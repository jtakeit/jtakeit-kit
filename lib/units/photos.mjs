/**
 * The example's photographs — and the one place that says where a site keeps
 * one and what its content calls it.
 *
 * ── a key of the library, from the first line ───────────────────────────────
 *
 * A picture a field names lives in the site's media library (jtakeit-core
 * wiki/108), so the example names its photographs as keys from the start —
 * of a reserved pseudo-site, `jtk-example` (wiki/110 §2.6):
 *
 *   in the content   { "src": "media/jtk-example/<hash16>.jpg", "alt": "…" }
 *   on this machine  src/assets/media/jtk-example/<hash16>.jpg (git-ignored), which
 *                    `uploads.ts` draws as it draws any key the build downloaded
 *   in a post's body ![…](./media/jtk-example/<hash16>.jpg), the file beside the entry
 *
 * `<hash16>` is the first sixteen hex digits of the file's SHA-256 — the
 * library's own key scheme. `jtk media push` (lib/media.mjs) treats
 * `media/jtk-example/…` as a key of another site: it sends the local file,
 * which the library keeps byte for byte (the example's files carry no
 * metadata and are under 2 400 px), and writes the site's key over it,
 * `media/<site>/<the same hash16>.jpg`. So `example/prints.json` recognises
 * the picture on either side of the move, and `jtk push --media` does the
 * move for the agent before the code goes.
 *
 * A site laid out by 0.17.0 named them by slot (`example-hero`, a file in
 * src/assets): the same push adopts those (wiki/108 §2.4 · 1), and
 * `slotOf` is the name they had.
 *
 * The files are `example/media/` of this package: generated with Higgsfield
 * for Brumy, released with the kit under its licence (example/README.md).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Where the package keeps them. */
export const MEDIA = resolve(HERE, '..', '..', 'example', 'media');

/**
 * Every photograph of the example, by its name: its file in `example/media/`
 * and its words in the two languages the example is written in.
 */
export const PHOTOS = {
  hero: { file: 'hero.jpg', alt: { en: 'A long oak table in morning light, two ceramic cups and a folded linen cloth', de: 'Ein langer Eichentisch im Morgenlicht, zwei Keramikbecher und ein gefaltetes Leinentuch' } },
  'gallery-linen': { file: 'gallery-linen.jpg', alt: { en: 'Folded linen in sand, oat and rust on a plaster shelf', de: 'Gefaltetes Leinen in Sand, Hafer und Rost auf einem Putzregal' } },
  'gallery-light': { file: 'gallery-light.jpg', alt: { en: 'Afternoon sun and the shadow of a window on a white wall, a wooden stool below', de: 'Nachmittagssonne und der Schatten eines Fensters an einer weissen Wand, darunter ein Holzhocker' } },
  'gallery-tools': { file: 'gallery-tools.jpg', alt: { en: 'Scissors, a brush, a brass ruler and twine on a pegboard', de: 'Schere, Pinsel, Messinglineal und Schnur an einer Lochwand' } },
  'gallery-ceramics': { file: 'gallery-ceramics.jpg', alt: { en: 'Hand-thrown cups and bowls on an oak shelf', de: 'Handgedrehte Becher und Schalen auf einem Eichenregal' } },
  'gallery-doorway': { file: 'gallery-doorway.jpg', alt: { en: 'An open door onto a bright room with a bench, a basket and a tree', de: 'Eine offene Tür zu einem hellen Raum mit Bank, Korb und Bäumchen' } },
  'gallery-chair': { file: 'gallery-chair.jpg', alt: { en: 'A bentwood chair with a wool blanket by a linen curtain', de: 'Ein Bugholzstuhl mit Wolldecke vor einem Leinenvorhang' } },
  'gallery-grain': { file: 'gallery-grain.jpg', alt: { en: 'Oak grain, a sharpened pencil and a few shavings in raking light', de: 'Eichenmaserung, ein gespitzter Bleistift und ein paar Späne im Streiflicht' } },
  'gallery-sideboard': { file: 'gallery-sideboard.jpg', alt: { en: 'Dried branches in a stoneware vase on an oak sideboard at dusk', de: 'Trockene Zweige in einer Steinzeugvase auf einem Eichensideboard am Abend' } },
  'service-conversation': { file: 'service-conversation.jpg', alt: { en: 'Two people talking over coffee at a round table, an open notebook between them', de: 'Zwei Menschen im Gespräch bei Kaffee an einem runden Tisch, ein offenes Notizbuch zwischen ihnen' } },
  'service-work': { file: 'service-work.jpg', alt: { en: 'Hands sanding the edge of an oak board', de: 'Hände schleifen die Kante eines Eichenbretts' } },
  'service-finish': { file: 'service-finish.jpg', alt: { en: 'Hands tying a parcel in kraft paper with cotton string', de: 'Hände binden ein Päckchen in Packpapier mit Baumwollschnur' } },
  'service-objects': { file: 'service-objects.jpg', alt: { en: 'A stoneware bowl, a wooden spoon and a rust ribbon on linen', de: 'Eine Steinzeugschale, ein Holzlöffel und ein rostrotes Band auf Leinen' } },
  'service-counter': { file: 'service-counter.jpg', alt: { en: 'A tidy work counter with a jug, a tray of tools and a linen towel', de: 'Eine aufgeräumte Werkbank mit Krug, Werkzeugschale und Leinentuch' } },
  'team-window': { file: 'team-window.jpg', alt: { en: 'A person in a linen shirt at a tall window, seen from behind', de: 'Eine Person im Leinenhemd an einem hohen Fenster, von hinten' } },
  'team-apron': { file: 'team-apron.jpg', alt: { en: 'Hands holding a ceramic mug in front of a linen apron', de: 'Hände halten einen Keramikbecher vor einer Leinenschürze' } },
  'team-silhouette': { file: 'team-silhouette.jpg', alt: { en: 'A silhouette against a sunlit linen curtain', de: 'Eine Silhouette vor einem sonnigen Leinenvorhang' } },
  'journal-measure': { file: 'journal-measure.jpg', alt: { en: 'Hands measuring handmade paper with a brass ruler and a pencil', de: 'Hände messen Büttenpapier mit Messinglineal und Bleistift' } },
  'journal-morning': { file: 'journal-morning.jpg', alt: { en: 'Coffee and two cups on a sunny windowsill', de: 'Kaffee und zwei Tassen auf einem sonnigen Fensterbrett' } },
  'journal-autumn': { file: 'journal-autumn.jpg', alt: { en: 'Dried grasses, autumn leaves, linen and scissors on an oak table', de: 'Trockengräser, Herbstlaub, Leinen und eine Schere auf einem Eichentisch' } },
};

/** The first sixteen hex digits of a photograph's SHA-256: the library's key scheme (wiki/108 §2). */
const hashes = new Map();
export function hashOf(name) {
  if (!hashes.has(name)) hashes.set(name, createHash('sha256').update(readFileSync(join(MEDIA, PHOTOS[name].file))).digest('hex').slice(0, 16));
  return hashes.get(name);
}

/**
 * Where a site keeps a photograph of the example, and what its content names
 * it by: a key of the `jtk-example` pseudo-site and the file the dev server
 * draws it from.
 *
 * @param {string} name
 * @returns {{ value: string; file: string }}
 */
export function placeOf(name) {
  if (!(name in PHOTOS)) throw new Error(`the example has no photograph «${name}»`);
  const key = `media/jtk-example/${hashOf(name)}.jpg`;
  return { value: key, file: `src/assets/${key}` };
}

/** The slot a site laid out by 0.17.0 named the photograph by (`example-hero`). */
export const slotOf = (name) => `example-${name}`;

/**
 * A photograph as a picture in an entry's markdown body: the key, beside
 * the entry's own file — where Astro resolves it and where the build puts a
 * downloaded one (`bodyFileOf` is the file).
 */
export function bodyPath(name) {
  return `./${placeOf(name).value}`;
}

/** Where a body's photograph is kept for an entry of a collection: `jtk/entries/<collection>/media/jtk-example/<hash16>.jpg`. */
export function bodyFileOf(name, collection) {
  return `jtk/entries/${collection}/${placeOf(name).value}`;
}

/** The example's photographs a markdown body names, by their names. */
export function photosInBody(markdown) {
  const out = [];
  for (const name of Object.keys(PHOTOS)) if (typeof markdown === 'string' && markdown.includes(bodyPath(name))) out.push(name);
  return out;
}

/** A photograph as a media value, in a language: `{ src, alt }`, and whatever else the field holds (`_key`, `focus`). */
export function picture(name, lang, more = {}) {
  return { ...more, src: placeOf(name).value, alt: PHOTOS[name].alt[lang] ?? PHOTOS[name].alt.en };
}

/** The files a unit's photographs are: `[{ from, to }]`, `to` from the site's root. */
export function filesOf(names) {
  return names.map((name) => ({ from: join(MEDIA, PHOTOS[name].file), to: placeOf(name).file, name }));
}

/** Whether a media value names one of the example's photographs — by its key or its old slot — and which. */
export function exampleOf(value) {
  for (const name of Object.keys(PHOTOS)) if (placeOf(name).value === value || slotOf(name) === value) return name;
  return undefined;
}
