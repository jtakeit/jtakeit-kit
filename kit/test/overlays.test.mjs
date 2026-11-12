// The merge of an original and its translation, held to the fixture corpus
// (jtakeit-core wiki/98 §1, 3: one rule, one implementation per runtime, one
// corpus): the kit's own cases (fixtures/overlays/), and the platform's or
// anybody's where JTK_OVERLAYS names a directory or a file of them —
//
//   JTK_OVERLAYS=../../jtakeit-core/backend/api/sites/testdata/overlays node --test test/overlays.test.mjs
//
// Then the door: what it serves is the merge's, and it hands out which
// values are the original's for the page to give them its `lang`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { content } from '../lib/content/index.mjs';
import { digest, judgeTranslation, judgeTranslations, ORPHAN, statesOf } from '../lib/translations.mjs';
import { readCases, sitCase } from './overlay-corpus.mjs';

const own = readCases(fileURLToPath(new URL('./fixtures/overlays/', import.meta.url)));
const theirs = (process.env.JTK_OVERLAYS ?? '').split(':').filter(Boolean).flatMap((at) => readCases(at));

for (const { file, case: one } of [...own, ...theirs]) {
  test(`corpus: ${one.name ?? file}`, () => {
    const parted = sitCase(one);
    assert.deepEqual(parted, [], `${file}\n  ${parted.join('\n  ')}`);
  });
}

test('the corpus covers what M3 promises: page, entry, shared text, rows by key, a gallery\'s words, seo, a body whole, held back, refused, missing, an unknown key', () => {
  const names = own.map((one) => one.case.name);
  for (const want of ['page-words-laid-by-key', 'entry-fields-shared-and-localized', 'shared-text-words-and-phone', 'keyed-rows-in-any-order', 'gallery-pictures-words-by-key', 'page-seo', 'entry-body-whole-per-language', 'entry-held-back', 'refused-shared-value-price', 'entry-missing-translation', 'unknown-key-is-advice', 'outdated-by-digest', 'entry-missing-translation-hidden']) {
    assert.ok(names.includes(want), want);
  }
  const keys = ['name', 'schema', 'base', 'translation', 'locale', 'merged', 'fromBase', 'outdated', 'advice', 'refused'];
  for (const { file, case: one } of own) assert.deepEqual(Object.keys(one), keys, `${file} is in the corpus's format, and only it`);
});

test('an unknown _key is advice: said, and refusing nothing', () => {
  const one = own.find((c) => c.case.name === 'unknown-key-is-advice').case;
  const said = judgeTranslation(one.schema, one.base, one.translation, { file: 'jtk/pages/preise.en.json' });
  assert.deepEqual(said.map((finding) => [finding.code, finding.path]).sort(), [
    [ORPHAN, 'jtk/pages/preise.en.json blocks[list].items[gone]'],
    [ORPHAN, 'jtk/pages/preise.en.json blocks[old]'],
  ]);
});

test('the digest is the platform\'s (content.Digest): eight hex digits of the SHA-256 of the canonical JSON, a string with its quotes; nothing for nothing', () => {
  assert.equal(digest('Preise'), 'e3ea67be', 'the platform\'s own test value');
  assert.equal(digest('Was es kostet'), '702993f9');
  assert.equal(digest(''), '');
  assert.equal(digest('  '), '');
  assert.equal(digest(undefined), '');
  assert.equal(digest([]), '');
  assert.equal(digest({ b: '<ü>', a: 1 }), digest({ a: 1, b: '<ü>' }), 'keys in byte order');
  assert.match(digest([{ _key: 'b1', type: 'text', v: 1, body: 'x' }]), /^[0-9a-f]{8}$/);
});

// ── a tree ─────────────────────────────────────────────────────────────────

const ID = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21';
const POST = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55';
const schema = {
  contract: 3,
  locale: 'de',
  locales: ['en', 'fr'],
  blocks: [
    { type: 'hero', v: 1, label: 'Hero', fields: [
      { key: 'title', label: 'Title', kind: 'text', client_editable: true },
      { key: 'image', label: 'Photo', kind: 'media', client_editable: true },
      { key: 'pictures', label: 'Pictures', kind: 'media', multiple: true, client_editable: true },
    ] },
    { type: 'post', v: 1, label: 'Post', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true }, { key: 'date', label: 'Date', kind: 'date' }] },
    { type: 'contacts', v: 1, label: 'Contacts', fields: [{ key: 'name', label: 'Name', kind: 'text', client_editable: true }] },
  ],
  shared: ['contacts'],
  collections: [{ name: 'blog', label: 'Blog', type: 'post', route: { detail: '/blog/{slug}', listing: '/blog' } }],
};
const tree = (more = {}) => ({
  '/jtk/schema.json': schema,
  '/jtk/pages/index.json': { id: ID, path: '/', name: 'Start', blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Hallo', image: { src: 'a.jpg', alt: 'Tür' }, pictures: [{ _key: 'p1', src: 'b.jpg', alt: 'Eins' }] }] },
  '/jtk/pages/index.en.json': { of: ID, locale: 'en', name: 'Home', blocks: [{ _key: 'hero', title: 'Hello' }], translated: { 'blocks[hero].title': { from: digest('Hallo'), by: 'agent' } } },
  '/jtk/entries/blog/erster.json': { id: POST, collection: 'blog', slug: 'erster', visible: true, fields: { title: 'Erster', date: '2026-11-01' } },
  '/jtk/entries/blog/erster.en.json': { of: POST, locale: 'en', slug: 'first', visible: false, fields: { title: 'First' }, translated: { 'fields.title': { from: digest('Ein früherer Titel') } } },
  '/jtk/shared.json': { blocks: [{ _key: 'contacts', type: 'contacts', v: 1, name: 'Salon' }] },
  '/jtk/shared.en.json': { blocks: [{ _key: 'contacts', name: 'The Salon' }] },
  ...more,
});

test('a tree\'s translations judged as the platform will: placed beside their original, in a language the site has, holding only words', () => {
  assert.deepEqual(judgeTranslations(tree()), []);
  const said = judgeTranslations(tree({
    '/jtk/pages/index.it.json': { of: ID, locale: 'it', name: 'Casa' },
    '/jtk/pages/index.fr.json': { of: POST, locale: 'fr', name: 'Accueil' },
    '/jtk/entries/blog/erster.fr.json': { of: POST, locale: 'fr', fields: { date: '2026-12-01' } },
    '/jtk/shared.fr.json': { blocks: [{ _key: 'contacts', name: 'Le Salon' }, { name: 'sans clé' }] },
  }));
  assert.deepEqual(said.map((one) => one.path).sort(), [
    'jtk/entries/blog/erster.fr.json fields.date',
    'jtk/pages/index.fr.json of',
    'jtk/pages/index.it.json locale',
    'jtk/shared.fr.json blocks[1]',
  ]);
  assert.ok(said.filter((one) => !one.path.endsWith('fields.date')).every((one) => one.code === 'JTK_E_DOCUMENT_INVALID'));
  const date = said.find((one) => one.path.endsWith('fields.date'));
  assert.equal(date.code, 'JTK_E_TRANSLATION_SHARED');
  assert.match(date.says, /the same in every language.*the base, everywhere/);
});

test('where each language stands: what is missing — the merge\'s fromBase — and what is outdated by its digest', () => {
  const [en, fr] = statesOf(tree());
  assert.equal(en.locale, 'en');
  assert.deepEqual(en.missing.sort(), ['jtk/pages/index.en.json blocks[hero].image.alt', 'jtk/pages/index.en.json blocks[hero].pictures[p1].alt']);
  assert.deepEqual(en.outdated, ['jtk/entries/blog/erster.en.json fields.title'], 'made from a title the original no longer has');
  assert.equal(en.held, 1);
  assert.deepEqual(fr.missing.sort(), [
    'jtk/entries/blog/erster.fr.json fields.title',
    'jtk/pages/index.fr.json blocks[hero].image.alt',
    'jtk/pages/index.fr.json blocks[hero].pictures[p1].alt',
    'jtk/pages/index.fr.json blocks[hero].title',
    'jtk/pages/index.fr.json name',
    'jtk/shared.fr.json blocks[contacts].name',
  ]);
  assert.deepEqual(fr.outdated, []);
});

test('the door serves the merge, and says which words are the original\'s: lang(), a picture\'s lang, a document\'s fromBase', () => {
  const site = content(tree());
  const en = site.page('/', 'en');
  assert.equal(en.name, 'Home');
  assert.deepEqual(en.fromBase.sort(), ['blocks[hero].image.alt', 'blocks[hero].pictures[p1].alt']);
  const hero = en.block('hero');
  assert.deepEqual(hero.lang('title'), {}, 'translated: no lang of its own');
  assert.equal(hero.picture('image').lang, 'de', 'the picture\'s words are the original\'s');
  assert.deepEqual(hero.gallery('pictures').map((one) => one.lang), ['de']);
  const fr = site.page('/', 'fr');
  assert.deepEqual(fr.block('hero').lang('title'), { lang: 'de' });
  assert.deepEqual(site.page('/').block('hero').lang('title'), {}, 'nothing is from the base in the base');
  assert.equal(site.page('/').block('hero').picture('image').lang, undefined);
  // Held back in English: built, not listed, no alternate.
  assert.deepEqual(site.entries('blog', { locale: 'en' }), []);
  assert.equal(site.entry('blog', 'first', 'en').visible, false);
  assert.deepEqual(site.alternatesOf(site.entry('blog', 'erster')), []);
  assert.deepEqual(site.entry('blog', 'erster', 'fr').fromBase, ['fields.title'], 'a slug left as the original\'s is not counted: an address has no language');
  assert.deepEqual(site.shared('fr').fromBase, ['blocks[contacts].name']);
});
