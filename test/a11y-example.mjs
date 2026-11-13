// The example site `jtk create` lays out (jtakeit-core wiki/110), read
// against WCAG 2.1 AA by `jtk a11y` (lib/a11y.mjs): every page it builds, in
// German and English — the header and its menu, the sections, the form, the
// footer, /services and /imprint — with the example's words and photographs,
// as a developer first sees it. Then again with each module a brief may add
// (`add blog`) where the kit has it.
//
//   node test/a11y-example.mjs                 lays out its own (the kit of this checkout)
//   node test/a11y-example.mjs --site <dir>    reads one already laid out and installed
//
// Not in `npm test`: it needs a Chrome; CI runs it as its own step.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { audit, report } from '../lib/a11y.mjs';

const args = process.argv.slice(2);
const given = args.includes('--site') ? args[args.indexOf('--site') + 1] : undefined;
const root = resolve(import.meta.dirname, '..');
const started = Date.now();
let scratch = '';
let site = given;
if (!site) {
  scratch = mkdtempSync(join(tmpdir(), 'jtk-a11y-example-'));
  site = join(scratch, 'example');
  execFileSync('node', [join(root, 'bin/jtk.mjs'), 'create', 'example-a11y', '--name', 'Atelier Probe', '--locale', 'de-CH', '--locales', 'en', '--out', site, '--no-git'], { stdio: 'pipe' });
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: site, stdio: 'pipe' });
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(root, 'kit')], { cwd: site, stdio: 'pipe' });
}
site = resolve(site);
try {
  execFileSync('npm', ['run', 'build'], { cwd: site, stdio: 'pipe' });
} catch (why) {
  console.error(String(why.stdout ?? ''), String(why.stderr ?? ''));
  console.error('a11y-example: the build failed');
  process.exit(1);
}
const all = await audit({ dist: join(site, 'dist'), schemes: ['light'], from: site, log: (line) => console.log(`[example] ${line}`) });
const lines = report(all);
if (scratch && !args.includes('--keep')) rmSync(scratch, { recursive: true, force: true });
const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (lines.length) {
  console.error(`\n${lines.join('\n')}\n`);
  console.error(`a11y-example: ${lines.filter((l) => !l.startsWith('    ')).length} finding(s) on ${all.length} page read(s), ${seconds}s`);
  process.exit(1);
}
console.log(`a11y-example: ${all.length} page read(s), nothing found against WCAG 2.1 AA, ${seconds}s`);
