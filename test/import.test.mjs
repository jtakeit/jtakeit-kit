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
  // More digits than the currency has are refused, zeros included (Ruling 236): 12.500 is no 12.50 and 12,500 no 12.50 either.
  for (const bad of ['12.500', '12.505', '12.999', '-3', '+3', '1,250.00', 'CHF 12.50', '12.50 CHF', '12,50', '1e3', '.5', '12.', '']) {
    const refused = price(bad);
    assert.equal(refused.result.status, 1, `${bad}: ${said(refused.result)}`);
    assert.match(refused.result.stderr, /row 2, column «Price»/, bad);
    assert.deepEqual(entriesOf(refused.site), [], `${bad}: nothing written`);
  }
  assert.match(price('12.505').result.stderr, /has 3 digits after the point and CHF has 2 — nothing is rounded/);
  assert.match(price('12.500').result.stderr, /has 3 digits after the point and CHF has 2 — nothing is rounded, and a zero at the end is no way round it/);
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
  assert.match(same.stderr, /rows 2 and 3, column «Size»: pick the same values \(S\)/);
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
  assert.deepEqual(entriesOf(site), ['alpha.json', 'groesse-ae.json', 'kerze-2.json', 'kerze-3.json', 'kerze.json', 'media-2.json']);
  const sku = (slug) => entry(site, slug).fields.variants[0].sku;
  assert.deepEqual(['kerze', 'kerze-2', 'kerze-3', 'groesse-ae', 'alpha'].map(sku), ['KERZE', 'KERZE-2-2', 'KERZE-2', 'GROESSE-AE', 'kerze-rot']);
  // Ranks follow the sheet.
  const ranks = ['kerze', 'kerze-2', 'kerze-3', 'groesse-ae', 'alpha'].map((slug) => entry(site, slug).rank);
  assert.deepEqual(ranks, [...ranks].sort());

  const kerze = structuredClone(entry(site, 'kerze'));

  // A second sheet: a made SKU steps round one the collection holds, in any case — and a name the collection has is
  // a product with SKUs of its own, so it is another one, numbered past what is there.
  const more = run(site, dir, 'Name,SKU,Price\nKerze Rot,,4\nKerze,NEW-1,5\n', mapping);
  assert.equal(more.status, 0, said(more));
  assert.equal(sku('kerze-rot'), 'KERZE-ROT-2');
  assert.equal(sku('kerze-4'), 'NEW-1');
  assert.ok(entry(site, 'kerze-4').rank > ranks.at(-1), 'after the last of the collection');
  assert.deepEqual(entry(site, 'kerze'), kerze, 'the Kerze the collection has is as it was, every field');
  assert.equal(sku('kerze'), 'KERZE');
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
  const { htmlText } = await import('../lib/import/sheet.mjs');
  assert.equal(htmlText('<p>One &amp; two</p><p>Three<br/>four<br />five</p>'), 'One & two\nThree\nfour\nfive');
  assert.equal(htmlText('<h2>Titel</h2>\n<ul>\n<li>Ein</li>\n<li>Zwei &euro; 5</li>\n</ul>'), 'Titel\nEin\nZwei € 5');
  assert.equal(htmlText('<p>a &lt;b&gt; &#65;&#x42; &unknown; <em>c</em></p><script>x()</script><style>p{}</style>'), 'a <b> AB &unknown; c');
  assert.equal(htmlText('Line one\r\nLine two: a < b & c'), 'Line one\nLine two: a < b & c', 'text already: its line breaks and its characters as they are');
  assert.equal(htmlText('<p></p>'), '');
  // Entities are read where there is no tag too, and an angle bracket that starts no element is a character.
  assert.equal(htmlText('Tom &amp; Jerry'), 'Tom & Jerry');
  assert.equal(htmlText('Write to <info@shop.ch> or call'), 'Write to <info@shop.ch> or call');
  assert.equal(htmlText('<p>Write to <info@shop.ch> &amp; <strong>call</strong></p>'), 'Write to <info@shop.ch> & call');
  assert.equal(htmlText('<a href="x">link</a> and <abc> and <3'), 'link and and <3', 'a raw <abc> is tag-shaped and goes: the accepted cost');
  // A tag is known by its shape, not by a list of names (Ruling 238): a name of letters, digits, `:` and `-` that begins with a letter.
  assert.equal(htmlText('<meta charset="utf-8"><p>Hello</p>'), 'Hello');
  assert.equal(htmlText('<html><head><title>t</title></head><body><p>z</p></body></html>'), 'tz', 'a title is text between tags: only the tags go');
  assert.equal(htmlText('<html><body><p>z</p></body></html>'), 'z');
  assert.equal(htmlText('<link rel="stylesheet" href="x"><big>b</big><o:p></o:p><select><option>o</option></select>'), 'bo');
  assert.equal(htmlText('<my-element x=1>hi</my-element>'), 'hi');
  assert.equal(htmlText('<!DOCTYPE html><?xml version="1.0"?><!-- a comment --><p>A<br>B<BR/>C</p>'), 'A\nB\nC');
  // A script, a style and a template go with what they hold: a description of nothing else is none.
  assert.equal(htmlText('<style>p { color: red }</style>'), '');
  assert.equal(htmlText('<script>alert("x")</script>'), '');
  assert.equal(htmlText('<template><p>hidden</p></template>shown'), 'shown');
  // Entities are read after the tags are out: an escaped bracket is the text it says, and a mail address is no tag.
  assert.equal(htmlText('<p>&lt;abc&gt;</p>'), '<abc>');
  assert.equal(htmlText('<p>Mail <info@shop.ch> now</p>'), 'Mail <info@shop.ch> now');
  assert.equal(htmlText('a < b and c > d'), 'a < b and c > d');
});

// ── fix round 1: the options of a WooCommerce product, the panel's addresses, what a sheet may skip and inherit ──

/** Rows of a WooCommerce sheet, with the columns that give a variation its attributes by name and three pairs of them. */
const THREE = 'ID,Type,SKU,Name,Published,Regular price,Parent,Attribute 1 name,Attribute 1 value(s),Attribute 2 name,Attribute 2 value(s),Attribute 3 name,Attribute 3 value(s)';
const threeMapping = () => {
  const mapping = fixtureMapping('woocommerce.json');
  mapping.fields = { title: 'Name', sku: 'SKU', price: 'Regular price', options: [1, 2, 3].map((n) => ({ name: `Attribute ${n} name`, value: `Attribute ${n} value(s)` })) };
  return mapping;
};

test('a variation\'s values are paired to the product\'s options by the names in its own row, never by the column they are in', () => {
  // WooCommerce numbers a variation's attributes from 1 over its own, so with a descriptive attribute (Brand) first on the
  // parent, the variation's first pair is the parent's second: pairing by position made «Brand: S» and «Size: Red».
  const sheet = `${THREE}
20,variable,TEE,Tee,1,,,Brand,Acme,Size,"S, M",Colour,"Red, Blue"
21,variation,TEE-S-R,Tee S R,1,10,id:20,Size,S,Colour,Red,,
22,variation,TEE-M-B,Tee M B,1,10,id:20,Colour,Blue,Size,M,,
`;
  const { dir, site } = freshSite();
  const result = run(site, dir, sheet, threeMapping());
  assert.equal(result.status, 0, said(result));
  const tee = entry(site, 'tee');
  assert.deepEqual(tee.fields.options, [
    { _key: 'size', name: 'Size', values: [{ _key: 's', label: 'S' }, { _key: 'm', label: 'M' }] },
    { _key: 'colour', name: 'Colour', values: [{ _key: 'red', label: 'Red' }, { _key: 'blue', label: 'Blue' }] },
  ], 'the parent\'s order, the attribute no variation uses left out');
  assert.deepEqual(tee.fields.variants.map((one) => [one.sku, one.picks]), [
    ['TEE-S-R', { size: 's', colour: 'red' }],
    ['TEE-M-B', { size: 'm', colour: 'blue' }],
  ], 'a variation that lists Colour first is paired by name all the same');
  assert.match(result.stdout, /tee: «Brand», named on row 2, is valued by no variation: left out of the options/);
  assert.equal(result.stdout.match(/«Brand»/g).length, 1, 'said once for the product');

  // A variation that names an attribute its parent has not got is refused with its row and the column of the name.
  const odd = freshSite();
  const refused = run(odd.site, odd.dir, sheet.replace('22,variation,TEE-M-B,Tee M B,1,10,id:20,Colour,Blue,Size,M,,', '22,variation,TEE-M-B,Tee M B,1,10,id:20,Colour,Blue,Material,Cotton,,'), threeMapping());
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 4, column «Attribute 2 name»: names the option «Material», and the product's first row \(row 2\) names «Brand», «Size», «Colour»/);
  assert.deepEqual(entriesOf(odd.site), []);

  // And one that has the name and no value picks nothing of that option: refused, not guessed.
  const any = freshSite();
  const anySize = run(any.site, any.dir, sheet.replace('22,variation,TEE-M-B,Tee M B,1,10,id:20,Colour,Blue,Size,M,,', '22,variation,TEE-M-B,Tee M B,1,10,id:20,Colour,Blue,Size,,,'), threeMapping());
  assert.equal(anySize.status, 1, said(anySize));
  assert.match(anySize.stderr, /row 4, column «Attribute 2 value\(s\)»: has no value of the option «Size»/);
});

test('a simple product\'s attributes describe it and are no options, and the import says what it left out, once', () => {
  const { dir, site } = freshSite();
  const sheet = withCell(withCell(fixture('woocommerce.csv'), 2, 'Attribute 1 name', 'Material'), 2, 'Attribute 1 value(s)', 'Ceramic, Glass');
  const result = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(result.status, 0, said(result));
  const mug = entry(site, 'becher');
  assert.equal('options' in mug.fields, false, 'no Material to pick, ceramic or glass');
  assert.equal('picks' in mug.fields.variants[0], false);
  assert.match(result.stdout, /becher: row 2 gives «Material» as attributes, which describe a product with no variations and are no options \(an option is an attribute its variations name\): left out/);
  assert.equal(result.stdout.match(/«Material»/g).length, 1);
  assert.doesNotMatch(result.stdout, /t-shirt-fox: row/, 'the fox\'s Size and Colour are what its variations name: options');
});

test('an address is made as the panel makes it, and a Ukrainian catalogue imports', async () => {
  const { slugify } = await import('../lib/import/slug.mjs');
  // The panel's own cases (frontend/admin/src/lib/slug.test.ts at jtakeit-core 0e150d8a), and what its slugify answers to others.
  const panel = [
    ['Догляд після сеансу', 'dohlyad-pislya-seansu'], ['Їжак і ґанок', 'yizhak-i-ganok'], ['Що робити', 'shcho-robyty'],
    ['aftercare-week-one', 'aftercare-week-one'], ['Café Kraków', 'cafe-krakow'], ['Grüße', 'gruesse'],
    ['', ''], ['   ', ''], ['!!!', ''], ['  ---  ', ''],
    ['Grösse Ä', 'groesse-ae'], ['Müller Tasse', 'mueller-tasse'], ['Кружка', 'kruzhka'], ['Щука й ЄВРО', 'shchuka-y-yevro'],
    ['Ёлка, ъ и ы', 'elka-y-y'], ['Łódź Żółć', 'lodz-zolc'], ['Ceské Řeka Čaj', 'ceske-reka-caj'], ['Ö1 Ä2 Ü3', 'oe1-ae2-ue3'],
    ['Ville Crème Brûlée', 'ville-creme-brulee'], ['🥐🥐🥐 круасани', 'kruasany'], ['Ціна — 2 000 ₴', 'tsina-2-000'], ['Fuß', 'fuss'],
    ['ǅ', ''], ['a'.repeat(70), 'a'.repeat(60)], ['ab '.repeat(30), 'ab-'.repeat(19) + 'ab'],
  ];
  for (const [title, slug] of panel) assert.equal(slugify(title), slug, JSON.stringify(title));

  // A sheet in Ukrainian, with no slug column (a WooCommerce export has none): every product has its address and its SKU.
  const { dir, site } = freshSite();
  const sheet = 'Назва,Ціна\nКружка,12.50\nЇжак і ґанок,8\n';
  const mapping = { v: 1, decimal: '.', fields: { title: 'Назва', price: 'Ціна' } };
  const result = run(site, dir, sheet, mapping);
  assert.equal(result.status, 0, said(result));
  assert.deepEqual(entriesOf(site), ['kruzhka.json', 'yizhak-i-ganok.json']);
  assert.equal(entry(site, 'kruzhka').fields.title, 'Кружка');
  assert.equal(entry(site, 'kruzhka').fields.variants[0].sku, 'KRUZHKA');
  assert.equal(entry(site, 'yizhak-i-ganok').fields.variants[0].sku, 'YIZHAK-I-GANOK');
  // A second import of the same names, SKU-less, finds the same entries by the same addresses and makes none.
  const again = run(site, dir, sheet, mapping);
  assert.equal(again.status, 0, said(again));
  assert.deepEqual(entriesOf(site), ['kruzhka.json', 'yizhak-i-ganok.json']);
  assert.match(again.stdout, /0 made, 0 updated, 2 left as they are/);

  // A name with no letter an address is made of is refused, with its row and column.
  const none = freshSite();
  const refused = run(none.site, none.dir, 'Назва,Ціна\n!!!,1\n', mapping);
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 2, column «Назва»: «!!!» has no letter or digit an address can be made of/);
});

test('a variation\'s empty weight is its parent row\'s, as WooCommerce reads «same as parent»; its size class and tax code are the product\'s', () => {
  const sheet = withCell(withCell(withCell(fixture('woocommerce.csv'), 3, 'Weight (kg)', '0.2'), 4, 'Weight (kg)', ''), 5, 'Weight (kg)', '0.25');
  const { dir, site } = freshSite();
  const result = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(result.status, 0, said(result));
  // The first variation has none and takes the parent's 0.2 kg, the second its own, the others theirs.
  assert.deepEqual(entry(site, 't-shirt-fox').fields.variants.map((one) => one.weight), [200, 250, 180, 180]);
  // The parent row's own weight is read as the weights are, and refused where it is no whole gram, with the parent's row.
  const bad = freshSite();
  const refused = run(bad.site, bad.dir, withCell(withCell(fixture('woocommerce.csv'), 3, 'Weight (kg)', '0.1805'), 4, 'Weight (kg)', ''), fixtureMapping('woocommerce.json'));
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 3, column «Weight \(kg\)»: «0\.1805» kg is 180\.5 g, not whole grams/);

  // Size class and tax code are the product's: the parent row's cell is the product's, and a variation's own is that or refused.
  const withTwo = (cells) => `${fixture('woocommerce.csv').trimEnd().split('\n').map((row, i) => `${row},${cells[i] ?? ''}`).join('\n')}\n`;
  const mapping = fixtureMapping('woocommerce.json');
  mapping.fields.size_class = 'Class';
  mapping.fields.tax_code = 'Tax';
  // The parent row says bulky and the tax code; a variation says the same, or nothing, or is refused.
  const header = 'Class,Tax';
  const sized = freshSite();
  const ok = run(sized.site, sized.dir, withTwo([header, ',', 'bulky,txcd_35010000', ',', 'bulky,', ',txcd_35010000', ',', ',', ',']), mapping);
  assert.equal(ok.status, 0, said(ok));
  const fox = entry(sized.site, 't-shirt-fox').fields;
  assert.equal(fox.size_class, 'bulky');
  assert.equal(fox.tax_code, 'txcd_35010000');
  const clash = freshSite();
  const differs = run(clash.site, clash.dir, withTwo([header, ',', 'bulky,txcd_35010000', ',', 'letter,', ',', ',', ',', ',']), mapping);
  assert.equal(differs.status, 1, said(differs));
  assert.match(differs.stderr, /row 5, column «Class»: «letter» is not the product's shipping size \(«bulky»\)/);
  assert.deepEqual(entriesOf(clash.site), []);
});

test('a row the mapping skips is no product, no variant and no parent, and each is said', () => {
  const { dir, site } = freshSite();
  const result = run(site, dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'));
  assert.equal(result.status, 0, said(result));
  assert.match(result.stdout, /row 8 skipped: «Type» is «grouped»/);
  assert.match(result.stdout, /row 9 skipped: «Type» is «external»/);
  assert.deepEqual(entriesOf(site), ['becher.en.json', 'becher.json', 't-shirt-fox.en.json', 't-shirt-fox.json']);
  assert.doesNotMatch(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), /SET-1|AFF-1/);

  // Without the key the grouped row is a variant with no price, and the import stops there, as it should.
  const bare = freshSite();
  const mapping = fixtureMapping('woocommerce.json');
  delete mapping.skip;
  const refused = run(bare.site, bare.dir, fixture('woocommerce.csv'), mapping);
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 8, column «Regular price»: is empty on a row that is a variant \(it has the SKU SET-1\)/);
  assert.deepEqual(entriesOf(bare.site), []);

  // A variation of a skipped row has no product to be a variant of: refused, naming the skip.
  const orphan = freshSite();
  const sheet = `${fixture('woocommerce.csv')}32,variation,SET-X,x,,1,,,9.90,,id:30,,,,,\n`;
  const lost = run(orphan.site, orphan.dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(lost.status, 1, said(lost));
  assert.match(lost.stderr, /row 10, column «Parent»: names row 8, which the mapping's `skip` leaves out/);

  // The key is `{ column, values }` with a column the sheet has; the values are compared without regard to case.
  const wrong = freshSite();
  const sheetOnly = 'Type,Name,Price\nGrouped,Set,\nsimple,Becher,5\n';
  const shaped = (skip) => ({ v: 1, decimal: '.', skip, fields: { title: 'Name', price: 'Price' } });
  const cased = run(wrong.site, wrong.dir, sheetOnly, shaped({ column: 'Type', values: ['grouped'] }));
  assert.equal(cased.status, 0, said(cased));
  assert.deepEqual(entriesOf(wrong.site), ['becher.json']);
  for (const skip of [{ column: 'Kind', values: ['x'] }, { column: 'Type', values: [] }, { column: 'Type' }, 'Type']) {
    const bad = run(wrong.site, wrong.dir, sheetOnly, shaped(skip));
    assert.equal(bad.status, 1, JSON.stringify(skip));
    assert.match(bad.stderr, /skip/);
  }
});

test('a number with more digits after the separator than its currency or unit has is refused, zeros included, and never read as a thousand', () => {
  const mapping = (decimal, weight) => ({ v: 1, decimal, fields: { title: 'Name', sku: 'SKU', price: 'Price', weight } });
  const tries = [
    // [price, weight, decimal, unit, what is refused]
    ['1,250', undefined, ',', 'g', 'Price', /«1,250» has 3 digits after the comma and CHF has 2 — nothing is rounded, and a zero at the end is no way round it: it could as well be a thousands separator/],
    ['1.250', undefined, '.', 'g', 'Price', /«1\.250» has 3 digits after the point and CHF has 2/],
    ['12,50', '0,1800', ',', 'kg', 'Weight', /«0,1800» has 4 digits after the comma and kilograms take at most 3 — nothing is rounded, and a zero at the end is no way round it$/m],
    ['12.50', '180.0', '.', 'g', 'Weight', /«180\.0» has 1 digit after the point and grams take no decimals — nothing is rounded, and a zero at the end is no way round it$/m],
    ['12,50', '180,0', ',', 'g', 'Weight', /«180,0» has 1 digit after the comma and grams take no decimals/],
    ['12,50', '1,000', ',', 'g', 'Weight', /«1,000» has 3 digits after the comma and grams take no decimals — nothing is rounded, and a zero at the end is no way round it: it could as well be a thousands separator/],
  ];
  for (const [price, weight, decimal, unit, column, why] of tries) {
    const { dir, site } = freshSite();
    const sheet = `Name,SKU,Price,Weight\nBecher,MUG-1,"${price}","${weight ?? ''}"\n`;
    const refused = run(site, dir, sheet, mapping(decimal, { column: 'Weight', unit }));
    assert.equal(refused.status, 1, `${price} ${weight}: ${said(refused)}`);
    assert.match(refused.stderr, new RegExp(`row 2, column «${column}»`), `${price} ${weight}`);
    assert.match(refused.stderr, why);
    if (decimal === '.') assert.doesNotMatch(refused.stderr, /thousands/, 'a thousands separator is a comma, and the point is the decimal here');
    assert.deepEqual(entriesOf(site), [], 'nothing written, and nothing read as 1.25 or 1250');
  }
  // What is within the digits is exact: 0.180 kg is 180 g, however many zeros a person would not have written.
  const { dir, site } = freshSite();
  const ok = run(site, dir, 'Name,SKU,Price,Weight\nBecher,MUG-1,"12,5","0,180"\n', mapping(',', { column: 'Weight', unit: 'kg' }));
  assert.equal(ok.status, 0, said(ok));
  assert.deepEqual(entry(site, 'becher').fields.variants[0], { _key: 'v1', sku: 'MUG-1', price: { minor: 1250 }, weight: 180 });
});

test('the picks of a second import are said only where the sheet\'s differ on the options the sheet knows', () => {
  const { dir, site } = firstImport();
  // The owner added an option in the panel, which the sheet does not know, and every variant picks it.
  const fox = entry(site, 't-shirt-fox');
  fox.fields.options.push({ _key: 'material', name: 'Material', values: [{ _key: 'cotton', label: 'Cotton' }] });
  for (const variant of fox.fields.variants) variant.picks.material = 'cotton';
  write(site, 'jtk/entries/products/t-shirt-fox.json', fox);
  const edited = snapshot(site);
  // Every variant has its SKU in this sheet (the one without is matched by its picks, which the owner's option would change).
  const sheet = withCell(fixture('woocommerce.csv'), 7, 'SKU', 'T-SHIRT-FOX-M-BLUE');
  const same = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(same.status, 0, said(same));
  assert.doesNotMatch(same.stdout, /another combination/, 'the owner\'s Material is not the sheet\'s to name');
  assert.deepEqual(snapshot(site)['jtk/entries/products/t-shirt-fox.json'], edited['jtk/entries/products/t-shirt-fox.json']);

  // The colours of two variants swapped in the sheet: that is a difference on options it knows, said, and the picks kept.
  const swapped = withCell(withCell(sheet, 4, 'Attribute 2 value(s)', 'Blue'), 6, 'Attribute 2 value(s)', 'Red');
  const second = run(site, dir, swapped, fixtureMapping('woocommerce.json'));
  assert.equal(second.status, 0, said(second));
  assert.match(second.stdout, /row 4: FOX-S-RED is Size S, Colour Blue in the sheet and another combination in t-shirt-fox — its picks are kept/);
  assert.match(second.stdout, /row 6: FOX-S-BLUE is Size S, Colour Red in the sheet and another combination in t-shirt-fox — its picks are kept/);
  assert.deepEqual(snapshot(site)['jtk/entries/products/t-shirt-fox.json'], edited['jtk/entries/products/t-shirt-fox.json']);
});

test('what an import says is capped and counted, as its changes are', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price' } };
  const rows = Array.from({ length: 45 }, (_, n) => `Ding ${n + 1},D-${n + 1},5`);
  const sheet = `Name,SKU,Price\n${rows.join('\n')}\n`;
  const { dir, site } = freshSite();
  assert.equal(run(site, dir, sheet, mapping).status, 0);
  // The owner renamed every one in the panel: forty-five words kept, and each said — as many as fit, and then how many more.
  for (let n = 1; n <= 45; n++) {
    const file = `jtk/entries/products/ding-${n}.json`;
    const one = read(site, file);
    one.fields.title = `Mein Ding ${n}`;
    write(site, file, one);
  }
  const second = run(site, dir, sheet, mapping);
  assert.equal(second.status, 0, said(second));
  assert.equal(second.stdout.match(/title kept/g).length, 40);
  assert.match(second.stdout, /… and 5 more said \(--dry-run says each\)/);
  assert.equal(run(site, dir, sheet, mapping, '--dry-run').stdout.match(/title kept/g).length, 45, 'the dry run says each');
});

test('a second import\'s other paths: a parent named by SKU, a «no value» word among real values, the words of a translation, an empty group cell, two rows of one entry', () => {
  // A variation names its parent by the parent's SKU as well as by id.
  const bySku = freshSite();
  let sheet = fixture('woocommerce.csv');
  for (const line of [4, 5, 6, 7]) sheet = withCell(sheet, line, 'Parent', 'T-SHIRT-FOX');
  const ok = run(bySku.site, bySku.dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(ok.status, 0, said(ok));
  assert.equal(entry(bySku.site, 't-shirt-fox').fields.variants.length, 4);

  // Shopify's «Default Title» for one variant of a product whose others have a value: it is no value, and the row says so.
  const mixed = freshSite();
  const refused = run(mixed.site, mixed.dir, withCell(fixture('shopify.csv'), 4, 'Option1 Value', 'Default Title'), fixtureMapping('shopify.json'));
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /row 4, column «Option1 Value»: says «Default Title», which is no value of the option «Size» — and the product's other variants have one/);

  // A row of a sheet grouped by a column that has no value there belongs to no product.
  const empty = freshSite();
  const rows = fixture('shopify.csv').trimEnd().split('\n');
  rows.push(`,Handleless${','.repeat(12)}`);
  const handleless = run(empty.site, empty.dir, `${rows.join('\n')}\n`, fixtureMapping('shopify.json'));
  assert.equal(handleless.status, 1, said(handleless));
  assert.match(handleless.stderr, /row 8, column «Handle»: is empty: the row belongs to no product/);

  // The words of a translation are kept like the original's, and --words takes the sheet's.
  const { dir, site } = firstImport();
  const english = entry(site, 't-shirt-fox', 'en');
  english.fields.title = 'Fox shirt, our way';
  write(site, 'jtk/entries/products/t-shirt-fox.en.json', english);
  const kept = run(site, dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'));
  assert.equal(kept.status, 0, said(kept));
  assert.match(kept.stdout, /t-shirt-fox: en title kept «Fox shirt, our way», the sheet says «Fox T-shirt»/);
  assert.equal(entry(site, 't-shirt-fox', 'en').fields.title, 'Fox shirt, our way');
  assert.equal(run(site, dir, fixture('woocommerce.csv'), fixtureMapping('woocommerce.json'), '--words').status, 0);
  assert.deepEqual(entry(site, 't-shirt-fox', 'en'), { of: entry(site, 't-shirt-fox').id, locale: 'en', fields: { title: 'Fox T-shirt' } });

  // Two rows of a sheet that are one entry of the site are refused, naming both.
  const twice = freshSite();
  const simple = { v: 1, decimal: '.', fields: { title: 'Name', price: 'Price' } };
  assert.equal(run(twice.site, twice.dir, 'Name,Price\nBecher,5\n', simple).status, 0);
  const both = run(twice.site, twice.dir, 'Name,Price\nBecher,5\nBecher,6\n', simple);
  assert.equal(both.status, 1, said(both));
  assert.match(both.stderr, /rows 2 and 3: are one product of the site, becher, twice/);
});

test('the command in the site\'s own directory, a .gitignore that has the line already or is not there, a site\'s schema that says no shop', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', price: 'Price', stock: 'Stock' } };
  const sheet = 'Name,Price,Stock\nBecher,5,3\n';

  // No --root: the working directory is the site.
  const here = freshSite();
  writeFileSync(join(here.dir, 'sheet.csv'), sheet);
  writeFileSync(join(here.dir, 'mapping.json'), JSON.stringify(mapping));
  const result = spawnSync('node', [bin, 'import', 'products', join(here.dir, 'sheet.csv'), '--map', join(here.dir, 'mapping.json')], { encoding: 'utf8', cwd: here.site });
  assert.equal(result.status, 0, said(result));
  assert.deepEqual(entriesOf(here.site), ['becher.json']);

  // A .gitignore that says it already is left as it is, and one that is not there is made with no blank first line.
  const said_ = freshSite();
  writeFileSync(join(said_.site, '.gitignore'), 'dist/\n.jtakeit/stock*.txt\n');
  assert.equal(run(said_.site, said_.dir, sheet, mapping).status, 0);
  assert.equal(readFileSync(join(said_.site, '.gitignore'), 'utf8'), 'dist/\n.jtakeit/stock*.txt\n');
  const none = freshSite();
  rmSync(join(none.site, '.gitignore'));
  assert.equal(run(none.site, none.dir, sheet, mapping).status, 0);
  assert.match(readFileSync(join(none.site, '.gitignore'), 'utf8'), /^# The starting stock `jtk import products` writes for set_stock/);
  const unended = freshSite();
  writeFileSync(join(unended.site, '.gitignore'), 'dist/');
  assert.equal(run(unended.site, unended.dir, sheet, mapping).status, 0);
  assert.match(readFileSync(join(unended.site, '.gitignore'), 'utf8'), /^dist\/\n\n# The starting stock/);

  // A schema without the shop, or without the collection a mapping names: refused with the one command that writes it.
  const noShop = freshSite();
  const schema = read(noShop.site, 'jtk/schema.json');
  delete schema.modules;
  write(noShop.site, 'jtk/schema.json', schema);
  const stale = run(noShop.site, noShop.dir, sheet, mapping);
  assert.equal(stale.status, 1, said(stale));
  assert.match(stale.stderr, /the site: has no products collection: jtk\/schema\.json says no `modules\.shop\.products`\. `jtk schema` writes it from the declaration/);
  const other = freshSite();
  const wrongCollection = run(other.site, other.dir, sheet, { ...mapping, collection: 'wares' });
  assert.equal(wrongCollection.status, 1, said(wrongCollection));
  assert.match(wrongCollection.stderr, /has no collection «wares» in jtk\/schema\.json \(its collections: services, team, products\) — `jtk schema` writes/);

  // An entry the sheet is matched to that has no id is refused with the sheet's row and column.
  const idless = freshSite();
  assert.equal(run(idless.site, idless.dir, sheet, mapping).status, 0);
  const becher = entry(idless.site, 'becher');
  delete becher.id;
  write(idless.site, 'jtk/entries/products/becher.json', becher);
  const noId = run(idless.site, idless.dir, 'Name,Price,Stock\nBecher,6,3\n', mapping);
  assert.equal(noId.status, 1, said(noId));
  assert.match(noId.stderr, /row 2, column «Name»: the entry it matches, jtk\/entries\/products\/becher\.json, has no id/);
});

test('the stock files are the import\'s, replaced whole: one of an earlier import is never left to be set as this sheet\'s', () => {
  const withStock = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price', stock: 'Stock' } };
  const withoutStock = { v: 1, decimal: '.', fields: { title: 'Name', sku: 'SKU', price: 'Price' } };
  const { dir, site } = freshSite();
  assert.equal(run(site, dir, 'Name,SKU,Price,Stock\nBecher,MUG-1,5,3\n', withStock).status, 0);
  writeFileSync(join(site, '.jtakeit/stock-2.txt'), 'OLD-1 9\n');

  // A sheet with no stock column: the files stay, and are said to be an earlier sheet's.
  const none = run(site, dir, 'Name,SKU,Price\nBecher,MUG-1,6\n', withoutStock);
  assert.equal(none.status, 0, said(none));
  assert.match(none.stdout, /\.jtakeit\/stock\.txt and \.jtakeit\/stock-2\.txt are an earlier import's, and the mapping names no `stock` column: they hold that sheet's counts, not this one's/);
  assert.equal(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), 'MUG-1 3\n');

  // A stock column that is empty on every row replaces them with nothing: the files go, and it says so.
  const empty = run(site, dir, 'Name,SKU,Price,Stock\nBecher,MUG-1,6,\n', withStock);
  assert.equal(empty.status, 0, said(empty));
  assert.match(empty.stdout, /no row of the sheet has a stock: \.jtakeit\/stock\.txt and \.jtakeit\/stock-2\.txt of an earlier import are taken away/);
  assert.equal(existsSync(join(site, '.jtakeit/stock.txt')) || existsSync(join(site, '.jtakeit/stock-2.txt')), false);
  assert.doesNotMatch(empty.stdout, /set_stock, with the text/);

  // A stock file of the sheet's replaces the first whole, and a second file beyond its lines is taken away (the stock test above has 5,001).
  mkdirSync(join(site, '.jtakeit'), { recursive: true });
  writeFileSync(join(site, '.jtakeit/stock-2.txt'), 'OLD-2 1\n');
  assert.equal(run(site, dir, 'Name,SKU,Price,Stock\nBecher,MUG-1,6,4\n', withStock).status, 0);
  assert.equal(readFileSync(join(site, '.jtakeit/stock.txt'), 'utf8'), 'MUG-1 4\n');
  assert.equal(existsSync(join(site, '.jtakeit/stock-2.txt')), false);
});

// ── fix round 2 ───────────────────────────────────────────────────────────

test('a description from a page\'s head and body is the text of it, and one that is only a style or a script is none', () => {
  const mapping = { v: 1, decimal: '.', fields: { title: 'Name', description: 'Body', price: 'Price' } };
  const cells = [
    ['Mit Kopf', '<meta charset="utf-8"><p>Hello &amp; welcome</p>'],
    ['Mit Seite', '<html><body><p>One</p><p>Two</p></body></html>'],
    ['Nur Stil', '<style>p { margin: 0 }</style>'],
    ['Nur Skript', '<script>track()</script>'],
    ['Mit Mail', '<p>Write to <info@shop.ch></p>'],
  ];
  const { dir, site } = freshSite();
  const sheet = `Name,Body,Price\n${cells.map(([name, body]) => `${name},"${body.replaceAll('"', '""')}",5`).join('\n')}\n`;
  const result = run(site, dir, sheet, mapping);
  assert.equal(result.status, 0, said(result));
  assert.equal(entry(site, 'mit-kopf').fields.description, 'Hello & welcome');
  assert.equal(entry(site, 'mit-seite').fields.description, 'One\nTwo');
  assert.equal('description' in entry(site, 'nur-stil').fields, false, 'a style is no description');
  assert.equal('description' in entry(site, 'nur-skript').fields, false, 'a script is no description');
  assert.equal(entry(site, 'mit-mail').fields.description, 'Write to <info@shop.ch>');
});

test('a bad parent weight is refused once, on its own row, however many variations would have taken it', () => {
  // The parent's 0.1805 kg is no whole gram; the four variations have none of their own and would each have taken it.
  let sheet = withCell(fixture('woocommerce.csv'), 3, 'Weight (kg)', '0.1805');
  for (const line of [4, 5, 6, 7]) sheet = withCell(sheet, line, 'Weight (kg)', '');
  const { dir, site } = freshSite();
  const refused = run(site, dir, sheet, fixtureMapping('woocommerce.json'));
  assert.equal(refused.status, 1, said(refused));
  assert.match(refused.stderr, /^jtk import products: 1 thing refused, and nothing was written:\n  row 3, column «Weight \(kg\)»: «0\.1805» kg is 180\.5 g, not whole grams/);
  assert.equal(refused.stderr.match(/row 3/g).length, 1);
  assert.deepEqual(entriesOf(site), []);

  // A parent weight no variation takes is never read: each has its own.
  const own = freshSite();
  const ok = run(own.site, own.dir, withCell(fixture('woocommerce.csv'), 3, 'Weight (kg)', '0.1805'), fixtureMapping('woocommerce.json'));
  assert.equal(ok.status, 0, said(ok));
});

test('a variation\'s attribute name is the product\'s option without regard to case or the spaces round it, and the option keeps the first row\'s spelling', () => {
  // The variations write the names in their own case, with spaces, and in an order of their own.
  const fixed = [
    THREE,
    '20,variable,TEE,Tee,1,,,Size,"S, M",Colour,"Red, Blue",,',
    '21,variation,TEE-S-R,Tee S R,1,10,id:20, SIZE ,S,colour,Red,,',
    '22,variation,TEE-M-B,Tee M B,1,10,id:20,Colour ,Blue,sIzE,M,,',
  ].join('\n');
  const { dir, site } = freshSite();
  const result = run(site, dir, `${fixed}\n`, threeMapping());
  assert.equal(result.status, 0, said(result));
  const tee = entry(site, 'tee');
  assert.deepEqual(tee.fields.options.map((one) => [one._key, one.name]), [['size', 'Size'], ['colour', 'Colour']], 'as the first row wrote them');
  assert.deepEqual(tee.fields.variants.map((one) => one.picks), [{ size: 's', colour: 'red' }, { size: 'm', colour: 'blue' }]);

  // Two option names of one product that differ in case alone are one name twice.
  const twice = freshSite();
  const clash = run(twice.site, twice.dir, `${THREE}\n20,variable,TEE,Tee,1,,,Size,"S, M",size,"Red, Blue",,\n21,variation,TEE-S-R,Tee S R,1,10,id:20,Size,S,,,,\n`, threeMapping());
  assert.equal(clash.status, 1, said(clash));
  assert.match(clash.stderr, /row 2, column «Attribute 2 name»: the option «size» is named twice/);
});
