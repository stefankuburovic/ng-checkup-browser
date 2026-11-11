// Renders design/mark.svg to the PNG icons Chrome needs (16, 32, 48, 128), with
// the Chromium that Playwright keeps (see test/e2e/chromium.mjs). Run after
// changing the mark: node scripts/icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { chromiumPath } from '../test/e2e/chromium.mjs';

const svg = readFileSync('design/mark.svg', 'utf8');
const browser = await chromium.launch({ executablePath: chromiumPath() });
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: `static/icons/${size}.png`, omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
