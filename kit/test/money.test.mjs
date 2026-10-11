import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitsOf, money } from '../lib/money.mjs';

// A price in its currency's own minor unit (11 October 2026): ¥1000 is a
// thousand yen, not ten.
test('a price is counted in its currency\'s own digits', () => {
  assert.equal(digitsOf('chf'), 2);
  assert.equal(digitsOf('JPY'), 0);
  assert.equal(digitsOf('kwd'), 3);
  assert.match(money(18000, 'CHF', 'en'), /180/);
  assert.doesNotMatch(money(18000, 'CHF', 'en'), /18,000|18000/);
  assert.match(money(1000, 'JPY', 'en'), /1,000/);
  assert.match(money(12345, 'KWD', 'en'), /12\.345/);
  // No currency said: the amount alone, in hundredths, and no sign made up.
  assert.equal(money(18000, '', 'en'), '180');
});
