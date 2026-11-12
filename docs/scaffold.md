# The scaffold, and what the platform holds it to

```bash
npx @jtakeit/astro create <slug> --name "The Business" --locale de-CH --vertical salon
```

Copies `template/`, fills in the tokens, names the copy module for the locale,
writes a README and makes the first commit (`--no-git` to skip it). It decides
nothing about how the site looks: every component is a starting point, and the
contract below is the only thing the platform will hold the repository to.

The site is on contract 3 unless `--contract 2` says otherwise (below). The
template is one for both: its pages read the content through the kit's door,
and only the files that are a contract's own differ — contract 3's are laid
from `template/contract-3/` in place of contract 2's `src/content/blocks.ts`
and `jtk/content/`.

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
`src/copy/<locale>.ts` ([languages.md](languages.md)). `jtk create
--contract 2` lays out contract 2's files exactly as they were, in one
language:

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
