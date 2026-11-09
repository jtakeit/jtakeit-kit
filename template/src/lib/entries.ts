import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getEntry, render } from 'astro:content';
import { drawsPagedListing, type Collection, type Entry } from '@jtakeit/kit/content';
import { storeId } from './entryLoader';
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
  if (stored === undefined) throw new Error(`${entry.collection}: ${entry.slug} (${entry.locale || 'the site’s own language'}) was not loaded — see src/lib/entryLoader.ts`);
  const { Content } = await render(stored);
  return { Content, texts: ((stored.data as { texts?: Record<number, string> }).texts ?? {}) };
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

/** A collection's listing in a language, page `n`: `/works/`, `/de/works/page/2/`. */
export function listingHref(name: string, locale: string, n = 1): string {
  return `${under(site.listingOf(name, locale, n))}/`;
}

/**
 * An entry's title as it is drawn on another page — a tile, a row of an
 * archive, a crumb of a trail: its words (its slug where nobody titled it),
 * and its annotation where the title is the owner's to tap, drawn
 * `data-jtk-fixed` where it is not.
 */
export function titleOf(entry: Entry): { text: string; at: { 'data-jtk-path'?: string }; fixed: boolean } {
  const title = entry.fields.value('title');
  const tappable = entry.fields.tappable('title');
  return { text: String(title ?? entry.slug), at: tappable ? entry.elsewhere.fields.at('title') : {}, fixed: !tappable };
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
 * alone. Read off the files, at build time, so writing one is the whole of
 * taking a listing over.
 */
export function ownListing(collection: Collection): boolean {
  const at = site.listingOf(collection.name, '').replace(/^\//, '');
  const pages = join(process.cwd(), 'src', 'pages');
  return [
    join(pages, '[...lang]', at, 'index.astro'),
    join(pages, '[...lang]', `${at}.astro`),
    join(pages, at, 'index.astro'),
    join(pages, `${at}.astro`),
  ].some((file) => existsSync(file));
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
