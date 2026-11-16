/**
 * `<jtk-order>` — the page after payment, made to work: the order read from
 * its token alone and asked after until it is paid, lapsed or cancelled,
 * Stripe's page offered again while it waits, the cart emptied once it is paid,
 * and — after two minutes of asking — said to be still waiting, and stopped.
 *
 * The whole client of the page, and no rule of the shop's: what the answer
 * means is `orderView`'s (lib/shop/order.mjs), and what the buyer is shown of
 * the order is what the shop froze — never the buyer's contact or address,
 * which the answer does not carry.
 *
 *   GET /api/order?token=<order>   → { state, number?, lines, subtotal, shipping, total, currency, method, pickup, pay_url? }
 *
 * asked over the shop's wire (`ask`, shop-wire.js: `X-Jtk-Shop: 1`, never
 * cached) at the address `orderAddress` makes of the page's own: Stripe sends the
 * buyer to the checkout's `return` with `order=<token>` on it, and `left=1` where
 * they left Stripe's page without paying. A page with no `order` on its address
 * asks nothing and says no order was found.
 *
 * ── how a page gets it ──────────────────────────────────────────────────────
 *
 * Import this module once on the page and every `[data-order]` is wired: one
 * inside a `<jtk-order>` by the element's own lifecycle, which also covers
 * markup the panel places later (`fl:placed`), and one written bare by
 * `onAlive`. The markup is the site's — the scaffold's
 * `src/components/shop/OrderAfter.astro`, copied and dressed — and the element
 * finds everything in it by a `data-*` hook, never by a class: the list is
 * `@jtakeit/kit/shop/hooks` (`ORDER`). A hook left out is said in the console.
 *
 * The root carries the site's api base as `data-api`, the page's language as
 * `data-locale` and the words the markup was written in as `data-words`
 * (`shopWordsFor`, which the element reads under them for any the page left
 * out). It says what it is drawing in `data-state`, for the site's CSS and for
 * a walk:
 *
 *   loading    the first answer is awaited (and `aria-busy`)
 *   waiting    Stripe has not said; the page asks again every three seconds
 *   stopped    the same, after two minutes of asking: said so, and no more asked
 *   paid       with its number; the cart has been emptied
 *   lapsed     nothing was taken; the cart is kept, to pay again
 *   cancelled  paid and refunded in full; the cart is kept
 *   unknown    nobody's token, or none on the address
 *
 * and `data-asked`, how many times the shop has been asked and has answered.
 *
 * ── what it does ────────────────────────────────────────────────────────────
 *
 *   - says what the order is in `[data-order-state]` (a status, written only
 *     when it changes, so a reader is not told the same again every three
 *     seconds), its number in `[data-order-number]` once it is paid, and draws
 *     the lines as they were frozen into `[data-order-lines]`, what they came
 *     to in `[data-order-total]` and the method — its name and what it cost —
 *     in `[data-order-method]`;
 *   - links `[data-pay-again]` to Stripe's page while the answer carries one, and
 *     `[data-back-to-cart]` where the cart is to pay with: a buyer who left Stripe's
 *     page, one whose order is still not confirmed, and an order lapsed,
 *     cancelled or not found;
 *   - once the order is paid, empties this device's cart — the one thing it does
 *     to the browser — but only for the press that went to Stripe from this tab
 *     (Ruling 227): the checkout marks the order it sent the buyer to pay for in
 *     `sessionStorage[paidFromKey(api)]`, and the page empties the cart only where
 *     its token is that one, and forgets the mark. A paid order's link opened later,
 *     on another device or in another tab, leaves the cart there. It never reads the
 *     cart: it decides nothing by it. A browser that will not let it empty the cart,
 *     or will not say whether the order is this tab's, keeps the cart and says so
 *     (`orderCartKept`).
 *
 * The asking is one loop: every `ASK_EVERY_MS`, each ask given `ASK_DEADLINE_MS` to
 * answer — one that has not by then is no answer, and the loop goes on, so that a
 * request that never answers cannot hold the page at *loading* — at most `ASKS_MOST` times, and
 * never while the tab is hidden — a tab shown again asks once it has waited out
 * the three seconds since its last ask, and carries on — and never after it has
 * stopped, or been shown again after it did. A page the browser restores from
 * its cache is the same as a tab shown again.
 */
import { money } from '../lib/money.mjs';
import { shopWordsFor } from '../lib/shop/words.mjs';
import { ORDER, lacking } from '../lib/shop/hooks.mjs';
import { cartKey } from '../lib/shop/cart.mjs';
import { ASK_DEADLINE_MS, ASK_EVERY_MS, frozenOrder, orderAddress, orderView, paidFromKey, sentFromHere } from '../lib/shop/order.mjs';
import { BaseElement, ask, defineOnce, parsed, putBase } from './shop-wire.js';
import { onAlive } from './alive.js';

export { SHOP_PROTOCOL, ask } from './shop-wire.js';

/** The rules the behaviour cannot work without: `putBase` in shop-wire.js says what they are for. */
const BASE = `
[data-order] [hidden] { display: none !important; }
:where([data-order] :focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
`;

/** The words after which the cart is where a buyer goes next: they left, are not confirmed, or the order is not to be paid. */
const CART_NEXT = new Set(['state.left', 'state.stillWaiting', 'state.lapsed', 'state.cancelled', 'state.unknown']);

/** A part the element draws: marked by a data attribute, never a class, so the site's CSS can find it. */
function part(tag, name, text) {
  const node = document.createElement(tag);
  node.setAttribute(`data-${name}`, '');
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Text written only where it differs: a status read aloud is not read again for the same words. */
function put(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

/**
 * Wires one order's `[data-order]`. Idempotent: an order already wired is left alone.
 * @param {HTMLElement} root
 */
export function wireOrder(root) {
  if (root.dataset.jtkWired === '1') return;
  root.dataset.jtkWired = '1';
  putBase('order', BASE);
  const missing = lacking(root, ORDER);
  if (missing.length > 0) console.error(`order: its markup has no ${missing.join(', ')}, and cannot work without them — the hooks are listed in @jtakeit/kit/shop/hooks`);

  const locale = root.dataset.locale ?? 'en';
  const api = root.dataset.api ?? '/api/';
  /** @type {Record<string, string>} */
  const words = { ...shopWordsFor(locale), ...parsed(root.dataset.words, {}) };

  /** @type {HTMLElement | null} */ const stated = root.querySelector('[data-order-state]');
  /** @type {HTMLElement | null} */ const lines = root.querySelector('[data-order-lines]');
  /** @type {HTMLElement | null} */ const total = root.querySelector('[data-order-total]');
  /** @type {HTMLElement | null} */ const number = root.querySelector('[data-order-number]');
  /** @type {HTMLElement | null} */ const method = root.querySelector('[data-order-method]');
  /** @type {HTMLElement | null} */ const again = root.querySelector('[data-pay-again]');
  /** @type {HTMLElement | null} */ const back = root.querySelector('[data-back-to-cart]');
  if (again && !(again instanceof HTMLAnchorElement)) console.error('order: its [data-pay-again] is no link (<a>), and cannot take the buyer back to Stripe\'s page');

  // The state is read as it changes, whatever the copy kept.
  if (stated && !stated.getAttribute('role')) stated.setAttribute('role', 'status');

  // ── what the address says ───────────────────────────────────────────────
  const query = new URLSearchParams(location.search);
  const address = orderAddress(api, location.search);
  const left = query.get('left') === '1';
  /**
   * Whether this tab's press went to Stripe with this order (Ruling 227): the mark the checkout wrote. Read once, as the page loads —
   * the tab is the buyer's, and the mark was written before they left. A tab that will not say is none, and said once a paid
   * order would have emptied the cart.
   */
  let mine = false;
  let unreadable = false;
  if (address !== null) {
    try {
      mine = sentFromHere(sessionStorage.getItem(paidFromKey(api)), (query.get('order') ?? '').trim());
    } catch (why) {
      unreadable = true;
      console.error(`order: the browser would not say whether this tab sent the buyer to pay for this order (${why instanceof Error ? why.message : String(why)})`);
    }
  }

  // ── what is drawn ───────────────────────────────────────────────────────
  /** What the lines were drawn from, so a waiting order asked again every three seconds is not redrawn for nothing. */
  let drawn = '';
  /** Whether the cart could not be emptied, and the buyer is told. */
  let kept = false;
  let currency = '';
  const say = (minor) => {
    try {
      return money(minor, currency || undefined, locale);
    } catch {
      // A currency the browser does not know: the amount, and no sign made up.
      return money(minor, undefined, locale);
    }
  };
  const itemTag = () => (lines instanceof HTMLUListElement || lines instanceof HTMLOListElement ? 'li' : 'div');
  const answerSaid = (one) => `${one.name === '' ? '' : `${one.name}: `}${one.value}${one.adds !== 0 ? ` (+ ${say(one.adds)})` : ''}`;

  function drawLines(frozen) {
    if (!lines) return;
    const key = JSON.stringify(frozen.lines);
    if (key === drawn) return;
    drawn = key;
    const item = itemTag();
    lines.replaceChildren(
      ...frozen.lines.map((line) => {
        const row = part(item, 'order-line');
        row.append(part('p', 'order-line-title', line.title));
        if (line.labels.length > 0) row.append(part('p', 'order-line-labels', line.labels.join(' · ')));
        if (line.answers.length > 0) {
          const list = part('ul', 'order-line-answers');
          for (const one of line.answers) list.append(part('li', 'order-line-answer', answerSaid(one)));
          row.append(list);
        }
        if (line.qty > 0) row.append(part('p', 'order-line-qty', `${words.quantity}: ${line.qty}`));
        if (line.total !== undefined) row.append(part('p', 'order-line-total', say(line.total)));
        return row;
      }),
    );
  }

  /** The order as the shop froze it: its lines, what they came to and the method, with what the method cost. */
  function drawOrder(frozen) {
    currency = frozen.currency;
    drawLines(frozen);
    put(total, frozen.total === undefined ? '' : say(frozen.total));
    const cost = frozen.shipping === undefined ? '' : frozen.shipping === 0 ? words.free : say(frozen.shipping);
    put(method, frozen.method === '' ? '' : cost === '' ? frozen.method : `${frozen.method}: ${cost}`);
  }

  function clearOrder() {
    drawn = '';
    lines?.replaceChildren();
    put(total, '');
    put(method, '');
  }

  /**
   * What the order is, the number, Stripe's page and the way to the cart, for what the shop answered. An answer that is
   * not the shop's — none, a gateway's page — says only what the page is doing: what the last answer drew stays.
   */
  function show(view, answer) {
    root.removeAttribute('aria-busy');
    root.dataset.state = view.state === 'waiting' && !view.askAgain ? 'stopped' : view.state;
    put(stated, `${words[view.word]}${kept ? `. ${words.orderCartKept}` : ''}`);
    if (back) back.hidden = !CART_NEXT.has(view.word);
    const body = answer?.status === 200 ? answer.body : null;
    // The shop's answer is one that says a state it knows: its number and Stripe's page do not wait on its lines.
    const usable = ['waiting', 'paid', 'lapsed', 'cancelled'].includes(body?.state);
    if (view.state !== 'unknown' && !usable) return;
    const frozen = usable ? frozenOrder(body, words.yes) : null;
    if (frozen !== null) drawOrder(frozen);
    else if (!usable) clearOrder();
    if (number) {
      if (view.number === undefined) number.hidden = true;
      else {
        put(number, words.orderNumber.replace('{number}', () => String(view.number)));
        number.hidden = false;
      }
    }
    if (again) {
      if (view.payUrl === undefined) {
        again.hidden = true;
        again.removeAttribute('href');
      } else {
        // The order's token is on this page's address: not told to Stripe's page it is sent to.
        if (again.getAttribute('href') !== view.payUrl) again.setAttribute('href', view.payUrl);
        again.setAttribute('rel', 'noreferrer');
        again.hidden = false;
      }
    }
  }

  /**
   * Empties the cart: the one thing this page does to the browser. Never read, only emptied — and only for the order this tab's press
   * went to Stripe with, whose mark is spent: the same page opened again, or the order's link opened elsewhere, keeps the cart.
   */
  function emptyCart() {
    try {
      localStorage.removeItem(cartKey(api));
    } catch (why) {
      console.error(`order: the browser would not let this page empty the cart (${why instanceof Error ? why.message : String(why)})`);
      kept = true;
      return;
    }
    try {
      sessionStorage.removeItem(paidFromKey(api));
    } catch (why) {
      console.error(`order: the browser would not let this page forget the mark of the order (${why instanceof Error ? why.message : String(why)})`);
    }
  }

  // ── asking the shop ─────────────────────────────────────────────────────
  let asked = 0;
  let inflight = false;
  let stopped = false;
  /** When the shop last answered, in milliseconds: the three seconds are counted from there. */
  let lastAt = Number.NEGATIVE_INFINITY;
  /** @type {ReturnType<typeof setTimeout> | undefined} the one timer the loop has */
  let timer;
  const stop = new AbortController();

  /** Ask again after what is left of the three seconds; at once where they are over; not while the tab is hidden. */
  function later() {
    clearTimeout(timer);
    timer = undefined;
    if (stopped || document.hidden) return;
    if (!root.isConnected) {
      stopped = true;
      stop.abort();
      return;
    }
    const wait = Math.min(ASK_EVERY_MS, Math.max(0, lastAt + ASK_EVERY_MS - Date.now()));
    if (wait === 0) void check();
    else {
      timer = setTimeout(() => {
        timer = undefined;
        void check();
      }, wait);
    }
  }

  async function check() {
    if (stopped || inflight || address === null) return;
    inflight = true;
    asked += 1;
    // The address is whole — `orderAddress` made it of the page's api base — so it is asked at the site's root. An ask that has
    // not answered in its deadline is no answer (Ruling 228): the loop goes on, and the stop is reached.
    const deadline = new AbortController();
    const giveUp = setTimeout(() => deadline.abort(), ASK_DEADLINE_MS);
    const answer = await ask('/', address, { signal: deadline.signal });
    clearTimeout(giveUp);
    inflight = false;
    lastAt = Date.now();
    if (!root.isConnected) {
      stopped = true;
      stop.abort();
      return;
    }
    const view = orderView(answer, { left, mine }, asked);
    // Emptied before it is said paid, so that the page that says it has nothing left in the cart to be paid for again.
    if (view.emptiesCart) emptyCart();
    // A tab that would not say whether the order is its own keeps the cart, and the buyer is told so.
    else if (view.state === 'paid' && unreadable) kept = true;
    show(view, answer);
    if (view.askAgain) later();
    else stopped = true;
    root.dataset.asked = String(asked);
  }

  // The tab hidden asks nothing; shown again, it asks once the three seconds are over. A page restored from the browser's cache
  // is the same. Neither starts a loop: there is one timer, and nothing after the page has stopped.
  const heard = (when) => (event) => {
    if (!root.isConnected) stop.abort();
    else when(event);
  };
  const options = { signal: stop.signal };
  document.addEventListener('visibilitychange', heard(() => later()), options);
  window.addEventListener('pageshow', heard((event) => event.persisted && later()), options);

  if (address === null) {
    // No order on the address: nobody's, and nothing to ask.
    show(orderView({ status: 404, body: null }, { left }, 0), null);
    stopped = true;
    return;
  }
  root.dataset.state = 'loading';
  root.setAttribute('aria-busy', 'true');
  put(stated, words.loading);
  void check();
}

/**
 * `<jtk-order>` wraps the page `OrderAfter.astro` wrote and wires it when it
 * reaches the document — on load, and when the panel places the markup later.
 */
export class JtkOrder extends BaseElement {
  connectedCallback() {
    const self = /** @type {any} */ (this);
    if (self.matches('[data-order]')) wireOrder(self);
    for (const root of /** @type {NodeListOf<HTMLElement>} */ (self.querySelectorAll('[data-order]'))) wireOrder(root);
  }
}

/** @param {string} [name] */
export function defineOrder(name = 'jtk-order') {
  defineOnce(name, /** @type {any} */ (JtkOrder));
}

if (typeof document !== 'undefined') {
  defineOrder();
  // An order page written bare, outside the element: wired at load, and again on markup the panel places.
  onAlive('[data-order]', (root) => wireOrder(/** @type {HTMLElement} */ (root)));
}
