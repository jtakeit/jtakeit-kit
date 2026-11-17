// A contract-3 site keeps its pages drawable live (the owner, 16 November
// 2026): a schema without `render: "live"` is advised, `JTK_W_NOT_LIVE` at
// `render`, as the platform's validate_schema advises it — and never refused,
// nor counted in `jtk schema`'s exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADVICE, isAdvice, W } from '../lib/codes.mjs';
import { adviseSchema, judgeSchema } from '../lib/judge3.mjs';

const text = { type: 'text', v: 1, label: 'Text', fields: [{ key: 'body', label: 'Body', kind: 'markdown', client_editable: true }] };
const schema = (more = {}) => JSON.stringify({ contract: 3, locale: 'de', blocks: [text], ...more });

test('a schema without render: "live" is advised at `render`, and accepted', () => {
  assert.equal(W.NOT_LIVE, 'JTK_W_NOT_LIVE');
  assert.ok(isAdvice(W.NOT_LIVE));
  assert.match(ADVICE[W.NOT_LIVE], /only after a build/);
  assert.deepEqual(judgeSchema(schema()), []);
  const [one, ...rest] = adviseSchema(schema());
  assert.deepEqual(rest, []);
  assert.equal(one.code, 'JTK_W_NOT_LIVE');
  assert.equal(one.path, 'render');
  assert.match(one.says, /the panel shows the owner a change only after a build, and an entry's card cannot be previewed before it is saved/);
  assert.match(one.says, /keep `RENDER = 'live'` in src\/content\/blocks\.ts and the scaffold's src\/live\//);
  assert.match(one.says, /take it out only where a page does at build what a server cannot; say why in BRIEF\.md \(docs\/live\.md\)/);
});

test('render: "live" is advised nothing; a render the judge refuses is advised nothing either', () => {
  assert.deepEqual(adviseSchema(schema({ render: 'live' })), []);
  assert.notDeepEqual(judgeSchema(schema({ render: 'static' })), []);
  assert.deepEqual(adviseSchema(schema({ render: 'static' })), []);
});

test('jtk schema says it, writes the schema, and passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-not-live-'));
  const tool = fileURLToPath(new URL('../lib/schema.mjs', import.meta.url));
  const declare = (render) =>
    writeFileSync(
      join(root, 'src', 'content', 'blocks.ts'),
      `export const CONTRACT = 3;\n${render ? "export const RENDER = 'live';\n" : ''}export const LOCALE = 'de';\nexport const BLOCKS = ${JSON.stringify([text])};\n`,
    );
  try {
    mkdirSync(join(root, 'src', 'content'), { recursive: true });
    declare(false);
    const run = spawnSync(process.execPath, [tool, '--emit-only', '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /~ JTK_W_NOT_LIVE {2}render: the schema does not say `render: "live"`, so the panel shows the owner a change only after a build/);
    assert.equal(JSON.parse(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8')).render, undefined);

    declare(true);
    const live = spawnSync(process.execPath, [tool, '--emit-only', '--root', root], { encoding: 'utf8' });
    assert.equal(live.status, 0, live.stderr);
    assert.doesNotMatch(live.stdout, /JTK_W_NOT_LIVE/);
    assert.equal(JSON.parse(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8')).render, 'live');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the scaffold's declaration says it, and keeps it", () => {
  for (const file of ['../../template/contract-3/src/content/blocks.ts', '../../example/files/src/content/blocks.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /^export const RENDER = 'live';$/m, file);
    assert.match(source, /Keep this line\./, file);
    assert.match(source, /BRIEF\.md/, file);
  }
});
