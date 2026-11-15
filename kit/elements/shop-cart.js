/**
 * `<jtk-cart>` — the cart's page, made to work: the browser's cart priced
 * again by the shop each time it is shown, a refused line said with its
 * reason and taken out by the buyer, the country and the methods that country
 * is offered, and *To checkout* handing the country and the method on.
 *
 * The whole client of the cart, and no rule of the shop's: the cart holds the
 * protocol's lines and nothing else — no title, no price — so everything it
 * shows is the shop's answer of this moment, and a line the shop no longer
 * sells is refused there, with its reason (`cartView`, lib/shop/cart.mjs).
 *
 *   POST /api/shipping   { lines, country, locale } → the cart priced, its methods and its refusals
 *
 * asked (`ask`, shop-wire.js: `X-Jtk-Shop: 1`, never cached) when the cart is
 * shown, when a line or the country changes, and when the cart changes in
 * another tab (`storage`) or the page says it did (`jtk:cart`, which a
 * product's form dispatches on *Add*). A cart with no line asks nothing.
 *
 * ── how a page gets it ──────────────────────────────────────────────────────
 *
 * Import this module once on the page and every `[data-cart]` is wired: one
 * inside a `<jtk-cart>` by the element's own lifecycle, which also covers
 * markup the panel places later (`fl:placed`), and one written bare by
 * `onAlive`. The markup is the site's — the scaffold's
 * `src/components/shop/Cart.astro`, copied and dressed — and the element
 * finds everything in it by a `data-*` hook or a control's `name`, never by a
 * class: the list is `@jtakeit/kit/shop/hooks` (`CART`). A hook left out is
 * said in the console, and the part it stands for does nothing.
 *
 * The root carries the site's api base as `data-api`, the page's language as
 * `data-locale`, the countries the shop sends to as `data-countries` (JSON,
 * from its zones; the country is a `<select>` the build drew from the same
 * list) and the words the markup was written in as `data-words`
 * (`shopWordsFor`, which the element reads under them for any the page left
 * out). The element says what it is drawing in `data-state` on the root, for
 * the site's CSS to hide or show a part by:
 *
 *   pricing  the first answer is awaited
 *   priced   the shop has answered for the cart as it is
 *   stale    the shop could not be asked again: the last rows stay, held, with
 *            `[data-cart-retry]` to ask again
 *   empty    the cart has no line
 *   failed   the shop could not be asked and there is nothing to keep
 *
 * and `aria-busy` while an answer is awaited.
 *
 * ── what it does ────────────────────────────────────────────────────────────
 *
 *   - writes a row for each line into `[data-cart-lines]`: the title, the
 *     labels, the answers and what they add, a quantity box and the line's
 *     total in the site's money, and a button that takes it out. A refused
 *     line has no title the cart could keep, so it says its place — «Item 2» —
 *     and why, and its box and its button are named by the place and described
 *     by the reason; all of them are summed up in `[data-cart-error]`
 *     (`role="alert"`);
 *   - writes a radio `name="method"` per method the country is offered into
 *     `[data-methods]`, the cart's chosen one where it is still offered, else
 *     the first; the subtotal into `[data-subtotal]`;
 *   - shows `[data-abroad]` (the customs sentence, never for a pick-up),
 *     `[data-vat]` and `[data-cannot-send]` where they hold;
 *   - enables `[data-to-checkout]` only while the cart is ready — every line
 *     priced, nothing refused, a method chosen — and the shop has answered for
 *     the cart as it is. Pressed, it writes the country and the method into the
 *     cart's storage and dispatches `jtk:to-checkout` on the document, the
 *     cart's key as its `detail`. No quote goes with it: the checkout asks the
 *     shop again with the stored cart, so the total it says is what the shop
 *     prices at that moment.
 *
 * What the buyer does is never dropped: a quantity or a removal is kept in the
 * browser's cart at once, the shop is asked again, and the newest answer is
 * what is shown; a line taken out leaves the page at once and the lines after
 * it take its place, so the next press is on the line it looks at. A shop that
 * cannot be asked keeps the rows as they were, held, says so (`cartFailed`) and
 * offers `[data-cart-retry]`; any change asks again as well.
 *
 * The focus stays where the buyer put it: a changed quantity keeps it on its
 * box, a method chosen by the arrow keys on its radio, a line taken out hands
 * it to the line that takes its place, or the one before it, or to
 * `[data-cart-empty]` when none is left. A browser that keeps no cart (site
 * data blocked) is said in `[data-cart-error]` (`cartUnavailable`), and nothing
 * is handed on.
 */
import { money } from '../lib/money.mjs';
import { shopWordsFor } from '../lib/shop/words.mjs';
import { CART, lacking } from '../lib/shop/hooks.mjs';
import { MAX_QTY, cartKey, cartView, readCart, removeLine, setQty, shippingBody } from '../lib/shop/cart.mjs';
import { BaseElement, ask, defineOnce, parsed, putBase } from './shop-wire.js';
import { onAlive } from './alive.js';

export { SHOP_PROTOCOL, ask } from './shop-wire.js';

/** The rules the behaviour cannot work without: `putBase` in shop-wire.js says what they are for. */
const BASE = `
[data-cart] [hidden] { display: none !important; }
:where([data-cart] :focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
`;

let wiredCount = 0;

/** A part the element draws: marked by a data attribute, never a class, so the site's CSS can find it. */
function part(tag, name, text) {
  const node = document.createElement(tag);
  node.setAttribute(`data-${name}`, '');
  if (text !== undefined) node.textContent = text;
  return node;
}

/** What makes a line this line — the product, the variant and the answers, not how many — so a row can tell it is still the cart's. */
const identity = (line) => JSON.stringify([line.product, line.variant, Object.entries(line.answers).sort()]);

/**
 * Wires one cart's `[data-cart]`. Idempotent: a cart already wired is left alone.
 * @param {HTMLElement} root
 */
export function wireCart(root) {
  if (root.dataset.jtkWired === '1') return;
  root.dataset.jtkWired = '1';
  putBase('cart', BASE);

  const locale = root.dataset.locale ?? 'en';
  const api = root.dataset.api ?? '/api/';
  const key = cartKey(api);
  /** @type {Record<string, string>} */
  const words = { ...shopWordsFor(locale), ...parsed(root.dataset.words, {}) };
  const listed = parsed(root.dataset.countries, []);
  /** @type {string[]} the countries the shop sends to, each once */
  const countries = [...new Set(Array.isArray(listed) ? listed.filter((one) => typeof one === 'string' && /^[A-Z]{2}$/.test(one)) : [])];
  // A shop with no country in a zone has no country to choose: a pick-up alone.
  const missing = lacking(root, CART).filter((hook) => countries.length > 0 || hook !== '[name=country]');
  if (missing.length > 0) console.error(`cart: its markup has no ${missing.join(', ')}, and cannot work without them — the hooks are listed in @jtakeit/kit/shop/hooks`);
  const prefix = `jtk-cart-${++wiredCount}`;

  /** @type {HTMLElement | null} */ const lines = root.querySelector('[data-cart-lines]');
  /** @type {HTMLElement | null} */ const empty = root.querySelector('[data-cart-empty]');
  /** @type {HTMLSelectElement | null} */ const country = root.querySelector('[name=country]');
  /** @type {HTMLElement | null} */ const methods = root.querySelector('[data-methods]');
  /** @type {HTMLElement | null} */ const subtotal = root.querySelector('[data-subtotal]');
  /** @type {HTMLElement | null} */ const error = root.querySelector('[data-cart-error]');
  /** @type {HTMLButtonElement | null} */ const checkout = root.querySelector('[data-to-checkout]');
  /** @type {HTMLElement | null} */ const abroad = root.querySelector('[data-abroad]');
  /** @type {HTMLElement | null} */ const vat = root.querySelector('[data-vat]');
  /** @type {HTMLElement | null} */ const cannot = root.querySelector('[data-cannot-send]');
  /** @type {HTMLElement | null} */ const retry = root.querySelector('[data-cart-retry]');

  // The ARIA the behaviour depends on, whatever the copy kept: the subtotal is read as it changes, a refusal
  // as it appears, the sentences that appear are statuses, and the empty message can take the focus.
  // (The copy's own live region, which may take in the word before the amount, is the better one.)
  if (subtotal && !subtotal.closest('[aria-live]')) subtotal.setAttribute('aria-live', 'polite');
  if (error && !error.getAttribute('role')) error.setAttribute('role', 'alert');
  for (const sentence of [abroad, cannot]) if (sentence && !sentence.getAttribute('role')) sentence.setAttribute('role', 'status');
  if (empty && !empty.hasAttribute('tabindex')) empty.tabIndex = -1;

  // ── what the cart is, and what the shop last said of it ─────────────────
  let cart = readCart(null);
  /** @type {any} the shipping answer drawn now; null before the first */
  let quote = null;
  /** @type {ReturnType<typeof cartView> | null} */
  let view = null;
  /** The sentence of a cart the browser cannot keep, or the shop could not price; empty where there is none. */
  let fault = '';
  /** The request being answered; an older one is dropped when it arrives. */
  let sent = 0;
  /** Whether the shop has yet to answer for the cart as it stands: what is drawn may be of an older one. */
  let pending = false;
  /** Whether the shop could not be asked again, so that what is drawn is the last it said. */
  let stale = false;
  /** Whether the cart's last line was just taken out: the empty message takes the focus. */
  let focusEmpty = false;
  /** The rows' lines, as each was drawn: a control is obeyed only while its row is still the cart's line there. */
  const drawnAs = new WeakMap();
  let rowCount = 0;

  const say = (minor) => money(minor, view?.currency || undefined, locale);
  /** The country asked about: the cart's where it is one the shop sends to, else the first it does. */
  const countryNow = () => (countries.includes(cart.country) ? cart.country : (countries[0] ?? cart.country));
  /** `li` where the lines are a list, as they are in the copy, else `div`. */
  const itemTag = () => (lines instanceof HTMLUListElement || lines instanceof HTMLOListElement ? 'li' : 'div');

  /** Reads the cart from storage; false where the browser would not say. */
  function load() {
    try {
      cart = readCart(localStorage.getItem(key));
      return true;
    } catch (why) {
      console.error(`cart: the browser kept no cart (${why instanceof Error ? why.message : String(why)})`);
      cart = readCart(null);
      return false;
    }
  }

  /** Keeps a cart; false where the browser will not, and the buyer is told. */
  function save(next) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (why) {
      console.error(`cart: the browser kept no cart (${why instanceof Error ? why.message : String(why)})`);
      fault = words.cartUnavailable;
      drawError();
      return false;
    }
    cart = next;
    if (fault === words.cartUnavailable) {
      fault = '';
      drawError();
    }
    return true;
  }

  // ── drawing ─────────────────────────────────────────────────────────────
  /** What has the focus, in the parts the element redraws, so it can be given back. */
  function focused() {
    const at = document.activeElement;
    if (!(at instanceof HTMLElement) || !root.contains(at)) return null;
    const row = at.closest('[data-cart-line]');
    if (row instanceof HTMLElement && at.matches('[data-line-qty]')) return { kind: /** @type {'qty'} */ ('qty'), line: Number(row.dataset.line) };
    if (row instanceof HTMLElement && at.matches('[data-line-remove]')) return { kind: /** @type {'remove'} */ ('remove'), line: Number(row.dataset.line) };
    if (at instanceof HTMLInputElement && at.matches('[name=method]')) return { kind: /** @type {'method'} */ ('method'), value: at.value };
    // The button to ask again goes when the shop has answered: the first box of the cart takes its place.
    if (at === retry) return { kind: /** @type {'qty'} */ ('qty'), line: 0 };
    return null;
  }

  function refocus(want) {
    /** @type {Element | null | undefined} */
    let target = null;
    if (want === null) return;
    if (want.kind === 'method') target = [...root.querySelectorAll('[name=method]')].find((one) => /** @type {HTMLInputElement} */ (one).value === want.value);
    else target = lines?.querySelector(`[data-cart-line][data-line="${want.line}"] [data-line-${want.kind}]`);
    if (target instanceof HTMLElement) target.focus();
  }

  /** What a customization a line answers says: «Engraving: Ada (+ CHF 5)». */
  function answerSaid(one) {
    const value = one.ticked === true ? words.yes : String(one.text ?? '') !== '' ? String(one.text) : String(one.label ?? '');
    if (value === '') return '';
    return `${one.name}: ${value}${Number(one.adds) !== 0 ? ` (+ ${say(Number(one.adds))})` : ''}`;
  }

  /**
   * The place of a line the cart keeps no title for — «Item 2» — in the row, and in the names of its box and its button,
   * so that two such lines are told apart by more than their reason. A title is put in as written: `() =>`, so that a
   * `$&` in it is no pattern.
   */
  function place(node, at) {
    const said = words.itemNumber.replace('{n}', () => String(at + 1));
    const note = node.querySelector('[data-line-place]');
    if (note) note.textContent = said;
    node.querySelector('[data-line-qty]')?.setAttribute('aria-label', `${words.quantity}: ${said}`);
    node.querySelector('[data-line-remove]')?.setAttribute('aria-label', words.removeNamed.replace('{title}', () => said));
  }

  /** One line of the cart: what the shop priced it at, or why it would not, a box for how many, and a way to take it out. */
  function rowNode(row, item) {
    const node = document.createElement(item);
    const n = (rowCount += 1);
    node.setAttribute('data-cart-line', '');
    node.dataset.line = String(row.at);
    drawnAs.set(node, identity(row.line));
    // A line the answer says nothing of is as good as refused: the cart goes no further with it.
    const why = row.refused?.word ?? (row.quoted === undefined ? words['error.refused'] : '');
    node.dataset.state = why === '' ? 'priced' : 'refused';
    const title = row.quoted?.title ?? '';
    if (row.quoted !== undefined) {
      node.append(part('p', 'line-title', title));
      if (row.quoted.labels.length > 0) node.append(part('p', 'line-labels', row.quoted.labels.join(' · ')));
      const answers = row.quoted.answers.map(answerSaid).filter((text) => text !== '');
      if (answers.length > 0) {
        const list = part('ul', 'line-answers');
        for (const text of answers) list.append(part('li', 'line-answer', text));
        node.append(list);
      }
    } else {
      node.append(part('p', 'line-place'));
    }
    /** @type {HTMLElement | null} */
    let note = null;
    if (why !== '') {
      note = part('p', 'line-refused', why);
      note.id = `${prefix}-why-${n}`;
      node.append(note);
    }

    const box = part('div', 'line-quantity');
    const id = `${prefix}-qty-${n}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = words.quantity;
    const input = /** @type {HTMLInputElement} */ (part('input', 'line-qty'));
    Object.assign(input, { type: 'number', id, min: '1', max: String(MAX_QTY), step: '1', value: String(row.line.qty) });
    input.inputMode = 'numeric';
    if (title !== '') input.setAttribute('aria-label', `${words.quantity}: ${title}`);
    if (note) input.setAttribute('aria-describedby', note.id);
    box.append(label, input);
    node.append(box);

    if (row.quoted !== undefined) node.append(part('p', 'line-total', say(row.quoted.total)));
    const remove = /** @type {HTMLButtonElement} */ (part('button', 'line-remove', words.remove));
    remove.type = 'button';
    // The visible word is in the name, whole: «Remove Mug».
    if (title !== '') remove.setAttribute('aria-label', words.removeNamed.replace('{title}', () => title));
    if (note) remove.setAttribute('aria-describedby', note.id);
    node.append(remove);
    if (title === '') place(node, row.at);
    return node;
  }

  function drawLines() {
    if (!lines || !view) return;
    const item = itemTag();
    lines.replaceChildren(...view.rows.map((row) => rowNode(row, item)));
  }

  function drawMethods() {
    if (!methods || !view) return;
    methods.replaceChildren(
      ...view.methods.map((one) => {
        const choice = part('label', 'method-choice');
        const radio = /** @type {HTMLInputElement} */ (part('input', 'method-radio'));
        Object.assign(radio, { type: 'radio', name: 'method', value: one.method, checked: one.method === view?.method });
        // A space between the words, so the name reads «Post CHF 7.90» and not «PostCHF 7.90».
        choice.append(radio, part('span', 'method-name', one.name), ' ', part('span', 'method-price', one.price === 0 ? words.free : say(one.price)));
        return choice;
      }),
    );
  }

  /** A sentence shown where it holds, written from the words, and hidden where it does not. */
  function note(node, shown, text) {
    if (!node) return;
    if (shown) node.textContent = text;
    node.hidden = !shown;
  }

  /** *To checkout* is open only for a cart the shop has answered for as it stands, and found ready. */
  function holdCheckout() {
    if (checkout) checkout.disabled = view === null || !view.ready || pending || stale;
  }

  /** What the shop's answer says besides the lines: the subtotal, the sentences that hold, and whether the buyer may go on. */
  function drawSummary() {
    if (!view) return;
    if (subtotal) subtotal.textContent = say(view.subtotal);
    note(vat, view.vat, words.vat);
    note(abroad, view.abroad, words.customs);
    const unsent = !view.sends && countries.length > 0 ? words.doesNotSend : view.cannotSend ? words.cannotSend : '';
    note(cannot, unsent !== '', unsent);
    holdCheckout();
    drawError();
  }

  /** `[data-cart-error]`: a cart that could not be kept or priced, else a line refused, said once for all of them. */
  function drawError() {
    if (!error) return;
    // Held with every line priced and a method to send by: the shop refused the cart as a whole, which no row bears.
    const unbeared = view !== null && !view.ready && view.rows.length > 0 && view.rows.every((row) => row.quoted !== undefined) && view.methods.length > 0;
    const refused = view !== null && (unbeared || view.rows.some((row) => row.refused !== undefined || row.quoted === undefined));
    const text = fault !== '' ? fault : refused ? words['error.refused'] : '';
    error.textContent = text;
    error.hidden = text === '';
  }

  /** Everything the shop's answer fills, left empty; the sentences hidden and *To checkout* held. */
  function clearAnswer() {
    quote = null;
    view = null;
    lines?.replaceChildren();
    methods?.replaceChildren();
    if (subtotal) subtotal.textContent = '';
    for (const sentence of [vat, abroad, cannot]) if (sentence) sentence.hidden = true;
    holdCheckout();
  }

  /** A cart with no line: said, and nothing to ask the shop. */
  function drawEmpty() {
    const askedAgain = document.activeElement === retry;
    sent += 1;
    pending = false;
    stale = false;
    root.removeAttribute('aria-busy');
    root.dataset.state = 'empty';
    clearAnswer();
    if (retry) retry.hidden = true;
    if (empty) {
      empty.textContent = words.cartEmpty;
      empty.hidden = false;
      if (focusEmpty || askedAgain) empty.focus();
    }
    focusEmpty = false;
    drawError();
  }

  /**
   * The shop could not be asked. What was drawn stays, held, where there was something to keep; where there was not,
   * nothing is drawn that the shop did not say. Either way it is said, and the buyer may ask again.
   */
  function drawFailed() {
    pending = false;
    root.removeAttribute('aria-busy');
    fault = words.cartFailed;
    if (quote === null) {
      root.dataset.state = 'failed';
      clearAnswer();
      if (empty) empty.hidden = true;
    } else {
      root.dataset.state = 'stale';
      stale = true;
    }
    if (retry) retry.hidden = false;
    holdCheckout();
    drawError();
  }

  function draw() {
    const was = focused();
    stale = false;
    view = cartView(cart, quote, locale);
    root.dataset.state = 'priced';
    if (empty) empty.hidden = true;
    if (retry) retry.hidden = true;
    drawLines();
    drawMethods();
    drawSummary();
    refocus(was);
  }

  // ── asking the shop ─────────────────────────────────────────────────────
  /** Reads the cart and prices it again: the cart as it is stored now, the country as it is chosen now. */
  async function show() {
    const readable = load();
    fault = readable ? '' : words.cartUnavailable;
    if (!readable || cart.lines.length === 0) {
      drawEmpty();
      return;
    }
    const mine = (sent += 1);
    pending = true;
    root.setAttribute('aria-busy', 'true');
    holdCheckout();
    if (country && countries.length > 0) country.value = countryNow();
    if (quote === null) {
      root.dataset.state = 'pricing';
      // In the list as one of its items, where the lines are a list.
      if (lines) lines.replaceChildren(part(itemTag(), 'cart-pricing', words.pricing));
    }
    if (empty) empty.hidden = true;
    const answer = await ask(api, 'shipping', { body: { ...shippingBody(cart, locale), country: countryNow() } });
    // A newer ask is on its way, and what that says is what is shown.
    if (mine !== sent) return;
    pending = false;
    root.removeAttribute('aria-busy');
    const body = answer?.status === 200 ? answer.body : null;
    if (body === null || typeof body !== 'object' || !Array.isArray(body.lines)) {
      drawFailed();
      return;
    }
    fault = '';
    quote = body;
    draw();
  }

  // ── what the buyer does ─────────────────────────────────────────────────
  /**
   * The place in the cart of the line a control's row stands for, or -1 where the cart's line there is another —
   * the cart changed under the row, in another tab, and an answer is about to draw it again.
   */
  function placeOf(control) {
    const row = control.closest('[data-cart-line]');
    if (!(row instanceof HTMLElement)) return -1;
    const at = Number(row.dataset.line);
    const line = cart.lines[at];
    return line !== undefined && drawnAs.get(row) === identity(line) ? at : -1;
  }

  /** How many, as a whole number of 1 to 999; what is no quantity is the line's as it was. Kept at once, and the shop asked again. */
  function onQty(input) {
    const at = placeOf(input);
    const was = cart.lines[at]?.qty;
    if (was === undefined) return;
    const n = Math.trunc(Number(input.value));
    const qty = Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_QTY) : was;
    input.value = String(qty);
    if (qty === was) return;
    if (save(setQty(cart, at, qty))) void show();
    else input.value = String(was);
  }

  /**
   * A line taken out: kept so at once, and gone from the page at once — the lines after it take its place, so the next press
   * is on the line it looks at — and the focus goes on. The shop is asked again for what is left.
   */
  function onRemove(button) {
    const at = placeOf(button);
    if (at < 0) return;
    const rest = removeLine(cart, at);
    if (!save(rest)) return;
    if (rest.lines.length === 0) focusEmpty = true;
    else {
      button.closest('[data-cart-line]')?.remove();
      for (const row of lines?.querySelectorAll('[data-cart-line]') ?? []) {
        const line = Number(/** @type {HTMLElement} */ (row).dataset.line);
        if (line <= at) continue;
        /** @type {HTMLElement} */ (row).dataset.line = String(line - 1);
        // A line with no title says its place: the place has moved up.
        if (row.querySelector('[data-line-place]')) place(row, line - 1);
      }
      refocus({ kind: 'remove', line: Math.min(at, rest.lines.length - 1) });
    }
    void show();
  }

  function onCountry(select) {
    if (save({ ...cart, country: select.value })) void show();
  }

  function onMethod(radio) {
    if (!save({ ...cart, method: radio.value }) || view === null) return;
    // The prices are the shop's and do not change with the method: what does is whether the parcel crosses the border.
    view = cartView(cart, quote, locale);
    drawSummary();
  }

  /** Hands the country and the method on: written into the cart, said on the document, with no quote. */
  function onCheckout() {
    if (view === null || !view.ready || pending || stale) return;
    if (!save({ ...cart, country: countryNow(), method: view.method })) return;
    document.dispatchEvent(new CustomEvent('jtk:to-checkout', { detail: key }));
  }

  root.addEventListener('change', (event) => {
    const target = /** @type {any} */ (event.target);
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('[data-line-qty]')) onQty(target);
    else if (target.matches('[name=country]')) onCountry(target);
    else if (target.matches('[name=method]')) onMethod(target);
  });
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const remove = target?.closest('[data-line-remove]');
    if (remove) onRemove(remove);
    else if (target?.closest('[data-cart-retry]')) void show();
    else if (target?.closest('[data-to-checkout]')) onCheckout();
  });

  // The cart changed somewhere else: another tab, or a product's form on this page. The listeners go with the markup.
  const stop = new AbortController();
  const heard = (when) => (event) => {
    if (!root.isConnected) stop.abort();
    else when(event);
  };
  const options = { signal: stop.signal };
  document.addEventListener('jtk:cart', heard((event) => event.detail === key && void show()), options);
  window.addEventListener('storage', heard((event) => (event.key === key || event.key === null) && void show()), options);
  // Back to the page from the browser's cache, hours later, or the network back after a failure: priced again.
  window.addEventListener('pageshow', heard((event) => event.persisted && void show()), options);
  window.addEventListener('online', heard(() => (root.dataset.state === 'failed' || root.dataset.state === 'stale') && void show()), options);

  void show();
}

/**
 * `<jtk-cart>` wraps the cart `Cart.astro` wrote and wires it when it reaches
 * the document — on load, and when the panel places the markup later.
 */
export class JtkCart extends BaseElement {
  connectedCallback() {
    const self = /** @type {any} */ (this);
    if (self.matches('[data-cart]')) wireCart(self);
    for (const root of /** @type {NodeListOf<HTMLElement>} */ (self.querySelectorAll('[data-cart]'))) wireCart(root);
  }
}

/** @param {string} [name] */
export function defineCart(name = 'jtk-cart') {
  defineOnce(name, /** @type {any} */ (JtkCart));
}

if (typeof document !== 'undefined') {
  defineCart();
  // A cart written bare, outside the element: wired at load, and again on markup the panel places.
  onAlive('[data-cart]', (root) => wireCart(/** @type {HTMLElement} */ (root)));
}
