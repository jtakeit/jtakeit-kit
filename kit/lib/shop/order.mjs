/**
 * The page after payment: what a buyer sees when Stripe sends them back, read
 * from the order's token alone (`GET /api/order?token=<order>`,
 * docs/reference/shop-protocol.md of the platform, *The page after payment*).
 *
 * The checkout's `return` is a path on the site, and Stripe sends the buyer to
 * it with `order=<token>` on its address — and `left=1` where they left
 * Stripe's page without paying. The page needs nothing else: it may be opened
 * on another device, or long after, with no cart there, and it shows what the
 * order is — its lines as they were frozen, what they came to and the
 * method's name, never the buyer's contact or address, which the answer does
 * not carry — and asks again until the order is paid, lapsed or cancelled.
 *
 *   waiting    Stripe has not said: a buyer who has just paid is here for a
 *              moment, and one who left is here for good. Asked again every
 *              `ASK_EVERY_MS`, at most `ASKS_MOST` times — two minutes — and
 *              then said and stopped, with Stripe's page still offered where
 *              the answer carries it
 *   paid       its number; the cart is emptied — the one thing the page does
 *              to the browser, and it never reads the cart to decide
 *   lapsed     the payment page expired, or the order was given up: nothing was
 *              taken, and the cart is kept, to pay again
 *   cancelled  paid and refunded in full: its number is still its own, and the
 *              cart is kept
 *   unknown    a token that is nobody's — or none on the address: said, and
 *              nothing is asked
 *
 * Pure and framework-free, as the cart and the checkout are: the element
 * (elements/shop-order.js) asks, draws what `orderView` says and empties the
 * cart.
 */

/** How long the page waits between two asks of a waiting order, in milliseconds. */
export const ASK_EVERY_MS = 3000;
/** How many times it asks at most: forty, every three seconds, is two minutes; then it says so and stops. */
export const ASKS_MOST = 40;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/**
 * @typedef {'waiting' | 'paid' | 'lapsed' | 'cancelled' | 'unknown'} OrderState
 * @typedef {{
 *   state: OrderState;
 *   word: string;
 *   number?: number;
 *   payUrl?: string;
 *   emptiesCart: boolean;
 *   askAgain: boolean;
 * }} OrderView
 */

/**
 * Where an order is asked, from the address the buyer is on: the shop's
 * `order` at the page's api base with the order's token — `order=<token>` on
 * the page's own query is `token=<token>` on the shop's. Nothing else of the
 * query goes (`left` is the page's own). `null` where the address names no
 * order.
 *
 * @param {string} api the base of the site's addresses, as the pieces carry it in `data-api`
 * @param {string | undefined} search the page's query, `?order=T9&left=1`
 * @returns {string | null}
 */
export function orderAddress(api, search) {
  const token = new URLSearchParams(String(search ?? '')).get('order')?.trim() ?? '';
  if (token === '') return null;
  return `${String(api).replace(/\/?$/, '/')}order?token=${encodeURIComponent(token)}`;
}

/** Stripe's page for a buyer to go back to paying, where the answer gives one: an address of the web, and nothing a link could run. */
function stripePage(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined;
}

/**
 * What the page after payment shows and does for the shop's answer.
 *
 *   404                 `unknown`, and asking stops
 *   waiting             `state.left` where the buyer came back from Stripe's
 *                       page without paying, `state.waiting` otherwise;
 *                       `payUrl` while the answer carries it; asked again
 *                       while `asked` < `ASKS_MOST`, then `state.stillWaiting`,
 *                       stopped, the `payUrl` kept
 *   paid                its number, and `emptiesCart` — a cart already empty
 *                       included
 *   lapsed, cancelled   said, the cart kept, to pay again; a cancelled order
 *                       has the number it had
 *   no answer           asked again, as if waiting: the network gone, a
 *                       gateway's page, a rate limiter, any answer that is not
 *                       the shop's — and so is a state this kit does not know
 *
 * @param {{ status: number; body: any } | null | undefined} answer what `ask` gave: null where nothing answered
 * @param {{ left: boolean }} query what the page's address says: the buyer came back from Stripe's page without paying
 * @param {number} asked how many times the shop has been asked, this answer's ask included
 * @returns {OrderView}
 */
export function orderView(answer, query, asked) {
  if (answer?.status === 404) return { state: 'unknown', word: 'state.unknown', emptiesCart: false, askAgain: false };
  const body = answer?.status === 200 && isObject(answer.body) ? answer.body : null;
  const number = Number.isInteger(body?.number) && body.number > 0 ? body.number : undefined;
  const given = (state, word, extra = {}) => ({ state, word, ...extra, emptiesCart: state === 'paid', askAgain: false });
  if (body?.state === 'paid') return given('paid', 'state.paid', number === undefined ? {} : { number });
  if (body?.state === 'lapsed') return given('lapsed', 'state.lapsed');
  if (body?.state === 'cancelled') return given('cancelled', 'state.cancelled', number === undefined ? {} : { number });
  // Waiting, or nothing that says otherwise: asked again until the two minutes are over.
  const payUrl = body?.state === 'waiting' ? stripePage(body.pay_url) : undefined;
  const more = asked < ASKS_MOST;
  return {
    state: 'waiting',
    word: more ? (query.left ? 'state.left' : 'state.waiting') : 'state.stillWaiting',
    ...(payUrl === undefined ? {} : { payUrl }),
    emptiesCart: false,
    askAgain: more,
  };
}

/**
 * @typedef {{ name: string; value: string; adds: number }} FrozenAnswer
 * @typedef {{ title: string; labels: string[]; answers: FrozenAnswer[]; qty: number; total: number | undefined }} FrozenLine
 * @typedef {{ lines: FrozenLine[]; subtotal: number | undefined; shipping: number | undefined; total: number | undefined; currency: string; method: string; pickup: boolean }} FrozenOrder
 */

/**
 * The order as the shop froze it, held to what the page draws: its lines — the
 * title, the labels, the answers with what they add, how many and what they
 * came to — the subtotal, the shipping, the total, the currency and the
 * method's name. Nothing else of the answer is read; a part that is not what
 * it should be is not there, whatever wrote it. `null` for an answer that
 * holds no lines.
 *
 * @param {any} body the order's answer
 * @param {string} yes the page's word for a customization ticked, which the answer says by `ticked`
 * @returns {FrozenOrder | null}
 */
export function frozenOrder(body, yes) {
  if (!isObject(body) || !Array.isArray(body.lines)) return null;
  const lines = body.lines.filter(isObject).map((line) => ({
    title: typeof line.title === 'string' ? line.title : '',
    labels: Array.isArray(line.labels) ? line.labels.filter((one) => typeof one === 'string' && one !== '') : [],
    answers: (Array.isArray(line.answers) ? line.answers.filter(isObject) : [])
      .map((one) => ({
        name: typeof one.name === 'string' ? one.name : '',
        value: one.ticked === true ? yes : typeof one.text === 'string' && one.text !== '' ? one.text : typeof one.label === 'string' ? one.label : '',
        adds: finite(one.adds) ?? 0,
      }))
      .filter((one) => one.value !== ''),
    qty: Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 0,
    total: finite(line.total),
  }));
  return {
    lines,
    subtotal: finite(body.subtotal),
    shipping: finite(body.shipping),
    total: finite(body.total),
    currency: typeof body.currency === 'string' ? body.currency : '',
    method: typeof body.method === 'string' ? body.method : '',
    pickup: body.pickup === true,
  };
}

/** Every word the page after payment may say, for a page to hand its element and a test to hold in every language. */
export const ORDER_WORDS = Object.freeze([
  'loading',
  'orderNumber',
  'quantity',
  'free',
  'yes',
  'orderCartKept',
  'state.waiting',
  'state.left',
  'state.paid',
  'state.lapsed',
  'state.cancelled',
  'state.unknown',
  'state.stillWaiting',
]);
