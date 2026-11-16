import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT, CART, CHECKOUT } from '../lib/shop/hooks.mjs';

// The hooks are the whole contract between a storefront piece's markup and its
// element (`@jtakeit/kit/shop/hooks`): what an agent keeps when it copies the
// scaffold's component and dresses it in a design of its own. The component
// `jtk add shop` lays carries every one, and the elements find nothing by a
// class, as the booking form's do (hooks.test.mjs).

const here = import.meta.dirname;
const component = (path) => readFileSync(join(here, '../../example/files/src/components/shop', path), 'utf8');

/**
 * How a hook is written in a component's source: `data-x`; `name="x"`; a
 * name with a key after its prefix, `name={`x:${…}`}`.
 */
function written(hook) {
  const name = /^\[name=([a-z0-9_]+)\]$/.exec(hook);
  if (name) return new RegExp(`\\sname="${name[1]}"`);
  const prefix = /^\[name\^="([a-z]+:)"\]$/.exec(hook);
  if (prefix) return new RegExp(`\\sname=(?:"${prefix[1]}|\\{\`${prefix[1]}\\$\\{)`);
  const data = /\[(data-[a-z-]+)\]$/.exec(hook);
  assert.ok(data, `a hook is a data attribute or a name: ${hook}`);
  return new RegExp(`\\s${data[1]}[\\s=>{]`);
}

test('the copied product carries every hook, imports the element and no stylesheet of the kit', () => {
  const astro = component('Product.astro');
  for (const one of [...PRODUCT.always, ...PRODUCT.said]) assert.match(astro, written(one.hook), `${one.hook} — ${one.says}`);
  // The form's own: what the element reads off it.
  const form = /<form\b[^>]*>/.exec(astro)?.[0] ?? '';
  for (const attribute of ['data-product', 'data-api', 'data-locale', 'data-facts', 'data-words', 'data-jtk-fixed', 'novalidate']) {
    assert.match(form, new RegExp(`\\s${attribute}[\\s=>]`), `the form says ${attribute}`);
  }
  assert.match(astro, /<jtk-product\b/, 'the form is inside <jtk-product>');
  assert.match(astro, /<script>\s*import '@jtakeit\/kit\/elements\/shop-product';\s*<\/script>/, 'and the element that makes it work');
  assert.match(astro, /<noscript>/, 'a sentence for a browser with no script');
  assert.match(astro, /<style>/, 'its own look');
  assert.doesNotMatch(astro, /@jtakeit\/kit\/[^'"]*\.css/, 'the look is the file\'s own, not the kit\'s');
});

test('the copied cart carries every hook, imports the element and no stylesheet of the kit', () => {
  const astro = component('Cart.astro');
  for (const one of [...CART.always, ...CART.said]) assert.match(astro, written(one.hook), `${one.hook} — ${one.says}`);
  // The root's own: what the element reads off it.
  const root = /<[a-z]+\b[^>]*\sdata-cart[\s>=][^>]*>/.exec(astro)?.[0] ?? '';
  for (const attribute of ['data-cart', 'data-api', 'data-locale', 'data-countries', 'data-words']) {
    assert.match(root, new RegExp(`\\s${attribute}[\\s=>]`), `the cart says ${attribute}`);
  }
  assert.match(astro, /<jtk-cart\b/, 'the cart is inside <jtk-cart>');
  assert.match(astro, /<script>\s*import '@jtakeit\/kit\/elements\/shop-cart';\s*<\/script>/, 'and the element that makes it work');
  assert.match(astro, /<noscript>/, 'a sentence for a browser with no script');
  assert.match(astro, /<style>/, 'its own look');
  assert.doesNotMatch(astro, /@jtakeit\/kit\/[^'"]*\.css/, 'the look is the file\'s own, not the kit\'s');
  // The country is a select, which the build draws from the shop's zones.
  assert.match(astro, /<select\b[^>]*\sname="country"/, 'the country is a select');
});

test('the copied checkout carries every hook, hidden until the cart hands on, imports the element and no stylesheet of the kit', () => {
  const astro = component('Checkout.astro');
  for (const one of [...CHECKOUT.always, ...CHECKOUT.said]) assert.match(astro, written(one.hook), `${one.hook} — ${one.says}`);
  // The form's own: what the element reads off it — and hidden, since the step is shown by the cart's *To checkout*.
  const form = /<form\b[^>]*>/.exec(astro)?.[0] ?? '';
  for (const attribute of ['data-checkout', 'data-api', 'data-locale', 'data-return', 'data-words', 'data-jtk-fixed', 'novalidate', 'hidden']) {
    assert.match(form, new RegExp(`\\s${attribute}[\\s=>]`), `the form says ${attribute}`);
  }
  // The order's page in the page's own language, under the build's base (Ruling 202).
  assert.match(form, /\sdata-return=\{under\(withLocale\(locale, '\/order'\)\)\}/, 'the return is the order page, in the language and under the base');
  assert.match(astro, /<jtk-checkout\b/, 'the form is inside <jtk-checkout>');
  assert.match(astro, /<script>\s*import '@jtakeit\/kit\/elements\/shop-checkout';\s*<\/script>/, 'and the element that makes it work');
  assert.match(astro, /<style>/, 'its own look');
  assert.doesNotMatch(astro, /@jtakeit\/kit\/[^'"]*\.css/, 'the look is the file\'s own, not the kit\'s');
  // What the browser fills in for the buyer, and the buttons a buyer presses: one, Pay, which submits.
  for (const [name, autocomplete] of [['name', 'name'], ['email', 'email'], ['phone', 'tel'], ['line1', 'address-line1'], ['line2', 'address-line2'], ['postal_code', 'postal-code'], ['city', 'address-level2']]) {
    assert.match(astro, new RegExp(`<input\\b[^>]*\\sname="${name}"[^>]*\\sautocomplete="${autocomplete}"`), `${name} is filled in as ${autocomplete}`);
  }
  assert.match(astro, /<button\b[^>]*\stype="submit"[^>]*\sdata-pay/, 'Pay submits the form');
});

test("the shop's elements find nothing by a class alone", () => {
  const files = readdirSync(join(here, '../elements')).filter((one) => /^shop-.*\.js$/.test(one));
  assert.ok(files.includes('shop-product.js') && files.includes('shop-wire.js') && files.includes('shop-cart.js') && files.includes('shop-checkout.js'), `the shop's elements: ${files}`);
  for (const file of files) {
    const source = readFileSync(join(here, '../elements', file), 'utf8');
    for (const [, selector] of source.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*['"`]([^'"`]+)['"`]/g)) {
      // A hook, or an element the element drew itself and marked with a data attribute — never a class.
      assert.doesNotMatch(selector, /\.[a-z_-]/i, `${file}: ${selector}`);
    }
  }
});
