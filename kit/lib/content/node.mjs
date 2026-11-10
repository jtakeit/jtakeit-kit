/**
 * The files the door reads, from a disk — for the readers that run in Node.
 *
 * In a template the files come from Vite's glob, which is what keeps a dev
 * server reloading a page when one of them changes. The Astro loader, the
 * kit's lint, `jtkit progress` and the dev diary have no Vite to ask: they
 * read the working tree, and `readJtk` hands them the same map the glob hands
 * a page — every `.json` under `jtk/`, keyed `/jtk/…`, parsed — so all of them
 * read it through one door and agree about what it says.
 *
 *   import { content } from '@jtakeit/kit/content';
 *   import { readJtk } from '@jtakeit/kit/content/node';
 *   const site = content(await readJtk());
 */
import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { content } from './index.mjs';
import { mint } from './identity.mjs';

/**
 * Which contract a working tree is in, by the door's rule (index.mjs): 3
 * where `jtk/schema.json` parses and says `contract: 3`, 2 for anything else
 * — a `jtk/catalogue.json`, no schema at all, or a `schema.json` saying
 * another contract, which the door does not read (wiki/98 §15 · 25).
 *
 * Synchronous, and asked before anything is written: the writers of
 * contract 2's files — `jtk catalogue`, a kit laid out, the scaffold — stop
 * short of a contract-3 tree, where the platform refuses `jtk/catalogue.json`
 * beside `jtk/schema.json` (wiki/98 §16).
 *
 * @param {string} [root] the site's root, holding `jtk/` — the working directory by default
 * @param {{ dir?: string }} [options] `dir`: where `jtk/` is, relative to the root
 * @returns {2 | 3}
 */
export function contractOf(root = process.cwd(), options = {}) {
  let schema;
  try {
    schema = JSON.parse(readFileSync(join(root, options.dir ?? 'jtk', 'schema.json'), 'utf8'));
  } catch {
    // No schema.json, or none that parses: not contract 3's file.
    return 2;
  }
  return schema !== null && typeof schema === 'object' && !Array.isArray(schema) && schema.contract === 3 ? 3 : 2;
}

/**
 * Every `.json` under a site's `jtk/`, parsed, keyed by its path from the
 * site's root — `/jtk/content/index.json`, as Vite's glob keys them.
 *
 * Two things are left out. A `media/` directory holds the pictures a build
 * downloads beside an entry, and is no content. `jtk/session.json` is the dev
 * session's watch key (`jtkit session`): nothing the door reads, and nothing
 * a reader of the content should be handed.
 *
 * A file that is not JSON is an error with its name in it, as it is to the
 * platform's import: a reader that skipped it would answer for a site the
 * platform will refuse.
 *
 * @param {string} [root] the site's root, holding `jtk/` — the working directory by default
 * @param {{ dir?: string }} [options] `dir`: where `jtk/` is, relative to the root; the keys still say `/jtk/`
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readJtk(root = process.cwd(), options = {}) {
  const top = join(root, options.dir ?? 'jtk');
  /** @type {Record<string, unknown>} */
  const files = {};
  async function walk(at, rel) {
    let entries;
    try {
      entries = await readdir(at, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
      throw error;
    }
    for (const entry of entries) {
      const name = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'media') await walk(join(at, entry.name), name);
        continue;
      }
      if (!entry.name.endsWith('.json') || name === 'session.json') continue;
      const file = join(at, entry.name);
      try {
        files[`/jtk/${name}`] = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        throw new Error(`${file}: ${error.message}`);
      }
    }
  }
  await walk(top, '');
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * A contract-3 working tree's names written in where they are missing: an
 * `id` on each page and entry, a `_key` on each block, row and picture
 * (identity.mjs, wiki/98 §15 · 12). Each file that changed is written back
 * whole, two spaces to a level, its keys in their order with the new name
 * first; nothing else is touched. Nothing at all on a tree that is not
 * contract 3.
 *
 * @param {string} [root] the site's root, holding `jtk/`
 * @param {{ dir?: string }} [options] `dir`: where `jtk/` is, relative to the root
 * @returns {Promise<{ file: string; place: string; what: 'id' | 'key' }[]>} what was minted, file by file
 */
export async function mintJtk(root = process.cwd(), options = {}) {
  const dir = options.dir ?? 'jtk';
  const { files, minted } = mint(await readJtk(root, { dir }));
  for (const [key, document] of Object.entries(files)) {
    await writeFile(join(root, dir, key.slice('/jtk/'.length)), `${JSON.stringify(document, null, 2)}\n`);
  }
  return minted;
}

/**
 * The content as one document, the shape the platform's build collects
 * (`collect-content.mjs`) and its annotation lint reads — here so that
 * `jtkit lint` and `jtkit progress` read a working tree the way the build
 * will. Read through the door, so the kit's checks find a page, an entry and
 * a language exactly as the scaffold renders them.
 *
 * `jtk/site.json` is what publish writes; a working tree before its first
 * publish has none, and the lint reads it anyway with the site's facts left
 * empty — the annotations do not depend on them.
 *
 * @param {string} root the site's root, holding `jtk/`
 * @param {{ dir?: string; now?: number }} [options] `dir`: where `jtk/` is, relative to the root; `now`: the clock a `show_at`/`hide_at` is read against
 */
export async function collectContent(root, options = {}) {
  const files = await readJtk(root, { dir: options.dir });
  const site = content(files, { now: options.now });
  const facts = /** @type {any} */ (files['/jtk/site.json']) ?? {};

  const pages = site.documents().map((doc) => {
    const collected = { path: doc.path, seo: doc.seo, blocks: doc.blocks };
    if (doc.collection !== undefined) {
      collected.collection = doc.collection;
      // Hidden by `visible: false`, or by a schedule not come or gone
      // (schedule.mjs) — read by the clock of this check, as the platform's
      // build reads it by its own.
      collected.visible = doc.shown;
    }
    return collected;
  });
  pages.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));

  const shared = site
    .sharedDocuments()
    .filter((one) => one.blocks.length > 0)
    .sort((a, b) => (a.file < b.file ? -1 : 1))
    .map((one) => ({ ...(one.locale === '' ? {} : { locale: one.locale }), blocks: one.blocks }));

  return {
    schema_version: facts.schema_version ?? 1,
    content_rev: facts.content_rev ?? 0,
    site: {
      slug: facts.slug ?? '',
      locale: facts.locale ?? 'uk',
      media_base: facts.media_base ?? '',
      business: facts.business ?? {},
    },
    pages,
    ...(shared.length > 0 ? { shared } : {}),
  };
}
