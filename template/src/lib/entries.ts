import { getEntry, render } from 'astro:content';
import { createComponent, renderTemplate, unescapeHTML } from 'astro/runtime/server/index.js';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { drawsPagedListing, type Collection, type Entry } from '@jtakeit/kit/content';
import { draft, fromBucket } from '@jtakeit/kit/live';
import { PAGE_FILES } from 'virtual:jtk/build';
import { HAST_PLUGINS } from '../../markdown.mjs';
import { sourceOf, storeId } from './entryLoader';
import { site } from './site';
import { under } from './under';

/**
 * A collection's entries, as this site draws them — what is left here once
 * the door reads them.
 *
 * ── what the door says, and what this file says ─────────────────────────────
 *
 * Which entries a collection has, in which language, in what order, which of
 * them are out, where each one lives, its headings, its tree and what points
 * at it: those are the platform's rules, and `site` answers them
 * (`@jtakeit/kit/content`, src/lib/site.ts). Two rules used to live here and
 * nowhere else — **a hidden entry is built and never listed**, and **the
 * order is the collection's own** — and they still hold, in the door:
 * `site.entries(name, { locale })` is what every listing, feed and sitemap
 * enumerates, and `{ all: true }` is what the route that renders one entry
 * builds its pages from.
 *
 * What is this site's: the address under the build's base path, which only
 * Astro knows; whether the repository wrote a listing page of its own; and an
 * entry's body as HTML, which the site's own markdown pipeline renders
 * (`entryLoader.ts`).
 */

export type { Collection, Entry };

/**
 * An entry's body, rendered by this site's pipeline: `Content` for its own
 * prose, and the HTML of each run of prose below it, by its place in `body`.
 */
export async function bodyOf(entry: Entry): Promise<{ Content: Awaited<ReturnType<typeof render>>['Content']; texts: Record<number, string> }> {
  const stored = await getEntry('jtk', storeId(entry));
  // A draft rendered live (src/lib/site.ts): the body the build rendered
  // where the draft's words are the build's, and drawn now where they are
  // not — an entry added since, or its words changed.
  if (draft() !== undefined && (stored === undefined || (stored.data as { source?: string }).source !== sourceOf(entry))) return drawnNow(entry);
  if (stored === undefined) throw new Error(`${entry.collection}: ${entry.slug} (${entry.locale || 'the site’s own language'}) was not loaded — see src/lib/entryLoader.ts`);
  const { Content } = await render(stored);
  return { Content, texts: ((stored.data as { texts?: Record<number, string> }).texts ?? {}) };
}

/**
 * An entry's body drawn at request time, by the pipeline the loader renders
 * it with (`markdown.mjs`): under the panel's live preview only, for words no
 * build has rendered. A picture in it is the bucket's file as it is, where a
 * build would have fetched and optimised it (`fromBucket`).
 */
let pipeline: ReturnType<typeof createSatteriMarkdownProcessor> | undefined;
async function drawnNow(entry: Entry): Promise<{ Content: Awaited<ReturnType<typeof render>>['Content']; texts: Record<number, string> }> {
  pipeline ??= createSatteriMarkdownProcessor({ hastPlugins: HAST_PLUGINS });
  const renderer = await pipeline;
  const pictures = (markdown: string) => markdown.replace(/(\]\()\.?\/?(media\/[^)\s]+)/g, (whole, open: string, key: string) => `${open}${fromBucket(key) ?? key}`);
  const value = entry.fields.value('body');
  const { code } = await renderer.render(pictures(typeof value === 'string' ? value : ''), { frontmatter: {} });
  const texts: Record<number, string> = {};
  for (const [at, block] of entry.body.entries()) {
    if (block.type !== 'text') continue;
    const prose = block.value('body');
    texts[at] = (await renderer.render(typeof prose === 'string' ? prose : '', { frontmatter: {} })).code;
  }
  const Content = createComponent(() => renderTemplate`${unescapeHTML(code)}`);
  return { Content: Content as unknown as Awaited<ReturnType<typeof render>>['Content'], texts };
}

/**
 * Where a link to an entry goes: its page — `/blog/first-look/`, under the
 * build's base — or, for an entry of a collection without pages, its row on
 * the listing (`[...listing].astro` gives each row the id).
 */
export function href(entry: Entry): string {
  if (entry.address !== undefined) return `${under(entry.address)}/`;
  const [listing, id] = (entry.anchor ?? '').split('#');
  return `${under(listing ?? '/')}/#${id ?? ''}`;
}

/** The id of an entry's row on its listing: `services-cut`. */
export function rowId(entry: Entry): string {
  return (entry.anchor ?? '').split('#')[1] ?? '';
}

/**
 * A collection's listing in a language, page `n`: `/works/`, `/de/works/page/2/`.
 * `undefined` where it has none — a contract-3 collection that declares no
 * listing (the door's `listingOf`).
 */
export function listingHref(name: string, locale: string, n = 1): string | undefined {
  const listing = site.listingOf(name, locale, n);
  return listing === undefined ? undefined : `${under(listing)}/`;
}

/**
 * An entry's title as it is drawn on another page — a tile, a row of an
 * archive, a crumb of a trail: its words (its slug where nobody titled it),
 * and its annotation where the title is the owner's to tap, drawn
 * `data-jtk-fixed` where it is not.
 */
export function titleOf(entry: Entry): { text: string; at: { 'data-jtk-path'?: string; lang?: string }; fixed: boolean } {
  const title = entry.fields.value('title');
  const tappable = entry.fields.tappable('title');
  // The original's words, where nobody translated them, carry its language.
  const lang = entry.fields.lang('title');
  return { text: String(title ?? entry.slug), at: { ...(tappable ? entry.elsewhere.fields.at('title') : {}), ...lang }, fixed: !tappable };
}

/*
 * ── a collection's listing, and its pages ───────────────────────────────────
 *
 * A collection without pages is always listed at its prefix
 * (`[...listing].astro`, which the platform frames to show an entry). One with
 * pages is listed there only when it says `listing: true` — opt-in, because a
 * page nobody asked for is an address on a client's site nobody designed
 * (`drawsPagedListing`, the door's) — and not even then where the repository
 * wrote a listing of its own at the prefix (the blog's
 * `src/pages/[...lang]/blog/index.astro`), which owns the address, and its
 * pages, whole.
 *
 * ── why page 2 is `<prefix>/page/2` and not `<prefix>/2` ────────────────────
 *
 * Everything under a prefix is an entry's address: `/works/2` is the page of
 * an entry whose slug is `2`, and the platform takes `2` for a slug (its
 * slugs are `[a-z0-9]+(-[a-z0-9]+)*`, a bare number included) — an owner who
 * numbers her works would collide with the listing on her second page, and
 * the build would draw one of them and drop the other. A slug the platform
 * makes has no `/` in it, so `/works/page/2` is nobody's: an entry called
 * `page` lives at `/works/page` beside it. The one way to collide is a file
 * nested by hand, `jtk/content/works/page/2.json`, and the door refuses it by
 * name (`site.listingPages`) rather than drawing one of the two.
 *
 * A collection without pages is one page whatever its `per_page`: the panel
 * frames its prefix to show any of its entries, and an entry on page two is
 * one the frame cannot find.
 */

/**
 * Whether the repository wrote a listing page of its own at a collection's
 * prefix — `src/pages/[...lang]/blog/index.astro` for `/blog`, or
 * `src/pages/works.astro` for `/works` — which the scaffold's then leaves
 * alone. Read off the files the build found, so writing one is the whole of
 * taking a listing over.
 */
export function ownListing(collection: Collection): boolean {
  const listing = site.listingOf(collection.name, '');
  if (listing === undefined) return false;
  const at = listing.replace(/^\//, '');
  // The files of src/pages, as the build found them (jtakeit-meta.mjs): read
  // off the disk while a page rendered, they were there only where the
  // renderer ran in the checkout (jtakeit-core wiki/89 §9.2).
  return [`[...lang]/${at}/index.astro`, `[...lang]/${at}.astro`, `${at}/index.astro`, `${at}.astro`].some((file) => PAGE_FILES.includes(file));
}

/**
 * Whether the scaffold lists a collection with pages at its prefix
 * (`[...listing].astro`): only one that says `listing: true` and has no page
 * of the repository's there.
 */
export function listsPaged(collection: Collection): boolean {
  return drawsPagedListing(collection, ownListing(collection));
}

/** Whether «And 3 more» links to a collection's listing (the door's rule). */
export { linksToListing } from '@jtakeit/kit/content';
