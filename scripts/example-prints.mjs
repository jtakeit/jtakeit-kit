#!/usr/bin/env node
/**
 * `example/prints.json` — the fingerprints of the example site's words and
 * photographs, for the platform's advice that a site still shows them
 * (`JTK_W_EXAMPLE_LEFT`, jtakeit-core wiki/110 §4), and for any tool that asks
 * the same question of a working copy.
 *
 *   node scripts/example-prints.mjs           write example/prints.json
 *   node scripts/example-prints.mjs --check   exit 1 where it is not what it would write
 *
 * A string is printed as the SHA-256, lowercase hex, of its text after:
 * Unicode NFC; every run of whitespace — spaces, tabs, line breaks — made one
 * space; both ends trimmed; letter case kept. A text of several lines is
 * printed whole and line by line, and a markdown body per paragraph too.
 *
 * What is printed: every sentence and every name the example writes, in each
 * language it is written in (en, de), from every unit — the home page's
 * blocks, the pages, the entries, the shared text. What is not: a single word
 * («Team», «Questions»), the navigation's labels, links — words an owner may
 * rightly keep — and anything that says the business's own name, which is
 * the site's from its first commit.
 *
 * A photograph is printed by the SHA-256 of its file and the first sixteen hex
 * digits of it, the media library's key scheme (wiki/108 §2): `hash16`, so
 * `media/<site>/<hash16>.jpg` is the same picture adopted into a site's
 * library, and `slot`, what a site names it by until then.
 *
 * Append-only: a release adds its strings and removes none, because a site
 * laid out by an older example keeps its words.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORDER } from '../lib/units/index.mjs';
import { SITE, wordsIn } from '../lib/units/units.mjs';
import { PHOTOS, MEDIA, slotOf } from '../lib/units/photos.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'example', 'prints.json');
const NAME = 'NAME';
const sha = (text) => createHash('sha256').update(text).digest('hex');
export const normalise = (text) => text.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Every string a value holds, with the field it is under. */
function strings(value, key = '', out = []) {
  if (typeof value === 'string') out.push([key, value]);
  else if (Array.isArray(value)) value.forEach((one) => strings(one, key, out));
  else if (value !== null && typeof value === 'object') for (const [k, one] of Object.entries(value)) strings(one, k, out);
  return out;
}

const SKIP = new Set(['_key', 'type', 'src', 'link', 'cta_link', 'cta_href', 'more_href', 'maps', 'url', 'path', 'slug', 'collection', 'rank', 'day', 'country', 'postal_code', 'arrangement']);

const words = { en: new Set(), de: new Set() };
for (const lang of ['en', 'de']) {
  const x = wordsIn(lang, NAME);
  const values = [];
  for (const unit of ORDER) {
    for (const make of unit.home ?? []) values.push(make(x));
    for (const make of Object.values(unit.pages ?? {})) values.push(make(x));
    if (unit.entries) values.push(...unit.entries(x).map((one) => one.fields));
    if (unit.examples) values.push(...unit.examples(x));
  }
  values.push(...SITE.shared(x), SITE.index(x), ...Object.values(SITE.pages).map((make) => make(x)));
  for (const [key, text] of values.flatMap((one) => strings(one))) {
    if (SKIP.has(key) || text.includes(NAME)) continue;
    const pieces = [text, ...text.split(/\n+/), ...text.split(/\n\s*\n/)].map(normalise).filter(Boolean);
    for (const piece of new Set(pieces)) {
      if (!/\s/.test(piece) && !/@/.test(piece)) continue; // a single word is anybody's
      if (/^!\[|^#+ /.test(piece)) continue; // a picture or a heading's marks alone
      words[lang].add(sha(piece));
    }
  }
}

const photos = Object.entries(PHOTOS).map(([name, one]) => {
  const digest = sha(readFileSync(join(MEDIA, one.file)));
  return { name, slot: slotOf(name), sha256: digest, hash16: digest.slice(0, 16), key: `media/jtk-example/${digest.slice(0, 16)}.jpg` };
});

// Append-only: what an earlier release printed stays.
const was = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const merged = (lang) => [...new Set([...(was.words?.[lang] ?? []), ...words[lang]])].sort();
const byHash = new Map((was.photos ?? []).map((one) => [one.sha256, one]));
for (const one of photos) byHash.set(one.sha256, one);

const table = {
  v: 1,
  about: 'The example site\'s fingerprints (@jtakeit/astro, jtakeit-core wiki/110 §4): words still the example\'s, photographs still the example\'s. Advice, never a refusal.',
  hash: 'sha256, lowercase hex, of the text after Unicode NFC, every run of whitespace made one space, both ends trimmed, case kept; a text of several lines also line by line, a markdown body also paragraph by paragraph',
  photo: 'sha256 of the file\'s bytes; hash16 its first 16 hex digits, the media library\'s key scheme (media/<site>/<hash16>.<ext>)',
  words: { en: merged('en'), de: merged('de') },
  photos: [...byHash.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
};
const text = `${JSON.stringify(table, null, 1)}\n`;
if (process.argv.includes('--check')) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) {
    console.error('example/prints.json is not what node scripts/example-prints.mjs writes — run it');
    process.exit(1);
  }
  console.log(`example/prints.json — ${table.words.en.length + table.words.de.length} words, ${table.photos.length} photographs, as written`);
} else {
  writeFileSync(OUT, text);
  console.log(`example/prints.json — ${table.words.en.length} English and ${table.words.de.length} German words, ${table.photos.length} photographs`);
}
