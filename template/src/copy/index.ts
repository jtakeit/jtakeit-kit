/**
 * The copy for the language a page is in:
 *
 *   const C = copyFor(localeOf(Astro.url.pathname));
 *
 * The site's own language is `''`. A second language — `de`, say, declared in
 * `LOCALES` in `src/content/blocks.ts` — is `src/copy/de.ts` beside this file,
 * made the way the site's own is (its home document is `jtk/content/de.json`),
 * and one line here:
 *
 *   import { COPY as de } from './de';
 *   const BY_LOCALE: Record<string, Copy> = { '': own, de };
 *
 * A language declared and not registered here renders with the site's own
 * words — the page is not broken, it is untranslated, and that is easy to see.
 */
import { COPY as own } from './{{LOCALE}}';
import type { Copy } from './make';

const BY_LOCALE: Record<string, Copy> = { '': own };

export function copyFor(locale: string): Copy {
  return BY_LOCALE[locale] ?? own;
}

export type { Copy, Shown } from './make';
