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
// The products' listing is read in that site as `jtk add shop` lays it — it chooses to hide nothing,
// so it asks the shop nothing and shows every product — and then in a second site built from a copy
// of it (Task 9.16): the site's own choice made in its listing page (`HIDE_SOLD_OUT`), its products
// listed under two headings, and all four of the fox's SKUs sold out. Once the page has loaded the
// fox's tile is hidden and the other two are shown, and its heading with the group it left empty.
//
// And the command itself, as a developer runs it in a site's directory: with
// no cart of its own, a cart page read with the product pages is given a line
// from the first product page's form and driven, and read alone is held to its
// empty state and passes; the order's page, read with no order on its
// address, says so and asks the shop nothing; and the listing, which chooses to
// hide nothing there, is held to its two checks. All through `jtk a11y`, on
// this site.
//
//   CHROME_PATH=/usr/bin/chromium node test/a11y-shop.mjs [--keep]
//
// Not in `npm test`: it needs a Chrome.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { audit, report } from '../lib/a11y.mjs';
import { copyShop, dearerFirst, groupShop, hideSoldOut, layShop } from './shop-site.mjs';

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
  'checkout: Pay pressed while the step shows no total yet sends nothing',
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
 * What the order's drive must have said on each cart page: the buyer's three orders on the shop's own pay page — the first paid,
 * the second left, the third a new order — and then the page's clock in the walk's hands, for what time alone can show.
 */
const ORDER_DRIVE = [
  'order: paid',
  "order: back from Stripe's page without paying",
  'order: Back to paying, by the keyboard',
  'order: Back to your cart, by the keyboard',
  "order: a paid order's page opened again in the same tab keeps the cart",
  "order: a paid order's link opened in another tab is read as paid, and keeps the cart there",
  "order: a press after the buyer left Stripe's page is a new order",
  'order: a browser that will not let the page empty the cart',
  "order: a browser that will not say whether the order is this tab's",
  'order: a buyer who has just paid and waits for Stripe to say',
  'order: a hidden tab asks the shop nothing',
  'order: a tab shown again asks once',
  'order: after two minutes of asking',
  'order: a page that has stopped asking asks no more',
  'order: a request that never answers is given up at its deadline',
  'order: asks that never answer end in the stop all the same',
  'order: a lapsed order is said',
  'order: a cancelled order is said',
  'order: a paid answer with no lines still says it is paid',
  "order: a token that is nobody's is said so",
  'order: an order that is paid, lapsed, cancelled or not found is asked after once',
];

/** What the listing's drive must have said where the listing hides nothing, as `jtk add shop` lays it — the shop is made to say everything is sold out. */
const LISTING_DRIVE = [
  'listing: every tile names its product',
  'listing: a listing that does not choose to hide what is sold out asks the shop nothing',
  'shop: every request names the protocol version',
];

/**
 * And where the site chooses to hide what is sold out: the fox sold out in all its four SKUs, the products under two headings, the
 * bag's cheaper variant its second. Then every product sold out, by the walk's own answer to the page's call, and a listing with no tile.
 */
const HIDING_DRIVE = [
  'listing: every tile names its product',
  'listing: once the page has loaded the tiles of what the shop says nobody can buy are hidden',
  'listing: a group made empty by hiding is hidden',
  'listing: the keyboard goes through the tiles shown',
  'listing: a shop that cannot be asked, or answers with no stock, hides nothing',
  'listing: a shop that never answers is given up at its deadline',
  'listing: where hiding leaves no tile, every group is hidden and no heading is left over nothing',
  'listing: where hiding leaves no tile the sentence for it is shown',
  'listing: a listing with no tile asks the shop nothing',
  'listing: more than 100 products are asked 100 at a time',
  'shop: every request names the protocol version',
];

/**
 * The storefront's pieces, in a buyer's order: the pages each adds to the
 * walk, and the checks its drive must have said on each — by the start of
 * the check's words.
 */
const PIECES = [
  {
    // The products' listing as the unit lays it, in German and in English: it chooses to hide nothing. What it does where it chooses to
    // is read in a second site, below (`HIDING_DRIVE`).
    piece: 'the listing',
    pages: ['/shop/', '/en/shop/'],
    reaches: { '/shop/': LISTING_DRIVE, '/en/shop/': LISTING_DRIVE },
  },
  {
    piece: 'the product',
    pages: ['/shop/t-shirt-fox/', '/shop/tasche-nach-mass/', '/shop/kerzenstaender/'],
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
  {
    // The page after payment: driven on the cart pages after the checkout (the buyer's three orders), and read as `jtk a11y` finds it,
    // with no order on its address, at /order/ and /en/order/ — which asks the shop nothing.
    piece: 'the order',
    pages: ['/order/', '/en/order/'],
    reaches: {
      '/cart/': ORDER_DRIVE,
      '/en/cart/': ORDER_DRIVE,
      '/order/': ['order: an address with no order says no order was found'],
      '/en/order/': ['order: an address with no order says no order was found'],
    },
  },
];
const SOLD_OUT = ['FOX-M-BLUE'];
/** The fox, sold out in every SKU it has: what the second site's listing is read with. */
const FOX_SOLD_OUT = ['FOX-S-RED', 'FOX-M-RED', 'FOX-S-BLUE', 'FOX-M-BLUE'];
const FOX = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02';
const BAG = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a03';
const CANDLE = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a01';
/** The fox's first variant: what the cart's drive writes into a cart it finds empty; and its second, for two variants named apart. */
const FOX_LINE = { product: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02', variant: 'v1', qty: 1, answers: {} };

const args = process.argv.slice(2);
const started = Date.now();
const scratch = mkdtempSync(join(tmpdir(), 'jtk-a11y-shop-'));
let lines = [];
let results = [];
let hiding = [];
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
    for (const said of one.found.filter((each) => /^(product|cart|checkout|order|listing|shop):/.test(each.check))) console.log(`${said.ok ? 'ok  ' : 'FAIL'} ${one.path} ${said.check}`);
  }

  // ── the listing that hides what is sold out: the walk's site built a second time ─
  // A copy of the site, its node_modules linked rather than copied, so it costs a build (about a second and a half) and a Chrome read.
  // The listing page says `HIDE_SOLD_OUT`, the products are listed under two headings, and the shop answers all four of the fox's SKUs
  // sold out: the fox's tile is hidden and the other two are shown, and the group the fox left empty is hidden with its heading.
  {
    const apart = Date.now();
    const copy = copyShop(site, `${site}-hiding`);
    hideSoldOut(copy);
    groupShop(copy);
    // The bag's dearer variant first: a tile built from the first variant on sale would say «ab CHF 119» and the walk's price check would fail.
    dearerFirst(copy);
    const second = spawnSync('npm', ['run', 'build'], { cwd: copy, encoding: 'utf8' });
    if (second.status !== 0) throw new Error(`a11y-shop: the site that hides what is sold out does not build:\n${second.stdout}\n${second.stderr}`);
    const built = Date.now();
    hiding = await audit({
      dist: join(copy, 'dist'),
      pages: ['/shop/'],
      schemes: ['light'],
      from: copy,
      soldOut: FOX_SOLD_OUT,
      log: (line) => console.log(`[shop, hiding] ${line}`),
    });
    lines.push(...report(hiding));
    const listing = hiding.find((one) => one.path === '/shop/');
    for (const check of HIDING_DRIVE) {
      if (!listing?.found.some((one) => one.check.startsWith(check))) lines.push(`/shop/ — the listing that hides what is sold out: the drive never reached «${check}…»`);
    }
    // What the fox's four SKUs sold out do to this listing: its tile hidden, and the others shown; its group hidden, and theirs shown.
    const tiles = listing?.found.find((one) => one.check.startsWith('listing: once the page has loaded'))?.tiles ?? [];
    const hid = (id) => tiles.find((one) => one.id === id)?.hidden;
    if (tiles.length !== 3 || hid(FOX) !== true || hid(BAG) !== false || hid(CANDLE) !== false) {
      lines.push(`/shop/ — with all four of the fox's SKUs sold out, the fox's tile is not the one hidden, with the other two shown: ${JSON.stringify(tiles.map((one) => [one.title, one.hidden]))}`);
    }
    const groups = listing?.found.find((one) => one.check.startsWith('listing: a group made empty by hiding'))?.groups ?? [];
    const group = (heading) => groups.find((one) => one.heading === heading);
    if (groups.length !== 2 || group('Kleidung')?.hidden !== true || group('Kleidung')?.shown !== 0 || group('Geschenke')?.hidden !== false || group('Geschenke')?.shown !== 2) {
      lines.push(`/shop/ — the group the fox left empty is not hidden with its heading, with the other shown: ${JSON.stringify(groups)}`);
    }
    // And when every product is sold out: no tile, no group, no heading left over nothing, and the sentence said in the page's language.
    const none = listing?.found.find((one) => one.check.startsWith('listing: where hiding leaves no tile, every group is hidden'));
    const headings = none?.headings ?? [];
    if (JSON.stringify(headings.map((one) => [one.text, one.shown])) !== JSON.stringify([['Kleidung', false], ['Geschenke', false]]) || none?.groups?.length !== 2 || none.groups.some((one) => !one.hidden || one.shown !== 0)) {
      lines.push(`/shop/ — with every product sold out, both groups are not hidden with their headings: ${JSON.stringify({ headings, groups: none?.groups })}`);
    }
    const sentence = listing?.found.find((one) => one.check.startsWith('listing: where hiding leaves no tile the sentence for it is shown'));
    if (sentence?.said?.startsWith('«Im Moment ist alles ausverkauft» shown') !== true) lines.push(`/shop/ — with every product sold out, the German listing does not say «Im Moment ist alles ausverkauft» as a shown status: ${sentence?.said}`);
    for (const said of listing?.found.filter((each) => /^(listing|shop):/.test(each.check)) ?? []) console.log(`${said.ok ? 'ok  ' : 'FAIL'} /shop/ (hiding) ${said.check}`);
    console.log(`a11y-shop: the second site (the listing hiding what is sold out, the products grouped) copied and built in ${((built - apart) / 1000).toFixed(1)} s, read in ${((Date.now() - built) / 1000).toFixed(1)} s`);
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
  // The listing, as the command reads it with the whole site: it chooses to hide nothing, so its two checks and no request to the shop.
  const atListing = ['/shop/', '/en/shop/'].map((path) => [path, reached(walked.stdout, path)]);
  for (const [path, got] of atListing) {
    if (got.length === 0 || got.some((one) => one !== 2)) lines.push(`jtk a11y — ${path} was not held to its two listing checks (shop checks per scheme: ${got.join(', ') || 'none'}):\n${walked.stdout}`);
  }
  // A cart page with no product page to give it a line: held to its empty state, which passes.
  const bare = command('/cart/');
  if (bare.status !== 0) lines.push(`jtk a11y /cart/ — exit ${bare.status}, though a cart with no line is a correct page:\n${bare.stdout}\n${bare.stderr}`);
  const empty = reached(bare.stdout, '/cart/');
  if (empty.length === 0 || empty.some((one) => one !== 1)) lines.push(`jtk a11y /cart/ — the empty cart was not held to its one check (shop checks per scheme: ${empty.join(', ') || 'none'}):\n${bare.stdout}`);
  // The order's page, with no order on its address — as the command reads every page of the site, and as it reads it alone: it says
  // so and asks the shop nothing, which is its one shop check, in each scheme it was read in. Both languages.
  const orderPages = ['/order/', '/en/order/'];
  const atOrder = orderPages.map((path) => [path, reached(walked.stdout, path)]);
  for (const [path, got] of atOrder) {
    if (got.length === 0 || got.some((one) => one !== 1)) lines.push(`jtk a11y — ${path} was not held to its one shop check, an address with no order (shop checks per scheme: ${got.join(', ') || 'none'}):\n${walked.stdout}`);
  }
  const alone = command(...orderPages);
  if (alone.status !== 0) lines.push(`jtk a11y ${orderPages.join(' ')} — exit ${alone.status}, though an address with no order is a correct page:\n${alone.stdout}\n${alone.stderr}`);
  const atAlone = orderPages.map((path) => [path, reached(alone.stdout, path)]);
  for (const [path, got] of atAlone) {
    if (got.length === 0 || got.some((one) => one !== 1)) lines.push(`jtk a11y ${orderPages.join(' ')} — ${path} was not held to its one shop check (shop checks per scheme: ${got.join(', ') || 'none'}):\n${alone.stdout}`);
  }
  console.log(`jtk a11y: exit ${walked.status}, the listing pages' shop checks ${atListing.map(([, got]) => got.join('/')).join(', ')}, the cart pages' ${withLine.join(', ')}, the order pages' ${atOrder.map(([, got]) => got.join('/')).join(', ')}; jtk a11y /cart/: exit ${bare.status}, ${empty.join(', ')}; jtk a11y /order/ /en/order/: exit ${alone.status}, ${atAlone.map(([, got]) => got.join('/')).join(', ')}`);
} finally {
  if (!args.includes('--keep')) rmSync(scratch, { recursive: true, force: true });
  else console.log(`a11y-shop: kept ${scratch}`);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (lines.length) {
  console.error(`\n${lines.join('\n')}\n`);
  console.error(`a11y: ${lines.filter((one) => !one.startsWith('    ')).length} finding(s) on ${results.length + hiding.length} page read(s) of the shop, ${seconds}s`);
  process.exit(1);
}
console.log(`a11y: ${results.length} page read(s) of the shop and ${hiding.length} of its listing hiding what is sold out, in de-CH and the light palette, nothing found against WCAG 2.1 AA, and every shop check ok, ${seconds}s`);
