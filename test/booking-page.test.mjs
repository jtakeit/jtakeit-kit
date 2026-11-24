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
