// Small pages that carry the same signals real builds do, one per case of the
// design. They are not real Angular apps: each is the least that makes the
// signal true (an ng-version attribute, a `new Version("x")` in a bundle,
// window.ng in a development build), so a failing case points at one rule.
//
// To prove the signals on real builds, see "To prove before 0.1" in the spec.

const pad = (bytes) => `/*${'x'.repeat(bytes)}*/\n`;

/** host → { path → [content type, body] } */
export const SITES = {
  'legacy.example.test': {
    '/': ['text/html', `<!doctype html><html><head><title>Cases</title></head><body>
<app-root ng-version="14.3.0"><h1>Cases</h1></app-root>
<script src="runtime.js"></script><script src="polyfills.js"></script><script src="vendor.js"></script><script src="main.js"></script>
</body></html>`],
    '/runtime.js': ['text/javascript', `${pad(12_000)}`],
    '/polyfills.js': ['text/javascript', `window.Zone = function Zone() {}; Zone.__symbol__ = function (name) { return '__zone_symbol__' + name; };\n${pad(300_000)}`],
    '/vendor.js': ['text/javascript', `function Version(full) { this.full = full; }\nvar core = new Version("14.3.0"), common = new Version("14.3.0"); /* ɵɵdefineComponent */\n${pad(1_000_000)}`],
    '/main.js': ['text/javascript', `window.ng = { getComponent: function () { return null; } };
window.addEventListener('load', function () { setTimeout(function () { var s = document.createElement('script'); s.src = 'src_app_features_case_case_module_ts.js'; document.head.appendChild(s); }, 10); });
${pad(500_000)}`],
    '/src_app_features_case_case_module_ts.js': ['text/javascript', pad(400_000)],
  },
  'shop.example.test': {
    '/': ['text/html', `<!doctype html><html><head><title>Shop</title></head><body>
<app-root ng-version="22.2.4" ng-server-context="ssr"><main><h1>Catalog</h1><app-store-map ngskiphydration></app-store-map><app-chat-widget ngskiphydration></app-chat-widget></main></app-root>
<script id="ng-state" type="application/json">{"__nghData__":[{"t":{}}]}</script>
<script src="main-4F2A9C.js" type="module"></script>
</body></html>`],
    '/main-4F2A9C.js': ['text/javascript', `import "./chunk-7D1E.js";\nfunction Version(full) { this.full = full; }\nexport const core = new Version("22.2.4"); /* ɵɵdefineComponent */\n${pad(200_000)}`],
    '/chunk-7D1E.js': ['text/javascript', `export const shared = 1;\n${pad(100_000)}`],
  },
  'claims.example.test': {
    '/': ['text/html', `<!doctype html><html><head><title>Claims</title></head><body>
<div ng-app="claims"><app-root ng-version="17.3.12"></app-root></div>
<script src="angular.js"></script><script src="polyfills.js"></script><script src="main.js"></script>
</body></html>`],
    '/angular.js': ['text/javascript', `/** @license AngularJS v1.8.3 */\nwindow.angular = { version: { full: '1.8.3', major: 1, minor: 8 } };\n${pad(800_000)}`],
    '/polyfills.js': ['text/javascript', `window.Zone = function Zone() {}; Zone.__symbol__ = function (name) { return '__zone_symbol__' + name; };\n${pad(100_000)}`],
    '/main.js': ['text/javascript', `function Version(full) { this.full = full; }\nvar core = new Version("17.3.12"); /* ɵɵdefineComponent */\n${pad(600_000)}`],
  },
  'news.example.test': {
    '/': ['text/html', `<!doctype html><html><head><title>News</title></head><body><div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
<script src="/_next/static/app.js"></script></body></html>`],
    '/_next/static/app.js': ['text/javascript', `var rd = {bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"};\n${pad(50_000)}`],
  },
  'plain.example.test': {
    '/': ['text/html', `<!doctype html><html><head><title>Sign in</title></head><body><form><label>Name <input></label></form></body></html>`],
  },
  localhost: {
    '/': ['text/html', `<!doctype html><html><head><title>Dev</title></head><body>
<app-root ng-version="22.2.4"></app-root><script src="main.js" type="module"></script></body></html>`],
    '/main.js': ['text/javascript', `function Version(full) { this.full = full; }\nexport const core = new Version("22.2.4"); /* ɵɵdefineComponent */\nwindow.ng = { getComponent: function () { return null; } };\n${pad(3_000_000)}`],
  },
};

/** What the popup must say for each site, checked by run.mjs. */
export const EXPECT = {
  'legacy.example.test': { title: 'Angular 14.3.0', word: 'Out of support', findings: ['Angular 14.3.0 is 8 majors behind 22 and out of support', 'A development build runs in production', 'of JavaScript before the page is usable'], badge: '14' },
  'shop.example.test': { title: 'Angular 22.2.4', word: 'Up to date', findings: ['Hydration is skipped for 2 components', 'Angular 22.2.4, the current major'], facts: ['Server + hydration', 'Zoneless'], badge: '22' },
  'claims.example.test': { title: 'AngularJS 1.8.3 + Angular 17.3.12', word: 'Out of support', findings: ['AngularJS 1.8.3 is end of life since January 2022', 'Angular 17.3.12 is 5 majors behind 22 and out of support'], badge: '1.x' },
  'news.example.test': { empty: 'Not an Angular app', text: 'This page runs React 18.3.1 with Next.js.', badge: '' },
  'plain.example.test': { empty: 'No Angular found', badge: '' },
  localhost: { title: 'Angular 22.2.4', word: 'Up to date', findings: ['Production checks are off on localhost'], badge: '22' },
};
