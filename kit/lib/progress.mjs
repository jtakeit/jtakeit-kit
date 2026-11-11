/**
 * Progress is a function of the files.
 *
 * Between «connect an agent» and the first preview a person sees nothing for
 * an hour while the site is written. What they should see is not what the
 * agent says it is doing but what the site *is*: this module reads the
 * working tree and says, for the person and the agent alike, what is written
 * and what is still missing. It declares nothing and believes nothing — the
 * brief's own checklist is read out as the agent's words, apart from the
 * files', and the rest is counted.
 *
 * One implementation, two readers: the scaffold's dev server serves this as
 * `/_jtk/progress.json` (jtakeit-meta.mjs) for the panel, and `jtkit
 * progress` prints it for the agent. A rule here is a rule in both.
 *
 * ── what «written» means ───────────────────────────────────────────────────
 *
 * The scaffold's content leaves every text empty (`jtk/content/index.json`),
 * so a page is being written when any of its text fields is filled, and is
 * written when every field the catalogue marks `required` is — the exact
 * rule where there is a catalogue, and the weaker one («has text») where a
 * site on another generator has none yet, said as such in `rule`.
 *
 * A contract-3 tree (`jtk/schema.json` says `contract: 3`) is read the same
 * way through the door (`readProgress3`): its schema is the declaration, its
 * pages and entries are under `jtk/pages/` and `jtk/entries/`, the diary's
 * settings are `jtk/modules/bookings.json`'s, and the site's currency is
 * `site.json`'s own.
 */
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { content } from './content/index.mjs';
import { unnamed } from './content/identity.mjs';
import { contractOf, readJtk } from './content/node.mjs';
import { isObject, pricePaths, srcOf } from './places3.mjs';

/** Under the weaker rule, a key named like one of these is not words. */
const NOT_WORDS = /(^|_)(image|picture|photo|media|video|url|href|link|icon|src)(_|$)|_href$|_url$/;
/** The field kinds a person writes words into. */
const TEXT = new Set(['text', 'textarea', 'richtext_lite', 'markdown']);
/** The brief's headings, in the order the guide writes them. */
export const BRIEF_SECTIONS = ['In one sentence', 'The one action', 'Facts', 'Bookings', 'Decisions', 'Open — NEEDS CLIENT', 'Done when'];

/**
 * Read the working tree and say where the site is.
 * @param {string} root the site's root, holding `BRIEF.md`, `jtk/` and `src/`
 * @param {{ dir?: string }} [options] `dir`: where `jtk/` is, relative to the root
 */
export async function readProgress(root, options = {}) {
  const dir = options.dir ?? 'jtk';
  if (contractOf(root, { dir }) === 3) return readProgress3(root, dir);
  const seen = [];
  const note = (file) => stat(file).then((s) => seen.push(s.mtime), () => {});

  const brief = await readBrief(join(root, 'BRIEF.md'));
  await note(join(root, 'BRIEF.md'));
  const catalogue = await readJSON(join(root, dir, 'catalogue.json'));
  await note(join(root, dir, 'catalogue.json'));
  const settings = await readJSON(join(root, dir, 'bookings.json'));
  await note(join(root, dir, 'bookings.json'));
  const facts = await readFacts(join(root, 'src', 'data', 'site.ts'));
  await note(join(root, 'src', 'data', 'site.ts'));
  // Read through the door, as the scaffold renders it: a page is the path
  // in its file, and the diary's settings are its `bookings_config` block
  // wherever it sits (wiki/98 §13).
  let site = null;
  try {
    site = content(await readJtk(root, { dir }));
  } catch {
    // No jtk/ yet, a file that is not JSON, or a document that is not a
    // page: nothing is written.
  }
  const documents = site?.documents() ?? [];
  for (const file of await contentFiles(join(root, dir, 'content'))) await note(file);

  const fields = fieldsOf(catalogue);
  const rule = catalogue ? 'exact' : 'has-text';
  const pages = [];
  const entries = {};
  let media = 0;
  for (const page of documents) {
    const counted = countFields(page, fields, rule);
    media += counted.media;
    if (page.collection !== undefined) {
      entries[page.collection] = (entries[page.collection] ?? 0) + 1;
      continue;
    }
    pages.push({
      path: page.path,
      written: counted.filled > 0 && counted.requiredMissing === 0,
      filled: counted.filled,
      of: counted.of,
      ...(counted.requiredMissing > 0 ? { missing: counted.requiredMissing } : {}),
    });
  }
  pages.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));

  const collections = {};
  const bookings = catalogue?.modules?.bookings ?? null;
  for (const one of catalogue?.collections ?? []) {
    const expected = bookings !== null && (bookings.services === one.name || bookings.resources === one.name) ? 1 : 0;
    collections[one.name] = { entries: entries[one.name] ?? 0, expected };
  }
  for (const [name, count] of Object.entries(entries)) {
    if (collections[name] === undefined) collections[name] = { entries: count, expected: 0 };
  }

  // The block whose type says it is the settings — not whichever came first.
  const block = settings === null ? null : (site ?? content({ '/jtk/bookings.json': settings })).module('bookings');
  const settingsRead =
    block === null
      ? null
      : {
          kit: typeof block.kit === 'string' ? block.kit : '',
          kit_version: typeof block.kit_version === 'string' ? block.kit_version : '',
          hours: Array.isArray(block.hours) && block.hours.length > 0,
          zone: typeof block.zone === 'string' && block.zone !== '',
          payment: typeof block.payment === 'string' ? block.payment : '',
        };

  const missing = [];
  if (brief === null) missing.push('BRIEF.md is not written yet');
  else {
    if (brief.open > 0) missing.push(`${brief.open} question${brief.open === 1 ? '' : 's'} for the client (Open — NEEDS CLIENT)`);
    if (!brief.sections['Decisions']) missing.push('the brief has no Decisions yet');
  }
  if (!catalogue) missing.push('jtk/catalogue.json is not written yet (npx @jtakeit/astro catalogue)');
  if (pages.length === 0) missing.push('no page has content yet');
  for (const page of pages) {
    if (page.written) continue;
    missing.push(page.filled === 0 ? `${page.path} is not written yet` : `${page.path}: ${page.filled} of ${page.of} fields, ${page.missing ?? 0} required missing`);
  }
  for (const [name, one] of Object.entries(collections)) {
    if (one.entries < one.expected) missing.push(`${name}: no entry yet`);
  }
  if (bookings !== null) {
    if (settingsRead === null) missing.push('jtk/bookings.json is not written yet');
    else {
      if (!settingsRead.hours) missing.push('the opening hours are not set (jtk/bookings.json)');
      if (!settingsRead.zone) missing.push('the time zone is not set (jtk/bookings.json)');
    }
  }
  if (facts !== null && facts.placeholders > 0) missing.push(`src/data/site.ts still carries ${facts.placeholders} placeholder${facts.placeholders === 1 ? '' : 's'}`);
  if (pages.length > 0 && media === 0) missing.push('no picture yet');

  const changedAt = seen.length > 0 ? new Date(Math.max(...seen.map((d) => d.getTime()))).toISOString() : null;
  return {
    version: 1,
    rule,
    kit: settingsRead === null ? null : { kind: settingsRead.kit, version: settingsRead.kit_version },
    brief,
    catalogue: catalogue !== null,
    pages,
    collections,
    settings: settingsRead === null ? null : { hours: settingsRead.hours, zone: settingsRead.zone, payment: settingsRead.payment },
    facts,
    media,
    missing,
    changedAt,
  };
}

/**
 * A contract-3 tree, as `readProgress` reads a contract-2 one: the same
 * answer, the same sentences where the thing is the same, and contract 3's
 * own where it is not.
 *
 *   - the declaration is `jtk/schema.json`, which the tree is named by, so
 *     the rule is exact; `catalogue` says it is written, the field the panel
 *     reads as «laid out», and `contract: 3` says whose file that is;
 *   - a page is `jtk/pages/…` and an entry `jtk/entries/<collection>/…`, in
 *     the site's own language — an entry is one whatever its languages, and
 *     before M3 a contract-3 site has one (wiki/98 §16); an entry's own
 *     values are its `fields`, by its collection's type, and its pictures
 *     count with its body's;
 *   - a picture is `{src}` (§3.4), and a gallery's are rows of it;
 *   - the diary's settings are `jtk/modules/bookings.json`'s `settings`
 *     (§4.6), and the collections the bookings module needs are the ones its
 *     roles name in the schema's `modules`, as on contract 2;
 *   - and what only contract 3 can lack, as missing: a `jtk/catalogue.json`
 *     left beside the schema, which the platform refuses; a page, an entry, a
 *     block, a row or a picture without the id or the `_key` it is tapped by
 *     (§15 · 12); a currency, where the schema declares a price and
 *     `site.json` says none at its top (§6).
 *
 * @param {string} root
 * @param {string} dir
 */
async function readProgress3(root, dir) {
  const seen = [];
  const note = (file) => stat(file).then((s) => seen.push(s.mtime), () => {});

  const brief = await readBrief(join(root, 'BRIEF.md'));
  await note(join(root, 'BRIEF.md'));
  const facts = await readFacts(join(root, 'src', 'data', 'site.ts'));
  await note(join(root, 'src', 'data', 'site.ts'));
  const schema = await readJSON(join(root, dir, 'schema.json'));
  await note(join(root, dir, 'schema.json'));
  /** @type {Record<string, unknown>} */
  let files = {};
  let site = null;
  try {
    files = await readJtk(root, { dir });
    site = content(files);
  } catch {
    // A file that is not JSON, or not a document: nothing is written.
  }
  for (const file of await contentFiles(join(root, dir, 'pages'))) await note(file);
  for (const file of await contentFiles(join(root, dir, 'entries'))) await note(file);
  for (const file of await contentFiles(join(root, dir, 'modules'))) await note(file);
  for (const name of await readdir(join(root, dir)).catch(() => [])) if (/^shared(\..+)?\.json$/.test(name)) await note(join(root, dir, name));

  const fields = fieldsOf(schema);
  const declared = new Map((Array.isArray(schema?.collections) ? schema.collections : []).filter(isObject).map((one) => [one.name, one]));
  const fieldsOfEntry = (name) => fields.get(declared.get(name)?.type) ?? [];
  // The pages a collection's entries are on: its listing, or the page its
  // `shown_on` names (`/services` for a booking kit's services). Such a page
  // may have no words of its own — the upgrade writes one so for a
  // collection shown only on it — and is written by its entries.
  const listing = new Set();
  for (const one of site?.collections ?? []) {
    for (const page of [site.listingOf(one.name, ''), site.shownOn(one.name, '')]) if (typeof page === 'string') listing.add(page);
  }
  const pages = [];
  const entries = {};
  let media = 0;
  for (const doc of site?.documents() ?? []) {
    if (doc.locale !== '') continue;
    if (doc.collection !== undefined) {
      entries[doc.collection] = (entries[doc.collection] ?? 0) + 1;
      media += picturesIn(isObject(doc.fields) ? doc.fields : {}, fieldsOfEntry(doc.collection)) + countFields3(doc.blocks, fields).media;
      continue;
    }
    const counted = countFields3(doc.blocks, fields);
    media += counted.media;
    pages.push({
      path: doc.path,
      written: counted.of === 0 && listing.has(doc.path) ? true : counted.filled > 0 && counted.requiredMissing === 0,
      filled: counted.filled,
      of: counted.of,
      ...(counted.requiredMissing > 0 ? { missing: counted.requiredMissing } : {}),
    });
  }
  pages.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));

  const collections = {};
  const bookings = isObject(schema?.modules) && isObject(schema.modules.bookings) ? schema.modules.bookings : null;
  for (const name of declared.keys()) {
    const expected = bookings !== null && (bookings.services === name || bookings.resources === name) ? 1 : 0;
    collections[name] = { entries: entries[name] ?? 0, expected };
  }
  for (const [name, count] of Object.entries(entries)) {
    if (collections[name] === undefined) collections[name] = { entries: count, expected: 0 };
  }

  // readJtk keys every file /jtk/…, wherever `dir` is.
  const block = isObject(files['/jtk/modules/bookings.json']) && site !== null ? site.module('bookings') : null;
  const settingsRead =
    block === null
      ? null
      : {
          kit: typeof block.kit === 'string' ? block.kit : '',
          kit_version: typeof block.kit_version === 'string' ? block.kit_version : '',
          hours: Array.isArray(block.hours) && block.hours.length > 0,
          zone: typeof block.zone === 'string' && block.zone !== '',
          payment: typeof block.payment === 'string' ? block.payment : '',
        };

  const missing = [];
  if (brief === null) missing.push('BRIEF.md is not written yet');
  else {
    if (brief.open > 0) missing.push(`${brief.open} question${brief.open === 1 ? '' : 's'} for the client (Open — NEEDS CLIENT)`);
    if (!brief.sections['Decisions']) missing.push('the brief has no Decisions yet');
  }
  if (existsSync(join(root, dir, 'catalogue.json'))) {
    missing.push("jtk/catalogue.json is contract 2's and still beside jtk/schema.json — the platform refuses a tree with both (git rm jtk/catalogue.json)");
  }
  const nameless = site === null ? 0 : unnamed(files).length;
  if (nameless > 0) {
    missing.push(`${nameless} place${nameless === 1 ? '' : 's'} in jtk/ without the id or the _key the panel taps it by (npx @jtakeit/astro catalogue mints them; jtkit lint names each)`);
  }
  if (pages.length === 0) missing.push('no page has content yet');
  for (const page of pages) {
    if (page.written) continue;
    missing.push(page.filled === 0 ? `${page.path} is not written yet` : `${page.path}: ${page.filled} of ${page.of} fields, ${page.missing ?? 0} required missing`);
  }
  for (const [name, one] of Object.entries(collections)) {
    if (one.entries < one.expected) missing.push(`${name}: no entry yet`);
  }
  if (bookings !== null) {
    if (settingsRead === null) missing.push('jtk/modules/bookings.json is not written yet');
    else {
      if (!settingsRead.hours) missing.push('the opening hours are not set (jtk/modules/bookings.json)');
      if (!settingsRead.zone) missing.push('the time zone is not set (jtk/modules/bookings.json)');
    }
  }
  if (site !== null && pricePaths(schema?.blocks).size > 0 && site.currency === '') {
    missing.push("the site has prices and no currency yet — jtk/site.json says none: write it at its top (\"currency\": \"CHF\") and the next import takes it while the site has none (create_site's `currency` for a new site); once set, a person changes it in the panel; every price is drawn without one until then");
  }
  if (facts !== null && facts.placeholders > 0) missing.push(`src/data/site.ts still carries ${facts.placeholders} placeholder${facts.placeholders === 1 ? '' : 's'}`);
  if (pages.length > 0 && media === 0) missing.push('no picture yet');

  const changedAt = seen.length > 0 ? new Date(Math.max(...seen.map((d) => d.getTime()))).toISOString() : null;
  return {
    version: 1,
    contract: 3,
    rule: 'exact',
    kit: settingsRead === null ? null : { kind: settingsRead.kit, version: settingsRead.kit_version },
    brief,
    catalogue: schema !== null,
    pages,
    collections,
    settings: settingsRead === null ? null : { hours: settingsRead.hours, zone: settingsRead.zone, payment: settingsRead.payment },
    facts,
    media,
    missing,
    changedAt,
  };
}

/** A filled picture: `{src}`, the string an old file may still hold, or a gallery with one. */
function hasPicture(value) {
  return srcOf(value) !== '' || (Array.isArray(value) && value.some((one) => srcOf(one) !== ''));
}

/** The picture fields of some values, by their declared fields, that hold a picture. */
function picturesIn(values, defs) {
  return defs.filter((def) => def.kind === 'media' && hasPicture(values[def.key])).length;
}

/** How much of a contract-3 document's blocks is written, as `countFields` counts a contract-2 one. */
function countFields3(blocks, fields) {
  let filled = 0;
  let of = 0;
  let requiredMissing = 0;
  let media = 0;
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!isObject(block)) continue;
    const defs = fields.get(block.type);
    if (defs !== undefined) {
      for (const def of defs) {
        if (def.kind === 'media') {
          if (hasPicture(block[def.key])) media++;
          continue;
        }
        if (!TEXT.has(def.kind)) continue;
        of++;
        if (hasText(block[def.key])) filled++;
        else if (def.required) requiredMissing++;
      }
      continue;
    }
    // A block of a type the schema does not declare: the weaker rule, as on contract 2.
    const weaker = countFields({ blocks: [block] }, new Map(), 'has-text');
    filled += weaker.filled;
    of += weaker.of;
    media += weaker.media;
  }
  return { filled, of, requiredMissing, media };
}

/**
 * The brief as a document: which sections have words, how many facts carry a
 * source, how many questions are open, and the agent's own checklist under
 * «Done when» — read out, never believed.
 */
export async function readBrief(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return null;
  }
  const sections = {};
  const bodies = {};
  let current = null;
  for (const line of text.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      bodies[current] = [];
      continue;
    }
    if (current !== null) bodies[current].push(line);
  }
  // A section has words when a line of it is neither empty, nor a table's
  // header or separator, nor the skeleton's own sentence (the kit's line
  // under Bookings is written by `jtk create`, not by the agent).
  for (const name of BRIEF_SECTIONS) {
    sections[name] = rowsOf(bodies[name] ?? []).some((l) => !/^\|/.test(l) ? !/^The kit: .*, whole/.test(l) : true);
  }
  const factRows = rowsOf(bodies['Facts'] ?? []).filter((l) => /^\|/.test(l));
  const open = (bodies['Open — NEEDS CLIENT'] ?? []).filter((l) => /^\s*[-*]\s+\S/.test(l)).length;
  const items = (bodies['Done when'] ?? []).filter((l) => /^\s*[-*]\s+\[[ xX]\]/.test(l));
  const done = items.filter((l) => /\[[xX]\]/.test(l)).length;
  // Gaps are marked in the tables: a fact or a default whose value is still
  // the client's to give. The heading and the checklist's own words are not
  // gaps.
  const needsClient = [...rowsOf(bodies['Facts'] ?? []), ...rowsOf(bodies['Bookings'] ?? [])]
    .filter((l) => /^\|/.test(l) && /NEEDS CLIENT/.test(l)).length;
  return {
    sections,
    facts: factRows.length,
    open,
    needsClient: Math.max(needsClient, 0),
    doneWhen: { done, of: items.length, items: items.map((l) => ({ done: /\[[xX]\]/.test(l), says: l.replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '').trim() })) },
  };
}

/** The lines of a section that carry words: not blank, not a table's header or its separator. */
function rowsOf(body) {
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (line.trim() === '') continue;
    if (/^\|?\s*:?-+:?\s*\|/.test(line)) continue;
    if (/^\|/.test(line) && /^\|?\s*:?-+:?\s*\|/.test(body[i + 1] ?? '')) continue;
    out.push(line);
  }
  return out;
}

async function readFacts(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return null;
  }
  return { placeholders: (text.match(/\{\{[A-Z_]+\}\}/g) ?? []).length };
}

function fieldsOf(catalogue) {
  const byType = new Map();
  for (const block of catalogue?.blocks ?? []) {
    byType.set(block.type, block.fields ?? []);
  }
  return byType;
}

/** How much of a document is written: the text fields filled, the required ones missing, the pictures in it. */
function countFields(page, fields, rule) {
  let filled = 0;
  let of = 0;
  let requiredMissing = 0;
  let media = 0;
  for (const block of page.blocks ?? []) {
    const defs = fields.get(block.type);
    if (rule === 'exact' && defs !== undefined) {
      for (const def of defs) {
        if (def.kind === 'media') {
          if (hasText(block[def.key]) || (Array.isArray(block[def.key]) && block[def.key].length > 0)) media++;
          continue;
        }
        if (!TEXT.has(def.kind)) continue;
        of++;
        if (hasText(block[def.key])) filled++;
        else if (def.required) requiredMissing++;
      }
      continue;
    }
    // The weaker rule, with no catalogue to say what a field is: every
    // string is words unless its name or its value says it is an address
    // or a picture.
    for (const [key, value] of Object.entries(block)) {
      if (key === '_key' || key === 'type' || key === 'v') continue;
      if (typeof value !== 'string') continue;
      if (NOT_WORDS.test(key)) {
        if (hasText(value) && /image|picture|photo|media|video/.test(key)) media++;
        continue;
      }
      if (/^(https?:|#|\/)/.test(value)) continue;
      of++;
      if (hasText(value)) filled++;
    }
  }
  return { filled, of, requiredMissing, media };
}

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function contentFiles(dir) {
  const out = [];
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const one of names) {
    const path = join(dir, one.name);
    if (one.isDirectory()) out.push(...(await contentFiles(path)));
    else if (one.name.endsWith('.json')) out.push(path);
  }
  return out;
}

/** The list as a person reads it in a terminal. */
export function sayProgress(progress) {
  const lines = [];
  if (progress.brief === null) lines.push('brief: not written');
  else {
    const b = progress.brief;
    lines.push(`brief: ${b.facts} fact(s), ${b.open} open for the client, done when ${b.doneWhen.done}/${b.doneWhen.of}`);
  }
  // Contract 3's declaration is jtk/schema.json.
  lines.push(`${progress.contract === 3 ? 'schema' : 'catalogue'}: ${progress.catalogue ? 'written' : 'not yet'}`);
  for (const page of progress.pages) {
    lines.push(`${page.written ? 'ok   ' : 'todo '}${page.path}  ${page.filled}/${page.of} fields${page.missing ? `, ${page.missing} required missing` : ''}`);
  }
  for (const [name, one] of Object.entries(progress.collections)) {
    lines.push(`${one.entries >= one.expected ? 'ok   ' : 'todo '}${name}: ${one.entries} entr${one.entries === 1 ? 'y' : 'ies'}${one.expected ? ` (≥ ${one.expected})` : ''}`);
  }
  if (progress.settings) lines.push(`settings: hours ${progress.settings.hours ? 'set' : 'not set'}, zone ${progress.settings.zone ? 'set' : 'not set'}`);
  lines.push(`pictures: ${progress.media}`);
  lines.push('');
  if (progress.missing.length === 0) lines.push('nothing missing — judge it, push, attach, build');
  else {
    lines.push('missing:');
    for (const one of progress.missing) lines.push(`  - ${one}`);
  }
  return lines.join('\n');
}
