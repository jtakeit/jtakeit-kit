// A site `jtk create` lays out draws its draft live (jtakeit-core wiki/89 §12):
//
//   1  the schema says it: `render: "live"`, from RENDER in blocks.ts
//   2  the two-language salon with a blog — the example site, `--kit` and
//      `--blog` mapped onto it as `jtk add booking` and `add blog` — filled: services, a master, three
//      posts, one with a picture in its body, an uploaded photograph on the
//      home page, every one translated — builds static as it always did
//   3  the same tree built for a server (`JTK_RENDER=live`, @astrojs/node in
//      middleware mode) renders every page the static build made, handed its
//      own files as the draft, and each is the built page once the three
//      things a server build is allowed to differ in are set aside — asset
//      names, picture files, the stylesheets' files (rule by rule, every rule
//      of the built page's must be there) — as the platform's check does
//      (backend/api/sitebuild/live.mjs)
//   4  and a draft changed four ways is drawn at once: a hero word, a post
//      no build drew (on the listing and at its address), a sentence in a
//      body, and a photograph uploaded since the build, from the bucket
//   6  the example with each section removed (`jtk remove`), one at a time:
//      judged against its build, and every page drawn live equal to it
//   5  the example site `jtk create` lays out (jtakeit-core wiki/110) — every
//      section, the header, the footer, /services and /imprint — in German
//      and English, every page drawn live equal to its built twin; and a draft
//      that changes a value's words, a service, a person, a gallery's picture
//      and the shared footer is drawn at once
//
// The kit is this checkout's, packed, as the smoke test installs it.
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveCheck } from './live-harness.mjs';

const bin = resolve('bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-live-'));
const site = join(dir, 'site');
const SITE_URL = 'https://salon-live.example/';
const fail = (m) => {
  console.error(`live: ${m}`);
  process.exit(1);
};
const json = (file) => JSON.parse(readFileSync(join(site, file), 'utf8'));
const write = (file, value) => {
  mkdirSync(join(site, file, '..'), { recursive: true });
  writeFileSync(join(site, file), `${JSON.stringify(value, null, 2)}\n`);
};

// ── the comparison the platform makes (backend/api/sitebuild/live.mjs) ──────
const STEPS = [
  ['asset names', (s) => s.replace(/(\/_astro\/[^"'\s)?,]+?)\.[A-Za-z0-9_-]{8}\.(css|js|mjs)\b/g, '$1.$2')],
  ['picture files', (s) => s.replace(/<(img|source)\b[^>]*>/g, (tag) => tag.replace(/\s(src|srcset|sizes)="[^"]*"/g, ''))],
  ['stylesheets', (s) => s.replace(/<link rel="stylesheet" href="[^"]*">/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')],
];
function rulesOf(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      out.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return out;
}
const stylesOf = (html, root) =>
  [...html.matchAll(/<link rel="stylesheet" href="([^"]*)">/g)].map(([, href]) => readFileSync(join(root, href), 'utf8')).join('\n') +
  [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n');
function compare(built, live) {
  let a = built;
  let b = live;
  for (const [, step] of STEPS) {
    if (a === b) break;
    a = step(a);
    b = step(b);
  }
  if (a === b) return null;
  let at = 0;
  while (a[at] === b[at]) at++;
  return `built «${a.slice(Math.max(0, at - 60), at + 100)}» live «${b.slice(Math.max(0, at - 60), at + 100)}»`;
}

let server;
try {
  // ── 1 · laid out, declared ────────────────────────────────────────────────
  execFileSync('node', [bin, 'create', 'salon-live', '--name', 'Salon Live', '--locale', 'de-CH', '--locales', 'en', '--kit', resolve('test/fixtures/kit-salon.json'), '--blog', '--out', site, '--no-git'], { stdio: 'pipe' });
  const packed = execFileSync('npm', ['pack', resolve('kit'), '--pack-destination', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(dir, packed)], { cwd: site, stdio: 'pipe' });
  if (json('jtk/schema.json').render !== 'live') fail(`1 · jtk/schema.json does not say render: "live" — ${JSON.stringify(json('jtk/schema.json').render)}`);
  if (json('package.json').dependencies?.['@astrojs/node'] === undefined) fail('1 · the scaffold does not depend on @astrojs/node');

  // ── 2 · filled, and built static ──────────────────────────────────────────
  const SITE_ID = '5b1c0d2e-7a41-4f3e-9c55-0a1b2c3d4e5f';
  const key = (n) => `media/${SITE_ID}/${(0xa0b0c0d0 + n).toString(16)}${'0'.repeat(24)}.jpg`;
  const sharp = createRequire(join(site, 'package.json'))('sharp');
  const picture = async (n, at) => {
    mkdirSync(join(at, '..'), { recursive: true });
    await sharp({ create: { width: 480, height: 320, channels: 3, background: { r: 40 + n * 20, g: 90, b: 140 } } }).jpeg({ quality: 70 }).toFile(at);
  };
  // What the platform writes, and what its build fetches beside it.
  write('jtk/site.json', { id: SITE_ID, slug: 'salon-live', media_base: 'https://media.example/', currency: 'CHF' });
  await picture(0, join(site, 'src', 'assets', key(0)));
  const home = json('jtk/pages/index.json');
  Object.assign(home.blocks[0], { title: 'Schnitt und Farbe', lead: 'Ein kleiner Salon.', cta_label: 'Termin buchen', image: { src: key(0), alt: 'Der Salon' } });
  write('jtk/pages/index.json', home);
  const homeEn = json('jtk/pages/index.en.json');
  homeEn.blocks = [{ _key: home.blocks[0]._key, title: 'Cut and colour', lead: 'A small salon.', cta_label: 'Book', image: { alt: 'The salon' } }, ...(homeEn.blocks ?? []).filter((one) => one._key !== home.blocks[0]._key)];
  write('jtk/pages/index.en.json', homeEn);
  const services = [['herrenschnitt', 'Herrenschnitt', "Men's cut", 30, 4500], ['faerben', 'Färben', 'Colour', 90, 12000]];
  const ids = {};
  services.forEach(([slug, de, en, takes, minor], i) => {
    ids[slug] = `01a1d043-0000-7000-8000-00000000000${i + 1}`;
    write(`jtk/entries/services/${slug}.json`, { id: ids[slug], collection: 'services', slug, rank: `a${i}`, visible: true, fields: { title: de, takes, costs: { minor } } });
    write(`jtk/entries/services/${slug}.en.json`, { of: ids[slug], locale: 'en', fields: { title: en } });
  });
  write('jtk/entries/masters/anna.json', { id: '01a1d043-0000-7000-8000-000000000010', collection: 'masters', slug: 'anna', rank: 'a0', visible: true, fields: { title: 'Anna Keller', does: Object.values(ids) } });
  const posts = [
    ['pflege', 'care', '2026-10-02', 'Pflege im Winter', 'Care in winter', `Im Winter verliert das Haar Feuchtigkeit.\n\n![Ein Kamm](./${key(1)} "Werkzeug")\n\n## Drei Dinge\n\n- lauwarm waschen\n`, `Hair loses moisture in winter.\n\n![A comb](./${key(1)} "Tools")\n`],
    ['farben', 'colours', '2026-09-15', 'Neue Farben', 'New colours', 'Kupfer und Schokolade.\n', 'Copper and chocolate.\n'],
    ['zehn', 'ten', '2024-05-01', 'Zehn Jahre', 'Ten years', '> Danke.\n', '> Thank you.\n'],
  ];
  for (const [i, [slug, enSlug, date, de, en, bodyDe, bodyEn]] of posts.entries()) {
    const id = `01a1d043-0000-7000-8000-00000000002${i}`;
    write(`jtk/entries/blog/${slug}.json`, { id, collection: 'blog', slug, rank: `a${i}`, visible: true, fields: { title: de, date, excerpt: de, body: bodyDe } });
    write(`jtk/entries/blog/${slug}.en.json`, { of: id, locale: 'en', slug: enSlug, fields: { title: en, excerpt: en, body: bodyEn } });
  }
  // A picture in a body, where the build puts it: beside the entry.
  await picture(1, join(site, 'jtk', 'entries', 'blog', key(1)));

  const env = { ...process.env, SITE_URL, ASTRO_TELEMETRY_DISABLED: '1' };
  let run = spawnSync('npx', ['astro', 'build'], { cwd: site, encoding: 'utf8', env });
  if (run.status !== 0) fail(`2 · the filled site does not build static:\n${run.stdout}\n${run.stderr}`);

  // ── 3 · built for a server, every page drawn from its own files ──────────
  run = spawnSync('npx', ['astro', 'build', '--outDir', '.jtk-live/dist'], { cwd: site, encoding: 'utf8', env: { ...env, JTK_RENDER: 'live' } });
  if (run.status !== 0) fail(`3 · the site does not build for a server:\n${run.stdout}\n${run.stderr}`);
  const { readJtk } = await import(pathToFileURL(join(site, 'node_modules', '@jtakeit', 'kit', 'lib', 'content', 'node.mjs')).href);
  const { handler } = await import(pathToFileURL(join(site, '.jtk-live', 'dist', 'server', 'entry.mjs')).href);
  let draft = await readJtk(site);
  let media = {};
  server = createServer((req, res) => handler(req, res, () => {
    res.writeHead(404);
    res.end();
  }, { jtkDraft: { files: draft, media } }));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = async (path) => {
    const answer = await fetch(base + path);
    return { status: answer.status, text: await answer.text() };
  };

  const dist = join(site, 'dist');
  const pages = [];
  const walk = (at) => {
    for (const one of readdirSync(at, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(at, one.name));
      else if (one.name === 'index.html' && !/\/_fl-/.test(at.split(sep).join('/'))) pages.push(`/${relative(dist, at).split(sep).join('/')}`.replace(/\/?$/, '/'));
    }
  };
  walk(dist);
  if (pages.length < 12) fail(`3 · the static build made only ${pages.length} pages: ${pages.join(' ')}`);
  for (const path of pages) {
    const built = readFileSync(join(dist, path, 'index.html'), 'utf8');
    const live = await page(path);
    if (live.status !== 200) fail(`3 · ${path} answered ${live.status} under the server build:\n${live.text.slice(0, 400)}`);
    const differs = compare(built, live.text);
    if (differs !== null) fail(`3 · ${path} drawn live is not the built page: ${differs}`);
    const lives = new Set(rulesOf(stylesOf(live.text, join(site, '.jtk-live', 'dist', 'client'))));
    const lacks = rulesOf(stylesOf(built, dist)).find((rule) => !lives.has(rule));
    if (lacks !== undefined) fail(`3 · ${path} drawn live lacks a rule of the built page's styles: ${lacks.slice(0, 160)}`);
  }

  // ── 4 · a draft, changed ──────────────────────────────────────────────────
  draft = structuredClone(draft);
  draft['/jtk/pages/index.json'].blocks[0].title = 'Ein Titel aus dem Entwurf';
  let got = await page('/');
  if (!got.text.includes('Ein Titel aus dem Entwurf')) fail('4 · a saved hero word is not on the home page drawn live');
  if (!(await page('/en/')).text.includes('Cut and colour')) fail("4 · the English home lost its own words");

  draft['/jtk/entries/blog/neu.json'] = { id: '01a1d043-0000-7000-8000-000000000099', collection: 'blog', slug: 'neu', rank: 'a9', visible: true, fields: { title: 'Ganz neu', date: '2026-11-12', excerpt: 'Kein Build hat ihn gezeichnet.', body: 'Ein **Satz** von heute.\n' } };
  if (!(await page('/blog/')).text.includes('Ganz neu')) fail('4 · a post no build drew is not on the listing');
  got = await page('/blog/neu/');
  if (got.status !== 200 || !got.text.includes('<strong>Satz</strong>')) fail(`4 · a post no build drew has no page of its own: ${got.status}`);

  draft['/jtk/entries/blog/pflege.json'].fields.body = draft['/jtk/entries/blog/pflege.json'].fields.body.replace('verliert das Haar', 'verliert das Haar schneller');
  got = await page('/blog/pflege/');
  if (!got.text.includes('verliert das Haar schneller')) fail('4 · a changed sentence in a body is not drawn');
  if (!got.text.includes(`src="https://media.example/${key(1)}"`)) fail("4 · the body's picture is not the bucket's, as it is");

  const fresh = `media/${SITE_ID}/ffff${'0'.repeat(28)}.jpg`;
  draft['/jtk/pages/index.json'].blocks[0].image = { src: fresh, alt: 'Frisch hochgeladen' };
  media = { [fresh]: { width: 1200, height: 800 } };
  server.removeAllListeners('request');
  server.on('request', (req, res) => handler(req, res, () => res.end(), { jtkDraft: { files: draft, media } }));
  got = await page('/');
  const img = /<img [^>]*Frisch hochgeladen[^>]*>/.exec(got.text)?.[0] ?? '';
  if (!img.includes(`src="https://media.example/${fresh}"`) || !img.includes('width="1200"')) fail(`4 · a photograph uploaded since the build is not drawn from the bucket: ${img || 'no <img>'}`);

  console.log(`live: ${pages.length} pages drawn live are the built ones; a hero word, a new post, a body's sentence and a new photograph are drawn from the draft`);
  server.close();
  server = undefined;

  // ── 5 · the example, in two languages ─────────────────────────────────────
  {
    const example = join(dir, 'example');
    execFileSync('node', [bin, 'create', 'example-live', '--name', 'Atelier Live', '--locale', 'de-CH', '--locales', 'en', '--out', example, '--no-git'], { stdio: 'pipe' });
    execFileSync('npm', ['install', '--no-audit', '--no-fund', join(dir, packed)], { cwd: example, stdio: 'pipe' });
    const drawn = await liveCheck(example, { url: SITE_URL, fail, said: '5 · the example' });
    if (drawn.pages.length < 8) fail(`5 · the example built only ${drawn.pages.length} pages: ${drawn.pages.join(' ')}`);
    for (const must of ['/', '/en/', '/services/', '/en/services/', '/imprint/', '/en/imprint/']) if (!drawn.pages.includes(must)) fail(`5 · the example has no ${must}`);
    const { draft } = drawn.state;
    const home = draft['/jtk/pages/index.json'];
    home.blocks.find((one) => one.type === 'values').items[0].title = 'Zeit aus dem Entwurf';
    home.blocks.find((one) => one.type === 'gallery').images[0].alt = 'Ein Bild aus dem Entwurf';
    draft['/jtk/entries/services/the-work.json'].fields.title = 'Eine Leistung aus dem Entwurf';
    draft['/jtk/entries/team/maria-muster.json'].fields.title = 'Maria Entwurf';
    draft['/jtk/shared.json'].blocks.find((one) => one.type === 'footer').tagline = 'Eine Zeile aus dem Entwurf';
    const got = (await drawn.page('/')).text;
    for (const words of ['Zeit aus dem Entwurf', 'Ein Bild aus dem Entwurf', 'Eine Leistung aus dem Entwurf', 'Maria Entwurf', 'Eine Zeile aus dem Entwurf']) {
      if (!got.includes(words)) fail(`5 · «${words}», saved in a draft, is not on the example's home page drawn live`);
    }
    if (!(await drawn.page('/services/')).text.includes('Eine Leistung aus dem Entwurf')) fail('5 · a service changed in a draft is not on /services drawn live');
    if (!(await drawn.page('/en/')).text.includes('Good work, done with care.')) fail("5 · the example's English home lost its own words");
    drawn.close();
    console.log(`live: the example — ${drawn.pages.length} pages drawn live are the built ones; a value, a picture's words, a service, a person and the footer are drawn from the draft`);

    // ── 6 · each section removed ──────────────────────────────────────────
    for (const unit of ['hero', 'values', 'services', 'gallery', 'team', 'testimonials', 'questions', 'contact']) {
      let ran = spawnSync('node', [bin, 'remove', unit, '--root', example], { encoding: 'utf8' });
      if (ran.status !== 0) fail(`6 · remove ${unit}:\n${ran.stdout}\n${ran.stderr}`);
      execFileSync('node', [bin, 'schema', '--emit-only', '--root', example], { stdio: 'pipe' });
      const without = await liveCheck(example, { url: SITE_URL, fail, said: `6 · the example without ${unit}` });
      without.close();
      ran = spawnSync('node', [bin, 'schema', '--root', example, '--dist', 'dist'], { encoding: 'utf8' });
      if (ran.status !== 0 || !ran.stdout.includes('the schema and the page agree')) fail(`6 · without ${unit}, jtk schema says:\n${ran.stdout}\n${ran.stderr}`);
      ran = spawnSync('node', [join(example, 'node_modules/@jtakeit/kit/bin/jtkit.mjs'), 'lint', '--dist', 'dist', '--root', '.'], { cwd: example, encoding: 'utf8' });
      if (ran.status !== 0) fail(`6 · without ${unit}, jtkit lint says:\n${ran.stdout}\n${ran.stderr}`);
      ran = spawnSync('node', [bin, 'add', unit, '--root', example], { encoding: 'utf8' });
      if (ran.status !== 0) fail(`6 · add ${unit}:\n${ran.stdout}\n${ran.stderr}`);
      execFileSync('node', [bin, 'schema', '--emit-only', '--root', example], { stdio: 'pipe' });
    }
    console.log('live: the example with each of its eight sections removed — judged, linted, and every page drawn live equal to its build');
  }
} finally {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
}
