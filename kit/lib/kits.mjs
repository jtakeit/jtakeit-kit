/**
 * A booking kit, laid out — the files the platform's `kits.Files` describes,
 * in the same shapes, into any repository.
 *
 * The kit is the platform's (`GET /v1/kits/<kind>`; a page of it at
 * `jtakeit:///kits/<kind>.md`) and it is judged there. It is served in
 * contract 2's words, and what this does is write what it says into a
 * site's `jtk/` files in the words of the contract the site is on:
 *
 *   contract 3 — a new site, always, and a contract-3 tree
 *       `kitIn3` puts the kit in contract 3's words by `@jtakeit/kit/upgrade`'s
 *       mapping, in memory: its block types, collections and module as
 *       `tablesOf` says them, its settings at `jtk/modules/bookings.json` and its
 *       rates under `jtk/entries/` with their ids and ranks as `documentsOf`
 *       moves them, and the page its services are shown on under `jtk/pages/`.
 *       `@jtakeit/astro`'s `jtk create --kit` writes the tables into
 *       `src/content/blocks.ts`; `layKit3Files` — `jtkit apply`, for a site on
 *       another generator, which has no declaration — writes them into
 *       `jtk/schema.json` beside the site's own and judges it as the platform
 *       does.
 *
 *   contract 2 — a site made before contract 3 and not moved yet
 *       `layKitFiles`: the settings into `jtk/bookings.json`, the rates as
 *       entries under `jtk/content/`, and the kit's types into
 *       `jtk/catalogue.json` without the keys only contract 3 has
 *       (`catalogueIn2`).
 *
 * `applyKit` reads which one a tree is and does it. Either way the settings
 * say `page` at the services' listing and `kit` / `kit_version` which kit and
 * which version they came from.
 *
 * Nothing written is a fact about the business: the rates carry no price and
 * the settings no zone and no hours. What the kit says to take from the brief
 * is in `kit.ask`, for whoever runs this to do next.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { canonicalLocale } from './content/locale.mjs';
import { contractOf } from './content/node.mjs';
import { judgeSchema } from './judge3.mjs';
import { canonicalJSON } from './translations.mjs';
import { documentsOf, isEmpty, tablesOf } from './upgrade3.mjs';

const TOOL_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Where the platform is, for a kit asked by its kind. */
export const API = 'https://api.jtakeit.com';

/** A kit, read from a file and checked. @param {string} file */
export function readKit(file) {
  let kit;
  try {
    kit = JSON.parse(readFileSync(resolve(file), 'utf8'));
  } catch (why) {
    throw new Error(`--kit ${file} is not a kit: ${why.message}`);
  }
  return checkKit(kit, file);
}

/**
 * A kit asked of the platform by its kind: the kit whole,
 * every part written out, and its version — which the site's settings record
 * as `kit_version`, so the platform's judge can say when a fix to the kit has
 * not reached the site (JTK_W_KIT_BEHIND).
 *
 * @param {string} kind
 * @param {string} [api]
 */
export async function fetchKit(kind, api = process.env.JTK_API_URL || API) {
  const base = api.replace(/\/+$/, '');
  const url = `${base}/v1/kits/${encodeURIComponent(kind)}`;
  let answer;
  try {
    answer = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (why) {
    throw new Error(`--kit ${kind}: the platform did not answer at ${url} (${why.message}) — pass --api, or a file: --kit <file>`);
  }
  if (answer.status === 404) {
    let kinds = '';
    try {
      const list = await (await fetch(`${base}/v1/kits`)).json();
      kinds = ` — the kits are ${list.kits.map((one) => one.kind).join(', ')}`;
    } catch {
      // The list is a courtesy; the refusal stands without it.
    }
    throw new Error(`--kit ${kind}: the platform has no kit of that kind${kinds}`);
  }
  if (!answer.ok) throw new Error(`--kit ${kind}: the platform answered ${answer.status} at ${url}`);
  const body = await answer.json();
  const kit = checkKit(body.kit, kind);
  kit.version = body.version;
  return kit;
}

/**
 * A kit by its kind or by a file, whichever the argument is.
 * @param {string} asked
 * @param {string} [api]
 */
export async function loadKit(asked, api) {
  // A file is a file: a folder that happens to share the kind's name — a
  // project called `salon`, run beside `--kit salon` — is not a kit, and
  // reading it failed with EISDIR.
  if (asked.endsWith('.json') || (existsSync(resolve(asked)) && statSync(resolve(asked)).isFile())) return readKit(asked);
  if (/^[a-z][a-z_]*$/.test(asked)) return fetchKit(asked, api);
  throw new Error(`--kit ${asked} is neither a kit's kind nor a file`);
}

/**
 * A kit checked for the shape this lays out, wherever it came from: a wrong
 * file stops here with its name rather than as a broken catalogue.
 * @param {any} kit
 * @param {string} from
 */
export function checkKit(kit, from) {
  const bookings = kit?.catalogue?.modules?.bookings;
  if (typeof kit?.kind !== 'string' || !/^[a-z][a-z_]*$/.test(kit.kind)
    || !Array.isArray(kit.catalogue?.blocks) || !Array.isArray(kit.catalogue?.collections)
    || typeof bookings?.services !== 'string' || typeof bookings?.resources !== 'string'
    || typeof kit.settings !== 'object' || !Array.isArray(kit.entries)) {
    throw new Error(`--kit ${from} is not a kit — save the JSON under «The kit, whole» on the kit's page, jtakeit:///kits/<kind>.md`);
  }
  const services = kit.catalogue.collections.find((one) => one.name === bookings.services);
  if (!services || services.pages !== false) {
    throw new Error(`--kit ${from}: its services are not a collection without pages, and the booking page is their listing`);
  }
  for (const entry of kit.entries) {
    if (!kit.catalogue.collections.some((one) => one.name === entry.collection)) {
      throw new Error(`--kit ${from}: the entry "${entry.slug}" is in "${entry.collection}", which the kit does not declare`);
    }
  }
  return kit;
}

/** The language a kit's words are taken in: the site's, or English where the kit has not got it. */
export function kitLanguage(locale) {
  const lang = String(locale ?? '').slice(0, 2);
  return ['uk', 'en', 'de', 'ru', 'es', 'it', 'pt', 'fr'].includes(lang) ? lang : 'en';
}

/**
 * The diary's settings for a kit, as `jtk/bookings.json` holds them: one
 * block of type `bookings_config`, `page` at the services' listing, and
 * which kit and which version they came from.
 * @param {any} kit
 */
export function kitSettings(kit) {
  const services = kit.catalogue.collections.find((one) => one.name === kit.catalogue.modules.bookings.services);
  return {
    type: 'bookings_config', v: 1, ...kit.settings, page: services.prefix,
    kit: kit.kind, ...(kit.version ? { kit_version: kit.version } : {}),
  };
}

/**
 * The kit's entries as content documents, one per file, in the site's
 * language: `[path, document]` pairs, the path relative to `jtk/content`.
 * @param {any} kit
 * @param {string} locale
 */
export function kitEntries(kit, locale) {
  const lang = kitLanguage(locale);
  return kit.entries.map((entry, i) => {
    const collection = kit.catalogue.collections.find((one) => one.name === entry.collection);
    const block = { _key: `kit${String(i + 1).padStart(5, '0')}`, type: collection.type, v: 1 };
    for (const [key, value] of Object.entries(entry.fields)) {
      // An object is the words per language; a list — a master's `does`, a
      // post's `tags: [{ tag }]` — is the value itself. It was read as a map
      // of languages and laid out as '' (12 October 2026), which broke the
      // listing that maps a resource's `does`.
      block[key] = Array.isArray(value) ? value : value !== null && typeof value === 'object' ? (value[lang] ?? '') : value;
    }
    const path = `${collection.prefix}/${entry.slug}`;
    const doc = { path, collection: collection.name, visible: true, seo: { title: '', description: '' }, blocks: [block] };
    return [path, doc];
  });
}

/**
 * The keys only contract 3 has, by where they are written: what the
 * platform's judge refuses in a contract-2 schema as a key it does not know
 * (JTK_E_CATALOGUE_UNREADABLE, «unknown field») — the registry's keys tagged
 * `contract:"3"`, read by its `decode2`, `contract3KeyIn` and
 * `routeWrittenOtherwise`. A field's at every depth of a list's rows, in a
 * block's fields and its asks.
 */
export const CONTRACT_3_ONLY = Object.freeze({
  catalogue: Object.freeze(['shared']),
  field: Object.freeze(['localized', 'role', 'integer', 'qualifiers', 'to', 'many', 'on_delete', 'option_defs', 'min_zero', 'max_zero']),
  collection: Object.freeze(['route', 'shown_on', 'untranslated']),
});

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** An object without the keys named, in its own order; the decoder matches a key in any case. */
const without = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key.toLowerCase())));
const fields2 = (fields) => (Array.isArray(fields)
  ? fields.map((field) => {
    if (!isObject(field)) return field;
    const out = without(field, CONTRACT_3_ONLY.field);
    if (Array.isArray(field.of)) out.of = fields2(field.of);
    return out;
  })
  : fields);

/**
 * A kit's catalogue as a contract-2 schema holds it: without contract 3's
 * keys (`CONTRACT_3_ONLY`), and nothing else changed — a kit that says none
 * of them comes back the same, key for key and in the same order.
 *
 * The platform serves a kit in contract 2's words with contract 3's on it
 * where a kit says what only contract 3 can — a person's name the same in
 * every language, `"localized": false` on the salon's masters' and the
 * clinic's doctors' title (jtakeit-core #223). Laid out on contract 3
 * (`jtk create`'s default), the upgrade's mapping carries them over; laid
 * out on contract 2, they would reach `src/content/blocks.ts` and
 * `jtk/catalogue.json`, which the platform then refuses whole — so contract
 * 2's layouts leave them out, as the platform's own `kits.Into` does.
 *
 * @param {any} catalogue a kit's `catalogue`
 */
export function catalogueIn2(catalogue) {
  if (!isObject(catalogue)) return catalogue;
  const out = without(catalogue, CONTRACT_3_ONLY.catalogue);
  if (Array.isArray(catalogue.blocks)) {
    out.blocks = catalogue.blocks.map((block) => {
      if (!isObject(block)) return block;
      const two = { ...block };
      for (const list of ['fields', 'asks']) if (Array.isArray(block[list])) two[list] = fields2(block[list]);
      return two;
    });
  }
  if (Array.isArray(catalogue.collections)) {
    out.collections = catalogue.collections.map((collection) => (isObject(collection) ? without(collection, CONTRACT_3_ONLY.collection) : collection));
  }
  return out;
}

/**
 * A kit's block types, collections and module put into a catalogue object —
 * for a site whose catalogue is `jtk/catalogue.json` rather than a
 * declaration, which is contract 2's file: the kit's in contract 2's words
 * (`catalogueIn2`). A type or a collection the catalogue already has by that
 * name is left as it is: the site's own wins.
 * @param {any} catalogue
 * @param {any} kit
 */
export function mergeKitIntoCatalogue(catalogue, kit) {
  const brought = catalogueIn2(kit.catalogue);
  const out = { contract: 2, ...catalogue };
  out.blocks = [...(out.blocks ?? [])];
  for (const block of brought.blocks) {
    if (!out.blocks.some((one) => one.type === block.type)) out.blocks.push(block);
  }
  out.collections = [...(out.collections ?? [])];
  for (const collection of brought.collections) {
    if (!out.collections.some((one) => one.name === collection.name)) out.collections.push(collection);
  }
  out.modules = { ...(out.modules ?? {}), ...brought.modules };
  return out;
}

/**
 * Lays the kit's `jtk/` files out under a repository: the settings and the
 * entries always; the catalogue too when `catalogue` is true (a site that
 * keeps `jtk/catalogue.json` by hand) — `@jtakeit/astro` writes the
 * declaration itself and passes false.
 *
 * Contract 2's files, every one, for a site on contract 2: on a contract-3
 * tree the settings are `jtk/modules/bookings.json`, an entry lives under
 * `jtk/entries/` with its id, and a `jtk/catalogue.json` beside
 * `jtk/schema.json` is a tree the platform refuses (wiki/98 §2, §16). Such a
 * tree is refused here before anything is written, rather than left half in
 * each contract — `layKit3Files` lays a kit into it.
 *
 * @param {string} target     the repository's root
 * @param {any} kit
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {boolean} [options.catalogue]
 * @returns {string[]} the files written
 */
export function layKitFiles(target, kit, { locale = 'en', catalogue = false } = {}) {
  if (contractOf(target) === 3) {
    throw new Error(
      `${join(target, 'jtk', 'schema.json')} says contract 3, and a kit is laid out in contract 2's files (jtk/catalogue.json, jtk/bookings.json, entries under jtk/content) — a contract-3 tree takes its kit in contract 3's: layKit3Files, as jtkit apply lays it`,
    );
  }
  const literal = (value) => JSON.stringify(value, null, 2);
  const written = [];
  const settingsFile = join(target, 'jtk', 'bookings.json');
  mkdirSync(dirname(settingsFile), { recursive: true });
  writeFileSync(settingsFile, `${literal({ blocks: [kitSettings(kit)] })}\n`, 'utf8');
  written.push(settingsFile);

  for (const [path, doc] of kitEntries(kit, locale)) {
    const file = join(target, 'jtk', 'content', ...path.split('/').filter(Boolean)) + '.json';
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${literal(doc)}\n`, 'utf8');
    written.push(file);
  }

  if (catalogue) {
    const file = join(target, 'jtk', 'catalogue.json');
    let had = {};
    if (existsSync(file)) {
      try { had = JSON.parse(readFileSync(file, 'utf8')); } catch (why) { throw new Error(`${file} is not JSON: ${why.message}`); }
    }
    writeFileSync(file, `${literal(mergeKitIntoCatalogue(had, kit))}\n`, 'utf8');
    written.push(file);
  }
  return written;
}

// ── contract 3 ─────────────────────────────────────────────────────────────

/**
 * A kit in contract 3's words, in memory, before anything is written — the
 * one mapping both of contract 3's layouts take (`jtk create --kit`'s
 * declaration and `jtkit apply`'s `jtk/schema.json`), and the one `jtk upgrade
 * contract-3` moves a contract-2 site by (`@jtakeit/kit/upgrade`):
 *
 *   the tables      its block types, collections and module as `tablesOf`
 *                   says them — a reference `{ to }`, `does` one reference to
 *                   many, a collection's `route` and `shown_on`, the counts a
 *                   module reads `integer`, a person's name `localized: false`
 *                   where the platform says so
 *   the documents   its settings and its rates, laid out as contract 2's files
 *                   would be and moved by `documentsOf`: the settings to
 *                   `jtk/modules/bookings.json`, `{ v, settings }`; each rate to
 *                   `jtk/entries/<collection>/<slug>.json` with a new id, its
 *                   rank and its values under `fields`, money as `{ minor }`;
 *                   the page each collection without pages is shown on,
 *                   `jtk/pages/<prefix>.json`, with a new id
 *
 * @param {any} kit
 * @param {{ locale: string; lang?: string; ownListings?: Set<string> }} how
 *   `locale`: the site's language, the kit's words taken in it; `lang`: the
 *   same as the schema spells it, `locale` by default; `ownListings`: the
 *   prefixes the repository lists at itself (`@jtakeit/astro` reads its pages)
 * @returns {{ blocks: any[]; collections: any[]; modules: Record<string, any>; write: Record<string, any>; questions: { what: string; where: string; ask: string }[]; refused?: string }}
 */
export function kitIn3(kit, { locale, lang = locale, ownListings = new Set() }) {
  const declared = { LOCALE: lang, LOCALES: [], BLOCKS: kit.catalogue.blocks, COLLECTIONS: kit.catalogue.collections, MODULES: kit.catalogue.modules ?? {} };
  const made = tablesOf(declared, { ownListings });
  if (made.refused) return { blocks: [], collections: [], modules: {}, write: {}, questions: [], refused: made.refused };
  const { BLOCKS: blocks, COLLECTIONS: collections, MODULES: modules } = made.tables;

  // The settings and the rates, as contract 2's files hold them, then moved.
  const files = { '/jtk/bookings.json': { blocks: [kitSettings(kit)] } };
  const order = {};
  for (const [path, doc] of kitEntries(kit, locale)) {
    const file = `/jtk/content${path}.json`;
    files[file] = doc;
    (order[doc.collection] ??= []).push(file);
  }
  const moved = documentsOf(files, {
    from: { locale: lang, blocks: kit.catalogue.blocks, collections: kit.catalogue.collections, modules: kit.catalogue.modules ?? {} },
    to: { contract: 3, locale: lang, blocks, collections, modules },
    order,
  });
  return { blocks, collections, modules, write: moved.write, questions: [...made.questions, ...moved.questions] };
}

/** contract 2's files, by their place under `jtk/`: a tree holding one is a contract-2 site. */
const CONTRACT_2_FILES = ['catalogue.json', 'content', 'bookings.json'];
/** contract 3's documents, by their place under `jtk/`: a tree holding one has a contract-3 site's content. */
const CONTRACT_3_FILES = ['pages', 'entries', 'modules'];

/**
 * Which contract a kit is laid into a tree on: 3 where `jtk/schema.json`
 * says contract 3; 2 where the tree holds contract 2's files and no schema;
 * and, where it holds neither — a new site — 3, the latest, as every way a
 * new site is made defaults to (the owner, 12 November 2026). A tree that is
 * neither cleanly — a `jtk/schema.json` that says another contract, both
 * schemas, contract 3's documents with no schema to say them — is refused
 * with the sentence of what is wrong, and nothing is written.
 *
 * @param {string} target the repository's root
 * @returns {{ contract: 2 | 3; fresh?: boolean; refused?: undefined } | { refused: string; contract?: undefined; fresh?: undefined }}
 */
export function treeOf(target) {
  const at = (name) => join(target, 'jtk', name);
  if (existsSync(at('schema.json'))) {
    if (contractOf(target) !== 3) {
      return { refused: `${at('schema.json')} does not say "contract": 3 — it is contract 3's file, and nothing reads it as another contract's (JTK_E_CONTRACT_UNKNOWN); write "contract": 3 in it, or remove it on a contract-2 site, whose schema is jtk/catalogue.json` };
    }
    if (existsSync(at('catalogue.json'))) {
      return { refused: `${at('catalogue.json')} is contract 2's schema, beside contract 3's jtk/schema.json, and the platform refuses a tree with both (wiki/98 §16) — remove it (git rm jtk/catalogue.json), then lay the kit in` };
    }
    return { contract: 3 };
  }
  if (CONTRACT_2_FILES.some((name) => existsSync(at(name)))) return { contract: 2 };
  const three = CONTRACT_3_FILES.filter((name) => existsSync(at(name)));
  if (three.length > 0) {
    return { refused: `${join(target, 'jtk')} holds contract 3's ${three.map((name) => `jtk/${name}/`).join(', ')} and no jtk/schema.json to say what they are — write the schema first (jtkit schema --declaration <file>, or by hand), then lay the kit into it` };
  }
  return { contract: 3, fresh: true };
}

/** The top of `jtk/schema.json`, in the order `jtkit schema` writes it. */
const SCHEMA_ORDER = ['contract', 'generator', 'locale', 'locales', 'blocks', 'page_seo', 'shared', 'collections', 'modules'];

/** An object with `key` set: where it was, or where the schema's order puts it among the keys there. */
function withKey(object, key, value) {
  if (Object.hasOwn(object, key)) return { ...object, [key]: value };
  const rank = SCHEMA_ORDER.indexOf(key);
  const out = {};
  let placed = false;
  for (const [one, held] of Object.entries(object)) {
    if (!placed && SCHEMA_ORDER.indexOf(one) > rank) {
      out[key] = value;
      placed = true;
    }
    out[one] = held;
  }
  if (!placed) out[key] = value;
  return out;
}

const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** The site's language and another one said for it: the same where they are the same language. */
const sameLanguage = (a, b) => String(a).split('-')[0].toLowerCase() === String(b).split('-')[0].toLowerCase();

/**
 * Lays a kit into a contract-3 tree — or a new one, which is contract 3's —
 * for a site on another generator, which has no declaration for `jtk create`
 * to write into (`jtkit apply`). The kit in contract 3's words (`kitIn3`),
 * then:
 *
 *   jtk/schema.json   the kit's block types, collections and module put beside
 *                     the site's own, which are never written over: one the
 *                     site declares by a kit's name is kept where it is the
 *                     same, and refused where it is not. A new tree's schema is
 *                     the kit's, in the site's language (`locale`, English by
 *                     default), signed by this package. Judged as the
 *                     platform's judge of contract 3 judges it (judge3.mjs)
 *                     before a file is written.
 *   jtk/modules/bookings.json, jtk/entries/<collection>/<slug>.json
 *                     written where there is none — or, for the settings, the
 *                     empty one `jtkit schema` seeds; a site's own is refused,
 *                     not written over
 *   jtk/pages/<prefix>.json
 *                     the page each collection without pages is shown on, with
 *                     a new id — or the site's own page there, kept as it is,
 *                     its id with it
 *
 * The kit's words are in the site's language: `jtk/schema.json`'s `locale` on
 * a tree that has one, and a `locale` that says another language is refused.
 * Everything wrong is said at once, in one error, and nothing is written.
 *
 * @param {string} target the repository's root
 * @param {any} kit
 * @param {{ locale?: string }} [options] the site's language, for a tree with no schema yet
 * @returns {{ written: string[]; questions: { what: string; where: string; ask: string }[] }}
 */
export function layKit3Files(target, kit, { locale } = {}) {
  const tree = treeOf(target);
  if (tree.refused) throw new Error(tree.refused);
  if (tree.contract !== 3) {
    throw new Error(`${join(target, 'jtk')} holds a contract-2 site (${CONTRACT_2_FILES.map((name) => `jtk/${name}`).join(', ')}), and contract 3's files beside them are a tree the platform refuses (wiki/98 §16) — layKitFiles lays its kit out in contract 2's; or move it first with jtk upgrade contract-3`);
  }
  const literal = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const schemaFile = join(target, 'jtk', 'schema.json');
  const page = `jtakeit:///kits/${kit.kind}.md`;

  // The site's language: the schema's, or the one asked for a new site.
  let had;
  if (!tree.fresh) {
    try {
      had = JSON.parse(readFileSync(schemaFile, 'utf8'));
    } catch (why) {
      throw new Error(`${schemaFile} is not JSON: ${why.message}`);
    }
  }
  const said = locale === undefined ? undefined : canonicalLocale(locale);
  if (locale !== undefined && said === null) throw new Error(`--locale: «${locale}» is not a language — two letters, or two and a region (de-CH)`);
  let lang;
  if (had !== undefined) {
    lang = canonicalLocale(had.locale) ?? (typeof had.locale === 'string' ? had.locale : said ?? 'en');
    if (said !== undefined && typeof had.locale === 'string' && !sameLanguage(said, had.locale)) {
      throw new Error(`${schemaFile} says the site's language is ${had.locale}, and --locale says ${locale}: a kit's words are taken in the site's own language — leave --locale out; another language is a translation beside each original`);
    }
  } else lang = said ?? 'en';

  const laid = kitIn3(kit, { locale: lang });
  if (laid.refused) throw new Error(`the «${kit.kind}» kit cannot be put in contract 3's words: ${laid.refused}`);

  // The kit's tables beside the site's own, which are never written over.
  const clashes = [];
  let schema = had ?? { contract: 3, generator: `@jtakeit/kit@${TOOL_VERSION}`, locale: lang, blocks: [] };
  const blocks = Array.isArray(schema.blocks) ? [...schema.blocks] : [];
  for (const block of laid.blocks) {
    const own = blocks.find((one) => isRecord(one) && one.type === block.type);
    if (own === undefined) blocks.push(block);
    else if (!same(own, block)) clashes.push(`the block type «${block.type}»`);
  }
  const collections = Array.isArray(schema.collections) ? [...schema.collections] : [];
  for (const collection of laid.collections) {
    const own = collections.find((one) => isRecord(one) && one.name === collection.name);
    if (own === undefined) collections.push(collection);
    else if (!same(own, collection)) clashes.push(`the collection «${collection.name}»`);
  }
  const modules = isRecord(schema.modules) ? { ...schema.modules } : {};
  for (const [name, roles] of Object.entries(laid.modules)) {
    if (modules[name] === undefined) modules[name] = roles;
    else if (!same(modules[name], roles)) {
      const on = isRecord(modules[name]) ? ` (${Object.entries(modules[name]).map(([role, collection]) => `${role} ${JSON.stringify(collection)}`).join(', ')})` : '';
      clashes.push(`the module «${name}»${on}`);
    }
  }
  schema = withKey(schema, 'blocks', blocks);
  if (collections.length > 0) schema = withKey(schema, 'collections', collections);
  if (Object.keys(modules).length > 0) schema = withKey(schema, 'modules', modules);

  // The documents where there are none: a site's own is never written over.
  const files = [];
  const taken = [];
  for (const [file, doc] of Object.entries(laid.write)) {
    const at = join(target, ...file.split('/').filter(Boolean));
    if (!existsSync(at)) {
      files.push([at, doc]);
      continue;
    }
    // The page a collection is shown on: the site's own, kept, its id with it.
    if (file.startsWith('/jtk/pages/')) continue;
    let held;
    try {
      held = JSON.parse(readFileSync(at, 'utf8'));
    } catch {
      held = undefined;
    }
    // The settings `jtkit schema` seeds empty for a module it turns on: not yet anybody's.
    if (file.startsWith('/jtk/modules/') && isRecord(held) && isEmpty(held.settings)) {
      files.push([at, doc]);
      continue;
    }
    taken.push(file.slice(1));
  }

  if (clashes.length > 0 || taken.length > 0) {
    const told = [
      clashes.length > 0 ? `jtk/schema.json declares ${clashes.join(', ')} of its own, by the kit's names, and not as the kit does` : '',
      taken.length > 0 ? `${taken.join(', ')} ${taken.length === 1 ? 'is' : 'are'} there already, the site's own` : '',
    ].filter(Boolean);
    throw new Error(
      `the «${kit.kind}» kit cannot be laid into ${join(target, 'jtk')}: ${told.join('; and ')} — a kit is laid in beside what a site has, never over it: rename the site's, or lay the kit out by hand from its page (${page}); nothing was written`,
    );
  }

  // Judged before anything is written, as the platform's judge of contract 3 will.
  const text = literal(schema);
  const findings = judgeSchema(text);
  if (findings.length > 0) {
    const before = had === undefined ? [] : judgeSchema(literal(had));
    const already = findings.every((one) => before.some((two) => two.code === one.code && two.path === one.path));
    throw new Error(
      `${already ? `${schemaFile} is not one the platform accepts as it stands, before the kit` : `jtk/schema.json with the «${kit.kind}» kit in it is not one the platform accepts`} — nothing was written:\n` +
        findings.map((one) => `  ✗ ${one.code}  ${one.path || '(the file)'}: ${one.says}`).join('\n'),
    );
  }

  const written = [];
  mkdirSync(dirname(schemaFile), { recursive: true });
  writeFileSync(schemaFile, text, 'utf8');
  written.push(schemaFile);
  for (const [at, doc] of files) {
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, literal(doc), 'utf8');
    written.push(at);
  }
  return { written, questions: laid.questions };
}

/**
 * `jtkit apply`: a kit laid into whatever the tree is (`treeOf`) — contract
 * 3's files on a new tree and on a contract-3 one (`layKit3Files`); contract
 * 2's on a site made before contract 3 and not moved yet, exactly as they
 * always were but without the keys only contract 3 has (`layKitFiles`, the
 * catalogue with them).
 *
 * @param {string} target the repository's root
 * @param {any} kit
 * @param {{ locale?: string }} [options] the site's language: a new tree's, or a contract-2 tree's (English by default)
 * @returns {{ contract: 2 | 3; written: string[]; questions: { what: string; where: string; ask: string }[] }}
 */
export function applyKit(target, kit, { locale } = {}) {
  const tree = treeOf(target);
  if (tree.refused) throw new Error(tree.refused);
  if (tree.contract === 2) return { contract: 2, written: layKitFiles(target, kit, { locale, catalogue: true }), questions: [] };
  return { contract: 3, ...layKit3Files(target, kit, { locale }) };
}
