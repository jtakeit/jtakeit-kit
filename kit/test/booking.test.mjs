// The booking form, as the kit renders it and as its element reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderBookingForm, bookingForm, SENDS, priceFrom } from '../lib/booking/render.mjs';
import { LINK, linkIn } from '../lib/booking/hooks.mjs';
import { wordsFor, LOCALES } from '../lib/booking/words.mjs';
import { money } from '../lib/money.mjs';
import { daysBetween, plusDays, lasting, wireBooking, wireAll, defineBooking, JtkBooking } from '../elements/booking.js';

const services = [
  { slug: 'cut', title: 'Haircut', takes: 45, costs: 5500, group: 'Hair' },
  { slug: 'colour', title: 'Colour <b>&amp;</b> tone', takes: 90, costs: 12000, group: 'Hair' },
  { slug: 'nails', title: 'Manicure', takes: 60, costs: 4000 },
];
const now = new Date('2026-10-07T10:00:00Z');

test('the form says what it sends, and is what preflight reads', () => {
  const html = renderBookingForm({ services, locale: 'uk', api: '/p/salon/api/', now });
  assert.match(html, /^<jtk-booking><form class="booking" data-booking /);
  assert.ok(html.includes(`data-sends="${SENDS.join(',')}"`));
  assert.ok(html.includes('data-api="/p/salon/api/"'));
  assert.ok(html.includes('data-jtk-fixed'));
  assert.ok(html.includes('novalidate'));
  // The platform's list, exactly: a key missing here is never sent, one
  // added is dropped by the element and said.
  assert.deepEqual([...SENDS], ['service', 'services', 'resource', 'class', 'party', 'count', 'quantity', 'start', 'name', 'phone', 'email', 'note', 'turnstile']);
});

test('one choice by default, a checklist with the running total when combined', () => {
  const one = renderBookingForm({ services, locale: 'en', now });
  assert.ok(one.includes('<select class="field__input" id="booking-service" name="service" required>'));
  assert.ok(one.includes('<option value="cut">Haircut · 45 min · 55</option>'), 'an option says how long and how much after its name');
  assert.ok(!one.includes('type="checkbox"'));

  const many = renderBookingForm({ services, locale: 'en', combine: true, currency: 'CHF', now });
  assert.ok(many.includes('<fieldset class="booking__services" data-services>'));
  assert.ok(many.includes('<input type="checkbox" name="service" value="cut" data-takes="45" data-costs="5500">'));
  // A run with a heading is a group named by it (WCAG 1.3.1).
  assert.ok(many.includes('role="group" aria-labelledby="booking-run-0"'));
  assert.ok(many.includes('<p class="booking__run-title" id="booking-run-0">Hair</p>'));
  assert.equal(many.match(/booking__run-title/g).length, 1, 'a heading once, for a run of services');
  assert.ok(many.includes('[data-total]') || many.includes('data-total'));
});

test('titles are escaped, whatever an owner typed into one', () => {
  const html = renderBookingForm({ services, locale: 'en', now });
  assert.ok(html.includes('Colour &lt;b&gt;&amp;amp;&lt;/b&gt; tone'));
  assert.ok(!html.includes('<b>'));
});

test('the words are the locale\'s, the letting business\'s by the day, and the platform\'s to replace', () => {
  const uk = renderBookingForm({ services, locale: 'uk', now });
  assert.ok(uk.includes('data-say="book">Записатися</button>'));
  assert.ok(uk.includes('>Оберіть день<'));
  const daily = renderBookingForm({ services, locale: 'uk', scale: 'daily', now });
  assert.ok(daily.includes('>Оберіть дати<'));
  assert.ok(daily.includes('data-scale="daily"'));
  // The words travel on the form for the element to read, as JSON in an attribute.
  const said = /data-words="([^"]*)"/.exec(daily)[1].replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
  assert.equal(JSON.parse(said).pick, 'Оберіть дати');
  // An unknown language reads as English rather than a crash.
  assert.ok(renderBookingForm({ services, locale: 'pl', now }).includes('>Book</button>'));
  assert.deepEqual([...LOCALES], ['uk', 'de', 'en', 'ru', 'es', 'it', 'pt', 'fr']);
  assert.equal(wordsFor('de').book, 'Termin buchen');
  assert.equal(wordsFor('de', 'daily').time, 'Tage');
});

test('a kind that is not a salon holds its words back until the platform has said them', () => {
  assert.ok(renderBookingForm({ services, locale: 'en', kind: 'car_rental', now }).includes('class="booking booking--unsaid"'));
  assert.ok(renderBookingForm({ services, locale: 'en', kind: 'salon', now }).includes('class="booking" data-booking'));
  assert.ok(renderBookingForm({ services, locale: 'en', now }).includes('class="booking" data-booking'));
});

test('the choice of whom is offered only where there is one to make', () => {
  const solo = renderBookingForm({ services, locale: 'en', resources: [{ slug: 'a', title: 'Anna' }], now });
  assert.ok(!solo.includes('name="resource"'));
  const team = renderBookingForm({ services, locale: 'en', resources: [{ slug: 'a', title: 'Anna' }, { slug: 'b', title: 'Bo' }], now });
  assert.ok(team.includes('<select class="field__input" id="booking-resource" name="resource" data-say-wait>'));
  assert.ok(team.includes('<option value="" data-say="any">Anyone</option>'));
});

test('the picker starts on the build\'s day and reaches the horizon; the wrapper may be left off', () => {
  const html = renderBookingForm({ services, locale: 'en', daysAhead: 10, now });
  assert.ok(html.includes('id="booking-day" name="day" type="date" min="2026-10-07" max="2026-10-17" required'));
  const bare = renderBookingForm({ services, locale: 'en', tag: '', now });
  assert.ok(bare.startsWith('<form class="booking"'));
  assert.ok(!bare.includes('jtk-booking'));
  assert.throws(() => renderBookingForm({ locale: 'en' }), TypeError);
});

test('the element\'s arithmetic: days by the calendar, hours as the time they are', () => {
  assert.equal(daysBetween('2026-10-10', '2026-10-13'), 3);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2, 'the night the clocks move is still one night');
  assert.equal(plusDays('2026-10-30', 3), '2026-11-02');
  assert.equal(lasting(90, wordsFor('uk')), '1 год 30 хв');
  assert.equal(lasting(120, wordsFor('en')), '2 h');
  // «2 300 ₴», whichever space the locale's data puts in the thousands.
  assert.equal(money(230000, 'UAH', 'uk').replace(/[  ]/g, ' '), '2 300 ₴');
  assert.equal(money(5500, undefined, 'en'), '55');
  assert.equal(money(5550, undefined, 'en'), '55.50', 'kopecks shown whole once there are any');
});

// Every language the form speaks says every word the form has: a key one
// language has and another has not is a sentence the visitor reads in
// English in the middle of their own — and the placeholders inside a word
// are the same in each, or the element's replace() leaves one unfilled.
test('every language has every word, with the same holes in it', () => {
  const holes = (text) => (text.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
  for (const scale of ['', 'daily']) {
    const en = wordsFor('en', scale);
    for (const locale of LOCALES) {
      const words = wordsFor(locale, scale);
      assert.deepEqual(Object.keys(words).sort(), Object.keys(en).sort(), `${locale} (${scale || 'hourly'}) has the English keys`);
      for (const key of Object.keys(en)) {
        assert.equal(holes(words[key]), holes(en[key]), `${locale}.${key} keeps the placeholders ${holes(en[key])}`);
        assert.ok(words[key].trim() !== '', `${locale}.${key} says something`);
      }
    }
  }
});

test('the module loads where there is no document, and exports the element for one', () => {
  assert.equal(typeof wireBooking, 'function');
  assert.equal(typeof wireAll, 'function');
  assert.equal(typeof defineBooking, 'function');
  assert.equal(typeof JtkBooking, 'function');
  // Nothing to define under Node: it returns rather than throws.
  assert.doesNotThrow(() => defineBooking());
});

test('a service priced by the hour of the week says «from», and sends no price of its own', () => {
  const lane = { slug: 'lane', title: 'Lane', takes: 60, rates: [
    { day: 'monday', from: 540, until: 1080, costs: 2500 }, { day: 'friday', from: 1080, until: 1440, costs: 4200 },
  ] };
  assert.equal(priceFrom(lane), 2500);
  assert.equal(priceFrom({ slug: 'cut', title: 'Cut', costs: 5500 }), 0);
  const html = renderBookingForm({ services: [lane, services[0]], locale: 'en', currency: 'EUR', combine: true, now });
  assert.ok(html.includes('data-costs="0"'), 'the running total cannot know a price that depends on the time');
  assert.ok(html.includes(`from ${money(2500, 'EUR', 'en')}`), html);
  assert.ok(html.includes(money(5500, 'EUR', 'en')));
  for (const locale of LOCALES) assert.ok(wordsFor(locale).from, locale);
});

test('several of a class: the form carries «how many», hidden until the platform says more than one, and sends quantity', () => {
  const html = renderBookingForm({ services, locale: 'en', now });
  assert.ok(html.includes('data-quantity-field hidden'), 'hidden until quantity_max says otherwise');
  assert.ok(html.includes('name="quantity"'));
  assert.ok(SENDS.includes('quantity'));
  for (const locale of LOCALES) { assert.ok(wordsFor(locale).quantity, locale); assert.ok(wordsFor(locale).together, locale); }
});

test('a price per person says so, and an add-on is listed under its own heading', () => {
  const html = renderBookingForm({
    services: [...services, { slug: 'yoga', title: 'Yoga', takes: 60, costs: 1500, per: 'person' }, { slug: 'shoes', title: 'Shoes', costs: 270, per: 'person' }],
    locale: 'en', currency: 'EUR', combine: true, now,
  });
  assert.ok(html.includes('data-per="person"'));
  assert.ok(html.includes('per person'));
  assert.match(html, /<p class="booking__run-title" id="booking-run-\d+">Add-ons<\/p>/);
  assert.ok(html.indexOf('value="shoes"') > html.indexOf('value="yoga"'), 'the add-on after the services');
  for (const locale of LOCALES) { assert.ok(wordsFor(locale).perPerson, locale); assert.ok(wordsFor(locale).addOns, locale); }
});

test('the look is on by default, and the form carries what it reads: the open days, what each resource does, the end of the visit, the link kept', () => {
  const html = renderBookingForm({
    services, locale: 'en', combine: true, now,
    resources: [{ slug: 'noa', title: 'Noa', does: ['cut', 'colour'] }, { slug: 'jonas', title: 'Jonas' }],
    open: ['tuesday', 'wednesday'],
  });
  assert.ok(html.includes('data-ui="steps week parts select"'));
  assert.ok(html.includes('data-open="tuesday,wednesday"'));
  assert.ok(html.includes('<option value="noa" data-does="cut,colour">Noa</option>'));
  assert.ok(html.includes('<option value="jonas">Jonas</option>'));
  assert.ok(html.includes('<p class="booking__ends" data-ends hidden></p>'));
  assert.ok(html.includes('data-keep-link'));
  assert.ok(html.includes('data-keep-copy'));
  // The plain form, or the pieces by name.
  assert.ok(!renderBookingForm({ services, locale: 'en', now, ui: false }).includes('data-ui'));
  assert.ok(renderBookingForm({ services, locale: 'en', now, ui: 'week parts' }).includes('data-ui="week parts"'));
  // Every language says the look's words, with the same holes.
  for (const locale of LOCALES) {
    const words = wordsFor(locale);
    for (const key of ['notWith', 'retime', 'until', 'withNamed', 'keep', 'copy', 'stepWhat', 'stepWho', 'morning', 'afternoon', 'evening', 'prevWeek', 'nextWeek']) {
      assert.ok(typeof words[key] === 'string' && words[key].length > 0, `${locale}.${key}`);
    }
    assert.ok(words.until.includes('{time}'), `${locale}.until`);
    assert.ok(words.withNamed.includes('{who}') && words.notWith.includes('{who}'), `${locale} {who}`);
  }
});

test('the services with no heading come after every heading, whatever order they came in', () => {
  const mixed = [
    { slug: 'tea', title: 'Tea', takes: 15, costs: 500 },
    { slug: 'cut', title: 'Haircut', takes: 45, costs: 5500, group: 'Hair' },
    { slug: 'gel', title: 'Gel', takes: 60, costs: 4000, group: 'Nails' },
  ];
  const html = renderBookingForm({ services: mixed, locale: 'en', combine: true, now });
  const hair = html.indexOf('>Hair</p>');
  const nails = html.indexOf('>Nails</p>');
  const tea = html.indexOf('value="tea"');
  assert.ok(hair > 0 && nails > hair, 'the headings in the order the services came');
  assert.ok(tea > nails, 'the service with no heading after the last one');
  assert.equal(html.match(/booking__run-title/g).length, 2, 'and under none of its own');
});

// What people book is in every language, always (M3): where nobody translated
// a service or a master, the form says the original's words and marks them
// with the original's language — in the kit's markup as in the scaffold's.
test('a name in the original\'s words is marked with its lang, and one in the page\'s language is not', () => {
  const said = [
    { slug: 'cut', title: 'Haircut', takes: 45, costs: 5500 },
    { slug: 'faerben', title: 'Färben', takes: 90, costs: 12000, lang: 'de-CH' },
  ];
  const team = [{ slug: 'anna', title: 'Anna' }, { slug: 'beat', title: 'Beat Keller', lang: 'de-CH', does: ['cut'] }];
  const one = renderBookingForm({ services: said, resources: team, locale: 'en', now });
  assert.ok(one.includes('<option value="cut">Haircut · 45 min · 55</option>'));
  assert.ok(one.includes('<option value="faerben" lang="de-CH">Färben · 1 h 30 min · 120</option>'));
  assert.ok(one.includes('<option value="anna">Anna</option>'));
  assert.ok(one.includes('<option value="beat" data-does="cut" lang="de-CH">Beat Keller</option>'));
  const listed = renderBookingForm({ services: said, locale: 'en', combine: true, now });
  assert.ok(listed.includes('<span class="booking__service-name" data-service-name>Haircut</span>'));
  assert.ok(listed.includes('<span class="booking__service-name" data-service-name lang="de-CH">Färben</span>'));
  assert.ok(!renderBookingForm({ services, locale: 'en', now }).includes(' lang='), 'nothing marked where nothing says a lang');
});

// ── the studio's patches, made the kit's (18 November 2026) ──────────────────
// A sessions site in German had to patch the form with scripts of its own; the
// markup half of each fix is read here, the behaviour half in a real Chrome
// (test/booking-element.test.mjs at the root).

test('a length is said one way everywhere: whole hours in hours', async () => {
  const { lasting: said } = await import('../lib/booking/words.mjs');
  assert.equal(said, lasting, 'the element says lengths with the words file\'s function');
  assert.equal(lasting(240, wordsFor('de')), '4 Std.');
  assert.equal(lasting(90, wordsFor('de')), '1 Std. 30 Min.');
  assert.equal(lasting(240, wordsFor('en')), '4 h');
  assert.equal(lasting(45, wordsFor('en')), '45 min');
  assert.equal(lasting(0, wordsFor('en')), '');
  const { runs } = bookingForm({ services: [{ slug: 's', title: 'Session', takes: 240, costs: 24000 }, services[0]], locale: 'de', currency: 'CHF', combine: true });
  assert.equal(runs.flatMap((run) => run.items).find((one) => one.slug === 's').meta.replace(/\s/g, ' '), '4 Std. · CHF 240', 'the list says «4 Std.», not «240 min»');
  const element = readFileSync(new URL('../elements/booking.js', import.meta.url), 'utf8');
  assert.doesNotMatch(element, /\$\{[^}]*\} min\b/, 'no length said in minutes by hand');
  assert.doesNotMatch(readFileSync(new URL('../lib/booking/render.mjs', import.meta.url), 'utf8'), /\$\{[^}]*\} min\b/);
});

test('one service is a line with its slug in a hidden input, not a choice of one', () => {
  const session = { slug: 'session', title: 'Session', takes: 240, costs: 24000 };
  for (const combine of [false, true]) {
    const html = renderBookingForm({ services: [session], locale: 'de', currency: 'CHF', combine, now });
    assert.ok(!html.includes('<select class="field__input" id="booking-service"'), 'no <select>');
    assert.ok(!html.includes('type="checkbox"'), 'no checklist of one');
    assert.ok(html.includes('<input type="hidden" name="service" value="session">'));
    assert.match(html.replace(/\s/g, ' '), /data-service-one><span data-service-name>Session<\/span><span class="booking__service-meta"> · 4 Std\. · CHF 240<\/span>/);
  }
  assert.equal(bookingForm({ services: [session], locale: 'en' }).one?.label, 'Session · 4 h · 240');
  assert.equal(bookingForm({ services, locale: 'en' }).one, null);
});

test('the choice of one of several is grouped by the checklist\'s own runs, each option saying how long and how much', () => {
  const html = renderBookingForm({ services, locale: 'en', currency: 'CHF', now });
  const select = html.slice(html.indexOf('<select'), html.indexOf('</select>')).replace(/\s/g, ' ');
  assert.match(select, /<optgroup label="Hair"><option value="cut">Haircut · 45 min · CHF 55<\/option> *<option value="colour">Colour &lt;b&gt;&amp;amp;&lt;\/b&gt; tone · 1 h 30 min · CHF 120<\/option><\/optgroup>/);
  assert.ok(select.indexOf('value="nails"') > select.indexOf('</optgroup>'), 'the service with no heading after the groups');
  const { runs } = bookingForm({ services, locale: 'en' });
  assert.deepEqual(runs.map((run) => run.group), ['Hair', ''], 'the same runs as the checklist\'s');
  assert.ok(!renderBookingForm({ services: services.map(({ group, ...one }) => one), locale: 'en', now }).includes('<optgroup'), 'no group where none is said');
});

test('a phone or an email: both marked, a line above them says either will do, in every language', () => {
  const html = renderBookingForm({ services, locale: 'de', now });
  assert.match(html, /<label class="field__label" for="booking-phone">Telefon <span aria-hidden="true">\*<\/span><\/label>/);
  assert.match(html, /<label class="field__label" for="booking-email">E-Mail <span aria-hidden="true">\*<\/span><\/label>/);
  assert.match(html, /<p class="booking__hint" id="booking-contact" data-field data-contact-note>Eins genügt\.<\/p>\s*<div class="field" data-field>\s*<label class="field__label" for="booking-phone">/);
  assert.equal(html.match(/aria-describedby="booking-contact"/g)?.length, 2);
  for (const locale of LOCALES) assert.ok(wordsFor(locale).oneEnough, locale);
  const element = readFileSync(new URL('../elements/booking.js', import.meta.url), 'utf8');
  assert.ok(element.includes("if (phone === '' && email === '')"), 'the press still refuses neither');
});

test('the times\' fieldset may be narrower than its widest line, in booking.css and in the rules the element puts on the page', () => {
  const css = readFileSync(new URL('../booking.css', import.meta.url), 'utf8');
  assert.match(css, /\.booking \[data-times\][^{]*\{ min-inline-size: 0; \}/);
  assert.match(css, /\.booking__times \{[^}]*min-inline-size: 0;/);
  const element = readFileSync(new URL('../elements/booking.js', import.meta.url), 'utf8');
  assert.ok(element.includes(':where([data-booking] :is([data-times], [data-services], fieldset)) { min-inline-size: 0; }'));
});

test('a link to the page: the names in one place, and only what parses', () => {
  assert.deepEqual({ ...LINK }, { service: 'service', day: 'day', time: 'time' });
  assert.deepEqual(linkIn('?service=cut&day=2026-11-24&time=14:00'), { services: ['cut'], day: '2026-11-24', time: '14:00' });
  assert.deepEqual(linkIn('?service=cut&service=nails').services, ['cut', 'nails'], 'several for a checklist');
  assert.deepEqual(linkIn('?day=2026-02-30&time=14:00'), { services: [], day: '', time: '' }, 'a day that is not one');
  assert.deepEqual(linkIn('?day=24.11.2026'), { services: [], day: '', time: '' });
  assert.equal(linkIn('?time=14:00').time, '', 'a time without a day');
  assert.equal(linkIn('?day=2026-11-24&time=9:00').time, '', 'a time not on a 24-hour clock of two digits');
  assert.equal(linkIn('?day=2026-11-24&time=24:00').time, '');
  assert.equal(linkIn(new URLSearchParams({ day: '2026-11-24', time: '23:59' })).time, '23:59');
});

test('the element answers to choose and clear, and is quiet where there is no form', () => {
  assert.equal(typeof JtkBooking.prototype.choose, 'function');
  assert.equal(typeof JtkBooking.prototype.clear, 'function');
  const bare = new JtkBooking();
  assert.equal(bare.choose('2026-11-24T14:00:00Z'), false);
  assert.doesNotThrow(() => bare.clear());
});
