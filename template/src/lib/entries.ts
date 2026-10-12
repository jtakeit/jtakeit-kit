import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { base, under } from './under';
import { getCollection, render } from 'astro:content';
import { BLOCKS, COLLECTIONS, words, type Collection, type Field } from '../content/blocks';
import { langOf, withLocale } from './locale';
import {
  ancestors,
  capped,
  descendants,
  grouped,
  groupField,
  pointersInto,
  pointsAtAny,
  refHeadings,
  selectHeadings,
  treeFields,
  type Group,
  type Heading,
} from './groups';

/**
 * Reading a collection: which entries there are, in the order the site lists
 * them, and without the ones nobody has finished.
 *
 * ── two rules live here and nowhere else ────────────────────────────────────
 *
 * **A hidden entry is built and never listed.** It has to be built — that is
 * how its author looks at it before it is out — and it must appear in no
 * listing, no feed and no sitemap. The studio's edge serves such a page only to
 * a session that is editing the site; everybody else gets a 404. So every place
 * that enumerates entries goes through here, and the one that renders a single
 * entry does not.
 *
 * **The order is the collection's own.** `order.by` names a field of the entry
 * and the catalogue has already refused anything that cannot be sorted by —
 * a date or a number, and required. No declaration means the order somebody
 * arranged by hand, which for a set of works is the honest answer.
 */

/**
 * What this file needs of an entry, written out rather than borrowed.
 *
 * The borrowed version was `CollectionEntry<string>`, and it was wrong in the
 * one case that matters most: a site with **no collections at all**. That is
 * not a broken state, it is the state every site is scaffolded in and the state
 * most of them stay in — a landing page has no blog. With `COLLECTIONS` empty,
 * `astro:content` generates the union of collection names as `never`,
 * `CollectionEntry<string>` collapses to `never` too, and every `entry.data`
 * and `entry.id` below stops type-checking against a type that has no
 * properties. Six errors, in the default project.
 *
 * Only `id` and `data` are ever read here, so those are what this says. The
 * cast at the call site is the price, and it is paid in one place.
 */
export type Entry = { id: string; data: Record<string, unknown> };

/** The declaration, by name. */
export function collectionNamed(name: string): Collection {
  const found = COLLECTIONS.find((one) => one.name === name);
  if (found === undefined) {
    // Loud, and at build time. A listing that quietly renders nothing is a page
    // that looks finished and is empty.
    throw new Error(`no collection named "${name}" in src/content/blocks.ts`);
  }
  return found;
}

/**
 * Every entry of a collection, finished or not, in no particular order.
 *
 * This is what the route that *renders* one entry builds its paths from, and
 * it deliberately does not filter by `visible` — see the note in
 * `[...entry].astro`. Everything that *lists* entries goes through `listed`.
 */
export async function everyEntry(name: string): Promise<Entry[]> {
  return (await getCollection(name as never)) as unknown as Entry[];
}

/**
 * An entry's body, rendered.
 *
 * `render()` wants the `CollectionEntry` astro:content generates, and `Entry`
 * above is a hand-written subset of it — the same object at runtime, a
 * narrower type at build time. The cast that bridges those two lives here, in
 * one place, rather than at every route that renders a body.
 */
export async function rendered(entry: Entry) {
  return render(entry as never);
}

/** Every entry of a collection, listable, in order. */
/** The slug an entry shares across its languages: `de/first-look` is `first-look`. */
export function slugOf(entry: Entry): string {
  const locale = String(entry.data.locale ?? '');
  return locale === '' ? entry.id : entry.id.slice(locale.length + 1);
}

/** The entries of one language — the site's own for `''` — in the collection's order, the unfinished ones dropped. */
export async function listed(name: string, locale = ''): Promise<Entry[]> {
  const collection = collectionNamed(name);
  // `as never` for the same reason: with no collections the parameter's type is
  // `never`, and a string is not assignable to it. The name has already been
  // checked against COLLECTIONS by collectionNamed above.
  const all = (await getCollection(name as never)) as unknown as Entry[];

  const out = all.filter((entry) => entry.data.visible !== false && String(entry.data.locale ?? '') === locale);
  const by = collection.order?.by;
  if (by === undefined || by === 'manual') return out;

  out.sort((a, b) => compare(a.data[by], b.data[by]));
  return collection.order?.desc === true ? out.reverse() : out;
}

/**
 * Every entry with a page of its own, listable. Feeds the sitemap, the feeds
 * and llms.txt — which list addresses, and an entry of a collection without
 * pages (a rate, a table) has none: it is a row of its collection's listing.
 */
export async function allListed(locale = ''): Promise<{ collection: Collection; entries: Entry[] }[]> {
  return Promise.all(
    COLLECTIONS.filter((collection) => collection.pages !== false).map(async (collection) => ({
      collection,
      entries: await listed(collection.name, locale),
    })),
  );
}

/** Where one entry lives. `id` is the file's name under the collection. */
/** The entry's address: `/blog/first-look`, or `/de/blog/first-look` for its German. */
export function href(collection: Collection, entry: Entry): string {
  return `${base()}${routeOf(collection, entry)}/`;
}

/** The route Astro builds for an entry, without the base: `de/blog/first-look`. */
export function routeOf(collection: Collection, entry: Entry): string {
  const locale = String(entry.data.locale ?? '');
  return `${locale === '' ? '' : `${locale}/`}${collection.prefix.replace(/^\//, '')}/${slugOf(entry)}`;
}

/** The other languages this entry exists in, as `<Layout alternates>` wants them. */
export async function alternatesOf(collection: Collection, entry: Entry): Promise<{ locale: string; path: string }[]> {
  const slug = slugOf(entry);
  const all = (await getCollection(collection.name as never)) as unknown as Entry[];
  const found = all
    .filter((one) => slugOf(one) === slug && one.data.visible !== false)
    .map((one) => ({ locale: String(one.data.locale ?? ''), path: `/${routeOf(collection, one)}` }));
  return found.length > 1 ? found : [];
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

/*
 * ── groups, trees and what points at an entry ───────────────────────────────
 *
 * The rules are `groups.ts`'s (wiki/78 of the platform, 12 October 2026); what
 * is here is the reading — which entries, in which language, by `listed()`, so
 * a hidden entry heads nothing, is under nothing and points at nothing.
 */

/** The fields of a collection's entry type. */
export function fieldsOf(collection: Collection): Field[] {
  return BLOCKS.find((one) => one.type === collection.type)?.fields ?? [];
}

/**
 * The annotation for an entry's title drawn on *another* page — a heading of
 * a listing, a row of an archive — or `undefined` where the title is not the
 * owner's to tap there, and the words are drawn `data-jtk-fixed`.
 *
 * `page:<address>:blocks[0].title`, the convention every listing already
 * follows (docs/collections.md): the admin resolves it against the entry's
 * own document, whether that entry has a page or is a row of its listing.
 */
export function titlePath(collection: Collection, entry: Entry): string | undefined {
  const title = fieldsOf(collection).find((one) => one.key === 'title');
  if (title === undefined || title.client_editable === false || title.no_tap_target === true) return undefined;
  return `page:/${routeOf(collection, entry)}:blocks[0].title`;
}

/**
 * The entries of a grouped collection under their headings — or `undefined`
 * for a collection that declares no `group`, which a listing draws flat.
 *
 * A select's headings are its options' labels in the page's language; a
 * ref's are the titles of the referenced collection's entries, in that
 * collection's order, the site's own language standing in for a category
 * not translated yet. What has no group, or one that is not a heading (a
 * renamed option, a hidden category), comes last under none.
 */
export async function groupsOf(collection: Collection, entries: Entry[], locale = ''): Promise<Group<Entry>[] | undefined> {
  const field = groupField(collection, fieldsOf(collection));
  if (field === undefined) return undefined;

  let headings: Heading[];
  if (field.kind === 'select') {
    headings = selectHeadings(field, (text) => words(text, langOf(locale)));
  } else {
    const target = COLLECTIONS.find((one) => one.name === field.ref);
    if (target === undefined) return undefined;
    headings = refHeadings(
      await listed(target.name, locale),
      locale === '' ? [] : await listed(target.name, ''),
      slugOf,
      (one) => titlePath(target, one),
    );
  }
  return grouped(entries, field.key, headings);
}

/** One collection's entries pointing at an entry, as many as its page shows, and how many more there are. */
export interface Referrers {
  collection: Collection;
  entries: Entry[];
  more: number;
}

/**
 * What points at an entry from the other collections: a category's services,
 * a tag's posts, a master's reviews — the archive an entry's page lists.
 *
 * Through a top-level `ref` or a `ref` in the rows of a list (tags). In the
 * order of `COLLECTIONS`, each collection's entries in its own order, in the
 * entry's language, hidden ones left out, and at most the referencing
 * collection's `per_page` of them (`capped` says why not pages of their own).
 * A collection's own entries pointing into it are a tree — see `treeOf`.
 *
 * Where the entry's collection is a tree, what points at any category under
 * it counts as pointing at it (12 October 2026): `beauty`'s page lists the
 * gel manicure filed under `nails/gel`. Once each, however many of the
 * categories it names, and still in its own collection's order — the walk
 * picks *which* entries, `listed()` has already said in what order.
 */
export async function referrersOf(collection: Collection, entry: Entry): Promise<Referrers[]> {
  const locale = String(entry.data.locale ?? '');
  const slug = slugOf(entry);
  const tree = await treeIn(collection, locale);
  const below = tree === undefined ? [] : descendants(slug, tree.parentOf, tree.known);
  const slugs = new Set([slug, ...below]);
  const out: Referrers[] = [];
  for (const other of COLLECTIONS) {
    if (other.name === collection.name) continue;
    const pointers = pointersInto(collection.name, fieldsOf(other));
    if (pointers.length === 0) continue;
    const found = (await listed(other.name, locale)).filter((one) => pointsAtAny(one, pointers, slugs));
    if (found.length === 0) continue;
    const { shown, more } = capped(found, other.per_page);
    out.push({ collection: other, entries: shown, more });
  }
  return out;
}

/**
 * A collection's tree in one language, for a walk: who is whose parent, and
 * which entries may be walked through (listed, so not hidden).
 *
 * The site's own language stands in for an entry not translated yet, as it
 * does for a group's heading: a German page of `beauty` still finds the
 * services under `nails/gel` when only `beauty` has been written in German.
 * `undefined` for a collection that is no tree.
 */
async function treeIn(collection: Collection, locale: string): Promise<{ parentOf: Map<string, string>; known: Set<string> } | undefined> {
  const field = treeFields(collection, fieldsOf(collection))[0];
  if (field === undefined) return undefined;
  const own = locale === '' ? [] : await listed(collection.name, '');
  const parentOf = new Map<string, string>();
  const known = new Set<string>();
  for (const one of [...own, ...(await listed(collection.name, locale))]) {
    const slug = slugOf(one);
    known.add(slug);
    const parent = one.data[field.key];
    if (typeof parent === 'string' && parent !== '') parentOf.set(slug, parent);
    else parentOf.delete(slug);
  }
  return { parentOf, known };
}

/**
 * Where an entry sits in a tree its collection makes with a `ref` into
 * itself (`parent: ref categories`): the trail from the root down to its
 * parent, and its children in the collection's order. Empty for a collection
 * that is no tree, and for a root with no children.
 */
export async function treeOf(collection: Collection, entry: Entry): Promise<{ trail: Entry[]; children: Entry[]; more: number }> {
  const field = treeFields(collection, fieldsOf(collection))[0];
  if (field === undefined) return { trail: [], children: [], more: 0 };
  const locale = String(entry.data.locale ?? '');
  const all = await listed(collection.name, locale);
  const bySlug = new Map(all.map((one) => [slugOf(one), one]));
  const parentOf = new Map<string, string>();
  for (const one of all) {
    const parent = one.data[field.key];
    if (typeof parent === 'string') parentOf.set(slugOf(one), parent);
  }
  const slug = slugOf(entry);
  // The entry itself may be hidden and still built (it is being looked at
  // before it is out), so its own parent is read off it, not off the list.
  const own = entry.data[field.key];
  if (typeof own === 'string') parentOf.set(slug, own);
  const trail = ancestors(slug, parentOf, new Set(bySlug.keys()))
    .map((one) => bySlug.get(one)!)
    .reverse();
  const { shown, more } = capped(all.filter((one) => one.data[field.key] === slug && slugOf(one) !== slug), collection.per_page);
  return { trail, children: shown, more };
}

/*
 * ── a collection's listing, and its pages ───────────────────────────────────
 *
 * Every collection is listed at its prefix (12 October 2026). One without
 * pages always was (`[...listing].astro`, which the platform frames to show
 * an entry); one with pages is listed there too now, unless the repository
 * wrote a listing of its own — the blog's `src/pages/[...lang]/blog/index.astro`
 * is one — which then owns the address, and its pages, whole.
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
 * nested by hand, `jtk/content/works/page/2.json`, and the build refuses it
 * by name (`listingPages`) rather than drawing one of the two.
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
  const at = collection.prefix.replace(/^\//, '');
  const pages = join(process.cwd(), 'src', 'pages');
  return [
    join(pages, '[...lang]', at, 'index.astro'),
    join(pages, '[...lang]', `${at}.astro`),
    join(pages, at, 'index.astro'),
    join(pages, `${at}.astro`),
  ].some((file) => existsSync(file));
}

/** Whether the scaffold lists a collection with pages at its prefix (`[...listing].astro`). */
export function listsPaged(collection: Collection): boolean {
  return collection.pages !== false && !ownListing(collection);
}

/** A collection's listing in a language, page `n`: `/works/`, `/de/works/page/2/`. */
export function listingHref(collection: Collection, locale: string, n = 1): string {
  const first = `${under(withLocale(locale, collection.prefix))}/`;
  return n <= 1 ? first : `${first}page/${n}/`;
}

/** The route a listing's page 1 is built at, without the base: `de/works`. */
export function listingRoute(collection: Collection, locale: string): string {
  return withLocale(locale, collection.prefix).replace(/^\//, '');
}

/**
 * A collection's entries in the order its listing draws them, and how many
 * to a page.
 *
 * The order is `listed()`'s, and for a grouped collection heading by heading
 * first — so a page is cut out of the grouped list, a heading's entries stay
 * together across the cut, and page two opens under the heading page one
 * closed with. Without a `per_page` (or 0) it is one page however long.
 */
export async function listingPages(collection: Collection, locale: string): Promise<{ entries: Entry[]; size: number; last: number }> {
  for (const one of await everyEntry(collection.name)) {
    if (slugOf(one).startsWith('page/')) {
      throw new Error(
        `${collection.name}: the entry "${one.id}" sits at ${collection.prefix}/${slugOf(one)}, which is the address of a page of the ` +
          `collection's listing (${collection.prefix}/page/<n>) — move the file out of a folder called "page" (docs/collections.md)`,
      );
    }
  }
  const all = await listed(collection.name, locale);
  const runs = await groupsOf(collection, all, locale);
  const entries = runs === undefined ? all : runs.flatMap((run) => run.entries);
  const size = collection.per_page !== undefined && collection.per_page > 0 ? collection.per_page : Number.POSITIVE_INFINITY;
  return { entries, size, last: Math.max(1, Math.ceil(entries.length / size)) };
}
