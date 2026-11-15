/**
 * The storefront's one way to the shop: every request its elements make to
 * `shop/1` (docs/reference/shop-protocol.md of the platform), at the page's
 * api base — `data-api` on a piece's root, `/api/` on the site's own host and
 * `/p/<slug>/api/` in a preview.
 *
 * Every request names the protocol version, `X-Jtk-Shop: 1` (SHOP_PROTOCOL),
 * and is never cached: what is left and what a cart comes to change with
 * every checkout, and a count a minute old sends a buyer to pay for the last
 * item somebody else is holding.
 *
 * An answer is its status and its body, read as JSON where it is JSON and as
 * the sentence it is where it is not; a request that never got an answer — the
 * network gone, a fetch that throws — is `null`, so a piece says what it can
 * and never throws at the buyer.
 */

/**
 * The shop protocol's version these elements speak, named on every request.
 * A page is a file in a build: a site keeps the kit it was built with, and
 * the platform answers it by this number for as long as a live site speaks
 * it — so it moves only with a change the platform cannot make by adding.
 */
export const SHOP_PROTOCOL = 1;

/**
 * A request to shop/1 at a page's api base.
 *
 * @param {string} api the base, `/api/`, as a piece's root carries it in `data-api`
 * @param {string} path `stock?product=<id>`, `shipping`, `checkout`, `order?token=<token>`
 * @param {{ method?: 'GET' | 'POST'; body?: unknown }} [init] a body is sent as JSON, and makes the request a POST unless a method is said
 * @returns {Promise<{ status: number; body: any } | null>}
 */
export async function ask(api, path, init = {}) {
  const at = `${String(api).replace(/\/?$/, '/')}${String(path).replace(/^\//, '')}`;
  const sends = init.body !== undefined;
  /** @type {Record<string, string>} */
  const headers = { 'x-jtk-shop': String(SHOP_PROTOCOL) };
  if (sends) headers['content-type'] = 'application/json';
  try {
    const answer = await fetch(at, {
      method: init.method ?? (sends ? 'POST' : 'GET'),
      cache: 'no-store',
      headers,
      ...(sends ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await answer.text();
    let body = null;
    if (text !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: answer.status, body };
  } catch {
    return null;
  }
}
