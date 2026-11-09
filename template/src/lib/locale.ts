/**
 * Which language a page is in, and the addresses of one in another.
 *
 * The rules are the platform's and the door's (`@jtakeit/kit/content`): the
 * language goes first and everything after it is the same — `/about` and
 * `/de/about`, `/blog/first-look` and `/de/blog/first-look` — the site's own
 * language has no prefix, and a regional one is spelt `de-CH` and addressed
 * `/de-ch/`. Which languages there are is the schema's: `LOCALE` and
 * `LOCALES` in `src/content/blocks.ts`, written into `jtk/catalogue.json`.
 *
 * What is here is this site's part of it: the build's base path, which only
 * Astro knows, and the convention every component of this scaffold keeps —
 * a page's language is `''` for the site's own, and the tag of any other.
 */
import { site } from './site';
import { base } from './under';

/** `''` for the site's own language, `'de'` for a page under `/de/`. */
export function localeOf(pathname: string): string {
  let path = pathname;
  const prefix = base();
  if (prefix !== '/' && path.startsWith(prefix)) path = `/${path.slice(prefix.length)}`;
  return site.localeOf(path);
}

/** `/about` in a language: `/de/about`; the home is `/de`. Unchanged for the site's own. */
export function withLocale(locale: string, path: string): string {
  return site.inLocale(locale, path);
}

/** The language tag a page renders with — `en`, `de-CH` — for `Intl` and `<html lang>`. */
export function langOf(locale: string): string {
  return locale === '' ? site.locale : locale;
}

/** Every language the site has: its own first, as `''`. */
export const EVERY_LOCALE: readonly string[] = ['', ...site.locales.slice(1)];

/**
 * What `getStaticPaths` answers for a page that exists in every language:
 * the site's own at the root, the others under their prefix.
 *
 *   export const getStaticPaths = localeParams;
 *   const locale = localeOf(Astro.url.pathname);
 */
export function localeParams(): { params: { lang: string | undefined } }[] {
  return EVERY_LOCALE.map((locale) => ({ params: { lang: locale === '' ? undefined : withLocale(locale, '/').slice(1) } }));
}
