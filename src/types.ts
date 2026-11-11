import type { DetectedFramework, SiteFinding, Signals } from 'ng-checkup-cli/site';

export type { DetectedFramework, SiteFinding, Signals };

/** What the page's own JavaScript shows, read in the page's MAIN world. Plain values only. */
export interface PageGlobals {
  /** `window.ng.getComponent` exists: Angular's debugging API, which only development builds publish. */
  ngDebugApi: boolean;
  /** `window.Zone` is zone.js's class. */
  zone: boolean;
  /** `angular.version.full` of an AngularJS app. */
  angularJsVersion?: string;
  nextData: boolean;
  nuxt: boolean;
}

/** One script the page loaded, from its resource timing. */
export interface ResourceEntry {
  url: string;
  /** Milliseconds since navigation start. */
  start: number;
  end: number;
  /** Bytes as the browser runs it; 0 when a cross-origin server does not allow timing details. */
  size: number;
  /** Bytes over the network; 0 from cache or when not allowed. */
  sent: number;
}

/** What the collector read from the page, in its isolated world. */
export interface RawPage {
  url: string;
  title: string;
  /** `signalsInHtml` of the live document. */
  pageSignals: Signals;
  /** Values of every `ng-version` attribute (one per Angular root). */
  ngVersions: string[];
  /** `ng-server-context` on a root: `ssr`, `ssg` or another value Angular sets on the server. */
  serverContext?: string;
  /**
   * Elements carrying `ngh`, Angular's hydration marker. Angular removes them
   * while it hydrates, so on a running page this is usually 0: see `hydrationData`.
   */
  hydrationMarkers: number;
  /** `<script id="ng-state">`: transfer state from the server. */
  transferState: boolean;
  /**
   * The transfer state holds `__nghData__`, the hydration data the server
   * writes when hydration is on. It stays on the page after hydration.
   */
  hydrationData: boolean;
  /** Tag names of elements with `ngskiphydration`. */
  skippedHydration: string[];
  /** The page's own scripts that were read, with what each shows. */
  scripts: Array<{ url: string; bytes: number; signals: Signals }>;
  /** Scripts named but not read: another site, the request limit, too large, or failed. */
  skipped: number;
  /** Every script in the page's resource timing, own site or not. */
  resources: ResourceEntry[];
  /** `loadEventEnd` of the navigation; 0 while the page is still loading. */
  loadEnd: number;
}

export type Severity = SiteFinding['severity'];

/** The one-line answer: the worst finding as a shape, the framework, and a word for its state. */
export interface Verdict {
  kind: 'angular' | 'other' | 'none';
  /** The shape and colour: `high`, `medium`, or `ok` when nothing above low. */
  level: 'high' | 'medium' | 'ok' | 'info';
  title: string;
  word: string;
  sub: string;
}

/** A labelled value of the popup's fact grid. */
export interface Fact {
  label: string;
  value: string;
  hint?: string;
  /** Marks the value with a severity shape when it is itself a problem. */
  flag?: Severity;
}

/** The result of one check of one tab: what the popup, the badge and the report tab show, and what Copy as JSON gives. */
export interface PageReport {
  /** Of this shape. */
  version: 1;
  tool: string;
  url: string;
  title: string;
  checkedAt: string;
  /** 0.1 checks on click only; runtime errors arrive with every-page mode. */
  mode: 'click';
  /** localhost and friends: production rules are off. */
  local: boolean;
  latestMajor: number;
  latestSource: 'built-in';
  frameworks: DetectedFramework[];
  angular?: {
    version?: string;
    build: 'production' | 'development';
    zoneJs: boolean;
    rendering: 'client' | 'server';
    serverContext?: string;
    hydration: boolean;
    skippedHydration: string[];
  };
  javascript: {
    /** False when no size could be read (all scripts from a site that hides timing details). */
    measured: boolean;
    initial: { bytes: number; sent: number; files: number };
    later: { bytes: number; sent: number; files: number };
    thirdParty: number;
  };
  scripts: Array<{ url: string; initial: boolean; bytes: number; sent: number; seen?: string }>;
  scriptsRead: number;
  scriptsSkipped: number;
  facts: Fact[];
  findings: SiteFinding[];
  verdict: Verdict;
  /** The command that checks the code, and the line above it. */
  next: { label: string; command: string };
}
