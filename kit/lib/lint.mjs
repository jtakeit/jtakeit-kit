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
 * a site can run it on its own `dist/` before any push (`jtkit lint`, core
 * wiki/71 · §3.2): the same checks, the same codes, the same sentences, and
 * every finding at once rather than one build round each.
 *
 * `lint()` returns findings rather than printing and exiting, so a script, a
 * test and the build can each do what they do with them. The order and the
 * early stops are the build's: a page that says noindex stops the lint, as it
 * stops the build.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { CODES, said } from './build-codes.mjs';
import { collectContent } from './content.mjs';

export { CODES, said };

/**
 * The kinds a person edits by tapping the thing itself. A URL, a boolean or
 * an alt text is edited in the panel beside it, so requiring an annotated
 * element for those would fail every honest template.
 */
export const TAPPABLE = new Set(['text', 'textarea', 'richtext_lite', 'markdown', 'media']);

/** @param {any} field */
function tappable(field) {
  if (!TAPPABLE.has(field.kind)) return false;
  if (field.client_editable === false) return false;
  if (field.no_tap_target === true) return false;
  return true;
}

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
 * @typedef {{ code: string, says: string }} Finding
 * @typedef {{ findings: Finding[], ok: boolean, pages: number, shared: boolean, line: string }} Verdict
 */

/**
 * Lint a built site.
 *
 * @param {object} options
 * @param {string} [options.root]      the site's root, holding `jtk/` — the working directory by default
 * @param {string} [options.dist]      the built pages — `dist` under the root by default
 * @param {string} [options.siteURL]   the address the build is for (`SITE_URL`); empty skips the host checks
 * @param {any}    [options.catalogue] the catalogue, read from `jtk/catalogue.json` when left out
 * @param {any}    [options.content]   the content document, collected from `jtk/` when left out
 * @returns {Promise<Verdict>}
 */
export async function lint(options = {}) {
  const root = options.root ?? process.cwd();
  const distDir = options.dist ?? join(root, 'dist');
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
    const host = hostOf(options.siteURL ?? '');
    const front = await readOrEmpty(join(distDir, 'index.html'));
    if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(front) || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(front)) {
      fault(CODES.NOINDEX, "the front page says noindex — nothing in a page decides whether it is indexed; the edge keeps a preview out of the index, and a build is always made for the site's address");
      return verdict();
    }
    if (disallowsEverybody(await readOrEmpty(join(distDir, 'robots.txt')))) {
      fault(CODES.ROBOTS_DISALLOW, 'robots.txt says Disallow: / for every crawler');
      return verdict();
    }
    const sitemap = await readOrEmpty(join(distDir, 'sitemap.xml'));
    if (sitemap !== '') {
      const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
      const foreign = host === '' ? [] : locs.filter((loc) => hostOf(loc) !== host);
      if (locs.length === 0 || foreign.length > 0) {
        fault(CODES.SITEMAP_EMPTY, locs.length === 0 ? 'sitemap.xml lists no pages' : `sitemap.xml lists pages on ${hostOf(foreign[0])}, and this build is for ${host} (SITE_URL)`);
        return verdict();
      }
    }
    const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(front)?.[1] ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(front)?.[1];
    if (host !== '' && canonical !== undefined && hostOf(canonical) !== '' && hostOf(canonical) !== host) {
      fault(CODES.CANONICAL_ELSEWHERE, `the front page's canonical is on ${hostOf(canonical)}, and this build is for ${host} (SITE_URL)`);
      return verdict();
    }
  }

  const htmlByPath = new Map();
  for (const file of await htmlFiles(distDir)) {
    const rel = '/' + relative(distDir, file).replaceAll('\\', '/');
    htmlByPath.set(rel.replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/', await readFile(file, 'utf8'));
  }

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

  const withShared = content.shared === undefined ? '' : ' and the shared text';
  const out = verdict(findings.length > 0
    ? `${findings.length} unannotated field(s) — the visual editor would silently stop working on them`
    : `every content field on ${content.pages?.length ?? 0} page(s)${withShared} is annotated`);
  out.pages = content.pages?.length ?? 0;
  out.shared = content.shared !== undefined;
  return out;
}

/**
 * The command: print the findings the way the build does, and exit 1 on any.
 * @param {{ root?: string, dist?: string, siteURL?: string }} options
 */
export async function lintCommand(options) {
  const out = await lint(options);
  for (const one of out.findings) console.error('  ' + said(one.code, one.says));
  if (out.line !== '') (out.ok ? console.log : console.error)('  ' + out.line);
  return out.ok ? 0 : 1;
}
