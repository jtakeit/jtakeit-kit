# The draft, drawn live

The panel's preview shows a saved field in the frame within about a second,
and an entry's card before the entry is saved, on a site whose template says
it is ready: `RENDER = 'live'` in `src/content/blocks.ts`, written by
`jtk schema` as `render: "live"` in `jtk/schema.json`. A site `jtk create`
lays out says it from the first commit, with the scaffold's `src/live/`.
Without it — or where the platform's check below says no — the owner sees a
change only after a build, and an entry not yet saved cannot be previewed at
all. What is published is always the build.

## Keep it

A contract-3 site keeps its pages drawable live (the owner, 16 November
2026): `RENDER = 'live'` stays in `src/content/blocks.ts`, and `src/live/`
stays the scaffold's. `jtk schema` advises on a schema without it
(`JTK_W_NOT_LIVE`, at `render`), as `validate_schema` does — advice, never a
failed run.

The live renderer runs on the edge: no Node `fs`, no sharp, no network but
the draft it is handed. What a page does at build time it must be able to do
there, so a page stays drawable live when:

| A page… | never… | but |
|---|---|---|
| reads its content through the door — `site.page()`, `site.entries()`, `site.shared()`, `site.facts()`, `site.settings()` — in the frontmatter of the page or section that draws it | `import home from '../../jtk/pages/index.json'`, `import.meta.glob('/jtk/…')`, `fs.readFile('jtk/…')`, or a read at a module's top level kept in a constant | the door, per request: it answers from the draft live and from the files at build |
| draws a picture the owner may change from its library key, through `<Shot>` (`block.picture('image')`, `block.gallery('images')`, an entry's `fields.picture('cover')`) | a directory scanned with `fs.readdir` for its pictures, a file read to measure it, sharp called in a page | the media library ([media.md](media.md)): `jtk media push` turns a folder of photographs into keys in the fields; a picture only the code draws is a slot, `<Shot name="…">` ([photos.md](photos.md)) |
| takes a file the owner gives — a menu, a price list as PDF — from a field of the library | a file read off the disk in the frontmatter, or listed from `public/` | a field holding the library key, read through the door |
| does no build-time-only work in its frontmatter | `fetch()` to another service, a file read or written, an image resized, a child process | what the page needs, written in `jtk/` (the owner's) or in the code (yours); what is fetched once, fetched by a script before the build and committed |
| draws the same thing twice from the same draft | `new Date()`, `Math.random()` in the markup | the build's year (`YEAR`, `virtual:jtk/build`); an entry over by its date says `ended` (`ends_by`, [collections.md](collections.md)); «open now», a shuffle — a script in the browser |

A route of your own that reads `Astro.props` from its `getStaticPaths` is
listed in `DRAWN` in `jtakeit-meta.mjs` (below).

## The one exception

Take `RENDER = 'live'` out only for a page that does at build what a server
on the edge cannot, and that cannot be rewritten as above — and then write
the reason in `BRIEF.md`, under Decisions: which page, what it does at build,
why it cannot move to the door or the library. The owner loses the preview of
unsaved changes for the whole site, and the next developer reads why.

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

## The example's sections

The example site's sections (`src/components/sections/`) and frame
(`src/components/site/`) are written to the same rules, and `test/live.mjs`
holds every page of the example — in two languages, with each section removed,
with a blog and a booking kit added — to its built twin:

- **A section reads what it is handed.** `Blocks.astro` hands each section its
  block, the page and the language from its own frontmatter; a section that
  reads a collection (`site.entries('services')`) or the shared text does it in
  its own frontmatter too. `SECTIONS` holds components, never values.
- **Nothing that differs between two renders.** The footer's year is the
  build's (`YEAR`, `virtual:jtk/build`); «open now» is a script over the hours'
  rows, never markup, and it reads the business's clock, never the browser's:
  the markup names the zone (`data-zone` — the diary's `zone`, else the
  country's, `zoneOf` in `src/components/site/words.ts`) and the script asks
  `Intl.DateTimeFormat` with that `timeZone`; where no zone is known it says
  nothing. The gallery's arrangement is the block's.
- **Pictures through `<Shot>`**, so one uploaded in the panel since the build is
  the bucket's at its measured size.
- **The imprint** is `src/pages/[...lang]/imprint.astro`, which reads no
  `Astro.props` and is rendered by the server as it is; `/services` is the
  listing's catch-all, which draws its page's sections (`site/Page.astro`).

## A tap on everything

The example draws every value it shows as its own annotated element and names
the source of what it works out — `data-jtk-from`, written by the door's
`from()` (`facts.from()`, a block's or the hours' `from()`, an entry's,
`site.settings('bookings').from()`), never typed. Both are attributes of the
page like any annotation: the live render writes them from the draft as the
build does, and a tap on a value saved since the build opens the same place.
The frame's headings over the address and the hours are optional shared fields
(`contacts.address_label`, `reach_label`, `maps_label`, `hours.label`): the
business's words where written, the kit's word in each language where empty.

## Two sheets, one rule

The server build bundles a page's stylesheets differently from the static
one: where two sheets every page reads say the same selector — the
scaffold's `global.css` and the site's own, say — it merges them into one,
and its minifier drops the rule the later one overrides. The static build
kept both. The platform's check then finds a rule of the built page missing
live, and draws nothing live (KAIF, 16 November 2026: `a { color }` and
`:focus-visible` in both `global.css` and `kaif.css`).

Write an overriding rule once: change it where it is first said, and take
the second one out, rather than saying it again in a later sheet.

## Moving a site

`jtk upgrade contract-3` lays the scaffold's files out where a site's are the
scaffold's, hands `astro.config.mjs`'s config to `liveRender` where it is
written the scaffold's way, adds `@astrojs/node`, lays in `src/live/` and
says `RENDER = 'live'`. Where the site's integration is its own — not
`jtakeit-meta.mjs`, as KAIF's `fastlane-meta.mjs` — it lays in only what the
routes need (`src/live/middleware.ts` and `images.ts`, and `Route.astro`
only beside the scaffold's four catch-alls), wraps the config where the
integration already says `liveRender`, and otherwise prints the lines to
paste. Whatever it cannot do it says first in its list for a person, file by
file with what each must do: the site will not be drawn live, and the owner
previews no change before a build.

## By hand, where the upgrade cannot

Wiring the site's own pages in is the developer's, and it is the next step,
not a later one. Each step as KAIF took it:

1. **The adapter.** `npm install @astrojs/node` at the version the scaffold's
   `package.json` names; the platform's renderer runs what the lockfile
   says.
2. **The middleware and the pictures.** Copy
   `node_modules/@jtakeit/astro/template/src/live/middleware.ts` and
   `images.ts` into `src/live/`. `Route.astro` only where `src/pages` has the
   scaffold's `[...entry]`, `[...listing]`, `[...listing]/page/[page]` and
   `[...lang]/index` — it draws exactly those.
3. **The integration.** In the site's Astro integration, under
   `process.env.JTK_RENDER === 'live'` only: export `liveRender(config)`,
   which returns the config with `output: 'server'`,
   `adapter: node({ mode: 'middleware' })` and `src/live/images.ts` as the
   image service; in `astro:config:setup`, when `config.output === 'server'`,
   `addMiddleware({ entrypoint: …/src/live/middleware.ts, order: 'pre' })`
   (and `injectRoute` for `Route.astro` where step 2 laid it).
   `jtk upgrade` prints these lines for an integration it does not know;
   `template/jtakeit-meta.mjs` is the whole of it.
4. **The config.** `export default defineConfig(await liveRender({ … }))`,
   `liveRender` imported from the integration.
5. **The routes that take props.** A route that reads `Astro.props` from its
   own `getStaticPaths` — `[...entry].astro`, `[...feed].xml.ts` — gets no
   props from a server. Prerender it under `JTK_RENDER=live` (in
   `astro:route:setup`, `route.prerender = true`), or draw it through
   `Route.astro`. A page that reads no `Astro.props` (`/`, `/afisha`) needs
   neither: the server draws it per request.
6. **The reads.** Every read of content at a module's top level moves into
   the frontmatter of the page or section that draws it, through the door —
   `src/lib/site.ts` wrapped in `live()` from `@jtakeit/kit/live` (the table
   at the top). Two sheets that say one rule say it once (above).
7. **The word.** `export const RENDER = 'live'` after `CONTRACT = 3` in
   `src/content/blocks.ts`, then `npx @jtakeit/astro schema`.
8. **The check.** `npm run build`, then `JTK_RENDER=live npm run build`: the
   server build must build too (it writes `dist/` for a server — build
   static again after it). Then push and build on the platform, whose check
   draws a few pages live, holds each to its built twin and names any page
   that differs in the build's log. The platform makes its server build in
   `.jtk-live/` beside the checkout: put that in `.gitignore`.

A site already on contract 3 takes the scaffold's files the same way:
`src/live/`, `src/lib/{site,entries,entryLoader,uploads,icon}.ts`,
`src/copy/index.ts`, `jtakeit-meta.mjs`, the config's two lines and the
dependency, then the word. Only where a page cannot be rewritten does the word
stay out — with its reason in `BRIEF.md` ([the one exception](#the-one-exception)).
