/**
 * The storefront's elements (`@jtakeit/kit/elements/shop-*`: the product, the
 * cart, the checkout, the page after payment, the listing) and the one wire they speak `shop/1` over
 * (`@jtakeit/kit/elements/shop-wire`).
 */

/** The shop protocol's version: 1, named on every request as `X-Jtk-Shop`. */
export const SHOP_PROTOCOL: number;

/**
 * A request to shop/1 at a page's api base: the protocol's header, no-store, a JSON body where one is
 * given (a POST unless a method is said). The body answered is JSON where it is JSON, its sentence where
 * it is not, and `null` where empty; a fetch that throws — or is aborted by the `signal` — is `null`.
 */
export function ask(api: string, path: string, init?: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal }): Promise<{ status: number; body: any } | null>;

/** JSON from an attribute, or what is given where it is none. */
export function parsed<T>(text: string | undefined, otherwise: T): any | T;
/** Puts the rules a piece cannot work without on the page, once, as `<style data-jtk-<name>>`, first in <head>. */
export function putBase(name: string, css: string): void;
/** What a piece's custom element extends: `HTMLElement` where there is a document, nothing under Node. */
export const BaseElement: typeof HTMLElement;
/** Defines a piece's custom element where there is a document and the name is not taken yet. */
export function defineOnce(name: string, element: CustomElementConstructor): void;

/** Wires one product's `form[data-product]`; a form already wired is left alone. */
export function wireProduct(form: HTMLFormElement): void;
/** Wires every product form under a root (the document by default) that is not wired yet. */
export function wireAll(root?: ParentNode): void;
/** Defines `<jtk-product>` (or the name given), where there is a document and it is not defined yet. */
export function defineProduct(name?: string): void;
/** `<jtk-product>`: wires the product form inside it when it reaches the document. */
export class JtkProduct extends HTMLElement {
  connectedCallback(): void;
}

/** Wires one cart's `[data-cart]`; one already wired is left alone. */
export function wireCart(root: HTMLElement): void;
/** Defines `<jtk-cart>` (or the name given), where there is a document and it is not defined yet. */
export function defineCart(name?: string): void;
/** `<jtk-cart>`: wires the cart inside it when it reaches the document. */
export class JtkCart extends HTMLElement {
  connectedCallback(): void;
}

/** Wires one checkout's `form[data-checkout]`; one already wired is left alone. */
export function wireCheckout(form: HTMLFormElement): void;
/** Defines `<jtk-checkout>` (or the name given), where there is a document and it is not defined yet. */
export function defineCheckout(name?: string): void;
/** `<jtk-checkout>`: wires the checkout form inside it when it reaches the document. */
export class JtkCheckout extends HTMLElement {
  connectedCallback(): void;
}

/** Wires one order's `[data-order]`; one already wired is left alone. */
export function wireOrder(root: HTMLElement): void;
/** Defines `<jtk-order>` (or the name given), where there is a document and it is not defined yet. */
export function defineOrder(name?: string): void;
/** `<jtk-order>`: wires the page after payment inside it when it reaches the document. */
export class JtkOrder extends HTMLElement {
  connectedCallback(): void;
}

/** Wires one listing's `[data-listing]`; one already wired is left alone. Where it says `data-hide-sold-out`, the tiles the shop says nobody can buy are hidden once the page has loaded. */
export function wireListing(root: HTMLElement): void;
/** Defines `<jtk-listing>` (or the name given), where there is a document and it is not defined yet. */
export function defineListing(name?: string): void;
/** `<jtk-listing>`: wires the listing inside it when it reaches the document. */
export class JtkListing extends HTMLElement {
  connectedCallback(): void;
}

declare global {
  interface DocumentEventMap {
    /**
     * The cart changed: `jtk:cart` on the document, the cart's key (`jtk:cart:<api>`) in `detail` — said by a product's form once a
     * line is added, by the cart as the buyer changes it there (a quantity, a line taken out, the country, the method), and by the
     * checkout after the shop answered a press with a new price. The cart and the checkout price it again; neither hears its own.
     */
    'jtk:cart': CustomEvent<string>;
    /**
     * What the cart says when the buyer goes on to the checkout: the country and the method chosen are written into the cart
     * first, and the cart's key is in `detail`. No quote goes with it: the checkout asks the shop again, with the stored cart,
     * and shows itself (`<jtk-checkout>`). The checkout says `jtk:cart` in turn where the shop answered a press with a new
     * price, so the cart above is priced again with it.
     */
    'jtk:to-checkout': CustomEvent<string>;
  }
}
