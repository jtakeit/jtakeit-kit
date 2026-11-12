import type { Loader, LoaderContext } from 'astro/loaders';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { content, type Block, type Entry } from '@jtakeit/kit/content';
import { readJtk } from '@jtakeit/kit/content/node';
import { HAST_PLUGINS } from '../../markdown.mjs';

/** Where an entry's rendered body is kept: one id per entry and language. `bodyOf` in src/lib/entries.ts reads it back. */
export function storeId(entry: Entry): string {
  return `${entry.collection}/${entry.locale === '' ? '-' : entry.locale}/${entry.slug}`;
}

/**
 * What an entry's rendered body was made of — its prose, and each run of prose
 * below it — kept beside the rendering, so the panel's live preview can tell
 * a body the build rendered from one whose words the draft changed since
 * (`bodyOf`, jtakeit-core wiki/89 §12).
 */
export function sourceOf(entry: Entry): string {
  const body = entry.fields.value('body');
  const texts = entry.body.filter((block) => block.type === 'text').map((block) => block.value('body'));
  return JSON.stringify([typeof body === 'string' ? body : '', texts]);
}

/**
 * The entries' bodies, rendered by this site's markdown pipeline.
 *
 * ── what the loader does now, and what it does not ──────────────────────────
 *
 * Which entries there are, in which language, with which values, and which of
 * them are out, is the door's to say (`@jtakeit/kit/content`): every page that
 * lists or draws an entry asks `site` in src/lib/site.ts. What the door cannot
 * do is the one thing that is this site's own — turn an entry's prose into
 * HTML through the pipeline this site configured, with Astro optimising the
 * pictures in it. That is this loader: one store entry per entry and
 * language, holding its rendered body and the HTML of every run of prose
 * below it, read by `bodyOf` in src/lib/entries.ts.
 *
 * It reads the files the way the door reads them anywhere in Node —
 * `readJtk()` and `content()` — so the store and the pages cannot disagree
 * about which entries exist.
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
export function entries(): Loader {
  return {
    name: 'jtakeit-entries',
    async load(ctx: LoaderContext) {
      await fill(ctx);
      /*
       * Under `astro dev`, read again when a file under `jtk/` comes, goes or
       * changes. Read once, a collection written after the dev server started
       * stayed empty on localhost until a restart — an agent writing a price
       * list mid-session showed the developer a /services with no prices and
       * no form, while the build had both (lewiscoiff, 17 October 2026). All
       * of `jtk/`, not the one file: the catalogue says which collections
       * there are, and the specimens are drawn from every entry.
       */
      if (!ctx.watcher) return;
      const root = join(process.cwd(), 'jtk');
      ctx.watcher.add(root);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const changed = (file: string) => {
        if (!file.endsWith('.json') || !file.startsWith(root + sep) || file === join(root, 'session.json')) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          fill(ctx).then(
            () => ctx.logger.info('entries read again'),
            (why: Error) => ctx.logger.error(`entries could not be read again — ${why.message}`),
          );
        }, 150);
      };
      ctx.watcher.on('add', changed);
      ctx.watcher.on('change', changed);
      ctx.watcher.on('unlink', changed);
    },
  };
}

/** Every entry with a page, and every specimen, rendered into the store. */
async function fill(ctx: LoaderContext): Promise<void> {
  const root = process.cwd();
  const files = await readJtk(root);
  const site = content(files);
  // No `image:` here on purpose. The processor's image option is
  // `{ domains, remotePatterns }` — which remote pictures may be fetched —
  // and not the site's `{ layout }`. Passing the latter type-checked as
  // nothing in common and meant nothing at runtime; the layout is applied
  // when Astro replaces the markers, from the site config.
  const renderer = await createSatteriMarkdownProcessor({ hastPlugins: HAST_PLUGINS });
  ctx.store.clear();

  for (const collection of site.collections) {
    // A collection without pages has no page to render a body on: its entries
    // are rows of its listing, drawn from their values alone.
    if (!collection.pages) continue;
    for (const locale of site.locales) {
      for (const entry of site.entries(collection.name, { locale, all: true })) {
        const file = join(root, entry.file ?? '');
        const body = entry.fields.value('body');
        const rendered = await drawn(renderer, typeof body === 'string' ? body : '', pathToFileURL(file));
        ctx.store.set({
          id: storeId(entry),
          data: { texts: await written(renderer, entry.body, file), source: sourceOf(entry) },
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
          digest: ctx.generateDigest(JSON.stringify(files[entry.file ?? ''] ?? null)),
          filePath: relative(root, file),
        });
      }
      /*
       * The specimens: one page per arrangement of every type a post may
       * hold, in every language, built with everything else and listed
       * nowhere — the door makes them (`site.specimens`), and their prose is
       * rendered here like any other.
       */
      for (const specimen of site.specimens(collection.name, { locale })) {
        ctx.store.set({
          id: storeId(specimen),
          data: { texts: await written(renderer, specimen.body, 'specimen'), source: sourceOf(specimen) },
          rendered: { html: '', metadata: {} },
          digest: ctx.generateDigest(JSON.stringify(specimen.body.map((one) => [one.type, one.view]))),
        });
      }
    }
  }
}

/**
 * The runs of prose below an entry's own, as HTML, by their place in `body`.
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
async function written(renderer: Renderer, blocks: Block[], file: string): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  for (const [at, block] of blocks.entries()) {
    if (block.type !== 'text') continue;
    const value = block.value('body');
    const body = typeof value === 'string' ? value : '';
    if (/!\[[^\]]*\]\(/.test(body)) {
      throw new Error(
        `${file}: a run of text in a post may not hold a picture — a picture is a block. ` +
          'See COLLECTIONS[].body and the block menu in the admin.',
      );
    }
    const { code } = await renderer.render(body, { frontmatter: {}, fileURL: pathToFileURL(file) });
    out[at] = code;
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
