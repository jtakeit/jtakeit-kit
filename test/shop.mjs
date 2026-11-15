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
//
// Every built page of the shop is held as test/create3.mjs holds the
// example's: no element says an attribute twice, no heading skips a level.
// The kit is this checkout's, packed. The walk in a real Chrome is
// test/a11y-shop.mjs's, outside `npm test`.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { money } from '../kit/lib/money.mjs';
import { layShop } from './shop-site.mjs';
import { varyContent } from './variants.mjs';

const bin = resolve(import.meta.dirname, '../bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-shop-'));
const FOX = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02';
const fail = (m) => {
  console.error(`shop: ${m}`);
  process.exit(1);
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
  for (const file of walk(join(site, 'dist')).filter((one) => one.endsWith('.html') && /[\\/]shop[\\/]/.test(one))) {
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

try {
  const site = await layShop(dir);
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

  // ── 3 · at the edges of the content ──────────────────────────────────────
  for (const variant of ['empty', 'full']) {
    const copy = `${site}-${variant}`;
    cpSync(site, copy, { recursive: true, filter: (from) => !/[\\/](node_modules|dist|\.git)$/.test(from) });
    symlinkSync(join(site, 'node_modules'), join(copy, 'node_modules'));
    varyContent(copy, variant);
    judged(copy, `every optional field of every product ${variant === 'full' ? 'filled and long' : 'empty'}`);
  }

  console.log('shop: the product\'s page is the site\'s own — its form, its facts and every option, the first price annotated, in German and English — and judged and linted clean, at the edges of the content too');
} finally {
  if (!process.env.KEEP_SHOP) rmSync(dir, { recursive: true, force: true });
  else console.log(`shop: kept ${dir}`);
}
