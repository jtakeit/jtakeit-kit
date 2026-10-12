/**
 * `_meta.json` — what the edge needs to know that the HTML cannot say — and
 * the specimen pages, whose addresses two things have to agree on.
 *
 * Cloudflare Pages read `_redirects` and `_headers` out of the build. The
 * platform serves sites from its own Worker instead, and this file is what
 * replaced them: one small object beside the pages, written by the build.
 *
 * ── drafts, and why the list has to exist ───────────────────────────────────
 *
 * An entry nobody has finished is **built** — that is how its author looks at
 * it before it is out — and it is in no listing, no feed and no sitemap. What
 * stops a stranger reading it is the edge, and the edge is serving static
 * objects: it has no way to tell a draft from a page except to be told. This
 * is being told.
 *
 * ── the specimens, which have no file at all ────────────────────────────────
 *
 * The build also draws one page per arrangement, so that the panel can lift
 * this site's own markup for a block a post has just been given. They are
 * generated from the declaration rather than written, so looking for their
 * documents finds nothing — and a draft nobody can find is a draft the edge
 * hands to anybody. Listed here, derived the same way the site derives them.
 *
 * ── immutable, which directory is the build's own ───────────────────────────
 *
 * The files whose name carries a hash of their contents are cached by the
 * edge for a year and never revalidated, and under the preview's slug a
 * script's reference to one is put under the slug. Where they live is the
 * generator's to say: `/_astro/` for Astro, `/_next/static/` for a Next
 * export, `/_app/immutable/` for SvelteKit, `/assets/` for Vite. A build that
 * says nothing is taken to be Astro's. Never a directory with an unhashed
 * file in it — it would be stuck in browsers for a year.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { shownAt } from './schedule.mjs';

/** The id of one specimen, which is also its address under the collection. */
export function specimenId(type, view) {
  return view === undefined || view === '' ? `_fl-${type}` : `_fl-${type}-${view}`;
}

/**
 * Every specimen this site builds, as addresses.
 *
 * One per arrangement of every type a post may hold — and one per language,
 * because a preview of a Russian post must lift its markup from a Russian
 * page: anything else puts the wrong words and an address that does not
 * exist around the block.
 *
 * @param {{ prefix: string; body?: string[] }[]} collections
 * @param {{ type: string; views?: { key: string }[] }[]} blocks
 * @param {string[]} [locales] the site's languages besides its own
 * @returns {string[]}
 */
export function specimenAddresses(collections, blocks, locales = []) {
  const out = [];
  for (const collection of collections) {
    for (const kind of collection.body ?? []) {
      const type = blocks.find((one) => one.type === kind);
      if (type === undefined) continue;
      for (const view of type.views ?? [undefined]) {
        const id = specimenId(kind, view?.key);
        for (const locale of ['', ...locales]) {
          const at = locale === '' ? collection.prefix : `/${locale}${collection.prefix}`;
          out.push(`${at}/${id}/`);
        }
      }
    }
  }
  return out.sort();
}

/**
 * Every entry whose document says it is not on the site yet, as addresses.
 *
 * A document, not frontmatter: an entry is a page of blocks in a `.json`
 * file. Only an entry carries `visible` at all; a page has none and is not a
 * draft. `=== false` and not falsy: absent means listed — and so does a
 * schedule that has come and not gone (`shownAt`, schedule.mjs): a `show_at`
 * still ahead or a `hide_at` behind is a draft at the moment of the build,
 * as it is on the platform, which writes it `visible: false` before building.
 *
 * @param {string} [root] where the content is, `jtk/content` under the working directory
 * @param {number} [now] the clock a schedule is read against, the build's by default
 * @returns {Promise<string[]>}
 */
export async function hiddenEntries(root = join(process.cwd(), 'jtk', 'content'), now = Date.now()) {
  const out = [];
  const walk = async (at) => {
    let entries;
    try {
      entries = await readdir(at, { withFileTypes: true });
    } catch {
      return; // a site with no content directory is a site with no drafts
    }
    for (const entry of entries) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) {
        // The pictures the build downloaded beside an entry.
        if (entry.name !== 'media') await walk(full);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      let document;
      try {
        document = JSON.parse(await readFile(full, 'utf8'));
      } catch {
        continue; // unreadable JSON is the build's error to report, not this one
      }
      // A schedule is an entry's (it names its collection); a page carries
      // none, and `visible: false` is read wherever it is written, as before.
      const isEntry = typeof document?.collection === 'string' && document.collection !== '';
      if (document?.visible === false || (isEntry && !shownAt(document, now))) {
        const name = relative(root, full).split(sep).join('/').replace(/\.json$/, '');
        out.push(`/${name}/`);
      }
    }
  };
  await walk(root);
  return out.sort();
}

/**
 * The whole file, assembled: the drafts from the content, the specimens from
 * the declaration, the hashed directory from the generator.
 *
 * @param {object} what
 * @param {string} [what.root]                 the content root, `jtk/content` by default
 * @param {{ prefix: string; body?: string[] }[]} [what.collections]
 * @param {{ type: string; views?: { key: string }[] }[]} [what.blocks]
 * @param {string[]} [what.locales]
 * @param {string[]} [what.immutable]          e.g. `['/_astro/']`
 * @param {{ from: string; to: string; status?: number }[]} [what.redirects]
 * @returns {Promise<{ redirects: object[]; drafts: string[]; immutable?: string[] }>}
 */
export async function buildMeta({ root, collections = [], blocks = [], locales = [], immutable, redirects = [] } = {}) {
  const drafts = [...(await hiddenEntries(root)), ...specimenAddresses(collections, blocks, locales)].sort();
  const meta = { redirects, drafts };
  if (Array.isArray(immutable) && immutable.length > 0) meta.immutable = immutable;
  return meta;
}

/**
 * Writes `_meta.json` into a build directory — whatever happens, empty lists
 * and all, because a missing file and an empty one mean different things to
 * whoever is debugging.
 *
 * @param {string} dir   the build directory, `dist/`
 * @param {Parameters<typeof buildMeta>[0]} what
 * @returns {Promise<{ redirects: object[]; drafts: string[]; immutable?: string[] }>}
 */
export async function writeMeta(dir, what = {}) {
  const meta = await buildMeta(what);
  await writeFile(join(dir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');
  return meta;
}
