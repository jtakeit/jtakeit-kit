/**
 * The files a sheet product comes to: a new entry, and its translations, or
 * what a second import lays over an entry that is there (jtakeit-core wiki/102
 * stage 9, decision 9, Ruling 191). Nothing is written here: the files are
 * planned into `ctx.writes`, and the caller writes them when nothing is refused.
 *
 * Made, a product is `{ id, collection, slug, rank, visible, fields }` — the id
 * minted, the rank after the collection's last, the keys of options and values
 * made from their names, a variant's `_key` the first `v<n>` not taken, a SKU the
 * sheet's or the one the platform would make.
 *
 * Updated, it takes the sheet's numbers and switches — prices, weights,
 * `on_sale`, `visible`, `tracked`, the size class, the tax code, the customs
 * fields — and keeps the `id`, every `_key`, the `rank` and every variant the
 * sheet does not name; adds the variants the sheet adds; and keeps the words the
 * entry holds, saying each that differs from the sheet's, unless `ctx.words`. A
 * cell the sheet leaves empty erases nothing.
 *
 * The pictures the sheet names are a product's `cover` and `pictures` — slots,
 * `products/<slug>-<n>`, the files lib/import/pictures.mjs fetched — for a product
 * made, or one with neither a cover nor pictures; a product that has its pictures
 * keeps them. Which are fetched is told by the first plan (`Planned.pictures`),
 * what was had is laid in by the second (`ctx.pictures`).
 */
import { isDeepStrictEqual } from 'node:util';
import { newKey, uuid7 } from '@jtakeit/kit/content/identity';
import { freeSku, keyOf, skuBase } from '@jtakeit/kit/shop/skus';
import { rankBetween } from '@jtakeit/kit/upgrade';
import { notesOf, MOST_VARIANTS } from './sheet.mjs';
import { optionOf, picksIn, picksOfRow, valueOf } from './match.mjs';
import { isObject, json, listOf, q, shown, thousands } from './util.mjs';

/**
 * @typedef {{
 *   own: string, collection: string, dir: string, words: boolean,
 *   priceColumn: string, titleColumn: string,
 *   refuse: (where: string, why: string) => void, said: string[], writes: Map<string, string | null>,
 *   taken: Set<string>, translations: Map<string, Map<string, { file: string, doc: any }>>,
 *   pictures: Map<string, string[]> | undefined, lastRank: string,
 * }} Context what the plan holds while it makes the files; `pictures` the slots of what was fetched, by slug (none in the plan that says what is to be fetched); `lastRank` moves with every product made
 * @typedef {{
 *   slug: string, id: string, action: 'made' | 'updated' | 'left', line: number, variants: number,
 *   made: { key: string, sku: string }[], changes: string[],
 *   pictures: { ref: string, line: number, column: string }[], keeps: boolean,
 * }} Planned `pictures` what the import fetches for the product: the sheet's where the product takes them, none where it has its own; `keeps` that the sheet names some and the product has its own
 */

/** The first `v<n>` not in `keys`, which then holds it. */
function nextKey(keys) {
  for (let n = 1; ; n++) {
    if (!keys.has(`v${n}`)) {
      keys.add(`v${n}`);
      return `v${n}`;
    }
  }
}

/** A variant's row: the sheet's numbers, and its picks where the product has options. */
const variantRow = (key, sku, V, picks) => ({
  _key: key,
  sku,
  price: { minor: V.price },
  ...(V.weight === undefined ? {} : { weight: V.weight }),
  ...(picks === undefined ? {} : { picks }),
  ...(V.on_sale === undefined ? {} : { on_sale: V.on_sale }),
});

/** The other languages the sheet has words in. */
const translated = (P, own) => Object.keys({ ...P.titles, ...P.descriptions }).filter((lang) => lang !== own);
const wordsIn = (P, lang) => ({
  ...(P.titles[lang] === undefined ? {} : { title: P.titles[lang] }),
  ...(P.descriptions[lang] === undefined ? {} : { description: P.descriptions[lang] }),
});

/**
 * A product's `cover` and `pictures` from the slots that were had: the first is the cover, the rest rows with a `_key` of
 * their own, each with the product's name as its words. None where none was had.
 * @param {string[]} slots @param {string} alt
 */
function pictureFields(slots, alt) {
  if (slots.length === 0) return {};
  const [cover, ...rest] = slots;
  const taken = new Set();
  return {
    cover: { src: cover, alt },
    ...(rest.length === 0 ? {} : { pictures: rest.map((src) => ({ _key: newKey(taken), src, alt })) }),
  };
}

/** A picture a product has: a `src` that says something. */
const present = (value) => (isObject(value) ? typeof value.src === 'string' && value.src.trim() !== '' : value !== undefined && value !== null && value !== '');

/**
 * A new product: its entry and the translations the sheet has words for.
 * @param {import('./sheet.mjs').SheetProduct} P @param {Context} ctx
 * @returns {Planned}
 */
export function makeEntry(P, ctx) {
  const used = new Set();
  const options = P.options.map((one) => {
    const key = keyOf(one.name, used, 'o');
    used.add(key);
    const inOption = new Set();
    const values = one.values.map((label) => {
      const value = keyOf(label, inOption, 'v');
      inOption.add(value);
      return { _key: value, label };
    });
    return { _key: key, name: one.name, values };
  });
  const keys = new Set();
  const made = [];
  const variants = P.variants.map((V) => {
    const key = nextKey(keys);
    const picks = {};
    const valueKeys = [];
    options.forEach((option, j) => {
      const value = option.values.find((one) => one.label === V.labels[j]);
      picks[option._key] = value._key;
      valueKeys.push(value._key);
    });
    const sku = V.sku ?? freeSku(skuBase(P.slug, valueKeys), ctx.taken);
    if (V.sku === undefined) made.push({ key, sku });
    V.final = sku;
    return variantRow(key, sku, V, options.length === 0 ? undefined : picks);
  });
  ctx.lastRank = rankBetween(ctx.lastRank, '');
  const doc = {
    id: uuid7(),
    collection: ctx.collection,
    slug: P.slug,
    rank: ctx.lastRank,
    visible: P.visible ?? true,
    fields: {
      title: P.titles[ctx.own],
      ...(P.descriptions[ctx.own] === undefined ? {} : { description: P.descriptions[ctx.own] }),
      ...pictureFields(ctx.pictures?.get(P.slug) ?? [], P.titles[ctx.own]),
      ...(options.length === 0 ? {} : { options }),
      variants,
      ...(P.tracked === undefined ? {} : { tracked: P.tracked }),
      ...(P.size_class === undefined ? {} : { size_class: P.size_class }),
      ...(P.tax_code === undefined ? {} : { tax_code: P.tax_code }),
      ...(P.tariff_number === undefined ? {} : { tariff_number: P.tariff_number }),
      ...(P.made_in === undefined ? {} : { made_in: P.made_in }),
    },
  };
  ctx.writes.set(`${ctx.dir}/${P.slug}.json`, json(doc));
  for (const lang of translated(P, ctx.own)) ctx.writes.set(`${ctx.dir}/${P.slug}.${lang}.json`, json({ of: doc.id, locale: lang, fields: wordsIn(P, lang) }));
  ctx.said.push(...notesOf(P, P.slug));
  return { slug: P.slug, id: doc.id, action: 'made', line: P.line, variants: variants.length, made, changes: [], pictures: P.pictures, keeps: false };
}

/**
 * What the sheet lays over the entry it matched: the entry's file and its translations, where they change.
 * @param {import('./sheet.mjs').SheetProduct} P @param {Context} ctx
 * @returns {Planned | undefined} undefined where the sheet cannot be laid over the entry, which is refused
 */
export function updateEntry(P, ctx) {
  const { entry } = P;
  const { own, refuse, said, writes, taken } = ctx;
  const slug = entry.slug;
  const doc = structuredClone(entry.doc);
  const here = `row ${P.line}, column ${q(ctx.titleColumn)}`;
  if (typeof doc.id !== 'string' || !isObject(doc.fields)) {
    refuse(here, `the entry it matches, ${entry.file}, has ${typeof doc.id !== 'string' ? 'no id (`jtk schema` mints it)' : 'no fields'}, so the sheet cannot be laid over it`);
    return undefined;
  }
  const fields = doc.fields;
  if (fields.variants !== undefined && !Array.isArray(fields.variants)) {
    refuse(here, `the entry it matches, ${entry.file}, has \`variants\` that is not a list, so the sheet cannot be laid over it`);
    return undefined;
  }
  /** @type {string[]} */ const changes = [];
  /** @type {string[]} */ const kept = [];
  const made = [];
  let touched = false;

  /** Words: kept where the entry holds some that differ, unless `words`; filled where it holds none. */
  const word = (what, before, sheetWords, apply) => {
    if (sheetWords === undefined || sheetWords === before) return;
    if (typeof before !== 'string' || before.trim() === '' || ctx.words) {
      changes.push(`${slug}: ${what} ${shown(before)} → ${shown(sheetWords)}`);
      apply();
    } else kept.push(`${slug}: ${what} kept ${shown(before)}, the sheet says ${shown(sheetWords)} (--words takes the sheet's)`);
  };
  /** A number or a switch: the sheet's, where it differs. */
  const number = (what, before, after, apply) => {
    if (after === undefined || after === before) return;
    changes.push(`${slug}: ${what} ${shown(before)} → ${shown(after)}`);
    apply();
  };

  word('title', fields.title, P.titles[own], () => (fields.title = P.titles[own]));
  word('description', fields.description, P.descriptions[own], () => (fields.description = P.descriptions[own]));
  if (P.given && P.wanted !== slug) kept.push(`${slug}: address kept, the sheet says ${q(P.wanted)} (an address is changed in the panel, where its redirect is made)`);

  // The options the sheet names, as the entry has them: by name, else by the key a name makes.
  const options = listOf(fields.options).filter(isObject);
  const matched = P.options.map((one) => optionOf(options, one.name));
  P.options.forEach((one, j) => {
    const option = matched[j];
    if (option === undefined) return;
    word(`option ${option._key} name`, option.name, one.name, () => (option.name = one.name));
    for (const label of one.values) {
      const value = valueOf(option, label);
      if (value !== undefined) word(`option ${option._key} value ${value._key}`, value.label, label, () => (value.label = label));
    }
  });
  const named = (V) => P.options.map((one, j) => `${one.name} ${V.labels[j]}`).join(', ');

  const originals = listOf(entry.doc.fields?.variants);
  const variants = fields.variants ?? (fields.variants = []);
  const keys = new Set(variants.map((one) => one?._key));
  for (const V of P.variants) {
    if (V.conflict !== undefined) {
      V.skipped = true;
      said.push(`row ${V.line}: the sheet's SKU ${V.sku} is not ${V.conflict.variant.sku}, which ${slug} holds for the same picks (${named(V) || 'none'}) — an import changes no SKU, so the row is skipped`);
      continue;
    }
    if (V.target !== undefined) {
      const row = variants[originals.indexOf(V.target.variant)];
      number(`${row._key} price`, isObject(row.price) ? row.price.minor : undefined, V.price, () => (row.price = { minor: V.price }));
      number(`${row._key} weight`, row.weight, V.weight, () => (row.weight = V.weight));
      // Without `on_sale`, on sale: a sheet that says on sale changes nothing there.
      number(`${row._key} on_sale`, typeof row.on_sale === 'boolean' ? row.on_sale : true, V.on_sale, () => (row.on_sale = V.on_sale));
      V.final = row.sku;
      if (V.sku !== undefined && P.options.length > 0) {
        // Said only where the sheet's picks differ on the options it knows: an option the owner added in the panel is not the sheet's to name.
        const picks = picksIn(entry, P, V);
        const held = picksOfRow(V.target.variant);
        if (picks !== undefined && !isDeepStrictEqual(Object.fromEntries(Object.keys(picks).map((key) => [key, held[key]])), picks)) {
          said.push(`row ${V.line}: ${V.sku} is ${named(V)} in the sheet and another combination in ${slug} — its picks are kept`);
        }
      }
      continue;
    }
    // A variant the sheet adds: it must pick a value of each of the entry's options, and nothing the entry has not.
    let why;
    let column = P.options[0]?.column ?? ctx.priceColumn;
    P.options.forEach((one, j) => {
      if (matched[j] !== undefined || why !== undefined) return;
      why = `the option ${q(one.name)} is none of ${slug}'s: the options of a product are the owner's to change in the panel, since each of its variants picks a value of each`;
      column = one.column;
    });
    for (const option of options) if (!matched.includes(option)) why ??= `picks no value of ${slug}'s option ${q(option.name)}`;
    if (why === undefined && variants.length >= MOST_VARIANTS) why = `would make ${slug} ${thousands(variants.length + 1)} variants, and a product has at most ${thousands(MOST_VARIANTS)}`;
    if (why !== undefined) {
      refuse(`row ${V.line}, column ${q(column)}`, why);
      continue;
    }
    const picks = {};
    const valueKeys = [];
    for (const option of options) {
      const label = V.labels[matched.indexOf(option)];
      let value = valueOf(option, label);
      if (value === undefined) {
        value = { _key: keyOf(label, new Set(listOf(option.values).map((one) => one._key)), 'v'), label };
        option.values = [...listOf(option.values), value];
        changes.push(`${slug}: option ${option._key} gains the value ${q(label)} (${value._key})`);
      }
      picks[option._key] = value._key;
      valueKeys.push(value._key);
    }
    const key = nextKey(keys);
    const sku = V.sku ?? freeSku(skuBase(slug, valueKeys), taken);
    if (V.sku === undefined) made.push({ key, sku });
    V.final = sku;
    variants.push(variantRow(key, sku, V, options.length === 0 ? undefined : picks));
    changes.push(`${slug}: ${key} added, ${sku} at ${V.price}`);
  }

  number('visible', doc.visible, P.visible, () => (doc.visible = P.visible));
  number('tracked', typeof fields.tracked === 'boolean' ? fields.tracked : true, P.tracked, () => (fields.tracked = P.tracked));
  number('size_class', typeof fields.size_class === 'string' ? fields.size_class : 'parcel', P.size_class, () => (fields.size_class = P.size_class));
  for (const key of ['tax_code', 'tariff_number', 'made_in']) number(key, typeof fields[key] === 'string' ? fields[key] : undefined, P[key], () => (fields[key] = P[key]));

  // The pictures: taken where the product has neither a cover nor pictures, and kept where it has either.
  const has = present(fields.cover) || (Array.isArray(fields.pictures) ? fields.pictures.some(present) : present(fields.pictures));
  const slots = has ? [] : ctx.pictures?.get(slug) ?? [];
  if (slots.length > 0) {
    Object.assign(fields, pictureFields(slots, typeof fields.title === 'string' ? fields.title : P.titles[own]));
    changes.push(`${slug}: cover none → ${shown(slots[0])}${slots.length > 1 ? `, and ${slots.length - 1} more ${slots.length === 2 ? 'picture' : 'pictures'}` : ''}`);
  }

  // The other languages: laid over the original, the words in them kept like the original's.
  for (const lang of translated(P, own)) {
    const there = ctx.translations.get(doc.id)?.get(lang);
    if (there === undefined) {
      writes.set(`${ctx.dir}/${slug}.${lang}.json`, json({ of: doc.id, locale: lang, fields: wordsIn(P, lang) }));
      changes.push(`${slug}: ${lang} translation made`);
      touched = true;
      continue;
    }
    const copy = structuredClone(there.doc);
    if (!isObject(copy.fields)) copy.fields = {};
    word(`${lang} title`, copy.fields.title, P.titles[lang], () => (copy.fields.title = P.titles[lang]));
    word(`${lang} description`, copy.fields.description, P.descriptions[lang], () => (copy.fields.description = P.descriptions[lang]));
    if (!isDeepStrictEqual(copy, there.doc)) {
      writes.set(there.file, json(copy));
      touched = true;
    }
  }

  if (!isDeepStrictEqual(doc, entry.doc)) {
    writes.set(entry.file, json(doc));
    touched = true;
  }
  said.push(...notesOf(P, slug), ...kept);
  return {
    slug, id: doc.id, action: touched ? 'updated' : 'left', line: P.line, variants: variants.length, made, changes,
    pictures: has ? [] : P.pictures, keeps: has && P.pictures.length > 0,
  };
}
