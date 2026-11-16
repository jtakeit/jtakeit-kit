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
import { cpSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
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

/**
 * A copy of a laid shop site to change and build apart from it: its files, and its `node_modules` linked rather than copied —
 * the packed kit is installed once, so a copy costs a build and not an install.
 * @param {string} site a site `layShop` laid
 * @param {string} to where the copy goes
 * @returns {string} the copy's path
 */
export function copyShop(site, to) {
  cpSync(site, to, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.git)$/.test(from) });
  symlinkSync(join(site, 'node_modules'), join(to, 'node_modules'));
  return to;
}

/**
 * A site's listing told to hide what is sold out: the one line a site changes to choose it (`HIDE_SOLD_OUT` in
 * `src/pages/[...lang]/shop/index.astro`, `false` as `jtk add shop` lays it). Thrown where that line is not there.
 * @param {string} site a site `layShop` laid, or a copy of one
 */
export function hideSoldOut(site) {
  const file = join(site, 'src/pages/[...lang]/shop/index.astro');
  const source = readFileSync(file, 'utf8');
  if (!source.includes('const HIDE_SOLD_OUT = false;')) throw new Error(`the listing page does not say \`const HIDE_SOLD_OUT = false;\` where the site chooses to hide what is sold out: ${file}`);
  writeFileSync(file, source.replace('const HIDE_SOLD_OUT = false;', 'const HIDE_SOLD_OUT = true;'));
}

/**
 * A site's products listed under two headings, as an agent who wants *Kleidung* and *Geschenke* writes them (docs/collections.md,
 * «group by a select»): a `tier` select on the product type, `group: 'tier'` on the products collection, the fox under the first
 * and the others under the second — and `jtk schema --emit-only` after, which judges it. Thrown where the site is not as `layShop`
 * lays it.
 * @param {string} site a site `layShop` laid, or a copy of one
 */
export function groupShop(site) {
  const file = join(site, 'src/content/blocks.ts');
  let source = readFileSync(file, 'utf8');
  const tier = `      {
        "key": "tier",
        "label": "Rubrik",
        "kind": "select",
        "client_editable": true,
        "options": [
          { "value": "clothes", "label": "Kleidung" },
          { "value": "gifts", "label": "Geschenke" }
        ]
      },
`;
  for (const [anchor, put] of [
    ['      {\n        "key": "made_in",', `${tier}      {\n        "key": "made_in",`],
    ['      "listing": "/shop"\n    }\n  },', '      "listing": "/shop"\n    },\n    "group": "tier"\n  },'],
  ]) {
    if (!source.includes(anchor)) throw new Error(`the site's blocks.ts has no ${JSON.stringify(anchor)}, where the products are grouped: ${file}`);
    source = source.replace(anchor, () => put);
  }
  writeFileSync(file, source);
  for (const [slug, value] of [['t-shirt-fox', 'clothes'], ['kerzenstaender', 'gifts'], ['tasche-nach-mass', 'gifts']]) {
    const entry = join(site, 'jtk/entries/products', `${slug}.json`);
    const product = JSON.parse(readFileSync(entry, 'utf8'));
    product.fields.tier = value;
    writeFileSync(entry, `${JSON.stringify(product, null, 2)}\n`);
  }
  jtk('schema', '--emit-only', '--root', site);
}
