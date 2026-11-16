/**
 * What `jtk import products` makes of a sheet: its products, made or matched
 * against what the site's files hold, and every file that changes — and
 * nothing written. The caller (`lib/import.mjs`) writes what this plans, and
 * only when it has refused nothing: an import that writes wrong data into a
 * business's catalogue is worse than one that writes none, so every fault the
 * sheet has is found first, each naming its row (the line of the sheet) and its
 * column, and the tree is as it was.
 *
 * The plan is four parts, each its own file:
 *
 *   sheet.mjs    the sheet's products, as the sheet says them (every cell read)
 *   match.mjs    which of them the collection already has, and the new ones' addresses
 *   entries.mjs  the files a product comes to: made, or laid over what is there
 *   this file    what the site says, what the collection holds, the order of the
 *                parts, and the stock — a file for `set_stock`, never a field of the site
 *
 * What it keeps, on the first import and the second (wiki/102 stage 9, decision 9, Ruling 191):
 * the business's SKUs, and the missing ones made as the platform makes them; the
 * keys of options and values from their names; on a second import a match by
 * SKU that takes the sheet's numbers and keeps the `id`, the `_key`s, the `rank`,
 * the owner's words and every variant the sheet does not name. A product the
 * sheet does not name is not read again, let alone written.
 */
import { basename } from 'node:path';
import { digitsOf } from '@jtakeit/kit/money';
import { skuKey } from '@jtakeit/kit/shop/skus';
import { makeEntry, updateEntry } from './entries.mjs';
import { matchProducts } from './match.mjs';
import { FOLDER } from './pictures.mjs';
import { readSheet } from './sheet.mjs';
import { andList, isObject, listOf, q } from './util.mjs';

/** The most lines `set_stock` takes in a call, and so the most a stock file holds. */
export const STOCK_LINES = 5000;
/** The first stock file; the next is `stock-2.txt`. */
export const STOCK_FILE = '.jtakeit/stock.txt';
/** What `.gitignore` is made to say: every stock file. */
export const STOCK_IGNORE = '.jtakeit/stock*.txt';
const STOCK_FILES = /^\.jtakeit\/stock(-\d+)?\.txt$/;
/** What `.gitignore` is made to say of the pictures that were fetched: their folder, which a picture never leaves for git. */
export const PICTURES_IGNORE = `${FOLDER}/`;

/** A line `.gitignore` is made to say, once, with its reason above it; `writes` may hold this plan's earlier change to the file. */
function ignoring(tree, writes, line, reason) {
  const text = writes.get('.gitignore') ?? tree.read('.gitignore') ?? '';
  if (text.split('\n').some((one) => one.trim() === line)) return;
  const lead = text === '' ? '' : `${text.endsWith('\n') ? '' : '\n'}\n`;
  writes.set('.gitignore', `${text}${lead}${reason}\n${line}\n`);
}

/**
 * The pictures' folder in `.gitignore`, into `writes`, unless the file says it already. It is no part of the plan: the caller
 * writes it before the first picture is fetched to the disk, so that a picture is never a file git would take.
 * @param {ReturnType<typeof import('../units/index.mjs').treeOf>} tree @param {Map<string, string | null>} writes
 */
export function ignorePictures(tree, writes) {
  ignoring(tree, writes, PICTURES_IGNORE, '# The pictures `jtk import products` fetched, as files of this machine: `jtk media push` (the import\'s --media) sends them to the\n# site\'s media library, writes the library\'s key in their place and moves the files out of here. A picture never reaches git.');
}

/**
 * The sheet's products, made or matched against what the site's files hold, and
 * every file that changes — nothing written.
 *
 * @param {ReturnType<typeof import('../units/index.mjs').treeOf>} tree the site's files
 * @param {{ header: string[], rows: Record<string, string>[], lines: number[] }} sheet
 * @param {ReturnType<typeof import('./mapping.mjs').readMapping>} mapping
 * @param {{ currency: string, words?: boolean, pictures?: Map<string, string[]> }} options `currency`: the site's, three letters; `words`: take the sheet's words over the entry's;
 *   `pictures`: the slots of the pictures that were fetched, by slug — what the first plan, without them, said was to be fetched (`products[].pictures`)
 * @returns {{
 *   collection: string | undefined,
 *   products: import('./entries.mjs').Planned[],
 *   writes: Map<string, string | null>,
 *   said: string[],
 *   refused: string[],
 *   stock: string[],
 * }} `collection` the products' collection; `writes` holds every file that changes by its path (`null` a file to delete), and is empty where anything is refused;
 *   `said` what is told without refusing; `stock` the lines of `set_stock`'s text, in the sheet's order
 */
export function planImport(tree, sheet, mapping, { currency, words = false, pictures }) {
  const F = mapping.fields;
  /** @type {string[]} */ const refused = [];
  /** @type {string[]} */ const said = [];
  /** @type {import('./entries.mjs').Planned[]} */ const products = [];
  /** @type {Map<string, string | null>} */ const writes = new Map();
  /** @type {string[]} */ const stock = [];
  /** @type {string | undefined} */ let collection;
  const finish = () => ({ collection, products, writes: refused.length > 0 ? new Map() : writes, said, refused, stock: refused.length > 0 ? [] : stock });
  const refuse = (where, why) => void refused.push(`${where}: ${why}`);

  // ── what the site says about itself ─────────────────────────────────────
  const schema = tree.json('jtk/schema.json') ?? {};
  const own = typeof schema.locale === 'string' ? schema.locale : '';
  const others = listOf(schema.locales).filter((one) => typeof one === 'string');
  collection = mapping.collection ?? schema.modules?.shop?.products;
  if (typeof collection !== 'string' || collection === '') {
    refuse('the site', 'has no products collection: jtk/schema.json says no `modules.shop.products`. `jtk schema` writes it from the declaration (it says it once `jtk add shop` has run) — `jtk add shop` first if it has not; or `"collection"` in the mapping says where the products go');
    return finish();
  }
  if (!listOf(schema.collections).some((one) => one?.name === collection)) {
    refuse('the site', `has no collection ${q(collection)} in jtk/schema.json (its collections: ${listOf(schema.collections).map((one) => one?.name).join(', ')}) — \`jtk schema\` writes the declaration's, and the mapping's \`"collection"\` names one of them`);
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

  // ── the parts, in order ─────────────────────────────────────────────────
  const list = readSheet(sheet, mapping, { own, digits: digitsOf(currency), currency, refuse, said });
  if (refused.length > 0) return finish();
  matchProducts(list, { held, bySlug, skuIndex }, { refuse, own, slugColumn: F.slug });
  if (refused.length > 0) return finish();

  /** Every SKU of the collection and of the sheet, by `skuKey`: what a made SKU may not be. */
  const taken = new Set(skuIndex.keys());
  for (const P of list) for (const V of P.variants) if (V.sku !== undefined) taken.add(skuKey(V.sku));
  const ctx = {
    own, collection, dir, words, priceColumn: F.price, titleColumn: ownTitle.column, refuse, said, writes, taken, translations, pictures,
    lastRank: held.map((one) => one.doc.rank).filter((rank) => typeof rank === 'string').sort().at(-1) ?? '',
  };
  for (const P of list) {
    const planned = P.entry === undefined ? makeEntry(P, ctx) : updateEntry(P, ctx);
    if (planned !== undefined) products.push(planned);
  }
  if (refused.length > 0) return finish();

  // ── the stock: a file for `set_stock`, never a field of the site ─────────
  for (const P of list) {
    for (const V of P.variants) if (V.stock !== undefined && !V.skipped && V.final !== undefined) stock.push(`${V.final} ${V.stock}`);
  }
  const numberOf = (file) => Number(/-(\d+)\.txt$/.exec(file)?.[1] ?? 1);
  const earlier = tree.under('.jtakeit').filter((file) => STOCK_FILES.test(file)).sort((a, b) => numberOf(a) - numberOf(b));
  if (F.stock === undefined) {
    // Not this sheet's: said, since whoever runs set_stock next would take it for this one's.
    if (earlier.length > 0) said.push(`${andList(earlier)} ${earlier.length === 1 ? 'is' : 'are'} an earlier import's, and the mapping names no \`stock\` column: ${earlier.length === 1 ? 'it holds' : 'they hold'} that sheet's counts, not this one's`);
    return finish();
  }
  // The stock files are this import's, replaced whole: one of an earlier import that this one has no lines for is taken away.
  const files = Math.ceil(stock.length / STOCK_LINES);
  const names = Array.from({ length: files }, (_, at) => (at === 0 ? STOCK_FILE : `.jtakeit/stock-${at + 1}.txt`));
  names.forEach((name, at) => writes.set(name, `${stock.slice(at * STOCK_LINES, (at + 1) * STOCK_LINES).join('\n')}\n`));
  for (const file of earlier) if (!names.includes(file)) writes.set(file, null);
  if (stock.length === 0 && earlier.length > 0) said.push(`no row of the sheet has a stock: ${andList(earlier)} of an earlier import ${earlier.length === 1 ? 'is' : 'are'} taken away, so that no old count is set as this sheet's`);
  if (stock.length > 0) {
    ignoring(tree, writes, STOCK_IGNORE, '# The starting stock `jtk import products` writes for set_stock: the shop\'s ledger holds stock by SKU,\n# never a file of the site, and a count committed here is a stale one.');
  }
  return finish();
}
