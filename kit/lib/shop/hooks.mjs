/**
 * What the storefront's five elements read off the markup a site's component
 * writes — the whole of the contract between a piece's markup and the element
 * that makes it work, as `booking/hooks.mjs` is the booking form's.
 *
 * An element finds everything by these: a `data-*` attribute or an input's
 * `name`, never a class. Classes, wrappers, the order of the fields, the
 * words and the look are the site's; a component an agent copies and dresses
 * in a design of its own keeps working as long as its hooks are on it.
 *
 * A piece has two kinds, and the first of each is the piece's root:
 *
 *   always  every copy has them, or the piece cannot work — the element says
 *           in the console which is missing (`lacking`, below);
 *   said    where the element writes what happened or what is left: the
 *           price «from», the customs notice, the order's number. Left out,
 *           that line is not said and nothing else changes.
 *
 * Five pieces, one per element: `<jtk-product>` (PRODUCT), `<jtk-cart>`
 * (CART), `<jtk-checkout>` (CHECKOUT), `<jtk-order>` (ORDER), `<jtk-listing>`
 * (LISTING). The test (kit/test/shop.test.mjs) pins every list below and holds
 * the hooks to being data or names. A copied component that lost one is found
 * by its element, in the console, through `lacking`: the platform's preflight
 * reads none of these hooks.
 */

/** @typedef {{ hook: string; says: string }} Hook */
/** @typedef {{ always: readonly Hook[]; said: readonly Hook[] }} Piece */

/**
 * @param {Hook[]} always
 * @param {Hook[]} said
 * @returns {Piece}
 */
function piece(always, said) {
  return Object.freeze({ always: Object.freeze(always.map((one) => Object.freeze(one))), said: Object.freeze(said.map((one) => Object.freeze(one))) });
}

/** The product page: the variant picker, the customization form, what is left, *Add to cart*. */
export const PRODUCT = piece(
  [
    { hook: 'form[data-product]', says: 'the form; `data-product` the entry\'s `id`, and `data-api`, `data-locale`, `data-facts` (the product\'s facts), `data-words` and `data-jtk-fixed` on it' },
    { hook: '[name^="option:"]', says: 'a radio group or a `<select>` for each option, named `option:<key>`, the value of each a value\'s `_key`' },
    { hook: '[data-price]', says: 'the chosen variant\'s price; it carries the first variant\'s annotation, which the element moves to the chosen one' },
    { hook: '[data-stock]', says: 'what is left of the chosen variant: «Sold out», «3 left», «In stock»' },
    { hook: '[name=qty]', says: 'how many, a number from 1 to 999' },
    { hook: '[data-add]', says: 'the button that puts the chosen variant in the cart' },
    { hook: '[data-product-error]', says: 'what is wrong, said; tied to the fields it is about' },
    { hook: '[data-added]', says: 'hidden; shown once added, with a link to the cart' },
  ],
  [
    { hook: '[name^="answer:"]', says: 'one for each customization, named `answer:<key>`: a `<select>` for a choice, a checkbox for a yes-or-no, a text with its `maxlength`' },
    { hook: '[data-from]', says: 'the lowest price of the product, «from CHF 29.90»' },
  ],
);

/** The cart: its lines, the country, the methods that country is offered, the subtotal. */
export const CART = piece(
  [
    { hook: '[data-cart]', says: 'the cart; `data-api`, `data-locale`, `data-countries` (the countries to choose from) and `data-words` on it, and what it is drawing in `data-state`: `pricing`, `priced`, `stale` (the shop could not be asked again: the last rows, held), `empty`, `failed`' },
    { hook: '[data-cart-lines]', says: 'empty; the element writes a row per line into it' },
    { hook: '[data-cart-empty]', says: 'hidden; shown while the cart has no line' },
    { hook: '[name=country]', says: 'a `<select>` of the countries' },
    { hook: '[data-methods]', says: 'empty; the element writes a radio `name=method` per method the country is offered' },
    { hook: '[data-subtotal]', says: 'what the lines come to, as the shop priced them' },
    { hook: '[data-cart-error]', says: 'what is wrong, said' },
    { hook: '[data-to-checkout]', says: 'the button that goes on to the checkout; held while a line is refused; pressed, it writes the country and method into the cart and says `jtk:to-checkout`' },
  ],
  [
    { hook: '[data-abroad]', says: 'hidden; shown where the parcel leaves the business\'s customs area' },
    { hook: '[data-vat]', says: 'hidden; shown where the prices include VAT' },
    { hook: '[data-cannot-send]', says: 'hidden; shown where the business does not send to the country, or no method carries the parcel' },
    { hook: '[data-cart-retry]', says: 'a button, hidden; shown where the shop could not be asked, and asks again when pressed' },
  ],
);

/** The checkout step: the buyer, the address unless a pick-up, the total, then Stripe's page. */
export const CHECKOUT = piece(
  [
    { hook: 'form[data-checkout]', says: 'the form, `hidden` until the cart\'s *To checkout* hands on; `data-api`, `data-locale`, `data-return` (the path the buyer comes back to: the order\'s page, in the page\'s language) and `data-words` on it, and what it is drawing in `data-state`: `pricing`, `priced`, `stale`, `failed`, `refused`, `empty`, `paying`' },
    { hook: '[name=name]', says: 'the buyer\'s name' },
    { hook: '[name=email]', says: 'the buyer\'s email, where the confirmation is sent' },
    { hook: '[name=phone]', says: 'a phone, optional' },
    { hook: '[data-address]', says: 'around the four lines of the address; hidden for a pick-up' },
    { hook: '[name=line1]', says: 'the address\'s first line' },
    { hook: '[name=line2]', says: 'the address\'s second line, optional' },
    { hook: '[name=postal_code]', says: 'the postal code' },
    { hook: '[name=city]', says: 'the city' },
    { hook: '[data-total]', says: 'the total the buyer is shown and the checkout sends: the subtotal and the method\'s price, as the shop priced the cart when the step was opened' },
    { hook: '[data-challenge]', says: 'empty and hidden; the anti-bot widget goes here where the host has one, and *Pay* waits for its token' },
    { hook: '[data-checkout-error]', says: 'what is wrong, said; tied to the fields it is about' },
    { hook: '[data-pay]', says: 'the button that goes to pay, a submit; held (`aria-disabled`) while the shop is asked — pressed then, it waits for the answer and goes on with it — and one press of it is one order however often it is retried on the same body' },
  ],
  [
    { hook: '[data-abroad]', says: 'hidden; the customs notice, shown for a method that sends across the customs border' },
    { hook: '[data-vat]', says: 'hidden; «incl. VAT» beside the total, shown where the prices include VAT' },
    { hook: '[data-own-currency]', says: 'hidden; beside the pay button, shown where Stripe may offer the buyer their own currency' },
  ],
);

/** The page after payment: the order's state, its lines, its total. */
export const ORDER = piece(
  [
    { hook: '[data-order]', says: 'the page\'s root; `data-api`, `data-locale` and `data-words` on it, and what it is drawing in `data-state`: `loading`, `waiting`, `stopped` (still waiting after two minutes of asking, and asking no more), `paid`, `lapsed`, `cancelled`, `unknown`' },
    { hook: '[data-order-state]', says: 'what the order is, said as a status: waiting, back from Stripe\'s page without paying, paid, lapsed, cancelled, not found' },
    { hook: '[data-order-lines]', says: 'empty; the element writes the order\'s lines, as they were frozen, into it' },
    { hook: '[data-order-total]', says: 'what the order came to' },
    { hook: '[data-pay-again]', says: 'a link (`<a>`), hidden; the element gives it Stripe\'s page to go back to paying, while the order waits and that page is still open' },
  ],
  [
    { hook: '[data-order-number]', says: 'hidden; the order\'s number, once it is paid (a cancelled order keeps the one it had)' },
    { hook: '[data-order-method]', says: 'the shipping method\'s name and what it cost' },
    { hook: '[data-back-to-cart]', says: 'a link to the cart, hidden; shown where the cart is to pay with: a buyer who left Stripe\'s page, an order not confirmed after two minutes, lapsed, cancelled or not found' },
  ],
);

/** A listing of products, which may hide what is sold out once the page has loaded. */
export const LISTING = piece(
  [
    { hook: '[data-listing]', says: 'the listing; `data-api`, and `data-hide-sold-out` where the site chooses to hide what is sold out' },
    { hook: '[data-product-tile]', says: 'each product\'s tile; `data-product` the entry\'s `id`' },
  ],
  [
    { hook: '[data-listing-group]', says: 'around the tiles of one group, so a group with none left to show can be hidden' },
  ],
);

/**
 * The hooks in a piece's `always` that a root lacks — what its element says
 * in the console when it wires one. A hook the root itself matches counts as
 * found, so the element may be handed either the element around the piece or
 * the piece's own root.
 *
 * @param {ParentNode & { matches?: (selector: string) => boolean }} root
 * @param {Piece} one
 * @returns {string[]}
 */
export function lacking(root, one) {
  return one.always.filter(({ hook }) => !(root.matches?.(hook) || root.querySelector(hook))).map(({ hook }) => hook);
}
