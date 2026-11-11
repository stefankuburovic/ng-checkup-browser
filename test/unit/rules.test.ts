import { BUNDLED_LATEST_ANGULAR_MAJOR } from 'ng-checkup-cli';
import { signalsInScript } from 'ng-checkup-cli/site';
import { describe, expect, it } from 'vitest';
import { badgeFor } from '../../src/badge.js';
import { isCheckable } from '../../src/check.js';
import { LATEST_ANGULAR_MAJOR } from '../../src/constants.js';
import { buildReport, formatBytes, isLocal } from '../../src/rules.js';
import type { PageGlobals, RawPage } from '../../src/types.js';

const NONE: PageGlobals = { ngDebugApi: false, zone: false, nextData: false, nuxt: false };
const options = { latest: 22, checkedAt: '2026-11-11T10:00:00.000Z', tool: 'ng-checkup 0.1.0' };

/** A page as the collector returns it, with the given overrides. */
function page(overrides: Partial<RawPage>): RawPage {
  return { url: 'https://app.example.org/', title: 'App', pageSignals: {}, ngVersions: [], hydrationMarkers: 0, transferState: false, hydrationData: false, skippedHydration: [], scripts: [], skipped: 0, resources: [], loadEnd: 900, ...overrides };
}
const script = (name: string, code: string) => ({ url: `https://app.example.org/${name}`, bytes: code.length, signals: signalsInScript(code) });
const timing = (name: string, end: number, size: number, sent: number) => ({ url: `https://app.example.org/${name}`, start: 0, end, size, sent });

describe('buildReport', () => {
  it('reads an old Angular development build in production, as in the design', () => {
    const report = buildReport(
      page({
        ngVersions: ['14.3.0'],
        scripts: [script('vendor.js', 'ɵɵdefineComponent new Version("14.3.0") new Version("14.3.0")'), script('polyfills.js', 'Zone.__symbol__("x")')],
        resources: [timing('runtime.js', 100, 13_000, 4_000), timing('vendor.js', 400, 1_012_000, 286_000), timing('main.js', 500, 588_000, 171_000), timing('src_app_case_module_ts.js', 2_000, 412_000, 103_000)],
      }),
      { ...NONE, ngDebugApi: true, zone: true },
      options,
    );
    expect(report.verdict).toEqual({ kind: 'angular', level: 'high', title: 'Angular 14.3.0', word: 'Out of support', sub: '8 majors behind 22' });
    expect(report.findings.map((finding) => [finding.severity, finding.message])).toEqual([
      ['high', 'Angular 14.3.0 is 8 majors behind 22 and out of support'],
      ['high', 'A development build runs in production'],
      ['low', '1.6 MB of JavaScript before the page is usable'],
    ]);
    expect(report.facts.map((fact) => `${fact.label}: ${fact.value}`)).toEqual(['Build: Development', 'Change detection: zone.js', 'Rendering: Client only', 'Scripts read: 2', 'Initial JavaScript: 1.6 MB', 'Loaded later: 412 KB']);
    expect(report.javascript.initial).toEqual({ bytes: 1_613_000, sent: 461_000, files: 3 });
    expect(report.scripts.find((row) => row.url.endsWith('vendor.js'))?.seen).toBe('Angular 14.3.0');
  });

  it('reads a current server-rendered app with hydration and a skipped component', () => {
    const report = buildReport(
      page({ ngVersions: ['22.2.4'], serverContext: 'ssr', hydrationMarkers: 0, transferState: true, hydrationData: true, skippedHydration: ['app-chat-widget', 'app-store-map'], resources: [timing('main-AB12.js', 300, 300_000, 90_000)] }),
      NONE,
      options,
    );
    expect(report.verdict).toMatchObject({ level: 'ok', word: 'Up to date', sub: 'the current major' });
    expect(report.angular).toMatchObject({ build: 'production', zoneJs: false, rendering: 'server', hydration: true });
    expect(report.facts.find((fact) => fact.label === 'Rendering')).toMatchObject({ value: 'Server + hydration', hint: 'ng-server-context: ssr' });
    expect(report.findings.map((finding) => finding.message)).toEqual(['Hydration is skipped for 2 components', 'Angular 22.2.4, the current major']);
  });

  it('also counts ngh markers as hydration, for a page read before Angular removed them', () => {
    const report = buildReport(page({ ngVersions: ['22.2.4'], serverContext: 'ssr', hydrationMarkers: 3, transferState: true }), NONE, options);
    expect(report.angular?.hydration).toBe(true);
  });

  it('says server-rendered, not hydrated, when no hydration marker is left on the page', () => {
    const report = buildReport(page({ ngVersions: ['20.3.0'], serverContext: 'ssg' }), NONE, options);
    expect(report.facts.find((fact) => fact.label === 'Rendering')?.value).toBe('Server-rendered');
    expect(report.verdict).toMatchObject({ word: 'Support ends soon', sub: 'two majors behind 22', level: 'medium' });
  });

  it('reads AngularJS next to Angular as a migration under way', () => {
    const report = buildReport(page({ ngVersions: ['17.3.12'] }), { ...NONE, angularJsVersion: '1.8.3', zone: true }, options);
    expect(report.verdict).toMatchObject({ title: 'AngularJS 1.8.3 + Angular 17.3.12', word: 'Out of support', sub: 'a migration is under way' });
    expect(report.findings[0]?.message).toBe('AngularJS 1.8.3 is end of life since January 2022');
    expect(report.next.command).toBe('npx ng-checkup-cli --plan');
  });

  it('turns production checks off on localhost', () => {
    const report = buildReport(page({ url: 'http://localhost:4200/', ngVersions: ['22.2.4'], resources: [timing('main.js', 300, 5_000_000, 0)] }), { ...NONE, ngDebugApi: true }, { ...options });
    expect(report.local).toBe(true);
    expect(report.findings.map((finding) => [finding.severity, finding.message])).toEqual([
      ['info', 'Angular 22.2.4, the current major'],
      ['info', 'Production checks are off on localhost'],
    ]);
    expect(report.verdict).toMatchObject({ level: 'ok', sub: 'your development server' });
    expect(report.facts.find((fact) => fact.label === 'Build')).toMatchObject({ value: 'Development', flag: 'info' });
  });

  it('names another framework and stays quiet about it', () => {
    const report = buildReport(page({ scripts: [script('app.js', 'version:"18.3.1",rendererPackageName:"react-dom"')] }), { ...NONE, nextData: true }, options);
    expect(report.verdict).toMatchObject({ kind: 'other', sub: 'React 18.3.1 · Next.js' });
    expect(report.findings).toEqual([]);
    expect(report.facts).toEqual([]);
  });

  it('says so when nothing is found', () => {
    expect(buildReport(page({}), NONE, options).verdict.kind).toBe('none');
  });

  it('does not measure scripts whose server hides the sizes', () => {
    const report = buildReport(page({ ngVersions: ['22.0.0'], resources: [timing('main.js', 300, 0, 0)] }), NONE, options);
    expect(report.javascript.measured).toBe(false);
    expect(report.facts.find((fact) => fact.label === 'Initial JavaScript')).toMatchObject({ value: '–', hint: 'the server hides script sizes' });
  });

  it('counts scripts from other sites apart', () => {
    const report = buildReport(page({ ngVersions: ['22.0.0'], resources: [timing('main.js', 300, 1000, 500), { url: 'https://widgets.other.net/chat.js', start: 0, end: 200, size: 9_000_000, sent: 0 }] }), NONE, options);
    expect(report.javascript.thirdParty).toBe(1);
    expect(report.javascript.initial.bytes).toBe(1000);
  });
});

describe('badgeFor', () => {
  const report = (versions: string[], globals: Partial<PageGlobals> = {}) => buildReport(page({ ngVersions: versions }), { ...NONE, ...globals }, options);

  it('shows the major, coloured by the verdict, and says the verdict in the title', () => {
    expect(badgeFor(report(['22.2.4']))).toEqual({ text: '22', colour: '#1f7a4d', title: 'ng-checkup: Angular 22.2.4, up to date' });
    expect(badgeFor(report(['20.3.0']))).toMatchObject({ text: '20', colour: '#8a5a00' });
    expect(badgeFor(report(['14.3.0'], { ngDebugApi: true }))).toEqual({ text: '14', colour: '#b42318', title: 'ng-checkup: Angular 14.3.0, out of support · 2 high findings' });
    expect(badgeFor(report(['17.3.12'], { angularJsVersion: '1.8.3' }))).toMatchObject({ text: '1.x', colour: '#b42318' });
    expect(badgeFor(buildReport(page({}), NONE, options))).toEqual({ text: '', title: 'ng-checkup: no Angular found on this page' });
  });

  it('turns red for a high finding even on a current Angular', () => {
    expect(badgeFor(report(['22.2.4'], { ngDebugApi: true }))).toMatchObject({ text: '22', colour: '#b42318' });
  });
});

describe('small rules', () => {
  it('knows the same latest Angular as the CLI', () => {
    expect(LATEST_ANGULAR_MAJOR).toBe(BUNDLED_LATEST_ANGULAR_MAJOR);
  });

  it('checks only websites, never browser pages or extension stores', () => {
    expect(isCheckable('https://app.example.org/x')).toBe(true);
    expect(isCheckable('http://localhost:4200/')).toBe(true);
    for (const url of ['chrome://settings', 'about:blank', 'file:///tmp/a.html', 'https://chromewebstore.google.com/detail/x', 'https://microsoftedge.microsoft.com/addons/x', undefined]) expect(isCheckable(url)).toBe(false);
  });

  it('treats localhost and its relatives as local, and nothing else', () => {
    for (const url of ['http://localhost:4200/', 'http://127.0.0.1:8080', 'http://app.localhost/', 'http://[::1]:4200/']) expect(isLocal(url)).toBe(true);
    for (const url of ['https://localhost.example.com/', 'https://app.example.org/']) expect(isLocal(url)).toBe(false);
  });

  it('formats bytes in decimal units, as Angular budgets do', () => {
    expect([formatBytes(820), formatBytes(412_000), formatBytes(2_415_000)]).toEqual(['820 B', '412 KB', '2.4 MB']);
  });
});
