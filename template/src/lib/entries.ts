import { base } from './under';
import { getCollection, render } from 'astro:content';
import { COLLECTIONS, type Collection } from '../content/blocks';

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
