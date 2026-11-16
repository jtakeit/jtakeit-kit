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
  rows, never markup; the gallery's arrangement is the block's.
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

## Moving a site

`jtk upgrade contract-3` lays the scaffold's files out where a site's are the
scaffold's, hands `astro.config.mjs`'s config to `liveRender` where it is
written the scaffold's way, adds `@astrojs/node`, lays in `src/live/` and
says `RENDER = 'live'`. Where any of those is the developer's, it leaves the
word and `src/live/` out, and says so first in its list for a person: the
site will not be drawn live, and the owner previews no change before a build.

Wiring the site's own pages in is then the developer's, and it is the next
step, not a later one:

1. make each file the upgrade names the scaffold's, or move its reads to the
   door per request, as the table above says;
2. lay in the scaffold's `src/live/`
   (`node_modules/@jtakeit/astro/template/src/live/`), the config's two lines
   (`liveRender` from `./jtakeit-meta.mjs`) and `@astrojs/node`;
3. list in `DRAWN` (`jtakeit-meta.mjs`) every route of the site's own that
   reads `Astro.props` from its `getStaticPaths`;
4. say `RENDER = 'live'`, run `jtk schema`, and build: the platform's check
   names any page that differs.

A site already on contract 3 takes the same files by hand: `src/live/`,
`src/lib/{site,entries,entryLoader,uploads,icon}.ts`, `src/copy/index.ts`,
`jtakeit-meta.mjs`, the config's two lines and the dependency, then the word.
Only where a page cannot be rewritten does the word stay out — with its
reason in `BRIEF.md` ([the one exception](#the-one-exception)).
