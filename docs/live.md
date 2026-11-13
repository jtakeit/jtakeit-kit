# The draft, drawn live

The panel's preview shows a saved field in the frame within about a second,
on a site whose template says it is ready: `RENDER = 'live'` in
`src/content/blocks.ts`, written by `jtk schema` as `render: "live"` in
`jtk/schema.json`. A site `jtk create` lays out says it from the first commit.
Without it — or where the platform's check below says no — the preview shows
the build after each save, as it always has. What is published is always the
build.

## What the platform does with the word

At every build of the preview (a build with annotations), after the static
build:

1. it builds the same tree for a server: `JTK_RENDER=live astro build`, with
   `@astrojs/node` in middleware mode — the site's own dependency, at the
   version its lockfile names. A save that changed only content builds no
   second server: the one made for the code is kept;
2. it draws a few of the built pages with that server, from the build's own
   files, and holds each to the built page. Allowed to differ, and only
   because of what a server build is: the hashed names of scripts and
   stylesheets, the files a picture is served from (the static build's are
   optimised, the live ones are the picture as it is), and which stylesheet a
   rule is in — every rule of the built page's styles must be there live;
3. where every page is the same, the panel draws the draft live from then on;
   where one is not, the build's log says which and where, and the preview
   shows the build.

## What the template does for it

All of it is in the scaffold, and none of it changes a static build: a site
built static with these files makes the same bytes it made before them.

- **The door is the request's** (`src/lib/site.ts`, `@jtakeit/kit/live`).
  `site` answers from the draft the renderer hands a request, and from the
  build's files at every other moment. So nothing may read the door at a
  module's top level and keep what it read: a module is evaluated once a
  process, and a server draws draft after draft. The copy (`src/copy/`) is
  made again from each draft's home page (`copyFor`); `EVERY_LOCALE` is the
  one top-level read left, and the languages are the code's.
- **One route draws the catch-alls** (`src/live/Route.astro`). A server
  ignores `getStaticPaths` and hands the first route that matches no props, so
  under `JTK_RENDER=live` the scaffold's `[...entry]`, `[...listing]`,
  `[...listing]/page/[page]` and `[...lang]/index` become the templates of one
  route, `/[...path]`, which asks each one's own `getStaticPaths` against the
  draft — an entry added since the build is found as a build finds it.
  A route of your own that reads `Astro.props` from its `getStaticPaths` is
  listed in `DRAWN` in `jtakeit-meta.mjs` and drawn by that route too, or the
  check says its pages differ.
- **An entry's body** is the one the build rendered while its words are the
  same, and drawn by the site's own pipeline (`markdown.mjs`) when the draft
  changed them (`bodyOf`, `src/lib/entries.ts`).
- **A picture uploaded since the build** is the bucket's file, as it is, at
  the size the platform measured (`uploaded`, `src/lib/uploads.ts`); one the
  build fetched, or one the repository ships, is the server build's own copy.
  Nothing is resized on request (`src/live/images.ts`).
- **No disk at render**: the files of `src/pages` and whether `public/icon.png`
  is there are read when the build starts (`virtual:jtk/build`,
  `jtakeit-meta.mjs`); sharp is imported where the icons are drawn, and the
  icons are drawn once, by the server build.

## Moving a site

`jtk upgrade contract-3` lays the scaffold's files out where a site's are the
scaffold's, hands `astro.config.mjs`'s config to `liveRender` where it is
written the scaffold's way, adds `@astrojs/node`, and says `RENDER = 'live'` —
and where any of those is the developer's, it says which and leaves the word
out. A site already on contract 3 takes the same files by hand: `src/live/`,
`src/lib/{site,entries,entryLoader,uploads,icon}.ts`, `src/copy/index.ts`,
`jtakeit-meta.mjs`, the config's two lines and the dependency, then the word.
