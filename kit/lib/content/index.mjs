/**
 * The door: the one place a site on jtakeit reads its content files.
 *
 *   import { content } from '@jtakeit/kit/content';
 *   export const site = content(import.meta.glob('/jtk/**\/*.json', { eager: true, import: 'default' }));
 *
 *   site.page('/prices', 'de').block('rates').text('title')
 *   site.entries('works', { locale })            // offered and ordered
 *   <h1 {...hero.at('title')}>{hero.text('title')}</h1>
 *
 * ── why a site reads through a door ─────────────────────────────────────────
 *
 * Until 9 November 2026 the scaffold's `src/lib/*.ts` read `jtk/content/**`
 * itself, and that code is copied into every site and belongs to its
 * developer from then on. Whatever it got wrong it got wrong for ever: no kit
 * release could change how an existing site reads its content. And it read
 * one thing several ways (wiki/98 §0):
 *
 *   - a page was found by its `path`, the home by its file name;
 *   - an entry by its file's location, while the kit's lint found it by `path`;
 *   - the shared files' language pattern took a lowercase region only;
 *   - the entry route annotated every gallery as `work`;
 *   - a picture's words were `<key>_alt` in one place and the entry's title in
 *     another;
 *   - four different sets of kinds decided what needs a tap target.
 *
 * So the reading is here, behind an interface a template writes against
 * (wiki/98 §13), and a kit bump changes it. The template keeps what is its
 * own: its components, its words, its markdown pipeline and how a picture
 * becomes an asset.
 *
 * ── a pure function of the files ────────────────────────────────────────────
 *
 * `content(files)` takes every file under `jtk/` as Vite's glob hands them —
 * `{ '/jtk/content/index.json': { … } }` — and reads nothing else. The line a
 * site writes to supply them stays the same when the layout of `jtk/` changes
 * (contract 3 moves it to `jtk/pages`, `jtk/entries` and `jtk/modules`), and
 * under `astro dev` Vite reloads the module that holds it when a file
 * changes. Node-side readers — the Astro loader, the kit's lint, progress and
 * dev diary — get the same map from `readJtk()` (`@jtakeit/kit/content/node`).
 *
 * Anything it does not know it ignores: `jtk/session.json`, `jtk/design.json`
 * (the template's own), a picture's directory, a module file nothing names.
 *
 * ── two contracts, one interface ────────────────────────────────────────────
 *
 * A site whose `jtk/schema.json` says `contract: 3` is read by
 * `contract3.mjs` (wiki/98 §2–5): pages and entries in a directory of their
 * own kind, translations beside their originals and merged over them, an
 * entry's own values under `fields`, addresses from a collection's `route`,
 * and annotations by `_key` and id. Every other site is read here, as
 * contract 2. A template calls the same functions on either and gets the
 * same shapes back; only what `at()` writes, and where the values came from,
 * differ.
 *
 * ── contract 2, read as the platform reads it ───────────────────────────────
 *
 *   - the schema is `jtk/catalogue.json`, the emitted JSON — never the
 *     developer's `blocks.ts`, which is a declaration the platform never sees;
 *   - a page or an entry is the `path` inside its file, never the file's name
 *     or place — what the platform imports and what its lint resolves;
 *   - its language is its `locale` key, or the language its path starts with;
 *   - an entry's slug is its path without the language and the collection's
 *     prefix, its own values are `blocks[0]` and its body the blocks after;
 *   - shared text is `shared.json` and `shared.<locale>.json`, the language
 *     matched in either case;
 *   - a module's settings are the block whose type is `<module>_config`, not
 *     whatever block comes first;
 *   - a manual order is each entry's `rank`, which the platform writes into
 *     the file since jtakeit-core wiki/94 · M4, and the order of the files'
 *     names for an entry without one, which is what a build of the scaffold
 *     has always listed by.
 *
 * A language is `''` for the base on everything the door hands out — what
 * the files say, where a base document carries no `locale` — and the
 * canonical tag (`de-CH`) for any other. Asked, it takes `''`, nothing, or a
 * tag in either case.
 */
import { money as priced } from '../money.mjs';
import { shownAt } from '../schedule.mjs';
import {
  ancestors,
  capped,
  descendants,
  drawsPagedListing,
  grouped,
  groupField,
  linksToListing,
  pointersInto,
  pointsAtAny,
  refHeadings,
  selectHeadings,
  treeFields,
} from './groups.mjs';
import { baseAddressOf, canonicalLocale, inLocale, languagesOf, localeArg, localeOfAddress, segmentOf, sharedLocaleOf } from './locale.mjs';
import { byRank, factsOf, labelWords, minorOf, namesIn, specimenId, TAPPABLE, tappable } from './rules.mjs';
import { contract3 } from './contract3.mjs';

export { shownAt, drawsPagedListing, linksToListing, canonicalLocale, sharedLocaleOf };
export { DEEPEST, ancestors, capped, descendants, grouped, groupField, pointersInto, pointsAt, pointsAtAny, refHeadings, selectHeadings, treeFields } from './groups.mjs';
// The platform's tappable kinds and where a specimen lives: rules.mjs, which
// both contracts' readers ask.
export { TAPPABLE, tappable, specimenId };
// The merge of an original and its translation (wiki/98 §4.4): the one rule
// the door serves a contract-3 page in another language by, for a tool or a
// test that has one document to merge, and the fixture corpus it is held to.
export { mergeDocument, overlay, layOf, kindOf, localizedIn, valueAt } from './overlay.mjs';

/** Empty is absent: what a value that says nothing is spelt as, folded. */
function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Read a site's content.
 *
 * @param {Record<string, unknown>} files every file under `jtk/`, by its path from the site's root
 *   (`/jtk/content/index.json`), parsed — `import.meta.glob('/jtk/**\/*.json', { eager: true, import: 'default' })`
 *   in a template, `await readJtk()` in Node
 * @param {{ annotate?: boolean; now?: number }} [options]
 *   `annotate`: whether `at()` writes annotations at all (off for a build with no editor);
 *   `now`: the clock a `show_at`/`hide_at` is read against, this moment by default
 */
export function content(files, options = {}) {
  const annotate = options.annotate !== false;
  const now = options.now ?? Date.now();

  // ── the files, in one order ──────────────────────────────────────────────
  //
  // Sorted by name, byte for byte, whatever order they were handed in: the
  // order of documents is the order a page's languages are found in and a
  // specimen's pictures are taken in, and neither may depend on how a glob
  // or a directory listing happened to walk.
  const byPath = new Map();
  for (const [key, value] of Object.entries(files ?? {})) {
    byPath.set(`/${String(key).replaceAll('\\', '/').replace(/^\/+/, '')}`, value);
  }
  const names = [...byPath.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // ── contract 3 ───────────────────────────────────────────────────────────
  //
  // A site whose schema is `jtk/schema.json` saying `contract: 3` is read by
  // its own reader (contract3.mjs), behind this same interface: a template
  // calls the same `page`, `entries`, `at` and `picture` on either. Anything
  // else — `jtk/catalogue.json`, or no schema at all — is contract 2, read
  // below exactly as before. A `schema.json` that says another contract is
  // not taken for a catalogue: the platform reads contract 2 from
  // `catalogue.json` and only from there.
  const schema = byPath.get('/jtk/schema.json');
  if (isObject(schema) && schema.contract === 3) return contract3(byPath, names, { annotate, now });

  const catalogue = isObject(byPath.get('/jtk/catalogue.json')) ? byPath.get('/jtk/catalogue.json') : {};
  const siteFile = isObject(byPath.get('/jtk/site.json')) ? byPath.get('/jtk/site.json') : {};
  const { base, others } = languagesOf(catalogue, siteFile);
  const every = ['', ...others];
  const langOf = (locale) => (locale === '' ? base : locale);
  const want = (locale) => localeArg(locale, base);

  const types = Array.isArray(catalogue.blocks) ? catalogue.blocks.filter(isObject) : [];
  const typeOf = (name) => types.find((one) => one.type === name);
  const declared = Array.isArray(catalogue.collections) ? catalogue.collections.filter(isObject) : [];

  // ── the documents ────────────────────────────────────────────────────────
  /** @type {any[]} */
  const documents = [];
  for (const name of names) {
    if (!name.startsWith('/jtk/content/') || !name.endsWith('.json')) continue;
    // The pictures a build downloads beside an entry are not documents.
    if (name.slice('/jtk/content'.length).split('/').includes('media')) continue;
    const raw = byPath.get(name);
    if (!isObject(raw)) continue;
    if (typeof raw.path !== 'string' || raw.path === '') {
      throw new Error(`${name.slice(1)}: no "path" — the platform knows a page or an entry by the path inside its file, so this one is nobody's`);
    }
    const path = raw.path.length > 1 ? raw.path.replace(/\/+$/, '') : raw.path;
    const keyed = typeof raw.locale === 'string' && raw.locale !== '' ? want(raw.locale) : localeOfAddress(path, others);
    const collection = typeof raw.collection === 'string' && raw.collection !== '' ? raw.collection : undefined;
    // Every block keeps its place, whatever it holds: the place is its
    // annotation in contract 2, and a block that is not one reads as empty.
    const blocks = Array.isArray(raw.blocks) ? raw.blocks.map((one) => (isObject(one) ? one : {})) : [];
    const doc = {
      file: name,
      raw,
      path,
      locale: keyed,
      baseAddress: baseAddressOf(path, keyed),
      collection,
      blocks,
      seo: isObject(raw.seo) ? raw.seo : {},
      shown: shownAt(raw, now),
    };
    if (collection !== undefined) {
      const declaration = declared.find((one) => one.name === collection);
      const prefix = typeof declaration?.prefix === 'string' ? declaration.prefix.replace(/\/+$/, '') : undefined;
      // The slug is the path without its language and its collection's
      // prefix — the platform's rule, the same in every language. A path that
      // is not under its prefix (the platform refuses one) keeps its last part.
      doc.slug =
        prefix !== undefined && doc.baseAddress.startsWith(`${prefix}/`)
          ? doc.baseAddress.slice(prefix.length + 1)
          : doc.baseAddress.split('/').filter(Boolean).pop() ?? '';
    }
    documents.push(doc);
  }

  const shared = new Map();
  for (const name of names) {
    if (!/^\/jtk\/[^/]+$/.test(name)) continue;
    const locale = sharedLocaleOf(name);
    if (locale === null) continue;
    const raw = byPath.get(name);
    const key = want(locale);
    if (!isObject(raw) || shared.has(key)) continue;
    shared.set(key, { file: name, locale: key, blocks: Array.isArray(raw.blocks) ? raw.blocks.map((one) => (isObject(one) ? one : {})) : [] });
  }

  // ── the schema, as a template reads it ───────────────────────────────────

  /** @type {Map<string, any>} */
  const collections = new Map();
  for (const one of declared) {
    if (typeof one.name !== 'string' || collections.has(one.name)) continue;
    const type = typeOf(one.type);
    collections.set(one.name, {
      name: one.name,
      label: one.label,
      one: one.one,
      intro: one.intro,
      icon: one.icon,
      type: one.type,
      fields: Array.isArray(type?.fields) ? type.fields : [],
      pages: one.pages !== false,
      listing: one.listing === true,
      per_page: typeof one.per_page === 'number' ? one.per_page : undefined,
      order: isObject(one.order) && typeof one.order.by === 'string' && one.order.by !== '' && one.order.by !== 'manual'
        ? { by: one.order.by, desc: one.order.desc === true }
        : 'manual',
      group: typeof one.group === 'string' && one.group !== '' ? one.group : undefined,
      blocks: Array.isArray(one.body) ? one.body : [],
      prefix: typeof one.prefix === 'string' ? one.prefix.replace(/\/+$/, '') : '',
    });
  }

  /** The words of a label in a language (rules.mjs, the one copy). */
  const words = labelWords(base, others, want);

  // ── reading a value, and writing where it is ─────────────────────────────

  /**
   * The annotation of one value, in contract 2's grammar: `blocks[i].f`,
   * `blocks[i].f[j].s`, with `shared:` or `page:<address>:` in front for
   * another document's.
   */
  function attrs(prefix, index, field, row, part) {
    if (!annotate || index === undefined || typeof field !== 'string' || field === '') return {};
    let path = `${prefix}blocks[${index}].${field}`;
    if (row !== undefined) path += part === undefined ? `[${row}]` : `[${row}].${part}`;
    return { 'data-jtk-path': path };
  }

  /**
   * The values of one object — a block, a row, an entry's own — and the
   * annotation of each.
   *
   * @param {Record<string, unknown>} values
   * @param {{ at: (field: string, row?: number | string, part?: string) => Record<string, string>; fields: any[]; title?: () => string; locale?: string }} how
   *   `at` writes an annotation; `fields` are the declaration of these values; `title` is the alt
   *   a picture falls back to — an entry's title, as contract 2 has always drawn a cover; `locale`,
   *   the language of the document they are in, which a reference is resolved in
   */
  function reader(values, how) {
    const field = (key) => how.fields.find((one) => one.key === key);
    const value = (key) => (isEmpty(values[key]) ? undefined : values[key]);
    const text = (key) => {
      const one = values[key];
      return one === undefined || one === null ? '' : typeof one === 'string' ? one : String(one);
    };
    /** A row's index, from its index or its `_key`. */
    const rowOf = (key, row) => {
      if (typeof row === 'number') return row;
      if (typeof row !== 'string') return undefined;
      const list = values[key];
      if (!Array.isArray(list)) return undefined;
      const at = list.findIndex((one) => isObject(one) && one._key === row);
      return at === -1 ? undefined : at;
    };
    const at = (key, row, part) => {
      if (row === undefined) return how.at(key);
      const index = rowOf(key, row);
      return index === undefined ? {} : how.at(key, index, part);
    };
    const alt = (key, own) => {
      if (typeof own === 'string') return own;
      const sibling = values[`${key}_alt`];
      if (typeof sibling === 'string' && sibling !== '') return sibling;
      return how.title?.() ?? (typeof sibling === 'string' ? sibling : '');
    };
    return {
      text,
      value,
      field,
      tappable: (key) => tappable(field(key)),
      minor: (key) => minorOf(values[key]),
      refs: (key) => resolved(field(key), values[key], how.locale ?? ''),
      // Contract 2 keeps a whole copy of every document per language, so no
      // value on a page in one language is another's (contract3.mjs has the
      // merge where one is).
      fromBase: () => false,
      lang: () => ({}),
      rows(key) {
        const list = values[key];
        if (!Array.isArray(list)) return [];
        const of = field(key)?.of ?? [];
        // A row's own values are annotated as cells of the list: `items[3].title`.
        // Contract 2 has no deeper place, so a value inside a row's own list or
        // gallery has none.
        return list.map((row, j) =>
          Object.assign(
            reader(isObject(row) ? row : {}, { at: (sub, deeper) => (deeper === undefined ? how.at(key, j, sub) : {}), fields: of, locale: how.locale }),
            { key: isObject(row) && typeof row._key === 'string' ? row._key : undefined, index: j },
          ),
        );
      },
      picture(key) {
        const one = values[key];
        const src = isObject(one) ? (typeof one.src === 'string' ? one.src : '') : text(key);
        const picture = { src, alt: alt(key, isObject(one) ? one.alt : undefined) };
        if (isObject(one) && typeof one.focus === 'string' && one.focus !== '') picture.focus = one.focus;
        if (isObject(one) && typeof one.poster === 'string' && one.poster !== '') picture.poster = one.poster;
        return { ...picture, ...how.at(key) };
      },
      gallery(key) {
        const list = values[key];
        if (!Array.isArray(list)) return [];
        return list.flatMap((item, i) => {
          if (!isObject(item) || typeof item.src !== 'string' || item.src === '') return [];
          const picture = { src: item.src, alt: typeof item.alt === 'string' ? item.alt : (how.title?.() ?? '') };
          if (typeof item.focus === 'string' && item.focus !== '') picture.focus = item.focus;
          if (typeof item.poster === 'string' && item.poster !== '') picture.poster = item.poster;
          return [{ ...picture, ...how.at(key, i, 'src') }];
        });
      },
      at,
    };
  }

  /**
   * The entries a field names, in the order it names them: a reference's
   * slug, or the one reference in each row of a list of them (`does: [{
   * service }]`), found in the document's language and else in the site's
   * own. A slug no entry has is left out.
   */
  function resolved(declared, held, locale) {
    const { to, names } = namesIn(declared, held);
    const out = [];
    for (const name of names) {
      for (const collection of to) {
        const found = site.entry(collection, name, locale) ?? (locale === '' ? undefined : site.entry(collection, name, ''));
        if (found !== undefined) {
          out.push(found);
          break;
        }
      }
    }
    return out;
  }

  /** One block of a document, at its place in the document's `blocks`. */
  function block(values, index, prefix, locale = '') {
    const type = typeof values.type === 'string' ? values.type : '';
    return {
      type,
      key: typeof values._key === 'string' ? values._key : undefined,
      view: typeof values.view === 'string' ? values.view : undefined,
      ...reader(values, {
        at: (field, row, part) => attrs(prefix, index, field, row, part),
        fields: typeOf(type)?.fields ?? [],
        locale,
      }),
    };
  }

  /** A block a document does not have: every value empty, nothing annotated. */
  const missing = (type) => ({ type, key: undefined, view: undefined, ...reader({}, { at: () => ({}), fields: typeOf(type)?.fields ?? [] }) });

  function blocksOf(list, prefix, locale = '') {
    const out = list.map((values, index) => block(values, index, prefix, locale));
    return { blocks: out, block: (type) => out.find((one) => one.type === type) ?? missing(type) };
  }

  // ── pages ────────────────────────────────────────────────────────────────

  const pageCache = new Map();
  /**
   * A page as a template draws it. `here` is the page's own annotation — the
   * page that is drawn is the document — and `elsewhere` the same words drawn
   * on another page, which name the document they are in.
   */
  function pageOf(doc, form = 'here') {
    const cached = pageCache.get(doc);
    if (cached !== undefined) return cached[form];
    const make = (which) => {
      const prefix = which === 'here' ? '' : `page:${doc.path}:`;
      const { blocks, block: find } = blocksOf(doc.blocks, prefix, doc.locale);
      return {
        kind: 'page',
        id: idOf(doc),
        address: doc.path,
        locale: doc.locale,
        seo: doc.seo,
        file: doc.file,
        blocks,
        block: find,
        // Contract 2 keeps a file per language: a page is in its language's own words.
        translated: true,
        get here() {
          return pageOf(doc, 'here');
        },
        get elsewhere() {
          return pageOf(doc, 'elsewhere');
        },
      };
    };
    const both = { here: make('here'), elsewhere: make('elsewhere') };
    pageCache.set(doc, both);
    return both[form];
  }

  /**
   * The document's own id, which the platform writes into every file since
   * jtakeit-core wiki/94 · M1: a file moved keeps it. Empty in a file written
   * before, and in one an agent wrote and nobody has saved yet.
   */
  function idOf(doc) {
    return typeof doc.raw?.id === 'string' ? doc.raw.id : '';
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
      translated: false,
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
   * An entry as a template draws it. `elsewhere` is how an entry is met far
   * more often than not — a tile, a row, a heading, a link from another — and
   * annotates with the document it is in (`page:<address>:` in contract 2);
   * `here` is its own page's, where the document is the page.
   */
  function entryOf(doc, form = 'elsewhere') {
    const cached = entryCache.get(doc);
    if (cached !== undefined) return cached[form];
    const collection = collections.get(doc.collection);
    const fields = isObject(doc.blocks[0]) ? doc.blocks[0] : {};
    const make = (which) => {
      const prefix = which === 'here' ? '' : `page:${doc.path}:`;
      const own = reader(fields, {
        at: (field, row, part) => attrs(prefix, 0, field, row, part),
        fields: collection?.fields ?? typeOf(fields.type)?.fields ?? [],
        title: () => {
          const title = fields.title;
          return typeof title === 'string' ? title : '';
        },
        locale: doc.locale,
      });
      const entry = {
        kind: 'entry',
        id: idOf(doc),
        collection: doc.collection,
        slug: doc.slug,
        // A slug is the same in every language on contract 2.
        baseSlug: doc.slug,
        translated: true,
        locale: doc.locale,
        visible: doc.shown,
        seo: doc.seo,
        file: doc.file,
        specimen: false,
        fields: own,
        body: doc.blocks.slice(1).map((values, offset) => block(values, offset + 1, prefix, doc.locale)),
        get here() {
          return entryOf(doc, 'here');
        },
        get elsewhere() {
          return entryOf(doc, 'elsewhere');
        },
      };
      if (collection === undefined || collection.pages) {
        if (collection !== undefined) entry.address = inLocale(doc.locale, `${collection.prefix}/${doc.slug}`);
      } else {
        entry.anchor = `${inLocale(doc.locale, collection.prefix)}#${collection.name}-${doc.slug}`;
      }
      return entry;
    };
    const both = { here: make('here'), elsewhere: make('elsewhere') };
    entryCache.set(doc, both);
    return both[form];
  }

  /**
   * The order a collection lists in: the declared field, or the owner's by
   * rank (`byRank`, rules.mjs, which contract 3 lists by too).
   */
  function ordered(list, collection) {
    const order = collection?.order;
    if (order === undefined || order === 'manual') return byRank(list);
    const compare = (a, b) => {
      const x = a.blocks[0]?.[order.by];
      const y = b.blocks[0]?.[order.by];
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return String(x ?? '').localeCompare(String(y ?? ''));
    };
    const out = [...list].sort(compare);
    return order.desc ? out.reverse() : out;
  }

  /**
   * A collection the owner orders by hand, in their order: each entry's
   * `rank`, written by their moves in the panel (jtakeit-core wiki/94 · M4),
   * compared as bytes. An entry with none comes after the ranked ones, in the
   * order it came — which is every entry of a site from before ranks.
   */
  function byRank(list) {
    const rankOf = (doc) => (typeof doc.raw?.rank === 'string' ? doc.raw.rank : '');
    return [...list].sort((a, b) => {
      const x = rankOf(a);
      const y = rankOf(b);
      if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  /**
   * The documents of a collection in a language, in the collection's order.
   *
   * Under a manual order that is the order of their addresses — contract 2
   * keeps the order an owner arranges in the platform's database and in no
   * file, the platform's own build collects documents by path, and a build of
   * the scaffold has always listed them by slug (Astro's content store sorts
   * by id). An order by a field is sorted on top of that, as it always was.
   */
  function docsOf(name, locale, { all = false, at = now } = {}) {
    const list = documents
      .filter((doc) => doc.collection === name && doc.locale === locale && (all || shownAt(doc.raw, at)))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    return ordered(list, collections.get(name));
  }

  function entries(name, { locale, now: at, all = false } = {}) {
    return docsOf(name, want(locale), { all, at: at ?? now }).map((doc) => entryOf(doc));
  }

  // ── specimens ────────────────────────────────────────────────────────────

  const specimenCache = new Map();
  /**
   * One page per arrangement of every type a collection's entries may hold,
   * in every language — the page the panel lifts this site's own markup from
   * for a block an owner has just added, in the entry's language. Hidden, as
   * an unfinished entry is; `_meta.json` lists them as drafts.
   *
   * The pictures are the site's own, from the collection's entries; a
   * collection with none gets the container without its contents, which is
   * still the right container.
   */
  function specimens(name, locale) {
    const collection = collections.get(name);
    if (collection === undefined || !collection.pages || collection.blocks.length === 0) return [];
    if (!specimenCache.has(name)) {
      const pictures = [];
      for (const language of every) {
        for (const doc of documents.filter((one) => one.collection === name && one.locale === language)) {
          for (const values of doc.blocks) {
            for (const value of Object.values(values)) {
              if (!Array.isArray(value)) continue;
              for (const item of value) {
                if (isObject(item) && typeof item.src === 'string' && item.src !== '') pictures.push(item.src);
              }
            }
          }
        }
      }
      const made = [];
      for (const kind of collection.blocks) {
        const type = typeOf(kind);
        if (type === undefined) continue;
        for (const view of Array.isArray(type.views) && type.views.length > 0 ? type.views : [undefined]) {
          const values = { _key: `${kind}-1`, type: kind, v: type.v };
          if (view !== undefined) values.view = view.key;
          const fields = Array.isArray(type.fields) ? type.fields : [];
          const gallery = fields.find((one) => one.kind === 'media' && one.multiple === true);
          if (gallery !== undefined) {
            values[gallery.key] = pictures.slice(0, Math.max(1, view?.min ?? 1)).map((src) => ({ src, alt: '' }));
          }
          for (const field of fields) {
            if ((field.kind === 'text' || field.kind === 'markdown') && values[field.key] === undefined) values[field.key] = ' ';
          }
          made.push({ id: specimenId(kind, view?.key), values });
        }
      }
      specimenCache.set(name, made);
    }
    const out = [];
    for (const language of locale === undefined ? every : [want(locale)]) {
      if (!every.includes(language)) continue;
      for (const { id, values } of specimenCache.get(name)) {
        const address = inLocale(language, `${collection.prefix}/${id}`);
        const doc = {
          file: undefined,
          raw: { visible: false },
          path: address,
          locale: language,
          baseAddress: `${collection.prefix}/${id}`,
          collection: name,
          blocks: [{ title: ' ' }, values],
          seo: {},
          shown: false,
          slug: id,
        };
        const entry = entryOf(doc);
        entry.specimen = true;
        entry.here.specimen = true;
        out.push(entry);
      }
    }
    return out;
  }

  // ── the site ─────────────────────────────────────────────────────────────

  const docOfEntry = (entry) =>
    documents.find((doc) => doc.collection === entry?.collection && doc.locale === entry?.locale && doc.slug === entry?.slug);

  /** An entry's title as a heading elsewhere: its words, and its annotation where the title is the owner's to tap. */
  function titleOf(entry) {
    const editable = entry.fields.tappable('title');
    return editable ? entry.elsewhere.fields.at('title') : {};
  }

  /** A collection's tree in one language, for a walk. */
  function treeIn(collection, locale) {
    const field = treeFields(collection, collection.fields)[0];
    if (field === undefined) return undefined;
    const parentOf = new Map();
    const known = new Set();
    for (const one of [...(locale === '' ? [] : entries(collection.name, { locale: '' })), ...entries(collection.name, { locale })]) {
      known.add(one.slug);
      const parent = one.fields.value(field.key);
      if (typeof parent === 'string' && parent !== '') parentOf.set(one.slug, parent);
      else parentOf.delete(one.slug);
    }
    return { parentOf, known };
  }

  const site = {
    /** Which contract the door read the files as. */
    contract: 2,
    /** The base language's tag: the schema's. */
    locale: base,
    /** Every language, base first: the schema's. */
    locales: [base, ...others],
    /** The site's currency, ISO 4217, upper case; `''` while nobody has said. */
    currency: String((isObject(siteFile.business) ? siteFile.business.currency : undefined) ?? siteFile.currency ?? '').toUpperCase(),
    /** Every block type the schema declares. */
    types,
    /** One block type, by name. */
    type: typeOf,
    /** Every collection the schema declares, in its order. */
    collections: [...collections.values()],
    collection: (name) => collections.get(name),
    /** The collections a module is pointed at — `{ services, resources }` — or nothing for a module the site has not turned on. */
    rolesOf: (module) => (isObject(catalogue.modules) && isObject(catalogue.modules[module]) ? catalogue.modules[module] : undefined),

    page(address, locale) {
      const language = want(locale);
      const clean = address.length > 1 ? address.replace(/\/+$/, '') : address;
      const wanted = baseAddressOf(clean, language);
      const doc =
        documents.find((one) => one.collection === undefined && one.locale === language && one.baseAddress === wanted) ??
        (language === '' ? documents.find((one) => one.collection === undefined && one.path === clean) : undefined);
      return doc === undefined ? nobodysPage(inLocale(language, wanted), language) : pageOf(doc);
    },
    pages(locale) {
      const language = want(locale);
      return documents.filter((doc) => doc.collection === undefined && doc.locale === language).map((doc) => pageOf(doc));
    },
    shared(locale) {
      const language = want(locale);
      const found = shared.get(language);
      const { blocks, block: find } = blocksOf(found?.blocks ?? [], 'shared:', language);
      return { kind: 'shared', locale: language, file: found?.file, blocks, block: find };
    },
    /**
     * The business's facts by role: none in contract 2, whose catalogue
     * says no `role` — its facts are the template's (`src/data/site.ts`)
     * and the platform's settings, read by nothing here (wiki/98 §0, 5). A
     * template asks the same question of either contract and falls back to
     * its own where the answer is empty.
     */
    facts(locale) {
      return factsOf(site.shared(locale), [], typeOf);
    },
    module(name) {
      const file = byPath.get(`/jtk/${name}.json`);
      const found = isObject(file) && Array.isArray(file.blocks) ? file.blocks.find((one) => isObject(one) && one.type === `${name}_config`) : undefined;
      if (found === undefined) return {};
      const { type: _type, v: _v, _key, ...settings } = found;
      return settings;
    },
    /**
     * A module's settings read like any values — `rows('hours')`, `text`,
     * `value` — for a template that draws them. Contract 2 has no annotation
     * for them: the settings are edited in the module's screens, and
     * `blocks[0].hours[2]` on a page would name the page's own first block.
     */
    settings(name) {
      return reader(site.module(name), { at: () => ({}), fields: [] });
    },

    entries,
    entry(name, idOrSlug, locale) {
      const doc = documents.find((one) => one.collection === name && one.locale === want(locale) && one.slug === idOrSlug);
      return doc === undefined ? undefined : entryOf(doc);
    },
    specimens: (name, { locale } = {}) => specimens(name, locale),

    addressOf: (entry) => entry?.address,
    anchorOf: (entry) => entry?.anchor,
    listingOf(name, locale, page = 1) {
      const collection = collections.get(name);
      const first = inLocale(want(locale), collection?.prefix ?? `/${name}`);
      return page <= 1 ? first : `${first}/page/${page}`;
    },
    /** The page a collection without pages is listed on: its prefix, in a language. */
    shownOn(name, locale) {
      const collection = collections.get(name);
      return collection === undefined || collection.pages ? undefined : inLocale(want(locale), collection.prefix);
    },
    /** Which of the site's languages an address is in: `''` for the base. No base path in front. */
    localeOf: (address) => localeOfAddress(address, others),
    /** An address in a language: `/about` → `/de/about`, `/` → `/de`. */
    inLocale: (locale, address) => inLocale(want(locale), address),

    /** The language switch's languages: on contract 2 the alternates, the files a document has in each language. */
    languagesOf: (document) => site.alternatesOf(document),
    alternatesOf(document) {
      if (document?.kind === 'page') {
        const self = documents.find((doc) => doc.file === document.file && doc.file !== undefined);
        if (self === undefined) return [];
        const found = documents
          .filter((doc) => doc.collection === undefined && doc.baseAddress === self.baseAddress && every.includes(doc.locale))
          .map((doc) => ({ locale: doc.locale, address: doc.path }));
        return found.length > 1 ? found : [];
      }
      if (document?.kind === 'entry') {
        if (document.address === undefined || document.specimen) return [];
        // In the order a build of the scaffold has always written them: by
        // `<language>/<slug>`, the base with no language — the ids Astro's
        // content store sorts by. Nothing reads meaning into it; it is kept
        // so that the door changed no page it did not mean to.
        const keyOf = (doc) => (doc.locale === '' ? doc.slug : `${segmentOf(doc.locale)}/${doc.slug}`);
        const found = documents
          .filter((one) => one.collection === document.collection && one.slug === document.slug && one.shown && every.includes(one.locale))
          .sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
          .map((doc) => ({ locale: doc.locale, address: entryOf(doc).address }));
        return found.length > 1 ? found : [];
      }
      return [];
    },

    groupsOf(name, list, locale) {
      const collection = collections.get(name);
      if (collection === undefined) return undefined;
      const field = groupField(collection, collection.fields);
      if (field === undefined) return undefined;
      const language = want(locale);
      // A select's label is the repository's words, drawn fixed; a category's
      // title is that entry's, and a tap on the heading opens it.
      const headings =
        field.kind === 'select'
          ? selectHeadings(field, (text) => words(text, language)).map((one) => ({ ...one, at: {}, fixed: true }))
          : collections.has(field.ref)
            ? refHeadings(entries(field.ref, { locale: language }), language === '' ? [] : entries(field.ref, { locale: '' })).map((one) => ({
                key: one.key,
                text: one.text,
                entry: one.entry,
                at: titleOf(one.entry),
                fixed: !one.entry.fields.tappable('title'),
              }))
            : undefined;
      return headings === undefined ? undefined : grouped(list, field.key, headings);
    },

    referrersOf(entry) {
      const collection = collections.get(entry?.collection);
      if (collection === undefined) return [];
      const tree = treeIn(collection, entry.locale);
      const below = tree === undefined ? [] : descendants(entry.slug, tree.parentOf, tree.known);
      const slugs = new Set([entry.slug, ...below]);
      const out = [];
      for (const other of collections.values()) {
        if (other.name === collection.name) continue;
        const pointers = pointersInto(collection.name, other.fields);
        if (pointers.length === 0) continue;
        const found = entries(other.name, { locale: entry.locale }).filter((one) => pointsAtAny(one, pointers, slugs));
        if (found.length === 0) continue;
        const { shown, more } = capped(found, other.per_page);
        out.push({ collection: other, entries: shown, more });
      }
      return out;
    },

    treeOf(entry) {
      const collection = collections.get(entry?.collection);
      const field = collection === undefined ? undefined : treeFields(collection, collection.fields)[0];
      if (field === undefined) return { trail: [], children: [], more: 0 };
      const all = entries(collection.name, { locale: entry.locale });
      const bySlug = new Map(all.map((one) => [one.slug, one]));
      const parentOf = new Map();
      for (const one of all) {
        const parent = one.fields.value(field.key);
        if (typeof parent === 'string') parentOf.set(one.slug, parent);
      }
      // The entry itself may be hidden and still built (it is being looked at
      // before it is out), so its own parent is read off it, not off the list.
      const own = entry.fields.value(field.key);
      if (typeof own === 'string') parentOf.set(entry.slug, own);
      const trail = ancestors(entry.slug, parentOf, new Set(bySlug.keys())).map((one) => bySlug.get(one)).reverse();
      const { shown, more } = capped(all.filter((one) => one.fields.value(field.key) === entry.slug && one.slug !== entry.slug), collection.per_page);
      return { trail, children: shown, more };
    },

    /**
     * A collection's listing as its pages draw it: the entries in the
     * listing's order — group by group where it is grouped, so a page is cut
     * out of the grouped list and page two opens under the heading page one
     * closed with — and how many to a page. One page without a `per_page`.
     */
    listingPages(name, locale) {
      const collection = collections.get(name);
      if (collection === undefined) throw new Error(`no collection named "${name}" in jtk/catalogue.json`);
      for (const doc of documents) {
        if (doc.collection !== name || !doc.slug.startsWith('page/')) continue;
        throw new Error(
          `${name}: the entry ${doc.path} sits at ${collection.prefix}/${doc.slug}, which is the address of a page of the ` +
            `collection's listing (${collection.prefix}/page/<n>) — move the file out of a folder called "page" (docs/collections.md)`,
        );
      }
      const all = entries(name, { locale });
      const runs = site.groupsOf(name, all, locale);
      const list = runs === undefined ? all : runs.flatMap((run) => run.entries);
      const size = collection.per_page !== undefined && collection.per_page > 0 ? collection.per_page : Number.POSITIVE_INFINITY;
      return { entries: list, size, last: Math.max(1, Math.ceil(list.length / size)) };
    },

    /**
     * A price as the page says it, in the site's currency: whole minor units
     * (contract 2) or `{ minor }` (contract 3) in, «CHF 45.–» out.
     */
    money(value, locale) {
      const minor = isObject(value) ? Number(value.minor) : Number(value);
      const tag = langOf(want(locale)) || undefined;
      return priced(minor, site.currency || undefined, tag);
    },

    words,
    // Contract 2's words are said as they always were, unmarked.
    wordsLang: () => '',
    tappable,

    /**
     * Every page and entry document as its file holds it, for the kit's own
     * checks — the lint, the progress, `_meta.json` — which compare the
     * files against what was built and so read contract 2 as it is.
     */
    documents: () =>
      documents.map((doc) => ({
        file: doc.file,
        path: doc.path,
        locale: doc.locale,
        collection: doc.collection,
        slug: doc.slug,
        seo: doc.seo,
        blocks: doc.blocks,
        visible: doc.raw.visible,
        shown: doc.shown,
      })),
    /** Every shared document, by language, as its file holds it. */
    sharedDocuments: () => [...shared.values()].map((one) => ({ file: one.file, locale: one.locale, blocks: one.blocks })),
  };
  return site;
}

/**
 * The content as one document, read off a disk — `@jtakeit/kit/content/node`'s,
 * where it lives now; kept here, where it was exported before the door, and
 * loaded only when called, so this module stays free of Node.
 * @param {string} root
 * @param {{ dir?: string; now?: number }} [options]
 */
export async function collectContent(root, options) {
  const node = await import('./node.mjs');
  return node.collectContent(root, options);
}

export { segmentOf };
