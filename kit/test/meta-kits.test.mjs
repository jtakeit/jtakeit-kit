// _meta.json, the specimens, and a kit laid out — as the kit does them for any repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { specimenId, specimenAddresses, hiddenEntries, buildMeta, writeMeta } from '../lib/meta.mjs';
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
