import type { Shown } from '../copy/make';
import { LOCALES } from '../content/blocks';

/**
 * Any page's content document, for a site that has more than one.
 *
 * ── what a second page costs, and why it is this file ───────────────────────
 *
 * The home page reads its own document through `src/copy/<locale>.ts`, which is
 * that page's *vocabulary*: `HOME.hero.title`, `HOME.cta.label`, shaped by hand
 * to the blocks this site happens to have. It is rewritten per project, which
 * is exactly why the generic reader is not in it — an agent reshaping the home
 * page's copy must not be able to break how every other page is read.
 *
 * So: a second page imports this, names its own path, and gets the same three
 * things the home page has — the blocks in order, a way to reach one, and the
 * annotation path for every field it renders.
 *
 *   ---
 *   import { readPage } from '../lib/page';
 *   const prices = readPage('/prices');
 *   const { at, of } = prices.block('rates');
 *   ---
 *   <h2 data-jtk-path={prices.pathAt(at, 'title')}>{prices.str(of, 'title')}</h2>
 *
 * ── the document has to be in the repository ────────────────────────────────
 *
 * `jtk/content/prices.json` is committed with empty strings in it, the
 * same way `index.json` is, and for the same reason: a static import of a file
 * that is not there is a build error rather than an empty page, and a fresh
 * project has to build on a laptop before it has ever been attached.
 *
 * The admin learns the page exists when the branch is imported — a page is a
 * file somebody wrote, and that is the only way one comes into being.
 */

type Block = Record<string, unknown> & { type: string };
type Item = Record<string, unknown>;

interface Document {
  path?: string;
  seo?: Record<string, unknown>;
  /** The page's language. Absent is the site's own — see the platform's wiki/29. */
  locale?: string;
  blocks?: Block[];
}

/** One language of a page, for `hreflang` and for a switcher. */
export interface Alternate {
  /** Empty is the site's own language. `META.lang` is what it is called. */
  locale: string;
  path: string;
}

/**
 * Every page document in the repository, keyed by the path it declares.
 *
 * Eager, because a page is read while its route renders and there is nothing to
 * wait for; and by glob rather than by import, because the whole point is that
 * a route names a path and does not have to know which file it lives in.
 */
const documents = import.meta.glob<Document>('/jtk/content/**/*.json', {
  eager: true,
  import: 'default',
});

/**
 * The shared document, if this site has one.
 *
 * A glob of exactly one file rather than an import of it, because a static
 * import of a file that is not there is a build error — and most sites have
 * none. `readShared()` on a site without one answers with nothing, and every
 * `str` off it is an empty string, which is what a page renders before anything
 * has been written.
 */
const sharedDocuments: Record<string, Document | undefined> = {};
for (const [file, document] of Object.entries(
  import.meta.glob<Document>('/jtk/shared*.json', { eager: true, import: 'default' }),
)) {
  // shared.json is the site's own language; shared.de.json is German. Named
  // rather than nested, because there is one per language and a directory of
  // one file is a directory somebody has to explain.
  const match = /\/shared(?:\.([a-z]{2}(?:-[a-z]{2})?))?\.json$/.exec(file);
  if (match !== null) sharedDocuments[match[1] ?? ''] = document;
}

const ANNOTATE = import.meta.env.PUBLIC_JTK_ANNOTATE !== 'false';

export interface Reading {
  /** The page's language, empty for the site's own. */
  locale: string;
  /**
   * Every language this page exists in, itself included, in the order the
   * documents were found.
   *
   * Empty for a page that has one language, which is most pages on most sites.
   * **Feed it to `<Layout alternates={…}>`**: without `hreflang` two language
   * versions of one page compete with each other in search, which is the only
   * thing in this whole area that costs money.
   */
  alternates: Alternate[];
  /** The page's own title and description, for `<Layout>`. */
  seo: { title: string; description: string };
  /** Every block, in the document's own order. */
  PAGE: readonly Block[];
  /** A block by type, with the index an annotation path is built from. */
  block(type: string): { at: number; of: Block };
  str(of: Block, key: string): string;
  rows(of: Block, key: string): Item[];
  picture(of: Block, at: number, key: string): Shown;
  gallery(of: Block, at: number, key: string): Shown[];
  pathAt(at: number, field: string, item?: number, subField?: string): string | undefined;
}

export function readPage(path: string): Reading {
  return reading(find(path), '');
}

/**
 * Another page's document, read from the page that is *showing* it.
 *
 * ── a tile in a list is somebody else's words ───────────────────────────────
 *
 * A blog listing draws a heading, a date and an excerpt for every post, and
 * every one of them belongs to that post's document rather than to the
 * listing's. Annotated the ordinary way they would name a field the listing
 * page has not got, so until this existed they carried no annotation at all —
 * and the words an owner most wants to fix were the one place on their site
 * they could not tap.
 *
 * The prefix says which document, by the address the tile already links to:
 *
 *   <a data-jtk-path={post.pathAt(0, 'title')}>{post.str(of, 'title')}</a>
 *   →  data-jtk-path="page:/blog/healing:blocks[0].title"
 *
 * The admin resolves it against that page, writes it there, and the post's own
 * page updates with it. `annotation-lint` checks the claim from the other end:
 * an address no page has, or a field that page's document has not got, fails
 * the build.
 *
 * Use it where a page renders another page's content and nowhere else. A
 * heading you wrote in *this* page's document is this page's, however much it
 * looks like a tile.
 */
export function readOther(path: string): Reading {
  return reading(find(path), `page:${path}:`);
}

/**
 * The text that is on every page.
 *
 * ── one value, and the annotation says which document it is in ──────────────
 *
 * A footer sentence, the line under the wordmark, the words over the form. They
 * are on every page and belong to none of them, and the wrong answer is the
 * obvious one: declared in each page's document, a three-page site has three
 * copies, and they diverge the first time somebody edits one. The owner changes
 * the footer on the prices page, looks at the home page, and reports that their
 * change disappeared. It did not — it was saved, on one page in three.
 *
 * So it lives in `jtk/shared.json`, once, and every field of it is
 * annotated with the prefix that says so:
 *
 *   <p data-jtk-path={chrome.pathAt(at, 'note')}>{chrome.str(of, 'note')}</p>
 *   →  data-jtk-path="shared:blocks[0].note"
 *
 * `pathAt` here writes the prefix for you. **Annotate it on every page that
 * renders it** — unlike a page's own field, the same annotation on five pages
 * is correct and is what makes the sentence editable wherever somebody happens
 * to be looking. The admin resolves it against the site's document, not the
 * page's, and tells the owner the line is on every page before they change it.
 */
export function readShared(locale = ''): Reading {
  return reading(sharedDocuments[locale], 'shared:');
}

/**
 * The languages a page exists in.
 *
 * ── from the address, because the address is the whole rule ─────────────────
 *
 * A page lives at the same address in every language, with the language in
 * front of it: `/prices` and `/de/preise` are not a pair, `/prices` and
 * `/de/prices` are. So take the language off the front and look for the same
 * address under every other one.
 *
 * This used to read a `group` key both documents declared, which let each
 * language have its own words. That key is a second source of truth for
 * something the addresses already say, and one nobody can check: `group:
 * "work"` on one page against `group: "works"` on the other is two unrelated
 * pages, no error anywhere, and a site that has quietly lost its hreflang. The
 * platform stopped reading it and `fl-check` refuses a document that still
 * carries one.
 *
 * A page in one language answers with nothing rather than with itself: a
 * `hreflang` set of one is noise.
 */
function alternatesOf(document: Document | undefined): Alternate[] {
  const here = document?.path;
  if (typeof here !== 'string') return [];

  const base = basePathOf(here);
  const found = Object.values(documents)
    .filter((other) => typeof other?.path === 'string' && basePathOf(other.path as string) === base)
    .map((other) => ({ locale: other?.locale ?? '', path: other?.path as string }));

  return found.length > 1 ? found : [];
}

/** `/de/prices` → `/prices`, and `/de` → `/`, which is the home page. */
function basePathOf(path: string): string {
  for (const locale of LOCALES) {
    if (path === `/${locale}` || path === `/${locale}/`) return '/';
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}

function reading(document: Document | undefined, prefix: string): Reading {
  const blocks = (document?.blocks ?? []) as Block[];

  const str = (of: Block, key: string): string => (of[key] as string) ?? '';
  const rows = (of: Block, key: string): Item[] => (of[key] as Item[]) ?? [];

  const pathAt = (at: number, field: string, item?: number, subField?: string): string | undefined => {
    if (!ANNOTATE) return undefined;
    if (at < 0 || at >= blocks.length) return undefined;

    return item === undefined
      ? `${prefix}blocks[${at}].${field}`
      : `${prefix}blocks[${at}].${field}[${item}].${subField}`;
  };

  const block = (type: string): { at: number; of: Block } => {
    const at = blocks.findIndex((candidate) => candidate.type === type);
    // A block the document does not have is not an error: the admin can remove
    // one, and a page that threw at build time because a section was deleted
    // would make removing a section a deploy incident.
    return at === -1 ? { at: -1, of: { type } } : { at, of: blocks[at]! };
  };

  return {
    locale: document?.locale ?? '',
    alternates: alternatesOf(document),
    seo: {
      title: (document?.seo?.title as string) ?? '',
      description: (document?.seo?.description as string) ?? '',
    },
    PAGE: blocks,
    block,
    str,
    rows,
    pathAt,
    picture: (of, at, key) => ({
      name: str(of, key),
      alt: str(of, `${key}_alt`),
      path: pathAt(at, key),
    }),
    gallery: (of, at, key) =>
      rows(of, key).flatMap((item, i) => {
        const src = (item.src as string) ?? '';
        if (!src) return [];
        return [
          {
            name: src,
            alt: (item.alt as string) ?? '',
            poster: (item.poster as string) || undefined,
            path: pathAt(at, key, i, 'src'),
          },
        ];
      }),
  };
}

/**
 * The document that declares this path.
 *
 * By the `path` inside the file rather than by the file's name, because that is
 * what publish writes and what the admin reads back: the two must agree about
 * which page is which, and a file somebody renamed is a page that moved.
 */
function find(path: string): Document | undefined {
  for (const document of Object.values(documents)) {
    if (document?.path === path) return document;
  }
  return undefined;
}
