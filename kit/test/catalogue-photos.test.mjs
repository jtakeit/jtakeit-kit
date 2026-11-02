// `jtk catalogue` on `photos`: the platform's check in registry/catalogue.go,
// mirrored (wiki/87 in the admin).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));

/** The tool's verdict on a block with these keys: its catalogue, or its findings. */
function judged(more) {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-photos-'));
  try {
    const BLOCKS = [{ type: 'order', v: 1, label: 'Order', fields: [{ key: 'title', label: 'Title', kind: 'text', client_editable: true }], ...more }];
    writeFileSync(join(dir, 'declaration.mjs'), `export const BLOCKS = ${JSON.stringify(BLOCKS)};`);
    const run = spawnSync('node', [tool, '--emit-only', '--root', dir, '--declaration', 'declaration.mjs'], { encoding: 'utf8' });
    if (run.status !== 0) return { findings: run.stderr };
    return { catalogue: JSON.parse(readFileSync(join(dir, 'jtk', 'catalogue.json'), 'utf8')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a form that collects takes up to seven photos, and the catalogue says how many', () => {
  const { catalogue, findings } = judged({ collects: 'enquiry', photos: 7 });
  assert.equal(findings, undefined);
  assert.equal(catalogue.blocks[0].photos, 7);
});

test('photos on a block that collects nothing, or a number outside one to seven, are refused', () => {
  assert.match(judged({ photos: 3 }).findings, /JTK_E_COLLECTS_UNKNOWN .*takes photos and collects nothing/);
  assert.match(judged({ collects: 'enquiry', photos: 8 }).findings, /JTK_E_COLLECTS_UNKNOWN .*a form takes 1 to 7/);
  assert.match(judged({ collects: 'enquiry', photos: 2.5 }).findings, /a form takes 1 to 7/);
});
