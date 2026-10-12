/**
 * @jtakeit/kit — the half of a site on jtakeit that does not depend on how
 * the site is built.
 *
 * `@jtakeit/astro` is the scaffold: an Astro project with the platform's
 * contract already on it. Everything in it that is not Astro's lives here,
 * so a site on any other generator can take the same pieces (wiki/66,
 * layer B): the booking form, as markup to put on a page at build time and
 * as an element that makes it work in the browser.
 *
 *   import { renderBookingForm } from '@jtakeit/kit/booking';   // build time
 *   import '@jtakeit/kit/elements/booking';                      // the page
 *   @import '@jtakeit/kit/booking.css';                          // optional
 *
 * and the enquiry form the same way: `@jtakeit/kit/lead`,
 * `@jtakeit/kit/elements/lead`, `@jtakeit/kit/lead.css`.
 */
export { renderBookingForm, bookingForm, SENDS } from './lib/booking/render.mjs';
export { ALWAYS, ASKED, SAID, HOOKS } from './lib/booking/hooks.mjs';
export { renderLeadForm, inputType } from './lib/lead/render.mjs';
export { wordsFor, LOCALES } from './lib/booking/words.mjs';
export { money } from './lib/money.mjs';
