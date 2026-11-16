/**
 * What `jtk import products` makes of a sheet: its products, made or matched
 * against what the site's files hold, and every file that changes — and
 * nothing written. The caller (`lib/import.mjs`) writes what this plans, and
 * only when it has refused nothing: an import that writes wrong data into a
 * business's catalogue is worse than one that writes none, so every fault the
 * sheet has is found first, each naming its row (the line of the sheet) and its
 * column, and the tree is as it was.
 *
 * ── what a product is ───────────────────────────────────────────────────────
 *
 * Its first row's fields — the name, the words, the switches, the size class,
 * the tax code, the customs fields, and the option names — and a variant for
 * each of its rows that has a price. A parent row that has none, and a row that
 * only adds a picture, are not variants; a row that has a SKU or an option value
 * and no price is, and is refused, since a variant is sold at a price or not at
 * all. How the rows make products is the mapping's `group`.
 *
 * ── what it keeps, on the first import and the second (wiki/102 stage 9, decision 9, Ruling 191)
 *
 * The business's SKUs are kept, and the missing ones made as the platform makes
 * them (`skuBase`, `freeSku`); the keys of options and values come from their
 * names (`keyOf`); a variant's `_key` is the first `v<n>` not taken. A second
 * import matches by SKU. A sheet variant whose SKU a variant of the collection
 * holds is that variant; one with none is matched by the product's slug and its
 * picks; a sheet product whose variants match one entry is that entry, and one
 * matching two is refused. What matches takes the sheet's numbers and switches
 * — prices, weights, `on_sale`, `visible`, `tracked`, the size class, the tax
 * code, the customs fields — and keeps the `id`, every `_key`, the `rank` and
 * every variant the sheet does not name. Words the entry holds are kept and the
 * difference said, unless `words` — an owner's rename in the panel is not undone
 * by a sheet. A cell the sheet leaves empty erases nothing. A SKU the sheet
 * gives a variant that holds another is said and skipped: an import changes no SKU.
 * A product the sheet does not name is not read again, let alone written.
 *
 * The stock is never in the site's files: it is the lines of `stock`, for `set_stock`.
 */
import { isDeepStrictEqual } from 'node:util';
import { basename } from 'node:path';
import { uuid7 } from '@jtakeit/kit/content/identity';
import { digitsOf } from '@jtakeit/kit/money';
import { freeSku, keyOf, skuBase, skuKey } from '@jtakeit/kit/shop/skus';
import { rankBetween } from '@jtakeit/kit/upgrade';
import { readAmount, readCount, readGrams, readSwitch } from './mapping.mjs';

/** The most variants a product has (wiki/101 §5.4). */
export const MOST_VARIANTS = 2000;
/** The most lines `set_stock` takes in a call, and so the most a stock file holds. */
export const STOCK_LINES = 5000;
/** The first stock file; the next is `stock-2.txt`. */
export const STOCK_FILE = '.jtakeit/stock.txt';
/** What `.gitignore` is made to say: every stock file. */
export const STOCK_IGNORE = '.jtakeit/stock*.txt';

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MOST = 80;
/** No entry may be named so: the folder beside a document is the pictures a build fetches there. */
const SLUG_RESERVED = 'media';
const TAX_CODE = /^txcd_[0-9]{8}$/;
const SIZE_CLASSES = ['letter', 'parcel', 'bulky'];
const TITLE_MOST = 120;
const DESCRIPTION_MOST = 4000;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const listOf = (value) => (Array.isArray(value) ? value : []);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const q = (text) => `«${text}»`;
const count = (text) => [...text].length;
const thousands = (n) => n.toLocaleString('en-US');
/** `3`, `3 and 7`, `3, 7 and 9`. */
const andList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
/** A word or two of a longer text, on one line. */
const clip = (text) => {
  const one = String(text).replace(/\s*\n\s*/g, ' / ');
  return count(one) > 80 ? `${[...one].slice(0, 77).join('')}…` : one;
};
const shown = (value) => (value === undefined ? 'none' : typeof value === 'string' ? q(clip(value)) : String(value));

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

/**
 * A description made text: what holds HTML — Shopify's `Body (HTML)`,
 * WooCommerce's `Description` — has its tags out, a paragraph or a `<br>` a line
 * break, its whitespace collapsed as a page collapses it and its entities read.
 * What holds no tag is text already and is kept as it is, its line breaks too.
 * @param {string} html
 * @returns {string}
 */
export function htmlText(html) {
  if (!/<\/?[a-zA-Z][^>]*>|<!--/.test(html)) return html.replace(/\r\n?/g, '\n').trim();
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|blockquote|section|article)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, decoded)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** An address from a name: lowercase letters and digits and single dashes, accents off, at most 80. */
export function slugOf(text) {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, SLUG_MOST).replace(/-+$/, '');
}

// ── the plan ──────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   slug: string, id: string, action: 'made' | 'updated' | 'left', line: number, variants: number,
 *   made: { key: string, sku: string }[], changes: string[], kept: string[],
 * }} Planned
 */

/**
 * The sheet's products, made or matched against what the site's files hold, and
 * every file that changes — nothing written.
 *
 * @param {ReturnType<typeof import('../units/index.mjs').treeOf>} tree the site's files
 * @param {{ header: string[], rows: Record<string, string>[], lines: number[] }} sheet
 * @param {ReturnType<typeof import('./mapping.mjs').readMapping>} mapping
 * @param {{ currency: string, words?: boolean }} options `currency`: the site's, three letters; `words`: take the sheet's words over the entry's
 * @returns {{
 *   products: Planned[],
 *   writes: Map<string, string | null>,
 *   said: string[],
 *   refused: string[],
 *   stock: string[],
 * }} `writes` holds every file that changes by its path (`null` a file to delete), and is empty where anything is refused;
 *   `said` what is told without refusing; `stock` the lines of `set_stock`'s text, in the sheet's order
 */
export function planImport(tree, sheet, mapping, { currency, words = false }) {
  const F = mapping.fields;
  /** @type {string[]} */ const refused = [];
  /** @type {string[]} */ const said = [];
  /** @type {Planned[]} */ const products = [];
  /** @type {Map<string, string | null>} */ const writes = new Map();
  /** @type {string[]} */ const stock = [];
  const finish = () => ({ products, writes: refused.length > 0 ? new Map() : writes, said, refused, stock: refused.length > 0 ? [] : stock });
  const refuse = (where, why) => void refused.push(`${where}: ${why}`);

  // ── what the site says about itself ─────────────────────────────────────
  const schema = tree.json('jtk/schema.json') ?? {};
  const own = typeof schema.locale === 'string' ? schema.locale : '';
  const others = listOf(schema.locales).filter((one) => typeof one === 'string');
  const collection = mapping.collection ?? schema.modules?.shop?.products;
  if (typeof collection !== 'string' || collection === '') {
    refuse('the site', 'has no shop: jtk/schema.json says no `modules.shop.products` — `jtk add shop` and `jtk schema` first, or `"collection"` in the mapping says where the products go');
    return finish();
  }
  if (!listOf(schema.collections).some((one) => one?.name === collection)) {
    refuse('the site', `has no collection ${q(collection)} in jtk/schema.json (its collections: ${listOf(schema.collections).map((one) => one?.name).join(', ')})`);
    return finish();
  }
  const languages = [own, ...others];
  const langOf = (one) => (one.locale === null ? own : one.locale);
  for (const [key, list] of [['title', F.title], ['description', F.description]]) {
    for (const one of list) {
      if (!languages.includes(langOf(one))) refuse(`fields.${key}`, `names the language ${q(one.locale)}, and the site has ${andList(languages.map(q))}`);
    }
  }
  const ownTitle = F.title.find((one) => langOf(one) === own);
  if (ownTitle === undefined) {
    refuse('fields.title', `has no column for the site's own language ${q(own)}: a product's name is required in it`);
    return finish();
  }
  const digits = digitsOf(currency);

  // ── what the collection holds ───────────────────────────────────────────
  const dir = `jtk/entries/${collection}`;
  /** @type {{ file: string, doc: any, slug: string }[]} */ const held = [];
  /** @type {Map<string, Map<string, { file: string, doc: any }>>} */ const translations = new Map();
  for (const file of tree.under(dir)) {
    // An entry is `<collection>/<slug>.json` and nothing deeper (a `media/` folder is no entry's).
    if (!file.endsWith('.json') || file.slice(dir.length + 1).includes('/')) continue;
    let doc;
    try {
      doc = tree.json(file);
    } catch (why) {
      refuse(file, `is not JSON (${why instanceof Error ? why.message : why})`);
      continue;
    }
    if (!isObject(doc)) {
      refuse(file, 'is not an object');
      continue;
    }
    if (typeof doc.of === 'string') {
      if (!translations.has(doc.of)) translations.set(doc.of, new Map());
      if (typeof doc.locale === 'string') translations.get(doc.of).set(doc.locale, { file, doc });
    } else held.push({ file, doc, slug: typeof doc.slug === 'string' && doc.slug !== '' ? doc.slug : basename(file, '.json') });
  }
  if (refused.length > 0) return finish();
  const bySlug = new Map(held.map((one) => [one.slug, one]));
  /** @type {Map<string, { entry: typeof held[number], variant: any }>} */ const skuIndex = new Map();
  for (const entry of held) {
    for (const variant of listOf(entry.doc.fields?.variants)) {
      if (isObject(variant) && typeof variant.sku === 'string' && variant.sku !== '') skuIndex.set(skuKey(variant.sku), { entry, variant });
    }
  }
  /** Every SKU of the collection and of the sheet, by `skuKey`: what a made SKU may not be. */
  const taken = new Set(skuIndex.keys());
  let lastRank = held.map((one) => one.doc.rank).filter((rank) => typeof rank === 'string').sort().at(-1) ?? '';

  // ── the sheet's rows, into products ─────────────────────────────────────
  const { rows, lines } = sheet;
  const line = (i) => lines[i];
  const cell = (i, column) => (column === undefined ? '' : (rows[i][column] ?? '').trim());
  const at = (i, column) => `row ${line(i)}, column ${q(column)}`;

  /** The rows that make one product each, the first of them the product's own. */
  function grouped() {
    const group = mapping.group;
    if (group === undefined) return rows.map((_, i) => ({ rows: [i], parent: false }));
    if ('by' in group) {
      const byValue = new Map();
      const out = [];
      for (let i = 0; i < rows.length; i++) {
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
    for (let i = 0; i < rows.length; i++) {
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
   * @returns {any}
   */
  function readProduct(group) {
    const first = group.rows[0];
    const P = {
      first, line: line(first), titles: {}, descriptions: {}, options: [], variants: [], skipped: [], bad: false,
      slug: '', given: false, wanted: '', entry: undefined,
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
      const slug = slugOf(P.titles[own]);
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
    const names = F.options.map((one) => ('is' in one.name ? one.name.is : cell(first, one.name.column)));
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
      const sku = F.sku === undefined ? '' : cell(row, F.sku);
      if (sku !== '') {
        if (SKU.test(sku)) V.sku = sku;
        else bad(at(row, F.sku), `${q(sku)} is not a SKU: a letter or a digit, then letters, digits, . _ -, 64 characters at most`);
      }
      const price = readAmount(cell(row, F.price), mapping.decimal, digits, currency);
      if ('error' in price) bad(at(row, F.price), price.error);
      else V.price = price.minor;
      if (F.weight !== undefined && cell(row, F.weight.column) !== '') {
        const weight = readGrams(cell(row, F.weight.column), mapping.decimal, F.weight.unit);
        if ('error' in weight) bad(at(row, F.weight.column), weight.error);
        else V.weight = weight.grams;
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

    // The options: named by the first row, a value on every variant.
    /** @type {{ name: string, column: string, values: string[], labels: (string | null | undefined)[] }[]} */
    const kept = [];
    F.options.forEach((one, k) => {
      const name = names[k];
      const nameColumn = 'is' in one.name ? undefined : one.name.column;
      // undefined: empty; null: the word that says the variant has no value (Shopify's «Default Title»); else the label
      const seen = variantRows.map((row) => {
        const text = cell(row, one.value);
        return text === '' ? undefined : one.none.includes(text) ? null : text;
      });
      if (name === '') {
        variantRows.forEach((row, j) => {
          if (typeof seen[j] === 'string') bad(at(row, one.value), `has ${q(seen[j])}, and the product's first row (row ${P.line}) names no option in ${q(nameColumn)}`);
        });
        return;
      }
      if (!seen.some((label) => typeof label === 'string')) {
        // An option the first row names and no variant has a value of is left out, and said; one the mapping names by itself (`is`) is the mapping's for every product, most of which have none.
        if (nameColumn !== undefined && seen.some((label) => label === undefined)) P.dropped = [...(P.dropped ?? []), `the option ${q(name)} has no value on any variant`];
        return;
      }
      variantRows.forEach((row, j) => {
        if (typeof seen[j] !== 'string') bad(at(row, one.value), `has no value of the option ${q(name)}: a variant of a product with options picks one of each`);
      });
      if (kept.some((each) => each.name === name)) bad(nameColumn === undefined ? 'fields.options' : at(first, nameColumn), `the option ${q(name)} is named twice`);
      kept.push({ name, column: one.value, values: [...new Set(seen.filter((label) => typeof label === 'string'))], labels: seen });
    });
    P.options = kept;
    P.variants.forEach((V, j) => {
      V.labels = kept.map((each) => each.labels[j]);
    });

    // Two variants of one combination cannot be told apart by a buyer.
    const combos = new Map();
    for (const V of P.variants) {
      const key = JSON.stringify(V.labels);
      if (combos.has(key)) {
        const other = combos.get(key);
        bad(`rows ${other.line} and ${V.line}`, kept.length === 0
          ? `are two variants of the product ${q(P.titles[own])} with no option to tell them apart — \`fields.options\` names the columns that do`
          : `pick the same values (${V.labels.join(', ')}) of the product ${q(P.titles[own])}`);
      } else combos.set(key, V);
    }
    return P;
  }

  const list = grouped().map(readProduct);

  // A SKU is one variant's, in any case.
  if (F.sku !== undefined) {
    const where = new Map();
    for (const P of list) for (const V of P.variants) if (V.sku !== undefined) where.set(skuKey(V.sku), [...(where.get(skuKey(V.sku)) ?? []), V]);
    for (const twice of where.values()) {
      if (twice.length > 1) refuse(`rows ${andList(twice.map((V) => V.line))}, column ${q(F.sku)}`, `the SKU ${twice[0].sku} is on ${twice.length === 2 ? 'both' : 'all'} (a SKU is one variant's, in any case)`);
    }
  }
  if (refused.length > 0) return finish();

  // ── what the collection already has of them ─────────────────────────────
  const optionOf = (options, name) => options.find((one) => one.name === name) ?? options.find((one) => one._key === keyOf(name, new Set(), 'o'));
  const valueOf = (option, label) => listOf(option.values).find((one) => one.label === label) ?? listOf(option.values).find((one) => one._key === keyOf(label, new Set(), 'v'));
  /** The picks a sheet variant makes of an entry's options, or undefined where one of its options or values is not the entry's. */
  function picksIn(entry, P, V) {
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
  const picksOfRow = (row) => (isObject(row.picks) ? row.picks : {});

  const claimed = new Map();
  for (const P of list) {
    /** @type {Map<typeof held[number], any[]>} */ const hits = new Map();
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
    // A SKU the collection does not hold, for the picks of a variant that holds another: the product is the entry the
    // other variants say it is, or — where none does — the entry at the address the sheet gives it. An address made
    // from a name is no identity: a second Kerze with SKUs of its own is another product.
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
  if (refused.length > 0) return finish();

  // A new product's address: the sheet's, which is the sheet's to give; or one made from its name, numbered where taken.
  const reserved = new Set([SLUG_RESERVED, ...bySlug.keys(), ...list.filter((P) => P.given).map((P) => P.slug)]);
  const given = new Map();
  for (const P of list.filter((one) => one.entry === undefined)) {
    if (P.given) {
      if (bySlug.has(P.slug)) refuse(at(P.first, F.slug), `${q(P.slug)} is the address of ${bySlug.get(P.slug).file}, whose SKUs are none of this product's — nothing is made over it: a variant it holds names it, or the product is given another address`);
      else if (given.has(P.slug)) refuse(`rows ${given.get(P.slug).line} and ${P.line}, column ${q(F.slug)}`, `${q(P.slug)} is the address of two products`);
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
  if (refused.length > 0) return finish();

  // Every SKU of the sheet is taken before any is made.
  for (const P of list) for (const V of P.variants) if (V.sku !== undefined) taken.add(skuKey(V.sku));

  const nextKey = (keys) => {
    for (let n = 1; ; n++) {
      if (!keys.has(`v${n}`)) {
        keys.add(`v${n}`);
        return `v${n}`;
      }
    }
  };
  const translated = (P) => Object.keys({ ...P.titles, ...P.descriptions }).filter((lang) => lang !== own);

  // ── made ────────────────────────────────────────────────────────────────
  function make(P) {
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
      const sku = V.sku ?? freeSku(skuBase(P.slug, valueKeys), taken);
      if (V.sku === undefined) made.push({ key, sku });
      V.final = sku;
      return {
        _key: key,
        sku,
        price: { minor: V.price },
        ...(V.weight === undefined ? {} : { weight: V.weight }),
        ...(options.length === 0 ? {} : { picks }),
        ...(V.on_sale === undefined ? {} : { on_sale: V.on_sale }),
      };
    });
    lastRank = rankBetween(lastRank, '');
    const doc = {
      id: uuid7(),
      collection,
      slug: P.slug,
      rank: lastRank,
      visible: P.visible ?? true,
      fields: {
        title: P.titles[own],
        ...(P.descriptions[own] === undefined ? {} : { description: P.descriptions[own] }),
        ...(options.length === 0 ? {} : { options }),
        variants,
        ...(P.tracked === undefined ? {} : { tracked: P.tracked }),
        ...(P.size_class === undefined ? {} : { size_class: P.size_class }),
        ...(P.tax_code === undefined ? {} : { tax_code: P.tax_code }),
        ...(P.tariff_number === undefined ? {} : { tariff_number: P.tariff_number }),
        ...(P.made_in === undefined ? {} : { made_in: P.made_in }),
      },
    };
    writes.set(`${dir}/${P.slug}.json`, json(doc));
    for (const lang of translated(P)) {
      const fields = {
        ...(P.titles[lang] === undefined ? {} : { title: P.titles[lang] }),
        ...(P.descriptions[lang] === undefined ? {} : { description: P.descriptions[lang] }),
      };
      writes.set(`${dir}/${P.slug}.${lang}.json`, json({ of: doc.id, locale: lang, fields }));
    }
    for (const note of P.dropped ?? []) said.push(`${P.slug}: ${note}: left out`);
    if (P.skipped.length > 0) said.push(`${P.slug}: row${P.skipped.length === 1 ? '' : 's'} ${andList(P.skipped)} carr${P.skipped.length === 1 ? 'ies' : 'y'} no price, SKU or option value, so adds no variant: skipped`);
    products.push({ slug: P.slug, id: doc.id, action: 'made', line: P.line, variants: variants.length, made, changes: [], kept: [] });
  }

  // ── updated, or left ────────────────────────────────────────────────────
  function update(P) {
    const { entry } = P;
    const slug = entry.slug;
    const doc = structuredClone(entry.doc);
    if (typeof doc.id !== 'string' || !isObject(doc.fields)) {
      refuse(entry.file, `has ${typeof doc.id !== 'string' ? 'no id (\`jtk schema\` mints it)' : 'no fields'}, so the sheet cannot be laid over it`);
      return;
    }
    const fields = doc.fields;
    if (fields.variants !== undefined && !Array.isArray(fields.variants)) {
      refuse(entry.file, '`variants` is not a list');
      return;
    }
    /** @type {string[]} */ const changes = [];
    /** @type {string[]} */ const kept = [];
    const made = [];
    let touched = false;

    /** Words: kept where the entry holds some that differ, unless `words`; filled where it holds none. */
    const word = (what, before, sheetWords, apply) => {
      if (sheetWords === undefined || sheetWords === before) return false;
      if (typeof before !== 'string' || before.trim() === '') {
        changes.push(`${slug}: ${what} ${shown(before)} → ${shown(sheetWords)}`);
        apply();
        return true;
      }
      if (words) {
        changes.push(`${slug}: ${what} ${shown(before)} → ${shown(sheetWords)}`);
        apply();
        return true;
      }
      kept.push(`${slug}: ${what} kept ${shown(before)}, the sheet says ${shown(sheetWords)} (--words takes the sheet's)`);
      return false;
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

    const originals = listOf(entry.doc.fields?.variants);
    const variants = fields.variants ?? (fields.variants = []);
    const keys = new Set(variants.map((one) => one?._key));
    for (const V of P.variants) {
      if (V.conflict !== undefined) {
        V.skipped = true;
        const held = V.conflict.variant.sku;
        said.push(`row ${V.line}: the sheet's SKU ${V.sku} is not ${held}, which ${slug} holds for the same picks (${P.options.map((one, j) => `${one.name} ${V.labels[j]}`).join(', ') || 'none'}) — an import changes no SKU, so the row is skipped`);
        continue;
      }
      if (V.target !== undefined) {
        const row = variants[originals.indexOf(V.target.variant)];
        const held = isObject(row.price) ? row.price.minor : undefined;
        number(`${row._key} price`, held, V.price, () => (row.price = { minor: V.price }));
        number(`${row._key} weight`, row.weight, V.weight, () => (row.weight = V.weight));
        // Without `on_sale`, on sale: a sheet that says on sale changes nothing there.
        number(`${row._key} on_sale`, typeof row.on_sale === 'boolean' ? row.on_sale : true, V.on_sale, () => (row.on_sale = V.on_sale));
        V.final = row.sku;
        if (V.sku !== undefined && P.options.length > 0 && entry.doc.fields !== undefined) {
          const picks = picksIn(entry, P, V);
          if (picks !== undefined && !isDeepStrictEqual(picksOfRow(V.target.variant), picks)) {
            said.push(`row ${V.line}: ${V.sku} is ${P.options.map((one, j) => `${one.name} ${V.labels[j]}`).join(', ')} in the sheet and another combination in ${slug} — its picks are kept`);
          }
        }
        continue;
      }
      // A variant the sheet adds: it must pick a value of each of the entry's options, and nothing the entry has not.
      let why;
      let column = P.options[0]?.column ?? F.price;
      P.options.forEach((one, j) => {
        if (matched[j] !== undefined || why !== undefined) return;
        why = `the option ${q(one.name)} is none of ${slug}'s: the options of a product are the owner's to change in the panel, since each of its variants picks a value of each`;
        column = one.column;
      });
      for (const option of options) if (!matched.includes(option)) why ??= `picks no value of ${slug}'s option ${q(option.name)}`;
      if (why === undefined && variants.length >= MOST_VARIANTS) why = `would make ${slug} ${thousands(variants.length + 1)} variants, and a product has at most ${thousands(MOST_VARIANTS)}`;
      if (why !== undefined) {
        refuse(at(V.row, column), why);
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
      variants.push({
        _key: key,
        sku,
        price: { minor: V.price },
        ...(V.weight === undefined ? {} : { weight: V.weight }),
        ...(options.length === 0 ? {} : { picks }),
        ...(V.on_sale === undefined ? {} : { on_sale: V.on_sale }),
      });
      changes.push(`${slug}: ${key} added, ${sku} at ${V.price}`);
    }

    number('visible', doc.visible, P.visible, () => (doc.visible = P.visible));
    number('tracked', typeof fields.tracked === 'boolean' ? fields.tracked : true, P.tracked, () => (fields.tracked = P.tracked));
    number('size_class', typeof fields.size_class === 'string' ? fields.size_class : 'parcel', P.size_class, () => (fields.size_class = P.size_class));
    for (const key of ['tax_code', 'tariff_number', 'made_in']) number(key, typeof fields[key] === 'string' ? fields[key] : undefined, P[key], () => (fields[key] = P[key]));

    // The other languages: laid over the original, the words in them kept like the original's.
    for (const lang of translated(P)) {
      const there = translations.get(doc.id)?.get(lang);
      if (there === undefined) {
        const translation = {
          ...(P.titles[lang] === undefined ? {} : { title: P.titles[lang] }),
          ...(P.descriptions[lang] === undefined ? {} : { description: P.descriptions[lang] }),
        };
        writes.set(`${dir}/${slug}.${lang}.json`, json({ of: doc.id, locale: lang, fields: translation }));
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
    for (const note of P.dropped ?? []) said.push(`${slug}: ${note}: left out`);
    if (P.skipped.length > 0) said.push(`${slug}: row${P.skipped.length === 1 ? '' : 's'} ${andList(P.skipped)} carr${P.skipped.length === 1 ? 'ies' : 'y'} no price, SKU or option value, so adds no variant: skipped`);
    said.push(...kept);
    products.push({ slug, id: doc.id, action: touched ? 'updated' : 'left', line: P.line, variants: variants.length, made, changes, kept });
  }

  for (const P of list) (P.entry === undefined ? make(P) : update(P));
  if (refused.length > 0) return finish();

  // ── the stock: a file for `set_stock`, never a field of the site ─────────
  for (const P of list) {
    for (const V of P.variants) if (V.stock !== undefined && !V.skipped && V.final !== undefined) stock.push(`${V.final} ${V.stock}`);
  }
  if (F.stock !== undefined && stock.length > 0) {
    const files = Math.ceil(stock.length / STOCK_LINES);
    for (let n = 1; n <= files; n++) {
      writes.set(n === 1 ? STOCK_FILE : `.jtakeit/stock-${n}.txt`, `${stock.slice((n - 1) * STOCK_LINES, n * STOCK_LINES).join('\n')}\n`);
    }
    // A file of an earlier import's that this one has no lines for would be taken for this one's by whoever runs set_stock.
    for (const file of tree.under('.jtakeit')) {
      const number = /^\.jtakeit\/stock-(\d+)\.txt$/.exec(file);
      if (number !== null && Number(number[1]) > files) writes.set(file, null);
    }
    const ignore = tree.read('.gitignore') ?? '';
    if (!ignore.split('\n').some((one) => one.trim() === STOCK_IGNORE)) {
      writes.set('.gitignore', `${ignore}${ignore === '' || ignore.endsWith('\n') ? '' : '\n'}\n# The starting stock \`jtk import products\` writes for set_stock: the shop's ledger holds stock by SKU,\n# never a file of the site, and a count committed here is a stale one.\n${STOCK_IGNORE}\n`);
    }
  }
  return finish();
}
