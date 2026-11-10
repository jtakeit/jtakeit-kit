/** A price as the page says it: «2 300 ₴». Minor units in. */
export function money(minor: number, currency: string | undefined, locale: string): string;
/**
 * A price's qualifiers in a language — `from` with `{amount}` where the price
 * goes, `on_request` — as a fresh object the caller may write over (wiki/98 §15 · 11).
 */
export function priceWords(locale: string | undefined): { from: string; on_request: string };
