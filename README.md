# ng-checkup for the browser

Which Angular a site runs, and whether it is in trouble. Click the icon on any page: the popup says the Angular or AngularJS version and its support window, whether a development build runs in production, zone.js or zoneless, client or server rendering with hydration, and how much JavaScript loads before the page is usable. The full report tab adds every script with its size.

It is [`ng-checkup url`](https://github.com/stefankuburovic/ng-checkup#check-a-live-site) in the browser, with the same rules, plus what only a running page shows. For the 15 areas of the code itself (standalone components, signals, type safety, tests, the upgrade plan), run the CLI in the repository: `npx ng-checkup-cli --plan`.

## Install while it is not in the store

```sh
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and pick the `dist` folder. Works in Chrome, Edge, Brave, Opera and Vivaldi (Chromium 120 or newer).

## What it reads, and what it does not

| Signal | Read from | Finding |
| --- | --- | --- |
| Angular version | `ng-version` on the root, the version object in the bundles | majors behind the latest, out of support (CLI rule) |
| AngularJS | `angular.version`, `ng-app`, the license header | end of life; with Angular, a migration under way (CLI rule) |
| Development build | `window.ng`, which only development builds publish | high, a note on localhost |
| zone.js | `window.Zone`, zone.js in a script | still loading it from Angular 21 (CLI rule) |
| Rendering | `ng-server-context`; hydration data (`__nghData__`) in `script#ng-state`, since Angular removes the `ngh` markers while it hydrates | fact: client only, server-rendered, or with hydration |
| Skipped hydration | `ngSkipHydration` elements | low |
| Initial JavaScript | resource timing of the page's own scripts | low above 1 MB, the default budget of a new CLI project |

Nothing is sent anywhere: see [PRIVACY.md](PRIVACY.md). Permissions: `activeTab`, `scripting`, `storage`.

## Checked on real builds

Besides the fixture sites, `test/e2e/real.mjs` runs the extension against real builds served locally (`test/e2e/serve.mjs` for static output, the app's own `server.mjs` for SSR). On 11 Nov 2026 it was run on new Angular 14.3.0 and 22.2.5 apps, production and development, and Angular 22 with prerendering and with per-request SSR. Every signal above held, except that `ngh` is gone after hydration; the rule reads the hydration data instead.

## Develop

| Command | Does |
| --- | --- |
| `npm run build` | bundles `src/` and copies `static/` into `dist/` |
| `npm test` | unit tests of the rules and the badge |
| `npm run e2e` | builds, then runs the extension in Chromium against six fixture sites and saves screenshots to `test/e2e/out/` |
| `npm run zip` | production build packed for the store |
| `node scripts/icons.mjs` | renders `design/mark.svg` to the PNG icons |

The end-to-end run needs a Chromium that loads unpacked extensions: Playwright's (`npx playwright install chromium`) or any path in `CHROMIUM_PATH`. Branded Chrome no longer loads extensions from the command line.

The rules come from the CLI through `ng-checkup-cli/site`. Until a CLI release has that export, the dependency points at the sibling checkout (`file:../ng-checkup`).

## How it is built

- `src/collect/globals.ts` runs in the page's own JavaScript world and returns plain values only.
- `src/collect/page.ts` runs in the extension's isolated world on the page: the DOM, resource timing and the page's own scripts.
- `src/rules.ts` turns both into a `PageReport` with the CLI's rules first.
- `src/ui/` renders the popup and the report tab with DOM calls only; nothing from the page is ever inserted as HTML.

Design and spec: the ng-checkup browser extension canvas (popup, full view, badge, repository chip, options, implementation spec).
