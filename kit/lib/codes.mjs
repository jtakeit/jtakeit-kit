/**
 * The names the platform gives to the things a catalogue can get wrong.
 *
 * ── this file is a copy, and that is not an accident ────────────────────────
 *
 * The set lives in the admin, in `backend/api/registry/errcode.go`, and that
 * table is the source of truth: it is what `POST /v1/registry/validate` answers
 * with, what the generated reference (`docs/reference/errors.md`) prints, and
 * what the troubleshooting page is tested against. Nothing here is authoritative
 * about anything.
 *
 * It is copied because `jtk catalogue` has to work before there is anything to
 * ask — on a laptop, before a deploy, before a token, on a plane. A local
 * checker that needs the network to name a fault is a local checker nobody runs.
 *
 * The alternative was generating this file from the Go table at build time, and
 * it was rejected for what it would cost rather than what it would buy: a
 * generator, a make target, a CI diff guard and a second repository in the
 * checkout, all so that a list of twenty-one strings can be regenerated on the
 * few days a year it changes.
 *
 * **What keeps it honest is `jtk catalogue --judge`, not anybody remembering.**
 * That flag posts the emitted catalogue to the real validator and reports every
 * place the two answers differ — a code the server raised and we did not, or one
 * we raised and it did not. Every client the studio runs through it is one
 * sitting of that exam, so a code that has been renamed or a
 * check that has drifted is found by the next real project rather than by a
 * reviewer noticing. A copy nobody checks rots in a month; a copy that is
 * examined weekly is a cache.
 *
 * Only the catalogue's codes are here. The build's five — `JTK_E_UNANNOTATED_
 * FIELD` and its siblings — belong to the annotation lint, which runs in the
 * platform's build container and is judged there.
 */

/**
 * The codes, under the names the Go table gives them, so a reader with both
 * files open can put them side by side.
 */
export const E = Object.freeze({
  // The file itself, before anything in it is read.
  UNREADABLE: 'JTK_E_CATALOGUE_UNREADABLE',
  CONTRACT: 'JTK_E_CONTRACT_UNKNOWN',
  EMPTY: 'JTK_E_CATALOGUE_EMPTY',
  GENERATOR: 'JTK_E_GENERATOR_INVALID',

  // Names: what a thing is called, and whether it is called that twice.
  NAME: 'JTK_E_NAME_INVALID',
  DUPLICATE: 'JTK_E_NAME_DUPLICATE',

  // Words: the label and the hint an owner reads in the admin.
  LABEL_MISSING: 'JTK_E_LABEL_MISSING',
  TEXT: 'JTK_E_TEXT_INVALID',

  // Blocks.
  BLOCK_VERSION: 'JTK_E_BLOCK_VERSION',
  BLOCK_EMPTY: 'JTK_E_BLOCK_EMPTY',
  COLLECTS: 'JTK_E_COLLECTS_UNKNOWN',

  // Fields.
  KIND: 'JTK_E_KIND_UNKNOWN',
  BOUNDS: 'JTK_E_BOUNDS_INVALID',
  OPTIONS: 'JTK_E_SELECT_NO_OPTIONS',
  LIST: 'JTK_E_LIST_INVALID',
  MEDIA: 'JTK_E_MEDIA_INVALID',
  BESIDE: 'JTK_E_BESIDE_INVALID',

  // Arrangements.
  VIEW: 'JTK_E_VIEW_INVALID',

  // Languages.
  LOCALE: 'JTK_E_LOCALE_INVALID',

  // Collections.
  COLLECTION: 'JTK_E_COLLECTION_INVALID',
  ENTRY_TYPE: 'JTK_E_ENTRY_TYPE_INVALID',
  ORDER: 'JTK_E_ORDER_INVALID',
});

/**
 * The judge's second voice: advice, with `JTK_W_` codes. A finding here
 * refuses nothing — the catalogue is valid — and comes back from
 * `POST /v1/registry/validate` under `advice`, apart from the refusals. This
 * checker raises none of them (the rules are the server's, about the bookings
 * module it runs), so `--judge` prints them and leaves them out of the exam.
 */
export const W = Object.freeze({
  MODULE_TWIN: 'JTK_W_MODULE_TWIN',
  MODULE_POST: 'JTK_W_MODULE_POST',
});

export const ADVICE = Object.freeze({
  [W.MODULE_TWIN]:
    'A page block types again a fact the bookings module holds — the owner\'s hours, the services\' prices — so the site has two copies and one goes stale.',
  [W.MODULE_POST]:
    'An entry type the bookings module reads is shaped as a post — a body, or excerpt, cover and body — or its services get a page each; a service is filled in, not written.',
});

/** Advice from the judge, never a refusal. */
export function isAdvice(code) {
  return typeof code === 'string' && code.startsWith('JTK_W_');
}

/**
 * What each one means, in the platform's own words — the `Means` line of its row
 * in `AllCodes`.
 *
 * Copied verbatim rather than paraphrased. A second wording of one rule is how
 * two documents come to describe two rules, and the developer reading this one
 * is going to be handed the other by the server a moment later.
 */
export const MEANS = Object.freeze({
  [E.UNREADABLE]: 'The catalogue is not JSON, or carries a key this contract has no place for.',
  [E.CONTRACT]: 'The catalogue names a contract number this service does not speak.',
  [E.EMPTY]: 'The catalogue declares no blocks, so it describes no site.',
  [E.GENERATOR]: 'The `generator` string does not name a tool.',

  [E.NAME]: 'A block type, field key, view key or collection name is not spelled the way an identifier must be.',
  [E.DUPLICATE]: 'Two things in the same place are called the same thing.',

  [E.LABEL_MISSING]: 'A field, view or collection has no label.',
  [E.TEXT]:
    'A label or hint is written both once and per language, names a language that is not one, is empty, or runs too long.',

  [E.BLOCK_VERSION]: 'A block type has no version, or a version below one.',
  [E.BLOCK_EMPTY]: 'A block type declares no fields.',
  [E.COLLECTS]: 'A block says it collects something nothing knows about.',

  [E.KIND]: "A field's kind is not one of the thirteen.",
  [E.BOUNDS]: 'A `min` or `max` is negative, or the minimum is above the maximum.',
  [E.OPTIONS]: 'A `select` field offers nothing to select.',
  [E.LIST]: 'A list nests another list, declares no item fields, or `of` appears on a field that is not a list.',
  [E.MEDIA]:
    "A media field's `accept`, `ratio` or `multiple` do not go together — or one of the three appears on a field that is not media.",

  [E.VIEW]:
    "A block declares arrangements but has no gallery to arrange, sets its bounds in two places, or a view's own bounds do not make sense.",

  [E.LOCALE]: "A language is not a language, is declared twice, or the site's own language appears again among the others.",

  [E.COLLECTION]: "A collection's prefix, pagination, entry type or body list is wrong.",
  [E.ENTRY_TYPE]: 'The block type a collection names cannot be used for entries.',
  [E.ORDER]: 'A collection is ordered by a field that will not order it.',
});

/**
 * The mark on a finding that is this skill's own and will never come back from
 * the server.
 *
 * ── why these may not have a JTK_E_ code ────────────────────────────────────
 *
 * A code is a promise the platform's documentation keeps: every one of them has
 * a row in the generated reference and an anchor in the troubleshooting page,
 * enforced by a test over there. Inventing a `JTK_E_…` for a rule the platform
 * has never heard of would put a name in a developer's terminal that leads
 * nowhere when they go and look it up.
 *
 * And these are genuinely not the catalogue's business. Whether every address in
 * `src/` survives being served under `/p/<slug>/` is about the studio's preview
 * — our deployment, our arrangement, nothing to do with the format a stranger's
 * repository declares. The judge is right not to have an opinion on it.
 *
 * So they are marked, printed as plainly as anything else, and left out of the
 * comparison in `--judge`: their absence from the server's answer is the correct
 * answer rather than a gap.
 */
export const LOCAL = 'JTK_LOCAL';

/** Whether a finding is one the server can be asked about. */
export function isPlatformCode(code) {
  return Object.hasOwn(MEANS, code);
}
