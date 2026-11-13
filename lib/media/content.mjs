/**
 * Every picture the site's content names, where it names it, and what it is —
 * the half of `jtk media push` and `jtk media pull` that reads `jtk/`
 * (jtakeit-core wiki/108 §2.4 · 1).
 *
 * ── where a picture can be named ────────────────────────────────────────────
 *
 * Contract 3 (wiki/98 §3.4): a picture is an object, `{ src, alt?, focus?,
 * poster? }`, a gallery's picture the same with its `_key` — in a page's
 * blocks and rows, an entry's `fields`, the shared text, a module's settings,
 * a page's SEO, at any depth. A picture in an entry's markdown body is
 * `![words](path)`, resolved relative to the entry's own file. So the walk
 * here is by shape, not by the schema: every object of that shape is a
 * picture wherever it sits, which is how the platform's build finds keys
 * too (`fetch-media.mjs`).
 *
 * Contract 2 (deprecated): a media field's value is a bare string, its
 * words beside it in `<key>_alt`; which fields are media is the catalogue's
 * to say. A gallery is a list of `{ src, alt }` as in contract 3.
 *
 * ── what a value is ─────────────────────────────────────────────────────────
 *
 *   media/<this site>/<hash>.<ext>   a key of this site's library — nothing to do
 *   media/<other>/<hash>.<ext>       a key of another site, or of the example
 *                                    (`media/jtk-example/…`) — pushed as a file
 *   https://…                        an address — left, and said (wiki/108 B9)
 *   anything else                    a slot (`atelier-raum` → src/assets/atelier-raum.jpg)
 *                                    or, in a body, a path relative to the entry
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';

/** The keys a contract-3 picture holds; an object with others is not one. */
const PICTURE_KEYS = new Set(['_key', 'src', 'alt', 'focus', 'poster']);

/** The extensions a slot may have, in the order `photos.ts` and the clip lookup try them. */
export const PICTURE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'];
export const CLIP_EXTS = ['.mp4', '.webm'];
export const MEDIA_EXTS = new Set([...PICTURE_EXTS, ...CLIP_EXTS]);
/** What a slot may also name that the library does not take — found, so the push can say why. */
const REFUSED_EXTS = ['.gif', '.mov', '.heic', '.heif', '.tif', '.tiff', '.bmp'];

/** A picture in markdown: `![words](path "title")`. */
const BODY_PICTURE = /!\[([^\]]*)\]\(\s*([^)\s]+)(\s+"[^"]*")?\s*\)/g;

/** A translation's file: `prices.en.json`, `vase.de-CH.json`. */
const TRANSLATION = /\.[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?\.json$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const posix = (path) => path.split(sep).join('/');

/**
 * Which contract the tree is on: 3 where `jtk/schema.json` says so, 2 where
 * there is a `jtk/catalogue.json` or a `jtk/content/`, 0 where neither.
 * @param {string} root
 */
export function contractOf(root) {
  const schema = readJson(join(root, 'jtk', 'schema.json'));
  if (schema?.contract === 3) return 3;
  if (existsSync(join(root, 'jtk', 'catalogue.json')) || existsSync(join(root, 'jtk', 'content'))) return 2;
  return existsSync(join(root, 'jtk', 'pages')) ? 3 : 0;
}

/** @param {string} file */
export function readJson(file) {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Every file under a directory, relative to `root`, skipping the `media/` a build downloads beside entries. */
function filesUnder(root, dir) {
  const out = [];
  const walk = (at) => {
    const full = join(root, at);
    if (!existsSync(full)) return;
    for (const one of readdirSync(full, { withFileTypes: true })) {
      const path = at === '' ? one.name : `${at}/${one.name}`;
      if (one.isDirectory()) {
        if (one.name !== 'media' && one.name !== 'node_modules') walk(path);
      } else out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * The content documents, each with its text as it was read (to write back in
 * the same indentation) and whether it is a translation (whose words are in
 * another language, so never a file's words).
 *
 * @param {string} root
 * @param {number} contract
 * @returns {{ file: string, doc: any, text: string, translation: boolean, entry: boolean }[]}
 */
export function readDocs(root, contract) {
  const names =
    contract === 2
      ? [...filesUnder(root, 'jtk/content'), ...['jtk/shared.json', 'jtk/bookings.json'].filter((one) => existsSync(join(root, one)))]
      : [
          ...filesUnder(root, 'jtk/pages'),
          ...filesUnder(root, 'jtk/entries'),
          ...filesUnder(root, 'jtk/modules'),
          ...readdirSync(join(root, 'jtk')).filter((one) => /^shared(\.[A-Za-z0-9-]+)?\.json$/.test(one)).map((one) => `jtk/${one}`),
        ];
  const docs = [];
  for (const file of names) {
    if (!file.endsWith('.json')) continue;
    const text = readFileSync(join(root, file), 'utf8');
    let doc;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new Error(`${file} is not JSON — fix it first; nothing was sent`);
    }
    if (!isObject(doc)) continue;
    const translation = typeof doc.of === 'string' || (contract === 3 && TRANSLATION.test(file)) || (contract === 2 && /^jtk\/content\/[a-z]{2}(-[A-Za-z]{2})?\//.test(file));
    const entry = contract === 3 ? file.startsWith('jtk/entries/') : typeof doc.collection === 'string' && doc.collection !== '';
    docs.push({ file, doc, text, translation, entry });
  }
  return docs;
}

/** The catalogue's media fields by block type, for contract 2's bare strings. */
function mediaFieldsOf(root) {
  const catalogue = readJson(join(root, 'jtk', 'catalogue.json'));
  /** @type {Map<string, Set<string>>} */
  const out = new Map();
  for (const block of catalogue?.blocks ?? catalogue?.block_types ?? []) {
    if (!isObject(block) || typeof block.type !== 'string') continue;
    const keys = new Set((block.fields ?? []).filter((one) => one?.kind === 'media').map((one) => one.key));
    if (keys.size) out.set(block.type, keys);
  }
  return out;
}

/**
 * @typedef {{
 *   file: string,
 *   translation: boolean,
 *   kind: 'picture' | 'poster' | 'string' | 'body',
 *   holder: any,
 *   prop: string,
 *   value: string,
 *   alt: string,
 *   where: string,
 *   of?: Use,
 * }} Use
 */

/**
 * Every place the documents name a picture.
 * @param {string} root
 * @param {ReturnType<typeof readDocs>} docs
 * @param {number} contract
 * @returns {Use[]}
 */
export function usesIn(root, docs, contract) {
  /** @type {Use[]} */
  const uses = [];
  const typed = contract === 2 ? mediaFieldsOf(root) : new Map();

  for (const { file, doc, translation, entry } of docs) {
    const walk = (value, where) => {
      if (Array.isArray(value)) {
        value.forEach((one, i) => walk(one, `${where}[${isObject(one) && typeof one._key === 'string' ? one._key : i}]`));
        return;
      }
      if (!isObject(value)) return;
      if (typeof value.src === 'string' && Object.keys(value).every((key) => PICTURE_KEYS.has(key))) {
        const alt = typeof value.alt === 'string' ? value.alt : '';
        const picture = { file, translation, kind: 'picture', holder: value, prop: 'src', value: value.src, alt, where: `${where}.src` };
        if (value.src.trim() !== '') uses.push(picture);
        if (typeof value.poster === 'string' && value.poster.trim() !== '') {
          uses.push({ file, translation, kind: 'poster', holder: value, prop: 'poster', value: value.poster, alt: '', where: `${where}.poster`, of: picture });
        }
        return;
      }
      const media = typeof value.type === 'string' ? typed.get(value.type) : undefined;
      for (const [key, one] of Object.entries(value)) {
        const at = where === '' ? key : `${where}.${key}`;
        if (key === 'body' && typeof one === 'string' && entry) {
          for (const found of one.matchAll(BODY_PICTURE)) {
            uses.push({ file, translation, kind: 'body', holder: value, prop: 'body', value: found[2], alt: found[1], where: at });
          }
          continue;
        }
        if (media?.has(key) && typeof one === 'string' && one.trim() !== '') {
          const alt = typeof value[`${key}_alt`] === 'string' ? value[`${key}_alt`] : '';
          uses.push({ file, translation, kind: 'string', holder: value, prop: key, value: one, alt, where: at });
          continue;
        }
        walk(one, at);
      }
    };
    walk(doc, '');
  }
  return uses;
}

/**
 * A media key, taken apart: `media/<site>/<file>`. A body names one as
 * `./media/…`.
 * @param {string} value
 */
export function keyOf(value) {
  const m = /^(?:\.\/)?media\/([^/\s]+)\/([^/\s]+\.[A-Za-z0-9]{2,5})$/.exec(value.trim());
  return m ? { key: `media/${m[1]}/${m[2]}`, site: m[1], name: m[2] } : undefined;
}

/** The files under src/assets a slot may name, by slot (lower case, no extension); `media/` is the library's. */
export function slotIndex(root) {
  /** @type {Map<string, string>} */
  const out = new Map();
  const assets = join(root, 'src', 'assets');
  const order = [...PICTURE_EXTS, ...CLIP_EXTS, ...REFUSED_EXTS];
  const found = filesUnder(root, 'src/assets')
    .filter((one) => !one.startsWith('src/assets/media/') && order.includes(extname(one).toLowerCase()))
    .sort((a, b) => order.indexOf(extname(a).toLowerCase()) - order.indexOf(extname(b).toLowerCase()) || (a < b ? -1 : 1));
  for (const path of found) {
    const slot = posix(relative(assets, join(root, path))).replace(/\.[^./]+$/, '').toLowerCase();
    // First wins, as in photos.ts: hero.jpg and hero.webp are not two slots.
    if (!out.has(slot)) out.set(slot, path);
  }
  return out;
}

/**
 * What a value names, as the push sees it.
 *
 * @param {Use} use
 * @param {{ root: string, site?: string, slots: Map<string, string> }} context
 * @returns {{ type: 'own', key: string } | { type: 'foreign', key: string, site: string, name: string } | { type: 'file', path: string } | { type: 'address' } | { type: 'missing', why: string }}
 */
export function classify(use, { root, site, slots }) {
  const value = use.value.trim();
  if (/^(https?:)?\/\//i.test(value) || /^data:/i.test(value)) return { type: 'address' };
  const key = keyOf(value);
  if (key) {
    if (site !== undefined && key.site === site) return { type: 'own', key: key.key };
    return { type: 'foreign', key: key.key, site: key.site, name: key.name };
  }
  if (use.kind === 'body') {
    const path = resolve(dirname(join(root, use.file)), value.replace(/^<|>$/g, ''));
    if (!inside(root, path)) return { type: 'missing', why: 'is outside the site' };
    if (existsSync(path) && statSync(path).isFile()) return { type: 'file', path: posix(relative(root, path)) };
    return { type: 'missing', why: 'is not a file here' };
  }
  const slot = value.replace(/^\/+/, '');
  const bySlot = slots.get(slot.toLowerCase());
  if (bySlot) return { type: 'file', path: bySlot };
  // A value with its extension: a file in src/assets, in the site, or in public/.
  if (MEDIA_EXTS.has(extname(slot).toLowerCase())) {
    for (const at of [join('src', 'assets', slot), slot, join('public', slot)]) {
      const path = resolve(root, at);
      if (inside(root, path) && existsSync(path) && statSync(path).isFile()) return { type: 'file', path: posix(relative(root, path)) };
    }
  }
  return { type: 'missing', why: `names no file in src/assets (${slot}.jpg, .png, .webp…)` };
}

/** @param {string} root @param {string} path */
function inside(root, path) {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel);
}

/**
 * The words `src/lib/photos.ts` registers for each slot (`PHOTOS`), which the
 * push gives a picture where the field and the library have none (wiki/108
 * §4.3, §12). Read as text: the registry is a literal list of
 * `{ name: '…', alt: '…' }`, and a site whose registry is built otherwise
 * simply gives no words here.
 * @param {string} root
 * @returns {Map<string, string>}
 */
export function registryWords(root) {
  const out = new Map();
  const file = join(root, 'src', 'lib', 'photos.ts');
  if (!existsSync(file)) return out;
  const text = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const at = text.indexOf('PHOTOS');
  if (at === -1) return out;
  const list = text.slice(at, text.indexOf('];', at) === -1 ? undefined : text.indexOf('];', at));
  for (const m of list.matchAll(/\{[^{}]*?\bname:\s*(['"`])((?:\\.|(?!\1).)*)\1[^{}]*?\balt:\s*(['"`])((?:\\.|(?!\3).)*)\3[^{}]*?\}/g)) {
    const words = m[4].replace(/\\(.)/g, '$1').trim();
    if (words) out.set(m[2].toLowerCase(), words);
  }
  return out;
}

/**
 * Write a value's key into its place, keeping everything else the picture
 * holds (`_key`, `focus`, `poster`) and the words where they are. Words are
 * written only where the place has none and the document is in the site's
 * own language (a translation's words are its own language's).
 *
 * @param {Use} use @param {string} key @param {string} words
 * @returns {boolean} whether the document changed
 */
export function rewrite(use, key, words) {
  const { holder } = use;
  if (use.kind === 'body') {
    const before = holder.body;
    holder.body = before.replace(BODY_PICTURE, (whole, alt, path, title = '') => {
      if (path !== use.value) return whole;
      const said = alt.trim() === '' && !use.translation && words ? words.replace(/[[\]]/g, '') : alt;
      return `![${said}](./${key}${title})`;
    });
    return holder.body !== before;
  }
  let changed = false;
  if (holder[use.prop] !== key) {
    holder[use.prop] = key;
    changed = true;
  }
  if (!use.translation && words) {
    if (use.kind === 'picture' && (typeof holder.alt !== 'string' || holder.alt.trim() === '')) {
      holder.alt = words;
      changed = true;
    } else if (use.kind === 'string') {
      const altKey = `${use.prop}_alt`;
      if (typeof holder[altKey] !== 'string' || holder[altKey].trim() === '') {
        holder[altKey] = words;
        changed = true;
      }
    }
  }
  return changed;
}

/** The document as text again, in the indentation it was read in. */
export function textOf({ doc, text }) {
  const indent = /^\{\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
  return `${JSON.stringify(doc, null, indent)}${text.endsWith('\n') ? '\n' : ''}`;
}

/** Where a body's picture goes beside its entry: `jtk/entries/<c>/media/<site>/<file>`. */
export function besideEntry(file, key) {
  return `${posix(dirname(file))}/${key}`;
}

/** The base name a file is shown by in the library. */
export const nameOf = (path) => basename(path);
