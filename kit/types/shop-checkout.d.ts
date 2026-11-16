import type { Cart } from './shop-cart';

/** A digest of what a press was sent with — its body less the challenge's token, the return and the page's language (Rulings 223, 225, 226): it tells one body from another, and keeps none of the buyer's details. */
export type Sent = string;
/** A press of *Pay*: its `attempt`, the same for every retry of it, and the order's token once the shop has made one. */
export interface Press {
  attempt: string;
  /** `''` until the shop has made the order. */
  order: string;
  /** What it was sent with, once it has been: only the same body is a retry of it. */
  sent?: Sent;
  /** When it was first sent, in milliseconds: past `HOLD`, it is over. */
  at?: number;
}
/** What an `attempt` is, as the shop holds it: 16 to 128 letters, digits, `-` and `_`. */
export const ATTEMPT: RegExp;
/** How long a press is kept: the 31 minutes of its order's hold, in milliseconds. */
export const HOLD: number;
/** Where a site's press in flight is kept in the tab: `jtk:checkout:` and the base of its addresses. */
export function pressKey(api: string): string;
/** A new press: a `crypto.randomUUID()` attempt, and no order. */
export function freshPress(): Press;
/** The stored press, where it is one, within the hold, and sent with `sent` where that is given; else a fresh one. */
export function pressFor(stored: Press | null | undefined, sent?: Sent, now?: number): Press;
/** What a press is for, as the cart and the form would send it — the body less the token, the return and the language — as a digest. */
export function sentOf(cart: Cart, form: CheckoutForm): Sent;
/** A press as the tab keeps it once sent: what it was sent with, and when it was first sent. */
export function keptPress(press: Press, sent: Sent, now?: number): Press;
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
  /** The press is over: to Stripe's page, for the order `order` (`''` if the shop named none), which the page marks as this tab's. */
  | { kind: 'go'; url: string; order: string }
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
