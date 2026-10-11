/**
 * Every sentence a visitor reads — read from `jtk/content/index.json`
 * rather than written here.
 *
 * The strings live in the repository's content document so that the studio's
 * admin can edit them: a commit under `jtk/` **is** the published state,
 * and publishing writes that file. This module is the adapter between that
 * document and the shape the components already import, which is why the
 * exports below look ordinary — nothing in a component has to know where its
 * text came from.
 *
 * Two things did not move, because they are not content:
 *   META  — the `<html lang>` value and the title suffix
 *   A11Y  — the skip link
 *
 * Comments and identifiers stay English. The values are the client's language.
 *
 * ── the document, and the file that ships with this scaffold ────────────────
 *
 * `jtk/content/index.json` is committed with empty strings in it, and that
 * is deliberate: a fresh project must `npm run build` on a laptop the minute
 * `fl-init` finishes, and a static import of a file that is not there is a build
 * error rather than an empty page. The first publish from the admin replaces it
 * wholesale.
 *
 * `jtk/catalogue.json` is **not** shipped. It describes what blocks a site
 * has, the admin seeds it from the registry on the first publish, and a copy
 * here would be a second one to keep in step by hand.
 */
import page from '../../jtk/content/index.json';
import { LOCALE } from '../content/blocks';
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
  a11y: { skipToContent: '{{UI_SKIP_TO_CONTENT}}' },
};

export const COPY = makeCopy(page, STRINGS);
export const { META, HOME, FORM, PRIVACY, A11Y, PAGE, block, str, rows, picture, gallery, flPath, pathAt } = COPY;
export type { Shown } from './make';
