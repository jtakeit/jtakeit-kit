// The door (lib/content) reading contract 3 (wiki/98 of the platform), on a
// tree laid out the way contract 3 lays it: a page per file under jtk/pages,
// an entry per file under jtk/entries/<collection>, translations beside their
// originals holding only their words, shared text and its translation, a
// module's settings as `{ v, settings }`, the currency at the top of
// site.json. Then the same calls a template makes on contract 2, and what
// each hands back: ids, merged words and which of them are the original's,
// addresses from routes, the owner's order, typed values, references by id,
// and every form of the annotation grammar by key and id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content, linksToListing } from '../lib/content/index.mjs';
import { mint, unnamed, uuid7 } from '../lib/content/identity.mjs';
import { contractOf, readJtk } from '../lib/content/node.mjs';
import { priceWords } from '../lib/money.mjs';

const now = Date.parse('2026-11-10T12:00:00Z');

const HOME = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21';
const PRICES = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e22';
const CONTACT = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e23';
const OAK = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55';
const GRANITE = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b56';
const PANE = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b57';
const GLASS = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b58';
const BEAUTY = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a61';
const NAILS = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a62';
const GEL = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a63';
const CUT = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a71';
const FILE = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a72';
const LOOSE = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a73';
const RED = '0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a81';

const ce = { client_editable: true };

const schema = {
  contract: 3,
  generator: 'test',
  locale: 'de',
  locales: ['en', 'fr-CH'],
  blocks: [
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
      { key: 'category', label: 'Category', kind: 'ref', ref: { to: ['categories'] } },
    ] },
    { type: 'tag', v: 1, label: 'Tag', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true, ...ce }] },
  ],
  page_seo: [{ key: 'title', label: 'Title', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }],
  shared: ['contacts'],
  collections: [
    // A pattern per language: what follows the language's prefix, which
    // always comes first (wiki/98 §15 · 4); the Swiss French, which the map
    // does not name, the German one under its own prefix.
    { name: 'works', label: { de: 'Werke', en: 'Works' }, type: 'work', route: { detail: { de: '/werke/{slug}', en: '/works/{slug}' }, listing: { de: '/werke', en: '/works' }, per_page: 2 }, order: { by: 'date', desc: true }, group: 'section', blocks: ['text', 'gallery'] },
    { name: 'categories', label: 'Categories', type: 'category', route: { detail: '/kategorien/{slug}' }, untranslated: 'hide' },
    { name: 'rates', label: 'Rates', type: 'rate', route: 'none', shown_on: ['/preise#{slug}'], order: 'manual', group: 'category' },
    { name: 'tags', label: 'Tags', type: 'tag', route: { detail: '/tags/{slug}' } },
  ],
  modules: { bookings: { services: 'rates', resources: 'works' } },
};

const work = (id, slug, fields, extra = {}, blocks) => ({
  id, collection: 'works', slug, visible: true, ...extra, fields: { title: slug, ...fields }, ...(blocks ? { blocks } : {}),
});

/** The files as Vite's glob hands them, out of order on purpose: the door sorts. */
function files() {
  return {
    '/jtk/site.json': { id: 'site-1', slug: 'test', currency: 'chf', media_base: '' },
    '/jtk/pages/preise.en.json': {
      // No `of`: a translation found by the file it sits beside. And a
      // price in it, which is no translation's to change.
      locale: 'en',
      name: 'Prices',
      seo: { title: 'Prices' },
      blocks: [
        { _key: 'list', title: 'Cuts', items: [{ _key: 'r7k2', title: 'Haircut', price: { minor: 1 }, options: [{ _key: 'o1', label: 'Short' }] }] },
        { _key: 'lost', type: 'hero', title: 'A block only the translation has' },
      ],
    },
    '/jtk/pages/index.json': {
      id: HOME,
      path: '/',
      name: 'Start',
      seo: { title: 'Start', description: 'Willkommen' },
      blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Hallo', lead: 'Willkommen', image: { src: 'media/2f/a1b2.jpg', alt: 'Die Tür', focus: '50% 30%' }, link: 'https://example.com' }],
    },
    '/jtk/pages/index.en.json': { of: HOME, locale: 'en', name: 'Home', seo: { title: 'Home' }, blocks: [{ _key: 'hero', title: 'Hello', image: { alt: 'The door' } }] },
    '/jtk/pages/preise.json': {
      id: PRICES,
      path: '/preise',
      blocks: [
        { _key: 'hero', type: 'hero', v: 1, title: 'Preise', image: { src: 'media/2f/c3d4.jpg' } },
        { _key: 'list', type: 'prices', v: 1, title: 'Schnitte', items: [
          { _key: 'r7k2', title: 'Haarschnitt', price: { minor: 4500, from: true }, photo: { src: 'media/2f/e5f6.jpg', alt: 'Schere' }, options: [{ _key: 'o1', label: 'Kurz' }, { _key: 'o2', label: 'Lang' }] },
          { _key: 'q1w2', title: 'Färben', price: { on_request: true } },
          { title: 'Ohne Schlüssel' },
        ] },
      ],
    },
    // A page without `path`: its place says it.
    '/jtk/pages/kontakt.json': { id: CONTACT, blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Kontakt', lead: null, link: '' }] },
    '/jtk/shared.json': { blocks: [{ _key: 'contacts', type: 'contacts', v: 1, name: 'Salon', phone: '+41 1' }] },
    // A phone number is the same in every language: a translation's is no one's.
    '/jtk/shared.en.json': { blocks: [{ _key: 'contacts', name: 'The Salon', phone: '+41 9' }] },
    '/jtk/entries/works/eiche.json': work(OAK, 'eiche', {
      title: 'Eiche', date: '2026-03-01', section: 'wood', category: BEAUTY, tags: [RED], price: { minor: 12000 },
      cover: { src: 'one', alt: 'Eichentür' },
      pictures: [{ _key: 'g1', src: 'two', alt: 'Zwei' }, { _key: 'g2', src: '' }, { _key: 'g3', src: 'three' }],
      body: 'Eiche.',
    }, { rank: 'a1', seo: { title: 'Eiche' } }, [
      { _key: 'b1', type: 'text', v: 1, body: 'Mehr.' },
      { _key: 'gal', type: 'gallery', v: 1, view: 'grid', items: [{ _key: 'p1', src: 'four', alt: 'Vier' }] },
    ]),
    '/jtk/entries/works/eiche.en.json': {
      of: OAK, locale: 'en', slug: 'oak', seo: { title: 'Oak' },
      fields: { title: 'Oak', cover: { alt: 'Oak door' }, pictures: [{ _key: 'g1', alt: 'Two' }], price: { minor: 1 }, body: 'Oak.' },
      // An entry's body is whole per language.
      blocks: [{ _key: 'b1', type: 'text', v: 1, body: 'More.' }],
    },
    '/jtk/entries/works/granit.json': work(GRANITE, 'granit', { title: 'Granit', date: '2026-05-01', section: 'stone', category: NAILS }),
    '/jtk/entries/works/fenster.json': work(PANE, 'fenster', { title: 'Fenster', date: '2026-04-01' }),
    // Held back in English: out in German, not in English.
    '/jtk/entries/works/fenster.en.json': { of: PANE, locale: 'en', slug: 'pane', visible: false, fields: { title: 'Pane' } },
    '/jtk/entries/works/glas.json': work(GLASS, 'glas', { title: 'Glas', date: '2026-06-01', section: 'wood' }, { visible: false }),
    // Ordered by hand: nails, beauty, gel — not by slug.
    '/jtk/entries/categories/beauty.json': { id: BEAUTY, collection: 'categories', slug: 'beauty', rank: 'a1', visible: true, fields: { title: 'Schönheit' } },
    '/jtk/entries/categories/beauty.en.json': { of: BEAUTY, locale: 'en', fields: { title: 'Beauty' } },
    '/jtk/entries/categories/nails.json': { id: NAILS, collection: 'categories', slug: 'nails', rank: 'a0V', visible: true, fields: { title: 'Nägel', parent: BEAUTY } },
    '/jtk/entries/categories/nails.en.json': { of: NAILS, locale: 'en', fields: { title: 'Nails' } },
    '/jtk/entries/categories/gel.json': { id: GEL, collection: 'categories', slug: 'gel', rank: 'a2', visible: true, fields: { title: 'Gel', parent: NAILS } },
    '/jtk/entries/rates/schnitt.json': { id: CUT, collection: 'rates', slug: 'schnitt', rank: 'b', visible: true, fields: { title: 'Schnitt', costs: { minor: 4500 }, category: BEAUTY } },
    '/jtk/entries/rates/feile.json': { id: FILE, collection: 'rates', slug: 'feile', rank: 'a', visible: true, fields: { title: 'Feile', costs: { minor: 2000, from: true }, category: GEL } },
    '/jtk/entries/rates/lose.json': { id: LOOSE, collection: 'rates', slug: 'lose', visible: true, fields: { title: 'Lose', costs: { on_request: true } } },
    '/jtk/entries/tags/rot.json': { id: RED, collection: 'tags', slug: 'rot', visible: true, fields: { title: 'Rot' } },
    '/jtk/modules/bookings.json': { v: 1, settings: { zone: 'Europe/Zurich', hours: [{ _key: 'h1', day: 'monday', opens: 540, closes: 1080 }, { _key: 'h2', day: 'tuesday', opens: 600, closes: 1080 }] } },
    '/jtk/schema.json': schema,
    '/jtk/session.json': { session: 's', key: 'k' },
    '/jtk/design.json': { v: 2, field: '' },
  };
}

const site = content(files(), { now });
const path = (at) => at['data-jtk-path'];

test('a schema.json saying contract 3 is read as contract 3; its languages are the schema\'s, the currency at the top of site.json', () => {
  assert.equal(site.contract, 3);
  assert.equal(site.locale, 'de');
  assert.deepEqual(site.locales, ['de', 'en', 'fr-CH']);
  assert.equal(site.currency, 'CHF');
  assert.deepEqual(site.rolesOf('bookings'), { services: 'rates', resources: 'works' });
  // A schema.json that is not contract 3 is no catalogue: contract 2 reads catalogue.json.
  const two = content({ '/jtk/schema.json': { ...schema, contract: 2 }, '/jtk/catalogue.json': { locale: 'uk' } });
  assert.equal(two.contract, 2);
  assert.equal(two.locale, 'uk');
});

test('pages: a file per page under jtk/pages, index.json the home, each with its id; a page without path is where its file is', () => {
  const home = site.page('/');
  assert.equal(home.id, HOME);
  assert.equal(home.file, '/jtk/pages/index.json');
  assert.equal(home.address, '/');
  assert.equal(home.block('hero').text('title'), 'Hallo');
  assert.equal(site.page('/preise').id, PRICES);
  assert.equal(site.page('/kontakt').id, CONTACT);
  assert.deepEqual(site.pages().map((one) => one.address), ['/', '/kontakt', '/preise']);
  assert.deepEqual(site.pages('en').map((one) => one.address), ['/en', '/en/kontakt', '/en/preise'], 'a page is in every language the site has');
  assert.equal(site.page('/en/preise').locale, 'en', 'asked by its address in a language');
  const nobody = site.page('/nowhere');
  assert.equal(nobody.id, '');
  assert.deepEqual(nobody.block('hero').at('title'), {});
});

test('entries: a file per entry under jtk/entries/<collection>, its id, its slug, its own values in fields and its body in blocks', () => {
  const oak = site.entry('works', 'eiche');
  assert.equal(oak.id, OAK);
  assert.equal(oak.collection, 'works');
  assert.equal(oak.slug, 'eiche');
  assert.equal(oak.file, '/jtk/entries/works/eiche.json');
  assert.equal(oak.fields.text('title'), 'Eiche');
  assert.deepEqual(oak.body.map((one) => [one.type, one.key]), [['text', 'b1'], ['gallery', 'gal']]);
  assert.equal(site.entry('works', OAK), oak, 'found by its id as well');
  assert.equal(site.entry('works', 'oak', 'en').id, OAK, 'and by its slug in a language');
  assert.equal(site.entry('works', 'eiche', 'en').slug, 'oak', 'or by the original\'s');
});

test('a translation beside its original is laid over it by key: its words, the original\'s for the rest, and which is which', () => {
  const home = site.page('/', 'en');
  assert.equal(home.file, '/jtk/pages/index.en.json');
  assert.equal(home.address, '/en');
  assert.deepEqual(home.seo, { title: 'Home', description: 'Willkommen' });
  const hero = home.block('hero');
  assert.equal(hero.text('title'), 'Hello');
  assert.equal(hero.fromBase('title'), false);
  assert.equal(hero.text('lead'), 'Willkommen', 'a value nobody translated is the original\'s…');
  assert.equal(hero.fromBase('lead'), true, '…and says so, for the original\'s lang');
  assert.deepEqual(hero.picture('image'), { src: 'media/2f/a1b2.jpg', alt: 'The door', focus: '50% 30%', 'data-jtk-path': 'blocks[hero].image.src' }, 'the file the original\'s, the words the translation\'s');
  assert.equal(site.page('/').block('hero').fromBase('title'), false, 'nothing in the original\'s own language is "from the base"');

  // Found by the file it sits beside; a shared value in it is the original's.
  const list = site.page('/preise', 'en').block('prices');
  assert.equal(list.text('title'), 'Cuts');
  const [cut, colour] = list.rows('items');
  assert.equal(cut.text('title'), 'Haircut');
  assert.deepEqual(cut.value('price'), { minor: 4500, from: true }, 'a price is no translation\'s to change');
  assert.equal(cut.fromBase('price'), false, 'and has no language to be the original\'s in (wiki/98 §15 · 3)');
  assert.equal(cut.fromBase('title'), false);
  assert.deepEqual(cut.rows('options').map((one) => [one.text('label'), one.fromBase('label')]), [['Short', false], ['Lang', true]]);
  assert.equal(colour.text('title'), 'Färben');
  assert.equal(colour.fromBase('title'), true, 'a row the translation does not name is all the original\'s');
  assert.equal(site.page('/preise', 'en').blocks.length, 2, 'a block only the translation has is not on the page');

  // A language with no translation: the original, every word marked.
  const swiss = site.page('/', 'fr-CH');
  assert.equal(swiss.address, '/fr-ch');
  assert.equal(swiss.block('hero').text('title'), 'Hallo');
  assert.equal(swiss.block('hero').fromBase('title'), true);
  // hreflang only where a translation is (jtakeit-core wiki/94 · M3): the
  // Swiss French home is built, in the original's words, and is no alternate.
  assert.deepEqual(site.alternatesOf(site.page('/')), [
    { locale: '', address: '/' },
    { locale: 'en', address: '/en' },
  ]);
});

test('shared text: shared.<locale>.json laid over shared.json by key, the phone the same in every language', () => {
  assert.equal(site.shared().block('contacts').text('name'), 'Salon');
  const en = site.shared('en').block('contacts');
  assert.equal(en.text('name'), 'The Salon');
  assert.equal(en.text('phone'), '+41 1');
  assert.equal(en.fromBase('phone'), false, 'a phone number has no language (wiki/98 §15 · 3)');
  assert.equal(site.shared('fr-CH').block('contacts').fromBase('name'), true);
  assert.deepEqual(site.sharedDocuments().map((one) => [one.locale, one.blocks[0].name]), [['', 'Salon'], ['en', 'The Salon']]);
});

test('the business\'s facts by role (wiki/98 §4.5): the shared text\'s fields that say one, read and annotated as the shared text is', () => {
  const facts = site.facts();
  assert.deepEqual(facts.roles.sort(), ['name', 'phone']);
  assert.equal(facts.text('name'), 'Salon');
  assert.equal(facts.text('phone'), '+41 1');
  assert.deepEqual(facts.at('phone'), { 'data-jtk-path': 'shared:blocks[contacts].phone' });
  assert.equal(facts.field('name')?.role, 'name');
  // A role no field says is empty, never an error: the template falls back to its own.
  assert.equal(facts.text('street'), '');
  assert.equal(facts.value('street'), undefined);
  assert.deepEqual(facts.rows('social'), []);
  assert.deepEqual(facts.at('street'), {});
  // In a language: the translation's words, the original's number.
  assert.equal(site.facts('en').text('name'), 'The Salon');
  assert.equal(site.facts('en').text('phone'), '+41 1');
  // A block of a type the schema does not list in `shared` says no facts, roles or not.
  const off = content({ ...files(), '/jtk/schema.json': { ...schema, shared: [] } }, { now });
  assert.equal(off.facts().text('name'), '');
  assert.deepEqual(off.facts().roles, []);
});

test('an entry in a language: its translation\'s fields laid over, its body the translation\'s whole, its address in that language', () => {
  const oak = site.entry('works', 'eiche', 'en');
  assert.equal(oak.file, '/jtk/entries/works/eiche.en.json');
  assert.equal(oak.address, '/en/works/oak', 'the English pattern after the English prefix, with the English slug');
  assert.equal(oak.fields.text('title'), 'Oak');
  assert.equal(oak.fields.fromBase('title'), false);
  assert.equal(oak.fields.value('date'), '2026-03-01');
  assert.equal(oak.fields.fromBase('date'), false, 'a date has no language (wiki/98 §15 · 3)');
  assert.deepEqual(oak.fields.value('price'), { minor: 12000 });
  assert.deepEqual(oak.fields.picture('cover'), { src: 'one', alt: 'Oak door', 'data-jtk-path': `entry:${OAK}:cover.src` });
  assert.deepEqual(oak.fields.gallery('pictures').map((one) => one.alt), ['Two', '']);
  assert.deepEqual(oak.body.map((one) => one.text('body')), ['More.'], 'the translation\'s body, whole: no gallery the German one has');
  assert.equal(oak.body[0].fromBase('body'), false);
  assert.deepEqual(oak.seo, { title: 'Oak' });

  // No translation: shown in the original's words, at the language's address.
  const granite = site.entry('works', 'granit', 'fr-CH');
  assert.equal(granite.address, '/fr-ch/werke/granit', 'the base pattern with the language put before it');
  assert.equal(granite.fields.text('title'), 'Granit');
  assert.equal(granite.fields.fromBase('title'), true);
  assert.equal(site.entry('works', 'granit', 'en').body.length, 0);

  assert.deepEqual(site.alternatesOf(site.entry('works', 'eiche')), [
    { locale: '', address: '/werke/eiche' },
    { locale: 'en', address: '/en/works/oak' },
  ], 'only where a translation is: the Swiss French page is the original\'s words');
  assert.deepEqual(site.alternatesOf(site.entry('works', 'fenster')), [], 'not where it is held back, nor where nobody translated it');
});

test('untranslated and visible: a hidden collection\'s entry is not in a language without its translation; a translation holds its language back', () => {
  assert.deepEqual(site.entries('categories', { locale: 'en' }).map((one) => one.slug), ['nails', 'beauty'], 'gel has no English and its collection hides it');
  // Hidden where nobody translated it, as a language held back is: built for
  // the panel's preview, listed nowhere, no alternate (the platform's corpus).
  assert.equal(site.entry('categories', 'gel', 'en').visible, false);
  assert.deepEqual(site.entries('categories', { locale: 'en', all: true }).map((one) => [one.slug, one.visible]), [['nails', true], ['beauty', true], ['gel', false]]);
  assert.deepEqual(site.entries('works').map((one) => one.slug), ['granit', 'fenster', 'eiche']);
  assert.deepEqual(site.entries('works', { locale: 'en' }).map((one) => one.slug), ['granit', 'oak'], 'the pane is held back in English');
  assert.deepEqual(site.entries('works', { all: true }).map((one) => [one.slug, one.visible]), [['glas', false], ['granit', true], ['fenster', true], ['eiche', true]]);
  assert.equal(site.entry('works', 'fenster', 'en').visible, false);
  assert.deepEqual(site.entries('works', { locale: 'it' }), [], 'a language the site does not have');
});

test('the order: by hand, by the rank in each original, in every language alike; by a field, on the language\'s values', () => {
  assert.deepEqual(site.entries('categories').map((one) => one.slug), ['nails', 'beauty', 'gel'], 'a0V < a1 < a2, as bytes');
  assert.deepEqual(site.entries('rates').map((one) => one.slug), ['feile', 'schnitt', 'lose'], 'unranked after the ranked');
  assert.deepEqual(site.entries('rates', { locale: 'en' }).map((one) => one.slug), ['feile', 'schnitt', 'lose']);
  const { entries, size, last } = site.listingPages('works');
  assert.deepEqual(entries.map((one) => one.slug), ['eiche', 'granit', 'fenster'], 'grouped: wood, stone, then none');
  assert.equal(size, 2);
  assert.equal(last, 2);
});

test('routes: a pattern per language, a listing, its pages; a collection shown only on another page has an anchor there', () => {
  const works = site.collection('works');
  assert.equal(works.pages, true);
  assert.equal(works.listing, true);
  assert.equal(works.per_page, 2);
  assert.equal(works.prefix, '/werke');
  assert.deepEqual(works.blocks, ['text', 'gallery']);
  assert.equal(works.untranslated, 'base');
  assert.equal(site.addressOf(site.entry('works', 'eiche')), '/werke/eiche');
  assert.equal(site.listingOf('works'), '/werke');
  assert.equal(site.listingOf('works', 'en', 2), '/en/works/page/2');
  assert.equal(site.listingOf('works', 'fr-CH'), '/fr-ch/werke');
  assert.equal(site.listingOf('categories', 'en'), undefined, 'no listing declared: none (wiki/98 §15 · 6)');
  assert.equal(site.collection('categories').prefix, '', 'and no prefix made up for it');

  const rates = site.collection('rates');
  assert.equal(rates.pages, false);
  assert.deepEqual(rates.route, 'none');
  assert.deepEqual(rates.shown_on, ['/preise#{slug}']);
  const cut = site.entry('rates', 'schnitt');
  assert.equal(cut.address, undefined);
  assert.equal(site.anchorOf(cut), '/preise#schnitt');
  assert.equal(site.anchorOf(site.entry('rates', 'schnitt', 'en')), '/en/preise#schnitt');
  assert.equal(site.listingOf('rates', 'en'), undefined, 'shown on a page is not a listing: none unless declared (wiki/98 §15 · 6)');
  assert.equal(rates.prefix, '');
  assert.deepEqual(site.alternatesOf(cut), [], 'no page of its own, no alternates');
});

test('values: money as { minor }, a picture as { src, alt, focus }, a gallery by key, empty as absent', () => {
  const list = site.page('/preise').block('prices');
  const [cut, colour, keyless] = list.rows('items');
  assert.deepEqual(cut.value('price'), { minor: 4500, from: true });
  assert.match(site.money(cut.value('price'), 'de'), /45/);
  assert.equal(site.money({ minor: 4500 }, 'de'), site.money(4500, 'de'), 'the same words as whole minor units');
  assert.equal(site.money(cut.value('price'), 'de'), `ab ${site.money(4500, 'de')}`, 'a price from says so (wiki/98 §15 · 11)');
  assert.equal(site.money(colour.value('price')), 'auf Anfrage', 'on request: the words, in the site\'s language');
  assert.equal(site.money(undefined), '');
  assert.deepEqual(cut.picture('photo'), { src: 'media/2f/e5f6.jpg', alt: 'Schere', 'data-jtk-path': 'blocks[list].items[r7k2].photo.src' });
  assert.deepEqual(site.page('/preise').block('hero').picture('image'), { src: 'media/2f/c3d4.jpg', alt: '', 'data-jtk-path': 'blocks[hero].image.src' }, 'no alt is no alt: no title stands in');
  assert.equal(keyless.key, undefined);
  assert.equal(keyless.text('title'), 'Ohne Schlüssel');

  const oak = site.entry('works', 'eiche').here;
  assert.deepEqual(oak.fields.gallery('pictures'), [
    { src: 'two', alt: 'Zwei', 'data-jtk-path': 'pictures[g1].src' },
    { src: 'three', alt: '', 'data-jtk-path': 'pictures[g3].src' },
  ], 'the empty picture left out, each named by its key');

  const contact = site.page('/kontakt').block('hero');
  assert.deepEqual(['lead', 'link', 'title'].map((key) => contact.value(key)), [undefined, undefined, 'Kontakt']);
});

test('the schema as a template reads it: a select\'s options and their labels, a reference\'s collections', () => {
  const fields = site.collection('works').fields;
  const section = fields.find((one) => one.key === 'section');
  assert.deepEqual(section.options, ['wood', 'stone']);
  assert.deepEqual(section.option_labels, { wood: { de: 'Holz', en: 'Wood' } });
  const category = fields.find((one) => one.key === 'category');
  assert.equal(category.ref, 'categories');
  assert.deepEqual(category.to, ['categories']);
  assert.equal(category.many, false);
  const tags = fields.find((one) => one.key === 'tags');
  assert.equal(tags.many, true);
  assert.equal(site.type('prices').fields[1].of[3].of[0].key, 'label', 'a nested list keeps its rows\' declaration');
});

test('references by id: a group\'s headings, what points at an entry, a tree', () => {
  // A select: its options in order, by their labels in the page's language.
  const runs = site.groupsOf('works', site.entries('works', { locale: 'en' }), 'en');
  assert.deepEqual(runs.map((run) => [run.heading?.key, run.heading?.text, run.entries.map((one) => one.slug)]), [
    ['wood', 'Wood', ['oak']],
    ['stone', 'stone', ['granit']],
  ]);

  // A reference: the other collection's entries, keyed by id, titled in the language.
  const rates = site.groupsOf('rates', site.entries('rates'));
  assert.deepEqual(rates.map((run) => [run.heading?.key, run.heading?.text, run.entries.map((one) => one.slug)]), [
    [BEAUTY, 'Schönheit', ['schnitt']],
    [GEL, 'Gel', ['feile']],
    [undefined, undefined, ['lose']],
  ], 'in the categories\' own order (nails, which nothing names, dropped)');
  assert.deepEqual(rates[0].heading.at, { 'data-jtk-path': `entry:${BEAUTY}:title` });
  // In English gel is hidden, so the file pointing at it heads nothing.
  assert.deepEqual(site.groupsOf('rates', site.entries('rates', { locale: 'en' }), 'en').map((run) => [run.heading?.text, run.entries.map((one) => one.slug)]), [
    ['Beauty', ['schnitt']],
    [undefined, ['feile', 'lose']],
  ]);

  // What points at a category or anything under it, by id; a `many` reference too.
  const beauty = site.referrersOf(site.entry('categories', 'beauty'));
  assert.deepEqual(beauty.map((one) => [one.collection.name, one.entries.map((e) => e.slug), one.more]), [
    ['works', ['granit', 'eiche'], 0],
    ['rates', ['feile', 'schnitt'], 0],
  ]);
  assert.deepEqual(site.referrersOf(site.entry('tags', 'rot')).map((one) => one.entries.map((e) => e.slug)), [['eiche']]);

  const gel = site.treeOf(site.entry('categories', 'gel'));
  assert.deepEqual(gel.trail.map((one) => one.slug), ['beauty', 'nails']);
  assert.deepEqual(site.treeOf(site.entry('categories', 'beauty')).children.map((one) => one.slug), ['nails']);
});

test("a module's settings are `settings` of jtk/modules/<module>.json", () => {
  const settings = site.module('bookings');
  assert.equal(settings.zone, 'Europe/Zurich');
  assert.equal(settings.hours.length, 2);
  assert.deepEqual(site.module('orders'), {});
});

test('annotations by key and id, every form of the grammar', () => {
  const prices = site.page('/preise');
  const list = prices.block('prices');
  // A block's value, by the block's key.
  assert.deepEqual(list.at('title'), { 'data-jtk-path': 'blocks[list].title' });
  // A row's value, by the row's key — asked by its key or its index.
  assert.deepEqual(list.at('items', 'r7k2', 'title'), { 'data-jtk-path': 'blocks[list].items[r7k2].title' });
  assert.deepEqual(list.at('items', 1, 'price'), { 'data-jtk-path': 'blocks[list].items[q1w2].price' });
  assert.deepEqual(list.rows('items').map((row) => path(row.at('price'))), ['blocks[list].items[r7k2].price', 'blocks[list].items[q1w2].price', undefined], 'a row without a key is named by nothing');
  assert.deepEqual(list.at('items', 2, 'title'), {});
  assert.deepEqual(list.at('items', 'r7k2'), {}, 'a row alone is no place');
  // A row inside a row: two steps, the grammar's deepest.
  assert.deepEqual(list.rows('items')[0].rows('options').map((row) => path(row.at('label'))), ['blocks[list].items[r7k2].options[o1].label', 'blocks[list].items[r7k2].options[o2].label']);
  assert.deepEqual(list.rows('items')[0].at('options', 'o2', 'label'), { 'data-jtk-path': 'blocks[list].items[r7k2].options[o2].label' });
  // A picture's parts.
  const hero = prices.block('hero');
  assert.deepEqual(hero.at('image'), { 'data-jtk-path': 'blocks[hero].image.src' });
  assert.deepEqual(hero.at('image', undefined, 'alt'), { 'data-jtk-path': 'blocks[hero].image.alt' });
  assert.deepEqual(hero.at('image', undefined, 'focus'), { 'data-jtk-path': 'blocks[hero].image.focus' });
  assert.deepEqual(hero.at('title', undefined, 'alt'), {}, 'a part of what is no picture');
  assert.deepEqual(hero.at('image', undefined, 'size'), {}, 'a part the grammar does not have');
  // Another page's, by its id.
  assert.deepEqual(prices.elsewhere.block('prices').at('title'), { 'data-jtk-path': `page:${PRICES}:blocks[list].title` });
  assert.equal(prices.here.elsewhere, prices.elsewhere);

  // An entry's own value on its own page, and drawn elsewhere by its id.
  const oak = site.entry('works', 'eiche');
  assert.deepEqual(oak.here.fields.at('title'), { 'data-jtk-path': 'title' });
  assert.deepEqual(oak.fields.at('title'), { 'data-jtk-path': `entry:${OAK}:title` });
  assert.equal(oak.here.elsewhere, oak);
  assert.deepEqual(oak.here.fields.at('cover'), { 'data-jtk-path': 'cover.src' });
  assert.deepEqual(oak.here.fields.at('cover', undefined, 'alt'), { 'data-jtk-path': 'cover.alt' });
  assert.deepEqual(oak.here.fields.at('pictures', 'g3'), { 'data-jtk-path': 'pictures[g3].src' });
  assert.deepEqual(oak.here.fields.at('pictures', 'g1', 'alt'), { 'data-jtk-path': 'pictures[g1].alt' });
  // Its body, by the block's key, on its page and elsewhere.
  const [text, gallery] = oak.here.body;
  assert.deepEqual(text.at('body'), { 'data-jtk-path': 'blocks[b1].body' });
  assert.deepEqual(oak.body[0].at('body'), { 'data-jtk-path': `entry:${OAK}:blocks[b1].body` });
  assert.deepEqual(gallery.gallery('items'), [{ src: 'four', alt: 'Vier', 'data-jtk-path': 'blocks[gal].items[p1].src' }], 'by its own field');
  // The same names in every language: a document's identity spans them.
  assert.deepEqual(site.entry('works', 'eiche', 'en').fields.at('title'), { 'data-jtk-path': `entry:${OAK}:title` });
  assert.deepEqual(site.page('/preise', 'en').block('prices').at('items', 'r7k2', 'title'), { 'data-jtk-path': 'blocks[list].items[r7k2].title' });

  // Shared text and a module's settings.
  assert.deepEqual(site.shared('en').block('contacts').at('phone'), { 'data-jtk-path': 'shared:blocks[contacts].phone' });
  const settings = site.settings('bookings');
  assert.deepEqual(settings.rows('hours').map((row) => path(row.at('opens'))), ['module:bookings:hours[h1].opens', 'module:bookings:hours[h2].opens']);
  assert.deepEqual(settings.at('zone'), { 'data-jtk-path': 'module:bookings:zone' });
  assert.equal(settings.text('zone'), 'Europe/Zurich');

  // A heading for a group by a reference: the entry's title, by its id.
  assert.deepEqual(site.groupsOf('rates', site.entries('rates'))[0].heading.at, { 'data-jtk-path': `entry:${BEAUTY}:title` });
});

test('nothing is named by what the grammar cannot parse: no id, no key, a key out of its alphabet, a step too deep', () => {
  const tree = files();
  tree['/jtk/pages/preise.json'] = { ...tree['/jtk/pages/preise.json'], id: undefined };
  tree['/jtk/pages/index.json'] = { ...tree['/jtk/pages/index.json'], blocks: [{ ...tree['/jtk/pages/index.json'].blocks[0], _key: 'Hero_1' }, { type: 'hero', v: 1, title: 'Unkeyed' }] };
  const read = content(tree, { now });
  assert.deepEqual(read.page('/preise').elsewhere.block('prices').at('title'), {}, 'a page without an id cannot be named from elsewhere');
  assert.deepEqual(read.page('/preise').block('prices').at('title'), { 'data-jtk-path': 'blocks[list].title' }, 'and is still its own page\'s');
  assert.deepEqual(read.page('/').blocks.map((one) => path(one.at('title'))), [undefined, undefined]);
  // Three steps deep is past the grammar: a gallery inside a row's row.
  const deep = content({
    '/jtk/schema.json': { contract: 3, locale: 'de', blocks: [{ type: 'x', v: 1, fields: [{ key: 'a', kind: 'list', of: [{ key: 'b', kind: 'list', of: [{ key: 'c', kind: 'media', multiple: true }] }] }] }] },
    '/jtk/pages/index.json': { id: HOME, path: '/', blocks: [{ _key: 'x', type: 'x', v: 1, a: [{ _key: 'k1', b: [{ _key: 'k2', c: [{ _key: 'k3', src: 'one' }] }] }] }] },
  });
  const row = deep.page('/').block('x').rows('a')[0].rows('b')[0];
  assert.deepEqual(row.at('c'), { 'data-jtk-path': 'blocks[x].a[k1].b[k2].c' });
  assert.deepEqual(row.gallery('c'), [{ src: 'one', alt: '' }]);
  assert.deepEqual(row.rows('c').map((one) => path(one.at('src'))), [undefined]);
});

test('annotate off: the same values, and no annotation anywhere', () => {
  const quiet = content(files(), { now, annotate: false });
  assert.deepEqual(quiet.page('/preise').block('prices').at('items', 'r7k2', 'title'), {});
  assert.deepEqual(quiet.entry('works', 'eiche').fields.at('title'), {});
  assert.deepEqual(quiet.page('/').block('hero').picture('image'), { src: 'media/2f/a1b2.jpg', alt: 'Die Tür', focus: '50% 30%' });
  assert.deepEqual(quiet.settings('bookings').rows('hours')[0].at('opens'), {});
  assert.equal(quiet.page('/', 'en').block('hero').text('title'), 'Hello');
});

test('specimens: one per arrangement in every language, each block and picture keyed, at the detail pattern', () => {
  const made = site.specimens('works').map((one) => one.address);
  assert.deepEqual(made, ['/werke/_fl-text', '/werke/_fl-gallery-grid', '/en/works/_fl-text', '/en/works/_fl-gallery-grid', '/fr-ch/werke/_fl-text', '/fr-ch/werke/_fl-gallery-grid']);
  const grid = site.specimens('works', { locale: 'en' })[1];
  assert.equal(grid.specimen, true);
  assert.equal(grid.visible, false);
  assert.deepEqual(grid.here.body[0].gallery('items'), [{ src: 'two', alt: '', 'data-jtk-path': 'blocks[gallery].items[p1].src' }]);
  assert.deepEqual(site.alternatesOf(grid), []);
  assert.deepEqual(site.specimens('rates'), []);
});

test('documents(): every page and entry in each language it is in, with its id and the address it is reached at', () => {
  const docs = site.documents();
  assert.ok(docs.some((one) => one.path === '/en/works/oak' && one.id === OAK && one.fields.title === 'Oak'));
  assert.ok(docs.some((one) => one.path === '/fr-ch/preise' && one.id === PRICES));
  assert.equal(docs.find((one) => one.locale === 'en' && one.slug === 'gel').shown, false, 'hidden in English, where nobody translated it and its collection hides the untranslated');
  assert.equal(docs.find((one) => one.slug === 'schnitt' && one.locale === '').path, undefined, 'shown only on another page: no address of its own');
});

// The interface is one: what contract 3 added a template may call on a
// contract-2 site too, and it answers there without changing a thing.
test('on a contract-2 site the same calls answer: nothing is from the base, the settings are read and annotated nowhere', () => {
  const two = content({
    '/jtk/catalogue.json': { contract: 2, locale: 'en', locales: ['de'], blocks: [{ type: 'hero', v: 1, fields: [{ key: 'title', kind: 'text' }] }] },
    '/jtk/content/index.json': { path: '/', blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Hello' }] },
    '/jtk/content/de/index.json': { path: '/de', blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Hallo' }] },
    '/jtk/bookings.json': { blocks: [{ type: 'bookings_config', v: 1, zone: 'Europe/Zurich', hours: [{ _key: 'h1', day: 'monday', opens: 540 }] }] },
  });
  assert.equal(two.contract, 2);
  assert.equal(two.page('/', 'de').block('hero').fromBase('title'), false);
  assert.deepEqual(two.page('/', 'de').block('hero').at('title'), { 'data-jtk-path': 'blocks[0].title' });
  const settings = two.settings('bookings');
  assert.equal(settings.text('zone'), 'Europe/Zurich');
  assert.deepEqual(settings.rows('hours').map((row) => [row.value('opens'), row.at('opens')]), [[540, {}]]);
});

test('readJtk: the contract-3 tree off a disk reads as the glob hands it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-door-3-'));
  try {
    for (const [key, value] of Object.entries(files())) {
      mkdirSync(join(root, key, '..'), { recursive: true });
      writeFileSync(join(root, key), JSON.stringify(value));
    }
    mkdirSync(join(root, 'jtk', 'entries', 'works', 'media'), { recursive: true });
    writeFileSync(join(root, 'jtk', 'entries', 'works', 'media', 'x.json'), '{}');
    const read = content(await readJtk(root), { now });
    assert.equal(read.contract, 3);
    assert.deepEqual(read.entries('works', { locale: 'en' }).map((one) => one.slug), site.entries('works', { locale: 'en' }).map((one) => one.slug));
    assert.equal(read.page('/', 'en').block('hero').text('title'), 'Hello');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('contractOf: a tree is contract 3 where jtk/schema.json says so, and contract 2 whatever else it holds', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-contract-'));
  try {
    const schema = (text) => {
      mkdirSync(join(root, 'jtk'), { recursive: true });
      writeFileSync(join(root, 'jtk', 'schema.json'), text);
    };
    assert.equal(contractOf(root), 2, 'no jtk/ at all');
    mkdirSync(join(root, 'jtk'));
    writeFileSync(join(root, 'jtk', 'catalogue.json'), '{"contract": 2, "blocks": []}');
    assert.equal(contractOf(root), 2, 'a catalogue');
    schema('{"contract": 3, "locale": "de", "blocks": []}');
    assert.equal(contractOf(root), 3);
    schema('{"contract": 2, "blocks": []}');
    assert.equal(contractOf(root), 2, 'a schema.json saying another contract is not read');
    schema('{"contract": 3,');
    assert.equal(contractOf(root), 2, 'nor one that does not parse');
    schema('[3]');
    assert.equal(contractOf(root), 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the readings the owner settled (wiki/98 §15, 10 November 2026) ─────────
//
// Where wiki/98 left the door a choice, #55 read it one way and the owner
// read it again. Each test below is one row of §15 that changed the door.

test('§15 · 3: only a localized value nobody translated is "from the base"; a price, a date, a phone number or a picture never is', () => {
  // A language with no translation at all: its words are the original's, its picture and link have no language.
  const swiss = site.page('/', 'fr-CH').block('hero');
  assert.deepEqual(['title', 'lead', 'image', 'link'].map((key) => swiss.fromBase(key)), [true, true, false, false]);
  // A translation that gave the title and the picture's words, not the lead.
  const english = site.page('/', 'en').block('hero');
  assert.deepEqual(['title', 'lead', 'image', 'link'].map((key) => english.fromBase(key)), [false, true, false, false]);
  // A row the translation does not name: its words the original's, its price nobody's.
  const [cut, colour] = site.page('/preise', 'en').block('prices').rows('items');
  assert.deepEqual([cut.fromBase('photo'), colour.fromBase('title'), colour.fromBase('price')], [false, true, false]);
  // An entry: its title is words, its date, price, picture, choice and references are not.
  const granite = site.entry('works', 'granit', 'fr-CH').fields;
  assert.deepEqual(['title', 'date', 'price', 'cover', 'section', 'category'].map((key) => granite.fromBase(key)), [true, false, false, false, false, false]);
  assert.equal(granite.fromBase('nothing_declared'), false, 'a key the schema does not declare has no language either');

  // A list whole per language (`localized: true`): its rows are one side's, the words in them marked, the price not.
  const tree = {
    '/jtk/schema.json': { contract: 3, locale: 'de', locales: ['en'], blocks: [{ type: 'menu', v: 1, fields: [
      { key: 'dishes', kind: 'list', localized: true, of: [{ key: 'name', kind: 'text' }, { key: 'price', kind: 'money' }] },
    ] }] },
    '/jtk/pages/index.json': { id: HOME, path: '/', blocks: [{ _key: 'menu', type: 'menu', v: 1, dishes: [{ _key: 'd1', name: 'Rösti', price: { minor: 1800 } }] }] },
    '/jtk/pages/karte.json': { id: PRICES, path: '/karte', blocks: [{ _key: 'menu', type: 'menu', v: 1, dishes: [{ _key: 'd1', name: 'Rösti', price: { minor: 1800 } }] }] },
    '/jtk/pages/karte.en.json': { of: PRICES, locale: 'en', blocks: [{ _key: 'menu', dishes: [{ _key: 'e1', name: 'Hash browns', price: { minor: 1800 } }] }] },
  };
  const read = content(tree, { now });
  const [untranslated] = read.page('/', 'en').block('menu').rows('dishes');
  assert.deepEqual([untranslated.text('name'), untranslated.fromBase('name'), untranslated.fromBase('price')], ['Rösti', true, false]);
  const [translated] = read.page('/karte', 'en').block('menu').rows('dishes');
  assert.deepEqual([translated.text('name'), translated.fromBase('name'), translated.fromBase('price')], ['Hash browns', false, false]);
});

test('§15 · 4: a route per language is what follows the language\'s prefix, which always comes first; a language the map lacks takes the base\'s', () => {
  assert.equal(site.entry('works', 'eiche').address, '/werke/eiche', 'the base language: no prefix, its own pattern');
  assert.equal(site.entry('works', 'eiche', 'en').address, '/en/works/oak', '{ en: "/works/{slug}" } under /en');
  assert.equal(site.entry('works', 'eiche', 'fr-CH').address, '/fr-ch/werke/eiche', 'not in the map: the base\'s pattern, under its own prefix');
  assert.deepEqual([site.listingOf('works'), site.listingOf('works', 'en'), site.listingOf('works', 'fr-CH')], ['/werke', '/en/works', '/fr-ch/werke']);
  assert.deepEqual(site.specimens('works', { locale: 'en' }).map((one) => one.address), ['/en/works/_fl-text', '/en/works/_fl-gallery-grid']);
  // Where an entry is shown, by a pattern per language too.
  const read = content({
    '/jtk/schema.json': { contract: 3, locale: 'de', locales: ['en', 'fr'], blocks: [{ type: 'rate', v: 1, fields: [{ key: 'title', kind: 'text' }] }],
      collections: [{ name: 'rates', type: 'rate', route: 'none', shown_on: [{ de: '/preise#{slug}', en: '/prices#{slug}' }] }] },
    '/jtk/entries/rates/schnitt.json': { id: CUT, collection: 'rates', slug: 'schnitt', visible: true, fields: { title: 'Schnitt' } },
  }, { now });
  assert.deepEqual(['', 'en', 'fr'].map((locale) => read.entry('rates', 'schnitt', locale).anchor), ['/preise#schnitt', '/en/prices#schnitt', '/fr/preise#schnitt']);
});

test('§15 · 6: a collection has a listing address only where it declares one; a later page of one is <listing>/page/<n>', () => {
  assert.deepEqual([site.listingOf('works', '', 3), site.listingOf('works', 'fr-CH', 2)], ['/werke/page/3', '/fr-ch/werke/page/2']);
  assert.equal(site.listingOf('categories'), undefined, 'a detail route and no listing: none, not the directory its entries sit in');
  assert.equal(site.listingOf('categories', '', 2), undefined, 'nor a page two of none');
  assert.equal(site.listingOf('rates'), undefined, 'shown on another page: none, not that page');
  assert.equal(site.listingOf('nothing'), undefined, 'a collection the schema has not got: none, not /nothing');
  assert.deepEqual(site.collections.map((one) => [one.name, one.listing, one.prefix]), [
    ['works', true, '/werke'],
    ['categories', false, ''],
    ['rates', false, ''],
    ['tags', false, ''],
  ]);
  // «And 3 more» links where there is a listing to land on, and only there.
  assert.deepEqual(site.collections.map((one) => linksToListing(one)), [true, false, false, false]);
});

test('§15 · 11: money says from and on request in the page\'s language, in the kit\'s words or the template\'s own', () => {
  const amount = (locale) => site.money(4500, locale);
  assert.equal(site.money({ minor: 4500, from: true }), `ab ${amount()}`);
  assert.equal(site.money({ minor: 4500, from: true }, 'en'), `from ${amount('en')}`);
  assert.equal(site.money({ minor: 4500, from: true }, 'fr-CH'), `à partir de ${amount('fr-CH')}`, 'a regional language reads its language\'s words');
  assert.deepEqual(['', 'en', 'fr-CH'].map((locale) => site.money({ on_request: true }, locale)), ['auf Anfrage', 'on request', 'sur demande']);
  assert.equal(site.money({ minor: 4500, on_request: true }), 'auf Anfrage', 'on request has no amount to say, whatever it holds');
  assert.equal(site.money({ minor: 4500 }), amount(), 'no qualifier, no words');
  assert.equal(site.money({ from: true }), '', 'from what: nothing');
  // A template that says its own.
  assert.equal(site.money({ minor: 4500, from: true }, 'de', { from: '{amount} und mehr' }), `${amount()} und mehr`);
  assert.equal(site.money({ on_request: true }, 'en', { on_request: 'Ask us' }), 'Ask us');
  assert.equal(site.money({ on_request: true }, 'en', { from: '{amount}+' }), 'on request', 'what it does not say is the kit\'s');
  // The kit's words, in every language the booking form speaks.
  for (const locale of ['uk', 'de', 'en', 'ru', 'es', 'it', 'pt', 'fr']) {
    const words = priceWords(locale);
    assert.match(words.from, /\{amount\}/, locale);
    assert.ok(words.on_request.trim() !== '', locale);
  }
  assert.deepEqual(priceWords('uk'), { from: 'від {amount}', on_request: 'за запитом' });
  assert.deepEqual(priceWords('ja'), priceWords('en'), 'a language without words reads English');
});

test('§15 · 12: mint() writes an id on every page and entry and a key on every block, row and picture that has none; unnamed() says the rest, with the file and the fix', () => {
  const tree = {
    '/jtk/schema.json': { contract: 3, locale: 'de', locales: ['en'], blocks: [
      { type: 'prices', v: 1, fields: [
        { key: 'title', kind: 'text' },
        { key: 'items', kind: 'list', of: [{ key: 'title', kind: 'text' }, { key: 'options', kind: 'list', of: [{ key: 'label', kind: 'text' }] }] },
        { key: 'notes', kind: 'list', localized: true, of: [{ key: 'text', kind: 'text' }] },
      ] },
      { type: 'work', v: 1, fields: [{ key: 'title', kind: 'text' }, { key: 'pictures', kind: 'media', multiple: true }] },
      { type: 'contacts', v: 1, fields: [{ key: 'name', kind: 'text' }] },
    ], collections: [{ name: 'works', type: 'work', route: { detail: '/werke/{slug}' } }], shared: ['contacts'] },
    '/jtk/pages/preise.json': { path: '/preise', blocks: [
      { type: 'prices', v: 1, title: 'Preise', items: [{ title: 'Schnitt', options: [{ label: 'Kurz' }] }, { _key: 'r1', title: 'Färben' }] },
      { _key: 'Hero_1', type: 'prices', v: 1, title: 'Falsch' },
    ] },
    '/jtk/pages/preise.en.json': { locale: 'en', blocks: [{ title: 'Prices' }, { _key: 'Hero_1', notes: [{ text: 'Our own' }] }] },
    '/jtk/entries/works/eiche.json': { id: 'Eiche-1', collection: 'works', slug: 'eiche', visible: true, fields: { title: 'Eiche', pictures: [{ src: 'a' }, { _key: 'g1', src: 'b' }] }, blocks: [{ type: 'text', v: 1, body: 'Mehr.' }] },
    '/jtk/entries/works/eiche.en.json': { locale: 'en', fields: { title: 'Oak', pictures: [{ alt: 'One' }] }, blocks: [{ type: 'text', v: 1, body: 'More.' }] },
    '/jtk/shared.json': { blocks: [{ type: 'contacts', v: 1, name: 'Salon' }] },
    '/jtk/shared.en.json': { blocks: [{ name: 'The Salon' }] },
    '/jtk/modules/bookings.json': { v: 1, settings: { zone: 'Europe/Zurich', hours: [{ day: 'monday', opens: 540 }] } },
  };
  const before = structuredClone(tree);
  const said = unnamed(tree);
  const where = (list) => list.map((one) => `${one.file} ${one.place} ${one.mintable ? 'mint' : 'say'}`);
  assert.deepEqual(where(said), [
    '/jtk/entries/works/eiche.json id say',
    '/jtk/entries/works/eiche.json fields.pictures[0] mint',
    '/jtk/entries/works/eiche.json blocks[0] mint',
    '/jtk/pages/preise.json id mint',
    '/jtk/pages/preise.json blocks[0] mint',
    '/jtk/pages/preise.json blocks[0].items[0] mint',
    '/jtk/pages/preise.json blocks[0].items[0].options[0] mint',
    '/jtk/pages/preise.json blocks[1] say',
    '/jtk/entries/works/eiche.en.json fields.pictures[0] say',
    '/jtk/entries/works/eiche.en.json blocks[0] mint',
    '/jtk/pages/preise.en.json blocks[0] say',
    '/jtk/pages/preise.en.json blocks[1] say',
    '/jtk/pages/preise.en.json blocks[1].notes[0] mint',
    '/jtk/shared.en.json blocks[0] say',
    '/jtk/shared.json blocks[0] mint',
    '/jtk/modules/bookings.json settings.hours[0] mint',
  ]);
  // Each says its file and its fix.
  const say = (file, place) => said.find((one) => one.file === file && one.place === place).says;
  assert.match(say('/jtk/pages/preise.json', 'id'), /^jtk\/pages\/preise\.json: no "id" — .*npx @jtakeit\/astro catalogue mints it/);
  assert.match(say('/jtk/pages/preise.json', 'blocks[0]'), /^jtk\/pages\/preise\.json: blocks\[0\] has no "_key" — .*npx @jtakeit\/astro catalogue mints it/);
  assert.match(say('/jtk/pages/preise.en.json', 'blocks[0]'), /a translation names what it translates by that one's key.*copy it from jtk\/pages\/preise\.json$/);
  assert.match(say('/jtk/entries/works/eiche.en.json', 'fields.pictures[0]'), /copy it from jtk\/entries\/works\/eiche\.json$/);
  assert.match(say('/jtk/shared.en.json', 'blocks[0]'), /copy it from jtk\/shared\.json$/);
  assert.match(say('/jtk/entries/works/eiche.json', 'id'), /"id" is "Eiche-1", not a lowercase UUID/);
  assert.match(say('/jtk/pages/preise.json', 'blocks[1]'), /"_key" "Hero_1", which the panel cannot name .*rename it, here and in every translation that names it/);

  const { files: minted, minted: list } = mint(tree);
  assert.deepEqual(tree, before, 'what it was handed is not touched');
  assert.deepEqual(Object.keys(minted), ['/jtk/entries/works/eiche.en.json', '/jtk/entries/works/eiche.json', '/jtk/modules/bookings.json', '/jtk/pages/preise.en.json', '/jtk/pages/preise.json', '/jtk/shared.json'], 'only the files it changed');
  assert.equal(list.length, said.filter((one) => one.mintable).length);
  const page = minted['/jtk/pages/preise.json'];
  assert.match(page.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'a lowercase UUID, version 7');
  assert.deepEqual(Object.keys(page), ['id', 'path', 'blocks'], 'the id first, the rest as it was');
  const [block, wrong] = page.blocks;
  assert.match(block._key, /^k[0-9a-f]{7}$/, 'the platform\'s spelling of a key');
  assert.equal(Object.keys(block)[0], '_key');
  assert.match(block.items[0]._key, /^k[0-9a-f]{7}$/);
  assert.equal(block.items[1]._key, 'r1', 'a key once given is kept');
  assert.notEqual(block.items[0]._key, block.items[1]._key);
  assert.match(block.items[0].options[0]._key, /^k[0-9a-f]{7}$/, 'a row\'s own list, one level down');
  assert.equal(wrong._key, 'Hero_1', 'a misspelt key is said, never replaced');
  assert.equal(minted['/jtk/entries/works/eiche.json'].id, 'Eiche-1', 'nor a misspelt id');
  assert.deepEqual(minted['/jtk/entries/works/eiche.json'].fields.pictures.map((one) => one._key === 'g1' || /^k[0-9a-f]{7}$/.test(one._key)), [true, true]);
  assert.match(minted['/jtk/modules/bookings.json'].settings.hours[0]._key, /^k[0-9a-f]{7}$/);

  // Minted, only what needs a person's hand is left; and the door names by what was minted.
  const after = { ...tree, ...minted };
  assert.deepEqual(where(unnamed(after)), [
    '/jtk/entries/works/eiche.json id say',
    '/jtk/pages/preise.json blocks[1] say',
    '/jtk/entries/works/eiche.en.json fields.pictures[0] say',
    '/jtk/pages/preise.en.json blocks[0] say',
    '/jtk/pages/preise.en.json blocks[1] say',
    '/jtk/shared.en.json blocks[0] say',
  ]);
  const read = content(after, { now });
  assert.deepEqual(read.page('/preise').elsewhere.block('prices').at('title'), { 'data-jtk-path': `page:${page.id}:blocks[${block._key}].title` });
  assert.deepEqual(read.page('/preise').block('prices').at('items', 0, 'title'), { 'data-jtk-path': `blocks[${block._key}].items[${block.items[0]._key}].title` });

  // Contract 2 keeps no names in its files: nothing to say, nothing to mint.
  const two = { '/jtk/catalogue.json': { contract: 2, blocks: [] }, '/jtk/content/index.json': { path: '/', blocks: [{ type: 'hero' }] } };
  assert.deepEqual(unnamed(two), []);
  assert.deepEqual(mint(two).files, {});
  // Ids minted later sort later.
  assert.ok(uuid7(Date.parse('2026-11-10T00:00:00Z')) < uuid7(Date.parse('2026-11-11T00:00:00Z')));
});

test('§15 · 12: jtk catalogue mints them on a contract-3 tree before anything else, and writes back only the files it named', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-names-'));
  try {
    const write = (path, value) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
    };
    write('declaration.mjs', `export const BLOCKS = ${JSON.stringify([{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text' }] }])};`);
    write('jtk/schema.json', { contract: 3, locale: 'de', blocks: [{ type: 'hero', v: 1, fields: [{ key: 'title', kind: 'text' }] }] });
    write('jtk/pages/index.json', { path: '/', blocks: [{ type: 'hero', v: 1, title: 'Hallo' }] });
    write('jtk/pages/kontakt.json', '{"id":"0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e23","path":"/kontakt","blocks":[{"_key":"hero","type":"hero","v":1}]}');
    const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));
    const run = spawnSync('node', [tool, '--emit-only', '--root', root, '--declaration', 'declaration.mjs'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /jtk\/pages\/index\.json — an id and 1 _key\(s\) minted/);
    const home = JSON.parse(readFileSync(join(root, 'jtk', 'pages', 'index.json'), 'utf8'));
    assert.match(home.id, /^[0-9a-f-]{36}$/);
    assert.match(home.blocks[0]._key, /^k[0-9a-f]{7}$/);
    assert.equal(readFileSync(join(root, 'jtk', 'pages', 'kontakt.json'), 'utf8'), '{"id":"0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e23","path":"/kontakt","blocks":[{"_key":"hero","type":"hero","v":1}]}', 'a file with its names is not rewritten');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('§16: jtk catalogue writes no jtk/catalogue.json on a contract-3 tree, says where its schema is, and names one left there without removing it; contract 2 is written as before', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-no-catalogue-'));
  try {
    const write = (path, value) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
    };
    const blocks = [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text' }] }];
    write('declaration.mjs', `export const BLOCKS = ${JSON.stringify(blocks)};`);
    const catalogue = join(root, 'jtk', 'catalogue.json');
    const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));
    const run = (...more) => spawnSync('node', [tool, '--emit-only', '--root', root, '--generator', 'test', ...more], { encoding: 'utf8' });

    // Contract 2, no schema.json: the declaration emitted as it always was.
    const two = run('--declaration', 'declaration.mjs');
    assert.equal(two.status, 0, two.stderr);
    assert.equal(readFileSync(catalogue, 'utf8'), `${JSON.stringify({ contract: 2, generator: 'test', blocks, page_seo: [], business_facts: [] }, null, 2)}\n`);
    rmSync(catalogue);

    // Contract 3: the names minted, and no catalogue beside the schema.
    write('jtk/schema.json', { contract: 3, locale: 'de', blocks: [{ type: 'hero', v: 1, fields: [{ key: 'title', kind: 'text' }] }] });
    write('jtk/pages/index.json', { path: '/', blocks: [{ type: 'hero', v: 1, title: 'Hallo' }] });
    const three = run('--declaration', 'declaration.mjs', '--judge');
    assert.equal(three.status, 0, three.stderr);
    assert.match(three.stdout, /jtk\/pages\/index\.json — an id and 1 _key\(s\) minted/);
    assert.match(three.stdout, /jtk\/schema\.json is a contract-3 site's schema, which jtk schema writes from src\/content\/blocks\.ts and checks against the page \(jtakeit-core wiki\/98 §7 · 2\); no jtk\/catalogue\.json is written/);
    assert.match(three.stdout, /--judge sends a catalogue, and a contract-3 tree has none: jtk schema --judge sends its schema/);
    assert.equal(existsSync(catalogue), false, 'no jtk/catalogue.json beside jtk/schema.json');

    // The declaration is not read on contract 3: without one, the same.
    const none = run();
    assert.equal(none.status, 0, none.stderr);
    assert.equal(existsSync(catalogue), false);

    // One left from before the move: said, left where it is, and the run fails.
    write('jtk/catalogue.json', '{"contract":2,"blocks":[]}');
    const stray = run('--declaration', 'declaration.mjs');
    assert.equal(stray.status, 1);
    assert.match(stray.stderr, /jtk\/catalogue\.json is contract 2's schema, beside contract 3's jtk\/schema\.json, and the platform refuses a tree with both — remove it/);
    assert.equal(readFileSync(catalogue, 'utf8'), '{"contract":2,"blocks":[]}', 'said, not deleted');
    rmSync(catalogue);

    // A name it cannot mint counts as well: a misspelt id is never replaced.
    write('jtk/pages/kontakt.json', { id: 'NOT-AN-ID', path: '/kontakt', blocks: [{ _key: 'hero', type: 'hero', v: 1 }] });
    const misspelt = run('--declaration', 'declaration.mjs');
    assert.equal(misspelt.status, 1);
    assert.match(misspelt.stderr, /jtk\/pages\/kontakt\.json: "id" is "NOT-AN-ID"/);
    assert.equal(existsSync(catalogue), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('§15 · 14: the currency is site.json\'s top-level currency and nothing else', () => {
  const tree = (facts) => ({ '/jtk/schema.json': { contract: 3, locale: 'de', blocks: [] }, '/jtk/site.json': facts });
  assert.equal(content(tree({ currency: 'chf', business: { currency: 'eur' } })).currency, 'CHF');
  assert.equal(content(tree({ business: { currency: 'eur' } })).currency, '', 'business is contract 2\'s: not read');
  assert.equal(content(tree({ business: { currency: 'eur' } })).money(4500), content(tree({})).money(4500), 'priced in nothing, as a site that has not said');
  // Contract 2 reads it where it has always been.
  assert.equal(content({ '/jtk/catalogue.json': { locale: 'de' }, '/jtk/site.json': { business: { currency: 'eur' } } }).currency, 'EUR');
});

test('§15 · 15: whitespace-only text is empty; a specimen draws an invisible value, not a space', () => {
  const tree = files();
  tree['/jtk/pages/kontakt.json'] = { id: CONTACT, blocks: [{ _key: 'hero', type: 'hero', v: 1, title: '   ', lead: ' \n\t', image: { src: 'media/2f/x.jpg', alt: '  ' } }] };
  tree['/jtk/pages/kontakt.en.json'] = { of: CONTACT, locale: 'en', blocks: [{ _key: 'hero', title: '  ', lead: 'Write to us' }] };
  const read = content(tree, { now });
  const hero = read.page('/kontakt').block('hero');
  assert.deepEqual([hero.value('title'), hero.text('title'), hero.value('lead'), hero.text('lead')], [undefined, '', undefined, '']);
  assert.equal(hero.picture('image').alt, '', 'an alt of spaces is no alt');
  const english = read.page('/kontakt', 'en').block('hero');
  assert.deepEqual([english.text('title'), english.fromBase('title')], ['', true], 'a translation\'s spaces translate nothing');
  assert.deepEqual([english.text('lead'), english.fromBase('lead')], ['Write to us', false]);
  // The specimens: every text drawn, with nothing a person sees in it.
  const [text] = read.specimens('works', { locale: '' });
  const body = text.here.body[0].value('body');
  assert.equal(body, '​');
  assert.notEqual(body.trim(), '', 'a value to trim()');
  assert.equal(text.fields.value('title'), '​');
});

test('§15 · 16: an id is a lowercase UUID and a module a module the schema turns on — anything else is named nowhere', () => {
  const tree = files();
  tree['/jtk/pages/preise.json'] = { ...tree['/jtk/pages/preise.json'], id: PRICES.toUpperCase() };
  tree['/jtk/entries/works/granit.json'] = { ...tree['/jtk/entries/works/granit.json'], id: 'granit-1' };
  tree['/jtk/modules/orders.json'] = { v: 1, settings: { note: 'Danke', steps: [{ _key: 's1', label: 'Bezahlt' }] } };
  const read = content(tree, { now });
  assert.deepEqual(read.page('/preise').elsewhere.block('prices').at('title'), {}, 'an id in capitals is no id the grammar names');
  assert.deepEqual(read.page('/preise').block('prices').at('title'), { 'data-jtk-path': 'blocks[list].title' }, 'its own page names no document');
  assert.deepEqual(read.entry('works', 'granit').fields.at('title'), {}, 'nor is a slug-like id');
  assert.deepEqual(read.entry('works', 'eiche').fields.at('title'), { 'data-jtk-path': `entry:${OAK}:title` });
  assert.deepEqual(read.settings('bookings').at('zone'), { 'data-jtk-path': 'module:bookings:zone' }, 'a module the schema turns on');
  const orders = read.settings('orders');
  assert.equal(orders.text('note'), 'Danke', 'a module it does not is read…');
  assert.deepEqual([orders.at('note'), orders.rows('steps')[0].at('label')], [{}, {}], '…and named nowhere');
});

test('§15 · 17: a key in a translation that the schema does not declare is ignored', () => {
  const tree = files();
  tree['/jtk/pages/index.json'].blocks[0].note = 'Nur hier';
  tree['/jtk/pages/index.en.json'] = { ...tree['/jtk/pages/index.en.json'], seo: { title: 'Home', keywords: 'door' }, blocks: [{ _key: 'hero', title: 'Hello', note: 'Only here', badge: 'New' }] };
  tree['/jtk/entries/works/eiche.en.json'] = { ...tree['/jtk/entries/works/eiche.en.json'], fields: { ...tree['/jtk/entries/works/eiche.en.json'].fields, colour: 'brown' } };
  const read = content(tree, { now });
  const hero = read.page('/', 'en').block('hero');
  assert.equal(hero.text('title'), 'Hello', 'a declared word is laid over');
  assert.deepEqual([hero.text('note'), hero.text('badge')], ['Nur hier', ''], 'an undeclared one is the original\'s, or nothing');
  assert.deepEqual(read.page('/', 'en').seo, { title: 'Home', description: 'Willkommen' }, 'an SEO key page_seo does not declare is not read either');
  assert.equal(read.entry('works', 'eiche', 'en').fields.text('colour'), '');
});
