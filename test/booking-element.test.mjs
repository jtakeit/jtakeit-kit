// The booking element as a person meets it, in a real Chrome over the kit's own
// markup and a platform that answers from here: what the parts of the day hide
// is not chosen, a link opens the form on a time, the page's script chooses
// and clears, and the times never push a phone's page sideways
// (18 November 2026). Without a Chrome — `CHROME_PATH`, the one installed, or
// Playwright's own — it says so and skips: the kit's own tests read the
// markup without one.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { renderBookingForm } from '@jtakeit/kit/booking';

const KIT = resolve(import.meta.dirname, '..', 'kit');
const ORIGIN = 'http://booking.test';

/** @type {import('playwright-core').Browser | null} */
let browser = null;
let why = '';
before(async () => {
  for (const how of [...(process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : []), { channel: 'chrome' }, {}]) {
    try { browser = await chromium.launch({ headless: true, ...how }); break; } catch (error) { why = String(error?.message ?? error).split('\n')[0]; }
  }
  if (!browser) console.log(`booking-element: no Chrome to run (${why}) — skipped`);
});
after(async () => { await browser?.close(); });

// The day after tomorrow, on UTC's calendar — the browser runs in UTC too, so
// the picker's floor and the platform's starts agree.
const DAY = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const HOURS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '17:00', '18:00', '19:00'];

const services = [
  { slug: 'cut', title: 'Haircut', takes: 45, costs: 5500, group: 'Hair' },
  { slug: 'colour', title: 'Colour', takes: 90, costs: 12000, group: 'Hair' },
  { slug: 'nails', title: 'Manicure', takes: 60, costs: 4000 },
];

/**
 * A page with the kit's form on it, the element from the checkout, and a
 * platform that offers HOURS on DAY and nothing on any other day.
 * @param {{ query?: string; form?: object; style?: string; width?: number }} [options]
 */
async function open({ query = '', form = {}, style = '', width = 1000 } = {}) {
  const context = await /** @type {import('playwright-core').Browser} */ (browser).newContext({ timezoneId: 'UTC', viewport: { width, height: 900 } });
  const page = await context.newPage();
  /** @type {URLSearchParams[]} */ const asked = [];
  await page.addInitScript(() => {
    /** @type {any} */ (window).said = [];
    document.addEventListener('slotchange', (event) => /** @type {any} */ (window).said.push(/** @type {CustomEvent} */ (event).detail));
  });
  const html = renderBookingForm({ services, locale: 'en', currency: 'CHF', now: new Date(), ...form });
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/kit/')) {
      return route.fulfill({ body: readFileSync(join(KIT, url.pathname.slice(5))), contentType: extname(url.pathname) === '.css' ? 'text/css' : 'text/javascript' });
    }
    if (url.pathname === '/api/turnstile') return route.fulfill({ json: { sitekey: '' } });
    if (url.pathname === '/api/availability') {
      asked.push(url.searchParams);
      const day = new Date(url.searchParams.get('from') ?? '').toISOString().slice(0, 10);
      const slots = day === DAY ? HOURS.map((hour) => ({ start: `${DAY}T${hour}:00Z`, ends: `${DAY}T${hour.slice(0, 2)}:45:00Z`, free: ['anna'], costs_minor: 5500 })) : [];
      return route.fulfill({ json: { zone: 'UTC', slots, party_max: 1, quantity_max: 1 } });
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${style}</style></head><body>${html}<script type="module" src="/kit/elements/booking.js"></script></body></html>`,
    });
  });
  await page.goto(`${ORIGIN}/book/${query}`);
  return { page, context, asked };
}

const pills = (page) => page.locator('[data-slot]');
const pressed = (page) => page.locator('[data-slot][aria-pressed="true"]');
const said = (page) => page.evaluate(() => /** @type {any} */ (window).said);

test('a time hidden by another part of the day is no longer chosen, and the next step will not take it', async (t) => {
  if (!browser) return t.skip('no Chrome');
  const { page, context } = await open({ query: `?day=${DAY}` });
  await pills(page).first().waitFor();
  await page.locator(`[data-slot][data-start="${DAY}T09:00:00Z"]`).click();
  assert.equal(await pressed(page).count(), 1);
  assert.ok(await page.locator('[data-ends]').isVisible(), 'the end of the visit said under the times');
  assert.deepEqual(await said(page), [{ start: `${DAY}T09:00:00Z`, ends: `${DAY}T09:45:00Z`, resource: null }]);

  await page.locator('.booking__part[data-part="evening"]').click();
  assert.equal(await pressed(page).count(), 0, 'the morning time is unchosen once the evening shows');
  assert.equal(await page.locator('.booking__slot.is-chosen').count(), 0);
  assert.ok(!(await page.locator('[data-ends]').isVisible()), 'and its end unsaid');
  assert.deepEqual((await said(page)).at(-1), null, 'slotchange says nothing is chosen');

  await page.locator('[data-step-next]').click();
  assert.equal(await page.locator('form').getAttribute('data-stage'), '1', 'the next step refuses a time the person does not see');
  assert.ok(await page.locator('.booking__need').isVisible());

  // A time chosen in a part that is not showing brings its part into view.
  await page.locator('.booking__part[data-part="morning"]').click();
  await page.locator(`[data-slot][data-start="${DAY}T17:00:00Z"]`).evaluate((pill) => /** @type {HTMLElement} */ (pill).click());
  await page.waitForFunction(() => document.querySelector('.booking__part[data-part="evening"]')?.getAttribute('aria-pressed') === 'true');
  assert.ok(await page.locator(`[data-slot][data-start="${DAY}T17:00:00Z"]`).isVisible());
  await context.close();
});

test('a link opens the form on its service, its day and its time, and on the second step', async (t) => {
  if (!browser) return t.skip('no Chrome');
  const { page, context, asked } = await open({ query: `?service=colour&day=${DAY}&time=17:00` });
  await page.waitForFunction(() => document.querySelector('form')?.dataset.stage === '2');
  assert.equal(await page.locator('select[name=service]').inputValue(), 'colour');
  assert.equal(await pressed(page).getAttribute('data-start'), `${DAY}T17:00:00Z`);
  assert.ok(asked.some((one) => one.get('service') === 'colour' && one.has('from')), 'the day asked of the platform for the linked service');
  assert.match(await page.locator('.booking__summary').innerText(), /Colour/);
  // The summary names the service; its length and price have rows of their own.
  assert.equal(await page.locator('.booking__summary-row dd').first().innerText(), 'Colour');
  assert.equal((await said(page)).at(-1)?.start, `${DAY}T17:00:00Z`);
  await context.close();
});

test('a link to what is not offered or not free is ignored, and nothing is said', async (t) => {
  if (!browser) return t.skip('no Chrome');
  const { page, context } = await open({ query: `?service=massage&day=${DAY}&time=12:34` });
  await pills(page).first().waitFor();
  assert.equal(await page.locator('select[name=service]').inputValue(), 'cut', 'an unknown service leaves the first');
  assert.equal(await page.locator('input[name=day]').inputValue(), DAY, 'the day is still opened');
  assert.equal(await pressed(page).count(), 0, 'a time that is not free is not chosen');
  assert.equal(await page.locator('form').getAttribute('data-stage'), '1');
  assert.ok(!(await page.locator('[data-booking-error]').isVisible()), 'and no refusal');
  await context.close();

  const bad = await open({ query: '?day=2020-01-01&time=09:00' });
  await bad.page.waitForTimeout(300);
  assert.equal(await bad.page.locator('input[name=day]').inputValue(), '', 'a day in the past is not opened');
  await bad.context.close();
});

test('the page\'s script chooses a drawn time and clears it, and slotchange says both', async (t) => {
  if (!browser) return t.skip('no Chrome');
  const { page, context } = await open({ query: `?day=${DAY}` });
  await pills(page).first().waitFor();
  const chose = await page.evaluate((start) => /** @type {any} */ (document.querySelector('jtk-booking')).choose(start), `${DAY}T10:00:00.000Z`);
  assert.equal(chose, true);
  assert.equal(await pressed(page).getAttribute('data-start'), `${DAY}T10:00:00Z`);
  assert.equal((await said(page)).at(-1)?.start, `${DAY}T10:00:00Z`);
  const count = (await said(page)).length;
  assert.equal(await page.evaluate((start) => /** @type {any} */ (document.querySelector('jtk-booking')).choose(start), `${DAY}T10:00:00Z`), true);
  assert.equal((await said(page)).length, count, 'the same time again is no change');
  assert.equal(await page.evaluate(() => /** @type {any} */ (document.querySelector('jtk-booking')).choose('2020-01-01T10:00:00Z')), false, 'a time not drawn');
  assert.equal(await page.evaluate(() => /** @type {any} */ (document.querySelector('jtk-booking')).choose('not a time')), false);
  await page.evaluate(() => /** @type {any} */ (document.querySelector('jtk-booking')).clear());
  assert.equal(await pressed(page).count(), 0);
  assert.equal((await said(page)).at(-1), null);
  await context.close();
});

test('one service is a line, books by its hidden slug, and goes to the second step by its name', async (t) => {
  if (!browser) return t.skip('no Chrome');
  const session = { slug: 'session', title: 'Session', takes: 240, costs: 24000 };
  const { page, context, asked } = await open({ query: `?day=${DAY}&time=13:00`, form: { services: [session], locale: 'de' } });
  await page.waitForFunction(() => document.querySelector('form')?.dataset.stage === '2');
  assert.equal(await page.locator('select[name=service]').count(), 0, 'no choice of one');
  assert.equal((await page.locator('[data-service-one]').innerText()).replace(/[\s\u00a0\u202f]+/g, ' ').trim(), 'Session · 4 Std. · CHF 240');
  assert.ok(asked.some((one) => one.get('service') === 'session' && one.has('from')));
  assert.match(await page.locator('.booking__summary').innerText(), /Session/);
  await context.close();
});

test('the choice of several is grouped as the checklist is, drawn and native alike', async (t) => {
  if (!browser) return t.skip('no Chrome');
  const { page, context } = await open();
  assert.deepEqual(await page.locator('select[name=service] optgroup').evaluateAll((groups) => groups.map((g) => /** @type {HTMLOptGroupElement} */ (g).label)), ['Hair']);
  await page.locator('.booking__dd-trigger').first().click();
  assert.equal(await page.locator('.booking__dd-group-label').first().textContent(), 'Hair');
  assert.equal(await page.locator('.booking__dd-group [data-value="cut"]').count(), 1, 'the grouped options inside their group');
  assert.equal(await page.locator('.booking__dd-list > [data-value="nails"]').count(), 1, 'the one with no heading after it');
  await context.close();
});

test('the times never push a phone\'s page sideways, whatever the site draws them as', async (t) => {
  if (!browser) return t.skip('no Chrome');
  // A row of pills that scrolls, the way a site draws them: in a fieldset
  // left at the browser's min-content, the row was the page's width.
  const { page, context } = await open({ query: `?day=${DAY}`, width: 320, form: { ui: false }, style: '[data-slots] { display: flex; overflow-x: auto; white-space: nowrap; } [data-slot] { flex: none; padding: 0 2rem; }' });
  await pills(page).first().waitFor();
  assert.equal(await page.locator('[data-times]').evaluate((el) => getComputedStyle(el).minInlineSize), '0px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 320px');
  await context.close();
});
