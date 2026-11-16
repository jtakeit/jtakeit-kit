/**
 * @jtakeit/kit — the half of a site on jtakeit that does not depend on how
 * the site is built.
 *
 * `@jtakeit/astro` is the scaffold: an Astro project with the platform's
 * contract already on it. Everything in it that is not Astro's lives here,
 * so a site on any other generator can take the same pieces: the booking form, as markup to put on a page at build time and
 * as an element that makes it work in the browser.
 *
 *   import { renderBookingForm } from '@jtakeit/kit/booking';   // build time
 *   import '@jtakeit/kit/elements/booking';                      // the page
 *   @import '@jtakeit/kit/booking.css';                          // optional
 *
 * and the enquiry form the same way: `@jtakeit/kit/lead`,
 * `@jtakeit/kit/elements/lead`, `@jtakeit/kit/lead.css`.
 *
 * The shop's storefront shares five things between its five pieces, each
 * with its own entry (`@jtakeit/kit/shop`, `/shop/words`, `/shop/hooks`,
 * `/shop/cart`, `/shop/checkout`): a product's facts, the words in eight
 * languages, the hooks each piece's markup keeps, the cart as the protocol's
 * lines, and the checkout's press and what follows each of its answers.
 */
export { renderBookingForm, bookingForm, SENDS } from './lib/booking/render.mjs';
export { ALWAYS, ASKED, SAID, HOOKS } from './lib/booking/hooks.mjs';
export { renderLeadForm, inputType } from './lib/lead/render.mjs';
export { wordsFor, LOCALES } from './lib/booking/words.mjs';
export { money } from './lib/money.mjs';
export { SHOP_LOCALES, shopWordsFor } from './lib/shop/words.mjs';
export { PRODUCT, CART, CHECKOUT, ORDER, LISTING } from './lib/shop/hooks.mjs';
export { MAX_LINES, MAX_QTY, cartKey, readCart, addLine, removeLine, setQty, shippingBody, cartView } from './lib/shop/cart.mjs';
export { productFacts, variantFor, valueStates, answersOf, fromPrice } from './lib/shop/product.mjs';
export { ATTEMPT, HOLD, pressKey, freshPress, pressFor, sentOf, keptPress, checkoutBody, missingDetails, afterAnswer, CHECKOUT_WORDS } from './lib/shop/checkout.mjs';
