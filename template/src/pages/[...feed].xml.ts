import type { APIRoute } from 'astro';
import { COLLECTIONS, words } from '../content/blocks';
import { INDEXABLE, canonicalFor } from '../data/site';
import { allListed, href } from '../lib/entries';
import { EVERY_LOCALE } from '../lib/locale';

/**
 * One feed per collection, at `/blog/rss.xml`.
 *
 * Written by hand rather than through `@astrojs/rss`, for the same reason
 * `sitemap.xml.ts` is: it is thirty lines, it has no dependency, and what goes
 * in it is a decision rather than a default.
 *
 * Hidden entries are absent, because `allListed` is the only way anything here
 * enumerates them. Empty while INDEXABLE is false — a preview announcing itself
 * to a reader is a preview competing with the site it previews.
 */
export async function getStaticPaths() {
  // A collection without pages has no feed: its entries have no address.
  return COLLECTIONS.filter((collection) => collection.pages !== false).flatMap((collection) =>
    EVERY_LOCALE.map((locale) => ({
      params: { feed: `${locale === '' ? '' : `${locale}/`}${collection.prefix.replace(/^\//, '')}/rss` },
      props: { name: collection.name, locale },
    })),
  );
}

export const GET: APIRoute = async ({ props }) => {
  const { name, locale } = props as { name: string; locale: string };
  const all = await allListed(locale);
  const found = all.find((one) => one.collection.name === name);
  const entries = INDEXABLE && found ? found.entries : [];

  const items = entries
    .map((entry) => {
      const data = entry.data as Record<string, unknown>;
      const link = canonicalFor(href(found!.collection, entry));
      return `    <item>
      <title>${escapeXML(String(data.title ?? ''))}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${data.date ? `<pubDate>${new Date(String(data.date)).toUTCString()}</pubDate>` : ''}
      ${data.excerpt ? `<description>${escapeXML(String(data.excerpt))}</description>` : ''}
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXML(words(found?.collection.label) || name)}</title>
    <link>${canonicalFor(found?.collection.prefix ?? '/')}</link>
    <description>${escapeXML(words(found?.collection.label) || name)}</description>
${items}
  </channel>
</rss>
`;

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
