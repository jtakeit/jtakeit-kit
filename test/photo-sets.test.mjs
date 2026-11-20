// A trade's set of the example's photographs (jtakeit-core wiki/117 §2.3):
// chosen by --photos, the vertical or the kit's kind, laid where the example
// lays its own, recorded for `jtk add`, and the package's own where the set
// cannot be had. A fixture of its own — a set file and its bytes — so nothing
// here reaches the media host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JTK = join(ROOT, 'bin', 'jtk.mjs');
const NAMES = ['hero', 'gallery-linen', 'gallery-light', 'gallery-tools', 'gallery-ceramics', 'gallery-doorway', 'gallery-chair', 'gallery-grain', 'gallery-sideboard', 'service-conversation', 'service-work', 'service-finish', 'service-objects', 'service-counter', 'team-window', 'team-apron', 'team-silhouette'];

/** A set file with one set, «barber», and a directory of its bytes. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-photo-sets-'));
  const files = join(dir, 'files');
  mkdirSync(files);
  const barber = {};
  for (const name of NAMES) {
    const bytes = Buffer.from(`a barber's ${name}, the fixture's bytes`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(files, `${sha256.slice(0, 16)}.jpg`), bytes);
    barber[name] = { hash16: sha256.slice(0, 16), sha256, width: 10, height: 10, alt: { en: `The barber's ${name}`, de: `Des Barbiers ${name}` } };
  }
  const sets = join(dir, 'photoSets.json');
  writeFileSync(sets, JSON.stringify({ site: '00000000-0000-0000-0000-000000000e01', sets: { barber } }));
  return { dir, files, sets, barber };
}

function create(cwd, args, env) {
  return execFileSync(process.execPath, [JTK, 'create', ...args, '--no-git'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, XDG_CACHE_HOME: join(cwd, 'cache'), ...env },
  });
}

/** Every example key the site's content names. */
function keysIn(site) {
  const out = new Set();
  const walk = (dir) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, one.name);
      if (one.isDirectory()) walk(path);
      else if (one.name.endsWith('.json')) for (const [, hash] of readFileSync(path, 'utf8').matchAll(/media\/jtk-example\/([0-9a-f]{16})\.jpg/g)) out.add(hash);
    }
  };
  walk(join(site, 'jtk'));
  return out;
}

test('--photos barber lays the set where the example lays its own, in its words, and records it', () => {
  const { dir, files, sets, barber } = fixture();
  const said = create(dir, ['shop-a', '--locale', 'de-CH', '--photos', 'barber'], { JTK_PHOTO_SETS: sets, JTK_EXAMPLES_DIR: files });
  const site = join(dir, 'shop-a');
  const hashes = new Set(Object.values(barber).map((one) => one.hash16));
  const keys = keysIn(site);
  assert.equal(keys.size, 17, 'the seventeen of the set');
  for (const key of keys) assert.ok(hashes.has(key), `${key} is the set's`);
  const laid = readdirSync(join(site, 'src', 'assets', 'media', 'jtk-example')).sort();
  assert.deepEqual(laid, [...hashes].map((one) => `${one}.jpg`).sort(), 'its files beside the content, for the dev server');
  const design = JSON.parse(readFileSync(join(site, 'jtk', 'design.json'), 'utf8'));
  assert.equal(design.photo_set, 'barber');
  assert.equal(typeof design.photos, 'object', "the design's own photos are left as they were");
  assert.match(readFileSync(join(site, 'jtk', 'pages', 'index.json'), 'utf8'), /Des Barbiers hero/, 'the words the set gives, in the site language');
  assert.match(said, /«barber» set/);
});

test('the vertical chooses the set, and the kit lays out the same', () => {
  const { dir, files, sets, barber } = fixture();
  create(dir, ['shop-b', '--vertical', 'Barbershop'], { JTK_PHOTO_SETS: sets, JTK_EXAMPLES_DIR: files });
  const keys = keysIn(join(dir, 'shop-b'));
  assert.ok([...keys].every((one) => Object.values(barber).some((p) => p.hash16 === one)));
  assert.equal(JSON.parse(readFileSync(join(dir, 'shop-b', 'jtk', 'design.json'), 'utf8')).photo_set, 'barber');
});

test('a set that cannot be had is said, and the package\'s own are laid', () => {
  const { dir, sets, barber } = fixture();
  const said = create(dir, ['shop-c', '--photos', 'barber'], { JTK_PHOTO_SETS: sets, JTK_MEDIA_URL: 'http://127.0.0.1:9/' });
  assert.match(said, /«barber» photographs could not be had/);
  const keys = keysIn(join(dir, 'shop-c'));
  assert.ok(keys.size > 0);
  for (const key of keys) assert.ok(!Object.values(barber).some((p) => p.hash16 === key), 'none of the set');
  assert.equal(JSON.parse(readFileSync(join(dir, 'shop-c', 'jtk', 'design.json'), 'utf8')).photo_set, undefined);
});

test('a set nobody has is refused with the sets there are', () => {
  const { dir, sets } = fixture();
  assert.throws(() => create(dir, ['shop-d', '--photos', 'bakery'], { JTK_PHOTO_SETS: sets }), /«bakery» is no set.*default, barber/s);
});

test('remove and add on a site laid out with a set keep to the set', () => {
  const { dir, files, sets, barber } = fixture();
  const env = { ...process.env, XDG_CACHE_HOME: join(dir, 'cache'), JTK_PHOTO_SETS: sets, JTK_EXAMPLES_DIR: files };
  create(dir, ['shop-e', '--photos', 'barber'], env);
  const site = join(dir, 'shop-e');
  execFileSync(process.execPath, [JTK, 'remove', 'gallery'], { cwd: site, encoding: 'utf8', env });
  execFileSync(process.execPath, [JTK, 'add', 'gallery'], { cwd: site, encoding: 'utf8', env });
  const keys = keysIn(site);
  assert.equal(keys.size, 17);
  for (const key of keys) assert.ok(Object.values(barber).some((p) => p.hash16 === key), `${key} is the set's`);
});

test('the fingerprints name every set\'s photographs as the example\'s', () => {
  const prints = JSON.parse(readFileSync(join(ROOT, 'example', 'prints.json'), 'utf8'));
  const printed = new Set(prints.photos.map((one) => one.hash16));
  const real = JSON.parse(readFileSync(join(ROOT, 'lib', 'units', 'photoSets.json'), 'utf8'));
  for (const [set, them] of Object.entries(real.sets)) {
    assert.equal(Object.keys(them).length, 17, `${set}: seventeen`);
    for (const [name, one] of Object.entries(them)) {
      assert.ok(printed.has(one.hash16), `${set}/${name} printed`);
      assert.equal(one.sha256.slice(0, 16), one.hash16);
      assert.ok(one.alt.en && one.alt.de, `${set}/${name} has its words`);
    }
  }
});

test('the media host is the environment\'s: the variable, the site file, the API beside it, then production\'s', async () => {
  const { mediaBase } = await import('../lib/units/photos.mjs');
  const kept = { media: process.env.JTK_MEDIA_URL, api: process.env.JTK_API_URL };
  delete process.env.JTK_MEDIA_URL;
  delete process.env.JTK_API_URL;
  try {
    const root = mkdtempSync(join(tmpdir(), 'jtk-media-base-'));
    assert.equal(mediaBase(), 'https://media.jtakeit.com/');
    assert.equal(mediaBase({ root }), 'https://media.jtakeit.com/', 'no site file');
    // A create on staging was given --api and fetched production's (20 November 2026).
    assert.equal(mediaBase({ api: 'https://api.stg.jtakeit.com' }), 'https://media.stg.jtakeit.com/');
    assert.equal(mediaBase({ api: 'http://localhost:4000' }), 'https://media.jtakeit.com/', 'no media host beside a local API');
    process.env.JTK_API_URL = 'https://api.stg.jtakeit.com/';
    assert.equal(mediaBase(), 'https://media.stg.jtakeit.com/');
    mkdirSync(join(root, 'jtk'));
    writeFileSync(join(root, 'jtk', 'site.json'), JSON.stringify({ id: 'x', media_base: 'https://media.example.test' }));
    assert.equal(mediaBase({ root, api: 'https://api.jtakeit.com' }), 'https://media.example.test/', 'the site file over the API');
    process.env.JTK_MEDIA_URL = 'https://builder.test/m';
    assert.equal(mediaBase({ root }), 'https://builder.test/m/', 'the builder\'s word over all');
  } finally {
    for (const [name, value] of [['JTK_MEDIA_URL', kept.media], ['JTK_API_URL', kept.api]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
