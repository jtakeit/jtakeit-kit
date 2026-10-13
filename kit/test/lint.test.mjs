import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lint, CODES, expectedPaths, TAPPABLE } from '../lib/lint.mjs';
import { collectContent } from '../lib/content.mjs';

// A site of two pages and a pageless price list, laid out in a temporary
// directory: the catalogue, the content, and a dist/ that annotates some of
// it. The lint says what the build would, before any push.

function site(annotate) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-lint-'));
  const write = (path, text) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('jtk/catalogue.json', JSON.stringify({
    contract: 2,
    blocks: [
      { type: 'hero', v: 1, label: 'Hero', fields: [{ key: 'title', label: 'Title', kind: 'text' }, { key: 'url', label: 'Link', kind: 'url' }] },
      { type: 'rate', v: 1, label: 'Rate', fields: [{ key: 'title', label: 'Name', kind: 'text' }, { key: 'costs', label: 'Price', kind: 'money' }] },
      { type: 'cta', v: 1, label: 'Form', collects: 'enquiry', asks: [{ key: 'lanes', label: 'Lanes', kind: 'number' }], fields: [{ key: 'title', label: 'Title', kind: 'text' }] },
    ],
    collections: [{ name: 'rates', label: 'Rates', prefix: '/prices', type: 'rate', pages: false }],
  }));
  write('jtk/content/index.json', JSON.stringify({ path: '/', seo: {}, blocks: [{ type: 'hero', v: 1, title: 'Bowling', url: 'https://x' }, { type: 'cta', v: 1, title: 'Write' }] }));
  write('jtk/content/prices/lane.json', JSON.stringify({ path: '/prices/lane', collection: 'rates', visible: true, seo: {}, blocks: [{ type: 'rate', v: 1, title: 'Lane', costs: 2500 }] }));
  const index = annotate
    ? '<html><body><h1 data-jtk-path="blocks[0].title">Bowling</h1><form action="/api/lead"><input name="name"><input name="phone"><input name="website"><input name="lanes"><h2 data-jtk-path="blocks[1].title">Write</h2></form></body></html>'
    : '<html><body><h1>Bowling</h1><form action="/api/lead"><input name="name"><input name="phone"><input name="website"><input name="shoes"></form></body></html>';
  write('dist/index.html', index);
  write('dist/prices/index.html', annotate ? '<ul><li data-jtk-path="page:/prices/lane:blocks[0].title">Lane</li></ul>' : '<ul><li>Lane</li></ul>');
  return root;
}

test('the lint says what the build would: an annotated site is clean', async () => {
  const out = await lint({ root: site(true) });
  assert.deepEqual(out.findings, []);
  assert.equal(out.ok, true);
  assert.equal(out.pages, 2);
  assert.match(out.line, /every content field on 2 page/);
});

test('an unannotated heading, a pageless entry off its listing, and a form control nobody declared — every finding at once', async () => {
  const out = await lint({ root: site(false) });
  const codes = out.findings.map((one) => one.code);
  // The forms stop the lint first, as they stop the build.
  assert.deepEqual(codes, [CODES.FORM_FIELD_UNDECLARED]);
  assert.match(out.findings[0].says, /"shoes"/);
});

test('without a form fault, the unannotated fields are all said', async () => {
  const root = site(false);
  writeFileSync(join(root, 'dist', 'index.html'), '<html><body><h1>Bowling</h1></body></html>');
  const out = await lint({ root });
  const codes = out.findings.map((one) => one.code).sort();
  assert.deepEqual(codes, [CODES.UNANNOTATED_FIELD, CODES.UNANNOTATED_FIELD, CODES.UNANNOTATED_FIELD]);
  assert.ok(out.findings.some((one) => one.says === '/: blocks[0].title is not annotated'));
  assert.ok(out.findings.some((one) => one.says.startsWith('/prices/lane: blocks[0].title is on no page')));
});

test('the content is collected the way the build collects it, site.json or not', async () => {
  const root = site(true);
  const content = await collectContent(root);
  assert.equal(content.pages[0].path, '/');
  assert.equal(content.pages[1].collection, 'rates');
  assert.equal(content.site.locale, 'uk');
  const typeOf = (name) => ({ hero: { fields: [{ key: 'title', kind: 'text' }, { key: 'url', kind: 'url' }] } })[name];
  assert.deepEqual(expectedPaths(content.pages[0].blocks, typeOf), ['blocks[0].title'], 'a url is edited in the panel, not tapped');
  assert.ok(TAPPABLE.has('text') && !TAPPABLE.has('url'));
});

test('no catalogue is refused, not skipped', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-lint-'));
  const out = await lint({ root });
  assert.deepEqual(out.findings.map((one) => one.code), [CODES.CATALOGUE_MISSING]);
});

// The files the platform never publishes, found in dist before the push
// (the platform's wiki/81): a dot in any part of the path, .well-known aside.
test('withheldIn finds what the platform will not publish', async () => {
  const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { withheldIn } = await import('../lib/lint.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'withheld-'));
  for (const rel of ['index.html', '.env', '.git/HEAD', 'img/.DS_Store', '.well-known/security.txt', '_astro/a.js']) {
    await mkdir(join(dir, rel, '..'), { recursive: true });
    await writeFile(join(dir, rel), 'x');
  }
  assert.deepEqual(await withheldIn(dir), ['.env', '.git/', 'img/.DS_Store']);
});
