// jtk media push / jtk media pull against a stand-in for the platform's media
// wire (jtakeit-core wiki/108 §2.3, the core's media/link.go): a link good for
// many requests, a manifest by the hash of the bytes as sent, the parts by the
// manifest's n, the words only where a file has none, the index — and the
// public media host the build reads. What the real intake adds (cleaning,
// measuring, thumbnails, the quota) is its own tests'; this holds the kit to
// the wire both are written to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { main } from '../lib/media.mjs';

const SITE = '7fd4aa8c-1111-4222-8333-444455556666';
const OTHER = 'd6fc4fd9-aaaa-4bbb-8ccc-ddddeeeeffff';
const sha = (data) => createHash('sha256').update(data).digest('hex');
/** A file the library takes: a JPEG's first bytes, then something of its own. */
const jpeg = (label) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`${label}-${'x'.repeat(64)}`)]);
const mp4 = (label) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.from(label)]);

const put = (root, path, data) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), typeof data === 'string' || Buffer.isBuffer(data) ? data : `${JSON.stringify(data, null, 2)}\n`);
};
const json = (root, path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** Every file under a directory with its hash: what «nothing was written» is compared by. */
function snapshot(root) {
  const out = {};
  const walk = (at) => {
    for (const one of readdirSync(join(root, at), { withFileTypes: true })) {
      const path = at ? `${at}/${one.name}` : one.name;
      if (one.isDirectory()) walk(path);
      else out[path] = sha(readFileSync(join(root, path)));
    }
  };
  walk('');
  return out;
}

/**
 * The platform's half, in memory: the library by key, what each was sent
 * as, the links and their last manifest — and the media host, which serves
 * a key to anybody holding it.
 */
async function fakePlatform() {
  /** @type {Map<string, { data: Buffer, sent: string, alt: string, name: string }>} */
  const library = new Map();
  /** Another site's files, served by the host alone. */
  const elsewhere = new Map();
  /** @type {Map<string, { manifest: any[], parts: number, dead: boolean }>} */
  const links = new Map();
  const requests = [];
  const api = {
    library,
    elsewhere,
    requests,
    /** After this many parts, every link ends (the fifteen minutes). */
    partsBeforeEnd: Infinity,
    /** The next answers refused with 429: `{ times, retryAfter?, message? }`. */
    busy: null,
    /** Files the library took from a part, each once. */
    stored: 0,
    get parts() {
      return requests.filter((one) => one.method === 'PUT').length;
    },
  };
  api.mint = () => {
    const token = randomBytes(24).toString('base64url');
    links.set(token, { manifest: [], parts: 0, dead: false });
    return `${api.origin}/v1/media#t=${token}`;
  };
  /** A file the owner put in through the panel, with their words. */
  api.uploaded = (data, alt = '', name = 'owner.jpg') => {
    const key = `media/${SITE}/${sha(data).slice(0, 16)}.jpg`;
    library.set(key, { data, sent: sha(data), alt, name });
    return key;
  };
  const giveWords = (key, words) => {
    const file = library.get(key);
    if (file && words && !file.alt) file.alt = words;
    return file?.alt ?? '';
  };

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const route = req.url ?? '';
    const answer = (status, value, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(value));
    };
    const fail = (status, code, message, headers) => answer(status, { code, message, details: null }, headers);

    // The media host: public, no token.
    const hosted = /^\/host\/(media\/.+)$/.exec(route);
    if (req.method === 'GET' && hosted) {
      requests.push({ method: 'HOST', route, auth: req.headers.authorization });
      const data = library.get(hosted[1])?.data ?? elsewhere.get(hosted[1]);
      if (!data) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      return res.end(data);
    }

    requests.push({ method: req.method, route, line: `${req.method} ${req.url}`, auth: req.headers.authorization });
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const link = links.get(token);
    if (!link || link.dead) return fail(401, 'unauthenticated', 'this link is not good (any more) — ask media_link for a new one');
    if (api.busy && api.busy.times > 0) {
      api.busy.times -= 1;
      return fail(429, 'resource_exhausted', api.busy.message ?? 'too many requests, try again later', api.busy.retryAfter === undefined ? {} : { 'retry-after': String(api.busy.retryAfter) });
    }

    if (req.method === 'POST' && route === '/v1/media/manifest') {
      const items = JSON.parse(body.toString());
      if (!Array.isArray(items) || items.length > 300) return fail(413, 'invalid_argument', 'a manifest names at most 300 files — send them in several');
      link.manifest = items;
      const out = items.map((item, i) => {
        if (!/^[0-9a-f]{64}$/.test(item.sha256)) return { sha256: item.sha256, held: false, refused: 'not a sha-256 in hex' };
        if (item.bytes > 8 * 1024 * 1024) return { sha256: item.sha256, held: false, refused: 'a file is at most 8 MB' };
        const key = [...library].find(([, file]) => file.sent === item.sha256)?.[0];
        if (key) return { sha256: item.sha256, held: true, key, alt: giveWords(key, item.alt) };
        return { sha256: item.sha256, held: false, n: i + 1 };
      });
      return answer(200, { items: out, part_bytes: 8388608 });
    }
    const part = /^\/v1\/media\/parts\/(\d+)$/.exec(route);
    if (req.method === 'PUT' && part) {
      const n = Number(part[1]);
      const item = link.manifest[n - 1];
      if (!item) return fail(404, 'not_found', `part ${n} is not in this link's manifest — send the manifest first`);
      if (sha(body) !== item.sha256) return fail(400, 'invalid_argument', `these bytes are not the ones the manifest named for part ${n}`);
      const ext = body[0] === 0xff ? 'jpg' : body[0] === 0x89 ? 'png' : body.subarray(4, 8).toString() === 'ftyp' ? 'mp4' : undefined;
      if (!ext) return fail(415, 'invalid_argument', 'that is not a picture or a clip the library takes');
      const key = `media/${SITE}/${sha(body).slice(0, 16)}.${ext}`;
      const deduplicated = library.has(key);
      if (!deduplicated) {
        library.set(key, { data: body, sent: item.sha256, alt: '', name: item.name });
        api.stored += 1;
      }
      const alt = giveWords(key, item.alt);
      link.parts += 1;
      if (api.parts >= api.partsBeforeEnd) for (const one of links.values()) one.dead = true;
      return answer(200, { key, bytes: body.length, content_type: ext === 'jpg' ? 'image/jpeg' : 'video/mp4', deduplicated, alt, thumbs: [160, 480], n, sha256: item.sha256 });
    }
    if (req.method === 'POST' && route === '/v1/media/alt') {
      const items = JSON.parse(body.toString());
      return answer(200, {
        items: items.map(({ key, alt }) => {
          const file = library.get(key);
          if (!file) return { key, alt: '', taken: false, refused: "not in this site's library" };
          const before = file.alt;
          const now = giveWords(key, alt);
          return { key, alt: now, taken: before === '' && now === alt };
        }),
      });
    }
    if (req.method === 'GET' && route === '/v1/media/index') {
      return answer(200, {
        files: [...library].map(([key, file]) => ({ id: key, key, bytes: file.data.length, content_type: 'image/jpeg', created_at: '2026-11-13T10:00:00Z', alt: file.alt, name: file.name, width: 1600, height: 1200, origin: 'agent', thumbs: [160, 480], uses: [] })),
        used: [...library.values()].reduce((sum, one) => sum + one.data.length, 0),
        quota: 250 * 1024 * 1024,
      });
    }
    return fail(404, 'not_found', `no ${req.method} ${route}`);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  api.origin = `http://127.0.0.1:${server.address().port}`;
  api.host = `${api.origin}/host/`;
  api.close = () => new Promise((done) => server.close(done));
  return api;
}

/**
 * A contract-3 site in German with an English translation, naming its
 * pictures every way there is: a slot with words and one without (whose
 * words the PHOTOS registry has), a gallery with a key of this site and a
 * key of another, an entry's cover and a picture in its body by path, and a
 * clip with its poster. A logo the layout draws by name, and a slot the
 * content names that is not there.
 */
function site(platform, { id = SITE } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-media-'));
  const own = platform.uploaded(jpeg('owner-photo'), 'Vom Inhaber beschrieben');
  const foreign = `media/${OTHER}/0123456789abcdef.jpg`;
  platform.elsewhere.set(foreign, jpeg('from-staging'));
  put(root, 'jtk/schema.json', { contract: 3, locale: 'de', locales: ['en'], blocks: [] });
  put(root, 'jtk/site.json', { ...(id ? { id } : {}), currency: 'CHF', media_base: platform.host });
  put(root, 'jtk/pages/index.json', {
    id: 'p1',
    path: '/',
    blocks: [
      { _key: 'hero0001', type: 'hero', v: 1, title: 'Willkommen', image: { src: 'atelier-raum', alt: 'Heller Salon mit Holzboden', focus: '50% 30%' } },
      {
        _key: 'gall0001',
        type: 'gallery',
        v: 1,
        images: [
          { _key: 'g1', src: 'gallery/stuhl', alt: '' },
          { _key: 'g2', src: own, alt: 'Ein Bild des Inhabers' },
          { _key: 'g3', src: foreign, alt: 'Vom Staging' },
          { _key: 'g4', src: 'fehlt-noch', alt: 'Kommt noch' },
        ],
      },
      { _key: 'clip0001', type: 'loop', v: 1, loop: [{ _key: 'c1', src: 'nadel', poster: 'nadel-still', alt: 'Die Nadel' }] },
      { _key: 'anim0001', type: 'note', v: 1, picture: { src: 'wink', alt: 'Ein Zwinkern' } },
    ],
  });
  put(root, 'jtk/pages/index.en.json', { of: 'p1', locale: 'en', blocks: [{ _key: 'hero0001', title: 'Welcome', image: { src: 'atelier-raum', alt: 'A bright salon' } }, { _key: 'gall0001', images: [{ _key: 'g1', alt: 'A chair' }] }] });
  put(root, 'jtk/entries/blog/erster.json', {
    id: 'e1',
    collection: 'blog',
    slug: 'erster',
    fields: { title: 'Der Erste', cover: { src: 'atelier-raum', alt: '' }, body: 'Ein Satz.\n\n![Die Hände](../../../src/assets/haende.jpg)\n\nNoch einer.\n' },
  });
  put(root, 'jtk/shared.json', { blocks: [{ _key: 'head0001', type: 'header', logo: { src: 'logo', alt: 'Salon' } }] });
  put(root, 'src/assets/atelier-raum.jpg', jpeg('atelier-raum'));
  put(root, 'src/assets/gallery/stuhl.jpg', jpeg('stuhl'));
  put(root, 'src/assets/haende.jpg', jpeg('haende'));
  put(root, 'src/assets/nadel.mp4', mp4('nadel'));
  put(root, 'src/assets/nadel-still.jpg', jpeg('nadel-still'));
  put(root, 'src/assets/logo.png', Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.from('logo')]));
  put(root, 'src/assets/wink.gif', Buffer.from('GIF89a-wink'));
  put(root, 'src/lib/photos.ts', "export const PHOTOS: readonly Photo[] = [\n  { name: 'gallery/stuhl', alt: 'Ein Bugholzstuhl am Fenster' },\n];\n");
  put(root, 'src/components/Header.astro', '---\nimport logo from "../assets/logo.png";\n---\n<img src={logo.src} alt="" />\n');
  put(root, '.gitignore', 'node_modules/\n');
  return { root, own, foreign };
}

async function run(args, { cwd, platform, sleeps = [] }) {
  const lines = [];
  const code = await main(args, { cwd, out: (line) => lines.push(line), err: (line) => lines.push(line), sleep: async (ms) => void sleeps.push(ms) });
  return { code, text: lines.join('\n'), lines, sleeps };
}

test('a push puts slots, a body\'s path, another site\'s key and a clip with its poster into the library, and writes the keys over them keeping the words', async () => {
  const platform = await fakePlatform();
  try {
    const { root, own, foreign } = site(platform);
    const url = platform.mint();
    const { code, text } = await run(['push', url], { cwd: root, platform });
    assert.equal(code, 1, `a slot naming no file is left and said, so the exit says so:\n${text}`);
    assert.doesNotMatch(text, new RegExp(url.split('#t=')[1]), 'the token is never printed');

    const page = json(root, 'jtk/pages/index.json');
    const [hero, gallery, loop] = page.blocks;
    assert.match(hero.image.src, new RegExp(`^media/${SITE}/[0-9a-f]{16}\\.jpg$`));
    assert.deepEqual({ ...hero.image, src: '' }, { src: '', alt: 'Heller Salon mit Holzboden', focus: '50% 30%' }, 'the picture keeps its words and its focus');
    assert.equal(gallery.images[0].src.startsWith(`media/${SITE}/`), true);
    assert.equal(gallery.images[0].alt, 'Ein Bugholzstuhl am Fenster', 'a picture with no words takes the registry\'s');
    assert.equal(gallery.images[1].src, own, 'a key of this site is left as it is');
    assert.equal(gallery.images[2].src, `media/${SITE}/${sha(jpeg('from-staging')).slice(0, 16)}.jpg`, 'another site\'s key is re-homed by its bytes');
    assert.equal(gallery.images[3].src, 'fehlt-noch', 'a slot naming no file is left');
    assert.match(text, /fehlt-noch.*names no file in src\/assets/);
    assert.match(loop.loop[0].src, /\.mp4$/);
    assert.match(loop.loop[0].poster, new RegExp(`^media/${SITE}/[0-9a-f]{16}\\.jpg$`));

    const translation = json(root, 'jtk/pages/index.en.json');
    assert.equal(translation.blocks[0].image.src, hero.image.src, 'a translation laying its own picture is rewritten too');
    assert.equal(translation.blocks[0].image.alt, 'A bright salon', 'its words are its own');

    const entry = json(root, 'jtk/entries/blog/erster.json');
    assert.equal(entry.fields.cover.src, hero.image.src, 'one file named twice is one key');
    assert.equal(entry.fields.cover.alt, 'Heller Salon mit Holzboden', 'the cover without words takes the file\'s');
    const bodyKey = /\]\(\.\/(media\/[^)]+)\)/.exec(entry.fields.body)?.[1];
    assert.ok(bodyKey?.startsWith(`media/${SITE}/`), `the body names the key beside the entry: ${entry.fields.body}`);
    assert.match(entry.fields.body, /!\[Die Hände\]\(\.\/media\//, 'the body keeps its words');
    assert.ok(existsSync(join(root, 'jtk/entries/blog', bodyKey)), 'the body\'s picture is beside the entry, where Astro resolves it');
    assert.ok(existsSync(join(root, 'src/assets', hero.image.src)), 'each file is kept in src/assets/media for the dev server');

    // The library: words from the content, the registry's, none for a poster.
    const files = [...platform.library.values()];
    assert.equal(platform.library.get(hero.image.src).alt, 'Heller Salon mit Holzboden');
    assert.equal(platform.library.get(gallery.images[0].src).alt, 'Ein Bugholzstuhl am Fenster');
    assert.equal(platform.library.get(loop.loop[0].poster).alt, '');
    assert.equal(platform.library.get(own).alt, 'Vom Inhaber beschrieben', 'the owner\'s words stay the file\'s');
    assert.equal(files.length, 8, 'the owner\'s, and seven sent');
    assert.equal(platform.requests.filter((one) => one.route === '/v1/media/manifest').length, 1, 'one manifest');
    assert.ok(platform.requests.filter((one) => one.method !== 'HOST').every((one) => one.auth?.startsWith('Bearer ') && !one.line.includes('#')), 'the token goes as a bearer, never in the request line');
    assert.ok(platform.requests.filter((one) => one.method === 'HOST').every((one) => one.auth === undefined), 'the media host is sent no token');

    // Tidy: what nothing names is moved, the logo the code imports stays.
    for (const path of ['atelier-raum.jpg', 'gallery/stuhl.jpg', 'haende.jpg', 'nadel.mp4', 'nadel-still.jpg']) {
      assert.ok(!existsSync(join(root, 'src/assets', path)), `${path} left src/assets`);
      assert.ok(existsSync(join(root, '.jtakeit/adopted', path)), `${path} is in .jtakeit/adopted, not deleted`);
    }
    assert.ok(existsSync(join(root, 'src/assets/logo.png')), 'the logo the code imports stays where the code draws it');
    assert.match(json(root, 'jtk/shared.json').blocks[0].logo.src, new RegExp(`^media/${SITE}/[0-9a-f]{16}\\.png$`), 'and the field that names it names the library\'s copy');
    assert.match(text, /left in src\/assets — the code still names them[^\n]*\n\s+src\/assets\/logo\.png — named by src\/components\/Header\.astro/);
    assert.equal(page.blocks[3].picture.src, 'wink', 'a GIF is refused before anything is sent, and its slot left');
    assert.match(text, /src\/assets\/wink\.gif is a GIF, which the library does not take/);
    const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
    for (const line of ['src/assets/media/', '.jtakeit/adopted/', '.jtakeit/media.json', 'jtk/entries/**/media/']) assert.ok(ignore.split('\n').includes(line), `.gitignore has ${line}`);
    assert.match(text, /next: npx @jtakeit\/astro schema/);
  } finally {
    await platform.close();
  }
});

test('a second push sends nothing and changes nothing', async () => {
  const platform = await fakePlatform();
  try {
    const { root } = site(platform);
    put(root, '_photos/rest.jpg', jpeg('rest-of-the-shoot'));
    put(root, '_photos/schleife.mp4', mp4('schleife'));
    put(root, '_photos/schleife.jpg', jpeg('schleife-still'));
    await run(['push', platform.mint(), '_photos'], { cwd: root, platform });
    assert.ok([...platform.library.values()].some((one) => one.name === 'schleife.jpg'));
    assert.equal(platform.requests.filter((one) => one.route === '/v1/media/manifest').length, 1);
    const before = snapshot(root);
    const parts = platform.parts;
    const count = platform.requests.length;

    const again = await run(['push', platform.mint(), '_photos'], { cwd: root, platform });
    assert.equal(platform.parts, parts, `no part sent the second time:\n${again.text}`);
    assert.deepEqual(snapshot(root), before, 'no file changed');
    assert.equal(platform.requests.length - count, 1, 'the files given are asked about once, and held');
    assert.match(again.text, /done: 0 sent/);

    const content = await run(['push', platform.mint()], { cwd: root, platform });
    assert.equal(platform.requests.length - count, 1, `with nothing given, a push of a site whose pictures are all in the library sends no request:\n${content.text}`);
    assert.deepEqual(snapshot(root), before);
  } finally {
    await platform.close();
  }
});

test('files given on the command line go whether or not anything names them, a clip and a still with one stem as a clip and its poster', async () => {
  const platform = await fakePlatform();
  try {
    const { root } = site(platform);
    put(root, '_clips/needle.mp4', mp4('needle'));
    put(root, '_clips/needle.jpg', jpeg('needle-still'));
    put(root, '_clips/notes.txt', 'not a picture');
    put(root, 'words.json', { needle: 'Die Nadel in Bewegung' });
    const manifests = [];
    const { text } = await main(['push', platform.mint(), '_clips', '--alt', 'words.json'], {
      cwd: root,
      out: () => {},
      err: (line) => manifests.push(line),
      sleep: async () => {},
      fetch: async (url, init) => {
        if (String(url).endsWith('/manifest')) manifests.push(JSON.parse(init.body));
        return fetch(url, init);
      },
    }).then(() => ({ text: '' }), () => ({ text: '' }));
    void text;
    const sent = manifests.find(Array.isArray) ?? [];
    const clip = sent.find((one) => one.name === 'needle.mp4');
    const still = sent.find((one) => one.name === 'needle.jpg');
    assert.ok(clip && still, 'both in the manifest');
    assert.equal(still.poster_of, clip.sha256, 'the still is the clip\'s poster');
    assert.equal(clip.alt, 'Die Nadel in Bewegung', '--alt gives words by stem');
    assert.ok(!sent.some((one) => one.name === 'notes.txt'), 'only what the library takes');
    assert.ok([...platform.library.values()].some((one) => one.name === 'needle.mp4'), 'the clip is in the library, named nowhere yet');
  } finally {
    await platform.close();
  }
});

test('a link that ends half-way leaves the keys of what reached the library, and the same command with a new link carries on', async () => {
  const platform = await fakePlatform();
  try {
    const { root } = site(platform);
    platform.partsBeforeEnd = 2;
    const first = await run(['push', platform.mint()], { cwd: root, platform });
    assert.equal(first.code, 1);
    assert.match(first.text, /the link has ended .* ask media_link for a new one and run the same command: it carries on/);
    const page = json(root, 'jtk/pages/index.json');
    const written = [page.blocks[0].image.src, page.blocks[1].images[0].src, page.blocks[2].loop[0].src].filter((one) => one.startsWith('media/')).length;
    assert.ok(written >= 1 && written < 3, `some keys are written, not all: ${written}`);
    assert.ok(existsSync(join(root, 'src/assets/atelier-raum.jpg')), 'nothing is tidied after a run that stopped');

    platform.partsBeforeEnd = Infinity;
    const sentBefore = platform.parts;
    const second = await run(['push', platform.mint()], { cwd: root, platform });
    assert.match(second.text, /done: /);
    const after = json(root, 'jtk/pages/index.json');
    assert.ok(after.blocks[0].image.src.startsWith('media/') && after.blocks[1].images[0].src.startsWith('media/') && after.blocks[2].loop[0].src.startsWith('media/'));
    assert.equal(platform.stored, 7, 'every file stored once in all');
    assert.ok(platform.parts - sentBefore <= 7);
    assert.ok(!existsSync(join(root, 'src/assets/atelier-raum.jpg')) && existsSync(join(root, '.jtakeit/adopted/atelier-raum.jpg')), 'the files adopted in the first run are tidied in the second');
  } finally {
    await platform.close();
  }
});

test('a 429 is waited out for as long as Retry-After says, or longer each time; the site\'s hourly budget stops the push with how to carry on', async () => {
  const platform = await fakePlatform();
  try {
    let { root } = site(platform);
    platform.busy = { times: 2, retryAfter: 3 };
    const told = await run(['push', platform.mint()], { cwd: root, platform });
    assert.deepEqual(told.sleeps, [3000, 3000], told.text);
    assert.match(told.text, /slow down — trying again in 3 s/);
    assert.match(told.text, /done: 7 sent/);

    ({ root } = site(platform));
    platform.library.clear();
    platform.uploaded(jpeg('owner-photo'), 'Vom Inhaber beschrieben');
    platform.busy = { times: 2 };
    const backed = await run(['push', platform.mint()], { cwd: root, platform });
    assert.deepEqual(backed.sleeps, [2000, 4000], 'without Retry-After, longer each time');

    ({ root } = site(platform));
    platform.library.clear();
    platform.uploaded(jpeg('owner-photo'), 'Vom Inhaber beschrieben');
    platform.busy = { times: 1, message: 'this site has taken 300 files or 250 MB through links in the last hour — the rest in an hour' };
    const spent = await run(['push', platform.mint()], { cwd: root, platform });
    assert.equal(spent.code, 1);
    assert.deepEqual(spent.sleeps, [], 'an hour is not waited out');
    assert.match(spent.text, /in the last hour .* run the same command again later/);

    ({ root } = site(platform));
    platform.busy = { times: 99, retryAfter: 1 };
    const tired = await run(['push', platform.mint()], { cwd: root, platform });
    assert.equal(tired.code, 1);
    assert.equal(tired.sleeps.length, 5, 'waited out five times, then stopped');
    platform.busy = null;
  } finally {
    await platform.close();
  }
});

test('an agent\'s words never overwrite the owner\'s: not in the library, not in a field', async () => {
  const platform = await fakePlatform();
  try {
    const { root, own } = site(platform);
    // The owner uploaded the very bytes of the slot, with words; the field has none of its own.
    const ownerKey = platform.uploaded(jpeg('atelier-raum'), 'Die Worte des Inhabers', 'raum.jpg');
    const page = json(root, 'jtk/pages/index.json');
    page.blocks[0].image.alt = '';
    put(root, 'jtk/pages/index.json', page);
    // And the agent says other words for a file the owner described.
    page.blocks[1].images[1].alt = 'Worte des Agenten';
    put(root, 'jtk/pages/index.json', page);
    await run(['push', platform.mint()], { cwd: root, platform });

    const after = json(root, 'jtk/pages/index.json');
    assert.equal(after.blocks[0].image.src, ownerKey, 'the library held the bytes: its key');
    assert.equal(after.blocks[0].image.alt, 'Die Worte des Inhabers', 'an empty field takes the library\'s words');
    assert.equal(platform.library.get(ownerKey).alt, 'Die Worte des Inhabers');
    assert.equal(after.blocks[1].images[1].alt, 'Worte des Agenten', 'a field\'s own words stay');
    assert.equal(platform.library.get(own).alt, 'Vom Inhaber beschrieben', 'and the library keeps the owner\'s');
    const alt = platform.requests.filter((one) => one.route === '/v1/media/alt');
    assert.equal(alt.length, 1, 'the content\'s words for its own keys are offered once');
    const again = await run(['push', platform.mint()], { cwd: root, platform });
    assert.equal(platform.requests.filter((one) => one.route === '/v1/media/alt').length, 1, `and not again:\n${again.text}`);
  } finally {
    await platform.close();
  }
});

test('--dry-run says the plan, sends nothing and writes nothing — with or without a link', async () => {
  const platform = await fakePlatform();
  try {
    const { root } = site(platform);
    const before = snapshot(root);
    const plan = await run(['push', '--dry-run'], { cwd: root, platform });
    assert.equal(plan.code, 0, plan.text);
    assert.match(plan.text, /would send what the library does not hold of 7 files/);
    assert.match(plan.text, /✗ src\/assets\/wink\.gif is a GIF/);
    assert.match(plan.text, /src\/assets\/atelier-raum\.jpg .* 3 places/);
    assert.match(plan.text, /would move \d+ files? of src\/assets to \.jtakeit\/adopted/);
    assert.match(plan.text, /would leave src\/assets\/logo\.png — named by src\/components\/Header\.astro/);
    assert.doesNotMatch(plan.text, /would leave src\/assets\/gallery/, 'the PHOTOS registry is not a use');
    assert.match(plan.text, /nothing was sent or written/);
    await run(['push', platform.mint(), '--dry-run'], { cwd: root, platform });
    assert.deepEqual(snapshot(root), before, 'not a byte written');
    assert.equal(platform.requests.filter((one) => one.method !== 'HOST').length, 0, 'not a request made');
  } finally {
    await platform.close();
  }
});

test('a pull brings the library\'s pictures the content names to an empty checkout, without a token; with a link, the whole library and its index', async () => {
  const platform = await fakePlatform();
  try {
    const { root } = site(platform);
    await run(['push', platform.mint()], { cwd: root, platform });
    const unused = platform.uploaded(jpeg('nobody-uses-me'), 'Rest des Shootings', 'rest.jpg');

    // A fresh checkout: jtk/ and the code, none of the git-ignored copies.
    const fresh = mkdtempSync(join(tmpdir(), 'jtk-media-pull-'));
    for (const path of ['jtk/schema.json', 'jtk/site.json', 'jtk/pages/index.json', 'jtk/pages/index.en.json', 'jtk/entries/blog/erster.json', 'jtk/shared.json']) put(fresh, path, readFileSync(join(root, path)));
    const count = platform.requests.length;
    const pulled = await run(['pull'], { cwd: fresh, platform });
    assert.equal(pulled.code, 0, pulled.text);
    const page = json(fresh, 'jtk/pages/index.json');
    for (const key of [page.blocks[0].image.src, page.blocks[1].images[1].src, page.blocks[2].loop[0].poster]) {
      assert.ok(existsSync(join(fresh, 'src/assets', key)), `${key} is here`);
      assert.deepEqual(readFileSync(join(fresh, 'src/assets', key)), platform.library.get(key).data);
    }
    const body = json(fresh, 'jtk/entries/blog/erster.json').fields.body;
    const bodyKey = /\]\(\.\/(media\/[^)]+)\)/.exec(body)[1];
    assert.ok(existsSync(join(fresh, 'jtk/entries/blog', bodyKey)), 'a body\'s picture is put beside its entry');
    assert.ok(!existsSync(join(fresh, 'src/assets', unused)), 'without a link, only what the content names');
    assert.ok(platform.requests.slice(count).every((one) => one.method === 'HOST' && one.auth === undefined), 'from the public host, no token');
    assert.match(pulled.text, /pictures? of the library here, \d+ downloaded/);
    assert.ok(readFileSync(join(fresh, '.gitignore'), 'utf8').includes('src/assets/media/'));

    const again = await run(['pull'], { cwd: fresh, platform });
    assert.doesNotMatch(again.text, /downloaded/, 'a second pull downloads nothing');

    const linked = await run(['pull', platform.mint()], { cwd: fresh, platform });
    assert.equal(linked.code, 0, linked.text);
    assert.ok(existsSync(join(fresh, 'src/assets', unused)), 'with a link, the files nothing uses too');
    const index = json(fresh, '.jtakeit/media.json').index;
    const listed = index.files.find((one) => one.key === unused);
    assert.equal(listed.alt, 'Rest des Shootings');
    assert.equal(listed.thumbs[1].url, `${platform.host}${unused.replace(/\.jpg$/, '')}.w480.webp`);
  } finally {
    await platform.close();
  }
});

test('a site that does not know its id yet learns it from the library, and every key of an empty library is another site\'s', async () => {
  const platform = await fakePlatform();
  try {
    const { root, foreign } = site(platform, { id: '' });
    platform.library.clear();
    const page = json(root, 'jtk/pages/index.json');
    page.blocks[1].images.splice(1, 1);
    put(root, 'jtk/pages/index.json', page);
    const { text } = await run(['push', platform.mint()], { cwd: root, platform });
    const after = json(root, 'jtk/pages/index.json');
    assert.notEqual(after.blocks[1].images[1].src, foreign, text);
    assert.ok(after.blocks[1].images[1].src.startsWith(`media/${SITE}/`));
    assert.equal(json(root, '.jtakeit/media.json').site, SITE, 'and the next run knows it');
  } finally {
    await platform.close();
  }
});

test('a URL with no token, a refused link and a tree with no jtk/ are said plainly', async () => {
  const platform = await fakePlatform();
  try {
    const { root } = site(platform);
    const cut = await run(['push', `${platform.origin}/v1/media`], { cwd: root, platform });
    assert.match(cut.text, /carries no token/);
    const dead = await run(['push', `${platform.origin}/v1/media#t=nothing`], { cwd: root, platform });
    assert.equal(dead.code, 1);
    assert.match(dead.text, /ask media_link for a new one/);
    assert.doesNotMatch(dead.text, /#t=nothing|nothing</);
    const empty = mkdtempSync(join(tmpdir(), 'jtk-media-none-'));
    const none = await run(['push', '--dry-run'], { cwd: empty, platform });
    assert.match(none.text, /there is no jtk\//);
    assert.ok(statSync(empty).isDirectory());
  } finally {
    await platform.close();
  }
});
