/**
 * The sheet's products, as the sheet says them — every cell read through the
 * mapping, every fault refused with its row and its column, nothing yet
 * compared with what the site holds (lib/import/match.mjs) or made of it
 * (lib/import/entries.mjs).
 *
 * ── what a product is ───────────────────────────────────────────────────────
 *
 * Its first row's fields — the name, the words, the switches, the size class,
 * the tax code, the customs fields, and the names of its options — and a
 * variant for each of its rows that has a price. A parent row that has none, and
 * a row that only adds a picture, are not variants; a row that has a SKU or an
 * option value and no price is one, and is refused, since a variant is sold at a
 * price or not at all. How rows make products is the mapping's `group`; which
 * rows are no product at all is its `skip`.
 *
 * ── what an option is ───────────────────────────────────────────────────────
 *
 * An attribute the product's variations name. The product's first row says
 * which attributes the product has, in the mapping's pairs of a name column and
 * a value column; each variant's own row says which of them it picks and which
 * value: by the name in the row's own name cell where it has one — WooCommerce
 * numbers a variation's attributes from 1 over the variation's own, so the
 * third pair of a row is not the third attribute of its parent — and, where its
 * name cell is empty, by the position of the pair, as Shopify writes the names
 * on a product's first row alone. A name no first row has, or a value with no
 * name to be pair of, is refused with its row and column; an attribute no
 * variation uses is left out and said, once for the product. In a parent-mode
 * sheet a product with no variations is a simple product, and its attributes
 * describe it.
 */
import { readAmount, readCount, readGrams, readSwitch } from './mapping.mjs';
import { slugify } from './slug.mjs';
import { andList, count, q, thousands } from './util.mjs';

/** The most variants a product has (wiki/101 §5.4). */
export const MOST_VARIANTS = 2000;

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The longest an address may be to the server (the panel makes them of 60 at most). */
const SLUG_MOST = 80;
/** No entry may be named so: the folder beside a document is the pictures a build fetches there. */
export const SLUG_RESERVED = 'media';
const TAX_CODE = /^txcd_[0-9]{8}$/;
const SIZE_CLASSES = ['letter', 'parcel', 'bulky'];
const TITLE_MOST = 120;
const DESCRIPTION_MOST = 4000;

// ── words ─────────────────────────────────────────────────────────────────

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', euro: '€', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç',
};

/** A reference as a character, or as it was written where it is none. */
function decoded(whole, name) {
  if (name[0] === '#') {
    const point = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  }
  return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : whole;
}

/** The elements a page is written with: a `<` that is not the start of one of these is a character, as in `<info@shop.ch>`. */
const ELEMENTS = 'a|abbr|address|article|aside|audio|b|blockquote|br|button|caption|center|cite|code|col|colgroup|dd|del|details|dfn|div|dl|dt|em|figcaption|figure|font|footer|form|h[1-6]|header|hr|i|iframe|img|input|ins|kbd|label|legend|li|main|mark|nav|noscript|ol|p|picture|pre|q|s|samp|section|small|source|span|strike|strong|sub|summary|sup|svg|table|tbody|td|tfoot|th|thead|tr|tt|u|ul|var|video|wbr';
const TAG = new RegExp(`</?(?:${ELEMENTS})(?=[\\s/>])[^>]*>`, 'gi');

/**
 * A description made text. Its entities are read — `Tom &amp; Jerry` is `Tom & Jerry`.
 * What holds HTML — Shopify's `Body (HTML)`, WooCommerce's `Description` — has its
 * elements out (and only elements: `<info@shop.ch>` is a mail address and stays),
 * a paragraph or a `<br>` a line break, and its whitespace collapsed as a page
 * collapses it. What holds none is text already, and its line breaks are kept.
 * @param {string} html
 * @returns {string}
 */
export function htmlText(html) {
  const reference = /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;
  if (!new RegExp(TAG.source, 'i').test(html) && !html.includes('<!--')) return html.replace(/\r\n?/g, '\n').replace(reference, decoded).trim();
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|blockquote|section|article)\s*>/gi, '\n')
    .replace(TAG, '')
    .replace(reference, decoded)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// ── the rows ──────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   row: number, line: number, labels: string[], skipped: boolean,
 *   sku?: string, price?: number, weight?: number, on_sale?: boolean, stock?: number,
 *   final?: string, target?: any, conflict?: any,
 * }} SheetVariant
 * @typedef {{
 *   first: number, line: number, titles: Record<string, string>, descriptions: Record<string, string>,
 *   slug: string, given: boolean, wanted: string, bad: boolean,
 *   visible?: boolean, tracked?: boolean, size_class?: string, tax_code?: string, tariff_number?: string, made_in?: string,
 *   options: { name: string, nameColumn: string | undefined, column: string, values: string[] }[],
 *   variants: SheetVariant[], skipped: number[],
 *   leftOut: string[], describes: boolean,
 *   entry?: any,
 * }} SheetProduct
 */

/**
 * The sheet's products.
 *
 * @param {{ rows: Record<string, string>[], lines: number[] }} sheet
 * @param {ReturnType<typeof import('./mapping.mjs').readMapping>} mapping
 * @param {{ own: string, digits: number, currency: string, refuse: (where: string, why: string) => void, said: string[] }} site
 * @returns {SheetProduct[]} in the order of their first rows
 */
export function readSheet(sheet, mapping, { own, digits, currency, refuse, said }) {
  const F = mapping.fields;
  const { rows, lines } = sheet;
  const line = (i) => lines[i];
  const cell = (i, column) => (column === undefined ? '' : (rows[i][column] ?? '').trim());
  const at = (i, column) => `row ${line(i)}, column ${q(column)}`;
  const langOf = (one) => (one.locale === null ? own : one.locale);
  const ownTitle = F.title.find((one) => langOf(one) === own);

  // A row the mapping leaves out is no product, no variant and no parent.
  const left = new Set();
  if (mapping.skip !== undefined) {
    for (let i = 0; i < rows.length; i++) {
      if (!mapping.skip.values.includes(cell(i, mapping.skip.column).toLowerCase())) continue;
      left.add(i);
      said.push(`row ${line(i)} skipped: ${q(mapping.skip.column)} is ${q(cell(i, mapping.skip.column))}`);
    }
  }
  const active = rows.map((_, i) => i).filter((i) => !left.has(i));

  /** The rows that make one product each, the first of them the product's own. */
  function grouped() {
    const group = mapping.group;
    if (group === undefined) return active.map((i) => ({ rows: [i], parent: false }));
    if ('by' in group) {
      const byValue = new Map();
      const out = [];
      for (const i of active) {
        const value = cell(i, group.by);
        if (value === '') {
          refuse(at(i, group.by), 'is empty: the row belongs to no product');
          continue;
        }
        if (!byValue.has(value)) {
          const one = { rows: [], parent: false };
          byValue.set(value, one);
          out.push(one);
        }
        byValue.get(value).rows.push(i);
      }
      return out;
    }
    // A row that names its parent, by the value of another row in one of the columns: `id:20` is the row whose ID is 20.
    const index = new Map();
    for (const column of group.of) {
      for (let i = 0; i < rows.length; i++) {
        const value = cell(i, column);
        if (value !== '') index.set(value, [...new Set([...(index.get(value) ?? []), i])]);
      }
    }
    const children = new Map();
    const roots = [];
    for (const i of active) {
      const named = cell(i, group.parent);
      if (named === '') {
        roots.push(i);
        continue;
      }
      const hits = (index.get(named.replace(/^id:/i, '').trim()) ?? []).filter((one) => one !== i);
      if (hits.length === 0) {
        refuse(at(i, group.parent), `names ${q(named)}, which no row of the sheet has in ${andList(group.of.map(q)).replace(' and ', ' or ')}`);
        continue;
      }
      if (hits.length > 1) {
        refuse(at(i, group.parent), `names ${q(named)}, which rows ${andList(hits.map(line))} all have — it is not one product`);
        continue;
      }
      if (left.has(hits[0])) {
        refuse(at(i, group.parent), `names row ${line(hits[0])}, which the mapping's \`skip\` leaves out`);
        continue;
      }
      if (cell(hits[0], group.parent) !== '') {
        refuse(at(i, group.parent), `names row ${line(hits[0])}, which is itself a variant: a variant's parent is a product`);
        continue;
      }
      children.set(hits[0], [...(children.get(hits[0]) ?? []), i]);
    }
    return roots.map((root) => ({ rows: [root, ...(children.get(root) ?? [])], parent: true, children: children.has(root) }));
  }

  /**
   * One product as the sheet says it, every cell read, every fault refused.
   * @returns {SheetProduct}
   */
  function readProduct(group) {
    const first = group.rows[0];
    /** @type {SheetProduct} */
    const P = {
      first, line: line(first), titles: {}, descriptions: {}, options: [], variants: [], skipped: [], bad: false,
      slug: '', given: false, wanted: '', leftOut: [], describes: false,
    };
    const bad = (where, why) => {
      refuse(where, why);
      P.bad = true;
    };

    for (const [key, list, most] of [['titles', F.title, TITLE_MOST], ['descriptions', F.description, DESCRIPTION_MOST]]) {
      for (const one of list) {
        const raw = cell(first, one.column);
        const text = key === 'titles' ? raw : htmlText(raw);
        if (text === '') continue;
        if (count(text) > most) bad(at(first, one.column), `is ${thousands(count(text))} characters, and ${key === 'titles' ? 'a name' : 'a description'} is at most ${thousands(most)}`);
        else P[key][langOf(one)] = text;
      }
    }
    if (P.titles[own] === undefined && !P.bad) bad(at(first, ownTitle.column), 'is empty: a product needs its name');

    if (F.slug !== undefined && cell(first, F.slug) !== '') {
      const slug = cell(first, F.slug);
      if (count(slug) > SLUG_MOST || !SLUG.test(slug)) bad(at(first, F.slug), `${q(slug)} is not an address: lowercase letters, digits and single dashes, at most ${SLUG_MOST}`);
      else if (slug === SLUG_RESERVED) bad(at(first, F.slug), `${q(slug)} is not an address an entry may have: the folder beside an entry is the pictures a build fetches there`);
      else Object.assign(P, { slug, given: true });
    } else if (P.titles[own] !== undefined) {
      const slug = slugify(P.titles[own]);
      if (slug === '') bad(at(first, ownTitle.column), `${q(P.titles[own])} has no letter or digit an address can be made of — a \`slug\` column says it`);
      else P.slug = slug;
    }
    P.wanted = P.slug;

    for (const key of ['visible', 'tracked']) {
      if (F[key] === undefined) continue;
      const read = readSwitch(cell(first, F[key].column), F[key]);
      if (read === undefined) continue;
      if ('error' in read) bad(at(first, F[key].column), read.error);
      else P[key] = read.value;
    }
    if (F.size_class !== undefined && cell(first, F.size_class) !== '') {
      const size = cell(first, F.size_class).toLowerCase();
      if (SIZE_CLASSES.includes(size)) P.size_class = size;
      else bad(at(first, F.size_class), `${q(cell(first, F.size_class))} is not a shipping size: ${SIZE_CLASSES.join(', ')}`);
    }
    if (F.tax_code !== undefined && cell(first, F.tax_code) !== '') {
      if (TAX_CODE.test(cell(first, F.tax_code))) P.tax_code = cell(first, F.tax_code);
      else bad(at(first, F.tax_code), `${q(cell(first, F.tax_code))} is not one of Stripe's tax codes: txcd_ and eight digits — a product with another is sold in no variant`);
    }
    for (const key of ['tariff_number', 'made_in']) if (F[key] !== undefined && cell(first, F[key]) !== '') P[key] = cell(first, F[key]);

    // Which rows are variants: those with a price.
    const variantRows = [];
    const asChild = new Set(group.parent ? group.rows.slice(1) : []);
    for (const row of group.rows) {
      if (cell(row, F.price) !== '') {
        variantRows.push(row);
        continue;
      }
      if (group.parent && row === first && group.children) continue; // the parent row of variations
      const sku = F.sku === undefined ? '' : cell(row, F.sku);
      const valued = F.options.some((one) => cell(row, one.value) !== '' && !one.none.includes(cell(row, one.value)));
      if (asChild.has(row) || sku !== '' || valued) {
        bad(at(row, F.price), `is empty on a row that is a variant (${asChild.has(row) ? 'it names its parent' : sku !== '' ? `it has the SKU ${sku}` : 'it has an option value'}): a variant is sold at a price, or not at all`);
      } else if (row !== first) P.skipped.push(line(row));
    }
    if (variantRows.length === 0 && !P.bad) bad(at(first, F.price), `the product ${q(P.titles[own])} has no row with a price: there is nothing to sell`);
    const marker = mapping.group === undefined ? F.price : 'by' in mapping.group ? mapping.group.by : mapping.group.parent;
    if (variantRows.length > MOST_VARIANTS) bad(at(first, marker), `the product ${q(P.titles[own])} has ${thousands(variantRows.length)} variants, and a product has at most ${thousands(MOST_VARIANTS)}`);

    for (const row of variantRows) {
      const V = { row, line: line(row), labels: [], skipped: false };
      // A variation of a parent row is «same as parent» where its own cell is empty, as WooCommerce reads it.
      const inherits = group.parent && row !== first;
      const sku = F.sku === undefined ? '' : cell(row, F.sku);
      if (sku !== '') {
        if (SKU.test(sku)) V.sku = sku;
        else bad(at(row, F.sku), `${q(sku)} is not a SKU: a letter or a digit, then letters, digits, . _ -, 64 characters at most`);
      }
      const price = readAmount(cell(row, F.price), mapping.decimal, digits, currency);
      if ('error' in price) bad(at(row, F.price), price.error);
      else V.price = price.minor;
      if (F.weight !== undefined) {
        const mine = cell(row, F.weight.column);
        const text = mine !== '' || !inherits ? mine : cell(first, F.weight.column);
        if (text !== '') {
          const weight = readGrams(text, mapping.decimal, F.weight.unit);
          if ('error' in weight) bad(at(mine !== '' ? row : first, F.weight.column), weight.error);
          else V.weight = weight.grams;
        }
      }
      // The size class and the tax code are the product's, the parent row's: a variation's own cell is that or it is refused.
      if (inherits) {
        for (const key of ['size_class', 'tax_code']) {
          const text = F[key] === undefined ? '' : cell(row, F[key]);
          if (text !== '' && text.toLowerCase() !== (P[key] ?? '').toLowerCase()) {
            bad(at(row, F[key]), `${q(text)} is not the product's ${key === 'size_class' ? 'shipping size' : 'tax code'} (${P[key] === undefined ? 'its parent row has none' : q(P[key])}): a product has one, and a variation's empty cell is its parent row's`);
          }
        }
      }
      if (F.on_sale !== undefined) {
        const read = readSwitch(cell(row, F.on_sale.column), F.on_sale);
        if (read !== undefined && 'error' in read) bad(at(row, F.on_sale.column), read.error);
        else if (read !== undefined) V.on_sale = read.value;
      }
      if (F.stock !== undefined && cell(row, F.stock) !== '') {
        const read = readCount(cell(row, F.stock));
        if ('error' in read) bad(at(row, F.stock), read.error);
        else V.stock = read.count;
      }
      P.variants.push(V);
    }

    readOptions(P, group, variantRows, bad);

    // Two variants of one combination cannot be told apart by a buyer.
    const combos = new Map();
    for (const V of P.variants) {
      const key = JSON.stringify(V.labels);
      if (!combos.has(key)) {
        combos.set(key, V);
        continue;
      }
      const columns = P.options.length === 0 ? q(F.price) : andList(P.options.map((one) => q(one.column)));
      bad(`rows ${combos.get(key).line} and ${V.line}, column ${columns}`, P.options.length === 0
        ? `are two variants of the product ${q(P.titles[own])} with no option to tell them apart — \`fields.options\` names the columns that do`
        : `pick the same values (${V.labels.join(', ')}) of the product ${q(P.titles[own])}`);
    }
    return P;
  }

  /** The product's options, and which value of each every variant picks: by the name in the variant's own row, else by position. */
  function readOptions(P, group, variantRows, bad) {
    const first = P.first;
    const nameColumn = (one) => ('is' in one.name ? undefined : one.name.column);
    const declared = F.options.map((one) => ('is' in one.name ? one.name.is : cell(first, one.name.column)));

    // A simple product's attributes describe it: an option is an attribute its variations name.
    if (group.parent && !group.children) {
      P.describes = true;
      F.options.forEach((one, k) => {
        if (nameColumn(one) !== undefined && declared[k] !== '' && cell(first, one.value) !== '' && !one.none.includes(cell(first, one.value))) P.leftOut.push(declared[k]);
      });
      P.variants.forEach((V) => (V.labels = []));
      return;
    }

    /** One Map a variant: option name → its value, or `{ none }` where the cell is the word that says no value. */
    const picks = variantRows.map(() => new Map());
    F.options.forEach((one, k) => {
      variantRows.forEach((row, j) => {
        const text = cell(row, one.value);
        if (text === '') return;
        const named = nameColumn(one) === undefined ? one.name.is : cell(row, nameColumn(one));
        const target = named !== '' ? named : declared[k];
        if (target === '') {
          bad(at(row, one.value), `has ${q(text)}, and the product's first row (row ${P.line}) names no option in ${q(nameColumn(one))}`);
        } else if (!declared.includes(target)) {
          bad(at(row, nameColumn(one) ?? one.value), `names the option ${q(target)}, and the product's first row (row ${P.line}) names ${declared.filter((name) => name !== '').map(q).join(', ') || 'none'}: a variant picks among its product's options`);
        } else if (picks[j].has(target)) {
          bad(at(row, one.value), `gives the option ${q(target)} a second value, ${q(text)}`);
        } else picks[j].set(target, one.none.includes(text) ? { none: text } : text);
      });
    });

    const named = new Set();
    declared.forEach((name, k) => {
      if (name === '') return;
      const one = F.options[k];
      if (named.has(name)) {
        bad(nameColumn(one) === undefined ? 'fields.options' : at(first, nameColumn(one)), `the option ${q(name)} is named twice`);
        return;
      }
      named.add(name);
      const labels = picks.map((each) => each.get(name));
      if (!labels.some((label) => typeof label === 'string')) {
        // Named by the first row and valued by no variation: left out, and said — unless it is Shopify's word for no option.
        const nothing = labels.every((label) => label !== undefined && typeof label === 'object');
        if (nameColumn(one) !== undefined && !nothing) P.leftOut.push(name);
        return;
      }
      variantRows.forEach((row, j) => {
        if (typeof labels[j] === 'string') return;
        bad(at(row, one.value), labels[j] === undefined
          ? `has no value of the option ${q(name)}: a variant of a product with options picks one of each`
          : `says ${q(labels[j].none)}, which is no value of the option ${q(name)} — and the product's other variants have one`);
      });
      P.options.push({ name, nameColumn: nameColumn(one), column: one.value, values: [...new Set(labels.filter((label) => typeof label === 'string'))] });
    });
    P.variants.forEach((V, j) => {
      V.labels = P.options.map((one) => picks[j].get(one.name)).map((label) => (typeof label === 'string' ? label : ''));
    });
  }

  const list = grouped().map(readProduct);

  // A SKU is one variant's, in any case.
  if (F.sku !== undefined) {
    const where = new Map();
    for (const P of list) for (const V of P.variants) if (V.sku !== undefined) where.set(V.sku.toLowerCase(), [...(where.get(V.sku.toLowerCase()) ?? []), V]);
    for (const twice of where.values()) {
      if (twice.length > 1) refuse(`rows ${andList(twice.map((V) => V.line))}, column ${q(F.sku)}`, `the SKU ${twice[0].sku} is on ${twice.length === 2 ? 'both' : 'all'} (a SKU is one variant's, in any case)`);
    }
  }
  return list;
}

/**
 * What the sheet's rows of a product leave out, said once for the product.
 * @param {SheetProduct} P @param {string} slug
 * @returns {string[]}
 */
export function notesOf(P, slug) {
  const notes = [];
  if (P.leftOut.length > 0) {
    notes.push(P.describes
      ? `${slug}: row ${P.line} gives ${andList(P.leftOut.map(q))} as attributes, which describe a product with no variations and are no options (an option is an attribute its variations name): left out`
      : `${slug}: ${andList(P.leftOut.map(q))}, named on row ${P.line}, ${P.leftOut.length === 1 ? 'is' : 'are'} valued by no variation: left out of the options`);
  }
  if (P.skipped.length > 0) {
    notes.push(`${slug}: row${P.skipped.length === 1 ? '' : 's'} ${andList(P.skipped)} carr${P.skipped.length === 1 ? 'ies' : 'y'} no price, SKU or option value, so adds no variant: skipped`);
  }
  return notes;
}
