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
//
// Every built page of the shop is held as test/create3.mjs holds the
// example's: no element says an attribute twice, no heading skips a level.
// The kit is this checkout's, packed. The walk in a real Chrome is
// test/a11y-shop.mjs's, outside `npm test`.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { money } from '../kit/lib/money.mjs';
import { CART, CHECKOUT } from '../kit/lib/shop/hooks.mjs';
import { CHECKOUT_WORDS } from '../kit/lib/shop/checkout.mjs';
import { shopWordsFor } from '../kit/lib/shop/words.mjs';
import { layShop } from './shop-site.mjs';
import { varyContent } from './variants.mjs';

const bin = resolve(import.meta.dirname, '../bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-shop-'));
const FOX = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02';
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
  for (const file of walk(join(site, 'dist')).filter((one) => one.endsWith('.html') && /[\\/](shop|cart)[\\/]/.test(one))) {
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
  {
    // Built only where the schema turns the shop on: a copy of the site with the module off has no cart, in any language.
    const off = `${site}-off`;
    cpSync(site, off, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.git)$/.test(from) });
    symlinkSync(join(site, 'node_modules'), join(off, 'node_modules'));
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
    check(!existsSync(join(off, 'dist/cart')) && !existsSync(join(off, 'dist/en/cart')), 'the shop turned off: the site still has a cart page');
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

  console.log('shop: the product\'s page is the site\'s own — its form, its facts and every option, the first price annotated, in German and English — and judged and linted clean, at the edges of the content too; the cart\'s page at /cart and /en/cart, linked from the header, left out of the sitemap, and not built where the shop is off; the checkout under the cart, every hook and every answer\'s words, coming back to /order and /en/order');
} catch (why) {
  if (!(why instanceof Failure)) throw why;
  console.error(`shop: ${why.message}`);
  process.exitCode = 1;
} finally {
  if (!process.env.KEEP_SHOP) rmSync(dir, { recursive: true, force: true });
  else console.log(`shop: kept ${dir}`);
}
