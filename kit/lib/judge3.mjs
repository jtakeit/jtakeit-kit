/**
 * The platform's judge of a contract-3 schema, offline — what `jtk schema`
 * holds `jtk/schema.json` to before anything leaves the laptop.
 *
 *   judgeSchema(text)   every fault the platform's strict decode and its judge
 *                       would find in this text, each as { code, path, says }
 *
 * ── a copy, and the copy of one judge ───────────────────────────────────────
 *
 * The judge is Go, in the platform's `registry` package: `Judge` reads a text
 * that says `"contract": 3` with its own types, strictly at every depth
 * (`contract3.go`), and then holds it to the rules of `Faults` — contract 2's,
 * with the handful that differ (`catalogue.go`, `collections.go`,
 * `modules.go`, jtakeit-core wiki/98 §3, §16 · 2). This is that judge again,
 * in the same order and with the same three stages, for the reason
 * `jtk catalogue` keeps a copy of contract 2's: the answer "the platform will
 * not read this" is worth having when the declaration is saved, with the
 * place in it, and not a push later.
 *
 *   1. the keys, as written: every key contract 3 does not have, at every
 *      depth, all at once — and nothing else is said until there are none;
 *   2. the shapes: a value of the wrong JSON type is one
 *      `JTK_E_SCHEMA_UNREADABLE`, as Go's decoder gives one error; then an
 *      option, a reference or an order written as contract 2 wrote it;
 *   3. the rules, each block, field and collection stopping at its own first
 *      fault, as `Faults` does.
 *
 * Every finding carries the code the platform gives it and the path it gives
 * it (`blocks.hero.title.kind`, `collections.works.route.detail`,
 * `blocks[0].category.ref` where Go walks by index), so `jtk schema --judge`
 * can hold this copy to the judge code by code, and the platform's own exam
 * of contract 3 (`registry/testdata/contract3.json`) is sat by both. The
 * sentences are this kit's, in the platform's words where it has them.
 *
 * Besides the verdict, the advice of the judge's that is about the schema
 * alone (`adviseSchema`): where the panel guesses an entry's card,
 * `JTK_W_PANEL_FORM_GUESSED` (form.go's `adviseForms`), and a schema without
 * `render: "live"`, `JTK_W_NOT_LIVE` — and the card itself, resolved as the
 * panel draws it (`formsOf`, `ResolveForm`).
 *
 * What is not here, on purpose: the judge of the files beside the schema —
 * pages, entries, a module's settings, a translation (lib/translations.mjs) — which the
 * platform's import applies and `--judge` asks it for; and the bookings
 * module's `JTK_W_` advice, which `--judge` prints.
 *
 * Imports nothing but the codes, the merge's notion of what a module books
 * (content/overlay.mjs) and what a zone is (endsBy.mjs), which import
 * nothing: the dev server runs it on every save.
 */
import { E, W } from './codes.mjs';
import { bookedIn } from './content/overlay.mjs';
import { ENDS_AFTER_MAX, isZone } from './endsBy.mjs';

// ── the platform's constants, by their Go names ────────────────────────────

/** `keyRe`: a block type, a field key, a view key, a collection name. */
const keyRe = /^[a-z][a-z0-9_]{0,39}$/;
/** `generatorRe`: provenance, bounded because it is echoed. */
const generatorRe = /^[A-Za-z0-9@/._+-]{1,80}$/;
/** `ratioRe`: two whole numbers, neither of them zero. */
const ratioRe = /^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/;
/** `prefixRe`: an address of the site, at least one segment, no trailing slash. */
const prefixRe = /^\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;
/** `anchorRe`: a fragment, and nothing clever. */
const anchorRe = /^#[A-Za-z0-9_-]{1,64}$/;
const lucideRe = /^lucide:[a-z0-9]+(-[a-z0-9]+)*$/;
const pathRe = /^path:[MmZzLlHhVvCcSsQqTtAa0-9 .,-]{1,1000}$/;
/** `localeRe`: the language lowercase, the region in either case. */
const localeRe = /^[a-z]{2}(-[a-zA-Z]{2})?$/;

const LONGEST_LABEL = 300;
const PHOTOS_MAX = 7;
const SLUG = '{slug}';
const MEDIA_FOLDER = 'media';

/** `AllKinds`, and `sku`, which only contract 3 knows. */
const KINDS = new Set([
  'text', 'textarea', 'richtext_lite', 'number', 'tel', 'url', 'email', 'date', 'select', 'bool',
  'media', 'list', 'markdown', 'money', 'duration', 'time_of_day', 'ref',
]);
const knownKind = (kind) => KINDS.has(kind);
const knows = (kind) => knownKind(kind) || kind === 'sku';

const ENQUIRY_KEYS = new Set(['name', 'contact', 'phone', 'email', 'message', 'website']);
const ASK_KINDS = new Set(['text', 'textarea', 'number', 'bool', 'select', 'tel', 'email', 'url', 'date', 'time_of_day']);

/** The reserved keys of an entry, and what each must be when declared. */
const ENTRY_KINDS = new Map([['title', 'text'], ['date', 'date'], ['excerpt', 'textarea'], ['cover', 'media'], ['body', 'markdown']]);

/** `Roles`: what a field of the shared text may mean to the outside world (§3.3). */
export const ROLES = ['name', 'phone', 'email', 'street', 'postal_code', 'city', 'region', 'country', 'maps', 'social', 'price_range', 'business_type', 'hours'];

// ── the modules, as far as a schema is concerned (`modules.go`) ────────────
//
// Only what `validateModules` reads: the roles, which are required, and what
// each reads from an entry, by key and kind. The settings' own fields are the
// module's, judged in `jtk/modules/<module>.json` by the platform.

const weekRow = [
  { key: 'day', kind: 'select', required: true },
  { key: 'opens', kind: 'time_of_day', required: true },
  { key: 'closes', kind: 'time_of_day', required: true },
];
const rateRow = [
  { key: 'day', kind: 'select', required: true },
  { key: 'from', kind: 'time_of_day', required: true },
  { key: 'until', kind: 'time_of_day', required: true },
  { key: 'costs', kind: 'money', required: true },
  { key: 'from_unit', kind: 'number', required: false },
  { key: 'until_unit', kind: 'number', required: false },
];
const MODULES = new Map([
  ['bookings', {
    roles: [
      {
        name: 'services',
        required: true,
        means: 'How long one appointment takes, in minutes. An entry that leaves it empty is not offered: nothing can be laid on a grid without a length.',
        reads: [
          { key: 'takes', kind: 'duration', required: true, means: 'How long one appointment takes, in minutes. An entry that leaves it empty is not offered: nothing can be laid on a grid without a length.' },
          { key: 'costs', kind: 'money' },
          { key: 'per', kind: 'select', options: ['booking', 'person'] },
          { key: 'rates', kind: 'list', of: rateRow },
          { key: 'scale', kind: 'select', options: ['hourly', 'daily'] },
          { key: 'fewest', kind: 'number' },
          { key: 'most', kind: 'number' },
        ],
      },
      {
        name: 'resources',
        required: true,
        means: 'The collection of things that get occupied — masters, chairs, tables.',
        reads: [
          { key: 'hours', kind: 'list', of: weekRow },
          { key: 'does', kind: 'list', of: [{ key: 'service', kind: 'text', required: true }] },
          { key: 'seats', kind: 'number' },
          { key: 'spots', kind: 'number' },
          { key: 'marks', kind: 'text' },
          { key: 'class', kind: 'ref' },
        ],
      },
      { name: 'classes', required: false, means: 'The collection of classes the resources are grouped in.', reads: [{ key: 'costs', kind: 'money' }] },
    ],
  }],
]);

// ── the keys contract 3 has (`contract3.go`, its wire types) ───────────────

const KEYS = {
  schema: ['contract', 'generator', 'blocks', 'page_seo', 'collections', 'modules', 'locale', 'locales', 'shared', 'render'],
  block: ['type', 'v', 'label', 'hint', 'fields', 'views', 'collects', 'asks', 'photos', 'upcast', 'form'],
  view: ['key', 'label', 'min', 'max', 'ratio', 'needs_build'],
  field: [
    'key', 'label', 'hint', 'kind', 'required', 'min', 'max', 'options', 'of', 'client_editable', 'accept', 'multiple',
    'ratio', 'ref', 'no_tap_target', 'beside', 'titled_by', 'seo_sensitive', 'localized', 'role', 'integer', 'qualifiers',
  ],
  option: ['value', 'label'],
  ref: ['to', 'many', 'on_delete'],
  collection: ['name', 'label', 'one', 'intro', 'place', 'icon', 'type', 'order', 'group', 'blocks', 'untranslated', 'route', 'shown_on', 'ends_by'],
  route: ['detail', 'listing', 'per_page'],
  order: ['by', 'desc'],
  ends_by: ['date', 'time', 'after', 'zone', 'then'],
  // An entry type's card in the panel (`form3`, form.go), and a type's steps
  // from its older versions (`upcast3`, `upcastRows3`, upcast.go).
  form: ['sections', 'aside', 'widgets'],
  section: ['title', 'note', 'rows'],
  cell: ['field', 'span'],
  upcast: ['from', 'rename', 'rows', 'values', 'drop', 'set'],
  rows: ['rename', 'rows', 'values', 'drop', 'set'],
};

/** What contract 3 says instead of a word of contract 2's (`replacedIn3`). */
const REPLACED = {
  'schema.business_facts': 'contract 3 has no business facts — the business\'s own words are shared text, each field saying its `role` (`shared`, wiki/98 §4.5)',
  'schema.country': 'the country is the payee\'s own detail, not the schema\'s (wiki/98 §3.1)',
  'schema.currency': 'the currency is the site\'s setting, not the schema\'s (wiki/98 §3.1)',
  'schema.legal_name': 'the registered name is the payee\'s own detail, not the schema\'s (wiki/98 §3.1)',
  'schema.tax_id': 'the registration number is the payee\'s own detail, not the schema\'s (wiki/98 §3.1)',
  'view.sample': 'contract 3 has no sample — nothing read it (wiki/98 §3.2)',
  'field.deprecated': 'contract 3 retires a field by removing it, and keeps what it held aside (wiki/98 §3.3)',
  'field.option_labels': 'an option\'s words are its own label: "options": [{"value": "wood", "label": "Holz"}] (wiki/98 §3.3)',
  'collection.prefix': 'where the entries live is the collection\'s route: {"detail": "/works/{slug}", "listing": "/works"}, or "none" with shown_on (wiki/98 §3.5)',
  'collection.pages': 'an entry without a page of its own is route "none", with shown_on naming where it is shown (wiki/98 §3.5)',
  'collection.listing': 'the listing is the route\'s: {"detail": "/works/{slug}", "listing": "/works"} (wiki/98 §3.5)',
  'collection.per_page': 'pagination is the route\'s: {"detail": "/works/{slug}", "listing": "/works", "per_page": 12} (wiki/98 §3.5)',
  'collection.body': 'the block types an entry may hold are the collection\'s `blocks` (wiki/98 §3.5)',
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const q = (value) => JSON.stringify(value);
/** Go's `len` of a string: its bytes. */
const bytes = (words) => new TextEncoder().encode(words).length;

/** `CanonicalLocale`: how a tag is spelt here, or `null` for one that is not a language. */
export function canonicalTag(tag) {
  if (typeof tag !== 'string' || !localeRe.test(tag)) return null;
  const [language, region] = tag.split('-');
  return region === undefined ? language : `${language}-${region.toUpperCase()}`;
}

/** `tagOf`: how a language is named in a pattern's map — the site's own by the schema's tag. */
const tagOf = (locale, base) => canonicalTag(locale === '' ? base : locale) ?? (locale === '' ? base : locale);

// ── 1 · the keys, as written ───────────────────────────────────────────────

function eachObject(list, fn) {
  if (!Array.isArray(list)) return;
  list.forEach((one, i) => {
    if (isObject(one)) fn(i, one);
  });
}

/** Where an object of a list is: by the name it gives itself, or its place. */
function named(owner, object, key, i) {
  const name = object[key];
  return typeof name === 'string' && name !== '' ? `${owner}.${name}` : `${owner}[${i}]`;
}

/** `unknownKeys3`: every key contract 3 has not got, each at its place, at once. */
function strayKeys(top) {
  const out = [];
  const say = (at, object, kind) => {
    const known = new Set(KEYS[kind]);
    for (const key of Object.keys(object).sort()) {
      if (known.has(key)) continue;
      const where = at === '' ? key : `${at}.${key}`;
      const instead = REPLACED[`${kind}.${key}`];
      out.push({
        code: E.SCHEMA_KEY,
        path: where,
        says: instead === undefined
          ? `${where} is not a key of contract 3's schema, and nothing would read it`
          : `${where} is contract 2's — ${instead}`,
      });
    }
  };
  say('', top, 'schema');
  const fields = (owner, list) => {
    eachObject(list, (i, field) => {
      const at = named(owner, field, 'key', i);
      say(at, field, 'field');
      eachObject(field.options, (j, option) => say(`${at}.options[${j}]`, option, 'option'));
      if (isObject(field.ref)) say(`${at}.ref`, field.ref, 'ref');
      fields(at, field.of);
    });
  };
  eachObject(top.blocks, (i, block) => {
    const at = named('blocks', block, 'type', i);
    say(at, block, 'block');
    fields(at, block.fields);
    fields(`${at}.asks`, block.asks);
    eachObject(block.views, (j, view) => say(named(`${at}.views`, view, 'key', j), view, 'view'));
    if (isObject(block.form)) {
      say(`${at}.form`, block.form, 'form');
      eachObject(block.form.sections, (j, section) => {
        const where = `${at}.form.sections[${j}]`;
        say(where, section, 'section');
        if (!Array.isArray(section.rows)) return;
        section.rows.forEach((row, r) => eachObject(row, (c, cell) => say(`${where}.rows[${r}][${c}]`, cell, 'cell')));
      });
    }
    eachObject(block.upcast, (j, step) => {
      const where = `${at}.upcast[${j}]`;
      say(where, step, 'upcast');
      const rows = (owner, lists) => {
        if (!isObject(lists)) return;
        for (const key of Object.keys(lists).sort()) {
          if (!isObject(lists[key])) continue;
          say(`${owner}.rows.${key}`, lists[key], 'rows');
          rows(`${owner}.rows.${key}`, lists[key].rows);
        }
      };
      rows(where, step.rows);
    });
  });
  fields('page_seo', top.page_seo);
  eachObject(top.collections, (i, collection) => {
    const at = named('collections', collection, 'name', i);
    say(at, collection, 'collection');
    if (isObject(collection.route)) say(`${at}.route`, collection.route, 'route');
    if (isObject(collection.order)) say(`${at}.order`, collection.order, 'order');
    if (isObject(collection.ends_by)) say(`${at}.ends_by`, collection.ends_by, 'ends_by');
  });
  return out;
}

// ── 2 · the shapes ─────────────────────────────────────────────────────────
//
// What Go's decoder refuses, as one finding: a value whose JSON type is not
// the one contract 3 has there. `null` is no value, as it is to Go.

class Unreadable extends Error {
  constructor(path, says) {
    super(says);
    this.path = path;
  }
}

const SHAPE = { string: 'words', bool: 'true or false', int: 'a whole number', list: 'a list', object: 'an object' };

function wrong(at, value, shape) {
  const held = Array.isArray(value) ? 'a list' : isObject(value) ? 'an object' : typeof value === 'string' ? 'words' : typeof value === 'boolean' ? 'true or false' : `the number ${value}`;
  return new Unreadable(at, `this is not a schema: ${at} holds ${held}, where contract 3 has ${SHAPE[shape]}`);
}

const absent = (value) => value === undefined || value === null;
function str(value, at) {
  if (absent(value)) return '';
  if (typeof value !== 'string') throw wrong(at, value, 'string');
  return value;
}
function int(value, at) {
  if (absent(value)) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw wrong(at, value, 'int');
  return value;
}
function intOrNone(value, at) {
  return absent(value) ? undefined : int(value, at);
}
function bool(value, at) {
  if (absent(value)) return false;
  if (typeof value !== 'boolean') throw wrong(at, value, 'bool');
  return value;
}
function list(value, at, each) {
  if (absent(value)) return [];
  if (!Array.isArray(value)) throw wrong(at, value, 'list');
  return value.map((one, i) => each(one, `${at}[${i}]`));
}
const strings = (value, at) => list(value, at, (one, where) => str(one, where));
function object(value, at) {
  if (absent(value)) return undefined;
  if (!isObject(value)) throw wrong(at, value, 'object');
  return value;
}
/** A Go map read strictly: `undefined` where absent (nil), each value read by `each`. */
function map(value, at, each) {
  const read = object(value, at);
  if (read === undefined) return undefined;
  return Object.fromEntries(Object.entries(read).map(([key, one]) => [key, each(one, `${at}.${key}`)]));
}
const stringMap = (value, at) => map(value, at, str);

/**
 * Words, written once or per language (`Text`): the languages spelt one way
 * on the way in, as the platform spells them, and two spellings of one
 * language refused.
 */
function text(value, at, what = 'a label') {
  if (absent(value)) return { words: '', byLocale: null };
  if (typeof value === 'string') return { words: value, byLocale: null };
  const refuse = () => new Unreadable(at, `this is not a schema: ${at} is ${what} — the words, or the words per language, {"de": "…", "en": "…"}`);
  if (!isObject(value)) throw refuse();
  const byLocale = new Map();
  for (const [locale, words] of Object.entries(value)) {
    if (!absent(words) && typeof words !== 'string') throw refuse();
    const canonical = canonicalTag(locale) ?? locale;
    if (byLocale.has(canonical)) throw new Unreadable(at, `this is not a schema: ${at} gives the words for ${q(canonical)} twice, spelt two ways`);
    byLocale.set(canonical, absent(words) ? '' : words);
  }
  return { words: '', byLocale };
}
const zero = (one) => one.words === '' && (one.byLocale === null || one.byLocale.size === 0);

/** An address in a route (`Pattern`): written once, or per language. */
const pattern = (value, at) => {
  const read = text(value, at, 'an address in a route');
  return { path: read.words, byLocale: read.byLocale };
};
const noPattern = (p) => p.path === '' && (p.byLocale === null || p.byLocale.size === 0);

/** `RouteDef`: "none", or the object. */
function route(value, at) {
  if (absent(value)) return undefined;
  const refuse = () => new Unreadable(at, `this is not a schema: ${at} is "none", or {"detail": "/works/{slug}"} with a "listing" and a "per_page" where the collection has them`);
  if (typeof value === 'string') {
    if (value !== 'none') throw refuse();
    return { none: true, detail: pattern(undefined), listing: pattern(undefined), perPage: 0 };
  }
  if (!isObject(value)) throw refuse();
  try {
    return { none: false, detail: pattern(value.detail, `${at}.detail`), listing: pattern(value.listing, `${at}.listing`), perPage: int(value.per_page, `${at}.per_page`) };
  } catch (why) {
    if (why instanceof Unreadable) throw refuse();
    throw why;
  }
}
const noRoute = (r) => !r.none && noPattern(r.detail) && noPattern(r.listing) && r.perPage === 0;

/** A field as the file writes it, before its options, reference and order are read. */
function wireField(raw, at) {
  const value = object(raw, at) ?? {};
  return {
    key: str(value.key, `${at}.key`),
    label: text(value.label, `${at}.label`),
    hint: text(value.hint, `${at}.hint`),
    kind: str(value.kind, `${at}.kind`),
    required: bool(value.required, `${at}.required`),
    min: intOrNone(value.min, `${at}.min`),
    max: intOrNone(value.max, `${at}.max`),
    options: list(value.options, `${at}.options`, (one) => one),
    of: list(value.of, `${at}.of`, wireField),
    clientEditable: bool(value.client_editable, `${at}.client_editable`),
    accept: str(value.accept, `${at}.accept`),
    multiple: bool(value.multiple, `${at}.multiple`),
    ratio: str(value.ratio, `${at}.ratio`),
    ref: value.ref,
    noTapTarget: bool(value.no_tap_target, `${at}.no_tap_target`),
    beside: str(value.beside, `${at}.beside`),
    titledBy: str(value.titled_by, `${at}.titled_by`),
    seoSensitive: bool(value.seo_sensitive, `${at}.seo_sensitive`),
    localized: absent(value.localized) ? undefined : bool(value.localized, `${at}.localized`),
    role: str(value.role, `${at}.role`),
    integer: bool(value.integer, `${at}.integer`),
    qualifiers: strings(value.qualifiers, `${at}.qualifiers`),
  };
}

function wireBlock(raw, at) {
  const value = object(raw, at) ?? {};
  return {
    type: str(value.type, `${at}.type`),
    v: int(value.v, `${at}.v`),
    label: text(value.label, `${at}.label`),
    hint: text(value.hint, `${at}.hint`),
    fields: list(value.fields, `${at}.fields`, wireField),
    views: list(value.views, `${at}.views`, (one, where) => {
      const view = object(one, where) ?? {};
      return {
        key: str(view.key, `${where}.key`),
        label: text(view.label, `${where}.label`),
        min: int(view.min, `${where}.min`),
        max: int(view.max, `${where}.max`),
        ratio: str(view.ratio, `${where}.ratio`),
        needsBuild: bool(view.needs_build, `${where}.needs_build`),
      };
    }),
    collects: str(value.collects, `${at}.collects`),
    asks: list(value.asks, `${at}.asks`, wireField),
    photos: int(value.photos, `${at}.photos`),
    upcast: list(value.upcast, `${at}.upcast`, (one, where) => {
      const step = object(one, where) ?? {};
      return { from: int(step.from, `${where}.from`), ...wireChange(step, where) };
    }),
    form: wireForm(value.form, `${at}.form`),
  };
}

/** `upcastRows3`: a step's changes, to a block or to each row of one of its lists. */
function wireChange(value, at) {
  return {
    rename: stringMap(value.rename, `${at}.rename`),
    rows: map(value.rows, `${at}.rows`, (one, where) => wireChange(object(one, where) ?? {}, where)),
    values: map(value.values, `${at}.values`, stringMap),
    drop: absent(value.drop) ? undefined : strings(value.drop, `${at}.drop`),
    set: object(value.set, `${at}.set`),
  };
}

/**
 * `form3`: a block type's `form` as the file writes it — `undefined` where it
 * says none, `sections` and `aside` absent apart from empty, as Go's nil and
 * `[]` are apart. A row's cells are kept raw, a key or `{field, span}`, and
 * read with the registry (`formDefOf`).
 */
function wireForm(raw, at) {
  const value = object(raw, at);
  if (value === undefined) return undefined;
  return {
    sections: absent(value.sections) ? undefined : list(value.sections, `${at}.sections`, (one, where) => {
      const section = object(one, where) ?? {};
      return {
        title: text(section.title, `${where}.title`, "a section's title"),
        note: text(section.note, `${where}.note`, "a section's note"),
        rows: list(section.rows, `${where}.rows`, (row, rowAt) => list(row, rowAt, (cell) => cell ?? null)),
      };
    }),
    aside: absent(value.aside) ? undefined : strings(value.aside, `${at}.aside`),
    widgets: stringMap(value.widgets, `${at}.widgets`) ?? {},
  };
}

function wireCollection(raw, at) {
  const value = object(raw, at) ?? {};
  return {
    name: str(value.name, `${at}.name`),
    label: text(value.label, `${at}.label`),
    one: text(value.one, `${at}.one`),
    intro: text(value.intro, `${at}.intro`),
    place: str(value.place, `${at}.place`),
    icon: str(value.icon, `${at}.icon`),
    type: str(value.type, `${at}.type`),
    order: value.order,
    group: str(value.group, `${at}.group`),
    blocks: strings(value.blocks, `${at}.blocks`),
    untranslated: str(value.untranslated, `${at}.untranslated`),
    route: route(value.route, `${at}.route`),
    shownOn: list(value.shown_on, `${at}.shown_on`, pattern),
    endsBy: endsBy(value.ends_by, `${at}.ends_by`),
  };
}

/** `EndsBy`: when the entries are over, by their own date — `{"date": …, "time": …, "after": …, "zone": …, "then": …}`. */
function endsBy(raw, at) {
  const value = object(raw, at);
  if (value === undefined) return undefined;
  return {
    date: str(value.date, `${at}.date`),
    time: str(value.time, `${at}.time`),
    after: intOrNone(value.after, `${at}.after`),
    zone: str(value.zone, `${at}.zone`),
    then: str(value.then, `${at}.then`),
  };
}

function wireModules(raw, at) {
  const value = object(raw, at);
  if (value === undefined) return {};
  const out = {};
  for (const [name, use] of Object.entries(value)) {
    const roles = object(use, `${at}.${name}`) ?? {};
    out[name] = {};
    for (const [role, collection] of Object.entries(roles)) out[name][role] = str(collection, `${at}.${name}.${role}`);
  }
  return out;
}

/** The file, decoded as Go's types decode it — or the one thing that stops that. */
function decode(top) {
  return {
    contract: int(top.contract, 'contract'),
    generator: str(top.generator, 'generator'),
    blocks: list(top.blocks, 'blocks', wireBlock),
    pageSEO: list(top.page_seo, 'page_seo', wireField),
    collections: list(top.collections, 'collections', wireCollection),
    modules: wireModules(top.modules, 'modules'),
    locale: str(top.locale, 'locale'),
    locales: strings(top.locales, 'locales'),
    shared: strings(top.shared, 'shared'),
    render: str(top.render, 'render'),
  };
}

// ── into one registry (`schema3.registry`) ─────────────────────────────────
//
// An option, a reference and an order are read here, where contract 2's
// spelling of each is told the word that replaced it. Any fault here is the
// whole answer, as in Go.

const at3 = (owner, name, i) => (name !== '' ? `${owner}.${name}` : `${owner}[${i}]`);

function fieldsOf(say, owner, fields) {
  return fields.map((field, i) => fieldOf(say, at3(owner, field.key, i), field));
}

function fieldOf(say, at, d) {
  const out = {
    key: d.key, label: d.label, hint: d.hint, kind: d.kind, required: d.required,
    clientEditable: d.clientEditable, accept: d.accept, ratio: d.ratio, multiple: d.multiple,
    noTapTarget: d.noTapTarget, beside: d.beside, titledBy: d.titledBy, localized: d.localized,
    role: d.role, integer: d.integer, qualifiers: d.qualifiers,
    of: fieldsOf(say, at, d.of),
    // Absent is unbounded and 0 is a bound (§3.3).
    min: d.min ?? 0, max: d.max ?? 0, minZero: d.min === 0, maxZero: d.max === 0,
    optionDefs: [], options: [],
    to: [], many: false, onDelete: '', ref: '',
  };

  d.options.forEach((raw, i) => {
    const where = `${at}.options[${i}]`;
    if (raw === null || typeof raw === 'string') {
      const word = raw ?? '';
      say(E.OPTIONS, where, `${where} is ${q(word)}, as contract 2 wrote an option — contract 3 writes {"value": ${q(word)}, "label": …}`);
      return;
    }
    let option;
    try {
      if (!isObject(raw)) throw new Unreadable(where, '');
      option = { value: str(raw.value, `${where}.value`), label: text(raw.label, `${where}.label`) };
    } catch (why) {
      if (!(why instanceof Unreadable)) throw why;
      say(E.SCHEMA_UNREADABLE, where, `this is not a schema: ${where} is not an option — an option is {"value": …, "label": …}`);
      return;
    }
    out.optionDefs.push(option);
    out.options.push(option.value);
  });

  if (d.ref !== undefined && d.ref !== null) {
    if (typeof d.ref === 'string') {
      say(E.REF, `${at}.ref`, `${at}.ref is ${q(d.ref)}, as contract 2 wrote a reference — contract 3 writes "ref": {"to": [${q(d.ref)}]}`);
    } else {
      try {
        if (!isObject(d.ref)) throw new Unreadable(`${at}.ref`, '');
        out.to = strings(d.ref.to, `${at}.ref.to`);
        out.many = bool(d.ref.many, `${at}.ref.many`);
        out.onDelete = str(d.ref.on_delete, `${at}.ref.on_delete`);
        if (out.to.length === 1) out.ref = out.to[0];
      } catch (why) {
        if (!(why instanceof Unreadable)) throw why;
        out.to = [];
        out.many = false;
        out.onDelete = '';
        say(E.SCHEMA_UNREADABLE, `${at}.ref`, `this is not a schema: ${at}.ref is not a reference — a reference is {"to": ["<collection>"], "many": true}`);
      }
    }
  }
  return out;
}

/** `RefersTo`: the collections a reference points into. */
const refersTo = (field) => (field.to.length > 0 ? field.to : field.ref !== '' ? [field.ref] : []);

function collectionOf(say, at, c, locale) {
  const out = {
    name: c.name, label: c.label, one: c.one, intro: c.intro, place: c.place, icon: c.icon, type: c.type,
    group: c.group, body: c.blocks, untranslated: c.untranslated, shownOn: c.shownOn, endsBy: c.endsBy,
    route: c.route ?? { none: false, detail: pattern(undefined), listing: pattern(undefined), perPage: 0 },
    order: { by: '', desc: false },
    prefix: '',
  };
  const order = c.order;
  if (order !== undefined && order !== null) {
    if (typeof order === 'string') {
      if (order !== 'manual') say(E.ORDER, `${at}.order`, `${at}.order is ${q(order)} — it is "manual", or {"by": "<field>", "desc": true}`);
      out.order = { by: 'manual', desc: false };
    } else {
      try {
        if (!isObject(order)) throw new Unreadable(`${at}.order`, '');
        out.order = { by: str(order.by, `${at}.order.by`), desc: bool(order.desc, `${at}.order.desc`) };
      } catch (why) {
        if (!(why instanceof Unreadable)) throw why;
        say(E.SCHEMA_UNREADABLE, `${at}.order`, `this is not a schema: ${at}.order is not an order — it is "manual", or {"by": "<field>", "desc": true}`);
      }
    }
  }
  // Contract 2's prefix, from the detail in the site's own language: what a
  // collection with no listing keeps its rows under (`prefixOf`).
  if (!out.route.none && !noRoute(out.route)) {
    const detail = out.route.detail.path || out.route.detail.byLocale?.get(tagOf('', locale)) || '';
    if (detail.endsWith(`/${SLUG}`)) {
      const before = detail.slice(0, -`/${SLUG}`.length);
      if (!before.includes(SLUG)) out.prefix = before;
    }
  }
  return out;
}

// ── 3 · the rules (`Faults`, contract 3's) ──────────────────────────────────

/** `validateText`: one label or hint, at most one fault. */
function validateText(say, owner, what, words) {
  const where = `${owner}.${what}`;
  if (words.words !== '') {
    if (bytes(words.words) > LONGEST_LABEL) say(E.TEXT, where, `${where} runs past ${LONGEST_LABEL} characters`);
    return;
  }
  for (const locale of [...(words.byLocale?.keys() ?? [])].sort()) {
    const said = words.byLocale.get(locale);
    if (canonicalTag(locale) === null) return say(E.TEXT, where, `${where} names the language ${q(locale)}, which is not a language`);
    if (said.trim() === '') return say(E.TEXT, where, `${where} is empty in ${q(locale)} — leave the language out instead`);
    if (bytes(said) > LONGEST_LABEL) return say(E.TEXT, where, `${where} in ${q(locale)} runs past ${LONGEST_LABEL} characters`);
  }
}

/** The judge in progress: `say` adds a fault, `mark` and `since` stop one item's checks. */
function judgement() {
  const list = [];
  const say = (code, path, says) => {
    list.push({ code, path, says });
  };
  return { list, say, mark: () => list.length, since: (mark) => list.length > mark };
}

function validateBlock(j, block, seen) {
  const { say } = j;
  const path = `blocks.${block.type}`;
  if (!keyRe.test(block.type)) return say(E.NAME, 'blocks', `${q(block.type)} is not a block type — lowercase letters, digits and underscores`);
  if (seen.has(block.type)) return say(E.DUPLICATE, path, `the block type ${q(block.type)} is declared twice`);
  // A module's settings type is the platform's, reserved whether or not the
  // site turns the module on.
  for (const module of MODULES.keys()) {
    if (block.type === `${module}_config`) return say(E.DUPLICATE, path, `the block type ${q(block.type)} belongs to the ${module} module — pick another name`);
  }
  seen.add(block.type);

  if (block.collects !== '' && block.collects !== 'enquiry') {
    say(E.COLLECTS, `${path}.collects`, `block ${q(block.type)} collects ${q(block.collects)}, and the only thing a block may collect is "enquiry"`);
  }
  if (block.photos !== 0) {
    if (block.collects === '') say(E.COLLECTS, `${path}.photos`, `block ${q(block.type)} takes photos and collects nothing — say collects: "enquiry"`);
    else if (block.photos < 1 || block.photos > PHOTOS_MAX) say(E.COLLECTS, `${path}.photos`, `block ${q(block.type)} takes ${block.photos} photos; a form takes 1 to ${PHOTOS_MAX}`);
  }
  if (block.asks.length > 0) {
    if (block.collects === '') say(E.COLLECTS, `${path}.asks`, `block ${q(block.type)} asks the visitor for fields and collects nothing — say collects: "enquiry"`);
    validateAsks(j, path, block.asks);
  }
  if (block.v < 1) say(E.BLOCK_VERSION, `${path}.v`, `block ${q(block.type)} needs a version of at least 1`);
  if (block.fields.length === 0) say(E.BLOCK_EMPTY, path, `block ${q(block.type)} has no fields`);
  validateText(say, path, 'label', block.label);
  validateText(say, path, 'hint', block.hint);
  validateFields(j, path, block.fields, 2);
  validateViews(j, block);
  validateUpcast(say, path, block);
}

function validateAsks(j, path, asks) {
  const owner = `${path}.asks`;
  for (const ask of asks) {
    if (ENQUIRY_KEYS.has(ask.key)) {
      j.say(E.NAME, `${owner}.${ask.key}`, `${owner}.${ask.key} is the enquiry's own — the form's name, contact, message and honeypot have their places already`);
      continue;
    }
    if (knownKind(ask.kind) && !ASK_KINDS.has(ask.kind)) {
      j.say(E.KIND, `${owner}.${ask.key}.kind`, `${owner}.${ask.key} is ${q(ask.kind)}, which is not something a visitor's form control can hold`);
    }
  }
  validateFields(j, owner, asks, 0);
}

function validateViews(j, block) {
  if (block.views.length === 0) return;
  const { say } = j;
  const path = `blocks.${block.type}`;
  const pictures = block.fields.find((one) => one.kind === 'media' && one.multiple);
  if (pictures === undefined) return say(E.VIEW, `${path}.views`, `block ${q(block.type)} declares views but has no gallery for them to arrange`);
  if (pictures.max !== 0 || pictures.min !== 0 || pictures.ratio !== '') {
    say(E.VIEW, `${path}.${pictures.key}`, `block ${q(block.type)} declares views, so ${pictures.key} must not set its own min, max or ratio`);
  }
  const seen = new Set();
  for (const view of block.views) {
    const where = `${path}.views.${view.key}`;
    if (!keyRe.test(view.key)) {
      say(E.NAME, `${path}.views`, `${q(view.key)} is not a view key on block ${q(block.type)}`);
      continue;
    }
    if (seen.has(view.key)) {
      say(E.DUPLICATE, where, `block ${q(block.type)} declares the view ${q(view.key)} twice`);
      continue;
    }
    seen.add(view.key);
    if (zero(view.label)) {
      say(E.LABEL_MISSING, `${where}.label`, `view ${block.type}.${view.key} has no label, and a menu of keys is not a menu`);
      continue;
    }
    const mark = j.mark();
    validateText(say, where, 'label', view.label);
    if (j.since(mark)) continue;
    if (view.min < 0 || view.max < 0) {
      say(E.BOUNDS, where, `view ${block.type}.${view.key} has a negative bound`);
      continue;
    }
    if (view.max !== 0 && view.min > view.max) {
      say(E.BOUNDS, where, `view ${block.type}.${view.key} has min above max`);
      continue;
    }
    if (view.ratio !== '' && !ratioRe.test(view.ratio)) {
      say(E.VIEW, `${where}.ratio`, `view ${block.type}.${view.key} has a ratio of ${q(view.ratio)}, which is not one`);
    }
  }
}

/** `boundless3`: a link, a date and one picture take no min or max in contract 3. */
const boundless = (field) => field.kind === 'url' || field.kind === 'date' || (field.kind === 'media' && !field.multiple);
const saysBounds = (field) => field.min !== 0 || field.max !== 0 || field.minZero || field.maxZero;

function validateFields(j, owner, fields, listsLeft) {
  const { say } = j;
  const seen = new Set();
  for (const field of fields) {
    const where = `${owner}.${field.key}`;
    if (!keyRe.test(field.key)) {
      say(E.NAME, owner, `${owner}.${field.key} is not a field key`);
      continue;
    }
    if (seen.has(field.key)) {
      say(E.DUPLICATE, where, `${owner} declares ${q(field.key)} twice`);
      continue;
    }
    seen.add(field.key);
    if (zero(field.label)) {
      say(E.LABEL_MISSING, `${where}.label`, `${owner}.${field.key} has no label, and a form of keys is not a form`);
      continue;
    }
    let mark = j.mark();
    validateText(say, where, 'label', field.label);
    validateText(say, where, 'hint', field.hint);
    if (j.since(mark)) continue;

    if (!knows(field.kind)) {
      say(E.KIND, `${where}.kind`, `${owner}.${field.key} has kind ${q(field.kind)}, which nothing knows how to draw or check`);
      continue;
    }
    if (field.min < 0 || field.max < 0) {
      say(E.BOUNDS, where, `${owner}.${field.key} has a negative bound`);
      continue;
    }
    if ((field.max !== 0 || field.maxZero) && field.min > field.max) {
      say(E.BOUNDS, where, `${owner}.${field.key} has min above max`);
      continue;
    }
    if (boundless(field) && saysBounds(field)) {
      say(E.BOUNDS, where, `${owner}.${field.key} is ${field.kind}, which takes no min or max in contract 3 — a link and a date have no length worth bounding, and one picture is one`);
      continue;
    }
    if (field.kind === 'ref' && refersTo(field).length === 0) {
      say(E.REF, `${where}.ref`, `${owner}.${field.key} is a ref that points nowhere — contract 3 writes "ref": {"to": ["<collection>"]}`);
      continue;
    }
    if (field.kind !== 'ref' && (field.ref !== '' || field.to.length > 0 || field.many || field.onDelete !== '')) {
      say(E.REF, `${where}.ref`, `${owner}.${field.key} is ${q(field.kind)} and points into a collection, which only a ref may`);
      continue;
    }
    if (field.kind === 'select' && field.options.length === 0) {
      say(E.OPTIONS, `${where}.options`, `${owner}.${field.key} is a select with no options`);
      continue;
    }
    mark = j.mark();
    validateField3(say, owner, field);
    if (j.since(mark)) continue;
    mark = j.mark();
    validateMedia(say, owner, field);
    if (j.since(mark)) continue;

    if (field.kind === 'list') {
      if (listsLeft === 0) {
        say(E.LIST, where, `${owner}.${field.key} nests a list inside a row of a row — contract 3 takes a list inside a list's row, and no deeper`);
        continue;
      }
      if (field.of.length === 0) {
        say(E.LIST, `${where}.of`, `${owner}.${field.key} is a list with no item fields`);
        continue;
      }
      validateFields(j, where, field.of, listsLeft - 1);
      continue;
    }
    if (field.of.length > 0) say(E.LIST, `${where}.of`, `${owner}.${field.key} is not a list but declares item fields`);
  }
  validateBeside(say, owner, fields);
}

function validateBeside(say, owner, fields) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  for (const field of fields) {
    if (field.titledBy !== '') {
      const where = `${owner}.${field.key}.titled_by`;
      const title = byKey.get(field.titledBy);
      if (field.titledBy === field.key) say(E.TITLED_BY, where, `${owner}.${field.key} is titled by itself`);
      else if (title === undefined) say(E.TITLED_BY, where, `${owner}.${field.key} is titled by ${q(field.titledBy)}, and ${owner} has no such field — titled_by names a field of the same block, or of the same row`);
      else if (title.kind !== 'text') say(E.TITLED_BY, where, `${owner}.${field.key} is titled by ${q(field.titledBy)}, which is ${title.kind} — a title is a line of text`);
    }
    if (field.beside === '') continue;
    const where = `${owner}.${field.key}.beside`;
    const target = byKey.get(field.beside);
    if (field.beside === field.key) say(E.BESIDE, where, `${owner}.${field.key} is beside itself`);
    else if (target === undefined) say(E.BESIDE, where, `${owner}.${field.key} is beside ${q(field.beside)}, and ${owner} has no such field — beside names a field of the same block, or of the same row`);
    else if (!field.noTapTarget) say(E.BESIDE, where, `${owner}.${field.key} is beside ${q(field.beside)} and is not no_tap_target — a field on the page is tapped itself; beside is for the one that is not shown`);
    else if (target.noTapTarget || target.beside !== '') say(E.BESIDE, where, `${owner}.${field.key} is beside ${q(field.beside)}, which is not on the page either — name the field the owner taps, the one this value belongs to`);
  }
}

/** `validateField3`: what contract 3 lets a field say — a reference's object, options as objects, the attributes a kind takes. */
function validateField3(say, owner, field) {
  const where = `${owner}.${field.key}`;
  const pointed = new Set();
  for (const to of field.to) {
    if (pointed.has(to)) return say(E.REF, `${where}.ref`, `${where} points into ${q(to)} twice`);
    pointed.add(to);
  }
  if (field.onDelete !== '' && field.onDelete !== 'restrict' && field.onDelete !== 'nullify') {
    return say(E.REF, `${where}.ref.on_delete`, `${where} says on_delete ${q(field.onDelete)} — it is "restrict", the default, or "nullify"`);
  }
  const values = new Set();
  for (const [i, option] of field.optionDefs.entries()) {
    const at = `${where}.options[${i}]`;
    if (option.value.trim() === '') return say(E.OPTIONS, at, `${at} has no value, and the value is what a document holds`);
    if (values.has(option.value)) return say(E.OPTIONS, at, `${where} offers ${q(option.value)} twice`);
    values.add(option.value);
    let said = false;
    validateText((...fault) => {
      said = true;
      say(...fault);
    }, at, 'label', option.label);
    if (said) return;
  }
  if (field.localized !== undefined && !['text', 'textarea', 'richtext_lite', 'markdown', 'media', 'url', 'list'].includes(field.kind)) {
    return say(E.ATTRIBUTE, `${where}.localized`, `${where} is ${field.kind}, which holds no words to be per language — localized is for text, a picture, a link or a list`);
  }
  if (field.integer && field.kind !== 'number') return say(E.ATTRIBUTE, `${where}.integer`, `${where} is ${field.kind} and says integer, which is a number's`);
  if (field.qualifiers.length > 0) {
    if (field.kind !== 'money') return say(E.ATTRIBUTE, `${where}.qualifiers`, `${where} is ${field.kind} and says qualifiers, which are a price's`);
    const said = new Set();
    for (const qualifier of field.qualifiers) {
      if (qualifier !== 'from' && qualifier !== 'on_request') return say(E.ATTRIBUTE, `${where}.qualifiers`, `${where} may say ${q(qualifier)}, and a price says "from" or "on_request"`);
      if (said.has(qualifier)) return say(E.ATTRIBUTE, `${where}.qualifiers`, `${where} says ${q(qualifier)} twice`);
      said.add(qualifier);
    }
  }
}

/** `validateMedia`, contract 3's: one picture is an object with room for its focus and poster, so neither needs `multiple`. */
function validateMedia(say, owner, field) {
  const where = `${owner}.${field.key}`;
  if (field.kind !== 'media') {
    if (field.accept !== '') return say(E.MEDIA, `${where}.accept`, `${owner}.${field.key} is a ${field.kind} and declares accept, which is for media fields`);
    if (field.ratio !== '') return say(E.MEDIA, `${where}.ratio`, `${owner}.${field.key} is a ${field.kind} and declares ratio, which is the frame a picture is shown in`);
    if (field.multiple) say(E.MEDIA, `${where}.multiple`, `${owner}.${field.key} is a ${field.kind} and declares multiple — a repeating list of anything but pictures is kind "list"`);
    return;
  }
  if (field.accept !== '' && field.accept !== 'image' && field.accept !== 'video') {
    return say(E.MEDIA, `${where}.accept`, `${owner}.${field.key} accepts ${q(field.accept)}, and the choices are "image" and "video"`);
  }
  if (field.ratio !== '' && !ratioRe.test(field.ratio)) {
    say(E.MEDIA, `${where}.ratio`, `${owner}.${field.key} is framed at ${q(field.ratio)} — a ratio is two whole numbers, like "3:2"`);
  }
}

// ── collections, their routes, and what points into them ──────────────────

const localisedPath = (path, locale) => (locale === '' ? path : path === '/' ? `/${locale}` : `/${locale}${path}`);

function inLocaleKeepingAnchor(address, locale) {
  const cut = address.indexOf('#');
  if (cut < 0) return localisedPath(address, locale);
  return `${localisedPath(address.slice(0, cut) || '/', locale)}#${address.slice(cut + 1)}`;
}

/** `Pattern.in`: the pattern in a language, its prefix in front. */
function patternIn(p, locale, base) {
  const own = p.path || p.byLocale?.get(tagOf(locale, base)) || p.byLocale?.get(tagOf('', base)) || '';
  return own === '' ? '' : inLocaleKeepingAnchor(own, locale);
}

/** `rowPattern`: where a collection's rows are kept in a language, `{slug}` where the slug goes. */
function rowPattern(reg, c, locale) {
  if (!c.route.none) {
    const detail = patternIn(c.route.detail, locale, reg.locale);
    if (detail !== '') return detail;
  }
  return `${localisedPath(c.prefix || `/${c.name}`, locale)}/${SLUG}`;
}

function overlaps(one, other) {
  const a = one.replace(/\/$/, '');
  const b = other.replace(/\/$/, '');
  return a === b || `${b}/`.startsWith(`${a}/`) || `${a}/`.startsWith(`${b}/`);
}

/** `patternFault`: what is wrong with one pattern for its use, or ''. */
function patternFault(pattern, use) {
  const cut = pattern.indexOf('#');
  const path = cut < 0 ? pattern : pattern.slice(0, cut);
  const anchor = cut < 0 ? '' : pattern.slice(cut + 1);
  const hasAnchor = cut >= 0;
  if (use === 'detail') {
    if (hasAnchor) return "and an entry's own page has no anchor in its address";
    if (path.split(SLUG).length - 1 !== 1) return "and an entry's own page says {slug} once, where its slug goes";
    if (!prefixRe.test(path.replace(SLUG, 'x'))) return 'which is not an address — lowercase words and digits between slashes, "/works/{slug}"';
  } else if (use === 'listing') {
    if (hasAnchor || path.includes(SLUG)) return 'and a listing is one page, with no slug and no anchor';
    if (!prefixRe.test(path)) return 'which is not an address — lowercase words and digits between slashes, "/works"';
  } else {
    if (path.includes(SLUG)) return 'and a place an entry is shown is a page and an anchor on it, the slug in the anchor: "/prices#{slug}"';
    if (path !== '/' && !prefixRe.test(path)) return 'which is not a page of the site — "/prices#{slug}"';
    if (hasAnchor && !anchorRe.test(`#${anchor.replaceAll(SLUG, 'x')}`)) return 'whose anchor is not one — letters, digits, dashes and the slug: "#services-{slug}"';
  }
  return '';
}

function validPattern(say, at, p, use, languages, base) {
  if (noPattern(p)) {
    say(E.ROUTE, at, `${at} is empty — say the address`);
    return false;
  }
  let whole = true;
  const check = (where, one) => {
    const why = patternFault(one, use);
    if (why !== '') {
      say(E.ROUTE, where, `${where} is ${q(one)}, ${why}`);
      whole = false;
    }
  };
  if (p.path !== '') {
    check(at, p.path);
    return whole;
  }
  for (const locale of [...p.byLocale.keys()].sort()) {
    const where = `${at}.${locale}`;
    if (!languages.has(locale)) {
      say(E.ROUTE, where, `${at} names ${q(locale)}, which is not one of the site's languages`);
      whole = false;
      continue;
    }
    check(where, p.byLocale.get(locale));
  }
  if (!p.byLocale.has(base)) {
    say(E.ROUTE, at, `${at} is written per language and leaves out the site's own, ${q(base)}, whose pattern every language the map does not name takes`);
    whole = false;
  }
  return whole;
}

/** `validateRoute3`: where a collection's entries are (§3.5); the prefixes taken so far, and whether the route was whole. */
function validateRoute(say, reg, c, prefixes) {
  const path = `collections.${c.name}`;
  const at = `${path}.route`;
  const r = c.route;
  if (noRoute(r)) {
    say(E.ROUTE, at, `collection ${q(c.name)} says nowhere where its entries are — contract 3 says it with a route: {"detail": "/${c.name}/{slug}"}, or "none" with shown_on (wiki/98 §15 · 5)`);
    return [prefixes, false];
  }
  const base = tagOf('', reg.locale);
  const languages = new Set([base, ...reg.locales.map((one) => tagOf(one, reg.locale))]);
  let whole = true;
  if (r.none) {
    if (c.shownOn.length === 0) {
      say(E.ROUTE, `${path}.shown_on`, `collection ${q(c.name)} has no page of its own and names none it is shown on — route "none" takes shown_on: ["/prices#{slug}"]`);
      whole = false;
    }
  } else {
    if (noPattern(r.detail)) {
      say(E.ROUTE, `${at}.detail`, `collection ${q(c.name)} has a route with no detail — the detail is an entry's own page, "/works/{slug}"`);
      whole = false;
    } else if (!validPattern(say, `${at}.detail`, r.detail, 'detail', languages, base)) {
      whole = false;
    }
    if (!noPattern(r.listing) && !validPattern(say, `${at}.listing`, r.listing, 'listing', languages, base)) whole = false;
    if (r.perPage < 0 || r.perPage > 200) {
      say(E.ROUTE, `${at}.per_page`, `collection ${q(c.name)} paginates at ${r.perPage} — between 1 and 200, or none for one page`);
      whole = false;
    }
  }
  c.shownOn.forEach((place, i) => {
    if (!validPattern(say, `${path}.shown_on[${i}]`, place, 'place', languages, base)) whole = false;
  });
  if (!whole) return [prefixes, false];

  const mine = [];
  for (const locale of ['', ...reg.locales]) {
    const before = rowPattern(reg, c, locale).split(SLUG)[0];
    for (const other of prefixes) {
      if (overlaps(other.prefix, before)) {
        say(E.ROUTE, at, `collections ${q(c.name)} and ${q(other.collection)} would both keep entries under ${q(before)}`);
        return [prefixes, false];
      }
    }
    mine.push({ collection: c.name, prefix: before });
  }
  return [[...prefixes, ...mine], true];
}

const typeOf = (reg, name) => reg.blocks.find((one) => one.type === name);
const fieldIn = (fields, key) => fields.find((one) => one.key === key);

function validateCollections(j, reg) {
  const { say } = j;
  if (reg.locale !== '' && canonicalTag(reg.locale) === null) say(E.LOCALE, 'locale', `${q(reg.locale)} is not a language — two letters, or two and a region`);
  const seen = new Set();
  reg.locales.forEach((locale, i) => {
    const where = `locales[${i}]`;
    if (canonicalTag(locale) === null) return say(E.LOCALE, where, `${q(locale)} is not a language — two letters, or two and a region`);
    if (seen.has(locale)) return say(E.DUPLICATE, where, `the language ${q(locale)} is declared twice`);
    if (locale === reg.locale) return say(E.LOCALE, where, `${q(locale)} is the site's own language and does not go in \`locales\` as well`);
    seen.add(locale);
  });
  const names = new Set();
  let prefixes = [];
  for (const c of reg.collections) prefixes = validateCollection(j, reg, c, names, prefixes);
}

function validateCollection(j, reg, c, names, prefixes) {
  const { say } = j;
  const path = `collections.${c.name}`;
  if (!keyRe.test(c.name)) {
    say(E.NAME, 'collections', `${q(c.name)} is not a collection name — lowercase letters, digits and underscores`);
    return prefixes;
  }
  if (names.has(c.name)) {
    say(E.DUPLICATE, path, `the collection ${q(c.name)} is declared twice`);
    return prefixes;
  }
  names.add(c.name);
  // A collection's name is its entries' folder, and a build keeps the
  // pictures it fetches in a folder called media (§15 · 13).
  if (c.name === MEDIA_FOLDER) {
    say(E.NAME, path, `${q(c.name)} is the folder a build keeps the pictures it fetches in — a collection's name is its entries' folder, so call it something else`);
    return prefixes;
  }
  if (zero(c.label)) {
    say(E.LABEL_MISSING, `${path}.label`, `collection ${q(c.name)} has no label, and a menu of keys is not a menu`);
    return prefixes;
  }
  const mark = j.mark();
  validateText(say, path, 'label', c.label);
  if (!zero(c.one)) validateText(say, path, 'one', c.one);
  if (!zero(c.intro)) validateText(say, path, 'intro', c.intro);
  if (c.place !== '' && c.place !== 'business' && c.place !== 'site') say(E.COLLECTION, `${path}.place`, `${path}.place is ${q(c.place)}; it is "business" or "site"`);
  if (c.icon !== '' && !lucideRe.test(c.icon) && !pathRe.test(c.icon)) {
    say(E.COLLECTION, `${path}.icon`, `${path}.icon is ${q(c.icon)}; it is \`lucide:<name>\` — an icon of Lucide by its name, like lucide:table-2 — or \`path:<svg path data>\` on a 20×20 grid`);
  }
  if (j.since(mark)) return prefixes;

  const [taken, whole] = validateRoute(say, reg, c, prefixes);
  prefixes = taken;
  if (!whole) return prefixes;

  const entry = typeOf(reg, c.type);
  if (entry === undefined) {
    say(E.COLLECTION, `${path}.type`, `collection ${q(c.name)} says its entries are ${q(c.type)}, and this schema has no such block`);
    return prefixes;
  }
  validateEntryType(say, c, entry);
  validateTrees(say, c, entry);

  const body = new Set();
  c.body.forEach((name, i) => {
    const where = `${path}.blocks[${i}]`;
    if (name === c.type) return say(E.COLLECTION, where, `collection ${q(c.name)} may hold ${q(name)} in its bodies, which is its own entry type — an entry inside an entry is a shape nothing renders`);
    if (typeOf(reg, name) === undefined) return say(E.COLLECTION, where, `collection ${q(c.name)} may hold ${q(name)} in its bodies, and this schema has no such block`);
    if (body.has(name)) return say(E.DUPLICATE, where, `collection ${q(c.name)} lists ${q(name)} twice in its bodies`);
    body.add(name);
  });
  if (c.untranslated !== '' && c.untranslated !== 'base' && c.untranslated !== 'hide') {
    say(E.ATTRIBUTE, `${path}.untranslated`, `collection ${q(c.name)} says untranslated ${q(c.untranslated)} — it is "base", the original shown, or "hide", the entry left out`);
  } else if (c.untranslated === 'hide' && bookedIn({ modules: reg.modules }).has(c.name)) {
    // An entry a module books is in every language, always (the owner, 12
    // November 2026; `registry.Booked`): a language without its translation
    // shows the original's words, never nothing.
    const { module, role } = bookedIn({ modules: reg.modules }).get(c.name);
    say(
      E.ATTRIBUTE,
      `${path}.untranslated`,
      `collection ${q(c.name)} is the ${module} module's ${role}, and says untranslated "hide" — what a visitor books is in every language, always: a language without its translation shows the original's words, or the entry would be bookable in one language's form and missing from another's; leave untranslated out, or say "base"`,
    );
  }
  return prefixes;
}

function validateEntryType(say, c, entry) {
  const path = `collections.${c.name}`;
  const block = `blocks.${c.type}`;
  const title = fieldIn(entry.fields, 'title');
  if (title === undefined) {
    return say(E.ENTRY_TYPE, block, `collection ${q(c.name)} has entries of type ${q(c.type)}, which declares no "title" — an entry is listed, linked to and put in a search result by its title`);
  }
  if (!title.required) return say(E.ENTRY_TYPE, `${block}.title`, `${c.type}.title must be required — an entry with no title cannot be listed`);
  for (const field of entry.fields) {
    const want = ENTRY_KINDS.get(field.key);
    if (want === undefined || field.kind === want) continue;
    return say(E.ENTRY_TYPE, `${block}.${field.key}`, `${c.type}.${field.key} is ${q(field.kind)}, and ${q(field.key)} is reserved for ${q(want)} on a collection's entries`);
  }
  const cover = fieldIn(entry.fields, 'cover');
  if (cover !== undefined && cover.multiple) {
    return say(E.ENTRY_TYPE, `${block}.cover`, `${c.type}.cover is a collection's cover and cannot be multiple — one entry, one picture that stands for it`);
  }

  // The order: by hand, or by a required date, number or — in contract 3 — line of text.
  if (c.order.by !== '' && c.order.by !== 'manual') {
    const where = `${path}.order.by`;
    const by = fieldIn(entry.fields, c.order.by);
    if (by === undefined) say(E.ORDER, where, `collection ${q(c.name)} is ordered by ${q(c.order.by)}, which ${q(c.type)} does not declare`);
    else if (!by.required) say(E.ORDER, where, `collection ${q(c.name)} is ordered by ${c.type}.${c.order.by}, so that field must be required`);
    else if (by.kind !== 'text' && by.kind !== 'date' && by.kind !== 'number') {
      say(E.ORDER, where, `collection ${q(c.name)} is ordered by ${c.type}.${c.order.by}, which is ${q(by.kind)} — order by a date or a number, or arrange them by hand ("manual")`);
    }
  }

  validateEntryGroup(say, c, entry, path);
  validateEndsBy(say, c, entry, path);
}

/** `validateEntryGroup`: a select, or a reference to one entry of one other collection. */
function validateEntryGroup(say, c, entry, path) {
  if (c.group !== '') {
    const where = `${path}.group`;
    const by = fieldIn(entry.fields, c.group);
    if (by === undefined) return say(E.COLLECTION, where, `collection ${q(c.name)} is grouped by ${q(c.group)}, which ${q(c.type)} does not declare`);
    if (by.kind === 'ref' && (refersTo(by).length > 1 || by.many)) {
      return say(E.REF, where, `collection ${q(c.name)} is grouped by ${c.type}.${c.group}, which may point at several ${refersTo(by).length > 1 ? 'collections' : 'entries'} — group by a reference to one other collection, one entry each`);
    }
    if (by.kind === 'ref' && by.ref === c.name) {
      return say(E.COLLECTION, where, `collection ${q(c.name)} is grouped by ${c.type}.${c.group}, which points into ${q(c.name)} itself — group by another collection, and make a tree with a parent field`);
    }
    if (by.kind !== 'select' && by.kind !== 'ref') {
      say(E.COLLECTION, where, `collection ${q(c.name)} is grouped by ${c.type}.${c.group}, which is ${q(by.kind)} — group by a select, or by a ref to another collection`);
    }
  }
}

/**
 * `validateEndsBy`: a collection whose entries are over by their own date
 * (the owner, 16 November 2026, on KAIF's nights) is held to the entry type
 * it reads — a date field of kind "date", a time field of kind
 * "time_of_day", at most a week after, `then` "keep" or "hide", on an IANA
 * zone's clock. Each part is judged on its own, as the platform's
 * `validateEndsBy` judges them (registry/endsBy.go).
 */
function validateEndsBy(say, c, entry, path) {
  const e = c.endsBy;
  if (e === undefined) return;
  const where = `${path}.ends_by`;
  const shape = '"ends_by": {"date": "<a date field>", "time": "<a time_of_day field>", "after": <minutes>, "zone": "Europe/Zurich"}';
  if (e.date === '') {
    say(E.COLLECTION, `${where}.date`, `collection ${q(c.name)} goes by a date it does not name — ${shape}`);
  } else {
    const field = fieldIn(entry.fields, e.date);
    if (field === undefined) say(E.COLLECTION, `${where}.date`, `collection ${q(c.name)} goes by ${c.type}.${e.date}, which ${q(c.type)} does not declare`);
    else if (field.kind !== 'date') {
      say(E.COLLECTION, `${where}.date`, `collection ${q(c.name)} goes by ${c.type}.${e.date}, which is ${q(field.kind)} — ends_by.date names a field of kind "date"`);
    }
  }
  if (e.time !== '') {
    const field = fieldIn(entry.fields, e.time);
    if (field === undefined) say(E.COLLECTION, `${where}.time`, `collection ${q(c.name)} goes at the time in ${c.type}.${e.time}, which ${q(c.type)} does not declare`);
    else if (field.kind !== 'time_of_day') {
      say(E.COLLECTION, `${where}.time`, `collection ${q(c.name)} goes at the time in ${c.type}.${e.time}, which is ${q(field.kind)} — ends_by.time names a field of kind "time_of_day"`);
    }
  }
  if (e.after !== undefined && (e.after < 0 || e.after > ENDS_AFTER_MAX)) {
    say(E.COLLECTION, `${where}.after`, `collection ${q(c.name)} goes ${e.after} minutes after its moment — between 0 and ${ENDS_AFTER_MAX} (a week)`);
  }
  if (e.then !== '' && e.then !== 'keep' && e.then !== 'hide') {
    say(E.COLLECTION, `${where}.then`, `collection ${q(c.name)} does ${q(e.then)} with an entry that is over — "keep" leaves it on the site for the template to place (the default), "hide" takes it off`);
  }
  if (e.zone === '') {
    say(E.COLLECTION, `${where}.zone`, `collection ${q(c.name)} goes by a date on no clock — ends_by.zone is the IANA zone the date is in, "Europe/Zurich"`);
  } else if (!isZone(e.zone)) {
    say(E.COLLECTION, `${where}.zone`, `collection ${q(c.name)} goes by a date in ${q(e.zone)}, which is no IANA zone — "Europe/Zurich", "Europe/Kyiv"`);
  }
}

/** `validateTrees3`: a tree is a parent — one reference, to the collection alone (§15 · 10). */
function validateTrees(say, c, entry) {
  for (const field of entry.fields) {
    const to = refersTo(field);
    if (field.kind !== 'ref' || !to.includes(c.name)) continue;
    if (to.length > 1 || field.many) {
      const at = `blocks.${c.type}.${field.key}`;
      say(E.REF, `${at}.ref`, `${at} points into ${q(c.name)} itself, and may point at several ${to.length > 1 ? 'collections' : 'entries'} — a tree is a parent: one reference, to this collection alone`);
    }
  }
}

/** `validateRefs`: every reference points into a collection the schema declares; blocks walked by place, as in Go. */
function validateRefs(say, reg) {
  const names = new Set(reg.collections.map((one) => one.name));
  const walk = (where, fields) => {
    for (const field of fields) {
      const at = `${where}.${field.key}`;
      if (field.kind === 'ref') {
        for (const to of refersTo(field)) {
          if (!names.has(to)) say(E.REF, `${at}.ref`, `${at} points into collection ${q(to)}, which this schema does not declare`);
        }
      }
      walk(at, field.of);
    }
  };
  reg.blocks.forEach((block, i) => walk(`blocks[${i}]`, block.fields));
  walk('page_seo', reg.pageSEO);
}

function validateModules(say, reg) {
  for (const name of Object.keys(reg.modules).sort()) {
    const use = reg.modules[name];
    const path = `modules.${name}`;
    const def = MODULES.get(name);
    if (def === undefined) {
      say(E.MODULE, path, `${q(name)} is not a module — this service knows ${[...MODULES.keys()].join(', ')}`);
      continue;
    }
    const bound = new Set();
    for (const role of Object.keys(use).sort()) {
      const collection = use[role];
      bound.add(role);
      const roleDef = def.roles.find((one) => one.name === role);
      if (roleDef === undefined) {
        say(E.MODULE_ROLE, `${path}.${role}`, `the ${name} module has no role ${q(role)} — it takes ${def.roles.map((one) => q(one.name)).join(', ')}`);
        continue;
      }
      const col = reg.collections.find((one) => one.name === collection);
      if (col === undefined) {
        say(E.MODULE_ROLE, `${path}.${role}`, `${q(role)} points at the collection ${q(collection)}, which this schema does not declare`);
        continue;
      }
      validateReads(say, reg, name, roleDef, col);
    }
    for (const role of def.roles) {
      if (role.required && !bound.has(role.name)) say(E.MODULE_ROLE, path, `the ${name} module needs ${q(role.name)}: ${role.means}`);
    }
    // A resource's class points into the collection bound as the classes.
    const resources = reg.collections.find((one) => one.name === use.resources);
    const entry = resources === undefined ? undefined : typeOf(reg, resources.type);
    const field = entry === undefined ? undefined : fieldIn(entry.fields, 'class');
    if (field !== undefined && field.kind === 'ref') {
      const at = `blocks.${resources.type}.class`;
      if (!Object.hasOwn(use, 'classes')) say(E.MODULE_ROLE, at, `${at} is a class, and the ${name} module has no collection bound as its classes — add "classes": ${q(field.ref)} to modules.${name}`);
      else if (field.ref !== use.classes) say(E.MODULE_ROLE, at, `${at} points at ${q(field.ref)}, and the ${name} module's classes are ${q(use.classes)}`);
    }
  }
}

function validateReads(say, reg, module, role, col) {
  const entry = typeOf(reg, col.type);
  if (entry === undefined) return;
  const path = `modules.${module}.${role.name}`;
  for (const read of role.reads) {
    const field = fieldIn(entry.fields, read.key);
    if (field === undefined) {
      if (read.required) say(E.MODULE_ROLE, path, `${q(col.name)} is the ${module} module's ${role.name}, and its entry type ${q(col.type)} has no ${q(read.key)} field — ${read.means}`);
      continue;
    }
    const at = `blocks.${col.type}.${read.key}`;
    // What a resource does is one reference to several services in contract 3 (§3.6).
    if (read.key === 'does' && field.kind === 'ref' && field.many) {
      const services = reg.modules[module]?.services ?? '';
      const to = refersTo(field);
      if (to.length !== 1 || to[0] !== services) say(E.MODULE_ROLE, at, `${at} is what a resource does, and points into ${q(to)} — the ${module} module's services are ${q(services)}`);
      continue;
    }
    if (field.kind !== read.kind) {
      say(E.MODULE_ROLE, at, `${at} is ${q(field.kind)}, and the ${module} module reads ${q(read.key)} as ${q(read.kind)}`);
      continue;
    }
    for (const option of read.options === undefined ? [] : field.options) {
      if (!read.options.includes(option)) say(E.MODULE_ROLE, at, `${at} offers ${q(option)}, and the ${module} module reads ${q(read.key)} as one of ${q(read.options)}`);
    }
    for (const want of read.of ?? []) {
      const sub = fieldIn(field.of, want.key);
      if (sub === undefined) {
        if (!want.required) continue;
        say(E.MODULE_ROLE, at, `${at} has no ${q(want.key)} row field — the ${module} module reads ${q(read.key)} rows as ${read.of.map((one) => `${q(one.key)} ${one.kind}`).join(', ')}`);
        continue;
      }
      if (sub.kind !== want.kind && !(want.kind === 'text' && sub.kind === 'ref')) {
        say(E.MODULE_ROLE, `${at}.${want.key}`, `${at}.${want.key} is ${q(sub.kind)}, and the ${module} module reads it as ${q(want.kind)}`);
      }
    }
  }
}

/** `validateShared`: the types `shared` names, and the roles their fields say (§3.1, §3.3). */
function validateShared(say, reg) {
  const shared = new Set();
  reg.shared.forEach((name, i) => {
    const at = `shared[${i}]`;
    if (typeOf(reg, name) === undefined) return say(E.SHARED, at, `${q(name)} is shared, and this schema declares no such block`);
    if (shared.has(name)) return say(E.SHARED, at, `${q(name)} is shared twice`);
    shared.add(name);
  });
  // A role is said by a field of a shared type itself — never by a row, an
  // ask or the page's SEO.
  const nowhere = (owner, fields) => {
    for (const field of fields) {
      const at = `${owner}.${field.key}`;
      if (field.role !== '') say(E.SHARED, `${at}.role`, `${at} says the role ${q(field.role)}, and a role is said by a field of the shared text itself`);
      nowhere(at, field.of);
    }
  };
  const said = new Map();
  for (const block of reg.blocks) {
    const owner = `blocks.${block.type}`;
    for (const field of block.fields) {
      nowhere(`${owner}.${field.key}`, field.of);
      if (field.role === '') continue;
      const at = `${owner}.${field.key}`;
      if (!ROLES.includes(field.role)) say(E.SHARED, `${at}.role`, `${at} says the role ${q(field.role)}, which is none of ${ROLES.join(', ')}`);
      else if (!shared.has(block.type)) say(E.SHARED, `${at}.role`, `${at} says the role ${q(field.role)}, and ${q(block.type)} is not among the types \`shared\` lists`);
      else if (said.has(field.role)) say(E.SHARED, `${at}.role`, `${said.get(field.role)} and ${at} both say the role ${q(field.role)} — one field a role`);
      else said.set(field.role, at);
    }
    nowhere(`${owner}.asks`, block.asks);
  }
  nowhere('page_seo', reg.pageSEO);
}

// ── a type's steps from its older versions (`upcast.go`) ───────────────────
//
// A type at `v: 3` names, for each older version, the step to the next: a
// closed set of changes — rename, rows, values, drop, set — each judged for
// its spelling, and the last step's names held to the fields the type has now.

/** `upcastDepth`: a list's rows, and no list inside a row. */
const UPCAST_DEPTH = 2;

/** Go's `IsEmpty`: nothing, blank words, an empty list. */
const emptyValue = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
const sortedKeys = (object) => Object.keys(object ?? {}).sort();

/** `validateUpcast`: each step from an older version of the type, each version once. */
function validateUpcast(say, path, block) {
  const seen = new Set();
  block.upcast.forEach((step, i) => {
    const at = `${path}.upcast[${i}]`;
    if (step.from < 1 || step.from >= block.v) {
      say(E.UPCAST, `${at}.from`, `block ${q(block.type)} is at version ${block.v}, and a step goes from an older version of it: from ${step.from} is not one (1 to ${Math.max(block.v - 1, 1)})`);
      return;
    }
    if (seen.has(step.from)) {
      say(E.UPCAST, `${at}.from`, `block ${q(block.type)} has two steps from version ${step.from} — one step a version`);
      return;
    }
    seen.add(step.from);
    // The last step makes the block the type as it is declared now; an
    // earlier step's names are a version nobody declares any more, and only
    // their spelling is held.
    const last = step.from === block.v - 1;
    validateChange(say, at, block.type, step, last ? block.fields : [], last, 1);
  });
}

/** `validateChange`: one step's changes to an object whose fields, in the last step, are `fields`. */
function validateChange(say, at, blockType, change, fields, last, depth) {
  const name = (where, key) => {
    if (keyRe.test(key)) return true;
    say(E.UPCAST, where, `${where} names ${q(key)}, which is not a field's name`);
    return false;
  };
  const declared = (where, key) => {
    if (last && fieldIn(fields, key) === undefined) {
      say(E.UPCAST, where, `${where} writes ${q(key)}, and the last step makes the block ${q(blockType)} as it is declared now, which has no such field`);
    }
  };

  const targets = new Map();
  for (const from of sortedKeys(change.rename)) {
    const to = change.rename[from];
    const where = `${at}.rename.${from}`;
    if (!name(where, from) || !name(where, to)) continue;
    if (from === to) {
      say(E.UPCAST, where, `${where} renames ${q(from)} to itself`);
      continue;
    }
    if (targets.has(to)) {
      say(E.UPCAST, where, `${at}.rename.${targets.get(to)} and ${where} both become ${q(to)} — one value a field`);
      continue;
    }
    targets.set(to, from);
    declared(where, to);
  }
  for (const key of sortedKeys(change.values)) {
    const where = `${at}.values.${key}`;
    if (!name(where, key)) continue;
    const renames = change.values[key] ?? {};
    if (Object.keys(renames).length === 0) say(E.UPCAST, where, `${where} renames no value`);
    // Go walks the map in no order; this copy in the keys' own.
    for (const was of sortedKeys(renames)) {
      const now = renames[was];
      if (was === '' || now === '' || was === now) say(E.UPCAST, where, `${where} renames ${q(was)} to ${q(now)}: a value becomes another value`);
    }
    declared(where, key);
  }
  (change.drop ?? []).forEach((key, i) => {
    const where = `${at}.drop[${i}]`;
    if (!name(where, key)) return;
    if (last && fieldIn(fields, key) !== undefined) say(E.UPCAST, where, `${where} drops ${q(key)}, which the block ${q(blockType)} still declares`);
  });
  for (const key of sortedKeys(change.set)) {
    const where = `${at}.set.${key}`;
    if (!name(where, key)) continue;
    if (emptyValue(change.set[key])) {
      say(E.UPCAST, where, `${where} sets nothing — leave the field out of \`set\`, and it starts empty`);
      continue;
    }
    declared(where, key);
  }
  for (const key of sortedKeys(change.rows)) {
    const where = `${at}.rows.${key}`;
    if (!name(where, key)) continue;
    if (depth >= UPCAST_DEPTH) {
      say(E.UPCAST, where, `${where} goes deeper than a list in a row`);
      continue;
    }
    let of = [];
    if (last) {
      const list = fieldIn(fields, key);
      if (list === undefined || list.kind !== 'list') {
        say(E.UPCAST, where, `${where} changes the rows of ${q(key)}, which the block ${q(blockType)} does not declare as a list`);
        continue;
      }
      of = list.of;
    }
    validateChange(say, where, blockType, change.rows[key], of, last, depth + 1);
  }
}

// ── an entry's card in the panel (`form.go`) ───────────────────────────────
//
// A collection's entry type may say `form`: sections with a title and a line
// under it, rows of up to three fields on a grid of six columns, an aside,
// and a control per field from its kind's closed list. The platform draws
// the rest; a field the form does not place is drawn after its sections,
// under «More», and advised (`JTK_W_PANEL_FORM_GUESSED`).

/** `FormColumns`, `FormRowMost`, `FormSpanLeast`, `FormAsideMost`, `FormSectionsMost`, `FormGuessFields`. */
const FORM_COLUMNS = 6;
const FORM_ROW_MOST = 3;
const FORM_SPAN_LEAST = 2;
const FORM_ASIDE_MOST = 6;
const FORM_SECTIONS_MOST = 8;
const FORM_GUESS_FIELDS = 7;
/** `SegmentedMost`, `RadioMost`, `StepperMost`. */
const SEGMENTED_MOST = 4;
const RADIO_MOST = 7;
const STEPPER_MOST = 50;

/** `widgetsByKind`: the controls a field is written with, its kind's own first. */
const WIDGETS = new Map([
  ['text', ['line']],
  ['textarea', ['area', 'tall']],
  ['richtext_lite', ['area', 'tall']],
  ['markdown', ['writing']],
  ['number', ['number', 'stepper']],
  ['money', ['money']],
  ['duration', ['minutes', 'presets']],
  ['time_of_day', ['clock']],
  ['date', ['calendar']],
  ['bool', ['toggle']],
  ['select', ['dropdown', 'radio', 'segmented']],
  ['tel', ['input']],
  ['email', ['input']],
  ['url', ['input']],
  ['sku', ['code']],
  ['media', ['picture']],
  ['list', ['rows']],
  ['ref', ['dropdown']],
]);

/** `WidgetsOf`: a gallery and several references are drawn by their own. */
function widgetsOf(field) {
  if (field.kind === 'media' && field.multiple) return ['gallery'];
  if (field.kind === 'ref' && field.many) return ['checklist'];
  return WIDGETS.get(field.kind) ?? [];
}

/** `widgetMisfit`: why a widget of the kind's cannot draw this field, or ''. */
function widgetMisfit(field, widget) {
  const n = field.options.length;
  if (widget === 'segmented' && n > SEGMENTED_MOST) {
    return `a row of buttons holds at most ${SEGMENTED_MOST} choices and \`${field.key}\` has ${n} — \`radio\` holds ${RADIO_MOST}, \`dropdown\` any number`;
  }
  if (widget === 'radio' && n > RADIO_MOST) return `radios hold at most ${RADIO_MOST} choices and \`${field.key}\` has ${n} — \`dropdown\` holds any number`;
  if (widget === 'stepper') {
    if (!field.integer) return `a stepper counts whole numbers: \`${field.key}\` says \`integer: true\` for it`;
    if ((field.min === 0 && !field.minZero) || (field.max === 0 && !field.maxZero)) return `a stepper runs between two bounds: \`${field.key}\` says both \`min\` and \`max\``;
    if (field.max - field.min > STEPPER_MOST) {
      return `a stepper takes at most ${STEPPER_MOST} steps and \`${field.key}\` runs from ${field.min} to ${field.max} — \`number\` is a box to type into`;
    }
  }
  return '';
}

/** `wholeRow`: rows, pictures in a strip, a document — each too narrow beside another field. */
const wholeRow = (field) => field.kind === 'list' || field.kind === 'markdown' || (field.kind === 'media' && field.multiple);

/** `asideRefuses`: why a field may not stand in the aside, or ''. */
function asideRefuses(field) {
  if (wholeRow(field)) return 'takes a whole row';
  if (field.kind === 'textarea' || field.kind === 'richtext_lite') return 'is a paragraph, written in a row';
  return '';
}

/** `pairable`: the kinds the default layout puts two to a row. */
function pairable(field) {
  if (['number', 'money', 'duration', 'time_of_day', 'date', 'bool', 'select', 'tel', 'email', 'sku'].includes(field.kind)) return true;
  if (field.kind === 'ref') return !field.many;
  if (field.kind === 'media') return !field.multiple;
  return false;
}

/** `inForm`: `body` is the writing, beside the page, and never in a form. */
const inForm = (field) => field.key !== 'body';

/** `kindSaid`: a field's kind as a sentence says it. */
function kindSaid(field) {
  if (field.kind === 'media') return field.multiple ? 'a gallery' : 'a picture';
  if (field.kind === 'list') return 'a list';
  if (field.kind === 'ref' && field.many) return 'references to several entries';
  return `a ${field.kind}`;
}

function saidAsOneOf(widgets) {
  const quoted = widgets.map((one) => `\`${one}\``);
  if (quoted.length === 1) return `its one control is ${quoted[0]} — leave it out`;
  return `it is written with ${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}`;
}

/**
 * `form3.def`: the form in its one shape, every cell an object; a cell that is
 * neither a key nor `{field, span}` is refused where it stands, as the file is
 * read. What the cells name is judged with the rest (`validateForms`).
 */
function formDefOf(say, at, d) {
  const out = { sections: d.sections === undefined ? undefined : [], aside: d.aside, widgets: d.widgets };
  (d.sections ?? []).forEach((section, i) => {
    const read = { title: section.title, note: section.note, rows: [] };
    section.rows.forEach((row, r) => {
      const cells = [];
      row.forEach((raw, c) => {
        // Go reads a cell as words first — null among them, as no words —
        // and then as `{field, span}`, each of the right shape.
        if (raw === null || typeof raw === 'string') {
          cells.push({ field: raw ?? '', span: 0 });
        } else if (isObject(raw) && (absent(raw.field) || typeof raw.field === 'string') && (absent(raw.span) || Number.isInteger(raw.span))) {
          cells.push({ field: raw.field ?? '', span: raw.span ?? 0 });
        } else {
          const where = `${at}.sections[${i}].rows[${r}][${c}]`;
          say(E.PANEL_FORM, where, `${where} is not a field of a row: a row is a list of keys, or of {"field": "costs", "span": 2}`);
        }
      });
      read.rows.push(cells);
    });
    out.sections.push(read);
  });
  return out;
}

/** `validateForms`: every `form` of the schema, one code, the rule in its sentence. */
function validateForms(say, reg) {
  const entryTypes = new Set(reg.collections.map((one) => one.type));
  for (const block of reg.blocks) {
    if (block.form === undefined) continue;
    const at = `blocks.${block.type}.form`;
    if (!entryTypes.has(block.type)) {
      say(E.PANEL_FORM, at, `${at} lays out an entry's card, and \`${block.type}\` is no collection's \`type\`: leave \`form\` out of a page's block`);
      continue;
    }
    validateForm(say, at, block);
  }
}

function validateForm(say, at, block) {
  const def = block.form;
  const keys = block.fields.filter(inForm).map((one) => one.key).join(', ');
  // Each name the form says, once, a field of the type the card draws.
  const seen = new Map();
  const name = (where, key) => {
    if (key === '') {
      say(E.PANEL_FORM, where, `${where} names no field: write the key of one of ${keys}`);
      return undefined;
    }
    if (key === 'body') {
      say(E.PANEL_FORM, where, `${where} names \`body\`, which is written beside the page and never in the form: leave it out`);
      return undefined;
    }
    const field = fieldIn(block.fields, key);
    if (field === undefined) {
      say(E.PANEL_FORM, where, `${where} names \`${key}\`, which ${block.type} does not declare: name one of ${keys}`);
      return undefined;
    }
    if (seen.has(key)) {
      say(E.PANEL_FORM, where, `${where} names \`${key}\` again, which ${seen.get(key)} already places: a field stands in one place`);
      return undefined;
    }
    seen.set(key, where);
    return field;
  };

  const sections = def.sections ?? [];
  if (sections.length > FORM_SECTIONS_MOST) {
    say(E.PANEL_FORM, `${at}.sections`, `${at}.sections holds ${sections.length} sections: at most ${FORM_SECTIONS_MOST} — a long form is read to its end on no phone`);
  }
  if (def.sections !== undefined && sections.length === 0) {
    say(E.PANEL_FORM, `${at}.sections`, `${at}.sections is empty: leave it out for the platform's layout, or say a section`);
  }
  sections.forEach((section, i) => {
    const where = `${at}.sections[${i}]`;
    if (section.rows.length === 0) {
      say(E.PANEL_FORM, `${where}.rows`, `${where} has no rows: a section holds one row or more, each a list of fields — [["title"], ["takes", "costs"]]`);
    }
    section.rows.forEach((row, r) => {
      const rowAt = `${where}.rows[${r}]`;
      if (row.length === 0) {
        say(E.PANEL_FORM, rowAt, `${rowAt} is empty: a row holds one to ${FORM_ROW_MOST} fields`);
        return;
      }
      if (row.length > FORM_ROW_MOST) say(E.PANEL_FORM, rowAt, `${rowAt} holds ${row.length} fields: at most ${FORM_ROW_MOST} stand side by side — start another row`);
      let used = 0;
      let open = 0;
      let spansOK = true;
      row.forEach((cell, c) => {
        const cellAt = `${rowAt}[${c}]`;
        const field = name(cellAt, cell.field);
        if (cell.span !== 0 && (cell.span < FORM_SPAN_LEAST || cell.span > FORM_COLUMNS)) {
          say(E.PANEL_FORM, `${cellAt}.span`, `${cellAt}.span is ${cell.span}: a field takes ${FORM_SPAN_LEAST} to ${FORM_COLUMNS} of the row's ${FORM_COLUMNS} columns`);
          spansOK = false;
        }
        used += cell.span;
        if (cell.span === 0) open += 1;
        if (field !== undefined && wholeRow(field) && row.length > 1) {
          say(E.PANEL_FORM, cellAt, `${cellAt} is \`${field.key}\`, ${kindSaid(field)}, which takes a whole row: give it a row of its own`);
        }
      });
      if (!spansOK) return;
      const left = FORM_COLUMNS - used;
      if (used > FORM_COLUMNS) say(E.PANEL_FORM, rowAt, `${rowAt} spans ${used} columns: a row has ${FORM_COLUMNS}`);
      else if (open > 0 && left % open !== 0) say(E.PANEL_FORM, rowAt, `${rowAt} leaves ${left} columns to ${open} fields, which do not share them evenly: give each a \`span\``);
      else if (open > 0 && Math.trunc(left / open) < FORM_SPAN_LEAST) {
        say(E.PANEL_FORM, rowAt, `${rowAt} leaves ${left} columns to ${open} fields: each takes at least ${FORM_SPAN_LEAST} — narrow a \`span\`, or start another row`);
      }
    });
  });

  if (def.aside !== undefined) {
    if (def.aside.length > FORM_ASIDE_MOST) {
      say(E.PANEL_FORM, `${at}.aside`, `${at}.aside holds ${def.aside.length} fields: at most ${FORM_ASIDE_MOST} — the aside is what the entry is at a glance; the rest goes in a section`);
    }
    def.aside.forEach((key, i) => {
      const where = `${at}.aside[${i}]`;
      const field = name(where, key);
      if (field === undefined) return;
      const why = asideRefuses(field);
      if (why !== '') say(E.PANEL_FORM, where, `${where} is \`${key}\`, ${kindSaid(field)}, which ${why}: the aside is a narrow column — put it in a section`);
    });
  }

  for (const key of sortedKeys(def.widgets)) {
    const where = `${at}.widgets.${key}`;
    const chosen = def.widgets[key];
    const field = fieldIn(block.fields, key);
    if (field === undefined || !inForm(field)) {
      say(E.PANEL_FORM, where, `${where} is for \`${key}\`, which ${block.type} does not declare in its form: name one of ${keys}`);
      continue;
    }
    const own = widgetsOf(field);
    if (!own.includes(chosen)) {
      say(E.PANEL_FORM, where, `${where} is ${q(chosen)}, which \`${key}\` (${kindSaid(field)}) is not written with: ${saidAsOneOf(own)}`);
      continue;
    }
    const why = widgetMisfit(field, chosen);
    if (why !== '') say(E.PANEL_FORM, where, `${where} is ${q(chosen)}: ${why}`);
  }

  // A required value is placed, so a new entry asks for it where the form
  // says: a form that leaves one to «More» has forgotten it.
  if (def.sections !== undefined) {
    for (const field of block.fields) {
      if (field.required && inForm(field) && field.key !== 'title' && !seen.has(field.key)) {
        say(E.PANEL_FORM, at, `${at} places no row or aside for \`${field.key}\`, which is required: a new entry is asked for it where the form puts it — place it`);
      }
    }
  }
}

/** The words of a section as the schema wrote them, or `undefined` for none (`rawText`). */
const textAsWritten = (one) => (zero(one) ? undefined : one.words !== '' ? one.words : Object.fromEntries(one.byLocale));

/**
 * `ResolveForm`: an entry type's card, its declared form over the defaults —
 * what the panel draws, as `{ declared, sections, aside }`.
 *
 *   - the aside: what the form says, else every single picture, up to six;
 *   - the sections: what the form says, with `title` first where no row
 *     names it; else one, the platform's: `title` (with `date` beside it),
 *     then every other field in its order, the short ones two to a row;
 *   - a field a declared form does not place: in a last section, «More»;
 *   - each field's control: the declared one, else its kind's own.
 */
function resolveForm(entryType) {
  const def = entryType.form ?? { sections: undefined, aside: undefined, widgets: {} };
  const out = { declared: entryType.form !== undefined, sections: [], aside: [] };
  const widget = (field) => {
    const chosen = def.widgets?.[field.key];
    if (chosen !== undefined && widgetsOf(field).includes(chosen)) return chosen;
    return widgetsOf(field)[0] ?? '';
  };
  const cell = (field, span) => ({ field: field.key, span, widget: widget(field) });
  const fields = entryType.fields.filter(inForm);
  const placed = new Set();

  if (def.aside !== undefined) {
    for (const key of def.aside) {
      const field = fieldIn(entryType.fields, key);
      if (field === undefined || !inForm(field) || placed.has(key)) continue;
      out.aside.push(cell(field, FORM_COLUMNS));
      placed.add(key);
    }
  } else {
    for (const field of fields) {
      if (out.aside.length < FORM_ASIDE_MOST && field.kind === 'media' && !field.multiple) {
        out.aside.push(cell(field, FORM_COLUMNS));
        placed.add(field.key);
      }
    }
  }

  for (const section of def.sections ?? []) {
    const resolved = { more: false, rows: [] };
    const title = textAsWritten(section.title);
    const note = textAsWritten(section.note);
    if (title !== undefined) resolved.title = title;
    if (note !== undefined) resolved.note = note;
    for (const row of section.rows) {
      const spans = rowSpans(row);
      const cells = [];
      row.forEach((at, i) => {
        const field = fieldIn(entryType.fields, at.field);
        if (field === undefined || !inForm(field) || placed.has(at.field)) return;
        cells.push(cell(field, wholeRow(field) ? FORM_COLUMNS : spans[i]));
        placed.add(at.field);
      });
      if (cells.length > 0) resolved.rows.push(cells);
    }
    if (resolved.rows.length > 0) out.sections.push(resolved);
  }

  // `title` first, where nothing placed it; in the platform's layout a dated
  // entry says when beside it.
  let lead;
  const title = fieldIn(entryType.fields, 'title');
  if (title !== undefined && !placed.has('title')) {
    lead = [cell(title, FORM_COLUMNS)];
    placed.add('title');
    const date = fieldIn(entryType.fields, 'date');
    if (date !== undefined && def.sections === undefined && date.kind === 'date' && !placed.has('date')) {
      lead = [cell(title, 4), cell(date, 2)];
      placed.add('date');
    }
  }

  const rest = fields.filter((field) => !placed.has(field.key));
  if (def.sections === undefined) {
    const rows = [...(lead === undefined ? [] : [lead]), ...packRows(rest, cell)];
    if (rows.length > 0) out.sections.push({ more: false, rows });
    return out;
  }
  if (lead !== undefined) {
    if (out.sections.length === 0) out.sections.push({ more: false, rows: [] });
    out.sections[0].rows.unshift(lead);
  }
  if (rest.length > 0) out.sections.push({ more: true, rows: packRows(rest, cell) });
  return out;
}

/** `packRows`: in their order, two short ones to a row, everything else a row of its own. */
function packRows(fields, cell) {
  const rows = [];
  let waiting;
  for (const field of fields) {
    if (!pairable(field)) {
      if (waiting !== undefined) rows.push([cell(waiting, FORM_COLUMNS / 2)]);
      waiting = undefined;
      rows.push([cell(field, FORM_COLUMNS)]);
    } else if (waiting === undefined) {
      waiting = field;
    } else {
      rows.push([cell(waiting, FORM_COLUMNS / 2), cell(field, FORM_COLUMNS / 2)]);
      waiting = undefined;
    }
  }
  if (waiting !== undefined) rows.push([cell(waiting, FORM_COLUMNS / 2)]);
  return rows;
}

/** `rowSpans`: each declared span, and the rest of the six shared by the cells that say none. */
function rowSpans(row) {
  const used = row.reduce((sum, one) => sum + one.span, 0);
  const open = row.filter((one) => one.span === 0).length;
  const share = open > 0 ? Math.trunc((FORM_COLUMNS - used) / open) : 0;
  return row.map((one) => (one.span === 0 ? share : one.span));
}

/**
 * `adviseForms`: where the panel guessed a field's place — a declared form
 * that leaves fields to «More», or a type of seven fields or more with no
 * form at all.
 */
function adviseForms(say, reg) {
  const done = new Set();
  for (const collection of reg.collections) {
    const entryType = typeOf(reg, collection.type);
    if (entryType === undefined || done.has(entryType.type)) continue;
    done.add(entryType.type);
    const at = `blocks.${entryType.type}`;
    if (entryType.form !== undefined) {
      for (const section of resolveForm(entryType).sections) {
        if (!section.more) continue;
        const keys = section.rows.flat().map((one) => `\`${one.field}\``).join(', ');
        say(W.PANEL_FORM_GUESSED, `${at}.form`, `${at}.form places no row for ${keys}: the panel draws them after its sections, under More, laid out by their kinds — place them, or say where in a section`);
      }
      continue;
    }
    const count = entryType.fields.filter(inForm).length;
    if (count >= FORM_GUESS_FIELDS) {
      say(W.PANEL_FORM_GUESSED, at, `${at} has ${count} fields and no \`form\`: the panel lays them out in their order, short ones two to a row and pictures aside — say \`form\` to put together what belongs together`);
    }
  }
}

// ── the judge ──────────────────────────────────────────────────────────────

/**
 * Everything the platform would say of this text as a contract-3 schema, in
 * the order it says it; `[]` for one it accepts. A text that does not say
 * `"contract": 3` is not this judge's: it is said so, as the platform's
 * reader of `jtk/schema.json` says it (`JTK_E_CONTRACT_UNKNOWN`).
 *
 * @param {string} raw the schema as text, as `jtk/schema.json` holds it
 * @returns {{ code: string; path: string; says: string }[]}
 */
export function judgeSchema(raw) {
  return judged(raw).faults;
}

/**
 * `adviseLive`: a schema that does not say `render: "live"` — the template
 * not declared ready to draw a draft live (`RENDER` in the scaffold's
 * blocks.ts, docs/live.md). A contract-3 site keeps it (the owner, 16
 * November 2026); said at `render`, as the platform's `Advise` says it.
 */
function adviseLive(say, reg) {
  if (reg.render === 'live') return;
  say(
    W.NOT_LIVE,
    'render',
    "the schema does not say `render: \"live\"`, so the panel shows the owner a change only after a build, and an entry's card cannot be previewed before it is saved — keep `RENDER = 'live'` in src/content/blocks.ts and the scaffold's src/live/, and take it out only where a page does at build what a server cannot; say why in BRIEF.md (docs/live.md)",
  );
}

/**
 * The judge's advice on this text where it refuses nothing, as the
 * platform's `Advise` gives it beside an empty verdict: the panel guessing
 * where an entry's fields go (`JTK_W_PANEL_FORM_GUESSED`) — a form that
 * leaves fields to «More», or a type of seven fields or more with none —
 * and a template not declared ready to draw a draft live
 * (`JTK_W_NOT_LIVE`). Allowed, and unwise; `[]` for a schema it refuses.
 *
 * @param {string} raw the schema as text
 * @returns {{ code: string; path: string; says: string }[]}
 */
export function adviseSchema(raw) {
  const { faults, reg } = judged(raw);
  if (faults.length > 0 || reg === undefined) return [];
  const j = judgement();
  adviseForms(j.say, reg);
  adviseLive(j.say, reg);
  return j.list;
}

/**
 * Each collection's entry card as the panel draws it (`Registry.Forms`), by
 * the collection's name — `{ declared, sections, aside }` — or `null` for a
 * schema the judge refuses.
 *
 * @param {string} raw the schema as text
 */
export function formsOf(raw) {
  const { faults, reg } = judged(raw);
  if (faults.length > 0 || reg === undefined) return null;
  const out = {};
  for (const collection of reg.collections) {
    const entryType = typeOf(reg, collection.type);
    if (entryType !== undefined) out[collection.name] = resolveForm(entryType);
  }
  return out;
}

/** The verdict, and the registry it was reached on where the text could be read into one. */
function judged(raw) {
  let top;
  try {
    top = JSON.parse(raw);
  } catch (why) {
    return { faults: [{ code: E.SCHEMA_UNREADABLE, path: '', says: `this is not a schema: ${why.message}` }] };
  }
  if (!isObject(top)) return { faults: [{ code: E.SCHEMA_UNREADABLE, path: '', says: 'this is not a schema: a schema is one JSON object' }] };
  if (top.contract !== 3) {
    const said = top.contract === undefined ? 'says no contract' : `says contract ${JSON.stringify(top.contract)}`;
    return { faults: [{ code: E.CONTRACT, path: 'contract', says: `jtk/schema.json ${said} — it is contract 3's file, and says "contract": 3; contracts 1 and 2 are written in jtk/catalogue.json` }] };
  }

  const stray = strayKeys(top);
  if (stray.length > 0) return { faults: stray };

  let file;
  try {
    file = decode(top);
  } catch (why) {
    if (!(why instanceof Unreadable)) throw why;
    return { faults: [{ code: E.SCHEMA_UNREADABLE, path: why.path, says: why.message }] };
  }

  const read = judgement();
  const reg = {
    generator: file.generator,
    // Spelt one way, as the platform's upgrade spells them before it judges.
    locale: canonicalTag(file.locale) ?? file.locale,
    locales: file.locales.map((one) => canonicalTag(one) ?? one),
    modules: file.modules,
    shared: file.shared,
    blocks: file.blocks.map((block, i) => {
      const at = at3('blocks', block.type, i);
      return {
        ...block,
        fields: fieldsOf(read.say, at, block.fields),
        asks: fieldsOf(read.say, `${at}.asks`, block.asks),
        // In the order of their versions, as `upcastSteps` keeps them: the
        // judge's `upcast[i]` is a step's place in that order.
        upcast: [...block.upcast].sort((one, other) => one.from - other.from),
        form: block.form === undefined ? undefined : formDefOf(read.say, `${at}.form`, block.form),
      };
    }),
    pageSEO: fieldsOf(read.say, 'page_seo', file.pageSEO),
    render: file.render,
  };
  reg.collections = file.collections.map((c, i) => collectionOf(read.say, at3('collections', c.name, i), c, file.locale));
  if (read.list.length > 0) return { faults: read.list };

  const j = judgement();
  if (reg.generator !== '' && !generatorRe.test(reg.generator)) j.say(E.GENERATOR, 'generator', `${q(reg.generator)} does not name a generator`);
  if (reg.blocks.length === 0) j.say(E.SCHEMA_EMPTY, 'blocks', 'a schema with no blocks describes nothing');
  if (reg.locale === '') j.say(E.LOCALE, 'locale', 'contract 3 names the site\'s own language — "locale": "de" — and the site takes it from here (wiki/98 §3.1)');
  // `render`: "live", or absent (wiki/89 §12) — `RENDER` in the scaffold's template.
  if (file.render !== '' && file.render !== 'live') j.say(E.ATTRIBUTE, 'render', `render is ${q(file.render)} — "live" says the template draws a draft live, and absent says it does not`);
  const seen = new Set();
  for (const block of reg.blocks) validateBlock(j, block, seen);
  validateFields(j, 'page_seo', reg.pageSEO, 2);
  validateCollections(j, reg);
  validateRefs(j.say, reg);
  validateModules(j.say, reg);
  validateShared(j.say, reg);
  validateForms(j.say, reg);
  return { faults: j.list, reg };
}
