import type { Cart } from './shop-cart';

/** A press of *Pay*: its `attempt`, the same for every retry of it, and the order's token once the shop has made one. */
export interface Press {
  attempt: string;
  /** `''` until the shop has made the order. */
  order: string;
}
/** What an `attempt` is, as the shop holds it: 16 to 128 letters, digits, `-` and `_`. */
export const ATTEMPT: RegExp;
/** Where a site's press in flight is kept in the tab: `jtk:checkout:` and the base of its addresses. */
export function pressKey(api: string): string;
/** A new press: a `crypto.randomUUID()` attempt, and no order. */
export function freshPress(): Press;
/** The stored press, where it is one, or a fresh one. */
export function pressFor(stored: Press | null | undefined): Press;
/** The buyer's details, as typed. */
export interface Buyer {
  name: string;
  email: string;
  phone?: string;
}
/** A delivery's address, as typed. */
export interface Address {
  line1: string;
  line2?: string;
  postal_code: string;
  city: string;
}
/** What the checkout step's form gives a press besides the cart. */
export interface CheckoutForm {
  buyer: Buyer;
  /** `null` for a pick-up, which asks no address. */
  address: Address | null;
  /** The total the buyer was shown: the subtotal and the method's price, in minor units. */
  total: number;
  /** The page's language, a tag such as `en` or `fr-CH`. */
  locale: string;
  /** The path the buyer comes back to from Stripe's page. */
  return: string;
  /** The challenge's token, or `''` where the host has no widget. */
  turnstile: string;
}
/** What `POST /api/checkout` is sent for a press: `{ order }` alone where the press holds one, else the cart and the form. */
export function checkoutBody(press: Press, cart: Cart, form: CheckoutForm): object;
/** The details a press cannot go without, by the protocol's paths (`buyer.name`, `address.line1`, …): only what is plainly missing. */
export function missingDetails(buyer: Buyer, address: Address | null): string[];
/** What follows an answer of the checkout. */
export type Next =
  /** The press is over: to Stripe's page. */
  | { kind: 'go'; url: string }
  /** Already paid: to the order's page. */
  | { kind: 'paid'; order: string }
  /** The same press again: with its order alone, or with its cart and a fresh token. */
  | { kind: 'ask_again'; press: Press }
  /** The same press, the buyer shown the shop's new answer, and `word` said. */
  | { kind: 'requote'; press: Press; quote: object; word: string }
  /** `word` said, the `fields` it is about where the shop named them; `press` null where the next press mints a new attempt. */
  | { kind: 'say'; word: string; press: Press | null; fields?: string[] };
/** What follows an answer of `POST /api/checkout` to a press: every answer the protocol gives the checkout. `null` is no answer. */
export function afterAnswer(press: Press, answer: { status: number; body: any } | null): Next;
/** Every word `afterAnswer` may name. */
export const CHECKOUT_WORDS: readonly string[];
