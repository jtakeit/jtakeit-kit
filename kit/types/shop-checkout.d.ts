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
/** A SKU the shop has too little of for the cart, as a `409 short` names it: how many it was asked for, and how many are left. */
export interface Short {
  sku: string;
  wanted: number;
  available: number;
}
/** The lines a `409 short` names, held to what they are: an entry with no SKU is none, and a count that is no whole number from 0 is 0. */
export function shortOf(raw: unknown): Short[];
/** A line short of stock, said: «Fox T-shirt, M, Blue: 1 left», or «…: none left» where nothing is (`short.some`, `short.none`); the title put in as written. */
export function shortSentence(words: Record<string, string>, name: string, available: number): string;
/** Each SKU a `409 short` names, with the sentence that says it, by the title and labels the quote gives its line (the SKU where it has none), in the shop's order. */
export function shortSaid(quote: any, short: Short[], words: Record<string, string>): { sku: string; available: number; text: string }[];
/** What follows an answer of the checkout. */
export type Next =
  /** The press is over: to Stripe's page, for the order `order` (`''` if the shop named none), which the page marks as this tab's. */
  | { kind: 'go'; url: string; order: string }
  /** Already paid: to the order's page. */
  | { kind: 'paid'; order: string }
  /** The same press again: with its order alone, or with its cart and a fresh token. */
  | { kind: 'ask_again'; press: Press }
  /** The same press, the buyer shown the shop's new answer, and `word` said. */
  | { kind: 'requote'; press: Press; quote: object; word: string; /** For `error.short`: the lines short, which the page says by name and the cart says on their rows. */ short?: Short[] }
  /** `word` said, the `fields` it is about where the shop named them; `press` null where the next press mints a new attempt. */
  | { kind: 'say'; word: string; press: Press | null; fields?: string[] };
/** What follows an answer of `POST /api/checkout` to a press: every answer the protocol gives the checkout. `null` is no answer. */
export function afterAnswer(press: Press, answer: { status: number; body: any } | null): Next;
/** Every word `afterAnswer` may name, and the two a `409 short` says of each line. */
export const CHECKOUT_WORDS: readonly string[];
