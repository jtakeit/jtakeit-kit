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
/** One customization a line answers, as the shop prices it: a choice's `label`, `ticked` for a yes-or-no, or the `text` typed; `adds` what it adds to the unit, in minor units. */
export interface QuotedAnswer {
  key: string;
  name: string;
  choice?: string;
  label?: string;
  ticked?: boolean;
  text?: string;
  adds: number;
}
/** What the shop says of a line it will not price, in the page's language: its protocol code and the word for it. */
export interface CartRefusal {
  code: string;
  word: string;
}
/** A line of the cart, with what the shop answered of it: its price (`quoted`) or why it would not (`refused`). */
export interface CartRow {
  /** The line's place in the cart, from 0. */
  at: number;
  line: CartLine;
  quoted?: { title: string; labels: string[]; answers: QuotedAnswer[]; unit: number; total: number };
  refused?: CartRefusal;
}
/** What a cart shows once the shop has priced it, as one value for the element to draw. */
export interface CartView {
  rows: CartRow[];
  /** Why the whole cart was refused (line `-1`), where it was. */
  whole?: CartRefusal;
  /** What the priced lines come to, in minor units. */
  subtotal: number;
  /** The site's currency, as the shop says it. */
  currency: string;
  methods: { method: string; name: string; pickup: boolean; price: number; free: boolean }[];
  /** The cart's, where it is still offered, else the first offered. */
  method: string;
  /** The shop's, and false where the chosen method is a pick-up. */
  abroad: boolean;
  vat: boolean;
  ownCurrency: boolean;
  sends: boolean;
  cannotSend: boolean;
  /** Every line priced, nothing refused, and a method chosen. */
  ready: boolean;
}
/** The cart and the shop's last shipping answer read together into what the page shows. */
export function cartView(cart: Cart, quote: object | null | undefined, locale: string): CartView;
