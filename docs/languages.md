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
`jt-check` answers "are these the same page" by looking rather than by trusting.
The price is one segment of one address reading in the site's own language.

For an entry the admin builds the address from this pattern, so it is not a
convention you can drift from. For a page you write the route yourself, and
`jt-check` holds you to it.

## The shape

A language version of a page is **a page**. It has its own route and its own
content document, and it says one thing about itself:

```json
{ "path": "/prices" }
{ "path": "/de/prices", "locale": "de" }
```

`locale` is absent for the site's own language, which the schema already says
(`LOCALE` in `src/content/blocks.ts`, written into `jtk/catalogue.json`). A
document without it whose path starts with a language — `/de/prices` — is read
as that language's all the same; the kit's door (`@jtakeit/kit/content`) takes
the `locale` key, or the language the path starts with.

A regional language is spelt `de-CH` everywhere a tag is written — `LOCALES`,
`locale`, `jtk/shared.de-CH.json` — and its addresses carry the lowercase,
`/de-ch/prices`, because an address on the platform is lowercase. The door is
the one place the two spellings meet; it reads either.

**The address is the same in every language, with the language in front of it.**
`/de/prices`, never `/de/preise` — and `/de/blog/healing` for a post written in
German. That is the whole of what pairs them: nothing is declared, so nothing
can be misspelt.

There used to be a `group` key the languages of one page shared, which let each
language have its own words. It is gone, and `jt-check` refuses a document that
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
   `src/content/blocks.ts`. The pages read the languages from
   `jtk/catalogue.json`, as the platform does: the dev server writes it again
   when `blocks.ts` is saved, and `npx @jtakeit/astro catalogue` writes it
   before a commit.
2. **The words that are not content.** Copy `src/copy/<your locale>.ts` to
   `src/copy/de.ts`, point it at the German home page —
   `makeCopy(site.page('/', 'de'), STRINGS)` — set `lang: 'de'` and translate
   the strings. Register it in `src/copy/index.ts`:
   `import { COPY as de } from './de';` and `{ '': own, de }`. A language
   declared and not registered renders with the site's own words — untranslated,
   not broken.
3. **The documents.** The German home page is **`jtk/content/de.json`**
   (`"path": "/de"`, `"locale": "de"`) — not `jtk/content/de/index.json`: the
   platform keeps the page at `/de` in the file named for it, as it keeps
   `/prices` in `prices.json`. Every other German page is
   `jtk/content/de/<page>.json` (`"path": "/de/prices"`), and every German entry
   `jtk/content/de/<prefix>/<slug>.json` with `"collection"` and
   `"locale": "de"` beside the path. The page or the entry is the path inside
   the file — the door finds it by that, as the platform does, wherever the
   file sits — but keep the file where the platform writes it, so the diff of
   its next save is the content and not a move.
4. **The sitemap** lists the German pages by their documents
   (`src/lib/pages.ts`); a German page with no document of its own is a line
   in `PAGES` (`src/data/site.ts`).

The routes are `src/pages/[...lang]/…`: `index.astro` and `privacy.astro` are
there already and build at `/` and `/de`, `/privacy` and `/de/privacy`. A page
you add for every language goes beside them:

```astro
---
import { localeOf, localeParams } from '../../lib/locale';
import { site } from '../../lib/site';
import { copyFor } from '../../copy';
export const getStaticPaths = localeParams;
const locale = localeOf(Astro.url.pathname);    // '' for the site's own
const page = site.page('/prices', locale);
const C = copyFor(locale);
---
<Layout title={String(page.seo.title ?? '')} description={String(page.seo.description ?? '')} alternates={site.alternatesOf(page)}>
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
import { site } from '../lib/site';
const prices = site.page('/prices');
const alternates = site.alternatesOf(prices);
---
<Layout title={String(prices.seo.title ?? '')} description={String(prices.seo.description ?? '')} alternates={alternates}>
```

`site.alternatesOf(page)` is every language of this page, found by taking the
language off the front of the address and looking for the same address under
every other one; `site.alternatesOf(entry)` is every language an entry is out
in. Each is `{ locale, address }`, `''` for the site's own. A page that exists
in one language answers with nothing and `Layout` emits nothing — a `hreflang`
set of one is noise.

The switcher on the page is the same list, rendered:

```astro
{alternates.map((other) => <a href={under(other.address)}>{other.locale || META.lang}</a>)}
```

## The text that is on every page

Per language, because it is text: `jtk/shared.json` for the site's own and
`jtk/shared.de.json` beside it — `jtk/shared.de-CH.json` for a regional one,
which the door finds whatever the case of its region. Read the one the page is
in:

```astro
const chrome = site.shared(localeOf(Astro.url.pathname));
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

The listing for each language shows its own — `site.entries('blog', { locale })`
for the language of the page rendering it.

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

---

## Contract 3: one document, its translations beside it

Everything above is contract 2, where a language is a full copy of every
document — so a photograph or a price changed in one language stays old in the
others. A site on contract 3 (`jtk/schema.json` says `"contract": 3`) keeps one
document in the site's own language and, beside it, a **translation** that holds
only the words (jtakeit-core wiki/95, wiki/98 §4.4). The addresses are the same:
`/prices`, `/en/prices`.

```
jtk/pages/prices.json        the page, in the site's own language
jtk/pages/prices.en.json     its English: { "of": <the page's id>, "locale": "en", … }
jtk/entries/blog/erster.json
jtk/entries/blog/erster.en.json
jtk/shared.json, jtk/shared.en.json
```

**What a translation holds.** A page's `name`, its `seo` and the words of its
blocks; an entry's `slug`, `seo`, the words of its `fields`, its body whole, and
`visible: false` to hold the language back; the shared text's blocks. A block, a
row and a gallery's picture are named by the original's `_key`, never by place:

```json
{
  "of": "0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21",
  "locale": "en",
  "name": "Prices",
  "blocks": [
    { "_key": "hero", "title": "Our prices", "image": { "alt": "The salon" } },
    { "_key": "list", "items": [ { "_key": "r1", "title": "Haircut" } ] }
  ]
}
```

**Which values are per language** is the field's kind, unless the field says
`localized`: text, a textarea, rich text and markdown are; a picture's `alt` is,
its file, focus and poster are not; a gallery is the original's pictures, each
with its words per language; a list is the original's rows, each with its words
per language. A number, a price, a date, a choice, a reference, a phone number
and a link are the same in every language. A picture with words on it, a link
to a page in the language, or a list each language has its own of says
`localized: true`; a brand name says `localized: false`. **A shared value in a
translation is refused** (`JTK_E_TRANSLATION_SHARED`): change it in the
original, and every language has it.

**An entry's body is whole per language**: a translation with `blocks` of its own
replaces the original's; one without shows the original's.

**What nobody translated is the original's**, and says so. The door hands out,
for every value, whether it is the original's words on a page in another
language; give it the original's `lang`:

```astro
<h1 {...hero.at('title')} {...hero.lang('title')}>{hero.text('title')}</h1>
<Shot name={shot.src} alt={shot.alt} lang={shot.lang} path={shot['data-jtk-path']} />
```

`lang()` is `{}` for a translated value, for a value with no language (a price,
a picture's file) and on contract 2. `page.fromBase` and `entry.fromBase` list
the places. A collection that says `untranslated: "hide"` hides an entry in a
language nobody translated it into, as `visible: false` in a translation holds
one back: built for the panel's preview, listed nowhere, in no sitemap.

**What people book is in every language, always.** An entry of a collection
a module names in one of its roles — the bookings' `services`, `resources` and
`classes` — is booked by the diary in every language, so the booking form
lists it in every language: where
nobody translated it, in the original's words, marked with the original's
`lang`. Such a collection cannot say `untranslated: "hide"`, nor a translation
of its entry `visible: false` — `jtk schema` refuses both. The form names a
service and a master by `entry.baseSlug`, the original's slug, which the diary
books by whatever a language calls the entry.

**`hreflang` names a language only where a translation is.** A page is built in
every language the site has; where nobody translated it, it is the original's
words under another address, and no alternate of the original.

**The copy.** A language with no `src/copy/<locale>.ts` of its own still reads
its page through the door on contract 3, `<html lang>` its own; only the words
that are not content — the form's, the privacy page's — are the site's own until
a copy is registered in `src/copy/index.ts`.

**Checked before the push.** `jtk schema` judges every translation as the
platform's import will: beside its original, `of` its id, in a language the
schema names, holding only words; words for a row the original no longer has are
advice (`JTK_W_TRANSLATION_ORPHAN`). `jtkit lint` checks every language's pages.
`jtkit progress` says, per language, what is **missing** (a value nobody
translated) and what is **outdated**: a translation remembers the original it was
made from, `translated: { "blocks[hero].title": { "from": "e3ea67be" } }`, the
first eight hex digits of the SHA-256 of the original value's canonical JSON. An
agent may leave `translated` out; the import records the original as it stands.

**Moving a contract-2 site** with `jtk upgrade contract-3`: each language's copy
becomes a translation beside its original. A shared value equal in every
language is kept once; one that differs — two photographs, two prices — stops
the move and is listed, for the agent or a person to answer: `--take-base` (or
`--take-base=hero.image,…`) keeps the original's for every language, and
`localized: true` on the field in `src/content/blocks.ts` keeps each language's
own. A page or an entry written only in another language has nothing to be a
translation of: the move stops and lists it, until its original is written or
the copy removed. A copy contract 2 hid of something people book is shown in
its language from now on.
