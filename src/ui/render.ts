import type { Fact, PageReport, Severity, SiteFinding, Verdict } from '../types.js';
import { formatBytes, fileName } from '../rules.js';

/**
 * DOM helpers for the popup and the report tab. Text from the page (titles,
 * URLs, file names) only ever goes in through textContent: nothing on these
 * pages is built from HTML strings.
 */
type Child = Node | string | false | null | undefined;
interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<Record<'click' | 'toggle', (event: Event) => void>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) element.setAttribute(name, value);
  for (const [name, listener] of Object.entries(props.on ?? {})) if (listener) element.addEventListener(name, listener);
  for (const child of children) if (child !== false && child !== null && child !== undefined) element.append(child);
  return element;
}

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string>, ...children: SVGElement[]): SVGElement {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

/** The mark: the report's scale ring with the good glyph's tick. */
export function mark(size: number): SVGElement {
  return svg(
    'svg',
    { class: 'mark', width: String(size), height: String(size), viewBox: '0 0 32 32', 'aria-hidden': 'true' },
    svg('rect', { class: 'm-bg', width: '32', height: '32', rx: '8' }),
    svg('circle', { class: 'm-ring', cx: '16', cy: '16', r: '9' }),
    svg('circle', { class: 'm-arc', cx: '16', cy: '16', r: '9' }),
    svg('path', { class: 'm-tick', d: 'M12 16.4l2.9 2.9 5.4-5.8' }),
  );
}

const ICONS = {
  refresh: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
  copy: ['M5 15V6a2 2 0 0 1 2-2h9'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  lock: ['M8 11V7a4 4 0 0 1 8 0v4'],
  chevron: ['M9 6l6 6-6 6'],
} as const;

export function icon(name: keyof typeof ICONS, className?: string): SVGElement {
  const element = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', ...(className ? { class: className } : {}) }, ...ICONS[name].map((d) => svg('path', { d })));
  if (name === 'copy') element.prepend(svg('rect', { x: '9', y: '9', width: '11', height: '11', rx: '2' }));
  if (name === 'lock') element.prepend(svg('rect', { x: '5', y: '11', width: '14', height: '10', rx: '2' }));
  return element;
}

const WORD: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low', info: 'Note' };

export function glyph(): HTMLSpanElement {
  return h('span', { class: 'glyph', attrs: { 'aria-hidden': 'true' } });
}

export function verdictEl(verdict: Verdict): HTMLElement {
  return h(
    'div',
    { class: `verdict s-${verdict.level}` },
    glyph(),
    h('p', { class: 'verdict-title', text: verdict.title }),
    h('p', { class: 'verdict-sub' }, h('span', { class: 'verdict-word', text: verdict.word }), verdict.word && verdict.sub ? ` · ${verdict.sub}` : verdict.sub),
  );
}

export function factsEl(facts: Fact[]): HTMLElement {
  return h(
    'dl',
    { class: 'facts' },
    ...facts.map((fact) =>
      h(
        'div',
        { class: `fact${fact.flag ? ` s-${fact.flag}` : ''}` },
        h('dt', { text: fact.label }),
        h('dd', {}, fact.flag ? glyph() : null, fact.value),
        fact.hint ? h('dd', { class: 'fact-hint', text: fact.hint }) : null,
      ),
    ),
  );
}

export function findingEl(finding: SiteFinding, open: boolean): HTMLElement {
  const details = h(
    'details',
    { class: 'finding' },
    h(
      'summary',
      {},
      h('span', { class: `sev s-${finding.severity}` }, glyph(), WORD[finding.severity]),
      h('span', { class: 'finding-msg', text: finding.message }),
      icon('chevron', 'chev'),
    ),
    finding.detail ? h('div', { class: 'finding-detail' }, h('p', {}, ...inline(finding.detail))) : null,
  );
  details.open = open;
  return h('li', {}, details);
}

/** Text with the CLI's one markup, backticks for code, as text nodes and <code> elements. */
export function inline(text: string): Array<string | HTMLElement> {
  return text.split('`').map((part, index) => (index % 2 === 1 ? h('code', { text: part }) : part));
}

/** "1 file", "3 files". */
export function plural(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

/** "2 high · 1 low", or "nothing" when there is no finding above a note. */
export function tally(findings: SiteFinding[]): string {
  const parts = (['high', 'medium', 'low'] as const).map((severity) => [severity, findings.filter((finding) => finding.severity === severity).length] as const).filter(([, n]) => n > 0);
  return parts.map(([severity, n]) => `${n} ${severity}`).join(' · ') || 'nothing';
}

/** A button that copies text and says so for a moment. */
export function copyButton(label: string, text: () => string, props: { iconOnly?: boolean; class?: string } = {}): HTMLButtonElement {
  const button = h('button', { class: props.class ?? (props.iconOnly ? 'icon-btn' : 'btn'), attrs: { type: 'button', ...(props.iconOnly ? { 'aria-label': label } : {}) } }, icon('copy'), props.iconOnly ? null : h('span', { text: label }));
  button.addEventListener('click', () => {
    void navigator.clipboard.writeText(text()).then(() => {
      const status = props.iconOnly ? button : button.querySelector('span');
      if (props.iconOnly) button.setAttribute('aria-label', 'Copied');
      else if (status) status.textContent = 'Copied';
      setTimeout(() => {
        if (props.iconOnly) button.setAttribute('aria-label', label);
        else if (status) status.textContent = label;
      }, 1500);
    });
  });
  return button;
}

export function commandEl(next: PageReport['next']): HTMLElement {
  return h(
    'div',
    {},
    h('p', { class: 'x-muted', text: next.label, attrs: { style: 'font-size: 11.5px; margin-bottom: 4px' } }),
    h('div', { class: 'cmd' }, h('code', { text: next.command }), copyButton('Copy the command', () => next.command, { iconOnly: true })),
  );
}

export function privacyEl(): HTMLElement {
  return h('p', { class: 'privacy' }, icon('lock'), 'Read in this tab only. Nothing leaves your browser.');
}

/** The report as Copy as JSON gives it. */
export function reportJson(report: PageReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Rows of the Scripts table. */
export function scriptRows(report: PageReport): HTMLTableRowElement[] {
  const largest = Math.max(1, ...report.scripts.map((script) => script.bytes));
  return report.scripts.map((script) =>
    h(
      'tr',
      {},
      h('td', { class: 'file', text: fileName(script.url), attrs: { title: script.url } }),
      h('td', {}, h('span', { class: script.initial ? 'tag tag-strong' : 'tag', text: script.initial ? 'Initial' : 'Lazy' })),
      h('td', { class: 'num' }, script.bytes > 0 ? formatBytes(script.bytes) : '–', h('span', { class: 'bar' }, h('span', { attrs: { style: `width: ${Math.round((script.bytes / largest) * 100)}%` } }))),
      h('td', { class: 'num', text: script.sent > 0 ? formatBytes(script.sent) : '–' }),
      h('td', { class: 'x-muted', text: script.seen ?? '' }),
    ),
  );
}

/** Follows the browser's light or dark preference, live. */
export function followTheme(root: HTMLElement = document.documentElement): void {
  const query = matchMedia('(prefers-color-scheme: dark)');
  const apply = (): void => {
    root.dataset['theme'] = query.matches ? 'dark' : 'light';
  };
  apply();
  query.addEventListener('change', apply);
}
