/**
 * The door, reading contract 3 (wiki/98 of the platform) behind the interface
 * a template already writes against.
 *
 *   jtk/schema.json                      { "contract": 3, "locale": "de", "locales": ["en"], … }
 *   jtk/pages/index.json                 the home, `/`
 *   jtk/pages/prices.json                a page, `/prices`; its English beside it, prices.en.json
 *   jtk/entries/works/vase.json          an entry; its English beside it, vase.en.json
 *   jtk/shared.json, shared.en.json      the shared text
 *   jtk/modules/bookings.json            a module's settings, { v, settings }
 *   jtk/site.json                        the platform's facts, `currency` at the top
 *
 * `content(files)` in index.mjs hands a tree here when its `jtk/schema.json`
 * says `contract: 3`. Nothing a template calls changes: `site.page`,
 * `site.entries`, `block`, `text`, `picture`, `rows` and `at` are the same
 * functions, and they hand back the same shapes. What differs is underneath.
 *
 * ── what contract 3 changes, and what the door does with it ─────────────────
 *
 * **The directory is the kind** (§2). A page lives under `jtk/pages/` at its
 * path, an entry under `jtk/entries/<collection>/` by its slug, a module's
 * settings under `jtk/modules/`. A page keeps `path` in its file; an entry
 * keeps `collection` and `slug`. Where a file written by hand leaves one out,
 * its place says it — the platform's import refuses such a file, and the door
 * reads rather than judges.
 *
 * **A translation sits beside its original and holds only its words** (§4.4).
 * `prices.en.json` says `of` (the original's id) and `locale`, and carries
 * only the localized values, each block and row matched by `_key`, never by
 * place. The door lays it over the original: what the translation says, the
 * page says; what it does not say — a value nobody translated, or one that
 * is the same in every language, such as a price or a photograph — is the
 * original's. Each value remembers which of the two it came from
 * (`fromBase`), so a page can give the original's words the original's
 * `lang`. An entry's body is the exception: it is whole per language (a
 * German post may have a paragraph the English one lacks), so a translation
 * with a body of its own replaces the original's, and one without shows it.
 *
 * **An entry's own values are under `fields`** (§4.2), its body in `blocks`.
 * The entry is no longer `blocks[0]` of its document, so on its own page its
 * title is annotated `title`, not `blocks[0].title`.
 *
 * **Annotations name a key and an id** (§5), never a place or an address:
 * `blocks[hero].title`, `blocks[faq].items[r7k2].answer`, `title` on an
 * entry's own page, `entry:<id>:title` and `page:<id>:blocks[hero].title`
 * from elsewhere, `shared:blocks[contacts].phone`, `module:bookings:hours[h1].opens`,
 * and a picture by its part, `blocks[hero].image.src` and `.alt`. A value
 * that cannot be named so — a block or a row without a `_key`, a document
 * without an id, a place deeper than the grammar goes — is annotated nowhere
 * rather than by a place the platform's parser would refuse.
 *
 * **An address comes from the collection's `route`** (§3.5):
 * `{ detail: "/works/{slug}", listing?: "/works", per_page? }`, a pattern per
 * language where the address differs by more than the language, or `"none"`
 * for a collection shown only on other pages — its `shown_on`,
 * `["/prices#{slug}"]`, says where.
 *
 * **Values are typed** (§3.4): money `{ minor, from?, on_request? }`, a
 * picture `{ src, alt?, focus?, poster? }`, a gallery's pictures and a list's
 * rows each with a `_key`, a reference an entry's id (an array of them where
 * the field says `many`), a select's options `[{ value, label }]`. Empty is
 * absent: `null`, `""` and `[]` are no value, as in contract 2 (§1, 6).
 *
 * ── the schema, as a template reads it ──────────────────────────────────────
 *
 * The door hands out a field's declaration in the shape the interface has
 * always declared (types/content.d.ts), so a template that reads
 * `field.options`, `field.option_labels` or `field.ref` reads them the same
 * on either contract: a select's `[{ value, label }]` becomes `options` and
 * `option_labels`, and a reference's `{ to, many }` becomes `to` and `many`,
 * with `ref` the one collection where `to` names one. The rest of a
 * declaration is passed as the schema writes it.
 *
 * Imports nothing outside the kit's content and money: the door runs in a
 * Vite build, in Node and in a test alike.
 */
import { money as priced } from '../money.mjs';
import { shownAt } from '../schedule.mjs';
import { ancestors, capped, descendants, grouped, groupField, selectHeadings } from './groups.mjs';
import { canonicalLocale, baseAddressOf, inLocale, languagesOf, localeArg, localeOfAddress, sharedLocaleOf } from './locale.mjs';
import { byRank, labelWords, specimenId, tappable } from './rules.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Empty is absent: `null`, `""` and `[]` (wiki/98 §1, 6, "readers fold them
 * to absent"). Whitespace-only text is folded by the platform's import
 * (§4.7), so a file never holds it, and the door keeps contract 2's reading
 * of it — the specimens are drawn with a space precisely so that it is a
 * value.
 */
function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

const str = (value) => (typeof value === 'string' ? value : '');

// ── the annotation grammar (wiki/98 §5) ────────────────────────────────────
//
//   annotation := [ document ":" ] place
//   document   := "shared" | "page:" ID | "entry:" ID | "module:" NAME
//   place      := [ "blocks[" KEY "]." ] value
//   value      := FIELD ( "[" KEY "]." FIELD ){0,2} [ "." PART ]
//
// The door writes nothing the grammar does not parse: a key or a field that
// does not match it is annotated nowhere. The grammar leaves ID and NAME
// open; an id is the platform's UUID, so letters, digits and hyphens, and a
// module's name is a word like a field's.
const KEY = /^[a-z][a-z0-9-]{0,31}$/;
const FIELD = /^[a-z][a-z0-9_]{0,39}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const PARTS = new Set(['src', 'alt', 'focus', 'poster']);
/** How many `[KEY].FIELD` steps a value may take: a row, and a row inside a row's list (M5). */
const DEEPEST_STEP = 2;

/** The keys of an object the schema does not shape (§4.7): never laid from a translation. */
const RESERVED = new Set(['_key', '_orphans', 'type', 'v', 'view']);

/** The kinds whose words are per language unless a field says `localized: false` (§3.3). */
const WORDS = new Set(['text', 'textarea', 'richtext_lite', 'markdown']);

/** A translation's file name: `prices.en.json`, `vase.de-CH.json`. A path never has a dot (`[a-z0-9-]`), so the dot is the language's. */
const TRANSLATION = /^(.+)\.([A-Za-z]{2}(?:-[A-Za-z]{2})?)$/;

/**
 * A field's declaration in the shape the interface declares (the header's
 * "the schema, as a template reads it"): options as `options` and
 * `option_labels`, a reference as `to`, `many` and — where it names one
 * collection — `ref`.
 */
function asDeclared(field) {
  if (!isObject(field)) return field;
  const out = { ...field };
  if (isObject(field.ref)) {
    const to = Array.isArray(field.ref.to) ? field.ref.to.filter((one) => typeof one === 'string' && one !== '') : [];
    out.to = to;
    out.many = field.ref.many === true;
    if (to.length === 1) out.ref = to[0];
    else delete out.ref;
  } else if (typeof field.ref === 'string' && field.ref !== '') {
    out.to = [field.ref];
    out.many = false;
  }
  if (Array.isArray(field.options) && field.options.some(isObject)) {
    const options = [];
    const labels = {};
    for (const one of field.options) {
      const value = isObject(one) ? one.value : one;
      if (typeof value !== 'string' || value === '') continue;
      options.push(value);
      if (isObject(one) && !isEmpty(one.label)) labels[value] = one.label;
    }
    out.options = options;
    if (Object.keys(labels).length > 0) out.option_labels = labels;
    else delete out.option_labels;
  }
  if (Array.isArray(field.of)) out.of = field.of.map(asDeclared);
  return out;
}

/** A block type with its fields (and a collecting block's asks) as a template reads them. */
function typeDeclared(type) {
  const out = { ...type, fields: Array.isArray(type.fields) ? type.fields.map(asDeclared) : [] };
  if (Array.isArray(type.asks)) out.asks = type.asks.map(asDeclared);
  return out;
}

/**
 * How a translation is laid over the original for one field (§3.3 `localized`, §3.4):
 *
 *   'whole'   the translation's value, where it has one: the text kinds, and
 *             a picture, a link or a list that says `localized: true`;
 *   'shared'  always the original's: a number, a price, a date, a reference —
 *             "the translation of a shared value is the base, everywhere";
 *   'media'   one picture: the original's file, its focus and poster, the
 *             translation's words (`alt`);
 *   'gallery' the original's pictures, each with the translation's words, by `_key`;
 *   'rows'    the original's rows, each laid over by the row of the same `_key`.
 */
function layOf(field) {
  const said = typeof field.localized === 'boolean' ? field.localized : undefined;
  if (field.kind === 'media') {
    if (said === true) return 'whole';
    return field.multiple === true ? 'gallery' : 'media';
  }
  if (field.kind === 'list') return said === true ? 'whole' : 'rows';
  if (WORDS.has(field.kind)) return said === false ? 'shared' : 'whole';
  if (field.kind === 'url') return said === true ? 'whole' : 'shared';
  return 'shared';
}

/**
 * Which keys of a laid object the translation gave: the one record of "came
 * from the base" (§4.4), kept beside the values rather than inside them so
 * that a value reads exactly as its file wrote it.
 * @type {WeakMap<object, Set<string>>}
 */
const GIVEN = new WeakMap();

/**
 * One object — a block, a row, an entry's `fields` — with a translation laid
 * over it, by the declaration of its fields. The original's keys are kept
 * whatever the translation says; the translation's words replace the
 * original's where it has them (an empty one is none, and leaves the
 * original's).
 *
 * A key the schema does not declare is taken from the translation where it
 * has one: the platform's judge refuses such a key, and until it does the
 * door shows what was written rather than guessing it is shared.
 *
 * @param {Record<string, unknown>} base
 * @param {unknown} over the translation's object at the same place, or nothing
 * @param {any[]} fields
 */
function lay(base, over, fields) {
  const out = { ...base };
  const given = new Set();
  const theirs = isObject(over) ? over : {};
  const declared = new Set();
  for (const field of fields) {
    if (!isObject(field) || typeof field.key !== 'string') continue;
    const key = field.key;
    declared.add(key);
    const mine = theirs[key];
    const how = layOf(field);
    if (how === 'whole') {
      if (!isEmpty(mine)) {
        out[key] = mine;
        given.add(key);
      }
    } else if (how === 'media') {
      const own = base[key];
      if (isObject(own) && isObject(mine) && !isEmpty(mine.alt)) {
        out[key] = { ...own, alt: mine.alt };
        given.add(key);
      }
    } else if (how === 'gallery' || how === 'rows') {
      const list = base[key];
      if (!Array.isArray(list)) continue;
      const byKey = new Map();
      for (const one of Array.isArray(mine) ? mine : []) {
        if (isObject(one) && typeof one._key === 'string' && !byKey.has(one._key)) byKey.set(one._key, one);
      }
      let any = false;
      out[key] = list.map((row) => {
        if (!isObject(row)) return row;
        const match = typeof row._key === 'string' ? byKey.get(row._key) : undefined;
        if (how === 'gallery') {
          if (match === undefined || isEmpty(match.alt)) return row;
          any = true;
          return { ...row, alt: match.alt };
        }
        if (match !== undefined) any = true;
        return lay(row, match, Array.isArray(field.of) ? field.of : []);
      });
      if (any) given.add(key);
    }
  }
  for (const [key, mine] of Object.entries(theirs)) {
    if (declared.has(key) || RESERVED.has(key) || isEmpty(mine)) continue;
    out[key] = mine;
    given.add(key);
  }
  GIVEN.set(out, given);
  return out;
}

/** The blocks of a document's file, each kept where it is: a block that is not an object reads as empty. */
const blocksIn = (raw) => (Array.isArray(raw?.blocks) ? raw.blocks.map((one) => (isObject(one) ? one : {})) : []);

/** The SEO of a document in a language: the original's, the translation's words over it. */
function seoOf(raw, over) {
  const out = { ...(isObject(raw?.seo) ? raw.seo : {}) };
  if (isObject(over?.seo)) {
    for (const [key, value] of Object.entries(over.seo)) if (!isEmpty(value)) out[key] = value;
  }
  return out;
}

/** An address with its language put before it, the anchor after: `/prices#{slug}` → `/de/prices#{slug}`. */
function inLocaleKeepingAnchor(language, address) {
  const at = address.indexOf('#');
  if (at === -1) return inLocale(language, address);
  return `${inLocale(language, address.slice(0, at) || '/')}${address.slice(at)}`;
}

/** The address a pattern's `{slug}` stands under: `/works/{slug}` → `/works`. */
function directoryOf(pattern) {
  const at = pattern.indexOf('{slug}');
  const head = at === -1 ? pattern : pattern.slice(0, at);
  return head.replace(/\/+$/, '') || '/';
}

const isPattern = (pattern) =>
  (typeof pattern === 'string' && pattern !== '') || (isObject(pattern) && Object.values(pattern).some((one) => typeof one === 'string' && one !== ''));

/**
 * A collection's `route` as the door reads it: `"none"`, or `{ detail,
 * listing?, per_page? }` with each pattern a string or one per language.
 *
 * A collection that says no route at all has none: wiki/98 §3.5 gives the
 * two forms and no default, and an address the door made up would be one no
 * page of the platform's knows. Its entries are shown where `shown_on` says,
 * or nowhere.
 */
function routeOf(route) {
  if (route === 'none' || !isObject(route) || !isPattern(route.detail)) return 'none';
  const out = { detail: route.detail };
  if (isPattern(route.listing)) out.listing = route.listing;
  if (typeof route.per_page === 'number') out.per_page = route.per_page;
  return out;
}

/** A key the specimens' block is known by: its type, spelt as a key (`priced_list` → `priced-list`). */
function specimenKey(type) {
  const key = type.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '');
  return (key === '' ? 'specimen' : key).slice(0, 32);
}

/**
 * Read a contract-3 site.
 *
 * @param {Map<string, unknown>} byPath every file under `jtk/`, keyed `/jtk/…`
 * @param {string[]} names the same keys, sorted byte for byte
 * @param {{ annotate: boolean; now: number }} options
 */
export function contract3(byPath, names, { annotate, now }) {
  const schema = /** @type {any} */ (byPath.get('/jtk/schema.json'));
  const siteFile = isObject(byPath.get('/jtk/site.json')) ? /** @type {any} */ (byPath.get('/jtk/site.json')) : {};
  // The schema's `locale` is the one source of the base language (§3.1);
  // `site.json` stops carrying it, and is read only by a tree whose schema
  // has not said one yet.
  const { base, others } = languagesOf(schema, siteFile);
  const every = ['', ...others];
  const langOf = (locale) => (locale === '' ? base : locale);
  const want = (locale) => localeArg(locale, base);
  const words = labelWords(base, others, want);
  const served = (language) => every.includes(language);

  const types = Array.isArray(schema.blocks) ? schema.blocks.filter(isObject).map(typeDeclared) : [];
  const typeOf = (name) => types.find((one) => one.type === name);

  // ── the schema's collections ─────────────────────────────────────────────

  /** @type {Map<string, any>} */
  const collections = new Map();
  for (const one of Array.isArray(schema.collections) ? schema.collections.filter(isObject) : []) {
    if (typeof one.name !== 'string' || collections.has(one.name)) continue;
    const type = typeOf(one.type);
    const route = routeOf(one.route);
    const collection = {
      name: one.name,
      label: one.label,
      one: one.one,
      intro: one.intro,
      icon: one.icon,
      type: one.type,
      fields: type?.fields ?? [],
      pages: route !== 'none',
      listing: route !== 'none' && route.listing !== undefined,
      per_page: route !== 'none' ? route.per_page : undefined,
      order: isObject(one.order) && typeof one.order.by === 'string' && one.order.by !== '' && one.order.by !== 'manual'
        ? { by: one.order.by, desc: one.order.desc === true }
        : 'manual',
      group: typeof one.group === 'string' && one.group !== '' ? one.group : undefined,
      // `body` in contract 2: the block types an entry may hold below its own.
      blocks: Array.isArray(one.blocks) ? one.blocks : [],
      route,
      shown_on: Array.isArray(one.shown_on) ? one.shown_on.filter(isPattern) : [],
      // What a language without a translation does with an entry (§3.5,
      // 95 §2): shows the original (`base`, the default) or leaves it out.
      untranslated: one.untranslated === 'hide' ? 'hide' : 'base',
      prefix: '',
    };
    collections.set(one.name, collection);
    // Contract 2's word for where a collection's entries live, kept for a
    // template that reads it: the listing in the site's own language, else
    // the directory the detail pattern puts them in, else the page a
    // collection without a route is shown on.
    collection.prefix = listingIn(collection, '');
  }

  /**
   * A pattern in a language (§3.5): a language's own pattern as it is
   * written — the developer wrote the whole address, `/werke/{slug}` — and
   * otherwise the one pattern, or the base language's, with the language put
   * before it, as every other address of the site has it (`/de/works/{slug}`).
   * wiki/98 says "a pattern may be per language … otherwise the language
   * prefix is put before it", read here as: a pattern given for a language
   * is that language's address whole.
   */
  function patternIn(pattern, language) {
    if (typeof pattern === 'string') return inLocaleKeepingAnchor(language, pattern);
    if (!isObject(pattern)) return undefined;
    const byTag = new Map();
    for (const [tag, one] of Object.entries(pattern)) {
      const canonical = canonicalLocale(tag);
      if (canonical !== null && typeof one === 'string' && one !== '' && !byTag.has(canonical)) byTag.set(canonical, one);
    }
    const own = byTag.get(langOf(language));
    if (own !== undefined) return own;
    const fallback = byTag.get(base);
    return fallback === undefined ? undefined : inLocaleKeepingAnchor(language, fallback);
  }

  /** An entry's page in a language: the detail pattern with its slug. */
  function addressIn(collection, language, slug) {
    if (collection === undefined || collection.route === 'none') return undefined;
    return patternIn(collection.route.detail, language)?.replaceAll('{slug}', slug);
  }

  /** Where an entry is shown besides its own page: the first of `shown_on`, with its slug. */
  function anchorIn(collection, language, slug) {
    const place = collection?.shown_on[0];
    return place === undefined ? undefined : patternIn(place, language)?.replaceAll('{slug}', slug);
  }

  /** A collection's listing in a language, page one (see `prefix` above for the order asked in). */
  function listingIn(collection, language) {
    if (collection.route === 'none') {
      const place = collection.shown_on[0] === undefined ? undefined : patternIn(collection.shown_on[0], language);
      return place === undefined ? inLocale(language, `/${collection.name}`) : place.split('#')[0] || '/';
    }
    const listing = collection.route.listing === undefined ? undefined : patternIn(collection.route.listing, language);
    if (listing !== undefined) return listing;
    const detail = patternIn(collection.route.detail, language);
    return detail === undefined ? inLocale(language, `/${collection.name}`) : directoryOf(detail);
  }

  // ── the documents ────────────────────────────────────────────────────────
  //
  // The originals first, then each translation laid beside the one it says
  // it is `of` — by the original's id, or, where it names none, by the file
  // it sits beside. A translation in a language the site does not have, or
  // of nothing, is nobody's and is left out.

  /** @type {any[]} */
  const pageFiles = [];
  /** @type {any[]} */
  const entryFiles = [];
  const translations = [];
  for (const name of names) {
    const kind = name.startsWith('/jtk/pages/') ? 'page' : name.startsWith('/jtk/entries/') ? 'entry' : undefined;
    if (kind === undefined || !name.endsWith('.json')) continue;
    const rel = name.slice((kind === 'page' ? '/jtk/pages/' : '/jtk/entries/').length, -'.json'.length);
    const parts = rel.split('/');
    // The pictures a build downloads beside a document are not documents;
    // an entry is `<collection>/<slug>.json` and nothing deeper.
    if (parts.includes('media') || parts.includes('') || (kind === 'entry' && parts.length !== 2)) continue;
    const raw = byPath.get(name);
    if (!isObject(raw)) continue;
    const last = parts[parts.length - 1];
    const tagged = TRANSLATION.exec(last);
    if (tagged !== null || typeof raw.of === 'string') {
      // Its language is its `locale`, which §4.3 requires of a translation;
      // its file name says the same where the key is missing.
      const tag = canonicalLocale(raw.locale) ?? (tagged === null ? null : canonicalLocale(tagged[2]));
      const sibling = tagged === null ? undefined : `${name.slice(0, name.length - last.length - '.json'.length)}${tagged[1]}.json`;
      translations.push({ kind, file: name, raw, locale: tag === null ? undefined : want(tag), sibling });
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (kind === 'page') {
      // The page's address is its `path` (§4.1); a file without one is where
      // its place says, `index.json` the home.
      const path = typeof raw.path === 'string' && raw.path !== '' ? (raw.path.length > 1 ? raw.path.replace(/\/+$/, '') : raw.path) : rel === 'index' ? '/' : `/${rel}`;
      pageFiles.push({ kind, file: name, raw, id, path, overlays: new Map(), docs: new Map() });
    } else {
      // An entry is its `collection` and its `slug` (§4.2, §4.3), which must
      // match its directory and its file's name; where one is missing the
      // place says it.
      const collection = typeof raw.collection === 'string' && raw.collection !== '' ? raw.collection : parts[0];
      const slug = typeof raw.slug === 'string' && raw.slug !== '' ? raw.slug : last;
      entryFiles.push({ kind, file: name, raw, id, collection, slug, overlays: new Map(), docs: new Map() });
    }
  }
  {
    const byId = new Map();
    const byFile = new Map();
    for (const one of [...pageFiles, ...entryFiles]) {
      if (one.id !== '' && !byId.has(`${one.kind}:${one.id}`)) byId.set(`${one.kind}:${one.id}`, one);
      byFile.set(one.file, one);
    }
    for (const one of translations) {
      if (one.locale === undefined || !others.includes(one.locale)) continue;
      const of = typeof one.raw.of === 'string' && one.raw.of !== '' ? byId.get(`${one.kind}:${one.raw.of}`) : undefined;
      const original = of ?? (one.sibling === undefined ? undefined : byFile.get(one.sibling));
      if (original === undefined || original.overlays.has(one.locale)) continue;
      original.overlays.set(one.locale, { file: one.file, raw: one.raw });
    }
  }

  /** The shared text's files by language, the language matched in either case (as contract 2's). */
  const sharedFiles = new Map();
  for (const name of names) {
    if (!/^\/jtk\/[^/]+$/.test(name)) continue;
    const locale = sharedLocaleOf(name);
    if (locale === null) continue;
    const raw = byPath.get(name);
    const key = want(locale);
    if (!isObject(raw) || sharedFiles.has(key)) continue;
    sharedFiles.set(key, { file: name, raw });
  }

  /**
   * A document's blocks in a language: the original's, each laid over by the
   * translation's block of the same `_key`. A page's blocks are the
   * developer's structure, shared, with their words per language (§4.4): a
   * block only the translation has is not on the page, and a block without
   * a `_key` cannot be matched and keeps the original's words.
   */
  function laidBlocks(blocks, over) {
    const theirs = new Map();
    for (const one of Array.isArray(over?.blocks) ? over.blocks : []) {
      if (isObject(one) && typeof one._key === 'string' && !theirs.has(one._key)) theirs.set(one._key, one);
    }
    return blocks.map((one) => lay(one, typeof one._key === 'string' ? theirs.get(one._key) : undefined, typeOf(one.type)?.fields ?? []));
  }

  /** A page in a language: the original, and its translation laid over it. In every language the site has — a page is the developer's structure. */
  function pageDoc(file, language) {
    if (file.docs.has(language)) return file.docs.get(language);
    const over = language === '' ? undefined : file.overlays.get(language);
    const doc = {
      kind: 'page',
      file: over?.file ?? file.file,
      original: file,
      language,
      id: file.id,
      path: file.path,
      address: inLocale(language, file.path),
      seo: seoOf(file.raw, over?.raw),
      blocks: language === '' ? blocksIn(file.raw) : laidBlocks(blocksIn(file.raw), over?.raw),
      origin: language === '' ? 'own' : 'laid',
    };
    file.docs.set(language, doc);
    return doc;
  }

  /**
   * An entry in a language, or nothing where it is not in that language.
   *
   * The original, with the translation laid over its `fields`; its body the
   * translation's own where it has one, whole, and the original's where not.
   * A language with no translation shows the original — every value marked
   * as the original's — unless its collection says `untranslated: "hide"`.
   * It is out in a language when the original is (`visible`, `show_at`,
   * `hide_at`, which only the original carries) and the translation does not
   * hold the language back (`visible: false`, §4.4).
   */
  function entryDoc(file, language) {
    if (file.docs.has(language)) return file.docs.get(language);
    let doc;
    const collection = collections.get(file.collection);
    const over = language === '' ? undefined : file.overlays.get(language);
    if (served(language) && (language === '' || over !== undefined || collection?.untranslated !== 'hide')) {
      const own = isObject(file.raw.fields) ? file.raw.fields : {};
      const theirBody = over !== undefined && Array.isArray(over.raw.blocks) && over.raw.blocks.length > 0;
      const held = over?.raw.visible === false;
      const shownBy = (at) => shownAt(file.raw, at) && !held;
      doc = {
        kind: 'entry',
        file: over?.file ?? file.file,
        original: file,
        // The original's file, which holds the rank and the schedule.
        raw: file.raw,
        language,
        id: file.id,
        collection: file.collection,
        slug: over !== undefined && typeof over.raw.slug === 'string' && over.raw.slug !== '' ? over.raw.slug : file.slug,
        seo: seoOf(file.raw, over?.raw),
        fields: language === '' ? own : lay(own, over?.raw.fields, collection?.fields ?? []),
        body: theirBody ? blocksIn(over.raw) : blocksIn(file.raw),
        fieldsOrigin: language === '' ? 'own' : 'laid',
        bodyOrigin: language === '' || theirBody ? 'own' : 'base',
        specimen: false,
        shownBy,
        shown: shownBy(now),
      };
    }
    file.docs.set(language, doc);
    return doc;
  }

  // ── reading a value, and writing where it is ─────────────────────────────

  /** A document's own part of an annotation, `page:<id>:`, or nothing where it has no id to be named by. */
  const named = (kind, id) => (typeof id === 'string' && ID.test(id) ? `${kind}:${id}:` : undefined);

  /**
   * The values of one object — a block, a row, an entry's `fields`, a
   * module's settings — and the annotation of each, by key.
   *
   * @param {Record<string, unknown>} values
   * @param {{ prefix?: string; trail?: string; depth: number; fields: any[]; origin: 'own' | 'base' | 'laid' }} how
   *   `prefix`: the document's part (`''` for the page's own, `entry:<id>:`, `shared:`), nothing where
   *   the document cannot be named; `trail`: this object's place in it (`blocks[hero].`,
   *   `blocks[faq].items[r7k2].`, `''` for an entry's `fields`), nothing where it has no key;
   *   `depth`: how many `[KEY]` steps the trail took; `origin`: whose values these are — the
   *   document's own language's, all the original's, or a translation laid over the original
   */
  function reader(values, how) {
    const field = (key) => how.fields.find((one) => isObject(one) && one.key === key);
    const value = (key) => (isEmpty(values[key]) ? undefined : values[key]);
    const text = (key) => {
      const one = values[key];
      return one === undefined || one === null ? '' : typeof one === 'string' ? one : String(one);
    };
    const fromBase = (key) => {
      if (how.origin === 'own') return false;
      if (how.origin === 'base') return true;
      return !(GIVEN.get(values)?.has(key) ?? false);
    };
    /** Whether a field holds one picture: declared so, or, undeclared, holding a picture's shape. */
    const onePicture = (declared, held) =>
      declared !== undefined ? declared.kind === 'media' && declared.multiple !== true : isObject(held) && typeof held.src === 'string';
    const gallery = (declared) => declared?.kind === 'media' && declared.multiple === true;
    const path = (place) => ({ 'data-jtk-path': `${how.prefix}${place}` });
    const writable = () => annotate && how.prefix !== undefined && how.trail !== undefined;

    /** A row's `_key`, from its index or its key; an index is named by the key of the row at it. */
    const rowKeyOf = (key, row) => {
      const list = values[key];
      if (!Array.isArray(list)) return undefined;
      if (typeof row === 'number') {
        const one = list[row];
        return isObject(one) && typeof one._key === 'string' ? one._key : undefined;
      }
      if (typeof row !== 'string') return undefined;
      return list.some((one) => isObject(one) && one._key === row) ? row : undefined;
    };

    /**
     * The annotation of a value (§5). Alone, a field: `title`, and a picture
     * by its file, `image.src`. With a part and no row, a picture's part:
     * `at('image', undefined, 'alt')` → `image.alt`. With a row (its `_key`,
     * or its index, named by its key) and a field of the row: a cell,
     * `items[r7k2].title`; a gallery's picture without one is its file,
     * `pictures[g1].src`. A row alone is no place in the grammar.
     */
    const at = (key, row, part) => {
      if (!writable() || typeof key !== 'string' || !FIELD.test(key)) return {};
      const declared = field(key);
      const here = `${how.trail}${key}`;
      if (row === undefined) {
        if (part === undefined) return path(onePicture(declared, values[key]) ? `${here}.src` : here);
        if (!PARTS.has(part)) return {};
        return declared === undefined || onePicture(declared, values[key]) ? path(`${here}.${part}`) : {};
      }
      if (how.depth >= DEEPEST_STEP) return {};
      const rowKey = rowKeyOf(key, row);
      if (rowKey === undefined || !KEY.test(rowKey)) return {};
      if (part === undefined) return gallery(declared) ? path(`${here}[${rowKey}].src`) : {};
      if (typeof part !== 'string' || !FIELD.test(part)) return {};
      const list = /** @type {any[]} */ (values[key]);
      const cell = list.find((one) => isObject(one) && one._key === rowKey)?.[part];
      const sub = Array.isArray(declared?.of) ? declared.of.find((one) => isObject(one) && one.key === part) : undefined;
      // A single picture in a row is named by its file, as it is anywhere.
      return path(`${here}[${rowKey}].${part}${!gallery(declared) && onePicture(sub, cell) ? '.src' : ''}`);
    };

    return {
      text,
      value,
      field,
      tappable: (key) => tappable(field(key)),
      fromBase,
      rows(key) {
        const list = values[key];
        if (!Array.isArray(list)) return [];
        const declared = field(key);
        const of = Array.isArray(declared?.of) ? declared.of : [];
        const deeper = how.trail !== undefined && how.depth < DEEPEST_STEP;
        return list.map((row, j) => {
          const own = isObject(row) ? row : {};
          const rowKey = typeof own._key === 'string' ? own._key : undefined;
          // A row laid over by its translation answers for itself; a row of
          // a list that is whole per language is all one side's.
          const origin = how.origin !== 'laid' ? how.origin : GIVEN.has(own) ? 'laid' : fromBase(key) ? 'base' : 'own';
          return Object.assign(
            reader(own, {
              prefix: how.prefix,
              trail: deeper && rowKey !== undefined && KEY.test(rowKey) ? `${how.trail}${key}[${rowKey}].` : undefined,
              depth: how.depth + 1,
              fields: of,
              origin,
            }),
            { key: rowKey, index: j },
          );
        });
      },
      picture(key) {
        const one = values[key];
        // A picture is `{ src, alt?, focus?, poster? }`; a bare key, the
        // contract-2 shape the upgrade turns into `{ src }`, is read as one.
        const media = isObject(one) ? one : typeof one === 'string' && one !== '' ? { src: one } : {};
        // Its words are its own `alt` (§13): no `<key>_alt` beside it, and no
        // entry's title standing in — an empty alt is the owner's to fill.
        const picture = { src: str(media.src), alt: str(media.alt) };
        if (typeof media.focus === 'string' && media.focus !== '') picture.focus = media.focus;
        if (typeof media.poster === 'string' && media.poster !== '') picture.poster = media.poster;
        return { ...picture, ...at(key) };
      },
      gallery(key) {
        const list = values[key];
        if (!Array.isArray(list)) return [];
        return list.flatMap((item) => {
          if (!isObject(item) || typeof item.src !== 'string' || item.src === '') return [];
          const picture = { src: item.src, alt: str(item.alt) };
          if (typeof item.focus === 'string' && item.focus !== '') picture.focus = item.focus;
          if (typeof item.poster === 'string' && item.poster !== '') picture.poster = item.poster;
          const keyed = typeof item._key === 'string' && KEY.test(item._key);
          const place = keyed && writable() && FIELD.test(key) && how.depth < DEEPEST_STEP ? path(`${how.trail}${key}[${item._key}].src`) : {};
          return [{ ...picture, ...place }];
        });
      },
      at,
    };
  }

  /** One block of a document, named by its `_key`. */
  function block(values, prefix, origin) {
    const type = typeof values.type === 'string' ? values.type : '';
    const key = typeof values._key === 'string' ? values._key : undefined;
    return {
      type,
      key,
      view: typeof values.view === 'string' ? values.view : undefined,
      ...reader(values, {
        prefix,
        trail: key !== undefined && KEY.test(key) ? `blocks[${key}].` : undefined,
        depth: 0,
        fields: typeOf(type)?.fields ?? [],
        origin,
      }),
    };
  }

  /** A block a document does not have: every value empty, nothing annotated. */
  const missing = (type) => ({
    type,
    key: undefined,
    view: undefined,
    ...reader({}, { prefix: undefined, trail: undefined, depth: 0, fields: typeOf(type)?.fields ?? [], origin: 'own' }),
  });

  function blocksOf(list, prefix, origin) {
    const out = list.map((values) => block(values, prefix, origin));
    return { blocks: out, block: (type) => out.find((one) => one.type === type) ?? missing(type) };
  }

  /** The documents behind what the door handed out, for `alternatesOf`. */
  const docOf = new WeakMap();

  // ── pages ────────────────────────────────────────────────────────────────

  const pageCache = new Map();
  /** A page as a template draws it: `here` names no document, `elsewhere` names it by its id. */
  function pageOf(doc, form = 'here') {
    const cached = pageCache.get(doc);
    if (cached !== undefined) return cached[form];
    const make = (which) => {
      const { blocks, block: find } = blocksOf(doc.blocks, which === 'here' ? '' : named('page', doc.id), doc.origin);
      const page = {
        kind: 'page',
        id: doc.id,
        address: doc.address,
        locale: doc.language,
        seo: doc.seo,
        file: doc.file,
        blocks,
        block: find,
        get here() {
          return pageOf(doc, 'here');
        },
        get elsewhere() {
          return pageOf(doc, 'elsewhere');
        },
      };
      docOf.set(page, doc);
      return page;
    };
    const both = { here: make('here'), elsewhere: make('elsewhere') };
    pageCache.set(doc, both);
    return both[form];
  }

  /** A page nobody wrote: empty, and nothing on it annotated. */
  function nobodysPage(address, locale) {
    const self = {
      kind: 'page',
      id: '',
      address,
      locale,
      seo: {},
      file: undefined,
      blocks: [],
      block: missing,
      get here() {
        return self;
      },
      get elsewhere() {
        return self;
      },
    };
    return self;
  }

  // ── entries ──────────────────────────────────────────────────────────────

  const entryCache = new Map();
  /**
   * An entry as a template draws it. `elsewhere` — the default, a tile or a
   * row or a heading — names it by its id, `entry:<id>:title`; `here`, its
   * own page, names nothing: `title`, `blocks[b1].body`.
   */
  function entryOf(doc, form = 'elsewhere') {
    const cached = entryCache.get(doc);
    if (cached !== undefined) return cached[form];
    const collection = collections.get(doc.collection);
    const make = (which) => {
      const prefix = which === 'here' ? '' : named('entry', doc.id);
      const entry = {
        kind: 'entry',
        id: doc.id,
        collection: doc.collection,
        slug: doc.slug,
        locale: doc.language,
        visible: doc.shown,
        seo: doc.seo,
        file: doc.file,
        specimen: doc.specimen,
        fields: reader(doc.fields, { prefix, trail: '', depth: 0, fields: collection?.fields ?? [], origin: doc.fieldsOrigin }),
        body: doc.body.map((values) => block(values, prefix, doc.bodyOrigin)),
        get here() {
          return entryOf(doc, 'here');
        },
        get elsewhere() {
          return entryOf(doc, 'elsewhere');
        },
      };
      const address = addressIn(collection, doc.language, doc.slug);
      if (address !== undefined) entry.address = address;
      const anchor = anchorIn(collection, doc.language, doc.slug);
      if (anchor !== undefined) entry.anchor = anchor;
      docOf.set(entry, doc);
      return entry;
    };
    const both = { here: make('here'), elsewhere: make('elsewhere') };
    entryCache.set(doc, both);
    return both[form];
  }

  /**
   * The order a collection lists in: the owner's by rank (`byRank`, the
   * original's rank, so every language lists alike), or a field's — a date,
   * a number, or a text compared as the language sorts it (§3.5) — on the
   * values the page shows in that language.
   */
  function ordered(list, collection, language) {
    const order = collection?.order;
    if (order === undefined || order === 'manual') return byRank(list);
    const tag = langOf(language) || undefined;
    const compare = (a, b) => {
      const x = a.fields[order.by];
      const y = b.fields[order.by];
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return String(x ?? '').localeCompare(String(y ?? ''), tag);
    };
    const out = [...list].sort(compare);
    return order.desc ? out.reverse() : out;
  }

  /** A collection's entries in a language, in its order; the originals' slugs first, so the unranked keep one order. */
  function docsOf(name, language, { all = false, at = now } = {}) {
    if (!served(language)) return [];
    const list = entryFiles
      .filter((one) => one.collection === name)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((one) => entryDoc(one, language))
      .filter((doc) => doc !== undefined && (all || doc.shownBy(at)));
    return ordered(list, collections.get(name), language);
  }

  function entries(name, { locale, now: at, all = false } = {}) {
    return docsOf(name, want(locale), { all, at: at ?? now }).map((doc) => entryOf(doc));
  }

  // ── specimens ────────────────────────────────────────────────────────────

  const specimenCache = new Map();
  /**
   * One page per arrangement of every type a collection's entries may hold,
   * in every language, as contract 2 builds them: hidden, listed nowhere,
   * the site's own pictures from the collection's entries. Each block and
   * picture has a key, so the panel finds the same `blocks[<key>]` grammar
   * on a specimen as on the entry it lifts the markup for.
   */
  function specimens(name, locale) {
    const collection = collections.get(name);
    if (collection === undefined || !collection.pages || collection.blocks.length === 0) return [];
    if (!specimenCache.has(name)) {
      const pictures = [];
      const look = (values) => {
        for (const value of Object.values(values)) {
          if (!Array.isArray(value)) continue;
          for (const item of value) if (isObject(item) && typeof item.src === 'string' && item.src !== '') pictures.push(item.src);
        }
      };
      const own = entryFiles.filter((one) => one.collection === name);
      for (const one of own) {
        if (isObject(one.raw.fields)) look(one.raw.fields);
        for (const values of blocksIn(one.raw)) look(values);
      }
      for (const language of others) {
        for (const one of own) for (const values of blocksIn(one.overlays.get(language)?.raw)) look(values);
      }
      const made = [];
      for (const kind of collection.blocks) {
        const type = typeOf(kind);
        if (type === undefined) continue;
        for (const view of Array.isArray(type.views) && type.views.length > 0 ? type.views : [undefined]) {
          const values = { _key: specimenKey(kind), type: kind, v: type.v };
          if (view !== undefined) values.view = view.key;
          const gallery = type.fields.find((one) => one.kind === 'media' && one.multiple === true);
          if (gallery !== undefined) {
            values[gallery.key] = pictures.slice(0, Math.max(1, view?.min ?? 1)).map((src, i) => ({ _key: `p${i + 1}`, src, alt: '' }));
          }
          for (const field of type.fields) {
            if ((field.kind === 'text' || field.kind === 'markdown') && values[field.key] === undefined) values[field.key] = ' ';
          }
          made.push({ id: specimenId(kind, view?.key), values });
        }
      }
      specimenCache.set(name, made);
    }
    const out = [];
    for (const language of locale === undefined ? every : [want(locale)]) {
      if (!served(language)) continue;
      for (const { id, values } of specimenCache.get(name)) {
        const doc = {
          kind: 'entry',
          file: undefined,
          original: undefined,
          raw: { visible: false },
          language,
          id: '',
          collection: name,
          slug: id,
          seo: {},
          fields: { title: ' ' },
          body: [values],
          fieldsOrigin: 'own',
          bodyOrigin: 'own',
          specimen: true,
          shownBy: () => false,
          shown: false,
        };
        out.push(entryOf(doc));
      }
    }
    return out;
  }

  // ── the site ─────────────────────────────────────────────────────────────

  /** An entry's title as a heading elsewhere: its annotation, where the title is the owner's to tap. */
  const titleAt = (entry) => (entry.fields.tappable('title') ? entry.elsewhere.fields.at('title') : {});
  const titleText = (entry) => {
    const title = entry.fields.value('title');
    return typeof title === 'string' ? title.trim() : '';
  };

  /** A collection's tree field: a reference to one entry of its own collection (a list of them is a graph, not a tree). */
  const treeField = (collection) =>
    collection.fields.find((one) => one.kind === 'ref' && one.many !== true && one.ref === collection.name);

  /** Where an entry of another collection may name one of `target`: a reference, or a reference in the rows of a list. */
  function pointersInto(target, fields) {
    const out = [];
    for (const field of fields) {
      if (field.kind === 'ref' && Array.isArray(field.to) && field.to.includes(target)) out.push({ field: field.key });
      if (field.kind === 'list') {
        for (const sub of Array.isArray(field.of) ? field.of : []) {
          if (sub.kind === 'ref' && Array.isArray(sub.to) && sub.to.includes(target)) out.push({ field: field.key, row: sub.key });
        }
      }
    }
    return out;
  }

  /** Whether an entry names any of `ids`: by one id, by several (`many`), or in a row. */
  function pointsAtAny(entry, pointers, ids) {
    const names = (value) =>
      typeof value === 'string' ? ids.has(value) : Array.isArray(value) && value.some((one) => typeof one === 'string' && ids.has(one));
    return pointers.some((pointer) => {
      const value = entry.fields.value(pointer.field);
      if (pointer.row === undefined) return names(value);
      return Array.isArray(value) && value.some((row) => isObject(row) && names(row[pointer.row]));
    });
  }

  const site = {
    /** Which contract the door read the files as. */
    contract: 3,
    /** The base language's tag: the schema's. */
    locale: base,
    /** Every language, base first: the schema's. */
    locales: [base, ...others],
    /**
     * The site's currency, ISO 4217, upper case; `''` while nobody has said.
     * Contract 3 has it at the top of `site.json` (§6). The platform moves it
     * there in a stage of its own (§10, "the currency"), so a `site.json`
     * still carrying it in `business` is read too rather than pricing a
     * contract-3 site in nothing.
     */
    currency: String(siteFile.currency ?? (isObject(siteFile.business) ? siteFile.business.currency : undefined) ?? '').toUpperCase(),
    types,
    type: typeOf,
    collections: [...collections.values()],
    collection: (name) => collections.get(name),
    rolesOf: (module) => (isObject(schema.modules) && isObject(schema.modules[module]) ? schema.modules[module] : undefined),

    /**
     * A page by its address, in a language — `page('/prices', 'de')`, or by
     * its address in the language, `page('/de/prices')`. In every language
     * the site has, its words laid over the original's; a page nobody wrote
     * is empty.
     */
    page(address, locale) {
      const language = want(locale);
      const clean = address.length > 1 ? address.replace(/\/+$/, '') : address;
      let tag = language;
      let wanted = baseAddressOf(clean, language);
      let file = pageFiles.find((one) => one.path === wanted);
      if (file === undefined && language === '') {
        const said = localeOfAddress(clean, others);
        if (said !== '') {
          tag = said;
          wanted = baseAddressOf(clean, said);
          file = pageFiles.find((one) => one.path === wanted);
        }
      }
      if (file === undefined || !served(tag)) return nobodysPage(inLocale(tag, wanted), tag);
      return pageOf(pageDoc(file, tag));
    },
    pages(locale) {
      const language = want(locale);
      return served(language) ? pageFiles.map((file) => pageOf(pageDoc(file, language))) : [];
    },
    /** The shared text in a language: `shared.json`, with `shared.<locale>.json` laid over it by `_key`. */
    shared(locale) {
      const language = want(locale);
      const original = sharedFiles.get('');
      const over = language === '' ? undefined : sharedFiles.get(language);
      const list = !served(language) ? [] : language === '' ? blocksIn(original?.raw) : laidBlocks(blocksIn(original?.raw), over?.raw);
      const { blocks, block: find } = blocksOf(list, 'shared:', language === '' ? 'own' : 'laid');
      return { kind: 'shared', locale: language, file: over?.file ?? original?.file, blocks, block: find };
    },
    /** A module's settings: `settings` of `jtk/modules/<module>.json` (§4.6); `{}` for none. */
    module(name) {
      const file = byPath.get(`/jtk/modules/${name}.json`);
      return isObject(file) && isObject(file.settings) ? { ...file.settings } : {};
    },
    /** A module's settings read like any values, each annotated `module:<name>:hours[h1].opens`. */
    settings(name) {
      return reader(site.module(name), {
        prefix: typeof name === 'string' && FIELD.test(name) ? `module:${name}:` : undefined,
        trail: '',
        depth: 0,
        fields: [],
        origin: 'own',
      });
    },

    entries,
    /** An entry by its id, or by its slug in the language (or the original's slug). */
    entry(name, idOrSlug, locale) {
      const language = want(locale);
      const own = entryFiles.filter((one) => one.collection === name);
      const pick = (test) => {
        for (const one of own) {
          const doc = entryDoc(one, language);
          if (doc !== undefined && test(one, doc)) return entryOf(doc);
        }
        return undefined;
      };
      return (
        pick((one, doc) => (one.id !== '' && one.id === idOrSlug) || doc.slug === idOrSlug) ??
        pick((one) => one.slug === idOrSlug)
      );
    },
    specimens: (name, { locale } = {}) => specimens(name, locale),

    addressOf: (entry) => entry?.address,
    anchorOf: (entry) => entry?.anchor,
    listingOf(name, locale, page = 1) {
      const collection = collections.get(name);
      const language = want(locale);
      const first = collection === undefined ? inLocale(language, `/${name}`) : listingIn(collection, language);
      return page <= 1 ? first : `${first}/page/${page}`;
    },
    localeOf: (address) => localeOfAddress(address, others),
    inLocale: (locale, address) => inLocale(want(locale), address),

    /**
     * Every language a page or an entry is in, for `hreflang`, base first.
     * A page is in every language the site has (its words laid over the
     * original's); an entry in each language it is out in, by its
     * collection's `untranslated`, at its address there.
     */
    alternatesOf(document) {
      const doc = docOf.get(document);
      if (doc === undefined) return [];
      if (doc.kind === 'page') {
        return every.length > 1 ? every.map((language) => ({ locale: language, address: inLocale(language, doc.path) })) : [];
      }
      if (doc.specimen || doc.original === undefined) return [];
      const found = [];
      for (const language of every) {
        const one = entryDoc(doc.original, language);
        if (one === undefined || !one.shown) continue;
        const address = addressIn(collections.get(one.collection), language, one.slug);
        if (address !== undefined) found.push({ locale: language, address });
      }
      return found.length > 1 ? found : [];
    },

    /**
     * Entries under their headings: a select's options by their labels, or
     * the entries of the collection a reference names, each heading keyed by
     * that entry's id — what the entries' values hold (§3.4). The headings
     * are that collection in the page's language, as its `untranslated`
     * says, so an untranslated category heads its services in the original's
     * words or not at all; contract 2 had to fall back to the site's own
     * language by hand.
     */
    groupsOf(name, list, locale) {
      const collection = collections.get(name);
      if (collection === undefined) return undefined;
      const field = groupField(collection, collection.fields);
      if (field === undefined || field.many === true) return undefined;
      const language = want(locale);
      const headings =
        field.kind === 'select'
          ? selectHeadings(field, (text) => words(text, language)).map((one) => ({ ...one, at: {}, fixed: true }))
          : collections.has(field.ref)
            ? entries(field.ref, { locale: language })
                .filter((one) => one.id !== '')
                .map((one) => ({ key: one.id, text: titleText(one) || one.slug, entry: one, at: titleAt(one), fixed: !one.fields.tappable('title') }))
            : undefined;
      return headings === undefined ? undefined : grouped(list, field.key, headings);
    },

    /** What names an entry by its id, from the other collections — and, for a tree, what names the entries under it. */
    referrersOf(entry) {
      const collection = collections.get(entry?.collection);
      if (collection === undefined || entry.id === '') return [];
      const field = treeField(collection);
      let below = [];
      if (field !== undefined) {
        const parentOf = new Map();
        const known = new Set();
        for (const one of entries(collection.name, { locale: entry.locale })) {
          known.add(one.id);
          const parent = one.fields.value(field.key);
          if (typeof parent === 'string') parentOf.set(one.id, parent);
        }
        below = descendants(entry.id, parentOf, known);
      }
      const ids = new Set([entry.id, ...below]);
      const out = [];
      for (const other of collections.values()) {
        if (other.name === collection.name) continue;
        const pointers = pointersInto(collection.name, other.fields);
        if (pointers.length === 0) continue;
        const found = entries(other.name, { locale: entry.locale }).filter((one) => pointsAtAny(one, pointers, ids));
        if (found.length === 0) continue;
        const { shown, more } = capped(found, other.per_page);
        out.push({ collection: other, entries: shown, more });
      }
      return out;
    },

    /** Where an entry sits in its collection's tree, by the ids its parents are named by. */
    treeOf(entry) {
      const collection = collections.get(entry?.collection);
      const field = collection === undefined ? undefined : treeField(collection);
      if (field === undefined) return { trail: [], children: [], more: 0 };
      const all = entries(collection.name, { locale: entry.locale });
      const byId = new Map(all.filter((one) => one.id !== '').map((one) => [one.id, one]));
      const parentOf = new Map();
      for (const one of all) {
        const parent = one.fields.value(field.key);
        if (typeof parent === 'string') parentOf.set(one.id, parent);
      }
      // The entry itself may be hidden and still built, so its own parent is read off it.
      const own = entry.fields.value(field.key);
      if (typeof own === 'string') parentOf.set(entry.id, own);
      const trail = entry.id === '' ? [] : ancestors(entry.id, parentOf, new Set(byId.keys())).map((one) => byId.get(one)).reverse();
      const children = entry.id === '' ? [] : all.filter((one) => one.fields.value(field.key) === entry.id && one.id !== entry.id);
      const { shown, more } = capped(children, collection.per_page);
      return { trail, children: shown, more };
    },

    /** A collection's listing as its pages draw it, as contract 2's. A slug has no `/` in contract 3, so nothing sits at `<listing>/page/<n>`. */
    listingPages(name, locale) {
      const collection = collections.get(name);
      if (collection === undefined) throw new Error(`no collection named "${name}" in jtk/schema.json`);
      const all = entries(name, { locale });
      const runs = site.groupsOf(name, all, locale);
      const list = runs === undefined ? all : runs.flatMap((run) => run.entries);
      const size = collection.per_page !== undefined && collection.per_page > 0 ? collection.per_page : Number.POSITIVE_INFINITY;
      return { entries: list, size, last: Math.max(1, Math.ceil(list.length / size)) };
    },

    /**
     * A price in the site's currency: `{ minor }` (or whole minor units, as
     * contract 2 wrote them) in, «CHF 45.–» out. A price `on_request` has no
     * amount, and says nothing here rather than «NaN»; `from` and
     * `on_request` are words, and the words are the site's
     * (`row.value('price').from`).
     */
    money(value, locale) {
      const amount = isObject(value) ? value.minor : value;
      if (typeof amount !== 'number' && !(typeof amount === 'string' && amount.trim() !== '')) return '';
      const minor = Number(amount);
      if (!Number.isFinite(minor)) return '';
      return priced(minor, site.currency || undefined, langOf(want(locale)) || undefined);
    },

    words,
    tappable,

    /**
     * Every page and entry, in every language it is in, as the door reads it
     * — `fields` and the body `blocks` of an entry apart, as contract 3 has
     * them. `path` is the address it is reached at; an entry of a
     * collection without a route has none. The kit's own checks (the lint,
     * progress, `_meta.json`) still read contract 2's shapes.
     */
    documents() {
      const out = [];
      for (const language of every) {
        for (const file of pageFiles) {
          const doc = pageDoc(file, language);
          out.push({ file: doc.file, id: doc.id, path: doc.address, locale: language, seo: doc.seo, blocks: doc.blocks, shown: true });
        }
        for (const file of entryFiles) {
          const doc = entryDoc(file, language);
          if (doc === undefined) continue;
          out.push({
            file: doc.file,
            id: doc.id,
            path: addressIn(collections.get(doc.collection), language, doc.slug),
            locale: language,
            collection: doc.collection,
            slug: doc.slug,
            seo: doc.seo,
            fields: doc.fields,
            blocks: doc.body,
            visible: file.raw.visible,
            shown: doc.shown,
          });
        }
      }
      return out;
    },
    /** The shared text in every language a file holds it in, laid over the original's; the site's languages' order. */
    sharedDocuments: () =>
      [...sharedFiles.entries()]
        .filter(([language]) => served(language))
        .sort(([a], [b]) => every.indexOf(a) - every.indexOf(b))
        .map(([language, one]) => ({
          file: one.file,
          locale: language,
          blocks: language === '' ? blocksIn(one.raw) : laidBlocks(blocksIn(sharedFiles.get('')?.raw), one.raw),
        })),
  };
  return site;
}
