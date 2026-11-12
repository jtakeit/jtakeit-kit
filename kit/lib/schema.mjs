#!/usr/bin/env node
/**
 * jtk schema — write a contract-3 site's `jtk/schema.json` from its
 * declaration, and prove it matches the page.
 *
 *   jtk schema                  # write, then check against a fresh build
 *   jtk schema --emit-only      # write, do not build or check
 *   jtk schema --dist ./dist    # check against a build made elsewhere
 *   jtk schema --judge          # and ask the platform's judge whether we agree
 *
 * Contract 3's schema is `jtk/schema.json` (jtakeit-core wiki/98 §2, §3), and
 * it is written from `src/content/blocks.ts` as contract 2's catalogue always
 * was: "`src/content/blocks.ts` is rewritten as the §3 tables say … `jtk
 * schema` then writes `jtk/schema.json` with `contract: 3`" (§7 · 2). This is
 * `jtk catalogue`'s work for contract 3, and the same three answers:
 *
 *   offline       the file is one the platform's strict decode and its judge
 *                 accept (judge3.mjs), with the codes the platform gives
 *   against the   every field the owner may edit is drawn with its annotation,
 *   page          in the grammar by key (§5), and every annotation names a
 *                 field the schema declares; every sentence is somebody's
 *   with --judge  the platform's own verdict, and where it and this copy part
 *
 * Exit code is the number of things wrong, at most 100. Zero means the schema
 * is written and the page agrees with it.
 *
 * ── how a declaration says it is contract 3 ─────────────────────────────────
 *
 * One line: `export const CONTRACT = 3`. The rest of the file is what it was —
 * one export per table, BLOCKS, COLLECTIONS, MODULES, PAGE_SEO, LOCALE,
 * LOCALES — written in §3's words (`@jtakeit/kit/schema` types them), with
 * SHARED for the block types the shared text holds and no BUSINESS_FACTS,
 * which become shared text with roles (§4.5). A declaration without the line
 * is contract 2's and `jtk catalogue`'s, and this command writes nothing for
 * it; one with the line is never written as a `jtk/catalogue.json`.
 *
 * Why the line rather than one `SCHEMA` object shaped as the file: the
 * template's own code imports the tables by name (`LOCALE` in the copy, the
 * collections where it lists them), the upgrade that moves a site rewrites
 * each table in place (§7 · 2, a codemod of data literals) rather than
 * restructuring the file, and an agent that has written a contract-2
 * declaration writes a contract-3 one by learning the new words, not a new
 * file. The top level of `jtk/schema.json` is assembled here in one order,
 * whatever order the exports come in, so a declaration that says the same
 * thing writes the same bytes.
 *
 * ── what it never writes ────────────────────────────────────────────────────
 *
 * `jtk/catalogue.json`: the platform refuses a tree holding both (§16), and
 * one already there is said and left, as `jtk catalogue` leaves it. Nor a
 * schema it has refused: `--judge` is sent the text, so the platform can be
 * asked about a file this copy turned down.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isAdvice, isPlatformCode, LOCAL } from './codes.mjs';
import { unnamed } from './content/identity.mjs';
import { content } from './content/index.mjs';
import { contractOf, mintJtk, readJtk } from './content/node.mjs';
import { canonicalTag, judgeSchema } from './judge3.mjs';
import { filesBeside, judgeRequest } from './judgeFiles.mjs';
import { copiesMissing, copyMissingSays, judgeTranslations } from './translations.mjs';
import { BY_INDEX, DOCUMENT_ID, ID, isEmpty, KEY, placesIn, tappable3 } from './places3.mjs';
import { builtPages, prefixBuild, servedFaults, unboundedHeights, unowned } from './served.mjs';

export { judgeSchema };

const TOOL_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// ── the declaration ────────────────────────────────────────────────────────

/**
 * Which contract a declaration is in: 3 where it says `CONTRACT = 3`, 2 where
 * it says nothing — every declaration written before contract 3 — or 2.
 * @param {Record<string, unknown>} declared the module's exports
 * @returns {2 | 3}
 */
export function contractOfDeclaration(declared) {
  const said = declared.CONTRACT;
  if (said === undefined || said === 2) return 2;
  if (said === 3) return 3;
  throw new Error(`CONTRACT is ${JSON.stringify(said)} — a declaration says CONTRACT = 3, or nothing at all for contract 2`);
}

/**
 * The schema a contract-3 declaration says, top level in the order the file
 * is written in: `contract`, `generator`, `locale`, `locales`, `blocks`,
 * `page_seo`, `shared`, `collections`, `modules`, `render`. Inside each table the
 * declaration's own order stands. A table that is empty is left out — empty
 * is absent (§1, 6) — except `blocks`, which a schema must have. The
 * languages are spelt as the platform spells them (`de-CH`).
 *
 * What is not contract 3's is passed through for the judge to refuse in its
 * own words: `BUSINESS_FACTS` becomes `business_facts`, which contract 3 has
 * not got, and a value of the wrong shape stays that shape.
 *
 * @param {Record<string, unknown>} declared the module's exports
 * @param {{ generator?: string }} [options]
 */
export function schemaOf(declared, options = {}) {
  const spelt = (tag) => (typeof tag === 'string' ? canonicalTag(tag) ?? tag : tag);
  const some = (value) => value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0) && !(isObject(value) && Object.keys(value).length === 0);

  /** @type {Record<string, unknown>} */
  const schema = { contract: 3 };
  if (typeof options.generator === 'string' && options.generator !== '') schema.generator = options.generator;
  if (declared.LOCALE !== undefined) schema.locale = spelt(declared.LOCALE);
  if (some(declared.LOCALES)) schema.locales = Array.isArray(declared.LOCALES) ? declared.LOCALES.map(spelt) : declared.LOCALES;
  schema.blocks = declared.BLOCKS ?? [];
  if (some(declared.PAGE_SEO)) schema.page_seo = declared.PAGE_SEO;
  if (some(declared.SHARED)) schema.shared = declared.SHARED;
  if (some(declared.COLLECTIONS)) schema.collections = declared.COLLECTIONS;
  if (some(declared.MODULES)) schema.modules = declared.MODULES;
  // Whether the template draws a draft live (jtakeit-core wiki/89 §12):
  // `RENDER = 'live'` in the declaration, as the scaffold writes it.
  if (declared.RENDER !== undefined) schema.render = declared.RENDER;
  if (declared.BUSINESS_FACTS !== undefined) schema.business_facts = declared.BUSINESS_FACTS;
  return schema;
}

/** The schema as `jtk/schema.json` holds it: two spaces to a level, and a newline. */
export function schemaText(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

// ── against the page: the grammar by key (§5) ──────────────────────────────
//
// What the platform's build asks of a contract-3 page (sitebuild's
// annotation lint, `lint3`), asked here before the push, and the other
// direction besides, as `jtk catalogue` asks it of contract 2:
//
//   every filled value the owner taps is annotated where it is drawn —
//   a field that says `client_editable: true`, of a kind a person taps;
//   a shared one somewhere on the site; an entry without a page of its own
//   as `entry:<id>:…` wherever it is shown;
//
//   every annotation names a place the schema declares, in the document it
//   says — the page's own, `shared:`, `page:<id>:`, `entry:<id>:` — filled or
//   not: a field outside the rule may be annotated, never one nobody declared;
//
//   and every value of the shared text the owner fills and taps nowhere — a
//   `no_tap_target` name, a phone, an email, a country — drawn somewhere all
//   the same: in the words, an attribute, a `tel:` link or the structured
//   data. The annotations cannot say where such a value is, so the pages'
//   own text is asked; a value on no page is one the owner edits for nothing.
//
// The rules of a place are places3.mjs's, which `jtkit lint` reads too.

/** A module's settings by the module's name; its fields are the module's, not the schema's. */
const MODULE = /^module:([a-z][a-z0-9_]*):([a-z][a-z0-9_]{0,39}(?:\[[a-z][a-z0-9-]{0,31}\]\.[a-z][a-z0-9_]{0,39}){0,2}(?:\.(?:src|alt|focus|poster))?)$/;

/** The kinds whose value a page draws as it is stored, so the page's text can be searched for it. */
const SAID_AS_STORED = new Set(['text', 'textarea', 'richtext_lite', 'markdown', 'tel', 'email', 'url', 'select', 'number']);

/** A page's text with the entities a build writes put back: what a visitor and a crawler read. */
function decoded(html) {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(quot|apos|lt|gt|nbsp|amp);/g, (_, name) => ({ quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0', amp: '&' })[name]);
}

/**
 * Every place the schema and the built pages disagree, as sentences.
 *
 * @param {{ files: Record<string, unknown>; schema: any; dist: string }} input
 *   `files`: the working tree's jtk/, as `readJtk` hands it; `schema`: the one just written
 */
export function pagesAgainst({ files, schema, dist }) {
  const out = [];
  const modules = isObject(schema.modules) ? schema.modules : {};

  const site = content({ ...files, '/jtk/schema.json': schema });
  const documents = site.documents();
  const own = documents.filter((one) => one.locale === '');
  const shared = site.sharedDocuments().flatMap((one) => one.blocks);
  const { types, blockPlaces, entryPlaces, declares } = placesIn(schema, shared);
  const fieldsOfType = (name) => (Array.isArray(types.get(name)?.fields) ? types.get(name).fields.filter(isObject) : []);
  const byId = { page: new Map(), entry: new Map() };
  for (const one of own) byId[one.collection === undefined ? 'page' : 'entry'].set(one.id, one);
  // Whose a built page is, in every language: a page's, or an entry's own.
  const at = new Map();
  for (const one of documents) if (typeof one.path === 'string') at.set(one.path, { document: one, entry: one.collection !== undefined });

  /** The annotations of every built page, by its address. */
  const built = new Map();
  /** Every page's text, decoded, for the values no annotation places. */
  let corpus = '';
  for (const file of builtPages(dist)) {
    const page = `/${relative(dist, file).split(sep).join('/')}`.replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';
    const html = readFileSync(file, 'utf8');
    corpus += `\n${decoded(html)}`;
    built.set(page, {
      paths: new Set([...html.matchAll(/data-jtk-path="([^"]+)"/g)].map((one) => one[1])),
      binds: [...html.matchAll(/data-jtk-bind="([^"]*)"/g)].flatMap((one) => one[1].split(/\s+/).filter(Boolean)),
      hrefs: [...html.matchAll(/data-jtk-href="([^"]*)"/g)].map((one) => one[1]),
    });
  }
  const everywhere = new Set([...built.values()].flatMap((one) => [...one.paths]));

  const undeclared = (path) =>
    BY_INDEX.test(path) ? `${path} names a place by its index — contract 3 names a block and a row by its _key: blocks[hero].title (wiki/98 §5)` : `${path} is on the page and the schema does not declare it`;

  // ── every value the owner taps, where it is drawn ────────────────────────

  for (const document of own) {
    for (const block of Array.isArray(document.blocks) ? document.blocks : []) {
      if (isObject(block) && !types.has(block.type)) out.push(`${document.file.slice(1)}: a block of type ${JSON.stringify(block.type)}, which the schema does not declare`);
    }
  }
  for (const place of blockPlaces(shared, 'shared:')) {
    if (!everywhere.has(place)) out.push(`${place} is declared and no page renders it`);
  }

  // ── every value of the shared text, drawn somewhere ──────────────────────
  //
  // A field of the shared text the owner fills and no tap reaches — the
  // contacts' name, address and telephone are `no_tap_target`, said in the
  // head and the structured data — has no annotation to look for, and the
  // check above passed a site whose every contact was drawn nowhere: the
  // layout read the business's facts from a constant, and what the owner
  // typed in the panel changed nothing (the contract-3 rehearsal, 11
  // November 2026). So the pages' text is asked for the value itself; a phone
  // also as it is dialled, its spaces and dashes left out.
  const drawn = (field, value) => {
    const said = String(value).trim();
    if (said === '' || corpus.includes(said)) return true;
    return field.kind === 'tel' && corpus.includes(said.replace(/[\s().\-/]/g, ''));
  };
  const undrawn = (values, fields, prefix, steps = 0) => {
    const places = [];
    for (const field of fields) {
      if (typeof field.key !== 'string' || field.client_editable !== true) continue;
      const value = values[field.key];
      if (isEmpty(value)) continue;
      const here = prefix + field.key;
      if (field.kind === 'list') {
        if (!Array.isArray(value) || steps >= 2) continue;
        const of = Array.isArray(field.of) ? field.of.filter(isObject) : [];
        for (const row of value) if (isObject(row) && KEY.test(row._key ?? '')) places.push(...undrawn(row, of, `${here}[${row._key}].`, steps + 1));
        continue;
      }
      if (tappable3(field) || !SAID_AS_STORED.has(field.kind) || (typeof value !== 'string' && typeof value !== 'number')) continue;
      if (!drawn(field, value)) places.push({ place: here, value: String(value).trim() });
    }
    return places;
  };
  for (const block of shared) {
    if (!isObject(block) || !KEY.test(block._key ?? '')) continue;
    for (const { place, value } of undrawn(block, fieldsOfType(block.type), `shared:blocks[${block._key}].`)) {
      out.push(`${place} is filled («${value.length > 40 ? `${value.slice(0, 39)}…` : value}») and no page draws it — not in its words, an attribute, a link or the structured data: what the owner types there changes nothing on the site`);
    }
  }
  for (const document of own) {
    const isEntry = document.collection !== undefined;
    if (typeof document.path === 'string') {
      const page = built.get(document.path);
      if (page === undefined) {
        out.push(`${document.path} is in the content and the build did not produce it`);
        continue;
      }
      for (const place of isEntry ? entryPlaces(document) : blockPlaces(document.blocks)) {
        if (!page.paths.has(place)) out.push(`${document.path}: ${place} is declared and the page does not render it`);
      }
      continue;
    }
    // An entry without a page of its own, shown on another: named by its id
    // wherever it is, unless it is hidden and so shown nowhere.
    if (!isEntry || document.shown === false || !ID.test(document.id ?? '')) continue;
    for (const place of entryPlaces(document)) {
      const tile = `entry:${document.id}:${place}`;
      if (!everywhere.has(tile)) out.push(`${document.collection}/${document.slug}: ${tile} is on no page — an entry without a page of its own is annotated where it is shown`);
    }
  }

  // ── every annotation, declared ───────────────────────────────────────────

  for (const [page, found] of built) {
    // A specimen is the door's, generated from the schema, and has no document.
    if (page.split('/').some((part) => part.startsWith('_fl-'))) continue;
    const mine = at.get(page);
    const orphans = [];
    for (const path of found.paths) {
      if (path.startsWith('shared:')) {
        if (!declares(undefined, path, false)) out.push(`${page}: ${undeclared(path)}`);
        continue;
      }
      if (path.startsWith('page:') || path.startsWith('entry:')) {
        const named = DOCUMENT_ID.exec(path);
        if (named === null) {
          out.push(`${page}: ${path} names no document by its id — contract 3 names another page or an entry by its id: page:<id>:… and entry:<id>:…`);
          continue;
        }
        const [, kind, id, place] = named;
        const document = byId[kind].get(id);
        if (document === undefined) out.push(`${page}: ${path} names ${kind === 'entry' ? 'an entry' : 'a page'} this site has not got`);
        else if (place.startsWith('shared:') || !declares(document, place, kind === 'entry')) out.push(`${page}: ${path} names a place that ${kind}'s document has no field for`);
        continue;
      }
      if (path.startsWith('module:')) {
        const named = MODULE.exec(path);
        if (named === null || !Object.hasOwn(modules, named[1])) out.push(`${page}: ${path} names no module the schema turns on`);
        continue;
      }
      if (mine === undefined) {
        orphans.push(path);
        continue;
      }
      if (!declares(mine.document, path, mine.entry)) out.push(`${page}: ${undeclared(path)}`);
    }
    // A page with no document of its own — a listing — names others' fields,
    // never its own: a tap there would open nothing.
    if (orphans.length > 0) out.push(`${page}: has annotations and no content document — ${orphans.sort()[0]} would open nothing`);

    // A value held in an attribute, and a link the owner sets: in the page's
    // own document or the shared text, by key, as the build reads them (§5).
    for (const pair of found.binds) {
      const cut = pair.indexOf(':');
      const name = cut < 1 ? '' : pair.slice(0, cut);
      const path = pair.slice(cut + 1);
      if (!/^data-[a-z0-9-]+$/.test(name)) out.push(`${page}: binds "${pair}" — a bind is data-<name>:<path>, and the editor writes only data- attributes`);
      else if (!declares(mine?.document, path, mine?.entry === true)) out.push(`${page}: binds ${name} to ${path}, which this page's document has no field for`);
    }
    for (const path of found.hrefs) {
      if (!declares(mine?.document, path, mine?.entry === true)) out.push(`${page}: leads a link to where ${path} says, which this page's document has no field for`);
    }
  }
  return [...new Set(out)].sort();
}

// ── the exam ───────────────────────────────────────────────────────────────
//
// The platform's judge is the judge, and judge3.mjs sits its exam: the schema
// as text and the jtk/ files beside it go to `POST /v1/registry/validate`,
// which reads a text by the contract it says, and the two verdicts are held
// to each other by code — the place is said in the same words on both sides,
// but a verdict is a code. A code the judge raised and this copy did not is
// this copy behind; one it raised and the judge did not is a schema refused
// for nothing. The files' findings (`jtk/…`) and the judge's advice are the
// platform's alone, printed and not examined.

async function sitTheExam(root, text, ours) {
  if (!process.env.JTK_API || !process.env.JTK_TOKEN) {
    console.error(`
jtk schema: --judge needs somewhere to ask and something to ask with.

  export JTK_API=https://…        the platform's API (https://api.stg.jtakeit.com on staging)
  export JTK_TOKEN=…              an agent's jtk_… token, or a signed-in session

An agent's access token (\`jtk_…\`) is sent as a bearer; anything else is taken
for the \`sid\` cookie of a person signed in to the panel. An agent with the MCP
server needs neither: validate_catalogue with the schema and the jtk/ files
beside it judges the whole working tree before any push.`);
    return { failed: true };
  }

  const files = filesBeside(root, { schema: true });
  const { url, init } = judgeRequest(text, files);
  let response;
  try {
    response = await fetch(url, init);
  } catch (why) {
    console.error(`\njtk schema: could not reach the judge at ${url} — ${why.message}`);
    console.error('The schema was not examined. This is not a verdict on it.');
    return { divergences: 0, ofFiles: 0 };
  }
  if (!response.ok) {
    const said = (await response.text()).trim().slice(0, 400);
    console.error(`\njtk schema: could not reach the judge — ${url} answered ${response.status}`);
    console.error(`  ${said || '(nothing)'}`);
    console.error(
      response.status === 401 || response.status === 403
        ? "A token lasts an hour and a session expires: put a current one in JTK_TOKEN — or push and ask validate_catalogue over MCP, which needs none."
        : 'The schema was not examined. This is not a verdict on it.',
    );
    return { divergences: 0, ofFiles: 0 };
  }
  let verdict;
  try {
    verdict = await response.json();
  } catch (why) {
    console.error(`\njtk schema: could not reach the judge — ${url} answered with something that is not JSON`);
    console.error(`  ${why.message}`);
    return { divergences: 0, ofFiles: 0 };
  }

  const all = verdict.findings ?? [];
  const ofFiles = all.filter((one) => /^jtk\//.test(one.path ?? ''));
  const findings = all.filter((one) => !ofFiles.includes(one));
  for (const one of ofFiles) console.error(`  ✗ ${one.code}  ${one.path}: ${one.says}`);
  if (ofFiles.length > 0) console.error(`  ${ofFiles.length} finding(s) in the files beside the schema (${files.length} sent) — refused at import until fixed.\n`);
  const advice = [...(verdict.advice ?? []), ...findings.filter((one) => isAdvice(one.code))];
  for (const one of advice) console.log(`  ~ ${one.code}  ${one.path || '(the file)'}: ${one.says}`);
  if (advice.length > 0) console.log(`  ${advice.length} piece(s) of advice from the judge — allowed, and unwise. Act on them before the first build.\n`);

  const theirs = new Set(findings.filter((one) => !isAdvice(one.code)).map((one) => one.code));
  const mine = new Set(ours.filter((one) => isPlatformCode(one.code)).map((one) => one.code));
  const missed = [...theirs].filter((code) => !mine.has(code)).sort();
  const invented = [...mine].filter((code) => !theirs.has(code)).sort();
  if (missed.length === 0 && invented.length === 0) {
    console.log(`judged by ${url} — ${findings.length} finding(s) in the schema, ${ofFiles.length} in the ${files.length} file(s) beside it, and this checker said the same of the schema`);
    return { divergences: 0, ofFiles: ofFiles.length };
  }
  console.error('\njtk schema: the judge and this checker do not agree\n');
  for (const code of missed) {
    console.error(`  ← ${code}  the judge raised this and we did not — this checker is behind`);
    for (const one of findings.filter((f) => f.code === code)) console.error(`      ${one.path || '(the file)'}: ${one.says}`);
  }
  for (const code of invented) {
    console.error(`  → ${code}  we raised this and the judge did not — a schema refused for nothing`);
    for (const one of ours.filter((f) => f.code === code)) console.error(`      ${one.where}: ${one.says}`);
  }
  console.error(`
The platform's judge (registry.Judge) is the judge; judge3.mjs is a copy that
has to work offline. A divergence is the copy's bug, not the platform's: bring
the rule here into line, or add the one it is missing.`);
  return { divergences: missed.length + invented.length, ofFiles: ofFiles.length };
}

// ── the command ────────────────────────────────────────────────────────────

/**
 * `jtk schema` with these arguments.
 * @param {string[]} argv
 * @returns {Promise<number>} the exit code
 */
export async function main(argv) {
  const has = (name) => argv.includes(`--${name}`);
  const flag = (name, fallback) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? fallback : argv[at + 1];
  };
  const capped = (count) => Math.min(count, 100);
  const root = resolve(flag('root', process.cwd()));

  // The declaration, imported rather than parsed: Node runs TypeScript by
  // stripping its types, so `src/content/blocks.ts` is read as it is written.
  const declarationPath = flag('declaration', join('src', 'content', 'blocks.ts'));
  const source = resolve(root, declarationPath);
  if (!existsSync(source)) {
    console.error(`jtk schema: no ${declarationPath} — that file is what says which fields the owner may edit; say where yours is with --declaration <file>`);
    return 1;
  }
  let declared;
  try {
    declared = await import(pathToFileURL(source).href);
  } catch (why) {
    console.error(`jtk schema: could not read ${declarationPath}: ${why.message}\n  Node runs TypeScript by stripping types, so the file may hold no enums and no namespaces.`);
    return 1;
  }
  let contract;
  try {
    contract = contractOfDeclaration(declared);
  } catch (why) {
    console.error(`jtk schema: ${declarationPath}: ${why.message}`);
    return 1;
  }
  if (contract === 2) {
    console.error(
      `jtk schema: ${declarationPath} is contract 2's — it does not say CONTRACT = 3 — and jtk catalogue writes its file, jtk/catalogue.json; ` +
        'jtk schema writes nothing for it. A site moves to contract 3 with jtk upgrade contract-3 (jtakeit-core wiki/98 §7).',
    );
    return 1;
  }

  // Signed as the tool that wrote it, unless the scaffold that owns the
  // declaration says it did (`@jtakeit/astro` passes --generator) or the dev
  // server keeps the one the file has.
  const schema = schemaOf(declared, { generator: flag('generator', `@jtakeit/kit@${TOOL_VERSION}`) });
  const text = schemaText(schema);

  const problems = [
    ...judgeSchema(text).map((one) => ({ code: one.code, where: one.path || '(the file)', says: one.says })),
    ...servedFaults(root),
  ];
  if (problems.length > 0) {
    console.error('jtk schema: this schema is not one the platform will accept\n');
    for (const one of problems) console.error(`  ✗ ${one.code}  ${one.where}: ${one.says}`);
    console.error(`
A JTK_E_… code is the platform's own name for that fault, the one POST
/v1/registry/validate returns for this text. ${LOCAL} is the kit's own — the
studio's preview arrangement, which the schema has nothing to say about.`);
  }
  const exam = has('judge') ? await sitTheExam(root, text, problems) : { divergences: 0, ofFiles: 0 };
  if (exam.failed) return 1;

  // Written only when the platform would read it, and only when it changed:
  // a dev server reloads every page on a write.
  const file = join(root, 'jtk', 'schema.json');
  if (problems.length === 0) {
    mkdirSync(join(root, 'jtk'), { recursive: true });
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
    const blocks = Array.isArray(schema.blocks) ? schema.blocks : [];
    const fields = blocks.reduce((n, one) => n + (Array.isArray(one.fields) ? one.fields.length : 0), 0);
    console.log(`jtk/schema.json — ${blocks.length} block type(s), ${fields} field(s)`);
  }

  // Contract 2's file beside it is refused with it (§16): said, and left — it
  // may hold what the developer means to carry over, and under git it is
  // theirs to delete.
  const stray = existsSync(join(root, 'jtk', 'catalogue.json'));
  if (stray) {
    console.error("jtk schema: jtk/catalogue.json is contract 2's schema, beside contract 3's jtk/schema.json, and the platform refuses a tree with both — remove it (git rm jtk/catalogue.json)");
  }

  // The names every contract-3 file carries from its first write (§15 · 12),
  // minted where they are missing, as `jtk catalogue` mints them — against
  // the schema on disk, the one just written or, refused, the last one.
  let nameless = [];
  let translations = 0;
  if (contractOf(root) === 3) {
    const byFile = new Map();
    for (const one of await mintJtk(root)) {
      const count = byFile.get(one.file) ?? { id: 0, key: 0 };
      count[one.what] += 1;
      byFile.set(one.file, count);
    }
    for (const [named, count] of byFile) {
      const said = [count.id > 0 ? 'an id' : '', count.key > 0 ? `${count.key} _key(s)` : ''].filter(Boolean).join(' and ');
      console.log(`${named.slice(1)} — ${said} minted`);
    }
    const tree = await readJtk(root);
    nameless = unnamed(tree);
    for (const one of nameless) console.error(`  ${one.says}`);

    // The translations beside their originals (M3, wiki/98 §4.4), judged as
    // the platform's import will judge them: placed, in a language the
    // schema has, holding only words. Advice is said and counts nothing.
    const judged = judgeTranslations({ ...tree, '/jtk/schema.json': problems.length === 0 ? schema : tree['/jtk/schema.json'] });
    const refused = judged.filter((one) => !isAdvice(one.code));
    if (refused.length > 0) console.error(`\njtk schema: ${refused.length} thing(s) in the translations the platform will refuse\n`);
    for (const one of judged) console.error(`  ${isAdvice(one.code) ? '·' : '✗'} ${one.code}  ${one.path}: ${one.says}`);
    translations = refused.length;

    // Each other language's words that are not content: the copy module the
    // scaffold's registry finds by its name. A language without one says the
    // site's own words on its pages.
    const said = problems.length === 0 ? schema : tree['/jtk/schema.json'];
    const copies = copiesMissing(root, said);
    for (const tag of copies) console.error(`  ✗ ${LOCAL}  ${copyMissingSays(tag, canonicalTag(said?.locale ?? '') ?? '')}`);
    translations += copies.length;
  }

  // A module the schema turns on has its settings, `{ v, settings }` at
  // jtk/modules/<module>.json (§4.6) — seeded empty where there is none, so
  // that "set it up" is filling in fields rather than guessing a document.
  // Never over one that is there: the file is the owner's once a save has
  // touched it.
  if (problems.length === 0 && isObject(schema.modules)) {
    for (const module of Object.keys(schema.modules)) {
      const settings = join(root, 'jtk', 'modules', `${module}.json`);
      if (existsSync(settings)) continue;
      mkdirSync(join(root, 'jtk', 'modules'), { recursive: true });
      writeFileSync(settings, `${JSON.stringify({ v: 1, settings: {} }, null, 2)}\n`);
      console.log(`jtk/modules/${module}.json — seeded with empty settings: fill them in (the platform's modules reference lists them) and commit it`);
    }
  }

  const before = nameless.length + (stray ? 1 : 0) + exam.ofFiles + translations;
  if (problems.length > 0) return capped(problems.length + before);
  // A divergence is the copy's failure and not the site's, so the schema is
  // written and then the run goes red.
  if (exam.divergences > 0) return capped(exam.divergences + before);
  if (has('emit-only')) return capped(before);

  // ── against the page ─────────────────────────────────────────────────────

  let dist = flag('dist');
  if (!dist) {
    console.log('building, to check the schema against what the page actually renders…');
    try {
      execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
    } catch {
      console.error('jtk schema: the site does not build, so there is nothing to check the schema against');
      return 1;
    }
    dist = join(root, 'dist');
  }
  dist = resolve(root, dist);
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    console.error(`jtk schema: no build at ${dist}`);
    return 1;
  }

  const height = unboundedHeights(root);
  if (height !== '') {
    console.error(`\njtk schema: the styles do not follow the rules the panel draws the page by\n\n  ✗ ${height}`);
    return capped(1 + before);
  }

  const disagreements = pagesAgainst({ files: await readJtk(root), schema, dist });

  // Built again under a path, into a directory that is thrown away (served.mjs).
  if (!flag('dist') && !existsSync(join(root, 'astro.config.mjs'))) {
    console.log('not an Astro project: the second build under a path is skipped — build with SITE_URL=https://x.invalid/p/check/ and run again with --dist <dir> to prove the addresses');
  }
  if (!flag('dist') && existsSync(join(root, 'astro.config.mjs'))) {
    const { prefix, out, leaks, failed } = prefixBuild(root);
    rmSync(out, { recursive: true, force: true });
    if (leaks !== undefined && leaks.length > 0) {
      console.error(`\njtk schema: built under ${prefix}, and ${leaks.length} address(es) still point at the root\n`);
      for (const leak of leaks.slice(0, 20)) console.error(`  ✗ ${leak.page}: ${leak.address}`);
      if (leaks.length > 20) console.error(`  … and ${leaks.length - 20} more`);
      console.error("\nThe studio's preview serves this build under /p/<slug>/, where every address above leaves the site.\nWrite them through src/lib/under.ts — including the ones that arrive as data.");
      return capped(leaks.length + before);
    }
    if (leaks !== undefined) console.log(`built again under ${prefix} — every address it emits stays inside the site`);
    if (failed !== undefined) {
      console.error('\njtk schema: this site does not build when it is served under a path');
      console.error(failed);
      return 1;
    }
  }

  if (disagreements.length > 0) {
    console.error('\njtk schema: the schema and the page disagree\n');
    for (const one of disagreements) console.error(`  ✗ ${one}`);
    console.error('\nA field declared and not rendered is a control that edits nothing.');
    console.error('A field rendered and not declared is text the owner cannot touch.');
    return capped(disagreements.length + before);
  }
  console.log(`checked against ${dist} — the schema and the page agree`);

  // Every sentence is the owner's or the design's (served.mjs, `unowned`).
  const loose = [];
  for (const page of builtPages(dist)) {
    for (const one of unowned(readFileSync(page, 'utf8'))) {
      if (!loose.some((seen) => seen.words === one.words)) loose.push(one);
    }
  }
  if (loose.length > 0) {
    console.error(`\njtk schema: ${loose.length} sentence(s) on the page belong to nobody\n`);
    for (const one of loose.slice(0, 30)) console.error(`  ✗ <${one.where}>  ${one.words.length > 70 ? `${one.words.slice(0, 67)}…` : one.words}`);
    if (loose.length > 30) console.error(`  … and ${loose.length - 30} more`);
    console.error(`
Each one is the owner's or the design's, and the repository has to say which:
declare the owner's — in the shared text where they are on every page — and
annotate them through the door; mark the design's data-jtk-fixed.`);
    return capped(loose.length + before);
  }
  console.log('every sentence on the page belongs to somebody');
  return capped(before);
}

// Run as a script — `node lib/schema.mjs`, as the dev server runs it — and
// not when imported by `jtk` or `jtkit`, which call `main` themselves.
if (process.argv[1] !== undefined && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
