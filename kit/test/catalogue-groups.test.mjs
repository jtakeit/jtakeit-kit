// `jtk catalogue` on a group and on a ref: the platform's validateEntryGroup
// and validateRefs, mirrored (wiki/78 of the platform, 12 October 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));

/** The tool's findings on a declaration, as one string; '' when it accepts it. */
function judged({ group, extra = [], collections = [], emitted }) {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-groups-'));
  try {
    const declaration = {
      BLOCKS: [
        { type: 'service', v: 1, label: 'Service', fields: [
          { key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true },
          { key: 'category', label: 'Category', kind: 'ref', ref: 'categories', client_editable: true },
          { key: 'same', label: 'Same', kind: 'ref', ref: 'services', client_editable: true },
          { key: 'section', label: 'Section', kind: 'select', options: ['hair', 'nails'], client_editable: true },
          { key: 'note', label: 'Note', kind: 'text', client_editable: true },
          ...extra,
        ] },
        { type: 'category', v: 1, label: 'Category', fields: [
          { key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true },
          { key: 'parent', label: 'Parent', kind: 'ref', ref: 'categories', client_editable: true },
        ] },
      ],
      COLLECTIONS: [
        { name: 'services', label: 'Services', prefix: '/services', type: 'service', pages: false, ...(group ? { group } : {}) },
        { name: 'categories', label: 'Categories', prefix: '/categories', type: 'category' },
        ...collections,
      ],
    };
    const file = join(dir, 'declaration.mjs');
    writeFileSync(file, Object.entries(declaration).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join('\n'));
    const run = spawnSync('node', [tool, '--emit-only', '--root', dir, '--declaration', 'declaration.mjs'], { encoding: 'utf8' });
    if (emitted) emitted(run.status === 0 ? JSON.parse(readFileSync(join(dir, 'jtk', 'catalogue.json'), 'utf8')) : undefined);
    return run.status === 0 ? '' : run.stderr;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a group may be a select, or a ref to another collection', () => {
  assert.equal(judged({ group: 'section' }), '');
  assert.equal(judged({ group: 'category' }), '', 'a category the owner adds in the panel');
  assert.equal(judged({}), '');
});

test('a group is never a ref into its own collection, free text, or a field the type has not got', () => {
  assert.match(judged({ group: 'same' }), /JTK_E_COLLECTION\w* .*points into "services" itself/);
  assert.match(judged({ group: 'note' }), /JTK_E_COLLECTION\w* .*group by a select, or by a ref to another collection/);
  assert.match(judged({ group: 'missing' }), /JTK_E_COLLECTION\w* .*grouped by "missing", which service does not declare/);
});

test('a parent ref into its own collection is a tree, and the catalogue takes it', () => {
  // `categories.parent` points into `categories` in every declaration above.
  assert.equal(judged({ group: 'category' }), '');
});

test('tags are a list of one ref, and every ref names a declared collection', () => {
  const tags = { key: 'tags', label: 'Tags', kind: 'list', client_editable: true, of: [{ key: 'tag', label: 'Tag', kind: 'ref', ref: 'tags', client_editable: true }] };
  assert.match(judged({ extra: [tags] }), /JTK_E_COLLECTION\w* .*blocks\[0\]\.tags\.tag\.ref: .*"tags", which this catalogue does not declare/);
  const tagType = { name: 'tags', label: 'Tags', prefix: '/tags', type: 'category' };
  assert.equal(judged({ extra: [tags], collections: [tagType] }), '');
});

test('a listing at the prefix is asked for with listing: true, passed through, and refused on a collection without pages', () => {
  const kinds = (more) => [{ name: 'kinds', label: 'Kinds', prefix: '/kinds', type: 'category', ...more }];
  let catalogue;
  assert.equal(judged({ collections: kinds({ listing: true }), emitted: (one) => { catalogue = one; } }), '');
  assert.equal(catalogue.collections.find((one) => one.name === 'kinds').listing, true, 'the catalogue carries it to the platform');
  assert.equal(judged({ collections: kinds({ listing: false }) }), '');
  assert.match(judged({ collections: kinds({ listing: true, pages: false }) }), /\.listing/);
  assert.match(judged({ collections: kinds({ listing: true, pages: false }) }), /has no pages of its own/);
  assert.match(judged({ collections: kinds({ listing: 'yes' }) }), /listing is "yes"/);
});
