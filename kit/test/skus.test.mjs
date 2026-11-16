// The kit makes every SKU and key the platform makes (jtakeit-core wiki/102 stage 9, decision 9, Task 9.18): the cases are
// the platform's, `backend/api/modules/shop/testdata/skus.json`, copied read-only at jtakeit-core 0e150d8a — unchanged since
// 91a63312 (Task 9.5), where the cases were written. The platform's Go test and the panel's test read the same file; here a
// copy is read, so that this suite runs offline. A case is added on the platform's side, never in this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKU_ROOM, freeSku, keyOf, skuBase, skuKey } from '../lib/shop/skus.mjs';

const cases = JSON.parse(readFileSync(new URL('./fixtures/platform/skus.json', import.meta.url), 'utf8'));

/** What the `sku` kind takes (registry/validate.go's skuRe). */
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** What a contract-3 `_key` holds. */
const KEY = /^[a-z][a-z0-9-]{0,31}$/;

test('the kit makes every SKU and key the platform\'s cases say', () => {
  assert.ok(cases.base.length > 0 && cases.free.length > 0 && cases.keys.length > 0, 'the file has its three lists');

  for (const one of cases.base) {
    const made = skuBase(one.slug, one.values);
    assert.equal(made, one.sku, one.name);
    assert.match(made, SKU, one.name);
    assert.ok(made.length <= SKU_ROOM, one.name);
  }

  for (const one of cases.free) {
    const taken = new Set(one.taken.map(skuKey));
    if (one.numbered !== null) for (let n = one.numbered.from; n <= one.numbered.to; n++) taken.add(skuKey(`${one.numbered.base}-${n}`));
    for (const sku of one.skus) {
      const made = freeSku(one.base, taken);
      assert.equal(made, sku, one.name);
      assert.match(made, SKU, one.name);
      assert.ok(taken.has(skuKey(made)), `${one.name}: the answer is taken from then on`);
    }
  }

  for (const one of cases.keys) {
    const made = keyOf(one.label, new Set(one.taken), one.fallback);
    assert.equal(made, one.key, one.name);
    assert.match(made, KEY, one.name);
  }
});

test('a letter the platform leaves as it is, ß among them, is a dash and not the two letters JavaScript makes of it', () => {
  // Go's ToUpper has no upper case for ß (it stays, and the kind does not take it); JavaScript's makes SS.
  assert.equal(skuBase('fuß', ['x']), 'FU-X');
  assert.equal(skuBase('ß', []), 'SKU');
  // Letters whose simple upper case is an ASCII letter are that letter, in both.
  assert.equal(skuBase('ıf', []), 'IF');
  assert.equal(skuKey('MuG-1'), 'mug-1');
});
