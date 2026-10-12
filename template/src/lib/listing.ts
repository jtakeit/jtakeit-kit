/**
 * Which collections have a listing at their prefix, and who draws it — the
 * rule, apart from the reading (`entries.ts` reads the files and the entries).
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
 * entry and refuses a build without one — and the repository's
 * `[...listing].astro` draws it; `listing` on one is refused by the catalogue.
 *
 * Imports nothing, so Node tests it on its own (`test/listing.test.mjs`).
 */

/** What these rules read of a collection — a subset of `Collection`. */
export interface ListedShape {
  pages?: boolean;
  listing?: boolean;
}

/** Whether the scaffold draws a collection with pages its paged listing (`EntryListing.astro`). */
export function drawsPagedListing(collection: ListedShape, ownPage: boolean): boolean {
  return collection.pages !== false && collection.listing === true && !ownPage;
}

/**
 * Whether «And 3 more» under an archive links to the collection's listing:
 * where there is one to land on by the platform's rule — a collection without
 * pages, or one that asked for its listing (drawn by the scaffold or by the
 * repository's own page). A collection that did not ask may still have a page
 * at its prefix written by hand, but nothing here promises it lists what the
 * line counts, so the line stays words.
 */
export function linksToListing(collection: ListedShape): boolean {
  return collection.pages === false || collection.listing === true;
}
