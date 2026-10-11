// The booking form, as the kit renders it and as its element reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookingForm, SENDS, priceFrom } from '../lib/booking/render.mjs';
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
  assert.ok(one.includes('<option value="cut">Haircut</option>'));
  assert.ok(!one.includes('type="checkbox"'));

  const many = renderBookingForm({ services, locale: 'en', combine: true, currency: 'CHF', now });
  assert.ok(many.includes('<fieldset class="booking__services" data-services>'));
  assert.ok(many.includes('<input type="checkbox" name="service" value="cut" data-takes="45" data-costs="5500">'));
  assert.ok(many.includes('<p class="booking__run-title">Hair</p>'));
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
  assert.ok(html.includes('<p class="booking__run-title">Add-ons</p>'));
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
