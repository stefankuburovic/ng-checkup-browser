import { assessSite, isOwnScript, mergeSignals, type SiteProbe } from 'ng-checkup-cli/site';
import { INITIAL_JS_BUDGET } from './constants.js';
import type { Fact, PageGlobals, PageReport, RawPage, Signals, SiteFinding, Verdict } from './types.js';

const SEVERITY_ORDER: Record<SiteFinding['severity'], number> = { high: 0, medium: 1, low: 2, info: 3 };

/** localhost, 127.0.0.1, [::1] and *.localhost: where a development build is the point. */
export function isLocal(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.localhost');
}

/**
 * The page's frameworks, findings and facts. Versions, AngularJS, other
 * frameworks and zone.js go through the CLI's own rules (`mergeSignals`,
 * `assessSite`), so `ng-checkup url` and the extension cannot disagree; what
 * only a running page shows is added after them.
 */
export function buildReport(raw: RawPage, globals: PageGlobals, options: { latest: number; checkedAt: string; tool: string }): PageReport {
  const local = isLocal(raw.url);

  // Every place a framework showed itself, as the CLI collects them, plus the page's live globals.
  const found: Array<{ signals: Signals; evidence: string }> = [{ signals: raw.pageSignals, evidence: 'the page' }];
  for (const version of raw.ngVersions) found.push({ signals: { angular: { versions: [version] } }, evidence: 'ng-version' });
  for (const script of raw.scripts) found.push({ signals: script.signals, evidence: fileName(script.url) });
  if (globals.angularJsVersion) found.push({ signals: { angularJs: { version: globals.angularJsVersion } }, evidence: 'window.angular' });
  if (globals.nextData) found.push({ signals: { next: true }, evidence: 'the page' });
  if (globals.nuxt) found.push({ signals: { nuxt: true }, evidence: 'the page' });
  if (globals.zone) found.push({ signals: { zoneJs: true }, evidence: 'window.Zone' });
  const merged = mergeSignals(found);

  const probe: SiteProbe = {
    url: raw.url,
    finalUrl: raw.url,
    ...(raw.title ? { title: raw.title } : {}),
    ...merged,
    scripts: raw.scripts.map((script) => ({ url: script.url, bytes: script.bytes })),
    skipped: raw.skipped,
  };
  const findings = assessSite(probe, options.latest);

  const angularFramework = merged.frameworks.find((framework) => framework.name === 'Angular');
  const angularJsFramework = merged.frameworks.find((framework) => framework.name === 'AngularJS');
  const javascript = measureJavaScript(raw);

  let angular: PageReport['angular'];
  if (angularFramework) {
    const server = raw.serverContext !== undefined;
    angular = {
      ...(angularFramework.version ? { version: angularFramework.version } : {}),
      build: globals.ngDebugApi ? 'development' : 'production',
      zoneJs: merged.zoneJs === true || globals.zone,
      rendering: server ? 'server' : 'client',
      ...(raw.serverContext ? { serverContext: raw.serverContext } : {}),
      // Angular removes the ngh markers while it hydrates; the hydration data in the transfer state stays.
      // Without either the rule stays quiet and says server-rendered only.
      hydration: server && (raw.hydrationData || raw.hydrationMarkers > 0),
      skippedHydration: raw.skippedHydration,
    };

    if (angular.build === 'development') {
      findings.push(
        local
          ? { severity: 'info', message: 'Production checks are off on localhost', detail: 'A development build, open source maps and bundle sizes are what ng serve is for. They are checked on any other address.' }
          : {
              severity: 'high',
              message: 'A development build runs in production',
              detail: "Angular's debugging API (window.ng) is on this page, and only development builds publish it. Every visitor pays for dev-mode checks and unminified code. Deploy the output of ng build with the production configuration.",
            },
      );
    }
    if (angular.rendering === 'server' && angular.skippedHydration.length > 0) {
      const names = unique(angular.skippedHydration);
      findings.push({
        severity: 'low',
        message: `Hydration is skipped for ${count(angular.skippedHydration.length, 'component')}`,
        detail: `ngSkipHydration on ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}: Angular throws their server HTML away and renders them again in the browser. Fine for a widget that touches the DOM directly; worth a look for anything above the fold.`,
      });
    }
  }
  if ((angularFramework || angularJsFramework) && !local && javascript.measured && javascript.initial.bytes > INITIAL_JS_BUDGET) {
    findings.push({
      severity: 'low',
      message: `${formatBytes(javascript.initial.bytes)} of JavaScript before the page is usable`,
      detail: `Measured as the browser runs it${javascript.initial.sent > 0 ? ` (${formatBytes(javascript.initial.sent)} over the network)` : ''}. Above the 1 MB error budget a new Angular CLI project starts with.`,
    });
  }
  findings.sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]);

  const verdict = verdictOf(merged.frameworks, findings, options.latest, local);
  return {
    version: 1,
    tool: options.tool,
    url: raw.url,
    title: raw.title,
    checkedAt: options.checkedAt,
    mode: 'click',
    local,
    latestMajor: options.latest,
    latestSource: 'built-in',
    frameworks: merged.frameworks,
    ...(angular ? { angular } : {}),
    javascript,
    scripts: scriptRows(raw),
    scriptsRead: raw.scripts.length,
    scriptsSkipped: raw.skipped,
    facts: verdict.kind === 'angular' ? factsOf(angular, javascript, raw, local) : [],
    findings: verdict.kind === 'angular' ? findings : [],
    verdict,
    next: local
      ? { label: 'This is your own code. In the project, run:', command: 'npx ng-checkup-cli --watch' }
      : angularJsFramework
        ? { label: 'The migration plan comes from the code. In its repository, run:', command: 'npx ng-checkup-cli --plan' }
        : { label: 'The code has 15 more areas. In its repository, run:', command: 'npx ng-checkup-cli --plan' },
  };
}

/** The verdict line: the framework, a word for its state, and the worst finding as the shape. */
export function verdictOf(frameworks: SiteProbe['frameworks'], findings: SiteFinding[], latest: number, local: boolean): Verdict {
  const angular = frameworks.find((framework) => framework.name === 'Angular');
  const angularJs = frameworks.find((framework) => framework.name === 'AngularJS');
  if (!angular && !angularJs) {
    if (frameworks.length === 0) return { kind: 'none', level: 'info', title: 'No Angular found', word: '', sub: '' };
    return { kind: 'other', level: 'info', title: 'Not an Angular app', word: '', sub: frameworks.map(label).join(' · ') };
  }
  const title = [angularJs, angular].filter((framework) => framework !== undefined).map(label).join(' + ');
  const worst = findings.find((finding) => finding.severity === 'high' || finding.severity === 'medium');
  const level: Verdict['level'] = worst ? (worst.severity as 'high' | 'medium') : 'ok';

  let word: string;
  let sub: string;
  const major = angular?.version ? Number(angular.version.split('.')[0]) : undefined;
  const gap = major === undefined ? undefined : Math.max(0, latest - major);
  if (angularJs) {
    word = 'Out of support';
    sub = angular ? 'a migration is under way' : 'end of life since January 2022';
  } else if (gap === undefined) {
    word = worst ? 'Needs attention' : 'Angular';
    sub = 'version not readable from the page';
  } else if (gap >= 3) {
    word = 'Out of support';
    sub = `${gap} majors behind ${latest}`;
  } else if (gap === 2) {
    word = 'Support ends soon';
    sub = `two majors behind ${latest}`;
  } else {
    word = worst?.severity === 'high' ? 'Needs attention' : gap === 1 ? 'Supported' : 'Up to date';
    sub = gap === 1 ? `one major behind ${latest}` : 'the current major';
  }
  if (local) sub = 'your development server';
  return { kind: 'angular', level, title, word, sub };
}

/** Initial and later JavaScript of the page's own site, from resource timing. */
export function measureJavaScript(raw: RawPage): PageReport['javascript'] {
  const own = raw.resources.filter((entry) => safeOwn(entry.url, raw.url));
  const initial = own.filter((entry) => raw.loadEnd === 0 || entry.end <= raw.loadEnd);
  const later = own.filter((entry) => !initial.includes(entry));
  const sum = (entries: typeof own): { bytes: number; sent: number; files: number } => ({
    bytes: entries.reduce((total, entry) => total + entry.size, 0),
    sent: entries.reduce((total, entry) => total + entry.sent, 0),
    files: entries.length,
  });
  return { measured: own.some((entry) => entry.size > 0), initial: sum(initial), later: sum(later), thirdParty: raw.resources.length - own.length };
}

function factsOf(angular: PageReport['angular'], javascript: PageReport['javascript'], raw: RawPage, local: boolean): Fact[] {
  const facts: Fact[] = [];
  if (angular) {
    facts.push(
      angular.build === 'development'
        ? { label: 'Build', value: 'Development', hint: local ? 'expected on localhost' : 'window.ng is on the page', flag: local ? 'info' : 'high' }
        : { label: 'Build', value: 'Production' },
    );
    facts.push(angular.zoneJs ? { label: 'Change detection', value: 'zone.js', hint: 'every event checks the app' } : { label: 'Change detection', value: 'Zoneless', hint: 'no zone.js loaded' });
    facts.push(
      angular.rendering === 'client'
        ? { label: 'Rendering', value: 'Client only', hint: 'no server HTML' }
        : angular.hydration
          ? { label: 'Rendering', value: 'Server + hydration', hint: `ng-server-context: ${angular.serverContext}` }
          : { label: 'Rendering', value: 'Server-rendered', hint: `ng-server-context: ${angular.serverContext}` },
    );
  } else {
    facts.push({ label: 'Build', value: '–', hint: 'AngularJS has no build mode' });
  }
  facts.push({ label: 'Scripts read', value: String(raw.scripts.length), hint: raw.skipped > 0 ? `${raw.skipped} skipped: other sites or the limit` : 'from this site' });
  if (local) {
    facts.push({ label: 'Initial JavaScript', value: '–', hint: 'not measured in development' }, { label: 'Loaded later', value: '–', hint: 'not measured in development' });
  } else if (!javascript.measured) {
    facts.push({ label: 'Initial JavaScript', value: '–', hint: 'the server hides script sizes' }, { label: 'Loaded later', value: '–', hint: 'the server hides script sizes' });
  } else {
    facts.push(
      { label: 'Initial JavaScript', value: formatBytes(javascript.initial.bytes), hint: `${count(javascript.initial.files, 'file')}${javascript.initial.sent > 0 ? `, ${formatBytes(javascript.initial.sent)} sent` : ''}` },
      { label: 'Loaded later', value: javascript.later.files === 0 ? '–' : formatBytes(javascript.later.bytes), hint: javascript.later.files === 0 ? 'no lazy chunk yet' : `${count(javascript.later.files, 'lazy chunk')} so far` },
    );
  }
  return facts;
}

/** One row per own script in resource timing, with what it showed when it was read. */
function scriptRows(raw: RawPage): PageReport['scripts'] {
  const seen = new Map(raw.scripts.map((script) => [script.url, describe(script.signals)]));
  return raw.resources
    .filter((entry) => safeOwn(entry.url, raw.url))
    .map((entry) => {
      const label = seen.get(entry.url);
      return { url: entry.url, initial: raw.loadEnd === 0 || entry.end <= raw.loadEnd, bytes: entry.size, sent: entry.sent, ...(label ? { seen: label } : {}) };
    });
}

/** What one script shows, for the Scripts table: "Angular 14.3.0", "zone.js". */
function describe(signals: Signals): string | undefined {
  const parts: string[] = [];
  if (signals.angularJs) parts.push(`AngularJS${signals.angularJs.version ? ` ${signals.angularJs.version}` : ''}`);
  if (signals.angular) parts.push(`Angular${signals.angular.versions[0] ? ` ${signals.angular.versions[0]}` : ''}`);
  if (signals.zoneJs) parts.push('zone.js');
  if (signals.react) parts.push(`React${signals.react.version ? ` ${signals.react.version}` : ''}`);
  if (signals.vue) parts.push(`Vue${signals.vue.version ? ` ${signals.vue.version}` : ''}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function label(framework: SiteProbe['frameworks'][number]): string {
  return `${framework.name}${framework.version ? ` ${framework.version}` : ''}`;
}

function safeOwn(url: string, page: string): boolean {
  try {
    return isOwnScript(url, page);
  } catch {
    return false;
  }
}

/** "1.2 MB", "412 KB", "820 B": decimal units, as Angular's budgets use. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function count(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function fileName(url: string): string {
  try {
    return new URL(url).pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}
