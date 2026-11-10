// _meta.json, the specimens, and a kit laid out — as the kit does them for any repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { content } from '../lib/content/index.mjs';
import { specimenId, specimenAddresses, hiddenEntries, buildMeta, writeMeta, draftsOf } from '../lib/meta.mjs';
import { checkKit, kitSettings, kitEntries, mergeKitIntoCatalogue, layKitFiles, kitLanguage } from '../lib/kits.mjs';

const blocks = [
  { type: 'gallery', views: [{ key: 'row' }, { key: 'pile' }] },
  { type: 'quote' },
];
const collections = [
  { name: 'posts', prefix: '/blog', body: ['gallery', 'quote', 'unknown'] },
  { name: 'rates', prefix: '/rates', pages: false },
];

test('a specimen is addressed once per arrangement, per language, under its collection', () => {
  assert.equal(specimenId('quote'), '_fl-quote');
  assert.equal(specimenId('gallery', 'row'), '_fl-gallery-row');
  assert.deepEqual(specimenAddresses(collections, blocks, ['ru']), [
    '/blog/_fl-gallery-pile/', '/blog/_fl-gallery-row/', '/blog/_fl-quote/',
    '/ru/blog/_fl-gallery-pile/', '/ru/blog/_fl-gallery-row/', '/ru/blog/_fl-quote/',
  ]);
  assert.deepEqual(specimenAddresses([{ prefix: '/x' }], blocks), []);
});

test('the drafts are the entries whose document says visible: false, and _meta.json is written whole', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-meta-'));
  try {
    const content = join(dir, 'jtk', 'content');
    mkdirSync(join(content, 'blog', 'media'), { recursive: true });
    writeFileSync(join(content, 'index.json'), JSON.stringify({ path: '/', blocks: [] }));
    writeFileSync(join(content, 'blog', 'done.json'), JSON.stringify({ path: '/blog/done', collection: 'posts', visible: true, blocks: [] }));
    writeFileSync(join(content, 'blog', 'draft.json'), JSON.stringify({ path: '/blog/draft', collection: 'posts', visible: false, blocks: [] }));
    writeFileSync(join(content, 'blog', 'media', 'x.json'), JSON.stringify({ visible: false }));
    writeFileSync(join(content, 'blog', 'broken.json'), '{');
    assert.deepEqual(await hiddenEntries(content), ['/blog/draft/']);

    const dist = join(dir, 'dist');
    mkdirSync(dist);
    const meta = await writeMeta(dist, { root: content, collections, blocks, immutable: ['/_next/static/'] });
    assert.deepEqual(meta, {
      redirects: [],
      drafts: ['/blog/_fl-gallery-pile/', '/blog/_fl-gallery-row/', '/blog/_fl-quote/', '/blog/draft/'],
      immutable: ['/_next/static/'],
    });
    assert.deepEqual(JSON.parse(readFileSync(join(dist, '_meta.json'), 'utf8')), meta);
    // Nothing declared: no key, so the edge's default stands.
    const bare = await buildMeta({ root: join(dir, 'nowhere') });
    assert.deepEqual(bare, { redirects: [], drafts: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("contract 3's _meta.json says no drafts — the platform's hidden list is the one (wiki/98 §6) — and contract 2's is byte for byte what it was", async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-meta-3-'));
  const here = process.cwd();
  try {
    const post = { type: 'post', v: 1, label: 'Post', fields: [{ key: 'title', label: 'Title', kind: 'text' }] };
    const quote = { type: 'quote', v: 1, label: 'Quote', fields: [{ key: 'text', label: 'Text', kind: 'text' }] };
    const schema = {
      contract: 3, locale: 'de', locales: ['en'], blocks: [post, quote],
      collections: [{ name: 'posts', label: 'Posts', type: 'post', route: { detail: '/blog/{slug}', listing: '/blog' }, blocks: ['quote'] }],
    };
    // An entry held back and a body that draws a specimen: what contract 2
    // lists as drafts, and the door still knows of on contract 3.
    const three = content({
      '/jtk/schema.json': schema,
      '/jtk/entries/posts/done.json': { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55', collection: 'posts', slug: 'done', visible: true, fields: { title: 'Fertig' } },
      '/jtk/entries/posts/draft.json': { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b56', collection: 'posts', slug: 'draft', visible: false, fields: { title: 'Entwurf' } },
    });
    assert.equal(three.contract, 3);
    assert.ok(draftsOf(three).includes('/blog/draft/'), 'the door still reads the entry as hidden');

    const dist = join(dir, 'dist');
    mkdirSync(dist);
    const cache = [{ prefix: '/clips/', maxAge: 86400 }];
    const meta = await writeMeta(dist, { site: three, immutable: ['/_astro/'], cache, redirects: [{ from: '/alt', to: '/neu', status: 301 }] });
    assert.deepEqual(meta, { redirects: [{ from: '/alt', to: '/neu', status: 301 }], immutable: ['/_astro/'], cache });
    // What the platform's build holds the file to (JTK_E_META_INVALID): these three keys and no other.
    const keys = Object.keys(JSON.parse(readFileSync(join(dist, '_meta.json'), 'utf8')));
    assert.deepEqual(keys.filter((key) => !['redirects', 'immutable', 'cache'].includes(key)), []);

    // Without the door's reading — a site on another generator — the working
    // directory's jtk/schema.json says which contract the build is in.
    mkdirSync(join(dir, 'jtk'));
    writeFileSync(join(dir, 'jtk', 'schema.json'), JSON.stringify(schema));
    process.chdir(dir);
    assert.deepEqual(await buildMeta({ collections, blocks }), { redirects: [] });
    process.chdir(here);

    // Contract 2, the same call: its drafts, and the file in the order of keys it always had.
    const two = content({
      '/jtk/catalogue.json': { contract: 2, blocks: [post, quote], collections: [{ name: 'posts', label: 'Posts', prefix: '/blog', type: 'post', body: ['quote'] }] },
      '/jtk/content/blog/done.json': { path: '/blog/done', collection: 'posts', visible: true, blocks: [{ type: 'post', v: 1, title: 'Fertig' }] },
      '/jtk/content/blog/draft.json': { path: '/blog/draft', collection: 'posts', visible: false, blocks: [{ type: 'post', v: 1, title: 'Entwurf' }] },
    });
    const twoDist = join(dir, 'dist-2');
    mkdirSync(twoDist);
    const twoMeta = await writeMeta(twoDist, { site: two, immutable: ['/_astro/'] });
    assert.deepEqual(twoMeta.drafts, ['/blog/_fl-quote/', '/blog/draft/']);
    assert.equal(
      readFileSync(join(twoDist, '_meta.json'), 'utf8'),
      `${JSON.stringify({ redirects: [], drafts: ['/blog/_fl-quote/', '/blog/draft/'], immutable: ['/_astro/'] }, null, 2)}\n`,
    );
  } finally {
    process.chdir(here);
    rmSync(dir, { recursive: true, force: true });
  }
});

const kit = {
  kind: 'car_rental', about: 'A test kit.', ask: ['zone: the time zone'], version: 'abc123',
  catalogue: {
    blocks: [
      { type: 'tariff', v: 1, label: { uk: 'Тариф', en: 'Rate' }, fields: [{ key: 'title', label: 'Name', kind: 'text' }, { key: 'takes', label: 'Takes', kind: 'duration' }] },
      { type: 'car', v: 1, label: 'Car', fields: [{ key: 'title', label: 'Name', kind: 'text' }] },
    ],
    collections: [
      { name: 'services', label: 'Rates', one: 'rate', prefix: '/rates', type: 'tariff', pages: false },
      { name: 'cars', label: 'Cars', prefix: '/cars', type: 'car' },
    ],
    modules: { bookings: { services: 'services', resources: 'cars' } },
  },
  settings: { kind: 'car_rental', scale: 'daily' },
  entries: [
    { collection: 'services', slug: 'day', fields: { title: { uk: 'Доба', en: 'Day' }, takes: 1440 } },
    { collection: 'cars', slug: 'combi', fields: { title: { uk: 'Комбі', en: 'Combi' } } },
  ],
};

test('a kit is checked for its shape, and its settings and entries are the platform\'s shapes', () => {
  assert.equal(checkKit(kit, 'test'), kit);
  assert.throws(() => checkKit({ kind: 'car_rental' }, 'bad.json'), /is not a kit/);
  assert.throws(() => checkKit({ ...kit, catalogue: { ...kit.catalogue, collections: [{ ...kit.catalogue.collections[0], pages: true }, kit.catalogue.collections[1]] } }, 'x'), /services are not a collection without pages/);
  assert.throws(() => checkKit({ ...kit, entries: [{ collection: 'boats', slug: 'x', fields: {} }] }, 'x'), /"boats", which the kit does not declare/);

  assert.deepEqual(kitSettings(kit), { type: 'bookings_config', v: 1, kind: 'car_rental', scale: 'daily', page: '/rates', kit: 'car_rental', kit_version: 'abc123' });
  assert.deepEqual(kitSettings({ ...kit, version: undefined }).kit_version, undefined);

  const [[path, doc]] = kitEntries(kit, 'uk');
  assert.equal(path, '/rates/day');
  assert.deepEqual(doc, { path: '/rates/day', collection: 'services', visible: true, seo: { title: '', description: '' }, blocks: [{ _key: 'kit00001', type: 'tariff', v: 1, title: 'Доба', takes: 1440 }] });
  assert.equal(kitEntries(kit, 'pl')[0][1].blocks[0].title, 'Day', 'a language the kit has not got reads as English');
  assert.equal(kitLanguage('de-CH'), 'de');

  // A list is the value, not words per language: a master's `does`, a post's tags.
  const listed = { ...kit, entries: [{ collection: 'cars', slug: 'combi', fields: { title: 'Combi', does: [{ service: 'day' }] } }] };
  assert.deepEqual(kitEntries(listed, 'uk')[0][1].blocks[0].does, [{ service: 'day' }]);
});

test('a kit goes into a catalogue file without writing over what the site already has', () => {
  const merged = mergeKitIntoCatalogue({ contract: 2, blocks: [{ type: 'car', v: 1, label: 'Mine', fields: [] }], modules: { enquiries: {} } }, kit);
  assert.equal(merged.blocks.find((b) => b.type === 'car').label, 'Mine');
  assert.ok(merged.blocks.some((b) => b.type === 'tariff'));
  assert.equal(merged.collections.length, 2);
  assert.deepEqual(merged.modules, { enquiries: {}, bookings: { services: 'services', resources: 'cars' } });
});

test('the kit\'s files are laid out under a repository, the catalogue only when asked', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-kit-'));
  try {
    const written = layKitFiles(dir, kit, { locale: 'uk', catalogue: true });
    assert.deepEqual(written.map((f) => f.slice(dir.length + 1)), ['jtk/bookings.json', 'jtk/content/rates/day.json', 'jtk/content/cars/combi.json', 'jtk/catalogue.json']);
    assert.equal(JSON.parse(readFileSync(join(dir, 'jtk', 'bookings.json'), 'utf8')).blocks[0].page, '/rates');
    assert.equal(JSON.parse(readFileSync(join(dir, 'jtk', 'catalogue.json'), 'utf8')).modules.bookings.resources, 'cars');

    const other = join(dir, 'astro');
    layKitFiles(other, kit, { locale: 'de' });
    assert.ok(!existsSync(join(other, 'jtk', 'catalogue.json')), 'the scaffold writes its declaration itself');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a kit is not laid out on a contract-3 tree: every file it writes is contract 2's, and nothing is written", () => {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-kit-3-'));
  try {
    mkdirSync(join(dir, 'jtk'));
    writeFileSync(join(dir, 'jtk', 'schema.json'), JSON.stringify({ contract: 3, locale: 'de', blocks: [] }));
    for (const catalogue of [true, false]) {
      assert.throws(() => layKitFiles(dir, kit, { locale: 'de', catalogue }), /schema\.json says contract 3, and a kit is laid out in contract 2's files/);
    }
    assert.deepEqual(readdirSync(join(dir, 'jtk')), ['schema.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
