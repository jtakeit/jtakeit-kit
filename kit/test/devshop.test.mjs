// `devShop` (jtakeit-core wiki/102 stage 9, decision 8, Task 9.11): shop/1 on
// the dev server, answered from the site's own files, so a storefront can be
// walked on localhost. The platform is the authority for every shape and every
// refusal (docs/reference/shop-protocol.md; modules/shop/*.go of the platform
// at dca045af): what is pinned here is what the stand-in copies of it, and the
// rules the files cannot carry — the platform's customs areas, its pricing by
// weight band and free-above, and what makes a variant not hold.
//
// The site is a temporary one: the golden shop schema (Task 9.8) in German and
// English, and the test shop's `jtk/` (Ruling 200) laid over it. It is asked
// over a real server, as a page would ask, so a header, a status and a 303 are
// the ones a browser meets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_PAY_WORDS, devShop } from '../lib/devshop.mjs';
import { money } from '../lib/money.mjs';
import { bodyOf, devDiary } from '../lib/devdiary.mjs';
import { SHOP_LOCALES, shopWordsFor } from '../lib/shop/words.mjs';

const fixture = fileURLToPath(new URL('./fixtures/shop/jtk/', import.meta.url));
const golden = JSON.parse(readFileSync(new URL('./fixtures/platform/shop-schema.json', import.meta.url), 'utf8'));

const CANDLE = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a01';
const FOX = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a02';
const BAG = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1a03';

/** A temporary site: the golden schema in German and English, the test shop's jtk/ over it. */
function shopSite(schema = { ...golden, locales: ['en'] }) {
  const root = mkdtempSync(join(tmpdir(), 'devshop-'));
  cpSync(fixture, join(root, 'jtk'), { recursive: true });
  writeFileSync(join(root, 'jtk', 'schema.json'), JSON.stringify(schema));
  return root;
}

/** A file of the site read, changed by `edit`, and written back. */
function change(root, file, edit) {
  const path = join(root, 'jtk', file);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  edit(doc);
  writeFileSync(path, JSON.stringify(doc));
}
const product = (root, slug, edit) => change(root, `entries/products/${slug}.json`, (doc) => edit(doc.fields, doc));
const settings = (root, edit) => change(root, 'modules/shop.json', (doc) => edit(doc.settings));

/** The shop answering over a real server, and a way to ask it. */
async function serving(t, root, options, before) {
  const handler = devShop(root, options);
  const server = createServer((req, res) => {
    // The dev server mounts it at /api, and connect takes the mount off the address before it reaches a middleware.
    req.originalUrl = req.url;
    req.url = req.url.replace(/^\/api/, '') || '/';
    const last = () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('next');
    };
    const run = before === undefined ? handler : (a, b, c) => before(a, b, () => handler(a, b, c));
    Promise.resolve(run(req, res, last)).catch((why) => {
      res.statusCode = 500;
      res.end(String(why?.stack ?? why));
    });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((done) => server.close(done));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, init = {}) => {
    const res = await fetch(origin + path, { redirect: 'manual', ...init, headers: { 'x-jtk-shop': '1', ...init.headers } });
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // a sentence or a page
    }
    return { status: res.status, headers: res.headers, body, text };
  };
  const post = (path, body, headers) => call(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { origin, call, post };
}

const line = (product, variant, qty = 1, answers = {}) => ({ product, variant, qty, answers });
const foxS = line(FOX, 'v1', 2);
const buyer = { name: 'Ada Lovelace', email: 'ada@example.ch', phone: '+41 79 000 00 00' };
const address = { line1: 'Bahnhofstrasse 1', line2: '', postal_code: '8001', city: 'Zürich' };
const stock = (shop, ...ids) => shop.call(`/api/stock?${ids.map((id) => `product=${id}`).join('&')}`);
const states = (answer, id) => Object.fromEntries(answer.body.products.find((one) => one.id === id).variants.map((v) => [v.key, v.state]));

// ── what is left ──────────────────────────────────────────────────────────

test('GET /stock tells each product asked, in the order asked, every variant in stock and no count', async (t) => {
  const shop = await serving(t, shopSite());
  const answer = await stock(shop, BAG, FOX, CANDLE);
  assert.equal(answer.status, 200);
  assert.equal(answer.headers.get('cache-control'), 'no-store');
  assert.match(answer.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(
    answer.body.products.map((one) => [one.id, one.served]),
    [[BAG, true], [FOX, true], [CANDLE, true]],
  );
  assert.deepEqual(answer.body.products[1].variants, [
    { key: 'v1', sku: 'FOX-S-RED', state: 'in_stock' },
    { key: 'v2', sku: 'FOX-M-RED', state: 'in_stock' },
    { key: 'v3', sku: 'FOX-S-BLUE', state: 'in_stock' },
    { key: 'v4', sku: 'FOX-M-BLUE', state: 'in_stock' },
  ]);
  assert.ok(answer.body.products.every((one) => one.variants.every((v) => !('left' in v))), 'the files carry no count, so none is told');
});

test('a SKU the walk names is sold out — and only a tracked product has a count to be out of', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root, { soldOut: ['FOX-M-BLUE', 'KERZ-01'] });
  assert.deepEqual(states(await stock(shop, FOX), FOX), { v1: 'in_stock', v2: 'in_stock', v3: 'in_stock', v4: 'sold_out' });
  assert.deepEqual(states(await stock(shop, CANDLE), CANDLE), { v1: 'sold_out' });
  // Made to order is never sold out, and a variant off sale is not sold, whatever its stock.
  product(root, 'kerzenstaender', (fields) => (fields.tracked = false));
  product(root, 't-shirt-fox', (fields) => (fields.variants[3].on_sale = false));
  assert.deepEqual(states(await stock(shop, CANDLE), CANDLE), { v1: 'in_stock' });
  assert.deepEqual(states(await stock(shop, FOX), FOX), { v1: 'in_stock', v2: 'in_stock', v3: 'in_stock', v4: 'off_sale' });
});

test('a SKU is named as the platform keys it, in lower case: the walk may say it either way', async (t) => {
  const shop = await serving(t, shopSite(), { soldOut: ['fox-m-blue', 'Fox-S-Red'] });
  assert.deepEqual(states(await stock(shop, FOX), FOX), { v1: 'sold_out', v2: 'in_stock', v3: 'in_stock', v4: 'sold_out' });
  const short = await go(shop, { lines: [line(FOX, 'v1', 1), line(FOX, 'v4', 2)], total: 8970 + 900 });
  assert.equal(short.status, 409);
  assert.deepEqual(short.body.short, [{ sku: 'FOX-S-RED', wanted: 1, available: 0 }, { sku: 'FOX-M-BLUE', wanted: 2, available: 0 }]);
});

test('a product the files hide, or one that is nobody\'s, is not served', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  product(root, 'kerzenstaender', (fields, doc) => (doc.visible = false));
  const nobody = '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1aff';
  const answer = await stock(shop, CANDLE, nobody, FOX);
  assert.deepEqual(answer.body.products[0], { id: CANDLE, served: false, variants: [] });
  assert.deepEqual(answer.body.products[1], { id: nobody, served: false, variants: [] });
  assert.equal(answer.body.products[2].served, true);
  // A schedule that has come to its end hides one as the switch does, and one still to come is not yet served.
  product(root, 'kerzenstaender', (fields, doc) => {
    doc.visible = true;
    doc.hide_at = '2020-01-01T00:00:00Z';
  });
  assert.equal((await stock(shop, CANDLE)).body.products[0].served, false);
  product(root, 'kerzenstaender', (fields, doc) => {
    delete doc.hide_at;
    doc.show_at = '2099-01-01T00:00:00Z';
  });
  assert.equal((await stock(shop, CANDLE)).body.products[0].served, false);
});

test('a variant that is off sale, or does not hold, is off sale', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  product(root, 't-shirt-fox', (fields) => {
    fields.variants[0].on_sale = false; // taken off
    delete fields.variants[1].sku; // no SKU
    fields.variants[2].price = '12'; // a price that is not money
    fields.variants[3].picks = { fit: 'slim' }; // picks that name no option of the product
  });
  assert.deepEqual(states(await stock(shop, FOX), FOX), { v1: 'off_sale', v2: 'off_sale', v3: 'off_sale', v4: 'off_sale' });
});

for (const [what, edit] of [
  ['a SKU of white space', (v) => (v.sku = '   ')],
  ['a price of a fraction', (v) => (v.price = { minor: 29.9 })],
  ['a price below nothing', (v) => (v.price = { minor: -1 })],
  ['a price with something else beside it', (v) => (v.price = { minor: 2990, from: true })],
  ['no price', (v) => delete v.price],
  ['a weight of a fraction', (v) => (v.weight = 180.5)],
  ['a weight below nothing', (v) => (v.weight = -1)],
  ['a weight in words', (v) => (v.weight = '180')],
  ['an on_sale in quotes', (v) => (v.on_sale = 'false')],
  ['an on_sale that is a number', (v) => (v.on_sale = 0)],
  ['no pick of an option the product has', (v) => delete v.picks.colour],
  ['a pick of a value the option has not got', (v) => (v.picks.colour = 'green')],
  ['picks that are not an object', (v) => (v.picks = 'S red')],
]) {
  test(`a variant with ${what} is off sale, and the others are not touched`, async (t) => {
    const root = shopSite();
    const shop = await serving(t, root);
    product(root, 't-shirt-fox', (fields) => edit(fields.variants[0]));
    assert.deepEqual(states(await stock(shop, FOX), FOX), { v1: 'off_sale', v2: 'in_stock', v3: 'in_stock', v4: 'in_stock' });
  });
}

test('a variant with no weight, an empty one, or one of 0 g holds', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  product(root, 't-shirt-fox', (fields) => {
    delete fields.variants[0].weight;
    fields.variants[1].weight = '';
    fields.variants[2].weight = 0;
    fields.variants[3].weight = null;
  });
  assert.deepEqual(states(await stock(shop, FOX), FOX), { v1: 'in_stock', v2: 'in_stock', v3: 'in_stock', v4: 'in_stock' });
});

test('a product without options has one variant that picks nothing, and holds; one that picks something does not', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  assert.deepEqual(states(await stock(shop, CANDLE), CANDLE), { v1: 'in_stock' });
  product(root, 'kerzenstaender', (fields) => (fields.variants[0].picks = { size: 's' }));
  assert.deepEqual(states(await stock(shop, CANDLE), CANDLE), { v1: 'off_sale' });
});

test('a tax code that is not one of Stripe\'s takes every variant of the product off sale', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  product(root, 'kerzenstaender', (fields) => (fields.tax_code = 'txcd_20030000'));
  assert.deepEqual(states(await stock(shop, CANDLE), CANDLE), { v1: 'in_stock' });
  product(root, 'kerzenstaender', (fields) => (fields.tax_code = 'candles'));
  assert.deepEqual(states(await stock(shop, CANDLE), CANDLE), { v1: 'off_sale' });
});

test('a customization a buyer must answer that does not hold takes every variant off sale; one nobody must answer does not', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  // The bag's `tag` is an optional text: without a `max` it does not hold, and a buyer who leaves it alone is still sold to.
  product(root, 'tasche-nach-mass', (fields) => delete fields.customizations[2].max);
  assert.deepEqual(states(await stock(shop, BAG), BAG), { v1: 'in_stock', v2: 'in_stock' });
  // `body` is a required choice: with no choices it can be answered by nobody.
  product(root, 'tasche-nach-mass', (fields) => (fields.customizations[0].choices = []));
  assert.deepEqual(states(await stock(shop, BAG), BAG), { v1: 'off_sale', v2: 'off_sale' });
  // A `required` that is not a switch says neither, and is read as required.
  product(root, 'tasche-nach-mass', (fields) => {
    fields.customizations[0].choices = [{ _key: 'natur', label: 'Natur' }];
    fields.customizations[2].required = 'yes';
  });
  assert.deepEqual(states(await stock(shop, BAG), BAG), { v1: 'off_sale', v2: 'off_sale' });
});

test('a stock call that asks after nothing, after too many, or after what is no product\'s id is a sentence, as the platform says', async (t) => {
  const shop = await serving(t, shopSite());
  const none = await shop.call('/api/stock');
  assert.equal(none.status, 400);
  assert.match(none.headers.get('content-type'), /^text\/plain/);
  assert.match(none.body, /1 to 100 products/);
  assert.equal((await shop.call(`/api/stock?${Array.from({ length: 101 }, () => `product=${FOX}`).join('&')}`)).status, 400);
  assert.equal((await shop.call(`/api/stock?${Array.from({ length: 100 }, () => `product=${FOX}`).join('&')}`)).status, 200);
  const bad = await shop.call('/api/stock?product=fox');
  assert.equal(bad.status, 400);
  assert.match(bad.body, /"fox" is not a product's id/);
  assert.equal((await shop.post('/api/stock', {})).status, 405);
  assert.equal((await stock(shop, FOX.toUpperCase())).body.products[0].served, true, 'an id is read in either case');
});

// ── the version a page speaks, and what is not the shop's ──────────────────

test('a request that names no version is answered and said once in the console; a version the platform does not answer is refused', async (t) => {
  const warned = t.mock.method(console, 'warn', () => {});
  const shop = await serving(t, shopSite());
  const named = await stock(shop, FOX);
  assert.equal(named.status, 200);
  assert.equal(warned.mock.callCount(), 0, 'a page that names version 1 is not told anything');
  for (let i = 0; i < 3; i++) {
    const bare = await shop.call(`/api/stock?product=${FOX}`, { headers: { 'x-jtk-shop': '' } });
    assert.equal(bare.status, 200);
    assert.equal(bare.body.products[0].served, true);
  }
  assert.equal(warned.mock.callCount(), 1, 'once');
  assert.match(String(warned.mock.calls[0].arguments[0]), /X-Jtk-Shop: 1/);
  const two = await shop.call(`/api/stock?product=${FOX}`, { headers: { 'x-jtk-shop': '2' } });
  assert.equal(two.status, 400);
  assert.deepEqual(two.body, { error: 'JTK_E_SHOP_PROTOCOL', said: '2', supported: [1] });
});

test('the pay page is a page a browser is sent to: it names no version, and is told nothing of it', async (t) => {
  const warned = t.mock.method(console, 'warn', () => {});
  const shop = await serving(t, shopSite());
  const made = await go(shop);
  const page = await shop.call(`/api/dev-pay?order=${made.body.order}`, { headers: { 'x-jtk-shop': '' } });
  assert.equal(page.status, 200);
  const pay = await shop.call(`/api/dev-pay?order=${made.body.order}&do=pay`, { method: 'POST', headers: { 'x-jtk-shop': '' } });
  assert.equal(pay.status, 303);
  assert.equal(warned.mock.callCount(), 0);
});

test('asked at /api/… as it is, without a mount taking the prefix off, it answers the same', async (t) => {
  const handler = devShop(shopSite());
  const server = createServer((req, res) => handler(req, res, () => res.end('next')));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((done) => server.close(done));
  });
  const asked = await fetch(`http://127.0.0.1:${server.address().port}/api/stock?product=${FOX}`, { headers: { 'x-jtk-shop': '1' } });
  assert.deepEqual((await asked.json()).products.map((one) => [one.id, one.served]), [[FOX, true]]);
});

test('a site whose schema does not turn the shop on is next()\'s, on every path — and /turnstile is the diary\'s', async (t) => {
  const plain = shopSite({ ...golden, locales: ['en'], modules: {} });
  const none = await serving(t, plain);
  for (const [method, path] of [
    ['GET', `/api/stock?product=${FOX}`],
    ['POST', '/api/shipping'],
    ['POST', '/api/checkout'],
    ['GET', '/api/order?token=x'],
    ['GET', '/api/dev-pay?order=x'],
    ['POST', '/api/dev-pay?order=x&do=pay'],
    ['GET', '/api/availability'],
  ]) {
    const answer = await none.call(path, { method });
    assert.deepEqual([answer.status, answer.body], [404, 'next'], path);
  }
  // A site on contract 2 has no shop at all.
  const two = mkdtempSync(join(tmpdir(), 'devshop-2-'));
  writeFileSync(join(two, 'package.json'), '{}');
  assert.equal((await (await serving(t, two)).call(`/api/stock?product=${FOX}`)).status, 404);

  // On a site with the shop, what is not its address is still next()'s, and the diary answers /turnstile.
  const home = shopSite();
  const shop = await serving(t, home, {}, devDiary(home));
  assert.equal((await shop.call('/api/availability')).status, 412, 'the diary has none set up');
  const turnstile = await shop.call('/api/turnstile');
  assert.deepEqual([turnstile.status, turnstile.body], [200, { sitekey: '' }]);
  assert.equal(turnstile.headers.get('x-jtk-dev-diary'), '1');
  const alone = await serving(t, shopSite());
  assert.deepEqual([(await alone.call('/api/turnstile')).status, (await alone.call('/api/lead', { method: 'POST' })).status], [404, 404]);
});

test('a file that is not JSON is said with its name, where a developer reads it', async (t) => {
  const root = shopSite();
  writeFileSync(join(root, 'jtk', 'entries', 'products', 'broken.json'), '{ nope');
  const shop = await serving(t, root);
  const answer = await stock(shop, FOX);
  assert.equal(answer.status, 500);
  assert.match(answer.body, /broken\.json/);
});

// ── the cart priced ───────────────────────────────────────────────────────

const ship = (shop, lines, country = 'CH', extra = {}) => shop.post('/api/shipping', { lines, country, ...extra });
const names = (answer) => answer.body.methods.map((m) => [m.method, m.price, m.free]);

test('a cart priced: the fox twice to Switzerland, by the weight band and the pick-up at nothing', async (t) => {
  const shop = await serving(t, shopSite());
  const answer = await ship(shop, [foxS]);
  assert.equal(answer.status, 200);
  assert.equal(answer.headers.get('cache-control'), 'no-store');
  assert.deepEqual(answer.body, {
    currency: 'chf',
    lines: [
      {
        line: 0,
        product: FOX,
        variant: 'v1',
        sku: 'FOX-S-RED',
        title: 'T-shirt «Fox»',
        labels: ['S', 'Red'],
        answers: [],
        unit: 2990,
        qty: 2,
        total: 5980,
      },
    ],
    refused: [],
    subtotal: 5980,
    country: 'CH',
    sends: true,
    cannot_send: false,
    abroad: false,
    methods: [
      { method: 'economy', name: 'PostPac Economy', pickup: false, price: 900, free: false },
      { method: 'pickup', name: 'Abholung im Laden', pickup: true, price: 0, free: false },
    ],
    vat_included: false,
    own_currency: false,
  });
  assert.deepEqual(Object.keys(answer.body), ['currency', 'lines', 'refused', 'subtotal', 'country', 'sends', 'cannot_send', 'abroad', 'methods', 'vat_included', 'own_currency']);
});

test('a country is read in capitals, and Liechtenstein is the same customs area as Switzerland', async (t) => {
  const shop = await serving(t, shopSite());
  const li = await ship(shop, [foxS], ' li ');
  assert.equal(li.body.country, 'LI');
  assert.deepEqual([li.body.sends, li.body.abroad, li.body.subtotal], [true, false, 5980]);
  assert.deepEqual(names(li), [['economy', 900, false], ['pickup', 0, false]]);
});

test('a country the business sends to by another zone is abroad, with that zone\'s method', async (t) => {
  const shop = await serving(t, shopSite());
  const de = await ship(shop, [foxS], 'DE');
  assert.deepEqual([de.body.sends, de.body.cannot_send, de.body.abroad], [true, false, true]);
  // A pick-up is offered whatever the country, in the settings' order: the shop's own.
  assert.deepEqual(names(de), [['pickup', 0, false], ['eu-post', 1900, false]]);
});

test('a country nobody sends to is offered the pick-ups alone, and is not abroad: a buyer who picks up crosses no border', async (t) => {
  const shop = await serving(t, shopSite());
  const us = await ship(shop, [foxS], 'US');
  assert.deepEqual([us.body.sends, us.body.cannot_send, us.body.abroad], [false, false, false]);
  assert.deepEqual(names(us), [['pickup', 0, false]]);
  assert.equal(us.body.subtotal, 5980, 'the cart is priced all the same');
  const none = await ship(shop, [foxS], '');
  assert.deepEqual([none.body.country, none.body.sends, names(none)], ['', false, [['pickup', 0, false]]]);
});

test('the bag with its red body and the zipper is 134.00, and the economy post is free above 100.00', async (t) => {
  const shop = await serving(t, shopSite());
  const answer = await ship(shop, [line(BAG, 'v2', 1, { body: 'rot', zipper: true })]);
  const [one] = answer.body.lines;
  assert.deepEqual([one.sku, one.unit, one.total, answer.body.subtotal], ['TASCHE-L', 13400, 13400, 13400]);
  assert.deepEqual(one.answers, [
    { key: 'body', name: 'Farbe des Körpers', choice: 'rot', label: 'Rot', adds: 1000 },
    { key: 'zipper', name: 'Reissverschluss', ticked: true, adds: 500 },
  ]);
  assert.deepEqual(names(answer), [['economy', 0, true], ['pickup', 0, false]]);
  // A text answer is kept trimmed, and adds what its question adds (nothing); the choice it was not asked adds nothing.
  const tagged = await ship(shop, [line(BAG, 'v1', 1, { body: 'natur', tag: '  Ada  ' })]);
  assert.deepEqual(tagged.body.lines[0].answers, [
    { key: 'body', name: 'Farbe des Körpers', choice: 'natur', label: 'Natur', adds: 0 },
    { key: 'tag', name: 'Name auf dem Etikett', text: 'Ada', adds: 0 },
  ]);
  assert.equal(tagged.body.lines[0].unit, 8900);
});

test('a choice answered with white space is no answer: an optional one is sold, a required one is refused as left alone', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  const refused = async (answers) => (await ship(shop, [line(BAG, 'v1', 1, answers)])).body.refused;
  // `body` is the bag's required choice.
  for (const blank of [' ', '   ', '\t', '\n', '\u00a0']) {
    const [one] = await refused({ body: blank });
    assert.deepEqual([one.code, /«Farbe des Körpers»: is required and was not answered/.test(one.says)], ['answer', true], JSON.stringify(blank));
  }
  product(root, 'tasche-nach-mass', (fields) => (fields.customizations[0].required = false));
  for (const blank of [' ', '   ', '\t', '\n', '\u00a0', '']) {
    const answer = await ship(shop, [line(BAG, 'v1', 1, { body: blank })]);
    assert.deepEqual(answer.body.refused, [], JSON.stringify(blank));
    assert.deepEqual(answer.body.lines[0].answers, [], 'it is no answer, so the line keeps none');
    assert.equal(answer.body.lines[0].unit, 8900);
  }
  // A choice that is not white space is still held to its choices, trimmed or not.
  assert.deepEqual((await refused({ body: ' natur ' })).map((r) => r.code), ['answer']);
});

test('a line the shop will not sell is refused with the protocol\'s code, and no method is offered while any is', async (t) => {
  const root = shopSite();
  product(root, 't-shirt-fox', (fields) => (fields.variants[1].on_sale = false));
  const shop = await serving(t, root);
  const answer = await ship(shop, [foxS, line(FOX, 'v2', 1), line(BAG, 'v1', 1, { body: 'lila' })]);
  assert.deepEqual(
    answer.body.refused.map((r) => [r.line, r.code]),
    [[1, 'off_sale'], [2, 'answer']],
  );
  assert.ok(answer.body.refused.every((r) => typeof r.says === 'string' && r.says !== ''));
  assert.deepEqual(answer.body.methods, []);
  assert.deepEqual([answer.body.sends, answer.body.cannot_send], [true, false], 'the country is told as for any cart');
  assert.deepEqual(answer.body.lines.map((one) => one.line), [0], 'a line refused leaves its place empty rather than shifting the others');
  assert.equal(answer.body.subtotal, 5980);
});

test('what a line may be refused for: not sold, quantity, answer, too large, and a cart of too many lines', async (t) => {
  const root = shopSite();
  product(root, 't-shirt-fox', (fields) => (fields.variants[2].weight = 'heavy'));
  const shop = await serving(t, root);
  const code = async (one, country) => (await ship(shop, [one], country)).body.refused.map((r) => [r.line, r.code]);
  assert.deepEqual(await code(line('0193a5c3-0000-7d20-9a31-000000000000', 'v1')), [[0, 'not_sold']], 'a product nobody has');
  assert.deepEqual(await code(line('fox', 'v1')), [[0, 'not_sold']], 'a product named by what is no id');
  assert.deepEqual(await code(line(FOX, 'v9')), [[0, 'not_sold']], 'a variant the product has not got');
  assert.deepEqual(await code(line(FOX, 'v3')), [[0, 'not_sold']], 'a variant that does not hold is not sold, as the cart says it');
  assert.deepEqual(await code(line(FOX, 'v1', 0)), [[0, 'quantity']]);
  assert.deepEqual(await code(line(FOX, 'v1', 1000)), [[0, 'quantity']]);
  assert.deepEqual(await code(line(FOX, 'v1', 1.5)), [[0, 'quantity']]);
  assert.deepEqual(await code(line(FOX, 'v1', 1, { engraving: 'Ada' })), [[0, 'answer']], 'an answer to a question the product does not ask');
  assert.deepEqual(await code(line(BAG, 'v1')), [[0, 'answer']], 'a required question left alone');
  const says = async (one) => (await ship(shop, [one])).body.refused[0].says;
  assert.match(await says(line(BAG, 'v1')), /«Farbe des Körpers»: is required and was not answered/);
  assert.match(await says(line(BAG, 'v1', 1, { body: 'natur', tag: 'x'.repeat(21) })), /«Name auf dem Etikett»: is 21 characters and at most 20 are taken/);
  assert.match(await says(line(BAG, 'v1', 1, { body: 'blau' })), /«Farbe des Körpers»: "blau" is not one of its choices/);
  assert.match(await says(line(FOX, 'v1', 1, { engraving: 'Ada' })), /asks nothing called "engraving"/);
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', tag: 'x'.repeat(21) })), [[0, 'answer']], 'a text past its max');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', zipper: 'yes' })), [[0, 'answer']], 'a yes-or-no answered with a word');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 5 })), [[0, 'answer']], 'a choice answered with what is no key');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', tag: 5 })), [[0, 'answer']], 'a text answered with what is no text');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', tag: 'Ada\nLovelace' })), [[0, 'answer']], 'a text on two lines');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', tag: '\u200d' })), [], 'a text of nothing a person can see is no answer, and the question is optional');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', tag: 'x'.repeat(20), zipper: false })), [], 'a text of exactly its max, a yes-or-no unticked');
  assert.deepEqual(await code(line(BAG, 'v1', 1, { body: 'natur', tag: '🦊'.repeat(20) })), [], 'a length is in characters');
  assert.deepEqual(await code(line(BAG, 'v1', 999, { body: 'rot' }), 'CH'), [], 'the most one line asks');

  // Past the most one amount may be: a line of many, and a unit that is more on its own.
  product(root, 'kerzenstaender', (fields) => (fields.variants[0].price = { minor: 200_000 }));
  assert.deepEqual(await code(line(CANDLE, 'v1', 999)), [[0, 'too_large']], '999 of 2,000.00 is more than 999,999.99');
  assert.deepEqual(await code(line(CANDLE, 'v1', 499)), [], '499 of it is not');
  product(root, 'kerzenstaender', (fields) => (fields.variants[0].price = { minor: 100_000_000 }));
  assert.deepEqual(await code(line(CANDLE, 'v1', 1)), [[0, 'too_large']]);
  product(root, 'tasche-nach-mass', (fields) => (fields.customizations[1].adds = { minor: 99_995_000 }));
  assert.deepEqual(await code(line(BAG, 'v2', 1, { body: 'natur', zipper: true })), [[0, 'too_large']], 'a unit with what its answers add');

  const many = await ship(shop, Array.from({ length: 101 }, () => foxS));
  assert.deepEqual(many.body.refused.map((r) => [r.line, r.code]), [[-1, 'too_large']]);
  assert.deepEqual([many.body.lines, many.body.subtotal, many.body.methods], [[], 0, []]);
  assert.equal((await ship(shop, Array.from({ length: 100 }, () => line(FOX, 'v1', 1)))).body.refused.length, 0);
});

test('the cart as a whole may not come to more than one amount may be: the line that takes it over is refused', async (t) => {
  const root = shopSite();
  product(root, 'kerzenstaender', (fields) => (fields.variants[0].price = { minor: 99_998_000 }));
  const shop = await serving(t, root);
  const first = await ship(shop, [line(CANDLE, 'v1', 1), line(FOX, 'v1', 1)]);
  assert.deepEqual(first.body.refused.map((r) => [r.line, r.code]), [[1, 'too_large']]);
  assert.equal(first.body.subtotal, 99_998_000);
  const second = await ship(shop, [line(FOX, 'v1', 1), line(CANDLE, 'v1', 1), line(CANDLE, 'v1', 1)]);
  assert.deepEqual(second.body.refused.map((r) => [r.line, r.code]), [[1, 'too_large'], [2, 'too_large']]);
  assert.equal(second.body.subtotal, 2990);
});

// The edge refuses whatever does not parse to a JSON object (`objectOf` of backend/edge/src/shop.ts), so a page that
// posts FormData, forgets JSON.stringify or posts nothing is told on localhost, not in production.
test('a body that does not parse to a JSON object is refused invalid_body on shipping and on checkout', async (t) => {
  const shop = await serving(t, shopSite());
  for (const path of ['/api/shipping', '/api/checkout']) {
    for (const [what, body, type] of [
      ['text that is not JSON', '{nope', 'application/json'],
      ['a form', 'country=CH&method=pickup', 'application/x-www-form-urlencoded'],
      ['nothing at all', '', 'application/json'],
      ['null', 'null', 'application/json'],
      ['a list', '[{"product":"x"}]', 'application/json'],
      ['a number', '5', 'application/json'],
    ]) {
      const answer = await shop.call(path, { method: 'POST', headers: { 'content-type': type }, body: body === '' ? undefined : body });
      assert.deepEqual([answer.status, answer.body], [400, { error: 'invalid_body' }], `${path} with ${what}`);
    }
    // And a body that is an object is read, whatever it holds: the empty object is an empty cart.
    assert.notEqual((await shop.post(path, {})).status, 400, `${path} with {}`);
  }
});

test('the shared bodyOf reads a body as the diary always has, and a strict read says nothing for what is no JSON object', async () => {
  const body = (raw, ...options) => {
    const listeners = {};
    const req = { on: (event, fn) => ((listeners[event] = fn), req) };
    const read = bodyOf(req, ...options);
    if (raw !== undefined) listeners.data(raw);
    listeners.end();
    return read;
  };
  // The diary's: anything that parses as it parses, an empty body and garbage as {}.
  assert.deepEqual(await body('{"a":1}'), { a: 1 });
  assert.deepEqual(await body(undefined), {});
  assert.deepEqual(await body('{nope'), {});
  assert.deepEqual(await body('[1]'), [1]);
  // Strict: an object, or nothing.
  assert.deepEqual(await body('{"a":1}', { strict: true }), { a: 1 });
  assert.deepEqual(await body('{}', { strict: true }), {});
  for (const raw of [undefined, '', '{nope', 'null', '[1]', '"x"', '5', 'a=b']) assert.equal(await body(raw, { strict: true }), undefined, String(raw));
});

test('a body that is not an object is refused invalid_body, and a call of the wrong method is not allowed', async (t) => {
  const shop = await serving(t, shopSite());
  assert.deepEqual(await shop.post('/api/shipping', [1]).then((a) => [a.status, a.body]), [400, { error: 'invalid_body' }]);
  assert.deepEqual(await shop.post('/api/checkout', 'x').then((a) => [a.status, a.body]), [400, { error: 'invalid_body' }]);
  const get = await shop.call('/api/shipping');
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  assert.equal((await shop.post('/api/order', {})).headers.get('allow'), 'GET');
  // No cart at all is an empty one: priced at nothing, offered what its country is.
  const empty = await shop.post('/api/shipping', { country: 'CH' });
  assert.deepEqual([empty.status, empty.body.lines, empty.body.subtotal, names(empty)], [200, [], 0, [['economy', 900, false], ['pickup', 0, false]]]);
});

// ── the buyer's language ──────────────────────────────────────────────────

test('the lines are read in the page\'s language where the site has it, the site\'s own words otherwise', async (t) => {
  const shop = await serving(t, shopSite());
  const title = async (locale) => (await ship(shop, [foxS], 'CH', locale === undefined ? {} : { locale })).body.lines[0].title;
  assert.equal(await title('en'), 'Fox T-shirt');
  assert.equal(await title('EN'), 'Fox T-shirt', 'the case of a tag does not matter');
  assert.equal(await title(undefined), 'T-shirt «Fox»');
  assert.equal(await title('de'), 'T-shirt «Fox»', 'the site\'s own language');
  assert.equal(await title('de-CH'), 'T-shirt «Fox»', 'a regional tag the site has not got is the site\'s own');
  assert.equal(await title('fr'), 'T-shirt «Fox»', 'a language the site has not got');
  assert.equal(await title('english'), 'T-shirt «Fox»', 'what is no tag');
  assert.equal(await title(5), 'T-shirt «Fox»');
  // The labels and the answers are the language's too; a price is the same in every language.
  const english = await ship(shop, [foxS], 'CH', { locale: 'en' });
  assert.deepEqual([english.body.lines[0].labels, english.body.lines[0].unit], [['S', 'Red'], 2990]);
});

test('the language chooses the words and never what is sold: a product it has no words for is sold in the site\'s own', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  const bag = line(BAG, 'v1', 1, { body: 'natur' });
  const answer = await ship(shop, [foxS, bag], 'CH', { locale: 'en' });
  assert.deepEqual(answer.body.refused, []);
  assert.deepEqual(answer.body.lines.map((one) => one.title), ['Fox T-shirt', 'Tasche nach Mass']);
  // Only a product the site's own copy does not serve is refused, in every language.
  product(root, 'tasche-nach-mass', (fields, doc) => (doc.visible = false));
  assert.deepEqual((await ship(shop, [bag], 'CH', { locale: 'en' })).body.refused.map((r) => r.code), ['not_sold']);
  assert.deepEqual((await ship(shop, [bag])).body.refused.map((r) => r.code), ['not_sold']);
  // A translation that holds the language back does not take the product off sale: an entry a module sells is in every language.
  change(root, 'entries/products/t-shirt-fox.en.json', (doc) => (doc.visible = false));
  assert.deepEqual((await ship(shop, [foxS], 'CH', { locale: 'en' })).body.refused, []);
});

// ── customs ───────────────────────────────────────────────────────────────

const EU = 'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK MC SM'.split(' ');

/** A site that sends to these countries by one flat method, the first its business's own. */
function sendingTo(countries, extra = (root) => {}) {
  const root = shopSite();
  settings(root, (s) => {
    s.zones = [{ _key: 'all', name: 'All', countries: countries.map((country, i) => ({ _key: `c${i}`, country })) }];
    s.methods = [{ _key: 'post', zone: 'all', name: 'Post', price: { minor: 500 } }];
  });
  extra(root);
  return root;
}
const abroadFrom = async (t, root, to) => {
  const shop = await serving(t, root);
  return Object.fromEntries(await Promise.all(to.map(async (country) => [country, (await ship(shop, [foxS], country)).body.abroad])));
};

test('abroad is a country outside the business\'s customs area: Switzerland with Liechtenstein, the union with Monaco and San Marino, any other its own', async (t) => {
  const others = ['CH', 'LI', 'GB', 'NO', 'US', 'TR'];
  const from = async (home) => abroadFrom(t, sendingTo([home, ...EU, ...others].filter((c, i, all) => all.indexOf(c) === i)), [...EU, ...others]);
  const ch = await from('CH');
  assert.deepEqual(Object.keys(ch).filter((c) => ch[c]), [...EU, 'GB', 'NO', 'US', 'TR'], 'from Switzerland: all 29 of the union, and every other country, but not Liechtenstein');
  assert.deepEqual([ch.CH, ch.LI], [false, false]);
  const li = await from('LI');
  assert.deepEqual(Object.keys(li).filter((c) => !li[c]), ['CH', 'LI'], 'from Liechtenstein: the same area');
  const de = await from('DE');
  assert.deepEqual(Object.keys(de).filter((c) => !de[c]), EU, 'from Germany: the 27, Monaco and San Marino are one area');
  const mc = await from('MC');
  assert.deepEqual(Object.keys(mc).filter((c) => !mc[c]), EU, 'from Monaco: the same');
  const gb = await from('GB');
  assert.deepEqual(Object.keys(gb).filter((c) => !gb[c]), ['GB'], 'from the United Kingdom: its own');
});

test('the business\'s country is the shared field whose role is country, else the first zone\'s first country', async (t) => {
  // Without one: the first zone's first country, CH — Germany is abroad.
  assert.equal((await abroadFrom(t, shopSite(), ['DE'])).DE, true);
  // With a shared field that says DE, Germany is home and Switzerland abroad.
  const root = shopSite({
    ...golden,
    locales: ['en'],
    blocks: [...golden.blocks, { type: 'contacts', v: 1, label: 'Contacts', fields: [{ key: 'country', label: 'Country', kind: 'text', role: 'country' }] }],
    shared: ['contacts'],
  });
  writeFileSync(join(root, 'jtk', 'shared.json'), JSON.stringify({ blocks: [{ _key: 'contacts', type: 'contacts', v: 1, country: 'de' }] }));
  assert.deepEqual(await abroadFrom(t, root, ['DE', 'CH']), { DE: false, CH: true });
  // A shared country that is not a country is not one.
  writeFileSync(join(root, 'jtk', 'shared.json'), JSON.stringify({ blocks: [{ _key: 'contacts', type: 'contacts', v: 1, country: 'Germany' }] }));
  assert.deepEqual(await abroadFrom(t, root, ['DE', 'CH']), { DE: true, CH: false });
});

// ── the methods, priced as the platform prices them ───────────────────────

/** Settings with one zone of CH and DE, and these methods. */
function methodsOf(...methods) {
  const root = shopSite();
  settings(root, (s) => {
    s.zones = [{ _key: 'home', name: 'Home', countries: [{ _key: 'a', country: 'CH' }, { _key: 'b', country: 'DE' }] }];
    s.methods = methods.map((m) => ({ zone: 'home', name: m._key, ...m }));
  });
  return root;
}
const priceOf = async (t, root, lines = [foxS], country = 'CH') => {
  const answer = await ship(await serving(t, root), lines, country);
  return { methods: names(answer), cannot_send: answer.body.cannot_send, sends: answer.body.sends };
};
const band = (cls, up_to, minor) => ({ _key: `${cls}${up_to}`, class: cls, up_to, price: { minor } });

test('a method is a flat price, or bands by size class and weight; the first band that carries the parcel is the price', async (t) => {
  const root = methodsOf(
    { _key: 'flat', price: { minor: 700 } },
    { _key: 'banded', bands: [band('parcel', 300, 400), band('parcel', 400, 600), band('parcel', 5000, 1500)] },
  );
  // 360 g: up to 400 g, the second band; the weight is the variants' times the quantities.
  assert.deepEqual((await priceOf(t, root)).methods, [['flat', 700, false], ['banded', 600, false]]);
  // 5 × 190 g = 950 g, the third.
  assert.deepEqual((await priceOf(t, root, [line(FOX, 'v2', 5)])).methods, [['flat', 700, false], ['banded', 1500, false]]);
  // A parcel heavier than every band is carried by the flat method alone.
  const heavy = await priceOf(t, root, [line(FOX, 'v2', 30)]);
  assert.deepEqual(heavy.methods, [['flat', 700, false]]);
  // Exactly up to a band's weight is that band (6 × 50 g would be; here 2 × 150 g with the weight set).
  product(root, 't-shirt-fox', (fields) => (fields.variants[0].weight = 200));
  assert.deepEqual((await priceOf(t, root, [foxS])).methods, [['flat', 700, false], ['banded', 600, false]], '400 g is up to 400 g');
});

test('free above is from the amount, and covers a bulky parcel only where the method says so', async (t) => {
  const root = methodsOf({ _key: 'post', price: { minor: 700 }, free_above: { minor: 5980 } });
  assert.deepEqual((await priceOf(t, root)).methods, [['post', 0, true]], '5980 is the amount: from it, free');
  assert.deepEqual((await priceOf(t, root, [foxS, line(FOX, 'v1', 0)])).methods, [], 'a cart with a refused line is offered none');
  assert.deepEqual((await priceOf(t, root, [line(FOX, 'v1', 1)])).methods, [['post', 700, false]]);
  product(root, 't-shirt-fox', (fields) => (fields.size_class = 'bulky'));
  assert.deepEqual((await priceOf(t, root)).methods, [['post', 700, false]], 'bulky goods are not free');
  settings(root, (s) => (s.methods[0].free_bulky = true));
  assert.deepEqual((await priceOf(t, root)).methods, [['post', 0, true]]);
});

test('a letter goes as a parcel where its letter bands do not carry it; a parcel never goes as a letter, and bulky as nothing else', async (t) => {
  const root = methodsOf({ _key: 'banded', bands: [band('parcel', 5000, 800), band('letter', 100, 200)] });
  product(root, 'kerzenstaender', (fields) => (fields.size_class = 'letter'));
  product(root, 't-shirt-fox', (fields) => {
    fields.size_class = 'letter';
    fields.variants[0].weight = 45;
  });
  // 450 g of letter is past the letter band's 100 g, so it goes as a parcel; 90 g is a letter.
  assert.deepEqual((await priceOf(t, root, [line(CANDLE, 'v1', 1)])).methods, [['banded', 800, false]]);
  assert.deepEqual((await priceOf(t, root, [foxS])).methods, [['banded', 200, false]]);
  // A parcel is not a letter: with letter bands alone nobody carries it.
  const letters = methodsOf({ _key: 'letters', bands: [band('letter', 5000, 200)] });
  assert.deepEqual(await priceOf(t, letters, [line(BAG, 'v1', 1, { body: 'natur' })]), { methods: [], cannot_send: true, sends: true });
  // A letter goes as a parcel where the method has no letter band at all, and bulky is carried by bulky bands alone.
  const parcels = methodsOf({ _key: 'parcels', bands: [band('parcel', 5000, 900)] });
  product(parcels, 'kerzenstaender', (fields) => (fields.size_class = 'letter'));
  assert.deepEqual((await priceOf(t, parcels, [line(CANDLE, 'v1', 1)])).methods, [['parcels', 900, false]]);
  product(parcels, 'kerzenstaender', (fields) => (fields.size_class = 'bulky'));
  assert.deepEqual(await priceOf(t, parcels, [line(CANDLE, 'v1', 1)]), { methods: [], cannot_send: true, sends: true });
  // The largest class in the cart is the parcel's.
  assert.deepEqual((await priceOf(t, parcels, [line(FOX, 'v1', 1), line(CANDLE, 'v1', 1)])).cannot_send, true);
});

test('a country the business sends to by no method that carries the parcel cannot be sent to — the pick-up still is offered', async (t) => {
  const root = methodsOf({ _key: 'banded', bands: [band('parcel', 100, 800)] }, { _key: 'pickup', pickup: true });
  assert.deepEqual(await priceOf(t, root), { methods: [['pickup', 0, false]], cannot_send: true, sends: true });
  // The shop kit as `jtk add shop` lays it: a post with no price yet, and a pick-up.
  const kit = methodsOf({ _key: 'post', name: 'Post' }, { _key: 'pickup', pickup: true });
  assert.deepEqual(await priceOf(t, kit), { methods: [['pickup', 0, false]], cannot_send: true, sends: true });
});

test('what the judge would refuse is left out whole, and never priced by guess', async (t) => {
  // An empty cart weighs nothing, so any band that holds carries it: a method that is offered is one that was read.
  const left = async (method) => (await priceOf(t, methodsOf({ _key: 'bad', ...method }, { _key: 'pickup', pickup: true }), [])).methods.map(([key]) => key);
  const rising = [band('parcel', 100, 100), band('parcel', 200, 200)];
  assert.deepEqual(await left({ price: { minor: 500 } }), ['bad', 'pickup'], 'the control: a flat price');
  assert.deepEqual(await left({ bands: rising }), ['bad', 'pickup'], 'the control: bands');
  assert.deepEqual(await left({ price: { minor: 500 }, name: '' }), ['pickup'], 'no name');
  assert.deepEqual(await left({ price: { minor: 500 }, name: 'x'.repeat(61) }), ['pickup'], 'a name of more than 60 characters');
  assert.deepEqual(await left({ price: { minor: 500 }, name: 'two\nlines' }), ['pickup'], 'a name of two lines');
  assert.deepEqual(await left({ price: { minor: 500 }, name: '🦊'.repeat(60) }), ['bad', 'pickup'], '60 characters, counted as characters');
  assert.deepEqual(await left({ price: { minor: 500 }, zone: 'nowhere' }), ['pickup'], 'a zone that is none');
  assert.deepEqual(await left({ price: { minor: 5.5 } }), ['pickup'], 'a price that is a fraction');
  assert.deepEqual(await left({ price: { minor: 500 }, free_above: 'much' }), ['pickup'], 'a free-above that is no amount');
  assert.deepEqual(await left({ price: { minor: 500 }, bands: rising }), ['pickup'], 'both a price and bands');
  assert.deepEqual(await left({ bands: [band('parcel', 5000, 100), band('parcel', 5000, 200)] }), ['pickup'], 'bands that do not rise');
  assert.deepEqual(await left({ bands: [band('parcel', 5000, 100), band('parcel', 4000, 200)] }), ['pickup'], 'bands that fall');
  assert.deepEqual(await left({ bands: [band('parcel', 100, 100), band('letter', 100, 200)] }), ['bad', 'pickup'], 'a class rises by its own: the letter\'s first band is the letter\'s');
  assert.deepEqual(await left({ bands: [{ _key: 'b', class: 'parcel', up_to: 0, price: { minor: 1 } }] }), ['pickup'], 'a band up to nothing');
  assert.deepEqual(await left({ bands: [{ _key: 'b', class: 'parcel', up_to: 5000 }] }), ['pickup'], 'a band with no price');
  assert.deepEqual(await left({ bands: [{ _key: 'b', class: 'parcel', up_to: 5000, price: 'free' }] }), ['pickup'], 'a band with a price that is no amount');
  assert.deepEqual(await left({ bands: [{ _key: 'b', class: 'parcel', up_to: 5000.5, price: { minor: 1 } }] }), ['pickup'], 'a band up to a fraction of a gram');
  assert.deepEqual(await left({ bands: [...rising, 'x'] }), ['pickup'], 'a band that is no object');
  // A pick-up sends nothing: a price, bands or a free-above on one refuses it.
  const pickup = async (extra) => (await priceOf(t, methodsOf({ _key: 'pickup', pickup: true, ...extra }))).methods;
  assert.deepEqual(await pickup({}), [['pickup', 0, false]]);
  assert.deepEqual(await pickup({ price: { minor: 100 } }), []);
  assert.deepEqual(await pickup({ free_above: { minor: 100 } }), []);
  assert.deepEqual(await pickup({ bands: [band('parcel', 100, 100)] }), []);
  // Rows that are no objects, and a country that is not two capital letters, are not read.
  const odd = methodsOf({ _key: 'post', price: { minor: 500 } });
  settings(odd, (s) => {
    s.zones = [{ _key: 'home', name: 'Home', countries: [{ _key: 'x', country: 'ch' }, { _key: 'y', country: 'CHE' }, 'DE', { _key: 'z', country: 'FR' }] }];
    s.methods.unshift('nonsense');
  });
  assert.deepEqual(await priceOf(t, odd, [foxS], 'CH'), { methods: [], cannot_send: false, sends: false });
  assert.deepEqual(await priceOf(t, odd, [foxS], 'DE'), { methods: [], cannot_send: false, sends: false });
  assert.deepEqual(await priceOf(t, odd, [foxS], 'FR'), { methods: [['post', 500, false]], cannot_send: false, sends: true });
});

test('a country in two zones is in neither: its buyers are offered the pick-ups alone', async (t) => {
  const root = methodsOf({ _key: 'post', price: { minor: 500 } }, { _key: 'pickup', pickup: true });
  settings(root, (s) => {
    s.zones.push({ _key: 'other', name: 'Other', countries: [{ _key: 'z', country: 'DE' }] });
    s.methods.push({ _key: 'other-post', zone: 'other', name: 'Other', price: { minor: 900 } });
  });
  assert.deepEqual(await priceOf(t, root, [foxS], 'DE'), { methods: [['pickup', 0, false]], cannot_send: false, sends: false });
  assert.deepEqual((await priceOf(t, root, [foxS], 'CH')).methods, [['post', 500, false], ['pickup', 0, false]]);
});

// ── the checkout ──────────────────────────────────────────────────────────

/** The body of a checkout the page would send for the fox twice, to Switzerland, by the economy post. */
const checkout = (extra = {}) => ({
  lines: [foxS],
  country: 'CH',
  method: 'economy',
  buyer,
  address,
  total: 6880,
  attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9d24',
  return: '/order',
  ...extra,
});
const go = (shop, extra) => shop.post('/api/checkout', checkout(extra));
const tokenOf = (answer) => answer.body.order;
const pageOf = (shop, token) => shop.call(`/api/order?token=${encodeURIComponent(token)}`);

test('a total other than the one the shop prices is refused 409 total, with the quote, and nothing is written', async (t) => {
  const shop = await serving(t, shopSite());
  const answer = await go(shop, { total: 5000 });
  assert.equal(answer.status, 409);
  assert.equal(answer.body.error, 'total');
  assert.deepEqual([answer.body.quote.subtotal, names({ body: answer.body.quote })], [5980, [['economy', 900, false], ['pickup', 0, false]]]);
  // The same press, right this time: an order, the first — the refusal wrote none.
  const right = await go(shop);
  assert.equal(right.status, 201);
  assert.equal((await pageOf(shop, tokenOf(right))).body.state, 'waiting');
});

test('the buyer is checked: the paths that are wrong, in the wire\'s order, and a pick-up asks no address', async (t) => {
  const shop = await serving(t, shopSite());
  const bad = async (extra) => {
    const answer = await go(shop, extra);
    assert.equal(answer.status, 400, JSON.stringify(answer.body));
    assert.equal(answer.body.error, 'buyer');
    return answer.body.fields;
  };
  assert.deepEqual(await bad({ buyer: { ...buyer, email: '' } }), ['buyer.email']);
  assert.deepEqual(await bad({ buyer: { name: '', email: 'ada', phone: 'call me' }, address: { line1: '', postal_code: '', city: '' } }), ['buyer.name', 'buyer.email', 'buyer.phone', 'address.line1', 'address.postal_code', 'address.city']);
  assert.deepEqual(await bad({ address: undefined }), ['address.line1', 'address.postal_code', 'address.city']);
  assert.deepEqual(await bad({ address: { ...address, line1: 'x'.repeat(201), line2: 'y'.repeat(201), postal_code: 'z'.repeat(21), city: 'c'.repeat(101) } }), ['address.line1', 'address.line2', 'address.postal_code', 'address.city']);
  assert.deepEqual(await bad({ buyer: { ...buyer, name: 'Ada\nLovelace' } }), ['buyer.name']);
  assert.deepEqual(await bad({ buyer: { ...buyer, name: 'x'.repeat(121) } }), ['buyer.name']);
  for (const email of ['ada@example', 'ada@@example.ch', 'ada example@x.ch', '@example.ch', 'ada@.ch', 'ada@example.', 'Ada <ada@example.ch>', 'a..b@example.ch', `${'a'.repeat(250)}@x.ch`]) {
    assert.deepEqual(await bad({ buyer: { ...buyer, email } }), ['buyer.email'], email);
  }
  assert.deepEqual(await bad({ buyer: { ...buyer, phone: 'x'.repeat(41) } }), ['buyer.phone']);
  // What is taken: any script, an address as typed, no phone, a phone with its signs.
  for (const [i, who] of [
    { name: 'Zoë', email: 'zoë@exämple.ch' },
    { name: 'Покупатель', email: 'покупатель@пример.рф' },
    { name: 'Ada', email: 'ada+shop@example.co.uk', phone: '(044) 123-45 67' },
  ].entries()) {
    assert.equal((await go(shop, { buyer: who, attempt: `0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9d3${i}` })).status, 201, who.email);
  }
  // A pick-up asks no address, and one sent with it is not judged.
  const pickup = await go(shop, { method: 'pickup', address: undefined, total: 5980, attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9d40' });
  assert.equal(pickup.status, 201);
  assert.equal((await go(shop, { method: 'pickup', address: { line1: '' }, total: 5980, attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9d41' })).status, 201);
  assert.deepEqual(await bad({ method: 'pickup', total: 5980, buyer: { ...buyer, email: '' }, attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9d42' }), ['buyer.email']);
});

test('a good checkout is 201 with the order and this server\'s pay page; the same press again is the same order', async (t) => {
  const shop = await serving(t, shopSite());
  const first = await go(shop);
  assert.equal(first.status, 201);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Object.keys(first.body), ['order', 'url', 'expires_at']);
  assert.match(first.body.order, /^[A-Za-z0-9_-]{32}$/, 'an order\'s token, as the platform makes it');
  assert.equal(first.body.url, `${shop.origin}/api/dev-pay?order=${first.body.order}`);
  assert.ok(new Date(first.body.expires_at) > new Date());
  const again = await go(shop);
  assert.deepEqual([again.status, again.body.order, again.body.url], [201, first.body.order, first.body.url]);
  // Whatever else the body says now: the lost answer asked for again is the order it was, to its own buyer in any case.
  const changed = await go(shop, { total: 1, lines: [], buyer: { ...buyer, email: 'ADA@example.ch' } });
  assert.deepEqual([changed.status, changed.body.order], [201, first.body.order]);
  // Another buyer's press with that token is refused, with nothing written.
  const theirs = await go(shop, { buyer: { ...buyer, email: 'grace@example.ch' } });
  assert.deepEqual([theirs.status, theirs.body], [409, { error: 'attempt' }]);
  // A press with no attempt is a new order every time; an attempt of any other shape is a sentence.
  const a = await go(shop, { attempt: undefined });
  const b = await go(shop, { attempt: undefined });
  assert.notEqual(a.body.order, b.body.order);
  for (const attempt of ['short', 'x'.repeat(129), 'with spaces in it, too long', 'ünïcödé-attempt-token-1']) {
    const refused = await go(shop, { attempt });
    assert.equal(refused.status, 400, attempt);
    assert.match(refused.body, /16 to 128/);
  }
});

test('what the cart or the method got wrong is refused with the quote as it is now', async (t) => {
  const root = shopSite();
  product(root, 't-shirt-fox', (fields) => (fields.variants[0].on_sale = false));
  const shop = await serving(t, root);
  const refused = await go(shop);
  assert.deepEqual([refused.status, refused.body.error, refused.body.quote.refused.map((r) => r.code)], [409, 'refused', ['off_sale']]);
  const method = await go(shop, { lines: [line(FOX, 'v2', 1)], method: 'eu-post', total: 3890 });
  assert.deepEqual([method.status, method.body.error, names({ body: method.body.quote })], [409, 'method', [['economy', 900, false], ['pickup', 0, false]]]);
  const none = await go(shop, { lines: [line(FOX, 'v2', 1)], method: '', total: 2990 });
  assert.equal(none.body.error, 'method');
  const nothing = await go(shop, { lines: [], method: 'pickup', total: 0 });
  assert.deepEqual([nothing.status, nothing.body], [400, { error: 'nothing_to_pay' }]);
});

test('a sold-out SKU the walk named stops the checkout 409 short, and nothing is written for it', async (t) => {
  const shop = await serving(t, shopSite(), { soldOut: ['FOX-S-RED'] });
  assert.equal((await ship(shop, [foxS])).body.refused.length, 0, 'the cart prices it: only the checkout finds it short');
  const answer = await go(shop);
  assert.equal(answer.status, 409);
  assert.deepEqual(answer.body.short, [{ sku: 'FOX-S-RED', wanted: 2, available: 0 }]);
  assert.equal(answer.body.error, 'short');
  assert.equal(answer.body.quote.subtotal, 5980);
  const other = await go(shop, { lines: [line(FOX, 'v2', 1), line(FOX, 'v2', 2)], total: 8970 + 900 });
  assert.equal(other.status, 201, 'another SKU is in stock');
});

test('a site with no currency sells nothing', async (t) => {
  const root = shopSite();
  writeFileSync(join(root, 'jtk', 'site.json'), '{}');
  const shop = await serving(t, root);
  const answer = await go(shop);
  assert.equal(answer.status, 409);
  assert.match(answer.body, /no currency/);
});

test('a second ask with the order alone answers the same pay page; an order that is nobody\'s is not found', async (t) => {
  const shop = await serving(t, shopSite());
  const first = await go(shop);
  const second = await shop.post('/api/checkout', { order: first.body.order });
  assert.deepEqual([second.status, second.body.order, second.body.url], [201, first.body.order, first.body.url]);
  assert.deepEqual(await shop.post('/api/checkout', { order: 'nobody' }).then((a) => [a.status, a.body]), [404, { error: 'not_found', order: 'nobody' }]);
  await shop.call(`/api/dev-pay?order=${first.body.order}&do=pay`, { method: 'POST' });
  assert.deepEqual(await shop.post('/api/checkout', { order: first.body.order }).then((a) => [a.status, a.body]), [409, { error: 'paid', order: first.body.order }]);
  assert.deepEqual(await go(shop).then((a) => [a.status, a.body]), [409, { error: 'paid', order: first.body.order }], 'a press whose order is paid is told so');
});

test('the order after it: waiting with its pay page, paid with its number from 1001, and never the buyer', async (t) => {
  const shop = await serving(t, shopSite());
  const made = await go(shop, { locale: 'en' });
  const waiting = await pageOf(shop, tokenOf(made));
  assert.equal(waiting.status, 200);
  assert.equal(waiting.headers.get('cache-control'), 'no-store');
  assert.deepEqual(waiting.body, {
    state: 'waiting',
    lines: [{ line: 0, product: FOX, variant: 'v1', sku: 'FOX-S-RED', title: 'Fox T-shirt', labels: ['S', 'Red'], answers: [], unit: 2990, qty: 2, total: 5980 }],
    subtotal: 5980,
    shipping: 900,
    total: 6880,
    currency: 'chf',
    method: 'PostPac Economy',
    pickup: false,
    pay_url: made.body.url,
  });
  assert.ok(!JSON.stringify(waiting.body).includes('Lovelace') && !JSON.stringify(waiting.body).includes('Bahnhof'));

  // Pay: a 303 to the return, with the order's token on it.
  const pay = await shop.call(`/api/dev-pay?order=${tokenOf(made)}&do=pay`, { method: 'POST' });
  assert.equal(pay.status, 303);
  assert.equal(pay.headers.get('location'), `/order?order=${tokenOf(made)}`);
  const paid = await pageOf(shop, tokenOf(made));
  assert.deepEqual([paid.body.state, paid.body.number, 'pay_url' in paid.body, paid.body.lines[0].title], ['paid', 1001, false, 'Fox T-shirt'], 'the lines as they were frozen, in the language the order was taken in');
  // Paying again is the same order, paid once.
  await shop.call(`/api/dev-pay?order=${tokenOf(made)}&do=pay`, { method: 'POST' });
  assert.equal((await pageOf(shop, tokenOf(made))).body.number, 1001);

  // Another order: leaving the page is a 303 with left=1, and the order waits still.
  const other = await go(shop, { attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9d99', method: 'pickup', total: 5980, address: undefined });
  const left = await shop.call(`/api/dev-pay?order=${tokenOf(other)}&do=leave`, { method: 'POST' });
  assert.equal(left.status, 303);
  assert.equal(left.headers.get('location'), `/order?order=${tokenOf(other)}&left=1`);
  const stillWaiting = await pageOf(shop, tokenOf(other));
  assert.deepEqual([stillWaiting.body.state, stillWaiting.body.pay_url, 'number' in stillWaiting.body, stillWaiting.body.pickup, stillWaiting.body.shipping, stillWaiting.body.lines[0].title], ['waiting', other.body.url, false, true, 0, 'T-shirt «Fox»']);
  // And paid after all, it takes the next number.
  await shop.call(`/api/dev-pay?order=${tokenOf(other)}&do=pay`, { method: 'POST' });
  assert.equal((await pageOf(shop, tokenOf(other))).body.number, 1002);

  // A token nobody has.
  const nobody = await pageOf(shop, 'nobody');
  assert.deepEqual([nobody.status, nobody.body], [404, { error: 'not_found' }]);
  assert.equal((await shop.call('/api/order')).status, 404);
});

test('the pay page says in the site\'s language that nothing is charged, and offers Pay and Leave', async (t) => {
  const shop = await serving(t, shopSite());
  const made = await go(shop);
  const page = await shop.call(`/api/dev-pay?order=${made.body.order}`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.text, /<html lang="de">/, 'the site\'s own language');
  assert.ok(page.text.includes(DEV_PAY_WORDS.de.note), 'the sentence');
  assert.ok(page.text.includes(money(6880, 'CHF', 'de')), 'what the order comes to');
  const forms = [...page.text.matchAll(/<form method="post" action="([^"]+)"><button[^>]*>([^<]+)<\/button><\/form>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(forms, [
    [`/api/dev-pay?order=${made.body.order}&amp;do=pay`, shopWordsFor('de').pay],
    [`/api/dev-pay?order=${made.body.order}&amp;do=leave`, DEV_PAY_WORDS.de.leave],
  ]);
  assert.ok(!page.text.includes('<script'), 'a page that needs no script');
  // A token nobody has is a sentence, and a paid order goes straight back to its return.
  assert.equal((await shop.call('/api/dev-pay?order=nobody')).status, 404);
  assert.equal((await shop.call('/api/dev-pay')).status, 404);
  await shop.call(`/api/dev-pay?order=${made.body.order}&do=pay`, { method: 'POST' });
  const back = await shop.call(`/api/dev-pay?order=${made.body.order}`);
  assert.deepEqual([back.status, back.headers.get('location')], [303, `/order?order=${made.body.order}`]);
  assert.equal((await shop.call(`/api/dev-pay?order=${made.body.order}&do=leave`, { method: 'POST' })).headers.get('location'), `/order?order=${made.body.order}`, 'a paid order was not left');
  // An action that is neither is a sentence.
  const other = await go(shop, { attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9daa' });
  assert.equal((await shop.call(`/api/dev-pay?order=${other.body.order}&do=refund`, { method: 'POST' })).status, 400);
  assert.equal((await shop.call(`/api/dev-pay?order=nobody&do=pay`, { method: 'POST' })).status, 404);
});

test('the pay page and the words it says are in every language the storefront has', () => {
  assert.deepEqual(Object.keys(DEV_PAY_WORDS).sort(), [...SHOP_LOCALES].sort());
  for (const [locale, words] of Object.entries(DEV_PAY_WORDS)) {
    assert.deepEqual(Object.keys(words).sort(), ['leave', 'note'], locale);
    assert.ok(words.note.trim() !== '' && words.leave.trim() !== '', locale);
    assert.notEqual(shopWordsFor(locale).pay, undefined);
  }
});

test('a return is a path on this host, as the edge makes it: an address the page names is only its path', async (t) => {
  const shop = await serving(t, shopSite());
  const to = async (path, n) => {
    const made = await go(shop, { return: path, attempt: `0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9e${n}` });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const pay = await shop.call(`/api/dev-pay?order=${made.body.order}&do=pay`, { method: 'POST' });
    return pay.headers.get('location').replace(made.body.order, 'T');
  };
  assert.equal(await to('/thanks', 10), '/thanks?order=T');
  assert.equal(await to('/en/thanks/?utm=1#top', 11), '/en/thanks/?utm=1&order=T#top');
  assert.equal(await to('https://elsewhere.example/p/fox/thanks', 12), '/p/fox/thanks?order=T', 'the host is ours whatever the page says');
  assert.equal(await to('thanks', 13), '/thanks?order=T', 'what is no path is read from the root');
  assert.equal(await to(undefined, 14), '/?order=T', 'none is the root');
  const long = await go(shop, { return: `/${'x'.repeat(2048)}`, attempt: '0193a5c4-2f6e-7c81-b3d0-8e1f5a7c9e20' });
  assert.deepEqual([long.status, long.body], [400, { error: 'return' }]);
});

test('files are read fresh on every request: a price changed in an entry is the next answer\'s', async (t) => {
  const root = shopSite();
  const shop = await serving(t, root);
  assert.equal((await ship(shop, [foxS])).body.subtotal, 5980);
  product(root, 't-shirt-fox', (fields) => fields.variants.forEach((v) => (v.price = { minor: 3000 })));
  assert.equal((await ship(shop, [foxS])).body.subtotal, 6000);
  settings(root, (s) => {
    delete s.methods[0].bands;
    s.methods[0].price = { minor: 100 };
  });
  assert.deepEqual(names(await ship(shop, [foxS])), [['economy', 100, false], ['pickup', 0, false]]);
});
