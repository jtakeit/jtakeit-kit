#!/usr/bin/env node
/**
 * jtk catalogue — write `jtk/catalogue.json`, and prove it matches the page.
 *
 * The admin edits a site by tapping the text on it, and it can do that for a
 * site built any way at all because it reads a catalogue rather than knowing
 * anything about the components. Which means the catalogue is the one file
 * standing between "a site that looks like nothing else" and "a site the owner
 * can edit" — and a catalogue kept by hand is a catalogue that drifts.
 *
 * So it is derived. `src/content/blocks.ts` is the declaration, in TypeScript,
 * beside the components; this emits it and then checks it against what the site
 * actually rendered:
 *
 *   every declared field  →  appears in the HTML carrying its data-jtk-path
 *   every annotated path  →  is declared here
 *
 * Both directions matter and they fail differently. A field declared and never
 * rendered is a control in the admin that edits nothing. A field rendered and
 * never declared is text the owner can see and cannot touch — and it is the
 * silent one, which is why `annotation-lint.mjs` exists at the other end of the
 * pipeline to catch it at build time too.
 *
 *   jtk catalogue                 # emit, then check against dist/
 *   jtk catalogue --emit-only     # emit, do not build or check
 *   jtk catalogue --dist ./dist   # check against a build made elsewhere
 *   jtk catalogue --judge         # and ask the real validator whether we agree
 *
 * Exit code is the number of disagreements. Zero means the admin can be handed
 * this repository.
 *
 * ── the checks below are a copy, and --judge is how it stays a good one ──────
 *
 * The authoritative catalogue validator is Go, in the admin's `registry`
 * package, reachable at `POST /v1/registry/validate`. The checks in this file
 * are a second implementation of the same contract, kept because this one has to
 * work offline, before a deploy and before there is a site to attach to — the
 * answer "that is not a usable catalogue" is worth having at the moment somebody
 * writes it, with a line number, rather than in the admin days later with none.
 *
 * Two hand-written validators of one contract disagree silently, so this one
 * sits the other's exam (wiki/35 §5): every finding carries the same `JTK_E_*`
 * code the server would give it, and `--judge` posts the emitted catalogue to
 * the real validator and reports every place the two answers differ. Every
 * client project the studio runs through it is one sitting.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { E, isAdvice, isPlatformCode, LOCAL } from './codes.mjs';

// What this tool calls itself in a catalogue it writes. Bumped when the shape
// it emits changes; the `contract` beside it moves only when the format does.
const TOOL_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const flag = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? fallback : argv[at + 1];
};

const root = resolve(flag('root', process.cwd()));

function die(message) {
  console.error(`jtk catalogue: ${message}`);
  process.exit(1);
}

// --- the declaration --------------------------------------------------------
//
// Imported rather than parsed. Node runs TypeScript by stripping the types,
// which is why the declaration may hold interfaces and `satisfies` and still be
// readable here with no build step and no dependency — and why it is a module
// rather than a JSON file a person edits with no type checking at all.
//
// `src/content/blocks.ts` is where the scaffold keeps it; a site on another
// generator says where its own is with `--declaration`. What the module
// exports is the contract — BLOCKS, PAGE_SEO, BUSINESS_FACTS, COLLECTIONS,
// MODULES, LOCALES — not where it lives.

const declarationPath = flag('declaration', join('src', 'content', 'blocks.ts'));
const source = resolve(root, declarationPath);
if (!existsSync(source)) {
  die(`no ${declarationPath} — that file is what says which fields the admin may edit.
     A site without one cannot be attached to the admin; copy the scaffold's and cut it down,
     or say where yours is: --declaration <file>.`);
}

let declared;
try {
  declared = await import(pathToFileURL(source).href);
} catch (why) {
  die(`could not read ${declarationPath}: ${why.message}
     Node runs TypeScript by stripping types, so the file may hold no enums and no namespaces.`);
}

// Who wrote the file, for the record: this package, unless the scaffold
// that owns the declaration says it did (`@jtakeit/astro` passes --generator).
const GENERATOR = flag('generator', `@jtakeit/kit@${TOOL_VERSION}`);

const catalogue = {
  /*
   * The version of the catalogue FORMAT, and the tool that wrote this file.
   *
   * A whole number because the question the service asks is binary: can this
   * parser read this file. Additive changes are compatible by the rule in
   * wiki/05, so a minor could never change what the validator does — it would
   * be documentation living in a load-bearing field. Semver belongs to this
   * toolkit instead, and its major names the contract it speaks.
   *
   * The generator is provenance and nothing branches on it: the first question
   * about a build that failed on somebody else's repository is which version of
   * the tooling produced the catalogue, and a lock file answers that about
   * dependencies for exactly the same reason.
   */
  contract: 2,
  generator: GENERATOR,
  blocks: declared.BLOCKS ?? [],
  page_seo: declared.PAGE_SEO ?? [],
  business_facts: declared.BUSINESS_FACTS ?? [],
};

// Only when there are any, so that a site with no collections emits the file it
// has always emitted — every catalogue already in a repository stays byte for
// byte what it was.
const collections = declared.COLLECTIONS ?? [];
if (collections.length > 0) catalogue.collections = collections;

// The domain modules the site turns on, and what each is pointed at —
// `{ bookings: { services: 'services', resources: 'masters' } }`. One door:
// a module is on because it is named here (registry/modules.go).
const modules = declared.MODULES ?? {};
if (Object.keys(modules).length > 0) catalogue.modules = modules;

// The languages this site has besides its own, and the same rule about not
// emitting what is not there: a site in one language produces the file it
// always produced.
/**
 * A language tag, as BCP 47 writes one: a lowercase language, and where there
 * is a region, an uppercase region — `de`, `de-CH`, `en-GB`.
 *
 * One constant, because there used to be two in this file and they disagreed:
 * this one, and a second at the LOCALE check that spelt the region `[a-z]{2}`.
 * A site scaffolded as `de-CH` therefore had its labels accepted and its own
 * language refused, with the message "not a language — two letters, or two and
 * a region" printed against a tag that is exactly that. Every regional locale
 * fl-init can produce hit it.
 *
 * The region is *read* in either case and *written* in one. There are sites in
 * repositories spelt `de-ch` — the platform asked for that once — and a checker
 * that refuses them is a checker somebody edits the site to get past, which is
 * how a language ends up spelt to suit a script. So this accepts both, and
 * `canonicalLocale` decides which one goes in the catalogue.
 */
const localeKeyRe = /^[a-z]{2}(-[A-Za-z]{2})?$/;

/** The one spelling, given either. Returns `null` for what is not a language. */
function canonicalLocale(tag) {
  if (!localeKeyRe.test(tag)) return null;
  const [language, region] = tag.split('-');
  return region === undefined ? language : `${language}-${region.toUpperCase()}`;
}

/*
 * A site declares every language it has, in one place.
 *
 * `LOCALE` is the one it is written in and `LOCALES` are the rest. The first
 * used to live only in the admin's record of the site — set when the site was
 * created, defaulting to the studio's own language, changeable by nobody — so a
 * site written in English carried a record saying Ukrainian, and every screen
 * that named a language named the wrong one. The import takes it from here now.
 */
const ownLocale = declared.LOCALE ?? '';
if (ownLocale !== '') catalogue.locale = canonicalLocale(ownLocale) ?? ownLocale;

const locales = declared.LOCALES ?? [];
if (locales.length > 0) catalogue.locales = locales.map((one) => canonicalLocale(one) ?? one);

// --- the shape the admin will refuse ----------------------------------------
//
// Checked here rather than discovered at import, because the answer "that is
// not a usable catalogue" arrives in the admin with no line number and by then
// the developer has moved on.

const keyRe = /^[a-z][a-z0-9_]{0,39}$/;
/*
 * The two sets checkAsks reads, beside the kinds: the keys the structure of
 * an enquiry owns, and the kinds a visitor's form control can hold.
 */
const ENQUIRY_KEYS = new Set(['name', 'contact', 'phone', 'email', 'message', 'website']);
const ASK_KINDS = new Set(['text', 'textarea', 'number', 'bool', 'select', 'tel', 'email', 'url', 'date', 'time_of_day']);

const kinds = new Set([
  'text', 'textarea', 'richtext_lite', 'number', 'tel', 'url',
  'email', 'date', 'select', 'bool', 'media', 'list', 'markdown',
  // An amount in minor units (25000 is 250.00) and a length in whole minutes.
  // Both are whole numbers carrying a unit, and both arrived with the domain
  // modules: a service entry costs something and takes some time.
  'money', 'duration', 'time_of_day',
  // A reference to an entry of one of the catalogue's own collections — the
  // service a master does, the range a product is in. Carries `ref`, the
  // collection it points into.
  'ref',
]);

const problems = [];

/**
 * One thing wrong with the catalogue, named the way the server names it.
 *
 * Three parts and each has one reader, which is the shape `registry.Fault`
 * already has on the other side: `code` is looked up, `where` is navigated to,
 * `says` is read. The code is the part that is new here — the sentence was
 * always enough for a person and was never enough for anything else, because
 * prose cannot be grepped, counted, or compared with what the judge said about
 * the same file.
 *
 * `code` is either one of the platform's — in which case it is a promise that
 * `docs/reference/errors.md` has a row for it, and `--judge` will hold this file
 * to raising it exactly when the server does — or `LOCAL`, for the handful of
 * checks that are the studio's own. See lib/codes.mjs for why those two must not
 * be spelled alike.
 */
function fault(code, where, says) {
  problems.push({ code, where, says });
}

// A label is the words, written once or per language. The same rule the server
// applies in registry.validateText — here so the answer arrives with a line
// number rather than in the admin, hours later, with none.
const LONGEST_LABEL = 300;

function checkText(where, what, text) {
  if (text === undefined || text === null) return;

  if (typeof text === 'string') {
    if (text.length > LONGEST_LABEL) {
      fault(E.TEXT, where, `${what} runs past ${LONGEST_LABEL} characters`);
    }
    return;
  }
  if (typeof text !== 'object' || Array.isArray(text)) {
    fault(
      E.TEXT,
      where,
      `${what} is neither the words — 'Заголовок' — nor the words per ` +
        `language — { uk: 'Заголовок', en: 'Heading' }`,
    );
    return;
  }
  const languages = Object.keys(text);
  if (languages.length === 0) {
    fault(E.TEXT, where, `${what} names no language at all`);
  }
  for (const locale of languages) {
    if (canonicalLocale(locale) === null) {
      fault(E.TEXT, where, `${what} names the language ${JSON.stringify(locale)}, which is not a language`);
    }
    const words = text[locale];
    if (typeof words !== 'string' || words.trim() === '') {
      fault(E.TEXT, where, `${what} is empty in ${JSON.stringify(locale)} — leave the language out instead`);
    } else if (words.length > LONGEST_LABEL) {
      fault(E.TEXT, where, `${what} in ${JSON.stringify(locale)} runs past ${LONGEST_LABEL} characters`);
    }
  }
}

function checkField(owner, field, nested) {
  const where = `${owner}.${field.key ?? '(no key)'}`;

  if (!keyRe.test(field.key ?? '')) {
    fault(E.NAME, where, 'a key must be a–z, 0–9 and underscores, starting with a letter');
  }
  if (!kinds.has(field.kind)) {
    fault(E.KIND, where, `${JSON.stringify(field.kind)} is not a kind the admin has a control for`);
  }
  if (field.kind === 'ref' && !field.ref) {
    fault(E.KIND, `${where}.${field.key}`, 'a ref field says which collection it points into: ref: "services"');
  }
  if (field.kind !== 'ref' && field.ref !== undefined) {
    fault(E.KIND, `${where}.${field.key}`, 'only a ref field carries ref');
  }
  if (!field.label) {
    fault(E.LABEL_MISSING, where, 'no label — the owner sees this above the control, so it is the words themselves');
  }
  checkText(where, 'label', field.label);
  checkText(where, 'hint', field.hint);
  if (field.kind === 'select' && !(field.options ?? []).length) {
    fault(E.OPTIONS, where, 'a select with no options');
  }
  /*
   * `accept` is what tells the admin a slot holds a clip rather than a
   * photograph — a different control, a different upload, and a poster frame
   * to go with it. On anything but a media field it is a field that was copied
   * from one above it.
   */
  if (field.accept && field.kind !== 'media') {
    fault(E.MEDIA, where, `accept is for media fields only, and this one is a ${field.kind}`);
  }
  if (field.accept && !['image', 'video'].includes(field.accept)) {
    fault(E.MEDIA, where, `accept is "image" or "video", not ${JSON.stringify(field.accept)}`);
  }
  if (field.multiple && field.kind !== 'media') {
    fault(E.MEDIA, where, `multiple is for media fields only — a list of anything else is \`kind: 'list'\``);
  }
  /*
   * A clip is stored with the still that a refused autoplay lands on, and a
   * plain media field is one key with nowhere to keep one. So the item shape is
   * the only shape a clip has, and one clip is `multiple` with `max: 1` — which
   * reads oddly for a moment and keeps one value shape for every video on every
   * site.
   */
  if (field.accept === 'video' && !field.multiple) {
    fault(
      E.MEDIA,
      where,
      `accept: 'video' without multiple — a clip is stored with its poster, so declare it multiple (max: 1 if there is only one)`,
    );
  }

  /*
   * The frame a picture is shown in, declared by the design.
   *
   * The other half of cropping — which part of the picture survives it — is
   * stored beside the picture, so a framed field needs the item shape for the
   * same reason a clip does.
   */
  if (field.ratio && field.kind !== 'media') {
    fault(E.MEDIA, where, `ratio is the frame a picture is shown in, and this one is a ${field.kind}`);
  }
  if (field.ratio && !/^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/.test(field.ratio)) {
    fault(E.MEDIA, where, `ratio is two whole numbers, like '3:2' — not ${JSON.stringify(field.ratio)}`);
  }
  if (field.ratio && field.kind === 'media' && !field.multiple) {
    fault(
      E.MEDIA,
      where,
      `ratio without multiple — the focus of a cropped picture is stored beside it, so declare it multiple (max: 1 if there is only one)`,
    );
  }
  if (field.kind === 'list') {
    if (nested) {
      fault(E.LIST, where, 'a list inside a list — the admin has no control for that');
      return;
    }
    if (!(field.of ?? []).length) {
      fault(E.LIST, where, 'a list with no fields in a row');
    }
    for (const sub of field.of ?? []) checkField(where, sub, true);
  }
}

const seenTypes = new Set();
for (const block of catalogue.blocks) {
  if (!keyRe.test(block.type ?? '')) {
    fault(E.NAME, block.type, 'a block type must be a–z, 0–9 and underscores');
  }
  if (seenTypes.has(block.type)) fault(E.DUPLICATE, block.type, 'declared twice');
  seenTypes.add(block.type);

  if (!block.label) fault(E.LABEL_MISSING, block.type, 'no label');
  checkText(block.type, 'label', block.label);
  checkText(block.type, 'hint', block.hint);
  if (!(block.v >= 1)) fault(E.BLOCK_VERSION, block.type, 'v must be 1 or more');

  const seenKeys = new Set();
  for (const field of block.fields ?? []) {
    if (seenKeys.has(field.key)) fault(E.DUPLICATE, `${block.type}.${field.key}`, 'declared twice');
    seenKeys.add(field.key);
    checkField(block.type, field, false);
  }

  checkAsks(block);
  checkViews(block);
}

/*
 * What a form asks a visitor for, beyond the structure every enquiry has.
 *
 * A mirror of validateAsks in registry/catalogue.go: the asks are fields and
 * are judged as fields, with two rules of their own — the structure's keys
 * (name, contact, phone, email, message, website) are taken, and a kind a
 * visitor cannot type into is refused. Only a block that collects may ask.
 */
function checkAsks(block) {
  const asks = block.asks ?? [];
  if (asks.length === 0) return;
  const owner = `${block.type}.asks`;
  if (block.collects !== 'enquiry') {
    fault(E.COLLECTS, owner, 'asks the visitor for fields and collects nothing — say collects: "enquiry"');
  }
  const seen = new Set();
  for (const ask of asks) {
    const where = `${owner}.${ask.key ?? '(no key)'}`;
    if (ENQUIRY_KEYS.has(ask.key)) {
      fault(E.NAME, where, "is the enquiry's own — the form's name, contact, message and honeypot have their places already");
      continue;
    }
    if (kinds.has(ask.kind) && !ASK_KINDS.has(ask.kind)) {
      fault(E.KIND, where, `${JSON.stringify(ask.kind)} is not something a visitor's form control can hold`);
    }
    if (seen.has(ask.key)) fault(E.DUPLICATE, where, 'declared twice');
    seen.add(ask.key);
    checkField(owner, ask, true);
  }
}

/*
 * The arrangements a block may be shown in, and the rules that come with each.
 *
 * A mirror of registry/catalogue.go for the reason the whole script is: the
 * admin's refusal arrives with no line number, days later, to somebody who has
 * moved on. Two rules carry the argument — one gallery, because an arrangement
 * arranges one; and the limits in one place, because a field saying three and a
 * view saying five is a rule whose answer depends on which the reader looked
 * at.
 */
function checkViews(block) {
  const views = block.views ?? [];
  if (views.length === 0) return;

  const galleries = (block.fields ?? []).filter((f) => f.kind === 'media' && f.multiple === true);
  if (galleries.length !== 1) {
    fault(
      E.VIEW,
      block.type,
      'declares views, so it must hold exactly one gallery for them to arrange ' +
        `(it holds ${galleries.length})`,
    );
    return;
  }
  const gallery = galleries[0];
  if (gallery.min !== undefined || gallery.max !== undefined || gallery.ratio !== undefined) {
    fault(
      E.VIEW,
      `${block.type}.${gallery.key}`,
      'the block declares views, so how many pictures and what shape ' +
        'they are cropped to belong to each view and not to the field',
    );
  }

  const seenViews = new Set();
  for (const view of views) {
    const where = `${block.type}.views.${view.key ?? '(no key)'}`;
    if (!keyRe.test(view.key ?? '')) fault(E.NAME, where, 'a view key must be a–z, 0–9 and underscores');
    if (seenViews.has(view.key)) fault(E.DUPLICATE, where, 'declared twice');
    seenViews.add(view.key);

    if (!view.label) fault(E.LABEL_MISSING, where, 'no label — a menu of keys is not a menu');
    checkText(where, 'label', view.label);
    if (view.min !== undefined && view.max !== undefined && view.min > view.max) {
      fault(E.VIEW, where, 'min above max');
    }
    if (view.ratio !== undefined && !/^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/.test(view.ratio)) {
      fault(E.VIEW, where, `${JSON.stringify(view.ratio)} is not a ratio`);
    }
    if (view.sample !== undefined && !/^\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/.test(view.sample)) {
      fault(E.VIEW, where, 'sample must be a page of this site, like "/portfolio"');
    }
    if (view.needs_build !== undefined && typeof view.needs_build !== 'boolean') {
      fault(E.VIEW, where, 'needs_build is true or absent');
    }
  }
}

for (const field of catalogue.page_seo) checkField('page_seo', field, false);
for (const field of catalogue.business_facts) checkField('business_facts', field, false);

/*
 * The collections, checked against the same rules the admin will apply.
 *
 * A mirror of registry/collections.go, and it is here for the reason the whole
 * script is: the admin's refusal arrives with no line number, days later, to
 * somebody who has moved on. These are the rules that cannot be relaxed —
 * every one of them is something that reads a reserved key by name: the
 * listing, the feed, the sitemap, the card a messenger draws, and the admin's
 * own list of entries.
 */
const prefixRe = /^\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;
const entryKinds = {
  title: 'text',
  date: 'date',
  excerpt: 'textarea',
  cover: 'media',
  body: 'markdown',
};

if (ownLocale !== '' && !localeKeyRe.test(ownLocale)) {
  fault(E.LOCALE, 'LOCALE', `${JSON.stringify(ownLocale)} is not a language — two letters, or two and a region`);
}

const seenLocales = new Set();
for (const locale of locales) {
  if (!localeKeyRe.test(locale)) {
    fault(E.LOCALE, 'LOCALES', `${JSON.stringify(locale)} is not a language — two letters, or two and a region`);
  }
  // Duplicate rather than locale, and it is the server's own division: a
  // language declared twice is the same fault as a block type declared twice,
  // and the remedy — rename or remove one — is what a code is for.
  if (seenLocales.has(locale)) fault(E.DUPLICATE, 'LOCALES', `${locale} is declared twice`);
  // The site's own language is the empty string on every page that carries one,
  // so naming it again here is a site with two spellings of one language.
  if (locale === ownLocale) {
    fault(E.LOCALE, 'LOCALES', `${locale} is LOCALE — the site's own language does not go in LOCALES as well`);
  }
  seenLocales.add(locale);
}

const takenPrefixes = [];
const takenNames = new Set();

for (const collection of collections) {
  const where = `collection ${collection.name ?? '(no name)'}`;

  if (!keyRe.test(collection.name ?? '')) {
    fault(E.NAME, where, 'a name must be a–z, 0–9 and underscores, starting with a letter');
  }
  if (takenNames.has(collection.name)) fault(E.DUPLICATE, where, 'declared twice');
  takenNames.add(collection.name);

  if (!collection.label) fault(E.LABEL_MISSING, where, 'no label — a menu of keys is not a menu');
  checkText(where, 'label', collection.label);

  if (!prefixRe.test(collection.prefix ?? '')) {
    fault(E.COLLECTION, where, 'prefix must be a path like "/blog", with no trailing slash');
  } else {
    for (const other of takenPrefixes) {
      if (`${other}/`.startsWith(`${collection.prefix}/`) || `${collection.prefix}/`.startsWith(`${other}/`)) {
        fault(E.COLLECTION, where, `it and "${other}" would both own the same paths`);
      }
    }
    takenPrefixes.push(collection.prefix);
  }

  // A mark for the sidebar is a Lucide name or path data and nothing else —
  // the same two regexes the registry holds it to (collections.go).
  if (collection.icon !== undefined) {
    const said = String(collection.icon);
    if (!/^lucide:[a-z0-9]+(-[a-z0-9]+)*$/.test(said) && !/^path:[MmZzLlHhVvCcSsQqTtAa0-9 .,-]{1,1000}$/.test(said)) {
      fault(E.COLLECTION, where, 'icon is `lucide:<name>` — an icon of Lucide by its name, like lucide:table-2 — or `path:<svg path data>` on a 20×20 grid');
    }
  }

  const entry = catalogue.blocks.find((block) => block.type === collection.type);
  if (entry === undefined) {
    // The collection's fault rather than the entry type's, which is the
    // division the server draws too: ENTRY_TYPE is about a block that exists
    // and cannot hold entries, and there is no block here at all.
    fault(E.COLLECTION, where, `its entries are "${collection.type}", and BLOCKS has no such type`);
    continue;
  }

  const field = (key) => entry.fields.find((one) => one.key === key);

  const title = field('title');
  if (title === undefined) {
    fault(E.ENTRY_TYPE, where, `${collection.type} declares no "title" — an entry is listed, linked to and put in a search result by its title`);
  } else if (title.required !== true) {
    fault(E.ENTRY_TYPE, where, `${collection.type}.title must be required`);
  }

  for (const [key, kind] of Object.entries(entryKinds)) {
    const declaredField = field(key);
    if (declaredField !== undefined && declaredField.kind !== kind) {
      fault(E.ENTRY_TYPE, where, `${collection.type}.${key} is "${declaredField.kind}" — on a collection's entries "${key}" is reserved for "${kind}"`);
    }
  }

  const cover = field('cover');
  if (cover !== undefined && cover.multiple === true) {
    fault(E.ENTRY_TYPE, where, `${collection.type}.cover cannot be multiple — one entry, one picture that stands for it`);
  }

  const by = collection.order?.by;
  if (by !== undefined && by !== '' && by !== 'manual') {
    const ordering = field(by);
    if (ordering === undefined) {
      fault(E.ORDER, where, `ordered by "${by}", which ${collection.type} does not declare`);
    } else if (ordering.required !== true) {
      fault(E.ORDER, where, `ordered by ${collection.type}.${by}, so that field must be required`);
    } else if (ordering.kind !== 'date' && ordering.kind !== 'number') {
      fault(E.ORDER, where, `ordered by ${collection.type}.${by}, which is "${ordering.kind}" — order by a date or a number, or arrange them by hand ("manual")`);
    }
  }

  const perPage = collection.per_page ?? 0;
  if (!Number.isInteger(perPage) || perPage < 0 || perPage > 200) {
    fault(E.COLLECTION, where, 'per_page must be between 1 and 200, or absent for one page');
  }

  /*
   * What a post may hold, and the one type it must.
   *
   * A post is a sequence: its opening prose, then runs of prose and whatever
   * else is named here, in the order the owner put them in. Without `text` in
   * the list the writing cannot be broken by anything — a gallery could only
   * ever go after the whole of it, which is the arrangement this replaced.
   */
  const body = collection.body ?? [];
  if (body.length > 0 && !body.includes('text')) {
    fault(
      E.COLLECTION,
      where,
      'body does not name "text", so a post could only ever hold a gallery after the whole ' +
        'of its writing — see COLLECTIONS[].body',
    );
  }
  for (const kind of body) {
    if (!seenTypes.has(kind)) {
      fault(E.COLLECTION, where, `body names "${kind}", and BLOCKS has no such type`);
    }
    if (kind === collection.type) {
      fault(E.COLLECTION, where, `body names "${kind}", which is what an entry *is* — a post cannot hold itself`);
    }
  }
}

/*
 * ── can the platform serve this at all ─────────────────────────────────────
 *
 * A site is served two ways and the difference is a path. On its own host it is
 * at the root, so `/preise/` and `/favicon.png` mean what they say. In the
 * studio's preview the same build is served under
 * `https://preview…/p/<slug>/`, where the root is not the site: every one of
 * those addresses leaves it, and what the client is shown is a page with no
 * stylesheet, no pictures and navigation that 404s.
 *
 * It reads as a broken build rather than as a wrong prefix, which is why it is
 * checked here rather than written down anywhere: it has cost three separate
 * afternoons, and the third one was a site the kit had already been used to
 * build. Two things are needed and neither is visible in a browser at
 * `localhost:4321`, where the base is `/` and everything works.
 *
 * ── and these three carry no JTK_E_ code, on purpose ────────────────────────
 *
 * The judge has no opinion about any of it, correctly. Where a build is served
 * from is the studio's arrangement — our preview, our prefix — and not something
 * the catalogue format says anything about; a stranger's repository could get
 * every one of these "wrong" and still be a repository the platform can build.
 * Giving them a `JTK_E_…` would put a name in the terminal that the platform's
 * own reference has no row for, and `--judge` would then read the server's
 * silence about them as a false refusal. They are marked LOCAL instead.
 */

const configPath = join(root, 'astro.config.mjs');
if (existsSync(configPath)) {
  const config = readFileSync(configPath, 'utf8');
  if (!/\bbase\s*:/.test(config)) {
    fault(
      LOCAL,
      'astro.config.mjs',
      'sets no `base`, so this build can only be served at the root of a host — ' +
        "the studio's preview serves it under /p/<slug>/, where every asset it emits is a 404. " +
        'Derive it from the site URL: `const BASE = new URL(SITE).pathname` and `base: BASE`',
    );
  } else if (!/new URL\(\s*SITE\s*\)\.pathname/.test(config) && !/BASE_URL/.test(config)) {
    fault(
      LOCAL,
      'astro.config.mjs',
      'sets `base` from something other than the site URL — the two are one ' +
        'decision, and setting one and forgetting the other is the failure this check exists for',
    );
  }
}

/*
 * And the addresses a person typed.
 *
 * `base` fixes what Astro emits — the bundled CSS, the optimised images — and
 * it cannot fix a string. `href="/preise/"` is a link out of the preview and
 * `href="/favicon.png"` is a 404, in a build where everything Astro made is
 * right. src/lib/under.ts is the one way to write these.
 *
 * `/api/…` is exempt: a form posts to the host it is served from, which is the
 * real site in production and is not part of the build.
 */
const absolute = /(?:href|src|poster|action|content)\s*=\s*"(\/(?!\/)[^"#]*)"/g;
const cssAbsolute = /url\(\s*['"]?(\/(?!\/)[^)'"]*)/g;

function sourceFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    // Whatever a generator writes a page in: the check is for an address a
    // person typed, and those are typed in any of these.
    if (/\.(astro|ts|tsx|js|jsx|mjs|vue|svelte|html|njk|liquid|hbs|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}

for (const file of sourceFiles(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  const where = relative(root, file);
  const seen = new Set();

  for (const [, address] of [...text.matchAll(absolute), ...text.matchAll(cssAbsolute)]) {
    if (address.startsWith('/api/')) continue;
    if (seen.has(address)) continue;
    seen.add(address);
    fault(
      LOCAL,
      where,
      `"${address}" is written from the root, so it leaves the site wherever the site ` +
        "is not at the root — which is the studio's preview, always. Write it as " +
        `under('${address}') — see src/lib/under.ts`,
    );
  }
}

/*
 * ── the exam ────────────────────────────────────────────────────────────────
 *
 * wiki/35 §5 settles which of the two validators is right: the Go one is the
 * judge, and this one sits its exam. Everything below is that sitting — post the
 * catalogue we just built to `POST /v1/registry/validate`, and compare the two
 * verdicts.
 *
 * The comparison is over **codes**, not over findings. Both sides say where a
 * fault is and they say it in different dialects — `hero.title` here against
 * `blocks[0].fields[2]` there — so matching on paths would report a divergence
 * every time the two agreed perfectly, which is the fastest way to teach
 * somebody to ignore a check. What may not differ is the verdict: a code the
 * judge raised and we did not means this file is behind, and a code we raised
 * and it did not means this file refuses a catalogue the platform would accept.
 * Both are gaps and both are ours to close.
 */

/** The credential, presented the way the admin API reads it. */
/**
 * The working tree's other jtk/ files, sent beside the catalogue so the
 * second judge — the settings, the entries, a price table's gaps, an add-on
 * nobody can take — answers in the same call, before any push (core
 * wiki/71 · §3.2). Everything under jtk/ but the catalogue itself, as
 * `{path, text}`; a site with no jtk/ yet sends none.
 * @param {string} root
 * @returns {{ path: string, text: string }[]}
 */
export function filesBeside(root) {
  const dir = join(root, 'jtk');
  if (!existsSync(dir)) return [];
  /** @type {{ path: string, text: string }[]} */
  const out = [];
  const walk = (/** @type {string} */ at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.json')) continue;
      const rel = relative(root, full).split(sep).join('/');
      if (rel === 'jtk/catalogue.json') continue;
      out.push({ path: rel, text: readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function judgeRequest(text, files) {
  const api = (process.env.JTK_API ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.JTK_TOKEN ?? '').trim();
  return {
    url: `${api}/v1/registry/validate`,
    init: {
      method: 'POST',
      headers: {
        // Two credentials, and the API reads each in its own place
        // (auth/authHandler.go): an agent's `jtk_…` token as a bearer, a
        // person's signed-in session as the `sid` cookie. This said once that
        // there were no bearer tokens in the app, which stopped being true
        // when agents got theirs (wiki/40); a `jtk_…` token sent as a cookie
        // is not read at all.
        ...(token.startsWith('jtk_') ? { authorization: `Bearer ${token}` } : { cookie: `sid=${token}` }),
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(files.length > 0 ? { catalogue: text, files } : { catalogue: text }),
    },
  };
}

/**
 * Ask the judge, and report where the two of us disagree.
 *
 * Returns the number of divergences, so the caller can make them an exit code.
 * Not reaching the judge at all returns zero on purpose: "the network is down"
 * and "your catalogue is wrong" are different facts, and a check that conflates
 * them is a check somebody disables on a train.
 */
async function sitTheExam(text, ours) {
  if (!process.env.JTK_API || !process.env.JTK_TOKEN) {
    // Loudly rather than quietly. A --judge that shrugs when it is not
    // configured is a --judge that has been passing for a month in somebody's
    // script while sitting no exam at all.
    console.error(`
jtk catalogue: --judge needs somewhere to ask and something to ask with.

  export JTK_API=https://…        the admin API (http://localhost:4000 locally)
  export JTK_TOKEN=…              an agent's jtk_… token, or a signed-in session

An agent's access token (\`jtk_…\`, from connecting it to the MCP server) is sent
as a bearer; anything else is taken for the \`sid\` cookie of a person signed in
to the admin. The MCP server itself reads neither variable — it is hosted, and
an agent connects to it through the browser.

An agent with the MCP server needs neither: \`validate_catalogue\` with the
catalogue and the jtk/ files beside it judges the whole working tree — this
catalogue, the settings, the content — before any push, every finding at once.`);
    process.exit(1);
  }

  const files = filesBeside(root);
  const { url, init } = judgeRequest(text, files);

  let response;
  try {
    response = await fetch(url, init);
  } catch (why) {
    console.error(`\njtk catalogue: could not reach the judge at ${url} — ${why.message}`);
    console.error('The catalogue was not examined. This is not a verdict on it.');
    return 0;
  }

  if (!response.ok) {
    const said = (await response.text()).trim().slice(0, 400);
    console.error(`\njtk catalogue: could not reach the judge — ${url} answered ${response.status}`);
    console.error(`  ${said || '(nothing)'}`);
    console.error(
      response.status === 401 || response.status === 403
        ? (process.env.JTK_TOKEN ?? '').trim().startsWith('jtk_')
          ? "An agent's access token lasts an hour; its client renews it. Put a current one in JTK_TOKEN — or push and ask validate_catalogue over MCP, which needs none."
          : 'A session expires. Sign in to the admin again and re-read the `sid` cookie into JTK_TOKEN.'
        : 'The catalogue was not examined. This is not a verdict on it.',
    );
    return 0;
  }

  let verdict;
  try {
    verdict = await response.json();
  } catch (why) {
    console.error(`\njtk catalogue: could not reach the judge — ${url} answered with something that is not JSON`);
    console.error(`  ${why.message}`);
    return 0;
  }

  const all = verdict.findings ?? [];
  // The files' findings — the settings, an entry, a price table — are the
  // judge's alone, about files this checker never reads: printed as what
  // they are, and not examined. The catalogue's own are the exam.
  const ofFiles = all.filter((one) => /^jtk\//.test(one.path ?? ''));
  const findings = all.filter((one) => !ofFiles.includes(one));
  for (const one of ofFiles) {
    console.error(`  ✗ ${one.code}  ${one.path}: ${one.says}`);
  }
  if (ofFiles.length > 0) {
    console.error(`  ${ofFiles.length} finding(s) in the files beside the catalogue (${files.length} sent) — refused at import until fixed.\n`);
  }
  // Advice is the judge's alone — rules about the bookings module it runs,
  // which this checker has no copy of — so it is printed and not examined.
  const advice = [...(verdict.advice ?? []), ...findings.filter((one) => isAdvice(one.code))];
  for (const one of advice) {
    console.log(`  ~ ${one.code}  ${one.path || '(the file)'}: ${one.says}`);
  }
  if (advice.length > 0) {
    console.log(
      `  ${advice.length} piece(s) of advice from the judge — allowed, and unwise. Act on them before the first build.\n`,
    );
  }
  const theirs = new Set(findings.filter((one) => !isAdvice(one.code)).map((one) => one.code));
  // LOCAL findings are left out entirely: the server has no rule about the
  // studio's preview, so its silence about them is the right answer rather than
  // a gap. See lib/codes.mjs.
  const mine = new Set(ours.filter((one) => isPlatformCode(one.code)).map((one) => one.code));

  const missed = [...theirs].filter((code) => !mine.has(code)).sort();
  const invented = [...mine].filter((code) => !theirs.has(code)).sort();

  if (missed.length === 0 && invented.length === 0) {
    console.log(
      `judged by ${url} — contract ${verdict.contract}, ${findings.length} finding(s) in the catalogue, ` +
        `${ofFiles.length} in the ${files.length} file(s) beside it, and this checker said the same of the catalogue`,
    );
    return ofFiles.length;
  }

  console.error(`\njtk catalogue: the judge and this checker do not agree (contract ${verdict.contract})\n`);

  for (const code of missed) {
    console.error(`  ← ${code}  the judge raised this and we did not — this checker is behind`);
    for (const one of findings.filter((f) => f.code === code)) {
      console.error(`      ${one.path || '(the file)'}: ${one.says}`);
    }
  }
  for (const code of invented) {
    console.error(`  → ${code}  we raised this and the judge did not — a catalogue refused for nothing`);
    for (const one of ours.filter((f) => f.code === code)) {
      console.error(`      ${one.where}: ${one.says}`);
    }
  }

  console.error(`
The Go validator in the admin's registry package is the judge (wiki/35 §5); the
checks in this file are a copy that has to work offline. A divergence is this
file's bug, not the server's — bring the check here into line, or add the one it
is missing, and note it in the platform's 12 · debt if the contract is what
moved.`);

  return missed.length + invented.length;
}

// --- the report, and then the judge -----------------------------------------
//
// The catalogue is serialised before either, because `--judge` sends the text
// and has to be able to send a catalogue this file refuses: the interesting exam
// question is not only "what did the server catch that we missed" but "what did
// we refuse that the server was happy with", and there is no way to ask the
// second one about a file we declined to produce.
//
// Serialised, not written. What goes on disk still goes there only when the
// checks pass — a `jtk/catalogue.json` that this tool has said is unusable is a
// file somebody would otherwise commit.

const catalogueText = JSON.stringify(catalogue, null, 2) + '\n';

if (problems.length) {
  console.error('jtk catalogue: this catalogue is not one the admin will accept\n');
  for (const problem of problems) {
    console.error(`  ✗ ${problem.code}  ${problem.where}: ${problem.says}`);
  }
  console.error(`
A JTK_E_… code is the platform's own name for that fault: the same one the admin
returns from POST /v1/registry/validate, and the anchor it has in the generated
docs/reference/errors.md. ${LOCAL} is this skill's own — the studio's preview
arrangement, which the catalogue format has nothing to say about.`);
}

const divergences = has('judge') ? await sitTheExam(catalogueText, problems) : 0;

if (problems.length) process.exit(Math.min(problems.length, 100));

// --- write it ---------------------------------------------------------------

const out = join(root, 'jtk', 'catalogue.json');
mkdirSync(join(root, 'jtk'), { recursive: true });
writeFileSync(out, catalogueText);

const fieldCount = catalogue.blocks.reduce((n, b) => n + (b.fields?.length ?? 0), 0);
console.log(`jtk/catalogue.json — ${catalogue.blocks.length} block type(s), ${fieldCount} field(s)`);

// --- and seed each module's settings, once --------------------------------
//
// A module the catalogue turns on has a settings document, `jtk/<module>.json`,
// and the platform reads it in exactly one shape: a document of one block, of
// the module's own config type — `bookings_config` — with the settings as that
// block's fields. It is what a publish writes back, and what `import_branch`
// reads into the diary so a demo takes bookings before anybody opens the panel.
//
// The first shop an agent built wrote the settings as top-level keys instead,
// and the platform imported an empty diary out of it. It refuses that shape now
// (JTK_E_MODULE_FILE_INVALID), and this is the other half: the skeleton is
// written here, in the right shape, so that "seed it" is filling in fields
// rather than guessing a document. Written only when the file is absent — the
// file is the owner's the moment a publish has touched it, and a tool that
// rewrote it would be a second author of the diary.
for (const module of Object.keys(modules)) {
  const settings = join(root, 'jtk', `${module}.json`);
  if (existsSync(settings)) continue;
  writeFileSync(settings, JSON.stringify({ blocks: [{ type: `${module}_config`, v: 1 }] }, null, 2) + '\n');
  console.log(`jtk/${module}.json — seeded with an empty ${module}_config block: fill in its fields (the platform's modules reference lists them) and commit it`);
}

// A divergence is a failure of this script and not of the site, so the site
// keeps its catalogue: the file is written, and then the run goes red. Holding
// the emit back would make a bug in our copy of the rules look like a broken
// project, which is exactly the confusion the codes are here to end.
if (divergences > 0) process.exit(Math.min(divergences, 100));

if (has('emit-only')) process.exit(0);

// --- and prove it matches the page ------------------------------------------

let dist = flag('dist');
if (!dist) {
  console.log('building, to check the catalogue against what the page actually renders…');
  try {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  } catch {
    /*
     * The one build failure worth explaining, because the message Astro gives
     * is true and useless.
     *
     * A picture inside an entry's body is markdown pointing at a media key, and
     * Astro resolves a markdown image relative to the markdown file — so the
     * build wants a real file beside the entry, and on a laptop there is none.
     * The studio's build downloads them there before it builds; a clone has
     * never downloaded anything.
     *
     * `ImageNotFound` on a path under jtk/content/ is always this, and it
     * is a stop rather than a bug in the site.
     */
    // Not `contentDir`: that is declared further down and would be a
    // ReferenceError from here. The function is hoisted; the const is not.
    if (hasEntries(join(root, 'jtk', 'content'))) {
      console.error(`
     If that failed with ImageNotFound on a media/… path, this is why:
     a picture in an entry's body is a real file beside the entry, and a clone
     has not downloaded any. The studio's build fetches them before it builds.
     Ask the studio for this site's media, or check the catalogue against a
     build made there:  jtk catalogue --dist ./dist`);
    }
    die('the site does not build, so there is nothing to check the catalogue against');
  }
  dist = join(root, 'dist');
}
dist = resolve(dist);

if (!existsSync(dist)) die(`no build at ${dist}`);

/**
 * Every data-jtk-path in the build, **per page**.
 *
 * Per page, and that word is the whole fix. It used to be one set for the whole
 * site, which works exactly as long as a site has one page: two pages both
 * carrying `blocks[0].title` are one string in a set, so the first one to be
 * accounted for deleted it and the second was reported as declared and not
 * rendered. A multi-page site could not pass this check, and a site with a
 * collection is a multi-page site by definition.
 */
function annotated(dir) {
  const byPage = new Map();

  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith('.html')) continue;

      const html = readFileSync(full, 'utf8');
      const found = new Set();
      for (const match of html.matchAll(/data-jtk-path="([^"]+)"/g)) found.add(match[1]);
      byPage.set(pageOfFile(full), found);
    }
  };

  walk(dir);
  return byPage;
}

/** dist/blog/doglyad/index.html is the page at /blog/doglyad. */
function pageOfFile(file) {
  const at = '/' + relative(dist, file).split(sep).join('/');
  return at.replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';
}

const annotationsByPage = annotated(dist);

/**
 * The same, before anything is taken out of it.
 *
 * The check below consumes those sets: a field matched against the catalogue is
 * deleted, and whatever is left over is text nobody can edit. That makes them
 * useless afterwards for the one question a cross-document path asks — *does
 * the page this claims to belong to actually offer this field* — so a copy is
 * kept. Without it that check reads every set as empty and passes everything,
 * which is a guard that only looks like one.
 */
const offeredByPage = new Map([...annotationsByPage].map(([at, found]) => [at, new Set(found)]));

// What the content document says is on the page, so a declared field can be
// looked for at the index it actually occupies.
//
// At any depth. An entry of a collection is a page like any other and lives
// under the collection's own directory — reading only the top level, which is
// what this did once, meant every entry's annotations came out the far end as
// "on the page and in nobody's catalogue", which is the report for text an
// owner cannot touch. They were the opposite: perfectly editable, and unread.
const contentDir = join(root, 'jtk', 'content');

/** A media key as the admin writes one: the site, then the file's own hash. */
const MEDIA_KEY = /^\.?\/?media\/[0-9a-fA-F-]{36}\/[0-9a-f]{8,64}\.[a-z0-9]{2,5}$/;

/** Every picture in every markdown field of a document, with where it is. */
function* bodyPictures(document) {
  const blocks = document.blocks ?? [];

  for (const [index, block] of blocks.entries()) {
    for (const [key, value] of Object.entries(block ?? {})) {
      if (typeof value !== 'string') continue;
      for (const found of value.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) {
        yield [`blocks[${index}].${key}`, found[1]];
      }
    }
  }
}

/** Whether any block of this document holds markdown with a picture in it. */
function hasBodyPicture(document) {
  return (document.blocks ?? []).some((block) =>
    Object.values(block ?? {}).some((value) => typeof value === 'string' && /!\[[^\]]*\]\(/.test(value)),
  );
}

/**
 * Whether this site has any entries at all, for the one message that mentions
 * them.
 *
 * An entry is a page now — a `.json` document of blocks (the platform's
 * wiki/30) — so what makes one an entry is the `collection` inside it, not the
 * extension. Which also means this check no longer needs the site's own Astro
 * installed to read a body: it used to parse frontmatter with it, and that is
 * gone with the format.
 */
function hasEntries(dir) {
  if (!existsSync(dir)) return false;

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'media' && hasEntries(full)) return true;
      continue;
    }
    if (!name.endsWith('.json')) continue;
    try {
      if (typeof JSON.parse(readFileSync(full, 'utf8')).collection === 'string') return true;
    } catch {
      // Unreadable JSON is somebody else's error to report, and it is reported
      // where the file is actually read.
    }
  }
  return false;
}

/**
 * Every content document under a collection or beside one, at any depth.
 *
 * One shape to read: an entry is a page now — a `.json` document of blocks —
 * so the branch that parsed markdown frontmatter is gone with the format.
 */
function contentPages(dir) {
  if (!existsSync(dir)) return [];

  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // A collection's own pictures land here at build time. They are not
      // content and reading them as such would be a stack trace.
      if (name !== 'media') out.push(...contentPages(full));
      continue;
    }
    if (!name.endsWith('.json')) continue;
    const document = JSON.parse(readFileSync(full, 'utf8'));
    // Where it came from, so a picture in a body can be resolved the way the
    // build resolves it: relative to the file that holds the markdown.
    Object.defineProperty(document, 'file', { value: full, enumerable: false });
    out.push(document);
  }
  return out;
}

/** Every stylesheet under src, as one string. Crude on purpose: the question is
 *  only whether a name appears at all. */
function readStyles(dir) {
  if (!existsSync(dir)) return '';

  let found = '';
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found += readStyles(full);
      continue;
    }
    // Astro components carry their styles inside them, which is where a site is
    // as likely to have put these as in a stylesheet.
    if (/\.(css|astro)$/.test(name)) found += readFileSync(full, 'utf8');
  }
  return found;
}

const pages = contentPages(contentDir);

/*
 * Every localised document lives at its own address with the language in front.
 *
 * ── the check that replaced a declaration ───────────────────────────────────
 *
 * Pages used to pair by a `group` key both documents carried, which let each
 * language have its own words. That is a second source of truth for something
 * the addresses already say, and one nobody can check: `group: "work"` on one
 * page against `group: "works"` on the other is two unrelated pages, no error
 * anywhere, and a site that has quietly lost its hreflang.
 *
 * The rule now is the address itself, and this is where a repository that has
 * not caught up is told so — before the push, rather than by the import.
 */
/*
 * ── the content's own problems, reported separately and on purpose ──────────
 *
 * `problems` above is about the catalogue, and it is reported and exited at the
 * point the catalogue is finished — long before the content is read. Two checks
 * were pushed into it from down here and were therefore never printed at all:
 * dead code that looked like a guard. This is the second list, reported where
 * the content it is about has actually been read.
 */
const contentProblems = [];

/*
 * A body with pictures in it needs the two class names that draw them.
 *
 * `figures.mjs` turns a paragraph of images into `.fl-figure` and `.fl-row`,
 * and the kit ships styles for both in `src/styles/global.css`. A site that
 * deleted them gets pictures at their natural size in document order, which
 * looks like a broken build and is really a missing stylesheet — so it is said
 * here rather than found in a screenshot.
 */
if (pages.some(hasBodyPicture)) {
  const styled = readStyles(join(root, 'src'));
  for (const name of ['fl-figure', 'fl-row']) {
    if (!styled.includes(name)) {
      contentProblems.push(
        `a post has pictures in its body and nothing styles .${name}. ` +
          `figures.mjs makes them out of plain markdown; the kit ships both in src/styles/global.css. ` +
          `Restyle them — do not invent a third.`,
      );
    }
  }
}

/*
 * A view that says where it can be seen points at a page that exists.
 *
 * The admin frames that page at the block and shows it in the menu, so an
 * arrangement whose sample is a typo is an arrangement offered as a blank
 * rectangle — and the person choosing has no way to know the difference between
 * "this looks like nothing" and "this could not be found".
 */
const addresses = new Set(pages.map((page) => page.path));
for (const block of catalogue.blocks) {
  for (const view of block.views ?? []) {
    if (view.sample !== undefined && !addresses.has(view.sample)) {
      contentProblems.push(
        `${block.type}.views.${view.key}: sample is ${JSON.stringify(view.sample)}, and this site has no ` +
          'such page. The admin shows that page in the menu, so a sample nobody can fetch is a blank rectangle.',
      );
    }
  }
}

for (const document of pages) {
  const where = document.path ?? '(a document with no path)';

  if ((document.group ?? '') !== '') {
    contentProblems.push(
      `${where}: \`group\` is no longer read. A page's address is the same in every language, ` +
        `with the language in front of it — /prices and /${locales[0] ?? 'de'}/prices — so the pairing ` +
        `is the address. Remove the key, and make the addresses match if they differ by more than the language.`,
    );
  }

  const locale = document.locale ?? '';
  if (locale === '') continue;

  // Compared by language rather than by spelling: a page written `de-ch` and a
  // LOCALES entry of `de-CH` are one language, and telling somebody their site
  // does not list a language it plainly lists is the unhelpful half of being
  // strict. The address below is still checked against what the page itself
  // says, because a URL is not a language tag and is not ours to re-case.
  const canonical = canonicalLocale(locale);
  if (!locales.some((one) => canonicalLocale(one) === canonical)) {
    contentProblems.push(`${where}: written in ${JSON.stringify(locale)}, which LOCALES does not list`);
    continue;
  }
  if (document.path !== `/${locale}` && !String(document.path ?? '').startsWith(`/${locale}/`)) {
    contentProblems.push(
      `${where}: written in ${locale} and not under /${locale}. A page's address is the same in ` +
        `every language, with the language in front of it.`,
    );
  }
}

/*
 * Every picture a body points at is a picture that exists.
 *
 * ── the failure this replaces ───────────────────────────────────────────────
 *
 * A body is markdown and its images are resolved by the build the way markdown
 * images always are: relative to the file. A path to nothing fails inside
 * Vite's resolver with `ImageNotFound` and a stack trace through four
 * packages, after a clone, an install and a content sync — which is a long way
 * to travel to be told a filename is wrong.
 *
 * Two kinds are legitimate and this knows both:
 *
 *   ./media/<site>/<hash>.jpg          an upload; the build downloads it here
 *   ../../../src/assets/healed.jpg     a photograph this repository ships
 *
 * An upload is not on disk in a clone and never can be, so it is taken on
 * trust — the download either finds it or says so in its own step. Anything
 * else has to be a file, now.
 */
for (const document of pages) {
  for (const [where, src] of bodyPictures(document)) {
    if (MEDIA_KEY.test(src)) continue;

    const from = document.file ? dirname(document.file) : contentDir;
    if (!existsSync(resolve(from, src))) {
      contentProblems.push(
        `${document.path ?? where}: ${where} points at ${JSON.stringify(src)} and there is no such file. ` +
          `A picture in a body is either an upload (./media/<site>/<hash>.jpg, which the build downloads ` +
          `beside the entry) or a path relative to this file — ../../../src/assets/<name>.jpg for a ` +
          `photograph the repository ships.`,
      );
    }
  }
}

if (contentProblems.length) {
  console.error('\njtk catalogue: the content does not follow the rules the admin reads it by\n');
  for (const problem of contentProblems) console.error(`  ✗ ${problem}`);
  process.exit(Math.min(contentProblems.length, 100));
}

/*
 * The text that is on every page.
 *
 * Beside the pages and not among them: it has no address, so there is no built
 * file to check it against — its fields are annotated on whichever pages render
 * them, with the `shared:` prefix that says which document they mean.
 */
const sharedFile = join(root, 'jtk', 'shared.json');
const sharedBlocks = existsSync(sharedFile)
  ? (JSON.parse(readFileSync(sharedFile, 'utf8')).blocks ?? [])
  : [];

const byType = new Map(catalogue.blocks.map((block) => [block.type, block]));
const disagreements = [];

/** `/de/services/x` without its language: `/services/x`. The site's own language has no prefix. */
function basePathOf(path, locales) {
  for (const locale of locales) {
    if (path === `/${locale}` || path === `/${locale}/`) return '/';
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}

for (const page of pages) {
  const onThePage = annotationsByPage.get(page.path);
  if (onThePage === undefined) {
    // A collection with `pages: false` builds no page for its entries: they
    // are read by the page that lists them and by the diary.
    // Said by the entry's own collection, or by its address — with the
    // language in front of it for an entry in another one: `/de/services/x`
    // is the `services` collection's as much as `/services/x` is (wiki/75 of
    // the platform; a German salon's eight services were each reported as a
    // page the build did not produce, 10 October 2026).
    const bare = basePathOf(page.path, catalogue.locales ?? []);
    const listedOnly = collections.some(
      (c) => c.pages === false && (page.collection === c.name || bare.startsWith(`${c.prefix}/`)),
    );
    if (listedOnly) {
      /*
       * No page of its own, so its fields are annotated on the listing as
       * `page:<address>:<field>` — and the platform's lint fails a build
       * where one is not. This used to `continue` here and let the platform
       * say it a build later; it is said here now, the same way.
       */
      // Every page's annotations, as one set of strings. Each page's are a Set,
      // and `.flat()` does not open a Set: this held Sets, `has` of a string
      // was false for every field, and every entry of every `pages: false`
      // collection was reported as annotated nowhere (reported by an agent's
      // rehearsal, 30 September 2026 — thirteen false findings on a restaurant).
      const everywhere = new Set([...annotationsByPage.values()].flatMap((found) => [...found]));
      (page.blocks ?? []).forEach((block, at) => {
        const type = byType.get(block.type);
        if (!type) return;
        for (const field of type.fields ?? []) {
          const value = block[field.key];
          const empty = value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0);
          if (empty || field.no_tap_target || field.kind === 'bool' || (field.kind === 'media' && field.multiple)) continue;
          if (!everywhere.has(`page:${page.path}:blocks[${at}].${field.key}`)) {
            disagreements.push(
              `${page.path}: blocks[${at}].${field.key} is on no page — an entry without a page of its own is annotated on its listing as page:${page.path}:blocks[${at}].${field.key}`,
            );
          }
        }
      });
      continue;
    }
    disagreements.push(`${page.path} is in the content and the build did not produce it`);
    continue;
  }

  (page.blocks ?? []).forEach((block, at) => {
    const type = byType.get(block.type);
    if (!type) {
      disagreements.push(`${block.type} is in the content and not in the catalogue`);
      return;
    }

    for (const field of type.fields ?? []) {
      // Only a field this page actually filled in: an empty one renders
      // nothing, correctly, and is not evidence of anything.
      const value = block[field.key];
      const empty = value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (empty || field.no_tap_target || field.kind === 'bool') continue;

      const path = `blocks[${at}].${field.key}`;

      /*
       * A gallery: one field, many pictures, and each picture is its own tap
       * target at `blocks[3].work[7].src`. The container is not one — tapping a
       * wall of thirty-seven and being asked to edit "the wall" is not an edit
       * anybody means to make — and neither are the words beside a picture,
       * which are edited in the panel and never appear as an element.
       *
       * `src`, `alt` and `poster` are the item's whole vocabulary. They are not
       * declared per site: the admin synthesises them from this field, so a
       * site naming them differently would be a site the editor cannot follow.
       */
      if (field.kind === 'media' && field.multiple) {
        const items = Array.isArray(value) ? value : [];
        items.forEach((item, i) => {
          if (item === null || typeof item !== 'object') return;
          const itemPath = `blocks[${at}].${field.key}[${i}]`;

          if (item.src && !field.no_tap_target) {
            if (!onThePage.has(`${itemPath}.src`)) {
              disagreements.push(`${itemPath}.src is declared and the page does not render it`);
            }
          }
          // Annotating them is allowed and not asked for, so they are accounted
          // for either way rather than reported as text nobody can touch.
          for (const key of ['src', 'alt', 'poster']) onThePage.delete(`${itemPath}.${key}`);
        });
        continue;
      }

      if (field.kind === 'list') {
        const rows = Array.isArray(value) ? value : [];
        rows.forEach((row, i) => {
          for (const sub of field.of ?? []) {
            if (sub.no_tap_target || !row[sub.key]) continue;
            const rowPath = `blocks[${at}].${field.key}[${i}].${sub.key}`;
            if (!onThePage.has(rowPath)) {
              disagreements.push(`${rowPath} is declared and the page does not render it`);
            }
            onThePage.delete(rowPath);
          }
        });
        continue;
      }

      if (!onThePage.has(path)) {
        disagreements.push(`${path} is declared and the page does not render it`);
      }
      onThePage.delete(path);
    }
  });

  // Whatever is left on this page is in nobody's catalogue: text an owner can
  // see and cannot touch, which is the failure that hides.
  //
  // Except the shared ones — they belong to the site's document, are checked
  // above, and are correct on every page that renders them.
  for (const path of onThePage) {
    if (path.startsWith('shared:')) continue;
    if (path.startsWith('page:')) continue;
    disagreements.push(`${page.path}: ${path} is on the page and not in the catalogue`);
  }
}

/*
 * A tile that names a page nobody has, or a field that page has not got.
 *
 * ── the check a cross-document path needs, and the others do not ────────────
 *
 * Every other annotation is checked from the document outwards: the field is
 * declared, so the page rendering it must say so. A `page:` path goes the other
 * way — a listing says "this heading belongs to /blog/healing" — and what can
 * be wrong is the claim. A mistyped address is a tile the owner taps and
 * nothing opens, which is this whole file's subject arriving through the one
 * door it did not watch.
 */
for (const [where, found] of annotationsByPage) {
  for (const path of found) {
    if (!path.startsWith('page:')) continue;

    const rest = path.slice('page:'.length);
    const ends = rest.indexOf(':');
    const address = ends < 0 ? '' : rest.slice(0, ends);
    const inner = ends < 0 ? '' : rest.slice(ends + 1);

    const there = offeredByPage.get(address);
    if (there === undefined) {
      /*
       * An entry of a collection without pages (`pages: false`) is exactly
       * what a `page:` annotation on a listing is for: the platform's lint
       * requires every filled-in field of such an entry to be annotated as
       * `page:<its address>:<field>` on the page that lists it. This check
       * refused those as "no such page" — the kit forbidding what the
       * platform demanded, and collections.md advising it in between. The
       * address is checked against the content instead, and the field
       * against the entry's own type.
       */
      const entry = pages.find((one) => one.path === address);
      // By the entry's collection, or its address without the language.
      const listedOnly = entry !== undefined && collections.some(
        (c) => c.pages === false && (entry.collection === c.name || basePathOf(address, catalogue.locales ?? []).startsWith(`${c.prefix}/`)),
      );
      if (listedOnly) {
        const m = /^blocks\[(\d+)\]\.([A-Za-z0-9_]+)/.exec(inner);
        const block = m ? (entry.blocks ?? [])[Number(m[1])] : undefined;
        const type = block ? byType.get(block.type) : undefined;
        if (!type || !(type.fields ?? []).some((f) => f.key === m[2])) {
          disagreements.push(`${where}: annotates page:${address}:${inner} and that entry has no such field`);
        }
        continue;
      }
      disagreements.push(`${where}: annotates page:${address}: and this site built no such page`);
      continue;
    }

    /*
     * Checked against what that page itself annotates rather than against a
     * second walk of its document. The two would eventually disagree, and the
     * page's own annotations are already held to the catalogue a few lines up
     * — so this asks a question that cannot drift: does the page whose field
     * this claims to be actually offer that field?
     */
    if (!there.has(inner)) {
      disagreements.push(
        `${where}: annotates ${inner} on ${address}, which that page does not offer`,
      );
    }
  }
}

/*
 * Every shared field has to be rendered somewhere, and every `shared:` path on
 * the page has to be a field.
 *
 * The rule is not the pages' rule and cannot be: a shared field is on many
 * pages and in none of their documents. What can be checked is the thing that
 * actually breaks — a field the whole site annotates nowhere is a control that
 * edits nothing, and an annotation for a field the shared document does not
 * have is text the owner cannot touch.
 */
const sharedOnThePage = new Set();
for (const found of annotationsByPage.values()) {
  for (const path of found) {
    if (path.startsWith('shared:')) sharedOnThePage.add(path);
  }
}

sharedBlocks.forEach((block, at) => {
  const type = byType.get(block.type);
  if (!type) {
    disagreements.push(`shared: ${block.type} is in the shared document and not in the catalogue`);
    return;
  }

  for (const field of type.fields ?? []) {
    const value = block[field.key];
    const empty = value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty || field.no_tap_target || field.kind === 'bool') continue;

    const path = `shared:blocks[${at}].${field.key}`;
    if (field.kind === 'list') {
      // A list is annotated by its rows, `shared:blocks[0].links[2].label`,
      // never by the container: the rows are what a person taps.
      const rows = Array.isArray(value) ? value : [];
      rows.forEach((row, i) => {
        const rowPath = `${path}[${i}]`;
        const under = [...sharedOnThePage].filter((p) => p === rowPath || p.startsWith(`${rowPath}.`));
        if (under.length === 0) {
          disagreements.push(`${rowPath} is declared and no page renders it`);
        }
        for (const p of under) sharedOnThePage.delete(p);
      });
      continue;
    }
    if (!sharedOnThePage.has(path)) {
      disagreements.push(`${path} is declared and no page renders it`);
    }
    sharedOnThePage.delete(path);
  }
});

for (const path of sharedOnThePage) {
  disagreements.push(`${path} is on the page and the shared document does not have it`);
}

// A built page with no content document of its own is skipped rather than
// reported: a listing is rendered from other pages' entries and has no document
// to check against. What it must not carry is an annotation — a tap there would
// send a path the admin resolves against the wrong document — and that is what
// the loop above would have said if the page had one.
for (const [at, found] of annotationsByPage) {
  if (pages.some((page) => page.path === at)) continue;
  /*
   * A specimen is annotated on purpose and has no document by design.
   *
   * `entryLoader.ts` builds one page per arrangement so the admin can lift this
   * site's own markup for a block that has just been added — annotations and
   * all, because the paths are half of what is lifted. Nothing is behind it and
   * nothing is meant to be: it is generated from the declaration at build time.
   * Named by `specimenId`, which is the one format the two sides agree on.
   */
  if (at.split('/').some((part) => part.startsWith('_fl-'))) continue;
  // A shared field is correct here: it says which document it belongs to, and
  // it is not this one. So is `page:<address>:…` — an entry with no page of its
  // own, annotated on its listing, which is exactly what the check on
  // `pages: false` collections above asks for; reporting it here as well told
  // the same site to do a thing and not to (30 September 2026).
  const ownPage = [...found].filter((path) => !path.startsWith('shared:') && !path.startsWith('page:'));
  if (ownPage.length === 0) continue;
  disagreements.push(`${at}: has annotations and no content document — ${ownPage.sort()[0]} would open the wrong page`);
}

/*
 * ── and prove it survives being served under a prefix ──────────────────────
 *
 * The source check above catches an address somebody typed. It cannot catch one
 * that arrives as data — a nav list of `{ label, href }`, rendered with
 * `href={item.href}` — and that is how the failure actually shipped: a site with
 * every link in one file, none of them under the base, and a preview where the
 * front page is right and every other page leaves the site.
 *
 * So the build is done a second time with a path in SITE_URL, into a directory
 * that is thrown away, and every address it emitted is held to that path. It is
 * the only proof that does not depend on how the site is written: whatever the
 * link went through, this is what came out. About five seconds on a whole site.
 */
// Astro's build takes `--outDir`, which is what lets this run into a directory
// that is thrown away. Another generator is asked with `--dist`: build it once
// yourself with a path in SITE_URL and point this at the result — which is the
// same proof, made by hand.
if (!flag('dist') && !existsSync(join(root, 'astro.config.mjs'))) {
  console.log('not an Astro project: the second build under a path is skipped — build with SITE_URL=https://x.invalid/p/check/ and run again with --dist <dir> to prove the addresses');
}
if (!flag('dist') && existsSync(join(root, 'astro.config.mjs'))) {
  const prefix = '/p/fl-check/';
  const out = join(root, '.fl-prefix-check');

  try {
    execFileSync('npx', ['astro', 'build', '--outDir', out], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, SITE_URL: `https://fl-check.invalid${prefix}`, PUBLIC_INDEXABLE: 'false' },
    });

    const leaks = [];
    const emitted = /(?:href|src|poster|action|content)="(\/(?!\/)[^"#]*)"/g;

    for (const file of builtPages(out)) {
      const page = relative(out, file);
      for (const [, address] of readFileSync(file, 'utf8').matchAll(emitted)) {
        if (address.startsWith(prefix) || address.startsWith('/api/')) continue;
        if (leaks.some((one) => one.address === address)) continue;
        leaks.push({ page, address });
      }
    }

    if (leaks.length > 0) {
      console.error(`\njtk catalogue: built under ${prefix}, and ${leaks.length} address(es) still point at the root\n`);
      for (const leak of leaks.slice(0, 20)) console.error(`  ✗ ${leak.page}: ${leak.address}`);
      if (leaks.length > 20) console.error(`  … and ${leaks.length - 20} more`);
      console.error(`
The studio's preview serves this build under /p/<slug>/. Every address above
leaves the site there: a stylesheet that 404s, a link back to somebody else's
home page. Write them through src/lib/under.ts — including the ones that arrive
as data, which is what this second build is here to catch.`);
      rmSync(out, { recursive: true, force: true });
      process.exit(Math.min(leaks.length, 100));
    }

    console.log(`built again under ${prefix} — every address it emits stays inside the site`);
  } catch (err) {
    // A build that fails only with a prefix is worth saying out loud; a build
    // that fails outright has already been reported above, and this one is
    // running against a directory nobody will deploy.
    if (err?.status !== undefined) {
      console.error('\njtk catalogue: this site does not build when it is served under a path');
      console.error(String(err.stderr ?? '').slice(-2000));
      rmSync(out, { recursive: true, force: true });
      process.exit(1);
    }
  }

  rmSync(out, { recursive: true, force: true });
}

if (disagreements.length) {
  console.error('\njtk catalogue: the catalogue and the page disagree\n');
  for (const one of disagreements.sort()) console.error(`  ✗ ${one}`);
  console.error('\nA field declared and not rendered is a control that edits nothing.');
  console.error('A field rendered and not declared is text the owner cannot touch.');
  process.exit(Math.min(disagreements.length, 100));
}

console.log(`checked against ${dist} — the catalogue and the page agree`);

// --- and what is on the page that nobody can edit --------------------------
//
// The checks above compare the catalogue with the annotations. Neither of them
// can see the failure that is actually most common: a sentence written straight
// into a component, which carries no annotation, is in nobody's catalogue and is
// therefore invisible to both directions of the check.
//
// It is found by tapping, one string at a time, by whoever is looking at the
// site — "I cannot edit the header", "nor the footer", "nor the labels on the
// form", "nor the word above each section" — and every one of those is a
// message and a deploy.
//
// **This used to be a report and is now a gate.** A report made the decision
// optional, and optional is how twenty-six strings on a real site ended up
// belonging to nobody: the navigation, the footer and the labels on the form,
// with a note in the handover saying the line had been drawn deliberately. It
// had not been drawn at all — nothing was written down, so nothing could be
// changed, and the owner found out by wanting to change one.
//
// So every visible sentence must be one of two things, and both are a decision
// somebody made **in the repository**:
//
//   the owner's   →  declared in the catalogue and annotated: `data-jtk-path`
//                    (text on every page goes in the shared document — one
//                    copy, annotated everywhere it is drawn)
//   the design's  →  marked `data-jtk-fixed`, which says "these words are part
//                    of the composition and not the business's to change"
//
// `data-jtk-fixed` is what a skip link, a honeypot's label and a decorative
// caption carry. It silences a subtree, so one attribute on a wrapper covers a
// whole ornament. The edge takes it off the public copy the same way it takes
// `data-jtk-path` off.

/** Text on the page with no annotated element above it. */
function unowned(html) {
  const found = [];
  const stack = [];
  let skipping = null;
  let at = 0;

  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const OPAQUE = new Set(['script', 'style', 'svg', 'head', 'template', 'noscript']);

  while (at < html.length) {
    const open = html.indexOf('<', at);
    if (open === -1) break;

    const text = html.slice(at, open);
    if (skipping === null && stack.length > 0 && !stack.some((frame) => frame.annotated)) {
      const words = text.replace(/\s+/g, ' ').trim();
      /*
       * Anything with letters in it, and that bar is low on purpose.
       *
       * The first version asked for a dozen characters and two words, and it
       * missed exactly the ones somebody was complaining about: `Method`,
       * `Evidence`, `One piece` — the word above each section, six letters
       * each, and as much the business's own as the heading under it. A bullet,
       * a dash and a page number have no letters and fall out anyway.
       */
      if (/\p{L}/u.test(words) && words.length >= 3) {
        found.push({ where: stack[stack.length - 1].tag, words });
      }
    }

    const close = html.indexOf('>', open);
    if (close === -1) break;
    const tag = html.slice(open + 1, close);
    at = close + 1;

    if (tag.startsWith('!') || tag.startsWith('?')) continue;

    if (tag.startsWith('/')) {
      const name = tag.slice(1).trim().toLowerCase();
      if (skipping === name) skipping = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const name = tag.split(/[\s/>]/)[0].toLowerCase();
    if (skipping !== null) continue;
    if (OPAQUE.has(name)) {
      skipping = name;
      continue;
    }
    if (VOID.has(name) || tag.endsWith('/')) continue;

    stack.push({
      tag: name,
      /*
       * Either the owner's or the design's — both are decisions, and what is
       * left is the failure: a sentence nobody has claimed.
       *
       * The `|$` is not a flourish. `tag` is held here with its brackets already
       * stripped, so a boolean attribute written last — which is where a person
       * naturally writes it, `<a class="skip" href="#main" data-jtk-fixed>` — has
       * nothing after it to match. Without the alternative the mark was silently
       * ignored and the sentence reported as belonging to nobody. It passed on
       * the two sites it was tried on only because Astro appends its own
       * `data-astro-cid-…` to elements in a component that has styles; the first
       * element without one failed, and was worked around locally rather than
       * reported as a bug for a day.
       *
       * The lookahead itself stays, so `data-jtk-fixedly` is still not a mark.
       */
      annotated: /\sdata-jtk-path=/.test(tag) || /\sdata-jtk-fixed(?=[\s/>=]|$)/.test(tag),
    });
  }

  return found;
}

/** Every built page, as files. `pages` above is the content, not the build. */
function builtPages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...builtPages(full));
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

const loose = [];
for (const file of builtPages(dist)) {
  for (const one of unowned(readFileSync(file, 'utf8'))) {
    if (!loose.some((seen) => seen.words === one.words)) loose.push(one);
  }
}

if (loose.length > 0) {
  console.error(`\njtk catalogue: ${loose.length} sentence(s) on the page belong to nobody\n`);
  for (const one of loose.slice(0, 30)) {
    const words = one.words.length > 70 ? one.words.slice(0, 67) + '…' : one.words;
    console.error(`  ✗ <${one.where}>  ${words}`);
  }
  if (loose.length > 30) console.error(`  … and ${loose.length - 30} more`);

  console.error(`
Each one is either the owner's or the design's, and the repository has to say
which. A wordmark, a navigation label, a footer note, the labels on a form and
the word above a section are the owner's: declare them — in the shared document
where they are on every page — and annotate them with data-jtk-path. A skip link,
a honeypot's label and a caption that is part of the composition are not: mark
them data-jtk-fixed, which silences everything inside the element it is on.

Undeclared is not a third answer. It is what "I cannot edit the header" is made
of, and it arrives as a message and a deploy weeks later. See
references/catalogue.md.`);
  process.exit(Math.min(loose.length, 100));
}

console.log('every sentence on the page belongs to somebody');
