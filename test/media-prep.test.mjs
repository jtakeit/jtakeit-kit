// The media push's smaller rules: what a file is made into before it is
// sent (the panel's downscale.ts), what a 429's Retry-After says, and how the
// code's push carries the media step — `jtk push --media` runs it first and
// sends no code when it stops; without it, a push says what is outside the
// library before it sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { main as code } from '../lib/code.mjs';
import { retryAfterOf } from '../lib/code/wire.mjs';
import { MAX_EDGE, prepare, refusalOf, sniff } from '../lib/media/prep.mjs';

const jpeg = (n) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7)]);

/** A stand-in for sharp: metadata as told, every encoding a third of the input. */
function fakeSharp({ width, height, orientation = 1 }) {
  const calls = [];
  const sharp = (data) => {
    const chain = {
      metadata: async () => ({ width, height, orientation }),
      rotate: () => (calls.push('rotate'), chain),
      resize: (options) => (calls.push(['resize', options]), chain),
      jpeg: (options) => (calls.push(['jpeg', options]), chain),
      webp: (options) => (calls.push(['webp', options]), chain),
      toBuffer: async () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(Math.floor(data.length / 3))]),
    };
    return chain;
  };
  return { sharp, calls };
}

test('a picture is scaled to 2 400 px only when it is over 300 KB and longer than that, as the panel does', async () => {
  const small = jpeg(200 * 1024);
  const { sharp, calls } = fakeSharp({ width: 4000, height: 3000 });
  assert.equal((await prepare(small, { sharp })).data, small, 'under 300 KB: as it is');
  assert.equal(calls.length, 0);

  const fits = fakeSharp({ width: 2400, height: 1600 });
  const big = jpeg(900 * 1024);
  assert.equal((await prepare(big, { sharp: fits.sharp })).data, big, '2 400 px already: as it is');

  const large = fakeSharp({ width: 6000, height: 4000 });
  const out = await prepare(big, { sharp: large.sharp });
  assert.equal(out.scaled, true);
  assert.ok(out.data.length < big.length);
  assert.deepEqual(large.calls, ['rotate', ['resize', { width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }], ['jpeg', { quality: 82 }]]);

  const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.alloc(900 * 1024)]);
  const wide = fakeSharp({ width: 5000, height: 1000 });
  const asWebp = await prepare(png, { sharp: wide.sharp });
  assert.equal(asWebp.type, 'image/webp', 'a PNG made smaller is a WebP, which keeps its transparency');

  assert.equal((await prepare(big, { sharp: null })).data, big, 'no sharp: the original, which the platform scales');
  const clip = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(900 * 1024)]);
  assert.equal((await prepare(clip, { sharp: large.sharp })).data, clip, 'a clip goes as it is');
});

test('the library\'s types, by their bytes', () => {
  assert.equal(sniff(jpeg(4)), 'image/jpeg');
  assert.equal(sniff(Buffer.from('RIFF....WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(sniff(Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypavif')])), 'image/avif');
  assert.equal(sniff(Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  ')])), 'video/quicktime');
  assert.equal(sniff(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')), 'image/svg+xml');
  assert.match(refusalOf(sniff(Buffer.from('GIF89a'))), /GIF/);
  assert.match(refusalOf('video/quicktime'), /MP4/);
  assert.equal(refusalOf('image/png'), null);
});

test('Retry-After in seconds or as a date', () => {
  assert.equal(retryAfterOf('12'), 12);
  assert.equal(retryAfterOf(new Date(Date.UTC(2026, 10, 13, 12, 0, 30)).toUTCString(), Date.UTC(2026, 10, 13, 12, 0, 0)), 30);
  assert.equal(retryAfterOf(null), undefined);
  assert.equal(retryAfterOf('soon'), undefined);
});

/** A site whose content names a slot, and a platform that answers only what is asked of it here. */
async function setting() {
  const root = mkdtempSync(join(tmpdir(), 'jtk-media-code-'));
  const put = (path, data) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
  };
  put('jtk/schema.json', { contract: 3, locale: 'de', blocks: [] });
  put('jtk/pages/index.json', { id: 'p1', path: '/', blocks: [{ _key: 'hero0001', type: 'hero', image: { src: 'raum', alt: 'Der Raum' } }] });
  put('src/assets/raum.jpg', jpeg(64));
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ code: req.url.startsWith('/v1/media') ? 'unauthenticated' : 'JTK_E_CODE_TOKEN', message: 'this link is not good (any more) — ask for a new one' }));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { root, seen, origin, close: () => new Promise((done) => server.close(done)) };
}

test('jtk push --media runs the media push first, and sends no code when it stops', async () => {
  const { root, seen, origin, close } = await setting();
  try {
    const lines = [];
    const status = await code('push', [`${origin}/v1/code#t=codetoken`, '--media', `${origin}/v1/media#t=mediatoken`], { cwd: root, out: (l) => lines.push(l), err: (l) => lines.push(l), sleep: async () => {} });
    assert.equal(status, 1);
    assert.ok(seen.length > 0 && seen.every((one) => one.startsWith('POST /v1/media/') || one.startsWith('GET /v1/media/')), `only the media wire was asked: ${seen.join(', ')}`);
    assert.match(lines.join('\n'), /ask media_link for a new one/);
    assert.doesNotMatch(lines.join('\n'), /codetoken|mediatoken/, 'neither token is printed');
  } finally {
    await close();
  }
});

test('jtk push without --media says what is outside the library before it sends', async () => {
  const { root, seen, origin, close } = await setting();
  try {
    const lines = [];
    await code('push', [`${origin}/v1/code#t=codetoken`], { cwd: root, out: (l) => lines.push(l), err: (l) => lines.push(l), git: false });
    assert.match(lines[0], /jtk push: 1 picture in jtk\/pages\/index\.json is not in the site's media library .* media_link, then run this push again with --media/);
    assert.ok(seen.some((one) => one.startsWith('POST /v1/code/manifest')), 'and the code goes on');
  } finally {
    await close();
  }
});
