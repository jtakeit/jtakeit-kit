// The storefront, built (jtakeit-core wiki/102 stage 9, decision 6): a shop
// laid out on the test shop (test/shop-site.mjs, Ruling 200), built, and its
// pages read back.
//
//   1  the product's page is the site's Product.astro, not the generic
//      entry: its form carries the product's id, its facts and every option;
//      the price shown is the first variant's, annotated as it; the English
//      page the same form in English; a customization a control each, a text
//      held to its length
//   2  `jtk schema` agrees with the page and `jtkit lint` finds nothing: every
//      value the owner taps on a product — each variant's price among them —
//      is annotated where it is drawn
//   3  the content an owner can write, at its edges, as the platform tries a
//      site's code (JTK_E_CONTENT_VARIANT, test/variants.mjs): every optional
//      field of every product empty, then every one filled and long — each
//      built, judged and linted, with nothing found
//   4  what is the owner's and never the buyer's is drawn nowhere: a product's
//      tax code and customs tariff number (`no_tap_target`, Ruling 217) are on
//      no product page, filled by the owner or at the edge — while where it is
//      made is drawn, and annotated
//
//   5  the cart's page, at /cart and /en/cart: the cart's root with the
//      countries of the shop's zones, in the page's language, and every hook
//      of the cart; the header links to it; the sitemap does not; the page is
//      no more `noindex` than any; and where the schema does not turn the shop
//      on there is no cart page at all
//   6  the checkout step, below the cart on the same page: its form, hidden
//      until the cart hands on, with every hook of the checkout, the words it
//      says for every answer of the shop in the page's language, and the order's
//      page in that language to come back to — /order, /en/order (Ruling 202)
//   7  the page after payment, at /order and /en/order: the order's root with
//      every hook of it, the words it says for every state in the page's
//      language, the way back to the cart in that language, no language switch
//      (the other language's page would have no token), no more `noindex` than
//      any page and left out of the sitemap (Ruling 201), and not built where
//      the schema does not turn the shop on
//   8  the products' listing, at /shop and /en/shop (Task 9.16): every product
//      a tile by its id, each with its title and its lowest price on sale
//      annotated, no `data-hide-sold-out` as the unit lays it; and a site that
//      chooses to hide what is sold out still builds every product — its
//      listing says `data-hide-sold-out`, with a product hidden in its file
//      gone from it and nothing else. The scaffold's own listing leaves /shop
//      to it, so it is built where the schema does not turn the shop on as
//      well — the sitemap and llms.txt name it, and every address they name is
//      a page the build wrote — asking a shop that is off for nothing
//
//   9  a site with no shop builds as before (Task 9.17; Task 9.12 checked it once,
//      by `diff -r` of two dist/ trees): a site with a blog and a salon kit and no
//      shop, built with the scaffold's entry page as it is, and again with the
//      lines the shop added to it taken out — the page as it was before the shop —
//      has the same dist/, byte for byte, and no trace of the shop in any file of it
//
// Every built page of the shop is held as test/create3.mjs holds the
// example's: no element says an attribute twice, no heading skips a level.
// The kit is this checkout's, packed. The walk in a real Chrome is
// test/a11y-shop.mjs's, outside `npm test`.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { money, priceWords } from '../kit/lib/money.mjs';
import { CART, CHECKOUT, LISTING, ORDER } from '../kit/lib/shop/hooks.mjs';
import { CHECKOUT_WORDS } from '../kit/lib/shop/checkout.mjs';
import { ORDER_WORDS } from '../kit/lib/shop/order.mjs';
import { shopWordsFor } from '../kit/lib/shop/words.mjs';
import { copyShop, dearerFirst, hideSoldOut, layShop } from './shop-site.mjs';
import { varyContent } from './variants.mjs';

const bin = resolve(import.meta.dirname, '../bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-shop-'));
const CANDLE = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a01';
const FOX = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02';
const BAG = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a03';
/** A fault that stops the run: thrown, so the `finally` takes the site away, and said once at the end. */
class Failure extends Error {}
const fail = (m) => {
  throw new Failure(m);
};
const faults = [];
const check = (ok, said) => {
  if (!ok) faults.push(said);
};
const settle = (stage) => {
  if (faults.length > 0) fail(`${stage}:\n  ${faults.join('\n  ')}`);
};
const walk = (at) => readdirSync(at, { withFileTypes: true }).flatMap((one) => (one.isDirectory() ? walk(join(at, one.name)) : [join(at, one.name)]));
/** An attribute of a tag, its entities read. */
const attr = (tag, name) => {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag ?? '');
  return found === null ? undefined : found[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};

/** Built, then held to `jtk schema` and `jtkit lint` on its dist/, and every shop page to being tidy. */
function judged(site, said) {
  const built = spawnSync('npm', ['run', 'build'], { cwd: site, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://shop-probe.example/' } });
  if (built.status !== 0) fail(`${said}: the shop does not build:\n${built.stdout}\n${built.stderr}`);
  const schema = spawnSync('node', [bin, 'schema', '--root', site, '--dist', 'dist'], { encoding: 'utf8' });
  if (schema.status !== 0 || !schema.stdout.includes('the schema and the page agree')) fail(`${said}: jtk schema says\n${schema.stdout}\n${schema.stderr}`);
  const lint = spawnSync('node', [join(site, 'node_modules/@jtakeit/kit/bin/jtkit.mjs'), 'lint', '--dist', 'dist', '--root', '.'], { cwd: site, encoding: 'utf8' });
  if (lint.status !== 0) fail(`${said}: jtkit lint says\n${lint.stdout}\n${lint.stderr}`);
  for (const file of walk(join(site, 'dist')).filter((one) => one.endsWith('.html') && /[\\/](shop|cart|order)[\\/]/.test(one))) {
    const html = readFileSync(file, 'utf8');
    const where = relative(join(site, 'dist'), file);
    for (const [tag] of html.matchAll(/<[a-zA-Z][a-zA-Z0-9-]*\s[^>]*>/g)) {
      const names = [...tag.matchAll(/\s([^\s=/>"']+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g)].map((one) => one[1].toLowerCase());
      const twice = names.find((one, i) => names.indexOf(one) !== i);
      if (twice !== undefined) fail(`${said}: ${where} has an element that says ${twice} twice: ${tag.slice(0, 160)}`);
    }
    let last = 0;
    for (const [, level] of html.slice(html.indexOf('<body')).matchAll(/<h([1-6])[\s>]/g)) {
      if (last !== 0 && Number(level) > last + 1) fail(`${said}: ${where} goes from h${last} to h${level}`);
      last = Number(level);
    }
  }
}

/**
 * Every address `sitemap.xml` and `llms.txt` name is a page the build wrote: the scaffold lists a collection's listing wherever a
 * page of the site's own is at its prefix (`ownListing`), so a page that builds nothing there leaves both naming a 404.
 */
function namedAreWritten(root, said) {
  const dist = join(root, 'dist');
  const sitemap = [...readFileSync(join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((one) => new URL(one[1]).pathname);
  const llms = [...readFileSync(join(dist, 'llms.txt'), 'utf8').matchAll(/^- (\/[^\s:]*)/gm)].map((one) => one[1]);
  check(sitemap.length > 0 && llms.length > 0 && sitemap.includes('/shop/') && llms.includes('/shop'), `${said}: sitemap.xml and llms.txt do not name the listing at /shop (${sitemap.length} and ${llms.length} addresses)`);
  for (const [file, addresses] of [['sitemap.xml', sitemap], ['llms.txt', llms]]) {
    for (const address of addresses) check(existsSync(join(dist, address, 'index.html')), `${said}: ${file} names ${address}, which the build did not write`);
  }
}

/**
 * 4 · On every product page of a built site, in every language: nothing of the tax code or the tariff number —
 * no annotation, no label, no value of a product's — and where it is made drawn and annotated where a product says it.
 */
function ownersOnly(site, said) {
  const schema = JSON.parse(readFileSync(join(site, 'jtk/schema.json'), 'utf8'));
  const fieldsOf = schema.blocks.find((one) => one.type === 'product').fields;
  const labelOf = (key) => fieldsOf.find((one) => one.key === key)?.label;
  for (const key of ['tax_code', 'tariff_number']) check(fieldsOf.find((one) => one.key === key)?.no_tap_target === true, `${said}: the site's product type does not say ${key} is no tap target`);
  const entries = walk(join(site, 'jtk/entries/products')).filter((one) => /\/[^/.]+\.json$/.test(one)).map((one) => JSON.parse(readFileSync(one, 'utf8')));
  for (const product of entries) {
    for (const prefix of ['', 'en/']) {
      const where = `/${prefix}shop/${product.slug}/`;
      const html = readFileSync(join(site, 'dist', where, 'index.html'), 'utf8');
      for (const key of ['tax_code', 'tariff_number']) {
        check(!html.includes(`data-jtk-path="${key}"`) && !html.includes(`>${labelOf(key)}<`), `${said}: ${where} draws ${key}, the owner's fact and never the buyer's`);
      }
      check(!/txcd_/.test(html) && !html.includes('6109.1000'), `${said}: ${where} shows a tax code or a tariff number`);
      const made = product.fields?.made_in;
      if (typeof made === 'string' && made.trim() !== '') {
        const at = new RegExp(`<dd[^>]*\\sdata-jtk-path="made_in"[^>]*>${made.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</dd>`);
        check(at.test(html), `${said}: ${where} does not draw where it is made, annotated`);
      }
    }
  }
}

/**
 * The scaffold's entry page as it was before the shop (Task 9.12): the lines it says about a product taken out — the glob that finds the
 * site's `Product.astro`, the facts loop's condition, and the branch that draws it in place of the generic article. Thrown where the page
 * does not say them in the words below: whoever moves them moves this with them, and the guard it makes is only as good as the page it gives.
 */
function withoutTheShop(source) {
  let out = source;
  for (const [what, found, put] of [
    ['the glob and the line that names the shop\'s product page', /\/\*\n \* ── a product, drawn by the shop's own page[\s\S]*?\*\/\nconst productPages = [^\n]*\nconst Product = [^\n]*\n\n/, ''],
    ['the facts loop\'s condition', /for \(const field of Product === undefined \? collection\.fields : \[\]\) \{/, 'for (const field of collection.fields) {'],
    ['the branch that draws a product', /    \{\/\* A product, where the site has its own page[^\n]*\*\/\}\n    \{Product !== undefined && <Product [^\n]*\/>\}\n    \{Product === undefined && \(\n/, ''],
    ['the branch\'s end', /(    <\/article>\n)    \)\}\n/, '$1'],
  ]) {
    const next = out.replace(found, put);
    if (next === out) throw new Failure(`a site with no shop: the scaffold's template/src/pages/[...entry].astro has not ${what} as test/shop.mjs's withoutTheShop expects`);
    out = next;
  }
  if (/\bproductPages\b|<Product\b|\bProduct (?:===|!==)|\bconst Product\b/.test(out)) throw new Failure('a site with no shop: the entry page still says Product after the shop\'s lines were taken out — withoutTheShop does not know all of them');
  return out;
}

/** A tree's files, by their path, with their bytes: what a build wrote. */
const treeOf = (root) => new Map(walk(root).map((file) => [relative(root, file), readFileSync(file)]));

try {
  const site = await layShop(dir);
  // The owner's facts on the fox, as the panel's card writes them: a tax code, a tariff number, where it is made.
  const foxFile = join(site, 'jtk/entries/products/t-shirt-fox.json');
  const fox = JSON.parse(readFileSync(foxFile, 'utf8'));
  Object.assign(fox.fields, { tax_code: 'txcd_99999999', tariff_number: '6109.1000', made_in: 'Portugal' });
  writeFileSync(foxFile, `${JSON.stringify(fox, null, 2)}\n`);
  judged(site, 'the test shop');
  const page = (address) => readFileSync(join(site, 'dist', address, 'index.html'), 'utf8');

  // ── 1 · the product's page ───────────────────────────────────────────────
  {
    const fox = page('shop/t-shirt-fox');
    const form = new RegExp(`<form[^>]*\\sdata-product="${FOX}"[^>]*>`).exec(fox)?.[0];
    check(form !== undefined, `/shop/t-shirt-fox has no form[data-product="${FOX}"]: the fox is drawn as any entry`);
    let facts;
    try {
      facts = JSON.parse(attr(form, 'data-facts') ?? '');
    } catch {
      facts = undefined;
    }
    check(
      JSON.stringify(facts?.variants?.map((one) => [one.key, one.sku, one.picks])) ===
        JSON.stringify([['v1', 'FOX-S-RED', { size: 's', colour: 'red' }], ['v2', 'FOX-M-RED', { size: 'm', colour: 'red' }], ['v3', 'FOX-S-BLUE', { size: 's', colour: 'blue' }], ['v4', 'FOX-M-BLUE', { size: 'm', colour: 'blue' }]]),
      `the fox's data-facts are not its four variants with their picks: ${JSON.stringify(facts?.variants)}`,
    );
    check(facts?.currency === 'CHF' && facts?.id === FOX, `the fox's facts do not say its id and the site's currency: ${JSON.stringify({ id: facts?.id, currency: facts?.currency })}`);
    const groups = new Set([...fox.matchAll(/\sname="(option:[^"]+)"/g)].map((one) => one[1]));
    check(JSON.stringify([...groups]) === JSON.stringify(['option:size', 'option:colour']), `the fox has not two option: groups: ${[...groups]}`);
    check(attr(form, 'data-locale') === 'de-CH' && attr(form, 'data-api') === '/api/', `the fox's form does not say its language and api: ${form}`);
    const price = /(<[a-z]+\b[^>]*\sdata-price(?=[\s>=])[^>]*>)([^<]*)</.exec(fox);
    const priceTag = price?.[1];
    check(price?.[2] === money(2990, 'CHF', 'de-CH'), `the fox's [data-price] says «${price?.[2]}», not «${money(2990, 'CHF', 'de-CH')}»`);
    check(/variants\[v1\]\.price$/.test(attr(priceTag, 'data-jtk-path') ?? ''), `the fox's [data-price] is not annotated as the first variant's price: ${priceTag}`);
    for (const path of ['variants[v1].price', 'variants[v2].price', 'variants[v3].price', 'variants[v4].price', 'options[size].name', 'options[colour].values[blue].label']) {
      check(fox.includes(`data-jtk-path="${path}"`), `the fox's page does not annotate ${path}`);
    }
    check(/<h1[^>]*\sdata-jtk-path="title"[^>]*>T-shirt «Fox»<\/h1>/.test(fox), `the fox's title is not its h1, annotated: ${fox.match(/<h1[^>]*>[^<]*<\/h1>/)?.[0]}`);
    check(!fox.includes('class="entry-facts"') && !fox.includes('[object Object]'), 'the fox is drawn with the generic entry\'s facts as well');
    check(/<jtk-product[\s>]/.test(fox) && /<script type="module" src="[^"]+"/.test(fox), 'the fox\'s page has no <jtk-product>, or no script for it');
    check(/<noscript><p[^>]*>Für den Warenkorb ist JavaScript nötig<\/p><\/noscript>/.test(fox), 'the fox\'s page has no <noscript> sentence in German');

    const english = page('en/shop/t-shirt-fox');
    const enForm = new RegExp(`<form[^>]*\\sdata-product="${FOX}"[^>]*>`).exec(english)?.[0];
    check(enForm !== undefined && attr(enForm, 'data-locale') === 'en', `/en/shop/t-shirt-fox has not the fox's form in English: ${enForm}`);
    check(JSON.parse(attr(enForm, 'data-facts') ?? '{}').variants?.length === 4, 'the English fox\'s facts are not its four variants');
    check(/<h1[^>]*>Fox T-shirt<\/h1>/.test(english), `the English fox is not titled «Fox T-shirt»: ${english.match(/<h1[^>]*>[^<]*<\/h1>/)?.[0]}`);
    check(english.includes('>Add to cart<') && !english.includes('>In den Warenkorb<'), 'the English fox\'s button is not in English');

    const bag = page('shop/tasche-nach-mass');
    const answers = [...bag.matchAll(/<(select|input)[^>]*\sname="(answer:[^"]+)"[^>]*>/g)];
    check(JSON.stringify(answers.map((one) => one[2])) === JSON.stringify(['answer:body', 'answer:zipper', 'answer:tag']), `the bag has not three answer: controls: ${answers.map((one) => one[2])}`);
    const tag = answers.find((one) => one[2] === 'answer:tag')?.[0];
    check(attr(tag, 'maxlength') === '20', `the bag's tag is not held to 20 characters: ${tag}`);
    check(/\srequired[\s>=]/.test(answers.find((one) => one[2] === 'answer:body')?.[0] ?? '') && /type="checkbox"/.test(answers.find((one) => one[2] === 'answer:zipper')?.[0] ?? ''), 'the bag\'s body colour is not a required select, or its zipper not a box');
    for (const path of ['customizations[body].choices[rot].adds', 'customizations[zipper].adds', 'customizations[tag].name']) check(bag.includes(`data-jtk-path="${path}"`), `the bag's page does not annotate ${path}`);
    check(bag.includes('data-from') && bag.includes(`>ab ${money(8900, 'CHF', 'de-CH')}<`), 'the bag, two sizes at two prices, does not say «ab CHF 89»');

    // A product with no option: no picker, the one variant's price.
    const candle = page('shop/kerzenstaender');
    check(!/name="option:/.test(candle) && candle.includes(`>${money(2400, 'CHF', 'de-CH')}<`) && candle.includes('data-jtk-path="variants[v1].price"'), 'the candlestick, with no option, is not drawn with its one price');
  }
  settle('the product\'s page');

  // ── 5 · the cart's page ──────────────────────────────────────────────────
  {
    const robots = (html) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];
    const sitemap = readFileSync(join(site, 'dist/sitemap.xml'), 'utf8');
    for (const [address, lang, heading, names] of [
      ['cart', 'de-CH', 'Warenkorb', ['Schweiz', 'Liechtenstein', 'Deutschland']],
      ['en/cart', 'en', 'Cart', ['Switzerland', 'Liechtenstein', 'Germany']],
    ]) {
      const cart = page(address);
      const where = `/${address}`;
      const root = /<[a-z]+\b[^>]*\sdata-cart(?=[\s>=])[^>]*>/.exec(cart)?.[0];
      check(root !== undefined, `${where} has no [data-cart]`);
      check(attr(root, 'data-countries') === '["CH","LI","DE"]', `${where}'s data-countries is not the test shop's two zones' countries, in order: ${attr(root, 'data-countries')}`);
      check(attr(root, 'data-api') === '/api/' && attr(root, 'data-locale') === lang, `${where} does not say its api and its language (${lang}): ${root}`);
      let said;
      try {
        said = JSON.parse(attr(root, 'data-words') ?? '');
      } catch {
        said = undefined;
      }
      check(said?.cartEmpty !== undefined && said?.['refused.off_sale'] !== undefined && said?.customs !== undefined, `${where} does not hand the element its words in ${lang}`);
      // Every hook of the cart, written as markup.
      for (const { hook } of [...CART.always, ...CART.said]) {
        const name = /^\[name=([a-z]+)\]$/.exec(hook);
        const data = /^\[(data-[a-z-]+)\]$/.exec(hook);
        check(name ? new RegExp(`\\sname="${name[1]}"`).test(cart) : data ? new RegExp(`\\s${data[1]}(?=[\\s>=])`).test(cart) : false, `${where} does not carry ${hook}`);
      }
      const options = [...cart.matchAll(/<option value="([A-Z]{2})"[^>]*>([^<]*)<\/option>/g)].map((one) => [one[1], one[2]]);
      check(JSON.stringify(options) === JSON.stringify([['CH', names[0]], ['LI', names[1]], ['DE', names[2]]]), `${where}'s country is not a select of the zones' countries, named in ${lang}: ${JSON.stringify(options)}`);
      check(new RegExp(`<h1[^>]*>${heading}</h1>`).test(cart) && (cart.match(/<h1[\s>]/g) ?? []).length === 1, `${where} is not headed «${heading}», once`);
      check(/<jtk-cart[\s>]/.test(cart) && /<script type="module" src="[^"]+"/.test(cart) && /<noscript><p[^>]*>[^<]+<\/p><\/noscript>/.test(cart), `${where} has no <jtk-cart>, no script for it or no <noscript> sentence`);
      // One page's robots are every page's: no per-page noindex (the layout has none), and nothing of the scaffold changed.
      check(robots(cart) !== undefined && robots(cart) === robots(page('')) && !/noindex/.test(cart), `${where} is not as indexable as the home page: ${robots(cart)}`);
      // The sitemap lists the content's pages, and the cart is nobody's content.
      check(!sitemap.includes(`${where}/`) && !sitemap.includes(`${where}<`), `sitemap.xml names ${where}`);
      // The language switch goes to the cart in the other language, which the cart has.
      const other = address === 'cart' ? '/en/cart' : '/cart';
      check(new RegExp(`<a href="${other}" hreflang="[^"]*"`).test(cart), `${where}'s language switch does not go to ${other}`);
    }
    check(!sitemap.includes('/cart'), 'sitemap.xml names the cart');
    // The header links to it, in each language, as the site's own navigation does.
    for (const [address, href, label] of [['', '/cart', 'Warenkorb'], ['en', '/en/cart', 'Cart']]) {
      const home = page(address);
      check(new RegExp(`<a href="${href}"[^>]*data-jtk-path="shared:blocks\\[header\\]\\.nav\\[nav-cart\\]\\.label"[^>]*>${label}</a>`).test(home), `/${address} has no link to ${href} in the header, annotated, saying «${label}»`);
    }
  }
  settle('the cart\'s page');

  // ── 6 · the checkout step, under the cart ────────────────────────────────
  for (const [address, lang, back] of [['cart', 'de-CH', '/order'], ['en/cart', 'en', '/en/order']]) {
    const cart = page(address);
    const where = `/${address}`;
    const form = /<form\b[^>]*\sdata-checkout(?=[\s>=])[^>]*>/.exec(cart)?.[0];
    check(form !== undefined, `${where} has no form[data-checkout]`);
    const at = form === undefined ? -1 : cart.indexOf(form);
    const step = at < 0 ? '' : cart.slice(at, cart.indexOf('</form>', at));
    check(at > cart.indexOf('data-cart-lines'), `${where} does not draw the checkout below the cart`);
    check(attr(form, 'data-return') === back, `${where}'s checkout sends the buyer back to ${attr(form, 'data-return')}, not to the order's page in its language, ${back}`);
    check(attr(form, 'data-api') === '/api/' && attr(form, 'data-locale') === lang, `${where}'s checkout does not say its api and its language (${lang}): ${form}`);
    check(/\shidden(?=[\s>=])/.test(form ?? '') && /\snovalidate(?=[\s>=])/.test(form ?? ''), `${where}'s checkout is not hidden until the cart hands on, or lets the browser judge it: ${form}`);
    // Every hook of the checkout, written as markup in its form.
    for (const { hook } of [...CHECKOUT.always, ...CHECKOUT.said]) {
      const name = /^\[name=([a-z_0-9]+)\]$/.exec(hook);
      const data = /^(?:form)?\[(data-[a-z-]+)\]$/.exec(hook);
      check(name ? new RegExp(`\\sname="${name[1]}"`).test(step) : data ? new RegExp(`\\s${data[1]}(?=[\\s>=])`).test(step) : false, `${where}'s checkout does not carry ${hook}`);
    }
    // The words for every answer the shop gives a press, in the page's language.
    let said;
    try {
      said = JSON.parse(attr(form, 'data-words') ?? '');
    } catch {
      said = undefined;
    }
    const W = shopWordsFor(lang);
    const unsaid = CHECKOUT_WORDS.filter((key) => said?.[key] !== W[key]);
    check(unsaid.length === 0, `${where}'s checkout does not hand its element the words for ${unsaid.join(', ')} in ${lang}`);
    check(/<jtk-checkout[\s>]/.test(cart) && new RegExp(`<h2[^>]*>${W.checkout}</h2>`).test(step) && new RegExp(`<button[^>]*\\stype="submit"[^>]*\\sdata-pay[^>]*>${W.pay}</button>`).test(step), `${where} has no <jtk-checkout>, no heading «${W.checkout}» or no ${W.pay} button for it`);
  }
  settle('the checkout step');

  // ── 7 · the page after payment ───────────────────────────────────────────
  {
    const robots = (html) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];
    const sitemap = readFileSync(join(site, 'dist/sitemap.xml'), 'utf8');
    for (const [address, lang, cart] of [['order', 'de-CH', '/cart'], ['en/order', 'en', '/en/cart']]) {
      const html = page(address);
      const where = `/${address}`;
      const W = shopWordsFor(lang);
      const root = /<[a-z]+\b[^>]*\sdata-order(?=[\s>=])[^>]*>/.exec(html)?.[0];
      check(root !== undefined, `${where} has no [data-order]`);
      check(attr(root, 'data-api') === '/api/' && attr(root, 'data-locale') === lang, `${where} does not say its api and its language (${lang}): ${root}`);
      // Every hook of the order, written as markup in its root.
      const at = root === undefined ? -1 : html.indexOf(root);
      const step = at < 0 ? '' : html.slice(at, html.indexOf('</section>', at));
      for (const { hook } of [...ORDER.always, ...ORDER.said]) {
        const data = /^\[(data-[a-z-]+)\]$/.exec(hook);
        check(data ? new RegExp(`\\s${data[1]}(?=[\\s>=])`).test(step) : false, `${where} does not carry ${hook}`);
      }
      // The words for every state, in the page's language; the element reads them under data-words.
      let said;
      try {
        said = JSON.parse(attr(root, 'data-words') ?? '');
      } catch {
        said = undefined;
      }
      const unsaid = ORDER_WORDS.filter((key) => said?.[key] !== W[key]);
      check(unsaid.length === 0, `${where} does not hand its element the words for ${unsaid.join(', ')} in ${lang}`);
      check(new RegExp(`<h1[^>]*>${W.order}</h1>`).test(html) && (html.match(/<h1[\s>]/g) ?? []).length === 1, `${where} is not headed «${W.order}», once`);
      check(/<jtk-order[\s>]/.test(html) && /<script type="module" src="[^"]+"/.test(html) && new RegExp(`<noscript><p[^>]*>${W.orderNoScript}</p></noscript>`).test(html), `${where} has no <jtk-order>, no script for it or no <noscript> sentence in ${lang}`);
      // The way back to the cart is the cart of this language, which the buyer's cart is on.
      const back = /<a\b[^>]*\sdata-back-to-cart[^>]*>/.exec(step)?.[0];
      check(attr(back, 'href') === cart && /\shidden(?=[\s>=])/.test(back ?? ''), `${where}'s way back to the cart is not ${cart}, hidden: ${back}`);
      check(!/\sdata-pay-again[^>]*\shref=/.test(step) && /<a\b[^>]*\sdata-pay-again/.test(step), `${where}'s Back to paying is not a link with no address of the build's`);
      // No more or less indexable than any page, and the sitemap — the content's pages — leaves it out.
      check(robots(html) !== undefined && robots(html) === robots(page('')) && !/noindex/.test(html), `${where} is not as indexable as the home page: ${robots(html)}`);
      check(!sitemap.includes(`${where}/`) && !sitemap.includes(`${where}<`), `sitemap.xml names ${where}`);
      // No language switch: the other language's page would have no token, and say that no order was found.
      check(!/hreflang=/.test(html.slice(html.indexOf('<body'))) && !html.includes(`href="${address === 'order' ? '/en/order' : '/order'}"`), `${where} offers to switch to the other language's order page, which has no token`);
    }
    check(!sitemap.includes('/order'), 'sitemap.xml names the order page');
  }
  settle('the page after payment');

  // ── 8 · the products' listing ────────────────────────────────────────────
  /** A listing's tiles in the order drawn: each product's id, its opening tag and what is inside it. */
  const tilesOf = (html) => [...html.matchAll(/(<li\b[^>]*\sdata-product-tile(?=[\s>=])[^>]*>)([\s\S]*?)<\/li>/g)].map((one) => ({ id: attr(one[1], 'data-product'), tag: one[1], inner: one[2] }));
  const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  {
    // What each tile of the test shop says, in each language: its title and its lowest price on sale — «from CHF 89» where the
    // variants differ (the bag's two sizes), the price where they do not (all four of the fox's are 29.90).
    const listed = (lang) => [
      [CANDLE, 'kerzenstaender', 'Kerzenständer', money(2400, 'CHF', lang)],
      [FOX, 't-shirt-fox', lang === 'en' ? 'Fox T-shirt' : 'T-shirt «Fox»', money(2990, 'CHF', lang)],
      [BAG, 'tasche-nach-mass', 'Tasche nach Mass', priceWords(lang).from.replace('{amount}', money(8900, 'CHF', lang))],
    ];
    for (const [address, lang, prefix] of [['shop', 'de-CH', ''], ['en/shop', 'en', '/en']]) {
      const html = page(address);
      const where = `/${address}/`;
      const root = /<[a-z]+\b[^>]*\sdata-listing(?=[\s>=])[^>]*>/.exec(html)?.[0];
      check(root !== undefined, `${where} has no [data-listing]`);
      check(attr(root, 'data-api') === '/api/', `${where} does not say its api: ${root}`);
      // The listing `jtk add shop` lays hides nothing: the site chooses it.
      check(!/\sdata-hide-sold-out(?=[\s>=])/.test(root ?? ''), `${where} says data-hide-sold-out, which only a site's own choice does: ${root}`);
      for (const { hook } of [...LISTING.always, ...LISTING.said]) {
        const data = /^\[(data-[a-z-]+)\]$/.exec(hook);
        check(data ? new RegExp(`\\s${data[1]}(?=[\\s>=])`).test(html) : false, `${where} does not carry ${hook}`);
      }
      // Every product is a tile, by its id, in the order of their ranks — and not one is hidden by the build.
      const tiles = tilesOf(html);
      check(JSON.stringify(tiles.map((one) => one.id)) === JSON.stringify([CANDLE, FOX, BAG]), `${where} does not list the three products by their ids, in the order of their ranks: ${tiles.map((one) => one.id)}`);
      // Nothing is hidden by the build but the place for the sentence of an empty listing, which is there, empty, hidden and a status.
      const empty = /<p\b[^>]*\sdata-listing-empty(?=[\s>=])[^>]*>([^<]*)<\/p>/.exec(html);
      check(empty !== null && empty[1] === '' && /\shidden(?=[\s>=])/.test(empty[0]) && /\srole="status"/.test(empty[0]), `${where} has no [data-listing-empty], empty, hidden and a status: ${empty?.[0]}`);
      check(tiles.every((one) => !/\shidden(?=[\s>=])/.test(one.tag)) && !/\shidden(?=[\s>=])/.test(html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<p\b[^>]*\sdata-listing-empty[^>]*>/, '')), `${where} is built with a tile hidden: the build lists every product`);
      // The word it will say is handed to the element, in the page's language.
      let handed;
      try {
        handed = JSON.parse(attr(root, 'data-words') ?? '');
      } catch {
        handed = undefined;
      }
      check(attr(root, 'data-locale') === lang && handed?.listingEmpty === shopWordsFor(lang).listingEmpty && handed.listingEmpty !== '', `${where} does not hand its element the sentence for an empty listing in ${lang}: ${root}`);
      for (const [id, slug, title, price] of listed(lang)) {
        const tile = tiles.find((one) => one.id === id);
        check(tile !== undefined && tile.inner.includes(`href="${prefix}/shop/${slug}/"`), `${where}: the tile of ${slug} does not link to ${prefix}/shop/${slug}/`);
        check(new RegExp(`<h2\\b[^>]*\\sdata-jtk-path="entry:${id}:title"[^>]*>${escaped(title)}</h2>`).test(tile?.inner ?? ''), `${where}: the tile of ${slug} has not its title «${title}» as a heading, annotated as the entry's`);
        // The lowest price on sale, annotated as the variant it is — all four of the fox's are the same, so the first.
        check(new RegExp(`<[a-z]+\\b[^>]*\\sdata-jtk-path="entry:${id}:variants\\[v1\\]\\.price"[^>]*>${escaped(price)}</`).test(tile?.inner ?? ''), `${where}: the tile of ${slug} does not say its lowest price «${price}», annotated as the variant's`);
      }
      check(/<jtk-listing[\s>]/.test(html) && /<script type="module" src="[^"]+"/.test(html) && !/<noscript/.test(html.slice(html.indexOf('<main'), html.indexOf('</main>'))), `${where} has no <jtk-listing> or no script for it, or a <noscript> sentence the whole listing does not need`);
      // The collection's name is the repository's (the kit writes it in the site's language), so both languages say it alike.
      check(/<h1[^>]*>Produkte<\/h1>/.test(html) && (html.match(/<h1[\s>]/g) ?? []).length === 1, `${where} is not headed «Produkte», the collection's name, once`);
      // The scaffold's own listing left /shop to it: the page at the address is the shop's, not the blog's cards.
      check(!/class="post-card"/.test(html), `${where} is the scaffold's own listing, not the shop's`);
    }
  }
  namedAreWritten(site, 'the test shop');
  settle('the products\' listing');
  {
    // A site's own choice: its page says `HIDE_SOLD_OUT`, and a product hidden in its file is left out of the listing — and no other.
    // What is sold out is the shop's to say, once the page has loaded: the build lists every product it serves.
    const hiding = copyShop(site, `${site}-hiding`);
    hideSoldOut(hiding);
    // The bag's cheaper variant comes second: its tile says the least price on sale, and annotates that variant's.
    dearerFirst(hiding);
    const candle = join(hiding, 'jtk/entries/products/kerzenstaender.json');
    writeFileSync(candle, `${JSON.stringify({ ...JSON.parse(readFileSync(candle, 'utf8')), visible: false }, null, 2)}\n`);
    // The fox has a cover — a picture of the example's own library — so a tile with a picture is built too.
    const foxFile = join(hiding, 'jtk/entries/products/t-shirt-fox.json');
    const foxEntry = JSON.parse(readFileSync(foxFile, 'utf8'));
    foxEntry.fields.cover = { src: 'media/jtk-example/360fe554c851e54e.jpg', alt: 'Fuchs auf dem Hemd' };
    writeFileSync(foxFile, `${JSON.stringify(foxEntry, null, 2)}\n`);
    const built = spawnSync('npm', ['run', 'build'], { cwd: hiding, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://shop-probe.example/' } });
    if (built.status !== 0) fail(`the listing that hides what is sold out does not build:\n${built.stdout}\n${built.stderr}`);
    for (const [address, prefix] of [['shop', ''], ['en/shop', '/en']]) {
      const html = readFileSync(join(hiding, 'dist', address, 'index.html'), 'utf8');
      const where = `/${address}/ of the site that hides what is sold out`;
      const root = /<[a-z]+\b[^>]*\sdata-listing(?=[\s>=])[^>]*>/.exec(html)?.[0];
      check(/\sdata-hide-sold-out(?=[\s>=])/.test(root ?? ''), `${where}: the listing does not say data-hide-sold-out: ${root}`);
      const tiles = tilesOf(html);
      check(JSON.stringify(tiles.map((one) => one.id)) === JSON.stringify([FOX, BAG]), `${where}: with the candle holder hidden in its file, the listing is not the fox and the bag: ${tiles.map((one) => one.id)}`);
      check(tiles.every((one) => !/\shidden(?=[\s>=])/.test(one.tag)), `${where}: a tile is hidden by the build`);
      check(!html.slice(html.indexOf('<main'), html.indexOf('</main>')).includes(CANDLE), `${where}: the hidden candle holder is still on the listing`);
      check(tiles.every((one) => one.inner.includes(`href="${prefix}/shop/`)), `${where}: a tile does not link under ${prefix}/shop/`);
      // The bag's tile says its least price on sale, which is its second variant's: not the first's 119.00, and annotated as the second's.
      const bagTile0 = tiles.find((one) => one.id === BAG);
      const least = priceWords(address === 'shop' ? 'de-CH' : 'en').from.replace('{amount}', money(8900, 'CHF', address === 'shop' ? 'de-CH' : 'en'));
      check(new RegExp(`<[a-z]+\\b[^>]*\\sdata-jtk-path="entry:${BAG}:variants\\[v2\\]\\.price"[^>]*>${escaped(least)}</`).test(bagTile0?.inner ?? ''), `${where}: with the bag's dearer variant first, its tile does not say «${least}», annotated as the second variant's`);
      // A tile with a cover draws it, with its words and the entry's annotation; one with none draws no picture.
      const [foxTile, bagTile] = [tiles.find((one) => one.id === FOX), tiles.find((one) => one.id === BAG)];
      check(new RegExp(`<img\\b[^>]*\\salt="Fuchs auf dem Hemd"[^>]*\\sdata-jtk-path="entry:${FOX}:cover\\.src"|<img\\b[^>]*\\sdata-jtk-path="entry:${FOX}:cover\\.src"[^>]*\\salt="Fuchs auf dem Hemd"`).test(foxTile?.inner ?? ''), `${where}: the fox's tile does not draw its cover, with its words, annotated as the entry's`);
      check(!/<img\b/.test(bagTile?.inner ?? ''), `${where}: the bag's tile draws a picture it has not got`);
    }
  }
  settle('the listing that hides what is sold out');
  {
    // Built only where the schema turns the shop on: a copy of the site with the module off has no cart, in any language — and
    // still the products' listing, which the sitemap names.
    const off = `${site}-off`;
    cpSync(site, off, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.git)$/.test(from) });
    symlinkSync(join(site, 'node_modules'), join(off, 'node_modules'));
    // The site chose to hide what is sold out, and then turned the shop off by hand, leaving the files.
    hideSoldOut(off);
    const blocks = join(off, 'src/content/blocks.ts');
    const source = readFileSync(blocks, 'utf8');
    const on = /^export const MODULES: Modules = \{[\s\S]*?\n\};/m;
    check(on.test(source) && /shop: \{ products: 'products' \}/.test(source), 'the site\'s MODULES is not where the test turns the shop off');
    writeFileSync(blocks, source.replace(on, 'export const MODULES: Modules = {};'));
    rmSync(join(off, 'jtk/modules/shop.json'));
    const emitted = spawnSync('node', [bin, 'schema', '--emit-only', '--root', off], { encoding: 'utf8' });
    if (emitted.status !== 0) fail(`the shop turned off: jtk schema says\n${emitted.stdout}\n${emitted.stderr}`);
    const built = spawnSync('npm', ['run', 'build'], { cwd: off, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://shop-probe.example/' } });
    if (built.status !== 0) fail(`the shop turned off: the site does not build:\n${built.stdout}\n${built.stderr}`);
    check(existsSync(join(off, 'dist/shop/index.html')) && existsSync(join(off, 'dist/index.html')), 'the shop turned off: the site has lost its other pages');
    // The products are still listed at /shop, in both languages — the sitemap and llms.txt name them there — and, though the page says
    // HIDE_SOLD_OUT, the listing does not ask a shop that is off: it says no data-hide-sold-out.
    for (const [address, lang] of [['shop', 'de-CH'], ['en/shop', 'en']]) {
      const file = join(off, 'dist', address, 'index.html');
      if (!existsSync(file)) {
        check(false, `the shop turned off: /${address}/ is not built, though the sitemap names it`);
        continue;
      }
      const html = readFileSync(file, 'utf8');
      const root = /<[a-z]+\b[^>]*\sdata-listing(?=[\s>=])[^>]*>/.exec(html)?.[0];
      check(JSON.stringify(tilesOf(html).map((one) => one.id)) === JSON.stringify([CANDLE, FOX, BAG]), `the shop turned off: /${address}/ does not list the three products by their ids`);
      check(root !== undefined && !/\sdata-hide-sold-out(?=[\s>=])/.test(root), `the shop turned off: /${address}/ asks a shop that is off (${lang}): ${root}`);
    }
    namedAreWritten(off, 'the shop turned off');
    check(!existsSync(join(off, 'dist/cart')) && !existsSync(join(off, 'dist/en/cart')), 'the shop turned off: the site still has a cart page');
    check(!existsSync(join(off, 'dist/order')) && !existsSync(join(off, 'dist/en/order')), 'the shop turned off: the site still has a page after payment');
  }
  settle('the cart, with the shop off');

  // ── 4 · the owner's, never the buyer's ───────────────────────────────────
  ownersOnly(site, 'the test shop');
  check(page('shop/t-shirt-fox').includes('data-jtk-path="made_in"'), 'the fox does not draw where it is made');
  settle('the owner\'s facts');

  // ── 3 · at the edges of the content ──────────────────────────────────────
  for (const variant of ['empty', 'full']) {
    const copy = `${site}-${variant}`;
    cpSync(site, copy, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.git)$/.test(from) });
    symlinkSync(join(site, 'node_modules'), join(copy, 'node_modules'));
    varyContent(copy, variant);
    judged(copy, `every optional field of every product ${variant === 'full' ? 'filled and long' : 'empty'}`);
    if (variant === 'full') {
      ownersOnly(copy, 'every optional field filled and long');
      settle('the owner\'s facts, at the edge');
    }
  }

  // ── 9 · a site with no shop builds as before ─────────────────────────────
  // The scaffold's entry page looks for the site's own `Product.astro`, which only `jtk add shop` lays. A site with none matches nothing
  // there and draws every entry as it always did: built with the entry page as it is, and with the shop's lines taken out of it, its dist/
  // is the same, file for file and byte for byte — and holds no trace of the shop, in a page, a script or a stylesheet. The site has what
  // the entry page draws — a blog's posts and a salon's services and masters — in two languages, and its node_modules are the shop's, since
  // the template's are the same.
  {
    const plain = join(dir, 'plain');
    const made = spawnSync('node', [bin, 'create', 'plain-probe', '--locale', 'de-CH', '--locales', 'en', '--blog', '--kit', join(import.meta.dirname, 'fixtures/kit-salon.json'), '--no-git', '--out', plain], { encoding: 'utf8' });
    if (made.status !== 0) fail(`a site with no shop: jtk create says\n${made.stdout}\n${made.stderr}`);
    const before = `${plain}-before`;
    cpSync(plain, before, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.git)$/.test(from) });
    for (const one of [plain, before]) symlinkSync(join(site, 'node_modules'), join(one, 'node_modules'));
    const entryPage = 'src/pages/[...entry].astro';
    check(!existsSync(join(plain, 'src/components/shop')) && !/shop/.test(readFileSync(join(plain, 'src/content/blocks.ts'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')), 'a site with no shop: the site has shop files or a shop in its declaration');
    writeFileSync(join(before, entryPage), withoutTheShop(readFileSync(join(before, entryPage), 'utf8')));
    for (const one of [plain, before]) {
      const built = spawnSync('npm', ['run', 'build'], { cwd: one, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://plain-probe.example/' } });
      if (built.status !== 0) fail(`a site with no shop: ${one === plain ? 'the site' : 'the site with the shop\'s lines taken out of its entry page'} does not build:\n${built.stdout}\n${built.stderr}`);
    }
    const [now, then] = [treeOf(join(plain, 'dist')), treeOf(join(before, 'dist'))];
    const pages = [...now.keys()].filter((one) => one.endsWith('.html'));
    // The subject: pages the entry page's generic article draws, in both languages — a comparison of two builds of nothing holds nothing.
    const drawn = pages.filter((one) => /<article class="entry"/.test(now.get(one).toString('utf8')));
    check(drawn.length >= 4 && drawn.some((one) => one.startsWith('en/')) && drawn.some((one) => !one.startsWith('en/')), `a site with no shop: the entry page's generic article draws only ${drawn.length} page(s), in one language at most: ${drawn.join(', ')} of ${pages.length}`);
    const only = (a, b, said) => [...a.keys()].filter((one) => !b.has(one)).map((one) => `${one} (${said})`);
    const differing = [...now.keys()].filter((one) => then.has(one) && !now.get(one).equals(then.get(one)));
    const apart = [...only(now, then, 'only with the shop\'s lines in the entry page'), ...only(then, now, 'only without them'), ...differing.map((one) => `${one} (different bytes)`)];
    check(apart.length === 0, `a site with no shop does not build as before: ${apart.length} file(s) of its dist/ differ with the shop's lines in the entry page:\n    ${apart.slice(0, 8).join('\n    ')}`);
    // And no trace of the shop in what it ships: the elements, their scripts, the cart's storage, the protocol's header and addresses.
    const TRACES = /jtk-(?:product|cart|checkout|order|listing)\b|data-(?:product|listing|cart|checkout|order)\b|jtk:cart|x-jtk-shop|\/api\/(?:shipping|stock|checkout)\b|@jtakeit\/kit\/elements\/shop/i;
    const traced = [...now].filter(([, bytes]) => TRACES.test(bytes.toString('utf8'))).map(([name]) => name);
    check(traced.length === 0, `a site with no shop carries the shop: ${traced.slice(0, 6).join(', ')} say the shop's elements, storage or addresses`);
    check(!['shop', 'cart', 'order', 'en/shop', 'en/cart', 'en/order'].some((one) => existsSync(join(plain, 'dist', one))), 'a site with no shop has a page of the shop');
    check(![...now.keys()].some((one) => /(?:^|[\\/])Product\.astro[^\\/]*$/.test(one)), 'a site with no shop ships a script of the shop\'s product page');
  }
  settle('a site with no shop');

  console.log('shop: the product\'s page is the site\'s own — its form, its facts and every option, the first price annotated, in German and English — and judged and linted clean, at the edges of the content too; the cart\'s page at /cart and /en/cart, linked from the header, left out of the sitemap, and not built where the shop is off; the checkout under the cart, every hook and every answer\'s words, coming back to /order and /en/order; the page after payment there, every hook and every state\'s words, no switch of language, left out of the sitemap, and not built where the shop is off; the products\' listing at /shop and /en/shop, every product a tile with its title and its lowest price annotated, hiding nothing as the unit lays it, and the same listing of a site that chooses to hide what is sold out built with every product it serves, the bag\'s least price on sale where it is not the first variant\'s; and, where the shop is off, built all the same and asking nothing, every address the sitemap and llms.txt name a page the build wrote; and a site with no shop built as before — the same dist/, byte for byte, with the shop\'s lines taken out of the scaffold\'s entry page, and no trace of the shop in it');
} catch (why) {
  if (!(why instanceof Failure)) throw why;
  console.error(`shop: ${why.message}`);
  process.exitCode = 1;
} finally {
  if (!process.env.KEEP_SHOP) rmSync(dir, { recursive: true, force: true });
  else console.log(`shop: kept ${dir}`);
}
