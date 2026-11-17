/**
 * What a second import is matched against: the sheet's products laid beside
 * the collection's entries (jtakeit-core wiki/102 stage 9, Ruling 191).
 *
 * A sheet variant whose SKU (by `skuKey`) a variant of the collection holds is
 * that variant; one with none is matched by the product's slug and its picks. A
 * sheet product whose variants match one entry is that entry, and one matching
 * two is refused, naming both. A SKU the collection does not hold, for the picks
 * of a variant that holds another, is said and skipped by the caller — an
 * import changes no SKU — but only where the product is already known: by its
 * other variants, or by an address the sheet gave. An address made from a name
 * is no identity: a second *Kerze* with SKUs of its own is another product.
 *
 * A product that matches nothing is new, and gets its address here: the
 * sheet's own, refused where it is taken, or one made from its name, numbered
 * where it is.
 */
import { isDeepStrictEqual } from 'node:util';
import { keyOf, skuKey } from '@jtakeit/kit/shop/skus';
import { SLUG_RESERVED } from './sheet.mjs';
import { SLUG_MOST, andList, isObject, listOf, q } from './util.mjs';

/** An entry's option by the name the sheet gives it, else by the key that name would make: a name an owner changed in the panel keeps its key. */
export const optionOf = (options, name) => options.find((one) => one.name === name) ?? options.find((one) => one._key === keyOf(name, new Set(), 'o'));
/** An option's value by its label, else by the key the label would make. */
export const valueOf = (option, label) => listOf(option.values).find((one) => one.label === label) ?? listOf(option.values).find((one) => one._key === keyOf(label, new Set(), 'v'));
export const picksOfRow = (row) => (isObject(row.picks) ? row.picks : {});

/**
 * The picks a sheet variant makes of an entry's options — `{ option key: value key }` — or undefined where one of its options or values is not the entry's.
 * @returns {Record<string, string> | undefined}
 */
export function picksIn(entry, P, V) {
  const options = listOf(entry.doc.fields?.options);
  const picks = {};
  for (const [j, one] of P.options.entries()) {
    const option = optionOf(options, one.name);
    const value = option === undefined ? undefined : valueOf(option, V.labels[j]);
    if (option === undefined || value === undefined) return undefined;
    picks[option._key] = value._key;
  }
  return picks;
}

/**
 * Each sheet product its entry, or none; each sheet variant its variant (`V.target`), or the one it conflicts with (`V.conflict`);
 * each new product its address. Nothing is written: refusals go to `refuse`.
 *
 * @param {import('./sheet.mjs').SheetProduct[]} list
 * @param {{ held: any[], bySlug: Map<string, any>, skuIndex: Map<string, any> }} existing what the collection holds
 * @param {{ refuse: (where: string, why: string) => void, own: string, slugColumn: string | undefined }} site
 */
export function matchProducts(list, { held, bySlug, skuIndex }, { refuse, own, slugColumn }) {
  const claimed = new Map();
  for (const P of list) {
    /** @type {Map<any, any[]>} */ const hits = new Map();
    const hit = (entry, V) => hits.set(entry, [...(hits.get(entry) ?? []), V]);
    for (const V of P.variants) {
      const bySku = V.sku === undefined ? undefined : skuIndex.get(skuKey(V.sku));
      if (bySku !== undefined) {
        V.target = bySku;
        hit(bySku.entry, V);
      }
    }
    /** The variant of an entry a sheet variant has the same picks as, if any. */
    const sameAs = (entry, V) => {
      const picks = picksIn(entry, P, V);
      return picks === undefined ? undefined : listOf(entry.doc.fields?.variants).find((one) => isObject(one) && isDeepStrictEqual(picksOfRow(one), picks));
    };
    // A variant with no SKU is matched by the product's slug and its picks.
    for (const V of P.variants.filter((one) => one.sku === undefined)) {
      const entry = bySlug.get(P.wanted);
      const variant = entry === undefined ? undefined : sameAs(entry, V);
      if (variant === undefined) continue;
      V.target = { entry, variant };
      hit(entry, V);
    }
    // A SKU the collection does not hold, for the picks of a variant that holds another.
    const home = hits.size === 1 ? [...hits.keys()][0] : hits.size === 0 && P.given ? bySlug.get(P.wanted) : undefined;
    for (const V of P.variants.filter((one) => one.sku !== undefined && one.target === undefined && home !== undefined)) {
      const variant = sameAs(home, V);
      if (variant === undefined) continue;
      V.conflict = { entry: home, variant };
      hit(home, V);
    }
    if (hits.size > 1) {
      refuse(`row ${P.line}`, `the product ${q(P.titles[own])} is two products of the site: ${andList([...hits].map(([entry, vs]) => `${entry.slug} (row ${vs[0].line}${vs[0].sku === undefined ? '' : `, ${vs[0].sku}`})`))} — one product of the sheet is one product of the site`);
    } else if (hits.size === 1) {
      const [entry] = hits.keys();
      if (claimed.has(entry)) refuse(`rows ${claimed.get(entry).line} and ${P.line}`, `are one product of the site, ${entry.slug}, twice`);
      else claimed.set(entry, P);
      P.entry = entry;
      P.slug = entry.slug;
    }
  }

  // A new product's address: the sheet's, which is the sheet's to give; or one made from its name, numbered where taken.
  const reserved = new Set([SLUG_RESERVED, ...bySlug.keys(), ...list.filter((P) => P.given).map((P) => P.slug)]);
  const given = new Map();
  const where = (P) => `row ${P.line}, column ${q(slugColumn)}`;
  for (const P of list.filter((one) => one.entry === undefined)) {
    if (P.given) {
      if (bySlug.has(P.slug)) refuse(where(P), `${q(P.slug)} is the address of ${bySlug.get(P.slug).file}, whose SKUs are none of this product's — nothing is made over it: a variant it holds names it, or the product is given another address`);
      else if (given.has(P.slug)) refuse(`rows ${given.get(P.slug).line} and ${P.line}, column ${q(slugColumn)}`, `${q(P.slug)} is the address of two products`);
      else given.set(P.slug, P);
      continue;
    }
    let slug = P.slug;
    for (let n = 2; reserved.has(slug); n++) {
      const suffix = `-${n}`;
      slug = `${P.slug.slice(0, SLUG_MOST - suffix.length).replace(/-+$/, '')}${suffix}`;
    }
    reserved.add(slug);
    P.slug = slug;
  }
}
