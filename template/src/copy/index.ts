/**
 * The copy for the language a page is in:
 *
 *   const C = copyFor(localeOf(Astro.url.pathname));
 *
 * The site's own language is `''`. A second language — `de`, say, declared in
 * `LOCALES` in `src/content/blocks.ts` — is `src/copy/de.ts` beside this file,
 * made the way the site's own is (its home page is `site.page('/', 'de')`,
 * the document whose path is `/de`), and one line here:
 *
 *   import { COPY as de } from './de';
 *   const BY_LOCALE: Record<string, Copy> = { '': own, de };
 *
 * A language declared and not registered here renders with the site's own
 * words — the page is not broken, it is untranslated, and that is easy to see.
 */
import { COPY as own, STRINGS } from './{{LOCALE}}';
import { site } from '../lib/site';
import { makeCopy, type Copy } from './make';

const BY_LOCALE: Record<string, Copy> = { '': own };

/**
 * Contract 3: a language with no copy of its own here still has its page.
 * The door lays the translation over the original (`site.page('/', locale)`:
 * the translation's words, the original's where nobody translated them, each
 * of those marked with the original's `lang`), so the page is the language's
 * and `<html lang>` says it; only the words that are not content — the
 * form's, the privacy page's, a listing's — are the site's own until a copy
 * registered above says them. Contract 2 reads a page per language from its
 * own file, and renders an unregistered language with the site's own words,
 * as it always has.
 */
const laid = new Map<string, Copy>();

export function copyFor(locale: string): Copy {
  const registered = BY_LOCALE[locale];
  if (registered !== undefined) return registered;
  if (site.contract !== 3 || locale === '' || !site.locales.includes(locale)) return own;
  let copy = laid.get(locale);
  if (copy === undefined) {
    copy = makeCopy(site.page('/', locale), { ...STRINGS, lang: locale, ogLocale: locale.replace('-', '_') });
    laid.set(locale, copy);
  }
  return copy;
}

export type { Copy } from './make';
