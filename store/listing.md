# Store listing

Everything the Chrome Web Store and Edge Add-ons ask for, ready to paste. Images are in `store/images/`, made by `npm run store:images` from the end-to-end screenshots.

## Package

`npm run zip` → `ng-checkup-browser-<version>.zip` (upload this file, not the folder).

## Store listing tab

**Name**: ng-checkup

**Summary** (132 characters at most, this one is 127):

> Which Angular a site runs, and whether it is in trouble: version and support, development builds, hydration, script weight.

**Description**:

> Click the icon on any page to see which Angular or AngularJS it runs and whether it is in trouble.
>
> • Angular version and its support window: how many majors behind, out of support or not
> • AngularJS, alone or next to Angular, where a migration is under way
> • A development build running in production
> • zone.js or zoneless change detection
> • Client rendering, server rendering, and whether hydration is on or skipped for some components
> • How much JavaScript loads before the page is usable, and what loads later
>
> The full report tab lists every script of the site with its size. The toolbar badge shows the Angular major in the colour of the verdict.
>
> It reads only the page you click on, and only what that page already loaded. Nothing is sent anywhere: no account, no telemetry, no server. Open source (MIT).
>
> For the code itself (standalone components, signals, type safety, tests and an upgrade plan) use the ng-checkup command line tool in the repository: npx ng-checkup-cli --plan

**Category**: Developer Tools

**Language**: English

**Store icon**: `static/icons/128.png`

**Screenshots** (1280 × 800): `store/images/1-popup.png`, `2-report.png`, `3-scripts.png`, `4-states.png`

**Small promo tile** (440 × 280): `store/images/promo-small.png`

**Homepage URL**: https://github.com/stefankuburovic/ng-checkup-browser

**Support URL**: https://github.com/stefankuburovic/ng-checkup-browser/issues

## Privacy practices tab

**Single purpose**:

> Shows which Angular or AngularJS version the page in the current tab runs and what state it is in (support, build mode, rendering, script size).

**Permission justifications**:

| Permission | Justification |
| --- | --- |
| `activeTab` | To read the page the user clicked the extension on, and only that page, when they click. |
| `scripting` | To run the read-only check in that tab: it reads the page, its own scripts and their timing. Nothing on the page is changed. |
| `storage` | To keep the result of the last check for that tab in session storage, so the full report tab can show it. Deleted when the tab navigates or closes. |

**Remote code**: No, I am not using remote code. Every script is in the package.

**Data usage**: tick none of the data types. Certify all three statements (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL**: https://github.com/stefankuburovic/ng-checkup-browser/blob/main/PRIVACY.md

## Distribution tab

Visibility: Public. Regions: all.

## Edge Add-ons (Microsoft Partner Center)

The same zip, the same texts. Category: Developer tools. Privacy policy: the same URL. No fee.
