// What the storefront's five pieces share and can be decided without a page
// (jtakeit-core wiki/102 stage 9, decision 6): the words in eight languages,
// the hooks each piece's markup keeps, the cart as the protocol's lines and
// nothing else, and a product's facts — which value of which option is sold
// out, an answer held to what the product asks.
//
// The test shop (Ruling 200) is `fixtures/shop/jtk/`, a tree to lay over a
// site: the golden shop's three products, copied from jtakeit-core's
// backend/api/sites/testdata/layout3/shop.json at dca045af (Task 9.7's
// commit); the fox's English translation; the golden's settings with a second
// zone, `eu`, sending to DE by `eu-post`, so a sent country is abroad and the
// customs sentence shows; and `site.json`, whose currency the door's money
// needs. Its schema is the golden's too (fixtures/platform/shop-schema.json),
// which `jtk add shop` lays on a site, so the door reads it here beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { content } from '../lib/content/index.mjs';
import { readJtk } from '../lib/content/node.mjs';
import { SHOP_LOCALES, shopWordsFor } from '../lib/shop/words.mjs';
import { PRODUCT, CART, CHECKOUT, ORDER, LISTING, lacking } from '../lib/shop/hooks.mjs';
import { MAX_LINES, MAX_QTY, cartKey, readCart, addLine, removeLine, setQty, shippingBody } from '../lib/shop/cart.mjs';
import { productFacts, variantFor, valueStates, answersOf, fromPrice } from '../lib/shop/product.mjs';
import * as barrel from '../index.mjs';

const now = Date.parse('2026-11-15T12:00:00Z');
const shopRoot = fileURLToPath(new URL('./fixtures/shop/', import.meta.url));
const schema = JSON.parse(readFileSync(new URL('./fixtures/platform/shop-schema.json', import.meta.url), 'utf8'));

/** The test shop as the door reads it: the golden's schema, in German and English, over the files laid on it. */
async function testShop(extra = {}) {
  const files = await readJtk(shopRoot);
  return content({ ...files, '/jtk/schema.json': { ...schema, locales: ['en'] }, ...extra }, { now });
}

// ── the words ─────────────────────────────────────────────────────────────

// Every language the storefront speaks says every word it has: a key one
// language has and another has not is a sentence the buyer reads in English in
// the middle of their own — and the placeholders in a word are the same in
// each, or the element's replace() leaves one unfilled.
test('every language has every word, with the same placeholders', () => {
  const holes = (text) => (text.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
  const en = shopWordsFor('en');
  assert.deepEqual([...SHOP_LOCALES], ['uk', 'de', 'en', 'ru', 'es', 'it', 'pt', 'fr']);
  for (const locale of SHOP_LOCALES) {
    const words = shopWordsFor(locale);
    assert.deepEqual(Object.keys(words).sort(), Object.keys(en).sort(), `${locale} has the English keys`);
    for (const key of Object.keys(en)) {
      assert.equal(typeof words[key], 'string', `${locale}.${key}`);
      assert.ok(words[key].trim() !== '', `${locale}.${key} says something`);
      assert.equal(holes(words[key]), holes(en[key]), `${locale}.${key} keeps the placeholders ${holes(en[key])}`);
    }
  }
  assert.deepEqual(shopWordsFor('pl'), en, 'a language the kit has no words in reads English');
  assert.deepEqual(shopWordsFor(undefined), en);
  assert.deepEqual(shopWordsFor('__proto__'), en);
});

test('the words the spec and the protocol fix are exactly as they are written, and a regional tag reads its language', () => {
  const en = shopWordsFor('en');
  assert.equal(en.soldOut, 'Sold out');
  assert.equal(en.left, '{n} left');
  assert.equal(en.inStock, 'In stock');
  assert.equal(en.addToCart, 'Add to cart');
  assert.equal(en.vat, 'incl. VAT');
  assert.equal(en.ownCurrency, 'You can pay in your own currency');
  assert.equal(en.customs, 'Customs duties are paid at the door by the buyer');
  assert.equal(en.payAgain, 'Back to paying');
  assert.equal(en.address, 'Stripe could not work out the tax for this address: check it, and start again');
  // The refusal codes of a line, and the order page's states, by the protocol's names.
  for (const code of ['not_sold', 'off_sale', 'quantity', 'answer', 'too_large']) assert.ok(en[`refused.${code}`], `refused.${code}`);
  for (const state of ['waiting', 'left', 'paid', 'lapsed', 'cancelled', 'unknown', 'stillWaiting']) assert.ok(en[`state.${state}`], `state.${state}`);
  // Each of a page's faults an answer can have.
  for (const word of ['required', 'too_long', 'not_a_choice']) assert.ok(en[`fault.${word}`], `fault.${word}`);
  assert.equal(shopWordsFor('de').soldOut, 'Ausverkauft');
  assert.deepEqual(shopWordsFor('de-CH'), shopWordsFor('de'), 'de-CH is German');
  assert.deepEqual(shopWordsFor('FR-ch'), shopWordsFor('fr'));
  // A fresh object each time: a site that writes its own over them changes no other's.
  shopWordsFor('en').soldOut = 'Gone';
  assert.equal(shopWordsFor('en').soldOut, 'Sold out');
});

// ── the hooks ─────────────────────────────────────────────────────────────

/** How a hook is written in markup: `data-x`, `name="x"`, `name="x:<key>"`. */
function written(hook) {
  const name = /^\[name=([a-z0-9_]+)\]$/.exec(hook);
  if (name) return `name="${name[1]}"`;
  const prefix = /^\[name\^="([a-z]+:)"\]$/.exec(hook);
  if (prefix) return `name="${prefix[1]}`;
  const data = /\[(data-[a-z-]+)\]$/.exec(hook);
  assert.ok(data, `a hook is a data attribute or a name: ${hook}`);
  return data[1];
}

test("every piece's hooks are data or names, never a class", () => {
  const pieces = { PRODUCT, CART, CHECKOUT, ORDER, LISTING };
  for (const [name, piece] of Object.entries(pieces)) {
    const hooks = [...piece.always, ...piece.said];
    assert.ok(piece.always.length > 0, `${name} has hooks it cannot work without`);
    for (const { hook, says } of hooks) {
      assert.ok(!hook.startsWith('.') && !/\.[a-z]/.test(hook), `${name}: ${hook} is no class`);
      assert.ok(says.trim() !== '', `${name}: ${hook} says what it is`);
      written(hook);
    }
    assert.equal(new Set(hooks.map((one) => one.hook)).size, hooks.length, `${name}: each once`);
    // The root first: the form or the element's own attribute.
    assert.match(piece.always[0].hook, /^(form)?\[data-[a-z-]+\]$/, `${name}: the root first`);
    assert.ok(Object.isFrozen(piece) && Object.isFrozen(piece.always) && Object.isFrozen(piece.said), `${name} is not for writing over`);
  }
  // Each piece's lists exactly as the brief of Task 9.10 gives them, root first: Tasks 9.12 to 9.16 read these as the truth.
  const pinned = {
    PRODUCT: [
      ['form[data-product]', '[name^="option:"]', '[data-price]', '[data-stock]', '[name=qty]', '[data-add]', '[data-product-error]', '[data-added]'],
      ['[name^="answer:"]', '[data-from]'],
    ],
    CART: [
      ['[data-cart]', '[data-cart-lines]', '[data-cart-empty]', '[name=country]', '[data-methods]', '[data-subtotal]', '[data-cart-error]', '[data-to-checkout]'],
      ['[data-abroad]', '[data-vat]', '[data-cannot-send]'],
    ],
    CHECKOUT: [
      [
        'form[data-checkout]', '[name=name]', '[name=email]', '[name=phone]', '[data-address]', '[name=line1]', '[name=line2]', '[name=postal_code]', '[name=city]',
        '[data-total]', '[data-challenge]', '[data-checkout-error]', '[data-pay]',
      ],
      ['[data-abroad]', '[data-vat]', '[data-own-currency]'],
    ],
    ORDER: [
      ['[data-order]', '[data-order-state]', '[data-order-lines]', '[data-order-total]', '[data-pay-again]'],
      ['[data-order-number]', '[data-order-method]', '[data-back-to-cart]'],
    ],
    LISTING: [
      ['[data-listing]', '[data-product-tile]'],
      ['[data-listing-group]'],
    ],
  };
  for (const [name, piece] of Object.entries(pieces)) {
    assert.deepEqual(piece.always.map((one) => one.hook), pinned[name][0], `${name}.always`);
    assert.deepEqual(piece.said.map((one) => one.hook), pinned[name][1], `${name}.said`);
  }
  assert.deepEqual(Object.keys(pinned), Object.keys(pieces), 'all five pieces are pinned');
});

test("lacking names the hooks a piece's root does not have, and counts the root's own", () => {
  /** A root that matches and finds the selectors it is told to. */
  const root = (has, itself = []) => ({
    querySelector: (selector) => (has.includes(selector) ? {} : null),
    matches: (selector) => itself.includes(selector),
  });
  const all = PRODUCT.always.map((one) => one.hook);
  assert.deepEqual(lacking(root(all), PRODUCT), []);
  assert.deepEqual(lacking(root([]), PRODUCT), all, 'an empty root lacks them all, the root first');
  assert.deepEqual(lacking(root(all.filter((hook) => hook !== '[data-stock]' && hook !== '[data-add]')), PRODUCT), ['[data-stock]', '[data-add]']);
  assert.deepEqual(lacking(root(all.filter((hook) => hook !== 'form[data-product]'), ['form[data-product]']), PRODUCT), [], "the root's own hook is found on the root");
  // A root with no `matches`, as a document fragment has none.
  assert.deepEqual(lacking({ querySelector: () => null }, LISTING), LISTING.always.map((one) => one.hook));
  // The said hooks are never asked for.
  assert.deepEqual(lacking(root(CART.always.map((one) => one.hook)), CART), []);
});

// ── the cart ──────────────────────────────────────────────────────────────

const line = (extra = {}) => ({ product: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02', variant: 'v1', qty: 2, answers: {}, ...extra });
const stored = (lines, extra = {}) => JSON.stringify({ v: 1, lines, country: 'CH', method: 'economy', ...extra });
const EMPTY = { v: 1, lines: [], country: '', method: '' };

test("a cart keeps the protocol's line and nothing else", () => {
  const read = readCart('{"v":1,"lines":[{"product":"p","variant":"v1","qty":2,"answers":{},"unit":2990,"title":"Fox"}],"country":"CH","method":"post"}');
  assert.equal(read.lines.length, 1);
  assert.deepEqual(Object.keys(read.lines[0]), ['product', 'variant', 'qty', 'answers']);
  assert.deepEqual(read, { v: 1, lines: [{ product: 'p', variant: 'v1', qty: 2, answers: {} }], country: 'CH', method: 'post' });

  // Anything else is an empty cart, a fresh one each time.
  assert.deepEqual(readCart('nonsense'), EMPTY);
  assert.deepEqual(readCart(null), EMPTY);
  assert.deepEqual(readCart(undefined), EMPTY);
  assert.deepEqual(readCart(''), EMPTY);
  assert.deepEqual(readCart('[]'), EMPTY);
  assert.deepEqual(readCart('{"v":2,"lines":[{"product":"p","variant":"v1","qty":1}]}'), EMPTY, 'a version this kit does not know');
  assert.notEqual(readCart(null), readCart(null));
  assert.deepEqual(readCart('{"v":1}'), EMPTY);
  assert.deepEqual(readCart('{"v":1,"lines":"p","country":7,"method":null}'), EMPTY);

  // At most a hundred lines.
  const many = Array.from({ length: 101 }, (_, i) => line({ variant: `v${i}` }));
  const kept = readCart(stored(many));
  assert.equal(kept.lines.length, MAX_LINES);
  assert.equal(MAX_LINES, 100);
  assert.equal(kept.lines[99].variant, 'v99', 'the first hundred');

  // A quantity of 0 takes the line out, one over 999 is 999; no quantity at all is none.
  const qtys = readCart(stored([line({ variant: 'a', qty: 0 }), line({ variant: 'b', qty: 1000 }), line({ variant: 'c', qty: 7 }), line({ variant: 'd', qty: -3 }), line({ variant: 'e', qty: '5' }), line({ variant: 'f', qty: 2.9 }), line({ variant: 'g', qty: null })]));
  assert.deepEqual(qtys.lines.map((one) => [one.variant, one.qty]), [['b', 999], ['c', 7], ['f', 2]]);
  assert.equal(MAX_QTY, 999);

  // A line that names no product or variant is none, and its answers are what the protocol takes.
  const odd = readCart(stored([
    { variant: 'v1', qty: 1 }, { product: 'p', qty: 1 }, { product: 'p', variant: '', qty: 1 }, 'p', null,
    { product: 'p', variant: 'v1', qty: 1, answers: { zipper: true, tag: ' Ada ', body: 'rot', off: false, empty: '', blank: '  ', n: 3, nested: { a: 1 } } },
  ]));
  assert.equal(odd.lines.length, 1);
  assert.deepEqual(odd.lines[0].answers, { zipper: true, tag: ' Ada ', body: 'rot' });
  assert.deepEqual(readCart(stored([{ product: 'p', variant: 'v1', qty: 1, answers: 'rot' }])).lines[0].answers, {});
});

test('a line added is the same line as one bought before, and a cart is never changed in place', () => {
  const none = readCart(null);
  const one = addLine(none, line());
  assert.deepEqual(none, EMPTY, 'the cart that was given is as it was');
  assert.equal(one.lines.length, 1);

  // The same product, variant and answers add up.
  const two = addLine(one, line());
  assert.deepEqual(two.lines.map((l) => l.qty), [4]);
  assert.equal(one.lines[0].qty, 2);
  // Whatever order the answers were written in.
  const bag = addLine(addLine(none, line({ answers: { zipper: true, tag: 'Ada' } })), line({ answers: { tag: 'Ada', zipper: true } }));
  assert.deepEqual(bag.lines.map((l) => l.qty), [4]);
  // Another answers, another variant, another product: another line.
  const other = addLine(two, line({ answers: { tag: 'Ada' } }));
  assert.equal(other.lines.length, 2);
  assert.equal(addLine(other, line({ variant: 'v2' })).lines.length, 3);
  assert.equal(addLine(other, line({ product: 'elsewhere' })).lines.length, 3);
  assert.deepEqual(addLine(other, line({ answers: { tag: 'Bo' } })).lines.map((l) => l.qty), [4, 2, 2]);
  // Up to 999 and no more.
  assert.equal(addLine(addLine(none, line({ qty: 600 })), line({ qty: 600 })).lines[0].qty, MAX_QTY);
  assert.equal(addLine(none, line({ qty: 5000 })).lines[0].qty, MAX_QTY);
  // A line that is none is not added; what a line carries beyond the protocol's four is not kept.
  assert.equal(addLine(none, line({ qty: 0 })).lines.length, 0);
  assert.equal(addLine(none, { product: '', variant: 'v1', qty: 1, answers: {} }).lines.length, 0);
  assert.deepEqual(Object.keys(addLine(none, line({ title: 'Fox', unit: 2990 })).lines[0]), ['product', 'variant', 'qty', 'answers']);
  // The country and the method stay.
  assert.deepEqual({ country: addLine({ ...none, country: 'DE', method: 'eu-post' }, line()).country, method: addLine({ ...none, country: 'DE', method: 'eu-post' }, line()).method }, { country: 'DE', method: 'eu-post' });
  // Nothing of the cart given is shared with the one handed back.
  const shared = addLine(none, line({ answers: { tag: 'Ada' } }));
  const next = addLine(shared, line({ variant: 'v2' }));
  next.lines[0].answers.tag = 'Changed';
  assert.equal(shared.lines[0].answers.tag, 'Ada');
});

test('past a hundred lines nothing new is added, and what is there still adds up', () => {
  let cart = readCart(null);
  for (let i = 0; i < MAX_LINES; i += 1) cart = addLine(cart, line({ variant: `v${i}`, qty: 1 }));
  assert.equal(cart.lines.length, MAX_LINES);
  assert.equal(addLine(cart, line({ variant: 'one-more' })).lines.length, MAX_LINES);
  assert.ok(!addLine(cart, line({ variant: 'one-more' })).lines.some((l) => l.variant === 'one-more'));
  assert.equal(addLine(cart, line({ variant: 'v5', qty: 3 })).lines[5].qty, 4);
});

test('a line removed, and a quantity set — 0 takes the line out', () => {
  const cart = addLine(addLine(addLine(readCart(null), line({ variant: 'a' })), line({ variant: 'b' })), line({ variant: 'c' }));
  assert.deepEqual(removeLine(cart, 1).lines.map((l) => l.variant), ['a', 'c']);
  assert.deepEqual(removeLine(cart, 7).lines.map((l) => l.variant), ['a', 'b', 'c'], 'a place that is no line');
  assert.deepEqual(removeLine(cart, -1).lines.map((l) => l.variant), ['a', 'b', 'c']);
  assert.equal(cart.lines.length, 3);

  assert.deepEqual(setQty(cart, 1, 9).lines.map((l) => l.qty), [2, 9, 2]);
  assert.deepEqual(setQty(cart, 1, 0).lines.map((l) => l.variant), ['a', 'c'], '0 takes the line out');
  assert.deepEqual(setQty(cart, 1, -4).lines.map((l) => l.variant), ['a', 'c']);
  assert.equal(setQty(cart, 0, 5000).lines[0].qty, MAX_QTY);
  assert.equal(setQty(cart, 0, 3.7).lines[0].qty, 3);
  assert.deepEqual(setQty(cart, 0, Number.NaN).lines.map((l) => l.qty), [2, 2, 2], 'what is no number leaves the cart as it is');
  assert.deepEqual(setQty(cart, 0, undefined).lines.map((l) => l.qty), [2, 2, 2]);
  assert.deepEqual(setQty(cart, 9, 4).lines.map((l) => l.qty), [2, 2, 2]);
  assert.deepEqual(cart.lines.map((l) => l.qty), [2, 2, 2], 'the cart given is as it was');
});

test("the cart is kept under the site's api, and sends the shop its lines, the country and the page's language", () => {
  assert.equal(cartKey('/p/fox/api/'), 'jtk:cart:/p/fox/api/');
  assert.equal(cartKey('/api/'), 'jtk:cart:/api/');

  const cart = { ...addLine(readCart(null), line({ answers: { tag: 'Ada' } })), country: 'CH', method: 'economy' };
  const body = shippingBody(cart, 'en');
  assert.equal(body.locale, 'en');
  assert.deepEqual(body, { lines: [{ product: line().product, variant: 'v1', qty: 2, answers: { tag: 'Ada' } }], country: 'CH', locale: 'en' });
  assert.deepEqual(Object.keys(body), ['lines', 'country', 'locale'], 'the method is the checkout\'s, not the shipping\'s');
  assert.equal(shippingBody(readCart(null), 'de-CH').locale, 'de-CH');
  assert.deepEqual(shippingBody(readCart(null), 'en').lines, []);
  // What was stored reads back as it was written.
  assert.deepEqual(readCart(JSON.stringify(cart)), cart);
});

// ── a product's facts ─────────────────────────────────────────────────────

const OPTION = (key, ...values) => ({ _key: key, name: key, values: values.map((value) => ({ _key: value, label: value.toUpperCase() })) });

/** A product of three options — size, colour and fit — through the door, one variant to a combination written. */
function threeOptions(picked, extra = {}) {
  const variants = picked.map(([size, colour, fit, on], i) => ({
    _key: `${size}-${colour}-${fit}`, sku: `SHIRT-${i}`, price: { minor: 2000 + i }, picks: { size, colour, fit }, ...(on === undefined ? {} : { on_sale: on }),
  }));
  const site = content({
    '/jtk/schema.json': schema,
    '/jtk/entries/products/shirt.json': {
      id: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1c01', collection: 'products', slug: 'shirt', visible: true,
      fields: { title: 'Shirt', options: [OPTION('size', 's', 'm'), OPTION('colour', 'red', 'blue'), OPTION('fit', 'slim', 'regular')], variants, ...extra },
    },
    '/jtk/site.json': { currency: 'CHF' },
  }, { now });
  return productFacts(site.entry('products', 'shirt'), 'CHF');
}

// Seven of the eight combinations: `s-red-regular` is not made.
const SEVEN = [
  ['s', 'red', 'slim'], ['s', 'blue', 'slim'], ['s', 'blue', 'regular'], ['m', 'red', 'slim'], ['m', 'red', 'regular'], ['m', 'blue', 'slim'], ['m', 'blue', 'regular'],
];

test('a value is said sold out, or none, by the other options chosen', () => {
  const facts = threeOptions(SEVEN);
  assert.equal(facts.variants.length, 7);
  // The stock answer, by each variant's `_key`: `m-blue-slim` sold out, `s-blue-slim` off sale, the rest in stock.
  const stock = Object.fromEntries(facts.variants.map((one) => [one.key, 'in_stock']));
  stock['m-blue-slim'] = 'sold_out';
  stock['s-blue-slim'] = 'off_sale';

  const blueM = valueStates(facts, stock, { size: 'm', colour: 'blue' });
  assert.deepEqual(blueM.fit, { slim: 'sold_out', regular: 'in_stock' });
  const redS = valueStates(facts, stock, { size: 's', colour: 'red' });
  assert.equal(redS.fit.regular, 'none', 'no such variant is made');
  assert.equal(redS.fit.slim, 'in_stock');
  const blueS = valueStates(facts, stock, { size: 's', colour: 'blue' });
  assert.equal(blueS.fit.slim, 'none', 'it is off sale');
  assert.equal(blueS.fit.regular, 'in_stock');

  // An option is read against the others, never its own choice: a buyer may always switch.
  assert.deepEqual(blueM.size, { s: 'in_stock', m: 'in_stock' }, 'with the fit not chosen, each size has one in stock');
  assert.deepEqual(valueStates(facts, stock, { size: 'm', colour: 'blue', fit: 'slim' }).size, { s: 'none', m: 'sold_out' }, 's-blue-slim is off sale, m-blue-slim sold out');
  assert.deepEqual(valueStates(facts, stock, { size: 'm', colour: 'blue', fit: 'regular' }).colour, { red: 'in_stock', blue: 'in_stock' });
  // Nothing chosen: a value is in stock where any variant of it is, and none where none is made.
  assert.deepEqual(valueStates(facts, stock, {}), {
    size: { s: 'in_stock', m: 'in_stock' },
    colour: { red: 'in_stock', blue: 'in_stock' },
    fit: { slim: 'in_stock', regular: 'in_stock' },
  });
  // What is sold out everywhere is sold out; and an option left as '' is not chosen.
  const allOut = Object.fromEntries(facts.variants.map((one) => [one.key, 'sold_out']));
  assert.deepEqual(valueStates(facts, allOut, { size: '', colour: undefined }).fit, { slim: 'sold_out', regular: 'sold_out' });
  const offEverywhere = Object.fromEntries(facts.variants.map((one) => [one.key, 'off_sale']));
  assert.deepEqual(valueStates(facts, offEverywhere, {}).size, { s: 'none', m: 'none' });
  // A value of an option has a state, and no option is left out.
  assert.deepEqual(Object.keys(blueM), ['size', 'colour', 'fit']);
});

test("a variant the stock answer has not named is read as the build says, and a state the kit does not know is none", () => {
  const facts = threeOptions(SEVEN.map((pick) => [...pick, pick.join('-') === 'm-red-slim' ? false : undefined]));
  assert.equal(facts.variants.find((one) => one.key === 'm-red-slim').onSale, false);
  // No answer at all (not yet arrived, or it failed): on sale reads as in stock, taken off sale as none.
  const states = valueStates(facts, {}, { size: 'm', colour: 'red' });
  assert.deepEqual(states.fit, { slim: 'none', regular: 'in_stock' });
  // The answer wins where it speaks, and a state that is not one of the three is not a way to buy.
  assert.equal(valueStates(facts, { 'm-red-slim': 'in_stock' }, { size: 'm', colour: 'red' }).fit.slim, 'in_stock');
  assert.equal(valueStates(facts, { 'm-red-regular': 'held' }, { size: 'm', colour: 'red' }).fit.regular, 'none');
  assert.equal(valueStates(facts, { 'm-red-regular': 'sold_out' }, { size: 'm', colour: 'red' }).fit.regular, 'sold_out');
});

test('variantFor answers only the variant whose picks are all chosen', () => {
  const facts = threeOptions(SEVEN);
  assert.equal(variantFor(facts, { size: 'm', colour: 'blue', fit: 'slim' }).key, 'm-blue-slim');
  assert.equal(variantFor(facts, { size: 's', colour: 'blue', fit: 'regular' }).key, 's-blue-regular');
  assert.equal(variantFor(facts, { size: 's', colour: 'red', fit: 'regular' }), undefined, 'that one is not made');
  assert.equal(variantFor(facts, { size: 'm', colour: 'blue' }), undefined, 'an option left unchosen');
  assert.equal(variantFor(facts, { size: 'm', colour: 'blue', fit: '' }), undefined);
  assert.equal(variantFor(facts, {}), undefined);
  // A variant whose picks the door read as nothing (a malformed value, or none) is never what is chosen, however little is.
  const broken = { ...facts, variants: [...facts.variants, { key: 'odd', sku: 'ODD', price: 1, picks: {}, onSale: true }] };
  assert.equal(variantFor(broken, {}), undefined);
  assert.equal(variantFor(broken, { size: 'm', colour: 'blue', fit: 'slim' }).key, 'm-blue-slim');
  assert.equal(variantFor({ ...facts, variants: [{ key: 'half', sku: 'H', picks: { size: 'm' }, onSale: true }] }, { size: 'm' }), undefined, 'picks that name an option and not the others');
  assert.equal(variantFor(facts, { size: 'm', colour: 'blue', fit: 'slim', extra: 'x' }).key, 'm-blue-slim', 'what is chosen of nothing the product has is nothing');
  // A product with no option has one variant, picking nothing, and `{}` chooses it.
  const site = content({
    '/jtk/schema.json': schema,
    '/jtk/entries/products/kerze.json': {
      id: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1c02', collection: 'products', slug: 'kerze', visible: true,
      fields: { title: 'Kerze', variants: [{ _key: 'v1', sku: 'KERZ-01', price: { minor: 2400 } }] },
    },
  }, { now });
  const plain = productFacts(site.entry('products', 'kerze'), 'CHF');
  assert.equal(variantFor(plain, {}).sku, 'KERZ-01');
  assert.deepEqual(valueStates(plain, {}, {}), {});
});

/** The bag of the test shop, which asks three questions. */
async function bag() {
  const site = await testShop();
  return productFacts(site.entry('products', 'tasche-nach-mass'), 'CHF');
}

test("a customization's answer is held to what the product asks", async () => {
  const facts = await bag();
  assert.deepEqual(facts.customizations.map((one) => [one.key, one.kind, one.required]), [['body', 'choice', true], ['zipper', 'yes_no', false], ['tag', 'text', false]]);

  // The required body colour unanswered.
  assert.deepEqual(answersOf(facts, {}), { answers: {}, faults: [{ key: 'body', word: 'required' }] });
  assert.deepEqual(answersOf(facts, { body: '' }).faults, [{ key: 'body', word: 'required' }]);
  // A choice that is none of its choices, and one that is.
  assert.deepEqual(answersOf(facts, { body: 'lila' }), { answers: {}, faults: [{ key: 'body', word: 'not_a_choice' }] });
  assert.deepEqual(answersOf(facts, { body: 'rot' }), { answers: { body: 'rot' }, faults: [] });
  assert.deepEqual(answersOf(facts, { body: true }).faults, [{ key: 'body', word: 'not_a_choice' }], 'a choice is answered with its key');
  // The zipper: unticked is no answer, ticked is `true`, and neither is ever a fault.
  assert.deepEqual(answersOf(facts, { body: 'natur', zipper: false }), { answers: { body: 'natur' }, faults: [] });
  assert.deepEqual(answersOf(facts, { body: 'natur', zipper: true }), { answers: { body: 'natur', zipper: true }, faults: [] });
  assert.deepEqual(answersOf(facts, { body: 'natur', zipper: 'on' }).answers, { body: 'natur' }, 'only `true` ticks it');
  // The tag, up to 20 characters: 21 is too long, counted as the shop counts them.
  assert.equal(facts.customizations[2].max, 20);
  assert.deepEqual(answersOf(facts, { body: 'natur', tag: 'a'.repeat(21) }), { answers: { body: 'natur' }, faults: [{ key: 'tag', word: 'too_long' }] });
  assert.deepEqual(answersOf(facts, { body: 'natur', tag: 'a'.repeat(20) }).answers, { body: 'natur', tag: 'a'.repeat(20) });
  assert.deepEqual(answersOf(facts, { body: 'natur', tag: '😀'.repeat(20) }).faults, [], 'twenty characters, though each is two code units');
  assert.deepEqual(answersOf(facts, { body: 'natur', tag: '😀'.repeat(21) }).faults, [{ key: 'tag', word: 'too_long' }]);
  assert.deepEqual(answersOf(facts, { body: 'natur', tag: 'Süd' }).answers.tag, 'Süd', 'composed, as the shop keeps it');
  assert.equal(answersOf(facts, { body: 'natur', tag: `${'a'.repeat(20)}   ` }).faults.length, 0, 'the spaces around it are not counted');
  // A text that says nothing is no answer; an optional one is left out without a fault.
  for (const nothing of ['', '   ', '\u200d', ' \u200c \u200d ', '\u200d\u200c']) assert.deepEqual(answersOf(facts, { body: 'natur', tag: nothing }), { answers: { body: 'natur' }, faults: [] }, JSON.stringify(nothing));
  assert.deepEqual(answersOf(facts, { body: 'natur', tag: ' Ada ' }).answers.tag, 'Ada');
  // Every question answered once, and one the product does not ask is left out.
  assert.deepEqual(answersOf(facts, { body: 'rot', zipper: true, tag: 'Ada', engraving: 'x' }), { answers: { body: 'rot', zipper: true, tag: 'Ada' }, faults: [] });
  // All the faults at once, in the product's order.
  assert.deepEqual(answersOf(facts, { body: 'lila', tag: 'a'.repeat(30) }).faults, [{ key: 'body', word: 'not_a_choice' }, { key: 'tag', word: 'too_long' }]);
  // A product that asks nothing.
  assert.deepEqual(answersOf({ ...facts, customizations: [] }, { body: 'rot' }), { answers: {}, faults: [] });
  // A text that is required, and a choice that is not.
  const asks = { ...facts, customizations: [
    { key: 'note', name: 'Note', kind: 'text', required: true, max: 5, choices: [] },
    { key: 'colour', name: 'Colour', kind: 'choice', required: false, choices: [{ key: 'red', label: 'Red' }] },
  ] };
  assert.deepEqual(answersOf(asks, {}), { answers: {}, faults: [{ key: 'note', word: 'required' }] });
  assert.deepEqual(answersOf(asks, { note: 'ok', colour: 'blue' }).faults, [{ key: 'colour', word: 'not_a_choice' }]);
});

test("a product's facts are read through the door", async () => {
  const site = await testShop();
  const fox = site.entry('products', 't-shirt-fox');
  const facts = productFacts(fox, 'CHF');

  assert.equal(facts.id, '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02');
  assert.equal(facts.id, fox.id);
  assert.equal(facts.currency, 'CHF');
  assert.equal(facts.tracked, true, 'a product counts its stock unless it says it does not');
  assert.deepEqual(facts.options, [
    { key: 'size', name: 'Size', values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }] },
    { key: 'colour', name: 'Colour', values: [{ key: 'red', label: 'Red' }, { key: 'blue', label: 'Blue' }] },
  ]);
  assert.deepEqual(facts.variants, [
    { key: 'v1', sku: 'FOX-S-RED', price: 2990, picks: { size: 's', colour: 'red' }, onSale: true },
    { key: 'v2', sku: 'FOX-M-RED', price: 2990, picks: { size: 'm', colour: 'red' }, onSale: true },
    { key: 'v3', sku: 'FOX-S-BLUE', price: 2990, picks: { size: 's', colour: 'blue' }, onSale: true },
    { key: 'v4', sku: 'FOX-M-BLUE', price: 2990, picks: { size: 'm', colour: 'blue' }, onSale: true },
  ]);
  assert.deepEqual(facts.customizations, []);
  assert.equal(fromPrice(facts), 2990);
  assert.equal(variantFor(facts, { size: 'm', colour: 'blue' }).sku, 'FOX-M-BLUE');

  // In English: the same picks and SKUs — a translation gives words, never what is sold.
  const english = productFacts(site.entry('products', 't-shirt-fox', 'en'), 'CHF');
  assert.equal(site.entry('products', 't-shirt-fox', 'en').fields.text('title'), 'Fox T-shirt');
  assert.equal(english.id, facts.id);
  assert.deepEqual(english.variants, facts.variants);
  assert.deepEqual(english.options, facts.options);

  // The candlestick has no option: one variant, picking nothing.
  const candle = productFacts(site.entry('products', 'kerzenstaender'), 'CHF');
  assert.deepEqual(candle.options, []);
  assert.deepEqual(candle.variants, [{ key: 'v1', sku: 'KERZ-01', price: 2400, picks: {}, onSale: true }]);
  assert.equal(fromPrice(candle), 2400);
  assert.equal(variantFor(candle, {}).key, 'v1');

  // The bag: two sizes at two prices, and what each question adds.
  const tasche = await bag();
  assert.equal(fromPrice(tasche), 8900, 'the lowest of the variants');
  assert.deepEqual(tasche.customizations[0], {
    key: 'body', name: 'Farbe des Körpers', kind: 'choice', required: true,
    choices: [{ key: 'natur', label: 'Natur' }, { key: 'schwarz', label: 'Schwarz' }, { key: 'rot', label: 'Rot', adds: 1000 }],
  });
  assert.deepEqual(tasche.customizations[1], { key: 'zipper', name: 'Reissverschluss', kind: 'yes_no', required: false, adds: 500, choices: [] });
  assert.deepEqual(tasche.customizations[2], { key: 'tag', name: 'Name auf dem Etikett', kind: 'text', required: false, max: 20, choices: [] });
});

test('a product that is taken off sale, not counted, or says what the shop would refuse, is read as the shop reads it', () => {
  const site = content({
    '/jtk/schema.json': schema,
    '/jtk/entries/products/odd.json': {
      id: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1c03', collection: 'products', slug: 'odd', visible: true,
      fields: {
        title: 'Odd', tracked: false,
        // No `_key`: named by its place. A price said «from» is no price; `on_sale` is a switch or never on sale.
        variants: [
          { sku: 'A', price: { minor: 500 }, on_sale: false },
          { _key: 'b', sku: 'B', price: { minor: 700, from: true } },
          { _key: 'c', sku: 'C', price: { minor: 900 }, on_sale: 'false' },
          { _key: 'd', sku: 'D', price: { minor: 1100 }, on_sale: true },
        ],
        customizations: [
          { _key: 'k1', name: 'Odd kind', kind: 'photo' },
          { _key: 'k2', name: 'Always', kind: 'yes_no', required: true },
          { _key: 'k3', name: 'Short', kind: 'text', max: 0 },
        ],
      },
    },
  }, { now });
  const facts = productFacts(site.entry('products', 'odd'), 'CHF');
  assert.equal(facts.tracked, false);
  assert.deepEqual(facts.variants.map((one) => [one.key, one.onSale, one.price]), [['0', false, 500], ['b', true, undefined], ['c', false, 900], ['d', true, 1100]]);
  assert.equal(fromPrice(facts), 1100, 'the lowest of those on sale that have a price');
  assert.deepEqual(facts.customizations.map((one) => [one.key, one.kind, one.required, one.max]), [['k2', 'yes_no', false, undefined], ['k3', 'text', false, undefined]]);
  assert.equal(fromPrice({ ...facts, variants: [] }), undefined);
  assert.equal(fromPrice({ ...facts, variants: facts.variants.slice(0, 1) }), undefined);
  // A product with nothing in it.
  const bare = content({
    '/jtk/schema.json': schema,
    '/jtk/entries/products/bare.json': { id: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1c04', collection: 'products', slug: 'bare', visible: true, fields: { title: 'Bare' } },
  }, { now });
  assert.deepEqual(productFacts(bare.entry('products', 'bare'), 'EUR'), { id: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1c04', currency: 'EUR', tracked: true, options: [], variants: [], customizations: [] });
});

// ── the test shop ─────────────────────────────────────────────────────────

test('the test shop is the golden shop with a zone that sends abroad, and says its currency', async () => {
  const files = await readJtk(shopRoot);
  assert.deepEqual(Object.keys(files), [
    '/jtk/entries/products/kerzenstaender.json',
    '/jtk/entries/products/t-shirt-fox.en.json',
    '/jtk/entries/products/t-shirt-fox.json',
    '/jtk/entries/products/tasche-nach-mass.json',
    '/jtk/modules/shop.json',
    '/jtk/site.json',
  ]);
  assert.deepEqual(files['/jtk/site.json'], { currency: 'CHF' });
  const fox = files['/jtk/entries/products/t-shirt-fox.json'];
  assert.deepEqual(files['/jtk/entries/products/t-shirt-fox.en.json'], { of: fox.id, locale: 'en', fields: { title: 'Fox T-shirt' } });

  const { v, settings } = files['/jtk/modules/shop.json'];
  assert.equal(v, 1);
  assert.deepEqual(settings.zones.map((zone) => [zone._key, zone.countries.map((one) => one.country)]), [['ch', ['CH', 'LI']], ['eu', ['DE']]]);
  assert.deepEqual(settings.methods.map((method) => [method._key, method.zone]), [['economy', 'ch'], ['pickup', 'ch'], ['eu-post', 'eu']]);
  assert.deepEqual(settings.zones[1], { _key: 'eu', name: 'EU', countries: [{ _key: 'c1', country: 'DE' }] });
  assert.deepEqual(settings.methods[2], { _key: 'eu-post', zone: 'eu', name: 'Post EU', price: { minor: 1900 } });

  // The door reads it: the three products in the owner's order, the settings as rows, the currency.
  const site = await testShop();
  assert.deepEqual(site.entries('products').map((one) => one.slug), ['kerzenstaender', 't-shirt-fox', 'tasche-nach-mass']);
  assert.equal(site.settings('shop').rows('methods').length, 3);
});

// ── the package ───────────────────────────────────────────────────────────

test('the storefront is in the package under its own entries, and in the barrel', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const [entry, file, types] of [
    ['./shop', './lib/shop/product.mjs', './types/shop.d.ts'],
    ['./shop/words', './lib/shop/words.mjs', './types/shop-words.d.ts'],
    ['./shop/hooks', './lib/shop/hooks.mjs', './types/shop-hooks.d.ts'],
    ['./shop/cart', './lib/shop/cart.mjs', './types/shop-cart.d.ts'],
  ]) {
    assert.deepEqual(manifest.exports[entry], { types, default: file }, entry);
    assert.ok(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').length > 0);
    assert.ok(readFileSync(new URL(`../${types}`, import.meta.url), 'utf8').length > 0);
  }
  // `lib` and `types` are packed whole, so none of it can be left out of a release.
  assert.ok(manifest.files.includes('lib') && manifest.files.includes('types'));
  for (const name of ['SHOP_LOCALES', 'shopWordsFor', 'PRODUCT', 'CART', 'CHECKOUT', 'ORDER', 'LISTING', 'MAX_LINES', 'MAX_QTY', 'cartKey', 'readCart', 'addLine', 'removeLine', 'setQty', 'shippingBody', 'productFacts', 'variantFor', 'valueStates', 'answersOf', 'fromPrice']) {
    assert.ok(name in barrel, `index.mjs exports ${name}`);
  }
});

// ── the elements ──────────────────────────────────────────────────────────

test("the product's element and its wire load without a DOM, and speak shop/1", async () => {
  const wire = await import('../elements/shop-wire.js');
  const product = await import('../elements/shop-product.js');
  assert.equal(wire.SHOP_PROTOCOL, 1);
  assert.equal(product.SHOP_PROTOCOL, 1, 'the element names the wire\'s version');
  assert.equal(product.ask, wire.ask);
  for (const name of ['wireProduct', 'wireAll', 'defineProduct']) assert.equal(typeof product[name], 'function', name);
  assert.equal(typeof product.JtkProduct, 'function');
  // With no custom elements to define it in, defining is nothing.
  product.defineProduct();

  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const [entry, file] of [['./elements/shop-wire', './elements/shop-wire.js'], ['./elements/shop-product', './elements/shop-product.js']]) {
    assert.deepEqual(manifest.exports[entry], { types: './types/elements-shop.d.ts', default: file }, entry);
  }
  assert.ok(manifest.files.includes('elements'));
  const types = readFileSync(new URL('../types/elements-shop.d.ts', import.meta.url), 'utf8');
  for (const name of ['SHOP_PROTOCOL', 'ask', 'wireProduct', 'defineProduct', 'JtkProduct', "'jtk:cart'"]) assert.ok(types.includes(name), `elements-shop.d.ts declares ${name}`);
});

test('ask names the protocol on every request, is never cached, sends JSON, and is null where nothing answered', async () => {
  const { createServer } = await import('node:http');
  const { ask } = await import('../elements/shop-wire.js');
  const heard = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      heard.push({ method: req.method, url: req.url, shop: req.headers['x-jtk-shop'], type: req.headers['content-type'], cache: req.headers['cache-control'], body });
      if (req.url.startsWith('/api/stock')) return res.end(JSON.stringify({ products: [] }));
      if (req.url === '/api/shipping') {
        res.statusCode = 400;
        return res.end('lines is not a list');
      }
      res.statusCode = 204;
      res.end();
    });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  try {
    assert.deepEqual(await ask(base, 'stock?product=p1'), { status: 200, body: { products: [] } });
    assert.deepEqual(await ask(base, '/shipping', { body: { lines: 'no' } }), { status: 400, body: 'lines is not a list' }, 'a sentence is the sentence; a leading slash is the same address');
    assert.deepEqual(await ask(base.slice(0, -1), 'order', { method: 'GET' }), { status: 204, body: null }, 'a base without its slash is the same base');
    assert.deepEqual(heard.map((one) => [one.method, one.url, one.shop]), [['GET', '/api/stock?product=p1', '1'], ['POST', '/api/shipping', '1'], ['GET', '/api/order', '1']]);
    assert.equal(heard[0].type, undefined, 'a GET says no body');
    assert.equal(heard[1].type, 'application/json');
    assert.deepEqual(JSON.parse(heard[1].body), { lines: 'no' });
    assert.ok(heard.every((one) => /no-cache/.test(one.cache ?? '')), 'never from a cache');
  } finally {
    await new Promise((done) => server.close(done));
  }
  assert.equal(await ask(base, 'stock?product=p1'), null, 'nothing answering is null, never a throw');
});
