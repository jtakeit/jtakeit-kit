import type { APIRoute } from 'astro';
import { INDEXABLE, canonicalFor } from '../data/site';
import { href } from '../lib/entries';
import { EVERY_LOCALE } from '../lib/locale';
import { site } from '../lib/site';

/**
 * One feed per collection, at `/blog/rss.xml`.
 *
 * Written by hand rather than through `@astrojs/rss`, for the same reason
 * `sitemap.xml.ts` is: it is thirty lines, it has no dependency, and what goes
 * in it is a decision rather than a default.
 *
 * Hidden entries are absent, because `site.entries` is the only way anything
 * here enumerates them. Empty while INDEXABLE is false — a preview announcing itself
 * to a reader is a preview competing with the site it previews.
 */
export async function getStaticPaths() {
  // A collection without pages has no feed: its entries have no address.
  return site.collections.filter((collection) => collection.pages).flatMap((collection) =>
    EVERY_LOCALE.map((locale) => ({
      params: { feed: `${site.listingOf(collection.name, locale).slice(1)}/rss` },
      props: { name: collection.name, locale },
    })),
  );
}

export const GET: APIRoute = async ({ props }) => {
  const { name, locale } = props as { name: string; locale: string };
  const collection = site.collection(name);
  const entries = INDEXABLE && collection ? site.entries(name, { locale }) : [];

  const items = entries
    .map((entry) => {
      const title = entry.fields.value('title');
      const date = entry.fields.value('date');
      const excerpt = entry.fields.value('excerpt');
      const link = canonicalFor(href(entry));
      return `    <item>
      <title>${escapeXML(String(title ?? ''))}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      ${date ? `<pubDate>${new Date(String(date)).toUTCString()}</pubDate>` : ''}
      ${excerpt ? `<description>${escapeXML(String(excerpt))}</description>` : ''}
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXML(site.words(collection?.label) || name)}</title>
    <link>${canonicalFor(collection ? site.listingOf(name, '') : '/')}</link>
    <description>${escapeXML(site.words(collection?.label) || name)}</description>
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
