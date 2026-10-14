/**
 * The booking form, as markup — made at build time by whatever builds the
 * site, and made to work in the browser by `@jtakeit/kit/elements/booking`.
 *
 * The rules — when the business is open, how long a slot is, whether a time
 * is still free, what it costs — live in one place, and it is not here: the
 * platform serves six addresses on the site's own host and the element draws
 * what they answer. Nothing about availability is computed on the page, and
 * nothing about the visitor's choice is trusted by the server.
 *
 * Two ways to the same form. `renderBookingForm` writes it as a string, for a
 * site on any generator: Eleventy in a shortcode, Next in
 * `dangerouslySetInnerHTML`, a Node script in a template literal.
 * `bookingForm` gives what that string is made of — the words, the services
 * in their runs, the form's attributes, the days — for a page that writes the
 * markup itself, the way `@jtakeit/astro`'s `BookingForm.astro` does, so the
 * markup is the site's and only the facts are the kit's. Either way, keep the
 * hooks (`./hooks.mjs`): the element reads those and nothing else, and the
 * platform reads what the element sends.
 *
 * ── what the page passes in ─────────────────────────────────────────────────
 *
 * The services and the resources are collection entries the owner edits, so
 * they arrive from the page that reads the collections. Slugs are what the
 * platform books against; titles are what the visitor reads.
 *
 * ── with JavaScript off ─────────────────────────────────────────────────────
 *
 * A booking cannot be made without a script — the free times are fetched — so
 * with scripts off this shows the sentence in `noScript`, and nothing
 * pretends otherwise.
 */
import { money } from '../money.mjs';
import { wordsFor } from './words.mjs';

/**
 * What this form sends to /api/book, said on the page. Preflight reads it off
 * the built page and books in exactly this shape, so a form that sends
 * `units` for nights, or never sends `count`, fails the check rather than
 * passing on a request the platform made up (2 October 2026). The element
 * sends no key that is not here — the list cannot drift from the request,
 * because the element imports this one.
 */
export const SENDS = Object.freeze(['service', 'services', 'resource', 'class', 'party', 'count', 'quantity', 'start', 'name', 'phone', 'email', 'note', 'turnstile']);

/**
 * @typedef {object} Named
 * @property {string} slug    what the platform books against
 * @property {string} title   what the visitor reads
 * @property {number} [takes] minutes, for the running total when several are picked
 * @property {number} [costs] minor units, for the same
 * @property {{ day: string, from: number, until: number, costs: number }[]} [rates] a price by the hour of the week instead of `costs`: the list says «from …», and the price is the slot's, printed beside the time
 * @property {string} [per]   `'person'` for a price times the party — a class per place, shoes; the list says so and the running total multiplies
 * @property {string} [group] a heading the services are listed under — the words (an option's label, a category's title), not the stored value; services with none are listed after every heading
 * @property {string[]} [does] for a resource: the services they perform, by slug — the element greys the others out once they are chosen; empty or absent is everything
 */

/**
 * The least a service priced by the hour of the week may cost, or nothing.
 * @param {Named} one
 */
export function priceFrom(one) {
  const rows = Array.isArray(one.rates) ? one.rates : [];
  return rows.reduce((least, row) => (row.costs > 0 && (least === 0 || row.costs < least) ? row.costs : least), 0);
}

/**
 * @typedef {object} BookingFormProps
 * @property {Named[]} services
 * @property {Named[]} [resources]  empty for a solo business: the platform assigns
 * @property {string} locale        `uk`, `de` or `en` — decides the words drawn before the platform has spoken
 * @property {number} [daysAhead]   how many days ahead the picker offers; the platform clamps to its own horizon
 * @property {boolean} [combine]    the module's `combine` setting: several services for one visit, as a checklist
 * @property {string} [currency]    the site's currency, for the running total
 * @property {string} [scale]       the module's `scale`: `'daily'` for a business that lets things by the day
 * @property {string} [kind]        the module's `kind`: for any kind but a salon's the kind's words are held back until the platform has said them
 * @property {string} [api]         where `/api/` is from this page — under the preview it carries a path, so pass the address as your generator writes a root-relative one (Astro's `under('/api/')`)
 * @property {string} [tag]         the element's name around the form, `jtk-booking`; `''` for none
 * @property {Date} [now]           the day the picker starts from; the build's, by default
 * @property {string[]} [open]      the days the business opens, by name (`monday`…) — the week of days strikes the others out; empty is every day
 * @property {boolean | string} [ui] the form's look — two steps, the week of days, the times by the part of the day, the drawn choice of whom — on by default; `false` for the plain form, or the ones wanted by name: `'week parts'`
 */

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** @param {unknown} value */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

/**
 * A service's price as the list says it: the price, or «from …» for one
 * priced by the hour of the week — whose price is the slot's and is printed
 * beside the time once one is chosen. Plain text, not escaped.
 * @param {Named} one
 * @param {string} currency
 * @param {string} lang
 * @param {Record<string, string>} words
 */
function priceText(one, currency, lang, words) {
  if (one.costs) return money(one.costs, currency, lang);
  const least = priceFrom(one);
  return least > 0 ? `${words.from} ${money(least, currency, lang)}` : '';
}

/**
 * @typedef {object} BookingForm
 * @property {Record<string, string>} words  the form's words, in the page's language; the platform's answer replaces the kind's
 * @property {string} lang                 the language tag prices and days are written in
 * @property {boolean} combine             a checklist, or one `<select>`
 * @property {{ group: string; items: (Named & { meta: string })[] }[]} runs  the checklist's runs, headings in order, the ones with none after them, the add-ons last under their own; `meta` is «45 min · CHF 95»
 * @property {Named[]} services            for one `<select>`, as they came
 * @property {(Named & { does: string })[]} resources  the choice of whom — empty for none; `does` is the slugs, joined, for `data-does`
 * @property {string} today                the day input's `min`
 * @property {string} last                 its `max`
 * @property {Record<string, string>} attrs  every attribute of the `<form>`, `data-booking` and `novalidate` among them — spread them on it
 */

/**
 * What the booking form is made of, for a page that writes the markup.
 *
 * @param {BookingFormProps} props
 * @returns {BookingForm}
 */
export function bookingForm(props) {
  const {
    services, resources = [], locale, daysAhead = 30, combine = false, currency = '', scale = '', kind = '',
    api = '/api/', now = new Date(), open = [], ui = true,
  } = props;
  if (!Array.isArray(services)) throw new TypeError('bookingForm: services is a list of { slug, title }');
  const unsaid = kind !== '' && kind !== 'salon';
  const words = wordsFor(locale, scale);
  const lang = { de: 'de-CH', uk: 'uk-UA', ru: 'ru-RU', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', fr: 'fr-FR' }[locale] ?? 'en';

  // The checklist's runs, in the order the services came, each heading once.
  /** @type {{ group: string; items: Named[] }[]} */
  const runs = [];
  for (const one of services) {
    const group = one.group ?? '';
    const run = runs.find((r) => r.group === group);
    if (run) run.items.push(one);
    else runs.push({ group, items: [one] });
  }
  // The services with no heading go after every run that has one, wherever
  // the first of them came: drawn first, they read as the run above the first
  // heading, and drawn between two they read as the one before. A group is
  // the heading's words — an option's label, a category's title — never the
  // stored value; the page that reads the catalogue resolves it (12 October
  // 2026: the scaffold passed `entry.data.group` itself).
  const loose = runs.findIndex((r) => r.group === '');
  if (loose >= 0 && runs.length > 1) runs.push(...runs.splice(loose, 1));

  const today = now.toISOString().slice(0, 10);
  const last = new Date(now.getTime() + daysAhead * 86_400_000).toISOString().slice(0, 10);

  // An add-on — a price and no length: shoes, a racket — is listed under
  // its own heading, after the services, and rides on the visit.
  const addOns = runs.flatMap((run) => run.items.filter((one) => !one.takes && (one.costs || priceFrom(one))));
  const timedRuns = runs.map((run) => ({ ...run, items: run.items.filter((one) => !addOns.includes(one)) })).filter((run) => run.items.length > 0);
  /** @param {Named} one */
  const meta = (one) => [one.takes ? `${one.takes} min` : '', priceText(one, currency, lang, words), one.per === 'person' ? words.perPerson : ''].filter(Boolean).join(' · ');

  // Fixed, the whole form, as the lead form's labels are: every word in it is
  // the platform's — spoken in the business's kind from the availability
  // answer, «Забронювати» over the build's «Записатися» — or an entry's own
  // title, which the owner edits on the entry. None is the owner's to edit
  // here, and `jtk catalogue` asked whose all seventeen were on a fresh
  // restaurant (30 September 2026).
  /** @type {Record<string, string>} */
  const attrs = {
    'data-booking': '',
    'data-locale': locale,
    'data-currency': currency,
    'data-words': JSON.stringify(words),
    'data-scale': scale,
    'data-api': api,
    'data-sends': SENDS.join(','),
    'data-open': open.join(','),
    ...(ui ? { 'data-ui': ui === true ? 'steps week parts select' : String(ui) } : {}),
    ...(unsaid ? { 'data-unsaid': '' } : {}),
    // Its own name as its value: Astro drops a boolean attribute spread as
    // '', and the browser's own check stopped every booking without a name
    // before the form could say so (12 October 2026).
    novalidate: 'novalidate',
    'data-jtk-fixed': '',
  };

  return {
    words, lang, combine, today, last, attrs, services,
    runs: [...timedRuns, ...(addOns.length ? [{ group: words.addOns, items: addOns }] : [])].map((run) => ({ ...run, items: run.items.map((one) => ({ ...one, meta: meta(one) })) })),
    resources: resources.length > 1 ? resources.map((one) => ({ ...one, does: Array.isArray(one.does) ? one.does.join(',') : '' })) : [],
  };
}

/**
 * The booking form as HTML — `bookingForm`'s facts in the kit's own markup.
 *
 * @param {BookingFormProps} props
 * @returns {string}
 */
export function renderBookingForm(props) {
  const { tag = 'jtk-booking', kind = '' } = props;
  if (!Array.isArray(props.services)) throw new TypeError('renderBookingForm: services is a list of { slug, title }');
  const { words: WORDS, combine, runs, services, resources, today, last, attrs } = bookingForm(props);
  const unsaid = kind !== '' && kind !== 'salon';

  const servicesField = combine
    ? `<fieldset class="booking__services" data-services>
        <legend class="field__label" data-say="services">${esc(WORDS.services)}</legend>
        ${runs.map((run, i) => `<div class="booking__run"${run.group !== '' ? ` role="group" aria-labelledby="booking-run-${i}"` : ''}>
            ${run.group !== '' ? `<p class="booking__run-title" id="booking-run-${i}">${esc(run.group)}</p>` : ''}
            ${run.items.map((one) => `<label class="booking__service" data-service-row>
                <input type="checkbox" name="service" value="${esc(one.slug)}" data-takes="${esc(one.takes ?? 0)}" data-costs="${esc(one.costs ?? 0)}"${one.per === 'person' ? ' data-per="person"' : ''}>
                <span class="booking__service-name" data-service-name>${esc(one.title)}</span>
                <span class="booking__service-meta">${esc(one.meta)}</span>
              </label>`).join('\n')}
          </div>`).join('\n')}
        <p class="booking__total" data-total hidden></p>
      </fieldset>`
    : `<label class="field__label" for="booking-service" data-say="service">${esc(WORDS.service)}</label>
        <select class="field__input" id="booking-service" name="service" required>
          ${services.map((one) => `<option value="${esc(one.slug)}">${esc(one.title)}</option>`).join('\n')}
        </select>`;

  const resourcesField = resources.length > 0
    ? `<div class="field" data-field>
      <label class="field__label" for="booking-resource" data-say="resource">${esc(WORDS.resource)}</label>
      <select class="field__input" id="booking-resource" name="resource" data-say-wait>
        <option value="" data-say="any">${esc(WORDS.any)}</option>
        ${resources.map((one) => `<option value="${esc(one.slug)}"${one.does ? ` data-does="${esc(one.does)}"` : ''}>${esc(one.title)}</option>`).join('\n')}
      </select>
    </div>`
    : '';

  const said = Object.entries(attrs).map(([key, value]) => (value === '' || value === key ? ` ${key}` : ` ${key}="${esc(value)}"`)).join('');
  const form = `<form class="booking${unsaid ? ' booking--unsaid' : ''}"${said}>
  <noscript><p class="booking__note">${esc(WORDS.noScript)}</p></noscript>

  <div class="field" data-field>
    ${servicesField}
  </div>

  ${resourcesField}

  <div class="field" data-field>
    <label class="field__label" for="booking-day">${esc(WORDS.day)}</label>
    <input class="field__input" id="booking-day" name="day" type="date" min="${today}" max="${last}" required>
  </div>

  <div class="field" data-field data-back-field hidden>
    <label class="field__label" for="booking-back">${esc(WORDS.back)}</label>
    <input class="field__input" id="booking-back" name="back" type="date" min="${today}">
    <p class="booking__hint" data-length hidden></p>
  </div>

  <div class="field" data-field data-hours-field hidden>
    <label class="field__label" for="booking-hours">${esc(WORDS.hours)}</label>
    <select class="field__input" id="booking-hours" name="hours"></select>
  </div>

  <div class="field" data-field data-party-field hidden>
    <label class="field__label" for="booking-party">${esc(WORDS.party)}</label>
    <select class="field__input" id="booking-party" name="party"></select>
  </div>

  <div class="field" data-field data-quantity-field hidden>
    <label class="field__label" for="booking-quantity">${esc(WORDS.quantity)}</label>
    <select class="field__input" id="booking-quantity" name="quantity"></select>
  </div>

  <fieldset class="field booking__times" data-times>
    <legend class="field__label">${esc(WORDS.time)}</legend>
    <p class="booking__hint" data-times-hint aria-live="polite">${esc(WORDS.pick)}</p>
    <div class="booking__slots" data-slots></div>
    <p class="booking__ends" data-ends hidden></p>
    <p class="booking__total" data-stay-total hidden></p>
  </fieldset>

  <div class="field" data-field>
    <label class="field__label" for="booking-name">${esc(WORDS.name)} <span aria-hidden="true">*</span></label>
    <input class="field__input" id="booking-name" name="name" type="text" autocomplete="name" required maxlength="120">
  </div>
  <div class="field" data-field>
    <label class="field__label" for="booking-phone">${esc(WORDS.phone)}</label>
    <input class="field__input" id="booking-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40">
  </div>
  <div class="field" data-field>
    <label class="field__label" for="booking-email">${esc(WORDS.email)}</label>
    <input class="field__input" id="booking-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="120">
  </div>
  <div class="field" data-field>
    <label class="field__label" for="booking-note">${esc(WORDS.note)}</label>
    <textarea class="field__input field__input--area" id="booking-note" name="note" rows="3" maxlength="2000"></textarea>
  </div>

  <div class="booking__challenge" data-challenge hidden></div>

  <p class="field__error" id="booking-error" data-booking-error role="alert" hidden></p>

  <button class="booking__submit" type="submit" data-submit data-say="book">${esc(WORDS.book)}</button>

  <div class="booking__done" data-done role="status" tabindex="-1" hidden>
    <p class="booking__done-line" data-done-line></p>
    <p class="booking__done-when" data-done-when></p>
    <p class="booking__done-when" data-done-what hidden></p>
    <div class="booking__keep" data-keep hidden>
      <p class="booking__note" data-keep-note></p>
      <div class="booking__keep-row">
        <input class="field__input booking__keep-link" type="text" readonly data-keep-link>
        <button type="button" class="booking__keep-copy" data-keep-copy></button>
        <a class="booking__keep-open" data-keep-open></a>
      </div>
      <span class="booking__sr" role="status" data-keep-said></span>
    </div>
    <p class="booking__note" data-pay-note hidden></p>
    <p class="booking__links">
      <a data-pay hidden></a>
      <a data-manage hidden></a>
      <a data-telegram hidden target="_blank" rel="noreferrer noopener"></a>
    </p>
  </div>
</form>`;

  return tag ? `<${tag}>${form}</${tag}>` : form;
}
