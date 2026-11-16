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
import { MAX_LINES, MAX_QTY, cartKey, readCart, addLine, removeLine, setQty, shippingBody, cartView } from '../lib/shop/cart.mjs';
import { productFacts, variantFor, valueStates, answersOf, fromPrice } from '../lib/shop/product.mjs';
import { ATTEMPT, CHECKOUT_WORDS, HOLD, afterAnswer, checkoutBody, freshPress, keptPress, missingDetails, pressFor, pressKey, sentOf } from '../lib/shop/checkout.mjs';
import { ASKS_MOST, ASK_DEADLINE_MS, ASK_EVERY_MS, ORDER_WORDS, frozenOrder, orderAddress, orderView, paidFromKey, sentFromHere } from '../lib/shop/order.mjs';
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
  assert.equal(en.itemNumber, 'Item {n}');
  assert.equal(en.tryAgain, 'Try again');
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
      ['[data-abroad]', '[data-vat]', '[data-cannot-send]', '[data-cart-retry]'],
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

// ── what a cart shows ─────────────────────────────────────────────────────

const FOX = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02';
/** A priced line as `POST /api/shipping` answers it, by the cart's place for it. */
const priced = (at, extra = {}) => ({ line: at, product: 'mug', variant: 'v1', sku: 'MUG-1', title: 'Mug', labels: ['Blue'], answers: [], unit: 1500, qty: 2, total: 3000, ...extra });
/** The shipping answer for a cart, as the shop gives it, with what the test says over it. */
const quoted = (extra = {}) => ({
  currency: 'chf', lines: [], refused: [], subtotal: 0, country: 'CH', sends: true, cannot_send: false, abroad: false, vat_included: false, own_currency: false,
  methods: [{ method: 'post', name: 'Post', pickup: false, price: 790, free: false }, { method: 'pickup', name: 'Pick-up', pickup: true, price: 0, free: false }],
  ...extra,
});

test('a line the shop refuses is said with its reason, and the rest is priced as the shop prices it now', () => {
  // The fox's v1 once, and a mug twice — the fox taken off sale since it was put in the cart.
  let cart = addLine(addLine(readCart(null), line({ qty: 1 })), { product: 'mug', variant: 'v1', qty: 2, answers: {} });
  cart = { ...cart, country: 'CH', method: 'post' };
  const answer = quoted({ lines: [priced(1)], refused: [{ line: 0, code: 'off_sale', says: 'the variant v1 (FOX-S-RED) of t-shirt-fox is not on sale' }], subtotal: 3000 });
  const view = cartView(cart, answer, 'en');

  assert.equal(view.rows.length, 2, 'a row for each line of the cart, in its order');
  assert.deepEqual(view.rows.map((row) => row.at), [0, 1]);
  assert.deepEqual(view.rows[0].line, { product: FOX, variant: 'v1', qty: 1, answers: {} }, 'a row keeps the cart\'s line, to change or take out');
  assert.equal(view.rows[0].refused.word, shopWordsFor('en')['refused.off_sale']);
  assert.equal(view.rows[0].refused.code, 'off_sale');
  assert.equal(view.rows[0].quoted, undefined, 'a refused line is not priced');
  assert.equal(view.rows[1].refused, undefined);
  assert.equal(view.rows[1].quoted.total, 3000);
  assert.deepEqual(view.rows[1].quoted, { title: 'Mug', labels: ['Blue'], answers: [], unit: 1500, total: 3000 });
  assert.equal(view.subtotal, 3000, 'the subtotal is the shop\'s, of what it priced');
  assert.equal(view.currency, 'chf');
  assert.equal(view.ready, false, 'a cart with a line refused goes no further');
  // The page's language chooses the word; one the kit has no words in reads English.
  assert.equal(cartView(cart, answer, 'de-CH').rows[0].refused.word, shopWordsFor('de')['refused.off_sale']);
  assert.equal(cartView(cart, answer, 'pl').rows[0].refused.word, shopWordsFor('en')['refused.off_sale']);

  // The buyer takes the line out: the cart sends the shop one line, and priced as the shop prices that, it is ready.
  const rest = removeLine(cart, view.rows[0].at);
  const body = shippingBody(rest, 'en');
  assert.deepEqual(body.lines.map((one) => one.product), ['mug'], 'the shop is asked about one line');
  const again = cartView(rest, quoted({ lines: [priced(0)], subtotal: 3000 }), 'en');
  assert.equal(again.ready, true);
  assert.equal(again.rows[0].quoted.total, 3000);
  assert.equal(cart.lines.length, 2, 'the cart given is as it was');
});

test("the method chosen is the cart's while it is offered", () => {
  const cart = (method, extra = {}) => ({ ...addLine(readCart(null), { product: 'mug', variant: 'v1', qty: 2, answers: {} }), country: 'CH', method, ...extra });
  const answer = quoted({ lines: [priced(0)], subtotal: 3000 });
  const view = (method, over = {}) => cartView(cart(method), { ...answer, ...over }, 'en');

  assert.equal(view('pickup').method, 'pickup', 'the cart\'s, where it is offered');
  assert.equal(view('post').method, 'post');
  assert.equal(view('express').method, 'post', 'one not offered falls back to the first');
  assert.equal(view('').method, 'post', 'none chosen is the first');
  assert.deepEqual(view('post').methods, [
    { method: 'post', name: 'Post', pickup: false, price: 790, free: false },
    { method: 'pickup', name: 'Pick-up', pickup: true, price: 0, free: false },
  ], 'the methods as the shop offers them, in its order');
  assert.equal(view('', { methods: [] }).method, '', 'no method offered, none chosen');

  // A parcel that crosses the border is abroad — a pick-up crosses none.
  assert.equal(view('post', { abroad: true }).abroad, true);
  assert.equal(view('pickup', { abroad: true }).abroad, false, 'abroad is false where the chosen method is a pick-up');
  assert.equal(view('express', { abroad: true }).abroad, true, 'a method not offered is the first, which is a parcel');
  assert.equal(view('post', { abroad: false }).abroad, false, 'and a parcel that stays home is not');
});

test('a cart is ready only when every line is priced, nothing is refused and a method is chosen', () => {
  const cart = { ...addLine(addLine(readCart(null), { product: 'mug', variant: 'v1', qty: 2, answers: {} }), { product: 'cup', variant: 'v1', qty: 1, answers: {} }), country: 'CH', method: 'post' };
  const both = quoted({ lines: [priced(0), priced(1, { product: 'cup', title: 'Cup', unit: 900, qty: 1, total: 900 })], subtotal: 3900 });
  assert.equal(cartView(cart, both, 'en').ready, true);

  assert.equal(cartView(cart, { ...both, methods: [] }, 'en').ready, false, 'no method to choose');
  assert.equal(cartView(cart, { ...both, lines: [both.lines[0]], subtotal: 3000 }, 'en').ready, false, 'a line the answer says nothing of is not priced');
  assert.equal(cartView(cart, { ...both, refused: [{ line: 1, code: 'quantity', says: '' }], lines: [both.lines[0]] }, 'en').ready, false);
  assert.equal(cartView(readCart(null), quoted(), 'en').ready, false, 'an empty cart');
  assert.deepEqual(cartView(readCart(null), quoted(), 'en').rows, []);

  // The whole cart refused — line -1 — holds it back though every line is priced, and no row bears it.
  const whole = cartView(cart, { ...both, refused: [{ line: -1, code: 'too_large', says: 'the cart has 101 lines' }] }, 'en');
  assert.equal(whole.ready, false);
  assert.equal(whole.rows.every((row) => row.quoted !== undefined && row.refused === undefined), true);
  assert.equal('whole' in whole, false, 'the view has no sentence of its own for it: the page says the order has changed');
  // A code the kit has no word for is still said: the order has changed.
  const odd = cartView(cart, { ...both, lines: [both.lines[0]], refused: [{ line: 1, code: 'from_a_later_version', says: '' }] }, 'en');
  assert.equal(odd.rows[1].refused.word, shopWordsFor('en')['error.refused']);

  // What the shop says of the country and the prices, as it says it.
  const says = cartView(cart, { ...both, vat_included: true, own_currency: true, sends: false, cannot_send: true }, 'en');
  assert.deepEqual([says.vat, says.ownCurrency, says.sends, says.cannotSend], [true, true, false, true]);
  const none = cartView(cart, both, 'en');
  assert.deepEqual([none.vat, none.ownCurrency, none.sends, none.cannotSend], [false, false, true, false]);
  // An answer that is no answer reads as the shop having priced nothing.
  const nothing = cartView(cart, null, 'en');
  assert.equal(nothing.ready, false);
  assert.equal(nothing.rows.length, 2);
  assert.equal(nothing.rows.every((row) => row.quoted === undefined && row.refused === undefined), true);
});

// ── the checkout ──────────────────────────────────────────────────────────

/** A random UUID, as `crypto.randomUUID()` makes one: what an attempt is, and of a shape the shop takes (Ruling 92). */
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The fox twice, to Switzerland by the economy post: 5980 and 900, as the test shop prices it. */
const FOX_TWICE = { v: 1, lines: [{ product: FOX, variant: 'v1', qty: 2, answers: {} }], country: 'CH', method: 'economy' };
/** What the checkout step's form gives a press: a delivery, as typed. */
const FORM = {
  buyer: { name: 'Ada Lovelace', email: 'ada@example.ch', phone: '+41 79 000 00 00' },
  address: { line1: 'Bahnhofstrasse 1', line2: '', postal_code: '8001', city: 'Zürich' },
  total: 5980 + 900,
  locale: 'de-CH',
  return: '/order',
  turnstile: '0.walk-token',
};

test("one attempt for a press and its retries, and a new one after Stripe's page was given", () => {
  assert.equal(pressKey('/api/'), 'jtk:checkout:/api/');
  assert.equal(pressKey('/p/fox/api/'), 'jtk:checkout:/p/fox/api/', 'a preview keeps a press of its own, as it keeps a cart');

  // A press: an attempt of its own, a crypto.randomUUID() — one the shop takes — and no order yet.
  const p = freshPress();
  assert.match(p.attempt, UUID4);
  assert.match(p.attempt, ATTEMPT);
  assert.equal(p.order, '');
  assert.notEqual(freshPress().attempt, p.attempt, 'each new press its own');
  // The press kept in the tab is the press the next Pay goes on with; anything else is a new one.
  assert.deepEqual(pressFor(JSON.parse(JSON.stringify(p))), p, 'kept, and read back as it was');
  assert.deepEqual(pressFor({ attempt: p.attempt, order: 'T9' }), { attempt: p.attempt, order: 'T9' });
  for (const stored of [null, undefined, 'a string', [], { order: 'T9' }, { attempt: 'short' }, { attempt: 'x'.repeat(129) }, { attempt: 'not one, with spaces' }]) {
    const fresh = pressFor(/** @type {any} */ (stored));
    assert.match(fresh.attempt, UUID4, JSON.stringify(stored));
    assert.equal(fresh.order, '', JSON.stringify(stored));
  }
  assert.deepEqual(pressFor(/** @type {any} */ ({ attempt: p.attempt, order: 7 })), { attempt: p.attempt, order: '' }, 'an order that is no token is none');
  // A page served over plain http has no randomUUID: an attempt of the same shape all the same.
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const plain = freshPress();
    assert.match(plain.attempt, UUID4);
    assert.notEqual(plain.attempt, freshPress().attempt);
  } finally {
    delete (/** @type {any} */ (globalThis.crypto)).randomUUID;
  }
  assert.equal(typeof globalThis.crypto.randomUUID, 'function');

  // 201: Stripe's page; the press is over and forgotten, and the next press is a new one.
  const stripe = 'https://checkout.stripe.com/c/pay/cs_test_a1';
  assert.deepEqual(afterAnswer(p, { status: 201, body: { order: 'T9', url: stripe, expires_at: '2026-11-16T12:31:00Z' } }), { kind: 'go', url: stripe, order: 'T9' });
  // The order the buyer is sent to pay for is the press's: the one the shop named, else the one the press held — and none where it is none.
  assert.equal(/** @type {any} */ (afterAnswer({ attempt: p.attempt, order: 'T7' }, { status: 201, body: { url: stripe } })).order, 'T7');
  assert.equal(/** @type {any} */ (afterAnswer(p, { status: 201, body: { url: stripe } })).order, '');
  const next = pressFor(null);
  assert.notEqual(next.attempt, p.attempt, 'the press after Stripe\'s page was given mints a new attempt');
  assert.match(next.attempt, UUID4);
  assert.equal(next.order, '');
  // A 201 that names no page to go to is an order made: asked for again by its token, never pressed anew.
  assert.deepEqual(afterAnswer(p, { status: 201, body: { order: 'T9', url: 'javascript:alert(1)' } }), { kind: 'ask_again', press: { attempt: p.attempt, order: 'T9' } });
  assert.deepEqual(afterAnswer(p, { status: 201, body: { order: 'T9' } }), { kind: 'ask_again', press: { attempt: p.attempt, order: 'T9' } });

  // 502 with the order: the same press, asked again with the order's token alone — no cart, nothing held, no challenge.
  const again = afterAnswer(p, { status: 502, body: { error: 'try_again', order: 'T9' } });
  assert.equal(again.kind, 'ask_again');
  assert.deepEqual(/** @type {any} */ (again).press, { attempt: p.attempt, order: 'T9' });
  assert.deepEqual(checkoutBody(/** @type {any} */ (again).press, FOX_TWICE, FORM), { order: 'T9' });
  // …and that ask lost too: still the order, still the press.
  assert.deepEqual(afterAnswer(/** @type {any} */ (again).press, null), { kind: 'ask_again', press: { attempt: p.attempt, order: 'T9' } });
  assert.deepEqual(afterAnswer(/** @type {any} */ (again).press, { status: 502, body: { error: 'try_again' } }), { kind: 'ask_again', press: { attempt: p.attempt, order: 'T9' } });
  // No answer, or a 502 with no order (the shop itself not reached): the same attempt, and the cart again.
  for (const answer of [null, { status: 502, body: { error: 'try_again' } }, { status: 502, body: '<html>Bad gateway</html>' }, { status: 504, body: 'Gateway Timeout' }, { status: 503, body: null }]) {
    const lost = afterAnswer(p, answer);
    assert.deepEqual(lost, { kind: 'ask_again', press: { attempt: p.attempt, order: '' } }, JSON.stringify(answer));
    const retry = checkoutBody(/** @type {any} */ (lost).press, FOX_TWICE, { ...FORM, turnstile: '0.a-fresh-one' });
    assert.equal(retry.attempt, p.attempt, 'a retry is never a new attempt');
    assert.equal(retry.turnstile, '0.a-fresh-one');
    assert.deepEqual(retry.lines, FOX_TWICE.lines);
  }

  // A price that changed, a line refused, a method no longer offered, a last item gone: the same press, the new answer shown.
  const quote = { currency: 'chf', lines: [], refused: [], subtotal: 6200, methods: [] };
  for (const code of ['total', 'refused', 'method', 'short']) {
    assert.deepEqual(afterAnswer(p, { status: 409, body: { error: code, quote, ...(code === 'short' ? { short: [{ sku: 'FOX-S-RED', wanted: 2, available: 1 }] } : {}) } }), { kind: 'requote', press: p, quote, word: `error.${code}` }, code);
  }
  assert.deepEqual(afterAnswer(p, { status: 409, body: { error: 'total' } }), { kind: 'say', word: 'error.total', press: p }, 'without its quote: said, and the press kept');
  // Already paid: to its page, the press over.
  assert.deepEqual(afterAnswer({ attempt: p.attempt, order: 'T9' }, { status: 409, body: { error: 'paid', order: 'T9' } }), { kind: 'paid', order: 'T9' });
  assert.deepEqual(afterAnswer({ attempt: p.attempt, order: 'T9' }, { status: 409, body: { error: 'paid' } }), { kind: 'paid', order: 'T9' }, 'the order the press holds');
  assert.deepEqual(afterAnswer(p, { status: 409, body: { error: 'paid' } }), { kind: 'say', word: 'error.paid', press: null }, 'an order paid that nobody names');

  // Kept: nothing was written that another press of it would find another way.
  assert.deepEqual(afterAnswer(p, { status: 403, body: { error: 'challenge' } }), { kind: 'say', word: 'error.challenge', press: p });
  assert.deepEqual(afterAnswer(p, { status: 400, body: { error: 'buyer', fields: ['buyer.email', 7, 'address.line2'] } }), { kind: 'say', word: 'error.buyer', press: p, fields: ['buyer.email', 'address.line2'] });
  assert.deepEqual(afterAnswer(p, { status: 429, body: { error: 'too_many' } }), { kind: 'say', word: 'error.too_many', press: p });
  assert.deepEqual(afterAnswer(p, { status: 429, body: { error: 'open_checkouts' } }), { kind: 'say', word: 'error.open_checkouts', press: p });

  // Gone: the order given up, lapsed, nobody's, or never to be — said, and the next press mints a new attempt.
  for (const [status, body, word] of [
    [409, { error: 'attempt' }, 'error.attempt'],
    [410, { error: 'lapsed' }, 'error.lapsed'],
    [410, { error: 'lapsed', order: 'T9' }, 'error.lapsed'],
    [410, { error: 'too_late', order: 'T9' }, 'error.too_late'],
    [410, { error: 'too_small', order: 'T9' }, 'error.too_small'],
    [422, { error: 'address', order: 'T9' }, 'address'],
    [424, { error: 'no_payee', order: 'T9' }, 'error.no_payee'],
    [404, { error: 'not_found', order: 'T9' }, 'error.lapsed'],
    [400, { error: 'return' }, 'error.return'],
    [400, { error: 'nothing_to_pay' }, 'error.nothing_to_pay'],
    [500, { error: 'internal', order: 'T9' }, 'error.internal'],
    [403, { error: 'showcase', message: 'a sample: it never checks out' }, 'error.showcase'],
    [409, "this site's schema does not turn the shop on", 'error.internal'],
    [400, "an attempt is a press's own token: 16 to 128 letters, digits, '-' or '_', or none", 'error.internal'],
  ]) {
    assert.deepEqual(afterAnswer(p, { status: /** @type {number} */ (status), body }), { kind: 'say', word, press: null }, `${status} ${JSON.stringify(body)}`);
  }
  // A refusal in JSON the table does not name keeps the press: the next press can never be a second order of this one.
  assert.deepEqual(afterAnswer(p, { status: 400, body: { error: 'JTK_E_SHOP_FIELD_UNKNOWN', fields: ['colour'], takes: [] } }), { kind: 'say', word: 'error.internal', press: p });
  // The network's answers, not the shop's: every 5xx but billing's own 500 internal, and a timeout, are answers that were lost —
  // the order may have been made, so the press is kept, its order with it where one is named (Ruling 225, M2).
  for (const [status, body] of [
    [500, 'internal error'], [500, '<html>Worker threw</html>'], [500, { error: 'something_else' }], [500, null],
    [501, null], [505, 'HTTP Version Not Supported'], [520, '<html>Web server is returning an unknown error</html>'], [522, ''], [524, 'A timeout occurred'], [599, null],
    [408, 'Request Timeout'], [408, null],
  ]) {
    assert.deepEqual(afterAnswer(p, { status, body }), { kind: 'ask_again', press: p }, `${status} ${JSON.stringify(body)}`);
  }
  assert.deepEqual(afterAnswer(p, { status: 524, body: { error: 'try_again', order: 'T9' } }), { kind: 'ask_again', press: { ...p, order: 'T9' } });
  // Too many, said by a rate limiter in front of the shop, with no word or a sentence: too many, the press kept — nothing was written.
  for (const body of [null, '', 'Too Many Requests', '<html>rate limited</html>', { error: 'something_else' }]) {
    assert.deepEqual(afterAnswer(p, { status: 429, body }), { kind: 'say', word: 'error.too_many', press: p }, JSON.stringify(body));
  }
  // A press kept goes on with what it was sent with, and when: a retry is matched against it (Ruling 223), its age against the hold.
  const sentOne = 'b1:0123456789abcdef0123456789ab';
  const kept = { ...p, sent: sentOne, at: 1_000 };
  assert.deepEqual(afterAnswer(kept, null), { kind: 'ask_again', press: kept });
  assert.deepEqual(afterAnswer(kept, { status: 502, body: { error: 'try_again', order: 'T9' } }), { kind: 'ask_again', press: { ...kept, order: 'T9' } });
  assert.deepEqual(afterAnswer(kept, { status: 409, body: { error: 'total', quote } }), { kind: 'requote', press: kept, quote, word: 'error.total' });
  assert.deepEqual(afterAnswer(kept, { status: 403, body: { error: 'challenge' } }), { kind: 'say', word: 'error.challenge', press: kept });

  // Every word the checkout says is in every language the storefront speaks.
  for (const locale of SHOP_LOCALES) {
    const words = shopWordsFor(locale);
    for (const word of CHECKOUT_WORDS) assert.ok(typeof words[word] === 'string' && words[word] !== '', `${locale}: ${word}`);
  }
  assert.equal(new Set(CHECKOUT_WORDS).size, CHECKOUT_WORDS.length);
});

test('a press is for one body: only the same body is a retry, and no press outlives the hold of its order (Rulings 223, 225)', () => {
  const t0 = Date.parse('2026-11-16T12:00:00Z');
  const cart = readCart(JSON.stringify({ ...FOX_TWICE, lines: [FOX_TWICE.lines[0], { product: FOX, variant: 'v2', qty: 1, answers: {} }] }));
  const sent = sentOf(cart, FORM);
  // What a press is for: the body less the challenge's token, the return and the page's language — kept as a digest of it, which
  // tells one body from another and holds nothing of the buyer's that could be read back from the tab (Ruling 226).
  assert.match(sent, /^b1:[0-9a-f]{28}$/);
  for (const detail of ['Ada', 'Lovelace', 'ada@example.ch', '+41', 'Bahnhofstrasse', '8001', 'Zürich', FOX, '6880']) assert.ok(!sent.includes(detail), `the digest holds ${detail}`);
  assert.equal(sentOf(cart, FORM), sent, 'the same body, the same digest');
  assert.equal(sentOf(cart, { ...FORM, turnstile: '0.another', return: '/en/order', locale: 'en' }), sent, 'a fresh token, another language or return is the same body');
  assert.notEqual(sentOf(cart, { ...FORM, address: null }), sent, 'a pick-up, sent with no address, is another');
  // However its keys were written: a line's answers in another order, the buyer's details in another, are the same body.
  const answered = (answers) => readCart(JSON.stringify({ ...cart, lines: [{ ...cart.lines[0], answers }, cart.lines[1]] }));
  assert.equal(sentOf(answered({ tag: 'Ada', colour: 'rot' }), FORM), sentOf(answered({ colour: 'rot', tag: 'Ada' }), FORM));
  assert.equal(sentOf(cart, { ...FORM, buyer: { phone: FORM.buyer.phone, email: FORM.buyer.email, name: FORM.buyer.name } }), sent);

  // The first press: a new attempt, kept with what it was sent with and when.
  const first = pressFor(null, sent, t0);
  assert.match(first.attempt, UUID4);
  const kept = keptPress(first, sent, t0);
  assert.deepEqual(kept, { attempt: first.attempt, order: '', sent, at: t0 });
  const stored = JSON.parse(JSON.stringify(kept));

  // Pay pressed again on the same body — after an answer that was lost — is the same press: a retry.
  assert.deepEqual(pressFor(stored, sentOf(cart, { ...FORM, turnstile: '0.fresh' }), t0 + 60_000), kept);
  // Anything the buyer changed is a new body, and a new press with a new attempt.
  const changed = {
    'a line taken out': sentOf(removeLine(cart, 1), { ...FORM, total: 2990 + 900 }),
    'a quantity': sentOf(setQty(cart, 0, 3), FORM),
    'another country': sentOf({ ...cart, country: 'LI' }, FORM),
    'another method': sentOf({ ...cart, method: 'pickup' }, { ...FORM, address: null }),
    'an email corrected': sentOf(cart, { ...FORM, buyer: { ...FORM.buyer, email: 'ada@example.org' } }),
    'a phone added': sentOf(cart, { ...FORM, buyer: { name: 'Ada Lovelace', email: 'ada@example.ch', phone: '+41 79 111 11 11' } }),
    'the address': sentOf(cart, { ...FORM, address: { ...FORM.address, city: 'Bern' } }),
    'a new total the shop said': sentOf(cart, { ...FORM, total: FORM.total + 100 }),
  };
  for (const [what, other] of Object.entries(changed)) {
    const next = pressFor(stored, other, t0 + 60_000);
    assert.notEqual(next.attempt, first.attempt, what);
    assert.deepEqual([next.order, next.sent, next.at], ['', undefined, undefined], what);
  }

  // A press that holds an order: its token is asked for again only for the same body, the total the step shows among it (Ruling 225).
  const holding = JSON.parse(JSON.stringify({ ...kept, order: 'T9' }));
  const again = pressFor(holding, sent, t0 + 120_000);
  assert.equal(again.order, 'T9');
  assert.deepEqual(checkoutBody(again, cart, FORM), { order: 'T9' });
  const moved = pressFor(holding, sentOf(cart, { ...FORM, total: FORM.total + 100 }), t0 + 120_000);
  assert.notEqual(moved.attempt, first.attempt, 'the step shows another total: a new press');
  const sentAnew = /** @type {any} */ (checkoutBody(moved, cart, { ...FORM, total: FORM.total + 100 }));
  assert.equal(sentAnew.order, undefined, 'not the order\'s token');
  assert.deepEqual([sentAnew.attempt, sentAnew.total, sentAnew.lines.length], [moved.attempt, FORM.total + 100, 2], 'the cart, with the total shown');
  // A retry keeps the time of the first send, as the order's hold does.
  assert.equal(keptPress(again, sent, t0 + 120_000).at, t0);

  // The hold: 31 minutes. Past it, whatever order the press made has been given up, and the next press starts afresh.
  assert.equal(HOLD, 31 * 60 * 1000);
  assert.deepEqual(pressFor(holding, sent, t0 + HOLD), { ...kept, order: 'T9' }, 'at the hold, still the press');
  const late = pressFor(holding, sent, t0 + HOLD + 1);
  assert.notEqual(late.attempt, first.attempt);
  assert.equal(late.order, '');
  assert.notEqual(pressFor(holding, undefined, t0 + HOLD + 1).attempt, first.attempt, 'with no body to match, the age still holds');
  // A kept press with no time is matched by its body alone; with no body kept, it is no retry of any.
  assert.equal(pressFor({ attempt: first.attempt, order: '', sent }, sent, t0 + 10 * HOLD).attempt, first.attempt);
  assert.notEqual(pressFor({ attempt: first.attempt, order: 'T9' }, sent, t0).attempt, first.attempt);
});

test("the checkout sends the protocol's body", () => {
  const p = freshPress();
  const cart = readCart(JSON.stringify({ ...FOX_TWICE, lines: [{ ...FOX_TWICE.lines[0], answers: { tag: 'Ada' } }] }));
  const body = /** @type {any} */ (checkoutBody(p, cart, FORM));
  // A delivery: the cart, its country and method, the buyer and the address as typed, the total shown, the press, the return,
  // the page's language and the challenge's token — in the protocol's order.
  assert.deepEqual(Object.keys(body), ['lines', 'country', 'method', 'buyer', 'address', 'total', 'attempt', 'return', 'locale', 'turnstile']);
  assert.deepEqual(body, {
    lines: [{ product: FOX, variant: 'v1', qty: 2, answers: { tag: 'Ada' } }],
    country: 'CH',
    method: 'economy',
    buyer: { name: 'Ada Lovelace', email: 'ada@example.ch', phone: '+41 79 000 00 00' },
    address: { line1: 'Bahnhofstrasse 1', postal_code: '8001', city: 'Zürich' },
    total: 6880,
    attempt: p.attempt,
    return: '/order',
    locale: 'de-CH',
    turnstile: '0.walk-token',
  });
  assert.equal(body.total, 5980 + 900, 'the subtotal and the method\'s price');
  assert.notEqual(body.lines, cart.lines, 'the cart\'s own lines are never handed over to be changed');
  assert.notEqual(body.lines[0].answers, cart.lines[0].answers);
  // As typed: a name in another script, spaces where the buyer put them; an address's second line where there is one.
  const typed = /** @type {any} */ (checkoutBody(p, cart, { ...FORM, buyer: { name: ' Ада Лавлейс ', email: 'ada@example.ch', phone: '' }, address: { ...FORM.address, line2: 'c/o Babbage' } }));
  assert.deepEqual(typed.buyer, { name: ' Ада Лавлейс ', email: 'ada@example.ch' }, 'no phone where none was given');
  assert.equal(typed.address.line2, 'c/o Babbage');

  // A pick-up: no address.
  const pickup = /** @type {any} */ (checkoutBody(p, { ...cart, method: 'pickup' }, { ...FORM, address: null, total: 5980 }));
  assert.equal('address' in pickup, false);
  assert.deepEqual([pickup.method, pickup.total], ['pickup', 5980]);

  // No key outside the protocol's: the checkout's table in shop-protocol.md (jtakeit-core at 0e150d8a, `POST
  // /api/checkout`; its shapes in backend/api/shopwire/testdata/protocol/v1/checkout.request.json) and `locale`,
  // which shop/1 grew within version 1 (Task 9.6). A second ask is `{ order }` alone.
  const PROTOCOL = new Set([
    'lines', 'lines[]', 'lines[].product', 'lines[].variant', 'lines[].qty', 'lines[].answers',
    'country', 'method', 'buyer', 'buyer.name', 'buyer.email', 'buyer.phone',
    'address', 'address.line1', 'address.line2', 'address.postal_code', 'address.city',
    'total', 'attempt', 'return', 'locale', 'turnstile', 'order',
  ]);
  /** The paths of a body, down to a line's answers, which are the product's own keys. */
  const paths = (value, at = '') => Object.entries(value).flatMap(([key, one]) => {
    const here = at === '' ? key : `${at}.${key}`;
    if (Array.isArray(one)) return [here, `${here}[]`, ...one.flatMap((each) => paths(each, `${here}[]`))];
    if (one !== null && typeof one === 'object' && here !== 'lines[].answers') return [here, ...paths(one, here)];
    return [here];
  });
  for (const sent of [body, typed, pickup, checkoutBody({ attempt: p.attempt, order: 'T9' }, cart, FORM)]) {
    for (const path of paths(sent)) assert.ok(PROTOCOL.has(path), `${path} is not in the protocol`);
  }
  assert.deepEqual(checkoutBody({ attempt: p.attempt, order: 'T9' }, cart, FORM), { order: 'T9' });

  // What a press cannot go without, before it is sent: only what is plainly missing, by the protocol's paths — the rest the shop checks.
  assert.deepEqual(missingDetails({ name: '', email: '' }, { line1: '', postal_code: '', city: '' }), ['buyer.name', 'buyer.email', 'address.line1', 'address.postal_code', 'address.city']);
  assert.deepEqual(missingDetails({ name: '  ', email: 'ada' }, null), ['buyer.name', 'buyer.email'], 'a pick-up asks no address');
  assert.deepEqual(missingDetails(FORM.buyer, FORM.address), []);
  assert.deepEqual(missingDetails({ name: 'Ada', email: 'ada@example' }, null), [], 'an email the shop refuses for its domain is the shop\'s to say');
});

// ── the page after payment ────────────────────────────────────────────────

const STRIPE_PAGE = 'https://checkout.stripe.com/c/pay/cs_test_x';
/** The lines of an order as the page after payment is told them: frozen at the checkout, in the language it was made in. */
const FROZEN = [
  { line: 0, product: 'p1', variant: 'v1', sku: 'FOX-S-RED', title: 'Fox T-shirt', labels: ['S', 'Red'], answers: [], unit: 2990, qty: 2, total: 5980 },
  {
    line: 1, product: 'p2', variant: 'v1', sku: 'BAG-1', title: 'Bag', labels: [],
    answers: [{ key: 'body', name: 'Body', choice: 'red', label: 'Red', adds: 0 }, { key: 'zipper', name: 'Zipper', ticked: true, adds: 500 }, { key: 'tag', name: 'Tag', text: 'Ada', adds: 0 }],
    unit: 8900, qty: 1, total: 8900,
  },
];
const ORDER_PAID = { state: 'paid', number: 1001, lines: FROZEN, subtotal: 14880, shipping: 790, total: 15670, currency: 'chf', method: 'Post, 2–3 days', pickup: false };

test("a buyer back from Stripe's page is offered it again, and keeps the cart", () => {
  const waiting = { status: 200, body: { ...ORDER_PAID, state: 'waiting', number: undefined, pay_url: STRIPE_PAGE } };
  // Back from Stripe's page without paying: said so, with the page to go back to paying — and the cart is not emptied.
  const left = orderView(waiting, { left: true }, 1);
  assert.equal(left.state, 'waiting');
  assert.equal(left.word, 'state.left');
  assert.equal(left.payUrl, STRIPE_PAGE);
  assert.equal(left.emptiesCart, false, 'an order not paid leaves the cart as it is');
  assert.equal(left.askAgain, true, 'and the page goes on asking: the buyer may have paid in another tab');
  assert.equal(left.number, undefined);
  // The same order without `left`: a buyer who has just paid, waiting for Stripe to say.
  const just = orderView(waiting, { left: false }, 1);
  assert.equal(just.state, 'waiting');
  assert.equal(just.word, 'state.waiting');
  assert.equal(just.payUrl, STRIPE_PAGE, 'the answer carries the page while the order waits');
  assert.equal(just.emptiesCart, false);
  assert.equal(just.askAgain, true);
  // The answer takes the page away — the hold ended — and the page offers none.
  const gone = orderView({ status: 200, body: { ...waiting.body, pay_url: undefined } }, { left: true }, 2);
  assert.equal(gone.payUrl, undefined);
  assert.equal(gone.word, 'state.left');
  // A page that is not Stripe's, or is no address of the web, is never offered to a buyer.
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example/x', '/relative', '', 7, null, {}]) {
    assert.equal(orderView({ status: 200, body: { ...waiting.body, pay_url: url } }, { left: true }, 1).payUrl, undefined, JSON.stringify(url));
  }
  // Lapsed and cancelled: said, the cart kept to pay again, and nothing more to ask.
  for (const [state, word] of [['lapsed', 'state.lapsed'], ['cancelled', 'state.cancelled']]) {
    for (const was of [true, false]) {
      const view = orderView({ status: 200, body: { ...ORDER_PAID, state, number: state === 'cancelled' ? 1001 : undefined, pay_url: STRIPE_PAGE } }, { left: was }, 3);
      assert.equal(view.state, state);
      assert.equal(view.word, word, 'what the order is, whether or not the buyer came back by leaving');
      assert.equal(view.emptiesCart, false, `${state}: the cart is kept, to pay again`);
      assert.equal(view.askAgain, false);
      assert.equal(view.payUrl, undefined, `${state}: Stripe's page is offered only while the order waits`);
    }
  }
  // A cancelled order, refunded in full, still has its number (shop-protocol.md).
  assert.equal(orderView({ status: 200, body: { ...ORDER_PAID, state: 'cancelled' } }, { left: false }, 1).number, 1001);
});

test('the page after payment needs no cart, and stops asking', () => {
  assert.equal(ASK_EVERY_MS, 3000);
  assert.equal(ASKS_MOST, 40, 'two minutes of asking, then said and stopped');
  // A token that is nobody's says so, and nothing more is asked.
  const unknown = orderView({ status: 404, body: 'not found' }, { left: false }, 1);
  assert.equal(unknown.state, 'unknown');
  assert.equal(unknown.word, 'state.unknown');
  assert.equal(unknown.askAgain, false);
  assert.equal(unknown.emptiesCart, false);
  assert.equal(orderView({ status: 404, body: { error: 'not_found' } }, { left: true }, 40).state, 'unknown');
  // Paid: its number, and the cart emptied — a cart already empty included: nothing here reads the cart.
  const paid = orderView({ status: 200, body: ORDER_PAID }, { left: false, mine: true }, 1);
  assert.equal(paid.state, 'paid');
  assert.equal(paid.word, 'state.paid');
  assert.equal(paid.number, 1001);
  assert.equal(paid.emptiesCart, true, 'the order this tab sent the buyer to pay for: the cart is emptied');
  assert.equal(paid.askAgain, false);
  assert.equal(paid.payUrl, undefined);
  // The page the buyer left, paid in another tab: paid all the same.
  assert.equal(orderView({ status: 200, body: ORDER_PAID }, { left: true, mine: true }, 17).word, 'state.paid');
  assert.deepEqual(Object.keys(orderView({ status: 200, body: ORDER_PAID }, { left: false, mine: true }, 1)).sort(), ['askAgain', 'emptiesCart', 'number', 'state', 'word']);
  // The number is the buyer's reference and does not wait on the lines.
  for (const body of [{ state: 'paid', number: 1002 }, { state: 'paid', number: 1002, lines: null }, { state: 'paid', number: 1002, lines: 'none' }]) {
    const bare = orderView({ status: 200, body }, { left: false, mine: true }, 1);
    assert.deepEqual([bare.state, bare.number, bare.emptiesCart], ['paid', 1002, true], JSON.stringify(body));
  }

  // Asked for two minutes — forty times, every three seconds — and then stopped, said, with Stripe's page while it lasts.
  const waiting = { status: 200, body: { state: 'waiting', lines: FROZEN, pay_url: STRIPE_PAGE } };
  assert.equal(orderView(waiting, { left: false }, ASKS_MOST - 1).askAgain, true, 'the 39th answer is asked after');
  assert.equal(orderView(waiting, { left: false }, ASKS_MOST - 1).word, 'state.waiting');
  const stopped = orderView(waiting, { left: false }, ASKS_MOST);
  assert.equal(stopped.state, 'waiting');
  assert.equal(stopped.word, 'state.stillWaiting');
  assert.equal(stopped.askAgain, false);
  assert.equal(stopped.payUrl, STRIPE_PAGE, 'Stripe\'s page is still offered');
  assert.equal(stopped.emptiesCart, false);
  assert.equal(orderView(waiting, { left: true }, ASKS_MOST + 5).word, 'state.stillWaiting', 'a buyer who left is told it is stopped as well');
  // No answer — the network gone, a gateway, a rate limiter, a sentence — is asked again as if waiting, up to the same two minutes.
  for (const answer of [null, undefined, { status: 502, body: { error: 'try_again' } }, { status: 503, body: 'upstream' }, { status: 429, body: null }, { status: 400, body: { error: 'invalid_body' } }, { status: 200, body: null }, { status: 200, body: 'ok' }, { status: 200, body: { state: 'something-new' } }, { status: 200, body: [] }]) {
    const lost = orderView(/** @type {any} */ (answer), { left: false }, 3);
    assert.deepEqual([lost.state, lost.word, lost.askAgain, lost.emptiesCart, lost.payUrl], ['waiting', 'state.waiting', true, false, undefined], JSON.stringify(answer));
    const late = orderView(/** @type {any} */ (answer), { left: false }, ASKS_MOST);
    assert.deepEqual([late.word, late.askAgain], ['state.stillWaiting', false], `${JSON.stringify(answer)} at the end`);
  }
  assert.equal(orderView(null, { left: true }, 1).word, 'state.left');

  // The order is read from the address alone: its token, and never the cart.
  assert.equal(orderAddress('/api/', '?order=T9&left=1'), '/api/order?token=T9');
  assert.equal(orderAddress('/api/', ''), null);
  assert.equal(orderAddress('/api/', '?left=1'), null);
  assert.equal(orderAddress('/api/', '?order='), null);
  assert.equal(orderAddress('/api/', '?order=%20'), null);
  assert.equal(orderAddress('/api/', undefined), null);
  assert.equal(orderAddress('/p/fox/api/', 'order=T9'), '/p/fox/api/order?token=T9', 'a preview asks its own, and a query with no ? is read');
  assert.equal(orderAddress('/api', '?order=T9'), '/api/order?token=T9', 'a base without its slash is the same base');
  assert.equal(orderAddress('/api/', '?order=a%26b%3Dc%20d'), '/api/order?token=a%26b%3Dc%20d', 'a token is put into the query as one value');
  assert.equal(orderAddress('/api/', '?order=T1&order=T2'), '/api/order?token=T1', 'the first');
});

test('the cart is emptied only for the press that went to Stripe from this tab (Ruling 227)', () => {
  assert.equal(paidFromKey('/api/'), 'jtk:paid-from:/api/');
  assert.equal(paidFromKey('/p/fox/api/'), 'jtk:paid-from:/p/fox/api/', 'a preview keeps a mark of its own, as it keeps a cart and a press');
  // The mark is the order's token: this tab's, and no other.
  assert.equal(sentFromHere('T9', 'T9'), true);
  for (const [mark, token] of [['T8', 'T9'], ['', ''], [null, 'T9'], [undefined, 'T9'], [9, '9'], [{}, 'T9'], ['T9 ', 'T9'], ['t9', 'T9']]) assert.equal(sentFromHere(mark, token), false, JSON.stringify([mark, token]));
  // A paid order opened anywhere else — later, on another device, in another tab — is read as paid, and the cart there is kept.
  for (const query of [{ left: false }, { left: true }, { left: false, mine: false }, { left: true, mine: undefined }]) {
    const view = orderView({ status: 200, body: ORDER_PAID }, query, 1);
    assert.deepEqual([view.state, view.word, view.number, view.emptiesCart, view.askAgain], ['paid', 'state.paid', 1001, false, false], JSON.stringify(query));
  }
  // …and only the one the press went to Stripe with empties it, whether or not the buyer came back by leaving.
  for (const left of [true, false]) assert.equal(orderView({ status: 200, body: ORDER_PAID }, { left, mine: true }, 1).emptiesCart, true);
  // An order that is not paid empties nothing, whoever's it is.
  for (const state of ['waiting', 'lapsed', 'cancelled']) assert.equal(orderView({ status: 200, body: { ...ORDER_PAID, state } }, { left: false, mine: true }, 1).emptiesCart, false, state);
  assert.equal(orderView({ status: 404, body: null }, { left: false, mine: true }, 1).emptiesCart, false);
  assert.equal(orderView(null, { left: false, mine: true }, 1).emptiesCart, false);
});

test('a request that never answers is given up and counts as no answer, so the stop is always reached', async () => {
  assert.equal(ASK_DEADLINE_MS, 10000);
  const { createServer } = await import('node:http');
  const { ask } = await import('../elements/shop-wire.js');
  const held = [];
  const server = createServer((req, res) => {
    held.push(res);
    // Never answered, until the test lets go.
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  try {
    const deadline = new AbortController();
    const asked = ask(base, 'order?token=T9', { signal: deadline.signal });
    // The server has the request and holds it: nothing answers, and nothing will.
    await new Promise((done) => { const wait = () => (held.length > 0 ? done(undefined) : setTimeout(wait, 5)); wait(); });
    deadline.abort();
    assert.equal(await asked, null, 'a request aborted is no answer, as a network gone is');
    // The same through an already aborted signal.
    assert.equal(await ask(base, 'order?token=T9', { signal: AbortSignal.abort() }), null);
  } finally {
    for (const res of held) res.destroy();
    await new Promise((done) => server.close(done));
  }
});

test('the order as it was frozen is read for the page to draw, whatever the answer says', () => {
  const read = frozenOrder(ORDER_PAID, 'Yes');
  assert.deepEqual(read?.lines, [
    { title: 'Fox T-shirt', labels: ['S', 'Red'], answers: [], qty: 2, total: 5980 },
    {
      title: 'Bag', labels: [],
      answers: [{ name: 'Body', value: 'Red', adds: 0 }, { name: 'Zipper', value: 'Yes', adds: 500 }, { name: 'Tag', value: 'Ada', adds: 0 }],
      qty: 1, total: 8900,
    },
  ]);
  assert.deepEqual([read?.subtotal, read?.shipping, read?.total, read?.currency, read?.method, read?.pickup], [14880, 790, 15670, 'chf', 'Post, 2–3 days', false]);
  // Nothing of the buyer's own is read — the shop's answer never carries it, and the page draws only these keys.
  assert.deepEqual(Object.keys(read ?? {}).sort(), ['currency', 'lines', 'method', 'pickup', 'shipping', 'subtotal', 'total']);
  // An answer that is no order, or holds none of its parts, is read as nothing, and a part that is wrong as not there.
  for (const body of [null, undefined, 'a sentence', [], 7, {}]) assert.equal(frozenOrder(/** @type {any} */ (body), 'Yes'), null, JSON.stringify(body));
  const bent = frozenOrder(/** @type {any} */ ({ lines: [null, 'x', { title: 7, labels: 'S', answers: 'no', qty: '2', total: Infinity }, { title: 'Ok', labels: ['A', 3, ''], answers: [{ name: 'N', text: '' }, null, { name: 'M', text: 'x', adds: 'ten' }], qty: 1, total: 100 }], subtotal: '1', shipping: NaN, total: 3, currency: 4, method: null, pickup: 'yes' }), 'Yes');
  assert.deepEqual(bent?.lines, [
    { title: '', labels: [], answers: [], qty: 0, total: undefined },
    { title: 'Ok', labels: ['A'], answers: [{ name: 'M', value: 'x', adds: 0 }], qty: 1, total: 100 },
  ]);
  assert.deepEqual([bent?.subtotal, bent?.shipping, bent?.total, bent?.currency, bent?.method, bent?.pickup], [undefined, undefined, 3, '', '', false]);
  // The words of an answer are the shop's, put in as they are; a yes-or-no is said in the page's word.
  assert.equal(frozenOrder({ lines: [{ title: 'T', labels: [], answers: [{ name: 'Gift', ticked: true, adds: 0 }], qty: 1, total: 1 }] }, 'Ja')?.lines[0].answers[0].value, 'Ja');
});

test('every word the page after payment may say is in every language, the three it adds among them', () => {
  assert.ok(ORDER_WORDS.length > 0 && new Set(ORDER_WORDS).size === ORDER_WORDS.length);
  for (const word of ['state.waiting', 'state.left', 'state.paid', 'state.lapsed', 'state.cancelled', 'state.unknown', 'state.stillWaiting', 'orderNumber', 'loading']) assert.ok(ORDER_WORDS.includes(word), word);
  for (const locale of SHOP_LOCALES) {
    const words = shopWordsFor(locale);
    for (const word of ORDER_WORDS) assert.ok(typeof words[word] === 'string' && words[word].trim() !== '', `${locale}: ${word}`);
    // The page's heading, the sentence for a browser with no script, and the one for a cart that could not be emptied.
    for (const word of ['order', 'orderNoScript', 'orderCartKept']) assert.ok(typeof words[word] === 'string' && words[word].trim() !== '', `${locale}: ${word}`);
  }
  // Every state the view can say is a word the page hands over.
  const body = { ...ORDER_PAID, state: 'waiting' };
  const views = [
    orderView({ status: 404, body: null }, { left: false }, 1), orderView({ status: 200, body: ORDER_PAID }, { left: false }, 1),
    orderView({ status: 200, body: { ...ORDER_PAID, state: 'lapsed' } }, { left: false }, 1), orderView({ status: 200, body: { ...ORDER_PAID, state: 'cancelled' } }, { left: false }, 1),
    orderView({ status: 200, body }, { left: false }, 1), orderView({ status: 200, body }, { left: true }, 1), orderView({ status: 200, body }, { left: true }, ASKS_MOST),
  ];
  for (const view of views) assert.ok(ORDER_WORDS.includes(view.word), `${view.state}: ${view.word}`);
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
    ['./shop/checkout', './lib/shop/checkout.mjs', './types/shop-checkout.d.ts'],
    ['./shop/order', './lib/shop/order.mjs', './types/shop-order.d.ts'],
  ]) {
    assert.deepEqual(manifest.exports[entry], { types, default: file }, entry);
    assert.ok(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').length > 0);
    assert.ok(readFileSync(new URL(`../${types}`, import.meta.url), 'utf8').length > 0);
  }
  // `lib` and `types` are packed whole, so none of it can be left out of a release.
  assert.ok(manifest.files.includes('lib') && manifest.files.includes('types'));
  for (const name of ['SHOP_LOCALES', 'shopWordsFor', 'PRODUCT', 'CART', 'CHECKOUT', 'ORDER', 'LISTING', 'MAX_LINES', 'MAX_QTY', 'cartKey', 'readCart', 'addLine', 'removeLine', 'setQty', 'shippingBody', 'cartView', 'pressKey', 'freshPress', 'pressFor', 'checkoutBody', 'missingDetails', 'afterAnswer', 'ASK_EVERY_MS', 'ASKS_MOST', 'ORDER_WORDS', 'orderView', 'orderAddress', 'frozenOrder', 'productFacts', 'variantFor', 'valueStates', 'answersOf', 'fromPrice']) {
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

test('the pieces\' shared helpers: JSON from an attribute or what is given, and nothing defined where there is no document', async () => {
  const wire = await import('../elements/shop-wire.js');
  assert.deepEqual(wire.parsed('{"a":[1,2]}', null), { a: [1, 2] });
  assert.equal(wire.parsed('not json', 'otherwise'), 'otherwise');
  assert.deepEqual(wire.parsed(undefined, []), [], 'an attribute that is not there');
  assert.equal(wire.parsed('', 7), 7);
  assert.equal(typeof wire.BaseElement, 'function', 'something for a piece\'s element to extend, with or without a document');
  // With no custom elements to define it in, defining is nothing.
  wire.defineOnce('jtk-nothing', class extends wire.BaseElement {});
  for (const file of ['shop-product.js', 'shop-cart.js', 'shop-checkout.js', 'shop-order.js']) {
    const source = readFileSync(new URL(`../elements/${file}`, import.meta.url), 'utf8');
    // Written once, in the wire: a piece takes them from there.
    assert.doesNotMatch(source, /^(?:export )?function (?:parsed|putBase)\b/m, `${file} writes its own`);
    assert.match(source, /from '\.\/shop-wire\.js'/, `${file} takes them from the wire`);
  }
  const types = readFileSync(new URL('../types/elements-shop.d.ts', import.meta.url), 'utf8');
  for (const name of ['parsed', 'putBase', 'BaseElement', 'defineOnce']) assert.ok(types.includes(name), `elements-shop.d.ts declares ${name}`);
});

test("a shop's title is put into a word as written, never as a replacement pattern", () => {
  // `'Remove {title}'.replace('{title}', 'Gift $& card')` would say «Remove {title} card»: a title is a shop's free text.
  assert.equal('Remove {title}'.replace('{title}', () => 'Gift $$ 50 $& card'), 'Remove Gift $$ 50 $& card');
  for (const file of ['shop-product.js', 'shop-cart.js', 'shop-checkout.js', 'shop-order.js']) {
    const source = readFileSync(new URL(`../elements/${file}`, import.meta.url), 'utf8');
    for (const [call] of source.matchAll(/\.replace\('\{title\}',[^\n]*/g)) assert.match(call, /\{title\}',\s*\(\)\s*=>/, `${file}: ${call}`);
  }
});

test("the cart's element loads without a DOM, speaks over the same wire, and is in the package with its types", async () => {
  const wire = await import('../elements/shop-wire.js');
  const cart = await import('../elements/shop-cart.js');
  assert.equal(cart.SHOP_PROTOCOL, 1, 'the element names the wire\'s version');
  assert.equal(cart.ask, wire.ask);
  for (const name of ['wireCart', 'defineCart']) assert.equal(typeof cart[name], 'function', name);
  assert.equal(typeof cart.JtkCart, 'function');
  // With no custom elements to define it in, defining is nothing.
  cart.defineCart();

  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.exports['./elements/shop-cart'], { types: './types/elements-shop.d.ts', default: './elements/shop-cart.js' });
  const types = readFileSync(new URL('../types/elements-shop.d.ts', import.meta.url), 'utf8');
  for (const name of ['wireCart', 'defineCart', 'JtkCart', "'jtk:to-checkout'"]) assert.ok(types.includes(name), `elements-shop.d.ts declares ${name}`);
  const cartTypes = readFileSync(new URL('../types/shop-cart.d.ts', import.meta.url), 'utf8');
  for (const name of ['CartRow', 'CartView', 'cartView']) assert.ok(cartTypes.includes(name), `shop-cart.d.ts declares ${name}`);
  assert.match(readFileSync(new URL('../types/index.d.ts', import.meta.url), 'utf8'), /cartView/, 'the barrel\'s types say cartView');
});

test("the checkout's element loads without a DOM, speaks over the same wire, and is in the package with its types", async () => {
  const wire = await import('../elements/shop-wire.js');
  const checkout = await import('../elements/shop-checkout.js');
  assert.equal(checkout.SHOP_PROTOCOL, 1, 'the element names the wire\'s version');
  assert.equal(checkout.ask, wire.ask);
  for (const name of ['wireCheckout', 'defineCheckout']) assert.equal(typeof checkout[name], 'function', name);
  assert.equal(typeof checkout.JtkCheckout, 'function');
  // With no custom elements to define it in, defining is nothing.
  checkout.defineCheckout();

  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.exports['./elements/shop-checkout'], { types: './types/elements-shop.d.ts', default: './elements/shop-checkout.js' });
  const types = readFileSync(new URL('../types/elements-shop.d.ts', import.meta.url), 'utf8');
  for (const name of ['wireCheckout', 'defineCheckout', 'JtkCheckout']) assert.ok(types.includes(name), `elements-shop.d.ts declares ${name}`);
  const checkoutTypes = readFileSync(new URL('../types/shop-checkout.d.ts', import.meta.url), 'utf8');
  for (const name of ['Press', 'pressKey', 'freshPress', 'pressFor', 'checkoutBody', 'Next', 'afterAnswer']) assert.ok(checkoutTypes.includes(name), `shop-checkout.d.ts declares ${name}`);
  assert.match(readFileSync(new URL('../types/index.d.ts', import.meta.url), 'utf8'), /afterAnswer/, 'the barrel\'s types say afterAnswer');
  // The element keeps the press where the module says, and decides nothing of its own: every answer goes through afterAnswer.
  const source = readFileSync(new URL('../elements/shop-checkout.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/lib\/shop\/checkout\.mjs'/);
  for (const name of ['pressKey', 'pressFor', 'checkoutBody', 'afterAnswer']) assert.match(source, new RegExp(`\\b${name}\\(`), `the element calls ${name}`);
  assert.match(source, /sessionStorage/, 'the press is kept in the tab');
});

test("the order's element loads without a DOM, speaks over the same wire, and is in the package with its types", async () => {
  const wire = await import('../elements/shop-wire.js');
  const order = await import('../elements/shop-order.js');
  assert.equal(order.SHOP_PROTOCOL, 1, 'the element names the wire\'s version');
  assert.equal(order.ask, wire.ask);
  for (const name of ['wireOrder', 'defineOrder']) assert.equal(typeof order[name], 'function', name);
  assert.equal(typeof order.JtkOrder, 'function');
  // With no custom elements to define it in, defining is nothing.
  order.defineOrder();

  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.exports['./elements/shop-order'], { types: './types/elements-shop.d.ts', default: './elements/shop-order.js' });
  const types = readFileSync(new URL('../types/elements-shop.d.ts', import.meta.url), 'utf8');
  for (const name of ['wireOrder', 'defineOrder', 'JtkOrder']) assert.ok(types.includes(name), `elements-shop.d.ts declares ${name}`);
  const orderTypes = readFileSync(new URL('../types/shop-order.d.ts', import.meta.url), 'utf8');
  for (const name of ['ASK_EVERY_MS', 'ASKS_MOST', 'OrderView', 'orderView', 'orderAddress', 'frozenOrder', 'ORDER_WORDS']) assert.ok(orderTypes.includes(name), `shop-order.d.ts declares ${name}`);
  assert.match(readFileSync(new URL('../types/index.d.ts', import.meta.url), 'utf8'), /orderView/, 'the barrel\'s types say orderView');
  // The element decides nothing of its own: what the answer means is orderView's, and the address is orderAddress's — and the
  // cart is never read, only emptied.
  const source = readFileSync(new URL('../elements/shop-order.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/lib\/shop\/order\.mjs'/);
  for (const name of ['orderView', 'orderAddress', 'frozenOrder']) assert.match(source, new RegExp(`\\b${name}\\(`), `the element calls ${name}`);
  assert.doesNotMatch(source, /localStorage\.getItem|readCart/, 'the page after payment reads the order from its address alone, never the cart');
  assert.match(source, /localStorage\.removeItem/, 'and empties it once the order is paid');
  // …only for the press that went to Stripe from this tab (Ruling 227): the mark is read and forgotten, and each ask has its deadline (Ruling 228).
  for (const name of ['sentFromHere', 'paidFromKey']) assert.match(source, new RegExp(`\\b${name}\\(`), `the element calls ${name}`);
  assert.match(source, /sessionStorage\.getItem/, 'the mark is read from the tab');
  assert.match(source, /sessionStorage\.removeItem/, 'and forgotten once the cart is emptied');
  assert.match(source, /ASK_DEADLINE_MS/, 'each ask has its deadline');
  // The checkout writes the mark, as it sends the buyer on.
  const sender = readFileSync(new URL('../elements/shop-checkout.js', import.meta.url), 'utf8');
  assert.match(sender, /paidFromKey\(/, 'the checkout names where the mark is kept');
  assert.match(sender, /sessionStorage\.setItem\(paidFrom,/, 'and writes it');
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
