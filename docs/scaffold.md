# The scaffold, and what the platform holds it to

```bash
npx @jtakeit/astro create <slug> --name "The Business" --locale de-CH --vertical salon
```

Copies `template/`, fills in the tokens, names the copy module for the locale,
lays out the example site, writes a README and makes the first commit
(`--no-git` to skip it). Every component is a starting point, and the contract
below is the only thing the platform will hold the repository to.

## The example site

What it lays out is an **example in the design system of Brumy** (brumy.ch), the
company that makes jtakeit (jtakeit-core wiki/110): a home page of eight
sections — a hero with a photograph, values, services and prices, a gallery, the
team, testimonials, questions, and the form with the address and the hours —
a price list at `/services`, the privacy page and an imprint, a header with the
navigation, the language switch and a button, and a footer with the hours, the
profiles and the legal links. Every word and picture is content, tapped and
translated in the panel; the words are the example's, in the business's own
name, in the site's language and English (German and English for a
German-speaking site); the photographs are the example's own (`example/media/`),
named as keys of the media library from the first line (below).
No sentence states a fact about the business: the people are «Muster», the
address is Musterstrasse 1, the testimonials are signed «an example».

Say so to the developer: the look may be kept, and is meant to be adapted — a
palette and a type pairing from the brief replace `src/styles/tokens.css` and
the three `@fontsource` packages, and every component keeps working; a deeper
direction replaces sections in `src/components/sections/`. `jtk/design.json`
says `"look": "brumy"` (`--look` takes no other yet).

| | where |
| --- | --- |
| the tokens: colour, type, space, radius, motion, the glass | `src/styles/tokens.css` |
| what is made of them: the glass, the button, the mono label, a section's frame | `src/styles/look.css` |
| the fonts, self-hosted (SIL OFL 1.1), two weights preloaded | `src/components/site/Look.astro` |
| the header, the footer, the hours, the button | `src/components/site/` |
| a section per block type, and the `SECTIONS` map | `src/components/sections/` |
| the declaration of every section's type, the shared `header`, `hours`, `footer` | `src/content/blocks.ts` |

`Blocks.astro` draws a block through its section where `SECTIONS` has one and as
the plain band where it has none; the layout draws the header, the footer and
the look where `src/components/site/` has them (`src/lib/sections.ts`). A site
without them — one laid out before the example, or moved from contract 2 —
builds the same bytes it always did.

The brief decides what stays: `npx @jtakeit/astro remove <section>` and
`add <section|module>`, or `create --without team,testimonials` ([units.md](units.md)).

The site is on contract 3: a new site is always laid out on the latest
contract, and contract 2 is only for a site made before it and not moved yet
(below). The template is one for both: its pages read the content through the
kit's door, and only the files that are a contract's own differ — contract 3's are laid
from `template/contract-3/` in place of contract 2's `src/content/blocks.ts`
and `jtk/content/`.

## The example's photographs

Every picture of the example is a field, and its value is a key of the media
library (jtakeit-core wiki/108, wiki/110 §2.6) — of a reserved pseudo-site,
`jtk-example`, until the site has a library of its own:

```
jtk/pages/index.json        "image": { "src": "media/jtk-example/a7a52f1ef1b7c2b1.jpg", "alt": "…" }
src/assets/media/jtk-example/a7a52f1ef1b7c2b1.jpg    the file the dev server draws (git-ignored)
jtk/entries/blog/media/jtk-example/…                 a post's picture, beside the post
```

`a7a52f1ef1b7c2b1` is the first sixteen hex digits of the file's SHA-256 — the
library's own key scheme. The files are copied there by `jtk create` and
`jtk add`, so the site draws them on a laptop with no network; nothing of them
is committed.

**Before the first push**, they go into the site's own library:
`npx @jtakeit/astro push '<url>' --media '<media url>'` (or `media push` before
a git push) uploads each by its bytes and writes `media/<site>/<same hash>.jpg`
over `media/jtk-example/…`. The owner then finds them in the library, «used
on» their pages, and replaces them there. A push without the media step is
told so: the platform cannot fetch `media/jtk-example/…` for a build.

A site laid out by 0.17.0 named them by slot — `example-hero`, a file in
`src/assets/`. The same push adopts those.

## What comes next

It ends by printing the platform's order (`jtakeit:///guides/start.md`), and
the README it writes says the same:

1. `create_site`, if the site is not made yet — with the brief's currency.
2. `npm ci && npm run dev`, then `open_dev_session` with its address and the
   `run` command its answer gives — before writing a line.
3. `src/content/blocks.ts`, then `npx @jtakeit/astro schema`.
4. `validate_schema` with the schema, the `jtk/` files and the `site_id`.
5. No GitHub remote in the copy → `push_code` and `media_link`, then
   `npx @jtakeit/astro push '<url>' --media '<media url>'`: the photographs go
   into the site's media library first ([media.md](media.md)); a GitHub remote
   → `media_link` and `npx @jtakeit/astro media push '<url>'` before the
   commit, ask the developer once, then our GitHub App on it (a person
   installs it) and `attach_repo`.
6. `commit_and_build` — nothing public; `get_build` until it settles;
   `preflight` before saying done.

## The tokens

| token | example |
| --- | --- |
| `{{SLUG}}` | `duckit` — the directory and the package name |
| `{{NAME}}` | `DUCK IT` |
| `{{LOCALE}}` | `de-CH` — the copy module's name, `src/copy/de-CH.ts` |
| `{{LANG}}` | `de-CH` — `<html lang>` |
| `{{OG_LOCALE}}` | `de_CH` |
| `{{PHONE_REGION}}` | `CH` — the region `libphonenumber` parses the number in |
| `{{SCHEMA_TYPE}}` | `LocalBusiness`, or `--schema-type HairSalon` |
| `{{PREVIEW_URL}}` | `http://localhost:4321/` — where `astro dev` says it is; every build the platform makes passes `SITE_URL` |
| `{{UI_*}}` | the form's, the privacy page's and a listing's sentences («And 3 more», «Page 2 of 5») in the site's language |
| `{{HOME_NAME}}` | `Startseite` — the home page's `name` on contract 3, in the site's language |

An unreplaced `{{` anywhere in the tree is a scaffold bug; the package's smoke
test fails on one.

## The `jtk/` contract

Contract 3, what `jtk create` lays out (jtakeit-core wiki/98):

```
jtk/schema.json                       what the owner may edit — written from src/content/blocks.ts
                                      (`CONTRACT = 3`) by `jtk schema`; the schema the pages
                                      render from, through the kit's door
jtk/pages/<path>.json                 a page — `/` is index.json — with its id, path and name
jtk/entries/<collection>/<slug>.json  an entry: its id, slug, its own values under `fields`
jtk/shared.json                       the text on every page: the business's contacts, by role
jtk/modules/bookings.json             the diary's settings, when the schema turns bookings on
jtk/design.json                       the design document the panel reads for the editor's chrome
jtk/site.json                         the platform's, written by its saves: never by the scaffold
```

Every page and entry carries its `id`, every block, row and picture its `_key`:
`jtk schema` mints the ones a file lacks. The documents are the panel's, written
by a publish. A module's settings are its own document, `{ "v": 1, "settings":
{ … } }`, each row of a list with its `_key`; `jtk schema` seeds an empty one
when the file is missing — fill in `settings` and commit it, and `import_branch`
reads it into the diary so the demo takes bookings before anybody opens the
panel.

```json
{
  "v": 1,
  "settings": {
    "zone": "Europe/Zurich",
    "hours": [{ "_key": "mon", "day": "monday", "opens": 540, "closes": 1020 }],
    "horizon": 30,
    "confirm": "auto",
    "payment": "no"
  }
}
```

The currency is the site's setting, not a file of the scaffold's: it is given
once, to `create_site` (or as `currency` at the top of `jtk/site.json`, which an
import takes while the site has none), and a person changes it in the panel
after that.

A contract-3 site in several languages is laid out with `--locales`
(`jtk create probe --locale de-CH --locales en`): each other language a
translation beside every original, its words that are not content in
`src/copy/<locale>.ts` ([languages.md](languages.md)). A site made before
contract 3, and not moved yet, keeps contract 2's files, in one language
(`jtk create --contract 2` still lays them out exactly as they were, for the
kit's own tests and for rehearsing a move — never for a new site):

```
jtk/catalogue.json    what the owner may edit — derived from src/content/blocks.ts by `jtk catalogue`;
                      the schema the pages render from, through the kit's door
jtk/content/*.json    the values, one document per page — the panel's, written by a publish,
                      each known by the `path` inside it
jtk/bookings.json     the diary's settings, when the catalogue turns bookings on — seed it here
jtk/design.json       the design document the panel reads for the editor's chrome
```

There, `jtk/bookings.json` has one shape, and it is the one a publish writes
back: a document of one block of type `bookings_config`, with the settings as
that block's fields. `jtk catalogue` writes the empty skeleton when the file is
missing; fill it in and commit it, and `import_branch` reads it into the diary
so the demo takes bookings before anybody opens the panel. `jtk upgrade
contract-3` moves such a site to contract 3 in one commit.

```json
{
  "blocks": [
    {
      "type": "bookings_config",
      "v": 1,
      "zone": "Europe/Zurich",
      "hours": [{ "day": "monday", "opens": 540, "closes": 1020 }],
      "horizon": 30,
      "confirm": "auto",
      "payment": "no"
    }
  ]
}
```

Times are whole minutes from midnight (540 is 09:00). The settings written as
top-level keys — no `blocks` — is the mistake the platform now refuses on import
with `JTK_E_MODULE_FILE_INVALID`, rather than reading an empty diary out of it.
The platform's modules reference lists every field.

The repository decides what a site *is*; the panel fills in the values. A commit
under `jtk/` **is** the published state, and a publish writes these files back.
`import_branch` reads them into the panel after you commit; `publish` makes them
what the preview offers.

## The build contract

The platform builds every commit in a container: `npm ci`, `npm run build`, the
annotation lint over `dist/`, upload. Three flags arrive as environment, read as
`import.meta.env`:

| flag | what |
| --- | --- |
| `SITE_URL` | the site's address, `https://<host>/` — the canonical and the sitemap follow it; under the preview it carries a path, `/p/<slug>/`, and `astro.config.mjs` derives `base` from it |
| `PUBLIC_INDEXABLE` | `true` once the site is launched; feeds the robots meta tag, `robots.txt` and the sitemap |
| `PUBLIC_JTK_ANNOTATE` | whether `data-jtk-path` is emitted — always on; the edge strips it for visitors |

`jtakeit-meta.mjs` writes `dist/_meta.json` beside the pages: the redirects and
the unfinished entries, which the edge cannot read off a page.

**The lockfile is pinned and committed.** `npm ci`, never `npm install`, in a
site: the platform's runner bakes the scaffold's `node_modules` so a build takes
twenty seconds rather than ninety, and a lockfile that drifted from the
scaffold's is a build that installs from scratch.

**There is no deploy.** The platform builds and serves; a site has no
`wrangler`, no Pages Functions, no server code of its own. The form posts to
`/api/lead` and the diary to `/api/availability`, `/api/book` and the rest, all
of which the platform answers beside the site ([lead-form.md](lead-form.md),
[booking.md](booking.md)).

## Accessibility

The scaffold is held to WCAG 2.1 AA ([accessibility](accessibility.md)), and
what you write on top of it is yours to keep there. The rules an agent breaks
most:

- every photograph has alt text that says what it shows, or `alt=""` if it is
  decoration;
- one `h1` a page, then `h2`, then `h3` — no level skipped for a size;
- link words say where they go, never «here» or «more»;
- the palette you set keeps text at 4.5:1 — set `--ink`, `--paper` and
  `--accent` together, and `--on-accent` when the accent is light on a light
  page;
- an outline is never removed without another focus style;
- every page's content stays in `<main id="content">`, where the skip link
  goes.

`npx @jtakeit/astro a11y` reads your `./dist` the way the kit's CI reads the
scaffold.

## Astro only

Today Astro is the only generator the platform supports: collecting a
collection's entries reads their frontmatter with the site's own Astro,
pictures go through `astro:assets`, the flags are read as `import.meta.env`,
and the runner's baked `node_modules` are this scaffold's. A repository on
another generator does not build on the platform.
