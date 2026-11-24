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
 *
 * ── a set per trade (jtakeit-core wiki/117 §2.3) ─────────────────────────────
 *
 * A barber, a clinic and a law firm do not start from the same chair by the
 * window: `photoSets.json` holds a set of the same seventeen names (the hero,
 * the gallery, the services, the team — the journal's stay the package's) per
 * trade, each with its hash, its size and its words. The files are not in the
 * package: they are at `<media base>media/<site>/<hash16>.jpg` of a reserved
 * pseudo-site on the platform's media host, fetched once into a cache
 * (`fetchSet`) and checked against their hash. `useSet` makes a set the one
 * every function below answers for; a site says its set in `jtk/design.json`
 * (`photo_set`, beside the look), so `jtk add` lays a section's photographs from the same set as
 * `jtk create` did. The keys stay the `jtk-example` pseudo-site's, so pushing,
 * homing and the fingerprints see a set's photographs as the example's.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
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

// ── the sets ────────────────────────────────────────────────────────────────

/** The sets, by trade: `{ site, sets: { <set>: { <name>: { hash16, sha256, width, height, alt } } } }` (`JTK_PHOTO_SETS` names another file — the kit's tests). */
export const PHOTO_SETS = JSON.parse(readFileSync(process.env.JTK_PHOTO_SETS || join(HERE, 'photoSets.json'), 'utf8'));
/** The sets' names, and `default` — the package's own. */
export const SETS = ['default', ...Object.keys(PHOTO_SETS.sets)];
/**
 * Where the platform keeps them, on the environment the site is on:
 * `JTK_MEDIA_URL` (the builder says the site's), then the site's own
 * `jtk/site.json` (`media_base`, which the platform writes), then the media
 * host beside the API the command was given (`--api` or `JTK_API_URL`:
 * api.stg.jtakeit.com's is media.stg.jtakeit.com), then production's. A
 * create on staging fetched production's, where a set is not until the
 * release, and laid the package's own instead (20 November 2026).
 */
export const PRODUCTION_MEDIA = 'https://media.jtakeit.com/';
export function mediaBase({ root, api } = {}) {
  const slash = (one) => (one.endsWith('/') ? one : `${one}/`);
  if (process.env.JTK_MEDIA_URL) return slash(process.env.JTK_MEDIA_URL);
  if (root) {
    try {
      const said = JSON.parse(readFileSync(join(root, 'jtk', 'site.json'), 'utf8'))?.media_base;
      if (typeof said === 'string' && /^https?:\/\//.test(said)) return slash(said);
    } catch {
      // no site file, or not JSON: the API's, or production's
    }
  }
  const from = api || process.env.JTK_API_URL;
  if (from) {
    try {
      const url = new URL(from);
      if (url.hostname.startsWith('api.')) return `${url.protocol}//media.${url.hostname.slice(4)}/`;
    } catch {
      // not a URL: production's
    }
  }
  return PRODUCTION_MEDIA;
}

/**
 * The set a trade starts from (wiki/117): the vertical first, where it names
 * one, then the booking kit's kind; `default` — the package's own — otherwise.
 */
const BY_VERTICAL = {
  nails: 'nails', nail: 'nails', manicure: 'nails',
  hair: 'hair', hairdresser: 'hair', salon: 'hair',
  barber: 'barber', barbershop: 'barber',
  clinic: 'clinic', dental: 'clinic', dentist: 'clinic', medical: 'clinic', practice: 'clinic',
  law: 'lawyers', lawyer: 'lawyers', lawyers: 'lawyers', legal: 'lawyers', notary: 'lawyers',
  sport: 'sport', gym: 'sport', fitness: 'sport', training: 'sport', crossfit: 'sport',
  yoga: 'sessions', pilates: 'sessions', studio: 'sessions', sessions: 'sessions',
  // The booking page's verticals (docs/booking-page.md) — the nearest set until a trade has its own.
  pedicure: 'nails', lash: 'nails', lashes: 'nails', brow: 'nails', brows: 'nails', 'lashes-brows': 'nails',
  cosmetology: 'nails', cosmetologist: 'nails', beauty: 'nails',
  colourist: 'hair', colorist: 'hair', stylist: 'hair',
  tattoo: 'barber', tattooist: 'barber',
  massage: 'sessions', masseur: 'sessions', spa: 'sessions', coach: 'sessions', coaching: 'sessions',
  therapist: 'sessions', therapy: 'sessions', psychologist: 'sessions',
  trainer: 'sport', 'personal-trainer': 'sport',
};
const BY_KIND = { sessions: 'sessions', clinic: 'clinic', salon: 'hair' };
export function setFor({ vertical = '', kind = '' } = {}) {
  const said = String(vertical).trim().toLowerCase();
  if (PHOTO_SETS.sets[said]) return said;
  if (BY_VERTICAL[said] && PHOTO_SETS.sets[BY_VERTICAL[said]]) return BY_VERTICAL[said];
  const by = BY_KIND[String(kind).trim().toLowerCase()];
  return by && PHOTO_SETS.sets[by] ? by : 'default';
}

/** Where fetched files are kept on this machine. */
export function cacheDir() {
  const root = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(root, 'jtakeit', 'examples');
}

/** Whether a file's bytes are the ones its hash16 names. */
const holds = (file, hash16) => existsSync(file) && createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16) === hash16;

/** Where a set's photograph is on this machine — `JTK_EXAMPLES_DIR`, then the cache — or undefined. */
function localFile(hash16) {
  for (const dir of [process.env.JTK_EXAMPLES_DIR, cacheDir()]) {
    if (!dir) continue;
    const file = join(dir, `${hash16}.jpg`);
    if (holds(file, hash16)) return file;
  }
  return undefined;
}

/**
 * Every photograph of a set on this machine, fetched from the media host
 * where one is not: `{ ok, missing }`, `missing` the names it could not have
 * (offline, not there, not the bytes their hash names). Nothing is thrown.
 */
export async function fetchSet(set, where = {}) {
  if (set === 'default') return { ok: true, missing: [] };
  const photos = PHOTO_SETS.sets[set];
  if (!photos) return { ok: false, missing: [`«${set}» is no set — ${SETS.join(', ')}`] };
  const missing = [];
  for (const [name, one] of Object.entries(photos)) {
    if (localFile(one.hash16)) continue;
    const url = `${mediaBase(where)}media/${PHOTO_SETS.site}/${one.hash16}.jpg`;
    try {
      const answer = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!answer.ok) throw new Error(`${answer.status}`);
      const bytes = Buffer.from(await answer.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex').slice(0, 16) !== one.hash16) throw new Error('not the bytes its name says');
      mkdirSync(cacheDir(), { recursive: true });
      const file = join(cacheDir(), `${one.hash16}.jpg`);
      writeFileSync(`${file}.part`, bytes);
      renameSync(`${file}.part`, file);
    } catch (why) {
      missing.push(`${name} (${url}: ${why.message})`);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** The set every function here answers for: `default` until `useSet` says another. */
let current = 'default';
export const currentSet = () => current;

/**
 * Make a set the one the example's photographs are taken from — only when
 * every one of its files is on this machine (`fetchSet` first); else the
 * package's own stay, and false is answered. `{ files: false }` takes it for
 * its keys and words alone — what `jtk remove` compares a site's values with,
 * which needs no file.
 */
export function useSet(set, { files = true } = {}) {
  if (!set || set === 'default' || !PHOTO_SETS.sets[set]) {
    current = 'default';
    return !set || set === 'default';
  }
  if (files && Object.values(PHOTO_SETS.sets[set]).some((one) => localFile(one.hash16) === undefined)) {
    current = 'default';
    return false;
  }
  current = set;
  return true;
}

/** The set a site was laid out with, as its `jtk/design.json` says (`photo_set`); `default` where it says none. */
export function photosOf(tree) {
  let said;
  try {
    said = tree.json('jtk/design.json')?.photo_set;
  } catch {
    said = undefined;
  }
  return typeof said === 'string' && PHOTO_SETS.sets[said] ? said : 'default';
}

/** A photograph of the current set, where the set has it: its record. */
const inSet = (name) => (current === 'default' ? undefined : PHOTO_SETS.sets[current]?.[name]);

/** The first sixteen hex digits of a photograph's SHA-256: the library's key scheme (wiki/108 §2). */
const hashes = new Map();
export function hashOf(name) {
  const own = inSet(name);
  if (own) return own.hash16;
  if (!hashes.has(name)) hashes.set(name, createHash('sha256').update(readFileSync(join(MEDIA, PHOTOS[name].file))).digest('hex').slice(0, 16));
  return hashes.get(name);
}

/** The file a photograph's bytes are on this machine: the set's, fetched, or the package's. */
function fileFor(name) {
  const own = inSet(name);
  return own ? localFile(own.hash16) : join(MEDIA, PHOTOS[name].file);
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
  const words = inSet(name)?.alt ?? PHOTOS[name].alt;
  return { ...more, src: placeOf(name).value, alt: words[lang] ?? words.en };
}

/** The files a unit's photographs are: `[{ from, to }]`, `to` from the site's root. */
export function filesOf(names) {
  return names.map((name) => ({ from: fileFor(name), to: placeOf(name).file, name }));
}

/** Every key of the example's photographs, the package's and every set's, to its name. */
let everyKey;
function keysOfEvery() {
  if (everyKey) return everyKey;
  everyKey = new Map();
  for (const name of Object.keys(PHOTOS)) {
    const own = createHash('sha256').update(readFileSync(join(MEDIA, PHOTOS[name].file))).digest('hex').slice(0, 16);
    everyKey.set(`media/jtk-example/${own}.jpg`, name);
  }
  for (const photos of Object.values(PHOTO_SETS.sets)) {
    for (const [name, one] of Object.entries(photos)) everyKey.set(`media/jtk-example/${one.hash16}.jpg`, name);
  }
  return everyKey;
}

/** Whether a media value names one of the example's photographs — of any set, by its key, or its old slot — and which. */
export function exampleOf(value) {
  const known = keysOfEvery().get(value);
  if (known) return known;
  for (const name of Object.keys(PHOTOS)) if (placeOf(name).value === value || slotOf(name) === value) return name;
  return undefined;
}
