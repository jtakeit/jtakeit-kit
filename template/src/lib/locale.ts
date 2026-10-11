/**
 * Which language a page is in, read off its address.
 *
 * The pattern is the platform's and fixed (docs/languages.md): the language
 * goes first and everything after it is the same — `/about` and `/de/about`,
 * `/blog/first-look` and `/de/blog/first-look`. The site's own language has
 * no prefix. Everything here derives from `LOCALE` and `LOCALES` in
 * `src/content/blocks.ts`, which is the one place a site says what languages
 * it has.
 */
import { LOCALE, LOCALES } from '../content/blocks';
import { base } from './under';

/** `''` for the site's own language, `'de'` for a page under `/de/`. */
export function localeOf(pathname: string): string {
  let path = pathname;
  const prefix = base();
  if (prefix !== '/' && path.startsWith(prefix)) path = `/${path.slice(prefix.length)}`;
  for (const locale of LOCALES) {
    if (path === `/${locale}` || path === `/${locale}/` || path.startsWith(`/${locale}/`)) return locale;
  }
  return '';
}

/** `/about` in a language: `/de/about`; the home is `/de`. Unchanged for the site's own. */
export function withLocale(locale: string, path: string): string {
  if (locale === '') return path;
  if (path === '/' || path === '') return `/${locale}`;
  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The language tag a page renders with — `en`, `de` — for `Intl` and `<html lang>`. */
export function langOf(locale: string): string {
  return locale === '' ? LOCALE : locale;
}

/**
 * What `getStaticPaths` answers for a page that exists in every language:
 * the site's own at the root, the others under their prefix.
 *
 *   export const getStaticPaths = localeParams;
 *   const locale = Astro.params.lang ?? '';
 */
export function localeParams(): { params: { lang: string | undefined } }[] {
  return [{ params: { lang: undefined } }, ...LOCALES.map((locale) => ({ params: { lang: locale } }))];
}

/** Every language the site has: its own first, as `''`. */
export const EVERY_LOCALE: readonly string[] = ['', ...LOCALES];
