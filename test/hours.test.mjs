// «Open now» on the business's clock, never the visitor's (example/files/src/components/site/words.ts):
// a barber's site on staging said «Jetzt geöffnet» at 18:58 Zurich time with the hours closing at 18:00
// (17 November 2026), because the script asked the browser's clock. The process runs on a zone far
// from Zurich, so a test that passed by reading the machine's own clock would fail here.
process.env.TZ = 'America/Los_Angeles';

import assert from 'node:assert/strict';
import test from 'node:test';
import { openAt, zoneOf } from '../example/files/src/components/site/words.ts';

// Monday to Friday 09:00–18:00, Saturday 09:00–14:00: the example's own hours, as the markup carries them.
const WEEK = [0, 1, 2, 3, 4].map((day) => [day, 540, 1080]).concat([[5, 540, 840]]);

test('the zone: the diary\'s where it says one, else the country\'s, else none', () => {
  assert.equal(zoneOf('Europe/Kyiv', 'CH'), 'Europe/Kyiv');
  assert.equal(zoneOf('', 'CH'), 'Europe/Zurich');
  assert.equal(zoneOf(undefined, ' ch '), 'Europe/Zurich');
  assert.equal(zoneOf(undefined, 'LI'), 'Europe/Vaduz');
  assert.equal(zoneOf(undefined, 'US'), '', 'a country of several zones names none');
  assert.equal(zoneOf(undefined, ''), '');
  assert.equal(zoneOf(undefined, undefined), '');
});

test('18:58 in Zurich on a Tuesday is closed, wherever the browser is', () => {
  // 17 November 2026, 17:58 UTC: 18:58 in Zurich (CET), 09:58 in Los Angeles, 19:58 in Kyiv.
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-17T17:58:00Z')), false);
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-17T16:59:00Z')), true, '17:59 in Zurich');
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-17T17:00:00Z')), false, '18:00 is the close');
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-17T07:59:00Z')), false, '08:59 is before the open');
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-17T08:00:00Z')), true, '09:00 is the open');
});

test('the day is the zone\'s too: late on Saturday in Los Angeles is Sunday in Zurich', () => {
  // Saturday 21 November 2026 23:30 in Los Angeles = Sunday 08:30 in Zurich; Saturday 13:30 in Zurich = 04:30 in Los Angeles.
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-22T07:30:00Z')), false);
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-21T12:30:00Z')), true);
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-11-21T13:00:00Z')), false, 'Saturday closes at 14:00');
});

test('summer time is the zone\'s', () => {
  // 14 July 2026: Zurich is UTC+2.
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-07-14T15:59:00Z')), true, '17:59 CEST');
  assert.equal(openAt(WEEK, 'Europe/Zurich', new Date('2026-07-14T16:00:00Z')), false, '18:00 CEST');
});

test('a span past midnight runs into the next day; one that closes as it opens is none', () => {
  const late = [[4, 1320, 120]]; // Friday 22:00 – 02:00
  assert.equal(openAt(late, 'Europe/Zurich', new Date('2026-11-20T21:30:00Z')), true, 'Friday 22:30');
  assert.equal(openAt(late, 'Europe/Zurich', new Date('2026-11-21T00:30:00Z')), true, 'Saturday 01:30');
  assert.equal(openAt(late, 'Europe/Zurich', new Date('2026-11-21T01:30:00Z')), false, 'Saturday 02:30');
  assert.equal(openAt([[1, 0, 0]], 'Europe/Zurich', new Date('2026-11-17T10:00:00Z')), false);
});

test('no zone, or one the browser does not know: nothing is claimed', () => {
  assert.equal(openAt(WEEK, '', new Date('2026-11-17T10:00:00Z')), undefined);
  assert.equal(openAt(WEEK, 'Mars/Olympus_Mons', new Date('2026-11-17T10:00:00Z')), undefined);
});
