/**
 * The SKUs and keys the platform makes for a product, made the same here
 * (jtakeit-core wiki/102 stage 9, decision 9): `jtk import products` gives a
 * variant the sheet leaves without a SKU the one the platform would have given
 * it, and an option or a value the key the panel would have given it, so that
 * an import and a person in the panel never disagree about what a thing is
 * called. Three makers, each a copy of a platform maker:
 *
 *   skuBase   `SKUBase`  (backend/api/modules/shop/skus.go)
 *   freeSku   `FreeSKU`  (the same file)
 *   keyOf     `keyOf`    (frontend/admin/src/widgets/shop/combinations.ts)
 *
 * They are held to the same answers by one list of cases, the platform's
 * `modules/shop/testdata/skus.json`, which the platform's Go test and the
 * panel's test read and which `kit/test/skus.test.mjs` reads a copy of.
 * A case is added there, never here.
 *
 * Pure: it knows no site. Which SKUs a site has taken is the caller's to say.
 */

/** How much of a made SKU is its base: 60 of the `sku` kind's 64 characters, leaving room for the number a taken one gets. */
export const SKU_ROOM = 60;

/** The longest a SKU of the `sku` kind may be. */
const SKU_MOST = 64;

/** A row's or a value's key, as the server takes one: a letter, then letters, digits, dashes, 32 at most. */
const KEY_MOST = 32;

/** What SKUs are compared by: in lower case, so that `Mug` and `MUG` are one (`SKUKey`). */
export function skuKey(sku) {
  return sku.toLowerCase();
}

/**
 * Go's `strings.ToUpper` maps a code point by its simple case mapping, which
 * has no answer for `ß` (and a few ligatures): it stays as it is. JavaScript's
 * `toUpperCase` answers `SS`, two characters. A code point whose upper case is
 * not one code point is therefore left alone, so that what is not a letter the
 * kind takes becomes a dash here as it does there.
 */
function upper(point) {
  const mapped = point.toUpperCase();
  return [...mapped].length === 1 ? mapped : point;
}

/**
 * The SKU a product's slug and the keys of a variant's values make, in the
 * options' order: `T-SHIRT-FOX`, `T-SHIRT-FOX-M-RED`. They are joined by a
 * dash, in capitals; anything outside the kind's `[A-Z0-9._-]` is a dash, a
 * run of dashes one, and none at either end; what is left is cut to
 * `SKU_ROOM`, and nothing left is `SKU`. Nothing starts with a dot or an
 * underscore: the kind begins with a letter or a digit.
 *
 * @param {string} slug
 * @param {string[]} values
 * @returns {string}
 */
export function skuBase(slug, values) {
  const joined = [slug, ...values].join('-');
  let made = '';
  for (const point of joined) {
    const one = upper(point);
    if ((one >= 'A' && one <= 'Z') || (one >= '0' && one <= '9')) made += one;
    else if ((one === '.' || one === '_') && made.length > 0) made += one;
    else if (made.length > 0 && !made.endsWith('-')) made += '-';
  }
  if (made.length > SKU_ROOM) made = made.slice(0, SKU_ROOM);
  const base = made.replace(/-+$/, '');
  return base === '' ? 'SKU' : base;
}

/**
 * The base if the site has not taken it, else the base with -2, -3 … — the
 * first one it has not — compared by `skuKey`. `taken` is by `skuKey`, and the
 * SKU answered is added to it, so that what is asked for next is never given
 * the same. The number never takes a SKU past the kind's 64 characters: a base
 * so often taken that its number is four digits gives up a character of itself
 * for it.
 *
 * @param {string} base
 * @param {Set<string>} taken
 * @returns {string}
 */
export function freeSku(base, taken) {
  let sku = base;
  for (let n = 2; taken.has(skuKey(sku)); n++) {
    const number = `-${n}`;
    let head = base;
    if (head.length + number.length > SKU_MOST) head = head.slice(0, SKU_MOST - number.length).replace(/-+$/, '');
    sku = head + number;
  }
  taken.add(skuKey(sku));
  return sku;
}

/** A key cut to a length, never ending in the dash the cut left. */
function trimmed(key, most) {
  return key.slice(0, most).replace(/-+$/, '');
}

/**
 * A key made from a label (contract 3's `_key`): "Size" → `size`, "Extra
 * large" → `extra-large`, letters with their accents taken off and anything
 * else a dash. It starts with a letter, so a label of digits — a shoe's 42 —
 * is put after `fallback` (`v42` for a value, `o42` for an option, as the
 * callers give them), and a label with nothing a key can hold — a
 * Cyrillic one — is `fallback` itself. A key already `taken` gets `-2`, `-3` …,
 * cut so the number fits in 32.
 *
 * @param {string} label
 * @param {ReadonlySet<string>} taken
 * @param {string} fallback
 * @returns {string}
 */
export function keyOf(label, taken, fallback) {
  const slug = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const said = slug === '' ? fallback : /^[a-z]/.test(slug) ? slug : `${fallback}${slug}`;
  const base = trimmed(said, KEY_MOST);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const key = `${trimmed(base, KEY_MOST - suffix.length)}${suffix}`;
    if (!taken.has(key)) return key;
  }
}
