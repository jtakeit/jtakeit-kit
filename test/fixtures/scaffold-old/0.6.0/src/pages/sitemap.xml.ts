import type { APIRoute } from 'astro';
import { INDEXABLE, PAGES, canonicalFor } from '../data/site';
import { allListed, href } from '../lib/entries';

/**
 * The pages are written by hand in `PAGES` rather than generated, so that
 * adding a page and forgetting to list it is a visible omission in one file
 * instead of a silent one across the build.
 *
 * The entries are not, and cannot be: nobody writes them here — the owner makes
 * them in the admin — so they are read from the collections, which is the only
 * list of them that exists. A hidden entry is absent, because `allListed` is
 * how anything here enumerates them.
 *
 * With INDEXABLE off the file is still served, but empty — an empty sitemap
 * says «nothing to crawl», where a 404 says «try again later».
 */
export const GET: APIRoute = async () => {
  const urls: { loc: string; priority: number }[] = [];

  if (INDEXABLE) {
    for (const page of PAGES) {
      urls.push({ loc: canonicalFor(page.path), priority: page.priority });
    }
    for (const { collection, entries } of await allListed()) {
      for (const entry of entries) {
        // Below every page of the site and above nothing: an entry is worth
        // crawling and is not what the site is for.
        urls.push({ loc: canonicalFor(href(collection, entry)), priority: 0.5 });
      }
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
