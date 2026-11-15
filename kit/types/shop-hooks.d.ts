export interface Hook {
  hook: string;
  says: string;
}
/** A piece's hooks, its root first: `always` every copy has or the piece cannot work, `said` where the element writes what happened. */
export interface Piece {
  always: readonly Hook[];
  said: readonly Hook[];
}
/** The product page: `form[data-product]`, the options, the price, what is left, *Add to cart*. */
export const PRODUCT: Piece;
/** The cart: its lines, the country, the methods that country is offered, the subtotal. */
export const CART: Piece;
/** The checkout step: the buyer, the address unless a pick-up, the total, then Stripe's page. */
export const CHECKOUT: Piece;
/** The page after payment: the order's state, its lines, its total. */
export const ORDER: Piece;
/** A listing of products, which may hide what is sold out once the page has loaded. */
export const LISTING: Piece;
/** The `always` hooks a piece's root lacks: what its element says in the console when it wires one. */
export function lacking(root: ParentNode, piece: Piece): string[];
