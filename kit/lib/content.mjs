/**
 * The published content as one document, from the files in `jtk/`.
 *
 * The content lives in the repository as one file per page, because that is
 * what makes a diff readable; everything that reads it — the build, the
 * annotation lint — wants one document, because that is what a template
 * renders from. This is the seam between the two, the same one the platform's
 * build runs (`collect-content.mjs`), here so that `jtkit lint` can read a
 * working tree the way the build will. Nothing over the network.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { shownAt } from './schedule.mjs';

/** @param {string} path */
async function readJSON(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`${path}: ${error.message}`);
  }
}

/** Every content file under a directory, at any depth, sorted. @param {string} root */
async function contentFiles(root) {
  /** @type {string[]} */
  const found = [];
  async function walk(/** @type {string} */ current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json')) found.push(path);
    }
  }
  await walk(root);
  return found.sort();
}

/**
 * Which language a shared file is, out of its name: `shared.json` the site's
 * own, `shared.de.json` German; null for a file that is not one.
 * @param {string} name
 */
export function sharedLocaleOf(name) {
  const match = /^shared(?:\.([a-z]{2}(?:-[a-z]{2})?))?\.json$/.exec(name);
  return match === null ? null : (match[1] ?? '');
}

/**
 * The document the build renders from. `jtk/site.json` is what publish writes;
 * a working tree before its first publish has none, and the lint reads it
 * anyway with the site's facts left empty — the annotations do not depend on
 * them.
 * @param {string} root the site's root, holding `jtk/`
 * @param {{ dir?: string; now?: number }} [options] `dir`: where `jtk/` is, relative to the root; `now`: the clock a `show_at`/`hide_at` is read against
 */
export async function collectContent(root, options = {}) {
  const now = options.now ?? Date.now();
  const dir = join(root, options.dir ?? 'jtk');
  const site = (await readJSON(join(dir, 'site.json'))) ?? {};
  const pages = [];
  for (const file of await contentFiles(join(dir, 'content'))) {
    const page = await readJSON(file);
    if (page === null) continue;
    if (typeof page.path !== 'string') throw new Error(`${file}: no "path" — cannot tell which page this is`);
    const collected = { path: page.path, seo: page.seo ?? {}, blocks: page.blocks ?? [] };
    if (typeof page.collection === 'string' && page.collection !== '') {
      collected.collection = page.collection;
      // Hidden by `visible: false`, or by a schedule not come or gone
      // (schedule.mjs) — read by the clock of this check, as the platform's
      // build reads it by its own.
      collected.visible = shownAt(page, now);
    }
    pages.push(collected);
  }
  pages.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));

  const shared = [];
  for (const name of (await readdir(dir).catch(() => [])).sort()) {
    const locale = sharedLocaleOf(name);
    if (locale === null) continue;
    const file = await readJSON(join(dir, name));
    if (file?.blocks?.length) shared.push({ ...(locale === '' ? {} : { locale }), blocks: file.blocks });
  }

  return {
    schema_version: site.schema_version ?? 1,
    content_rev: site.content_rev ?? 0,
    site: {
      slug: site.slug ?? '',
      locale: site.locale ?? 'uk',
      media_base: site.media_base ?? '',
      business: site.business ?? {},
    },
    pages,
    ...(shared.length > 0 ? { shared } : {}),
  };
}
