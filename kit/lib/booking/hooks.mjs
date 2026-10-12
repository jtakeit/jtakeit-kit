/**
 * What `<jtk-booking>` reads off a booking form — the whole of the contract
 * between a form's markup and the element that makes it work.
 *
 * The element finds everything by these: a `data-*` attribute or an input's
 * `name`, never a class. Classes, wrappers, the order of the fields, the
 * words and the look are the site's; a form an agent copies and dresses in
 * its own design keeps working as long as these are on it.
 *
 * Three kinds:
 *
 *   ALWAYS  every form has them, or it cannot book — the element says which
 *           is missing in the console, and the platform's preflight fails a
 *           booking page without them;
 *   ASKED   a field the element shows only when the platform's answer asks
 *           for it — a party, how many, how long, a second date. A form for
 *           a business that never asks may leave one out; preflight fails it
 *           where the business does ask;
 *   SAID    where the element writes what happened — the running total, when
 *           the visit ends, what was taken, the link to keep. Left out, that
 *           line is not said and nothing else changes.
 *
 * The test (kit/test/hooks.test.mjs) holds `renderBookingForm` and the
 * scaffold's `BookingForm.astro` to ALWAYS, ASKED and SAID; the platform's
 * preflight keeps its own copy of ALWAYS and ASKED, written from this one.
 */

/** @typedef {{ hook: string; says: string }} Hook */

/** @type {readonly Hook[]} */
export const ALWAYS = Object.freeze([
  { hook: 'form[data-booking]', says: 'the form; `data-api`, `data-sends` and `data-locale` on it' },
  { hook: '[name=service]', says: 'a `<select>` for one service, or checkboxes for several (`combine`)' },
  { hook: '[name=day]', says: 'an `<input type="date">`; the week of days is drawn over it' },
  { hook: '[data-times]', says: 'around the times: the hint, the times and when the visit ends' },
  { hook: '[data-slots]', says: 'empty; the element writes a button per free time into it' },
  { hook: '[data-times-hint]', says: '«pick a day», «nothing free», «…» while it asks' },
  { hook: '[name=name]', says: 'the visitor\'s name' },
  { hook: '[name=phone]', says: 'a phone or an email, one of the two is needed' },
  { hook: '[name=email]', says: 'a phone or an email, one of the two is needed' },
  { hook: '[data-challenge]', says: 'empty and hidden; the anti-bot widget goes here where the host has one' },
  { hook: '[data-booking-error]', says: 'the refusal, said; tied to the fields it is about' },
  { hook: '[data-submit]', says: 'the submit button' },
  { hook: '[data-done]', says: 'hidden; shown once booked, with the lines below inside it' },
  { hook: '[data-done-line]', says: '«you are booked» or «waiting for the business»' },
  { hook: '[data-done-when]', says: 'the day and the time booked' },
  { hook: '[data-manage]', says: 'a link to the visitor\'s own page: cancel, move' },
  { hook: '[data-pay-note]', says: 'the sentence before paying, where the booking is paid online' },
  { hook: '[data-pay]', says: 'the link that pays, where the booking is paid online' },
]);

/** @type {readonly (Hook & { when: string })[]} */
export const ASKED = Object.freeze([
  { hook: '[data-party-field]', when: 'party_max > 1', says: 'hidden; around `[name=party]`, a `<select>` the element fills' },
  { hook: '[name=party]', when: 'party_max > 1', says: 'how many people' },
  { hook: '[data-quantity-field]', when: 'quantity_max > 1', says: 'hidden; around `[name=quantity]`' },
  { hook: '[name=quantity]', when: 'quantity_max > 1', says: 'how many of a class at once' },
  { hook: '[data-hours-field]', when: 'an hourly service with most > fewest', says: 'hidden; around `[name=hours]`' },
  { hook: '[name=hours]', when: 'an hourly service with most > fewest', says: 'how long, in the service\'s units' },
  { hook: '[data-back-field]', when: 'a daily service with most > fewest', says: 'hidden; around `[name=back]` and `[data-length]`' },
  { hook: '[name=back]', when: 'a daily service with most > fewest', says: 'the second date: until when' },
  { hook: '[data-length]', when: 'a daily service with most > fewest', says: 'how many nights may be taken' },
  { hook: '[name=resource]', when: 'the visitor chooses whom', says: 'a `<select>`: anyone, a class, or one by name' },
]);

/** @type {readonly Hook[]} */
export const SAID = Object.freeze([
  { hook: '[data-field]', says: 'on each field\'s wrapper: what the two steps sort and what is hidden once booked' },
  { hook: '[data-services]', says: 'the checklist\'s fieldset' },
  { hook: '[data-service-row]', says: 'the `<label>` around each checkbox: greyed with `data-off` when the one chosen does not do it' },
  { hook: '[data-service-name]', says: 'the service\'s name inside the row' },
  { hook: '[data-total]', says: 'the running total of a checklist' },
  { hook: '[data-ends]', says: '«until about 10:45 · 1 h 15 min»' },
  { hook: '[data-stay-total]', says: 'the price of a stay' },
  { hook: '[data-done-what]', says: 'what was taken: «with Noa», «any of Economy»' },
  { hook: '[data-keep]', says: 'hidden; the link to keep, with `[data-keep-note]`, `[data-keep-link]`, `[data-keep-copy]`, `[data-keep-open]`, `[data-keep-said]`' },
  { hook: '[data-telegram]', says: 'a link to the business\'s Telegram bot, where it has one' },
  { hook: '[name=note]', says: 'a note to the business' },
]);

/** Every hook, for a check that reads them all. */
export const HOOKS = Object.freeze([...ALWAYS, ...ASKED, ...SAID].map((one) => one.hook));

/**
 * The hooks in `ALWAYS` a form lacks — what the element says in the console
 * when it wires one.
 * @param {ParentNode & { matches?: (s: string) => boolean }} form
 */
export function lacking(form) {
  return ALWAYS.filter(({ hook }) => hook !== 'form[data-booking]' && !form.querySelector(hook)).map(({ hook }) => hook);
}
