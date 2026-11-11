// Bundles the extension into dist/, which is what Chrome loads ("Load unpacked")
// and what scripts/zip.mjs packs for the store.
//
// Every script is one self-contained IIFE: extension pages and content scripts
// load no modules from the network, and the store forbids remote code. The
// site rules come from ng-checkup-cli/site, so the extension and `ng-checkup url`
// share one source.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const production = process.argv.includes('--production');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await build({
  entryPoints: {
    popup: 'src/ui/popup.ts',
    report: 'src/ui/report.ts',
    collector: 'src/collect/collector.ts',
    worker: 'src/worker/worker.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: production ? false : 'inline',
  minify: production,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});

cpSync('static', 'dist', { recursive: true });
const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));
manifest.version = pkg.version;
writeFileSync('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
