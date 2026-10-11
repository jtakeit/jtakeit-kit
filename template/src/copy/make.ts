/**
 * The copy for one language: what the home document of that language says
 * (`jtk/content/index.json` for the site's own, `jtk/content/<locale>.json`
 * for another — the platform keeps the page at `/de` in `de.json`), and the
 * handful of strings that are not content, passed in.
 *
 * `src/copy/<locale>.ts` calls this once for the site's language; a second
 * language is a second file beside it that calls it with its own home
 * document and its own strings, and a line in `src/copy/index.ts`. Nothing
 * in a component knows which language it is rendering: it asks `copyFor`
 * for the page it is on (docs/languages.md).
 */

export interface Shown {
  readonly name: string;
  readonly alt: string;
  /** `data-jtk-path` for this picture: `blocks[3].work[7].src`. */
  readonly path?: string;
  /** A clip's poster — the still every refused autoplay lands on. */
  readonly poster?: string;
}

export type Block = Record<string, unknown> & { type: string };
export type Item = Record<string, unknown>;

/** A home document, as the file holds it. */
export interface HomeDocument {
  seo?: { title?: string; description?: string };
  blocks: unknown[];
}

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
  a11y: { skipToContent: string };
}

const ANNOTATE = import.meta.env.PUBLIC_JTK_ANNOTATE !== 'false';

export function makeCopy(page: HomeDocument, S: Strings) {
  const blocks = page.blocks as unknown as Block[];

  const block = (type: string): { at: number; of: Block } => {
    const at = blocks.findIndex((candidate) => candidate.type === type);
    // A block the document does not have is not an error: the admin can
    // remove one, and a build that threw for it would make removing a
    // section a deploy incident.
    return at === -1 ? { at: -1, of: { type } } : { at, of: blocks[at]! };
  };
  const str = (of: Block, key: string): string => (of[key] as string) ?? '';
  const rows = (of: Block, key: string): Item[] => (of[key] as Item[]) ?? [];

  /**
   * The path of a field, for `data-jtk-path`; undefined when annotations are
   * off, so a production build carries no trace of the editor.
   */
  const pathAt = (at: number, field: string, item?: number, subField?: string): string | undefined => {
    if (!ANNOTATE) return undefined;
    if (at < 0 || at >= blocks.length) return undefined;
    return item === undefined ? `blocks[${at}].${field}` : `blocks[${at}].${field}[${item}].${subField}`;
  };

  const flPath = (type: string, field: string, item?: number, subField?: string): string | undefined =>
    pathAt(block(type).at, field, item, subField);

  /** One picture of a block: its slot, its alt (`<key>_alt`), its path. */
  const picture = (of: Block, at: number, key: string): Shown => ({
    name: str(of, key),
    alt: str(of, `${key}_alt`),
    path: pathAt(at, key),
  });

  /** A gallery field as pictures, each with its own path. */
  const gallery = (of: Block, at: number, key: string): Shown[] =>
    rows(of, key).flatMap((item, i) => {
      const src = (item.src as string) ?? '';
      if (!src) return [];
      return [{ name: src, alt: (item.alt as string) ?? '', poster: (item.poster as string) || undefined, path: pathAt(at, key, i, 'src') }];
    });

  const hero = block('hero').of;
  const cta = block('cta_banner').of;

  const META = { lang: S.lang, ogLocale: S.ogLocale, titleSuffix: S.titleSuffix } as const;

  const HOME = {
    title: page.seo?.title ?? '',
    description: page.seo?.description ?? '',
    hero: {
      eyebrow: str(hero, 'eyebrow'),
      heading: str(hero, 'title'),
      lead: str(hero, 'lead'),
      cta: str(hero, 'cta_label'),
      ctaHref: str(hero, 'cta_href') || '#contact',
      image: str(hero, 'image'),
      imageAlt: str(hero, 'image_alt'),
    },
  } as const;

  const FORM = {
    title: str(cta, 'title'),
    lead: str(cta, 'lead'),
    // The questions, which are the business's own — see blocks.ts.
    name: str(cta, 'name_label'),
    contact: str(cta, 'contact_label'),
    message: str(cta, 'message_label'),
    required: S.form.required,
    requiredNote: str(cta, 'required_note'),
    privacy: S.form.privacy,
    submit: str(cta, 'cta_label'),
    sending: S.form.sending,
    success: S.form.success,
    error: S.form.error,
    invalidName: S.form.invalidName,
    invalidContact: S.form.invalidContact,
    invalidMessage: S.form.invalidMessage,
    demoNote: S.form.demoNote,
  } as const;

  return {
    META,
    HOME,
    FORM,
    PRIVACY: S.privacy,
    A11Y: S.a11y,
    PAGE: blocks as readonly Block[],
    block,
    str,
    rows,
    picture,
    gallery,
    flPath,
    pathAt,
  };
}

export type Copy = ReturnType<typeof makeCopy>;
