// Checks the extension against real Angular builds, which the fixture sites
// only imitate. Serve each build on 127.0.0.1 and pass name=port pairs:
//
//   node test/e2e/real.mjs ng22-ssr=4101 ng22-dev=4102 ng14-prod=4103
//
// Each is opened as http://<name>.example.test:<port>/ (so the localhost rules
// stay off). For each it prints the raw signals twice, in the HTML the server
// sent and in the live DOM after the app started, then what the popup says,
// and saves screenshots as test/e2e/out/real-<name>-*.png.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { chromiumPath } from './chromium.mjs';

const targets = process.argv.slice(2).map((pair) => {
  const [name, port] = pair.split('=');
  return { name, url: `http://${name}.example.test:${port}/` };
});
if (targets.length === 0) throw new Error('Pass name=port pairs.');

const work = mkdtempSync(join(tmpdir(), 'ngc-real-'));
const extension = join(work, 'extension');
cpSync(resolve('dist'), extension, { recursive: true });
const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://*.example.test/*'];
writeFileSync(join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2));
const out = resolve('test/e2e/out');
mkdirSync(out, { recursive: true });

const context = await chromium.launchPersistentContext(join(work, 'profile'), {
  executablePath: chromiumPath(),
  headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--host-resolver-rules=MAP *.example.test 127.0.0.1'],
});
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  const results = [];

  for (const { name, url } of targets) {
    const site = await context.newPage();
    const response = await site.goto(url, { waitUntil: 'load' });
    const served = (await response?.text()) ?? '';
    await site.waitForTimeout(2000);
    const live = await site.evaluate(() => ({
      ngVersion: [...document.querySelectorAll('[ng-version]')].map((element) => element.getAttribute('ng-version')),
      serverContext: document.querySelector('[ng-server-context]')?.getAttribute('ng-server-context') ?? null,
      ngh: document.querySelectorAll('[ngh]').length,
      ngState: document.getElementById('ng-state') !== null,
      windowNg: typeof window.ng,
      ngGetComponent: typeof window.ng?.getComponent,
      zone: typeof window.Zone,
      zoneSymbol: typeof window.Zone?.__symbol__,
      ngDevMode: typeof window.ngDevMode,
      scripts: performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'script' || /\.m?js(\?|$)/.test(entry.name)).map((entry) => `${new URL(entry.name).pathname} ${entry.initiatorType} ${entry.decodedBodySize}`),
    }));
    const server = {
      ngVersion: /ng-version="([^"]+)"/.exec(served)?.[1] ?? null,
      serverContext: /ng-server-context="([^"]+)"/.exec(served)?.[1] ?? null,
      ngh: (served.match(/\sngh="/g) ?? []).length,
      ngState: /id="ng-state"/.test(served),
    };

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 360, height: 600 });
    await popup.goto(`chrome-extension://${id}/popup.html?target=${encodeURIComponent(url.replace(/:\d+\//, '/'))}`);
    await popup.waitForSelector('.verdict-title, .empty h2', { timeout: 20_000 });
    await popup.waitForTimeout(150);
    await popup.screenshot({ path: join(out, `real-${name}-popup.png`) });
    const said = await popup.evaluate(() => ({
      title: document.querySelector('.verdict-title, .empty h2')?.textContent ?? '',
      word: document.querySelector('.verdict-word')?.textContent ?? '',
      facts: [...document.querySelectorAll('.fact')].map((fact) => `${fact.querySelector('dt')?.textContent}: ${fact.querySelector('dd')?.textContent}`),
      findings: [...document.querySelectorAll('.finding')].map((finding) => `${finding.querySelector('.sev')?.textContent} ${finding.querySelector('.finding-msg')?.textContent}`),
    }));
    results.push({ name, server, live, said });
    await popup.close();
    await site.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await context.close();
  rmSync(work, { recursive: true, force: true });
}
