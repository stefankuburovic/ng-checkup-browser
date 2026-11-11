// The Chromium to run: CHROMIUM_PATH, else the newest one Playwright has
// downloaded. Branded Chrome no longer loads unpacked extensions from the
// command line, so the tests need Chromium (or Chrome for Testing).
import { existsSync, readdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (platform() === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : platform() === 'win32' ? join(homedir(), 'AppData/Local/ms-playwright') : join(homedir(), '.cache/ms-playwright'));
  const builds = existsSync(cache) ? readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])) : [];
  const candidates = builds.flatMap((build) => [
    join(cache, build, 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium'),
    join(cache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    join(cache, build, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
    join(cache, build, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    join(cache, build, 'chrome-linux/chrome'),
    join(cache, build, 'chrome-linux64/chrome'),
    join(cache, build, 'chrome-win/chrome.exe'),
    join(cache, build, 'chrome-win64/chrome.exe'),
  ]);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('No Chromium found. Set CHROMIUM_PATH, or run npx playwright install chromium.');
  return found;
}
