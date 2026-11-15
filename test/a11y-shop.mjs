// The shop's walk (jtakeit-core wiki/102 stage 9, decision 13, Ruling 195):
// the storefront on the test shop (test/shop-site.mjs, Ruling 200), built, and
// walked in a real Chrome by `jtk a11y` (lib/a11y.mjs) over `devShop` — the
// shop's addresses answered from the site's own files, FOX-M-BLUE sold out —
// in the site's own language and the light palette, against WCAG 2.1 AA and
// the shop's own checks.
//
// The pages are read in a buyer's order, one browser's storage throughout, so
// what a product page puts in the cart is there when a later piece's page is
// read. Each piece of the storefront adds its pages here and its drive to
// lib/a11y.mjs, and names below what its drive must reach on which page: a
// drive does what the page it is on can do, and a walk that never got to a
// state is a finding, not a pass.
//
//   CHROME_PATH=/usr/bin/chromium node test/a11y-shop.mjs [--keep]
//
// Not in `npm test`: it needs a Chrome.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audit, report } from '../lib/a11y.mjs';
import { layShop } from './shop-site.mjs';

/**
 * The storefront's pieces, in a buyer's order: the pages each adds to the
 * walk, and the checks its drive must have said on each — by the start of
 * the check's words.
 */
const PIECES = [
  {
    piece: 'the product',
    pages: ['/shop/', '/shop/t-shirt-fox/', '/shop/tasche-nach-mass/', '/shop/kerzenstaender/'],
    reaches: {
      '/shop/t-shirt-fox/': [
        "product: each option's value chosen by the keyboard",
        "product: the price shown is the chosen variant's",
        'product: a variant sold out is said in words',
        'product: «added» is said',
        'product: a cart the browser cannot keep is said',
        'shop: every request names the protocol version',
      ],
      '/shop/tasche-nach-mass/': [
        "product: each option's value chosen by the keyboard",
        "product: the price shown is the chosen variant's",
        'product: a question left unanswered is said',
        'product: «added» is said',
        'product: a cart the browser cannot keep is said',
        'shop: every request names the protocol version',
      ],
      '/shop/kerzenstaender/': ['product: «added» is said', 'product: a cart the browser cannot keep is said', 'shop: every request names the protocol version'],
    },
  },
];
const SOLD_OUT = ['FOX-M-BLUE'];

const args = process.argv.slice(2);
const started = Date.now();
const scratch = mkdtempSync(join(tmpdir(), 'jtk-a11y-shop-'));
let lines = [];
let results = [];
try {
  const site = await layShop(scratch);
  const built = spawnSync('npm', ['run', 'build'], { cwd: site, encoding: 'utf8' });
  // Thrown, not exited: the `finally` below takes the site away either way.
  if (built.status !== 0) throw new Error(`a11y-shop: the shop does not build:\n${built.stdout}\n${built.stderr}`);
  results = await audit({
    dist: join(site, 'dist'),
    pages: PIECES.flatMap((one) => one.pages),
    schemes: ['light'],
    from: site,
    soldOut: SOLD_OUT,
    log: (line) => console.log(`[shop] ${line}`),
  });
  lines = report(results);
  for (const { piece, reaches } of PIECES) {
    for (const [path, checks] of Object.entries(reaches)) {
      const read = results.find((one) => one.path === path);
      for (const check of checks) {
        if (!read?.found.some((one) => one.check.startsWith(check))) lines.push(`${path} — ${piece}'s drive never reached «${check}…»`);
      }
    }
  }
  for (const one of results) {
    for (const said of one.found.filter((each) => /^(product|shop):/.test(each.check))) console.log(`${said.ok ? 'ok  ' : 'FAIL'} ${one.path} ${said.check}`);
  }
} finally {
  if (!args.includes('--keep')) rmSync(scratch, { recursive: true, force: true });
  else console.log(`a11y-shop: kept ${scratch}`);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (lines.length) {
  console.error(`\n${lines.join('\n')}\n`);
  console.error(`a11y: ${lines.filter((one) => !one.startsWith('    ')).length} finding(s) on ${results.length} page read(s) of the shop, ${seconds}s`);
  process.exit(1);
}
console.log(`a11y: ${results.length} page read(s) of the shop, in de-CH and the light palette, nothing found against WCAG 2.1 AA, and every shop check ok, ${seconds}s`);
