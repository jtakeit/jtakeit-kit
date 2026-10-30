// `jtk catalogue` on `beside`: the platform's validateBeside, mirrored
// (wiki/84 in the admin).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));

/** The tool's findings on a block of these fields, as one string; '' when it accepts it. */
function judged(fields) {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-beside-'));
  try {
    const BLOCKS = [{ type: 'ticket', v: 1, label: 'Ticket', fields }];
    const file = join(dir, 'declaration.mjs');
    writeFileSync(file, `export const BLOCKS = ${JSON.stringify(BLOCKS)};`);
    const run = spawnSync('node', [tool, '--emit-only', '--root', dir, '--declaration', 'declaration.mjs'], { encoding: 'utf8' });
    return run.status === 0 ? '' : run.stderr;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const date = { key: 'date', label: 'Date', kind: 'date', client_editable: true };
const starts = (more = {}) => ({ key: 'starts', label: 'Starts', kind: 'time_of_day', client_editable: true, no_tap_target: true, beside: 'date', ...more });

test('a hidden field beside the field the owner taps is taken, in a block or in a row', () => {
  assert.equal(judged([date, starts()]), '');
  assert.equal(judged([starts(), date]), '', 'named before it is declared');
  assert.equal(judged([{ key: 'rows', label: 'Rows', kind: 'list', client_editable: true, of: [date, starts()] }]), '');
});

test('beside that opens nowhere is refused', () => {
  assert.match(judged([starts({ beside: 'starts' })]), /JTK_E_BESIDE_INVALID .*beside itself/);
  assert.match(judged([date, starts({ beside: 'day' })]), /JTK_E_BESIDE_INVALID .*not a field of the same block/);
  assert.match(judged([date, starts({ no_tap_target: undefined })]), /JTK_E_BESIDE_INVALID .*only a field the page does not show/);
  assert.match(judged([{ ...date, no_tap_target: true }, starts()]), /JTK_E_BESIDE_INVALID .*not on the page either/);
});

test('titled_by names a line of text of the same set', () => {
  const label = { key: 'age_label', label: 'Label', kind: 'text', client_editable: true };
  const age = (more = {}) => ({ key: 'age', label: 'Age', kind: 'text', client_editable: true, titled_by: 'age_label', ...more });
  assert.equal(judged([label, age()]), '');
  assert.match(judged([age({ titled_by: 'age' })]), /JTK_E_TITLED_BY_INVALID .*titled by itself/);
  assert.match(judged([label, age({ titled_by: 'nope' })]), /JTK_E_TITLED_BY_INVALID .*not a field/);
  assert.match(judged([{ ...label, kind: 'date' }, age()]), /JTK_E_TITLED_BY_INVALID .*a line of text/);
});
