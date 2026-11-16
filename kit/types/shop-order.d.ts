/** How long the page after payment waits between two asks of a waiting order, in milliseconds: three seconds. */
export const ASK_EVERY_MS: 3000;
/** How many times it asks at most: forty, every three seconds, is two minutes; then it says so and stops. */
export const ASKS_MOST: 40;
/** What an order is, as the page tells it: `unknown` is a token that is nobody's, or none on the address. */
export type OrderState = 'waiting' | 'paid' | 'lapsed' | 'cancelled' | 'unknown';
/** What the page after payment shows and does for the shop's answer. */
export interface OrderView {
  state: OrderState;
  /** The key of `shopWordsFor`'s sentence for it: `state.waiting`, `state.left`, `state.paid`, `state.lapsed`, `state.cancelled`, `state.unknown` or `state.stillWaiting`. */
  word: string;
  /** Once it is paid — and a cancelled order has the number it had. */
  number?: number;
  /** Stripe's page, to go back to paying: while the order waits and the answer carries it, an address of the web. */
  payUrl?: string;
  /** Paid: the cart is emptied, a cart already empty included. */
  emptiesCart: boolean;
  /** Whether to ask again: a waiting order, until `ASKS_MOST`; no other state. */
  askAgain: boolean;
}
/**
 * What the page after payment shows and does for the shop's answer to `GET /api/order`: `404` is `unknown` and asking stops; a
 * waiting order is `state.left` for a buyer who came back from Stripe's page without paying and `state.waiting` for any other, asked
 * again until `asked` reaches `ASKS_MOST` and then `state.stillWaiting`; a paid order has its number and empties the cart; a lapsed
 * or cancelled one is said and the cart kept; no answer is asked again as if waiting.
 *
 * @param answer what `ask` gave: `null` where nothing answered
 * @param query what the page's address says
 * @param asked how many times the shop has been asked, this answer's ask included
 */
export function orderView(answer: { status: number; body: any } | null | undefined, query: { left: boolean }, asked: number): OrderView;
/**
 * Where an order is asked, from the address the buyer is on: `<api>order?token=<the query's order>`; `null` where the address names
 * no order.
 *
 * @param api the base of the site's addresses, as the pieces carry it in `data-api`
 * @param search the page's query, `?order=T9&left=1`
 */
export function orderAddress(api: string, search: string | undefined): string | null;
/** A customization of a frozen line, said: its name, what was chosen or typed (or the page's word for a yes), and what it added. */
export interface FrozenAnswer {
  name: string;
  value: string;
  adds: number;
}
/** A line of the order as the shop froze it. */
export interface FrozenLine {
  title: string;
  labels: string[];
  answers: FrozenAnswer[];
  qty: number;
  total: number | undefined;
}
/** The order as the shop froze it, held to what the page draws: never the buyer's contact or address. */
export interface FrozenOrder {
  lines: FrozenLine[];
  subtotal: number | undefined;
  shipping: number | undefined;
  total: number | undefined;
  currency: string;
  method: string;
  pickup: boolean;
}
/** The order's answer held to what the page draws; `null` for an answer that holds no lines. @param yes the page's word for a customization ticked */
export function frozenOrder(body: any, yes: string): FrozenOrder | null;
/** Every word the page after payment may say. */
export const ORDER_WORDS: readonly string[];
