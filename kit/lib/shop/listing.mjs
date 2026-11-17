/**
 * A listing of products that may hide what is sold out, once the page has
 * loaded (jtakeit-core wiki/102 stage 9, decision 6): which products to ask
 * the shop after, and which tiles the answers say nobody can buy.
 *
 * The built page lists every product — a crawler, a reader whose script never
 * ran and a page the shop could not be asked for all see them all — so a tile
 * is hidden only by what the shop says, and only where the site chose it
 * (`data-hide-sold-out`). A failed or stalled answer hides nothing: the
 * checkout holds the stock either way, and a product shown that cannot be
 * bought is told so on its own page; one hidden by a wrong answer cannot be
 * found at all.
 *
 *   GET /api/stock?product=<id>[&product=<id>…]  → { products: [{ id, served, variants: [{ key, sku, state, left? }] }] }
 *
 * at most `STOCK_ASKS_MOST` products a call (shop/1 answers `400` for more),
 * so a long listing is several calls. Pure and framework-free, as the other
 * pieces' are: the element (elements/shop-listing.js) asks, and hides what
 * `hiddenTiles` names.
 */

/** How many products one stock call asks after, at most: the protocol's (shop/1) — a call that asks after more is refused. */
export const STOCK_ASKS_MOST = 100;
/**
 * How long one stock call may take, in milliseconds. A call that has not answered by then counts as no answer, so a shop that
 * never answers leaves every tile shown instead of a page that waits on it.
 */
export const STOCK_DEADLINE_MS = 10000;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The addresses that ask after these products: each id once, in the order given, at most `STOCK_ASKS_MOST` to an address —
 * `<api>stock?product=<id>&product=<id>…`, each id written as one value. Nothing for a list with no id, and an id that is no
 * text or is empty is none.
 *
 * @param {string} api the base of the site's addresses, as the pieces carry it in `data-api`: `/api/`
 * @param {string[]} ids the entries' ids, as the tiles say them
 * @returns {string[]}
 */
export function stockAsks(api, ids) {
  const base = `${String(api).replace(/\/?$/, '/')}stock`;
  const once = [...new Set(ids.filter((id) => typeof id === 'string' && id !== ''))];
  /** @type {string[]} */
  const asks = [];
  for (let from = 0; from < once.length; from += STOCK_ASKS_MOST) {
    asks.push(`${base}?${once.slice(from, from + STOCK_ASKS_MOST).map((id) => `product=${encodeURIComponent(id)}`).join('&')}`);
  }
  return asks;
}

/**
 * The tiles to hide for the answers of the shop: the ids of a product the shop serves with no variant in stock — sold out, or
 * off sale, or none at all — and of one it does not serve (a product hidden, saved and not yet published, or one deleted). A
 * state other than `in_stock` is none, as the product page reads it. None from an answer that failed (`null`), that is no
 * stock answer, or that does not say a product plainly: its products stay shown — and a product an answer does not name stays
 * shown too.
 *
 * @param {({ products: { id: string; served: boolean; variants: { state: string }[] }[] } | null | undefined)[]} answers the bodies of the shop's answers, `null` where a call had none
 * @returns {Set<string>}
 */
export function hiddenTiles(answers) {
  /** @type {Set<string>} */
  const hidden = new Set();
  for (const answer of answers) {
    if (!isObject(answer) || !Array.isArray(answer.products)) continue;
    for (const product of answer.products) {
      if (!isObject(product) || typeof product.id !== 'string' || product.id === '') continue;
      if (product.served === false) hidden.add(product.id);
      else if (product.served === true && Array.isArray(product.variants) && !product.variants.some((variant) => isObject(variant) && variant.state === 'in_stock')) hidden.add(product.id);
    }
  }
  return hidden;
}
