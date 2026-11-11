import { readGlobals } from './collect/globals.js';
import { LATEST_ANGULAR_MAJOR, VERSION } from './constants.js';
import { buildReport } from './rules.js';
import type { PageReport, RawPage } from './types.js';

export type CheckOutcome = { state: 'report'; report: PageReport } | { state: 'restricted' } | { state: 'error'; message: string };

/** Browsers keep extensions out of their own pages and their extension stores. */
const STORES = [/^https:\/\/chromewebstore\.google\.com\//, /^https:\/\/chrome\.google\.com\/webstore/, /^https:\/\/microsoftedge\.microsoft\.com\/addons/, /^https:\/\/addons\.mozilla\.org\//];

export function isCheckable(url: string | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  return !STORES.some((store) => store.test(url));
}

export { reportKey } from './keys.js';
import { reportKey } from './keys.js';

/**
 * Checks one tab: its globals in the page's MAIN world, then the collector in
 * the isolated world, then the rules here. Needs access to the tab, which
 * `activeTab` grants when the user opens the popup on it.
 */
export async function checkTab(tabId: number, url: string | undefined): Promise<CheckOutcome> {
  if (!isCheckable(url)) return { state: 'restricted' };
  try {
    const [globals] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: readGlobals });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['collector.js'] });
    const answer = (await chrome.tabs.sendMessage(tabId, { type: 'ngc:collect' })) as { ok: true; page: RawPage } | { ok: false; error: string } | undefined;
    if (!answer || !answer.ok) return { state: 'error', message: answer && !answer.ok ? answer.error : 'The page did not answer.' };
    const report = buildReport(answer.page, globals?.result ?? { ngDebugApi: false, zone: false, nextData: false, nuxt: false }, {
      latest: LATEST_ANGULAR_MAJOR,
      checkedAt: new Date().toISOString(),
      tool: `ng-checkup ${VERSION}`,
    });
    await chrome.storage.session.set({ [reportKey(tabId)]: report });
    return { state: 'report', report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A file:// page without file access, an error page, a PDF: the browser refuses the injection.
    if (/Cannot access|cannot be scripted|chrome-extension:|extensions gallery|Missing host permission/i.test(message)) return { state: 'restricted' };
    return { state: 'error', message };
  }
}
