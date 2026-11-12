// `jtkit apply --kit`: a booking kit laid into a site on another generator,
// in the words of the contract its tree is on — contract 3 on a new tree and
// on a contract-3 one (the owner, 12 November 2026: every way a new site is
// made defaults to the latest contract), contract 2's files on a site made
// before it and not moved yet, as they always were.
//
// The ten kits under fixtures/kits are the platform's, copied read-only from
// jtakeit-core's docs/kits/<kind>.md, «The kit, whole» (c3-rehearsal5 at
// 60a47a0f — what GET /v1/kits/<kind> on staging served on 12 November 2026,
// a person's name "localized": false on the salon's and the clinic's).
// Copied, not fetched, so this suite runs offline; test/create3.mjs lays
// out the served ones when JTK_KITS_API names a platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyKit, kitIn3, layKit3Files, layKitFiles, readKit, treeOf, CONTRACT_3_ONLY } from '../lib/kits.mjs';
import { judgeSchema } from '../lib/judge3.mjs';
import { content } from '../lib/content/index.mjs';
import { readJtk } from '../lib/content/node.mjs';
import { unnamed } from '../lib/content/identity.mjs';
import { judgeTranslations } from '../lib/translations.mjs';

const KITS = fileURLToPath(new URL('./fixtures/kits/', import.meta.url));
const KINDS = readdirSync(KITS).filter((one) => one.endsWith('.json')).map((one) => one.slice(0, -'.json'.length)).sort();
const kitOf = (kind) => readKit(join(KITS, `${kind}.json`));
const jtkit = fileURLToPath(new URL('../bin/jtkit.mjs', import.meta.url));
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const json = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const put = (root, file, value) => {
  mkdirSync(join(root, file, '..'), { recursive: true });
  writeFileSync(join(root, file), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};
/** Every file under a tree, by its path, with its bytes: what a refusal must leave as it was. */
const snapshot = (root) => {
  const out = {};
  const walk = (at) => {
    for (const one of readdirSync(at, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(at, one.name));
      else out[relative(root, join(at, one.name))] = readFileSync(join(at, one.name), 'utf8');
    }
  };
  if (existsSync(root)) walk(root);
  return out;
};
const scratch = (name) => mkdtempSync(join(tmpdir(), `jtk-apply-${name}-`));

test('the platform\'s ten kits are here, each a kit', () => {
  assert.deepEqual(KINDS, ['apartments', 'car_rental', 'clinic', 'coworking', 'equipment_rental', 'hotel', 'photo_studio', 'restaurant', 'salon', 'sessions']);
  for (const kind of KINDS) assert.equal(kitOf(kind).kind, kind);
});

test('which contract a kit is laid into a tree on: 3 for a new tree and a contract-3 one, 2 for a site still on contract 2, and a tree that is neither refused', () => {
  const dir = scratch('tree');
  try {
    const at = (name) => join(dir, name);
    mkdirSync(at('empty'));
    assert.deepEqual(treeOf(at('empty')), { contract: 3, fresh: true });
    assert.deepEqual(treeOf(at('nowhere')), { contract: 3, fresh: true }, 'a directory not made yet is a new tree');
    put(at('platform-only'), 'jtk/site.json', { id: 'x' });
    assert.deepEqual(treeOf(at('platform-only')), { contract: 3, fresh: true }, 'jtk/site.json is the platform\'s, and says no contract');
    put(at('three'), 'jtk/schema.json', { contract: 3, locale: 'de', blocks: [] });
    assert.deepEqual(treeOf(at('three')), { contract: 3 });
    for (const file of ['jtk/catalogue.json', 'jtk/content/index.json', 'jtk/bookings.json']) {
      put(at(`two-${file.split('/')[1]}`), file, { contract: 2, path: '/', blocks: [] });
      assert.deepEqual(treeOf(at(`two-${file.split('/')[1]}`)), { contract: 2 }, file);
    }
    put(at('says-two'), 'jtk/schema.json', { contract: 2, blocks: [] });
    assert.match(treeOf(at('says-two')).refused, /does not say "contract": 3/);
    put(at('broken'), 'jtk/schema.json', '{');
    assert.match(treeOf(at('broken')).refused, /does not say "contract": 3/);
    put(at('both'), 'jtk/schema.json', { contract: 3, locale: 'de', blocks: [] });
    put(at('both'), 'jtk/catalogue.json', { contract: 2, blocks: [] });
    assert.match(treeOf(at('both')).refused, /catalogue\.json is contract 2's schema, beside contract 3's jtk\/schema\.json/);
    put(at('headless'), 'jtk/pages/index.json', { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55', path: '/', name: 'Home' });
    assert.match(treeOf(at('headless')).refused, /holds contract 3's jtk\/pages\/ and no jtk\/schema\.json/);
    for (const name of ['says-two', 'both', 'headless']) {
      const before = snapshot(at(name));
      assert.throws(() => applyKit(at(name), kitOf('salon'), {}));
      assert.deepEqual(snapshot(at(name)), before, `${name}: nothing written`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Every kit the platform has, into an empty tree: contract 3, judged clean by
// the platform's rules, every document named, read back through the door.
for (const kind of KINDS) {
  test(`${kind}: into an empty tree, contract 3 — the schema judged clean, the settings, the rates and the pages they are shown on, read back through the door`, async () => {
    const kit = kitOf(kind);
    const dir = scratch(kind);
    try {
      const { contract, written, questions } = applyKit(dir, kit, { locale: 'de-CH' });
      assert.equal(contract, 3);
      assert.ok(Array.isArray(questions));
      const tree = snapshot(dir);
      assert.deepEqual(written.map((file) => relative(dir, file)).sort(), Object.keys(tree).sort(), 'every file written is said, and nothing else is there');
      for (const never of ['jtk/catalogue.json', 'jtk/bookings.json', 'jtk/content']) assert.ok(!existsSync(join(dir, never)), `no ${never}`);

      const text = readFileSync(join(dir, 'jtk/schema.json'), 'utf8');
      assert.deepEqual(judgeSchema(text), [], 'the platform\'s judge of contract 3 finds nothing');
      const schema = JSON.parse(text);
      assert.deepEqual(Object.keys(schema), ['contract', 'generator', 'locale', 'blocks', 'collections', 'modules']);
      assert.equal(schema.contract, 3);
      assert.match(schema.generator, /^@jtakeit\/kit@\d+\.\d+\.\d+/);
      assert.equal(schema.locale, 'de-CH');

      // One mapping: the tables are the ones `jtk create --kit` writes into its declaration.
      const laid = kitIn3(kit, { locale: 'de-CH' });
      assert.deepEqual(schema.blocks, laid.blocks);
      assert.deepEqual(schema.collections, laid.collections);
      assert.deepEqual(schema.modules, laid.modules);
      assert.deepEqual(Object.keys(laid.write).sort(), written.slice(1).map((file) => `/${relative(dir, file)}`).sort());
      // Contract 3's words carried over: a person's name the same in every language.
      for (const block of kit.catalogue.blocks) {
        for (const field of block.fields ?? []) {
          if (field.localized !== undefined) assert.equal(schema.blocks.find((one) => one.type === block.type).fields.find((one) => one.key === field.key).localized, field.localized, `${block.type}.${field.key}`);
        }
      }

      const settings = json(dir, 'jtk/modules/bookings.json');
      const services = kit.catalogue.collections.find((one) => one.name === kit.catalogue.modules.bookings.services);
      assert.equal(settings.v, 1);
      assert.equal(settings.settings.kit, kind);
      assert.equal(settings.settings.kit_version, kit.version);
      assert.equal(settings.settings.page, services.prefix);

      const files = await readJtk(dir);
      assert.deepEqual(unnamed(files), [], 'every page and entry has its id, every row its _key');
      assert.deepEqual(judgeTranslations(files), []);
      const site = content(files);
      assert.equal(site.contract, 3);
      assert.equal(site.module('bookings').kit, kind);
      for (const collection of kit.catalogue.collections) {
        const entries = site.entries(collection.name, { all: true });
        const said = kit.entries.filter((one) => one.collection === collection.name);
        assert.deepEqual(entries.map((one) => one.slug).sort(), said.map((one) => one.slug).sort(), collection.name);
        for (const entry of entries) assert.match(entry.id, ID);
        if (collection.pages === false) {
          const page = json(dir, `jtk/pages${collection.prefix}.json`);
          assert.match(page.id, ID);
          assert.equal(page.path, collection.prefix);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('a new tree is in the language asked, English where none is, and a language that is none is refused', () => {
  const dir = scratch('locale');
  try {
    applyKit(join(dir, 'en'), kitOf('car_rental'), {});
    assert.equal(json(join(dir, 'en'), 'jtk/schema.json').locale, 'en');
    assert.equal(json(join(dir, 'en'), 'jtk/entries/services/day.json').fields.title, 'Day');
    applyKit(join(dir, 'uk'), kitOf('car_rental'), { locale: 'uk' });
    assert.equal(json(join(dir, 'uk'), 'jtk/entries/services/day.json').fields.title, 'Доба');
    assert.throws(() => applyKit(join(dir, 'none'), kitOf('car_rental'), { locale: 'xx-yy-zz' }), /is not a language/);
    assert.ok(!existsSync(join(dir, 'none')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A contract-3 site on another generator, before a kit: its own types, a collection, the shared text, a page at /rates of its own. */
function ownSite(root) {
  const schema = {
    contract: 3,
    generator: 'eleventy-jtk@1.0.0',
    locale: 'de',
    locales: ['en'],
    blocks: [
      { type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text', client_editable: true }] },
      { type: 'post', v: 1, label: 'Post', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true }] },
      { type: 'contacts', v: 1, label: 'Contacts', fields: [{ key: 'phone', label: 'Phone', kind: 'tel', role: 'phone', client_editable: true }] },
    ],
    shared: ['contacts'],
    collections: [{ name: 'posts', label: 'Posts', type: 'post', route: { detail: '/blog/{slug}', listing: '/blog' } }],
  };
  put(root, 'jtk/schema.json', schema);
  put(root, 'jtk/pages/index.json', { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55', path: '/', name: 'Start', blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Willkommen' }] });
  put(root, 'jtk/pages/rates.json', { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b56', path: '/rates', name: 'Unsere Preise', blocks: [{ _key: 'top', type: 'hero', v: 1, title: 'Preise' }] });
  put(root, 'jtk/entries/posts/erster.json', { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b57', collection: 'posts', slug: 'erster', visible: true, fields: { title: 'Erster' } });
  put(root, 'jtk/shared.json', { blocks: [{ _key: 'contacts', type: 'contacts', v: 1, phone: '+41 44 000 00 00' }] });
  return schema;
}

test('into a contract-3 tree with its own types: the kit is added beside them, the site\'s own kept as they were, its own page at the kit\'s place kept with its id', async () => {
  const dir = scratch('own');
  try {
    const own = ownSite(dir);
    const before = snapshot(dir);
    const kit = kitOf('car_rental');
    const { contract, written } = applyKit(dir, kit, {});
    assert.equal(contract, 3);
    const schema = json(dir, 'jtk/schema.json');
    assert.deepEqual(judgeSchema(readFileSync(join(dir, 'jtk/schema.json'), 'utf8')), []);
    assert.deepEqual(Object.keys(schema), ['contract', 'generator', 'locale', 'locales', 'blocks', 'shared', 'collections', 'modules'], 'the keys in the schema\'s order, the new ones where they go');
    assert.equal(schema.generator, own.generator, 'the site\'s own generator, not this package');
    assert.deepEqual(schema.locales, ['en']);
    assert.deepEqual(schema.blocks.slice(0, 3), own.blocks, 'the site\'s own types first, as they were');
    assert.deepEqual(schema.blocks.slice(3).map((one) => one.type), kit.catalogue.blocks.map((one) => one.type));
    assert.deepEqual(schema.collections[0], own.collections[0]);
    assert.deepEqual(schema.collections.slice(1).map((one) => one.name), kit.catalogue.collections.map((one) => one.name));
    assert.deepEqual(schema.modules, kit.catalogue.modules);
    // The site's files are its own: none written over, the page at /rates kept with its id.
    for (const [file, text] of Object.entries(before)) if (file !== 'jtk/schema.json') assert.equal(readFileSync(join(dir, file), 'utf8'), text, file);
    assert.ok(!written.some((file) => relative(dir, file) === 'jtk/pages/rates.json'));
    assert.deepEqual(written.map((file) => relative(dir, file)).sort(), ['jtk/entries/services/day.json', 'jtk/entries/services/week.json', 'jtk/modules/bookings.json', 'jtk/pages/classes.json', 'jtk/schema.json']);
    assert.equal(json(dir, 'jtk/entries/services/day.json').fields.title, 'Tag', 'in the schema\'s language');
    const site = content(await readJtk(dir));
    assert.equal(site.entries('posts').length, 1);
    assert.equal(site.entries('services', { all: true }).length, 2);
    assert.equal(site.module('bookings').page, '/rates');
    assert.deepEqual(judgeTranslations(await readJtk(dir)), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the empty settings jtkit schema seeds for a module are filled; a kit laid out already is the site\'s, and is said', () => {
  const dir = scratch('seed');
  try {
    put(dir, 'jtk/schema.json', { contract: 3, locale: 'en', blocks: [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text' }] }] });
    put(dir, 'jtk/modules/bookings.json', { v: 1, settings: {} });
    applyKit(dir, kitOf('salon'), {});
    assert.equal(json(dir, 'jtk/modules/bookings.json').settings.kit, 'salon');
    // The same kit again: its types are the site's now, the same, and kept;
    // its settings are there, the site's, and not written over.
    const before = snapshot(dir);
    assert.throws(() => applyKit(dir, kitOf('salon'), {}), /jtk\/modules\/bookings\.json is there already, the site's own — a kit is laid in beside what a site has, never over it/);
    assert.deepEqual(snapshot(dir), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a clash is refused with a sentence, every one at once, and nothing is written', () => {
  const dir = scratch('clash');
  try {
    const cases = [
      ['a block type of the kit\'s name', (schema) => schema.blocks.push({ type: 'car', v: 1, label: 'Our car', fields: [{ key: 'title', label: 'Name', kind: 'text' }] }), /declares the block type «car» of its own, by the kit's names, and not as the kit does/],
      ['a collection of the kit\'s name', (schema) => schema.collections.push({ name: 'cars', label: 'Cars', type: 'post', route: { detail: '/autos/{slug}' } }), /declares the collection «cars» of its own/],
      ['a diary of its own', (schema) => Object.assign(schema, { modules: { bookings: { services: 'posts', resources: 'posts' } } }), /declares the module «bookings» \(services "posts", resources "posts"\) of its own/],
    ];
    for (const [said, change, says] of cases) {
      const root = join(dir, said.replaceAll(/\W+/g, '-'));
      const schema = ownSite(root);
      change(schema);
      put(root, 'jtk/schema.json', schema);
      const before = snapshot(root);
      assert.throws(() => applyKit(root, kitOf('car_rental'), {}), (why) => says.test(why.message) && /rename the site's, or lay the kit out by hand from its page \(jtakeit:\/\/\/kits\/car_rental\.md\); nothing was written/.test(why.message), said);
      assert.deepEqual(snapshot(root), before, `${said}: nothing written`);
    }
    // A rate the site has already, at the kit's place, and two clashes said together.
    const root = join(dir, 'taken');
    const schema = ownSite(root);
    schema.blocks.push({ type: 'car', v: 1, label: 'Our car', fields: [] });
    put(root, 'jtk/schema.json', schema);
    put(root, 'jtk/entries/services/day.json', { id: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b58', collection: 'services', slug: 'day', visible: true, fields: { title: 'Unser Tag' } });
    const before = snapshot(root);
    assert.throws(() => applyKit(root, kitOf('car_rental'), {}), /the block type «car» of its own.*; and jtk\/entries\/services\/day\.json is there already, the site's own/);
    assert.deepEqual(snapshot(root), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the schema with the kit in it is judged as the platform judges it before anything is written — and a schema refused before the kit is said so', () => {
  const dir = scratch('judged');
  try {
    // The site keeps its team at /masters, where the salon's masters would be.
    const root = join(dir, 'overlap');
    const schema = ownSite(root);
    schema.collections.push({ name: 'team', label: 'Team', type: 'post', route: { detail: '/masters/{slug}' } });
    put(root, 'jtk/schema.json', schema);
    assert.deepEqual(judgeSchema(readFileSync(join(root, 'jtk/schema.json'), 'utf8')), [], 'the site\'s own schema is one the platform accepts');
    let before = snapshot(root);
    assert.throws(() => applyKit(root, kitOf('salon'), {}), (why) => /with the «salon» kit in it is not one the platform accepts — nothing was written/.test(why.message) && /JTK_E_ROUTE_INVALID|JTK_E_ROUTE/.test(why.message) && /"masters" and "team"|"team" and "masters"/.test(why.message));
    assert.deepEqual(snapshot(root), before);

    const broken = join(dir, 'broken');
    const own = ownSite(broken);
    delete own.locale;
    put(broken, 'jtk/schema.json', own);
    before = snapshot(broken);
    assert.throws(() => applyKit(broken, kitOf('salon'), {}), /is not one the platform accepts as it stands, before the kit — nothing was written:\n {2}✗ JTK_E_LOCALE/);
    assert.deepEqual(snapshot(broken), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('on a contract-3 tree the kit\'s words are the site\'s language: a --locale that says another is refused', () => {
  const dir = scratch('lang');
  try {
    ownSite(dir);
    const before = snapshot(dir);
    assert.throws(() => applyKit(dir, kitOf('salon'), { locale: 'en' }), /says the site's language is de, and --locale says en/);
    assert.deepEqual(snapshot(dir), before);
    applyKit(dir, kitOf('car_rental'), { locale: 'de-CH' });
    assert.equal(json(dir, 'jtk/entries/services/day.json').fields.title, 'Tag', 'the same language, said with a region');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A site still on contract 2 takes the kit in its own files, exactly as
// `jtkit apply` always laid them — without the keys only contract 3 has.
for (const kind of KINDS) {
  test(`${kind}: into a contract-2 tree, contract 2's files byte for byte as they were laid, without contract 3's keys`, () => {
    const kit = kitOf(kind);
    const dir = scratch(`two-${kind}`);
    try {
      const site = {
        'jtk/catalogue.json': { contract: 2, locale: 'de', blocks: [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text' }] }], modules: { enquiries: {} } },
        'jtk/content/index.json': { path: '/', blocks: [{ type: 'hero', v: 1, title: 'Willkommen' }] },
      };
      for (const [file, value] of Object.entries(site)) {
        put(join(dir, 'applied'), file, value);
        put(join(dir, 'laid'), file, value);
      }
      const { contract, written, questions } = applyKit(join(dir, 'applied'), kit, { locale: 'de' });
      assert.equal(contract, 2);
      assert.deepEqual(questions, []);
      const laid = layKitFiles(join(dir, 'laid'), kit, { locale: 'de', catalogue: true });
      assert.deepEqual(written.map((file) => relative(join(dir, 'applied'), file)), laid.map((file) => relative(join(dir, 'laid'), file)));
      assert.deepEqual(snapshot(join(dir, 'applied')), snapshot(join(dir, 'laid')));
      assert.ok(!existsSync(join(dir, 'applied', 'jtk/schema.json')));
      const catalogue = readFileSync(join(dir, 'applied', 'jtk/catalogue.json'), 'utf8');
      const three = [...CONTRACT_3_ONLY.catalogue, ...CONTRACT_3_ONLY.field, ...CONTRACT_3_ONLY.collection];
      assert.doesNotMatch(catalogue, new RegExp(`"(${three.join('|')})":`, 'i'));
      // A locale left unsaid is English, as it always was.
      cpSync(join(dir, 'laid'), join(dir, 'english'), { recursive: true });
      rmSync(join(dir, 'english', 'jtk/bookings.json'));
      assert.equal(applyKit(join(dir, 'english'), kit, {}).contract, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('layKit3Files lays nothing into a contract-2 tree, and layKitFiles nothing into a contract-3 one', () => {
  const dir = scratch('cross');
  try {
    put(join(dir, 'two'), 'jtk/catalogue.json', { contract: 2, blocks: [] });
    assert.throws(() => layKit3Files(join(dir, 'two'), kitOf('salon')), /holds a contract-2 site/);
    put(join(dir, 'three'), 'jtk/schema.json', { contract: 3, locale: 'de', blocks: [] });
    assert.throws(() => layKitFiles(join(dir, 'three'), kitOf('salon'), { catalogue: true }), /says contract 3, and a kit is laid out in contract 2's files/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('jtkit apply says which contract it laid out on, what it wrote, and what to ask', () => {
  const dir = scratch('cli');
  try {
    const kit = join(KITS, 'hotel.json');
    let run = spawnSync(process.execPath, [jtkit, 'apply', '--kit', kit, '--root', join(dir, 'new'), '--locale', 'de-CH'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^5 files written under .*, on contract 3:\n {2}jtk\/schema\.json\n/);
    assert.match(run.stdout, /The «hotel» kit is laid out\. Ask, never make up:/);
    assert.match(run.stdout, /validate_schema/);
    assert.equal(json(join(dir, 'new'), 'jtk/schema.json').contract, 3);

    put(join(dir, 'old'), 'jtk/catalogue.json', { contract: 2, blocks: [] });
    run = spawnSync(process.execPath, [jtkit, 'apply', '--kit', kit, '--root', join(dir, 'old')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^3 files written under [^\n]*[^,]:\n {2}jtk\/bookings\.json\n/, 'contract 2 says what it always said');
    assert.doesNotMatch(run.stdout, /contract 3|validate_schema/);

    run = spawnSync(process.execPath, [jtkit, 'apply', '--kit', kit, '--root', join(dir, 'new')], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^jtkit apply: the «hotel» kit cannot be laid into .*nothing was written\n$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
