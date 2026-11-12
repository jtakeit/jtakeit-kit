/**
 * Every address this build makes a page at that a search engine or an
 * assistant should know of — the sitemap's and `llms.txt`'s one list.
 *
 *   - the pages written by hand in `PAGES` (src/data/site.ts), first, with
 *     their priority and summary;
 *   - every page of the content, in every language — the home page, and on
 *     contract 3 the booking page (`jtk/pages/services.json`) — as the door
 *     finds them (`site.pages`);
 *   - every listing a collection is drawn at: its own listing where it has one
 *     (the blog's `/blog`), and for a collection without pages the page its
 *     entries are rows of (the diary's `/services`, with the form);
 *   - the privacy page, which every scaffold builds.
 *
 * The entries are listed by the sitemap itself, from the collections.
 *
 * Written by hand, `PAGES` alone was the list, and it said `/` and nothing
 * else: the booking page, the blog and the privacy page were built and in no
 * sitemap (the contract-3 rehearsal, 11 November 2026). The pages of the
 * content are the platform's to know of — its build refuses a page it has
 * and the build did not make — so they are read, not written down again.
 *
 * An address once, the first time it is met; each without its trailing slash,
 * `/` for the home, as the door says them.
 */
import { PAGES } from '../data/site';
import { copyFor } from '../copy';
import { listsPaged, ownListing } from './entries';
import { EVERY_LOCALE, langOf, withLocale } from './locale';
import { site } from './site';

export interface Listed {
  address: string;
  /** The sitemap's `priority`. */
  priority: number;
  /** One line about it, for `llms.txt`; `''` where nobody wrote one. */
  summary: string;
}

export function everyPage(): Listed[] {
  const out = new Map<string, Listed>();
  const add = (address: string | undefined, priority: number, summary: string) => {
    if (address === undefined || address === '') return;
    const clean = address.length > 1 ? address.replace(/\/+$/, '') : address;
    if (!out.has(clean)) out.set(clean, { address: clean, priority, summary });
  };

  for (const page of PAGES) add(page.path, page.priority, page.summary);
  for (const locale of EVERY_LOCALE) {
    const LANG = langOf(locale);
    for (const page of site.pages(locale)) {
      // A page nobody translated is built in every language, in the
      // original's words, and listed only in its own: the sitemap's rule is
      // hreflang's (always translated on contract 2, a file per language).
      if (!page.translated) continue;
      const home = page.address === withLocale(locale, '/');
      add(page.address, home ? 1.0 : 0.8, typeof page.seo.description === 'string' ? page.seo.description : '');
    }
    for (const collection of site.collections) {
      // Where `[...listing].astro`, or the repository's own listing page,
      // draws the collection — and nowhere else: a collection with pages and
      // no listing has none.
      const listing = collection.pages
        ? listsPaged(collection) || ownListing(collection)
          ? site.listingOf(collection.name, locale)
          : undefined
        : site.shownOn(collection.name, locale);
      add(listing, 0.6, site.words(collection.label, LANG));
    }
    add(withLocale(locale, '/privacy'), 0.3, copyFor(locale).PRIVACY.title);
  }
  return [...out.values()];
}
