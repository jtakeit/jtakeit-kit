/**
 * `<jtk-product>` — a product's page, made to work: the variant picker over
 * the product's options, what is left of the chosen one, the customizations
 * held to what each asks, and *Add to cart* into the browser's cart.
 *
 * The whole client of the product, and no rule of the shop's: the platform
 * prices every line again at the cart and holds the stock at the checkout, so
 * nothing here is a gate. What the element does is say, at once and in the
 * buyer's language, what the shop would say later.
 *
 *   GET /api/stock?product=<id>   → { products: [{ id, served, variants: [{ key, sku, state, left? }] }] }
 *
 * asked once, when the form is wired (`ask`, shop-wire.js: `X-Jtk-Shop: 1`,
 * never cached). A read that fails says nothing and leaves *Add* on — the
 * checkout holds the stock either way. The form says `data-stock-read="yes"`
 * once the answer is drawn, or `"failed"`, for a walk to wait on.
 *
 * ── how a page gets it ──────────────────────────────────────────────────────
 *
 * Import this module once on the page and every `<form data-product>` is
 * wired: one inside a `<jtk-product>` by the element's own lifecycle, which
 * also covers markup the panel places later (`fl:placed`), and one written
 * bare by `onAlive`. The markup is the site's — the scaffold's
 * `src/components/shop/Product.astro`, copied and dressed — and the element
 * finds everything in it by a `data-*` hook or a control's `name`, never by a
 * class: the list is `@jtakeit/kit/shop/hooks` (`PRODUCT`). A hook left out
 * is said in the console, and the part it stands for does nothing.
 *
 * The form carries the product's facts as `data-facts` (`productFacts`), the
 * words the markup was written in as `data-words` (`shopWordsFor`, which the
 * element reads under them for any the page left out), the page's language
 * as `data-locale` and the site's api base as `data-api`.
 *
 * ── what it does ────────────────────────────────────────────────────────────
 *
 *   - chooses the first value of each option that leads to a variant on sale,
 *     and, once the stock is read and while the buyer has chosen nothing, the
 *     first that leads to one in stock;
 *   - marks each value by `valueStates`: `data-state` on its control, a value
 *     sold out said in words beside it («Sold out»), one no variant on sale
 *     has `disabled` and is said «Not available»;
 *   - says the chosen variant's state in `[data-stock]` — «In stock», «3
 *     left» (a count of FEW or fewer, where the shop tells one), «Sold out» —
 *     and holds `[data-add]` while it cannot be bought;
 *   - writes the chosen variant's price into `[data-price]` and moves the
 *     annotation's `[<key>]` to it, so a tap edits the price that is shown;
 *   - on *Add*, holds the answers to `answersOf`: each fault said beside its
 *     field (`aria-invalid`, `aria-describedby`) and in `[data-product-error]`,
 *     the first faulty field focused; with none, the line added to the cart
 *     (`localStorage["jtk:cart:" + api]`, `addLine`), `[data-added]` shown and
 *     focused, and `jtk:cart` dispatched on the document with the cart's key
 *     as its `detail`.
 */
import { money } from '../lib/money.mjs';
import { shopWordsFor } from '../lib/shop/words.mjs';
import { PRODUCT, lacking } from '../lib/shop/hooks.mjs';
import { answersOf, valueStates, variantFor } from '../lib/shop/product.mjs';
import { MAX_QTY, addLine, cartKey, readCart } from '../lib/shop/cart.mjs';
import { ask } from './shop-wire.js';
import { onAlive } from './alive.js';

export { SHOP_PROTOCOL, ask } from './shop-wire.js';

/** A count the shop tells is said as «3 left» at this or fewer, and as «In stock» above it. */
const FEW = 5;

/** A `_key` the platform's grammar can name, and so the only one an annotation is moved to. */
const KEY = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * The rules the behaviour cannot work without, whatever the site's CSS says:
 * a state shown and hidden by `hidden`, and a ring on whatever has the focus.
 * First in <head>, at the lowest weight, so a site's own rule wins where it
 * says one.
 */
const BASE = `
[data-product] [hidden] { display: none !important; }
:where([data-product] :focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
`;

function putBase() {
  if (document.querySelector('style[data-jtk-product]')) return;
  const style = document.createElement('style');
  style.dataset.jtkProduct = '';
  style.textContent = BASE;
  document.head.prepend(style);
}

let wiredCount = 0;

/** JSON from an attribute, or what is given where it is none. */
function parsed(text, otherwise) {
  try {
    return JSON.parse(text ?? '');
  } catch {
    return otherwise;
  }
}

/**
 * Wires one product's form. Idempotent: a form already wired is left alone.
 * @param {HTMLFormElement} form
 */
export function wireProduct(form) {
  if (form.dataset.jtkWired === '1') return;
  form.dataset.jtkWired = '1';
  putBase();

  /** @type {import('../lib/shop/product.mjs').ProductFacts | null} */
  const facts = parsed(form.dataset.facts, null);
  if (facts === null || !Array.isArray(facts.options) || !Array.isArray(facts.variants) || !Array.isArray(facts.customizations)) {
    console.error('product: its form has no data-facts to work from — the hooks are listed in @jtakeit/kit/shop/hooks');
    return;
  }
  // A product with no option has no picker to lack.
  const missing = lacking(form, PRODUCT).filter((hook) => facts.options.length > 0 || hook !== '[name^="option:"]');
  if (missing.length > 0) console.error(`product: its form has no ${missing.join(', ')}, and cannot work without them — the hooks are listed in @jtakeit/kit/shop/hooks`);

  const locale = form.dataset.locale ?? 'en';
  const api = form.dataset.api ?? '/api/';
  /** @type {Record<string, string>} */
  const words = { ...shopWordsFor(locale), ...parsed(form.dataset.words, {}) };
  const prefix = `jtk-product-${++wiredCount}`;

  /** The controls of one name: a radio group, or the one select, box or text. */
  const controls = (name) => /** @type {any[]} */ ([...form.elements]).filter((one) => one.name === name);
  for (const option of facts.options) {
    if (controls(`option:${option.key}`).length === 0) console.error(`product: its form has no control named option:${option.key}, for the option «${option.name}»`);
  }
  /** What a group of controls says: the radio ticked, a box's tick, a select's or a text's value. */
  const valueIn = (list) => {
    if (list.length === 0) return undefined;
    if (list[0].type === 'radio') return list.find((one) => one.checked)?.value ?? '';
    if (list[0].type === 'checkbox') return list[0].checked;
    return list[0].value;
  };

  /** @type {HTMLElement | null} */ const price = form.querySelector('[data-price]');
  /** @type {HTMLElement | null} */ const stockSaid = form.querySelector('[data-stock]');
  /** @type {HTMLButtonElement | null} */ const add = form.querySelector('[data-add]');
  /** @type {HTMLElement | null} */ const error = form.querySelector('[data-product-error]');
  /** @type {HTMLElement | null} */ const added = form.querySelector('[data-added]');

  // The ARIA the behaviour depends on, whatever the copy kept: what is left is
  // read as it changes, a refusal as it appears, «added» takes the focus.
  if (stockSaid && !stockSaid.hasAttribute('aria-live')) stockSaid.setAttribute('aria-live', 'polite');
  if (error && !error.getAttribute('role')) error.setAttribute('role', 'alert');
  if (added) {
    if (!added.getAttribute('role')) added.setAttribute('role', 'status');
    if (!added.hasAttribute('tabindex')) added.tabIndex = -1;
  }

  // ── what is left ────────────────────────────────────────────────────────
  /** @type {Record<string, 'in_stock' | 'sold_out' | 'off_sale'>} the stock answer's state, by the variant's key */
  const stock = {};
  /** @type {Record<string, number>} the count the shop told, by the variant's key */
  const left = {};
  let read = false;
  let touched = false;

  /** A variant's state: the stock answer's, or what the build says until there is one. */
  const stateOf = (variant) => (Object.hasOwn(stock, variant.key) ? stock[variant.key] : variant.onSale ? 'in_stock' : 'off_sale');

  /** What is chosen now: an option's key to its value's, for every option with one. */
  function chosen() {
    /** @type {Record<string, string>} */
    const picks = {};
    for (const option of facts.options) {
      const value = valueIn(controls(`option:${option.key}`));
      if (typeof value === 'string' && value !== '') picks[option.key] = value;
    }
    return picks;
  }

  /** @param {Record<string, string>} picks */
  function choose(picks) {
    for (const option of facts.options) {
      for (const one of controls(`option:${option.key}`)) {
        if (one.type === 'radio') one.checked = one.value === picks[option.key];
        else one.value = picks[option.key] ?? '';
      }
    }
  }

  /**
   * The first value of each option, in the product's order, that leads to a
   * variant `buys` takes — given the values chosen before it. Nothing where
   * no variant does.
   */
  function firstChoice(buys) {
    /** @type {Record<string, string>} */
    const picks = {};
    for (const option of facts.options) {
      const fits = (variant) => buys(variant) && Object.entries(picks).every(([key, value]) => variant.picks[key] === value);
      const value = option.values.find((one) => facts.variants.some((variant) => fits(variant) && variant.picks[option.key] === one.key));
      if (value === undefined) return undefined;
      picks[option.key] = value.key;
    }
    const variant = variantFor(facts, picks);
    return variant !== undefined && buys(variant) ? picks : undefined;
  }

  /** A value's control marked by its state, and the state said in words beside it. */
  function mark(control, state) {
    control.dataset.state = state;
    control.disabled = state === 'none';
    const said = state === 'sold_out' ? words.soldOut : state === 'none' ? words.notAvailable : '';
    if (control instanceof HTMLOptionElement) {
      // An option holds its words alone: the state is said after them.
      if (control.dataset.label === undefined) control.dataset.label = control.textContent ?? '';
      control.textContent = said === '' ? control.dataset.label : `${control.dataset.label} — ${said}`;
      return;
    }
    const label = control.labels?.[0];
    if (!label) return;
    /** @type {HTMLElement | null} */
    let note = label.querySelector('[data-value-state]');
    if (note === null) {
      if (said === '') return;
      note = document.createElement('span');
      note.dataset.valueState = '';
      // A space before it, so the value's name reads «M Sold out» and not «MSold out».
      label.append(' ', note);
    }
    note.textContent = said;
    note.hidden = said === '';
  }

  function render() {
    const picks = chosen();
    const states = valueStates(facts, stock, picks);
    for (const option of facts.options) {
      for (const one of controls(`option:${option.key}`)) {
        if (one instanceof HTMLSelectElement) {
          for (const item of one.options) if (item.value !== '') mark(item, states[option.key]?.[item.value] ?? 'none');
        } else {
          mark(one, states[option.key]?.[one.value] ?? 'none');
        }
      }
    }

    const complete = facts.options.every((option) => picks[option.key] !== undefined);
    const variant = complete ? variantFor(facts, picks) : undefined;
    const state = variant === undefined ? undefined : stateOf(variant);

    if (price && variant?.price !== undefined) {
      price.textContent = money(variant.price, facts.currency, locale);
      const at = price.getAttribute('data-jtk-path');
      if (at && KEY.test(variant.key)) price.setAttribute('data-jtk-path', at.replace(/\[[^\]]*\](?=[^[]*$)/, `[${variant.key}]`));
    }

    let said = '';
    if (!complete) {
      const any = facts.variants.map(stateOf);
      said = any.includes('in_stock') ? words.chooseEach : any.includes('sold_out') ? words.soldOut : words.notAvailable;
    } else if (state === undefined) said = words.notAvailable;
    else if (state === 'sold_out') said = words.soldOut;
    else if (state !== 'in_stock') said = words.notAvailable;
    else if (read) {
      const count = left[/** @type {any} */ (variant).key];
      said = count !== undefined && count <= FEW ? words.left.replace('{n}', String(count)) : words.inStock;
    }
    if (stockSaid) {
      stockSaid.textContent = said;
      stockSaid.dataset.state = state ?? 'none';
    }
    if (add) add.disabled = state !== 'in_stock';
  }

  // ── what is wrong ───────────────────────────────────────────────────────
  /** @type {{ field: HTMLElement; note: HTMLElement }[]} */
  let blamed = [];
  function unblame(field) {
    for (const one of blamed.filter((each) => field === undefined || each.field === field)) {
      one.field.removeAttribute('aria-invalid');
      const rest = (one.field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== one.note.id);
      if (rest.length > 0) one.field.setAttribute('aria-describedby', rest.join(' '));
      else one.field.removeAttribute('aria-describedby');
      one.note.remove();
    }
    blamed = field === undefined ? [] : blamed.filter((each) => each.field !== field);
    if (blamed.length === 0 && error) {
      error.textContent = '';
      error.hidden = true;
    }
  }
  /** A fault said beside its field, and the field described by it. */
  function blame(field, text) {
    const note = document.createElement('span');
    note.dataset.fault = '';
    note.id = `${prefix}-fault-${blamed.length + 1}`;
    note.textContent = text;
    field.insertAdjacentElement('afterend', note);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
    blamed.push({ field, note });
  }

  /** How many, as a whole number of 1 to 999 — written back where the field said another. */
  function quantity() {
    const [field] = controls('qty');
    const n = Math.trunc(Number(field?.value));
    const qty = Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_QTY) : 1;
    if (field && field.value !== String(qty)) field.value = String(qty);
    return qty;
  }

  form.addEventListener('change', (event) => {
    const name = /** @type {any} */ (event.target)?.name;
    if (typeof name !== 'string') return;
    if (added) added.hidden = true;
    if (name.startsWith('option:')) {
      touched = true;
      render();
    } else if (blamed.some((one) => one.field === event.target)) {
      unblame(/** @type {HTMLElement} */ (event.target));
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    unblame(undefined);
    if (added) added.hidden = true;
    const variant = variantFor(facts, chosen());
    if (variant === undefined || stateOf(variant) !== 'in_stock') {
      render();
      return;
    }
    /** @type {Record<string, string | boolean>} */
    const given = {};
    for (const one of facts.customizations) {
      const value = valueIn(controls(`answer:${one.key}`));
      if (value !== undefined) given[one.key] = value;
    }
    const { answers, faults } = answersOf(facts, given);
    if (faults.length > 0) {
      const lines = [];
      for (const fault of faults) {
        const one = facts.customizations.find((each) => each.key === fault.key);
        const text = (words[`fault.${fault.word}`] ?? '').replace('{max}', String(one?.max ?? ''));
        const [field] = controls(`answer:${fault.key}`);
        if (field) blame(field, text);
        lines.push(one?.name ? `${one.name}: ${text}` : text);
      }
      if (error) {
        error.textContent = lines.join(' · ');
        error.hidden = false;
      }
      blamed[0]?.field.focus();
      return;
    }

    const key = cartKey(api);
    const qty = quantity();
    /** @type {ReturnType<typeof readCart>} */
    let before;
    /** @type {ReturnType<typeof readCart>} */
    let after;
    try {
      before = readCart(localStorage.getItem(key));
      after = addLine(before, { product: facts.id, variant: variant.key, qty, answers });
      localStorage.setItem(key, JSON.stringify(after));
    } catch (why) {
      console.error(`product: the browser kept no cart (${why instanceof Error ? why.message : String(why)})`);
      return;
    }
    // A line at 999 already, or a cart of a hundred lines, takes no more.
    const count = (cart) => cart.lines.reduce((sum, line) => sum + line.qty, 0);
    if (count(after) === count(before)) {
      if (error) {
        error.textContent = words['refused.quantity'];
        error.hidden = false;
      }
      return;
    }
    if (added) {
      added.hidden = false;
      added.focus();
    }
    document.dispatchEvent(new CustomEvent('jtk:cart', { detail: key }));
  });

  // ── at once, and when the shop has said what is left ────────────────────
  const first = firstChoice((variant) => variant.onSale);
  if (first !== undefined) choose(first);
  render();

  void ask(api, `stock?product=${encodeURIComponent(facts.id)}`).then((answer) => {
    const products = answer?.status === 200 && Array.isArray(answer.body?.products) ? answer.body.products : [];
    const product = products.find((one) => String(one?.id ?? '').toLowerCase() === facts.id.toLowerCase());
    if (product === undefined) {
      // Said nothing, and Add left on: the checkout holds the stock.
      form.dataset.stockRead = 'failed';
      return;
    }
    if (product.served === false) {
      // A product the site does not serve sells none of its variants.
      for (const variant of facts.variants) stock[variant.key] = 'off_sale';
    } else {
      for (const one of Array.isArray(product.variants) ? product.variants : []) {
        if (typeof one?.key !== 'string') continue;
        stock[one.key] = one.state;
        if (Number.isInteger(one.left) && one.left >= 0) left[one.key] = one.left;
      }
    }
    read = true;
    if (!touched) {
      const better = firstChoice((variant) => stateOf(variant) === 'in_stock');
      if (better !== undefined) choose(better);
    }
    render();
    form.dataset.stockRead = 'yes';
  });
}

/**
 * Wires every product form under a root that is not wired yet.
 * @param {ParentNode} [root]
 */
export function wireAll(root = document) {
  if (root instanceof HTMLFormElement && root.matches('form[data-product]')) wireProduct(root);
  for (const form of /** @type {NodeListOf<HTMLFormElement>} */ (root.querySelectorAll('form[data-product]'))) wireProduct(form);
}

// The element, where there is a document to define it in. Under Node — the
// tests, a build that imports the module — there is none, and nothing here
// needs one.
const BaseElement = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

/**
 * `<jtk-product>` wraps the form `Product.astro` wrote and wires it when it
 * reaches the document — on load, and when the panel places the markup later.
 */
export class JtkProduct extends BaseElement {
  connectedCallback() {
    wireAll(/** @type {any} */ (this));
  }
}

/** @param {string} [name] */
export function defineProduct(name = 'jtk-product') {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, JtkProduct);
}

if (typeof document !== 'undefined') {
  defineProduct();
  // A form written bare, outside the element: wired at load, and again on
  // markup the panel places.
  onAlive('form[data-product]', (form) => wireProduct(/** @type {HTMLFormElement} */ (form)));
}
