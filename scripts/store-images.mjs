// Makes the store images from the end-to-end screenshots (run `npm run e2e`
// first): four 1280 × 800 screenshots and the 440 × 280 small promo tile, in
// store/images/. Each is an HTML page rendered by Chromium, so the text is
// real text in the report's own palette and fonts.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumPath } from '../test/e2e/chromium.mjs';

const shots = resolve('test/e2e/out');
const need = ['legacy.example.test-popup.png', 'shop.example.test-popup.png', 'legacy.example.test-report.png', 'legacy.example.test-scripts.png', 'claims.example.test-popup.png', 'legacy.example.test-popup-dark.png', 'news.example.test-popup.png'];
for (const file of need) if (!existsSync(resolve(shots, file))) throw new Error(`Missing ${file}: run npm run e2e first.`);
const image = (file) => `data:image/png;base64,${readFileSync(resolve(shots, file)).toString('base64')}`;
const mark = readFileSync('design/mark.svg', 'utf8');
const out = resolve('store/images');
mkdirSync(out, { recursive: true });

const page = (body, width = 1280, height = 800) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1b1d21; background: #f7f7f5; }
  .frame { border-radius: 12px; box-shadow: 0 1px 2px rgba(20,22,26,.08), 0 12px 32px rgba(20,22,26,.16); display: block; }
  h1 { font-size: 40px; line-height: 1.15; letter-spacing: -.015em; }
  p { font-size: 19px; line-height: 1.45; color: #5d636e; }
  .brand { display: flex; align-items: center; gap: 12px; font-size: 18px; font-weight: 700; }
  .brand svg { width: 36px; height: 36px; }
</style></head><body>${body}</body></html>`;

const screens = {
  '1-popup.png': page(`<div style="display:flex;height:100%;align-items:center;gap:56px;padding:0 72px">
    <div style="flex:1;display:flex;flex-direction:column;gap:18px">
      <div class="brand">${mark}ng-checkup</div>
      <h1>Which Angular a site runs, and whether it is in trouble</h1>
      <p>One click: the version and its support window, a development build in production, zone.js or zoneless, server rendering and hydration, and how much JavaScript loads first.</p>
    </div>
    <img class="frame" src="${image('legacy.example.test-popup.png')}" width="360" height="600">
    <img class="frame" src="${image('shop.example.test-popup.png')}" width="360" height="600">
  </div>`),
  '2-report.png': page(`<div style="padding:20px 40px 0;display:flex;flex-direction:column;gap:14px;height:100%">
    <h1 style="font-size:28px">The full report: every finding with its explanation</h1>
    <img class="frame" src="${image('legacy.example.test-report.png')}" style="width:1200px;height:auto">
  </div>`),
  '3-scripts.png': page(`<div style="padding:20px 40px 0;display:flex;flex-direction:column;gap:14px;height:100%">
    <h1 style="font-size:28px">Every script of the site, initial and loaded later, with its size</h1>
    <img class="frame" src="${image('legacy.example.test-scripts.png')}" style="width:1200px;height:auto">
  </div>`),
  '4-states.png': page(`<div style="display:flex;height:100%;align-items:center;justify-content:center;gap:40px;padding:0 40px">
    <figure style="display:flex;flex-direction:column;gap:12px;align-items:center"><img class="frame" src="${image('claims.example.test-popup.png')}" width="360" height="600"><p>AngularJS next to Angular</p></figure>
    <figure style="display:flex;flex-direction:column;gap:12px;align-items:center"><img class="frame" src="${image('legacy.example.test-popup-dark.png')}" width="360" height="600"><p>Follows the dark theme</p></figure>
    <figure style="display:flex;flex-direction:column;gap:12px;align-items:center"><img class="frame" src="${image('news.example.test-popup.png')}" width="360" height="600"><p>Says so when it is not Angular</p></figure>
  </div>`),
  'promo-small.png': page(`<div style="height:100%;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:0 32px;background:#3b5bdb;color:#fff">
    <div class="brand" style="font-size:26px;color:#fff">${mark.replace('fill="#3b5bdb"', 'fill="#ffffff" fill-opacity="0.16"')}ng-checkup</div>
    <p style="color:#e8edfd;font-size:18px">Which Angular a site runs, and whether it is in trouble</p>
  </div>`, 440, 280),
};

const browser = await chromium.launch({ executablePath: chromiumPath() });
try {
  for (const [name, html] of Object.entries(screens)) {
    const size = name === 'promo-small.png' ? { width: 440, height: 280 } : { width: 1280, height: 800 };
    const tab = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.screenshot({ path: resolve(out, name) });
    await tab.close();
  }
} finally {
  await browser.close();
}
console.log(`Store images in ${out}`);
