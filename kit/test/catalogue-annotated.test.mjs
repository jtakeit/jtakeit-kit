// `jtk catalogue` against a built page: a field that is declared may be
// annotated even where it is empty or hidden — the line the owner cleared and
// taps to write again, a value the page names — and only an undeclared one is
// "not in the catalogue".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('../lib/catalogue.mjs', import.meta.url));

function judged(page) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-annotated-'));
  try {
    const BLOCKS = [{ type: 'hero', v: 1, label: 'Hero', fields: [
      { key: 'title', label: 'Title', kind: 'text', client_editable: true },
      { key: 'note', label: 'Note', kind: 'text', client_editable: true },
      { key: 'later', label: 'Later', kind: 'text', client_editable: true, no_tap_target: true, beside: 'title', hint: 'Said later.' },
    ] }];
    writeFileSync(join(root, 'declaration.mjs'), `export const BLOCKS = ${JSON.stringify(BLOCKS)};`);
    mkdirSync(join(root, 'jtk', 'content'), { recursive: true });
    writeFileSync(join(root, 'jtk', 'content', 'index.json'), JSON.stringify({ path: '/', seo: {}, blocks: [{ type: 'hero', v: 1, title: 'Hello', note: '' }] }));
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'index.html'), `<html><body>${page}</body></html>`);
    const run = spawnSync('node', [tool, '--root', root, '--declaration', 'declaration.mjs', '--dist', join(root, 'dist')], { encoding: 'utf8' });
    return `${run.stdout}\n${run.stderr}`;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('an empty field and a hidden one may be annotated', () => {
  const out = judged('<h1 data-jtk-path="blocks[0].title">Hello</h1><p data-jtk-path="blocks[0].note"></p><p data-jtk-path="blocks[0].later" hidden>Soon</p>');
  assert.doesNotMatch(out, /not in the catalogue/);
  assert.match(out, /the catalogue and the page agree/);
});

test('a field nobody declared is still said', () => {
  const out = judged('<h1 data-jtk-path="blocks[0].title">Hello</h1><p data-jtk-path="blocks[0].ghost">Boo</p>');
  assert.match(out, /blocks\[0\]\.ghost is on the page and not in the catalogue/);
});

test('a viewport height with no ceiling is said, and one with a ceiling is not', () => {
  const run = (css) => {
    const root = mkdtempSync(join(tmpdir(), 'jtk-vh-'));
    try {
      const BLOCKS = [{ type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text', client_editable: true }] }];
      writeFileSync(join(root, 'declaration.mjs'), `export const BLOCKS = ${JSON.stringify(BLOCKS)};`);
      mkdirSync(join(root, 'jtk', 'content'), { recursive: true });
      writeFileSync(join(root, 'jtk', 'content', 'index.json'), JSON.stringify({ path: '/', seo: {}, blocks: [{ type: 'hero', v: 1, title: 'Hello' }] }));
      mkdirSync(join(root, 'src', 'styles'), { recursive: true });
      writeFileSync(join(root, 'src', 'styles', 'site.css'), css);
      mkdirSync(join(root, 'dist'), { recursive: true });
      writeFileSync(join(root, 'dist', 'index.html'), '<html><body><h1 data-jtk-path="blocks[0].title">Hello</h1></body></html>');
      const out = spawnSync('node', [tool, '--root', root, '--declaration', 'declaration.mjs', '--dist', join(root, 'dist')], { encoding: 'utf8' });
      return `${out.stdout}\n${out.stderr}`;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  assert.match(run('.hero { min-block-size: 100svh; }'), /min-block-size: 100vh with no ceiling/);
  assert.match(run('.a{height:100vh}'), /height: 100vh with no ceiling/);
  assert.doesNotMatch(run('.hero { min-block-size: min(100svh, 56rem); }'), /no ceiling/);
});
