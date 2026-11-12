/**
 * The merge of an original and its translation (jtakeit-core wiki/95 §2,
 * wiki/98 §3.3, §4.4, §15 · 2–3): the one rule, in the kit, that the
 * platform's `Content.Served` is in Go, held equal by one fixture corpus
 * (§1, 3).
 *
 *   const { merged, fromBase } = mergeDocument(schema, base, translation);
 *
 * `base` is a contract-3 document as its file holds it — a page
 * (`jtk/pages/…`), an entry (`jtk/entries/<collection>/…`) or the shared
 * text (`jtk/shared.json`) — and `translation` the file beside it
 * (`prices.en.json`, `shared.en.json`), or nothing. `merged` is the document
 * a visitor is served in that language, in the base's shape — hidden
 * (`visible: false`) where the language is held back, or where nobody
 * translated an entry its collection hides untranslated. `fromBase` is every
 * place whose value is the original's words, because nobody translated it —
 * what a page marks with the original's `lang`.
 *
 * ── the rule ────────────────────────────────────────────────────────────────
 *
 *   - A translation holds only localized values, each block and row named by
 *     its `_key`, never by its place. What it does not say is the original's.
 *   - Which values are localized: by kind (wiki/95 §2), unless the field says
 *     `localized`. The text kinds are; a picture's words (`alt`) are, its
 *     file, focus and poster are not; a gallery is the original's pictures,
 *     each with its words per language; a list is the original's rows, each
 *     with its words per language — or, `localized: true`, a list of its own
 *     per language. A number, a price, a date, a choice, a reference, a phone
 *     number, a link (unless it says `localized`) are the same everywhere:
 *     the translation of a shared value is the base, everywhere (§4.4).
 *   - A page's and an entry's `name`, `slug` and SEO are words; `id`, `path`,
 *     `collection`, `rank` and the schedule are the original's.
 *   - An entry's body (`blocks`) is whole per language: a translation with a
 *     body of its own replaces the original's, one without shows it (§15 · 2).
 *   - An entry held back in a language — `visible: false` in its translation
 *     — is served there hidden: `merged.visible` is `false`.
 *   - An entry with no translation is the original in every language, its
 *     words marked; hidden there, as held back, where its collection says
 *     `untranslated: "hide"`.
 *   - A key the schema does not declare is never read from a translation
 *     (§15 · 17), nor a block, a row or a picture the original has not got.
 *
 * ── the places ──────────────────────────────────────────────────────────────
 *
 * A place is said as the annotation grammar says it (§5), without the
 * document — the same words `translated` keys a translation's record by
 * (§4.4): `blocks[hero].title`, `blocks[hero].image.alt`,
 * `blocks[faq].items[r7k2].answer`, `blocks[gal].pictures[g1].alt`; on an
 * entry its own values under `fields`, `fields.title`, `fields.cover.alt`, as
 * the file holds them; and the three that are no value of a block, `name`,
 * `slug` and `seo.<key>`. An entry's body is one place, `blocks`, since it is
 * one value per language. The platform's merge (`content.Lay`) says them so.
 *
 * A value counts as from the base only where the original has one: an empty
 * value came from nowhere.
 *
 * Imports nothing: the door runs in a Vite build, in Node and in a test alike.
 */

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Empty is absent: `null`, `""`, whitespace-only text and `[]` (wiki/98 §1, 6; §15 · 15). */
export function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

/** The kinds whose words are per language unless a field says `localized: false` (§3.3). */
const WORDS = new Set(['text', 'textarea', 'richtext_lite', 'markdown']);

/**
 * How a translation is laid over the original for one field (§3.3 `localized`, §3.4):
 *
 *   'whole'   the translation's value, where it has one: the text kinds, and
 *             a picture, a link or a list that says `localized: true`;
 *   'shared'  always the original's: a number, a price, a date, a reference;
 *   'media'   one picture: the original's file, its focus and poster, the
 *             translation's words (`alt`);
 *   'gallery' the original's pictures, each with the translation's words, by `_key`;
 *   'rows'    the original's rows, each laid over by the row of the same `_key`.
 *
 * @param {{ kind?: unknown; localized?: unknown; multiple?: unknown }} field
 * @returns {'whole' | 'shared' | 'media' | 'gallery' | 'rows'}
 */
export function layOf(field) {
  const said = typeof field?.localized === 'boolean' ? field.localized : undefined;
  if (field?.kind === 'media') {
    if (said === true) return 'whole';
    return field.multiple === true ? 'gallery' : 'media';
  }
  if (field?.kind === 'list') return said === true ? 'whole' : 'rows';
  if (WORDS.has(/** @type {string} */ (field?.kind))) return said === false ? 'shared' : 'whole';
  if (field?.kind === 'url') return said === true ? 'whole' : 'shared';
  return 'shared';
}

/**
 * Which kind of document a file holds, by its keys: an entry names its
 * `collection`; the shared text is `blocks` alone; anything else is a page.
 * @param {unknown} document
 * @returns {'page' | 'entry' | 'shared'}
 */
export function kindOf(document) {
  if (!isObject(document)) return 'page';
  if (typeof document.collection === 'string' && document.collection !== '') return 'entry';
  if (document.id === undefined && document.path === undefined && document.name === undefined) return 'shared';
  return 'page';
}

/**
 * Which keys of a laid object the translation gave: the one record of "came
 * from the base", kept beside the values rather than inside them so that a
 * value reads exactly as its file wrote it. The door's readers ask it for an
 * object that has no place the grammar can say (a block without a `_key`).
 * @type {WeakMap<object, Set<string>>}
 */
const GIVEN = new WeakMap();
/** The gallery pictures a translation gave words to. @type {WeakSet<object>} */
const ALT_GIVEN = new WeakSet();

/** Whether a value of a laid object is the translation's; `undefined` for an object no merge laid. */
export function given(object, key) {
  const set = GIVEN.get(object);
  return set === undefined ? undefined : set.has(key);
}

/** Whether a laid object is one a merge made. */
export const laid = (object) => GIVEN.has(object);

/** Whether a gallery's picture has the translation's words. */
export const altGiven = (picture) => isObject(picture) && ALT_GIVEN.has(picture);

/**
 * The schema as the merge reads it: each block type's fields, each
 * collection's type's fields and its `untranslated`, and `page_seo`.
 * @param {any} schema `jtk/schema.json`
 */
function readSchema(schema) {
  const types = new Map();
  for (const one of Array.isArray(schema?.blocks) ? schema.blocks : []) {
    if (isObject(one) && typeof one.type === 'string' && !types.has(one.type)) types.set(one.type, Array.isArray(one.fields) ? one.fields.filter(isObject) : []);
  }
  const collections = new Map();
  for (const one of Array.isArray(schema?.collections) ? schema.collections : []) {
    if (!isObject(one) || typeof one.name !== 'string' || collections.has(one.name)) continue;
    collections.set(one.name, { fields: types.get(one.type) ?? [], untranslated: one.untranslated === 'hide' ? 'hide' : 'base', route: one.route });
  }
  const seo = (Array.isArray(schema?.page_seo) ? schema.page_seo : []).filter((one) => isObject(one) && typeof one.key === 'string');
  return { types, collections, seo, fieldsOf: (type) => types.get(type) ?? [] };
}

/**
 * The merge, for one schema: read once, asked once per document and language.
 *
 * @param {any} schema `jtk/schema.json`, contract 3
 */
export function overlay(schema) {
  const read = readSchema(schema);

  /**
   * One object — a block, a row, an entry's `fields`, a page's `seo` — with
   * a translation's object at the same place laid over it.
   *
   * @param {Record<string, unknown>} base
   * @param {unknown} over
   * @param {any[]} fields its declaration
   * @param {string | undefined} trail its place, `blocks[hero].`; nothing where it has none the grammar can say
   * @param {string[]} from where the original's words are kept, appended to
   */
  function layObject(base, over, fields, trail, from) {
    const out = { ...base };
    const gave = new Set();
    const theirs = isObject(over) ? over : {};
    const note = (place) => {
      if (trail !== undefined) from.push(`${trail}${place}`);
    };
    for (const field of fields) {
      if (!isObject(field) || typeof field.key !== 'string') continue;
      const key = field.key;
      const own = base[key];
      const mine = theirs[key];
      const how = layOf(field);
      if (how === 'whole') {
        if (!isEmpty(mine)) {
          out[key] = mine;
          gave.add(key);
        } else if (!isEmpty(own)) note(key);
      } else if (how === 'media') {
        if (!isObject(own)) continue;
        if (isObject(mine) && !isEmpty(mine.alt)) {
          out[key] = { ...own, alt: mine.alt };
          gave.add(key);
        } else if (!isEmpty(own.alt)) note(`${key}.alt`);
      } else if (how === 'gallery' || how === 'rows') {
        if (!Array.isArray(own)) continue;
        const byKey = new Map();
        for (const one of Array.isArray(mine) ? mine : []) {
          if (isObject(one) && typeof one._key === 'string' && !byKey.has(one._key)) byKey.set(one._key, one);
        }
        let any = false;
        out[key] = own.map((row) => {
          if (!isObject(row)) return row;
          const rowKey = typeof row._key === 'string' ? row._key : undefined;
          const match = rowKey === undefined ? undefined : byKey.get(rowKey);
          if (how === 'gallery') {
            if (match !== undefined && !isEmpty(match.alt)) {
              any = true;
              const words = { ...row, alt: match.alt };
              ALT_GIVEN.add(words);
              return words;
            }
            if (!isEmpty(row.alt) && rowKey !== undefined) note(`${key}[${rowKey}].alt`);
            return row;
          }
          if (match !== undefined) any = true;
          return layObject(row, match, Array.isArray(field.of) ? field.of.filter(isObject) : [], trail !== undefined && rowKey !== undefined ? `${trail}${key}[${rowKey}].` : undefined, from);
        });
        if (any) gave.add(key);
      }
    }
    GIVEN.set(out, gave);
    return out;
  }

  /**
   * A document's blocks with a translation's laid over them, each by its
   * `_key`: a page's blocks are the developer's structure, shared, with their
   * words per language (§4.4). A block only the translation has is nobody's;
   * one without a `_key` cannot be matched and keeps the original's words.
   *
   * @param {unknown} blocks the original's
   * @param {unknown} over the translation's
   * @param {string[]} from
   */
  function layBlocks(blocks, over, from) {
    const theirs = new Map();
    for (const one of Array.isArray(over) ? over : []) {
      if (isObject(one) && typeof one._key === 'string' && !theirs.has(one._key)) theirs.set(one._key, one);
    }
    return (Array.isArray(blocks) ? blocks : []).map((one) => {
      if (!isObject(one)) return one;
      const key = typeof one._key === 'string' ? one._key : undefined;
      return layObject(one, key === undefined ? undefined : theirs.get(key), read.fieldsOf(one.type), key === undefined ? undefined : `blocks[${key}].`, from);
    });
  }

  /**
   * A document's SEO in a language: the original's, the translation's words
   * over it, for the keys `page_seo` declares (§3.1: its fields are
   * localized, each by its kind as any field is).
   */
  function laySeo(base, over, from) {
    if (!isObject(base) && !isObject(over)) return undefined;
    const out = layObject(isObject(base) ? base : {}, over, read.seo, 'seo.', from);
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /**
   * One word of the document's own: `name`, `slug`. A slug left as the
   * original's is not counted: an address has no language (the platform's
   * corpus, `entry-words`), and the page it names is in the language all the
   * same.
   */
  function word(out, base, over, key, from) {
    const mine = isObject(over) ? over[key] : undefined;
    if (typeof mine === 'string' && !isEmpty(mine)) out[key] = mine;
    else if (key !== 'slug' && !isEmpty(base[key])) from.push(key);
  }

  /**
   * A document in a language.
   *
   * @param {Record<string, any>} base the original, as its file holds it
   * @param {Record<string, any> | null | undefined} translation the file beside it, or nothing
   * @param {{ kind?: 'page' | 'entry' | 'shared' }} [options] its kind, where its keys do not say it
   * @returns {{ merged: Record<string, any> | null; fromBase: string[] }}
   */
  function merge(base, translation, options = {}) {
    if (!isObject(base)) return { merged: null, fromBase: [] };
    const kind = options.kind ?? kindOf(base);
    const over = isObject(translation) ? translation : undefined;
    /** @type {string[]} */
    const from = [];
    const merged = { ...base };

    if (kind === 'shared') {
      if (Array.isArray(base.blocks)) merged.blocks = layBlocks(base.blocks, over?.blocks, from);
      return { merged, fromBase: from };
    }

    if (kind === 'page') {
      word(merged, base, over, 'name', from);
      const seo = laySeo(base.seo, over?.seo, from);
      if (seo !== undefined) merged.seo = seo;
      if (Array.isArray(base.blocks)) merged.blocks = layBlocks(base.blocks, over?.blocks, from);
      return { merged, fromBase: from };
    }

    // An entry.
    const collection = read.collections.get(base.collection);
    word(merged, base, over, 'slug', from);
    const seo = laySeo(base.seo, over?.seo, from);
    if (seo !== undefined) merged.seo = seo;
    const fields = layObject(isObject(base.fields) ? base.fields : {}, over?.fields, collection?.fields ?? [], 'fields.', from);
    if (isObject(base.fields) || Object.keys(fields).length > 0) merged.fields = fields;
    else GIVEN.set(fields, new Set());
    // The body, whole per language.
    if (over !== undefined && Array.isArray(over.blocks) && over.blocks.length > 0) merged.blocks = over.blocks;
    else if (Array.isArray(base.blocks) && base.blocks.length > 0) from.push('blocks');
    // Held back in this language — or hidden in it, where nobody translated
    // the entry and its collection says so (`untranslated: "hide"`): served
    // hidden, every word the original's, as a held-back one is.
    if (over?.visible === false || (over === undefined && collection?.untranslated === 'hide')) merged.visible = false;
    return { merged, fromBase: from };
  }

  return { merge, layObject, layBlocks, laySeo, schema: read };
}

/**
 * The merge of one document, for a caller with one to merge: the corpus,
 * a tool, a test.
 *
 * @param {any} schema `jtk/schema.json`
 * @param {Record<string, any>} base
 * @param {Record<string, any> | null | undefined} translation
 * @param {{ kind?: 'page' | 'entry' | 'shared' }} [options]
 */
export function mergeDocument(schema, base, translation, options) {
  return overlay(schema).merge(base, translation, options);
}

// ── what a document holds that is per language ─────────────────────────────

/**
 * Every localized value a document holds, by its place (the places above):
 * what a translation of it may say, and what is missing where it does not.
 * An entry's body is one value, `blocks`.
 *
 * @param {any} schema
 * @param {Record<string, any>} document an original, or a translation (whose values are only ever localized)
 * @param {'page' | 'entry' | 'shared'} kind
 * @returns {{ place: string; value: unknown }[]}
 */
export function localizedIn(schema, document, kind) {
  const read = readSchema(schema);
  const out = [];
  if (!isObject(document)) return out;
  const walk = (values, fields, trail) => {
    if (!isObject(values)) return;
    for (const field of fields) {
      if (!isObject(field) || typeof field.key !== 'string') continue;
      const key = field.key;
      const value = values[key];
      if (isEmpty(value)) continue;
      const how = layOf(field);
      if (how === 'whole') out.push({ place: `${trail}${key}`, value });
      else if (how === 'media') {
        if (isObject(value) && !isEmpty(value.alt)) out.push({ place: `${trail}${key}.alt`, value: value.alt });
      } else if (how === 'gallery' || how === 'rows') {
        if (!Array.isArray(value)) continue;
        for (const row of value) {
          if (!isObject(row) || typeof row._key !== 'string') continue;
          if (how === 'gallery') {
            if (!isEmpty(row.alt)) out.push({ place: `${trail}${key}[${row._key}].alt`, value: row.alt });
          } else walk(row, Array.isArray(field.of) ? field.of.filter(isObject) : [], `${trail}${key}[${row._key}].`);
        }
      }
    }
  };
  const blocks = (list) => {
    for (const block of Array.isArray(list) ? list : []) {
      if (isObject(block) && typeof block._key === 'string') walk(block, read.fieldsOf(block.type), `blocks[${block._key}].`);
    }
  };
  if (kind === 'shared') {
    blocks(document.blocks);
    return out;
  }
  const word = kind === 'page' ? 'name' : 'slug';
  if (!isEmpty(document[word])) out.push({ place: word, value: document[word] });
  walk(document.seo, read.seo, 'seo.');
  if (kind === 'page') blocks(document.blocks);
  else {
    walk(document.fields, read.collections.get(document.collection)?.fields ?? [], 'fields.');
    if (Array.isArray(document.blocks) && document.blocks.length > 0) out.push({ place: 'blocks', value: document.blocks });
  }
  return out;
}

/**
 * The value at a place of a document, as the places above say it — `name`,
 * `seo.title`, `blocks[hero].image.alt`, `blocks[faq].items[r1].answer`, an
 * entry's `title` or its body `blocks` — or `undefined` where there is none.
 *
 * @param {Record<string, any>} document
 * @param {string} place
 * @param {'page' | 'entry' | 'shared'} kind
 */
export function valueAt(document, place, kind) {
  if (!isObject(document) || typeof place !== 'string') return undefined;
  if (kind === 'entry' && (place === 'blocks' || place === 'slug')) return document[place];
  if (kind === 'page' && place === 'name') return document.name;
  let at = place;
  /** @type {any} */
  let here = document;
  if (at.startsWith('seo.')) {
    here = document.seo;
    at = at.slice(4);
  } else if (at.startsWith('blocks[')) {
    const close = at.indexOf('].');
    if (close === -1) return undefined;
    const key = at.slice('blocks['.length, close);
    here = (Array.isArray(document.blocks) ? document.blocks : []).find((one) => isObject(one) && one._key === key);
    at = at.slice(close + 2);
  }
  // FIELD ( [KEY] . FIELD )* [ . PART ]
  const steps = at.split('.');
  for (let i = 0; i < steps.length; i++) {
    if (!isObject(here)) return undefined;
    const step = steps[i];
    const row = /^([a-z][a-z0-9_]*)\[([^\]]+)\]$/.exec(step);
    if (row !== null) {
      const list = here[row[1]];
      here = Array.isArray(list) ? list.find((one) => isObject(one) && one._key === row[2]) : undefined;
      continue;
    }
    here = here[step];
  }
  return here;
}
