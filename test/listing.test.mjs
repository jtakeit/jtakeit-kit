// Which collections are listed at their prefix, and where «And 3 more» links
// (template/src/lib/listing.ts): opt-in, never by default. Run by Node on its
// own — the file imports nothing, and Node strips its types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawsPagedListing, linksToListing } from '../template/src/lib/listing.ts';

test('a collection with pages is listed by the scaffold only when it says listing: true', () => {
  assert.equal(drawsPagedListing({}, false), false, 'nothing said: no new address on the site');
  assert.equal(drawsPagedListing({ pages: true }, false), false);
  assert.equal(drawsPagedListing({ listing: false }, false), false);
  assert.equal(drawsPagedListing({ listing: true }, false), true);
  assert.equal(drawsPagedListing({ listing: true }, true), false, "the repository's own page at the prefix wins");
  assert.equal(drawsPagedListing({ pages: false, listing: true }, false), false, 'a collection without pages has its own listing route');
});

test('«And 3 more» links only where a listing is there by the rule', () => {
  assert.equal(linksToListing({}), false);
  assert.equal(linksToListing({ listing: false }), false);
  assert.equal(linksToListing({ listing: true }), true);
  assert.equal(linksToListing({ pages: false }), true, 'its prefix is its listing, which the platform demands');
});
