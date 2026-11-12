import type { APIRoute } from 'astro';
import { INDEXABLE, canonicalFor } from '../data/site';
import { EVERY_LOCALE } from '../lib/locale';
import { everyPage } from '../lib/pages';
import { site } from '../lib/site';

/**
 * The pages are src/lib/pages.ts's list: the ones written by hand in `PAGES`,
 * every page of the content, every listing and the privacy page — one list
 * with `llms.txt`'s.
 *
 * The entries are read from the collections, which is the only list of them
 * that exists: nobody writes them here — the owner makes them in the admin. A
 * hidden entry is absent, because `site.entries` is how anything here
 * enumerates them, and an entry of a collection without pages has no address
 * of its own to list.
 *
 * Each address as the page's canonical link says it — with its trailing
 * slash — and under this build's base once, by `canonicalFor`.
 *
 * With INDEXABLE off the file is still served, but empty — an empty sitemap
 * says «nothing to crawl», where a 404 says «try again later».
 */
export const GET: APIRoute = async () => {
  const urls: { loc: string; priority: number }[] = [];

  if (INDEXABLE) {
    const slashed = (address: string) => (address === '/' ? '/' : `${address}/`);
    for (const page of everyPage()) {
      urls.push({ loc: canonicalFor(slashed(page.address)), priority: page.priority });
    }
    for (const locale of EVERY_LOCALE) {
      for (const collection of site.collections.filter((one) => one.pages)) {
        for (const entry of site.entries(collection.name, { locale })) {
          // Below every page of the site and above nothing: an entry is worth
          // crawling and is not what the site is for. In a language only
          // where it is translated, as hreflang names it: an untranslated
          // post at /en/ is the original's words at a second address.
          if (!entry.translated) continue;
          if (entry.address !== undefined) urls.push({ loc: canonicalFor(slashed(entry.address)), priority: 0.5 });
        }
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
