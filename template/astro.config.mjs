// @ts-check
import { env } from 'node:process';
import { defineConfig } from 'astro/config';
import { jtakeitMeta, liveRender } from './jtakeit-meta.mjs';
import { satteri } from '@astrojs/markdown-satteri';
import { IMAGE, HAST_PLUGINS } from './markdown.mjs';

// The host this build claims as its own: it is what canonical links, the
// sitemap and the OG tags are written against. `src/data/site.ts` reads it back
// out of `import.meta.env.SITE`, so it is written down exactly once.
//
// SITE_URL is what the platform gives every build: the site's address. There
// is one kind of build, and the preview shows it under the slug.
const SITE = env.SITE_URL ?? '{{PREVIEW_URL}}';

/**
 * The path this build is served under, taken from SITE_URL rather than
 * configured beside it.
 *
 * **Without this the preview is a bare document, and it took three separate
 * afternoons to see why.** A site's own address is a host — assets come out as
 * `/_astro/style.css` and resolve — but the studio's preview serves the same
 * build under `https://preview…/p/<slug>/`, where that path is not the site's
 * root and every stylesheet, every script and every image asks for something
 * that is not there. The page renders with no CSS at all, which reads as a
 * broken build rather than as a wrong prefix.
 *
 * Deriving it from SITE_URL is what makes it impossible to set one and forget
 * the other: they are one decision, and there is one place it is written.
 * A build for a real host gets `/` and nothing changes.
 */
const BASE = new URL(SITE).pathname;

// `liveRender` hands this back as it is — except to the platform's second
// build of a site whose schema says `render: "live"` (JTK_RENDER=live), which
// it makes for a server, for the panel's live preview of the draft
// (jtakeit-meta.mjs). What is published is the static build alone.
export default defineConfig(await liveRender({
  site: SITE,
  base: BASE,

  // Static output. There is no server-side part: the lead form posts to
  // /api/lead, which the platform serves beside the site.
  output: 'static',

  /**
   * Responsive images by default — which is a decision about *bodies*, not
   * about components.
   *
   * A picture inside an entry of a collection is markdown: `![alt](media/…jpg)`,
   * with no props to pass and nowhere to pass them. Without a layout Astro
   * emits one optimised file and an empty `srcset`, so a phone downloads the
   * sixteen-hundred-pixel version of every photograph in a blog post. With
   * `constrained` the same markdown produces the full set — 640 through 1600 —
   * and `sizes` to go with it.
   *
   * Components that already choose their own widths opt out with
   * `layout="none"` and are unchanged; `Shot.astro` does.
   */
  image: IMAGE,

  /**
   * A picture in a body is a figure, and pictures side by side are a row.
   *
   * The whole of what a post's pictures can look like, and it adds no syntax:
   * one image alone in a paragraph is a figure, several in *one* paragraph are
   * a row, and the caption is markdown's own title slot. See figures.mjs — the
   * argument for why this is not a markdown dialect is worth reading before
   * anybody adds one.
   *
   * `hastPlugins` belongs to the processor, not to Astro. Written as
   * `markdown: { hastPlugins }` it was accepted and ignored — Astro 7 has no
   * such option — so `figures()` applied to bodies the loader rendered and to
   * nothing Astro rendered itself. Two pipelines, one of them silently plain,
   * and no error anywhere to say so.
   */
  markdown: { processor: satteri({ hastPlugins: HAST_PLUGINS }) },

  // Writes dist/_meta.json: the redirects and the unfinished entries, which
  // are the two things the studio's edge cannot read off a page.
  integrations: [jtakeitMeta()],

  build: {
    // One canonical URL per page, with the trailing slash a redirect map and a
    // sitemap both expect.
    format: 'directory',
  },
}));
