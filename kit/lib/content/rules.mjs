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
