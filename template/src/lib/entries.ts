import { base } from './under';
import { getCollection, render } from 'astro:content';
import { BLOCKS, COLLECTIONS, words, type Collection, type Field } from '../content/blocks';
import { langOf } from './locale';
import {
  ancestors,
  capped,
  grouped,
  groupField,
  pointersInto,
  pointsAt,
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
 */
export async function referrersOf(collection: Collection, entry: Entry): Promise<Referrers[]> {
  const locale = String(entry.data.locale ?? '');
  const slug = slugOf(entry);
  const out: Referrers[] = [];
  for (const other of COLLECTIONS) {
    if (other.name === collection.name) continue;
    const pointers = pointersInto(collection.name, fieldsOf(other));
    if (pointers.length === 0) continue;
    const found = (await listed(other.name, locale)).filter((one) => pointsAt(one, pointers, slug));
    if (found.length === 0) continue;
    const { shown, more } = capped(found, other.per_page);
    out.push({ collection: other, entries: shown, more });
  }
  return out;
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
