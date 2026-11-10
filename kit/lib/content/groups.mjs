/**
 * Groups, trees and the entries that point at one — the taxonomies a site has
 * without a taxonomy feature.
 *
 * ── three patterns, no new kind ─────────────────────────────────────────────
 *
 * There is no "category" or "tag" in the catalogue, on purpose: every one of
 * them is a collection and a `ref`, which the platform already stores, lists,
 * translates and orders.
 *
 *   **A group.** A collection's `group` names a field of the entry type, and
 *   that field is a `select` — the repository names the sections — or a `ref`
 *   to *another* collection — the owner adds a category in the panel, titles
 *   it in every language and orders it. The headings follow the select's
 *   options, or the referenced collection's own order.
 *
 *   **A tree.** A `ref` into its own collection — `parent: ref categories` —
 *   is a hierarchy. The platform refuses a loop where a value is written, but
 *   a repository can be edited by hand, so every walk here is bounded too.
 *
 *   **Tags.** Many-to-many is a `list` whose row is one `ref` —
 *   `tags: list of { tag: ref tags }` — the same shape the diary's
 *   `does: [{ service }]` has always had.
 *
 * And from the other side, an entry's page lists what points at it: a
 * category's page its services (and those of the categories under it), a
 * tag's page its posts. That is the archive page, and it is the entry route's.
 *
 * ── why these are the door's ────────────────────────────────────────────────
 *
 * They were the scaffold's `src/lib/groups.ts` until 9 November 2026, copied
 * into every site the day it was laid out and frozen there: a rule fixed in
 * the kit reached no site. They are the door's now (wiki/98 §13), and the door
 * calls them with entries it has already listed — hidden ones dropped, sorted
 * by the collection's order — so this file is the rule and nothing is the
 * reading. It imports nothing, and `test/content.test.mjs` runs it whole.
 *
 * An entry here is anything with a `slug` and `fields.value(key)`: the
 * door's own entries, or a test's.
 */

/**
 * How deep a tree is walked before the walk gives up.
 *
 * Far deeper than any menu or shop anybody navigates, and shallow enough that
 * a loop written by hand (`a → b → a`) costs nothing. The visited set stops a
 * loop on its own; the depth stops a chain that is merely absurd.
 */
export const DEEPEST = 12;

/**
 * The field a collection is grouped by, if it declares one its type has.
 * @param {{ name: string; group?: string }} collection
 * @param {any[]} fields the entry type's fields
 */
export function groupField(collection, fields) {
  if (!collection.group) return undefined;
  const field = fields.find((one) => one.key === collection.group);
  if (field === undefined) return undefined;
  // The catalogue refuses anything else (`jtk catalogue`, and the platform's
  // registry); a declaration that slipped past both groups nothing rather
  // than inventing headings from free text.
  if (field.kind === 'select') return field;
  if (field.kind === 'ref' && field.ref && field.ref !== collection.name) return field;
  return undefined;
}

/**
 * A select's headings, in the order of its options: the label the repository
 * wrote for each, in the page's language, or the option itself.
 * @param {any} field
 * @param {(text: unknown) => string} say
 * @returns {{ key: string; text: string }[]}
 */
export function selectHeadings(field, say) {
  return (field.options ?? []).map((option) => {
    const label = field.option_labels?.[option];
    const text = label === undefined ? '' : say(label);
    return { key: option, text: text !== '' ? text : option };
  });
}

/**
 * A ref's headings: the referenced collection's entries, in that collection's
 * order, each by its title — or its slug, for one nobody titled.
 *
 * `listed` is that collection read in the page's language, and `fallback` in
 * the site's own (empty on a page in the site's own). A category somebody
 * has not translated yet still heads its services, in the words it has,
 * rather than dropping them into "no group". The order is the site's own
 * language's, the translations put in their places, so a German page's
 * headings come in the order the owner arranged the categories rather than
 * translated-first; a category that exists only in the page's language comes
 * after them. An entry hidden in both is no heading, and what points at it is
 * listed last, under none — the same place an entry with no group goes.
 *
 * Each heading carries the entry it stands for in the page's language — the
 * translation where there is one, the site's own where there is not — so the
 * caller annotates it as that entry's title.
 *
 * @template {{ slug: string; fields: { value(key: string): unknown } }} E
 * @param {E[]} listed
 * @param {E[]} fallback
 * @returns {{ key: string; text: string; entry: E }[]}
 */
export function refHeadings(listed, fallback) {
  const titleOf = (entry) => {
    const title = entry?.fields.value('title');
    return typeof title === 'string' ? title.trim() : '';
  };
  const local = new Map(listed.map((entry) => [entry.slug, entry]));
  const own = new Map(fallback.map((entry) => [entry.slug, entry]));
  const order = [
    ...fallback.map((entry) => local.get(entry.slug) ?? entry),
    ...listed.filter((entry) => !own.has(entry.slug)),
  ];
  return order.map((entry) => {
    const key = entry.slug;
    return { key, text: titleOf(entry) || titleOf(own.get(key)) || key, entry };
  });
}

/**
 * Entries under their headings, in the headings' order.
 *
 * Every entry keeps the order it came in within its heading, which is its own
 * collection's order — the door has already sorted them. An entry with no
 * value, or a value no heading has (an option since renamed, a category
 * deleted or hidden), comes last, under no heading: the listing still shows
 * it, and the owner sees where it went. A heading nothing is under is dropped.
 *
 * @template {{ fields: { value(key: string): unknown } }} E
 * @template {{ key: string }} H
 * @param {E[]} entries
 * @param {string} key
 * @param {H[]} headings
 * @returns {{ heading?: H; entries: E[] }[]}
 */
export function grouped(entries, key, headings) {
  const runs = new Map(headings.map((one) => [one.key, []]));
  const loose = [];
  for (const entry of entries) {
    const value = entry.fields.value(key);
    const run = typeof value === 'string' ? runs.get(value) : undefined;
    if (run) run.push(entry);
    else loose.push(entry);
  }
  const out = headings
    .filter((one) => (runs.get(one.key) ?? []).length > 0)
    .map((one) => ({ heading: one, entries: runs.get(one.key) }));
  if (loose.length > 0) out.push({ entries: loose });
  return out;
}

/**
 * Where an entry of one collection may point at an entry of `target`.
 *
 * A top-level `ref` (`category: ref categories`), or a `ref` inside the rows
 * of a list (`tags: list of { tag: ref tags }`, the diary's `does: [{ service }]`).
 * Both are the same question asked of a different shape, so they come back as
 * one: the field, and for a list the key inside its row.
 *
 * @param {string} target
 * @param {any[]} fields
 * @returns {{ field: string; row?: string }[]}
 */
export function pointersInto(target, fields) {
  const out = [];
  for (const field of fields) {
    if (field.kind === 'ref' && field.ref === target) out.push({ field: field.key });
    if (field.kind === 'list') {
      for (const sub of field.of ?? []) {
        if (sub.kind === 'ref' && sub.ref === target) out.push({ field: field.key, row: sub.key });
      }
    }
  }
  return out;
}

/**
 * Whether an entry points at `slug` through any of `pointers`.
 * @param {{ fields: { value(key: string): unknown } }} entry
 * @param {{ field: string; row?: string }[]} pointers
 * @param {string} slug
 */
export function pointsAt(entry, pointers, slug) {
  return pointsAtAny(entry, pointers, new Set([slug]));
}

/**
 * Whether an entry points at any of `slugs` — a category or one of the
 * categories under it (`descendants`). One answer per entry however many of
 * them it names, which is what keeps a service filed under both `nails` and
 * `nails/gel` to one row of the archive.
 *
 * @param {{ fields: { value(key: string): unknown } }} entry
 * @param {{ field: string; row?: string }[]} pointers
 * @param {ReadonlySet<string>} slugs
 */
export function pointsAtAny(entry, pointers, slugs) {
  const named = (value) => typeof value === 'string' && slugs.has(value);
  return pointers.some((pointer) => {
    const value = entry.fields.value(pointer.field);
    if (pointer.row === undefined) return named(value);
    return Array.isArray(value) && value.some((row) => row !== null && typeof row === 'object' && named(row[pointer.row]));
  });
}

/**
 * The ancestors of an entry along a field that points into its own
 * collection, nearest first: `nails/gel` → `[nails]`, and `[]` for a root.
 *
 * Bounded twice, as the header says: a slug met again ends the walk (a loop
 * written by hand), and so does {@link DEEPEST}. A parent that is not listed —
 * hidden, deleted, a slug mistyped — ends it too: a trail through a page
 * nobody can open is not a trail.
 *
 * @param {string} slug
 * @param {Map<string, string>} parentOf
 * @param {Set<string>} known
 */
export function ancestors(slug, parentOf, known) {
  const out = [];
  const seen = new Set([slug]);
  let at = parentOf.get(slug);
  while (at !== undefined && at !== '' && !seen.has(at) && known.has(at) && out.length < DEEPEST) {
    out.push(at);
    seen.add(at);
    at = parentOf.get(at);
  }
  return out;
}

/**
 * Everything under an entry in a tree, nearest first, the entry itself not
 * among them: `beauty` → `[nails, hair, nails/gel]`. What a category's page
 * lists is what points at it *or at anything under it* — the gel manicure is
 * a nail service and a beauty service both.
 *
 * Bounded the way {@link ancestors} is: a slug met again is not walked again
 * (a loop written by hand), the walk stops {@link DEEPEST} levels down, and
 * only an entry in `known` — listed, so not hidden — is a child; a hidden
 * category hides its own subtree from the walk, as it hides it from the trail.
 *
 * @param {string} slug
 * @param {Map<string, string>} parentOf
 * @param {Set<string>} known
 */
export function descendants(slug, parentOf, known) {
  const childrenOf = new Map();
  for (const [child, parent] of parentOf) {
    if (!known.has(child)) continue;
    const run = childrenOf.get(parent);
    if (run) run.push(child);
    else childrenOf.set(parent, [child]);
  }
  const out = [];
  const seen = new Set([slug]);
  let level = [slug];
  for (let depth = 0; depth < DEEPEST && level.length > 0; depth++) {
    const next = [];
    for (const at of level) {
      for (const child of childrenOf.get(at) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        out.push(child);
        next.push(child);
      }
    }
    level = next;
  }
  return out;
}

/**
 * Fields of a type that point into its own collection — `parent` on a
 * category. Only a single `ref`: a list of them is a graph, not a tree, and
 * nothing here pretends to draw one.
 *
 * @param {{ name: string }} collection
 * @param {any[]} fields
 */
export function treeFields(collection, fields) {
  return fields.filter((one) => one.kind === 'ref' && one.ref === collection.name);
}

/**
 * At most `cap` of a list, and how many were left out — the back-references
 * of a popular tag, shown as the referencing collection would page them.
 *
 * A cap and not pages of their own: an address under a collection's prefix is
 * an entry's address to the platform (its edge, its editor, its sitemap), and
 * `/tags/red/2` would be one no entry owns. The rest are on the referencing
 * collection's own listing, which pages, and the line that says how many
 * links there. Without a `per_page` the collection is one page however long,
 * and so is this.
 *
 * @template T
 * @param {T[]} items
 * @param {number | undefined} cap
 * @returns {{ shown: T[]; more: number }}
 */
export function capped(items, cap) {
  if (cap === undefined || cap <= 0 || items.length <= cap) return { shown: items, more: 0 };
  return { shown: items.slice(0, cap), more: items.length - cap };
}

/**
 * Which collections have a listing at their prefix, and who draws it.
 *
 * ── opt-in, by the developer's word ─────────────────────────────────────────
 *
 * A collection whose entries have pages gets a listing at its prefix only
 * when it says `listing: true` (the platform's `CollectionDef.Listing`, 12
 * October 2026). A page nobody asked for is an address on a client's site
 * that nobody designed — it is crawled, linked and found — so a site gains one
 * only because its developer said so, and a site that says nothing builds
 * exactly the routes it always had.
 *
 * Where the repository wrote its own page at the prefix (the blog's
 * `src/pages/[...lang]/blog/index.astro`), that page is the listing and the
 * scaffold draws nothing there, whatever `listing` says. A collection without
 * pages always has its listing — the platform frames its prefix to show an
 * entry and refuses a build without one — and `listing` on one is refused by
 * the catalogue.
 *
 * @param {{ pages?: boolean; listing?: boolean }} collection
 * @param {boolean} ownPage whether the repository wrote a page of its own at the prefix
 */
export function drawsPagedListing(collection, ownPage) {
  return collection.pages !== false && collection.listing === true && !ownPage;
}

/**
 * Whether «And 3 more» under an archive links to the collection's listing:
 * where there is one to land on by the platform's rule — a collection without
 * pages, or one that asked for its listing (drawn by the scaffold or by the
 * repository's own page). A collection that did not ask may still have a page
 * at its prefix written by hand, but nothing here promises it lists what the
 * line counts, so the line stays words.
 *
 * A contract-3 collection shown only on other pages (`route: "none"`) has no
 * listing unless it declares one (jtakeit-core wiki/98 §15 · 6), and the door
 * says so with an empty `prefix`; it stays words too.
 *
 * @param {{ pages?: boolean; listing?: boolean; prefix?: string }} collection
 */
export function linksToListing(collection) {
  return (collection.pages === false || collection.listing === true) && collection.prefix !== '';
}
