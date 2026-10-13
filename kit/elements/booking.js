/**
 * `<jtk-booking>` — the booking form, made to work.
 *
 * The whole client. No framework, one form, one fetch per question. Every
 * rule enforced here is enforced again by the platform — the browser's checks
 * are a convenience, never a gate — so the script's only jobs are to fetch
 * the free times, to render the widget it is told to, and to say plainly
 * what the platform answered.
 *
 *   GET  /api/turnstile             the widget's key, or "" for none
 *   GET  /api/availability?service=…&from=…&to=…[&resource=…][&party=…][&count=…]
 *        → { zone, slots[{start, free, ends, costs_minor}], party_max, quantity_max, scale, services[{slug,
 *            scale, takes, fewest, most}], prices{class: minor}, currency, … }
 *   POST /api/book                  → { id, state, amount_minor, currency, token, manage_path, telegram_url }
 *   POST /api/pay                   → { url } — only when amount_minor > 0
 *
 * Every request names the protocol version: `X-Jtk-Booking: 1` (BOOKING_PROTOCOL).
 *
 * The visitor's own page — cancel, move, add to calendar — is served by the
 * platform at `manage_path`; this form only has to link to it.
 *
 * ── how a page gets it ──────────────────────────────────────────────────────
 *
 * Import this module once on the page and every `<form data-booking>` is
 * wired: the ones inside a `<jtk-booking>` by the element's own lifecycle,
 * which also covers markup the panel places later (`fl:placed`); the ones
 * written bare by a walk of the document at load. The markup is the site's —
 * the scaffold's `BookingForm.astro` written out, or `renderBookingForm`'s
 * (`@jtakeit/kit/booking`) — and the element finds everything in it by a
 * `data-*` hook or an input's `name`, never by a class: the list is
 * `@jtakeit/kit/booking/hooks`. A hook left out is said in the console and
 * its field is never shown; the CSS the behaviour needs (`[hidden]`, the
 * steps, the native control under a drawn one) and the ARIA it depends on are
 * put on the page by the element, so a form restyled from nothing keeps them.
 *
 * ── a stay of several nights ────────────────────────────────────────────────
 *
 * By the day a visitor gives two dates, from and until, and the form sends how
 * many of the service that is — `count`, nights of «a day» — and **never an
 * end**: the platform computes the end and the price from the service. The
 * answer to the first question says, per service, what may be taken (`fewest`,
 * `most`); a service taken a fixed number of times — «a week» — asks for one
 * date only. What the form draws comes from that answer rather than from the
 * build, so a service changed in the panel needs no rebuild.
 *
 * ── any of a class, or this one ─────────────────────────────────────────────
 *
 * Where the business keeps classes, the choice of what to take is «any free
 * Економ» — the platform gives the first free one — or one car by name, with
 * what tells it from its twins: «VW Combi · білий · AA1234BB». Both from the
 * platform's answer (`resources`, `classes`), and the page that just booked
 * says which was taken.
 */
import { money } from '../lib/money.mjs';
import { wordsFor } from '../lib/booking/words.mjs';
import { dressBooking } from './booking-ui.js';
import { lacking } from '../lib/booking/hooks.mjs';

/**
 * The rules the behaviour cannot work without, whatever the site's own CSS
 * says — put on the page once, by the element, at the lowest specificity
 * that still wins where it must. Not a look: every state here is shown and
 * hidden by the `hidden` attribute, the two steps by `data-stage`, a drawn
 * control over a native one by `data-replaced`; a form an agent dressed from
 * nothing lost all three with `booking.css` (12 October 2026). The first two
 * are `!important`, as `hidden` is: a site's `display: grid` on a piece of
 * the second step drew it on the first.
 */
const BASE = `
[data-booking] [hidden] { display: none !important; }
[data-booking][data-unsaid] :is([data-say], [data-say-wait]) { visibility: hidden; }
:where([data-booking]) :where([data-replaced], .is-replaced, [data-sr], .booking__sr) {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; border: 0;
}
:where([data-booking]) :where([data-replaced], .is-replaced) { opacity: 0; pointer-events: none; }
[data-booking][data-stage='1'] [data-step='2'], [data-booking][data-stage='2'] [data-step='1'],
[data-booking][data-stage='done'] [data-step-ui] { display: none !important; }
:where([data-booking] :focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
`;

function putBase() {
  if (typeof document === 'undefined' || document.querySelector('style[data-jtk-booking]')) return;
  const style = document.createElement('style');
  style.dataset.jtkBooking = '';
  style.textContent = BASE;
  // First in <head>, so a site's own rule of the same weight wins.
  document.head.prepend(style);
}
let wiredCount = 0;

// The words that depend on the kind of business, as the platform says them:
// its availability answer carries the form's, in every language, the site's
// own over the kind's. Heard from every answer, and asked for once at the
// start, so they are there before anybody has picked a day.
const SAID = {
  'form.service': 'service', 'form.services': 'services', 'form.resource': 'resource', 'form.any': 'any',
  'form.book': 'book', 'form.sending': 'sending', 'form.confirmed': 'confirmed', 'form.pending': 'pending',
  'form.manage': 'manage', 'form.failed': 'failed', 'form.tooMany': 'tooMany', 'form.length': 'length',
};

/**
 * Days between two dates of the picker, by the calendar rather than by the
 * clock: a night the clocks move is still one night.
 * @param {string} from  YYYY-MM-DD
 * @param {string} until YYYY-MM-DD
 */
export function daysBetween(from, until) {
  const [a, b] = [from, until].map((iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / 86_400_000);
}

/** @param {string} iso YYYY-MM-DD @param {number} n */
export function plusDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * «2 год», «1 год 30 хв»: n of a rate, said as the time it is.
 * @param {number} minutes
 * @param {Record<string, string>} words
 */
export function lasting(minutes, words) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h > 0 ? `${h} ${words.hourShort}` : '', m > 0 ? `${m} ${words.minuteShort}` : ''].filter(Boolean).join(' ');
}

/**
 * Wires one form. Idempotent: a form already wired is left alone.
 * @param {HTMLFormElement} form
 */
/**
 * The booking protocol's version this element speaks, named on every request
 * (the platform's wiki/79). A page is a file in a build: when the platform
 * changes, a site keeps the kit it was built with, and the platform answers it
 * by this number for as long as a live site speaks it — so it moves only with
 * a change the platform cannot make by adding, and the platform says which
 * versions it answers when it refuses one.
 */
export const BOOKING_PROTOCOL = 1;
const SPOKEN = { 'x-jtk-booking': String(BOOKING_PROTOCOL) };

export function wireBooking(form) {
  if (form.dataset.jtkWired === '1') return;
  form.dataset.jtkWired = '1';

  putBase();
  const missing = lacking(form);
  if (missing.length > 0) console.error(`booking form: it has no ${missing.join(', ')}, and cannot book without them — the hooks are listed in @jtakeit/kit/booking/hooks`);

  /** @type {Record<string, string>} */
  // The form's own words under the page's: a form rendered by an older kit
  // carries none of the newer ones.
  const words = { ...wordsFor(form.dataset.locale ?? 'en', form.dataset.scale ?? ''), ...JSON.parse(form.dataset.words ?? '{}') };
  // Days or hours. The page's own setting first; the platform's answer,
  // once there is one, wins — an owner may switch without a rebuild.
  let daily = form.dataset.scale === 'daily';
  const api = form.dataset.api ?? '/api/';
  // A hook the form left out is an element of its kind that is never on the
  // page: the field it stands for is never shown, and nothing here throws.
  /** @template {HTMLElement} T @param {string} sel @param {string} [tag] @returns {T} */
  const q = (sel, tag = 'div') => /** @type {any} */ (form.querySelector(sel) ?? document.createElement(tag));
  const lang = form.dataset.locale ?? 'en';
  const pageLang = () => document.documentElement.lang || 'en';

  // One select, or a checklist: what is chosen is a list either way.
  const select = /** @type {HTMLSelectElement | null} */ (form.querySelector('select[name=service]'));
  const boxes = /** @type {HTMLInputElement[]} */ ([...form.querySelectorAll('input[type=checkbox][name=service]')]);
  const total = /** @type {HTMLElement | null} */ (form.querySelector('[data-total]'));
  // A checkbox's row and the service's name in it, by their hooks; the
  // classes of an older kit's markup where a form has no hooks.
  /** @param {HTMLInputElement} box */
  const rowOf = (box) => /** @type {HTMLElement | null} */ (box.closest('[data-service-row], .booking__service, label'));
  /** @param {Element} row */
  const nameIn = (row) => /** @type {HTMLElement | null} */ (row.querySelector('[data-service-name], .booking__service-name'));
  const picked = () => (select ? (select.value ? [select.value] : []) : boxes.filter((b) => b.checked).map((b) => b.value));
  function showTotal() {
    if (!total) return;
    const chosenBoxes = boxes.filter((b) => b.checked);
    if (chosenBoxes.length < 2) { total.hidden = true; return; }
    const minutes = chosenBoxes.reduce((sum, b) => sum + Number(b.dataset.takes ?? 0), 0);
    // A price per person is times the party (wiki/70); the slot's price is
    // the platform's, this is the list's own running sum.
    const people = partyField.hidden ? 1 : Number(party.value) || 1;
    const minor = chosenBoxes.reduce((sum, b) => sum + Number(b.dataset.costs ?? 0) * (b.dataset.per === 'person' ? people : 1), 0);
    const price = minor > 0 ? ' · ' + money(minor, form.dataset.currency, pageLang()) : '';
    total.textContent = `${words.total}: ${minutes} min${price}`;
    total.hidden = false;
  }
  const resource = /** @type {HTMLSelectElement | null} */ (form.querySelector('[name=resource]'));
  /** @type {HTMLSelectElement} */ const party = q('[name=party]', 'select');
  /** @type {HTMLSelectElement} */ const quantity = q('[name=quantity]', 'select');
  /** @type {HTMLElement} */ const quantityField = q('[data-quantity-field]');
  /** @type {HTMLSelectElement} */ const hours = q('[name=hours]', 'select');
  /** @type {HTMLElement} */ const hoursField = q('[data-hours-field]');
  /** @type {HTMLElement} */ const partyField = q('[data-party-field]');
  /** @type {HTMLInputElement} */ const day = q('[name=day]', 'input');
  /** @type {HTMLElement | null} */ const ends = form.querySelector('[data-ends]');
  // The day's floor is the browser's today, not the build's: `min` was
  // written when the site was built, and a site built on Friday is read on
  // Saturday (10 October 2026).
  {
    const n = new Date();
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    if (!day.min || day.min < today) day.min = today;
  }
  // What each resource does, read off the options before the element
  // rewrites them from the platform's answers.
  /** @type {Map<string, Set<string>>} */
  const does = new Map();
  for (const option of resource?.options ?? []) {
    if (option.dataset.does) does.set(option.value, new Set(option.dataset.does.split(',').filter(Boolean)));
  }
  /** @type {Set<HTMLInputElement | HTMLOptionElement>} */
  const offByMe = new Set();
  /** @type {HTMLElement} */ const slots = q('[data-slots]');
  /** @type {HTMLElement} */ const hint = q('[data-times-hint]');
  /** @type {HTMLElement} */ const error = q('[data-booking-error]');
  /** @type {HTMLButtonElement} */ const submit = q('[data-submit]');
  /** @type {HTMLElement} */ const challenge = q('[data-challenge]');
  /** @type {HTMLInputElement} */ const back = q('[name=back]', 'input');
  /** @type {HTMLElement} */ const backField = q('[data-back-field]');
  /** @type {HTMLElement} */ const lengthHint = q('[data-length]');
  /** @type {HTMLElement} */ const stayTotal = q('[data-stay-total]');

  // The ARIA the behaviour depends on, whatever the copy kept: the hint is
  // read as it changes, the refusal as it appears, the answer takes the focus
  // and is read, and a refusal is tied to its fields by the error's id.
  if (!hint.hasAttribute('aria-live')) hint.setAttribute('aria-live', 'polite');
  if (!error.getAttribute('role')) error.setAttribute('role', 'alert');
  if (!error.id) error.id = `jtk-booking-error-${++wiredCount}`;
  {
    /** @type {HTMLElement} */ const answerBox = q('[data-done]');
    if (!answerBox.getAttribute('role')) answerBox.setAttribute('role', 'status');
    if (!answerBox.hasAttribute('tabindex')) answerBox.tabIndex = -1;
    const keepSaid = form.querySelector('[data-keep-said]');
    if (keepSaid && !keepSaid.getAttribute('role')) keepSaid.setAttribute('role', 'status');
  }

  /** @param {Record<string, Record<string, string>>} [all] */
  function hear(all) {
    const mine = all?.[lang] ?? all?.en;
    if (mine) {
      for (const [key, name] of Object.entries(SAID)) if (mine[key]) words[name] = mine[key];
      for (const el of /** @type {NodeListOf<HTMLElement>} */ (form.querySelectorAll('[data-say]'))) {
        // A button mid-send says «sending»; it says «book» again when done.
        if (el instanceof HTMLButtonElement && el.disabled) continue;
        el.textContent = words[el.dataset.say ?? ''] ?? el.textContent;
      }
    }
    unsay();
  }
  function unsay() {
    form.classList.remove('booking--unsaid');
    delete form.dataset.unsaid;
  }
  // Held back at most this long: a platform that is slow to answer is not
  // a reason for a form without a button.
  setTimeout(unsay, 3000);
  {
    const first = select?.options[0]?.value ?? boxes[0]?.value ?? '';
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    if (first) {
      const params = new URLSearchParams({ service: first, from: from.toISOString(), to: to.toISOString() });
      void fetch(api + 'availability?' + params.toString(), { cache: 'no-store', headers: SPOKEN })
        .then((r) => (r.ok ? r.json() : {}))
        .then((data) => {
          hear(data.words);
          hearCombine(data.combine);
          sayEmptyServices(data.empty_services ?? []);
        })
        .catch(() => hear());
    } else {
      hear();
    }
  }

  // What the platform said each service may be taken as, and the prices of
  // what was last asked — from the answer, never from the build.
  /** @type {Map<string, { slug: string; scale: string; takes: number; fewest: number; most: number }>} */
  const offered = new Map();
  /** @type {Record<string, number>} */ let prices = {};
  /** @type {Record<string, string>} */ let classOf = {};
  // The site's, from the page, and then the platform's own answer below: no
  // sign made up while it is asked (11 October 2026).
  let currency = form.dataset.currency || '';

  // One service or several, as the platform answers it now: the owner flips
  // `combine` in the panel and a checklist built while it was on keeps to one
  // choice once it is off, rather than offering two the booking refuses.
  let single = false;
  /** @param {unknown} said */
  function hearCombine(said) {
    if (typeof said !== 'boolean' || boxes.length === 0) return;
    single = !said;
    if (!single) return;
    let kept = false;
    for (const box of boxes) {
      if (box.checked && kept) box.checked = false;
      if (box.checked) kept = true;
    }
    showTotal();
  }

  /** @type {string | null} */ let chosen = null;
  let zone = '';
  let turnstileToken = '';

  /** The page's own scheme — `color-scheme` on the root — or the browser's. */
  function turnstileTheme() {
    const said = form.dataset.turnstileTheme;
    if (said === 'light' || said === 'dark' || said === 'auto') return said;
    const scheme = getComputedStyle(document.documentElement).colorScheme || '';
    if (/\blight\b/.test(scheme) && !/\bdark\b/.test(scheme)) return 'light';
    if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme)) return 'dark';
    return 'auto';
  }

  // The widget, if this host has one. Asked at runtime so the site carries
  // no key: which widget covers a host is the platform's to decide.
  void fetch(api + 'turnstile', { cache: 'no-store', headers: SPOKEN })
    .then((r) => r.json())
    .then((data) => {
      if (!data.sitekey) return;
      challenge.hidden = false;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        window.turnstile?.render(challenge, {
          sitekey: data.sitekey,
          // The widget in the page's colours and language, not the
          // browser's: a light site showed a dark box saying «Успешно» to
          // a visitor whose browser was dark and Russian (10 October 2026).
          // `data-turnstile-theme` on the form says otherwise.
          theme: turnstileTheme(),
          language: pageLang(),
          callback: (token) => { turnstileToken = token; },
          'expired-callback': () => { turnstileToken = ''; },
        });
      };
      document.head.appendChild(script);
    })
    .catch(() => undefined);

  // The party control appears the first time the platform says how large a
  // party may be, and asks again when it changes.
  /** @param {number} most */
  function offerParty(most) {
    if (most <= 1) { partyField.hidden = true; return; }
    if (party.options.length !== most) {
      const was = party.value;
      party.textContent = '';
      for (let n = 1; n <= most; n++) {
        const option = document.createElement('option');
        option.value = String(n);
        option.textContent = String(n);
        party.appendChild(option);
      }
      party.value = was && Number(was) <= most ? was : '1';
    }
    if (partyField.hidden) {
      partyField.hidden = false;
      party.addEventListener('change', () => { showTotal(); void load(); });
    }
  }

  /**
   * How many of the class one request may take (wiki/69): the settings'
   * most, and no more than are free at the chosen time. Hidden at one, and
   * when a resource is named — a name is one thing.
   * @param {number} most
   * @param {number} free
   */
  function offerQuantity(most, free) {
    if (most <= 1 || resourceChosen()) { quantityField.hidden = true; return; }
    const cap = Math.max(1, Math.min(most, free || most));
    const was = quantity.value;
    quantity.textContent = '';
    for (let n = 1; n <= cap; n++) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = String(n);
      quantity.appendChild(option);
    }
    quantity.value = was && Number(was) <= cap ? was : '1';
    quantityField.hidden = false;
  }
  function quantityChosen() {
    return quantityField.hidden ? 1 : Number(quantity.value) || 1;
  }
  // The fields the last refusal was about: marked invalid and described by
  // the sentence, so a screen reader reads it on the field itself and not
  // only as it appears (WCAG 3.3.1, 12 October 2026).
  /** @type {HTMLElement[]} */ let blamed = [];
  /** @param {string} text @param {HTMLElement[]} [fields] the fields it is about */
  function say(text, fields = []) {
    error.textContent = text;
    error.hidden = text === '';
    for (const field of blamed) {
      field.removeAttribute('aria-invalid');
      const rest = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== error.id);
      if (rest.length) field.setAttribute('aria-describedby', rest.join(' '));
      else field.removeAttribute('aria-describedby');
    }
    blamed = text === '' || !error.id ? [] : fields;
    for (const field of blamed) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
    }
  }

  // A refusal as a sentence in the visitor's language. The platform answers
  // with a JSON body — `{"error":"challenge"}` — or with a line of prose;
  // neither is for a visitor to read as it came, and a sweep once found the
  // JSON printed between the form and its button.
  /** @param {Response} answer */
  async function reason(answer) {
    let body = '';
    try { body = await answer.text(); } catch { /* nothing to read */ }
    let code = '';
    try { code = String(JSON.parse(body).error ?? ''); } catch { /* prose */ }
    if (answer.status === 403 || code === 'challenge') return words.challenge;
    if (answer.status === 429) return words.tooMany;
    if (answer.status === 409) return words.taken;
    return words.failed;
  }

  // A letting's day, «сб, 26 вер.» on a button, «субота, 26 вересня» in a
  // sentence. Out to back, both drawn: the day it comes back is the day to
  // bring it.
  /** @param {string} iso @param {boolean} long */
  function dayOf(iso, long) {
    try {
      return new Intl.DateTimeFormat(pageLang(), long
        ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone || undefined }
        : { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone || undefined },
      ).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  }

  // A letting handed over at an hour says it beside the day — «сб, 10 жовт.
  // 15:00»; one from midnight is its day (25 September 2026).
  /** @param {string} iso @param {boolean} long */
  function dayAndHour(iso, long) {
    let midnight = true;
    try {
      midnight = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone || undefined }).format(new Date(iso)) === '00:00';
    } catch { /* the day alone */ }
    return midnight ? dayOf(iso, long) : `${dayOf(iso, long)}, ${clock(iso)}`;
  }

  // On a 24-hour clock in every language: the sites are Swiss, German and
  // Ukrainian, and «11:15 AM» on a Zürich salon's page reads as foreign.
  /** @param {string} iso */
  function clock(iso) {
    try {
      return new Intl.DateTimeFormat(pageLang(), {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone || undefined,
      }).format(new Date(iso));
    } catch {
      return iso.slice(11, 16);
    }
  }

  // The one service a stay is of, and what it may be taken as — null for a
  // visit of several, or an hourly one, or before the platform has said.
  function stay() {
    const slugs = picked();
    if (slugs.length !== 1) return null;
    const one = offered.get(slugs[0]);
    if (!one || one.scale !== 'daily') return null;
    return { unit: Math.max(1, Math.round(one.takes / 1440)), fewest: one.fewest || 1, most: one.most || 1 };
  }

  // The one rate by the hour that may be taken several times, and how —
  // null for anything else, or before the platform has said.
  function byHours() {
    const slugs = picked();
    if (slugs.length !== 1) return null;
    const one = offered.get(slugs[0]);
    if (!one || one.scale === 'daily' || (one.most || 1) <= (one.fewest || 1)) return null;
    return { takes: one.takes, fewest: one.fewest || 1, most: one.most };
  }

  // The choice of how long, as the chosen rate allows it: shown, filled,
  // and keeping what was chosen where it still may be.
  function fitHours() {
    const h = byHours();
    if (!h) { hoursField.hidden = true; return; }
    const was = hours.value;
    hours.textContent = '';
    for (let n = h.fewest; n <= h.most; n++) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = lasting(n * h.takes, words);
      hours.appendChild(option);
    }
    hours.value = [...hours.options].some((o) => o.value === was) ? was : String(h.fewest);
    hoursField.hidden = false;
  }

  // How many of the service the two dates are, or null where there is no
  // choice to send; NaN for dates the service does not allow. By the hour,
  // the hours chosen.
  function count() {
    const h = byHours();
    if (h) return Number(hours.value) || h.fewest;
    const s = stay();
    if (!s || s.fewest === s.most || !back.value || !day.value) return s ? s.fewest : null;
    const nights = daysBetween(day.value, back.value);
    const n = nights / s.unit;
    return Number.isInteger(n) && n >= s.fewest && n <= s.most ? n : NaN;
  }

  // The second date as the service allows it: shown, bounded, and filled
  // with the shortest stay when it is empty or out of bounds.
  function fitBack() {
    const s = stay();
    daily = s !== null || (offered.size === 0 && daily);
    if (!s || s.fewest === s.most || !day.value) { backField.hidden = true; lengthHint.hidden = true; return; }
    backField.hidden = false;
    back.min = plusDays(day.value, s.fewest * s.unit);
    back.max = plusDays(day.value, s.most * s.unit);
    if (!back.value || back.value < back.min || back.value > back.max) back.value = back.min;
    lengthHint.textContent = words.length.replace('{min}', String(s.fewest * s.unit)).replace('{max}', String(s.most * s.unit));
    lengthHint.hidden = false;
  }

  function showStayTotal() {
    const s = stay();
    const cls = classChosen() || (resourceChosen() ? classOf[resourceChosen()] ?? '' : '');
    const minor = prices[cls] ?? prices[''] ?? 0;
    if (!s || minor <= 0) { stayTotal.hidden = true; return; }
    stayTotal.textContent = `${words.total}: ` + money(minor, currency, pageLang());
    stayTotal.hidden = false;
  }

  // Which question is the latest. Two dates changed quickly are two
  // questions in flight, and both answers drew their buttons — the same
  // stay offered twice. Only the last one asked is drawn.
  let asking = 0;

  // «class:<slug>» is «any free one of the class»; anything else a resource.
  const classChosen = () => (resource?.value.startsWith('class:') ? resource.value.slice(6) : '');
  const resourceChosen = () => (resource && !resource.value.startsWith('class:') ? resource.value : '');

  // The choice rebuilt from every answer: every class as «any free», then
  // every resource by its name and its marks. A class nothing is in is said
  // and cannot be chosen: offered as «any free», it answered «nothing free»
  // on every day, as if another might be different. So is a master who
  // does not do what is asked — and the answer changes with the service,
  // which is why it is rebuilt each time (2 October 2026). One already
  // chosen stays chosen, said, rather than swapped for somebody else.
  /**
   * @param {{ slug: string; title: string }[]} classes
   * @param {{ slug: string; title: string; marks: string; class: string; performs?: boolean }[]} resources
   * @param {{ slug: string; title: string }[]} [empty]
   */
  function offerChoices(classes, resources, empty = []) {
    if (!resource || resources.length === 0) return;
    const was = resource.value;
    resource.textContent = '';
    /** @param {string} value @param {string} label @param {boolean} [disabled] */
    const add = (value, label, disabled = false) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.disabled = disabled;
      if (value === '') option.dataset.say = 'any';
      resource.appendChild(option);
    };
    add('', words.any);
    for (const one of classes) add('class:' + one.slug, words.anyOf.replace('{class}', one.title));
    for (const one of empty) add('empty:' + one.slug, words.noneOf.replace('{class}', one.title), true);
    for (const one of resources) {
      const name = one.marks ? `${one.title} · ${one.marks}` : one.title;
      add(one.slug, one.performs === false ? words.notFor.replace('{who}', name) : name, one.performs === false);
    }
    if ([...resource.options].some((o) => o.value === was)) resource.value = was;
  }

  /**
   * A resource chosen: the services they do not do go grey and come
   * unticked, with their name on them («not with Noa»); «anyone» brings
   * them all back. The other direction — a service chosen, the resources
   * who do not do it — the platform's answer says (`performs`).
   */
  function greyByResource() {
    const who = resource?.value ?? '';
    const option = resource?.options[resource.selectedIndex];
    const name = (option?.textContent ?? '').split(' · ')[0].trim();
    const can = who && !who.startsWith('class:') && !who.startsWith('empty:') && does.has(who) ? does.get(who) : null;
    let moved = false;
    for (const box of boxes) {
      const row = rowOf(box);
      const off = can !== null && !can.has(box.value);
      if (off && !box.disabled) {
        box.disabled = true;
        offByMe.add(box);
        if (box.checked) { box.checked = false; moved = true; }
      } else if (!off && offByMe.has(box)) {
        box.disabled = false;
        offByMe.delete(box);
      }
      row?.classList.toggle('is-off', offByMe.has(box));
      if (row) row.toggleAttribute('data-off', offByMe.has(box));
      let note = row?.querySelector('[data-service-off], .booking__service-off') ?? null;
      if (offByMe.has(box) && row) {
        const nameEl = nameIn(row);
        if (!note && nameEl) {
          note = document.createElement('span');
          note.className = 'booking__service-off';
          note.setAttribute('data-service-off', '');
          nameEl.insertAdjacentElement('afterend', note);
        }
        if (note) note.textContent = words.notWith.replace('{who}', name.split(' ')[0] || name);
      } else {
        note?.remove();
      }
    }
    for (const o of select?.options ?? []) {
      const off = can !== null && !can.has(o.value);
      if (off && !o.disabled) { o.disabled = true; offByMe.add(o); }
      else if (!off && offByMe.has(o)) { o.disabled = false; offByMe.delete(o); }
    }
    if (select && select.options[select.selectedIndex]?.disabled) {
      const next = [...select.options].find((o) => !o.disabled);
      if (next) { select.value = next.value; moved = true; }
    }
    if (moved) showTotal();
  }

  // The resource chosen, if it does not do what is asked: its name, for
  // saying so in place of «nothing free on this day».
  /** @param {{ slug: string; title: string; performs?: boolean }[]} resources */
  function chosenNotFor(resources) {
    const one = resources.find((r) => r.slug === resourceChosen());
    return one && one.performs === false ? one.title : '';
  }

  // A service nobody performs — a salon's service no master does — is said
  // and cannot be chosen, as a class nothing is in: offered, it answered
  // «nothing free» on every day. True when the choice had to move off it,
  // so what is now chosen is asked for.
  /** @param {{ slug: string; title: string }[]} empty */
  function sayEmptyServices(empty) {
    let moved = false;
    for (const one of empty) {
      const said = words.noneOf.replace('{class}', one.title);
      const option = select ? [...select.options].find((o) => o.value === one.slug) : undefined;
      if (select && option && !option.disabled) {
        option.disabled = true;
        option.textContent = said;
        if (select.value === one.slug) {
          const next = [...select.options].find((o) => !o.disabled);
          if (next) { select.value = next.value; moved = true; }
        }
      }
      const box = boxes.find((b) => b.value === one.slug);
      if (box && !box.disabled) {
        box.disabled = true;
        const row = rowOf(box);
        const name = row ? nameIn(row) : null;
        if (name) name.textContent = said;
        if (box.checked) { box.checked = false; showTotal(); moved = true; }
      }
    }
    return moved;
  }

  // The last answer's choices, so that a form with nothing picked any more
  // can offer every master again: «not for this choice» is about a choice,
  // and it went on reading that way after the choice was taken back
  // (9 October 2026).
  let lastClasses = [];
  let lastResources = [];

  async function load() {
    const mine = ++asking;
    // The start picked before this reload: picked again if it is still
    // offered — a service added, the same time — and said gone if not.
    const wanted = chosen;
    chosen = null;
    slots.textContent = '';
    if (ends) ends.hidden = true;
    if (!day.value || picked().length === 0) {
      hint.textContent = picked().length === 0 ? words.pickService : words.pick;
      if (lastResources.length > 0) offerChoices(lastClasses, lastResources.map((one) => ({ ...one, performs: true })), []);
      return;
    }
    hint.textContent = '…';
    slots.setAttribute('aria-busy', 'true');

    const from = new Date(day.value + 'T00:00:00');
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    for (const slug of picked()) params.append('service', slug);
    if (resourceChosen()) params.set('resource', resourceChosen());
    if (classChosen()) params.set('class', classChosen());
    if (!partyField.hidden && party.value) params.set('party', party.value);
    const n = count();
    if (Number.isNaN(n)) { hint.textContent = lengthHint.textContent || words.failed; stayTotal.hidden = true; return; }
    if (n !== null) params.set('count', String(n));

    try {
      const answer = await fetch(api + 'availability?' + params.toString(), { cache: 'no-store', headers: SPOKEN }).finally(() => slots.removeAttribute('aria-busy'));
      if (!answer.ok) throw new Error(await answer.text());
      if (mine !== asking) return;
      const data = await answer.json();
      hear(data.words);
      hearCombine(data.combine);
      lastClasses = data.classes ?? [];
      lastResources = data.resources ?? [];
      offerChoices(lastClasses, lastResources, data.empty_classes ?? []);
      if (sayEmptyServices(data.empty_services ?? [])) { void load(); return; }
      zone = data.zone;
      if (typeof data.scale === 'string') daily = data.scale === 'daily';
      offerParty(data.party_max ?? 0);
      offerQuantity(data.quantity_max ?? 1, Math.max(0, ...(data.slots ?? []).map((/** @type {{free?: string[]}} */ s) => (s.free ?? []).length)));
      // A platform that says what each service may be taken as: the second
      // date follows it. The first answer may change what was asked — the
      // shortest stay filled in — and is asked once more with it.
      if (Array.isArray(data.services)) {
        const knewBefore = offered.size > 0;
        for (const one of data.services) offered.set(one.slug, one);
        prices = data.prices ?? {};
        classOf = data.class_of ?? {};
        if (data.currency) currency = data.currency;
        const was = back.value;
        fitBack();
        fitHours();
        if (!knewBefore && stay() && back.value !== was && !backField.hidden) { void load(); return; }
        showStayTotal();
      }
      if (data.slots.length === 0) {
        // A party larger than any table is not a busy day: no other day has
        // a place for it either (the night run of 2 October 2026).
        const seats = data.party_seats ?? 0;
        const asked = partyField.hidden ? 1 : Number(party.value);
        // Nor is a master who does not do what was asked (2 October 2026).
        const notFor = chosenNotFor(data.resources ?? []);
        hint.textContent = notFor ? words.notForChosen.replace('{who}', notFor).replace('{any}', words.any)
          : seats > 0 && asked > seats ? words.noParty : words.none;
        return;
      }
      hint.textContent = '';
      // A price beside each time only where the times differ in price — a
      // rate by the hour (wiki/68). Where every time costs the same, the
      // price is the services' and is said beside them: «09:00 · CHF 95» on
      // thirty pills is one number read thirty times (11 October 2026).
      const slotPrices = new Set(data.slots.map((one) => one.costs_minor ?? 0));
      const pricedByTime = slotPrices.size > 1;
      for (const slot of data.slots) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'booking__slot';
        button.dataset.slot = '';
        // Which one is chosen, said as well as drawn.
        button.setAttribute('aria-pressed', 'false');
        button.textContent = daily
          ? slot.ends ? `${dayAndHour(slot.start, false)} — ${dayAndHour(slot.ends, false)}` : dayAndHour(slot.start, false)
          : clock(slot.start);
        // What the booking starting here costs — the platform's number, every
        // hour by its own row (wiki/68) — beside the time, where it varies.
        if (pricedByTime && slot.costs_minor > 0) button.textContent += ` · ${money(slot.costs_minor, currency, pageLang())}`;
        button.dataset.start = slot.start;
        button.addEventListener('click', () => {
          chosen = slot.start;
          if (hint.textContent === words.retime) hint.textContent = '';
          sayEnds(slot);
          offerQuantity(data.quantity_max ?? 1, (slot.free ?? []).length);
          for (const other of slots.querySelectorAll('[data-slot]')) {
            other.classList.remove('is-chosen');
            other.setAttribute('aria-pressed', 'false');
          }
          button.classList.add('is-chosen');
          button.setAttribute('aria-pressed', 'true');
          say('');
        });
        slots.appendChild(button);
      }
      if (stay() && data.slots.length === 1) /** @type {HTMLButtonElement | null} */ (slots.firstElementChild)?.click();
      else if (wanted) {
        const same = /** @type {HTMLButtonElement | null} */ (slots.querySelector(`[data-start="${CSS.escape(wanted)}"]`));
        if (same) same.click();
        else hint.textContent = words.retime;
      }
    } catch (err) {
      // The platform's sentence, where it sent one; never a whole 404 page
      // (the preview's slug missing from the address, 10 October 2026).
      const said = err instanceof Error ? err.message : '';
      hint.textContent = said && said.length <= 200 && !/<[a-z!]/i.test(said) ? said : words.failed;
    }
  }

  /**
   * When the visit ends — the platform's own `ends`, said under the times:
   * «Until about 10:45 · 1 h 15 min». Nothing by the day, which says its
   * days on the pill.
   * @param {{ start: string; ends?: string }} slot
   */
  function sayEnds(slot) {
    if (!ends || daily || !slot.ends) return;
    const minutes = Math.round((new Date(slot.ends).getTime() - new Date(slot.start).getTime()) / 60000);
    if (!(minutes > 0)) return;
    ends.dataset.clock = clock(slot.ends);
    ends.dataset.length = lasting(minutes, words);
    ends.textContent = `${words.until.replace('{time}', ends.dataset.clock)} · ${ends.dataset.length}`;
    ends.hidden = false;
  }

  select?.addEventListener('change', () => { fitHours(); void load(); });
  hours.addEventListener('change', () => void load());
  // The look — the steps, the week, the parts of the day, the drawn choice
  // — over the form, where the form asks for it.
  if (form.dataset.ui) dressBooking(form, words);
  for (const box of boxes) {
    box.addEventListener('change', () => {
      if (single && box.checked) for (const other of boxes) if (other !== box) other.checked = false;
      showTotal();
      void load();
    });
  }
  resource?.addEventListener('change', () => { greyByResource(); void load(); });
  greyByResource();
  // A new first date keeps the stay's length: five nights from the 10th
  // become five nights from the 12th, not whatever the old «until» leaves.
  let lastDay = day.value;
  day.addEventListener('change', () => {
    chosen = null; // a new day starts clean
    if (lastDay && back.value && day.value) back.value = plusDays(day.value, daysBetween(lastDay, back.value));
    lastDay = day.value;
    fitBack();
    void load();
  });
  back.addEventListener('change', () => void load());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    say('');
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    if (picked().length === 0) { say(words.pickService); return; }
    if (!chosen) { say(words.pick); return; }
    /** @type {HTMLInputElement} */ const nameInput = q('[name=name]');
    if (name === '') { say(words.needName, [nameInput]); nameInput.focus(); return; }
    if (phone === '' && email === '') {
      /** @type {HTMLInputElement} */ const phoneInput = q('[name=phone]');
      say(words.needContact, [phoneInput, q('[name=email]')]);
      phoneInput.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = words.sending;
    try {
      /** @type {Record<string, unknown>} */
      const body = {
        service: picked()[0],
        services: picked(),
        resource: resourceChosen(),
        class: classChosen(),
        party: partyField.hidden ? 1 : Number(party.value) || 1,
        // How many of the service — never an end: the platform computes
        // the end and the price from it.
        ...(count() ? { count: count() } : {}),
        ...(quantityChosen() > 1 ? { quantity: quantityChosen() } : {}),
        start: chosen,
        name, phone, email,
        note: String(data.get('note') ?? ''),
        turnstile: turnstileToken,
      };
      // Only what the form says it sends (`data-sends`), which is what
      // preflight books with: a key added here and not there is dropped,
      // and said, rather than sent unchecked.
      const sends = new Set((form.dataset.sends ?? '').split(','));
      for (const key of Object.keys(body)) {
        if (!sends.has(key)) {
          console.error(`booking form: "${key}" is not in data-sends, so it is not sent`);
          delete body[key];
        }
      }
      const answer = await fetch(api + 'book', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...SPOKEN },
        body: JSON.stringify(body),
      });
      if (answer.status === 409) { say(words.taken); await load(); return; }
      if (!answer.ok) { say(await reason(answer)); return; }
      done(await answer.json());
    } catch {
      say(words.failed);
    } finally {
      submit.disabled = false;
      submit.textContent = words.book;
      window.turnstile?.reset();
      turnstileToken = '';
    }
  });

  /**
   * @param {{ state: string; start: string; ends: string; amount_minor: number; currency: string; id: string; manage_path: string; telegram_url: string; resource?: string; class?: string; group?: { quantity: number; amount_minor: number; bookings: { resource: string; resource_name?: string }[] } }} made
   */
  function done(made) {
    // Everything that asks, gone; the answer stays. By the hooks — the
    // classes are an older kit's markup.
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (form.querySelectorAll('[data-field], [data-times], [data-services], [data-submit], [data-challenge], .field, .booking__times, .booking__services'))) {
      if (!el.contains(form.querySelector('[data-done]'))) el.hidden = true;
    }
    /** @type {HTMLElement} */ const box = q('[data-done]');
    box.hidden = false;
    // After the lines are written below — see the end of this function.
    queueMicrotask(() => box.focus());
    q('[data-done-line]').textContent = made.state === 'confirmed' ? words.confirmed : words.pending;
    q('[data-done-when]').textContent = daily
      ? `${dayAndHour(made.start, true)} — ${dayAndHour(made.ends, true)}`
      : `${new Intl.DateTimeFormat(pageLang(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone || undefined }).format(new Date(made.start))}, ${clock(made.start)}–${clock(made.ends)}`;

    // What was taken: the class promised, where «any free» was chosen; the
    // one by name and marks, where it was chosen — «VW Combi · білий ·
    // AA1234BB». Nothing where the business has one of everything.
    let what = made.class ? words.anyOf.replace('{class}', made.class) : resourceChosen() ? made.resource ?? '' : '';
    // A group: the resources it took, and how many together (wiki/69).
    if (made.group && made.group.quantity > 1) {
      what = `${made.group.bookings.map((/** @type {{resource_name?: string, resource: string}} */ b) => b.resource_name || b.resource).join(', ')} · ${words.together.replace('{n}', String(made.group.quantity))}`;
    }
    if (what) {
      /** @type {HTMLElement} */ const line = q('[data-done-what]');
      // A person by name is «With Noa»; a class or a group is what was taken.
      const byName = !made.class && !(made.group && made.group.quantity > 1) && resourceChosen();
      line.textContent = byName ? words.withNamed.replace('{who}', what) : words.took.replace('{what}', what);
      line.hidden = false;
    }

    /** @type {HTMLAnchorElement} */ const manage = q('[data-manage]');
    if (made.manage_path) { manage.href = made.manage_path; manage.textContent = words.manage; manage.hidden = false; }
    // The link is the booking's only key: shown whole, with a way to copy
    // it and a sentence saying so, where the form has the box for it.
    /** @type {HTMLElement | null} */ const keep = q('[data-keep]');
    if (keep && made.manage_path) {
      const href = new URL(made.manage_path, window.location.href).href;
      /** @type {HTMLInputElement} */ const link = q('[data-keep-link]');
      /** @type {HTMLButtonElement} */ const copy = q('[data-keep-copy]');
      /** @type {HTMLAnchorElement} */ const open = q('[data-keep-open]');
      q('[data-keep-note]').textContent = words.keep;
      link.value = href;
      link.setAttribute('aria-label', words.manage);
      link.addEventListener('focus', () => link.select());
      copy.textContent = words.copy;
      /** @type {HTMLElement | null} */ const told = q('[data-keep-said]');
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(href); } catch { link.select(); document.execCommand('copy'); }
        copy.textContent = words.copied;
        // Said as well as drawn: a button's own words changing under the
        // focus is read by some screen readers and not by others.
        if (told) told.textContent = words.copied;
        setTimeout(() => { copy.textContent = words.copy; if (told) told.textContent = ''; }, 1600);
      });
      open.href = href;
      open.textContent = words.open;
      keep.hidden = false;
      manage.hidden = true;
    }
    /** @type {HTMLAnchorElement} */ const tg = q('[data-telegram]');
    if (made.telegram_url) { tg.href = made.telegram_url; tg.textContent = words.telegram; tg.hidden = false; }

    // The group is paid for together: its sum on the button.
    const owed = made.group && made.group.amount_minor > 0 ? made.group.amount_minor : made.amount_minor;
    if (owed > 0) {
      /** @type {HTMLElement} */ const note = q('[data-pay-note]');
      note.textContent = words.payNote;
      note.hidden = false;
      /** @type {HTMLAnchorElement} */ const pay = q('[data-pay]');
      pay.textContent = `${words.pay} · ${money(owed, made.currency, pageLang())}`;
      pay.href = '#';
      pay.hidden = false;
      pay.addEventListener('click', async (event) => {
        event.preventDefault();
        const answer = await fetch(api + 'pay', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...SPOKEN },
          body: JSON.stringify({ booking: made.id, return: made.manage_path || '/' }),
        });
        if (!answer.ok) { say(await reason(answer)); return; }
        const { url } = await answer.json();
        window.location.href = url;
      });
    }
  }
}

/**
 * Wires every booking form under a root that is not wired yet.
 * @param {ParentNode} [root]
 */
export function wireAll(root = document) {
  for (const form of /** @type {NodeListOf<HTMLFormElement>} */ (root.querySelectorAll('form[data-booking]'))) wireBooking(form);
  if (root instanceof HTMLFormElement && root.matches('[data-booking]')) wireBooking(root);
}

// The element, where there is a document to define it in. Under Node — the
// tests, a build that imports the module for its helpers — there is none, and
// nothing here needs one.
const BaseElement = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

/**
 * `<jtk-booking>` wraps the form `renderBookingForm` wrote and wires it when
 * it reaches the document — on load, and when the panel places the markup
 * later, which is what a custom element's lifecycle is for.
 */
export class JtkBooking extends BaseElement {
  connectedCallback() {
    wireAll(/** @type {any} */ (this));
  }
}

/** @param {string} [name] */
export function defineBooking(name = 'jtk-booking') {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, JtkBooking);
}

if (typeof document !== 'undefined') {
  defineBooking();
  // A form written bare, outside the element: wired at load, and again on
  // markup the panel places (`fl:placed`, the way the scaffold's `onAlive`
  // listens).
  const start = () => wireAll(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  document.addEventListener('fl:placed', (event) => {
    const at = event.target;
    if (at instanceof Element) wireAll(at);
  });
}
