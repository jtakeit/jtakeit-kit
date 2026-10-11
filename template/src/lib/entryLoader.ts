import type { Loader, LoaderContext } from 'astro/loaders';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HAST_PLUGINS } from '../../markdown.mjs';
import { BLOCKS, LOCALES, type Collection } from '../content/blocks';
// The one place that says what a specimen is called. The meta plugin needs the
// same answer — an address nobody can find is a draft the edge hands to
// anybody — and a rule written twice is a rule that ends up meaning two things.
import { specimenId } from '../../specimens.mjs';

/**
 * Reading a collection's entries out of the repository.
 *
 * ── why this is a loader of ours and not `glob` ─────────────────────────────
 *
 * An entry used to be markdown with frontmatter, and Astro's glob loader read
 * exactly that shape with nothing of ours in between. It could hold one block,
 * because the body *was* the file — and a post that wants a gallery between two
 * paragraphs cannot be written that way at all (the platform's wiki/30).
 *
 * So an entry is a document of blocks now, like every other page: a `.json`
 * file with `blocks`, the first of which is the post — its title, its date, its
 * cover and its prose. Everything after it is whatever the collection lets a
 * post hold, rendered by this site's own components.
 *
 * Which leaves one job glob cannot do: the prose is a *string* now, and it has
 * to become HTML through the same markdown pipeline as everything else.
 *
 * ── and not through `ctx.renderMarkdown`, which is the trap ────────────────
 *
 * That is the sanctioned call and it builds its renderer **without the plugins
 * this site configured** — Astro's own code, not a setting: it passes `image`,
 * `syntaxHighlight`, `shikiConfig`, `gfm` and `smartypants`, and stops. A body
 * rendered through it silently loses `figures.mjs`, so a row of three
 * photographs comes out as three paragraphs. Measured, not guessed at: the
 * markers Astro leaves for its image pipeline were still in the HTML.
 *
 * So the same renderer is built here with the same options, from
 * `markdown.mjs`, which is the one place either this or `astro.config.mjs`
 * reads. The `fileURL` is what makes `![](one.jpg)` resolve **beside the
 * entry's own file** — which is exactly where the build downloads it, so the
 * media pipeline is untouched by any of this — and `imagePaths` is what Astro
 * reads back to optimise them.
 */
export function entries(collection: Collection): Loader {
  return {
    name: 'jtakeit-entries',
    async load(ctx: LoaderContext) {
      const prefix = collection.prefix.replace(/^\//, '');
      // No `image:` here on purpose. The processor's image option is
      // `{ domains, remotePatterns }` — which remote pictures may be fetched —
      // and not the site's `{ layout }`. Passing the latter type-checked as
      // nothing in common and meant nothing at runtime; the layout is applied
      // when Astro replaces the markers, from the site config.
      const renderer = await createSatteriMarkdownProcessor({ hastPlugins: HAST_PLUGINS });
      ctx.store.clear();
      /** Whatever this collection's own entries show, for the specimens below. */
      const seen: string[] = [];

      // Every language the site has: its own under `jtk/content/<prefix>/`,
      // the others under `jtk/content/<locale>/<prefix>/` — the platform's
      // own layout for a document at `/de/blog/first-look`. An entry in
      // another language is `<locale>/<slug>` here and carries `locale`,
      // so a listing can take its own and a route can put the language in
      // front (docs/languages.md).
      const roots = ['', ...LOCALES].map((locale) => ({ locale, base: join(process.cwd(), 'jtk', 'content', locale, prefix) }));
      for (const { locale, base } of roots) for (const file of await jsonUnder(base)) {
        const raw = await readFile(file, 'utf8');
        const document = JSON.parse(raw) as {
          blocks?: Record<string, unknown>[];
          visible?: boolean;
          seo?: Record<string, unknown>;
        };
        const blocks = document.blocks ?? [];

        // blocks[0] is the post. A document with none is not corrupt — it is an
        // entry somebody emptied — and refusing to load it would take the only
        // page from which it can be seen and fixed.
        const post = blocks[0] ?? {};
        const body = typeof post.body === 'string' ? post.body : '';

        const slug = relative(base, file).split(sep).join('/').replace(/\.json$/, '');
        const id = locale === '' ? slug : `${locale}/${slug}`;
        const rendered = await drawn(renderer, body, pathToFileURL(file));

        ctx.store.set({
          id,
          data: {
            ...post,
            /** `''` for the site's own language, `'de'` for its German. */
            locale,
            /** Everything after the post, for the template to render. */
            rest: await written(renderer, blocks.slice(1), file),
            /** Whether the site lists it. The page itself is always built. */
            visible: document.visible !== false,
            /*
             * What the post is found by, where it is not what it is called.
             *
             * The admin writes these two beside the post — a title for a result
             * list and the sentence under it — and they are an override, not a
             * requirement: a post that says nothing here is found by its own
             * heading and its announcement. Read in `[...entry].astro`, which
             * is the only place that knows what a head tag is.
             */
            seo: document.seo ?? {},
          },
          rendered,
          /*
           * The half that is easy to leave out and impossible to notice.
           *
           * `imagePaths` in the rendered metadata is what the *runtime* reads
           * to swap a marker for an optimised picture. This is what makes the
           * pictures exist to swap in: the store builds `content-assets` from
           * `assetImports` and from nothing else. Without it the build passes,
           * the page renders, and every picture in a post is an `<img>` with a
           * marker where its `src` should be — which is exactly what happened
           * the first time, and the reason there is a test for it.
           */
          assetImports: rendered.metadata.imagePaths,
          digest: ctx.generateDigest(raw),
          filePath: relative(process.cwd(), file),
        });

        for (const found of pictures(blocks)) seen.push(found);
      }

      await specimens(ctx, renderer, collection, seen);
    },
  };
}

/**
 * One page per arrangement, built with everything else and listed nowhere.
 *
 * ── why a site builds a page nobody will read ───────────────────────────────
 *
 * The admin's preview is the built site with the draft patched onto it, and
 * that works while the shape is the shape the build knows. Put a gallery into a
 * post and it stops: the page has no element for it, and only a build can make
 * one — the arrangement is this repository's markup and this repository's CSS,
 * and an admin that drew its own would be guessing at both.
 *
 * So the build draws one of each, once. The admin takes the markup from here
 * and puts it where the new block goes, and what somebody sees is this site's
 * own arrangement rather than an approximation of it.
 *
 * ── rendered by the route that renders the real thing ───────────────────────
 *
 * Not by a page of its own. A fragment rendered somewhere else is styled
 * somewhere else — `:nth-child`, the classes of a parent, a grid that counts
 * its children — and the copy would be subtly wrong in a way nobody could see
 * until it was live. These are entries, so they go through `[...entry].astro`
 * inside the same article as every other post, and the context is identical by
 * construction.
 *
 * ── invisible, and that is not a trick ──────────────────────────────────────
 *
 * `visible: false` is the same flag a post nobody has finished carries: every
 * place that *lists* entries skips it, the sitemap never sees it, and the
 * studio's edge serves it only to a session that is editing the site. Which is
 * exactly who asks for it.
 *
 * The pictures are the site's own, taken from the entries it already has. A
 * collection with no photographs anywhere gets an empty arrangement — the
 * container without its contents, which is still the right container.
 */
async function specimens(
  ctx: LoaderContext,
  renderer: Renderer,
  collection: Collection,
  pictures: string[],
): Promise<void> {
  for (const kind of collection.body ?? []) {
    const type = BLOCKS.find((one) => one.type === kind);
    if (type === undefined) continue;

    for (const view of type.views ?? [undefined]) {
      const block: Record<string, unknown> = { _key: `${kind}-1`, type: kind, v: type.v };
      if (view !== undefined) block.view = view.key;

      const gallery = type.fields.find((one) => one.kind === 'media' && one.multiple === true);
      if (gallery !== undefined) {
        const wanted = Math.max(1, view?.min ?? 1);
        block[gallery.key] = pictures.slice(0, wanted).map((src) => ({ src, alt: '' }));
      }
      for (const field of type.fields) {
        if (field.kind === 'text' && block[field.key] === undefined) block[field.key] = ' ';
        if (field.kind === 'markdown' && block[field.key] === undefined) block[field.key] = ' ';
      }

      ctx.store.set({
        id: specimenId(kind, view?.key),
        data: {
          title: ' ',
          rest: await written(renderer, [block], 'specimen'),
          visible: false,
          seo: {},
        },
        rendered: { html: '', metadata: {} },
        digest: ctx.generateDigest(JSON.stringify(block)),
      });
    }
  }
}

/** Every picture a document points at, in the order it points at them. */
function* pictures(blocks: Record<string, unknown>[]): Generator<string> {
  for (const block of blocks) {
    for (const value of Object.values(block)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        const src = (item as Record<string, unknown> | null)?.src;
        if (typeof src === 'string' && src !== '') yield src;
      }
    }
  }
}

/**
 * The blocks after the post, with every run of prose in them turned to HTML.
 *
 * A post is a sequence — prose, a gallery, more prose — and the runs after the
 * first are `text` blocks. They are rendered here rather than by Astro's own
 * `render()`, which does one body per entry and knows nothing about a second.
 *
 * Prose only: a picture in a post is a block chosen from the menu this
 * repository declares, not an `![]()` written into the text. The build says so
 * rather than rendering a broken image, because the failure is otherwise a
 * marker in the HTML that nobody sees until the page is live.
 */
async function written(
  renderer: Renderer,
  blocks: Record<string, unknown>[],
  file: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];

  for (const block of blocks) {
    if (block.type !== 'text') {
      out.push(block);
      continue;
    }

    const body = typeof block.body === 'string' ? block.body : '';
    if (/!\[[^\]]*\]\(/.test(body)) {
      throw new Error(
        `${file}: a run of text in a post may not hold a picture — a picture is a block. ` +
          'See COLLECTIONS[].body and the block menu in the admin.',
      );
    }

    const { code } = await renderer.render(body, { frontmatter: {}, fileURL: pathToFileURL(file) });
    out.push({ ...block, html: code });
  }

  return out;
}

/**
 * The prose as HTML, in the shape the content store expects.
 *
 * `imagePaths` is the half that is easy to leave out and impossible to notice:
 * it is how Astro knows which files to optimise, and without it the markers it
 * left in the HTML are never replaced — a picture in a post renders as an
 * `<img>` with no `src` at all.
 */
async function drawn(renderer: Renderer, body: string, fileURL: URL) {
  const { code, metadata } = await renderer.render(body, { frontmatter: {}, fileURL });

  return {
    html: code,
    metadata: {
      ...metadata,
      imagePaths: [...(metadata.localImagePaths ?? []), ...(metadata.remoteImagePaths ?? [])],
    },
  };
}

/**
 * The renderer, taken from the function that makes one rather than described
 * again here.
 *
 * It used to be a hand-written signature, and the copy drifted: it said
 * `metadata` was `Record<string, string[] | undefined>`, while the real one is
 * `{ headings, localImagePaths, remoteImagePaths, frontmatter }` — `headings`
 * is not an array of strings and `frontmatter` is not an array at all. Four
 * errors, and the sort that gets worse rather than better, because the
 * description was in this file and the thing described is in a package that
 * keeps moving.
 *
 * Deriving it leaves nothing to drift. It is deliberately NOT
 * `import type { MarkdownRenderer } from '@astrojs/internal-helpers/markdown'`:
 * that package is not a dependency of this project, only a transitive one of
 * astro, and reaching across that line is a build that breaks on somebody
 * else's refactor.
 */
type Renderer = Awaited<ReturnType<typeof createSatteriMarkdownProcessor>>;

/** Every `.json` under a collection, however deeply a site nests them. */
async function jsonUnder(dir: string): Promise<string[]> {
  let found: string[] = [];

  let listing;
  try {
    listing = await readdir(dir, { withFileTypes: true });
  } catch {
    // A collection nobody has written an entry for yet. Not an error: a site
    // ships its blog before its first post.
    return [];
  }

  for (const item of listing) {
    const full = join(dir, item.name);
    // A collection's own pictures land beside its entries at build time. They
    // are not entries, and reading one as such is a stack trace.
    if (item.isDirectory()) {
      if (item.name !== 'media') found = found.concat(await jsonUnder(full));
      continue;
    }
    if (item.name.endsWith('.json')) found.push(full);
  }
  return found;
}
