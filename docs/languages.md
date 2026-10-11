# A site in more than one language

Two language versions of the same site, in one repository, edited by one owner
in one admin.

**Only when it was asked for.** A second language is a second site to keep
written — every page, every post, every footer, for ever. It is a commitment,
not a feature, and the bar is a sentence in the brief that names the language.

---

## Declare the languages once

```ts
// src/content/blocks.ts
export const LOCALE = 'en';                // the one the site is written in
export const LOCALES: string[] = ['ru'];   // and every other one it has
```

Both, in one place, because **a site declares every language it has where it
declares everything else.** `LOCALE` is what `META.lang` and `<html lang>` are
— the copy file reads it rather than repeating it — and it is what the admin
calls the site's own language on every screen that names one. It used to live
only in the admin's record of the site, set when the site was created and
changeable by nobody, and a site written in English could carry a record saying
Ukrainian.

Everything else derives from those two lines: where an entry's address goes,
which languages the admin offers, which translations it reports as missing. A
fact repeated in three places is a fact that is eventually three different facts.

## The address pattern is fixed

**The language goes first, and everything after it is the same:**

```
/prices          /ru/prices
/blog/healing    /ru/blog/healing
```

Not `/blog/ru/...`, which reads as a section of the blog called "ru" — to a
person and to a crawler. Not `/ru/zhurnal/...` either, however much better that
reads in Russian: a free choice there is a place where two sites built from this
kit come out different, and then the studio keeps two conventions for the sake
of one segment nobody searches for.

**And not a translated slug.** `/ru/blog/healing`, not `/ru/blog/zazhivlenie`,
even for a post written in Russian. The whole address being the same is what
pairs the two languages — nothing is declared, so nothing can be misspelt, and
`fl-check` answers "are these the same page" by looking rather than by trusting.
The price is one segment of one address reading in the site's own language.

For an entry the admin builds the address from this pattern, so it is not a
convention you can drift from. For a page you write the route yourself, and
`fl-check` holds you to it.

## The shape

A language version of a page is **a page**. It has its own route and its own
content document, and it says one thing about itself:

```json
{ "path": "/prices" }
{ "path": "/de/prices", "locale": "de" }
```

`locale` is absent for the site's own language, which `jtk/site.json`
already says.

**The address is the same in every language, with the language in front of it.**
`/de/prices`, never `/de/preise` — and `/de/blog/healing` for a post written in
German. That is the whole of what pairs them: nothing is declared, so nothing
can be misspelt.

There used to be a `group` key the languages of one page shared, which let each
language have its own words. It is gone, and `fl-check` refuses a document that
still carries one. The reason is worth knowing, because it is the shape of most
rules in this kit: `group: "work"` on one page against `group: "works"` on the
other is two unrelated pages, no error anywhere, and a site that has quietly
lost its `hreflang`. Nothing could tell that apart from a page which genuinely
has no translation. **A rule that can be checked beats a rule that must be
obeyed** — and what it costs is one segment of one address reading in the site's
own language.

## What you write

The scaffold already speaks every language `LOCALES` names: its routes, its
entries, its listings, its feed, its switcher and its `hreflang` read the
language off the address. Adding German is four things, and none of them is a
route:

1. **Declare it.** `export const LOCALES: string[] = ['de'];` in
   `src/content/blocks.ts`.
2. **The words that are not content.** Copy `src/copy/<your locale>.ts` to
   `src/copy/de.ts`, point its import at `jtk/content/de.json`, set `lang: 'de'`
   and translate the strings. Register it in `src/copy/index.ts`:
   `import { COPY as de } from './de';` and `{ '': own, de }`. A language
   declared and not registered renders with the site's own words — untranslated,
   not broken.
3. **The documents.** The German home page is **`jtk/content/de.json`**
   (`"path": "/de"`, `"locale": "de"`) — not `jtk/content/de/index.json`: the
   platform keeps the page at `/de` in the file named for it, as it keeps
   `/prices` in `prices.json`. Every other German page is
   `jtk/content/de/<page>.json` (`"path": "/de/prices"`), and every German entry
   `jtk/content/de/<collection>/<slug>.json` with `"collection"` and
   `"locale": "de"` beside the path.
4. **`PAGES`** in `src/data/site.ts`: the German addresses, so they are in the
   sitemap.

The routes are `src/pages/[...lang]/…`: `index.astro` and `privacy.astro` are
there already and build at `/` and `/de`, `/privacy` and `/de/privacy`. A page
you add for every language goes beside them:

```astro
---
import { localeParams, withLocale } from '../../lib/locale';
import { readPage } from '../../lib/page';
import { copyFor } from '../../copy';
export const getStaticPaths = localeParams;
const locale = Astro.params.lang ?? '';          // '' for the site's own
const page = readPage(withLocale(locale, '/prices'));
const C = copyFor(locale);
---
<Layout title={page.seo.title} description={page.seo.description} alternates={page.alternates}>
```

A page that exists in one language only stays an ordinary route
(`src/pages/impressum.astro`) — the language route is for pages that exist in
all of them.

## `hreflang`, which is the part that costs money

Without it, two language versions of one page compete with each other in search
and an engine picks a winner you did not choose. With it, each is offered to the
right reader.

It comes out of the data — never a list somebody maintains:

```astro
---
import { readPage } from '../lib/page';
const prices = readPage('/prices');
---
<Layout title={prices.seo.title} description={prices.seo.description} alternates={prices.alternates}>
```

`alternates` is every language of this page, found by taking the language off
the front of the address and looking for the same address under every other one.
A page that exists in one language answers with nothing and `Layout` emits
nothing — a `hreflang` set of one is noise.

The switcher on the page is the same list, rendered:

```astro
{prices.alternates.map((other) => <a href={other.path}>{other.locale || META.lang}</a>)}
```

## The text that is on every page

Per language, because it is text: `jtk/shared.json` for the site's own and
`jtk/shared.de.json` beside it. Read the one the page is in:

```astro
const chrome = readShared('de');
```

The annotation is unchanged — `shared:blocks[0].note` — because a shared
document is already one language. The admin resolves it against the shared
document of **the page's** language, so a footer edited under a German page is
the German footer.

## Entries of a collection

Two languages of one post are **two entries at the same address**, one with the
language in front of it. They are separate on purpose: different words, of
different lengths, published on different days, and one may not exist yet. What
makes them one thing is the slug, which they share.

So a post written in German lives at `/de/blog/healing` and not at
`/de/blog/heilung`. The admin shows one row with the languages it exists in and
the ones it does not; writing the missing one is a button on that row, and it
does not ask for an address, because there is nothing to decide.

The listing for each language shows its own — `listed('blog')` filtered by the
locale of the page rendering it.

A **page** in a language it does not have is not the admin's to make: a page is
a file you wrote, so it reports the gap and you fill it.

## The switcher is drawn for you

`src/components/Languages.astro` draws it from `alternates`, names each
language in itself (`Intl.DisplayNames` — no words to translate) and draws
nothing on a page in one language. `Layout.astro` places it in a corner of
every page so a second language works the day it is declared; move it into the
header when the design has one. Pass `alternates` to `<Layout>` on every page
you write — the scaffold's routes all do.

## The switcher must never rewrite the address

Build it from `alternates`, which is the list of languages that **exist**:

```astro
{prices.alternates.map((other) => <a href={other.path}>{other.locale || META.lang}</a>)}
```

Never by swapping a prefix into the current URL. That is the shape that gives
somebody a 404 the first time a page has no translation — and on a blog, where
most posts will only ever be written once, that is most of them.

## The catalogue is not translated

A field's label is what the person *editing* reads, and it has never been a
property of the site's language — that was a coincidence, because a site had one
language and the owner spoke it.

**Write the labels in the owner's language, not the site's.** For a bilingual
site they stay in one language, which is correct: the owner is one person.

## What does not change

Annotations, the bridge, the build, the edge, the catalogue's block types,
drafts, versions and publishing. A page is already one language, so
`blocks[0].title` is unambiguous and everything that reads it is untouched. Two
languages is one repository and one `astro build`.
