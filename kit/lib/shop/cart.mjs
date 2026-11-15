/**
 * The cart a visitor keeps in the browser, as the protocol's lines and
 * nothing else.
 *
 * `localStorage["jtk:cart:" + api]` holds `{ v: 1, lines: [{ product,
 * variant, qty, answers }], country, method }`: a line is the one `POST
 * /api/shipping` and `POST /api/checkout` take (docs/reference/shop-protocol.md
 * of the platform), with no title and no price on it, so a cart kept for a
 * week can say nothing stale. Whatever the cart shows is the last shipping
 * answer; a line the shop no longer sells is refused there, with its reason.
 *
 * Pure and framework-free: every function takes a cart and gives a new one,
 * and what is read from storage is held to the shape whatever was written
 * there — by an older kit, by another page of the site, or by hand.
 */

/** The most lines the protocol takes in a cart. */
export const MAX_LINES = 100;
/** The most of one variant a line asks. */
export const MAX_QTY = 999;

/**
 * @typedef {{ product: string; variant: string; qty: number; answers: Record<string, string | boolean> }} CartLine
 * @typedef {{ v: 1; lines: CartLine[]; country: string; method: string }} Cart
 */

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Where a site's cart is kept: one a site, and a preview's `/p/<slug>/api/` a
 * cart of its own.
 *
 * @param {string} api the base of the site's addresses, as the pieces carry it in `data-api`
 */
export function cartKey(api) {
  return `jtk:cart:${api}`;
}

/** An empty cart: a fresh one each time. @returns {Cart} */
function empty() {
  return { v: 1, lines: [], country: '', method: '' };
}

/**
 * The answers a line keeps: a choice's `_key` or a text, or `true` — the three
 * things the protocol takes. An empty text and `false` are no answer, so a
 * line that says one and a line that does not are the same line.
 */
function answersOf(raw) {
  /** @type {Record<string, string | boolean>} */
  const answers = {};
  if (!isObject(raw)) return answers;
  for (const [key, value] of Object.entries(raw)) {
    if (value === true || (typeof value === 'string' && value.trim() !== '')) answers[key] = value;
  }
  return answers;
}

/** A quantity as a whole number of 1 to MAX_QTY, or 0 for one that is no quantity. */
function qtyOf(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  const whole = Math.trunc(raw);
  return whole < 1 ? 0 : Math.min(whole, MAX_QTY);
}

/**
 * A line held to the protocol's four keys, or nothing for one that names no
 * product or variant, or asks for none.
 *
 * @param {unknown} raw
 * @returns {CartLine | undefined}
 */
function lineOf(raw) {
  if (!isObject(raw)) return undefined;
  const { product, variant } = raw;
  if (typeof product !== 'string' || product === '' || typeof variant !== 'string' || variant === '') return undefined;
  const qty = qtyOf(raw.qty);
  return qty === 0 ? undefined : { product, variant, qty, answers: answersOf(raw.answers) };
}

/** Whether two lines are the same thing to buy: product, variant and every answer. */
function same(a, b) {
  if (a.product !== b.product || a.variant !== b.variant) return false;
  const left = Object.entries(a.answers);
  return left.length === Object.keys(b.answers).length && left.every(([key, value]) => Object.hasOwn(b.answers, key) && b.answers[key] === value);
}

/**
 * The cart a storage value holds. Anything that is not a cart of this
 * version, and anything that is not JSON, is an empty cart; a line keeps the
 * protocol's four keys and nothing else, one with no quantity is left out,
 * one past 999 is 999, and lines past the hundredth are left out.
 *
 * @param {string | null | undefined} stored what `localStorage.getItem` gave
 * @returns {Cart}
 */
export function readCart(stored) {
  let parsed;
  try {
    parsed = JSON.parse(stored ?? 'null');
  } catch {
    return empty();
  }
  if (!isObject(parsed) || parsed.v !== 1) return empty();
  const lines = Array.isArray(parsed.lines) ? parsed.lines.map(lineOf).filter((one) => one !== undefined).slice(0, MAX_LINES) : [];
  return {
    v: 1,
    lines: /** @type {CartLine[]} */ (lines),
    country: typeof parsed.country === 'string' ? parsed.country : '',
    method: typeof parsed.method === 'string' ? parsed.method : '',
  };
}

/** A line copied, its answers too: a cart handed back is never the one that was given. */
const copied = (line) => ({ ...line, answers: { ...line.answers } });

/**
 * A line added: the same product, variant and answers add up, to MAX_QTY; a
 * new one goes last. A cart already at MAX_LINES takes no new line, and a line
 * that is none is not added.
 *
 * @param {Cart} cart
 * @param {CartLine} line
 * @returns {Cart}
 */
export function addLine(cart, line) {
  const lines = cart.lines.map(copied);
  const one = lineOf(line);
  if (one === undefined) return { ...cart, lines };
  const at = lines.findIndex((kept) => same(kept, one));
  if (at >= 0) lines[at].qty = Math.min(lines[at].qty + one.qty, MAX_QTY);
  else if (lines.length < MAX_LINES) lines.push(one);
  return { ...cart, lines };
}

/**
 * A line taken out. A place that is no line leaves the cart as it is.
 *
 * @param {Cart} cart
 * @param {number} at the line's place, from 0
 * @returns {Cart}
 */
export function removeLine(cart, at) {
  return { ...cart, lines: cart.lines.filter((_, i) => i !== at).map(copied) };
}

/**
 * A line's quantity set: 0, or less, takes the line out; more than MAX_QTY is
 * MAX_QTY; what is no number leaves the cart as it is.
 *
 * @param {Cart} cart
 * @param {number} at the line's place, from 0
 * @param {number} qty
 * @returns {Cart}
 */
export function setQty(cart, at, qty) {
  if (typeof qty !== 'number' || !Number.isFinite(qty)) return { ...cart, lines: cart.lines.map(copied) };
  const whole = qtyOf(qty);
  if (whole === 0) return removeLine(cart, at);
  return { ...cart, lines: cart.lines.map((kept, i) => ({ ...copied(kept), qty: i === at ? whole : kept.qty })) };
}

/**
 * What `POST /api/shipping` takes for this cart: its lines, the country the
 * buyer chose, and the language the page is in. Nothing else of the cart
 * goes: the method is the checkout's.
 *
 * @param {Cart} cart
 * @param {string} locale the page's language, a tag such as `en` or `fr-CH`
 * @returns {{ lines: CartLine[]; country: string; locale: string }}
 */
export function shippingBody(cart, locale) {
  return { lines: cart.lines.map(copied), country: cart.country, locale };
}
