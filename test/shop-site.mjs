// The site the shop's tests and walks stand on (jtakeit-core wiki/102 stage 9,
// Ruling 200): what an agent lays out for a business in German with English
// beside it, the shop added from the platform's kit, and the test shop's own
// files laid over it — the golden shop's three products, the fox's English,
// the zones `ch` and `eu`, the currency CHF — so a sent country is abroad and
// a price says francs, as on the platform.
//
//   create shop-probe --locale de-CH --locales en --no-git
//   add shop --kit kit/test/fixtures/kits/shop.json
//   kit/test/fixtures/shop/jtk/ over jtk/
//   schema --emit-only
//
// and the kit of this checkout, packed and installed as test/built.mjs installs
// it. Not built: a test builds it as it needs it.
import { execFileSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const jtk = (...args) => execFileSync('node', [join(root, 'bin/jtk.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * A shop's site, laid out and installed in `dir`.
 * @param {string} dir a directory of the caller's, which the site and the packed kit go into
 * @returns {Promise<string>} the site's path
 */
export async function layShop(dir) {
  const site = join(dir, 'shop-probe');
  jtk('create', 'shop-probe', '--locale', 'de-CH', '--locales', 'en', '--no-git', '--out', site);
  jtk('add', 'shop', '--kit', join(root, 'kit/test/fixtures/kits/shop.json'), '--root', site);
  cpSync(join(root, 'kit/test/fixtures/shop/jtk'), join(site, 'jtk'), { recursive: true });
  jtk('schema', '--emit-only', '--root', site);
  const packed = execFileSync('npm', ['pack', join(root, 'kit'), '--pack-destination', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(dir, packed)], { cwd: site, stdio: 'pipe' });
  return site;
}
