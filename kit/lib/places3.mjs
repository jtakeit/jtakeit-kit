/**
 * What a contract-3 page owes the owner, and what an annotation on it may
 * name: the grammar by key (jtakeit-core wiki/98 §5) held against a schema.
 *
 * The rules are the platform's build lint's (`sitebuild/annotation-lint.mjs`,
 * `lint3`), and two of the kit's readers ask them of a built page: `jtkit
 * lint`, which says what the build will say before the push, and `jtk
 * schema`, which holds the schema it has just written to the page both ways.
 * One copy, so the two cannot come to disagree about a page:
 *
 *   expected     every filled value the owner taps, where it has to be
 *                annotated — a field that says `client_editable: true`
 *                (absent is false, §3.3) of a kind a person taps; a block, a
 *                row and a gallery's picture by its `_key`, a single
 *                picture by its file (`image.src`); an entry's own value by
 *                its field's name alone; nothing deeper than a row's own list,
 *                which the grammar cannot name
 *
 *   declares     whether a place is declared in a document, filled or not —
 *                a bind or a tile names a field the owner may not have filled
 *                in yet, and an empty field is still the one the tap opens
 *
 * Empty is absent (§4.7), spaces included (§15 · 15): a value of spaces asks
 * for no annotation, as the door draws none.
 *
 * And where a price sits (`pricePaths`), which the lint's currency check and
 * `jtkit progress` both ask of a schema.
 */
import { ADVISED, TAPPABLE } from './content/index.mjs';

/** A `_key` and an id, as the grammar names them (§15 · 16). */
export const KEY = /^[a-z][a-z0-9-]{0,31}$/;
export const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A place by key: the platform's own expression of it (sitebuild/annotation-lint.mjs, `BOUND_KEYED`). */
export const BOUND_KEYED = /^(shared:)?(?:blocks\[([a-z][a-z0-9-]{0,31})\]\.)?([a-z][a-z0-9_]{0,39})(?:\[[a-z][a-z0-9-]{0,31}\]\.([a-z][a-z0-9_]{0,39})(?:\[[a-z][a-z0-9-]{0,31}\]\.([a-z][a-z0-9_]{0,39}))?)?(?:\.(src|alt|focus|poster))?$/;
/** Another document by its id, then a place in it. */
export const DOCUMENT_ID = /^(page|entry):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(.+)$/;
/** Contract 2's place by index, which a contract-3 page does not write. */
export const BY_INDEX = /^(shared:)?blocks\[\d+\]\./;
/** A picture's parts, which end a path. */
export const PICTURE = new Set(['src', 'alt', 'focus', 'poster']);

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Empty is absent (§1, 6; §4.7), spaces included (§15 · 15). */
export const isEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
/** A picture's file: a string, or an object's `src`; `''` for none. */
export const srcOf = (value) => (typeof value === 'string' ? value.trim() : isObject(value) && typeof value.src === 'string' ? value.src.trim() : '');
/** Absent is false (§3.3): only what says `client_editable: true` is the owner's to tap. */
export const tappable3 = (field) => TAPPABLE.has(field.kind) && field.client_editable === true && field.no_tap_target !== true;
/** What the platform's rule adds to `tappable3` (wiki/111 E1): a phone, an email, a link, a choice, a date, a time, a number — advice, `JTK_W_UNANNOTATED_FIELD`, where it is drawn without its annotation. */
export const widened3 = (field) => ADVISED.has(field.kind) && field.client_editable === true && field.no_tap_target !== true;

/**
 * The rules over one schema.
 *
 * @param {any} schema `jtk/schema.json`, contract 3's
 * @param {unknown[]} shared the shared text's blocks a `shared:` place is looked for in
 */
export function placesIn(schema, shared, { which = tappable3 } = {}) {
  const types = new Map((Array.isArray(schema?.blocks) ? schema.blocks : []).filter(isObject).map((one) => [one.type, one]));
  const fieldsOfType = (name) => (Array.isArray(types.get(name)?.fields) ? types.get(name).fields.filter(isObject) : []);
  const collections = new Map((Array.isArray(schema?.collections) ? schema.collections : []).filter(isObject).map((one) => [one.name, one]));
  /** An entry's own fields: its collection's type's. */
  const fieldsOfEntry = (entry) => fieldsOfType(collections.get(entry.collection)?.type);
  const sharedBlocks = Array.isArray(shared) ? shared : [];

  /**
   * Every place a filled, tappable value under `values` is annotated at (the
   * build's `expected`): `prefix` is the place of `values` itself, `steps`
   * how many rows deep it already is.
   */
  function expected(values, fields, prefix, steps = 0) {
    const places = [];
    for (const field of fields) {
      if (typeof field.key !== 'string') continue;
      const value = values[field.key];
      if (isEmpty(value)) continue;
      const here = prefix + field.key;
      if (field.kind === 'list') {
        if (!Array.isArray(value) || steps >= 2) continue;
        const of = Array.isArray(field.of) ? field.of.filter(isObject) : [];
        for (const row of value) if (isObject(row) && KEY.test(row._key ?? '')) places.push(...expected(row, of, `${here}[${row._key}].`, steps + 1));
        continue;
      }
      if (!which(field)) continue;
      if (field.kind === 'media' && field.multiple === true) {
        if (!Array.isArray(value) || steps >= 2) continue;
        for (const item of value) if (isObject(item) && KEY.test(item._key ?? '') && srcOf(item) !== '') places.push(`${here}[${item._key}].src`);
        continue;
      }
      if (field.kind === 'media') {
        if (srcOf(value) !== '') places.push(`${here}.src`);
        continue;
      }
      places.push(here);
    }
    return places;
  }
  /** The places of a document's blocks: each block by its key, `prefix` before it (`shared:` for the shared text). */
  const blockPlaces = (blocks, prefix = '') =>
    (Array.isArray(blocks) ? blocks : []).filter((one) => isObject(one) && KEY.test(one._key ?? '')).flatMap((one) => expected(one, fieldsOfType(one.type), `${prefix}blocks[${one._key}].`));
  /** An entry's own values and its body, as its own page names them. */
  const entryPlaces = (entry) => [...expected(isObject(entry.fields) ? entry.fields : {}, fieldsOfEntry(entry), ''), ...blockPlaces(entry.blocks)];

  /**
   * Whether a place is declared — filled or not — in a document, by key (the
   * build's `declares3`). No block names an entry's own value, which only an
   * entry's own page or `entry:<id>:` may; `shared:` is the shared text's.
   */
  function declares(document, path, entry) {
    const found = BOUND_KEYED.exec(path);
    if (found === null) return false;
    const isShared = found[1] !== undefined;
    if (found[2] === undefined) return !isShared && entry && document !== undefined && holds(fieldsOfEntry(document), found[3], found[4], found[5], found[6]);
    const blocks = isShared ? sharedBlocks : Array.isArray(document?.blocks) ? document.blocks : [];
    const block = blocks.find((one) => isObject(one) && one._key === found[2]);
    return block !== undefined && holds(fieldsOfType(block.type), found[3], found[4], found[5], found[6]);
  }
  function holds(fields, key, sub, deep, part) {
    let here = fields.find((one) => one.key === key);
    if (here === undefined) return false;
    for (const next of [sub, deep]) {
      if (next === undefined) break;
      // A gallery's picture is a row whose fields are a picture's parts.
      if (here.kind === 'media' && here.multiple === true && PICTURE.has(next)) return next === (deep ?? sub) && part === undefined;
      here = here.kind === 'list' && Array.isArray(here.of) ? here.of.find((one) => isObject(one) && one.key === next) : undefined;
      if (here === undefined) return false;
    }
    return part === undefined || here.kind === 'media';
  }

  /**
   * The field a place names in a document and the value it holds there — the
   * page's own blocks, the shared text's (`shared:`), or an entry's own
   * values — or undefined where the document has no such place. A row and a
   * gallery's picture by their `_key`, a picture's part last.
   */
  function valueAt(document, path, entry) {
    const found = /^(shared:)?(?:blocks\[([a-z][a-z0-9-]{0,31})\]\.)?(.+)$/.exec(path);
    if (found === null) return undefined;
    let fields;
    let values;
    if (found[2] === undefined) {
      if (found[1] !== undefined || !entry || document === undefined) return undefined;
      fields = fieldsOfEntry(document);
      values = isObject(document.fields) ? document.fields : {};
    } else {
      const blocks = found[1] !== undefined ? sharedBlocks : Array.isArray(document?.blocks) ? document.blocks : [];
      const block = blocks.find((one) => isObject(one) && one._key === found[2]);
      if (block === undefined) return undefined;
      fields = fieldsOfType(block.type);
      values = block;
    }
    let field;
    let value = values;
    for (const step of found[3].split('.')) {
      if (field?.kind === 'media' && PICTURE.has(step)) return isObject(value) ? { field, value: value[step], part: step } : undefined;
      const named = /^([a-z][a-z0-9_]{0,39})(?:\[([a-z][a-z0-9-]{0,31})\])?$/.exec(step);
      if (named === null || !isObject(value)) return undefined;
      field = (field === undefined ? fields : Array.isArray(field.of) ? field.of.filter(isObject) : []).find((one) => one.key === named[1]);
      if (field === undefined) return undefined;
      value = value[named[1]];
      if (named[2] !== undefined) {
        const row = Array.isArray(value) ? value.find((one) => isObject(one) && one._key === named[2]) : undefined;
        if (row === undefined) return undefined;
        if (field.kind === 'media') return { field, value: row, part: undefined };
        value = row;
      }
    }
    return field === undefined ? undefined : { field, value };
  }

  return { types, collections, fieldsOfType, fieldsOfEntry, expected, blockPlaces, entryPlaces, declares, valueAt };
}

/** The kinds whose value a page draws as it is stored, in its words, an attribute or a link — so a page can be searched for it. */
const SEARCHABLE = new Set(['text', 'textarea', 'tel', 'email', 'url', 'number', 'select']);

/** A page's markup with the entities a build writes put back, its spaces as one. */
export function searchable(html) {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(quot|apos|lt|gt|nbsp|amp);/g, (_, name) => ({ quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&' })[name])
    .replace(/\s+/g, ' ');
}

/**
 * Whether a filled value a page does not annotate is on that page at all —
 * the line between a field this build does not draw (a template condition
 * hides it: KAIF's footer draws `tickets_label` only when the next night has
 * a ticket link, B9) and one drawn and left untappable. Asked of the page's
 * markup, words and attributes, for a value drawn as it is stored; a picture
 * or a body is drawn as something else, and is never said to be absent.
 *
 * @param {string} page `searchable(html)` of the built page
 * @param {any} field @param {unknown} value
 * @returns {boolean | undefined} true drawn, false not drawn, undefined not known
 */
export function drawnOn(page, field, value) {
  if (!isObject(field) || !SEARCHABLE.has(field.kind)) return undefined;
  let said;
  if (field.kind === 'select') {
    const option = (Array.isArray(field.options) ? field.options : []).find((one) => (isObject(one) ? one.value : one) === value);
    const label = isObject(option) ? option.label : undefined;
    said = [value, ...(typeof label === 'string' ? [label] : isObject(label) ? Object.values(label) : [])];
  } else said = [value];
  const words = said.filter((one) => typeof one === 'string' || typeof one === 'number').map((one) => String(one).replace(/\s+/g, ' ').trim()).filter((one) => one !== '');
  if (words.length === 0) return undefined;
  if (words.some((one) => page.includes(one))) return true;
  return field.kind === 'tel' && words.some((one) => page.includes(one.replace(/[\s().\-/]/g, ''))) ? true : false;
}

/**
 * Where a price sits in a block, by path from the block down: `costs`, or
 * `rates.costs` for one in a list's rows, one list deeper where a row holds
 * one (§3.3) — the preflight's `pricePaths`, over every block type, an
 * entry's own type among them.
 */
export function pricePaths(blocks) {
  const out = new Set();
  const walk = (fields, trail, depth) => {
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!isObject(field) || typeof field.key !== 'string') continue;
      const here = trail === '' ? field.key : `${trail}.${field.key}`;
      if (field.kind === 'money') out.add(here);
      if (field.kind === 'list' && depth < 2) walk(field.of, here, depth + 1);
    }
  };
  for (const block of Array.isArray(blocks) ? blocks : []) if (isObject(block)) walk(block.fields, '', 0);
  return out;
}
