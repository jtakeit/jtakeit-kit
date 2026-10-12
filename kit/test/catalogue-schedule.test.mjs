// `jtk catalogue --dist` on an entry without a page that is hidden — by
// visible:false or by a schedule (lib/schedule.mjs): its listing leaves it
// out, and the check owes it nothing there, as the platform's lint does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));

/** The tool's verdict on a listing that draws only `/rates/out`, beside a second rate written `extra`. */
function checked(extra) {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-schedule-dist-'));
  try {
    const declaration = {
      BLOCKS: [{ type: 'rate', v: 1, label: 'Rate', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true }] }],
      COLLECTIONS: [{ name: 'rates', label: 'Rates', prefix: '/rates', type: 'rate', pages: false }],
    };
    writeFileSync(join(dir, 'declaration.mjs'), Object.entries(declaration).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join('\n'));
    mkdirSync(join(dir, 'jtk', 'content', 'rates'), { recursive: true });
    const rate = (slug, more) => writeFileSync(
      join(dir, 'jtk', 'content', 'rates', `${slug}.json`),
      JSON.stringify({ path: `/rates/${slug}`, collection: 'rates', blocks: [{ type: 'rate', v: 1, title: slug }], ...more }),
    );
    rate('out', {});
    rate('other', extra);
    mkdirSync(join(dir, 'dist', 'rates'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'rates', 'index.html'),
      '<!doctype html><html><body><h1 data-jtk-fixed>Rates</h1><p data-jtk-path="page:/rates/out:blocks[0].title">out</p></body></html>');
    const run = spawnSync('node', [tool, '--root', dir, '--declaration', 'declaration.mjs', '--dist', join(dir, 'dist')], { encoding: 'utf8' });
    return `${run.stdout}\n${run.stderr}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a hidden or scheduled entry without a page is owed no annotation on its listing', () => {
  assert.match(checked({ visible: false }), /the catalogue and the page agree/);
  assert.match(checked({ show_at: '2099-01-01T00:00:00Z' }), /the catalogue and the page agree/);
  assert.match(checked({ hide_at: '2020-01-01T00:00:00Z' }), /the catalogue and the page agree/);
});

test('one that is out is owed it, schedule or none', () => {
  assert.match(checked({}), /\/rates\/other: blocks\[0\]\.title is on no page/);
  assert.match(checked({ show_at: '2020-01-01T00:00:00Z' }), /\/rates\/other: blocks\[0\]\.title is on no page/);
});
