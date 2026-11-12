/**
 * The annotation lint: the built pages against the content and the catalogue.
 *
 * «Every content field carries data-jtk-path» is not a convention — it is a
 * gate. An element that loses its annotation breaks the visual editor
 * SILENTLY: the sheet stops opening when the client taps that heading, and
 * nobody finds out for a week. The lint compares two things it did not write
 * — the content and the HTML the site produced — never the component source,
 * so it works with any template, including one an agent wrote this afternoon.
 *
 * The platform's build runs this lint on every demo build. It is here so that
 * a site can run it on its own `dist/` before any push (`jtkit lint`): the same checks, the same codes, the same sentences, and
 * every finding at once rather than one build round each.
 *
 * `lint()` returns findings rather than printing and exiting, so a script, a
 * test and the build can each do what they do with them. The order and the
 * early stops are the build's: a page that says noindex stops the lint, as it
 * stops the build.
 *
 * A contract-3 tree (`jtk/schema.json` says `contract: 3`) is linted as the
 * build lints one (`lint3`, below): the grammar by key and by id, read
 * through the door. A contract-2 tree is linted as it always was.
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { CODES, said } from './build-codes.mjs';
import { LOCAL } from './codes.mjs';
import { content as door, TAPPABLE, tappable } from './content/index.mjs';
import { unnamed } from './content/identity.mjs';
import { collectContent, contractOf, readJtk } from './content/node.mjs';
import { DOCUMENT_ID, ID, isObject, placesIn, pricePaths } from './places3.mjs';

export { CODES, said, pricePaths };

/**
 * The kinds a person edits by tapping the thing itself — the door's, which
 * are the platform's (`registry/kinds.go`). A URL, a boolean or an alt text
 * is edited in the panel beside it, so requiring an annotated element for
 * those would fail every honest template.
 *
 * This copy used to stop at `media`, while the platform's build lint has
 * always asked for `money` and `duration` too: a price drawn without its
 * path passed here and failed the platform's build (wiki/98 §0, 4).
 */
export { TAPPABLE };

/** @param {string} url */
function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

/** A robots.txt whose `User-agent: *` group says `Disallow: /` and nothing narrower. @param {string} text */
function disallowsEverybody(text) {
  let everybody = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (key.trim().toLowerCase() === 'user-agent') everybody = value === '*';
    else if (everybody && key.trim().toLowerCase() === 'disallow' && value === '/') return true;
  }
  return false;
}

/** @param {string} path */
async function readOrEmpty(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

/** @param {string} dir */
async function htmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

/** Every built page by the address it is served at: dist/about/index.html is /about. @param {string} distDir */
async function builtHTML(distDir) {
  const htmlByPath = new Map();
  for (const file of await htmlFiles(distDir)) {
    const rel = '/' + relative(distDir, file).replaceAll('\\', '/');
    htmlByPath.set(rel.replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/', await readFile(file, 'utf8'));
  }
  return htmlByPath;
}

/** Every path a built page is expected to carry, for one page's blocks. */
export function expectedPaths(blocks, typeOf) {
  /** @type {string[]} */
  const paths = [];
  blocks.forEach((block, index) => {
    const blockType = typeOf(block.type);
    if (blockType === undefined) return;
    for (const field of blockType.fields ?? []) {
      const value = block[field.key];
      if (value === undefined || value === null || value === '') continue;
      if (field.kind === 'media' && field.multiple === true) {
        if (!Array.isArray(value) || !tappable(field)) continue;
        value.forEach((item, itemIndex) => {
          if (item === null || typeof item !== 'object' || !item.src) return;
          paths.push(`blocks[${index}].${field.key}[${itemIndex}].src`);
        });
        continue;
      }
      if (field.kind === 'list') {
        if (!Array.isArray(value)) continue;
        value.forEach((item, itemIndex) => {
          for (const sub of field.of ?? []) {
            const subValue = item[sub.key];
            if (!tappable(sub)) continue;
            if (subValue === undefined || subValue === null || subValue === '') continue;
            paths.push(`blocks[${index}].${field.key}[${itemIndex}].${sub.key}`);
          }
        });
        continue;
      }
      if (tappable(field)) paths.push(`blocks[${index}].${field.key}`);
    }
  });
  return paths;
}

/** Every form on the page that posts to the platform's enquiry endpoint. @param {string} html */
function leadForms(html) {
  const out = [];
  for (const [form] of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)) {
    const action = attrOf(form.slice(0, form.indexOf('>') + 1), 'action') ?? '';
    if (/(^|\/)api\/lead\/?(\?|#|$)/.test(action)) out.push(form);
  }
  return out;
}

/** The names of a form's controls, buttons left out. @param {string} form */
function controlsOf(form) {
  const names = new Set();
  for (const [tag] of form.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)) {
    const type = (attrOf(tag, 'type') ?? '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'reset' || type === 'image') continue;
    const name = attrOf(tag, 'name');
    if (name !== undefined && name !== '') names.add(name);
  }
  return names;
}

/** @param {string} tag @param {string} name */
function attrOf(tag, name) {
  const quoted = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (quoted === null) return undefined;
  return quoted[1] ?? quoted[2] ?? quoted[3];
}

/**
 * Whether a block collects enquiries — as the API judges it, not only as the
 * file says: a catalogue written before `collects` existed says nothing, and
 * a block with a `form` switch is one that can put a form on the page.
 * @param {any} blockType
 */
function collectsEnquiry(blockType) {
  if (blockType === undefined) return false;
  if (blockType.collects === 'enquiry') return true;
  if (blockType.collects !== undefined && blockType.collects !== '') return false;
  return (blockType.fields ?? []).some((field) => field.key === 'form' && field.kind === 'bool');
}

const OWN_CONTROLS = new Set(['name', 'phone', 'email', 'contact', 'message', 'website']);

/**
 * What every build promises search engines, read off the files themselves —
 * the first fault of it, which stops the lint as it stops the build; `null`
 * where the build keeps every promise.
 *
 * @param {string} distDir the built pages
 * @param {string} [siteURL] the address the build is for; empty skips the host checks
 * @returns {Promise<Finding | null>}
 */
async function searchFault(distDir, siteURL) {
  const host = hostOf(siteURL ?? '');
  const front = await readOrEmpty(join(distDir, 'index.html'));
  if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(front) || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(front)) {
    return { code: CODES.NOINDEX, says: "the front page says noindex — nothing in a page decides whether it is indexed; the edge keeps a preview out of the index, and a build is always made for the site's address" };
  }
  if (disallowsEverybody(await readOrEmpty(join(distDir, 'robots.txt')))) {
    return { code: CODES.ROBOTS_DISALLOW, says: 'robots.txt says Disallow: / for every crawler' };
  }
  const sitemap = await readOrEmpty(join(distDir, 'sitemap.xml'));
  if (sitemap !== '') {
    const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    const foreign = host === '' ? [] : locs.filter((loc) => hostOf(loc) !== host);
    if (locs.length === 0 || foreign.length > 0) {
      return { code: CODES.SITEMAP_EMPTY, says: locs.length === 0 ? 'sitemap.xml lists no pages' : `sitemap.xml lists pages on ${hostOf(foreign[0])}, and this build is for ${host} (SITE_URL)` };
    }
  }
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(front)?.[1] ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(front)?.[1];
  if (host !== '' && canonical !== undefined && hostOf(canonical) !== '' && hostOf(canonical) !== host) {
    return { code: CODES.CANONICAL_ELSEWHERE, says: `the front page's canonical is on ${hostOf(canonical)}, and this build is for ${host} (SITE_URL)` };
  }
  return null;
}

/**
 * @typedef {{ code: string, says: string }} Finding
 * @typedef {{ findings: Finding[], ok: boolean, pages: number, shared: boolean, line: string, contract?: 3, entries?: number }} Verdict
 */

/**
 * Lint a built site.
 *
 * @param {object} options
 * @param {string} [options.root]      the site's root, holding `jtk/` — the working directory by default
 * @param {string} [options.dist]      the built pages — `dist` under the root by default
 * @param {string} [options.siteURL]   the address the build is for (`SITE_URL`); empty skips the host checks
 * @param {any}    [options.catalogue] contract 2: the catalogue, read from `jtk/catalogue.json` when left out
 * @param {any}    [options.content]   contract 2: the content document, collected from `jtk/` when left out
 * @param {number} [options.now]       contract 3: the clock an entry's `show_at` and `hide_at` are read against
 * @returns {Promise<Verdict>}
 */
export async function lint(options = {}) {
  const root = options.root ?? process.cwd();
  const distDir = options.dist ?? join(root, 'dist');
  // Which contract the tree is decides what is read, by the door's rule.
  if (contractOf(root) === 3) return lint3({ root, distDir, siteURL: options.siteURL, now: options.now });

  /** @type {Finding[]} */
  const findings = [];
  const fault = (code, says) => findings.push({ code, says });
  const verdict = (line = '') => ({ findings, ok: findings.length === 0, pages: 0, shared: false, line });

  // The catalogue: refused rather than skipped when missing. A lint that
  // quietly passes when it cannot find its catalogue is worse than no lint.
  let registry = options.catalogue;
  if (registry === undefined) {
    const file = join(root, 'jtk', 'catalogue.json');
    try {
      registry = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`could not read ${file}: ${error.message}`);
      fault(CODES.CATALOGUE_MISSING, `no jtk/catalogue.json — this site has no block catalogue, so nothing can check that its content is annotated`);
      return verdict();
    }
  }
  const typeOf = (name) => registry?.blocks?.find((block) => block.type === name);
  const content = options.content ?? (await collectContent(root));

  // What every build promises search engines, read off the files themselves.
  {
    const broken = await searchFault(distDir, options.siteURL);
    if (broken !== null) {
      fault(broken.code, broken.says);
      return verdict();
    }
  }

  const htmlByPath = await builtHTML(distDir);

  // The form against the contract of an enquiry.
  const sharedBlocks = (content.shared ?? []).flatMap((document) => document.blocks ?? []);
  const siteCollects = (registry?.blocks ?? []).some(collectsEnquiry);
  const pageByPath = new Map((content.pages ?? []).map((page) => [page.path, page]));
  const asksOf = (blocks) => {
    const keys = new Set();
    for (const block of blocks) {
      const blockType = typeOf(block.type);
      if (!collectsEnquiry(blockType)) continue;
      for (const ask of blockType.asks ?? []) keys.add(ask.key);
    }
    return keys;
  };
  let formFaults = 0;
  for (const [where, html] of htmlByPath) {
    for (const form of leadForms(html)) {
      const controls = controlsOf(form);
      const page = pageByPath.get(where);
      const near = [...(page?.blocks ?? []), ...sharedBlocks];
      const nearCollects = near.some((block) => collectsEnquiry(typeOf(block.type)));
      if (!nearCollects && !siteCollects) {
        fault(CODES.FORM_UNDECLARED, `${where}: a form posts to /api/lead and no block says collects: "enquiry"`);
        formFaults++;
        continue;
      }
      const asks = nearCollects ? asksOf(near) : asksOf((registry?.blocks ?? []).map((block) => ({ type: block.type })));
      const lacking = [];
      if (!controls.has('name')) lacking.push('a name control');
      if (!controls.has('contact') && !controls.has('phone') && !controls.has('email')) lacking.push('a contact, phone or email control');
      if (!controls.has('website')) lacking.push('the honeypot website');
      if (lacking.length > 0) {
        fault(CODES.FORM_INCOMPLETE, `${where}: the enquiry form has no ${lacking.join(', no ')}`);
        formFaults++;
      }
      for (const control of controls) {
        if (OWN_CONTROLS.has(control) || asks.has(control)) continue;
        fault(CODES.FORM_FIELD_UNDECLARED, `${where}: the enquiry form asks for "${control}" and no block declares it in asks — the inbox would show a key, not a label`);
        formFaults++;
      }
    }
  }
  if (formFaults > 0) return verdict(`${formFaults} enquiry form fault(s)`);

  // The text that is on every page: a shared field the whole site annotates nowhere.
  for (const document of content.shared ?? []) {
    const language = document.locale === undefined ? '' : ` (${document.locale})`;
    for (const path of expectedPaths(document.blocks ?? [], typeOf)) {
      const shared = `shared:${path}`;
      if (![...htmlByPath.values()].some((html) => html.includes(`data-jtk-path="${shared}"`))) {
        fault(CODES.SHARED_NOT_RENDERED, `${shared}${language} is on no page — a shared field nothing renders is a control that edits nothing`);
      }
    }
  }

  // Entries of a collection without pages: on their listing, annotated there.
  const pageless = new Set((registry?.collections ?? []).filter((one) => one.pages === false).map((one) => one.name));
  const everywhere = [...htmlByPath.values()].join('\n');
  // `visible` as collectContent read it: false for `visible: false` and for a
  // schedule not come or gone (schedule.mjs) — a listing leaves both out.
  const listable = (page) => page.visible !== false;
  for (const one of registry?.collections ?? []) {
    if (one.pages !== false) continue;
    const hasEntries = (content.pages ?? []).some((page) => page.collection === one.name && listable(page));
    if (hasEntries && !htmlByPath.has(one.prefix)) {
      fault(CODES.PAGE_NOT_BUILT, `${one.prefix}: the collection "${one.name}" has no pages of its own and lists its entries here, and the build did not produce this page — make the prefix the page that lists them, or build one there`);
    }
  }
  for (const page of content.pages ?? []) {
    if (page.collection !== undefined && pageless.has(page.collection)) {
      if (!listable(page)) continue;
      for (const path of expectedPaths(page.blocks ?? [], typeOf)) {
        if (!everywhere.includes(`data-jtk-path="page:${page.path}:${path}"`)) {
          fault(CODES.UNANNOTATED_FIELD, `${page.path}: ${path} is on no page — an entry without a page of its own has to be annotated on its listing`);
        }
      }
      continue;
    }
    const html = htmlByPath.get(page.path);
    if (html === undefined) {
      const listedOnly = (registry?.collections ?? []).find((one) => one.pages === false && page.path.startsWith(`${one.prefix}/`));
      const hint = page.collection === undefined && listedOnly !== undefined
        ? ` — it sits under the "${listedOnly.name}" collection's prefix and names no collection; an entry says "collection": "${listedOnly.name}" and is annotated on the listing instead`
        : '';
      fault(CODES.PAGE_NOT_BUILT, `${page.path}: the content has this page and the build did not produce it${hint}`);
      continue;
    }
    for (const path of expectedPaths(page.blocks ?? [], typeOf)) {
      if (!html.includes(`data-jtk-path="${path}"`)) fault(CODES.UNANNOTATED_FIELD, `${page.path}: ${path} is not annotated`);
    }
  }

  // A tile that names a page nobody has, or a field that page has not got.
  const CROSS = /data-jtk-path="page:([^:"]*):([^"]+)"/g;
  for (const [where, html] of htmlByPath) {
    for (const [, address, inner] of html.matchAll(CROSS)) {
      const named = pageByPath.get(address);
      if (named === undefined) {
        fault(CODES.ANNOTATION_UNKNOWN, `${where}: annotates page:${address}: and this site has no such page`);
        continue;
      }
      if (!expectedPaths(named.blocks ?? [], typeOf).includes(inner)) {
        fault(CODES.ANNOTATION_UNKNOWN, `${where}: annotates ${inner} on ${address}, which that page's document has no field for`);
      }
    }
  }

  // A value held in an attribute the editor writes as it is typed
  // (data-jtk-bind="data-starts:blocks[0].night_starts") — a mirror of the
  // platform's annotation lint: the field exists, and the attribute is data-.
  const BOUND = /data-jtk-bind="([^"]*)"/g;
  const BOUND_PATH = /^(shared:)?blocks\[(\d+)\]\.([a-z][a-z0-9_]*)(?:\[\d+\]\.([a-z][a-z0-9_]*))?$/;
  const declares = (blocks, path) => {
    const found = BOUND_PATH.exec(path);
    if (found === null) return false;
    const block = blocks[Number(found[2])];
    const field = block === undefined ? undefined : typeOf(block.type)?.fields.find((one) => one.key === found[3]);
    if (field === undefined) return false;
    if (found[4] === undefined) return true;
    return field.kind === 'list' && (field.of ?? []).some((one) => one.key === found[4]);
  };
  for (const [where, html] of htmlByPath) {
    const own = pageByPath.get(where)?.blocks ?? [];
    for (const [, pairs] of html.matchAll(BOUND)) {
      for (const pair of pairs.split(/\s+/).filter(Boolean)) {
        const cut = pair.indexOf(':');
        const name = cut < 1 ? '' : pair.slice(0, cut);
        const path = pair.slice(cut + 1);
        if (!/^data-[a-z0-9-]+$/.test(name)) {
          fault(CODES.ANNOTATION_UNKNOWN, `${where}: binds "${pair}" — a bind is data-<name>:<path>, and the editor writes only data- attributes`);
        } else if (!declares(path.startsWith('shared:') ? sharedBlocks : own, path)) {
          fault(CODES.ANNOTATION_UNKNOWN, `${where}: binds ${name} to ${path}, which this page's document has no field for`);
        }
      }
    }
  }

  const withShared = content.shared === undefined ? '' : ' and the shared text';
  const out = verdict(findings.length > 0
    ? `${findings.length} unannotated field(s) — the visual editor would silently stop working on them`
    : `every content field on ${content.pages?.length ?? 0} page(s)${withShared} is annotated`);
  out.pages = content.pages?.length ?? 0;
  out.shared = content.shared !== undefined;
  return out;
}

// ── contract 3 ─────────────────────────────────────────────────────────────

/**
 * The same gate over a contract-3 tree, as the platform's build lints one
 * (`sitebuild/annotation-lint.mjs`, `lint3`: jtakeit-core #186, wiki/98
 * §16 · 6) — in its order, with its stops and its sentences, read through
 * the door rather than off the document the build collects:
 *
 *   - what stops the build before it builds, when it collects the content
 *     (`collect-content.mjs`, `collect3`): a `jtk/catalogue.json` beside
 *     `jtk/schema.json`, contract 2's `jtk/content/`, a document that is not
 *     an object, an entry of a collection the schema does not declare — in
 *     the build's words and with no code, as the build says them. A
 *     translation stops nothing since M3: it is laid over its original by
 *     the door, and `jtk schema` judges what it holds;
 *   - the promises to search engines, as on contract 2;
 *   - `dist/_meta.json` in the shape the platform reads, `drafts` gone (§6):
 *     JTK_E_META_INVALID, which stops it;
 *   - every page and entry named by an `id`, every block, row and picture by
 *     a `_key` (§15 · 12): JTK_E_UNNAMED, each with its file and its fix;
 *   - the enquiry form, where only `collects: "enquiry"` collects (§3.2);
 *   - every filled value the owner taps (`client_editable: true`, §3.3)
 *     annotated where it is drawn, by key, in every language the site has
 *     (an annotation names no language, §5): a page's on the page; an entry's
 *     on its own page, or — with none — as `entry:<id>:…` wherever it is
 *     shown, and the page its collection's `shown_on` names built; a shared
 *     one somewhere;
 *   - every `page:<id>:` and `entry:<id>:` naming a document by an id its
 *     file carries, and a place that document declares;
 *   - every `data-jtk-bind` and `data-jtk-href` naming a place, by key, in
 *     the page's own document or the shared text (§5).
 *
 * Then one check the build does not make and the platform's preflight makes
 * at the launch (`currencyCheck`, backend/mcp): a price drawn says the site's
 * currency — `site.json`'s, at its top (§6, §15 · 14) — or none. It is marked
 * JTK_LOCAL, as the kit marks what the build has no code for.
 *
 * @param {{ root: string; distDir: string; siteURL?: string; now?: number }} input
 * @returns {Promise<Verdict>}
 */
async function lint3({ root, distDir, siteURL, now }) {
  /** @type {Finding[]} */
  const findings = [];
  const fault = (code, says) => findings.push({ code, says });
  const verdict = (line = '') => ({ findings, ok: findings.length === 0, pages: 0, shared: false, line, contract: /** @type {3} */ (3), entries: 0 });

  // What the build's collection of the content refuses, before anything is
  // built: said as it says it, and the lint goes no further.
  if (existsSync(join(root, 'jtk', 'catalogue.json'))) {
    throw new Error(
      "jtk/ holds both schema.json and catalogue.json, and a tree is in one contract: schema.json is contract 3's file and catalogue.json contract 2's (wiki/98 §16). " +
        'A site moved to contract 3 keeps schema.json alone — remove jtk/catalogue.json (git rm jtk/catalogue.json); one that has not moved keeps catalogue.json alone — remove jtk/schema.json',
    );
  }
  const files = await readJtk(root);
  {
    const strays = Object.keys(files).filter((name) => name.startsWith('/jtk/content/'));
    if (strays.length > 0) {
      throw new Error(
        `${strays[0].slice(1)}${strays.length > 1 ? ` and ${strays.length - 1} more` : ''}: jtk/content/ is contract 2's, and this tree says contract 3 (jtk/schema.json) — a page is under jtk/pages/, an entry under jtk/entries/<collection>/. ` +
          'Move them there (`jtk upgrade contract-3` does), or the template, reading contract 3, shows none of them',
      );
    }
    for (const [name, body] of Object.entries(files)) {
      if (/^\/jtk\/(pages|entries|modules)\//.test(name) || name === '/jtk/shared.json') {
        if (!isObject(body)) throw new Error(`${name.slice(1)} is not a document — a JSON object is`);
      }
    }
  }
  const schema = files['/jtk/schema.json'];
  const site = door(files, { now });
  const documents = site.documents();
  const own = documents.filter((one) => one.locale === '');
  const sharedBlocks = site.sharedDocuments().find((one) => one.locale === '')?.blocks ?? [];
  const { types, collections, blockPlaces, entryPlaces, declares } = placesIn(schema, sharedBlocks);
  for (const one of own) {
    if (one.collection !== undefined && !collections.has(one.collection)) {
      throw new Error(`${one.file.slice(1)}: the schema declares no collection "${one.collection}" — an entry is one of a collection jtk/schema.json declares, which says where its entries are; declare it, or move the entry`);
    }
  }

  {
    const broken = await searchFault(distDir, siteURL);
    if (broken !== null) {
      fault(broken.code, broken.says);
      return verdict();
    }
  }

  {
    const faults = await metaFaults(distDir);
    if (faults.length > 0) {
      for (const one of faults) fault(CODES.META_INVALID, `dist/_meta.json: ${one}`);
      return verdict();
    }
  }

  // Names (§15 · 12): what has none can be annotated by nothing. The rest is
  // read all the same, as the build reads it.
  for (const one of unnamed(files)) fault(CODES.UNNAMED, one.says);

  // In the build's order: the home first, then by address; entries by
  // collection, then by slug. Every language's (M3): a page and an entry are
  // built at their address in each language they are in, and annotated
  // there by the same places — an annotation names no language (§5), and a
  // translated page that drops one is a page the owner cannot tap in that
  // language. The site's own language first, each language in the schema's
  // order, as the door hands them.
  const languages = ['', ...site.locales.slice(1)];
  const byLanguage = (a, b) => languages.indexOf(a.locale) - languages.indexOf(b.locale);
  const pages = documents
    .filter((one) => one.collection === undefined)
    .sort((a, b) => byLanguage(a, b) || (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const entries = documents
    .filter((one) => one.collection !== undefined)
    .sort((a, b) => byLanguage(a, b) || (a.collection !== b.collection ? (a.collection < b.collection ? -1 : 1) : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const pagesById = new Map(own.filter((one) => one.collection === undefined && one.id !== '').map((one) => [one.id, one]));
  const entriesById = new Map(own.filter((one) => one.collection !== undefined && one.id !== '').map((one) => [one.id, one]));

  const htmlByPath = await builtHTML(distDir);
  const everywhere = [...htmlByPath.values()].join('\n');
  // Whose document a built page is: a page's, or an entry's own.
  const documentAt = new Map();
  for (const one of [...pages, ...entries]) {
    if (typeof one.path === 'string' && !documentAt.has(one.path)) documentAt.set(one.path, { document: one, entry: one.collection !== undefined });
  }

  // The form against the contract of an enquiry, as contract 2's.
  {
    const collects = (type) => type?.collects === 'enquiry';
    const siteCollects = [...types.values()].some(collects);
    const asksOf = (blocks) => {
      const keys = new Set();
      for (const block of blocks) {
        const type = types.get(block?.type);
        if (!collects(type)) continue;
        for (const ask of Array.isArray(type.asks) ? type.asks : []) keys.add(ask.key);
      }
      return keys;
    };
    let formFaults = 0;
    const formFault = (code, says) => {
      fault(code, says);
      formFaults++;
    };
    for (const [where, html] of htmlByPath) {
      for (const form of leadForms(html)) {
        const controls = controlsOf(form);
        const blocks = documentAt.get(where)?.document.blocks;
        const near = [...(Array.isArray(blocks) ? blocks : []), ...sharedBlocks];
        const nearCollects = near.some((block) => collects(types.get(block?.type)));
        if (!nearCollects && !siteCollects) {
          formFault(CODES.FORM_UNDECLARED, `${where}: a form posts to /api/lead and no block says collects: "enquiry"`);
          continue;
        }
        const asks = asksOf(nearCollects ? near : [...types.keys()].map((type) => ({ type })));
        const lacking = [];
        if (!controls.has('name')) lacking.push('a name control');
        if (!controls.has('contact') && !controls.has('phone') && !controls.has('email')) lacking.push('a contact, phone or email control');
        if (!controls.has('website')) lacking.push('the honeypot website');
        if (lacking.length > 0) formFault(CODES.FORM_INCOMPLETE, `${where}: the enquiry form has no ${lacking.join(', no ')}`);
        for (const control of controls) {
          if (OWN_CONTROLS.has(control) || asks.has(control)) continue;
          formFault(CODES.FORM_FIELD_UNDECLARED, `${where}: the enquiry form asks for "${control}" and no block declares it in asks — the inbox would show a key, not a label`);
        }
      }
    }
    if (formFaults > 0) return verdict(`${formFaults} enquiry form fault(s)`);
  }

  // The shared text: each of its fields somewhere on the site.
  for (const place of blockPlaces(sharedBlocks, 'shared:')) {
    if (!everywhere.includes(`data-jtk-path="${place}"`)) fault(CODES.SHARED_NOT_RENDERED, `${place} is on no page — a shared field nothing renders is a control that edits nothing`);
  }

  // Each page, built and annotated.
  for (const page of pages) {
    const html = htmlByPath.get(page.path);
    if (html === undefined) {
      fault(CODES.PAGE_NOT_BUILT, `${page.path}: the content has this page and the build did not produce it`);
      continue;
    }
    for (const place of blockPlaces(page.blocks)) {
      if (!html.includes(`data-jtk-path="${place}"`)) fault(CODES.UNANNOTATED_FIELD, `${page.path}: ${place} is not annotated`);
    }
  }

  // Each entry: on its own page where it has one — hidden or not, since its
  // page is built either way — and, where it has none, named by its id
  // wherever it is shown, unless it is hidden and so shown nowhere.
  for (const entry of entries) {
    const what = `${entry.collection} "${entry.slug}"`;
    if (typeof entry.path === 'string') {
      const html = htmlByPath.get(entry.path);
      if (html === undefined) {
        fault(CODES.PAGE_NOT_BUILT, `${entry.path}: the content has this page, ${what}'s own, and the build did not produce it`);
        continue;
      }
      for (const place of entryPlaces(entry)) {
        if (!html.includes(`data-jtk-path="${place}"`)) fault(CODES.UNANNOTATED_FIELD, `${entry.path}: ${place} is not annotated`);
      }
      continue;
    }
    if (!entry.shown || !ID.test(entry.id ?? '')) continue;
    for (const place of entryPlaces(entry)) {
      const tile = `entry:${entry.id}:${place}`;
      if (!everywhere.includes(`data-jtk-path="${tile}"`)) {
        fault(CODES.UNANNOTATED_FIELD, `${entry.anchor ?? what}: ${tile} is on no page — ${what} has no page of its own, and has to be annotated where it is shown`);
      }
    }
  }

  // And where an entry without a page is shown has to be a page the build
  // made: its collection's first `shown_on`, where it has entries to show.
  {
    const shownAt = new Map();
    for (const entry of entries) {
      if (typeof entry.path === 'string' || !entry.shown || typeof entry.anchor !== 'string') continue;
      const page = entry.anchor.split('#')[0] || '/';
      if (!shownAt.has(page)) shownAt.set(page, entry.collection);
    }
    for (const [page, collection] of shownAt) {
      if (!htmlByPath.has(page)) {
        fault(CODES.PAGE_NOT_BUILT, `${page}: the collection "${collection}" shows its entries here (its shown_on), and the build did not produce this page — build it, or name in shown_on the page that shows them`);
      }
    }
  }

  // A tile of another document: a page or an entry by its id, never by an address.
  for (const [where, html] of htmlByPath) {
    for (const [, path] of html.matchAll(/data-jtk-path="((?:page|entry):[^"]*)"/g)) {
      const found = DOCUMENT_ID.exec(path);
      if (found === null) {
        fault(CODES.ANNOTATION_UNKNOWN, `${where}: annotates ${path}, which names no document by its id — contract 3 names another page or an entry by its id: page:<id>:… and entry:<id>:…`);
        continue;
      }
      const [, kind, id, place] = found;
      const document = (kind === 'page' ? pagesById : entriesById).get(id);
      if (document === undefined) fault(CODES.ANNOTATION_UNKNOWN, `${where}: annotates ${kind}:${id}: and this site has no such ${kind}`);
      else if (place.startsWith('shared:') || !declares(document, place, kind === 'entry')) {
        fault(CODES.ANNOTATION_UNKNOWN, `${where}: annotates ${place} on ${kind}:${id}, which that ${kind}'s document has no field for`);
      }
    }
  }

  // A value the page holds in an attribute, and a link the owner sets: both
  // in the page's own document or the shared text, by key.
  for (const [where, html] of htmlByPath) {
    const mine = documentAt.get(where);
    for (const [, pairs] of html.matchAll(/data-jtk-bind="([^"]*)"/g)) {
      for (const pair of pairs.split(/\s+/).filter(Boolean)) {
        const cut = pair.indexOf(':');
        const name = cut < 1 ? '' : pair.slice(0, cut);
        const path = pair.slice(cut + 1);
        if (!/^data-[a-z0-9-]+$/.test(name)) fault(CODES.ANNOTATION_UNKNOWN, `${where}: binds "${pair}" — a bind is data-<name>:<path>, and the editor writes only data- attributes`);
        else if (!declares(mine?.document, path, mine?.entry === true)) fault(CODES.ANNOTATION_UNKNOWN, `${where}: binds ${name} to ${path}, which this page's document has no field for`);
      }
    }
    for (const [, path] of html.matchAll(/data-jtk-href="([^"]*)"/g)) {
      if (!declares(mine?.document, path, mine?.entry === true)) fault(CODES.ANNOTATION_UNKNOWN, `${where}: leads a link to where ${path} says, which this page's document has no field for`);
    }
  }

  const theBuilds = findings.length;
  const prices = priceFaults(htmlByPath, schema, site.currency);
  findings.push(...prices);

  const lines = [];
  if (theBuilds > 0) lines.push(`${theBuilds} unannotated field(s) — the visual editor would silently stop working on them`);
  if (prices.length > 0) lines.push(`${prices.length} price(s) in a currency that is not the site's — the platform's preflight refuses them at the launch`);
  const withShared = sharedBlocks.length > 0 ? ' and the shared text' : '';
  const out = verdict(lines.length > 0 ? lines.join('; ') : `every content field on ${pages.length} page(s) and ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}${withShared} is annotated`);
  out.pages = pages.length;
  out.entries = entries.length;
  out.shared = sharedBlocks.length > 0;
  return out;
}

/**
 * What the build tells the platform beside its pages, `dist/_meta.json`, in
 * the shape the platform reads it (§6) — the build's `checkMeta3`, a fault
 * to a sentence: `redirects`, `immutable` and `cache`, and nothing else. A
 * build that writes no `_meta.json` declares nothing.
 *
 * @param {string} distDir
 * @returns {Promise<string[]>}
 */
async function metaFaults(distDir) {
  const raw = await readOrEmpty(join(distDir, '_meta.json'));
  if (raw === '') return [];
  const faults = [];
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (error) {
    faults.push(`it is not JSON: ${error.message}`);
  }
  if (meta !== undefined && !isObject(meta)) faults.push('it is not an object of redirects, immutable and cache');
  if (!isObject(meta)) return faults;
  for (const key of Object.keys(meta)) {
    if (key === 'drafts') {
      faults.push(`"drafts" is contract 2's — on contract 3 which entries a visitor may not see is the platform's to say, from each entry's visible and its moments, for every build; leave it out`);
    } else if (!['redirects', 'immutable', 'cache'].includes(key)) {
      faults.push(`"${key}" is no key of it — the platform reads redirects, immutable and cache, and nothing else`);
    }
  }
  const listOf = (key) => {
    if (meta[key] === undefined) return [];
    if (Array.isArray(meta[key])) return meta[key];
    faults.push(`"${key}" is not a list`);
    return [];
  };
  listOf('redirects').forEach((one, i) => {
    if (!isObject(one) || typeof one.from !== 'string' || !one.from.startsWith('/') || typeof one.to !== 'string' || one.to === '') {
      faults.push(`redirects[${i}] is not {"from": "/an/address", "to": "<where it leads>"}`);
    } else if (one.status !== undefined && ![301, 302, 303, 307, 308].includes(one.status)) {
      faults.push(`redirects[${i}].status is ${JSON.stringify(one.status)} — a redirect's status is 301, 302, 303, 307 or 308`);
    }
  });
  listOf('immutable').forEach((one, i) => {
    if (typeof one !== 'string' || one.replace(/^\/+|\/+$/g, '') === '') {
      faults.push(`immutable[${i}] is ${JSON.stringify(one)} — a directory whose files are named by their contents, like "/_astro/", never the whole site`);
    }
  });
  const cache = listOf('cache');
  if (cache.length > 32) faults.push(`cache has ${cache.length} rules, and the edge reads the first 32`);
  cache.forEach((one, i) => {
    if (!isObject(one) || typeof one.prefix !== 'string' || one.prefix.replace(/^\/+|\/+$/g, '') === '') {
      faults.push(`cache[${i}] names no directory — {"prefix": "/clips/", "maxAge": 86400}, never the whole site`);
    } else if (typeof one.maxAge !== 'number' || !Number.isFinite(one.maxAge) || one.maxAge < 0) {
      faults.push(`cache[${i}].maxAge is ${JSON.stringify(one.maxAge)} — a number of seconds, 0 or more`);
    }
  });
  return faults;
}

// ── a price's currency ─────────────────────────────────────────────────────
//
// The platform's preflight check, asked of the built pages before the push
// (backend/mcp/src/handlers.ts, `currencyCheck`, wiki/98 §11): a site has one
// currency, in `site.json` — at its top on contract 3 (§6), never in a value
// (`{"minor": 4500}`, §3.4). The agent gives it once, there or as
// create_site's `currency`, and an import takes it while the site has none;
// after that a person changes it in the panel (jtakeit-core #212). A page
// that writes a code or a sign of its own goes on saying francs after the
// business changed to euros, while the diary and the payment are in euros.
// What it reads is the preflight's: every element annotated with a money
// field of the schema, by its path from the block down (a list's rows, and a
// row's own list, included), and the currency codes and signs in its text.

const PRICED = /<([a-z][a-z0-9]*)\b[^>]*\sdata-jtk-path\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
const HOW = "draw a price with site.money(), which says it in the site's currency, and never write a code or a sign into the page; the currency is the site's, given once (\"currency\" at the top of jtk/site.json while the site has none, or create_site's `currency`) and changed after by a person, in the panel";

/**
 * Every price drawn in another currency than the site's, one finding each.
 * @param {Map<string, string>} htmlByPath @param {any} schema @param {string} currency the site's, upper case; `''` for none
 */
function priceFaults(htmlByPath, schema, currency) {
  const paths = pricePaths(schema.blocks);
  if (paths.size === 0) return [];
  const own = new Set([currency, ...signsOf(currency)].filter((one) => one !== ''));
  const out = [];
  const told = new Set();
  for (const [where, html] of htmlByPath) {
    for (const match of html.matchAll(PRICED)) {
      if (!paths.has(placeOf(match[2]))) continue;
      const text = match[3].replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
      const foreign = marksIn(text).filter((mark) => !own.has(mark));
      const shown = `${where}: «${text.slice(0, 40)}»`;
      if (foreign.length === 0 || told.has(shown)) continue;
      told.add(shown);
      out.push({
        code: LOCAL,
        says: currency === ''
          ? `${shown} is a price in ${foreign[0]}, and the site has no currency — jtk/site.json says none, so the diary and a payment have none: ${HOW}`
          : `${shown} is a price in ${foreign[0]}, and the site prices in ${currency} (jtk/site.json): ${HOW}`,
      });
    }
  }
  return out;
}

const INDEXED = /^blocks\[(?:0|[1-9]\d{0,2})\]\.([a-z][a-z0-9_]{0,39})(?:\[(?:0|[1-9]\d{0,2})\]\.([a-z][a-z0-9_]{0,39}))?$/;
const KEYED = /^(?:blocks\[[a-z][a-z0-9-]{0,31}\]\.)?([a-z][a-z0-9_]{0,39})(?:\[[a-z][a-z0-9-]{0,31}\]\.([a-z][a-z0-9_]{0,39})(?:\[[a-z][a-z0-9-]{0,31}\]\.([a-z][a-z0-9_]{0,39}))?)?(?:\.(?:src|alt|focus|poster))?$/;
const ADDRESS = /^\/([a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*)?$/;

/**
 * An annotation's place in its block, in either grammar (§5), as
 * `pricePaths` says one — the preflight's `placeOf`: the document and the
 * block left off, then the field and each row's field; a picture's part is
 * the picture's. `''` for an annotation the grammar does not read.
 *
 *   blocks[2].rates[1].costs               → rates.costs
 *   page:<id>:blocks[b1].rates[r2].costs   → rates.costs
 *   entry:<id>:costs                       → costs   (an entry's own field)
 */
export function placeOf(annotation) {
  let rest = annotation.trim();
  let grammar = 0;
  if (rest.startsWith('shared:')) rest = rest.slice('shared:'.length);
  else {
    const named = /^(page|entry|module):([^:]*):/.exec(rest);
    if (named !== null) {
      const [, kind, name] = named;
      if (kind === 'page' && ADDRESS.test(name)) grammar = 2;
      else if (kind !== 'module' && ID.test(name)) grammar = 3;
      else if (kind === 'module' && /^[a-z][a-z0-9_]{0,39}$/.test(name)) grammar = 3;
      else return '';
      rest = rest.slice(named[0].length);
    }
  }
  if (grammar !== 3) {
    const two = INDEXED.exec(rest);
    if (two !== null) return [two[1], two[2]].filter((one) => one !== undefined).join('.');
    if (grammar === 2) return '';
  }
  const three = KEYED.exec(rest);
  return three === null ? '' : [three[1], three[2], three[3]].filter((one) => one !== undefined).join('.');
}

/** The signs a currency is written with, narrow and not, in a few languages. @param {string} code */
function signsOf(code) {
  if (code === '') return [];
  const out = new Set();
  for (const locale of ['en', 'de', 'fr', 'it', 'uk', 'ru', 'es', 'pt']) {
    for (const display of ['narrowSymbol', 'symbol']) {
      try {
        const part = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: display }).formatToParts(1).find((one) => one.type === 'currency')?.value;
        if (part !== undefined) out.add(part.trim());
      } catch {
        // A code Intl does not know has only itself.
      }
    }
  }
  return [...out];
}

/** Words that are also codes — «ALL services», «TOP» — are words. */
const WORDS = new Set(['ALL', 'TOP', 'CUP', 'MAD', 'SOS', 'TRY', 'PEN', 'MOP', 'BOB', 'GEL', 'BAM', 'ANG', 'LAK']);
const SIGNS = ['€', '$', '£', '¥', '₴', '₽', '₺', '₹', '₪', '₩', 'zł', 'Kč', 'Fr.', 'kr'];

/** The currency codes and signs in a price's text. @param {string} text */
function marksIn(text) {
  const out = [];
  for (const code of text.match(/\b[A-Z]{3}\b/g) ?? []) if (!WORDS.has(code) && isCurrency(code)) out.push(code);
  for (const sign of SIGNS) if (text.includes(sign)) out.push(sign);
  return out;
}

/** @param {string} code */
function isCurrency(code) {
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return /^[A-Z]{3}$/.test(code) && (typeof Intl.supportedValuesOf !== 'function' || Intl.supportedValuesOf('currency').includes(code));
  } catch {
    return false;
  }
}

/**
 * The command: print the findings the way the build does, and exit 1 on any.
 * @param {{ root?: string, dist?: string, siteURL?: string }} options
 */
/**
 * The files under a built directory the platform never publishes: a path with
 * a segment that starts with a dot, `.well-known/` at the root aside — the
 * rule the platform's upload and edge keep. A directory is said
 * once, with a slash.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function withheldIn(dir) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} at @param {string} rel */
  async function walk(at, rel) {
    let entries;
    try {
      entries = await readdir(at, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = rel === '' ? entry.name : `${rel}/${entry.name}`;
      const dotted = entry.name.startsWith('.') && !(rel === '' && entry.name === '.well-known');
      if (dotted) out.push(entry.isDirectory() ? `${path}/` : path);
      else if (entry.isDirectory()) await walk(join(at, entry.name), path);
    }
  }
  await walk(dir, '');
  return out.sort();
}

export async function lintCommand(options) {
  const out = await lint(options);
  // Said, and not a failure: the platform leaves these out of the upload and
  // its preflight fails the site until a build without them is served. Here
  // they are caught before the push, which is when they are cheapest.
  const withheld = await withheldIn(options.dist ?? join(options.root ?? process.cwd(), 'dist'));
  if (withheld.length > 0) {
    console.error(`  not published: ${withheld.join(', ')} — a path starting with a dot is never served (.well-known/ aside). It comes from the repository (usually public/): remove it there, and change any secret it held — it is in the history.`);
  }
  for (const one of out.findings) console.error('  ' + said(one.code, one.says));
  if (out.line !== '') (out.ok ? console.log : console.error)('  ' + out.line);
  return out.ok ? 0 : 1;
}
