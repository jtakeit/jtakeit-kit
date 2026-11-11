import type { APIRoute } from 'astro';
import { BUSINESS, INDEXABLE } from '../data/site';
import { href } from '../lib/entries';
import { EVERY_LOCALE, langOf } from '../lib/locale';
import { everyPage } from '../lib/pages';
import { site } from '../lib/site';

/**
 * A plain-text summary of the business for a language model that lands on the
 * site. No engine promises to read it; it costs one route, and for a client
 * whose pitch is «be findable» it is a reasonable thing to ship.
 *
 * Built from the same data as the page and the structured data, so it cannot
 * contradict either: the business's facts from the shared text the owner
 * edits (`site.facts`, by role) and src/data/site.ts where it says nothing,
 * the pages from src/lib/pages.ts, as the sitemap's. Empty while INDEXABLE is
 * false — a preview should not be summarising itself to anyone.
 */
export const GET: APIRoute = async () => {
  if (!INDEXABLE) {
    return new Response('', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // What the owner writes, listed under its own heading. An assistant that
  // lands here is looking for what this business has said, and a title with an
  // address is the shortest honest form of it.
  const collections = EVERY_LOCALE.flatMap((locale) =>
    site.collections.filter((one) => one.pages).map((collection) => ({ collection, locale, entries: site.entries(collection.name, { locale }) })),
  );

  // The site's own language's: what the owner keeps in the panel's contacts,
  // and src/data/site.ts where a role is empty (Layout.astro says why).
  const facts = site.facts();
  const fact = (role: string, own: string): string => facts.text(role).trim() || own;
  const address = [
    fact('street', BUSINESS.street),
    [fact('postal_code', BUSINESS.postalCode), fact('city', BUSINESS.city)].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  const lines = [
    `# ${fact('name', BUSINESS.name)}`,
    '',
    `> ${BUSINESS.description}`,
    '',
    address,
    fact('phone', BUSINESS.phoneDisplay),
    fact('email', BUSINESS.email),
    fact('price_range', BUSINESS.priceRange),
    '',
    '## Pages',
    ...everyPage().map((p) => `- ${p.address}: ${p.summary}`),
    ...collections.flatMap(({ collection, locale, entries }) =>
      entries.length === 0
        ? []
        : [
            '',
            // A label is words per language (`{ de: 'Blog', en: 'Blog' }`):
            // said in the listing's, never as `[object Object]`.
            `## ${site.words(collection.label, langOf(locale))}`,
            ...entries.map((entry) => `- ${href(entry)}: ${String(entry.fields.value('title') ?? '')}`),
          ],
    ),
  ].filter((line) => line !== undefined && line !== null);

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
