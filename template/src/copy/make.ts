/**
 * The copy for one language: what the home page of that language says — read
 * through the door, `site.page('/')` for the site's own and
 * `site.page('/', 'de')` for German, found by its address as the platform
 * finds it — and the handful of strings that are not content, passed in.
 *
 * `src/copy/<locale>.ts` calls this once for the site's language; a second
 * language is a second file beside it that calls it with its own home page
 * and its own strings, and a line in `src/copy/index.ts`. Nothing in a
 * component knows which language it is rendering: it asks `copyFor` for the
 * page it is on (docs/languages.md).
 */
import type { Page } from '@jtakeit/kit/content';

/** What is not content, per language. */
export interface Strings {
  /** `<html lang>` for this language — `de`, `de-CH`. */
  lang: string;
  ogLocale: string;
  titleSuffix: string;
  form: {
    required: string;
    privacy: string;
    sending: string;
    success: string;
    error: string;
    invalidName: string;
    invalidContact: string;
    invalidMessage: string;
    demoNote: string;
  };
  privacy: {
    title: string;
    intro: string;
    formTitle: string;
    formBody: string;
    whoTitle: string;
    whoBody: string;
    askTitle: string;
    askBody: string;
    ownTitle: string;
  };
  /**
   * A listing's few words, and an archive's: «And {n} more» under a capped
   * list of what points at an entry, and a paged listing's way between its
   * pages. `{n}` and `{total}` are filled in, as numbers in this language.
   */
  listing: {
    more: string;
    previous: string;
    next: string;
    pageOf: string;
  };
  a11y: { skipToContent: string };
}

/**
 * The home page's words, and the page itself for whatever draws the rest.
 *
 * `PAGE` is the door's page (`@jtakeit/kit/content`): `PAGE.block('hero')`,
 * `PAGE.blocks`, and on every block `text`, `rows`, `picture`, `gallery` and
 * `at` — the value and its annotation together, so no component writes a
 * path. A block the page does not have is an empty one annotated nowhere:
 * the admin can remove one, and a build that threw for it would make
 * removing a section a deploy incident.
 */
export function makeCopy(page: Page, S: Strings, wordsLang = '') {
  const hero = page.block('hero');
  const cta = page.block('cta_banner');
  // The photograph and its words through the door: one picture, `{ src, alt }`
  // in contract 3; in contract 2 the key and the `image_alt` beside it.
  const picture = hero.picture('image');
  const seo = (key: string): string => (typeof page.seo[key] === 'string' ? (page.seo[key] as string) : '');

  const META = { lang: S.lang, ogLocale: S.ogLocale, titleSuffix: S.titleSuffix } as const;

  const HOME = {
    title: seo('title'),
    description: seo('description'),
    hero: {
      eyebrow: hero.text('eyebrow'),
      heading: hero.text('title'),
      lead: hero.text('lead'),
      cta: hero.text('cta_label'),
      ctaHref: hero.text('cta_href') || '#contact',
      image: picture.src,
      imageAlt: picture.alt,
    },
  } as const;

  const FORM = {
    title: cta.text('title'),
    lead: cta.text('lead'),
    // The questions, which are the business's own — see blocks.ts.
    name: cta.text('name_label'),
    contact: cta.text('contact_label'),
    message: cta.text('message_label'),
    required: S.form.required,
    requiredNote: cta.text('required_note'),
    privacy: S.form.privacy,
    submit: cta.text('cta_label'),
    sending: S.form.sending,
    success: S.form.success,
    error: S.form.error,
    invalidName: S.form.invalidName,
    invalidContact: S.form.invalidContact,
    invalidMessage: S.form.invalidMessage,
    demoNote: S.form.demoNote,
  } as const;

  const count = new Intl.NumberFormat(S.lang);
  const filled = (text: string, n: number, total = 0): string =>
    text.replace('{n}', count.format(n)).replace('{total}', count.format(total));
  const LISTING = {
    more: (n: number): string => filled(S.listing.more, n),
    previous: S.listing.previous,
    next: S.listing.next,
    pageOf: (n: number, total: number): string => filled(S.listing.pageOf, n, total),
  } as const;

  return {
    META,
    HOME,
    FORM,
    PRIVACY: S.privacy,
    LISTING,
    A11Y: S.a11y,
    PAGE: page,
    /**
     * The language of the words above that are not content — the form's
     * messages, the privacy page, the skip link, a listing's pager — where it
     * is not the page's: the site's own, on a page in a language this site
     * has no copy of (src/copy/index.ts). `''` where they are the page's. Put
     * it on what says them, as `lang`.
     */
    WORDS_LANG: wordsLang,
  };
}

export type Copy = ReturnType<typeof makeCopy>;
