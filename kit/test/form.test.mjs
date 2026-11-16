// An entry's card in the panel (`form`) and a type's steps from its older
// versions (`upcast`), judged offline as the platform judges them
// (registry/form.go, registry/upcast.go): the same codes, at the same paths,
// in the same sentences — and the advice where the panel guesses the card.
//
// forms.json is the platform's corpus of forms, copied read-only from
// jtakeit-core (backend/api/registry/fixtures/forms.json, at 358dc217), and
// sat here whole: every case's resolved card, its refusals by path and its
// advice by path, as TestFormFixtures sits it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adviseSchema, formsOf, judgeSchema } from '../lib/judge3.mjs';
import { catalogueIn2 } from '../lib/kits.mjs';
import { POST_FORM, scaffoldFormsOf, tablesOf } from '../lib/upgrade3.mjs';

const corpus = JSON.parse(readFileSync(new URL('./fixtures/platform/forms.json', import.meta.url), 'utf8'));

/** `schemaAround`: one entry type as the type of the collection `items`, and a page's block beside it where a case has one. */
const around = (type, page) => JSON.stringify({
  contract: 3,
  locale: 'de',
  blocks: page === undefined ? [type] : [type, page],
  collections: [{ name: 'items', label: 'Items', type: type.type, route: { detail: '/items/{slug}' } }],
});

test('the platform\'s corpus of forms: each card resolved as the panel draws it, refused and advised at its places (TestFormFixtures)', () => {
  assert.ok(corpus.cases.length >= 15);
  for (const one of corpus.cases) {
    const text = around(one.type, one.page_block);
    const found = judgeSchema(text);
    if (one.refused !== undefined) {
      // A path may be said twice — two rules broken at one place — and is asked once.
      assert.deepEqual([...new Set(found.map((f) => f.path))].sort(), [...one.refused].sort(), one.name);
      for (const fault of found) assert.equal(fault.code, 'JTK_E_PANEL_FORM_INVALID', `${one.name}: ${JSON.stringify(fault)}`);
      assert.deepEqual(adviseSchema(text), [], `${one.name}: no advice on a schema refused`);
      continue;
    }
    assert.deepEqual(found, [], one.name);
    assert.deepEqual(JSON.parse(JSON.stringify(formsOf(text).items)), one.resolved, one.name);
    assert.deepEqual(adviseSchema(text).map((f) => f.path).sort(), one.advice ?? [], one.name);
    for (const advice of adviseSchema(text)) assert.equal(advice.code, 'JTK_W_PANEL_FORM_GUESSED');
  }
});

const service = (form, more = []) => ({
  type: 'service',
  v: 1,
  label: 'Service',
  fields: [
    { key: 'title', label: 'Name', kind: 'text', required: true },
    { key: 'takes', label: 'Takes', kind: 'duration', required: true },
    { key: 'costs', label: 'Price', kind: 'money' },
    { key: 'photo', label: 'Photo', kind: 'media' },
    { key: 'kind', label: 'Kind', kind: 'select', options: ['a', 'b', 'c', 'd', 'e'].map((value) => ({ value })) },
    ...more,
  ],
  form,
});

test('a form, in the platform\'s sentences', () => {
  const said = (form, more) => judgeSchema(around(service(form, more)));
  assert.deepEqual(said({ sections: [{ rows: [['title'], ['takes', 'costs']] }], aside: ['photo'], widgets: { takes: 'presets', kind: 'radio' } }), []);
  assert.deepEqual(said({}), [], 'every key may be left out');
  for (const [form, path, says, more] of [
    [{ sections: [] }, 'blocks.service.form.sections', "blocks.service.form.sections is empty: leave it out for the platform's layout, or say a section"],
    [{ sections: [{ rows: [] }] }, 'blocks.service.form.sections[0].rows', 'blocks.service.form.sections[0] has no rows: a section holds one row or more, each a list of fields — [["title"], ["takes", "costs"]]'],
    [{ sections: [{ rows: [['takes'], []] }] }, 'blocks.service.form.sections[0].rows[1]', 'blocks.service.form.sections[0].rows[1] is empty: a row holds one to 3 fields'],
    [{ sections: [{ rows: [['takes', '']] }] }, 'blocks.service.form.sections[0].rows[0][1]', 'blocks.service.form.sections[0].rows[0][1] names no field: write the key of one of title, takes, costs, photo, kind'],
    [{ sections: [{ rows: [[{ field: 'takes', span: 3 }, { field: 'costs', span: 4 }]] }] }, 'blocks.service.form.sections[0].rows[0]', 'blocks.service.form.sections[0].rows[0] spans 7 columns: a row has 6'],
    [{ sections: [{ rows: [[{ field: 'takes', span: 5 }, 'costs']] }] }, 'blocks.service.form.sections[0].rows[0]', 'blocks.service.form.sections[0].rows[0] leaves 1 columns to 1 fields: each takes at least 2 — narrow a `span`, or start another row'],
    [{ sections: [{ rows: [['takes']] }], aside: ['photo', 'title', 'costs', 'kind', 'x', 'y', 'z'] }, 'blocks.service.form.aside', 'blocks.service.form.aside holds 7 fields: at most 6 — the aside is what the entry is at a glance; the rest goes in a section'],
    [{ widgets: { nope: 'line' } }, 'blocks.service.form.widgets.nope', 'blocks.service.form.widgets.nope is for `nope`, which service does not declare in its form: name one of title, takes, costs, photo, kind'],
    [{ widgets: { kind: 'checklist' } }, 'blocks.service.form.widgets.kind', 'blocks.service.form.widgets.kind is "checklist", which `kind` (a select) is not written with: it is written with `dropdown`, `radio` or `segmented`'],
    [{ widgets: { n: 'stepper' } }, 'blocks.service.form.widgets.n', 'blocks.service.form.widgets.n is "stepper": a stepper takes at most 50 steps and `n` runs from 0 to 99 — `number` is a box to type into', [{ key: 'n', label: 'N', kind: 'number', integer: true, min: 0, max: 99 }]],
    [{ widgets: { n: 'stepper' } }, 'blocks.service.form.widgets.n', 'blocks.service.form.widgets.n is "stepper": a stepper counts whole numbers: `n` says `integer: true` for it', [{ key: 'n', label: 'N', kind: 'number', min: 0, max: 9 }]],
    [{ sections: [{ rows: [['title']] }] }, 'blocks.service.form', 'blocks.service.form places no row or aside for `takes`, which is required: a new entry is asked for it where the form puts it — place it'],
  ]) {
    const found = said(form, more);
    assert.deepEqual(found.filter((f) => f.path === path), [{ code: 'JTK_E_PANEL_FORM_INVALID', path, says }], JSON.stringify(form));
  }
  // Nine sections are one too many — and each is then judged as well.
  const nine = said({ sections: Array.from({ length: 9 }, (_, i) => ({ rows: [[['title', 'takes', 'costs', 'photo', 'kind'][i] ?? 'title']] })) });
  assert.equal(nine[0].path, 'blocks.service.form.sections');
  assert.match(nine[0].says, /holds 9 sections: at most 8/);
  // A shape Go's decoder refuses is one unreadable schema.
  for (const form of [{ sections: 'all' }, { aside: 'photo' }, { widgets: { takes: 3 } }, { sections: [{ title: 5, rows: [['title']] }] }, { sections: [{ rows: ['title'] }] }]) {
    const found = said(form);
    assert.equal(found.length, 1, JSON.stringify(form));
    assert.equal(found[0].code, 'JTK_E_SCHEMA_UNREADABLE', JSON.stringify(form));
  }
});

test('a form\'s keys are contract 3\'s, refused where they stand at every depth (TestAFormsKeysAreContract3s)', () => {
  const text = JSON.stringify({
    contract: 3,
    locale: 'de',
    blocks: [{ type: 'post', v: 1, label: 'Post', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true }], form: { tabs: [], sections: [{ heading: 'x', rows: [[{ field: 'title', width: 'half' }]] }] } }],
    collections: [{ name: 'blog', label: 'Blog', type: 'post', route: { detail: '/blog/{slug}' } }],
  });
  assert.deepEqual(judgeSchema(text).map((f) => [f.code, f.path]), [
    ['JTK_E_SCHEMA_KEY_UNKNOWN', 'blocks.post.form.tabs'],
    ['JTK_E_SCHEMA_KEY_UNKNOWN', 'blocks.post.form.sections[0].heading'],
    ['JTK_E_SCHEMA_KEY_UNKNOWN', 'blocks.post.form.sections[0].rows[0][0].width'],
  ]);
});

const hero = (steps) => JSON.stringify({ contract: 3, locale: 'de', blocks: [{ type: 'hero', v: 3, label: 'Hero', fields: [{ key: 'title', label: 'Titel', kind: 'text' }], upcast: steps }] });

test('a type\'s steps from its older versions, judged as the platform judges them (TestUpcastIsJudged)', () => {
  for (const [name, step, path, says] of [
    ["from the type's own version", { from: 3 }, 'blocks.hero.upcast[0].from', 'block "hero" is at version 3, and a step goes from an older version of it: from 3 is not one (1 to 2)'],
    ['from nothing', { from: 0 }, 'blocks.hero.upcast[0].from', 'block "hero" is at version 3, and a step goes from an older version of it: from 0 is not one (1 to 2)'],
    ["a name that is no field's", { from: 2, rename: { Heading: 'title' } }, 'blocks.hero.upcast[0].rename.Heading', 'blocks.hero.upcast[0].rename.Heading names "Heading", which is not a field\'s name'],
    ['a rename to itself', { from: 2, rename: { title: 'title' } }, 'blocks.hero.upcast[0].rename.title', 'blocks.hero.upcast[0].rename.title renames "title" to itself'],
    ['two fields into one', { from: 2, rename: { a: 'title', b: 'title' } }, 'blocks.hero.upcast[0].rename.b', 'blocks.hero.upcast[0].rename.a and blocks.hero.upcast[0].rename.b both become "title" — one value a field'],
    ['the last step writes nothing declared', { from: 2, set: { colour: 'red' } }, 'blocks.hero.upcast[0].set.colour', 'blocks.hero.upcast[0].set.colour writes "colour", and the last step makes the block "hero" as it is declared now, which has no such field'],
    ['the last step drops a field still there', { from: 2, drop: ['title'] }, 'blocks.hero.upcast[0].drop[0]', 'blocks.hero.upcast[0].drop[0] drops "title", which the block "hero" still declares'],
    ['rows of what is no list', { from: 2, rows: { title: { rename: { a: 'b' } } } }, 'blocks.hero.upcast[0].rows.title', 'blocks.hero.upcast[0].rows.title changes the rows of "title", which the block "hero" does not declare as a list'],
    ['a value renamed to nothing', { from: 2, values: { title: { a: '' } } }, 'blocks.hero.upcast[0].values.title', 'blocks.hero.upcast[0].values.title renames "a" to "": a value becomes another value'],
    ['a value renamed to none at all', { from: 2, values: { title: {} } }, 'blocks.hero.upcast[0].values.title', 'blocks.hero.upcast[0].values.title renames no value'],
    ['a field set to nothing', { from: 2, set: { title: ' ' } }, 'blocks.hero.upcast[0].set.title', 'blocks.hero.upcast[0].set.title sets nothing — leave the field out of `set`, and it starts empty'],
    ['deeper than a list in a row', { from: 1, rows: { items: { rows: { more: { drop: ['x'] } } } } }, 'blocks.hero.upcast[0].rows.items.rows.more', 'blocks.hero.upcast[0].rows.items.rows.more goes deeper than a list in a row'],
    ['a key a step has not got', { from: 2, move: { a: 'b' } }, 'blocks.hero.upcast[0].move', "blocks.hero.upcast[0].move is not a key of contract 3's schema, and nothing would read it"],
  ]) {
    const found = judgeSchema(hero([step]));
    assert.ok(found.some((f) => f.path === path && f.says === says), `${name}: ${JSON.stringify(found)}`);
    for (const fault of found) assert.equal(fault.code, path.endsWith('.move') ? 'JTK_E_SCHEMA_KEY_UNKNOWN' : 'JTK_E_UPCAST_INVALID', name);
  }
  // An earlier step's names are a version nobody declares any more: only their spelling is held.
  assert.deepEqual(judgeSchema(hero([{ from: 1, rename: { heading: 'headline' } }, { from: 2, rename: { headline: 'title' } }])), []);
  // In the order of their versions, as the platform keeps them: a step's place is its place in that order.
  const twice = judgeSchema(hero([{ from: 2 }, { from: 1 }, { from: 1 }]));
  assert.deepEqual(twice, [{ code: 'JTK_E_UPCAST_INVALID', path: 'blocks.hero.upcast[1].from', says: 'block "hero" has two steps from version 1 — one step a version' }]);
  // A step of the wrong shape is one unreadable schema.
  assert.equal(judgeSchema(hero([{ from: 1.5 }]))[0].code, 'JTK_E_SCHEMA_UNREADABLE');
  assert.equal(judgeSchema(hero([{ from: 2, drop: 'title' }]))[0].code, 'JTK_E_SCHEMA_UNREADABLE');
});

test('contract 2 has no form and no upcast: a kit laid out on contract 2 leaves them out', () => {
  const two = catalogueIn2({ blocks: [{ type: 'service', v: 2, label: 'S', fields: [], form: { aside: [] }, upcast: [{ from: 1 }] }], collections: [] });
  assert.deepEqual(two.blocks, [{ type: 'service', v: 2, label: 'S', fields: [] }]);
});

const post = (more = []) => ({
  type: 'post',
  v: 1,
  label: 'Post',
  fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'excerpt', label: 'Excerpt', kind: 'textarea' },
    { key: 'cover', label: 'Cover', kind: 'media' },
    { key: 'body', label: 'Text', kind: 'markdown' },
    ...more,
  ],
});

test('the move gives the scaffold\'s post the scaffold\'s card, and no other type one', () => {
  const declared = (block) => ({ LOCALE: 'de', BLOCKS: [block, { type: 'text', v: 1, label: 'T', fields: [{ key: 'body', label: 'B', kind: 'markdown' }] }], COLLECTIONS: [{ name: 'blog', label: 'Blog', type: 'post', prefix: '/blog' }] });
  assert.deepEqual([...scaffoldFormsOf(declared(post())).keys()], ['post']);
  assert.equal(scaffoldFormsOf(declared(post([{ key: 'tags', label: 'Tags', kind: 'text' }]))).size, 0, 'a post of its own is the site\'s, and keeps the panel\'s guess');
  const { tables } = tablesOf(declared(post()));
  assert.deepEqual(tables.BLOCKS[0].form, POST_FORM);
  assert.equal(tables.BLOCKS[1].form, undefined);
  // And the card is one the judge takes, and advises nothing of.
  const schema = JSON.stringify({ contract: 3, locale: 'de', blocks: [{ ...post(), form: POST_FORM }], collections: [{ name: 'blog', label: 'Blog', type: 'post', route: { detail: '/blog/{slug}' } }] });
  assert.deepEqual(judgeSchema(schema), []);
  assert.deepEqual(adviseSchema(schema), []);
});

test('jtk schema says the form advice, passes, and counts it nowhere', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-form-'));
  try {
    mkdirSync(join(root, 'src', 'content'), { recursive: true });
    const room = { type: 'room', v: 1, label: 'Room', fields: ['title', 'a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({ key, label: key, kind: 'text', required: key === 'title' })) };
    writeFileSync(join(root, 'src', 'content', 'blocks.ts'), `export const CONTRACT = 3;
export const LOCALE = 'de';
export const BLOCKS = ${JSON.stringify([room, { ...post(), form: { sections: [{ rows: [['title', 'date']] }] } }])};
export const COLLECTIONS = ${JSON.stringify([
      { name: 'rooms', label: 'Rooms', type: 'room', route: { detail: '/rooms/{slug}' } },
      { name: 'blog', label: 'Blog', type: 'post', route: { detail: '/blog/{slug}' } },
    ])};
`);
    const tool = fileURLToPath(new URL('../lib/schema.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [tool, '--emit-only', '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /~ JTK_W_PANEL_FORM_GUESSED {2}blocks\.room: blocks\.room has 7 fields and no `form`/);
    assert.match(run.stdout, /~ JTK_W_PANEL_FORM_GUESSED {2}blocks\.post\.form: blocks\.post\.form places no row for `excerpt`: the panel draws them after its sections, under More/);
    assert.match(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8'), /"form": \{/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
