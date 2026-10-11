// The arithmetic behind the form's look, without a document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { to24, partOfHour, partsOf, ymd, parseDay } from '../lib/booking/parts.mjs';

test('a clock read on 24 hours, whatever the page said', () => {
  assert.equal(to24('09:15 AM'), '09:15');
  assert.equal(to24('12:30 PM · CHF 95'), '12:30 · CHF 95');
  assert.equal(to24('12:05 AM'), '00:05');
  assert.equal(to24('21:00'), '21:00');
});

test('the parts of a day, and a part of one or two times joining its neighbour', () => {
  assert.deepEqual([9, 12, 16].map(partOfHour), ['morning', 'afternoon', 'evening']);
  // Twelve morning times, sixteen afternoon ones, one at 16:00: no «Evening 16:00–16:00».
  const hours = [...Array(12).fill(9), ...Array(16).fill(13), 16];
  const parts = partsOf(hours);
  assert.equal(parts[parts.length - 1], 'afternoon');
  assert.deepEqual([...new Set(parts)], ['morning', 'afternoon']);
  // Two in the morning join the afternoon; a day of three parts stays three.
  assert.deepEqual([...new Set(partsOf([9, 10, 13, 13, 13, 17, 17, 17]))], ['afternoon', 'evening']);
  assert.deepEqual([...new Set(partsOf([9, 9, 9, 13, 13, 13, 17, 17, 17]))], ['morning', 'afternoon', 'evening']);
  // A morning alone is a morning: nothing to join.
  assert.deepEqual([...new Set(partsOf([9, 10]))], ['morning']);
});

test('a day is the browser\'s own, never UTC\'s', () => {
  const d = new Date(2026, 9, 10, 0, 30); // 10 October, half past midnight, wherever the browser is
  assert.equal(ymd(d), '2026-10-10');
  assert.equal(parseDay('2026-10-10')?.getDate(), 10);
  assert.equal(parseDay('10.10.2026'), null);
});
