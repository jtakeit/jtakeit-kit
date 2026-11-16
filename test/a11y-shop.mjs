// The shop's walk (jtakeit-core wiki/102 stage 9, decision 13, Ruling 195):
// the storefront on the test shop (test/shop-site.mjs, Ruling 200), built, and
// walked in a real Chrome by `jtk a11y` (lib/a11y.mjs, its shop drives in
// lib/a11y-shop.mjs) over `devShop` — the shop's addresses answered from the
// site's own files, FOX-M-BLUE sold out — against WCAG 2.1 AA and the shop's
// own checks. Made whole in Task 9.17:
//
//   every page of the shop, in de-CH and in en, in the light palette and in
//     the dark one — the kit's own tokens, and `test/a11y.mjs`'s dark page with
//     a light accent, written to jtk/design.json and built again — each read
//     with every drive: the listing, three products, the cart with the checkout
//     below it and the page after payment. The cart is read with its rows drawn
//     at 320 px wide as well, and with the sentences the shop says only where
//     they hold: incl. VAT, a country it does not send to, a parcel no method
//     carries, the buyer's own currency; and the chosen option and shipping
//     method are read in forced colors, drawn unlike an empty one
//   the listing that hides what is sold out, in both languages and both
//     palettes: a copy of the site whose listing page says `HIDE_SOLD_OUT`, its
//     products under two headings, all four of the fox's SKUs sold out
//   the storefront as an agent leaves it (the booking form's copied walk,
//     test/a11y.mjs): every file of `SHOP_FILES`, the components and the three
//     pages, with each class renamed (`mine-…`), no `<style>`, the product's
//     fields in a row of their own —
//     built and walked again, in de-CH and the light palette, the pieces and the
//     listing that hides. The hooks are all it keeps, and the elements must still
//     draw, price, refuse and pay with only the rules they put on the page
//     themselves
//   a canary, every run: an element made to find a hook by a class (the product's
//     Add, by `.buy__add`) passes a storefront that keeps its classes and must fail
//     the agent's copy, so the copy's walk is known to tell a lost hook from a kept
//     one — in a copy with a kit of its own, which the other sites do not share
//   and the command, as a developer runs it in a site's directory (below)
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
//   CHROME_PATH=/usr/bin/chromium node test/a11y-shop.mjs [--keep] [--verbose]
//
// `--verbose` says every shop check of every read, not only the findings. It takes
// about seven minutes (6 min 45 s on a 16-core machine; the time of each part is said as it
// ends); CI runs it as its own step with a bound. Not in `npm test`: it needs a Chrome.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { audit, report } from '../lib/a11y.mjs';
import { SHOP_FILES } from '../lib/units/shop.mjs';
import { copyShop, dearerFirst, groupShop, hideSoldOut, layShop } from './shop-site.mjs';

/** What the cart's drive must have said on each of its pages — the test shop's country and methods give it each of them to do. */
const CART_DRIVE = [
  "cart: every line is the shop's own",
  'cart: with its rows drawn nothing of the cart is cut off at 320 px wide',
  'cart: a chosen shipping method is drawn unlike an empty one in forced colors',
  'cart: a country chosen by the keyboard',
  'cart: a method chosen by the keyboard',
  'cart: the customs sentence is said for a parcel that crosses the border, and not for a pick-up',
  'cart: incl. VAT is said beside the subtotal',
  'cart: a country the shop does not send to, and a parcel no method carries, are each said',
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
  'checkout: incl. VAT is said beside the total, and the buyer\'s own currency beside Pay',
  'checkout: a parcel no method carries is said as an alert',
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

/** What the product page's drive must have said on each of the test shop's three products. */
const FOX_DRIVE = [
  'product: a chosen option is drawn unlike an empty one in forced colors',
  "product: each option's value chosen by the keyboard",
  "product: the price shown is the chosen variant's",
  'product: a variant sold out is said in words',
  'product: «added» is said',
  'product: a cart the browser cannot keep is said',
  'shop: every request names the protocol version',
];
const BAG_DRIVE = [
  'product: a chosen option is drawn unlike an empty one in forced colors',
  "product: each option's value chosen by the keyboard",
  "product: the price shown is the chosen variant's",
  'product: a question left unanswered is said',
  'product: «added» is said',
  'product: a cart the browser cannot keep is said',
  'shop: every request names the protocol version',
];
const CANDLE_DRIVE = ['product: «added» is said', 'product: a cart the browser cannot keep is said', 'shop: every request names the protocol version'];

/**
 * The storefront's pieces, in a buyer's order: the pages each adds to the
 * walk, in German and in English, and the checks its drive must have said on
 * each — by the start of the check's words.
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
    pages: ['/shop/t-shirt-fox/', '/shop/tasche-nach-mass/', '/shop/kerzenstaender/', '/en/shop/t-shirt-fox/', '/en/shop/tasche-nach-mass/', '/en/shop/kerzenstaender/'],
    reaches: {
      '/shop/t-shirt-fox/': FOX_DRIVE,
      '/shop/tasche-nach-mass/': BAG_DRIVE,
      '/shop/kerzenstaender/': CANDLE_DRIVE,
      '/en/shop/t-shirt-fox/': FOX_DRIVE,
      '/en/shop/tasche-nach-mass/': BAG_DRIVE,
      '/en/shop/kerzenstaender/': CANDLE_DRIVE,
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

/**
 * The dark palette: `test/a11y.mjs`'s own — a dark page with a light accent and the hero's field on, the tokens a
 * design pass sets — over the site's `jtk/design.json`. The light palette is the kit's own tokens, which is what `jtk create` lays.
 * The example site is dressed dark the way its tokens ask (`src/styles/tokens.css`): the body says it is dark (`data-ground`, which
 * turns its glass dark) and the lifted paper of its language switch and its form, which `design.json` does not reach, is dark too.
 */
const DARK = { paper: '#16130f', ink: '#f3eee6', accent: '#e3b04b', field: 'aurora', ground: '#16130f', colors: ['#2b2620', '#5a4630', '#8a6a3c', '#e3b04b'] };
/** What the listing says where hiding leaves no tile, in each language of the site (the unit's words, written out so the check does not read what it checks). */
const SOLD_OUT_SAYS = { '/shop/': 'Im Moment ist alles ausverkauft', '/en/shop/': 'Everything here is sold out for now' };

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const started = Date.now();
const scratch = mkdtempSync(join(tmpdir(), 'jtk-a11y-shop-'));
/** @type {string[]} */ const lines = [];
/** @type {any[]} */ const everything = [];
/** The time of each part, for the report: a walk that grows is seen where it grew. */
/** @type {string[]} */ const times = [];
const since = (from) => `${((Date.now() - from) / 1000).toFixed(1)} s`;
const timed = async (what, work) => {
  const from = Date.now();
  const done = await work();
  times.push(`${what} ${since(from)}`);
  console.log(`a11y-shop: ${what} — ${since(from)}`);
  return done;
};
const built = (site, what) => {
  const one = spawnSync('npm', ['run', 'build'], { cwd: site, encoding: 'utf8' });
  // Thrown, not exited: the `finally` below takes the site away either way.
  if (one.status !== 0) throw new Error(`a11y-shop: ${what} does not build:\n${one.stdout}\n${one.stderr}`);
};
/** A copy of a site, its palette the dark one where asked. A copy costs a build (about a second and a half), and no install. */
const copied = (site, name, palette = 'light') => {
  const copy = copyShop(site, `${site}-${name}`);
  if (palette === 'dark') {
    const file = join(copy, 'jtk/design.json');
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), ...DARK }, null, 2));
    const tokens = join(copy, 'src/styles/tokens.css');
    writeFileSync(tokens, `${readFileSync(tokens, 'utf8')}\nhtml:root {\n  --paper-lift: #26221c;\n}\n`);
    const layout = join(copy, 'src/layouts/Layout.astro');
    const page = readFileSync(layout, 'utf8');
    if (!page.includes('<body class={bodyClass}>')) throw new Error(`a11y-shop: ${layout} has not the <body> line the dark palette says it is dark on`);
    writeFileSync(layout, page.replace('<body class={bodyClass}>', '<body class={bodyClass} data-ground="dark">'));
  }
  return copy;
};
const German = (path) => !path.startsWith('/en/');

/**
 * What a drive must have reached and has not, as findings: for each page of the pieces given, each check it names by the start of its words.
 * @param {any[]} results the pages read
 * @param {typeof PIECES} pieces
 * @param {string} said whose read this is
 */
function unreached(results, pieces, said) {
  const out = [];
  for (const { piece, reaches } of pieces) {
    for (const [path, checks] of Object.entries(reaches)) {
      const read = results.find((one) => one.path === path);
      for (const check of checks) {
        if (!read?.found.some((one) => one.check.startsWith(check))) out.push(`${path} (${said}) — ${piece}'s drive never reached «${check}…»`);
      }
    }
  }
  return out;
}

/** The pieces, read in a site's palette: the pages of every piece in a buyer's order, the drives' checks held to what they must reach. */
async function readPieces(site, { label, palette, pieces = PIECES }) {
  const results = await audit({
    dist: join(site, 'dist'),
    pages: pieces.flatMap((one) => one.pages),
    schemes: ['light'],
    from: site,
    soldOut: SOLD_OUT,
    cart: { line: FOX_LINE, second: { ...FOX_LINE, variant: 'v2' } },
    palette,
    log: (line) => console.log(`[shop, ${label}] ${line}`),
  });
  everything.push(...results);
  lines.push(...report(results), ...unreached(results, pieces, palette));
  // The Review Focus's two languages, by the words: the English cart titles the line the German fox page added «Fox T-shirt».
  const english = results.find((one) => one.path === '/en/cart/')?.found.find((one) => one.check.startsWith("cart: a line added on a page in another language"));
  if (english !== undefined && !(english.said ?? '').includes('«Fox T-shirt»')) lines.push(`/en/cart/ (${palette}) — the line the German fox page added is not titled «Fox T-shirt»: ${english.said}`);
  for (const one of results) {
    for (const said of one.found.filter((each) => /^(product|cart|checkout|order|listing|shop):/.test(each.check))) {
      if (verbose || !said.ok) console.log(`${said.ok ? 'ok  ' : 'FAIL'} ${one.path} (${label}) ${said.check}`);
    }
  }
  return results;
}

/**
 * The listing in a site whose listing hides what is sold out, in the pages given: the fox's four SKUs sold out, so its tile is hidden
 * and the other two are shown, and the group it left empty is hidden with its heading — and with every product sold out no group, no
 * heading, and the sentence for it in the page's language.
 */
async function readHiding(site, { label, palette, pages }) {
  const results = await audit({
    dist: join(site, 'dist'),
    pages,
    schemes: ['light'],
    from: site,
    soldOut: FOX_SOLD_OUT,
    palette,
    log: (line) => console.log(`[shop, ${label}] ${line}`),
  });
  everything.push(...results);
  lines.push(...report(results));
  for (const path of pages) {
    const listing = results.find((one) => one.path === path);
    const where = `${path} (${palette})`;
    for (const check of HIDING_DRIVE) {
      if (!listing?.found.some((one) => one.check.startsWith(check))) lines.push(`${where} — the listing that hides what is sold out: the drive never reached «${check}…»`);
    }
    // What the fox's four SKUs sold out do to this listing: its tile hidden, and the others shown; its group hidden, and theirs shown.
    const tiles = listing?.found.find((one) => one.check.startsWith('listing: once the page has loaded'))?.tiles ?? [];
    const hid = (id) => tiles.find((one) => one.id === id)?.hidden;
    if (tiles.length !== 3 || hid(FOX) !== true || hid(BAG) !== false || hid(CANDLE) !== false) {
      lines.push(`${where} — with all four of the fox's SKUs sold out, the fox's tile is not the one hidden, with the other two shown: ${JSON.stringify(tiles.map((one) => [one.title, one.hidden]))}`);
    }
    // A select's label is the repository's and fixed, so the headings are the same in every language.
    const groups = listing?.found.find((one) => one.check.startsWith('listing: a group made empty by hiding'))?.groups ?? [];
    const group = (heading) => groups.find((one) => one.heading === heading);
    if (groups.length !== 2 || group('Kleidung')?.hidden !== true || group('Kleidung')?.shown !== 0 || group('Geschenke')?.hidden !== false || group('Geschenke')?.shown !== 2) {
      lines.push(`${where} — the group the fox left empty is not hidden with its heading, with the other shown: ${JSON.stringify(groups)}`);
    }
    // And when every product is sold out: no tile, no group, no heading left over nothing, and the sentence said in the page's language.
    const none = listing?.found.find((one) => one.check.startsWith('listing: where hiding leaves no tile, every group is hidden'));
    const headings = none?.headings ?? [];
    if (JSON.stringify(headings.map((one) => [one.text, one.shown])) !== JSON.stringify([['Kleidung', false], ['Geschenke', false]]) || none?.groups?.length !== 2 || none.groups.some((one) => !one.hidden || one.shown !== 0)) {
      lines.push(`${where} — with every product sold out, both groups are not hidden with their headings: ${JSON.stringify({ headings, groups: none?.groups })}`);
    }
    const sentence = listing?.found.find((one) => one.check.startsWith('listing: where hiding leaves no tile the sentence for it is shown'));
    if (sentence?.said?.startsWith(`«${SOLD_OUT_SAYS[path]}» shown`) !== true) lines.push(`${where} — with every product sold out, the listing does not say «${SOLD_OUT_SAYS[path]}» as a shown status: ${sentence?.said}`);
    for (const said of listing?.found.filter((each) => /^(listing|shop):/.test(each.check)) ?? []) {
      if (verbose || !said.ok) console.log(`${said.ok ? 'ok  ' : 'FAIL'} ${path} (${label}) ${said.check}`);
    }
  }
  return results;
}

/**
 * The storefront as an agent leaves it, in a copy of a site (the booking form's copied walk, test/a11y.mjs; docs/booking.md): every
 * file of `SHOP_FILES` — the five components and the three pages that draw them — with each class renamed, `mine-…`, and the look gone,
 * the `<style>`; and the product's fields — its options, the price and what is left, its questions and the quantity — wrapped in a row of
 * their own. The hooks are all it keeps. Thrown where the copy was not made as meant, so that a file that says its classes some other way
 * is seen here and not passed for the wrong reason.
 * @param {string} site a copy of a site `layShop` laid
 */
function asAnAgentLeavesIt(site) {
  const components = SHOP_FILES.filter((file) => file.startsWith('src/components/'));
  const pages = SHOP_FILES.filter((file) => file.startsWith('src/pages/'));
  if (components.length < 5 || pages.length < 3 || components.length + pages.length !== SHOP_FILES.length) {
    throw new Error(`a11y-shop: SHOP_FILES has ${components.length} component(s) and ${pages.length} page(s) where the storefront has five and three: ${SHOP_FILES.join(', ')}`);
  }
  for (const file of SHOP_FILES) {
    const at = join(site, file);
    const original = readFileSync(at, 'utf8');
    let copy = original
      .replace(/\n<style[^>]*>[\s\S]*?<\/style>/, '')
      .replace(/class="([^"]+)"/g, (_, names) => `class="${names.split(' ').map((one) => `mine-${one}`).join(' ')}"`);
    if (file.endsWith('/Product.astro')) {
      copy = copy
        .replace(/(<noscript><p class="mine-buy__note">[^\n]*<\/noscript>)/, '$1\n        <div class="mine-row">')
        .replace(/(<div class="mine-buy__qty">[\s\S]*?<\/div>)/, '$1\n        </div>');
      if (!copy.includes('mine-row')) throw new Error(`a11y-shop: the product's fields were not wrapped in a row in ${file}`);
    }
    const classes = [...copy.matchAll(/class="([^"]+)"/g)].map((one) => one[1].split(' '));
    // A component says its classes; a page may say none, but a <style> it says is gone with the rest.
    if ((components.includes(file) && !/class="/.test(original)) || classes.some((names) => names.some((one) => !one.startsWith('mine-'))) || /<style[\s>]/.test(copy) || /class[:=]\{|class:list/.test(copy)) {
      throw new Error(`a11y-shop: the copied ${file} was not made as meant: a class left as it was, a <style> left, or a class this copy cannot rename`);
    }
    writeFileSync(at, copy);
  }
}

/**
 * A copy of a site that has a kit of its own to change: its `node_modules` are the site's, each entry linked, except `@jtakeit/kit`, which
 * is copied — so an element changed in the copy's is changed in the copy's build alone, and the site and the copies made from it are not.
 * @param {string} copy a copy `copyShop` made
 * @param {string} site the site it was made from
 */
function withKitOfItsOwn(copy, site) {
  const modules = join(copy, 'node_modules');
  rmSync(modules, { force: true });
  mkdirSync(modules);
  for (const entry of readdirSync(join(site, 'node_modules'))) {
    if (entry !== '@jtakeit') symlinkSync(join(site, 'node_modules', entry), join(modules, entry));
  }
  mkdirSync(join(modules, '@jtakeit'));
  for (const entry of readdirSync(join(site, 'node_modules/@jtakeit'))) {
    const there = join(site, 'node_modules/@jtakeit', entry);
    if (entry === 'kit') cpSync(realpathSync(there), join(modules, '@jtakeit', entry), { recursive: true });
    else symlinkSync(there, join(modules, '@jtakeit', entry));
  }
}

/**
 * An element made to find a hook by a class — the product's *Add* by `.buy__add` — which is what the storefront's elements must never do:
 * they find by `data-*`, and a site that renames its classes keeps them working. Thrown where the line is not there.
 * @param {string} copy a copy that has a kit of its own
 */
function findingAddByItsClass(copy) {
  const file = join(copy, 'node_modules/@jtakeit/kit/elements/shop-product.js');
  const source = readFileSync(file, 'utf8');
  if (!source.includes("form.querySelector('[data-add]')")) throw new Error(`a11y-shop: ${file} does not find Add as the canary expects`);
  writeFileSync(file, source.replace("form.querySelector('[data-add]')", "form.querySelector('.buy__add')"));
}

try {
  const site = await timed('the shop laid out, installed and built', async () => {
    const laid = await layShop(scratch);
    built(laid, 'the shop');
    return laid;
  });

  // ── every page of the shop, in both languages, in the light palette and in the dark one ─
  await timed('the pieces in the light palette, in de-CH and en', () => readPieces(site, { label: 'light', palette: 'light' }));
  await timed('the pieces in the dark palette, in de-CH and en', async () => {
    const copy = copied(site, 'dark', 'dark');
    built(copy, 'the site on the dark palette');
    return readPieces(copy, { label: 'dark', palette: 'dark' });
  });

  // ── the listing that hides what is sold out: the walk's site built again, on each palette ─
  // The listing page says `HIDE_SOLD_OUT`, the products are listed under two headings, and the shop answers all four of the fox's SKUs
  // sold out: the fox's tile is hidden and the other two are shown, and the group the fox left empty is hidden with its heading.
  const hiding = copied(site, 'hiding');
  hideSoldOut(hiding);
  groupShop(hiding);
  // The bag's dearer variant first: a tile built from the first variant on sale would say «ab CHF 119» and the walk's price check would fail.
  dearerFirst(hiding);
  built(hiding, 'the site that hides what is sold out');
  const LISTINGS = ['/shop/', '/en/shop/'];
  await timed('the listing that hides, in de-CH and en, in the light palette', () => readHiding(hiding, { label: 'hiding', palette: 'light, hiding', pages: LISTINGS }));
  await timed('the listing that hides, in de-CH and en, in the dark palette', async () => {
    const copy = copied(hiding, 'dark', 'dark');
    built(copy, 'the site that hides what is sold out, on the dark palette');
    return readHiding(copy, { label: 'hiding, dark', palette: 'dark, hiding', pages: LISTINGS });
  });

  // ── the storefront as an agent leaves it: every class renamed, no <style>, the product's fields in a row ─
  // Walked again as the site's own language and the light palette — the words and the palette change no markup — the pieces and then the
  // listing that hides, whose group, tile and sentence are found by their hooks alone.
  await timed('the storefront as an agent leaves it, in de-CH and the light palette', async () => {
    const mine = copied(site, 'mine');
    asAnAgentLeavesIt(mine);
    built(mine, 'the storefront as an agent leaves it');
    const pieces = PIECES.map((one) => ({ ...one, pages: one.pages.filter(German), reaches: Object.fromEntries(Object.entries(one.reaches).filter(([path]) => German(path))) }));
    await readPieces(mine, { label: 'copy', palette: 'copy', pieces });
    const mineHiding = copied(hiding, 'mine');
    asAnAgentLeavesIt(mineHiding);
    built(mineHiding, 'the listing that hides, as an agent leaves it');
    await readHiding(mineHiding, { label: 'copy, hiding', palette: 'copy, hiding', pages: ['/shop/'] });
  });

  // ── a canary: the copy's walk must be able to tell a lost hook from a kept one, every run ─
  // An element made to find Add by its class is as good as ever while the classes are there, and loses Add where an agent renamed them. The
  // fox's page is read in the two copies — one that keeps its classes, which must pass, and the agent's, which must not — so that a walk that
  // has stopped telling the two apart (a drive that skips a check, a copy that is not renamed) says so here and does not pass the copy for nothing.
  await timed('the canary: an element that finds Add by its class, in a copy that keeps its classes and in the agent\'s', async () => {
    const reads = {};
    for (const [name, renamed] of [['kept', false], ['left', true]]) {
      const copy = copied(site, `canary-${name}`);
      withKitOfItsOwn(copy, site);
      findingAddByItsClass(copy);
      if (renamed) asAnAgentLeavesIt(copy);
      built(copy, `the canary's copy (${name})`);
      const results = await audit({ dist: join(copy, 'dist'), pages: ['/shop/t-shirt-fox/'], schemes: ['light'], from: copy, soldOut: SOLD_OUT, palette: `canary, ${name}`, log: (line) => console.log(`[shop, canary ${name}] ${line}`) });
      reads[name] = report(results);
    }
    if (reads.kept.length > 0) lines.push(`the canary: the element that finds Add by its class does not pass where the classes are kept, so the canary proves nothing:\n${reads.kept.join('\n')}`);
    if (reads.left.length === 0) lines.push('the canary: an element that finds Add by its class passed the storefront as an agent leaves it, every class renamed — the copy\'s walk cannot tell a lost hook from a kept one');
    else console.log(`a11y-shop: the canary failed the agent's copy as it must: ${reads.left.length} finding(s), «${reads.left[0].replace(/\s+/g, ' ').slice(0, 140)}»`);
  });

  // The command as a developer runs it, in the site's directory, on the pages it is given: `jtk a11y` has no cart to start from.
  await timed('jtk a11y, on the whole site and on the pages it is given', async () => {
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
  });
} finally {
  if (!args.includes('--keep')) rmSync(scratch, { recursive: true, force: true });
  else console.log(`a11y-shop: kept ${scratch}`);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`a11y-shop: ${times.join('; ')}`);
if (lines.length) {
  console.error(`\n${lines.join('\n')}\n`);
  console.error(`a11y: ${lines.filter((one) => !one.startsWith('    ')).length} finding(s) on ${everything.length} page read(s) of the shop, ${seconds}s`);
  process.exit(1);
}
console.log(`a11y: ${everything.length} page read(s) of the shop in light and dark, in de-CH and en, and as an agent leaves it, nothing found against WCAG 2.1 AA, and every shop check ok, ${seconds}s`);
