# Privacy

ng-checkup for the browser collects no data.

- **What it reads.** When you click its icon, it reads the open tab: the page, the scripts that page loaded from its own site (at most 12, from the browser's cache when it has them), and the page's resource timing. It reads a few of the page's own JavaScript values (`window.ng`, `window.Zone`, `angular.version`) to tell a development build, zone.js and AngularJS apart. Nothing is clicked and nothing is submitted.
- **Where the result goes.** Into the popup, and into the browser's session storage for that tab, so the full report tab can show it. It is deleted when the tab moves to another page or closes. "Copy as JSON" puts it on your clipboard, nowhere else.
- **What it sends.** Nothing. There is no telemetry, no account and no server. The only requests it makes are the page's own scripts, to the page's own site.
- **Permissions.** `activeTab` (the tab you clicked on, until it navigates), `scripting` (to read that tab), `storage` (the result above). No access to any other site, your history, cookies or tabs.

Source code: https://github.com/stefankuburovic/ng-checkup-browser (MIT).
