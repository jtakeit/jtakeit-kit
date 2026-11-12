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
import { inDraft } from '@jtakeit/kit/live';
import { COPY as own, STRINGS } from './{{LOCALE}}';
import { site } from '../lib/site';
import { makeCopy, type Copy, type Strings } from './make';

const BY_LOCALE: Record<string, Copy> = { '': own };

/**
 * Contract 3: every language's copy beside this file, found by its name —
 * `src/copy/en.ts` is English's, as `npx @jtakeit/astro copy en` writes it, in
 * the kit's words for the language — with no line to add here. A language
 * with none still has its page: the door lays the translation over the
 * original (`site.page('/', locale)`), so the page is the language's and
 * `<html lang>` says it; the words that are not content — the form's, the
 * privacy page's — are the site's own, and say so (`WORDS_LANG`), until its
 * copy is written. `jtk schema` and `jtkit progress` name a language without
 * one. Contract 2 reads a page per language from its own file, registers its
 * copy above, and renders an unregistered language with the site's own words,
 * as it always has.
 */
const beside = import.meta.glob<{ COPY?: Copy; STRINGS?: Strings }>(['./*.ts', '!./index.ts', '!./make.ts'], { eager: true });
const laid = new Map<string, Copy>();

/**
 * ── a draft rendered live ───────────────────────────────────────────────────
 *
 * Each language's copy is made when its file is first imported — once a
 * process, from the build's home page. Under the panel's live preview a
 * process renders draft after draft (jtakeit-core wiki/89 §12), so there a
 * language's copy is made again from the draft's home page, once a request,
 * by the same `makeCopy` and the same `STRINGS` its file makes it with; a
 * build never has a draft, and is handed the copy it always was.
 */
export function copyFor(locale: string): Copy {
  const built = builtFor(locale);
  return inDraft(`copy:${locale}`, () => draftedFor(locale, built)) ?? built;
}

function builtFor(locale: string): Copy {
  const registered = BY_LOCALE[locale];
  if (registered !== undefined) return registered;
  if (site.contract !== 3 || locale === '' || !site.locales.includes(locale)) return own;
  let copy = laid.get(locale);
  if (copy === undefined) {
    copy = beside[`./${locale}.ts`]?.COPY ?? makeCopy(site.page('/', locale), { ...STRINGS, lang: locale, ogLocale: locale.replace('-', '_') }, STRINGS.lang);
    laid.set(locale, copy);
  }
  return copy;
}

/** The copy `builtFor` hands out, made of the draft: what is made of the home page, made again; a copy registered by hand stays as it was registered. */
function draftedFor(locale: string, built: Copy): Copy {
  if (built === own) return makeCopy(site.page('/'), STRINGS);
  if (BY_LOCALE[locale] !== undefined) return built;
  const file = beside[`./${locale}.ts`];
  if (file?.COPY !== undefined) return file.STRINGS !== undefined ? makeCopy(site.page('/', locale), file.STRINGS) : built;
  return makeCopy(site.page('/', locale), { ...STRINGS, lang: locale, ogLocale: locale.replace('-', '_') }, STRINGS.lang);
}

export type { Copy } from './make';
