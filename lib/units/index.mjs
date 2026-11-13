/**
 * Units applied to a site's files: a section or a module added, or taken
 * away, part by part (jtakeit-core wiki/110 §3). `jtk create` lays the
 * example with these same functions, so `remove X` then `add X` is the tree
 * `create` made, ids aside, and `create --without X` is `create` then
 * `remove X`.
 *
 * Plan, then write. Every part is planned against the files as they are, in
 * memory; where one cannot be done — a table that is not a literal, words
 * that are not the example's — nothing is written and the plan says which
 * part and why. A part already there is left (`add` twice is `add` once), a
 * part already gone is left (`remove` twice is `remove` once).
 *
 * Pure file transforms: no network, no `npm`, no TypeScript of the site's —
 * callable from `jtk create` before `npm ci`, from a shell, and later from a
 * workspace with no shell at all (wiki/110 §6, wiki/100).
 */
import { createHash, getRandomValues } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nameOfPage } from '@jtakeit/kit/upgrade';
import { bodyFileOf, filesOf, photosInBody, placeOf, PHOTOS } from './photos.mjs';
import { said, tableIn, keyOf, uncommented, withElement, withoutElement } from './source.mjs';
import { EXAMPLE_LANGS, SECTIONS, SITE, exampleLang, wordsIn } from './units.mjs';
import { MODULES } from './modules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The example's own files, laid out at the same paths in a site. */
export const FILES = resolve(HERE, '..', '..', 'example', 'files');
const SCAFFOLD_TABLE = resolve(HERE, '..', 'upgrade', 'scaffold.json');

/** Every unit, in the order the home page, the tables and the navigation hold them. */
export const ORDER = [...SECTIONS.slice(0, 6), MODULES.blog, ...SECTIONS.slice(6), MODULES.booking];
export const UNITS = Object.fromEntries(ORDER.map((one) => [one.name, one]));
/** What cannot be removed, and why — the site's skeleton (wiki/110 §3.1). */
export const SKELETON = {
  header: 'the header is the site\'s own: hide it by taking `<Header>` out of src/components/site/, or change its words in the panel',
  footer: 'the footer is the site\'s own: change its words in the panel, or src/components/site/Footer.astro by hand',
  contacts: 'the contacts are the business\'s facts, read by the head, the structured data and the imprint',
  hours: 'the opening hours are the site\'s own: empty their rows in the panel, or take <Hours> out of the footer by hand',
  imprint: 'a site in Switzerland, Germany or Austria needs an imprint: change its words, or delete src/pages/[...lang]/imprint.astro and jtk/pages/imprint*.json by hand',
  privacy: 'the privacy page carries the link the platform looks for (PROCESSING_URL)',
  form: 'the form\'s own block, `cta_banner`, is the site\'s: `remove contact` takes its section off the page',
  site: 'the site is not a unit',
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha = (text) => createHash('sha256').update(text).digest('hex');

/** A new id: a UUID, version 7, as the platform mints one. */
function uuid7() {
  const bytes = getRandomValues(new Uint8Array(16));
  let moment = Date.now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = moment % 256;
    moment = Math.floor(moment / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((one) => one.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A page's file under jtk/pages: `/` is index.json. */
export const pageFile = (address, locale = '') => `jtk/pages/${address === '/' ? 'index' : address.replace(/^\//, '')}${locale ? `.${locale}` : ''}.json`;
const entryFile = (collection, slug, locale = '') => `jtk/entries/${collection}/${slug}${locale ? `.${locale}` : ''}.json`;
const sharedFile = (locale = '') => `jtk/shared${locale ? `.${locale}` : ''}.json`;

// ── the tree, in memory ─────────────────────────────────────────────────────

/** A site's files, read on demand and changed in memory until `commit`. */
export function treeOf(root) {
  const changed = new Map(); // path → text | null (deleted) | Buffer
  const read = (path) => {
    if (changed.has(path)) {
      const one = changed.get(path);
      return one === null ? undefined : typeof one === 'string' ? one : one.toString('utf8');
    }
    const at = join(root, path);
    return existsSync(at) ? readFileSync(at, 'utf8') : undefined;
  };
  const exists = (path) => (changed.has(path) ? changed.get(path) !== null : existsSync(join(root, path)));
  return {
    root,
    read,
    exists,
    json: (path) => {
      const text = read(path);
      return text === undefined ? undefined : JSON.parse(text);
    },
    write: (path, text) => {
      if (read(path) !== text || !exists(path)) changed.set(path, text);
    },
    copy: (path, from) => changed.set(path, readFileSync(from)),
    bytes: (path) => (changed.has(path) ? changed.get(path) : existsSync(join(root, path)) ? readFileSync(join(root, path)) : undefined),
    remove: (path) => {
      if (exists(path)) changed.set(path, null);
    },
    /** Every path under a directory of the site, as it stands now. */
    under: (dir) => {
      const out = new Set();
      const walk = (at) => {
        const full = join(root, at);
        if (!existsSync(full)) return;
        for (const one of readdirSync(full, { withFileTypes: true })) {
          const path = `${at}/${one.name}`;
          if (one.isDirectory()) walk(path);
          else out.add(path);
        }
      };
      walk(dir);
      for (const [path, value] of changed) if (path.startsWith(`${dir}/`)) (value === null ? out.delete(path) : out.add(path));
      return [...out].filter((path) => exists(path)).sort();
    },
    changed,
    commit() {
      const written = [];
      for (const [path, value] of changed) {
        const at = join(root, path);
        if (value === null) {
          rmSync(at, { force: true });
          // A directory the last file left is gone with it: an entry-less collection leaves no folder.
          for (let up = dirname(at); up.startsWith(root) && up !== root && !['jtk', 'src', 'jtk/entries', 'jtk/pages'].includes(up.slice(root.length + 1)); up = dirname(up)) {
            if (existsSync(up) && readdirSync(up).length === 0) rmSync(up, { recursive: true });
            else break;
          }
        } else {
          mkdirSync(dirname(at), { recursive: true });
          writeFileSync(at, value);
        }
        written.push(path);
      }
      return written.sort();
    },
  };
}

// ── what a site says about itself ───────────────────────────────────────────

const BLOCKS_TS = 'src/content/blocks.ts';
const SECTIONS_TS = 'src/components/sections/index.ts';

/** The site's language, its other languages, and the business's name. */
export function siteOf(tree) {
  const source = tree.read(BLOCKS_TS) ?? '';
  const locale = /^export const LOCALE\s*=\s*['"]([^'"]+)['"]/m.exec(source)?.[1] ?? 'en';
  const listed = /^export const LOCALES\s*:[^=]*=\s*\[([^\]]*)\]/m.exec(source)?.[1] ?? '';
  const locales = [...listed.matchAll(/['"]([^'"]+)['"]/g)].map((one) => one[1]);
  const shared = tree.json(sharedFile());
  const contacts = shared?.blocks?.find((one) => one?.type === 'contacts');
  const name = typeof contacts?.name === 'string' && contacts.name !== '' ? contacts.name : JSON.parse(tree.read('package.json') ?? '{}').name ?? 'The business';
  return { locale, locales, name, lang: exampleLang(locale) };
}

/** The languages a unit writes the example's words in, besides the original: those the example has, and that differ from the original's. */
function overlaysOf(site) {
  return site.locales.filter((one) => EXAMPLE_LANGS.includes(exampleLang(one)) && EXAMPLE_LANGS.some((lang) => one.toLowerCase().startsWith(lang)) && exampleLang(one) !== site.lang);
}

// ── what a translation holds ────────────────────────────────────────────────

/** A data literal's value, its comments taken out: the example's declarations are literals. */
function literal(text) {
  try {
    return new Function(`return (${uncommented(text)});`)();
  } catch {
    return undefined;
  }
}

let declared;
/**
 * Every block type the example and its units declare, by its type: the
 * example's own declaration (its `BLOCKS`, the shared types, the blog's post)
 * and every unit's types — what says which of a value's words are a
 * language's (`localized`), so a translation the example writes holds all of
 * them and a new site starts with nothing left to translate.
 */
function declarations() {
  if (declared !== undefined) return declared;
  declared = new Map();
  const source = readFileSync(join(FILES, BLOCKS_TS), 'utf8');
  for (const name of ['BLOCKS', 'CONTACTS', 'HEADER', 'HOURS', 'FOOTER', 'BLOG_POST']) {
    const table = tableIn(source, name);
    if ('refused' in table) continue;
    const values = source[table.open] === '[' ? table.elements.map((one) => literal(one.text)) : [literal(source.slice(table.open, table.close + 1))];
    for (const one of values) if (isObject(one) && typeof one.type === 'string') declared.set(one.type, one);
  }
  for (const unit of ORDER) for (const one of unit.types ?? []) {
    const value = literal(one.source);
    if (isObject(value)) declared.set(value.type, value);
  }
  return declared;
}

const WORDS = new Set(['text', 'textarea', 'richtext_lite', 'markdown']);

/**
 * A value's words in one language, as a translation holds them: every value of
 * a field that is a language's — words that are not `localized: false`, a
 * picture's `alt`, the rows of a list by their `_key` — whether or not the
 * words differ from the original's. What is the same in every language (a
 * link, a price, a picture's file, a name) is never written: the platform
 * refuses it in a translation (JTK_E_TRANSLATION_SHARED).
 */
export function localWords(fields, value) {
  const out = {};
  for (const field of fields ?? []) {
    const one = value?.[field.key];
    if (one === undefined || one === null || field.localized === false) continue;
    if (WORDS.has(field.kind)) {
      if (typeof one === 'string' && one.trim() !== '') out[field.key] = one;
    } else if (field.kind === 'media') {
      if (Array.isArray(one)) {
        const rows = one.filter((row) => isObject(row) && typeof row._key === 'string' && typeof row.alt === 'string' && row.alt !== '').map((row) => ({ _key: row._key, alt: row.alt }));
        if (rows.length > 0) out[field.key] = rows;
      } else if (isObject(one) && typeof one.alt === 'string' && one.alt !== '') out[field.key] = { alt: one.alt };
    } else if (field.kind === 'list' && Array.isArray(one)) {
      const rows = one.flatMap((row) => {
        if (!isObject(row) || typeof row._key !== 'string') return [];
        const words = localWords(field.of, row);
        return Object.keys(words).length > 0 ? [{ _key: row._key, ...words }] : [];
      });
      if (rows.length > 0) out[field.key] = rows;
    }
  }
  return out;
}

/** A block's words in a language, by its type's declaration; `undefined` where it has none. */
function blockWords(block) {
  const words = localWords(declarations().get(block.type)?.fields, block);
  return Object.keys(words).length > 0 ? { _key: block._key, ...words } : undefined;
}

/** A page's words in a language: its name, its SEO, its blocks'. */
function pageWords(page) {
  const seo = Object.fromEntries(Object.entries(page.seo ?? {}).filter(([, one]) => typeof one === 'string' && one !== ''));
  return {
    ...(page.name ? { name: page.name } : {}),
    ...(Object.keys(seo).length > 0 ? { seo } : {}),
    blocks: (page.blocks ?? []).map(blockWords).filter(Boolean),
  };
}

/** The type an entry of a collection is, as the units declare it. */
const typeOfCollection = (name) => {
  for (const unit of ORDER) for (const one of unit.collections ?? []) if (one.name === name) return literal(one.source)?.type;
  return name === 'blog' ? 'post' : undefined;
};

/** The words of one language laid over another's, as a translation holds them: only what differs, by `_key`. */
export function wordsOver(base, other) {
  if (typeof other === 'string') return other !== base ? other : undefined;
  if (Array.isArray(other)) {
    if (!other.every((one) => isObject(one) && typeof one._key === 'string')) return undefined;
    const rows = other.flatMap((row) => {
      const was = Array.isArray(base) ? base.find((one) => isObject(one) && one._key === row._key) : undefined;
      const diff = wordsOver(was ?? {}, row);
      return diff === undefined ? [] : [{ _key: row._key, ...diff }];
    });
    return rows.length > 0 ? rows : undefined;
  }
  if (isObject(other)) {
    const out = {};
    for (const [key, value] of Object.entries(other)) {
      if (key === '_key' || key === 'type' || key === 'v' || key === 'src') continue;
      const diff = wordsOver(isObject(base) ? base[key] : undefined, value);
      if (diff !== undefined) out[key] = diff;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

// ── the tables: blocks.ts and the sections map ──────────────────────────────

/** The block types every unit before `unit` owns, nearest first: where its own go after. */
function before(unit, what) {
  const at = ORDER.indexOf(unit);
  // Nearest unit first, and of each its last part first: a unit's next goes after all of its own.
  return ORDER.slice(0, at)
    .reverse()
    .flatMap((one) => [...what(one)].reverse());
}

const typesOf = (unit) => (unit.types ?? []).map((one) => one.type);
const collectionsOf = (unit) => (unit.collections ?? []).map((one) => one.name);
const homeTypes = (unit) => [...new Set((unit.home ?? []).map((make) => make(wordsIn('en', '')).type))];

class Refusal extends Error {}

function editTable(source, name, file, edit) {
  const table = tableIn(source, name, file);
  if ('refused' in table) throw new Refusal(table.refused);
  return edit(table);
}

/** blocks.ts with a unit's types and collections, each after the nearest unit before it. */
function declare(source, unit, said_) {
  let out = source;
  for (const [table, key, items, prior] of [
    ['BLOCKS', 'type', unit.types ?? [], (u) => typesOf(u)],
    ['COLLECTIONS', 'name', unit.collections ?? [], (u) => collectionsOf(u)],
  ]) {
    let last; // the one this unit just wrote: its next goes after it
    for (const item of items) {
      const id = item[key === 'type' ? 'type' : 'name'];
      out = editTable(out, table, BLOCKS_TS, (found) => {
        if (found.elements.some((one) => said(one, key) === id)) {
          last = id;
          return out;
        }
        // After the one this unit just wrote, else the nearest earlier unit's
        // that is there, else `text` (BLOCKS) or the head of the table.
        const after = last !== undefined ? [last] : before(unit, prior);
        const present = after.find((one) => found.elements.some((e) => said(e, key) === one));
        const where = present !== undefined ? (one) => said(one, key) === present : key === 'type' ? (one) => said(one, 'type') === 'text' : () => false;
        said_.push(`${BLOCKS_TS}: ${table} gains ${id}`);
        last = id;
        return withElement(out, found, item.source, where);
      });
    }
  }
  return out;
}

/** blocks.ts without a unit's types and collections. */
function undeclare(source, unit, said_) {
  let out = source;
  for (const [table, key, ids] of [
    ['BLOCKS', 'type', typesOf(unit)],
    ['COLLECTIONS', 'name', collectionsOf(unit)],
  ]) {
    for (const id of ids) {
      out = editTable(out, table, BLOCKS_TS, (found) => {
        const element = found.elements.find((one) => said(one, key) === id);
        if (element === undefined) return out;
        said_.push(`${BLOCKS_TS}: ${table} loses ${id}`);
        return withoutElement(out, element, found);
      });
    }
  }
  return out;
}

const importLine = (component) => `import ${component} from './${component}.astro';`;

/** The sections map with a unit's lines and imports. */
function mapIn(source, unit, said_, add) {
  let out = source;
  let lastType;
  let lastImport;
  for (const { type, component } of unit.sections ?? []) {
    const line = importLine(component);
    const others = ORDER.filter((one) => one !== unit).flatMap((one) => (one.sections ?? []).filter((s) => s.component !== component).map((s) => s.component));
    const still = others.includes(component);
    if (add) {
      if (!out.split('\n').includes(line)) {
        // After the import of the nearest unit before it, else before the map.
        const prior = [...(lastImport ? [lastImport] : []), ...before(unit, (u) => (u.sections ?? []).map((s) => importLine(s.component)))];
        const lines = out.split('\n');
        const at = prior.map((one) => lines.indexOf(one)).find((one) => one !== -1);
        const map = lines.findIndex((one) => /^export const SECTIONS\b/.test(one));
        if (map === -1) throw new Refusal(`${SECTIONS_TS} declares no SECTIONS`);
        // With none before it there, before the first of a unit after it, else just above the map.
        const later = ORDER.slice(ORDER.indexOf(unit) + 1).flatMap((u) => (u.sections ?? []).map((s) => lines.indexOf(importLine(s.component)))).filter((one) => one !== -1);
        lines.splice(at !== undefined ? at + 1 : later.length > 0 ? Math.min(...later) : map, 0, line);
        out = lines.join('\n');
        said_.push(`${SECTIONS_TS}: imports ${component}`);
      }
      lastImport = line;
      out = editTable(out, 'SECTIONS', SECTIONS_TS, (found) => {
        if (found.elements.some((one) => keyOf(one) === type)) return out;
        const prior = [...(lastType ? [lastType] : []), ...before(unit, (u) => (u.sections ?? []).map((s) => s.type))];
        const present = prior.find((one) => found.elements.some((e) => keyOf(e) === one));
        said_.push(`${SECTIONS_TS}: SECTIONS gains ${type}: ${component}`);
        lastType = type;
        return withElement(out, found, `${type}: ${component}`, (one) => present !== undefined && keyOf(one) === present);
      });
    } else {
      out = editTable(out, 'SECTIONS', SECTIONS_TS, (found) => {
        const element = found.elements.find((one) => keyOf(one) === type);
        if (element === undefined) return out;
        said_.push(`${SECTIONS_TS}: SECTIONS loses ${type}`);
        return withoutElement(out, element, found);
      });
      if (!still && out.split('\n').includes(line)) {
        out = out
          .split('\n')
          .filter((one) => one !== line)
          .join('\n');
        said_.push(`${SECTIONS_TS}: no longer imports ${component}`);
      }
    }
  }
  return out;
}

// ── the scaffold's own files ────────────────────────────────────────────────

/** Whether a site's copy of an example file is the scaffold's — this package's, or any version's (lib/upgrade/scaffold.json, `example`). */
export function scaffolds(path, text) {
  const own = join(FILES, path);
  if (existsSync(own) && readFileSync(own, 'utf8') === text) return true;
  try {
    const table = JSON.parse(readFileSync(SCAFFOLD_TABLE, 'utf8')).example ?? {};
    return Object.hasOwn(table[path] ?? {}, sha(text));
  } catch {
    return false;
  }
}

// ── the example's content ───────────────────────────────────────────────────

/** Where a unit's block goes on a page: after the nearest unit before it whose block is there, else first. */
function placeOn(blocks, unit) {
  const prior = before(unit, homeTypes);
  for (const type of prior) {
    let at = -1;
    blocks.forEach((one, i) => {
      if (one?.type === type) at = i;
    });
    if (at !== -1) return at + 1;
  }
  return 0;
}

/** A translation's blocks in the order of the original's. */
function orderLike(blocks, original) {
  const rank = (key) => {
    const at = original.findIndex((one) => one?._key === key);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...blocks].sort((a, b) => rank(a._key) - rank(b._key));
}

/** The leaves of a value, by their path. */
function leaves(value, at = '', out = new Map()) {
  if (Array.isArray(value)) value.forEach((one, i) => leaves(one, `${at}[${isObject(one) && one._key ? one._key : i}]`, out));
  else if (isObject(value)) for (const [key, one] of Object.entries(value)) leaves(one, at === '' ? key : `${at}.${key}`, out);
  else out.set(at, value);
  return out;
}

/** The form's words, the kit's own (lib/copies.mjs): an owner may keep them, and they are no example's. */
const GENERIC = /(^|\.)(name_label|contact_label|message_label|topic_label|required_note|cta_label|[a-z_]+_label)$/;

/**
 * Where a value differs from every one of the example's versions of it:
 * `[]` when it is still the example's, else the places and what they say.
 */
function notExample(value, versions, prefix) {
  const theirs = versions.map((one) => leaves(one));
  const out = [];
  for (const [path, said_] of leaves(value)) {
    if (/(^|\.)(_key|type|v|id|rank|visible|of|locale|collection|slug|path)$/.test(path) || path === '') continue;
    if (GENERIC.test(path) && typeof said_ === 'string') continue;
    if (theirs.some((one) => one.has(path) && JSON.stringify(one.get(path)) === JSON.stringify(said_))) continue;
    out.push(`${prefix}${path} says «${String(said_).slice(0, 60)}» — not the example's`);
  }
  return out;
}

// ── add and remove ──────────────────────────────────────────────────────────

/**
 * Plan a unit's addition into `tree`. Returns what it did, part by part.
 * @param {ReturnType<typeof treeOf>} tree
 */
export function addUnit(tree, unit, options = {}) {
  const did = [];
  const site = siteOf(tree);
  const x = wordsIn(site.lang, site.name);
  const others = overlaysOf(site).map((locale) => ({ locale, x: wordsIn(exampleLang(locale), site.name) }));

  if (unit.add) return unit.add(tree, { site, x, others, did, options, engine: { helpers, wordsOver, pageFile, removeUnit, unitPresent, units: UNITS } });

  // The declaration and the sections map.
  const source = tree.read(BLOCKS_TS);
  if (source === undefined) throw new Refusal(`${BLOCKS_TS} is not there — run this in a site's root (--root)`);
  let declared = declare(source, unit, did);
  // A module's statements at the foot of blocks.ts (the blog's two lines).
  const lines = declared.split('\n');
  if (unit.statements && !unit.statements.split('\n').filter((one) => !one.startsWith('//')).every((one) => lines.includes(one))) {
    declared = `${declared.replace(/\s+$/, '')}\n\n${unit.statements}\n`;
    did.push(`${BLOCKS_TS}: ${unit.statements.split('\n').slice(1).join(' ')}`);
  }
  tree.write(BLOCKS_TS, declared);
  if ((unit.sections ?? []).length > 0) {
    const map = tree.read(SECTIONS_TS) ?? readFileSync(join(FILES, SECTIONS_TS), 'utf8');
    tree.write(SECTIONS_TS, mapIn(map, unit, did, true));
  }

  // The components, where the site has none of its own at their paths.
  for (const path of unit.files ?? []) {
    if (tree.exists(path)) continue;
    tree.write(path, readFileSync(join(FILES, path), 'utf8'));
    did.push(`${path}: written`);
  }

  // The photographs.
  for (const { from, to } of filesOf(unit.photos ?? [])) {
    if (tree.exists(to)) continue;
    tree.copy(to, from);
    did.push(`${to}: the example's photograph`);
  }

  helpers.home(tree, unit, site, x, others, did, options);
  helpers.pages(tree, unit.pages ?? {}, site, x, others, did);
  helpers.entries(tree, unit, x, others, did);
  if (unit.nav) helpers.nav(tree, unit, x, others, did);
  return did;
}

const helpers = {
  /** A unit's blocks on the home page, and their words in each language. */
  home(tree, unit, site, x, others, did, options = {}) {
    if ((unit.home ?? []).length === 0) return;
    const file = pageFile('/');
    const page = tree.json(file);
    if (page === undefined) throw new Refusal(`${file} is not there`);
    page.blocks ??= [];
    const added = [];
    for (const make of unit.home) {
      const block = make(x);
      if (page.blocks.some((one) => one?._key === block._key || one?.type === block.type)) continue;
      // Where the command said (--after/--before a type), else the unit's place in the example's order.
      const after = options.after ? page.blocks.findLastIndex((one) => one?.type === options.after) : -1;
      const before_ = options.before ? page.blocks.findIndex((one) => one?.type === options.before) : -1;
      const at = after !== -1 ? after + 1 : before_ !== -1 ? before_ : placeOn(page.blocks, unit);
      page.blocks.splice(at, 0, block);
      added.push(make);
      did.push(`${file}: a ${block.type} block, the example's words`);
    }
    if (added.length === 0) return;
    page.id ??= uuid7();
    tree.write(file, json(page));
    for (const { locale, x: y } of others) {
      const over = pageFile('/', locale);
      const translation = tree.json(over) ?? { of: page.id, locale, name: nameOfPage({}, '/', locale), blocks: [] };
      translation.blocks ??= [];
      for (const make of added) {
        const words = blockWords(make(y));
        if (words === undefined || translation.blocks.some((one) => one?._key === make(x)._key)) continue;
        translation.blocks.push(words);
      }
      translation.blocks = orderLike(translation.blocks, page.blocks);
      tree.write(over, json(translation));
      did.push(`${over}: its words in ${locale}`);
    }
  },

  /** Pages of a unit's own, whole, with their translations. */
  pages(tree, pages, site, x, others, did) {
    for (const [address, make] of Object.entries(pages)) {
      const file = pageFile(address);
      if (tree.exists(file)) continue;
      const page = { id: uuid7(), ...make(x) };
      tree.write(file, json(page));
      did.push(`${file}: the page, the example's words`);
      for (const { locale, x: y } of others) {
        const translation = { of: page.id, locale, ...pageWords(make(y)) };
        tree.write(pageFile(address, locale), json(translation));
        did.push(`${pageFile(address, locale)}: its words in ${locale}`);
      }
    }
  },

  /** A collection's example entries, with their translations. */
  entries(tree, unit, x, others, did) {
    if (!unit.entries) return;
    const theirs = unit.entries(x);
    const per = others.map(({ locale, x: y }) => ({ locale, entries: unit.entries(y) }));
    theirs.forEach((entry, at) => {
      const file = entryFile(entry.collection, entry.slug);
      if (tree.exists(file)) return;
      const doc = { id: uuid7(), collection: entry.collection, slug: entry.slug, rank: entry.rank, visible: true, fields: entry.fields };
      tree.write(file, json(doc));
      did.push(`${file}: the example's entry`);
      // A photograph in its body is beside the entry, where Astro resolves it (lib/units/photos.mjs).
      for (const { from, name } of filesOf(photosInBody(entry.fields?.body))) {
        const to = bodyFileOf(name, entry.collection);
        if (!tree.exists(to)) tree.copy(to, from);
      }
      for (const { locale, entries } of per) {
        const words = localWords(declarations().get(typeOfCollection(entry.collection))?.fields, entries[at].fields);
        if (Object.keys(words).length === 0) continue;
        tree.write(entryFile(entry.collection, entry.slug, locale), json({ of: doc.id, locale, fields: words }));
        did.push(`${entryFile(entry.collection, entry.slug, locale)}: its words in ${locale}`);
      }
    });
  },

  /** A unit's item in the header's navigation, after the nearest unit before it whose item is there. */
  nav(tree, unit, x, others, did) {
    const shared = tree.json(sharedFile());
    const header = shared?.blocks?.find((one) => one?.type === 'header');
    if (header === undefined) return;
    const item = unit.nav(x);
    header.nav ??= [];
    if (header.nav.some((one) => one?._key === item._key || one?.link === item.link)) return;
    const prior = before(unit, (u) => (u.nav ? [u.nav(x).link] : []));
    let at = 0;
    for (const link of prior) {
      const found = header.nav.findIndex((one) => one?.link === link);
      if (found !== -1) {
        at = found + 1;
        break;
      }
    }
    header.nav.splice(at, 0, item);
    tree.write(sharedFile(), json(shared));
    did.push(`${sharedFile()}: the navigation gains «${item.label}» → ${item.link}`);
    for (const { locale, x: y } of others) {
      const nav = declarations().get('header')?.fields?.find((one) => one.key === 'nav');
      const { _key, ...words } = { _key: item._key, ...localWords(nav?.of, unit.nav(y)) };
      void _key;
      if (Object.keys(words).length === 0) continue;
      const file = sharedFile(locale);
      const translation = tree.json(file) ?? { locale, blocks: [] };
      translation.blocks ??= [];
      let over = translation.blocks.find((one) => one?._key === header._key);
      if (over === undefined) {
        over = { _key: header._key };
        translation.blocks.push(over);
      }
      over.nav ??= [];
      if (!over.nav.some((one) => one?._key === item._key)) over.nav.push({ _key: item._key, ...words });
      over.nav = orderLike(over.nav, header.nav);
      translation.blocks = orderLike(translation.blocks, shared.blocks);
      tree.write(file, json(translation));
      did.push(`${file}: its words in ${locale}`);
    }
  },
};

/** Every translation file of a document: `index.en.json` beside `index.json`. */
function translationsOf(tree, file) {
  const dir = dirname(file);
  const stem = file.slice(dir.length + 1).replace(/\.json$/, '');
  return tree.under(dir).filter((one) => new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[A-Za-z]{2}(-[A-Za-z]{2})?\\.json$`).test(one));
}

/**
 * Plan a unit's removal from `tree`: what it did, and where the words are a
 * person's — refused, unless `force`.
 */
export function removeUnit(tree, unit, { force = false } = {}) {
  const did = [];
  const kept = [];
  const faults = [];
  const site = siteOf(tree);
  const versions = (make) => EXAMPLE_LANGS.map((lang) => make(wordsIn(lang, site.name)));

  if (unit.remove) return unit.remove(tree, { site, did, kept, faults, force, versions, units: UNITS, wordsIn });

  const types = new Set([...typesOf(unit), ...homeTypes(unit)]);

  // The page blocks of its types, on every page, and their words in every translation.
  for (const file of tree.under('jtk/pages').filter((one) => /^jtk\/pages\/[^.]+(\/[^.]+)*\.json$/.test(one))) {
    const page = tree.json(file);
    if (!Array.isArray(page?.blocks)) continue;
    const owned = page.blocks.filter((one) => types.has(one?.type));
    if (owned.length === 0) continue;
    const ownPage = Object.keys(unit.pages ?? {}).some((address) => pageFile(address) === file);
    if (ownPage) continue; // the whole page goes, below
    for (const block of owned) {
      const make = (unit.home ?? []).find((one) => one(wordsIn('en', site.name)).type === block.type);
      const wrong = make ? notExample(block, versions(make), `${file} · blocks[${block._key}].`) : [`${file} · blocks[${block._key}] is a ${block.type} block the example never wrote`];
      if (wrong.length > 0 && !force) faults.push(...wrong);
    }
    page.blocks = page.blocks.filter((one) => !types.has(one?.type));
    tree.write(file, json(page));
    did.push(`${file}: ${owned.map((one) => `the ${one.type} block`).join(', ')} taken off`);
    const keys = new Set(owned.map((one) => one._key));
    for (const over of translationsOf(tree, file)) {
      const translation = tree.json(over);
      if (!Array.isArray(translation?.blocks)) continue;
      const before_ = translation.blocks.length;
      translation.blocks = translation.blocks.filter((one) => !keys.has(one?._key));
      if (translation.blocks.length !== before_) {
        tree.write(over, json(translation));
        did.push(`${over}: their words taken off`);
      }
    }
  }

  // Its own pages, whole.
  for (const [address, make] of Object.entries(unit.pages ?? {})) {
    const file = pageFile(address);
    const page = tree.json(file);
    if (page === undefined) continue;
    const wrong = notExample(page, versions(make), `${file} · `);
    if (wrong.length > 0 && !force) faults.push(...wrong);
    for (const one of [file, ...translationsOf(tree, file)]) {
      tree.remove(one);
      did.push(`${one}: deleted`);
    }
  }

  // Its collections' entries, every one — the example's, or refused.
  for (const collection of [...collectionsOf(unit), ...(unit.entryCollections ?? [])]) {
    const examples = unit.entries ? EXAMPLE_LANGS.map((lang) => unit.entries(wordsIn(lang, site.name))) : [];
    for (const file of tree.under(`jtk/entries/${collection}`)) {
      // The pictures beside the entries are the example's copies, git-ignored: they go with the collection.
      if (file.startsWith(`jtk/entries/${collection}/media/`)) {
        if (file.startsWith(`jtk/entries/${collection}/media/jtk-example/`)) tree.remove(file);
        continue;
      }
      if (!file.endsWith('.json') || /\.[A-Za-z]{2}(-[A-Za-z]{2})?\.json$/.test(file)) continue;
      const entry = tree.json(file);
      const mine = examples.map((list) => list.find((one) => one.slug === entry?.slug)).filter(Boolean);
      const wrong = mine.length === 0 ? [`${file} is an entry the example never wrote («${String(entry?.fields?.title ?? entry?.slug)}»)`] : notExample(entry.fields ?? {}, mine.map((one) => one.fields), `${file} · fields.`);
      if (wrong.length > 0 && !force) faults.push(...wrong);
      for (const one of [file, ...translationsOf(tree, file)]) {
        tree.remove(one);
        did.push(`${one}: deleted`);
      }
    }
  }

  // Its item in the navigation, and its words.
  if (unit.nav) {
    const link = unit.nav(wordsIn('en', site.name)).link;
    const shared = tree.json(sharedFile());
    const header = shared?.blocks?.find((one) => one?.type === 'header');
    const gone = (header?.nav ?? []).filter((one) => one?.link === link);
    if (gone.length > 0) {
      header.nav = header.nav.filter((one) => one?.link !== link);
      tree.write(sharedFile(), json(shared));
      did.push(`${sharedFile()}: the navigation loses ${link}`);
      const keys = new Set(gone.map((one) => one._key));
      for (const over of translationsOf(tree, sharedFile())) {
        const translation = tree.json(over);
        const block = translation?.blocks?.find((one) => one?._key === header._key);
        if (!Array.isArray(block?.nav)) continue;
        block.nav = block.nav.filter((one) => !keys.has(one?._key));
        if (block.nav.length === 0) delete block.nav;
        if (Object.keys(block).length === 1) translation.blocks = translation.blocks.filter((one) => one !== block);
        tree.write(over, json(translation));
        did.push(`${over}: its words taken off`);
      }
    }
  }

  // The sections map, the declaration.
  if ((unit.sections ?? []).length > 0 && tree.exists(SECTIONS_TS)) tree.write(SECTIONS_TS, mapIn(tree.read(SECTIONS_TS), unit, did, false));
  if (tree.exists(BLOCKS_TS)) {
    let source = undeclare(tree.read(BLOCKS_TS), unit, did);
    if (unit.statements) {
      if (source.includes(`\n\n${unit.statements}`)) source = source.replace(`\n\n${unit.statements}`, '');
      else {
        // Written another way — `jtk create --blog`'s comment — the lines themselves go.
        const lines = unit.statements.split('\n').filter((one) => !one.startsWith('//'));
        source = source
          .split('\n')
          .filter((one, i, all) => !lines.includes(one) && !(one.startsWith('// The blog, turned on by') && lines.includes(all[i + 1])))
          .join('\n')
          .replace(/\n{3,}$/, '\n');
      }
      did.push(`${BLOCKS_TS}: ${unit.statements.split('\n').slice(1).join(' ')} — taken out`);
    }
    tree.write(BLOCKS_TS, source);
  }

  // The components: the scaffold's are deleted, one the agent changed is kept and named.
  const stillUsed = new Set(ORDER.filter((one) => one !== unit).flatMap((one) => one.files ?? []).filter((path) => ORDER.some((u) => u !== unit && (u.files ?? []).includes(path) && unitPresent(tree, u))));
  for (const path of unit.files ?? []) {
    if (!tree.exists(path) || stillUsed.has(path) || SITE.files.includes(path)) continue;
    if (force || scaffolds(path, tree.read(path))) {
      tree.remove(path);
      did.push(`${path}: deleted`);
    } else kept.push(`${path}: yours now — taken out of SECTIONS and left; delete it by hand if nothing uses it (--force deletes it)`);
  }

  // The photographs nothing names any more, where they are still the example's bytes.
  const named = tree
    .under('jtk')
    .filter((one) => one.endsWith('.json'))
    .map((one) => tree.read(one) ?? '')
    .join('\n');
  for (const { from, to, name } of filesOf(unit.photos ?? [])) {
    if (!tree.exists(to)) continue;
    if (named.includes(placeOf(name).value)) continue;
    if (Buffer.compare(tree.bytes(to), readFileSync(from)) !== 0) continue;
    tree.remove(to);
    did.push(`${to}: deleted (the example's, named nowhere now)`);
  }
  return { did, kept, faults };
}

/** Whether a unit is on the site: any of its parts there. */
export function unitPresent(tree, unit) {
  if (unit.present) return unit.present(tree);
  const source = tree.read(BLOCKS_TS) ?? '';
  const declared = (table, key, id) => {
    const found = tableIn(source, table);
    return !('refused' in found) && found.elements.some((one) => said(one, key) === id);
  };
  if (typesOf(unit).some((one) => declared('BLOCKS', 'type', one))) return true;
  const map = tree.read(SECTIONS_TS) ?? '';
  if ((unit.sections ?? []).some((one) => new RegExp(`^\\s*${one.type}\\s*:`, 'm').test(map))) return true;
  const home = tree.json(pageFile('/'));
  return homeTypes(unit).some((type) => (home?.blocks ?? []).some((one) => one?.type === type));
}

// ── the skeleton, laid once by jtk create ───────────────────────────────────

/**
 * The example's skeleton into a fresh tree: its declaration, look, header,
 * footer and imprint (files), with the tokens `jtk create` fills.
 * Then `layContent` once the languages are said.
 */
export function layFiles(tree, substitute) {
  for (const path of SITE.files) {
    const text = readFileSync(join(FILES, path), 'utf8');
    tree.write(path, substitute(text));
  }
}

/** The example's shared text, home page and imprint — the content every unit stands on. */
export function layContent(tree, name) {
  const site = { ...siteOf(tree), ...(name ? { name } : {}) };
  const x = wordsIn(site.lang, site.name);
  const others = overlaysOf(site).map((locale) => ({ locale, x: wordsIn(exampleLang(locale), site.name) }));
  const did = [];

  const home = tree.json(pageFile('/')) ?? { path: '/', name: nameOfPage({}, '/', site.locale) };
  const index = SITE.index(x);
  const page = { id: home.id ?? uuid7(), path: '/', name: home.name ?? nameOfPage({}, '/', site.locale), seo: index.seo, blocks: [] };
  tree.write(pageFile('/'), json(page));
  for (const { locale, x: y } of others) {
    const words = pageWords(SITE.index(y));
    tree.write(pageFile('/', locale), json({ of: page.id, locale, name: nameOfPage({}, '/', locale), ...(words.seo ? { seo: words.seo } : {}), blocks: [] }));
  }

  const shared = SITE.shared(x);
  tree.write(sharedFile(), json({ blocks: shared }));
  for (const { locale, x: y } of others) {
    const blocks = SITE.shared(y).map(blockWords).filter(Boolean);
    tree.write(sharedFile(locale), json({ locale, blocks }));
  }
  helpers.pages(tree, SITE.pages, site, x, others, did);
  return did;
}

export { Refusal };
