/**
 * The rules the door reads both contracts by — one copy each, whichever
 * contract a site's files are in.
 *
 * ── why they are a file of their own ────────────────────────────────────────
 *
 * The door reads contract 2 in `index.mjs` and contract 3 in `contract3.mjs`,
 * two readers behind one interface (wiki/98 §13). What a tap target is, where
 * a specimen lives, the words of a label in a language and the order a hand-
 * ordered collection lists in are not a contract's: they are the platform's
 * rules, and a second copy in the second reader is how the kit came to
 * disagree with itself in the first place (wiki/98 §0, 4). So they are here,
 * moved out of `index.mjs` as they were, and both readers ask them.
 *
 * Imports nothing: the door runs in a Vite build, in Node and in a test alike.
 */

/**
 * The kinds whose value, filled and the owner's to edit, is drawn as an
 * element a person taps: the platform's set, one for every reader.
 *
 * The platform decides it once (`registry/kinds.go`, `Tappable`) and its
 * build's lint and the panel read that. The kit had four copies of its own and
 * they disagreed — the lint without `money` and `duration`, a listing without
 * `richtext_lite` and `markdown` — so a price the platform's build refused
 * passed every check on the laptop (wiki/98 §0, 4). This is the one copy, and
 * the lint, the catalogue check and the scaffold all ask it.
 */
export const TAPPABLE = new Set(['text', 'textarea', 'richtext_lite', 'markdown', 'media', 'money', 'duration']);

/**
 * Whether a declared field, filled, must carry a tap target: a tappable kind,
 * not kept from the owner (`client_editable: false`), and drawn as an element
 * at all (`no_tap_target` is a value that lives in an attribute, or nowhere).
 * @param {any} field
 */
export function tappable(field) {
  if (field === undefined || field === null) return false;
  if (!TAPPABLE.has(field.kind)) return false;
  if (field.client_editable === false) return false;
  if (field.no_tap_target === true) return false;
  return true;
}

/**
 * Where a specimen lives under its collection: `_fl-<type>[-<view>]`. The
 * panel asks for exactly this address, in the entry's language, to lift the
 * site's own markup for a block an owner has just added.
 * @param {string} type
 * @param {string} [view]
 */
export function specimenId(type, view) {
  return view === undefined || view === '' ? `_fl-${type}` : `_fl-${type}-${view}`;
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The words of a label in a language, looked for in the order the
 * scaffold's `words()` (src/content/blocks.ts) has always looked: the
 * language, its language without the region, the site's other languages,
 * English, and then whatever the label holds.
 *
 * @param {string} base the site's own language, canonical
 * @param {string[]} others its other languages, canonical
 * @param {(locale: unknown) => string} want a language as the door is asked for it, in the form a document carries it
 * @returns {(text: unknown, locale?: unknown) => string}
 */
export function labelWords(base, others, want) {
  const langOf = (locale) => (locale === '' ? base : locale);
  return function words(text, locale) {
    if (text === undefined || text === null) return '';
    if (typeof text === 'string') return text;
    if (!isObject(text)) return '';
    const tag = locale === undefined ? base : langOf(want(locale)) || base;
    const found = text[tag];
    if (typeof found === 'string' && found !== '') return found;
    // A regional language reads its language's words: `en-NL` is English,
    // and labels are written by language (Schorem, 15 October 2026).
    const plain = text[tag.split('-')[0]];
    if (typeof plain === 'string' && plain !== '') return plain;
    for (const other of others) {
      const next = text[other] ?? text[other.split('-')[0]];
      if (typeof next === 'string' && next !== '') return next;
    }
    if (typeof text.en === 'string' && text.en !== '') return text.en;
    return Object.values(text).find((one) => typeof one === 'string' && one !== '') ?? '';
  };
}

/**
 * Which language a label's words are in, where they are not the page's: the
 * same search `labelWords` makes, and the tag of the words it found — `''`
 * where they are the page's language's (or its language's, `en` for
 * `en-NL`), the site's own for words written once, as a declaration writes
 * them in the site's language. For a page to mark the words it falls back on
 * with their `lang`.
 *
 * @param {string} base @param {string[]} others @param {(locale: unknown) => string} want
 */
export function labelLang(base, others, want) {
  const langOf = (locale) => (locale === '' ? base : locale);
  const sameLanguage = (a, b) => a.split('-')[0].toLowerCase() === b.split('-')[0].toLowerCase();
  return function wordsLang(text, locale) {
    if (text === undefined || text === null) return '';
    const tag = locale === undefined ? base : langOf(want(locale)) || base;
    if (typeof text === 'string') return sameLanguage(text === '' ? tag : base, tag) ? '' : base;
    if (!isObject(text)) return '';
    const said = (key) => typeof text[key] === 'string' && text[key] !== '';
    if (said(tag) || said(tag.split('-')[0])) return '';
    for (const other of others) {
      if (said(other)) return sameLanguage(other, tag) ? '' : other;
      if (said(other.split('-')[0])) return sameLanguage(other, tag) ? '' : other.split('-')[0];
    }
    if (said('en')) return sameLanguage('en', tag) ? '' : 'en';
    const first = Object.keys(text).find(said);
    return first === undefined || sameLanguage(first, tag) ? '' : first;
  };
}

/**
 * A collection the owner orders by hand, in their order: each entry's
 * `rank`, written by their moves in the panel (jtakeit-core wiki/94 · M4),
 * compared as bytes. An entry with none comes after the ranked ones, in the
 * order it came — which is every entry of a site from before ranks.
 *
 * The rank is the base document's in both contracts: contract 3 keeps it on
 * the entry's own file and never on a translation (wiki/98 §4.2), so every
 * language lists in the one order the owner arranged.
 *
 * @template {{ raw?: any }} D
 * @param {D[]} list
 * @returns {D[]}
 */
export function byRank(list) {
  const rankOf = (doc) => (typeof doc.raw?.rank === 'string' ? doc.raw.rank : '');
  return [...list].sort((a, b) => {
    const x = rankOf(a);
    const y = rankOf(b);
    if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/**
 * A price as the whole minor units a booking form sums and the platform
 * charges, whichever contract wrote it: the number contract 2 keeps (`4500`)
 * or contract 3's `{ minor: 4500 }` (wiki/98 §3.4). `undefined` for none, for
 * a number that is not whole, and for a price said «from» or «on request»,
 * which nobody is charged online: there is no amount to charge (the owner,
 * 10 November 2026; the platform's `priceIn` reads it as none).
 *
 * A template reads a price it sums through this, never `value('costs')`:
 * read raw, contract 3's object was no number, and the form priced every
 * service at nothing.
 *
 * @param {unknown} value
 * @returns {number | undefined}
 */
export function minorOf(value) {
  let amount = value;
  if (isObject(value)) {
    if (value.from === true || value.on_request === true) return undefined;
    amount = value.minor;
  }
  return typeof amount === 'number' && Number.isInteger(amount) ? amount : undefined;
}

/**
 * What a field names, and where: the collections a reference may point into,
 * and the names it holds, in its order — a reference's one name, a `many`
 * reference's several (contract 3), or the one reference in each row of a
 * list of them, contract 2's `does: [{ service }]` (wiki/98 §3.3: "a one-ref
 * list becomes a `ref` with `many: true`"). A name is an entry's slug in
 * contract 2 and its id in contract 3; the door resolves it either way.
 *
 * @param {any} declared the field's declaration, as the door hands it out
 * @param {unknown} held the field's value
 * @returns {{ to: string[]; names: string[] }}
 */
export function namesIn(declared, held) {
  const targets = (one) =>
    Array.isArray(one?.to) && one.to.length > 0 ? one.to.filter((to) => typeof to === 'string') : typeof one?.ref === 'string' && one.ref !== '' ? [one.ref] : [];
  const words = (list) => list.filter((one) => typeof one === 'string' && one.trim() !== '');
  if (!isObject(declared)) return { to: [], names: [] };
  if (declared.kind === 'ref') return { to: targets(declared), names: words(Array.isArray(held) ? held : [held]) };
  const of = Array.isArray(declared.of) ? declared.of : [];
  if (declared.kind === 'list' && of.length === 1 && of[0]?.kind === 'ref' && Array.isArray(held)) {
    const key = of[0].key;
    return { to: targets(of[0]), names: words(held.map((row) => (isObject(row) ? row[key] : undefined))) };
  }
  return { to: [], names: [] };
}

/**
 * The business's facts, by role (wiki/98 §4.5): every field of the shared
 * text that says a `role` — the scaffold's `contacts` — read where the shared
 * text has it, in the language it was read in. What the owner edits in the
 * panel as the business's name, address and telephone is what the page's
 * structured data, its head and `llms.txt` say: a template reads
 * `facts.text('name')`, never a constant of its own, and falls back to one
 * only where the role is empty.
 *
 * The first block of a type the schema lists in `shared` that declares the
 * role wins, as the judge allows one field a role. A schema with no `shared`
 * — every contract-2 catalogue — has no facts: there the business's facts
 * are the template's (`src/data/site.ts`) and the platform's settings, and
 * contract 2 gets no new readers (wiki/98 §7).
 *
 * @param {{ blocks: any[] }} shared the shared text in a language, as `site.shared(locale)` hands it out
 * @param {unknown} listed the schema's `shared`: the block types the shared text holds
 * @param {(type: string) => any} typeOf a block type's declaration, as the door hands it out
 */
export function factsOf(shared, listed, typeOf) {
  const types = new Set(Array.isArray(listed) ? listed.filter((one) => typeof one === 'string') : []);
  /** @type {Map<string, { block: any; key: string }>} */
  const found = new Map();
  /** @type {Set<string>} */
  const roles = new Set();
  for (const type of types) {
    for (const field of Array.isArray(typeOf(type)?.fields) ? typeOf(type).fields : []) {
      if (isObject(field) && typeof field.role === 'string' && field.role !== '') roles.add(field.role);
    }
  }
  for (const block of Array.isArray(shared?.blocks) ? shared.blocks : []) {
    if (!types.has(block?.type)) continue;
    for (const field of Array.isArray(typeOf(block.type)?.fields) ? typeOf(block.type).fields : []) {
      if (!isObject(field) || typeof field.role !== 'string' || field.role === '' || found.has(field.role)) continue;
      found.set(field.role, { block, key: field.key });
    }
  }
  const of = (role) => found.get(role);
  return {
    roles: [...roles],
    text: (role) => (of(role) === undefined ? '' : of(role).block.text(of(role).key)),
    value: (role) => (of(role) === undefined ? undefined : of(role).block.value(of(role).key)),
    rows: (role) => (of(role) === undefined ? [] : of(role).block.rows(of(role).key)),
    at: (role, row, part) => (of(role) === undefined ? {} : of(role).block.at(of(role).key, row, part)),
    field: (role) => (of(role) === undefined ? undefined : of(role).block.field(of(role).key)),
  };
}
