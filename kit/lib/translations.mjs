/**
 * A contract-3 site's translations, judged and counted (jtakeit-core wiki/95,
 * wiki/98 §4.4, §15 · 17–19): what `jtk schema` holds a translation to before
 * a push, and what `jtkit progress` says is left to translate.
 *
 *   judgeTranslation(schema, base, translation, at)   one translation against its original
 *   judgeTranslations(files)                          every translation of a tree
 *   statesOf(files)                                   per language, what is missing and outdated
 *   digest(value)                                     the digest `translated[place].from` holds
 *
 * ── the judge ───────────────────────────────────────────────────────────────
 *
 * As the platform's import will judge one (its `content.Lay`, held to the
 * same corpus) — each a `JTK_E_DOCUMENT_INVALID`, the code its judge gives
 * every other fault of a contract-3 document, but a shared value:
 *
 *   - a translation names what it translates, `of` the original's id, and
 *     sits beside it named for its language, which its `locale` says too, in
 *     the canonical spelling (§15 · 18, 19; the platform's `translationPlaced`)
 *     — the tree's to judge, in `judgeTranslations`, as the platform's is;
 *   - its language is one of the schema's `locales`;
 *   - it holds only what a translation may: a page's `name`, `seo` and the
 *     localized values of its blocks; an entry's `slug`, `seo`, localized
 *     `fields`, its body whole, and `visible` to hold the language back;
 *     the shared text's blocks; and `translated`;
 *   - **a shared value in it is refused**, `JTK_E_TRANSLATION_SHARED`: the
 *     translation of a price, a date, a picture's file is the base,
 *     everywhere (§4.4);
 *   - a block's `type`, `v` and `view` are the original's, and refused;
 *   - an entry somebody books — of a collection a module names in one of
 *     its roles (`registry.Booked`) — is not held back (`visible: false`): it
 *     is in every language, always (the owner, 12 November 2026);
 *   - a key the schema does not declare is refused (§15 · 17);
 *   - a block, a row or a picture is named by its `_key`, never by its place.
 *
 * And, as advice (`JTK_W_TRANSLATION_ORPHAN`, refusing nothing): a
 * `_key` the original has not got. A row the original removed is gone in
 * every language (wiki/95 §2); its words in a translation are shown nowhere,
 * and the platform's next save drops them.
 *
 * ── where a translation stands (wiki/95 §2) ─────────────────────────────────
 *
 *   missing    a localized value the original has and the translation does
 *              not: what the page shows in the original's words — the merge's
 *              `fromBase`, the one rule (overlay.mjs)
 *   outdated   a value the translation has whose `translated[place].from` is
 *              not the digest of the original's value as it is now
 *
 * A value with no `translated` record is current: the import records what an
 * agent wrote as made from the original as it stands (§4.4).
 *
 * ── the digest ──────────────────────────────────────────────────────────────
 *
 * Neither wiki/95 nor wiki/98 fixes it beyond §4.4's eight hex digits
 * (`"from": "9f2c41d0"`); the platform's merge does (`content.Digest`), and
 * this is it: the first eight hex digits of the SHA-256 of the value's
 * canonical JSON — every object's keys in byte order at every depth, no
 * space, a string quoted and escaped as `JSON.stringify` writes it, so text
 * is digested with its quotes (`"Preise"` → `e3ea67be`) — and `""` for a value
 * that says nothing (§4.7), from which nothing was made.
 */
import { createHash } from 'node:crypto';
import { canonicalLocale, sharedLocaleOf } from './content/locale.mjs';
import { bookedIn, isEmpty, kindOf, layOf, localizedIn, overlay, valueAt } from './content/overlay.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A refusal, the code the platform's judge gives a contract-3 document's faults. */
export const REFUSED = 'JTK_E_DOCUMENT_INVALID';
/** A shared value in a translation (the platform's `CodeTranslationShared`, Since: 3). */
export const SHARED = 'JTK_E_TRANSLATION_SHARED';
/** Advice: words for a block, a row or a picture the original has not got (`JTK_W_TRANSLATION_ORPHAN`). */
export const ORPHAN = 'JTK_W_TRANSLATION_ORPHAN';

/** A translation's file name: `prices.en.json`, `vase.de-CH.json`. */
const TRANSLATION = /^(.+)\.([A-Za-z]{2}(?:-[A-Za-z]{2})?)$/;

/** What may be at the top of a translation, by the kind of what it translates (§4.4). */
const TOP = {
  page: ['of', 'locale', 'name', 'seo', 'blocks', 'translated'],
  entry: ['of', 'locale', 'slug', 'visible', 'seo', 'fields', 'blocks', 'translated'],
  shared: ['of', 'locale', 'blocks', 'translated'],
};

/** Who made a translation (§4.4). */
const MAKERS = new Set(['person', 'agent', 'machine']);

// ── the digest ─────────────────────────────────────────────────────────────

/** A value as JSON with its keys in byte order: the bytes a digest is taken of. */
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map((one) => canonicalJSON(one === undefined ? null : one)).join(',')}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The digest of a value: what `translated[place].from` holds of the original
 * a translation was made from (wiki/95 §2, wiki/98 §4.4).
 * @param {unknown} value
 */
export function digest(value) {
  if (isEmpty(value)) return '';
  return createHash('sha256').update(canonicalJSON(value), 'utf8').digest('hex').slice(0, 8);
}

// ── one translation ────────────────────────────────────────────────────────

/**
 * One translation against its original: every fault, each `{ code, path, says }`.
 *
 * @param {any} schema `jtk/schema.json`
 * @param {Record<string, any>} base the original
 * @param {Record<string, any>} translation
 * @param {{ file?: string; original?: string; kind?: 'page' | 'entry' | 'shared' }} [at]
 *   `file`: the translation's file, said in each path; `original`: the original's, said in a sentence
 * @returns {{ code: string; path: string; says: string }[]}
 */
export function judgeTranslation(schema, base, translation, at = {}) {
  const out = [];
  const file = at.file ?? 'the translation';
  const original = at.original ?? 'the original';
  const kind = at.kind ?? kindOf(base);
  const { schema: read } = overlay(schema);
  const refuse = (place, says) => out.push({ code: REFUSED, path: `${file} ${place}`, says });
  const advise = (place, says) => out.push({ code: ORPHAN, path: `${file} ${place}`, says });
  if (!isObject(translation)) {
    refuse('', `${file} is not a document — a JSON object is`);
    return out;
  }
  const shared = (place, field) =>
    out.push({
      code: SHARED,
      path: `${file} ${place}`,
      says:
        `${place} is ${field.kind}, the same in every language, and a translation holds only words — the translation of a shared value is the base, everywhere (wiki/98 §4.4): take it out here, and change it in ${original}, where every language has it`,
    });

  for (const key of Object.keys(translation)) {
    if (!TOP[kind].includes(key)) {
      const holds = { page: 'its name, its seo and the words of its blocks', entry: 'its slug, its seo, the words of its fields, its body and visible', shared: 'the words of its blocks' }[kind];
      refuse(key, `a translation of ${kind === 'shared' ? 'the shared text' : `a ${kind}`} has no "${key}" — it holds ${holds} (wiki/98 §4.4)`);
    }
  }
  // `of` is the tree's to judge (judgeTranslations): a document alone cannot
  // say what else the tree holds — as the platform's `translationPlaced`.
  const words = (key) => {
    if (translation[key] !== undefined && typeof translation[key] !== 'string') refuse(key, `${key} is words, a string`);
  };
  if (kind === 'page') words('name');
  if (kind === 'entry') {
    words('slug');
    if (translation.visible !== undefined && typeof translation.visible !== 'boolean') refuse('visible', 'visible is true or false — false holds this language back');
    // An entry somebody books is in every language, always (the owner, 12
    // November 2026): the diary books it in every language, so no language
    // may drop it from its booking form.
    else if (translation.visible === false && bookedIn(schema).has(base.collection)) {
      const { module, role } = bookedIn(schema).get(base.collection);
      refuse('visible', `an entry of ${JSON.stringify(base.collection)} is the ${module} module's ${role}, and is in every language, always — a visitor books it in any language's form, and the diary reads the original: a translation does not hold it back; take visible out, and a language without its words shows the original's`);
    }
  }

  // Its SEO: the words of the keys `page_seo` declares.
  if (translation.seo !== undefined && kind !== 'shared') {
    if (!isObject(translation.seo)) refuse('seo', 'seo is an object of the keys page_seo declares');
    else {
      const route = kind === 'entry' ? read.collections.get(base.collection)?.route : undefined;
      if (route === 'none') refuse('seo', `an entry of ${base.collection} has no page of its own, so no words for a search engine (wiki/98 §16 · 5)`);
      else judgeObject(translation.seo, isObject(base.seo) ? base.seo : {}, read.seo, 'seo');
    }
  }

  // Blocks laid over by key: a page's and the shared text's.
  if (kind !== 'entry' && translation.blocks !== undefined) {
    if (!Array.isArray(translation.blocks)) refuse('blocks', 'blocks is a list of the original\'s blocks, each by its _key');
    else {
      const theirs = new Map((Array.isArray(base.blocks) ? base.blocks : []).filter((one) => isObject(one) && typeof one._key === 'string').map((one) => [one._key, one]));
      translation.blocks.forEach((block, i) => {
        if (!isObject(block)) return refuse(`blocks[${i}]`, `blocks[${i}] is not a block`);
        if (typeof block._key !== 'string' || block._key === '') return refuse(`blocks[${i}]`, `blocks[${i}] has no _key — a translation names the original's block by its key, never by its place (wiki/98 §4.4)`);
        const place = `blocks[${block._key}]`;
        const mine = theirs.get(block._key);
        if (mine === undefined) return advise(place, `${original} has no block ${block._key}: its words here are shown nowhere, and the platform's next save drops them — the block was removed, or its key is misspelt`);
        for (const part of ['type', 'v', 'view']) {
          if (block[part] !== undefined) refuse(`${place}.${part}`, `${place}.${part}: a translation of a block carries no ${part} — the block is the original's, its words the translation's (wiki/98 §4.4)`);
        }
        judgeObject(block, mine, read.fieldsOf(mine.type), place);
      });
    }
  }

  // An entry's own values, and its body, whole per language.
  if (kind === 'entry') {
    if (translation.fields !== undefined) {
      if (!isObject(translation.fields)) refuse('fields', 'fields is an object of the entry\'s words');
      else judgeObject(translation.fields, isObject(base.fields) ? base.fields : {}, read.collections.get(base.collection)?.fields ?? [], 'fields');
    }
    if (translation.blocks !== undefined && !Array.isArray(translation.blocks)) refuse('blocks', 'blocks is the body in this language, whole — a list of blocks');
  }

  // The record of where each value came from.
  if (translation.translated !== undefined) {
    if (!isObject(translation.translated)) refuse('translated', 'translated is an object: per place, { from, by, at }');
    else {
      for (const [place, record] of Object.entries(translation.translated)) {
        const where = `translated[${JSON.stringify(place)}]`;
        if (!isObject(record) || typeof record.from !== 'string' || !/^[0-9a-f]{8}$/.test(record.from)) refuse(where, `${where} says where its value came from: { "from": the digest of the original's value, eight hex digits }`);
        else if (record.by !== undefined && !MAKERS.has(record.by)) refuse(`${where}.by`, `${where}.by is "person", "agent" or "machine"`);
        else if (record.at !== undefined && (typeof record.at !== 'string' || Number.isNaN(Date.parse(record.at)))) refuse(`${where}.at`, `${where}.at is a moment, RFC 3339`);
      }
    }
  }
  return out;

  /**
   * One object of a translation against the original's at the same place.
   * @param {Record<string, any>} theirs
   * @param {Record<string, any>} mine the original's
   * @param {any[]} fields
   * @param {string} place
   */
  function judgeObject(theirs, mine, fields, place) {
    for (const [key, value] of Object.entries(theirs)) {
      if (key === '_key' || key === '_orphans' || key === 'type' || key === 'v' || key === 'view') continue;
      if (isEmpty(value)) continue;
      const here = `${place}.${key}`;
      const field = fields.find((one) => isObject(one) && one.key === key);
      if (field === undefined) {
        refuse(here, `${here}: the schema declares no field "${key}" there — a translation holds only the localized values the schema declares (wiki/98 §15 · 17)`);
        continue;
      }
      const how = layOf(field);
      if (how === 'whole') continue;
      if (how === 'shared') {
        shared(here, field);
        continue;
      }
      if (how === 'media') {
        if (!isObject(value)) shared(here, field);
        else for (const part of Object.keys(value)) if (part !== 'alt' && !isEmpty(value[part])) shared(`${here}.${part}`, { kind: 'a picture\'s file' });
        continue;
      }
      // A gallery's pictures, or a list's rows: the original's, by key.
      if (!Array.isArray(value)) {
        refuse(here, `${here} is the original's ${how === 'gallery' ? 'pictures' : 'rows'}, each named by its _key with its words`);
        continue;
      }
      const rows = new Map((Array.isArray(mine[key]) ? mine[key] : []).filter((one) => isObject(one) && typeof one._key === 'string').map((one) => [one._key, one]));
      value.forEach((row, i) => {
        if (!isObject(row)) return refuse(`${here}[${i}]`, `${here}[${i}] is not a ${how === 'gallery' ? 'picture' : 'row'}`);
        if (typeof row._key !== 'string' || row._key === '') return refuse(`${here}[${i}]`, `${here}[${i}] has no _key — a translation names the original's ${how === 'gallery' ? 'picture' : 'row'} by its key, never by its place (wiki/98 §4.4)`);
        const at = `${here}[${row._key}]`;
        const original = rows.get(row._key);
        if (original === undefined) return advise(at, `${at}: the original has no ${how === 'gallery' ? 'picture' : 'row'} ${row._key} — its words are shown nowhere, and the platform's next save drops them`);
        if (how === 'gallery') {
          for (const part of Object.keys(row)) if (part !== '_key' && part !== 'alt' && !isEmpty(row[part])) shared(`${at}.${part}`, { kind: 'a picture\'s file' });
          return undefined;
        }
        judgeObject(row, original, Array.isArray(field.of) ? field.of.filter(isObject) : [], at);
        return undefined;
      });
    }
  }
}

// ── a tree ─────────────────────────────────────────────────────────────────

/**
 * A contract-3 tree's documents, the originals and the translations beside
 * them, as the door pairs them: a translation is its original's by `of`, or
 * by the file it sits beside.
 *
 * @param {Record<string, any>} files every file under `jtk/`, keyed `/jtk/…`
 */
export function documentsOf(files) {
  const schema = files['/jtk/schema.json'];
  const base = canonicalLocale(schema?.locale) ?? '';
  const others = (Array.isArray(schema?.locales) ? schema.locales : []).map(canonicalLocale).filter((one) => one !== null && one !== base);
  const originals = [];
  const translations = [];
  for (const name of Object.keys(files).sort()) {
    const raw = files[name];
    const shared = sharedLocaleOf(name);
    if (/^\/jtk\/[^/]+$/.test(name) && shared !== null) {
      if (shared === '') originals.push({ file: name, raw, kind: 'shared' });
      else translations.push({ file: name, raw, kind: 'shared', named: shared, beside: '/jtk/shared.json' });
      continue;
    }
    const kind = name.startsWith('/jtk/pages/') ? 'page' : name.startsWith('/jtk/entries/') ? 'entry' : undefined;
    if (kind === undefined || !name.endsWith('.json')) continue;
    const rel = name.slice((kind === 'page' ? '/jtk/pages/' : '/jtk/entries/').length, -'.json'.length);
    const parts = rel.split('/');
    if (parts.includes('media') || (kind === 'entry' && parts.length !== 2)) continue;
    const last = parts[parts.length - 1];
    const tagged = TRANSLATION.exec(last);
    if (tagged !== null || (isObject(raw) && typeof raw.of === 'string')) {
      const beside = tagged === null ? undefined : `${name.slice(0, name.length - last.length - '.json'.length)}${tagged[1]}.json`;
      translations.push({ file: name, raw, kind, named: tagged === null ? '' : tagged[2], beside });
    } else originals.push({ file: name, raw, kind });
  }
  const byId = new Map();
  const byFile = new Map();
  for (const one of originals) {
    if (isObject(one.raw) && typeof one.raw.id === 'string' && one.raw.id !== '' && !byId.has(one.raw.id)) byId.set(one.raw.id, one);
    byFile.set(one.file, one);
  }
  for (const one of translations) {
    // The file it sits beside first: a translation whose `of` names another
    // document is judged against the one it sits beside, and told its `of`
    // is wrong once.
    const beside = one.beside === undefined ? undefined : byFile.get(one.beside);
    one.original = beside ?? (isObject(one.raw) && typeof one.raw.of === 'string' ? byId.get(one.raw.of) : undefined);
    one.locale = canonicalLocale(isObject(one.raw) ? one.raw.locale : undefined) ?? canonicalLocale(one.named) ?? undefined;
  }
  return { schema, base, others, originals, translations, byId };
}

/**
 * Every translation of a contract-3 tree, judged: where it sits, what it
 * names, its language, and what it holds. Nothing for a tree that is not
 * contract 3.
 *
 * @param {Record<string, any>} files
 * @returns {{ code: string; path: string; says: string }[]}
 */
export function judgeTranslations(files) {
  const { schema, base, others, translations, byId } = documentsOf(files);
  if (!isObject(schema) || schema.contract !== 3) return [];
  const out = [];
  const refuse = (path, says) => out.push({ code: REFUSED, path, says });
  for (const one of translations) {
    const file = one.file.slice(1);
    // Where it sits and what it says it is (§15 · 18, 19), as the platform's `translationPlaced`.
    if (one.kind !== 'shared') {
      const of = isObject(one.raw) ? one.raw.of : undefined;
      if (typeof of !== 'string' || of === '') {
        refuse(`${file} of`, `${file} says no \`of\` — a translation names the id of what it translates (wiki/98 §15 · 18)`);
      } else if (one.original === undefined) {
        refuse(`${file} of`, `${file} is a translation of ${JSON.stringify(of)}, and no page or entry in this tree has that id (wiki/98 §15 · 18)`);
      } else if (one.beside !== undefined && one.original.file !== one.beside) {
        // Named for a file that is not there, and its `of` names another.
        refuse(`${file} of`, `${file} translates ${one.original.file.slice(1)}, and sits where ${one.beside.slice(1)} would be — a translation sits beside its original (wiki/98 §2)`);
      } else if (one.original.raw?.id !== of) {
        refuse(`${file} of`, `${file} is a translation of ${JSON.stringify(of)}, and sits beside ${one.original.file.slice(1)}, whose id is ${JSON.stringify(one.original.raw?.id)} (wiki/98 §15 · 18)`);
      }
      const said = isObject(one.raw) ? one.raw.locale : undefined;
      const canonical = canonicalLocale(said);
      if (one.named === '') refuse(`${file} locale`, `${file} is not named for its language — a translation is <name>.<locale>.json beside its original (wiki/98 §15 · 19)`);
      else if (typeof said !== 'string' || said === '') refuse(`${file} locale`, `${file} says no \`locale\` — a translation says its language, and its name says ${one.named} (wiki/98 §15 · 19)`);
      else if (canonical !== said) refuse(`${file} locale`, `${file} says the language ${JSON.stringify(said)}, which is not spelt as a language is (${canonical ?? 'a language'}) (wiki/98 §15 · 19)`);
      else if (one.named !== said) refuse(`${file} locale`, `${file} says the language ${said} and is named for ${one.named} — both say one language, spelt ${canonical} (wiki/98 §15 · 19)`);
    }
    if (one.locale !== undefined && !others.includes(one.locale)) {
      refuse(`${file} locale`, `${file} is in ${one.locale}, which is not one of the site's other languages (jtk/schema.json locales: ${others.join(', ') || 'none'}${base !== '' ? `; ${base} is the site's own` : ''})`);
      continue;
    }
    if (one.original === undefined) {
      if (one.kind === 'shared') refuse(file, `${file} is the shared text in ${one.named}, and there is no jtk/shared.json for it to translate`);
      continue;
    }
    out.push(...judgeTranslation(schema, one.original.raw, one.raw, { file, original: one.original.file.slice(1), kind: one.kind }));
  }
  return out;
}

// ── where each language stands ─────────────────────────────────────────────

/**
 * The places a translation gives a value at that it made from an original
 * that has changed since: `translated[place].from` is not the digest of the
 * original's value now (wiki/95 §2). A value with no record is current — the
 * import records it as made from the original as it stands (§4.4).
 *
 * @param {any} schema
 * @param {Record<string, any>} base
 * @param {Record<string, any> | null | undefined} translation
 * @param {'page' | 'entry' | 'shared'} [kind]
 */
export function outdatedIn(schema, base, translation, kind = kindOf(base)) {
  if (!isObject(translation) || !isObject(translation.translated)) return [];
  const { merged, fromBase } = overlay(schema).merge(base, translation, { kind });
  if (merged === null) return [];
  // What the translation gave: every localized value of the merged document
  // that is not the original's.
  const kept = new Set(fromBase);
  const gave = new Set(localizedIn(schema, merged, kind).map((value) => value.place).filter((place) => !kept.has(place)));
  const out = [];
  for (const [place, made] of Object.entries(translation.translated)) {
    if (!isObject(made) || typeof made.from !== 'string' || !gave.has(place)) continue;
    if (made.from !== digest(valueAt(base, place, kind))) out.push(place);
  }
  return out;
}

/**
 * Per language, what is left: each localized value a page, an entry or the
 * shared text has in the original and not in the language (missing), and
 * each the language has made from an earlier original (outdated) — every one
 * by its file and its place. An entry its collection hides where it has no
 * translation (`untranslated: "hide"`) is hidden there, its words all missing.
 *
 * @param {Record<string, any>} files
 * @returns {{ locale: string; missing: string[]; outdated: string[]; held: number }[]}
 */
export function statesOf(files) {
  const { schema, others, originals, translations } = documentsOf(files);
  if (!isObject(schema) || schema.contract !== 3) return [];
  const merger = overlay(schema);
  return others.map((locale) => {
    const missing = [];
    const outdated = [];
    let held = 0;
    for (const original of originals) {
      if (!isObject(original.raw)) continue;
      const one = translations.find((t) => t.original === original && t.locale === locale && isObject(t.raw));
      const file = one?.file ?? original.file.replace(/\.json$/, `.${locale}.json`);
      if (original.kind === 'entry' && one?.raw.visible === false) held += 1;
      const { merged, fromBase } = merger.merge(original.raw, one?.raw, { kind: original.kind });
      if (merged === null) continue;
      for (const place of fromBase) missing.push(`${file.slice(1)} ${place}`);
      for (const place of outdatedIn(schema, original.raw, one?.raw, original.kind)) outdated.push(`${file.slice(1)} ${place}`);
    }
    return { locale, missing, outdated, held };
  });
}
