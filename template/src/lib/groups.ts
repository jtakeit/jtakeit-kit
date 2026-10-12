/**
 * Groups, trees and the entries that point at one — the taxonomies a site has
 * without a taxonomy feature (the platform's wiki/78, 12 October 2026).
 *
 * ── three patterns, no new kind ─────────────────────────────────────────────
 *
 * There is no "category" or "tag" in the catalogue, on purpose: every one of
 * them is a collection and a `ref`, which the platform already stores, lists,
 * translates and orders.
 *
 *   **A group.** `COLLECTIONS[].group` names a field of the entry type, and
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
 * tag's page its posts. That is the archive
 * page, and it is the entry route's (`[...entry].astro`), not a new one.
 *
 * ── why this file imports nothing ───────────────────────────────────────────
 *
 * Everything here is the rule and nothing is the reading: the entries arrive
 * as arguments, already listed by `entries.ts` (which drops the hidden ones
 * and sorts by the collection's order). That keeps the rules testable by Node
 * on its own (`test/groups.test.mjs` strips the types and runs them) and keeps
 * `astro:content` in the one file that already owns it.
 */

/** An entry as `entries.ts` reads one. Repeated, not imported: see the header. */
export type Entry = { id: string; data: Record<string, unknown> };

type Words = string | Record<string, string>;

/** What these rules read of a field — a subset of `Field` in `content/blocks.ts`. */
export interface FieldShape {
  key: string;
  kind: string;
  label?: Words;
  ref?: string;
  options?: string[];
  option_labels?: Record<string, Words>;
  of?: FieldShape[];
  client_editable?: boolean;
  no_tap_target?: boolean;
}

/** What these rules read of a collection — a subset of `Collection`. */
export interface CollectionShape {
  name: string;
  type: string;
  group?: string;
  pages?: boolean;
}

/**
 * One heading entries are listed under.
 *
 * `key` is the stored value — the option, or the referenced entry's slug.
 * `path` is set only for a heading that is somebody's editable words: the
 * title of the referenced entry, annotated as that entry's field
 * (`page:/categories/hair:blocks[0].title`), exactly as a listing annotates a
 * row. A select's label is the repository's, and is drawn `data-jtk-fixed`.
 */
export interface Heading {
  key: string;
  text: string;
  path?: string;
}

/** A run of entries under one heading; no heading is the run that comes last. */
export interface Group<T> {
  heading?: Heading;
  entries: T[];
}

/**
 * How deep a tree is walked before the walk gives up.
 *
 * Far deeper than any menu or shop anybody navigates, and shallow enough that
 * a loop written by hand (`a → b → a`) costs nothing. The visited set stops a
 * loop on its own; the depth stops a chain that is merely absurd.
 */
export const DEEPEST = 12;

/** The field a collection is grouped by, if it declares one its type has. */
export function groupField(collection: CollectionShape, fields: FieldShape[]): FieldShape | undefined {
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
 */
export function selectHeadings(field: FieldShape, say: (text: Words) => string): Heading[] {
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
 */
export function refHeadings(
  listed: Entry[],
  fallback: Entry[],
  slugOf: (entry: Entry) => string,
  pathOf: (entry: Entry) => string | undefined,
): Heading[] {
  const titleOf = (entry: Entry | undefined): string =>
    typeof entry?.data.title === 'string' ? entry.data.title.trim() : '';
  const local = new Map(listed.map((entry) => [slugOf(entry), entry]));
  const own = new Map(fallback.map((entry) => [slugOf(entry), entry]));
  const order = [
    ...fallback.map((entry) => local.get(slugOf(entry)) ?? entry),
    ...listed.filter((entry) => !own.has(slugOf(entry))),
  ];
  return order.map((entry) => {
    const key = slugOf(entry);
    const text = titleOf(entry) || titleOf(own.get(key)) || key;
    const path = pathOf(entry);
    return path === undefined ? { key, text } : { key, text, path };
  });
}

/**
 * Entries under their headings, in the headings' order.
 *
 * Every entry keeps the order it came in within its heading, which is its own
 * collection's order — `listed()` has already sorted them. An entry with no
 * value, or a value no heading has (an option since renamed, a category
 * deleted or hidden), comes last, under no heading: the listing still shows
 * it, and the owner sees where it went. A heading nothing is under is dropped.
 */
export function grouped<T extends Entry>(entries: T[], key: string, headings: Heading[]): Group<T>[] {
  const runs = new Map<string, T[]>(headings.map((one) => [one.key, []]));
  const loose: T[] = [];
  for (const entry of entries) {
    const value = entry.data[key];
    const run = typeof value === 'string' ? runs.get(value) : undefined;
    if (run) run.push(entry);
    else loose.push(entry);
  }
  const out: Group<T>[] = headings
    .filter((one) => (runs.get(one.key) ?? []).length > 0)
    .map((one) => ({ heading: one, entries: runs.get(one.key)! }));
  if (loose.length > 0) out.push({ entries: loose });
  return out;
}

/**
 * Where an entry of `owner` may point at an entry of `target`.
 *
 * A top-level `ref` (`category: ref categories`), or a `ref` inside the rows
 * of a list (`tags: list of { tag: ref tags }`, the diary's `does: [{ service }]`).
 * Both are the same question asked of a different shape, so they come back as
 * one: the field, and for a list the key inside its row.
 */
export interface Pointer {
  field: string;
  row?: string;
}

export function pointersInto(target: string, fields: FieldShape[]): Pointer[] {
  const out: Pointer[] = [];
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

/** Whether an entry points at `slug` through any of `pointers`. */
export function pointsAt(entry: Entry, pointers: Pointer[], slug: string): boolean {
  return pointsAtAny(entry, pointers, new Set([slug]));
}

/**
 * Whether an entry points at any of `slugs` — a category or one of the
 * categories under it (`descendants`). One answer per entry however many of
 * them it names, which is what keeps a service filed under both `nails` and
 * `nails/gel` to one row of the archive.
 */
export function pointsAtAny(entry: Entry, pointers: Pointer[], slugs: ReadonlySet<string>): boolean {
  const named = (value: unknown): boolean => typeof value === 'string' && slugs.has(value);
  return pointers.some((pointer) => {
    const value = entry.data[pointer.field];
    if (pointer.row === undefined) return named(value);
    return Array.isArray(value) && value.some((row) => row !== null && typeof row === 'object' && named((row as Record<string, unknown>)[pointer.row!]));
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
 */
export function ancestors(slug: string, parentOf: Map<string, string>, known: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>([slug]);
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
 */
export function descendants(slug: string, parentOf: Map<string, string>, known: Set<string>): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    if (!known.has(child)) continue;
    const run = childrenOf.get(parent);
    if (run) run.push(child);
    else childrenOf.set(parent, [child]);
  }
  const out: string[] = [];
  const seen = new Set<string>([slug]);
  let level = [slug];
  for (let depth = 0; depth < DEEPEST && level.length > 0; depth++) {
    const next: string[] = [];
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
 */
export function treeFields(collection: CollectionShape, fields: FieldShape[]): FieldShape[] {
  return fields.filter((one) => one.kind === 'ref' && one.ref === collection.name);
}

/**
 * At most `cap` of a list, and how many were left out — the back-references
 * of a popular tag, shown as the referencing collection would page them.
 *
 * A cap and not pages of their own: an address under a collection's prefix is
 * an entry's address to the platform (its edge, its editor, its sitemap), and
 * `/tags/red/2` would be one no entry owns. The rest are on the referencing
 * collection's own listing, which pages (`listingPages` in entries.ts), and
 * the line that says how many links there. Without a `per_page` the
 * collection is one page however long (`Collection.per_page`), and so is this.
 */
export function capped<T>(items: T[], cap: number | undefined): { shown: T[]; more: number } {
  if (cap === undefined || cap <= 0 || items.length <= cap) return { shown: items, more: 0 };
  return { shown: items.slice(0, cap), more: items.length - cap };
}
