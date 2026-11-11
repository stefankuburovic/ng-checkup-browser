import { importsOfScript, isOwnScript, MAX_SCRIPT_BYTES, MAX_SCRIPTS, scriptsOfPage, signalsInHtml, signalsInScript } from 'ng-checkup-cli/site';
import type { RawPage, ResourceEntry } from '../types.js';

/** The document is read up to this length; an Angular root and its attributes are near the top. */
const MAX_HTML = 5_000_000;

/**
 * Reads the page as it is now: the live DOM, the scripts it loaded and the
 * timing of each. Runs in the extension's isolated world on the page, so the
 * page's own JavaScript cannot see or change it, and the script requests go
 * out as the page's own (from cache when the browser has them).
 *
 * The same limits as `ng-checkup url`: at most MAX_SCRIPTS scripts of the
 * page's own site, none above MAX_SCRIPT_BYTES. Nothing is clicked or sent.
 */
export async function collectPage(doc: Document = document, perf: Performance = performance, get: typeof fetch = fetch): Promise<RawPage> {
  const url = doc.location.href;
  const html = doc.documentElement.outerHTML.slice(0, MAX_HTML);

  const resources: ResourceEntry[] = perf
    .getEntriesByType('resource')
    .filter((entry): entry is PerformanceResourceTiming => 'initiatorType' in entry)
    .filter((entry) => entry.initiatorType === 'script' || ((entry.initiatorType === 'link' || entry.initiatorType === 'other') && /\.m?js(?:[?#]|$)/.test(entry.name)))
    .map((entry) => ({ url: entry.name, start: Math.round(entry.startTime), end: Math.round(entry.responseEnd), size: entry.decodedBodySize, sent: entry.transferSize }));
  const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

  // Scripts the HTML names, then the ones loaded later (lazy chunks), as the CLI would see them.
  const queue = [...scriptsOfPage(html, url), ...resources.map((entry) => entry.url)];
  const seen = new Set<string>();
  const scripts: RawPage['scripts'] = [];
  let skipped = 0;
  while (queue.length > 0) {
    const scriptUrl = queue.shift()!;
    if (seen.has(scriptUrl)) continue;
    seen.add(scriptUrl);
    if (!ownScript(scriptUrl, url) || scripts.length >= MAX_SCRIPTS) {
      skipped++;
      continue;
    }
    try {
      const response = await get(scriptUrl, { cache: 'force-cache', credentials: 'same-origin', signal: AbortSignal.timeout(10_000) });
      const length = Number(response.headers.get('content-length') ?? 0);
      if (!response.ok || length > MAX_SCRIPT_BYTES) {
        skipped++;
        continue;
      }
      const code = await response.text();
      if (code.length > MAX_SCRIPT_BYTES) {
        skipped++;
        continue;
      }
      scripts.push({ url: scriptUrl, bytes: code.length, signals: signalsInScript(code) });
      queue.push(...importsOfScript(code, scriptUrl).filter((next) => !seen.has(next)));
    } catch {
      skipped++;
    }
  }

  const all = (selector: string): Element[] => Array.from(doc.querySelectorAll(selector));
  const serverContext = doc.querySelector('[ng-server-context]')?.getAttribute('ng-server-context') ?? undefined;
  return {
    url,
    title: doc.title,
    pageSignals: signalsInHtml(html),
    ngVersions: all('[ng-version]').map((element) => element.getAttribute('ng-version') ?? '').filter((version) => /^\d+\.\d+\.\d+/.test(version)),
    ...(serverContext !== undefined ? { serverContext } : {}),
    hydrationMarkers: all('[ngh]').length,
    transferState: doc.getElementById('ng-state') !== null,
    hydrationData: /"__nghData__"\s*:/.test(doc.getElementById('ng-state')?.textContent?.slice(0, 200_000) ?? ''),
    skippedHydration: all('[ngskiphydration]').map((element) => element.tagName.toLowerCase()),
    scripts,
    skipped,
    resources,
    loadEnd: navigation && navigation.loadEventEnd > 0 ? Math.round(navigation.loadEventEnd) : 0,
  };
}

function ownScript(scriptUrl: string, pageUrl: string): boolean {
  try {
    return isOwnScript(scriptUrl, pageUrl);
  } catch {
    return false;
  }
}
