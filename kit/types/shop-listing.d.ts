/** How many products one stock call asks after, at most: shop/1's — a call that asks after more is refused. */
export const STOCK_ASKS_MOST: 100;
/** How long one stock call may take, in milliseconds: ten seconds. A call that has not answered by then counts as no answer, and every tile it names stays shown. */
export const STOCK_DEADLINE_MS: 10000;
/**
 * The addresses that ask after these products: each id once, in the order given, at most `STOCK_ASKS_MOST` to an address —
 * `<api>stock?product=<id>&product=<id>…`. Nothing for a list with no id; an id that is no text or is empty is none.
 *
 * @param api the base of the site's addresses, as the pieces carry it in `data-api`
 * @param ids the entries' ids, as the tiles say them
 */
export function stockAsks(api: string, ids: string[]): string[];
/**
 * The tiles to hide for the answers of the shop: a product served with no variant in stock (sold out, off sale or none at all) and
 * one not served. None from an answer that failed (`null`) or is no stock answer, and none for a product an answer does not name.
 *
 * @param answers the bodies of the shop's answers, `null` where a call had none
 */
export function hiddenTiles(answers: ({ products: { id: string; served: boolean; variants: { state: string }[] }[] } | null | undefined)[]): Set<string>;
