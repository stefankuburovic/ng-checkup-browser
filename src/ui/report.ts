import { reportKey } from '../keys.js';
import { formatBytes } from '../rules.js';
import type { PageReport } from '../types.js';
import { commandEl, copyButton, factsEl, findingEl, followTheme, h, mark, plural, reportJson, scriptRows, tally, verdictEl } from './render.js';

/**
 * The full report in a tab of its own: what the popup's "Open full report"
 * opens, for a reader who never opens DevTools. It shows the tab's last
 * report from session storage and does not read the page again.
 */
followTheme();
const app = document.getElementById('app')!;

async function main(): Promise<void> {
  const tabId = Number(new URLSearchParams(location.search).get('tab'));
  const stored = Number.isInteger(tabId) ? await chrome.storage.session.get(reportKey(tabId)) : {};
  const report = stored[reportKey(tabId)] as PageReport | undefined;
  if (!report) {
    app.replaceChildren(h('div', { class: 'opt' }, h('div', { class: 'empty s-info' }, h('span', { class: 'glyph', attrs: { 'aria-hidden': 'true' } }), h('h2', { text: 'Nothing to show' }), h('p', { text: 'The page was closed or has moved on since it was checked. Open ng-checkup on it again.' }))));
    return;
  }
  document.title = `ng-checkup: ${report.verdict.title} · ${new URL(report.url).host}`;
  render(report, 'overview');
}

type Tab = 'overview' | 'scripts';

function render(report: PageReport, tab: Tab): void {
  const tabButton = (id: Tab, label: string, count: number): HTMLElement =>
    h('button', { class: 'dt-tab', attrs: { type: 'button', role: 'tab', 'aria-selected': String(tab === id), ...(tab === id ? { 'aria-current': 'page' } : {}) }, on: { click: () => render(report, id) } }, label, h('span', { class: 'dt-count', text: String(count) }));

  app.replaceChildren(
    h(
      'div',
      { class: 'dt' },
      h(
        'nav',
        { class: 'dt-bar', attrs: { 'aria-label': 'ng-checkup' } },
        h('span', { class: 'dt-brand' }, mark(18), 'ng-checkup'),
        h('div', { class: 'dt-tabs', attrs: { role: 'tablist' } }, tabButton('overview', 'Overview', report.findings.length), tabButton('scripts', 'Scripts', report.scripts.length)),
        h('span', { class: 'dt-spacer' }),
        h('div', { class: 'dt-tools' }, copyButton('Copy as JSON', () => reportJson(report))),
      ),
      h(
        'div',
        { class: 'dt-main' },
        h(
          'aside',
          { class: 'dt-side', attrs: { 'aria-label': 'Summary' } },
          verdictEl(report.verdict),
          factsEl(report.facts),
          h('div', { class: 'dt-meta' }, h('div', { text: report.url }), h('div', { text: `Checked ${new Date(report.checkedAt).toLocaleString()}, on click` }), h('div', { text: `Latest Angular: ${report.latestMajor}, from the list built into ${report.tool}` })),
        ),
        h('main', { class: 'dt-content' }, ...(tab === 'overview' ? overview(report) : scripts(report))),
      ),
    ),
  );
}

function overview(report: PageReport): HTMLElement[] {
  return [
    h('h2', { class: 'section-title', text: `What to look at · ${tally(report.findings)}` }),
    h('ul', { class: 'panel' }, ...report.findings.map((finding, index) => findingEl(finding, index < 2))),
    h('h2', { class: 'section-title', text: 'What the browser can’t see' }),
    h(
      'div',
      { class: 'panel', attrs: { style: 'padding: 14px 16px; display: flex; flex-direction: column; gap: 10px' } },
      h('p', { text: 'These checks read the running page. Standalone components, signals, type safety, tests, security in the code and 11 more areas need the source.' }),
      commandEl(report.next),
    ),
  ];
}

function scripts(report: PageReport): HTMLElement[] {
  const js = report.javascript;
  const total = js.initial.bytes + js.later.bytes;
  const initialShare = total > 0 ? Math.round((js.initial.bytes / total) * 100) : 100;
  return [
    h('h2', { class: 'section-title', text: `Scripts from ${new URL(report.url).host} · ${js.measured ? formatBytes(total) : 'sizes hidden'} in ${plural(report.scripts.length, 'file')}` }),
    h(
      'div',
      { class: 'panel', attrs: { style: 'padding: 14px 16px' } },
      h('div', { class: 'split', attrs: { 'aria-hidden': 'true' } }, h('span', { attrs: { style: `width: ${initialShare}%` } }), h('span', { attrs: { style: `width: ${100 - initialShare}%` } })),
      h(
        'p',
        { class: 'legend' },
        h('span', {}, h('i', {}), `Initial: ${formatBytes(js.initial.bytes)} in ${plural(js.initial.files, 'file')}${js.initial.sent ? `, ${formatBytes(js.initial.sent)} sent` : ''}`),
        h('span', {}, h('i', { class: 'lazy' }), js.later.files === 0 ? 'Loaded later: nothing yet' : `Loaded later: ${formatBytes(js.later.bytes)} in ${plural(js.later.files, 'file')}`),
        h('span', { text: `Third-party scripts: ${js.thirdParty}, not counted` }),
      ),
    ),
    h(
      'div',
      { class: 'panel tbl-wrap', attrs: { style: 'margin-top: 12px' } },
      h(
        'table',
        { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', { text: 'File', attrs: { scope: 'col' } }), h('th', { text: 'Loaded', attrs: { scope: 'col' } }), h('th', { class: 'num', text: 'Size', attrs: { scope: 'col' } }), h('th', { class: 'num', text: 'Sent', attrs: { scope: 'col' } }), h('th', { text: 'Seen in it', attrs: { scope: 'col' } }))),
        h('tbody', {}, ...scriptRows(report)),
      ),
    ),
    h('p', { class: 'x-muted', attrs: { style: 'margin-top: 10px; font-size: 12px' }, text: 'Size is the code as the browser runs it, Sent is what came over the network. Both come from the page’s own resource timing; a script from another site shows a size only if that site allows it. Public source maps arrive in 0.3.' }),
  ];
}

void main();
