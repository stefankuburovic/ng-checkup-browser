import { collectPage } from './page.js';

/**
 * The content script the popup injects into the tab it was opened on. It
 * answers one message, `ngc:collect`, with what `collectPage` read. Injected
 * again on every check, so it registers its listener only once per page.
 */
const flag = '__ngCheckupCollector';
const scope = globalThis as unknown as Record<string, unknown>;
if (!scope[flag]) {
  scope[flag] = true;
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    // Only the extension itself can send to a content script, but check the shape anyway.
    if (sender.id !== chrome.runtime.id || typeof message !== 'object' || message === null || (message as { type?: unknown }).type !== 'ngc:collect') return false;
    collectPage()
      .then((page) => respond({ ok: true, page }))
      .catch((error: unknown) => respond({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  });
}
