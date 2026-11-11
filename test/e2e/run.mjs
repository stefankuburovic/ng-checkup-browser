// End-to-end: the built extension in a real Chromium against the fixture
// sites. For each site it opens the page, then the popup as a page aimed at
// that tab (?target=), checks what it says and the badge, and saves
// screenshots of the popup and the report tab to test/e2e/out/.
//
// The test build gets host permissions for the fixture hosts in place of
// activeTab, which only a real click on the toolbar grants.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumPath } from './chromium.mjs';
import { EXPECT, SITES } from './fixtures.mjs';

const work = mkdtempSync(join(tmpdir(), 'ngc-e2e-'));
const extension = join(work, 'extension');
cpSync(resolve('dist'), extension, { recursive: true });
const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://*.example.test/*', 'http://localhost/*'];
writeFileSync(join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2));
const out = resolve('test/e2e/out');
mkdirSync(out, { recursive: true });

const server = createServer((request, response) => {
  const host = (request.headers.host ?? '').split(':')[0];
  const site = SITES[host];
  const entry = site?.[(request.url ?? '/').split('?')[0]];
  if (!entry) {
    response.writeHead(404).end();
    return;
  }
  const [type, body] = entry;
  response.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'content-length': Buffer.byteLength(body), 'cache-control': 'max-age=3600' });
  response.end(body);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;

const context = await chromium.launchPersistentContext(join(work, 'profile'), {
  executablePath: chromiumPath(),
  headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--host-resolver-rules=MAP *.example.test 127.0.0.1'],
});
const failures = [];
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;

  for (const [host, expect] of Object.entries(EXPECT)) {
    const url = `http://${host}:${port}/`;
    const site = await context.newPage();
    await site.goto(url, { waitUntil: 'load' });
    await site.waitForTimeout(400);

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 600 });
    await popup.goto(`chrome-extension://${id}/popup.html?target=${encodeURIComponent(`http://${host}/`)}`);
    await popup.waitForSelector('.verdict-title, .empty h2', { timeout: 15_000 });
    await popup.waitForTimeout(150);
    await popup.screenshot({ path: join(out, `${host}-popup.png`) });

    const said = await popup.evaluate(async (target) => {
      const [tab] = await chrome.tabs.query({ url: `${target}*` });
      return {
        title: document.querySelector('.verdict-title')?.textContent ?? '',
        word: document.querySelector('.verdict-word')?.textContent ?? '',
        empty: document.querySelector('.empty h2')?.textContent ?? '',
        text: document.querySelector('.empty p')?.textContent ?? '',
        findings: [...document.querySelectorAll('.finding-msg')].map((node) => node.textContent ?? ''),
        facts: [...document.querySelectorAll('.fact dd:not(.fact-hint)')].map((node) => node.textContent ?? ''),
        badge: tab?.id ? await chrome.action.getBadgeText({ tabId: tab.id }) : '?',
        tabId: tab?.id,
      };
    }, `http://${host}/`);

    const problems = [];
    if (expect.title && said.title !== expect.title) problems.push(`title "${said.title}"`);
    if (expect.word && said.word !== expect.word) problems.push(`word "${said.word}"`);
    if (expect.empty && said.empty !== expect.empty) problems.push(`empty "${said.empty}"`);
    if (expect.text && !said.text.includes(expect.text)) problems.push(`text "${said.text}"`);
    for (const finding of expect.findings ?? []) if (!said.findings.some((message) => message.includes(finding))) problems.push(`missing finding "${finding}"`);
    for (const fact of expect.facts ?? []) if (!said.facts.includes(fact)) problems.push(`missing fact "${fact}"`);
    if (said.badge !== expect.badge) problems.push(`badge "${said.badge}"`);
    console.log(`${problems.length === 0 ? 'ok  ' : 'FAIL'} ${host.padEnd(22)} ${said.title || said.empty} | ${said.word} | badge ${said.badge || '(none)'} | ${said.findings.join(' / ')}`);
    if (problems.length > 0) failures.push(`${host}: ${problems.join(', ')}`);

    if (said.title && said.tabId) {
      const report = await context.newPage();
      await report.setViewportSize({ width: 1200, height: 760 });
      await report.goto(`chrome-extension://${id}/report.html?tab=${said.tabId}`);
      await report.waitForSelector('.dt-content .section-title');
      await report.screenshot({ path: join(out, `${host}-report.png`) });
      await report.getByRole('tab', { name: /Scripts/ }).click();
      await report.screenshot({ path: join(out, `${host}-scripts.png`) });
      await report.close();
    }
    await popup.close();
    await site.close();
  }

  // Dark theme of the busiest popup.
  const dark = await context.newPage();
  await dark.emulateMedia({ colorScheme: 'dark' });
  const legacy = await context.newPage();
  await legacy.goto(`http://legacy.example.test:${port}/`, { waitUntil: 'load' });
  await dark.setViewportSize({ width: 360, height: 600 });
  await dark.goto(`chrome-extension://${id}/popup.html?target=${encodeURIComponent('http://legacy.example.test/')}`);
  await dark.waitForSelector('.verdict-title');
  await dark.screenshot({ path: join(out, 'legacy.example.test-popup-dark.png') });
} finally {
  await context.close();
  server.close();
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nAll ${Object.keys(EXPECT).length} sites as expected. Screenshots in test/e2e/out/.`);
