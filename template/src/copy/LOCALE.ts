/**
 * Every sentence a visitor reads — read from the home page's document rather
 * than written here.
 *
 * The strings live in the repository's content so that the studio's admin
 * can edit them: a commit under `jtk/` **is** the published state, and
 * publishing writes it. This module is the adapter between that document and
 * the shape the components already import, which is why the exports below
 * look ordinary — nothing in a component has to know where its text came
 * from.
 *
 * The document is the page whose path is `/`, found by the kit's door
 * (src/lib/site.ts) the way the platform finds it: by the `path` inside the
 * file, never by the file's name. It used to be imported by name —
 * `jtk/content/index.json` — while every other page was found by its path,
 * so a home the platform had written under another name was a page the
 * template could not see (9 November 2026).
 *
 * Three things did not move, because they are not content:
 *   META     — the `<html lang>` value and the title suffix
 *   A11Y     — the skip link
 *   LISTING  — «And 3 more» under an archive, and a paged listing's
 *              «Previous», «Next», «Page 2 of 5»: the scaffold's sentences
 *              around the owner's entries, not the owner's
 *
 * Comments and identifiers stay English. The values are the client's language.
 *
 * ── the document, and the file that ships with this scaffold ────────────────
 *
 * `jtk/content/index.json` is committed with empty strings in it, and that
 * is deliberate: a fresh project must `npm run build` on a laptop the minute
 * `jtk create` finishes, and a page with nothing written draws nothing rather
 * than nothing at all. The first publish from the admin replaces it.
 *
 * `jtk/catalogue.json` — which blocks a site has, and what the door reads the
 * content by — is written from `src/content/blocks.ts` by `jtk create`, by the
 * dev server whenever that file is saved, and by `npx @jtakeit/astro
 * catalogue`, which is what to run before a commit.
 */
import { LOCALE } from '../content/blocks';
import { site } from '../lib/site';
import { makeCopy, type Strings } from './make';

/** What is not content, in the site's own language. A second language copies this file (docs/languages.md). */
export const STRINGS: Strings = {
  lang: LOCALE,
  ogLocale: '{{OG_LOCALE}}',
  titleSuffix: ' — {{NAME}}',
  form: {
    required: '{{UI_REQUIRED}}',
    privacy: '{{UI_PRIVACY}}',
    sending: '{{UI_SENDING}}',
    success: '{{UI_SUCCESS}}',
    error: '{{UI_ERROR}}',
    invalidName: '{{UI_INVALID_NAME}}',
    invalidContact: '{{UI_INVALID_CONTACT}}',
    invalidMessage: '{{UI_INVALID_MESSAGE}}',
    demoNote: '{{UI_DEMO_NOTE}}',
  },
  privacy: {
    title: '{{UI_PRIVACY_TITLE}}',
    intro: '{{UI_PRIVACY_INTRO}}',
    formTitle: '{{UI_PRIVACY_FORM_TITLE}}',
    formBody: '{{UI_PRIVACY_FORM_BODY}}',
    whoTitle: '{{UI_PRIVACY_WHO_TITLE}}',
    whoBody: '{{UI_PRIVACY_WHO_BODY}}',
    askTitle: '{{UI_PRIVACY_ASK_TITLE}}',
    askBody: '{{UI_PRIVACY_ASK_BODY}}',
    ownTitle: '{{UI_PRIVACY_OWN_TITLE}}',
  },
  listing: {
    more: '{{UI_MORE}}',
    previous: '{{UI_PREVIOUS}}',
    next: '{{UI_NEXT}}',
    pageOf: '{{UI_PAGE_OF}}',
  },
  a11y: { skipToContent: '{{UI_SKIP_TO_CONTENT}}' },
};

export const COPY = makeCopy(site.page('/'), STRINGS);
export const { META, HOME, FORM, PRIVACY, LISTING, A11Y, PAGE } = COPY;
