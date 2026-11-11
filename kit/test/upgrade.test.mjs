// `@jtakeit/kit/upgrade` (lib/upgrade3.mjs): a contract-2 declaration and
// tree in contract 3's words (jtakeit-core wiki/98 §7 · 2 and 3), and what
// is left to a person (§8). The schema it makes is judged by the offline
// copy of the platform's judge; the tree it makes is read back through the
// door, which must find in it what it found in contract 2's.
//
// And the door's typed reads the template needs on both contracts: a price
// in minor units, the entries a reference names, the page a collection
// without pages is shown on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../lib/content/index.mjs';
import { judgeSchema, schemaOf, schemaText } from '../lib/schema.mjs';
import { collection3, contactsOf, documentsOf, field3, fields3, rankBetween, rankSpread, stateOf, tablesOf } from '../lib/upgrade3.mjs';

const ce = { client_editable: true };

/** A contract-2 declaration with every shape the upgrade changes. */
const DECLARED = {
  LOCALE: 'de-ch',
  LOCALES: [],
  BLOCKS: [
    {
      type: 'hero',
      v: 1,
      label: 'Hero',
      fields: [
        { key: 'title', label: 'Title', kind: 'text', max: 80, ...ce },
        { key: 'image', label: 'Picture', kind: 'media', max: 0, ...ce },
        { key: 'image_alt', label: 'Words', kind: 'text', max: 120, ...ce, no_tap_target: true, beside: 'image' },
        { key: 'mood', label: 'Mood', kind: 'select', options: ['calm', 'loud'], option_labels: { calm: 'Ruhig' } },
        { key: 'old', label: 'Old', kind: 'text', deprecated: true },
      ],
    },
    {
      type: 'gallery',
      v: 1,
      label: 'Gallery',
      fields: [{ key: 'work', label: 'Work', kind: 'media', multiple: true, ...ce }],
      views: [{ key: 'row', label: 'Row', min: 0, max: 3, sample: '/x' }],
    },
    { type: 'service', v: 1, label: 'Service', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true, ...ce }, { key: 'takes', label: 'Takes', kind: 'duration', required: true, ...ce }, { key: 'costs', label: 'Price', kind: 'money', ...ce }, { key: 'fewest', label: 'Fewest', kind: 'number', min: 0 }] },
    {
      type: 'master',
      v: 1,
      label: 'Master',
      fields: [
        { key: 'title', label: 'Name', kind: 'text', required: true, ...ce },
        { key: 'seats', label: 'Seats', kind: 'number' },
        { key: 'does', label: 'Does', kind: 'list', max: 40, ...ce, of: [{ key: 'service', label: 'Service', kind: 'ref', ref: 'services', required: true, ...ce, no_tap_target: true }] },
        { key: 'mentor', label: 'Mentor', kind: 'ref', ref: 'masters' },
      ],
    },
  ],
  COLLECTIONS: [
    { name: 'services', label: 'Services', prefix: '/services', type: 'service', pages: false, per_page: 9 },
    { name: 'masters', label: 'Masters', prefix: '/team/', type: 'master', listing: true, per_page: 6, order: { by: 'title' }, body: ['gallery'] },
  ],
  MODULES: { bookings: { services: 'services', resources: 'masters' } },
  PAGE_SEO: [{ key: 'title', label: 'Title', kind: 'text', max: 60, ...ce, no_tap_target: true }],
  BUSINESS_FACTS: [
    { key: 'name', label: 'Name', kind: 'text', max: 80, ...ce, no_tap_target: true },
    { key: 'phone_display', label: 'Phone', kind: 'text', ...ce, no_tap_target: true },
    { key: 'phone_dial', label: 'Dial', kind: 'tel', ...ce, no_tap_target: true },
    { key: 'instagram', label: 'Instagram', kind: 'url', ...ce, no_tap_target: true },
    { key: 'currency', label: 'Currency', kind: 'text' },
    { key: 'parking', label: 'Parking', kind: 'text', ...ce, no_tap_target: true },
  ],
};

test('the tables: §3 field by field, and a schema the platform\'s judge accepts', () => {
  const { tables, questions, notes, refused } = tablesOf(DECLARED, { ownListings: new Set() });
  assert.equal(refused, undefined);
  assert.equal(tables.CONTRACT, 3);
  assert.equal(tables.LOCALE, 'de-CH');
  const hero = tables.BLOCKS.find((one) => one.type === 'hero');
  // `image_alt` folded away, `deprecated` gone, a bound of 0 gone, options as objects.
  assert.deepEqual(hero.fields.map((one) => one.key), ['title', 'image', 'mood']);
  assert.deepEqual(hero.fields[1], { key: 'image', label: 'Picture', kind: 'media', client_editable: true });
  assert.deepEqual(hero.fields[2].options, [{ value: 'calm', label: 'Ruhig' }, { value: 'loud' }]);
  assert.equal(hero.fields[2].option_labels, undefined);
  // A view's sample and its bound of 0, gone.
  assert.deepEqual(tables.BLOCKS.find((one) => one.type === 'gallery').views, [{ key: 'row', label: 'Row', max: 3 }]);
  // The counts a module reads are whole; what a resource does is one reference to many.
  const service = tables.BLOCKS.find((one) => one.type === 'service');
  assert.deepEqual(service.fields.find((one) => one.key === 'fewest'), { key: 'fewest', label: 'Fewest', kind: 'number', integer: true });
  const master = tables.BLOCKS.find((one) => one.type === 'master');
  assert.equal(master.fields.find((one) => one.key === 'seats').integer, true);
  assert.deepEqual(master.fields.find((one) => one.key === 'does'), { key: 'does', label: 'Does', kind: 'ref', ref: { to: ['services'], many: true }, max: 40, client_editable: true });
  assert.deepEqual(master.fields.find((one) => one.key === 'mentor').ref, { to: ['masters'] });
  // Collections: route and shown_on, as the platform's own upgrade reads them; body → blocks.
  assert.deepEqual(tables.COLLECTIONS[0], { name: 'services', label: 'Services', type: 'service', route: 'none', shown_on: ['/services#services-{slug}'] });
  assert.deepEqual(tables.COLLECTIONS[1], { name: 'masters', label: 'Masters', type: 'master', route: { detail: '/team/{slug}', listing: '/team', per_page: 6 }, order: { by: 'title' }, blocks: ['gallery'] });
  // The business facts: the shared contacts, with roles; the currency not content; a fact with no role asked.
  assert.deepEqual(tables.SHARED, ['contacts']);
  const contacts = tables.BLOCKS.at(-1);
  assert.equal(contacts.type, 'contacts');
  assert.deepEqual(contacts.fields.map((one) => [one.key, one.kind, one.role]), [
    ['name', 'text', 'name'],
    ['phone', 'tel', 'phone'],
    ['social', 'list', 'social'],
    ['parking', 'text', undefined],
  ]);
  assert.ok(notes.some((one) => /BUSINESS_FACTS currency is not content/.test(one)));
  assert.ok(notes.some((one) => /hero.old was deprecated/.test(one)));
  assert.deepEqual(questions.map((one) => one.what), ['a business fact with no role']);
  // And the platform's judge, offline, takes it.
  assert.deepEqual(judgeSchema(schemaText(schemaOf(tables))), []);
});

test('the tables: a listing the repository draws itself is declared, so the feed and the alternates keep their address', () => {
  const blog = { name: 'blog', label: 'Blog', prefix: '/blog', type: 'post', order: { by: 'date', desc: true }, per_page: 10, body: ['text'] };
  assert.deepEqual(collection3(blog).route, { detail: '/blog/{slug}', per_page: 10 });
  assert.deepEqual(collection3(blog, new Set(['/blog'])).route, { detail: '/blog/{slug}', listing: '/blog', per_page: 10 });
  assert.deepEqual(collection3(blog).order, { by: 'date', desc: true });
});

test('the tables: refused for a site in two languages, and where a contacts type is declared already', () => {
  assert.match(tablesOf({ ...DECLARED, LOCALES: ['en'] }).refused, /before M3 the platform keeps a contract-3 site in one language .*JTK_E_TRANSLATION_BEFORE_M_THREE/);
  const taken = { ...DECLARED, BLOCKS: [...DECLARED.BLOCKS, { type: 'contacts', v: 1, label: 'C', fields: [] }] };
  assert.match(tablesOf(taken).refused, /a shared block type called `contacts`/);
});

test('a field: what contract 3 says unchanged is left as it was', () => {
  const plain = { key: 'title', label: 'Title', kind: 'text', max: 80, client_editable: true };
  assert.deepEqual(field3(plain), plain);
  assert.deepEqual(fields3([plain]), [plain]);
  // On a link and a date there are no bounds in contract 3.
  assert.deepEqual(field3({ key: 'when', label: 'When', kind: 'date', max: 10 }), { key: 'when', label: 'When', kind: 'date' });
  // A country is a select of ISO codes, its labels in the site's language.
  const { block } = contactsOf([{ key: 'country', label: 'Land', kind: 'text', max: 60 }], 'de-CH');
  assert.equal(block.fields[0].kind, 'select');
  assert.deepEqual(block.fields[0].options.find((one) => one.value === 'CH'), { value: 'CH', label: 'Schweiz' });
});

test('ranks: the platform\'s, spread and between, compared as bytes', () => {
  assert.deepEqual(rankSpread(3), ['F', 'V', 'k']);
  assert.equal(rankBetween('', ''), 'V');
  assert.equal(rankBetween('V', ''), 'k');
  assert.ok(rankBetween('a0', 'a1') > 'a0' && rankBetween('a0', 'a1') < 'a1');
  const many = rankSpread(100);
  assert.deepEqual([...many].sort(), many);
  assert.equal(new Set(many).size, 100);
});

// ── the documents ──────────────────────────────────────────────────────────

const id = (n) => `0193a5c3-0000-7000-8000-${String(n).padStart(12, '0')}`;
const catalogue = (declared) => ({
  contract: 2,
  locale: 'de-CH',
  blocks: declared.BLOCKS,
  page_seo: declared.PAGE_SEO,
  business_facts: declared.BUSINESS_FACTS,
  collections: declared.COLLECTIONS,
  modules: declared.MODULES,
});

function tree() {
  return {
    '/jtk/catalogue.json': catalogue(DECLARED),
    '/jtk/site.json': { schema_version: 2, id: 'site-1', slug: 'probe', name: 'Probe', locale: 'de-CH', media_base: 'https://m', business: { name: 'Probe', phone_display: '044 000', phone_dial: '+41440000', instagram: 'https://instagram.com/p', currency: 'chf', legal_name: 'Probe GmbH', tiktok: 'https://tiktok.com/@p' } },
    '/jtk/content/index.json': {
      id: id(1),
      path: '/',
      seo: { title: '', description: ' ' },
      blocks: [
        { _key: '4f2a91c0', type: 'hero', v: 1, title: 'Willkommen', image: 'media/site-1/a.jpg', image_alt: 'Der Laden', mood: 'calm', old: 'weg', stray: 'x', lead: null },
        { type: 'gallery', v: 1, view: 'row', work: [{ src: 'media/site-1/b.jpg', alt: '' }, { src: '' }] },
      ],
    },
    '/jtk/content/services/cut.json': { id: id(11), path: '/services/cut', collection: 'services', visible: true, rank: 'V', blocks: [{ type: 'service', v: 1, title: 'Cut', takes: 45, costs: 6500 }] },
    '/jtk/content/services/talk.json': { path: '/services/talk', collection: 'services', blocks: [{ type: 'service', v: 1, title: 'Talk', takes: 15, costs: 'ab 45.–', fewest: 2.5 }] },
    '/jtk/content/team/anna.json': { id: id(21), path: '/team/anna', collection: 'masters', visible: true, seo: { title: 'Anna', description: '' }, blocks: [{ type: 'master', v: 1, title: 'Anna', does: [{ service: 'cut' }, { service: 'gone' }], mentor: 'ben' }, { type: 'gallery', v: 1, work: [{ src: 'media/site-1/c.jpg' }] }] },
    '/jtk/content/team/ben.json': { id: id(22), path: '/team/ben', collection: 'masters', visible: false, blocks: [{ type: 'master', v: 1, title: 'Ben', does: [] }] },
    '/jtk/bookings.json': { blocks: [{ type: 'bookings_config', v: 1, schema_version: 2, zone: 'Europe/Zurich', hours: [{ day: 'monday', opens: 540, closes: 1080 }], closed: [{ from: '2026-12-01', until: '2026-12-01', who: 'anna' }, { from: '2026-12-02', until: '2026-12-02', who: 'carla' }, { from: '2026-12-24', until: '2026-12-26', who: '' }] }] },
  };
}

function moved(files = tree(), state) {
  const { tables, contacts } = tablesOf(DECLARED, {});
  const to = schemaOf(tables);
  const door = content(files, { annotate: false });
  const order = Object.fromEntries(door.collections.map((one) => [one.name, door.entries(one.name, { locale: '', all: true }).map((entry) => entry.file)]));
  let n = 100;
  const out = documentsOf(files, { from: files['/jtk/catalogue.json'], to, order, state, contacts, mint: { id: () => id(n++) } });
  return { ...out, to };
}

test('documents: each at its §2 place, the ids kept, the rest minted; contract 2\'s files and catalogue removed', () => {
  const { write, remove } = moved();
  assert.deepEqual(Object.keys(write), [
    '/jtk/entries/masters/anna.json',
    '/jtk/entries/masters/ben.json',
    '/jtk/entries/services/cut.json',
    '/jtk/entries/services/talk.json',
    '/jtk/modules/bookings.json',
    '/jtk/pages/index.json',
    '/jtk/pages/services.json',
    '/jtk/shared.json',
    '/jtk/site.json',
  ]);
  assert.deepEqual(remove, ['/jtk/bookings.json', '/jtk/catalogue.json', '/jtk/content/index.json', '/jtk/content/services/cut.json', '/jtk/content/services/talk.json', '/jtk/content/team/anna.json', '/jtk/content/team/ben.json']);
  assert.equal(write['/jtk/pages/index.json'].id, id(1));
  assert.equal(write['/jtk/entries/services/cut.json'].id, id(11));
  assert.equal(write['/jtk/entries/services/talk.json'].id, id(100));
  // The page a collection without pages is shown on, which the judge asks for (§16 · 5).
  assert.deepEqual(write['/jtk/pages/services.json'], { id: id(101), path: '/services', name: 'Services' });
});

test('documents: a page named once, empty folded away, a key the grammar cannot name minted again, words folded into the picture', () => {
  const { write } = moved();
  const page = write['/jtk/pages/index.json'];
  assert.equal(page.name, 'Willkommen');
  assert.equal(page.seo, undefined);
  const [hero, gallery] = page.blocks;
  assert.match(hero._key, /^k[0-9a-f]{7}$/);
  assert.notEqual(hero._key, '4f2a91c0');
  assert.deepEqual(hero.image, { src: 'media/site-1/a.jpg', alt: 'Der Laden' });
  assert.equal(hero.image_alt, undefined);
  assert.equal(hero.lead, undefined);
  // What the schema no longer declares, kept (§4.7).
  assert.deepEqual(hero._orphans, { old: 'weg', stray: 'x' });
  assert.equal(gallery.view, 'row');
  assert.equal(gallery.work.length, 1);
  assert.match(gallery.work[0]._key, /^k[0-9a-f]{7}$/);
  assert.equal(gallery.work[0].alt, undefined);
});

test('documents: money typed, a price as text kept and asked; references by id, one that names nothing to _orphans and asked', () => {
  const { write, questions } = moved();
  assert.deepEqual(write['/jtk/entries/services/cut.json'].fields, { title: 'Cut', takes: 45, costs: { minor: 6500 } });
  assert.equal(write['/jtk/entries/services/talk.json'].fields.costs, 'ab 45.–');
  const anna = write['/jtk/entries/masters/anna.json'];
  assert.deepEqual(anna.fields.does, [id(11)]);
  assert.deepEqual(anna.fields.mentor, id(22));
  assert.deepEqual(anna.fields._orphans, { does: ['gone'] });
  assert.deepEqual(anna.seo, { title: 'Anna' });
  assert.match(anna.blocks[0]._key, /^k[0-9a-f]{7}$/);
  // An empty list is absent.
  assert.deepEqual(write['/jtk/entries/masters/ben.json'].fields, { title: 'Ben' });
  assert.equal(write['/jtk/entries/masters/ben.json'].visible, false);
  const asked = questions.map((one) => `${one.what} @ ${one.where}`);
  assert.ok(asked.includes('a price written as text @ jtk/entries/services/talk.json fields.costs'));
  assert.ok(asked.includes('a reference to no entry @ jtk/entries/masters/anna.json fields.does'));
  assert.ok(asked.includes('a count that is not whole @ jtk/entries/services/talk.json fields.fewest'));
  assert.match(questions.find((one) => one.what === 'a price written as text').ask, /\{ "minor": 4500, "from": true \}/);
});

test('documents: the owner\'s order kept as ranks; the module\'s settings as { v, settings }, a day off naming its resource by id', () => {
  const { write, questions, minted } = moved();
  assert.equal(write['/jtk/entries/services/cut.json'].rank, 'V');
  // Unranked after the ranked, in the order the site listed them.
  assert.equal(write['/jtk/entries/services/talk.json'].rank, 'k');
  assert.deepEqual(minted.ranks, ['/jtk/content/services/talk.json']);
  // Ordered by a field: no rank.
  assert.equal(write['/jtk/entries/masters/anna.json'].rank, undefined);
  const settings = write['/jtk/modules/bookings.json'];
  assert.equal(settings.v, 1);
  assert.equal(settings.settings.schema_version, undefined);
  assert.equal(settings.settings.zone, 'Europe/Zurich');
  assert.match(settings.settings.hours[0]._key, /^k[0-9a-f]{7}$/);
  assert.equal(settings.settings.closed[0].who, id(21));
  // Nobody of that name: kept as it was, so the day stays off for whom it was off, and asked.
  assert.equal(settings.settings.closed[1].who, 'carla');
  assert.equal(settings.settings.closed[2].who, undefined);
  assert.ok(questions.some((one) => one.what === 'a day off for nobody' && /«carla»/.test(one.ask)));
});

test('documents: the facts become the shared contacts; site.json the platform\'s contract-3 file, the currency at the top', () => {
  const { write, questions } = moved();
  const [contacts] = write['/jtk/shared.json'].blocks;
  assert.equal(contacts._key, 'contacts');
  assert.equal(contacts.name, 'Probe');
  // The number dials as typed (§4.5).
  assert.equal(contacts.phone, '+41440000');
  assert.equal(contacts.social.length, 1);
  assert.equal(contacts.social[0].url, 'https://instagram.com/p');
  assert.deepEqual(write['/jtk/site.json'], { id: 'site-1', slug: 'probe', media_base: 'https://m', currency: 'CHF' });
  assert.ok(questions.some((one) => one.what === 'a business fact the scaffold did not declare' && /tiktok/.test(one.ask)));
  assert.ok(!questions.some((one) => /legal_name/.test(one.ask)));
});

test('documents: the platform\'s state gives the ids a file lacks and the order no move ranked', () => {
  const files = tree();
  delete files['/jtk/content/services/cut.json'].rank;
  const state = stateOf({
    site: { id: 'site-1', currency: 'eur' },
    pages: [
      { id: id(50), path: '/services/talk', collection: 'services', locale: '', position: 1 },
      { id: id(11), path: '/services/cut', collection: 'services', locale: '', position: 2 },
    ],
  });
  assert.deepEqual(state.faults, []);
  const { write, minted } = moved(files, state);
  assert.equal(write['/jtk/entries/services/talk.json'].id, id(50));
  // Ranked in the platform's order, talk before cut.
  assert.ok(write['/jtk/entries/services/talk.json'].rank < write['/jtk/entries/services/cut.json'].rank);
  assert.equal(write['/jtk/site.json'].currency, 'EUR');
  assert.ok(!minted.ids.includes('/jtk/content/services/talk.json'));
  assert.deepEqual(stateOf({ pages: [{ id: 'nope', path: '/' }] }).faults, ['pages[0] has no id the platform writes (a lowercase UUID)']);
});

test('documents: the tree it writes reads through the door as the old one did', () => {
  const files = tree();
  const { write, to } = moved(files);
  const after = { ...write, '/jtk/schema.json': to };
  const door2 = content(files, { annotate: false });
  const door3 = content(after, { annotate: false });
  assert.equal(door3.contract, 3);
  assert.equal(door3.currency, 'CHF');
  const titles = (door, name) => door.entries(name, { locale: '', all: true }).map((one) => one.fields.text('title'));
  assert.deepEqual(titles(door3, 'services'), titles(door2, 'services'));
  assert.equal(door3.page('/').block('hero').text('title'), door2.page('/').block('hero').text('title'));
  assert.deepEqual(door3.page('/').block('hero').picture('image'), { ...door2.page('/').block('hero').picture('image') });
  // The typed reads, alike on both.
  const cut = (door) => door.entry('services', 'cut', '');
  assert.equal(cut(door3).fields.minor('costs'), 6500);
  assert.equal(cut(door2).fields.minor('costs'), 6500);
  const does = (door) => door.entry('masters', 'anna', '').fields.refs('does').map((one) => one.slug);
  assert.deepEqual(does(door3), ['cut']);
  assert.deepEqual(does(door2), ['cut']);
  assert.equal(door2.shownOn('services'), '/services');
  assert.equal(door3.shownOn('services'), '/services');
  assert.equal(door3.shownOn('masters'), undefined);
  assert.equal(cut(door3).anchor, cut(door2).anchor);
});

test('the door: minor() is none for a price said «from» or «on request»; refs() leaves out a name no entry has', () => {
  const files = {
    '/jtk/schema.json': {
      contract: 3,
      locale: 'de',
      blocks: [{ type: 'service', v: 1, label: 'S', fields: [{ key: 'title', label: 'T', kind: 'text' }, { key: 'costs', label: 'P', kind: 'money', qualifiers: ['from', 'on_request'] }, { key: 'next', label: 'N', kind: 'ref', ref: { to: ['services'] } }] }],
      collections: [{ name: 'services', label: 'S', type: 'service', route: 'none', shown_on: ['/preise#{slug}'] }],
    },
    '/jtk/pages/preise.json': { id: id(1), path: '/preise', name: 'Preise' },
    '/jtk/entries/services/a.json': { id: id(2), collection: 'services', slug: 'a', visible: true, fields: { title: 'A', costs: { minor: 100, from: true }, next: id(3) } },
    '/jtk/entries/services/b.json': { id: id(3), collection: 'services', slug: 'b', visible: true, fields: { title: 'B', costs: { on_request: true }, next: id(9) } },
    '/jtk/entries/services/c.json': { id: id(4), collection: 'services', slug: 'c', visible: true, fields: { title: 'C', costs: { minor: 250 } } },
  };
  const site = content(files, { annotate: false });
  assert.equal(site.entry('services', 'a').fields.minor('costs'), undefined);
  assert.equal(site.entry('services', 'b').fields.minor('costs'), undefined);
  assert.equal(site.entry('services', 'c').fields.minor('costs'), 250);
  assert.deepEqual(site.entry('services', 'a').fields.refs('next').map((one) => one.slug), ['b']);
  assert.deepEqual(site.entry('services', 'b').fields.refs('next'), []);
  assert.equal(site.shownOn('services'), '/preise');
});

test('documents: a price kept as words in a text field stays words, and is asked about once a field', () => {
  const declared = {
    LOCALE: 'de',
    BLOCKS: [{ type: 'priced_list', v: 1, label: 'Prices', fields: [{ key: 'items', label: 'Rows', kind: 'list', of: [{ key: 'title', label: 'T', kind: 'text', ...ce }, { key: 'price', label: 'P', kind: 'text', ...ce }] }] }],
  };
  const { tables } = tablesOf(declared);
  const to = schemaOf(tables);
  const files = {
    '/jtk/catalogue.json': { contract: 2, locale: 'de', blocks: declared.BLOCKS },
    '/jtk/content/index.json': { id: id(1), path: '/', blocks: [{ _key: 'list', type: 'priced_list', v: 1, items: [{ title: 'Schnitt', price: 'ab 45.–' }, { title: 'Farbe', price: 'CHF 120.–' }, { title: 'Beratung', price: 'gratis' }] }] },
  };
  const { write, questions } = documentsOf(files, { from: files['/jtk/catalogue.json'], to, order: {}, mint: { id: () => id(9) } });
  assert.deepEqual(write['/jtk/pages/index.json'].blocks[0].items.map((one) => one.price), ['ab 45.–', 'CHF 120.–', 'gratis']);
  const asked = questions.filter((one) => one.what === 'a price written as text');
  assert.equal(asked.length, 1);
  assert.match(asked[0].ask, /«ab 45.–», a price in words .*\{ "minor": 4500, "from": true \}\? The field stays text/);
});
