# A second page

A landing page is one page on purpose, and most sites should stay that way: one
address, one message, one action, and everything a visitor needs before they
decide. Add a page when there is something a visitor genuinely goes looking
for — prices, a service they searched for by name, a place with an address — and
not to have somewhere to put the rest.

**Which pages a site has is this repository's to say.** There is no "add a page"
in the admin, and there should not be: a page is a route somebody wrote, and a
page invented in the admin would be an address that renders nothing. The one
exception is a collection's entries — [collections.md](collections.md).

---

## What a page costs

Five things, and every one of them is small.

**A route** — `src/pages/prices.astro`. Designed like the home page: it is a
page of this site, not a subpage of a template. On a site in more than one
language it is `src/pages/[...lang]/prices.astro` and builds at `/prices` and
`/de/prices` both — see languages.md, «What you write».

**Its blocks in the catalogue.** `src/content/blocks.ts` describes every block
on every page of the site; a new page usually brings one or two new types with
it. Reusing a type across pages is fine and common — a `questions` block belongs
on more than one page.

**A content document** — `jtk/content/prices.json`, committed with the
fields in it and a `path` of `/prices`. Empty strings are fine and are what the
scaffold ships for the home page; what is not fine is the file not existing,
because the build reads it and a missing one is a build error rather than an
empty page.

**A line in `PAGES`** — `src/data/site.ts`. It feeds the sitemap and `llms.txt`,
and it is written by hand so that adding a page and forgetting to list it is a
visible omission in one file rather than a silent one across the build.

**A way to get there.** A page nothing links to is a page nobody reads. That is
design, and it is the part worth thinking about longest.

## Reading its content

The home page has `src/copy/<locale>.ts`, which is that page's own vocabulary —
`HOME.hero.title`, shaped by hand to the blocks it happens to have. Every other
page uses the generic reader instead, so that reshaping the home page's copy
cannot break how the rest of the site is read:

```astro
---
import Layout from '../layouts/Layout.astro';
import { readPage } from '../lib/page';

const prices = readPage('/prices');
const { at, of } = prices.block('rates');
---

<Layout title={prices.seo.title} description={prices.seo.description}>
  <main id="content">
    <h1 data-jtk-path={prices.pathAt(at, 'title')}>{prices.str(of, 'title')}</h1>
    <p data-jtk-path={prices.pathAt(at, 'lead')}>{prices.str(of, 'lead')}</p>
  </main>
</Layout>
```

`readPage` gives the same set the copy module does: `PAGE` (every block in
order), `block(type)`, `str`, `rows`, `picture`, `gallery`, and `pathAt`. It
finds the document by the `path` written inside it, not by the file's name,
because that is what publish writes and what the admin reads back.

**Every field rendered carries its `data-jtk-path`.** The annotation lint fails
the build without one, per page — and it is per page for a reason worth knowing:
two pages both rendering `blocks[0].title` are two different fields of two
different documents, and the check knows which is which.

## What the admin does with it

Nothing, until the branch is imported. Import walks `jtk/content/`, creates
a page for every document it does not already have, and the page appears in the
site's list with its own drafts, versions and search fields. Publishing writes
every page back out again.

A page in the admin that the branch no longer has is **reported and never
deleted** — the branch may simply be an older ref, and a page may hold a draft
somebody is in the middle of.

## Text that is on every page

A footer note, the line under the wordmark, the words over the form. One
sentence, on all of them.

**It does not go in a page's document.** Declared in each one, a three-page site
has three copies, and they diverge the first time somebody edits one: the owner
changes the footer on the prices page, looks at the home page, and reports that
their change disappeared. It did not — it was saved, on one page in three.

It goes in `jtk/shared.json`, once:

```json
{
  "schema_version": 1,
  "blocks": [
    { "_key": "chrome-1", "type": "chrome", "v": 1, "note": "Bookings go through the form." }
  ]
}
```

Its blocks are ordinary types from `blocks.ts` — nothing new to declare. What
makes them shared is where they live.

Read it with `readShared()`, and **annotate it on every page that renders it**:

```astro
---
import { readShared } from '../lib/page';
const chrome = readShared();
const { at, of } = chrome.block('chrome');
---
<p data-jtk-path={chrome.pathAt(at, 'note')}>{chrome.str(of, 'note')}</p>
```

`pathAt` writes `shared:blocks[0].note` — the prefix says which document the
field is in. Unlike a page's own field, **the same annotation on five pages is
correct**, and it is what makes the sentence editable wherever the owner happens
to be looking. The admin resolves it against the site's shared document rather
than the page in front of it, and tells them the line is on every page before
they change it.

A shared field is checked from the other side too: `jtk catalogue` refuses one
that no page renders — a control that edits nothing — and refuses a `shared:`
annotation for a field the document does not have.

It has the same three stages as everything else: a draft while it is being
typed, a saved version, and what the world sees. It is stored as a page that no
route renders, which is why none of that had to be built twice — the platform's
wiki/28 has the argument.

## The icon

The picture in the browser tab, on a phone's home screen and beside the site in
search results. **Ask for it in the brief** — «is there a logo or a mark, as a
file?» — the way you ask for the address: it is the business's, not a design
choice, and a site launched without one shows a blank page in every tab it is
open in.

One file is the whole icon; `src/lib/icon.ts` renders the rest at build time:

- **`public/favicon.svg`** — the mark as SVG. `jtk create` writes a stand-in
  there: the business's initials, light on dark (`data-jtk-monogram`). Say it
  back to the developer as a stand-in, and replace it when the mark arrives.
- **`public/icon.png`** — the mark as a picture (square, 180px or more), when
  it is not a vector. It wins over the SVG, and the layout links only the PNGs.

The 32px tab icon and the 180px home-screen icon (`/favicon-32.png`,
`/apple-touch-icon.png`) are made from that one file, so there is nothing else
to keep in step. A square mark reads best; a wide logo is fitted inside the
square with transparent sides — crop it to the symbol or the first letter if it
has one. The platform's `preflight` fails a site whose layout links an icon the
build does not have, and says when the site still wears the monogram.

## Every address inside the site goes under the base

A site is served two ways and the difference is a path. On its own host it is at
the root, so `/preise/` and `/favicon.png` mean what they say. **In the studio's
preview the same build is served under `https://preview…/p/<slug>/`**, where the
root is not the site: every one of those addresses leaves it.

What the client is then shown is a page with no stylesheet, no photographs and
navigation that 404s. It reads as a broken build rather than as a wrong prefix,
which is why it has cost three separate afternoons — the last of them on a site
built with this kit.

Two halves, and both are needed:

```js
// astro.config.mjs — the path this build is served under, taken from the site
// URL rather than configured beside it. They are one decision.
const SITE = env.SITE_URL ?? 'http://localhost:4321/';
const BASE = new URL(SITE).pathname;

export default defineConfig({ site: SITE, base: BASE, /* … */ });
```

`base` fixes what Astro emits — the bundled CSS, the optimised images, the
routes it generates. It cannot fix a string somebody typed. So the other half:

```astro
---
import { under } from '../lib/under';
---
<a href={under('/preise/')}>Preise</a>
<link rel="icon" href={under('/favicon.png')} />
```

That includes addresses that arrive as **data** — a nav list of
`{ label, href }` is rendered `href={under(item.href)}`, and a `current` compared
against `Astro.url.pathname` has to have the base taken off it first. A build for
a real host has a base of `/`, where `under()` changes nothing; that is the point
of writing every address one way.

`/api/…` is the exception: a form posts to the host it is served from, which is
the real site and is not part of the build.

`jtk catalogue` fails a repository that gets either half wrong, and proves the
second by building the site again under a path and holding every address it
emitted to it — so this is a rule that is checked rather than one to remember.

## What a page is not

**Not a place for a link the owner edits.** A cross-page link's address is the
repository's: it points at a route somebody wrote, and an owner who could retype
it could break it with no way to know. Declare `cta_href` with
`client_editable: false`, or leave it out of the catalogue entirely.

**Not a blog post.** A page is a file. Anything the owner will keep adding to
over time — posts, works, prices that come and go — is a collection, and it
works differently: see [collections.md](collections.md).
