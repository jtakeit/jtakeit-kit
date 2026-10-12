// Scheduled entries in `astro dev` (template/src/lib/schedule.ts): the
// platform's rule for `show_at` and `hide_at`, run by Node on its own — the
// file imports nothing, and Node strips its types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shownAt } from '../template/src/lib/schedule.ts';

const now = Date.parse('2026-10-12T12:00:00Z');

test('an entry with no schedule is shown, and visible:false hides it as it always did', () => {
  assert.equal(shownAt({}, now), true);
  assert.equal(shownAt({ visible: true }, now), true);
  assert.equal(shownAt({ visible: false }, now), false);
  assert.equal(shownAt({ visible: false, show_at: '2026-01-01T00:00:00Z' }, now), false, 'a date never shows what is hidden');
});

test('show_at hides an entry until it comes, and not a moment after', () => {
  assert.equal(shownAt({ show_at: '2026-10-20T07:00:00Z' }, now), false);
  assert.equal(shownAt({ show_at: '2026-10-12T12:00:00Z' }, now), true, 'at the second itself it is out');
  assert.equal(shownAt({ show_at: '2026-10-01T00:00:00Z' }, now), true);
});

test('hide_at hides an entry from then on', () => {
  assert.equal(shownAt({ hide_at: '2026-10-01T00:00:00Z' }, now), false);
  assert.equal(shownAt({ hide_at: '2026-10-12T12:00:00Z' }, now), false, 'at the second itself it is gone');
  assert.equal(shownAt({ hide_at: '2026-12-31T23:59:59Z' }, now), true);
});

test('both: shown between the two', () => {
  const window = { show_at: '2026-10-10T00:00:00Z', hide_at: '2026-10-14T00:00:00Z' };
  assert.equal(shownAt(window, now), true);
  assert.equal(shownAt(window, Date.parse('2026-10-09T23:59:59Z')), false);
  assert.equal(shownAt(window, Date.parse('2026-10-14T00:00:00Z')), false);
});

test('a value that is not a time is no schedule', () => {
  assert.equal(shownAt({ show_at: 'next week' }, now), true);
  assert.equal(shownAt({ show_at: '', hide_at: null }, now), true);
  assert.equal(shownAt({ hide_at: 1760270400000 }, now), true, 'a number is not RFC 3339');
});
