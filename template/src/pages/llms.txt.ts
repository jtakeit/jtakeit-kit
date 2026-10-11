import type { APIRoute } from 'astro';
import { BUSINESS, INDEXABLE, PAGES, fullAddress } from '../data/site';
import { allListed, href } from '../lib/entries';
import { EVERY_LOCALE } from '../lib/locale';

/**
 * A plain-text summary of the business for a language model that lands on the
 * site. No engine promises to read it; it costs one route, and for a client
 * whose pitch is «be findable» it is a reasonable thing to ship.
 *
 * Built from the same data as the page and the structured data, so it cannot
 * contradict either. Empty while INDEXABLE is false — a preview should not be
 * summarising itself to anyone.
 */
export const GET: APIRoute = async () => {
  if (!INDEXABLE) {
    return new Response('', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // What the owner writes, listed under its own heading. An assistant that
  // lands here is looking for what this business has said, and a title with an
  // address is the shortest honest form of it.
  const collections = (await Promise.all(EVERY_LOCALE.map((locale) => allListed(locale)))).flat();

  const lines = [
    `# ${BUSINESS.name}`,
    '',
    `> ${BUSINESS.description}`,
    '',
    fullAddress,
    BUSINESS.phoneDisplay,
    BUSINESS.email,
    BUSINESS.priceRange,
    '',
    '## Pages',
    ...PAGES.map((p) => `- ${p.path}: ${p.summary}`),
    ...collections.flatMap(({ collection, entries }) =>
      entries.length === 0
        ? []
        : [
            '',
            `## ${collection.label}`,
            ...entries.map((entry) => `- ${href(collection, entry)}: ${String(entry.data.title ?? '')}`),
          ],
    ),
  ].filter((line) => line !== undefined && line !== null);

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
