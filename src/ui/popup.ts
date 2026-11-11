import { showBadge } from '../badge.js';
import { checkTab, type CheckOutcome } from '../check.js';
import type { PageReport } from '../types.js';
import { commandEl, copyButton, factsEl, findingEl, followTheme, glyph, h, icon, mark, privacyEl, reportJson, tally, verdictEl } from './render.js';

/**
 * The popup: checks the tab it was opened on and shows the verdict.
 *
 * `?target=<url prefix>` picks the tab by address instead of the active one.
 * Only the end-to-end tests use it: they open the popup as a page, where the
 * active tab is the popup itself.
 */
followTheme();
const app = document.getElementById('app')!;

async function main(): Promise<void> {
  const target = new URLSearchParams(location.search).get('target');
  const [tab] = target ? await chrome.tabs.query({ url: `${target}*` }) : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return show(header(''), empty('info', 'This page can’t be checked', 'There is no tab to read.'));
  const tabId = tab.id;
  const host = tab.url ? hostOf(tab.url) : '';

  const run = async (): Promise<void> => {
    show(header(host, run), loading());
    const outcome = await checkTab(tabId, tab.url);
    render(outcome, tabId, host, run);
  };
  await run();
}

function render(outcome: CheckOutcome, tabId: number, host: string, again: () => Promise<void>): void {
  if (outcome.state === 'restricted') return show(header(host), empty('info', 'This page can’t be checked', 'Browsers keep extensions out of their own pages, local files and the extension stores. Open a website in a normal tab.'));
  if (outcome.state === 'error') return show(header(host, again), empty('info', 'The check did not finish', outcome.message, h('button', { class: 'btn', text: 'Check again', attrs: { type: 'button' }, on: { click: () => void again() } })));
  const { report } = outcome;
  void showBadge(tabId, report);
  if (report.verdict.kind === 'none') {
    return show(header(host, again), empty('info', 'No Angular found', 'Nothing in the page or its own scripts looks like Angular, AngularJS, React or Vue. The app may load only after sign-in, or keep its code on another site.', h('button', { class: 'btn', text: 'Check again', attrs: { type: 'button' }, on: { click: () => void again() } })));
  }
  if (report.verdict.kind === 'other') {
    const names = report.frameworks.map((framework) => `${framework.name}${framework.version ? ` ${framework.version}` : ''}`);
    const runs = names.length > 1 ? `${names.slice(0, -1).join(', ')} with ${names.at(-1)}` : names[0];
    return show(header(host, again), empty('info', 'Not an Angular app', `This page runs ${runs}. ng-checkup checks Angular and AngularJS, so there is nothing more to say about it.`));
  }
  show(header(host, again), ...reportView(report, tabId));
}

function reportView(report: PageReport, tabId: number): HTMLElement[] {
  const list = h('ul', {}, ...report.findings.map((finding, index) => findingEl(finding, index === 0)));
  return [
    verdictEl(report.verdict),
    // The popup keeps the four facts that decide something; the report tab has all six.
    factsEl(report.facts.filter((fact) => fact.label !== 'Scripts read' && fact.label !== 'Loaded later')),
    h(
      'div',
      { class: 'pop-body' },
      h('div', { class: 'list-head' }, h('h2', { class: 'list-title', text: 'What to look at' }), h('span', { class: 'x-muted x-num', text: tally(report.findings), attrs: { style: 'font-size: 12px' } })),
      list,
    ),
    h(
      'footer',
      { class: 'pop-foot' },
      h(
        'div',
        { class: 'pop-actions' },
        h('button', { class: 'btn btn-primary', attrs: { type: 'button' }, on: { click: () => void openReport(tabId) } }, icon('external'), 'Open full report'),
        copyButton('Copy as JSON', () => reportJson(report)),
      ),
      commandEl(report.next),
      privacyEl(),
    ),
  ];
}

async function openReport(tabId: number): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL(`report.html?tab=${tabId}`) });
  window.close();
}

function header(host: string, again?: () => Promise<void>): HTMLElement {
  return h(
    'header',
    { class: 'pop-head' },
    mark(24),
    h('div', { class: 'pop-site' }, h('p', { class: 'pop-name', text: 'ng-checkup' }), h('p', { class: 'pop-host', text: host || '–', attrs: { title: host } })),
    again ? h('button', { class: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Check this page again' }, on: { click: () => void again() } }, icon('refresh')) : null,
  );
}

function loading(): HTMLElement {
  const facts = ['Build', 'Change detection', 'Rendering', 'Scripts read', 'Initial JavaScript', 'Loaded later'];
  return h(
    'div',
    { class: 'pop-loading' },
    h('div', { class: 'verdict', attrs: { style: 'grid-template-columns: 30px minmax(0, 1fr)' } }, h('span', { class: 'skel', attrs: { style: 'grid-row: 1 / span 2; width: 30px; height: 30px; border-radius: 50%' } }), h('span', { class: 'skel', attrs: { style: 'width: 70%; height: 16px' } }), h('span', { class: 'skel', attrs: { style: 'width: 45%' } })),
    h('dl', { class: 'facts' }, ...facts.map((label) => h('div', { class: 'fact' }, h('dt', { text: label }), h('dd', {}, h('span', { class: 'skel', attrs: { style: 'width: 60%; margin-top: 4px' } }))))),
    h('div', { class: 'empty', attrs: { style: 'justify-content: flex-start; padding-top: 28px' } }, h('p', { text: 'Reading the page and its scripts…', attrs: { role: 'status' } }), h('p', { text: 'Usually under a second; at most 12 scripts are read.' })),
  );
}

function empty(level: string, title: string, text: string, action?: HTMLElement): HTMLElement {
  return h('div', { class: 'pop-empty' }, h('div', { class: `empty s-${level}` }, glyph(), h('h2', { text: title }), h('p', { text }), action ?? null), h('footer', { class: 'pop-foot' }, privacyEl()));
}

function show(...children: HTMLElement[]): void {
  app.replaceChildren(...children);
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host + (parsed.pathname === '/' ? '' : parsed.pathname) : url;
  } catch {
    return url;
  }
}

void main();
