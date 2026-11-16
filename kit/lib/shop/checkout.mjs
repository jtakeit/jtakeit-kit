/**
 * The checkout step's press: one `attempt` for a press of *Pay* and every
 * retry of it, and what follows each answer the shop's protocol gives the
 * checkout (`POST /api/checkout`, docs/reference/shop-protocol.md of the
 * platform, *Going to pay*).
 *
 * A press is one order. The page makes an `attempt` when the buyer presses
 * *Pay* — random, 16 to 128 letters, digits, `-` and `_`; a
 * `crypto.randomUUID()` is one (Ruling 92) — and sends it again, the same, on
 * every retry of that press: an answer that was lost, or a button pressed
 * twice, is the same order with one hold. Once the shop has made the order
 * and the page was not given Stripe's page, the retry is the order's token
 * alone, `{ order }`, which holds nothing more. A press answered `201` is over;
 * so is one answered with a refusal that says the order is gone, and the next
 * press mints a new `attempt`.
 *
 * A press is for one body (Ruling 223): the cart's lines, its country and
 * method, the buyer, the address and the total shown (Ruling 225) — not the
 * challenge's token, which every call that carries the cart spends anew. Only
 * *Pay* pressed again on the same body is a retry; a body that differs —
 * a line taken out, an email corrected, a total the shop has said again — is a
 * new press, with a new `attempt`. A press is also no older than the hold its
 * order would have, 31 minutes from when it was first sent: past that, any
 * order it made has been given up, and the next press starts afresh.
 *
 * The press in flight is kept in the tab, `sessionStorage["jtk:checkout:" +
 * api]` (`pressKey`), as `{ attempt, order, sent, at }` (`keptPress`), from the
 * moment it is pressed until it is over — so a page reloaded after an answer
 * that was lost asks for the same order, and a page that has sent its buyer to
 * Stripe starts the next press afresh. What it was sent with is kept as a
 * digest of the body (`sentOf`), enough to tell the same body from another
 * and nothing more: a stranger's name, email, phone and address are not left
 * in the tab's storage for as long as a press lives (Ruling 226).
 *
 * Pure and framework-free, as the cart is: the element (elements/shop-checkout.js)
 * reads the storage, asks, and draws what `afterAnswer` says.
 */

/** What an `attempt` is, as the shop holds it (Ruling 92): anything else is refused `400`. */
export const ATTEMPT = /^[A-Za-z0-9_-]{16,128}$/;

/** How long a press is kept: the hold its order would have, 31 minutes (101 §7), in milliseconds. */
export const HOLD = 31 * 60 * 1000;

/**
 * @typedef {string} Sent a digest of what a press was sent with — its body less the token, the return and the language — and nothing of it that can be read back
 * @typedef {{ attempt: string; order: string; sent?: Sent; at?: number }} Press `order` is `''` until the shop has made one; `sent` and `at` (when it was first sent, in milliseconds) once it has been
 * @typedef {import('./cart.mjs').Cart} Cart
 * @typedef {{ name: string; email: string; phone?: string }} Buyer
 * @typedef {{ line1: string; line2?: string; postal_code: string; city: string }} Address
 * @typedef {{ buyer: Buyer; address: Address | null; total: number; locale: string; return: string; turnstile: string }} CheckoutForm
 * @typedef {{ kind: 'go'; url: string }
 *   | { kind: 'paid'; order: string }
 *   | { kind: 'ask_again'; press: Press }
 *   | { kind: 'requote'; press: Press; quote: object; word: string }
 *   | { kind: 'say'; word: string; press: Press | null; fields?: string[] }} Next
 */

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Where a site's press in flight is kept: one a site, and a preview's
 * `/p/<slug>/api/` one of its own, as its cart is.
 *
 * @param {string} api the base of the site's addresses, as the pieces carry it in `data-api`
 */
export function pressKey(api) {
  return `jtk:checkout:${api}`;
}

/** A UUID, version 4: `crypto.randomUUID()` where the page has it, and the same made of random bytes where it has not (a page served over plain http). */
function uuid() {
  const random = globalThis.crypto;
  if (typeof random?.randomUUID === 'function') return random.randomUUID();
  const bytes = random.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((one) => one.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A new press: an `attempt` of its own, and no order yet.
 *
 * @returns {Press}
 */
export function freshPress() {
  return { attempt: uuid(), order: '' };
}

/**
 * The press a buyer's *Pay* goes on with: the one kept, where it is a retry
 * of it — the same body (`sentOf`), within the hold — or a new one. What is
 * kept is held to the shape, whatever wrote it: an `attempt` the shop would
 * refuse is no press, and starts a new.
 *
 * @param {Press | null | undefined} stored what the tab keeps under `pressKey`, read as JSON
 * @param {Sent} [sent] what this *Pay* would send (`sentOf`): a kept press sent with anything else is a new one; left out, only the shape and the age are held
 * @param {number} [now] the time of the press, in milliseconds
 * @returns {Press}
 */
export function pressFor(stored, sent, now = Date.now()) {
  if (!isObject(stored) || typeof stored.attempt !== 'string' || !ATTEMPT.test(stored.attempt)) return freshPress();
  const at = typeof stored.at === 'number' && Number.isFinite(stored.at) ? stored.at : undefined;
  // Past the hold, whatever order the press made has been given up: a retry of it would be answered that it lapsed.
  if (at !== undefined && now - at > HOLD) return freshPress();
  // Ruling 223: a press is for one body, and only the same body is a retry.
  if (sent !== undefined && stored.sent !== sent) return freshPress();
  return {
    attempt: stored.attempt,
    order: typeof stored.order === 'string' ? stored.order.trim() : '',
    ...(typeof stored.sent === 'string' ? { sent: stored.sent } : {}),
    ...(at === undefined ? {} : { at }),
  };
}

/** JSON with every object's keys in order: one text for one value, however its keys were written. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** cyrb53: 53 bits of a text, by its seed — not a secret, only a short name for it that cannot be read back. */
function cyrb53(text, seed) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * What a press is for: the body `checkoutBody` makes of the cart and the form,
 * less what is not the buyer's choice — the challenge's token, spent by every
 * call, the return and the page's language. Two presses sent with the same are
 * one press (Ruling 223), and the total among it (Ruling 225) keeps an order's
 * token from being asked for once the step shows another.
 *
 * Kept as a digest (Ruling 226): two runs of cyrb53 over the body written out
 * the same way whatever order its keys came in — 106 bits, so that two bodies
 * that differ are told apart, and a stranger's details are not kept in the
 * tab. Synchronous, so it is the same on a page served over plain http, where
 * the browser's own digests are not offered.
 *
 * @param {Cart} cart
 * @param {CheckoutForm} form
 * @returns {Sent}
 */
export function sentOf(cart, form) {
  const body = /** @type {any} */ (checkoutBody({ attempt: '', order: '' }, cart, form));
  const text = canonical({ lines: body.lines, country: body.country, method: body.method, buyer: body.buyer, address: body.address ?? null, total: body.total });
  return `b1:${cyrb53(text, 0).toString(16).padStart(14, '0')}${cyrb53(text, 0x9e3779b9).toString(16).padStart(14, '0')}`;
}

/**
 * A press as the tab keeps it once it is sent: the digest of what it was sent
 * with, and when it was first sent — a retry keeps the time of the first, as
 * the order's hold does.
 *
 * @param {Press} press
 * @param {Sent} sent
 * @param {number} [now]
 * @returns {Press}
 */
export function keptPress(press, sent, now = Date.now()) {
  return { attempt: press.attempt, order: press.order, sent, at: press.at ?? now };
}

/**
 * What `POST /api/checkout` is sent for a press: the order's token alone where
 * the shop has made one — a second ask, which carries no cart, holds nothing
 * and passes no challenge — and otherwise the cart, the buyer, the total
 * shown, the press's `attempt`, the return, the page's language and the
 * challenge's token. The buyer's details go as they were typed; a phone and an
 * address's second line left empty are not sent, and a pick-up sends no
 * address.
 *
 * @param {Press} press
 * @param {Cart} cart the cart that was priced, with the country and the method the total is of
 * @param {CheckoutForm} form
 * @returns {object}
 */
export function checkoutBody(press, cart, form) {
  if (press.order !== '') return { order: press.order };
  /** @type {Buyer} */
  const buyer = { name: String(form.buyer.name ?? ''), email: String(form.buyer.email ?? '') };
  if (filled(form.buyer.phone)) buyer.phone = /** @type {string} */ (form.buyer.phone);
  const given = form.address;
  /** @type {Address | undefined} */
  const address = isObject(given)
    ? {
      line1: String(given.line1 ?? ''),
      ...(filled(given.line2) ? { line2: /** @type {string} */ (given.line2) } : {}),
      postal_code: String(given.postal_code ?? ''),
      city: String(given.city ?? ''),
    }
    : undefined;
  return {
    lines: cart.lines.map((line) => ({ product: line.product, variant: line.variant, qty: line.qty, answers: { ...line.answers } })),
    country: cart.country,
    method: cart.method,
    buyer,
    ...(address === undefined ? {} : { address }),
    total: form.total,
    attempt: press.attempt,
    return: form.return,
    locale: form.locale,
    turnstile: form.turnstile,
  };
}

/**
 * The details a press cannot go without, as the shop names them
 * (`buyer.name`, `address.line1`, …): a name, an email with its `@`, and for
 * a delivery the street, the postal code and the city. Only what is plainly
 * missing — the shop checks the rest, and says it (`400 buyer`), so nothing
 * the shop would take is ever held back here.
 *
 * @param {Buyer} buyer
 * @param {Address | null} address `null` for a pick-up, which asks none
 * @returns {string[]} in the protocol's order
 */
export function missingDetails(buyer, address) {
  const missing = [];
  if (!filled(buyer.name)) missing.push('buyer.name');
  if (!filled(buyer.email) || !buyer.email.includes('@')) missing.push('buyer.email');
  if (address === null) return missing;
  for (const key of ['line1', 'postal_code', 'city']) if (!filled(address[key])) missing.push(`address.${key}`);
  return missing;
}

/** The refusals that leave the press as it was: nothing was written that a retry of it could find another way. */
const KEPT = { 403: ['challenge'], 400: ['buyer'] };

/**
 * The refusals after which the order is gone — given up, lapsed, nobody's, or
 * never to be — and the next press is a new one, each with the word it says.
 * `422 address` says the address is to be checked, and the page focuses it.
 */
const GONE = {
  '409 attempt': 'error.attempt',
  '410 lapsed': 'error.lapsed',
  '410 too_late': 'error.too_late',
  '410 too_small': 'error.too_small',
  '422 address': 'address',
  '424 no_payee': 'error.no_payee',
  '404 not_found': 'error.lapsed',
  '400 return': 'error.return',
  '400 nothing_to_pay': 'error.nothing_to_pay',
  '403 showcase': 'error.showcase',
  '500 internal': 'error.internal',
};

/**
 * What follows an answer of `POST /api/checkout` to a press (Ruling 202),
 * every answer the protocol gives the checkout named:
 *
 *   201                                   go: to Stripe's page; the press is over
 *   502 with an order                     ask_again with the order's token alone
 *   502 with none, or no answer           ask_again: the same press, its cart again
 *   409 total · refused · method · short  requote: the same press, the shop's new answer shown
 *   409 paid                              paid: to the order's page; the press is over
 *   403 challenge · 400 buyer · 429       say, the press kept (400 buyer with its fields)
 *   409 attempt · 410 · 422 address ·     say, the press gone: the next press is a new one
 *   424 · 404 not_found · 400 return ·
 *   400 nothing_to_pay · 500 internal ·
 *   a sentence
 *
 * And, outside the table, as safe as it can be for a buyer's money: a `201`
 * that names no Stripe page asks again for its order; every `5xx` but
 * billing's own `500 internal`, and a `408` — a gateway, a timeout, a page of
 * the network's — is an answer that was lost, the order perhaps made; a `429`
 * with no word of the shop's, a rate limiter's, is too many and keeps the
 * press; `403 showcase` is a sample's, which never checks out; any other
 * refusal in JSON keeps the press, so that the next press can never be a
 * second order of the same one. A press kept goes on with what it was sent
 * with, and when (`sent`, `at`).
 *
 * @param {Press} press the press the answer is to
 * @param {{ status: number; body: any } | null} answer what `ask` gave: null where nothing answered
 * @returns {Next}
 */
export function afterAnswer(press, answer) {
  const kept = { ...press };
  if (answer === null || answer === undefined) return { kind: 'ask_again', press: kept };
  const { status } = answer;
  const body = isObject(answer.body) ? answer.body : null;
  const code = typeof body?.error === 'string' ? body.error : '';
  const order = filled(body?.order) ? String(body?.order).trim() : '';
  const withOrder = { ...kept, order: order === '' ? kept.order : order };

  if (status === 201) {
    const url = body?.url;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return { kind: 'go', url };
    // Made, and no page to send the buyer to: the order's token asks for it again.
    return { kind: 'ask_again', press: withOrder };
  }
  // Too many, whoever said it — the shop in its words, or a rate limiter in front of it with none: nothing was written.
  if (status === 429) return { kind: 'say', word: code === 'open_checkouts' ? 'error.open_checkouts' : 'error.too_many', press: kept };
  // Lost: the network's answer, not the shop's — the order may have been made, and is asked for again the same way.
  if ((status >= 500 && !(status === 500 && code === 'internal')) || status === 408) return { kind: 'ask_again', press: withOrder };
  // A refusal that is a sentence is for the developer to read, and no press of this one will mend it.
  if (body === null) return { kind: 'say', word: 'error.internal', press: null };
  if (status === 409 && ['total', 'refused', 'method', 'short'].includes(code)) {
    if (isObject(body.quote)) return { kind: 'requote', press: kept, quote: body.quote, word: `error.${code}` };
    return { kind: 'say', word: `error.${code}`, press: kept };
  }
  if (status === 409 && code === 'paid') {
    return withOrder.order === '' ? { kind: 'say', word: 'error.paid', press: null } : { kind: 'paid', order: withOrder.order };
  }
  if (KEPT[status]?.includes(code)) {
    const said = { kind: /** @type {'say'} */ ('say'), word: `error.${code}`, press: kept };
    if (code !== 'buyer') return said;
    return { ...said, fields: Array.isArray(body.fields) ? body.fields.filter((one) => typeof one === 'string') : [] };
  }
  const gone = GONE[`${status} ${code}`] ?? (status === 410 ? 'error.lapsed' : undefined);
  if (gone !== undefined) return { kind: 'say', word: gone, press: null };
  return { kind: 'say', word: 'error.internal', press: kept };
}

/** Every word `afterAnswer` may name, for a page to hand its element and a test to hold in every language. */
export const CHECKOUT_WORDS = Object.freeze([
  'error.try_again',
  'error.total',
  'error.refused',
  'error.method',
  'error.short',
  'error.paid',
  'error.challenge',
  'error.buyer',
  'error.too_many',
  'error.open_checkouts',
  ...new Set(Object.values(GONE)),
]);
