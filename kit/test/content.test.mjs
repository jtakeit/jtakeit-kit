// The door (lib/content): a site's content read the way the platform reads
// contract 2, on a tree of files laid out the way the platform writes them —
// pages in two languages, shared text in three, a collection with pages and
// one without, both orders, both groups, a tree, a schedule, a module's
// settings that are not its first block, and the annotation of each value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { content, TAPPABLE, tappable, sharedLocaleOf, canonicalLocale, specimenId } from '../lib/content/index.mjs';
import { collectContent, readJtk } from '../lib/content/node.mjs';
import { draftsOf } from '../lib/meta.mjs';

const now = Date.parse('2026-11-09T12:00:00Z');

const catalogue = {
  contract: 2,
  generator: 'test',
  locale: 'en',
  locales: ['de', 'de-ch'],
  blocks: [
    { type: 'text', v: 1, label: 'Text', fields: [{ key: 'body', label: 'Text', kind: 'markdown', client_editable: true }] },
    { type: 'hero', v: 1, label: 'Hero', fields: [
      { key: 'title', label: 'Title', kind: 'text', client_editable: true },
      { key: 'image', label: 'Photo', kind: 'media', client_editable: true },
      { key: 'image_alt', label: 'Photo words', kind: 'text', no_tap_target: true, beside: 'image' },
    ] },
    { type: 'prices', v: 1, label: 'Prices', fields: [
      { key: 'title', label: 'Title', kind: 'text', client_editable: true },
      { key: 'items', label: 'Rows', kind: 'list', of: [{ key: 'title', label: 'Name', kind: 'text', client_editable: true }, { key: 'price', label: 'Price', kind: 'money', client_editable: true }] },
    ] },
    { type: 'contacts', v: 1, label: 'Contacts', fields: [{ key: 'phone', label: 'Phone', kind: 'text', client_editable: true }] },
    { type: 'work', v: 1, label: 'Work', fields: [
      { key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true },
      { key: 'date', label: 'Date', kind: 'date', required: true, no_tap_target: true },
      { key: 'cover', label: 'Cover', kind: 'media', client_editable: true },
      { key: 'cover_alt', label: 'Cover words', kind: 'text', no_tap_target: true, beside: 'cover' },
      { key: 'pictures', label: 'Pictures', kind: 'media', multiple: true, client_editable: true },
      { key: 'section', label: 'Section', kind: 'select', options: ['wood', 'stone', 'glass'], option_labels: { wood: { en: 'Wood', de: 'Holz' }, stone: 'Stone' } },
      { key: 'category', label: 'Category', kind: 'ref', ref: 'categories' },
      { key: 'body', label: 'Text', kind: 'markdown', client_editable: true },
    ] },
    { type: 'gallery', v: 1, label: 'Gallery', views: [{ key: 'grid', label: 'Grid', min: 1 }, { key: 'row', label: 'Row', min: 2 }], fields: [
      { key: 'items', label: 'Pictures', kind: 'media', multiple: true, client_editable: true },
    ] },
    { type: 'category', v: 1, label: 'Category', fields: [
      { key: 'title', label: 'Name', kind: 'text', required: true, client_editable: true },
      { key: 'parent', label: 'Parent', kind: 'ref', ref: 'categories' },
    ] },
    { type: 'rate', v: 1, label: 'Rate', fields: [
      { key: 'title', label: 'Name', kind: 'text', required: true, client_editable: true },
      { key: 'costs', label: 'Price', kind: 'money', client_editable: true },
      { key: 'category', label: 'Category', kind: 'ref', ref: 'categories' },
    ] },
  ],
  page_seo: [],
  business_facts: [],
  collections: [
    { name: 'works', label: { en: 'Works', de: 'Arbeiten' }, prefix: '/works', type: 'work', order: { by: 'date', desc: true }, group: 'section', per_page: 2, body: ['text', 'gallery'] },
    { name: 'categories', label: 'Categories', prefix: '/categories', type: 'category', per_page: 1 },
    { name: 'rates', label: 'Rates', prefix: '/rates', type: 'rate', pages: false, group: 'category' },
  ],
  modules: { bookings: { services: 'rates', resources: 'works' } },
};

const page = (path, blocks, extra = {}) => ({ path, schema_version: 1, seo: { title: path }, ...extra, blocks });
const entry = (collection, path, fields, extra = {}, body = []) => ({
  path, collection, schema_version: 1, visible: true, seo: {}, ...extra,
  blocks: [{ _key: `${fields.type}-1`, v: 1, ...fields }, ...body],
});

/** The files as Vite's glob hands them, out of order on purpose: the door sorts. */
function files() {
  return {
    '/jtk/site.json': { schema_version: 1, slug: 'test', locale: 'en', business: { currency: 'chf' } },
    '/jtk/content/start.json': page('/', [
      { _key: 'hero0001', type: 'hero', v: 1, title: 'Hello', image: 'hero', image_alt: 'The door at dawn' },
    ]),
    '/jtk/content/de.json': page('/de', [{ _key: 'hero0001', type: 'hero', v: 1, title: 'Hallo', image: 'hero' }], { locale: 'de' }),
    '/jtk/content/prices.json': page('/prices', [
      { _key: 'hero0001', type: 'hero', v: 1, title: 'Prices' },
      { _key: 'list0001', type: 'prices', v: 1, title: 'Cuts', items: [{ _key: 'r7k2', title: 'Short', price: 4500 }, { _key: 'q1w2', title: 'Long', price: 6500 }] },
    ]),
    // A translation known by its path alone: no `locale` key.
    '/jtk/content/de/prices.json': page('/de/prices', [{ _key: 'hero0001', type: 'hero', v: 1, title: 'Preise' }]),
    '/jtk/shared.json': { schema_version: 1, blocks: [{ _key: 'contacts', type: 'contacts', v: 1, phone: '+41 1' }] },
    '/jtk/shared.de.json': { blocks: [{ type: 'contacts', v: 1, phone: '+41 2' }] },
    '/jtk/shared.de-CH.json': { blocks: [{ type: 'contacts', v: 1, phone: '+41 3' }] },
    '/jtk/content/works/oak.json': entry('works', '/works/oak', { type: 'work', title: 'Oak', date: '2026-03-01', section: 'wood', category: 'beauty', cover: 'one', pictures: [{ src: 'two', alt: 'Two' }, { src: '' }, { src: 'three' }], body: 'Oak.' }, {}, [
      { _key: 'text-2', type: 'text', v: 1, body: 'More.' },
      { _key: 'gallery-1', type: 'gallery', v: 1, view: 'grid', items: [{ _key: 'g1', src: 'four', alt: 'Four' }, { _key: 'g2', src: 'media/x/a1b2.jpg', alt: '' }] },
    ]),
    '/jtk/content/works/elm.json': entry('works', '/works/elm', { type: 'work', title: 'Elm', date: '2026-01-01', section: 'wood', cover: 'two', cover_alt: 'An elm door' }),
    '/jtk/content/works/granite.json': entry('works', '/works/granite', { type: 'work', title: 'Granite', date: '2026-05-01', section: 'stone', category: 'nails' }),
    '/jtk/content/works/pane.json': entry('works', '/works/pane', { type: 'work', title: 'Pane', date: '2026-04-01' }),
    '/jtk/content/works/hidden.json': entry('works', '/works/hidden', { type: 'work', title: 'Hidden', date: '2026-06-01', section: 'wood' }, { visible: false }),
    '/jtk/content/works/soon.json': entry('works', '/works/soon', { type: 'work', title: 'Soon', date: '2026-07-01' }, { show_at: '2026-12-01T00:00:00Z' }),
    '/jtk/content/works/gone.json': entry('works', '/works/gone', { type: 'work', title: 'Gone', date: '2026-02-01' }, { hide_at: '2026-11-01T00:00:00Z' }),
    '/jtk/content/de/works/oak.json': entry('works', '/de/works/oak', { type: 'work', title: 'Eiche', date: '2026-03-01', section: 'wood' }, { locale: 'de' }),
    '/jtk/content/categories/nails.json': entry('categories', '/categories/nails', { type: 'category', title: 'Nails', parent: 'beauty' }),
    '/jtk/content/categories/beauty.json': entry('categories', '/categories/beauty', { type: 'category', title: 'Beauty' }),
    '/jtk/content/categories/gel.json': entry('categories', '/categories/gel', { type: 'category', title: 'Gel', parent: 'nails' }),
    '/jtk/content/rates/cut.json': entry('rates', '/rates/cut', { type: 'rate', title: 'Cut', costs: 4500, category: 'beauty' }),
    '/jtk/content/rates/file.json': entry('rates', '/rates/file', { type: 'rate', title: 'File', costs: 2000, category: 'gel' }),
    '/jtk/content/rates/loose.json': entry('rates', '/rates/loose', { type: 'rate', title: 'Loose', costs: 1000 }),
    '/jtk/bookings.json': { schema_version: 1, module: 'bookings', blocks: [{ type: 'note', v: 1, hours: [] }, { type: 'bookings_config', v: 1, zone: 'Europe/Zurich', hours: [{ day: 'monday', opens: 540, closes: 1080 }] }] },
    '/jtk/catalogue.json': catalogue,
    '/jtk/session.json': { session: 's', key: 'k' },
    '/jtk/design.json': { v: 2, field: '' },
  };
}

const site = content(files(), { now });

test('the languages are the schema\'s, canonical, base first; a document says `\'\'` for the base', () => {
  assert.equal(site.locale, 'en');
  assert.deepEqual(site.locales, ['en', 'de', 'de-CH']);
  assert.equal(canonicalLocale('de-ch'), 'de-CH');
  assert.equal(site.localeOf('/de-ch/works'), 'de-CH', 'an address carries the lowercase');
  assert.equal(site.inLocale('de-CH', '/works'), '/de-ch/works');
  assert.equal(site.inLocale('de', '/'), '/de');
  assert.equal(site.inLocale('en', '/x'), '/x', 'the base, asked by its tag, has no prefix');
  assert.equal(site.currency, 'CHF');
});

test('a page is the path in its file, in two languages, and its alternates are the same address in each', () => {
  const home = site.page('/');
  assert.equal(home.file, '/jtk/content/start.json', 'the home is found by its path, not by being index.json');
  assert.equal(home.block('hero').text('title'), 'Hello');
  const de = site.page('/', 'de');
  assert.equal(de.address, '/de');
  assert.equal(de.block('hero').text('title'), 'Hallo');
  const preise = site.page('/prices', 'de');
  assert.equal(preise.locale, 'de', 'a translation without a `locale` key is in the language its path starts with');
  assert.equal(site.page('/de/prices').file, '/jtk/content/de/prices.json', 'and its own path finds it too');
  assert.deepEqual(site.alternatesOf(site.page('/prices')), [
    { locale: 'de', address: '/de/prices' },
    { locale: '', address: '/prices' },
  ]);
  assert.deepEqual(site.alternatesOf(home), [{ locale: 'de', address: '/de' }, { locale: '', address: '/' }]);
  assert.deepEqual(site.pages('de').map((one) => one.address), ['/de', '/de/prices']);
  const nobody = site.page('/nowhere');
  assert.equal(nobody.block('hero').text('title'), '');
  assert.deepEqual(nobody.block('hero').at('title'), {}, 'a page nobody wrote is annotated nowhere');
});

test('shared text: shared.json, shared.de.json, and shared.de-CH.json found whatever the case of its region', () => {
  assert.equal(site.shared().block('contacts').text('phone'), '+41 1');
  assert.equal(site.shared('de').block('contacts').text('phone'), '+41 2');
  assert.equal(site.shared('de-CH').block('contacts').text('phone'), '+41 3');
  assert.equal(site.shared('de-ch').block('contacts').text('phone'), '+41 3');
  assert.deepEqual(site.shared('de-CH').block('contacts').at('phone'), { 'data-jtk-path': 'shared:blocks[0].phone' });
  assert.equal(sharedLocaleOf('shared.de-CH.json'), 'de-CH');
  assert.equal(sharedLocaleOf('shared.de-ch.json'), 'de-CH');
  assert.equal(sharedLocaleOf('/jtk/shared.json'), '');
  assert.equal(sharedLocaleOf('sharedness.json'), null);
});

test('a collection with pages gives an entry an address; one without, an anchor on its listing', () => {
  const oak = site.entry('works', 'oak');
  assert.equal(oak.slug, 'oak');
  assert.equal(oak.address, '/works/oak');
  assert.equal(site.addressOf(oak), '/works/oak');
  assert.equal(oak.anchor, undefined);
  const de = site.entry('works', 'oak', 'de');
  assert.equal(de.slug, 'oak', 'the slug is the path without the language and the prefix');
  assert.equal(de.address, '/de/works/oak');
  const cut = site.entry('rates', 'cut');
  assert.equal(cut.address, undefined);
  assert.equal(site.anchorOf(cut), '/rates#rates-cut');
  assert.equal(site.listingOf('works', 'de', 2), '/de/works/page/2');
  assert.equal(site.listingOf('works'), '/works');
  assert.deepEqual(site.alternatesOf(oak), [{ locale: 'de', address: '/de/works/oak' }, { locale: '', address: '/works/oak' }]);
  assert.deepEqual(site.alternatesOf(site.entry('works', 'elm')), [], 'one language is no alternates');
});

test('the order: by date, newest first; manual, by slug; a field\'s value read where it is', () => {
  assert.deepEqual(site.entries('works').map((one) => one.slug), ['granite', 'pane', 'oak', 'elm']);
  assert.deepEqual(site.entries('categories').map((one) => one.slug), ['beauty', 'gel', 'nails']);
  assert.deepEqual(site.entries('works', { locale: 'de' }).map((one) => one.slug), ['oak']);
  const { entries, size, last } = site.listingPages('works');
  assert.deepEqual(entries.map((one) => one.slug), ['oak', 'elm', 'granite', 'pane'], 'a grouped listing cuts its pages out of the grouped order');
  assert.equal(size, 2);
  assert.equal(last, 2);
});

test('show_at, hide_at and visible: built always, listed while out', () => {
  const all = site.entries('works', { all: true }).map((one) => [one.slug, one.visible]);
  assert.deepEqual(Object.fromEntries(all), { soon: false, hidden: false, granite: true, pane: true, oak: true, gone: false, elm: true });
  assert.ok(!site.entries('works').some((one) => ['hidden', 'soon', 'gone'].includes(one.slug)));
  const later = site.entries('works', { now: Date.parse('2026-12-02T00:00:00Z') }).map((one) => one.slug);
  assert.ok(later.includes('soon'), 'asked at another moment, a scheduled entry is out');
  const earlier = site.entries('works', { now: Date.parse('2026-10-01T00:00:00Z') }).map((one) => one.slug);
  assert.ok(earlier.includes('gone') && !earlier.includes('soon'));
});

test('a group by a select: its options in their order, by their label in the page\'s language, fixed', () => {
  const runs = site.groupsOf('works', site.entries('works'), 'de');
  assert.deepEqual(runs.map((run) => [run.heading?.text, run.heading?.fixed, run.entries.map((one) => one.slug)]), [
    ['Holz', true, ['oak', 'elm']],
    ['Stone', true, ['granite']],
    [undefined, undefined, ['pane']],
  ]);
  assert.deepEqual(runs[0].heading.at, {});
});

test("a group by a ref: the other collection's entries in its order, each annotated as that entry's title", () => {
  const runs = site.groupsOf('rates', site.entries('rates'));
  assert.deepEqual(runs.map((run) => [run.heading?.text, run.entries.map((one) => one.slug)]), [
    ['Beauty', ['cut']],
    ['Gel', ['file']],
    [undefined, ['loose']],
  ]);
  assert.deepEqual(runs[0].heading.at, { 'data-jtk-path': 'page:/categories/beauty:blocks[0].title' });
  assert.equal(runs[0].heading.fixed, false);
  assert.equal(site.groupsOf('categories', site.entries('categories')), undefined, 'a collection with no group');
});

test('a tree: the trail to the root and the children; what points at a category or anything under it', () => {
  const tree = site.treeOf(site.entry('categories', 'gel'));
  assert.deepEqual(tree.trail.map((one) => one.slug), ['beauty', 'nails']);
  const beauty = site.treeOf(site.entry('categories', 'beauty'));
  assert.deepEqual(beauty.children.map((one) => one.slug), ['nails']);
  const referrers = site.referrersOf(site.entry('categories', 'beauty'));
  assert.deepEqual(referrers.map((one) => [one.collection.name, one.entries.map((e) => e.slug), one.more]), [
    ['works', ['granite', 'oak'], 0],
    ['rates', ['cut', 'file'], 0],
  ]);
  assert.deepEqual(site.referrersOf(site.entry('categories', 'gel')).map((one) => one.entries.map((e) => e.slug)), [['file']]);
});

test("a module's settings are its `<module>_config` block, wherever it sits", () => {
  const settings = site.module('bookings');
  assert.equal(settings.zone, 'Europe/Zurich');
  assert.equal(settings.hours.length, 1);
  assert.equal(settings.type, undefined);
  assert.deepEqual(site.module('orders'), {});
  assert.deepEqual(site.rolesOf('bookings'), { services: 'rates', resources: 'works' });
});

test("annotations, in contract 2's grammar: a page's own, another page's, shared, rows by index or key", () => {
  const prices = site.page('/prices');
  const list = prices.block('prices');
  assert.deepEqual(list.at('title'), { 'data-jtk-path': 'blocks[1].title' });
  assert.deepEqual(list.at('items', 1, 'title'), { 'data-jtk-path': 'blocks[1].items[1].title' });
  assert.deepEqual(list.at('items', 'r7k2', 'price'), { 'data-jtk-path': 'blocks[1].items[0].price' }, 'a row by its _key is written by its place');
  assert.deepEqual(list.rows('items').map((row) => [row.key, row.at('price')['data-jtk-path'], row.value('price')]), [
    ['r7k2', 'blocks[1].items[0].price', 4500],
    ['q1w2', 'blocks[1].items[1].price', 6500],
  ]);
  assert.deepEqual(prices.elsewhere.block('prices').at('title'), { 'data-jtk-path': 'page:/prices:blocks[1].title' });
  assert.deepEqual(prices.block('missing').at('title'), {});
});

test("an entry: `page:<path>:` drawn elsewhere, its own on its page; a gallery by the field it is in", () => {
  const oak = site.entry('works', 'oak');
  assert.deepEqual(oak.fields.at('title'), { 'data-jtk-path': 'page:/works/oak:blocks[0].title' });
  assert.deepEqual(oak.here.fields.at('title'), { 'data-jtk-path': 'blocks[0].title' });
  assert.equal(oak.here.elsewhere, oak);
  const [text, gallery] = oak.here.body;
  assert.deepEqual(text.at('body'), { 'data-jtk-path': 'blocks[1].body' });
  assert.equal(gallery.view, 'grid');
  assert.deepEqual(gallery.gallery('items'), [
    { src: 'four', alt: 'Four', 'data-jtk-path': 'blocks[2].items[0].src' },
    { src: 'media/x/a1b2.jpg', alt: '', 'data-jtk-path': 'blocks[2].items[1].src' },
  ], 'annotated by its own field, `items`, never `work`');
  // The entry's own gallery: the empty picture left out, its place kept; a
  // picture with no words of its own reads the entry's title, as a cover does.
  assert.deepEqual(oak.here.fields.gallery('pictures'), [
    { src: 'two', alt: 'Two', 'data-jtk-path': 'blocks[0].pictures[0].src' },
    { src: 'three', alt: 'Oak', 'data-jtk-path': 'blocks[0].pictures[2].src' },
  ]);
});

test('a picture\'s words: `<key>_alt` beside it, else an entry\'s title', () => {
  assert.deepEqual(site.page('/').block('hero').picture('image'), { src: 'hero', alt: 'The door at dawn', 'data-jtk-path': 'blocks[0].image' });
  assert.equal(site.page('/', 'de').block('hero').picture('image').alt, '', 'a page has no title to fall back on');
  assert.equal(site.entry('works', 'oak').fields.picture('cover').alt, 'Oak');
  assert.equal(site.entry('works', 'elm').fields.picture('cover').alt, 'An elm door');
});

test('annotate off: the same values, and no annotation anywhere', () => {
  const quiet = content(files(), { now, annotate: false });
  const oak = quiet.entry('works', 'oak');
  assert.deepEqual(oak.fields.at('title'), {});
  assert.deepEqual(oak.here.fields.at('title'), {});
  assert.deepEqual(oak.here.body[1].gallery('items')[0], { src: 'four', alt: 'Four' });
  assert.deepEqual(quiet.page('/').block('hero').picture('image'), { src: 'hero', alt: 'The door at dawn' });
  assert.deepEqual(quiet.shared().block('contacts').at('phone'), {});
  assert.deepEqual(quiet.groupsOf('rates', quiet.entries('rates'))[0].heading.at, {});
  assert.equal(quiet.page('/').block('hero').text('title'), 'Hello');
});

test('empty is absent: null, "" and [] are no value; text is always words', () => {
  const quiet = content({ '/jtk/content/index.json': { path: '/', blocks: [{ type: 'x', a: null, b: '', c: [], d: 0, e: false, f: 3 }] } });
  const block = quiet.page('/').block('x');
  assert.deepEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => block.value(key)), [undefined, undefined, undefined, 0, false, 3, undefined]);
  assert.equal(block.text('f'), '3');
  assert.equal(block.text('a'), '');
  assert.deepEqual(block.rows('c'), []);
});

test("money, in the site's currency, from minor units or `{ minor }`", () => {
  assert.equal(site.money(4500, 'de'), site.money({ minor: 4500 }, 'de'));
  assert.match(site.money(4550, 'de'), /45,50/);
  assert.match(site.money(4500), /CHF|Fr/);
  assert.equal(content({}).money(4500, 'en'), '45', 'no currency said, no sign made up');
});

test('the tappable kinds are the platform\'s, one set', () => {
  assert.deepEqual([...TAPPABLE].sort(), ['duration', 'markdown', 'media', 'money', 'richtext_lite', 'text', 'textarea']);
  assert.equal(tappable({ kind: 'money' }), true);
  assert.equal(tappable({ kind: 'text', client_editable: false }), false);
  assert.equal(tappable({ kind: 'text', no_tap_target: true }), false);
  assert.equal(tappable({ kind: 'url' }), false);
  assert.equal(site.entry('works', 'oak').fields.tappable('date'), false);
  assert.equal(site.entry('works', 'oak').fields.tappable('title'), true);
});

test('specimens: one per arrangement of every type a post may hold, in every language, listed as drafts', () => {
  const made = site.specimens('works').map((one) => one.address);
  assert.deepEqual(made, [
    '/works/_fl-text', '/works/_fl-gallery-grid', '/works/_fl-gallery-row',
    '/de/works/_fl-text', '/de/works/_fl-gallery-grid', '/de/works/_fl-gallery-row',
    '/de-ch/works/_fl-text', '/de-ch/works/_fl-gallery-grid', '/de-ch/works/_fl-gallery-row',
  ]);
  assert.equal(specimenId('gallery', 'row'), '_fl-gallery-row');
  const row = site.specimens('works', { locale: 'de' })[2];
  assert.equal(row.specimen, true);
  assert.equal(row.visible, false);
  assert.deepEqual(row.here.body[0].gallery('items').map((one) => one.src), ['two', 'three'], "the collection's own galleries' pictures, as many as the view asks");
  assert.deepEqual(site.specimens('rates'), [], 'a collection without pages has no page to show one on');
  const drafts = draftsOf(site);
  assert.ok(drafts.includes('/de-ch/works/_fl-text/') && drafts.includes('/works/hidden/') && drafts.includes('/works/soon/'));
  assert.ok(!drafts.includes('/works/oak/'));
});

test('a file under jtk/content without a path is nobody\'s, and said so', () => {
  assert.throws(() => content({ '/jtk/content/lost.json': { blocks: [] } }), /lost\.json: no "path"/);
});

test('readJtk: every .json under jtk/, keyed as the glob keys them, pictures and the session left out', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-door-'));
  try {
    for (const [key, value] of Object.entries(files())) {
      mkdirSync(join(root, key, '..'), { recursive: true });
      writeFileSync(join(root, key), JSON.stringify(value));
    }
    mkdirSync(join(root, 'jtk', 'content', 'works', 'media'), { recursive: true });
    writeFileSync(join(root, 'jtk', 'content', 'works', 'media', 'x.json'), '{}');
    const read = await readJtk(root);
    assert.ok(!('/jtk/session.json' in read));
    assert.ok(!Object.keys(read).some((key) => key.includes('/media/')));
    assert.deepEqual(read['/jtk/content/start.json'], files()['/jtk/content/start.json']);
    assert.deepEqual(Object.keys(read), Object.keys(read).sort());
    const fromDisk = content(read, { now });
    assert.deepEqual(fromDisk.entries('works').map((one) => one.slug), site.entries('works').map((one) => one.slug));

    // The content the kit's checks read sees the regional shared text, which
    // a lowercase-only pattern used to miss.
    const collected = await collectContent(root, { now });
    assert.deepEqual(collected.shared.map((one) => one.locale ?? ''), ['de-CH', 'de', ''], 'by file name, as before');
    assert.equal(collected.pages[0].path, '/');
    assert.equal(collected.pages.find((one) => one.path === '/works/soon').visible, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// A collection ordered by hand lists in the owner's order: each entry's
// `rank`, written by their moves in the panel (jtakeit-core wiki/94 · M4).
// An entry without one comes after, in the order it came.
test('a hand-ordered collection lists by rank, the unranked after', () => {
  const ranked = files();
  ranked['/jtk/content/categories/nails.json'] = { ...ranked['/jtk/content/categories/nails.json'], rank: 'U' };
  ranked['/jtk/content/categories/gel.json'] = { ...ranked['/jtk/content/categories/gel.json'], rank: 'k' };
  const moved = content(ranked, { now });
  assert.deepEqual(moved.entries('categories').map((one) => one.slug), ['nails', 'gel', 'beauty']);
});
