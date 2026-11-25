// The booking page (`jtk create --kind booking-page`, docs/booking-page.md; the
// owner, 24 November 2026): one page from the example's units — hero, services,
// gallery, contact — with the salon kit's diary booking on `/` at #book, one
// person who does every service, the price list on the page, the gloss look and
// the vertical's palette. Laid from the kit's fixture and the package's own
// photographs, so nothing here reaches the platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTES, TOKENS, namedOver, paletteFaults, paletteFor, paletteFromMessage } from '../lib/units/palettes.mjs';
import { AA, contrast, groundOf, isDark, over } from '../template/src/lib/ground.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JTK = join(ROOT, 'bin', 'jtk.mjs');
const KIT = join(ROOT, 'test', 'fixtures', 'kit-salon.json');
const dir = mkdtempSync(join(tmpdir(), 'jtk-booking-page-'));

const create = (slug, ...args) =>
  spawnSync(process.execPath, [JTK, 'create', slug, '--no-git', '--photos', 'default', '--kit', KIT, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, XDG_CACHE_HOME: join(dir, 'cache') } });
const json = (site, path) => JSON.parse(readFileSync(join(dir, site, path), 'utf8'));
const text = (site, path) => readFileSync(join(dir, site, path), 'utf8');

test('--kind booking-page lays one page: four sections, the diary on /, the price list on the page', () => {
  const run = create('studio-probe', '--kind', 'booking-page', '--name', 'Studio Probe', '--vertical', 'tattoo', '--locale', 'de-CH', '--locales', 'en');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /booking page/);

  const home = json('studio-probe', 'jtk/pages/index.json');
  assert.deepEqual(home.blocks.map((one) => one.type), ['hero', 'services_list', 'gallery', 'cta_banner']);
  const hero = home.blocks[0];
  assert.equal(hero.title, 'Studio Probe');
  assert.equal(hero.cta_href, '#book');
  assert.equal(hero.cta_label, 'Termin wählen');
  assert.equal(home.blocks[1].limit, 0);
  assert.equal(home.blocks[1].more_label, undefined);
  assert.equal(home.blocks[3].form, false);
  // The translation holds the same blocks' words, and only words.
  const en = json('studio-probe', 'jtk/pages/index.en.json');
  assert.equal(en.blocks.find((one) => one._key === 'hero0001').cta_label, 'Book a time');
  assert.equal(en.blocks.find((one) => one._key === 'hero0001').cta_href, undefined);

  // The gallery is the business's posts: «Latest posts» in the site's language, the
  // handle beside it, each picture its post — placeholders, plainly so (the owner, 24 November 2026).
  const gallery = home.blocks[2];
  assert.equal(gallery.title, 'Neueste Beiträge');
  assert.equal(gallery.eyebrow, undefined);
  assert.equal(gallery.instagram, 'your_instagram');
  assert.ok(gallery.images.length > 0);
  gallery.images.forEach((one, at) => assert.equal(one.href, `https://www.instagram.com/p/your_post_${at + 1}/`));
  const enGallery = en.blocks.find((one) => one._key === 'gall0001');
  assert.equal(enGallery.title, 'Latest posts');
  assert.equal(enGallery.instagram, undefined, 'the handle is the original\'s');
  assert.ok(enGallery.images.every((one) => one.href === undefined), 'the posts are the original\'s');
  assert.match(text('studio-probe', 'src/content/blocks.ts'), /type: 'gallery',[\s\S]*?`href`[\s\S]*?\{ key: 'instagram', label: 'Instagram handle, without @', kind: 'text', max: 30, client_editable: true, no_tap_target: true, beside: 'title', localized: false \}/);
  assert.ok(json('studio-probe', 'jtk/schema.json').blocks.find((one) => one.type === 'gallery').fields.some((one) => one.key === 'instagram'));
  const section = text('studio-probe', 'src/components/sections/GallerySection.astro');
  assert.match(section, /target="_blank" rel="noopener"/);
  assert.match(section, /W\.post/);
  assert.match(text('studio-probe', 'src/components/site/words.ts'), /post: 'Diesen Beitrag auf Instagram öffnen'/);
  assert.match(text('studio-probe', 'src/components/gallery/Lightbox.astro'), /closest\('a\[href\]'\)/);

  // The price list is on the page; its own page is gone.
  assert.ok(!existsSync(join(dir, 'studio-probe', 'jtk/pages/services.json')));
  assert.ok(!existsSync(join(dir, 'studio-probe', 'jtk/pages/services.en.json')));
  assert.match(text('studio-probe', 'src/content/blocks.ts'), /name: 'services',[\s\S]*?shown_on: \['\/#services-\{slug\}'\]/);

  // The diary books on the page, and one person does every service.
  assert.equal(json('studio-probe', 'jtk/modules/bookings.json').settings.page, '/');
  const person = json('studio-probe', 'jtk/entries/masters/alex-muster.json');
  assert.equal(person.collection, 'masters');
  assert.ok(person.id);
  assert.equal(json('studio-probe', 'jtk/entries/masters/alex-muster.en.json').of, person.id);

  // The navigation is the page's anchors, the button books.
  const header = json('studio-probe', 'jtk/shared.json').blocks.find((one) => one.type === 'header');
  assert.deepEqual(header.nav.map((one) => one.link), ['/#services', '/#gallery', '/#contact']);
  assert.equal(header.cta_link, '/#book');

  // The gloss look, the lacquer field, the vertical's palette.
  const design = json('studio-probe', 'jtk/design.json');
  assert.equal(design.look, 'gloss');
  assert.equal(design.field, 'lacquer');
  assert.deepEqual(design.palette, PALETTES.tattoo);
  assert.deepEqual(paletteFaults(design.palette), []);
  assert.match(text('studio-probe', 'src/components/sections/Hero.astro'), /HeroField/);
  assert.match(text('studio-probe', 'src/components/sections/GallerySection.astro'), /Lightbox/);
  assert.ok(existsSync(join(dir, 'studio-probe', 'src/components/gallery/Lightbox.astro')));

  // No section the page does not keep, and the schema written.
  const sections = text('studio-probe', 'src/components/sections/index.ts');
  for (const gone of ['TeamList', 'Testimonials', 'Questions', 'Values']) assert.ok(!sections.includes(gone), gone);
  assert.ok(existsSync(join(dir, 'studio-probe', 'jtk/schema.json')));
  assert.match(text('studio-probe', 'BRIEF.md'), /The three questions/);
});

test('«Latest posts» is said in the site\'s language, and never counted as the example\'s words', async () => {
  const { LATEST_POSTS, latestPosts } = await import('../lib/units/bookingPage.mjs');
  assert.deepEqual(
    ['en', 'de-CH', 'fr', 'it', 'es', 'pt-BR', 'ru', 'pl', 'uk', 'ja'].map(latestPosts),
    ['Latest posts', 'Neueste Beiträge', 'Derniers posts', 'Ultimi post', 'Últimas publicaciones', 'Últimas publicações', 'Последние посты', 'Najnowsze posty', 'Останні пости', 'Latest posts'],
  );
  const run = create('probe-ru', '--kind', 'booking-page', '--name', 'Probe', '--locale', 'ru');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(json('probe-ru', 'jtk/pages/index.json').blocks.find((one) => one._key === 'gall0001').title, 'Последние посты');
  const { createHash } = await import('node:crypto');
  const prints = JSON.parse(readFileSync(join(ROOT, 'example', 'prints.json'), 'utf8'));
  const printed = new Set([...prints.words.en, ...prints.words.de]);
  for (const words of Object.values(LATEST_POSTS)) assert.ok(!printed.has(createHash('sha256').update(words).digest('hex')), words);
});

test('the builder\'s form: no slug, the directory named by --out, every flag a full site takes', () => {
  const out = join(dir, 'anna-nails');
  const run = spawnSync(process.execPath, [JTK, 'create', '--kind', 'booking-page', '--kit', KIT, '--photos', 'default', '--locale', 'de-CH', '--name', 'Nägel by Anna', '--no-git', '--out', out], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')).name, 'anna-nails');
  // An unknown kind is refused and said as one, with or without --kit.
  const unknown = create('probe-unknown', '--kind', 'booking_page');
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /booking-page/);
  const alone = spawnSync(process.execPath, [JTK, 'create', 'probe-alone', '--no-git', '--kind', 'florist', '--api', 'http://127.0.0.1:9'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(alone.status, 0);
  assert.match(alone.stderr, /neither booking-page nor a booking kit/);
});

test('--kind <anything else> is still a booking kit, and the booking page refuses what is not for it', () => {
  const blog = create('probe-blog', '--kind', 'booking-page', '--blog');
  assert.notEqual(blog.status, 0);
  assert.match(blog.stderr, /add blog/);
  const two = create('probe-two', '--kind', 'booking-page', '--contract', '2');
  assert.notEqual(two.status, 0);
  const site = spawnSync(process.execPath, [JTK, 'create', 'probe-site', '--no-git', '--photos', 'default', '--kind', KIT], { cwd: dir, encoding: 'utf8' });
  assert.equal(site.status, 0, site.stderr);
  assert.ok(existsSync(join(dir, 'probe-site', 'jtk/pages/services.json')), 'a full site keeps its price list page');
  assert.equal(json('probe-site', 'jtk/design.json').look, 'brumy');
});

test('a palette is eight hex colours by name; every vertical has one, and an unknown one is the look\'s', () => {
  // The palette widget's names, in its order (choose_palette).
  assert.deepEqual(TOKENS, ['bg', 'surface', 'ink', 'muted', 'accent', 'accentInk', 'lacquerA', 'lacquerB']);
  const blush = paletteFromMessage('Use the palette "Blush": bg #f7ece9, surface #fffaf8, ink #2a1215, muted #6e4f52, accent #8e1b2c, accentInk #ffffff, lacquerA #b0243a, lacquerB #f2b8c0. (choose_palette: … — set all 8 as the site\'s colour tokens.)');
  assert.deepEqual(Object.keys(blush), TOKENS);
  assert.deepEqual(paletteFaults(blush), []);
  assert.deepEqual(namedOver({ background: '#ffffff', 'lacquer-light': '#000000' }), { bg: '#ffffff', lacquerB: '#000000' });
  for (const [vertical, palette] of Object.entries(PALETTES)) assert.deepEqual(paletteFaults(palette), [], vertical);
  assert.deepEqual(paletteFor('Lash & Brow'.replace(' & ', '-')), PALETTES.lashes);
  assert.deepEqual(paletteFor('florist'), PALETTES.nails);
  assert.deepEqual(paletteFor('brows'), PALETTES.lashes);
  assert.deepEqual(paletteFor('personal trainer'), PALETTES.trainer);
  assert.deepEqual(paletteFor(''), PALETTES.nails);
  assert.ok(paletteFaults({ ...PALETTES.nails, accent: 'red' }).some((one) => one.startsWith('accent:')));
  assert.ok(paletteFaults({ ...PALETTES.nails, extra: '#000000' }).some((one) => one.startsWith('extra:')));
});

test('every palette\'s words read at 4.5:1 — the header\'s glass, the booking card, its chips, the posts\' handle — a dark one too', () => {
  // The owner's dark palette (24 November 2026): the light porcelain header under its light ink read 1.05:1.
  const DARK = { bg: '#1d1312', surface: '#2a1d1b', ink: '#f4e9e5', muted: '#c9b5ae', accent: '#e3a59b', accentInk: '#1d1312', lacquerA: '#4a1219', lacquerB: '#a8434f' };
  const palettes = { ...PALETTES, dark: DARK };
  assert.equal(Object.keys(PALETTES).length, 10);
  for (const [name, palette] of Object.entries(palettes)) {
    const ground = groundOf(palette);
    assert.ok(ground, name);
    assert.equal(ground.dark, isDark(palette.bg), name);
    // The header: its words on its glass, alone and over the worst that can pass behind it.
    for (const on of ground.grounds) {
      assert.ok(contrast(ground.ink, on) >= AA, `${name}: the header's words ${ground.ink} on ${on} read ${contrast(ground.ink, on).toFixed(2)}`);
      assert.ok(contrast(ground.quiet, on) >= AA, `${name}: the header's navigation ${ground.quiet} on ${on} read ${contrast(ground.quiet, on).toFixed(2)}`);
    }
    // The booking card and its chips are the surface under the ink and the muted; a chosen chip and a button are the accent under its words.
    assert.ok(contrast(palette.ink, palette.surface) >= AA, `${name}: ink on the card`);
    assert.ok(contrast(palette.muted, palette.surface) >= AA, `${name}: the quieter words on the card`);
    assert.ok(contrast(palette.accentInk, palette.accent) >= AA, `${name}: the words on the accent`);
    // The posts' handle: the ink on the surface at 72% over the page.
    assert.ok(contrast(palette.ink, over(palette.surface, palette.bg, 0.72)) >= AA, `${name}: the posts' handle`);
  }
  assert.equal(groundOf(DARK).dark, true);
  assert.equal(groundOf(PALETTES.tattoo).dark, true);
  assert.equal(groundOf(PALETTES.nails).dark, false);
  // A palette whose words do not read on its own paper still gets a header that does.
  const muddy = groundOf({ bg: '#777777', ink: '#888888', muted: '#7a7a7a' });
  for (const on of muddy.grounds) assert.ok(contrast(muddy.ink, on) >= AA && contrast(muddy.quiet, on) >= AA, on);
  assert.equal(groundOf({}), null, 'no bg: the look\'s own tokens stand');

  // The build reads it: the page says it is dark, the header draws the palette's glass and words.
  const layout = readFileSync(join(ROOT, 'template/src/layouts/Layout.astro'), 'utf8');
  assert.match(layout, /from '\.\.\/lib\/ground\.mjs'/);
  assert.match(layout, /data-ground=\{ground\?\.dark \? 'dark' : undefined\}/);
  const header = readFileSync(join(ROOT, 'example/looks/gloss/src/components/site/Header.astro'), 'utf8');
  for (const token of ['--bar-glass', '--bar-solid', '--bar-ink', '--bar-ink-quiet']) assert.ok(header.includes(`var(${token}`), token);
});

test('the phone\'s first screen: the photograph first, centred and compact, the name in two lines, the lead in three', () => {
  const hero = readFileSync(join(ROOT, 'example/looks/gloss/src/components/sections/Hero.astro'), 'utf8');
  const phone = hero.slice(hero.indexOf('@media (max-width: 40rem)'));
  // Centred and compact, as the teaser has it: a third of the screen at most (25 November 2026).
  assert.match(phone, /\.hx__stage \{[^}]*order: -1;[^}]*justify-self: center;[^}]*block-size: min\(calc\(var\(--screen\) \* 0\.32\), 17rem\)/);
  assert.match(phone, /\.hx__title \{[^}]*-webkit-line-clamp: 2;/);
  assert.match(phone, /\.hx__lead \{[^}]*-webkit-line-clamp: 3;/);
  assert.match(hero, /!shot\.focus && 'hx__stage--top'/);
});
