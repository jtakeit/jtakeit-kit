/**
 * `<jtk-checkout>` — the checkout step below the cart, made to work: the cart
 * priced again when the step is opened, the buyer, the address unless it is a
 * pick-up, the challenge, the total as shown, and one press of *Pay* held
 * across its retries until the shop sends the buyer to Stripe's page.
 *
 * The whole client of the checkout, and no rule of the shop's: the shop prices
 * the cart again and holds the stock when it is pressed, and refuses what it
 * would not take with its reason. What the element does is send what the buyer
 * was shown, keep the press, and act on every answer (`afterAnswer`,
 * lib/shop/checkout.mjs).
 *
 *   POST /api/shipping   { lines, country, locale }    → the cart priced, when the step is opened and when the cart changes
 *   GET  /api/turnstile                                 → the challenge's key, or "" where the host has none
 *   POST /api/checkout   { lines, …, attempt, … }       → 201 Stripe's page, or the refusal that says why not
 *                        { order }                      → the same, for an order already made
 *
 * asked over the shop's wire (`ask`, shop-wire.js: `X-Jtk-Shop: 1`, never cached).
 *
 * ── how a page gets it ──────────────────────────────────────────────────────
 *
 * Import this module once on the page and every `form[data-checkout]` is
 * wired: one inside a `<jtk-checkout>` by the element's own lifecycle, which
 * also covers markup the panel places later (`fl:placed`), and one written bare
 * by `onAlive`. The markup is the site's — the scaffold's
 * `src/components/shop/Checkout.astro`, copied and dressed — and the element
 * finds everything in it by a `data-*` hook or a control's `name`, never by a
 * class: the list is `@jtakeit/kit/shop/hooks` (`CHECKOUT`). A hook left out
 * is said in the console, and the part it stands for does nothing.
 *
 * The form carries the site's api base as `data-api`, the page's language as
 * `data-locale`, the path the buyer comes back to from Stripe's page as
 * `data-return` (the order's page, in the page's language and under the
 * build's base), and the words the markup was written in as `data-words`
 * (`shopWordsFor`, which the element reads under them for any the page left
 * out). It is `hidden` until the cart hands on, and says what it is drawing in
 * `data-state`, for the site's CSS and for a walk:
 *
 *   pricing  the shop is asked what the cart comes to
 *   priced   the total is the shop's answer for the cart as it is
 *   stale    the shop could not be asked again: the last total, which *Pay*
 *            does not pay for until the shop has said it again
 *   failed   the shop could not be asked, and there is no total to show
 *   refused  the shop would not price the cart as it is — a line refused, no
 *            way to send it — which the cart above says, and *Pay* asks again
 *   empty    the cart has no line
 *   paying   a press is with the shop, or the buyer is on the way to pay
 *
 * and `aria-busy` while an answer is awaited.
 *
 * ── what it does ────────────────────────────────────────────────────────────
 *
 *   - on `jtk:to-checkout` (the cart's *To checkout*, the cart's key as its
 *     `detail`), shows itself, takes the focus to its heading and asks
 *     `POST /api/shipping` again with the stored cart, its country and its
 *     method (Ruling 200): no quote passes from the cart, so the total it says
 *     and sends is what the shop prices at that moment;
 *   - prices the cart again whenever it changes while the step is open — the
 *     cart above says so with `jtk:cart`, another tab with `storage` — so the
 *     total beside *Pay* is always the cart's as shown (Ruling 224); a change
 *     heard while a press is with the shop is priced once it has answered;
 *   - says that answer's total — the subtotal and the method's price — in
 *     `[data-total]`, with `[data-vat]` (*incl. VAT*) and `[data-abroad]` (the
 *     customs sentence, never for a pick-up) beside it, and
 *     `[data-own-currency]` beside *Pay*, where the shop says them;
 *   - hides `[data-address]` for a pick-up, which asks no address;
 *   - on *Pay*: pressed while the shop is pricing, it waits for the answer and
 *     goes on with it — or says the price changed, where the total it was
 *     pressed on is no longer the shop's, and only shows the total where it
 *     was pressed on none, sending nothing the buyer has not seen; a cart
 *     changed since the total was said is priced again and shown before
 *     anything is sent; what is plainly
 *     missing — a name, an email, the street, the postal code and the city of
 *     a delivery — is said beside its field (`aria-invalid`,
 *     `aria-describedby`) and in `[data-checkout-error]` (`role="alert"`), the
 *     first such field focused; then the press is sent (`checkoutBody`) and
 *     kept with what it was sent with (`keptPress`,
 *     `sessionStorage[pressKey(api)]`): *Pay* pressed again on the same body is
 *     a retry of it, on any other body a new press (`pressFor`, Ruling 223),
 *     and an order's token alone is asked for only while the step shows the
 *     total the order was made at (Ruling 225). Where the host has a challenge
 *     it is rendered into `[data-challenge]`, a fresh token goes with every
 *     call that carries the cart, and *Pay* waits for one; a key that could not
 *     be asked is asked again after the shop says `403 challenge`, and a widget
 *     that does not load is said;
 *   - acts on the answer: Stripe's page, or the order's page where it is paid
 *     already, the press then over and forgotten and the order marked as this
 *     tab's (`sessionStorage[paidFromKey(api)]`: the order's page empties the
 *     cart only for that order, Ruling 227); the same press asked again —
 *     by the order's token alone where the shop made one — after an answer that
 *     was lost; a new total shown and said, the cart above priced again
 *     (`jtk:cart`); a detail the shop refuses said at its field; and any other
 *     refusal said, the press kept or given up as the protocol says, so that the
 *     next press is a new one only once this one can make no order.
 *
 * A press is never two: *Pay* pressed while the shop answers is the same press,
 * and is not sent twice. A browser that keeps no cart is said (`cartUnavailable`);
 * one that keeps nothing in the tab keeps the press in the page.
 */
import { money } from '../lib/money.mjs';
import { shopWordsFor } from '../lib/shop/words.mjs';
import { CHECKOUT, lacking } from '../lib/shop/hooks.mjs';
import { cartKey, cartView, readCart, shippingBody } from '../lib/shop/cart.mjs';
import { afterAnswer, checkoutBody, keptPress, missingDetails, pressFor, pressKey, sentOf } from '../lib/shop/checkout.mjs';
import { paidFromKey } from '../lib/shop/order.mjs';
import { BaseElement, ask, defineOnce, parsed, putBase } from './shop-wire.js';
import { onAlive } from './alive.js';

export { SHOP_PROTOCOL, ask } from './shop-wire.js';

/** The rules the behaviour cannot work without: `putBase` in shop-wire.js says what they are for. */
const BASE = `
[data-checkout][hidden], [data-checkout] [hidden] { display: none !important; }
:where([data-checkout] :focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
[data-checkout] [data-pay][aria-disabled='true'] { cursor: progress; }
`;

/** Each detail the protocol names, and the control the form names it by. */
const FIELDS = {
  'buyer.name': 'name',
  'buyer.email': 'email',
  'buyer.phone': 'phone',
  'address.line1': 'line1',
  'address.line2': 'line2',
  'address.postal_code': 'postal_code',
  'address.city': 'city',
};
const ADDRESS = ['line1', 'line2', 'postal_code', 'city'];

let wiredCount = 0;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Wires one checkout's `form[data-checkout]`. Idempotent: a form already wired is left alone.
 * @param {HTMLFormElement} form
 */
export function wireCheckout(form) {
  if (form.dataset.jtkWired === '1') return;
  form.dataset.jtkWired = '1';
  putBase('checkout', BASE);
  const missing = lacking(form, CHECKOUT);
  if (missing.length > 0) console.error(`checkout: its form has no ${missing.join(', ')}, and cannot work without them — the hooks are listed in @jtakeit/kit/shop/hooks`);

  const locale = form.dataset.locale ?? 'en';
  const api = form.dataset.api ?? '/api/';
  const back = form.dataset.return ?? '/';
  const key = cartKey(api);
  const kept = pressKey(api);
  const paidFrom = paidFromKey(api);
  /** @type {Record<string, string>} */
  const words = { ...shopWordsFor(locale), ...parsed(form.dataset.words, {}) };
  const prefix = `jtk-checkout-${++wiredCount}`;

  /** @type {HTMLElement | null} */ const total = form.querySelector('[data-total]');
  /** @type {HTMLElement | null} */ const address = form.querySelector('[data-address]');
  /** @type {HTMLElement | null} */ const challenge = form.querySelector('[data-challenge]');
  /** @type {HTMLElement | null} */ const error = form.querySelector('[data-checkout-error]');
  /** @type {HTMLButtonElement | null} */ const pay = form.querySelector('[data-pay]');
  /** @type {HTMLElement | null} */ const abroad = form.querySelector('[data-abroad]');
  /** @type {HTMLElement | null} */ const vat = form.querySelector('[data-vat]');
  /** @type {HTMLElement | null} */ const own = form.querySelector('[data-own-currency]');
  // Where the focus goes when the step is opened: its heading, else the form itself.
  /** @type {HTMLElement} */ const opening = form.querySelector('h1, h2, h3, h4, h5, h6') ?? form;
  /** @type {(name: string) => HTMLInputElement | null} */
  const control = (name) => form.querySelector(`[name="${name}"]`);
  // What *Pay* says, as the build wrote it, put back once a press is answered.
  const payWords = pay ? [...pay.childNodes] : [];

  // The ARIA the behaviour depends on, whatever the copy kept: the total is read as it changes, a refusal as it
  // appears, the sentences that appear are statuses, and the step's heading can take the focus.
  if (total && !total.closest('[aria-live]')) total.setAttribute('aria-live', 'polite');
  if (error && !error.getAttribute('role')) error.setAttribute('role', 'alert');
  for (const sentence of [abroad, own]) if (sentence && !sentence.getAttribute('role')) sentence.setAttribute('role', 'status');
  if (!opening.hasAttribute('tabindex')) opening.tabIndex = -1;

  // ── what is priced, and the press ───────────────────────────────────────
  let cart = readCart(null);
  /** @type {ReturnType<typeof readCart> | null} the cart as it was priced: what the total shown is of */
  let priced = null;
  /** @type {any} the shop's last answer for `priced` */
  let quote = null;
  /** @type {ReturnType<typeof cartView> | null} */
  let view = null;
  /** The total shown, in minor units; null where none is. */
  let shown = /** @type {number | null} */ (null);
  /** Whether `shown` is the shop's answer as of the last ask, and not one kept after an ask that failed. */
  let fresh = false;
  /** The ask being answered; an older one is dropped when it arrives. */
  let sent = 0;
  let pricing = false;
  /** Whether a press is with the shop, or the buyer is on the way to pay: another is not sent, and nothing is priced. */
  let busy = false;
  /** A change of the cart heard while a press was with the shop: priced once it has answered. */
  let dirty = false;
  /** *Pay* pressed while the shop was pricing, and the total shown when it was: it goes on once the shop has answered. */
  let wanted = false;
  let seen = /** @type {number | null} */ (null);
  /** Whether `jtk:cart` is this step's own, said after a new price: not heard again by the step that said it. */
  let echo = false;
  /** The press as this page keeps it, once it has kept one — the tab's storage may not. */
  let remembered = /** @type {import('../lib/shop/checkout.mjs').Press | null} */ (null);
  let keptHere = false;
  /** The challenge: its widget, once rendered, and the token it gave for the next call that carries the cart. */
  let widget = /** @type {string | undefined} */ (undefined);
  let token = '';
  let keyAsked = false;

  /** The press the tab keeps, or none. */
  function storedPress() {
    if (keptHere) return remembered;
    try {
      return parsed(sessionStorage.getItem(kept) ?? undefined, null);
    } catch {
      return null;
    }
  }

  /** Keeps a press for its retries — in the tab, so a reload asks for the same order — or forgets it. */
  function keepPress(one) {
    remembered = one;
    keptHere = true;
    try {
      if (one === null) sessionStorage.removeItem(kept);
      else sessionStorage.setItem(kept, JSON.stringify(one));
    } catch (why) {
      console.error(`checkout: the browser keeps no press across a reload, so this page keeps it (${why instanceof Error ? why.message : String(why)})`);
    }
  }

  /** Reads the cart from storage; false where the browser would not say. */
  function load() {
    try {
      cart = readCart(localStorage.getItem(key));
      return true;
    } catch (why) {
      console.error(`checkout: the browser kept no cart (${why instanceof Error ? why.message : String(why)})`);
      cart = readCart(null);
      return false;
    }
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** The method the total is of: the cart's while the shop offers it, else the first it does (`cartView`). */
  const methodNow = () => view?.methods.find((one) => one.method === view?.method);

  // ── what is wrong ───────────────────────────────────────────────────────
  /** A sentence not tied to a field: a refusal, a state of the shop. */
  let sentence = '';
  /** Whether the sentence is what the shop's price said — the cart could not be priced, or as it is — which a new price takes back. */
  let ofPrice = false;
  /** @type {{ field: HTMLElement; note: HTMLElement; line: string }[]} */
  let blamed = [];
  let faults = 0;

  /** `[data-checkout-error]` said again from what remains: the sentence, and each field's fault. */
  function sum() {
    if (!error) return;
    const text = [sentence, ...blamed.map((one) => one.line)].filter((one) => one !== '').join(' · ');
    error.textContent = text;
    error.hidden = text === '';
  }
  function say(text, priceSaid = false) {
    sentence = text;
    ofPrice = priceSaid && text !== '';
    sum();
  }
  function unblame(field) {
    for (const one of blamed.filter((each) => field === undefined || each.field === field)) {
      one.field.removeAttribute('aria-invalid');
      const rest = (one.field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== one.note.id);
      if (rest.length > 0) one.field.setAttribute('aria-describedby', rest.join(' '));
      else one.field.removeAttribute('aria-describedby');
      one.note.remove();
    }
    blamed = field === undefined ? [] : blamed.filter((each) => each.field !== field);
    sum();
  }
  /**
   * The details the protocol names, said at their fields — `buyer.email`, `address.line1` — and the first of them focused.
   * Answers whether any was a field of this form.
   * @param {string[]} paths
   */
  function blameAll(paths) {
    for (const path of paths) {
      const name = FIELDS[path];
      const field = name === undefined ? null : control(name);
      if (!field || blamed.some((one) => one.field === field)) continue;
      const text = words[`fault.${name}`] ?? words['error.buyer'];
      const note = document.createElement('span');
      note.dataset.fault = '';
      note.id = `${prefix}-fault-${(faults += 1)}`;
      note.textContent = text;
      field.insertAdjacentElement('afterend', note);
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
      const label = field.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim() || words[`field.${name}`] || name;
      blamed.push({ field, note, line: `${label}: ${text}` });
    }
    sum();
    blamed[0]?.field.focus();
    return blamed.length > 0;
  }

  // ── drawing ─────────────────────────────────────────────────────────────
  /** A sentence shown where it holds, written from the words, and hidden where it does not. */
  function note(node, holds, text) {
    if (!node) return;
    if (holds) node.textContent = text;
    node.hidden = !holds;
  }

  /** *Pay* is held while the shop is asked: pressed, it waits for the answer, or is the press already with the shop. */
  function hold() {
    if (pay) pay.setAttribute('aria-disabled', String(busy || pricing));
    if (busy || pricing) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  }

  /** What *Pay* says while a press is with the shop, and what the build wrote there once it is answered. */
  function paying(now) {
    if (!pay) return;
    if (now) pay.textContent = words.paying;
    else pay.replaceChildren(...payWords);
  }

  /** Nothing of a total shown: the sentences beside it hidden. */
  function blank() {
    if (total) total.textContent = '';
    for (const part of [vat, abroad, own]) if (part) part.hidden = true;
  }

  /** The total of the priced cart, the sentences beside it, and the address asked only of a delivery. */
  function draw() {
    if (priced === null) return;
    view = cartView(priced, quote, locale);
    const method = methodNow();
    shown = view.ready && method !== undefined ? view.subtotal + method.price : null;
    if (total) total.textContent = shown === null ? '' : money(shown, view.currency || undefined, locale);
    note(vat, shown !== null && view.vat, words.vat);
    note(abroad, shown !== null && view.abroad, words.customs);
    note(own, shown !== null && view.ownCurrency, words.ownCurrency);
    const pickup = method?.pickup === true;
    if (address) {
      address.hidden = pickup;
      if (pickup) for (const name of ADDRESS) {
        const field = control(name);
        if (field) unblame(field);
      }
    }
    form.dataset.state = shown === null ? 'refused' : 'priced';
    // A cart the shop would not price as it is — a line refused, no way to send it: the cart above says which.
    if (shown === null) say(view.cannotSend ? words.cannotSend : words['error.refused'], true);
  }

  /** The shop could not be asked: what was shown stays, and is not paid for until the shop has said it again. */
  function failed(text) {
    fresh = false;
    if (shown === null) {
      form.dataset.state = 'failed';
      blank();
    } else {
      form.dataset.state = 'stale';
    }
    say(text, true);
  }

  // ── asking the shop ─────────────────────────────────────────────────────
  /**
   * Prices the cart as it is stored now: its lines, its country, its method. Never while a press is with the shop, whose
   * total must not change under it: that waits for its answer. *Pay* pressed meanwhile goes on with the answer (`resume`).
   */
  async function price() {
    if (busy) {
      dirty = true;
      return;
    }
    const readable = load();
    if (!readable || cart.lines.length === 0) {
      sent += 1;
      pricing = false;
      hold();
      priced = null;
      shown = null;
      fresh = false;
      // A press waiting on this price is answered by it: there is nothing to pay for.
      wanted = false;
      blank();
      form.dataset.state = readable ? 'empty' : 'failed';
      say(readable ? words.cartEmpty : words.cartUnavailable, true);
      return;
    }
    const mine = (sent += 1);
    const asked = cart;
    pricing = true;
    if (shown === null) form.dataset.state = 'pricing';
    hold();
    const answer = await ask(api, 'shipping', { body: shippingBody(asked, locale) });
    // A newer ask is on its way, and what that says is what is shown — and what a press waiting on it goes on with (M3).
    if (mine !== sent) return;
    pricing = false;
    hold();
    const body = answer?.status === 200 ? answer.body : null;
    if (!isObject(body) || !Array.isArray(body.lines)) {
      // A press waiting on this price is answered by it: the shop could not be asked.
      wanted = false;
      failed(words.cartFailed);
      return;
    }
    priced = asked;
    quote = body;
    fresh = true;
    if (ofPrice) say('');
    draw();
    if (wanted) {
      wanted = false;
      resume(seen);
    }
  }

  /** The challenge, if this host has one: its key asked at runtime, the widget rendered into `[data-challenge]`. */
  async function offerChallenge() {
    if (keyAsked || !challenge) return;
    keyAsked = true;
    const answer = await ask(api, 'turnstile');
    // A key that could not be asked is not «no challenge»: it is asked again, at the next opening or after a 403 challenge.
    if (answer === null || answer.status !== 200 || !isObject(answer.body)) {
      keyAsked = false;
      return;
    }
    const sitekey = typeof answer.body.sitekey === 'string' ? answer.body.sitekey : '';
    // Where the host has no widget, nothing is asked and nothing is sent.
    if (sitekey === '') return;
    challenge.hidden = false;
    const scheme = getComputedStyle(document.documentElement).colorScheme || '';
    const said = form.dataset.turnstileTheme;
    // The widget in the page's colours and language, not the browser's (the booking form's rule).
    const theme = said === 'light' || said === 'dark' || said === 'auto' ? said : /\blight\b/.test(scheme) && !/\bdark\b/.test(scheme) ? 'light' : /\bdark\b/.test(scheme) && !/\blight\b/.test(scheme) ? 'dark' : 'auto';
    /** A widget that cannot be drawn — its script blocked, or not what it should be — is said, and asked for again later. */
    const unavailable = () => {
      keyAsked = false;
      challenge.hidden = true;
      say(words.challengeUnavailable);
    };
    const render = () => {
      const turnstile = /** @type {any} */ (window).turnstile;
      if (typeof turnstile?.render !== 'function') return unavailable();
      const id = turnstile.render(challenge, {
        sitekey,
        theme,
        language: document.documentElement.lang || locale,
        callback: (/** @type {string} */ given) => { token = given; },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; },
      });
      widget = typeof id === 'string' ? id : undefined;
    };
    if (/** @type {any} */ (window).turnstile) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    script.onerror = () => {
      script.remove();
      unavailable();
    };
    document.head.appendChild(script);
  }

  /** A widget's token is spent by the call that carried it: the next call that carries the cart needs a fresh one. */
  function spend() {
    token = '';
    if (widget !== undefined) /** @type {any} */ (window).turnstile?.reset(widget);
  }

  /** Whether the challenge is drawn and has given no token yet: a call that carries the cart waits for one. */
  const unchallenged = () => challenge !== null && !challenge.hidden && token === '';

  /** What the form says of the buyer, as typed, and the address — none for a pick-up. */
  function details() {
    const value = (name) => control(name)?.value ?? '';
    const pickup = methodNow()?.pickup === true;
    return {
      buyer: { name: value('name'), email: value('email'), phone: value('phone') },
      address: pickup ? null : { line1: value('line1'), line2: value('line2'), postal_code: value('postal_code'), city: value('city') },
    };
  }

  /** Where the buyer is sent for an order that is paid: the order's page, with the order on its address. */
  function orderPage(order) {
    const at = new URL(back, location.href);
    at.searchParams.set('order', order);
    return at.pathname + at.search + at.hash;
  }

  /**
   * Marks the order this tab's press is sending the buyer to pay for (Ruling 227): the order's page empties the cart only for
   * this token, so a paid order's link opened later, on another device or in another tab, leaves the cart there. A browser that
   * will not keep the mark is said in the console: the page keeps the cart, and says so if it cannot read the mark either.
   */
  function markOrder(order) {
    if (order === '') return;
    try {
      sessionStorage.setItem(paidFrom, order);
    } catch (why) {
      console.error(`checkout: the browser keeps no mark of this order, so its page will not empty the cart (${why instanceof Error ? why.message : String(why)})`);
    }
  }

  /** On the way: the press over and forgotten, the order marked as this tab's, *Pay* held while the page is left. */
  function leave(to, order) {
    keepPress(null);
    markOrder(order);
    busy = true;
    form.dataset.state = 'paying';
    paying(true);
    hold();
    location.assign(to);
  }

  /**
   * Sends a press and acts on its answer. The press is kept before it is sent, with what it is sent with and when, so an
   * answer that is lost — the page closed, the network gone — leaves it for the next press on the same body to retry, the same.
   * @param {import('../lib/shop/checkout.mjs').Press} press
   * @param {ReturnType<typeof readCart>} order the cart that was priced, with the method the total is of
   * @param {import('../lib/shop/checkout.mjs').CheckoutForm} given
   */
  async function send(press, order, given) {
    keepPress(press);
    const body = checkoutBody(press, order, given);
    const carries = press.order === '';
    const was = form.dataset.state ?? '';
    busy = true;
    form.dataset.state = 'paying';
    paying(true);
    hold();
    const answer = await ask(api, 'checkout', { body });
    if (carries) spend();
    busy = false;
    paying(false);
    form.dataset.state = was;
    hold();
    const next = afterAnswer(press, answer);
    // A sentence is the developer's to read, whatever follows it — a refusal, or a gateway's page retried as a lost answer:
    // said in the console as it was said.
    if (typeof answer?.body === 'string' && answer.body !== '') console.error(`checkout: the shop said ${answer.status} — ${answer.body}`);
    if (next.kind === 'go') return leave(next.url, next.order);
    if (next.kind === 'paid') return leave(orderPage(next.order), next.order);
    keepPress(next.press);
    if (next.kind === 'ask_again') say(words['error.try_again']);
    else if (next.kind === 'requote') {
      // The shop's answer now, for the cart that was sent: shown and said, and the cart above priced again with it — the
      // step does not hear its own word.
      quote = next.quote;
      fresh = true;
      draw();
      say(words[next.word] ?? words['error.refused']);
      echo = true;
      try {
        document.dispatchEvent(new CustomEvent('jtk:cart', { detail: key }));
      } finally {
        echo = false;
      }
    } else {
      if (!(next.fields !== undefined && next.fields.length > 0 && blameAll(next.fields))) {
        say(words[next.word] ?? words['error.internal']);
        // An address Stripe cannot tax: checked, and started again from it.
        if (next.word === 'address' && address && !address.hidden) control('line1')?.focus();
        // The shop wants a challenge this page has not drawn — its key could not be asked: asked again.
        if (next.word === 'error.challenge' && challenge?.hidden) {
          keyAsked = false;
          void offerChallenge();
        }
      }
    }
    // The cart changed while the press was with the shop: priced now.
    if (dirty) {
      dirty = false;
      void price();
    }
  }

  // ── what the buyer does ─────────────────────────────────────────────────
  /**
   * *Pay*. The same press with the shop: nothing more. While the shop is pricing: kept, and gone on with once it has answered.
   * A total the shop has not said for the cart as it is: priced first, and gone on with if it is the one shown.
   */
  function onPay() {
    if (busy) return;
    if (pricing) {
      if (!wanted) {
        wanted = true;
        seen = shown;
      }
      return;
    }
    say('');
    if (!load()) {
      say(words.cartUnavailable);
      return;
    }
    if (priced === null || !fresh || shown === null || !same(cart, priced)) {
      wanted = true;
      seen = shown;
      void price();
      return;
    }
    void go();
  }

  /**
   * A press that waited for the shop's price goes on with it: where the shop priced nothing, its answer says why; where it was
   * made on no total at all, the total is shown and nothing sent — the buyer presses on what they see; where the total is not
   * the one the press was made on, the buyer is told and presses again on the new one.
   * @param {number | null} was the total shown when *Pay* was pressed
   */
  function resume(was) {
    if (busy || !fresh || shown === null) return;
    // Pressed on no total — the step still being priced as it opened, or after a price that failed or was refused: the total
    // is shown now, and nothing is sent until the buyer presses on it (N1).
    if (was === null) return;
    if (shown !== was) {
      say(words['error.total']);
      return;
    }
    void go();
  }

  /** The press: the details it cannot go without, then the same press for the same body (Ruling 223), or a new one. */
  async function go() {
    if (busy || priced === null || view === null || shown === null) return;
    unblame(undefined);
    const { buyer, address: where } = details();
    if (blameAll(missingDetails(buyer, where))) return;
    const order = { ...priced, method: view.method };
    const given = { buyer, address: where, total: shown, locale, return: back, turnstile: token };
    const what = sentOf(order, given);
    const now = Date.now();
    // The press kept, where this is the same body within its hold; else a new one. An order's token is asked for only so:
    // the step priced, and its total the one the order was made at (Ruling 225).
    const press = pressFor(storedPress(), what, now);
    // A call that carries the cart waits for the challenge's token; the order's token alone holds nothing, and needs none.
    if (press.order === '' && unchallenged()) {
      say(words['error.challenge']);
      return;
    }
    await send(keptPress(press, what, now), order, given);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onPay();
  });
  // A fault goes as its field is changed.
  form.addEventListener('input', (event) => {
    const target = /** @type {any} */ (event.target);
    if (blamed.some((one) => one.field === target)) unblame(target);
  });

  /** The step opened: shown, the focus on its heading, and the cart priced again as it is stored. */
  function open() {
    form.hidden = false;
    opening.focus();
    void offerChallenge();
    void price();
  }

  /** The cart changed — here, or in another tab — while the step is open: priced again, so the total is the cart's as shown. */
  function changed() {
    if (!form.hidden) void price();
  }

  // The cart hands on or changes, or the page comes back from the browser's cache — from Stripe's page, without paying.
  // The listeners go with the markup.
  const stop = new AbortController();
  const heard = (when) => (event) => {
    if (!form.isConnected) stop.abort();
    else when(event);
  };
  const options = { signal: stop.signal };
  document.addEventListener('jtk:to-checkout', heard((event) => event.detail === key && open()), options);
  document.addEventListener('jtk:cart', heard((event) => event.detail === key && !echo && changed()), options);
  window.addEventListener('storage', heard((event) => (event.key === key || event.key === null) && changed()), options);
  window.addEventListener('pageshow', heard((event) => {
    if (!event.persisted) return;
    busy = false;
    wanted = false;
    paying(false);
    if (form.dataset.state === 'paying') form.dataset.state = shown === null ? 'failed' : 'stale';
    fresh = false;
    hold();
    if (!form.hidden) void price();
  }), options);
}

/**
 * Wires every checkout form under a root that is not wired yet.
 * @param {ParentNode} [root]
 */
function wireAll(root = document) {
  if (root instanceof HTMLFormElement && root.matches('form[data-checkout]')) wireCheckout(root);
  for (const form of /** @type {NodeListOf<HTMLFormElement>} */ (root.querySelectorAll('form[data-checkout]'))) wireCheckout(form);
}

/**
 * `<jtk-checkout>` wraps the form `Checkout.astro` wrote and wires it when it
 * reaches the document — on load, and when the panel places the markup later.
 */
export class JtkCheckout extends BaseElement {
  connectedCallback() {
    wireAll(/** @type {any} */ (this));
  }
}

/** @param {string} [name] */
export function defineCheckout(name = 'jtk-checkout') {
  defineOnce(name, /** @type {any} */ (JtkCheckout));
}

if (typeof document !== 'undefined') {
  defineCheckout();
  // A form written bare, outside the element: wired at load, and again on markup the panel places.
  onAlive('form[data-checkout]', (form) => wireCheckout(/** @type {HTMLFormElement} */ (form)));
}
