// `jtk schema` (lib/schema.mjs): a contract-3 site's jtk/schema.json written
// from a declaration that says CONTRACT = 3, judged offline by the platform's
// rules (lib/judge3.mjs), and checked against the built page in the grammar
// by key — and contract 2's declaration and file left as they were.
//
// Two fixtures are the platform's, copied read-only from jtakeit-core
// (backend/api/registry/testdata, at 4ce8af97): kit-schema.json, which is the
// schema content-v3.test.mjs reads, as the platform's registry is tested on
// it; and contract3-exam.json, the exam the platform's judge of contract 3
// sits (TestTheContract3Exam). Copied, not fetched, so this suite runs
// offline; a change on the platform's side is found by `jtk schema --judge`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judgeSchema } from '../lib/judge3.mjs';
import { contractOfDeclaration, schemaOf, schemaText } from '../lib/schema.mjs';

const tool = fileURLToPath(new URL('../lib/schema.mjs', import.meta.url));
const catalogueTool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));
const fixture = (name) => readFileSync(new URL(`./fixtures/platform/${name}`, import.meta.url), 'utf8');

/**
 * The kit's contract-3 fixtures (content-v3.test.mjs), declared as a site
 * declares them: one export per table, in §3's words, typed by the kit.
 * Its parts, so a test can put them in another order.
 */
const PARTS = {
  head: `import type { Block, Collection, Field, Modules } from '@jtakeit/kit/schema';
const ce = { client_editable: true } as const;
`,
  contract: 'export const CONTRACT = 3;\n',
  locale: "export const LOCALE = 'de';\nexport const LOCALES: string[] = ['en', 'fr-CH'];\n",
  blocks: `export const BLOCKS: Block[] = [
  { type: 'hero', v: 1, label: 'Hero', fields: [
    { key: 'title', label: 'Title', kind: 'text', ...ce },
    { key: 'lead', label: 'Lead', kind: 'textarea', ...ce },
    { key: 'image', label: 'Photo', kind: 'media', ...ce },
    { key: 'link', label: 'Link', kind: 'url' },
  ] },
  { type: 'prices', v: 1, label: 'Prices', fields: [
    { key: 'title', label: 'Title', kind: 'text', ...ce },
    { key: 'items', label: 'Rows', kind: 'list', of: [
      { key: 'title', label: 'Name', kind: 'text', ...ce },
      { key: 'price', label: 'Price', kind: 'money', qualifiers: ['from', 'on_request'], ...ce },
      { key: 'photo', label: 'Photo', kind: 'media', ...ce },
      { key: 'options', label: 'Options', kind: 'list', of: [{ key: 'label', label: 'Label', kind: 'text', ...ce }] },
    ] },
  ] },
  { type: 'text', v: 1, label: 'Text', fields: [{ key: 'body', label: 'Text', kind: 'markdown', ...ce }] },
  { type: 'gallery', v: 1, label: 'Gallery', views: [{ key: 'grid', label: 'Grid', min: 1 }], fields: [
    { key: 'items', label: 'Pictures', kind: 'media', multiple: true, ...ce },
  ] },
  { type: 'contacts', v: 1, label: 'Contacts', fields: [
    { key: 'name', label: 'Name', kind: 'text', role: 'name', ...ce },
    { key: 'phone', label: 'Phone', kind: 'tel', role: 'phone', ...ce },
  ] },
  { type: 'work', v: 1, label: 'Work', fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true, ...ce },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'cover', label: 'Cover', kind: 'media', ...ce },
    { key: 'pictures', label: 'Pictures', kind: 'media', multiple: true, ...ce },
    { key: 'price', label: 'Price', kind: 'money', ...ce },
    { key: 'section', label: 'Section', kind: 'select', options: [{ value: 'wood', label: { de: 'Holz', en: 'Wood' } }, { value: 'stone' }] },
    { key: 'category', label: 'Category', kind: 'ref', ref: { to: ['categories'] } },
    { key: 'tags', label: 'Tags', kind: 'ref', ref: { to: ['tags'], many: true } },
    { key: 'body', label: 'Text', kind: 'markdown', ...ce },
  ] },
  { type: 'category', v: 1, label: 'Category', fields: [
    { key: 'title', label: 'Name', kind: 'text', required: true, ...ce },
    { key: 'parent', label: 'Parent', kind: 'ref', ref: { to: ['categories'] } },
  ] },
  { type: 'rate', v: 1, label: 'Rate', fields: [
    { key: 'title', label: 'Name', kind: 'text', required: true, ...ce },
    { key: 'costs', label: 'Price', kind: 'money', ...ce },
    { key: 'category', label: 'Category', kind: 'ref', ref: { to: ['categories'] } },/*TAKES*/
  ] },
  { type: 'tag', v: 1, label: 'Tag', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true, ...ce }] },
];
`,
  seo: `export const PAGE_SEO: Field[] = [{ key: 'title', label: 'Title', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }];
`,
  shared: "export const SHARED: string[] = ['contacts'];\n",
  collections: `export const COLLECTIONS: Collection[] = [
  { name: 'works', label: { de: 'Werke', en: 'Works' }, type: 'work', route: { detail: { de: '/werke/{slug}', en: '/works/{slug}' }, listing: { de: '/werke', en: '/works' }, per_page: 2 }, order: { by: 'date', desc: true }, group: 'section', blocks: ['text', 'gallery'] },
  { name: 'categories', label: 'Categories', type: 'category', route: { detail: '/kategorien/{slug}' }, untranslated: 'hide' },
  { name: 'rates', label: 'Rates', type: 'rate', route: 'none', shown_on: ['/preise#{slug}'], order: 'manual', group: 'category' },
  { name: 'tags', label: 'Tags', type: 'tag', route: { detail: '/tags/{slug}' } },
];
`,
  modules: "export const MODULES: Modules = { bookings: { services: 'rates', resources: 'works' } };\n",
};
const ORDER = ['head', 'contract', 'locale', 'blocks', 'seo', 'shared', 'collections', 'modules'];
const declaration = (order = ORDER, change = (text) => text) => change(order.map((part) => PARTS[part]).join('\n'));
/** The diary's services must take a length: the platform's own `withTakes`. */
const withTakes = (text) => text.replace('/*TAKES*/', "\n    { key: 'takes', label: 'Dauer', kind: 'duration' },");

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-schema-'));
  for (const [path, value] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  }
  return root;
}
const run = (root, ...args) => spawnSync('node', [tool, '--root', root, '--generator', 'test', ...args], { encoding: 'utf8' });

test('a declaration that says CONTRACT = 3 emits the kit\'s fixture schema byte for byte — the platform\'s copy of it', async () => {
  const root = tree({ 'src/content/blocks.ts': declaration() });
  try {
    const declared = await import(pathToFileURL(join(root, 'src/content/blocks.ts')).href);
    assert.equal(contractOfDeclaration(declared), 3);
    assert.equal(schemaText(schemaOf(declared, { generator: 'test' })), fixture('kit-schema.json'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the exports in any order write the same bytes', async () => {
  const one = tree({ 'src/content/blocks.ts': declaration() });
  const other = tree({ 'src/content/blocks.ts': declaration(['head', 'modules', 'collections', 'shared', 'seo', 'blocks', 'locale', 'contract']) });
  try {
    const read = async (root) => schemaText(schemaOf(await import(pathToFileURL(join(root, 'src/content/blocks.ts')).href), { generator: 'test' }));
    assert.equal(await read(other), await read(one));
  } finally {
    rmSync(one, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

test('the platform\'s exam of contract 3, sat offline: every specimen gets its code at its place, every good schema nothing', () => {
  const exam = JSON.parse(fixture('contract3-exam.json'));
  assert.ok(exam.cases.length > 40);
  for (const specimen of exam.cases) {
    const found = judgeSchema(JSON.stringify(specimen.catalogue));
    if (specimen.expect === '') {
      assert.deepEqual(found, [], specimen.name);
    } else {
      assert.ok(found.some((one) => one.code === specimen.expect && (specimen.at === undefined || one.path === specimen.at)), `${specimen.name}: expected ${specimen.expect} at ${specimen.at}, said ${JSON.stringify(found)}`);
    }
  }
});

test('the kit\'s fixture: the one thing the platform says of it, and nothing with a length on its rates', () => {
  // As the platform's TestTheKitsSchemaIsReadAsContract3: its diary's
  // services are rates that carry no `takes`.
  const found = judgeSchema(fixture('kit-schema.json'));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].code, 'JTK_E_MODULE_ROLE_INVALID');
  assert.equal(found[0].path, 'modules.bookings.services');
  assert.match(found[0].says, /"takes"/);
  const schema = JSON.parse(fixture('kit-schema.json'));
  schema.blocks.find((one) => one.type === 'rate').fields.push({ key: 'takes', label: 'Dauer', kind: 'duration' });
  assert.deepEqual(judgeSchema(JSON.stringify(schema)), []);
});

test('jtk schema refuses what the platform refuses, writes what it reads, and the file is stable', () => {
  const root = tree({ 'src/content/blocks.ts': declaration() });
  try {
    const refused = run(root, '--emit-only');
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stderr, /✗ JTK_E_MODULE_ROLE_INVALID {2}modules\.bookings\.services: "rates" is the bookings module's services/);
    assert.equal(existsSync(join(root, 'jtk', 'schema.json')), false, 'a schema the platform refuses is not written');

    writeFileSync(join(root, 'src/content/blocks.ts'), declaration(ORDER, withTakes));
    const written = run(root, '--emit-only');
    assert.equal(written.status, 0, written.stderr);
    assert.match(written.stdout, /jtk\/schema\.json — 9 block type\(s\), 26 field\(s\)/);
    // The languages are said as the platform holds them before M3.
    assert.match(written.stderr, /names languages besides its own \(en, fr-CH\).*JTK_E_TRANSLATION_BEFORE_M_THREE/);
    const expected = JSON.parse(fixture('kit-schema.json'));
    expected.blocks.find((one) => one.type === 'rate').fields.push({ key: 'takes', label: 'Dauer', kind: 'duration' });
    const text = readFileSync(join(root, 'jtk', 'schema.json'), 'utf8');
    assert.equal(text, `${JSON.stringify(expected, null, 2)}\n`);
    assert.equal(existsSync(join(root, 'jtk', 'catalogue.json')), false, 'never a catalogue');

    // Run again, the same bytes.
    assert.equal(run(root, '--emit-only').status, 0);
    assert.equal(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8'), text);

    // The module the schema turns on gets its settings, `{ v, settings }`, once.
    assert.equal(readFileSync(join(root, 'jtk', 'modules', 'bookings.json'), 'utf8'), '{\n  "v": 1,\n  "settings": {}\n}\n');
    writeFileSync(join(root, 'jtk', 'modules', 'bookings.json'), '{"v":1,"settings":{"zone":"Europe/Zurich"}}');
    assert.equal(run(root, '--emit-only').status, 0);
    assert.equal(readFileSync(join(root, 'jtk', 'modules', 'bookings.json'), 'utf8'), '{"v":1,"settings":{"zone":"Europe/Zurich"}}', 'the owner\'s settings are never written over');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a contract-2 declaration is said to be jtk catalogue\'s, and nothing is written', () => {
  const blocks = [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text' }] }];
  const root = tree({ 'src/content/blocks.ts': `export const BLOCKS = ${JSON.stringify(blocks)};\nexport const BUSINESS_FACTS = [];\n` });
  try {
    const said = run(root);
    assert.equal(said.status, 1);
    assert.match(said.stderr, /is contract 2's — it does not say CONTRACT = 3 — and jtk catalogue writes its file, jtk\/catalogue\.json; jtk schema writes nothing for it/);
    assert.equal(existsSync(join(root, 'jtk')), false);

    writeFileSync(join(root, 'src/content/blocks.ts'), 'export const CONTRACT = 4;\n');
    const four = run(root);
    assert.equal(four.status, 1);
    assert.match(four.stderr, /CONTRACT is 4 — a declaration says CONTRACT = 3, or nothing at all for contract 2/);

    // And contract 2's tool writes contract 2's file from it, as before.
    writeFileSync(join(root, 'src/content/blocks.ts'), `export const BLOCKS = ${JSON.stringify(blocks)};\n`);
    const two = spawnSync('node', [catalogueTool, '--emit-only', '--root', root, '--generator', 'test'], { encoding: 'utf8' });
    assert.equal(two.status, 0, two.stderr);
    assert.equal(readFileSync(join(root, 'jtk', 'catalogue.json'), 'utf8'), `${JSON.stringify({ contract: 2, generator: 'test', blocks, page_seo: [], business_facts: [] }, null, 2)}\n`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('jtk catalogue writes no catalogue of a declaration that says CONTRACT = 3', () => {
  const root = tree({ 'src/content/blocks.ts': declaration(ORDER, withTakes) });
  try {
    const said = spawnSync('node', [catalogueTool, '--emit-only', '--root', root, '--generator', 'test'], { encoding: 'utf8' });
    assert.equal(said.status, 1);
    assert.match(said.stderr, /says CONTRACT = 3, and its file is jtk\/schema\.json, which jtk schema writes from it — no jtk\/catalogue\.json is written/);
    assert.equal(existsSync(join(root, 'jtk', 'catalogue.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('contract 2\'s words in a contract-3 declaration are refused in the judge\'s: business facts, a prefix, an option as a word', () => {
  const root = tree({
    'src/content/blocks.ts': `export const CONTRACT = 3;
export const LOCALE = 'de';
export const BLOCKS = [{ type: 'work', v: 1, label: 'Werk', fields: [
  { key: 'title', label: 'Titel', kind: 'text', required: true },
  { key: 'tone', label: 'Ton', kind: 'select', options: ['dark'] },
] }];
export const COLLECTIONS = [{ name: 'works', label: 'Werke', type: 'work', prefix: '/werke' }];
export const BUSINESS_FACTS = [{ key: 'phone', label: 'Telefon', kind: 'tel' }];
`,
  });
  try {
    const said = run(root, '--emit-only');
    assert.equal(said.status, 2);
    // The keys first, every one at once, and nothing else until they are gone.
    assert.match(said.stderr, /✗ JTK_E_SCHEMA_KEY_UNKNOWN {2}business_facts: business_facts is contract 2's — contract 3 has no business facts/);
    assert.match(said.stderr, /✗ JTK_E_SCHEMA_KEY_UNKNOWN {2}collections\.works\.prefix: collections\.works\.prefix is contract 2's — where the entries live is the collection's route/);
    assert.doesNotMatch(said.stderr, /JTK_E_SELECT_NO_OPTIONS/);
    assert.equal(existsSync(join(root, 'jtk', 'schema.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a stray jtk/catalogue.json is said and left; the names are minted on the tree the schema makes contract 3', () => {
  const root = tree({
    'src/content/blocks.ts': `export const CONTRACT = 3;
export const LOCALE = 'de';
export const BLOCKS = [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Titel', kind: 'text', client_editable: true }] }];
`,
    'jtk/pages/index.json': { path: '/', name: 'Start', blocks: [{ type: 'hero', v: 1, title: 'Hallo' }] },
    'jtk/catalogue.json': '{"contract":2,"blocks":[]}',
  });
  try {
    const said = run(root, '--emit-only');
    assert.equal(said.status, 1, said.stderr);
    assert.match(said.stderr, /jtk\/catalogue\.json is contract 2's schema, beside contract 3's jtk\/schema\.json, and the platform refuses a tree with both — remove it/);
    assert.equal(readFileSync(join(root, 'jtk', 'catalogue.json'), 'utf8'), '{"contract":2,"blocks":[]}', 'said, not deleted');
    assert.match(said.stdout, /jtk\/pages\/index\.json — an id and 1 _key\(s\) minted/);
    const home = JSON.parse(readFileSync(join(root, 'jtk', 'pages', 'index.json'), 'utf8'));
    assert.match(home.id, /^[0-9a-f-]{36}$/);
    assert.match(home.blocks[0]._key, /^k[0-9a-f]{7}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── against the page ───────────────────────────────────────────────────────

const HOME = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21';
const OAK = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55';
const CUT = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a71';

/** A small contract-3 site: a page, a routed entry, an entry shown on the page, the shared text. */
function site(page, entry = '') {
  return tree({
    'src/content/blocks.ts': `export const CONTRACT = 3;
export const LOCALE = 'de';
const ce = { client_editable: true };
export const BLOCKS = [
  { type: 'hero', v: 1, label: 'Hero', fields: [
    { key: 'title', label: 'Titel', kind: 'text', ...ce },
    { key: 'image', label: 'Bild', kind: 'media', ...ce },
    { key: 'note', label: 'Notiz', kind: 'text' },
    { key: 'items', label: 'Zeilen', kind: 'list', of: [{ key: 'title', label: 'Name', kind: 'text', ...ce }, { key: 'price', label: 'Preis', kind: 'money', ...ce }] },
  ] },
  { type: 'contacts', v: 1, label: 'Kontakt', fields: [{ key: 'phone', label: 'Telefon', kind: 'tel', role: 'phone', ...ce }, { key: 'name', label: 'Name', kind: 'text', role: 'name', ...ce }] },
  { type: 'work', v: 1, label: 'Werk', fields: [{ key: 'title', label: 'Titel', kind: 'text', required: true, ...ce }, { key: 'pictures', label: 'Bilder', kind: 'media', multiple: true, ...ce }] },
  { type: 'rate', v: 1, label: 'Tarif', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true, ...ce }] },
];
export const SHARED = ['contacts'];
export const COLLECTIONS = [
  { name: 'works', label: 'Werke', type: 'work', route: { detail: '/werke/{slug}' } },
  { name: 'rates', label: 'Tarife', type: 'rate', route: 'none', shown_on: ['/#{slug}'] },
];
`,
    'jtk/pages/index.json': {
      id: HOME, path: '/', name: 'Start',
      blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Hallo', image: { src: 'media/x.jpg', alt: 'Tür' }, note: 'still', items: [{ _key: 'r1', title: 'Schnitt', price: { minor: 4500 } }] }],
    },
    'jtk/entries/works/eiche.json': { id: OAK, collection: 'works', slug: 'eiche', visible: true, fields: { title: 'Eiche', pictures: [{ _key: 'g1', src: 'media/y.jpg' }] } },
    'jtk/entries/rates/schnitt.json': { id: CUT, collection: 'rates', slug: 'schnitt', visible: true, fields: { title: 'Schnitt' } },
    'jtk/shared.json': { blocks: [{ _key: 'contacts', type: 'contacts', v: 1, phone: '+41 1', name: 'Salon' }] },
    'dist/index.html': `<html><body>${page}</body></html>`,
    'dist/werke/eiche/index.html': `<html><body>${entry}</body></html>`,
  });
}
const shared = '<footer><a data-jtk-path="shared:blocks[contacts].phone">+41 1</a><b data-jtk-path="shared:blocks[contacts].name">Salon</b></footer>';
const HOME_PAGE = [
  '<h1 data-jtk-path="blocks[hero].title">Hallo</h1>',
  '<img data-jtk-path="blocks[hero].image.src" alt="Tür">',
  '<p data-jtk-path="blocks[hero].items[r1].title">Schnitt</p><p data-jtk-path="blocks[hero].items[r1].price">45.–</p>',
  `<p id="schnitt" data-jtk-path="entry:${CUT}:title">Schnitt</p>`,
  shared,
].join('');
const OAK_PAGE = `<h1 data-jtk-path="title">Eiche</h1><img data-jtk-path="pictures[g1].src" alt="">${shared}`;
const checked = (page, entry) => {
  const root = site(page, entry);
  try {
    const said = run(root, '--dist', join(root, 'dist'));
    return { status: said.status, out: `${said.stdout}\n${said.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('the page agrees: every value the owner taps annotated by key, and every annotation declared', () => {
  const { status, out } = checked(HOME_PAGE, OAK_PAGE);
  assert.match(out, /the schema and the page agree/);
  assert.match(out, /every sentence on the page belongs to somebody/);
  assert.equal(status, 0, out);
});

test('a declared field the page does not draw, a shared one drawn nowhere, an entry without a page annotated nowhere', () => {
  const page = HOME_PAGE.replace(' data-jtk-path="blocks[hero].title"', ' data-jtk-fixed').replace(`<p id="schnitt" data-jtk-path="entry:${CUT}:title">Schnitt</p>`, '');
  const { status, out } = checked(page, OAK_PAGE.replace(' data-jtk-path="pictures[g1].src"', '').replaceAll(shared, ''));
  assert.match(out, /✗ \/: blocks\[hero\]\.title is declared and the page does not render it/);
  assert.match(out, /✗ \/werke\/eiche: pictures\[g1\]\.src is declared and the page does not render it/);
  assert.match(out, new RegExp(`✗ rates/schnitt: entry:${CUT}:title is on no page`));
  assert.equal(status, 3);
});

test('an annotation nobody declared, one by index, one of a document the site has not got — and a field outside the rule may be annotated', () => {
  const page = HOME_PAGE
    + '<p data-jtk-path="blocks[hero].note">still</p>'
    + '<p data-jtk-path="blocks[hero].ghost">Boo</p>'
    + '<p data-jtk-path="blocks[0].title">Hallo</p>'
    + '<p data-jtk-path="entry:0193a5c3-0000-7000-8000-000000000000:title">Nobody</p>'
    + '<p data-jtk-path="shared:blocks[contacts].fax">Fax</p>';
  const { status, out } = checked(page, OAK_PAGE);
  assert.doesNotMatch(out, /blocks\[hero\]\.note/, 'declared and not the owner\'s to tap: accepted where it is annotated');
  assert.match(out, /✗ \/: blocks\[hero\]\.ghost is on the page and the schema does not declare it/);
  assert.match(out, /✗ \/: blocks\[0\]\.title names a place by its index — contract 3 names a block and a row by its _key/);
  assert.match(out, /✗ \/: entry:0193a5c3-0000-7000-8000-000000000000:title names an entry this site has not got/);
  assert.match(out, /✗ \/: shared:blocks\[contacts\]\.fax is on the page and the schema does not declare it/);
  assert.equal(status, 4);
});

test('a sentence nobody claimed is said, as jtk catalogue says it', () => {
  const { status, out } = checked(`${HOME_PAGE}<p>Words in the template</p>`, OAK_PAGE);
  assert.match(out, /1 sentence\(s\) on the page belong to nobody/);
  assert.match(out, /✗ <p> {2}Words in the template/);
  assert.equal(status, 1);
});

// ── --judge ────────────────────────────────────────────────────────────────

/** A judge on localhost that answers `verdict` and keeps what it was sent. */
async function judge(verdict) {
  const sent = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      sent.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(verdict));
    });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { api: `http://127.0.0.1:${server.address().port}`, sent, close: () => server.close() };
}
const runAsync = (root, env, ...args) =>
  new Promise((done) => {
    const child = spawn('node', [tool, '--root', root, '--generator', 'test', ...args], { env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('close', (status) => done({ status, out }));
  });

test('--judge sends the schema as text and the jtk/ files beside it — not the schema again, not the session — and says where the two disagree', async () => {
  const root = tree({
    'src/content/blocks.ts': `export const CONTRACT = 3;
export const LOCALE = 'de';
export const BLOCKS = [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Titel', kind: 'text' }] }];
`,
    'jtk/schema.json': '{"contract":3}',
    'jtk/session.json': '{"key":"secret"}',
    'jtk/pages/index.json': { id: HOME, path: '/', name: 'Start', blocks: [] },
  });
  const agreeing = await judge({ ok: true, contract: 2, findings: [], advice: [] });
  try {
    const env = { JTK_API: agreeing.api, JTK_TOKEN: 'jtk_test' };
    const said = await runAsync(root, env, '--emit-only', '--judge');
    assert.equal(said.status, 0, said.out);
    assert.match(said.out, /this checker said the same of the schema/);
    const [request] = agreeing.sent;
    assert.equal(request.url, '/v1/registry/validate');
    assert.equal(request.auth, 'Bearer jtk_test');
    assert.equal(JSON.parse(request.body.catalogue).contract, 3);
    assert.deepEqual(request.body.files.map((one) => one.path), ['jtk/pages/index.json']);
  } finally {
    agreeing.close();
  }
  // A code the judge raised that this copy did not: the copy is behind, and the run fails.
  const behind = await judge({ ok: false, contract: 2, findings: [{ code: 'JTK_E_ROUTE_INVALID', path: 'collections.x.route', says: 'somewhere' }, { code: 'JTK_E_TRANSLATION_BEFORE_M_THREE', path: 'jtk/schema.json locales', says: 'later' }] });
  try {
    const said = await runAsync(root, { JTK_API: behind.api, JTK_TOKEN: 'jtk_test' }, '--emit-only', '--judge');
    assert.match(said.out, /← JTK_E_ROUTE_INVALID {2}the judge raised this and we did not — this checker is behind/);
    assert.match(said.out, /✗ JTK_E_TRANSLATION_BEFORE_M_THREE {2}jtk\/schema\.json locales: later/);
    assert.equal(said.status, 2);
  } finally {
    behind.close();
    rmSync(root, { recursive: true, force: true });
  }
});
