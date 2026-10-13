import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderBookingForm, bookingForm } from '../lib/booking/render.mjs';
import { ALWAYS, ASKED, SAID, HOOKS } from '../lib/booking/hooks.mjs';

// The hooks are the whole contract between a booking form's markup and the
// element: what an agent keeps when it copies the scaffold's form and dresses
// it in a design of its own. Both forms the kit hands out carry every one.

const here = import.meta.dirname;
const services = [
  { slug: 'cut', title: 'Cut', takes: 45, costs: 9500, group: 'Hair' },
  { slug: 'colour', title: 'Colour', takes: 90, costs: 18000, group: 'Hair' },
  { slug: 'shoes', title: 'Shoes', costs: 500 },
];
const resources = [{ slug: 'ada', title: 'Ada', does: ['cut'] }, { slug: 'noa', title: 'Noa' }];

/** How a hook is written in markup: `data-x`, `name="x"`. */
function written(hook) {
  const name = /^\[name=([a-z]+)\]$/.exec(hook);
  if (name) return `name="${name[1]}"`;
  const data = /\[(data-[a-z-]+)\]$/.exec(hook);
  assert.ok(data, `a hook is a data attribute or a name: ${hook}`);
  return data[1];
}

test('every hook is a data attribute or an input name, never a class', () => {
  for (const hook of HOOKS) {
    assert.doesNotMatch(hook, /\./, hook);
    written(hook);
  }
  assert.equal(new Set(HOOKS).size, HOOKS.length, 'each once');
});

test('renderBookingForm carries every hook', () => {
  const html = renderBookingForm({ services, resources, locale: 'en', combine: true });
  for (const one of [...ALWAYS, ...ASKED, ...SAID]) assert.ok(html.includes(written(one.hook)), `${one.hook} — ${one.says}`);
  assert.match(html, /<form [^>]* novalidate[ >]/, 'novalidate, bare: the form says what is missing, not the browser');
});

test("the scaffold's BookingForm.astro carries every hook, and draws from bookingForm", () => {
  const astro = readFileSync(join(here, '../../template/src/components/BookingForm.astro'), 'utf8');
  for (const one of [...ALWAYS, ...ASKED, ...SAID]) {
    if (one.hook === 'form[data-booking]') continue;
    assert.ok(astro.includes(written(one.hook)), `${one.hook} — ${one.says}`);
  }
  assert.ok(astro.includes('{...form.attrs}'), 'the form takes its data-api, data-sends and the rest from bookingForm');
  assert.ok(astro.includes("import '@jtakeit/kit/elements/booking'"), 'and the element that makes it work');
  assert.doesNotMatch(astro, /@jtakeit\/kit\/booking\.css/, 'the look is the file\'s own, not the kit\'s');
});

test("the form's attributes: data-booking, what it sends, novalidate that survives Astro", () => {
  const { attrs } = bookingForm({ services, locale: 'en' });
  assert.equal(attrs['data-booking'], '');
  assert.match(attrs['data-sends'], /^service,services,/);
  assert.equal(attrs.novalidate, 'novalidate', "Astro drops a boolean attribute spread as ''");
  assert.equal(bookingForm({ services, locale: 'en', kind: 'car_rental' }).attrs['data-unsaid'], '');
});

test('bookingForm: the runs in order, the add-ons last under their own heading, a price beside each', () => {
  const { runs } = bookingForm({ services, locale: 'en', currency: 'chf', combine: true });
  assert.deepEqual(runs.map((run) => run.group), ['Hair', 'Add-ons']);
  assert.equal(runs[0].items[0].meta.replace(/\s/g, ' '), '45 min · CHF 95');
  assert.deepEqual(runs[1].items.map((one) => one.slug), ['shoes']);
});

test('the element finds nothing by a class alone', () => {
  for (const file of ['../elements/booking.js', '../elements/booking-ui.js']) {
    const source = readFileSync(join(here, file), 'utf8');
    for (const [, selector] of source.matchAll(/(?:querySelector(?:All)?|closest)\(\s*'([^']+)'/g)) {
      // A class may stand beside a hook, for an older kit's markup, or name a
      // piece the element drew itself; never a piece of the site's markup alone.
      const drawn = /^\.(?:booking__(?:day|days|part|step|stepper|back|dd|dd-option|service-off)|is-chosen)\b/;
      if (/\.[a-z]/.test(selector)) assert.ok(/\[data-|label/.test(selector) || drawn.test(selector), `${file}: ${selector}`);
    }
  }
});
