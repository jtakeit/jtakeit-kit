// keepByName, and the lifetimes _meta.json carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { keepByName, keptName } from '../lib/kept.mjs';
import { buildMeta, cacheRules } from '../lib/meta.mjs';

function build(files) {
  const dist = mkdtempSync(join(tmpdir(), 'jtk-kept-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), body);
  }
  return dist;
}

test('a file a script names is copied under a hashed name and every whole address points at it', () => {
  const dist = build({
    'index.html':
      '<video src="/clips/einsatz.mp4" poster="/clips/einsatz.jpg"></video>' +
      '<div data-src="/scenes/scene-1.webp" style="background:url(/scenes/scene-1.webp)"></div>' +
      '<img srcset="/scenes/scene-1.webp 1x, /scenes/scene-2.webp 2x">' +
      '<a href="/clips/einsatz.mp4.old">old</a><a href="/x/clips/einsatz.mp4">elsewhere</a>' +
      '<div data-scenes="[{&quot;file&quot;:&quot;/scenes/scene-2.webp&quot;,&quot;w&quot;:822}]"></div>',
    '_astro/hero.Ab12Cd34.js': 'const scenes=["/scenes/scene-1.webp",\'/scenes/scene-2.webp\'];const n=`/scenes/scene-${i}.webp`;',
    'clips/einsatz.mp4': 'film',
    'clips/einsatz.jpg': 'poster',
    'clips/index.html': '<h1>a page under the directory</h1>',
    'scenes/scene-1.webp': 'one',
    'scenes/scene-2.webp': 'two',
    'scenes/scene-3.webp': 'three',
  });

  const out = keepByName(dist, { dirs: ['clips', '/scenes/'] });
  const film = `/_astro/kept/clips/${keptName('einsatz.mp4', Buffer.from('film'))}`;
  const one = `/_astro/kept/scenes/${keptName('scene-1.webp', Buffer.from('one'))}`;
  assert.match(film, /^\/_astro\/kept\/clips\/einsatz\.[0-9a-f]{8}\.mp4$/);
  assert.equal(out.kept.length, 5, 'the page under the directory is not a file to keep');
  assert.ok(existsSync(join(dist, film)));
  assert.ok(existsSync(join(dist, 'clips/einsatz.mp4')), 'the original stays');

  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  assert.ok(html.includes(`<video src="${film}"`));
  assert.ok(html.includes(`data-src="${one}"`));
  assert.ok(html.includes(`url(${one})`));
  assert.ok(html.includes(`srcset="${one} 1x, /_astro/kept/scenes/`));
  assert.ok(html.includes('href="/clips/einsatz.mp4.old"'));
  assert.ok(html.includes('href="/x/clips/einsatz.mp4"'));

  const js = readFileSync(join(dist, '_astro/hero.Ab12Cd34.js'), 'utf8');
  assert.ok(js.includes(`"${one}"`));
  assert.ok(js.includes('`/scenes/scene-${i}.webp`'), 'an assembled address is left as written');

  // Nothing named scene-3 whole: it is said, and still served by name.
  assert.deepEqual(out.unreferenced, ['/scenes/scene-3.webp']);
  assert.equal(out.rewritten, 9);
  assert.ok(html.includes(`&quot;file&quot;:&quot;/_astro/kept/scenes/${keptName('scene-2.webp', Buffer.from('two'))}&quot;`), 'a JSON list in an attribute');

  // The same bytes, the same name: a rebuild changes nothing.
  assert.equal(keptName('a.webp', Buffer.from('x')), keptName('a.webp', Buffer.from('x')));
  assert.notEqual(keptName('a.webp', Buffer.from('x')), keptName('a.webp', Buffer.from('y')));
});

test('keepByName follows the site base and refuses a directory that is not one', () => {
  const dist = build({ 'index.html': '<video src="/shop/clips/a.mp4"></video>', 'clips/a.mp4': 'a' });
  const out = keepByName(dist, { dirs: ['clips'], base: '/shop' });
  assert.equal(out.kept[0].from, '/shop/clips/a.mp4');
  assert.ok(readFileSync(join(dist, 'index.html'), 'utf8').includes(out.kept[0].to));
  assert.ok(out.kept[0].to.startsWith('/shop/_astro/kept/clips/a.'));

  for (const bad of ['', '/', '_astro', '.git']) assert.throws(() => keepByName(dist, { dirs: [bad] }), TypeError);
  assert.deepEqual(keepByName(dist, { dirs: [] }), { kept: [], rewritten: 0, unreferenced: [] });
});

test('_meta.json carries the lifetimes as the edge reads them, and refuses one that covers the site', async () => {
  assert.deepEqual(cacheRules([{ prefix: 'clips', maxAge: 86400.7 }, { prefix: '/scenes/', maxAge: 1e12 }]), [
    { prefix: '/clips/', maxAge: 86400 },
    { prefix: '/scenes/', maxAge: 31_536_000 },
  ]);
  assert.deepEqual(cacheRules(undefined), []);
  assert.throws(() => cacheRules([{ prefix: '/', maxAge: 60 }]), /whole site/);
  assert.throws(() => cacheRules([{ prefix: '/clips/', maxAge: 'a day' }]), /seconds/);
  assert.throws(() => cacheRules({ prefix: '/clips/' }), TypeError);

  const root = mkdtempSync(join(tmpdir(), 'jtk-meta-cache-'));
  const meta = await buildMeta({ root, cache: [{ prefix: '/clips/', maxAge: 86400 }] });
  assert.deepEqual(meta.cache, [{ prefix: '/clips/', maxAge: 86400 }]);
  assert.equal((await buildMeta({ root })).cache, undefined);
});
