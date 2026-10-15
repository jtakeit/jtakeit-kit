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
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { collectContent } from './content.mjs';

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
  let content = { pages: [] };
  try {
    content = await collectContent(root, { dir });
  } catch {
    // No jtk/ yet, or a document that is not a page: nothing is written.
  }
  for (const file of await contentFiles(join(root, dir, 'content'))) await note(file);

  const fields = fieldsOf(catalogue);
  const rule = catalogue ? 'exact' : 'has-text';
  const pages = [];
  const entries = {};
  let media = 0;
  for (const page of content.pages) {
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

  const block = settings?.blocks?.[0] ?? null;
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
  lines.push(`catalogue: ${progress.catalogue ? 'written' : 'not yet'}`);
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
