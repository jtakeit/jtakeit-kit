// The rules of groups, trees, tags and back-references (template/src/lib/groups.ts),
// run by Node on their own: the file imports nothing, and Node strips its types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ancestors, capped, DEEPEST, grouped, groupField, pointersInto, pointsAt, refHeadings, selectHeadings, treeFields,
} from '../template/src/lib/groups.ts';

const e = (id, data) => ({ id, data });
const slugOf = (entry) => entry.id;

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
  const de = [e('de/new', { title: 'Neu' }), e('de/nails', { title: 'Nägel' }), e('de/hair', { title: '' })];
  const own = [e('hair', { title: 'Hair' }), e('brows', { title: 'Brows' }), e('nails', { title: 'Nails' }), e('none', {})];
  const headings = refHeadings(de, own, (one) => one.id.replace(/^de\//, ''), (one) => `page:/${one.id}:blocks[0].title`);
  assert.deepEqual(headings.map((one) => [one.key, one.text]), [
    ['hair', 'Hair'], // translated with no title: the site's own words
    ['brows', 'Brows'], // not translated: the site's own entry
    ['nails', 'Nägel'],
    ['none', 'none'], // titled nowhere: its slug
    ['new', 'Neu'], // only in the page's language: after the site's own order
  ]);
  assert.equal(headings[2].path, 'page:/de/nails:blocks[0].title', "a category's title is annotated as that entry's");
  assert.equal(headings[1].path, 'page:/brows:blocks[0].title', 'and a borrowed one as the entry whose words it shows');
  assert.deepEqual(refHeadings(own, [], slugOf, () => undefined).map((one) => one.key), ['hair', 'brows', 'nails', 'none']);
  assert.equal(refHeadings([e('x', { title: 'X' })], [], slugOf, () => undefined)[0].path, undefined);
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
  assert.deepEqual(runs.map((run) => [run.heading?.text, run.entries.map((one) => one.id)]), [
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

test("back-references are capped at the referencing collection's per_page, and say how many more", () => {
  assert.deepEqual(capped([1, 2, 3], undefined), { shown: [1, 2, 3], more: 0 });
  assert.deepEqual(capped([1, 2, 3], 2), { shown: [1, 2], more: 1 });
  assert.deepEqual(capped([1, 2], 2), { shown: [1, 2], more: 0 });
});
