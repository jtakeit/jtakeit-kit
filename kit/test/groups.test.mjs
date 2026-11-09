// The rules of groups, trees, tags and back-references, and of which
// collections are listed at their prefix — the door's since 9 November 2026
// (lib/content/groups.mjs), the scaffold's src/lib/groups.ts and listing.ts
// before. The cases are the ones the scaffold's tests held them to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ancestors, capped, DEEPEST, descendants, drawsPagedListing, grouped, groupField, linksToListing, pointersInto, pointsAt, pointsAtAny, refHeadings, selectHeadings, treeFields,
} from '../lib/content/groups.mjs';

const e = (slug, data) => ({ slug, fields: { value: (key) => data[key] } });

const service = [
  { key: 'title', kind: 'text' },
  { key: 'category', kind: 'ref', ref: 'categories' },
  { key: 'section', kind: 'select', options: ['hair', 'nails'], option_labels: { hair: { en: 'Hair', de: 'Haare' } } },
  { key: 'same', kind: 'ref', ref: 'services' },
  { key: 'note', kind: 'text' },
];

test('a group is a select or a ref to another collection, and nothing else', () => {
  const services = (group) => ({ name: 'services', type: 'service', group });
  assert.equal(groupField(services('section'), service)?.key, 'section');
  assert.equal(groupField(services('category'), service)?.key, 'category');
  assert.equal(groupField(services('same'), service), undefined, 'a ref into itself is a tree, not a group');
  assert.equal(groupField(services('note'), service), undefined, 'free text groups nothing');
  assert.equal(groupField(services('missing'), service), undefined);
  assert.equal(groupField({ name: 'services', type: 'service' }, service), undefined);
});

test("a select's headings are its options, in order, by their label in the page's language", () => {
  const say = (text) => (typeof text === 'string' ? text : text.de ?? '');
  assert.deepEqual(selectHeadings(service[2], say), [
    { key: 'hair', text: 'Haare' },
    { key: 'nails', text: 'nails' },
  ]);
});

test("a ref's headings are the referenced entries in their order, titled, the site's language standing in", () => {
  const de = [e('new', { title: 'Neu' }), e('nails', { title: 'Nägel' }), e('hair', { title: '' })];
  const own = [e('hair', { title: 'Hair' }), e('brows', { title: 'Brows' }), e('nails', { title: 'Nails' }), e('none', {})];
  const headings = refHeadings(de, own);
  assert.deepEqual(headings.map((one) => [one.key, one.text]), [
    ['hair', 'Hair'], // translated with no title: the site's own words
    ['brows', 'Brows'], // not translated: the site's own entry
    ['nails', 'Nägel'],
    ['none', 'none'], // titled nowhere: its slug
    ['new', 'Neu'], // only in the page's language: after the site's own order
  ]);
  assert.equal(headings[2].entry, de[1], "a category's heading is that entry's, in the page's language");
  assert.equal(headings[1].entry, own[1], 'and a borrowed one is the entry whose words it shows');
  assert.deepEqual(refHeadings(own, []).map((one) => one.key), ['hair', 'brows', 'nails', 'none']);
});

test('entries under their headings in the headings order, the ungrouped last, empty headings dropped', () => {
  const entries = [
    e('cut', { section: 'hair' }),
    e('gel', { section: 'nails' }),
    e('tea', {}),
    e('old', { section: 'renamed' }),
    e('dye', { section: 'hair' }),
  ];
  const runs = grouped(entries, 'section', [{ key: 'brows', text: 'Brows' }, { key: 'nails', text: 'Nails' }, { key: 'hair', text: 'Hair' }]);
  assert.deepEqual(runs.map((run) => [run.heading?.text, run.entries.map((one) => one.slug)]), [
    ['Nails', ['gel']],
    ['Hair', ['cut', 'dye']],
    [undefined, ['tea', 'old']],
  ]);
  assert.deepEqual(grouped([], 'section', [{ key: 'hair', text: 'Hair' }]), []);
});

test('tags are a list of one ref, and what points at an entry is found through either shape', () => {
  const post = [
    { key: 'title', kind: 'text' },
    { key: 'category', kind: 'ref', ref: 'categories' },
    { key: 'tags', kind: 'list', of: [{ key: 'tag', kind: 'ref', ref: 'tags' }] },
  ];
  assert.deepEqual(pointersInto('tags', post), [{ field: 'tags', row: 'tag' }]);
  assert.deepEqual(pointersInto('categories', post), [{ field: 'category' }]);
  assert.deepEqual(pointersInto('masters', post), []);

  const one = e('p', { category: 'news', tags: [{ tag: 'red' }, { tag: 'blue' }] });
  assert.ok(pointsAt(one, pointersInto('tags', post), 'blue'));
  assert.ok(!pointsAt(one, pointersInto('tags', post), 'green'));
  assert.ok(pointsAt(one, pointersInto('categories', post), 'news'));
  assert.ok(!pointsAt(e('q', { tags: 'red' }), pointersInto('tags', post), 'red'), 'a list that is not a list points at nothing');
});

test('a tree is walked to its root, and a loop or a chain past the limit ends the walk', () => {
  const category = [{ key: 'title', kind: 'text' }, { key: 'parent', kind: 'ref', ref: 'categories' }];
  assert.deepEqual(treeFields({ name: 'categories', type: 'category' }, category).map((one) => one.key), ['parent']);

  const known = new Set(['gel', 'nails', 'beauty', 'a', 'b']);
  assert.deepEqual(ancestors('gel', new Map([['gel', 'nails'], ['nails', 'beauty']]), known), ['nails', 'beauty']);
  assert.deepEqual(ancestors('beauty', new Map(), known), []);
  assert.deepEqual(ancestors('a', new Map([['a', 'b'], ['b', 'a']]), known), ['b'], 'a loop written by hand');
  assert.deepEqual(ancestors('gel', new Map([['gel', 'hidden']]), known), [], 'a parent nobody can open ends the trail');

  const chain = new Map();
  const deep = new Set();
  for (let i = 0; i < 100; i++) { chain.set(`c${i}`, `c${i + 1}`); deep.add(`c${i + 1}`); }
  assert.equal(ancestors('c0', chain, deep).length, DEEPEST);
});

test("a category's descendants: every level down, each once, loops and hidden branches and depth bounded", () => {
  const parentOf = new Map([['nails', 'beauty'], ['hair', 'beauty'], ['gel', 'nails'], ['tips', 'gel'], ['brows', 'hidden'], ['a', 'b'], ['b', 'a']]);
  const known = new Set(['beauty', 'nails', 'hair', 'gel', 'tips', 'brows', 'a', 'b']);
  assert.deepEqual(descendants('beauty', parentOf, known), ['nails', 'hair', 'gel', 'tips'], 'nearest first');
  assert.deepEqual(descendants('gel', parentOf, known), ['tips']);
  assert.deepEqual(descendants('tips', parentOf, known), []);
  assert.deepEqual(descendants('a', parentOf, known), ['b'], 'a loop written by hand is walked once');
  assert.deepEqual(descendants('beauty', parentOf, new Set(['beauty', 'hair', 'gel', 'tips'])), ['hair'], 'a hidden category hides what is under it');

  const chain = new Map();
  const deep = new Set(['c0']);
  for (let i = 0; i < 100; i++) { chain.set(`c${i + 1}`, `c${i}`); deep.add(`c${i + 1}`); }
  assert.equal(descendants('c0', chain, deep).length, DEEPEST);
});

test('an entry pointing at a category or one under it is found once, through either shape', () => {
  const fields = [{ key: 'category', kind: 'ref', ref: 'categories' }, { key: 'also', kind: 'list', of: [{ key: 'category', kind: 'ref', ref: 'categories' }] }];
  const pointers = pointersInto('categories', fields);
  const slugs = new Set(['beauty', 'nails', 'gel']);
  assert.ok(pointsAtAny(e('a', { category: 'gel' }), pointers, slugs));
  assert.ok(pointsAtAny(e('b', { also: [{ category: 'hair' }, { category: 'nails' }] }), pointers, slugs));
  assert.ok(!pointsAtAny(e('c', { category: 'hair' }), pointers, slugs));
  const all = [e('a', { category: 'gel', also: [{ category: 'beauty' }] }), e('c', { category: 'hair' }), e('d', { category: 'beauty' })];
  assert.deepEqual(all.filter((one) => pointsAtAny(one, pointers, slugs)).map((one) => one.slug), ['a', 'd'], 'once each, in the order they came');
});

test("back-references are capped at the referencing collection's per_page, and say how many more", () => {
  assert.deepEqual(capped([1, 2, 3], undefined), { shown: [1, 2, 3], more: 0 });
  assert.deepEqual(capped([1, 2, 3], 2), { shown: [1, 2], more: 1 });
  assert.deepEqual(capped([1, 2], 2), { shown: [1, 2], more: 0 });
});

test('a collection with pages is listed by the scaffold only when it says listing: true', () => {
  assert.equal(drawsPagedListing({}, false), false, 'nothing said: no new address on the site');
  assert.equal(drawsPagedListing({ pages: true }, false), false);
  assert.equal(drawsPagedListing({ listing: false }, false), false);
  assert.equal(drawsPagedListing({ listing: true }, false), true);
  assert.equal(drawsPagedListing({ listing: true }, true), false, "the repository's own page at the prefix wins");
  assert.equal(drawsPagedListing({ pages: false, listing: true }, false), false, 'a collection without pages has its own listing route');
});

test('«And 3 more» links only where a listing is there by the rule', () => {
  assert.equal(linksToListing({}), false);
  assert.equal(linksToListing({ listing: false }), false);
  assert.equal(linksToListing({ listing: true }), true);
  assert.equal(linksToListing({ pages: false }), true, 'its prefix is its listing, which the platform demands');
});
