/**
 * The site's own facts, as the platform writes them into jtk/site.json on
 * every version (sites/content.go): the currency is the site row's — what the
 * diary prices in, what Stripe charges in, what the panel shows.
 *
 * Read here and nowhere else, so a page never names a currency of its own: a
 * literal «CHF» in a page went on saying francs after the business changed its
 * currency in the panel (11 October 2026). The platform's preflight looks for
 * exactly that.
 */
const files = import.meta.glob<{ business?: { currency?: string } }>('/jtk/site.json', { eager: true, import: 'default' });

/** ISO 4217, upper case; '' while nobody has said what the prices are in. */
export const siteCurrency: string = String(Object.values(files)[0]?.business?.currency ?? '').toUpperCase();
