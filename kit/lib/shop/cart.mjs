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
 *
 * `cartView` is the other half: the cart and the shop's last shipping answer
 * read together into what the page shows, as one value the element draws.
 */
import { shopWordsFor } from './words.mjs';

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

/**
 * @typedef {{ code: string; word: string }} Refusal
 * @typedef {{ at: number; line: CartLine; quoted?: { title: string; labels: string[]; answers: object[]; unit: number; total: number }; refused?: Refusal }} CartRow
 */

/** What the shop says of a refused line in the page's language; a code the kit has no word for says the order has changed. */
function refusal(words, code) {
  return { code, word: words[`refused.${code}`] ?? words['error.refused'] };
}

/**
 * What a cart shows once the shop has priced it: the answer of `POST
 * /api/shipping` for this cart, read against the cart's own lines.
 *
 * A row for each line of the cart, in its order — its place `at`, the line as
 * the cart keeps it, and either what the shop priced it at (`quoted`) or why it
 * would not (`refused`, in the page's language). The cart holds no title and no
 * price, so every word and every amount here is the shop's, as of its answer.
 *
 * The method is the cart's while the country is still offered it, else the
 * first the shop offers — a cart carried to another country, or one whose
 * method was taken off, is never left choosing nothing. `abroad` is the shop's,
 * except that a pick-up crosses no border. `ready` is whether the buyer may go
 * on to pay: every line priced, nothing refused (a line, or the whole cart),
 * and a method to send it by.
 *
 * @param {Cart} cart
 * @param {any} quote the shipping answer; anything that is no answer reads as the shop having priced nothing
 * @param {string} locale the page's language, a tag such as `en` or `fr-CH`
 */
export function cartView(cart, quote, locale) {
  const words = shopWordsFor(locale);
  const answer = isObject(quote) ? quote : {};
  const priced = Array.isArray(answer.lines) ? answer.lines.filter(isObject) : [];
  const refused = Array.isArray(answer.refused) ? answer.refused.filter(isObject) : [];
  const rows = cart.lines.map((one, at) => {
    const row = { at, line: copied(one) };
    const why = refused.find((each) => each.line === at);
    const line = priced.find((each) => each.line === at);
    if (why !== undefined) return { ...row, refused: refusal(words, String(why.code)) };
    if (line === undefined) return row;
    return {
      ...row,
      quoted: {
        title: String(line.title ?? ''),
        labels: Array.isArray(line.labels) ? line.labels.map(String) : [],
        answers: Array.isArray(line.answers) ? line.answers.filter(isObject).map((each) => ({ ...each })) : [],
        unit: Number(line.unit),
        total: Number(line.total),
      },
    };
  });
  const whole = refused.find((each) => each.line === -1);
  const methods = (Array.isArray(answer.methods) ? answer.methods.filter(isObject) : []).map((one) => ({
    method: String(one.method),
    name: String(one.name ?? ''),
    pickup: one.pickup === true,
    price: Number(one.price),
    free: one.free === true,
  }));
  const chosen = methods.find((one) => one.method === cart.method) ?? methods[0];
  return {
    rows,
    ...(whole === undefined ? {} : { whole: refusal(words, String(whole.code)) }),
    subtotal: Number(answer.subtotal) || 0,
    currency: typeof answer.currency === 'string' ? answer.currency : '',
    methods,
    method: chosen?.method ?? '',
    abroad: answer.abroad === true && chosen?.pickup !== true,
    vat: answer.vat_included === true,
    ownCurrency: answer.own_currency === true,
    sends: answer.sends === true,
    cannotSend: answer.cannot_send === true,
    ready: rows.length > 0 && refused.length === 0 && rows.every((row) => row.quoted !== undefined) && chosen !== undefined,
  };
}
