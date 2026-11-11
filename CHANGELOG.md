# Changelog

## 0.1.0 (unreleased)

First version, for Chrome and other Chromium browsers (Edge, Brave, Opera, Vivaldi).

- **Popup on click**: which Angular or AngularJS the page runs and whether it is in trouble, as a shape and a word: version and support window, development build in production, zone.js or zoneless, client or server rendering with hydration, initial JavaScript. Findings worst first, each with its explanation.
- **Same rules as `ng-checkup url`**: versions, AngularJS, other frameworks and zone.js come from `ng-checkup-cli/site` (ng-checkup-cli 2.3.1), so the extension and the CLI cannot disagree. A test keeps the latest Angular major equal to the CLI's.
- **Only a running page shows**: `window.ng` (a development build), `ng-server-context` and `ngh` (server rendering, hydration), `ngSkipHydration`, and script sizes from resource timing, initial and loaded later.
- **Full report tab** from "Open full report": Overview and Scripts, Copy as JSON.
- **Toolbar badge** after a check: the Angular major (or `1.x` for AngularJS), coloured by the verdict, which the tooltip says in words.
- **localhost** is development: a development build there is a note, not a finding, and sizes are not measured.
- Checked on real Angular 14 and 22 builds (production, development, SSG, SSR). Hydration is read from `__nghData__` in the transfer state, because Angular removes the `ngh` markers while it hydrates.
- Permissions `activeTab`, `scripting` and `storage` only; the install dialog shows no warning. Nothing is sent anywhere.
