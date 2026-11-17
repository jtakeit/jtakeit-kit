/** The languages the storefront carries words in: `uk`, `de`, `en`, `ru`, `es`, `it`, `pt`, `fr`. */
export const SHOP_LOCALES: readonly string[];
/**
 * The storefront's words for a page's language, as a fresh object the caller may write over.
 * A regional tag reads its language's words (`de-CH` is German); any other language reads English.
 * A word may hold a placeholder in braces — `{n}`, `{max}`, `{title}`, `{number}` — the same in every language.
 */
export function shopWordsFor(locale: string | undefined): Record<string, string>;
