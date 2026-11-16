/**
 * `<jtk-listing>` — a listing of products, made to hide what is sold out where
 * the site chose it, once the page has loaded.
 *
 * The built page lists every product: a crawler, a reader whose script never
 * ran and a page whose stock could not be read all see them all. Only this
 * element hides a tile, and only where the listing says `data-hide-sold-out` —
 * the site's own choice, off in the page `jtk add shop` lays. With it set, the
 * element asks the shop what is left of the products the tiles stand for,
 *
 *   GET /api/stock?product=<id>[&product=<id>…]   → { products: [{ id, served, variants: [{ key, sku, state, left? }] }] }
 *
 * a hundred at a time (`stockAsks`, lib/shop/listing.mjs: shop/1 refuses more),
 * over the shop's wire (`ask`, shop-wire.js: `X-Jtk-Shop: 1`, never cached),
 * and sets `hidden` on each tile `hiddenTiles` names — a product the shop
 * serves with no variant in stock, and one it does not serve — and on each
 * group left with no tile shown, so that a group's heading is never left over
 * nothing. Where hiding leaves no tile at all, it writes the sentence for that
 * (`listingEmpty`) into `[data-listing-empty]` and shows it, so the buyer is not
 * left with a heading and nothing under it. A call that fails or has not
 * answered in `STOCK_DEADLINE_MS` hides nothing: its tiles stay shown, and the
 * page the buyer sees is the whole listing, which the shop's checkout holds to
 * what can be bought either way. Asked once, as the page loads; a listing is
 * not asked again.
 *
 * ── how a page gets it ──────────────────────────────────────────────────────
 *
 * Import this module once on the page and every `[data-listing]` is wired: one
 * inside a `<jtk-listing>` by the element's own lifecycle, which also covers
 * markup the panel places later (`fl:placed`), and one written bare by
 * `onAlive`. The markup is the site's — the scaffold's
 * `src/components/shop/ProductListing.astro`, copied and dressed — and the
 * element finds everything in it by a `data-*` hook, never by a class: the list
 * is `@jtakeit/kit/shop/hooks` (`LISTING`). A hook left out is said in the
 * console where the listing hides.
 *
 * The root carries the site's api base as `data-api`, the page's language as
 * `data-locale` and the words the markup was written in as `data-words`
 * (`shopWordsFor`, which the element reads under them for any the page left
 * out). It says what it has done in `data-stock-read`, for a walk to wait on:
 * absent until every call has answered or been given up, then `yes` where each
 * answered — or where there was no tile to ask after — and `failed` where one
 * did not, and the tiles of that call stay shown. A listing that does not hide
 * asks nothing and says nothing: no `data-stock-read`. Its one sentence is
 * `[data-listing-empty]`'s; a tile's words are the build's.
 */
import { shopWordsFor } from '../lib/shop/words.mjs';
import { LISTING, lacking } from '../lib/shop/hooks.mjs';
import { STOCK_DEADLINE_MS, hiddenTiles, stockAsks } from '../lib/shop/listing.mjs';
import { BaseElement, ask, defineOnce, parsed, putBase } from './shop-wire.js';
import { onAlive } from './alive.js';

export { SHOP_PROTOCOL, ask } from './shop-wire.js';

/** The rules the behaviour cannot work without: `putBase` in shop-wire.js says what they are for. */
const BASE = `
[data-listing] [hidden] { display: none !important; }
:where([data-listing] :focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
`;

/**
 * Wires one listing's `[data-listing]`. Idempotent: a listing already wired is left alone.
 * @param {HTMLElement} root
 */
export function wireListing(root) {
  if (root.dataset.jtkWired === '1') return;
  root.dataset.jtkWired = '1';
  putBase('listing', BASE);
  // Only where the site chose it: the built page is the whole listing, and a listing that hides nothing asks nothing.
  if (!root.hasAttribute('data-hide-sold-out')) return;
  const missing = lacking(root, LISTING);
  if (missing.length > 0) console.error(`listing: its markup has no ${missing.join(', ')}, and cannot hide what is sold out without them — the hooks are listed in @jtakeit/kit/shop/hooks`);

  const api = root.dataset.api ?? '/api/';
  /** @type {Record<string, string>} */
  const words = { ...shopWordsFor(root.dataset.locale ?? 'en'), ...parsed(root.dataset.words, {}) };
  /** @type {HTMLElement | null} */
  const empty = root.querySelector('[data-listing-empty]');
  // A sentence that appears once the page has loaded is read as a status.
  if (empty && !empty.getAttribute('role')) empty.setAttribute('role', 'status');
  /** @type {HTMLElement[]} */
  const tiles = [...root.querySelectorAll('[data-product-tile]')].filter((one) => one instanceof HTMLElement);
  /** @type {HTMLElement[]} */
  const groups = [...root.querySelectorAll('[data-listing-group]')].filter((one) => one instanceof HTMLElement);
  const idOf = (tile) => (tile.getAttribute('data-product') ?? '').trim();
  const unnamed = tiles.filter((one) => idOf(one) === '');
  if (unnamed.length > 0) console.error(`listing: ${unnamed.length} tile(s) have no data-product, the entry's id, and are never hidden`);

  /**
   * Hides the tiles of these products, and every group that has none left to show — its heading with it. Where that leaves no
   * tile at all the sentence for it is written and shown.
   */
  function hide(ids) {
    for (const tile of tiles) if (ids.has(idOf(tile))) tile.hidden = true;
    for (const group of groups) {
      if (![...group.querySelectorAll('[data-product-tile]')].some((one) => !(one instanceof HTMLElement && one.hidden))) group.hidden = true;
    }
    if (empty && tiles.length > 0 && tiles.every((one) => one.hidden)) {
      empty.textContent = words.listingEmpty;
      empty.hidden = false;
    }
  }

  const addresses = stockAsks(api, tiles.map(idOf));
  if (addresses.length === 0) {
    // Nothing to ask after, and nothing pending: a group with no tile is not left over its heading, and the walk is told so.
    hide(new Set());
    root.dataset.stockRead = 'yes';
    return;
  }
  let failed = false;
  /**
   * One call. Its answer hides what it says nobody can buy; no answer — the network gone, a status that is not 200, a body that
   * is no stock answer, a deadline passed — hides nothing of what it asked after.
   */
  async function read(address) {
    // The address is whole — `stockAsks` made it of the page's api base — so it is asked at the site's root. A call that has not
    // answered in its deadline is no answer, so a shop that never does leaves every tile shown.
    const deadline = new AbortController();
    const giveUp = setTimeout(() => deadline.abort(), STOCK_DEADLINE_MS);
    const answer = await ask('/', address, { signal: deadline.signal });
    clearTimeout(giveUp);
    if (!root.isConnected) return;
    const body = answer?.status === 200 ? answer.body : null;
    if (!Array.isArray(body?.products)) {
      failed = true;
      if (answer !== null) console.error(`listing: the shop answered ${answer.status} to ${address.split('?')[0]} with no stock answer, and what is sold out is not hidden`);
      return;
    }
    hide(hiddenTiles([body]));
  }
  void Promise.all(addresses.map(read)).then(() => {
    if (root.isConnected) root.dataset.stockRead = failed ? 'failed' : 'yes';
  });
}

/**
 * `<jtk-listing>` wraps the listing `ProductListing.astro` wrote and wires it when it
 * reaches the document — on load, and when the panel places the markup later.
 */
export class JtkListing extends BaseElement {
  connectedCallback() {
    const self = /** @type {any} */ (this);
    if (self.matches('[data-listing]')) wireListing(self);
    for (const root of /** @type {NodeListOf<HTMLElement>} */ (self.querySelectorAll('[data-listing]'))) wireListing(root);
  }
}

/** @param {string} [name] */
export function defineListing(name = 'jtk-listing') {
  defineOnce(name, /** @type {any} */ (JtkListing));
}

if (typeof document !== 'undefined') {
  defineListing();
  // A listing written bare, outside the element: wired at load, and again on markup the panel places.
  onAlive('[data-listing]', (root) => wireListing(/** @type {HTMLElement} */ (root)));
}
