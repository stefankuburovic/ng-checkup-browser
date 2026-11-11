// Packs dist/ into ng-checkup-browser-<version>.zip for the Chrome Web Store and
// Edge Add-ons, with the system's zip (macOS and Linux have it).
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const target = `ng-checkup-browser-${version}.zip`;
rmSync(target, { force: true });
execFileSync('zip', ['-r', '-X', `../${target}`, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(`Packed ${target}`);
