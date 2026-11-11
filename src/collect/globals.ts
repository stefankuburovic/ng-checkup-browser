import type { PageGlobals } from '../types.js';

/**
 * Runs in the page's MAIN world through `chrome.scripting.executeScript`, so it
 * is sent as source text: it must not use anything outside its own body.
 *
 * The page owns these globals and can define them as it likes (getters that
 * throw, proxies), so every read is guarded and only plain values leave.
 */
export function readGlobals(): PageGlobals {
  const w = window as unknown as Record<string, unknown>;
  const read = <T>(get: () => T, fallback: T): T => {
    try {
      return get();
    } catch {
      return fallback;
    }
  };
  const ng = read(() => w['ng'] as Record<string, unknown> | undefined, undefined);
  const zone: unknown = read(() => w['Zone'], undefined);
  const angular = read(() => w['angular'] as { version?: { full?: unknown } } | undefined, undefined);
  const angularJsVersion = read(() => (typeof angular?.version?.full === 'string' && /^1\.\d+\.\d+/.test(angular.version.full) ? angular.version.full : undefined), undefined);
  const result: PageGlobals = {
    ngDebugApi: read(() => typeof ng === 'object' && ng !== null && typeof ng['getComponent'] === 'function', false),
    zone: read(() => typeof zone === 'function' && typeof (zone as { __symbol__?: unknown }).__symbol__ === 'function', false),
    nextData: read(() => document.getElementById('__NEXT_DATA__') !== null, false),
    nuxt: read(() => w['__NUXT__'] !== undefined || w['$nuxt'] !== undefined, false),
  };
  if (angularJsVersion) result.angularJsVersion = angularJsVersion;
  return result;
}
