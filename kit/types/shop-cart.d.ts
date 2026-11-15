/** A cart line is the protocol's own: the product's `id`, the variant's `_key`, 1 to 999, and an answer for each question it asks. */
export interface CartLine {
  product: string;
  variant: string;
  qty: number;
  /** A customization's `_key` to a choice's `_key`, `true`, or a text. */
  answers: Record<string, string | boolean>;
}
/** What a site's cart keeps in the browser: the protocol's lines and nothing else — no title, no price. */
export interface Cart {
  v: 1;
  lines: CartLine[];
  country: string;
  method: string;
}
/** The most lines the protocol takes in a cart. */
export const MAX_LINES: 100;
/** The most of one variant a line asks. */
export const MAX_QTY: 999;
/** Where a site's cart is kept: `jtk:cart:` and the base of its addresses, so a preview's is a cart of its own. */
export function cartKey(api: string): string;
/** The cart a storage value holds; anything else is an empty cart, and a line keeps the protocol's four keys and nothing else. */
export function readCart(stored: string | null | undefined): Cart;
/** A line added: the same product, variant and answers add up, to MAX_QTY; past MAX_LINES nothing is added. */
export function addLine(cart: Cart, line: CartLine): Cart;
export function removeLine(cart: Cart, at: number): Cart;
/** 0 takes the line out. */
export function setQty(cart: Cart, at: number, qty: number): Cart;
/** What `POST /api/shipping` takes for this cart. */
export function shippingBody(cart: Cart, locale: string): { lines: CartLine[]; country: string; locale: string };
