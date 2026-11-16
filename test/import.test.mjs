// `jtk import products` (lib/import.mjs): a spreadsheet's products read through a mapping into contract 3's entry
// files — the business's SKUs kept and the missing ones made as the platform makes them, the options' keys made from
// their names, a second import matched by SKU, the starting stock written where `set_stock` takes it and never into
// the site (jtakeit-core wiki/102 stage 9, decision 9, Ruling 191). Every test runs the command as a person does, in a
// site laid out as an agent lays one out for a business in German with English beside it, the shop kit added.
//
// An import that writes wrong data into a business's catalogue is the failure these guard against: each refusal is
// held with the tree left as it was, and nothing is ever rounded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { content } from '@jtakeit/kit/content';
import { readJtk } from '@jtakeit/kit/content/node';

const bin = resolve('bin/jtk.mjs');
const KIT = resolve('kit/test/fixtures/kits/shop.json');
const FIXTURES = resolve('test/fixtures/import');
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const jtk = (...args) => execFileSync('node', [bin, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** The site every test starts from, laid once: `create`, `add shop`, the schema written, the currency given as the platform gives it. */
let laid;
function baseSite() {
  if (laid !== undefined) return laid;
  const dir = mkdtempSync(join(tmpdir(), 'jtk-import-base-'));
  const site = join(dir, 'site');
  jtk('create', 'import-probe', '--locale', 'de-CH', '--locales', 'en', '--no-git', '--out', site);
  jtk('add', 'shop', '--kit', KIT, '--root', site);
  jtk('schema', '--emit-only', '--root', site);
  writeFileSync(join(site, 'jtk/site.json'), `${JSON.stringify({ currency: 'CHF' }, null, 2)}\n`);
  laid = site;
  return site;
}

const scratch = [];
/** A copy of the base site, and a directory of its own for the sheets. */
function freshSite() {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-import-'));
  scratch.push(dir);
  const site = join(dir, 'site');
  cpSync(baseSite(), site, { recursive: true });
  return { dir, site };
}
test.after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
  if (laid !== undefined) rmSync(join(laid, '..'), { recursive: true, force: true });
});

/** The command, run as a person runs it. */
function run(site, dir, sheet, mapping, ...flags) {
  const sheetFile = join(dir, 'sheet.csv');
  const mapFile = join(dir, 'mapping.json');
  writeFileSync(sheetFile, sheet);
  writeFileSync(mapFile, typeof mapping === 'string' ? mapping : `${JSON.stringify(mapping, null, 2)}\n`);
  return spawnSync('node', [bin, 'import', 'products', sheetFile, '--map', mapFile, '--root', site, ...flags], { encoding: 'utf8' });
}
const said = (result) => `${result.stdout}${result.stderr}`;
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8');
const fixtureMapping = (name) => JSON.parse(fixture(name));

const read = (site, file) => JSON.parse(readFileSync(join(site, file), 'utf8'));
const entry = (site, slug, locale) => read(site, `jtk/entries/products/${slug}${locale ? `.${locale}` : ''}.json`);
const write = (site, file, value) => writeFileSync(join(site, file), `${JSON.stringify(value, null, 2)}\n`);
const entriesOf = (site) => {
  const folder = join(site, 'jtk/entries/products');
  return existsSync(folder) ? readdirSync(folder).sort() : [];
};
/** Every file of a tree and a hash of it, for "nothing was written". */
function snapshot(site) {
  const out = {};
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      if (name === 'node_modules' || name === '.git') continue;
      const file = join(at, name);
      if (statSync(file).isDirectory()) walk(file);
      else out[relative(site, file)] = createHash('sha256').update(readFileSync(file)).digest('hex');
    }
  };
  walk(site);
  return out;
}
/** One line of a sheet, in its cells (quotes honoured, no line break inside one: the fixtures have none). */
function cellsOf(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let at = 0; at < line.length; at++) {
    const one = line[at];
    if (quoted) {
      if (one === '"' && line[at + 1] === '"') (cell += '"', at++);
      else if (one === '"') quoted = false;
      else cell += one;
    } else if (one === '"') quoted = true;
    else if (one === ',') (cells.push(cell), cell = '');
    else cell += one;
  }
  return [...cells, cell];
}
const lineOf = (cells) => cells.map((cell) => (/[",]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(',');
/** A sheet's line, given a new cell: the line numbered as the sheet numbers it (the header is line 1). */
function withCell(csv, line, column, value) {
  const lines = csv.split('\n');
  const cells = cellsOf(lines[line - 1]);
  cells[cellsOf(lines[0]).indexOf(column)] = value;
  lines[line - 1] = lineOf(cells);
  return lines.join('\n');
}

// ── the two real exports ──────────────────────────────────────────────────

test('a WooCommerce export is the products it lists', async () => {
  const { dir, site } = freshSite();
  const result = run(site, dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'));
  assert.equal(result.status, 0, said(result));

  // Two products and the fox's English: four files, and nothing else under the collection.
  assert.deepEqual(entriesOf(site), ['becher.en.json', 'becher.json', 't-shirt-fox.en.json', 't-shirt-fox.json']);

  const fox = entry(site, 't-shirt-fox');
  assert.deepEqual(Object.keys(fox), ['id', 'collection', 'slug', 'rank', 'visible', 'fields']);
  assert.match(fox.id, UUID7);
  assert.equal(fox.collection, 'products');
  assert.equal(fox.slug, 't-shirt-fox');
  assert.equal(fox.visible, true);
  assert.equal(fox.fields.title, 'T-Shirt Fox');
  assert.equal(fox.fields.description, 'Soft cotton.\nFits as you expect.', 'the HTML made text: a paragraph a line break');
  // The options' keys are made from their names, a value's from its label.
  assert.deepEqual(fox.fields.options, [
    { _key: 'size', name: 'Size', values: [{ _key: 's', label: 'S' }, { _key: 'm', label: 'M' }] },
    { _key: 'colour', name: 'Colour', values: [{ _key: 'red', label: 'Red' }, { _key: 'blue', label: 'Blue' }] },
  ]);
  // The business's SKUs are kept; the variation with none is given the one the platform would give it.
  assert.deepEqual(fox.fields.variants, [
    { _key: 'v1', sku: 'FOX-S-RED', price: { minor: 2990 }, weight: 180, picks: { size: 's', colour: 'red' } },
    { _key: 'v2', sku: 'FOX-M-RED', price: { minor: 2990 }, weight: 180, picks: { size: 'm', colour: 'red' } },
    { _key: 'v3', sku: 'FOX-S-BLUE', price: { minor: 2990 }, weight: 180, picks: { size: 's', colour: 'blue' } },
    { _key: 'v4', sku: 'T-SHIRT-FOX-M-BLUE', price: { minor: 2990 }, weight: 180, picks: { size: 'm', colour: 'blue' } },
  ]);
  assert.match(said(result), /T-SHIRT-FOX-M-BLUE/, 'the SKU it made is said');

  // The mug is one variant without picks, and no options.
  const mug = entry(site, 'becher');
  assert.equal(mug.fields.title, 'Becher');
  assert.equal(mug.fields.description, 'Hand-thrown & glazed.');
  assert.equal('options' in mug.fields, false);
  assert.deepEqual(mug.fields.variants, [{ _key: 'v1', sku: 'MUG-1', price: { minor: 1450 }, weight: 350 }]);
  assert.ok(mug.rank < fox.rank, 'in the order the sheet lists them');

  // The title's other language goes into a translation laid over the original.
  assert.deepEqual(entry(site, 't-shirt-fox', 'en'), { of: fox.id, locale: 'en', fields: { title: 'Fox T-shirt' } });
  assert.deepEqual(entry(site, 'becher', 'en'), { of: mug.id, locale: 'en', fields: { title: 'Mug' } });

  // The starting stock is a file for set_stock, in the sheet's order, and never in the site's files.
  assert.equal(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), 'MUG-1 12\nFOX-S-RED 5\nFOX-M-RED 7\nFOX-S-BLUE 0\nT-SHIRT-FOX-M-BLUE 3\n');
  assert.ok(readFileSync(join(site, '.gitignore'), 'utf8').split('\n').includes('.jtakeit/stock*.txt'));
  for (const file of entriesOf(site)) assert.doesNotMatch(readFileSync(join(site, 'jtk/entries/products', file), 'utf8'), /stock|on_hand/);
  assert.match(said(result), /set_stock/);

  // The door reads what was written as it reads any product.
  const door = content(await readJtk(site));
  const rows = door.entry('products', 't-shirt-fox').fields.rows('variants');
  assert.deepEqual(rows.map((one) => one.picks('picks')), fox.fields.variants.map((one) => one.picks));
  assert.equal(door.entry('products', 't-shirt-fox', 'en').fields.text('title'), 'Fox T-shirt');
  assert.deepEqual(door.rolesOf('shop'), { products: 'products' });
});

test('a Shopify export is the same products', () => {
  const { dir, site } = freshSite();
  const result = run(site, dir, fixture('shopify.csv'), fixtureMapping('shopify.json'));
  assert.equal(result.status, 0, said(result));
  assert.deepEqual(entriesOf(site), ['becher.json', 't-shirt-fox.json']);

  const fox = entry(site, 't-shirt-fox');
  // `Status: draft` is a product not shown; the option names are the group's first row's.
  assert.equal(fox.visible, false);
  assert.equal(fox.fields.title, 'T-Shirt Fox');
  assert.equal(fox.fields.description, 'Weich & fair gemacht.\nPasst wie gewohnt.', 'Body (HTML) made text: tags out, a <br> a line break');
  assert.deepEqual(fox.fields.options, [
    { _key: 'size', name: 'Size', values: [{ _key: 's', label: 'S' }, { _key: 'm', label: 'M' }] },
    { _key: 'colour', name: 'Colour', values: [{ _key: 'red', label: 'Red' }, { _key: 'blue', label: 'Blue' }] },
  ]);
  assert.deepEqual(
    fox.fields.variants.map((one) => [one._key, one.sku, one.price.minor, one.weight, one.picks]),
    [
      ['v1', 'FOX-S-RED', 2990, 180, { size: 's', colour: 'red' }],
      ['v2', 'FOX-S-BLUE', 2990, 180, { size: 's', colour: 'blue' }],
      ['v3', 'FOX-M-RED', 2990, 180, { size: 'm', colour: 'red' }],
      ['v4', 'T-SHIRT-FOX-M-BLUE', 2990, 180, { size: 'm', colour: 'blue' }],
    ],
    'the row that only adds a picture is no variant',
  );

  // Shopify's `Title: Default Title` is the way it says a product has no options.
  const mug = entry(site, 'becher');
  assert.equal(mug.visible, true);
  assert.equal('options' in mug.fields, false);
  assert.deepEqual(mug.fields.variants, [{ _key: 'v1', sku: 'MUG-1', price: { minor: 1450 }, weight: 350 }]);
  assert.equal(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), 'MUG-1 12\nFOX-S-RED 5\nFOX-S-BLUE 0\nFOX-M-RED 7\nT-SHIRT-FOX-M-BLUE 3\n');
});

// ── what is refused, and the tree left as it was ──────────────────────────

test('a SKU on two rows is refused', () => {
  const { dir, site } = freshSite();
  const before = snapshot(site);
  // The fox's last variant, on row 7, says the SKU the first, on row 3, has.
  const sheet = withCell(fixture('shopify.csv'), 7, 'Variant SKU', 'FOX-S-RED');
  const result = run(site, dir, sheet, fixtureMapping('shopify.json'));
  assert.equal(result.status, 1, said(result));
  assert.match(result.stderr, /rows 3 and 7/);
  assert.match(result.stderr, /Variant SKU/);
  assert.match(result.stderr, /FOX-S-RED/);
  assert.deepEqual(snapshot(site), before, 'nothing was written');

  // The same SKU in another case is the same SKU.
  const cased = run(site, dir, withCell(fixture('shopify.csv'), 7, 'Variant SKU', 'fox-s-red'), fixtureMapping('shopify.json'));
  assert.equal(cased.status, 1, said(cased));
  assert.match(cased.stderr, /rows 3 and 7/);
  assert.deepEqual(snapshot(site), before);
});

test("a price is read in the mapping's decimal", () => {
  const sheet = 'Name,SKU,Preis,Gewicht\nBecher,MUG-1,"12,50","0,18"\n';
  const mapping = (decimal, extra = {}) => ({
    v: 1,
    decimal,
    fields: { title: 'Name', sku: 'SKU', price: 'Preis', weight: { column: 'Gewicht', unit: 'kg' }, ...extra },
  });

  const { dir, site } = freshSite();
  const ok = run(site, dir, sheet, mapping(','));
  assert.equal(ok.status, 0, said(ok));
  assert.deepEqual(entry(site, 'becher').fields.variants, [{ _key: 'v1', sku: 'MUG-1', price: { minor: 1250 }, weight: 180 }], '12,50 is 1250 and 0,18 kg 180 g');

  // Read with a point, a comma is no decimal: refused, naming the row and the column and saying what would have read it.
  const wrong = freshSite();
  const before = snapshot(wrong.site);
  const refused = run(wrong.site, wrong.dir, sheet, mapping('.'));
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 2, column «Preis»/);
  assert.match(refused.stderr, /"decimal": ","/);
  assert.match(refused.stderr, /row 2, column «Gewicht»/);
  assert.deepEqual(snapshot(wrong.site), before);

  // A weight that is not whole grams once its unit is read is refused, and nothing is rounded to 180 or 181.
  const rounded = freshSite();
  const half = run(rounded.site, rounded.dir, 'Name,SKU,Preis,Gewicht\nBecher,MUG-1,"12,50","0,1805"\n', mapping(','));
  assert.equal(half.status, 1, said(half));
  assert.match(half.stderr, /row 2, column «Gewicht»/);
  assert.deepEqual(entriesOf(rounded.site), []);

  // The same in grams: whole grams are read, a fraction of a gram is refused.
  const grams = freshSite();
  const gramsMapping = mapping(',', { weight: 'Gewicht' });
  assert.equal(run(grams.site, grams.dir, 'Name,SKU,Preis,Gewicht\nBecher,MUG-1,"12,50",180\n', gramsMapping).status, 0);
  assert.equal(entry(grams.site, 'becher').fields.variants[0].weight, 180);
  const fraction = freshSite();
  assert.equal(run(fraction.site, fraction.dir, 'Name,SKU,Preis,Gewicht\nBecher,MUG-1,"12,50","180,5"\n', gramsMapping).status, 1);
});

test('a contract-2 site is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-import-2-'));
  scratch.push(dir);
  const site = join(dir, 'site');
  jtk('create', 'probe-two', '--locale', 'de-CH', '--no-git', '--contract', '2', '--out', site);
  const before = snapshot(site);
  const result = run(site, dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'), '--currency', 'CHF');
  assert.equal(result.status, 1, said(result));
  assert.match(result.stderr, /^jtk import products: .*not on contract 3.*`jtk upgrade contract-3` first/s, 'the import says it, not the help');
  assert.deepEqual(snapshot(site), before, 'nothing was written');
  assert.equal(existsSync(join(site, '.jtakeit')), false);
});

// ── a second import ───────────────────────────────────────────────────────

/** The WooCommerce sheet imported once into a fresh site. */
function firstImport() {
  const made = freshSite();
  const result = run(made.site, made.dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'));
  assert.equal(result.status, 0, said(result));
  return made;
}

test('a second import keeps the words the entry holds', () => {
  const { dir, site } = firstImport();
  const before = entry(site, 't-shirt-fox');

  // The owner renamed the product in the panel; the sheet has a new price for the first variant.
  const renamed = structuredClone(before);
  renamed.fields.title = 'Fox, the T-shirt';
  write(site, 'jtk/entries/products/t-shirt-fox.json', renamed);
  const sheet = withCell(fixture('woocommerce.csv'), 4, 'Regular price', '32.90');

  const second = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(second.status, 0, said(second));
  // The title kept, and said with the sheet's beside it.
  assert.match(second.stdout, /t-shirt-fox: title kept «Fox, the T-shirt», the sheet says «T-Shirt Fox»/);
  const after = entry(site, 't-shirt-fox');
  assert.equal(after.fields.title, 'Fox, the T-shirt');
  // The sheet's price taken, and nothing else of the variants changed.
  assert.deepEqual(after.fields.variants[0].price, { minor: 3290 });
  assert.deepEqual(after.fields.variants.slice(1), before.fields.variants.slice(1));
  // The id, every _key and the rank as they were.
  assert.equal(after.id, before.id);
  assert.equal(after.rank, before.rank);
  assert.deepEqual(after.fields.options, before.fields.options);
  assert.deepEqual(after.fields.variants.map((one) => [one._key, one.sku, one.picks]), before.fields.variants.map((one) => [one._key, one.sku, one.picks]));

  // --words takes the sheet's.
  const third = run(site, dir, sheet, fixtureMapping('woocommerce.json'), '--words');
  assert.equal(third.status, 0, said(third));
  assert.equal(entry(site, 't-shirt-fox').fields.title, 'T-Shirt Fox');
  assert.equal(entry(site, 't-shirt-fox').id, before.id);
});

test('a second import changes no SKU and leaves alone what the sheet does not name', () => {
  const { dir, site } = firstImport();
  const mug = readFileSync(join(site, 'jtk/entries/products/becher.json'));
  const mugEnglish = readFileSync(join(site, 'jtk/entries/products/becher.en.json'));
  const fox = readFileSync(join(site, 'jtk/entries/products/t-shirt-fox.json'));

  // The sheet names the mug no more, and says FOX-S for the variant that holds FOX-S-RED.
  const lines = withCell(fixture('woocommerce.csv'), 4, 'SKU', 'FOX-S').split('\n');
  const sheet = [lines[0], ...lines.slice(2)].join('\n');
  const second = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(second.status, 0, said(second));
  assert.match(second.stdout, /FOX-S\b.*FOX-S-RED/, 'said');
  assert.match(second.stdout, /an import changes no SKU/);
  assert.deepEqual(readFileSync(join(site, 'jtk/entries/products/becher.json')), mug, 'the mug, left out of the sheet, byte for byte');
  assert.deepEqual(readFileSync(join(site, 'jtk/entries/products/becher.en.json')), mugEnglish);
  // The variant is skipped, not added again under the sheet's SKU: still four, with the SKUs they had.
  assert.deepEqual(readFileSync(join(site, 'jtk/entries/products/t-shirt-fox.json')), fox, 'nothing the sheet says changed anything');
  assert.deepEqual(entry(site, 't-shirt-fox').fields.variants.map((one) => one.sku), ['FOX-S-RED', 'FOX-M-RED', 'FOX-S-BLUE', 'T-SHIRT-FOX-M-BLUE']);
  // The skipped row sets no stock under either SKU.
  assert.doesNotMatch(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), /FOX-S\b(?!-)/);
});

// ── --dry-run ─────────────────────────────────────────────────────────────

test('--dry-run writes nothing and says what it would', () => {
  const fresh = freshSite();
  const before = snapshot(fresh.site);
  const first = run(fresh.site, fresh.dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'), '--dry-run');
  assert.equal(first.status, 0, said(first));
  assert.deepEqual(snapshot(fresh.site), before, 'nothing written');
  assert.match(first.stdout, /would make t-shirt-fox/);
  assert.match(first.stdout, /T-SHIRT-FOX-M-BLUE/, 'each SKU it would make');
  assert.match(first.stdout, /MUG-1 12/, 'the stock\'s lines');

  const { dir, site } = firstImport();
  const imported = snapshot(site);
  const sheet = withCell(fixture('woocommerce.csv'), 4, 'Regular price', '32.90');
  const second = run(site, dir, sheet, fixtureMapping('woocommerce.json'), '--dry-run');
  assert.equal(second.status, 0, said(second));
  assert.match(second.stdout, /t-shirt-fox: v1 price 2990 → 3290/);
  assert.deepEqual(snapshot(site), imported, 'the tree unchanged');
});

// ── the most a product may have ───────────────────────────────────────────

/** A sheet of one product with this many variants, one row each, grouped by its handle. */
function manyVariants(count) {
  const rows = ['Handle,Title,SKU,Price,Size'];
  for (let n = 1; n <= count; n++) rows.push(`stoff,${n === 1 ? 'Stoff' : ''},S-${n},1.00,${n}`);
  return `${rows.join('\n')}\n`;
}
const manyMapping = {
  v: 1,
  decimal: '.',
  group: { by: 'Handle' },
  fields: { title: 'Title', slug: 'Handle', sku: 'SKU', price: 'Price', options: [{ name: { is: 'Size' }, value: 'Size' }] },
};

test('more than 2,000 variants is refused', () => {
  const over = freshSite();
  const before = snapshot(over.site);
  const refused = run(over.site, over.dir, manyVariants(2001), manyMapping);
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 2/, 'the product, by its first row');
  assert.match(refused.stderr, /2,001 variants/);
  assert.match(refused.stderr, /2,000/);
  assert.deepEqual(snapshot(over.site), before);

  // 2,000 is the most, and is imported.
  const most = freshSite();
  const ok = run(most.site, most.dir, manyVariants(2000), manyMapping);
  assert.equal(ok.status, 0, said(ok));
  const variants = entry(most.site, 'stoff').fields.variants;
  assert.equal(variants.length, 2000);
  assert.equal(variants[1999]._key, 'v2000');

  // A second import cannot make it 2,001 either: the variants the entry holds count, the sheet's or not.
  const held = snapshot(most.site);
  const one = run(most.site, most.dir, 'Handle,Title,SKU,Price,Size\nstoff,Stoff,S-1,1.00,1\nstoff,,S-2001,1.00,2001\n', manyMapping);
  assert.equal(one.status, 1, said(one));
  assert.match(one.stderr, /row 3, column «Size»: would make stoff 2,001 variants, and a product has at most 2,000/);
  assert.deepEqual(snapshot(most.site), held);
});

// ── the sheet as a program wrote it ───────────────────────────────────────

test('a sheet is read as RFC 4180 has it: quotes, a line break in a cell, a BOM, any line ending, the delimiter the header says', async () => {
  const { parseCSV, SheetError } = await import('../lib/import/csv.mjs');
  const text = 'Name,Note,Price\r\n"Becher, gross","He said ""hi""\r\nand left",12.50\r\n\r\nTasse,,9\r\n';
  const sheet = parseCSV(`﻿${text}`);
  assert.deepEqual(sheet.header, ['Name', 'Note', 'Price']);
  assert.deepEqual(sheet.rows, [
    { Name: 'Becher, gross', Note: 'He said "hi"\nand left', Price: '12.50' },
    { Name: 'Tasse', Note: '', Price: '9' },
  ]);
  // A row is told by the line it begins on: the cell with a line break is two lines, the empty line one.
  assert.deepEqual(sheet.lines, [2, 5]);
  assert.equal(sheet.delimiter, ',');

  // The delimiter is read off the header, outside quotes; a comma in a quoted word does not make a sheet a comma's.
  assert.equal(parseCSV('Name;Note;Price\nBecher;"a, b, c";12,50\n').delimiter, ';');
  assert.deepEqual(parseCSV('Name;Note;Price\nBecher;"a, b, c";12,50\n').rows[0], { Name: 'Becher', Note: 'a, b, c', Price: '12,50' });
  assert.equal(parseCSV('Name\tPrice\nBecher\t12.50\n').delimiter, '\t');
  assert.deepEqual(parseCSV('Name|Price\nBecher|1\n').header, ['Name|Price'], 'a comma with nothing to divide is the default');
  // Old Mac line ends, a trailing delimiter, a header with spaces round its names.
  assert.deepEqual(parseCSV(' A , B \r1,2,\r3,4').rows, [{ A: '1', B: '2' }, { A: '3', B: '4' }]);

  // What would be another sheet is refused, naming the line.
  assert.throws(() => parseCSV('A,B\n"open,1\n'), (why) => why instanceof SheetError && /line 2/.test(why.message) && /never closed/.test(why.message));
  assert.throws(() => parseCSV('A,B\n"a"b,1\n'), /line 2: text after a closing quote/);
  assert.throws(() => parseCSV('A,B\n1,12,50\n'), /row 2 has 3 cells and the header 2/);
  assert.throws(() => parseCSV('\n\n'), /empty/);
});

test('a sheet that is not UTF-8 is refused, and no word in it is read as another', () => {
  const { dir, site } = freshSite();
  const before = snapshot(site);
  writeFileSync(join(dir, 'latin.csv'), Buffer.from('Name,Price\nT\xe4sse,9\n', 'latin1'));
  writeFileSync(join(dir, 'map.json'), JSON.stringify({ v: 1, decimal: '.', fields: { title: 'Name', price: 'Price' } }));
  const result = spawnSync('node', [bin, 'import', 'products', join(dir, 'latin.csv'), '--map', join(dir, 'map.json'), '--root', site], { encoding: 'utf8' });
  assert.equal(result.status, 1, said(result));
  assert.match(result.stderr, /not UTF-8/);
  assert.deepEqual(snapshot(site), before);
});

// ── the mapping ───────────────────────────────────────────────────────────

test('a mapping that names a column the sheet has not got is refused, naming the key, and so is a key the import does not read', () => {
  const { dir, site } = freshSite();
  const before = snapshot(site);
  const sheet = 'Name,SKU,Price\nBecher,MUG-1,9\n';
  const missing = run(site, dir, sheet, { v: 1, decimal: '.', fields: { title: 'Name', sku: 'Artikel', price: 'Preis', weight: { column: 'Gewicht', unit: 'g' } } });
  assert.equal(missing.status, 1, said(missing));
  assert.match(missing.stderr, /fields\.sku: names the column «Artikel» and the sheet has not got one \(its columns: Name, SKU, Price\)/);
  assert.match(missing.stderr, /fields\.price: .*«Preis»/);
  assert.match(missing.stderr, /fields\.weight\.column: .*«Gewicht»/);

  const misspelt = run(site, dir, sheet, { v: 1, decimal: '.', fields: { title: 'Name', price: 'Price', prize: 'Price' }, extra: 1 });
  assert.equal(misspelt.status, 1, said(misspelt));
  assert.match(misspelt.stderr, /fields\.prize: is not a field of a product the import reads/);
  assert.match(misspelt.stderr, /extra: is not a key of a mapping/);

  // The decimal is never guessed; the pictures wait for the step that sends them.
  const undecided = run(site, dir, sheet, { v: 1, fields: { title: 'Name', price: 'Price', pictures: 'Price' } });
  assert.equal(undecided.status, 1);
  assert.match(undecided.stderr, /decimal: .*"decimal": "\."/);
  assert.match(undecided.stderr, /fields\.pictures: the pictures are not read by this version/);
  assert.match(run(site, dir, sheet, '{ not json').stderr, /the mapping is not JSON/);
  assert.deepEqual(snapshot(site), before, 'nothing was written');
});

// ── nothing is rounded, nothing is guessed ────────────────────────────────

test('a price is an amount of the currency or it is refused, never rounded', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price' } };
  const price = (text, ...flags) => {
    const { dir, site } = freshSite();
    const result = run(site, dir, `Name,SKU,Price\nBecher,MUG-1,"${text}"\n`, mapping, ...flags);
    return { result, site, minor: result.status === 0 ? entry(site, 'becher').fields.variants[0].price.minor : undefined };
  };
  assert.equal(price('12').minor, 1200);
  assert.equal(price('12.5').minor, 1250);
  assert.equal(price('0').minor, 0, 'free is an amount');
  assert.equal(price('12.500').minor, 1250, 'zeros past the digits are no fraction');
  for (const bad of ['12.505', '12.999', '-3', '+3', '1,250.00', 'CHF 12.50', '12.50 CHF', '12,50', '1e3', '.5', '12.', '']) {
    const refused = price(bad);
    assert.equal(refused.result.status, 1, `${bad}: ${said(refused.result)}`);
    assert.match(refused.result.stderr, /row 2, column «Price»/, bad);
    assert.deepEqual(entriesOf(refused.site), [], `${bad}: nothing written`);
  }
  assert.match(price('12.505').result.stderr, /more decimals than CHF has \(2\) — nothing is rounded/);
});

test('the currency is the site\'s: said by --currency or by jtk/site.json, and never one that contradicts the other', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price' } };
  const sheet = 'Name,SKU,Price\nBecher,MUG-1,1500\n';
  const without = freshSite();
  rmSync(join(without.site, 'jtk/site.json'));
  const unknown = run(without.site, without.dir, sheet, mapping);
  assert.equal(unknown.status, 1, said(unknown));
  assert.match(unknown.stderr, /--currency <xxx>/);
  assert.deepEqual(entriesOf(without.site), []);

  // Said by the flag where the site has none: the minor unit is the currency's — a yen is a whole yen.
  const yen = run(without.site, without.dir, sheet, mapping, '--currency', 'jpy');
  assert.equal(yen.status, 0, said(yen));
  assert.equal(entry(without.site, 'becher').fields.variants[0].price.minor, 1500);
  const fraction = freshSite();
  rmSync(join(fraction.site, 'jtk/site.json'));
  assert.equal(run(fraction.site, fraction.dir, 'Name,SKU,Price\nBecher,MUG-1,1500.5\n', mapping, '--currency', 'JPY').status, 1);

  // The site says CHF: another currency is no price of this site's.
  const clash = freshSite();
  const contradicted = run(clash.site, clash.dir, sheet, mapping, '--currency', 'EUR');
  assert.equal(contradicted.status, 1, said(contradicted));
  assert.match(contradicted.stderr, /not the site's currency, CHF/);
  assert.equal(run(clash.site, clash.dir, sheet, mapping, '--currency', 'chf').status, 0);
  assert.equal(run(clash.site, clash.dir, sheet, mapping, '--currency', 'francs').status, 1);
});

test('a variant that has no price, or picks no value of an option, is refused with its row and column', () => {
  const mapping = {
    v: 1,
    decimal: '.',
    group: { by: 'Handle' },
    fields: { title: 'Title', slug: 'Handle', sku: 'SKU', price: 'Price', options: [{ name: { is: 'Size' }, value: 'Size' }] },
  };
  const header = 'Handle,Title,SKU,Price,Size';

  // A row with a SKU and no price is a variant, and a variant is sold at a price.
  const noPrice = freshSite();
  const priceless = run(noPrice.site, noPrice.dir, `${header}\nhemd,Hemd,H-S,10,S\nhemd,,H-M,,M\n`, mapping);
  assert.equal(priceless.status, 1, said(priceless));
  assert.match(priceless.stderr, /row 3, column «Price»: is empty on a row that is a variant \(it has the SKU H-M\)/);
  assert.deepEqual(entriesOf(noPrice.site), []);

  // A row with nothing of a variant is not one: it adds nothing, and is said.
  const quiet = freshSite();
  const skipped = run(quiet.site, quiet.dir, `${header}\nhemd,Hemd,H-S,10,S\nhemd,,,,\nhemd,,H-M,12,M\n`, mapping);
  assert.equal(skipped.status, 0, said(skipped));
  assert.match(skipped.stdout, /hemd: row 3 carries no price, SKU or option value, so adds no variant: skipped/);
  assert.deepEqual(entry(quiet.site, 'hemd').fields.variants.map((one) => one.sku), ['H-S', 'H-M']);

  // A variant of a product with options picks a value of each.
  const noSize = freshSite();
  const unsized = run(noSize.site, noSize.dir, `${header}\nhemd,Hemd,H-S,10,S\nhemd,,H-M,12,\n`, mapping);
  assert.equal(unsized.status, 1, said(unsized));
  assert.match(unsized.stderr, /row 3, column «Size»: has no value of the option «Size»/);

  // Two variants no option tells apart are refused, naming both.
  const twins = freshSite();
  const same = run(twins.site, twins.dir, `${header}\nhemd,Hemd,H-S,10,S\nhemd,,H-X,12,S\n`, mapping);
  assert.equal(same.status, 1, said(same));
  assert.match(same.stderr, /rows 2 and 3: pick the same values \(S\)/);
  assert.deepEqual(entriesOf(twins.site), []);
});

test('the Advanced fields are read as the platform reads them: a tax code of Stripe\'s, a size class of the three', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price', tax_code: 'Tax', tariff_number: 'Tariff', made_in: 'Made in', size_class: 'Size', tracked: 'Counted', visible: 'Shown', on_sale: 'Sale' } };
  const header = 'Name,SKU,Price,Tax,Tariff,Made in,Size,Counted,Shown,Sale';
  const ok = freshSite();
  const good = run(ok.site, ok.dir, `${header}\nBuch,B-1,19.90,txcd_35010000,4901.99,CH,Letter,no,yes,false\n`, mapping);
  assert.equal(good.status, 0, said(good));
  const book = entry(ok.site, 'buch');
  assert.deepEqual(book.fields, {
    title: 'Buch',
    variants: [{ _key: 'v1', sku: 'B-1', price: { minor: 1990 }, on_sale: false }],
    tracked: false,
    size_class: 'letter',
    tax_code: 'txcd_35010000',
    tariff_number: '4901.99',
    made_in: 'CH',
  });
  assert.equal(book.visible, true);

  for (const [what, row, column] of [
    ['a tax code that is none of Stripe\'s', 'Buch,B-1,19.90,35010000,,,,,,', 'Tax'],
    ['a size class that is none of the three', 'Buch,B-1,19.90,,,,Huge,,,', 'Size'],
    ['a switch that says neither yes nor no', 'Buch,B-1,19.90,,,,,maybe,,', 'Counted'],
    ['a name that is too long', `${'x'.repeat(121)},B-1,19.90,,,,,,,`, 'Name'],
    ['a SKU the kind does not take', 'Buch,B 1,19.90,,,,,,,', 'SKU'],
  ]) {
    const bad = freshSite();
    const refused = run(bad.site, bad.dir, `${header}\n${row}\n`, mapping);
    assert.equal(refused.status, 1, `${what}: ${said(refused)}`);
    assert.match(refused.stderr, new RegExp(`row 2, column «${column}»`), what);
    assert.deepEqual(entriesOf(bad.site), [], what);
  }
});

// ── a second import, further ──────────────────────────────────────────────

test('a second import of the same sheet changes nothing, and a cell the sheet leaves empty erases nothing', () => {
  const { dir, site } = firstImport();
  const before = snapshot(site);
  const same = run(site, dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'));
  assert.equal(same.status, 0, said(same));
  assert.match(same.stdout, /0 made, 0 updated, 2 left as they are/);
  assert.deepEqual(snapshot(site), before, 'every file byte for byte, the ids and ranks too');

  // The owner has written a description and a weight in the panel; the sheet's cells for them are empty.
  const fox = entry(site, 't-shirt-fox');
  fox.fields.description = 'Our own words.';
  fox.fields.variants[0].weight = 200;
  fox.fields.size_class = 'bulky';
  fox.fields.made_in = 'PT';
  write(site, 'jtk/entries/products/t-shirt-fox.json', fox);
  const edited = snapshot(site);
  const sheet = withCell(withCell(fixture('woocommerce.csv'), 4, 'Weight (kg)', ''), 3, 'Description', '');
  const second = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(second.status, 0, said(second));
  assert.deepEqual(entry(site, 't-shirt-fox'), fox, 'what the sheet leaves empty is what the entry holds');
  assert.deepEqual(snapshot(site)['jtk/entries/products/t-shirt-fox.json'], edited['jtk/entries/products/t-shirt-fox.json']);
});

test('a second import adds the variants the sheet adds, with a SKU made for them, and keeps every key', () => {
  const { dir, site } = firstImport();
  const before = entry(site, 't-shirt-fox');

  // A colour and a size the product does not have: two new variants, one with a SKU of the sheet's and one made.
  const lines = fixture('woocommerce.csv').trimEnd().split('\n');
  lines.push('25,variation,FOX-L-GREEN,"T-Shirt Fox - L, Green",,1,,0.2,31.90,2,id:20,Size,L,Colour,Green,');
  lines.push('26,variation,,"T-Shirt Fox - S, Green",,1,,0.2,31.90,,id:20,Size,S,Colour,Green,');
  const second = run(site, dir, `${lines.join('\n')}\n`, fixtureMapping('woocommerce.json'));
  assert.equal(second.status, 0, said(second));
  assert.match(second.stdout, /t-shirt-fox: v6 SKU T-SHIRT-FOX-S-GREEN made/);

  const after = entry(site, 't-shirt-fox');
  assert.deepEqual(after.fields.variants.slice(0, 4), before.fields.variants, 'the four the product had are as they were');
  assert.deepEqual(after.fields.variants.slice(4), [
    { _key: 'v5', sku: 'FOX-L-GREEN', price: { minor: 3190 }, weight: 200, picks: { size: 'l', colour: 'green' } },
    { _key: 'v6', sku: 'T-SHIRT-FOX-S-GREEN', price: { minor: 3190 }, weight: 200, picks: { size: 's', colour: 'green' } },
  ]);
  assert.deepEqual(after.fields.options, [
    { _key: 'size', name: 'Size', values: [...before.fields.options[0].values, { _key: 'l', label: 'L' }] },
    { _key: 'colour', name: 'Colour', values: [...before.fields.options[1].values, { _key: 'green', label: 'Green' }] },
  ]);
  assert.equal(after.id, before.id);
  assert.equal(after.rank, before.rank);
  // The new SKU with a stock of the sheet's is in the stock file, and the one with none is not.
  assert.match(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), /FOX-L-GREEN 2\n/);
  assert.doesNotMatch(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), /GREEN-S|S-GREEN/);

  // A product the sheet gives an option the entry has not got cannot have a variant laid over it: the options are the
  // owner's to change in the panel, since each variant picks a value of each. The row without a SKU, which is matched
  // by its picks, is the one that cannot be found, and is refused with its row and the column of the option.
  const kept = snapshot(site);
  const materials = fixtureMapping('woocommerce.json');
  materials.fields.options.push({ name: 'Attribute 3 name', value: 'Attribute 3 value(s)' });
  const sheet = fixture('woocommerce.csv').trimEnd().split('\n').map((row, i) => (i === 0 ? `${row},Attribute 3 name,Attribute 3 value(s)` : `${row},Material,Cotton`)).join('\n');
  const refused = run(site, dir, `${sheet}\n`, materials);
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 7, column «Attribute 3 value\(s\)»: the option «Material» is none of t-shirt-fox's/);
  assert.deepEqual(snapshot(site), kept, 'nothing was written');
});

test('a sheet product that holds the SKUs of two products of the site is refused, naming both', () => {
  const { dir, site } = firstImport();
  const before = snapshot(site);
  // The mug no longer in the sheet, and its SKU on one of the fox's variants.
  const lines = withCell(fixture('woocommerce.csv'), 5, 'SKU', 'MUG-1').split('\n');
  const sheet = [lines[0], ...lines.slice(2)].join('\n');
  const refused = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /t-shirt-fox \(row 3, FOX-S-RED\)/);
  assert.match(refused.stderr, /becher \(row 4, MUG-1\)/);
  assert.match(refused.stderr, /two products of the site/);
  assert.deepEqual(snapshot(site), before);
});

test('a variant with no SKU is matched by the product\'s slug and its picks, and keeps the SKU it holds', () => {
  const sheet = 'Name,Size,Price\nHemd,S,10\nHemd,M,12\n';
  const mapping = { v: 1, decimal: '.', group: { by: 'Name' }, fields: { title: 'Name', price: 'Price', options: [{ name: { is: 'Size' }, value: 'Size' }] } };
  const { dir, site } = freshSite();
  assert.equal(run(site, dir, sheet, mapping).status, 0);
  const first = entry(site, 'hemd');
  assert.deepEqual(first.fields.variants.map((one) => one.sku), ['HEMD-S', 'HEMD-M'], 'made as the platform makes them');

  // The owner gives the first its own SKU in the panel; the sheet has none, and a new price.
  first.fields.variants[0].sku = 'SHIRT-S';
  write(site, 'jtk/entries/products/hemd.json', first);
  const second = run(site, dir, 'Name,Size,Price\nHemd,S,11\nHemd,M,12\nHemd,L,13\n', mapping);
  assert.equal(second.status, 0, said(second));
  const after = entry(site, 'hemd').fields.variants;
  assert.deepEqual(after.map((one) => [one._key, one.sku, one.price.minor]), [['v1', 'SHIRT-S', 1100], ['v2', 'HEMD-M', 1200], ['v3', 'HEMD-L', 1300]]);
});

test('made SKUs and slugs never take one that is held, by the collection or by the sheet', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price' } };
  const { dir, site } = freshSite();
  // Two products of one name: the second is numbered, and so is its SKU, which is not the KERZE-2 the sheet gives a third.
  const sheet = 'Name,SKU,Price\nKerze,,5\nKerze,,6\nKerze,KERZE-2,7\nGrösse Ä,,8\nAlpha,kerze-rot,9\nMedia,,1\n';
  const result = run(site, dir, sheet, mapping);
  assert.equal(result.status, 0, said(result));
  // A name that makes `media` is numbered: no entry may be named so, the folder beside it is the build's pictures.
  assert.deepEqual(entriesOf(site), ['alpha.json', 'grosse-a.json', 'kerze-2.json', 'kerze-3.json', 'kerze.json', 'media-2.json']);
  const sku = (slug) => entry(site, slug).fields.variants[0].sku;
  assert.deepEqual(['kerze', 'kerze-2', 'kerze-3', 'grosse-a', 'alpha'].map(sku), ['KERZE', 'KERZE-2-2', 'KERZE-2', 'GROSSE-A', 'kerze-rot']);
  // Ranks follow the sheet.
  const ranks = ['kerze', 'kerze-2', 'kerze-3', 'grosse-a', 'alpha'].map((slug) => entry(site, slug).rank);
  assert.deepEqual(ranks, [...ranks].sort());

  // A second sheet: a made SKU steps round one the collection holds, in any case — and a name the collection has is
  // a product with SKUs of its own, so it is another one, numbered past what is there.
  const more = run(site, dir, 'Name,SKU,Price\nKerze Rot,,4\nKerze,NEW-1,5\n', mapping);
  assert.equal(more.status, 0, said(more));
  assert.equal(sku('kerze-rot'), 'KERZE-ROT-2');
  assert.equal(sku('kerze-4'), 'NEW-1');
  assert.ok(entry(site, 'kerze-4').rank > ranks.at(-1), 'after the last of the collection');
  assert.deepEqual(entry(site, 'kerze'), entry(site, 'kerze'));
  assert.equal(sku('kerze'), 'KERZE', 'the Kerze the collection has is as it was');
});

test('an address the sheet gives is the product\'s own or it is refused: one the platform takes, on one product', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', slug: 'Handle', sku: 'SKU', price: 'Price' } };
  for (const [handle, why] of [['Fox_Tee', /row 2, column «Handle»: «Fox_Tee» is not an address/], ['media', /«media» is not an address an entry may have/], ['a--b', /not an address/], ['x'.repeat(81), /not an address/]]) {
    const { dir, site } = freshSite();
    const refused = run(site, dir, `Name,Handle,SKU,Price\nFox,${handle},F-1,1\n`, mapping);
    assert.equal(refused.status, 1, `${handle}: ${said(refused)}`);
    assert.match(refused.stderr, why);
    assert.deepEqual(entriesOf(site), []);
  }
  // Two products at one address, naming both rows.
  const twice = freshSite();
  const clash = run(twice.site, twice.dir, 'Name,Handle,SKU,Price\nFox,fox,F-1,1\nFuchs,fox,F-2,1\n', mapping);
  assert.equal(clash.status, 1, said(clash));
  assert.match(clash.stderr, /rows 2 and 3, column «Handle»: «fox» is the address of two products/);
  // An address of an entry the collection has, for SKUs that are none of the entry's and picks that are none of its own, is not made over.
  const held = freshSite();
  assert.equal(run(held.site, held.dir, 'Name,Handle,SKU,Price\nFox,fox,F-1,1\n', mapping).status, 0);
  const before = snapshot(held.site);
  const over = run(held.site, held.dir, 'Name,Handle,SKU,Price\nFox,fox,F-2,2\n', mapping);
  assert.equal(over.status, 0, 'its picks are the entry\'s, the SKU is not: the row is said and skipped');
  assert.match(over.stdout, /the sheet's SKU F-2 is not F-1, which fox holds for the same picks/);
  assert.deepEqual(snapshot(held.site)['jtk/entries/products/fox.json'], before['jtk/entries/products/fox.json']);
});

// ── the stock ─────────────────────────────────────────────────────────────

test('the starting stock is written 5,000 lines to a file, a file of an earlier import is not left to be taken for this one\'s, and .gitignore says it once', () => {
  const mapping = { v: 1, decimal: '.', group: { by: 'Handle' }, fields: { title: 'Title', slug: 'Handle', sku: 'SKU', price: 'Price', stock: 'Stock', options: [{ name: { is: 'N' }, value: 'N' }] } };
  const sheetOf = (products, each) => {
    const rows = ['Handle,Title,SKU,Price,Stock,N'];
    for (let p = 1; p <= products; p++) for (let n = 1; n <= each; n++) rows.push(`p${p},${n === 1 ? `P${p}` : ''},P${p}-${n},1,${n % 7},${n}`);
    return `${rows.join('\n')}\n`;
  };
  const { dir, site } = freshSite();
  // 5,001 SKUs: two files.
  const big = run(site, dir, sheetOf(3, 1667), mapping);
  assert.equal(big.status, 0, said(big));
  const first = readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8').trimEnd().split('\n');
  const second = readFileSync(join(site, '.jtakeit/stock-2.txt'), 'utf8').trimEnd().split('\n');
  assert.deepEqual([first.length, second.length], [5000, 1]);
  assert.equal(first[0], 'P1-1 1');
  assert.equal(second[0], 'P3-1667 ' + (1667 % 7));
  assert.match(big.stdout, /stock-2\.txt/);
  const ignored = readFileSync(join(site, '.gitignore'), 'utf8').split('\n').filter((one) => one === '.jtakeit/stock*.txt');
  assert.equal(ignored.length, 1);

  // A second import with fewer SKUs: the second file would be this sheet's no more, and is taken away.
  const small = run(site, dir, sheetOf(1, 3), mapping);
  assert.equal(small.status, 0, said(small));
  assert.equal(existsSync(join(site, '.jtakeit/stock-2.txt')), false);
  assert.equal(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), 'P1-1 1\nP1-2 2\nP1-3 3\n');
  assert.equal(readFileSync(join(site, '.gitignore'), 'utf8').split('\n').filter((one) => one === '.jtakeit/stock*.txt').length, 1, 'said once, however many imports');

  // A count that is not a whole number, or too large, is refused with its row; so is a count below nothing.
  for (const bad of ['1.5', '-1', 'many', '1000000']) {
    const refused = freshSite();
    const result = run(refused.site, refused.dir, `Handle,Title,SKU,Price,Stock,N\np,P,P-1,1,${bad},1\n`, mapping);
    assert.equal(result.status, 1, `${bad}: ${said(result)}`);
    assert.match(result.stderr, /row 2, column «Stock»/);
  }
  // No stock column: no stock file, and nothing said to set.
  const none = freshSite();
  const mapped = { ...mapping, fields: { ...mapping.fields, stock: undefined } };
  const result = run(none.site, none.dir, sheetOf(1, 2), mapped);
  assert.equal(result.status, 0, said(result));
  assert.equal(existsSync(join(none.site, '.jtakeit')), false);
  assert.match(result.stdout, /names no `stock` column/);
});

test('a description holding HTML is made text, and one that holds none is kept as it is', async () => {
  const { htmlText } = await import('../lib/import/products.mjs');
  assert.equal(htmlText('<p>One &amp; two</p><p>Three<br/>four<br />five</p>'), 'One & two\nThree\nfour\nfive');
  assert.equal(htmlText('<h2>Titel</h2>\n<ul>\n<li>Ein</li>\n<li>Zwei &euro; 5</li>\n</ul>'), 'Titel\nEin\nZwei € 5');
  assert.equal(htmlText('<p>a &lt;b&gt; &#65;&#x42; &unknown; <em>c</em></p><script>x()</script><style>p{}</style>'), 'a <b> AB &unknown; c');
  assert.equal(htmlText('Line one\r\nLine two: a < b & c'), 'Line one\nLine two: a < b & c', 'text already: its line breaks and its characters as they are');
  assert.equal(htmlText('<p></p>'), '');
});
