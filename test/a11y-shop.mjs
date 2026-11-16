// The shop's walk (jtakeit-core wiki/102 stage 9, decision 13, Ruling 195):
// the storefront on the test shop (test/shop-site.mjs, Ruling 200), built, and
// walked in a real Chrome by `jtk a11y` (lib/a11y.mjs, its shop drives in
// lib/a11y-shop.mjs) over `devShop` — the
// shop's addresses answered from the site's own files, FOX-M-BLUE sold out —
// in the site's own language and the light palette, against WCAG 2.1 AA and
// the shop's own checks.
//
// The pages are read in a buyer's order, one browser's storage throughout, so
// what a product page puts in the cart is there when a later piece's page is
// read. Each piece of the storefront adds its pages here and its drive to
// lib/a11y-shop.mjs, and names below what its drive must reach on which page: a
// drive does what the page it is on can do, and a walk that never got to a
// state is a finding, not a pass.
//
// And the command itself, as a developer runs it in a site's directory: with
// no cart of its own, a cart page read with the product pages is given a line
// from the first product page's form and driven, and read alone is held to its
// empty state and passes. Both through `jtk a11y`, on this site.
//
//   CHROME_PATH=/usr/bin/chromium node test/a11y-shop.mjs [--keep]
//
// Not in `npm test`: it needs a Chrome.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { audit, report } from '../lib/a11y.mjs';
import { layShop } from './shop-site.mjs';

/** What the cart's drive must have said on each of its pages — the test shop's country and methods give it each of them to do. */
const CART_DRIVE = [
  "cart: every line is the shop's own",
  'cart: a country chosen by the keyboard',
  'cart: a method chosen by the keyboard',
  'cart: the customs sentence is said for a parcel that crosses the border, and not for a pick-up',
  'cart: a quantity changed by the keyboard',
  'cart: a quantity changed while the shop is still answering',
  'cart: two variants of one product are named apart',
  'cart: a line the shop refuses is said',
  'cart: two lines the shop refuses are told apart',
  'cart: a line taken out by the keyboard is gone',
  'cart: the last line taken out',
  'cart: a line taken out while the shop is still answering',
  'cart: while the shop is being asked the cart says it is checking',
  'cart: a shop that cannot be asked again leaves the rows as they were',
  'cart: the button that asks again prices the cart',
  'cart: a shop that cannot be asked at the first ask',
  'cart: To checkout writes the country and the method',
  'cart: a cart the browser cannot keep is said',
  'cart: a browser that keeps no cart says so',
  'shop: every request names the protocol version',
];

/**
 * What the checkout's drive must have said on each cart page: the test shop sends to Switzerland by a parcel and a pick-up,
 * and to Deutschland across the customs border by both — and devShop answers every press, which the walk holds where an
 * answer it never gives is under test.
 */
const CHECKOUT_DRIVE = [
  'checkout: To checkout opens the step',
  "checkout: the total is the shop's",
  'checkout: Pay pressed with nothing filled in',
  'checkout: a pick-up asks no address',
  'checkout: the customs sentence is said beside the total',
  'checkout: incl. VAT is said beside the total',
  'checkout: a cart changed while the step is open',
  'checkout: Pay pressed while the shop is pricing, the cart changed again meanwhile, goes on with the newest price',
  'checkout: Pay pressed while the shop is pricing is kept',
  "checkout: Pay sends the protocol's body",
  'checkout: Pay pressed again while the shop answers is the same press',
  'checkout: a cart change heard while a press is with the shop',
  'checkout: a detail the shop refuses is said at its field',
  'checkout: a price that changed is shown and said',
  'checkout: an address Stripe cannot tax is said',
  'checkout: an answer that was lost is said',
  'checkout: an answer lost, then Pay pressed with nothing changed, is the same press',
  'checkout: a press retried after an answer was lost is the same attempt',
  "checkout: Stripe's page not given, the press keeps the order",
  "checkout: the buyer is sent to Stripe's page",
  "checkout: paid, the buyer comes back to the order's page",
  "checkout: after Stripe's page was given the next press is a new one",
  'checkout: an answer lost, then a line taken out of the cart, then Pay is a new press',
  "checkout: a press that holds an order is not asked for by the order's token once the step shows another total",
  'checkout: an order already paid is not paid again',
  'checkout: a browser that keeps no cart is told so as the step opens',
  'checkout: a browser that keeps no cart is told so as Pay is pressed',
  'checkout: a tab that keeps nothing keeps the press in the page',
  'checkout: a challenge whose key could not be asked is asked for again',
  "checkout: Pay waits for the challenge's token",
  'checkout: a challenge whose widget does not load is said',
];

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
  {
    // The cart, read in German and then in English: the line the German fox page added is titled by the shop in each.
    piece: 'the cart',
    pages: ['/cart/', '/en/cart/'],
    reaches: {
      '/cart/': CART_DRIVE,
      '/en/cart/': [...CART_DRIVE, "cart: a line added on a page in another language is titled in this page's language"],
    },
  },
  {
    // The checkout, below the cart on the same pages, driven after the cart's: it ends on the order's page, /order and /en/order.
    piece: 'the checkout',
    pages: [],
    reaches: { '/cart/': CHECKOUT_DRIVE, '/en/cart/': CHECKOUT_DRIVE },
  },
];
const SOLD_OUT = ['FOX-M-BLUE'];
/** The fox's first variant: what the cart's drive writes into a cart it finds empty; and its second, for two variants named apart. */
const FOX_LINE = { product: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02', variant: 'v1', qty: 1, answers: {} };

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
    cart: { line: FOX_LINE, second: { ...FOX_LINE, variant: 'v2' } },
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
  // The Review Focus's two languages, by the words: the English cart titles the line the German fox page added «Fox T-shirt».
  const english = results.find((one) => one.path === '/en/cart/')?.found.find((one) => one.check.startsWith("cart: a line added on a page in another language"));
  if (english !== undefined && !(english.said ?? '').includes('«Fox T-shirt»')) lines.push(`/en/cart/ — the line the German fox page added is not titled «Fox T-shirt»: ${english.said}`);
  for (const one of results) {
    for (const said of one.found.filter((each) => /^(product|cart|checkout|shop):/.test(each.check))) console.log(`${said.ok ? 'ok  ' : 'FAIL'} ${one.path} ${said.check}`);
  }

  // The command as a developer runs it, in the site's directory, on the pages it is given: `jtk a11y` has no cart to start from.
  const command = (...pages) => spawnSync('node', [resolve(import.meta.dirname, '../bin/jtk.mjs'), 'a11y', ...pages], { cwd: site, encoding: 'utf8', env: process.env });
  /** The shop checks the command says it reached on a page, one number for each scheme it read it in. */
  const reached = (out, path) => [...out.matchAll(new RegExp(`^ok   ${path.replace(/\//g, '\\/')} \\((\\w+)\\)(?: · (\\d+) shop check)?`, 'gm'))].map((one) => Number(one[2] ?? 0));
  // The whole site, as `jtk a11y` reads it with no pages named: the cart pages come before the product pages, a new browser has no cart,
  // and each is given the first product page's first variant on sale and walked. Every page of it passes.
  const walked = command();
  if (walked.status !== 0) lines.push(`jtk a11y — exit ${walked.status}:\n${walked.stdout}\n${walked.stderr}`);
  const withLine = [...reached(walked.stdout, '/cart/'), ...reached(walked.stdout, '/en/cart/')];
  if (withLine.length === 0 || withLine.some((one) => one < 10)) lines.push(`jtk a11y — a cart's drive did not reach its checks with the product's line in the cart (shop checks per cart page: ${withLine.join(', ') || 'none'}):\n${walked.stdout}`);
  // A cart page with no product page to give it a line: held to its empty state, which passes.
  const bare = command('/cart/');
  if (bare.status !== 0) lines.push(`jtk a11y /cart/ — exit ${bare.status}, though a cart with no line is a correct page:\n${bare.stdout}\n${bare.stderr}`);
  const empty = reached(bare.stdout, '/cart/');
  if (empty.length === 0 || empty.some((one) => one !== 1)) lines.push(`jtk a11y /cart/ — the empty cart was not held to its one check (shop checks per scheme: ${empty.join(', ') || 'none'}):\n${bare.stdout}`);
  console.log(`jtk a11y: exit ${walked.status}, the cart pages' shop checks ${withLine.join(', ')}; jtk a11y /cart/: exit ${bare.status}, ${empty.join(', ')}`);
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
