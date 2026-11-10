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

// A price «from» says the booking form's own word, so the form and the price
// list on one site say one thing (jtakeit-core wiki/98 §15 · 11).
test('a price\'s qualifiers are in every language the booking form is, and «from» is the form\'s word', async () => {
  const { priceWords } = await import('../lib/money.mjs');
  const { LOCALES, wordsFor } = await import('../lib/booking/words.mjs');
  for (const locale of LOCALES) {
    assert.equal(priceWords(locale).from, `${wordsFor(locale).from} {amount}`, locale);
    assert.notEqual(priceWords(locale).on_request.trim(), '', locale);
  }
  assert.deepEqual(priceWords('de-CH'), { from: 'ab {amount}', on_request: 'auf Anfrage' });
  const own = priceWords('de');
  own.from = 'mutated';
  assert.equal(priceWords('de').from, 'ab {amount}', 'a fresh object each time, the caller\'s to write over');
});
