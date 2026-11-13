# Collections — a blog, a portfolio, a price list

## Only when it is asked for

**Never add a collection because a site could have one.** No brief that does not
name it gets a blog, and no site gets one "for later".

The example site `jtk create` lays out declares two, `services` and `team` —
the price list and the people, each a section of its home page (jtakeit-core
wiki/110) — and **the brief decides which stay**: `npx @jtakeit/astro remove
team` takes the section, its collection and its entries away, and
`create --without team` never lays it out ([units.md](units.md)). Beyond those
two, a collection is added on a sentence in the brief, and a blog with
`npx @jtakeit/astro add blog` (`--blog` at create).

The reason is not tidiness. A collection is a standing obligation on the person
who owns the site: an empty blog on a live page says the business stopped
caring in March, and a blog with three posts from a year ago says it louder. A
landing page that never mentions one says nothing at all. Handing somebody a
weekly job they did not ask for is worse than handing them a smaller site.

So the bar is a sentence from the person commissioning the work — the studio,
the developer, the client — that names the thing: *«потрібен блог»*, *«хочу
розділ з роботами»*. Not "it would be nice", not inferred from a vertical, not
because the design has room. If the brief is silent, the answer is silence.

---

A collection is a set of **entries the owner creates in the admin** and this
repository renders. It is the one place the admin makes something the
repository did not, and the line is drawn once:

> **This repository declares the shape. The admin creates the entries.**

Everywhere else, which pages a site has is yours: pages arrive by import, and
the admin has no "add a page" — a page invented there would have no route to
render it. A collection changes exactly one thing: you write the shape and the
two routes, and the owner writes the posts.

So there is no "blog feature" in the platform. A blog is one collection whose
entries are at `/blog/{slug}`, ordered by date. A portfolio, a menu, a vacancy
board and a price list are the same mechanism with different words.

This page is written in contract 3's words, every new site's (`jtk/schema.json`).
A site made before it and not moved yet says the same in contract 2's: a
`prefix`, `pages: false` and `listing: true` where contract 3 has a `route`,
entries under `jtk/content/` known by their `path`, and annotations by index
(`page:/blog/healing:blocks[0].title`) — [catalogue.md](catalogue.md) is its
schema; `jtk upgrade contract-3` moves it.

---

## A blog, turned on

The scaffold keeps one ready and off. `npx @jtakeit/astro add blog` turns it on
(`jtk create --blog` at create) — on the example site with two example posts and
a section of the latest on the home page — or two lines at the foot of
`src/content/blocks.ts` do:

```ts
BLOCKS.push(BLOG_POST);
COLLECTIONS.push(BLOG_COLLECTION);
```

`BLOG_POST` is the post type with the five reserved keys; `BLOG_COLLECTION` is
`blog` at `/blog`, newest first. The listing is
`src/pages/[...lang]/blog/index.astro`, which builds itself once the collection
is there (and at `/de/blog` for a site in German) and lists every post on one
page — a listing of the repository's own, which the scaffold's paged one
(«The listing», below) never draws over; a post's page is
`[...entry].astro`, the feed `/blog/rss.xml`. Write the first posts as
`jtk/entries/blog/<slug>.json` (below, «Writing an entry by hand») — a blog
launched empty says the business stopped caring before it started. What
follows is how any other collection is made.

## What you write

**One entry in `src/content/blocks.ts`**, beside the blocks:

```ts
export const COLLECTIONS: Collection[] = [
  { name: 'blog', label: 'Блог', type: 'post',
    route: { detail: '/blog/{slug}' },
    order: { by: 'date', desc: true } },
];
```

`route` is where its entries are: `detail`, an entry's own page. A collection
whose entries have no page of their own — a price list's rows, the diary's
services, a restaurant's tables — says `route: 'none'` and the page they are
shown on, `shown_on: ['/services#services-{slug}']`, a page of the site and
the anchor of each row on it.

**And the block type its entries are made of**, in `BLOCKS` like any other:

```ts
{
  type: 'post',
  v: 1,
  label: 'Допис',
  fields: [
    { key: 'title',   label: 'Заголовок', kind: 'text', required: true, max: 90, client_editable: true, seo_sensitive: true },
    { key: 'date',    label: 'Дата', kind: 'date', required: true, client_editable: true, no_tap_target: true },
    { key: 'excerpt', label: 'Анонс', kind: 'textarea', max: 200, client_editable: true, no_tap_target: true },
    { key: 'cover',   label: 'Обкладинка', kind: 'media', client_editable: true },
    { key: 'body',    label: 'Текст допису', kind: 'markdown', max: 40000, client_editable: true },
  ],
}
```

**And, if the site wants one, a listing**: `listing` in the route —
`route: { detail: '/works/{slug}', listing: '/works', per_page: 12 }` — and
the scaffold draws it (below), or a page of your own at that address —
`src/pages/works.astro` or `src/pages/[...lang]/works/index.astro` for
`/works`, the route declaring it all the same, so the feed and the languages
know where it is — designed like every other:

```astro
---
import { site } from '../../lib/site';
import { href } from '../../lib/entries';
import { localeOf } from '../../lib/locale';
const locale = localeOf(Astro.url.pathname);
const works = site.collection('works')!;
const all = site.entries('works', { locale });
---
<ul>
  {all.map((work) => (
    <li><a href={href(work)} {...work.fields.at('title')}>{work.fields.text('title')}</a></li>
  ))}
</ul>
```

`site.entries()` — the kit's door, `@jtakeit/kit/content` — is the only thing
that enumerates entries, and it does two things you must not do by hand: it
drops the ones nobody has finished, and it sorts by the collection's own order
(`{ all: true }` for every one, which only the route that renders an entry
asks for). An entry drawn on another page annotates as that entry's, by its
id — `entry:<id>:title` — so a tap opens the entry; on its own page
`entry.here` annotates as the page's own, `title`.

## The listing

A collection **without pages** (`route: 'none'`) is always listed on the page
its `shown_on` names, in every language (`/services`, `/de/services`), by
`src/pages/[...listing].astro`: its entries as rows, every field the owner taps
annotated `entry:<id>:<field>`. The platform frames that page to show an entry
and refuses a build without it. One page, however many rows — an entry on page
two is one the frame cannot find.

A collection **with pages** gets a listing **only when it asks**:

```ts
{ name: 'works', label: 'Works', type: 'work', route: { detail: '/works/{slug}', listing: '/works', per_page: 12 } }
```

**Why opt-in.** A page nobody asked for is an address on a client's site that
nobody designed — it is crawled, linked from search, shared — so a site gains
one only by its developer's word. Without `listing`, the build has exactly the
routes it had: the entries' pages, and nothing at `/works`. A collection
without pages has no route to put a listing in: the page it is shown on is
its listing already.

With a `listing` the scaffold draws its entries as tiles
(`EntryCard.astro`, the blog's tile too) linked to their pages — the cover, the
date, the title and the excerpt where the type has them — `per_page` to a page,
through Astro's `paginate()`. Grouped under its headings where it has a
`group`, the page cut out of the grouped list, so a heading's run crossing the
cut opens the next page under the same heading. Hidden entries are on no page.

**Page two is `<listing>/page/2`, not `<listing>/2`.** Everything under
`/works/` is an entry's address, and the platform takes a bare number for a slug: an
owner who numbers her works would have entry `2` and the listing's second page
at one address. A slug the platform makes has no `/`, so `/works/page/2` is
nobody's, and an entry called `page` lives beside it at `/works/page`. The one
way to collide is an entry written by hand with the path `/works/page/2`,
and the build refuses it by name rather than drawing one of the two.

**Your own listing wins.** Where `src/pages/works.astro`,
`src/pages/works/index.astro` or the same under `[...lang]/` exists — the
blog's does — the scaffold builds nothing at that address and no pages under
it: the page is yours, paging included. Draw `EntryListing.astro` in it to
keep the scaffold's pages, or delete it to hand the address back.

**Annotation** is every listing's: an entry's words with its page-qualified
path, a category heading as that category's title, and the collection's label,
a select's label and the way between pages («Previous», «Page 2 of 5»,
«Next», in the page's language from `LISTING` in `src/copy`) `data-jtk-fixed`.

## What you get without writing it

| | |
| --- | --- |
| `src/pages/[...entry].astro` | one entry of **any** collection. Ships with the scaffold; a new collection needs no new route |
| `src/pages/[...listing].astro` | the listing of a collection without pages, on the page its `shown_on` names, and of one whose route has a `listing` — paged by `per_page` at `<listing>/page/2` (`[...listing]/page/[page].astro`) |
| `/blog/rss.xml` | one feed per collection |
| `sitemap.xml`, `llms.txt` | the entries are in both, the unfinished ones in neither |
| `dist/_meta.json` | the redirects and the hashed directory; which entries are unfinished the platform says itself, from each entry's `visible` and its moments, and its edge keeps them private |

The entry route is a **starting point, not a design** — exactly like
`Blocks.astro`. Replace what is inside `<article>`. What must survive is the
annotation.

---

## The five reserved keys

An entry's block type may declare whatever this business needs, and five names
are spoken for, because the listing, the feed, the sitemap, the card a messenger
draws and the admin's own list of entries all read them by name:

| | |
| --- | --- |
| `title` | text, **required**. Everything above needs one. |
| `date` | date. Required if the collection is ordered by it. |
| `excerpt` | textarea. The sentence under the title in a listing. |
| `cover` | media, one picture — never `multiple`. The card, the listing, `og:image`. |
| `body` | markdown. The entry itself. |

Leave out any that make no sense — a set of works has no excerpt. What you may
not do is give one of those names to something else; `jtk schema` refuses it.

The entry's *file* says the rest — `id`, `collection`, `slug`, `rank`,
`visible`, `show_at`, `hide_at`, `seo` — beside its values under `fields`
(«Writing an entry by hand», below).

## Annotation: two rules

**An entry's own values are its `fields`**, so on its own page their paths are
the field's key — `title`, `body` — and a block of its body is
`blocks[<its _key>].<field>`.

**A listing page carries no annotations of its own.** The titles on it are
other documents' words; a bare `title` there would name a field of the
listing's own page, which has none — and `jtk schema` refuses an annotation the
page's document does not declare. What a listing annotates, it annotates as the
entry's, by its id («A listing's tiles are the posts' own words», below).

A field the entry page does not render is `no_tap_target: true` — that is
usually `date` and `excerpt`, which live on the listing rather than on the post.

## Categories, tags and trees — a `ref`, not a feature

There is no taxonomy in the catalogue and no "category" kind, on purpose. A category is an entry of a collection,
and what is in it points at it with a `ref`: the platform already stores,
lists, translates and orders entries, and the owner adds a category in the
panel the way they add a post. Four patterns, by name — use these, not a
`select` of categories the owner cannot extend and not a free-text field:

| pattern | what you declare | what the scaffold does with it |
| --- | --- | --- |
| **group by a select** | `group: 'course'` on the collection, `course` a `select` with `options` as `{ value, label }` | the listing's headings are the labels, in the options' order |
| **category** (group by a ref) | a `categories` collection, and on the grouped one `group: 'category'` with `category: ref { to: ['categories'] }` | the headings are the categories' titles in the page's language, in the categories' own order, each annotated as that category's title |
| **tree** | on `category`, `parent: ref { to: ['categories'] }` — one reference into its own collection | a category's page shows the trail of its parents above the title and its children below |
| **tags** (many-to-many) | a `tags` collection, and `tags: ref { to: ['tags'], many: true }` — one reference to many, the shape the diary's `does` has | each tag on a post links to the tag's page; the tag's page lists its posts |

```ts
// The category pattern, whole — a salon whose owner adds categories herself.
BLOCKS.push(
  { type: 'category', v: 1, label: 'Category', fields: [
    { key: 'title',  label: 'Name',   kind: 'text', required: true, max: 60, client_editable: true },
    { key: 'parent', label: 'Inside', kind: 'ref', ref: { to: ['categories'] }, client_editable: true }, // the tree; leave it out for a flat list
  ] },
  { type: 'service', v: 1, label: 'Service', fields: [
    { key: 'title',    label: 'Name',     kind: 'text', required: true, max: 80, client_editable: true },
    { key: 'takes',    label: 'Takes',    kind: 'duration', required: true, client_editable: true },
    { key: 'category', label: 'Category', kind: 'ref', ref: { to: ['categories'] }, client_editable: true },
  ] },
);
COLLECTIONS.push(
  { name: 'categories', label: 'Categories', type: 'category', route: { detail: '/categories/{slug}' } },
  { name: 'services', label: 'Services', type: 'service', route: 'none', shown_on: ['/services#services-{slug}'], group: 'category' },
);

// The tags pattern: one reference to many.
{ key: 'tags', label: 'Tags', kind: 'ref', ref: { to: ['tags'], many: true }, client_editable: true }
```

**What `jtk schema` refuses**, as the platform does: a `group` naming a
field the type has not got, a `group` that is neither a select nor a ref, a
`group` that is a ref to several entries or into the collection itself (that
is a tree — make it a `parent` field and group by something else), a tree's
`parent` that may point at several, and a `ref` anywhere — a list's row
included — naming a collection the schema does not declare. A `parent` ref
into its own collection is accepted: a loop (`a → b → a`) is refused by the
platform where the value is written, and the scaffold's walks stop at one
anyway, and at twelve levels.

**One field, read by three.** `group` decides the listing's headings, the
admin's list of entries, and the booking form's runs of services. A heading is
words, never the stored value: a select's label (or the option where it has
none), a category's title — in the page's language, the site's own language
standing in for a category nobody has translated yet. Entries with no group, or
with one that is no heading (a renamed option, a hidden category), come last
under none.

**What the scaffold already draws**, so a design pass keeps it rather than
writes it:

- `[...listing].astro` lists a grouped collection under its headings — one
  without pages, or one whose route has a `listing` — and, for the diary's
  services, hands the booking form the same headings.
- `[...entry].astro` is every entry's **archive page**: below the post, the
  entries of the other collections that point at it — through a `ref` of
  its own or one in a list's rows — under each collection's label, in its
  own order, hidden ones left out, each linked to its page (or its row on the
  listing, for a collection without pages). **In a tree, what points at any
  category under it counts**: `beauty`'s page lists the gel manicure filed
  under `nails/gel`, once however many of the categories it names, in its own
  collection's order — the walk down is bounded as the trail up is. At most
  the referencing collection's `per_page` of them, then a line that says how
  many more in the page's language («And 3 more», `LISTING.more` in
  `src/copy`), linked to that collection's listing where it has one by the
  rule — no pages of its own, or a `listing` in its route — and plain words
  otherwise; not pages of their own:
  `/tags/red/page/2` would be an address under the tags' entries no entry
  owns. A ref's value on an entry links to the entry it names.
- The door has the reading for your own pages: `site.groupsOf(name, entries,
  locale)` (the runs, each with its `heading` — `text`, `at` and `fixed`),
  `site.referrersOf(entry)`, `site.treeOf(entry)`, and
  `site.listingPages(name, locale)` / `site.listingOf(name, locale, n)` for a
  listing's order, its page size and its addresses. `src/lib/entries.ts` adds
  what is this site's: `href(entry)` and `listingHref(name, locale, n)` under
  the build's base, and `titleOf(entry)` — an entry's title as drawn on
  another page, with its annotation where the owner taps it. The rules are
  the kit's (`lib/content/groups.mjs`), tested there.

**Annotation.** A heading that is a category's title is that category's words:
it carries `entry:<the category's id>:title`, as a listing's row does, and a
tap opens the category. A select's label, a collection's label and the
«And 3 more» line are the repository's — `data-jtk-fixed`. A `ref` and a
`select` are edited in the panel beside the page, never by tapping, and
neither the platform's build nor `jtk schema` asks an element of them.

## Pictures in a body

Ordinary markdown, and the address is a media key exactly as everywhere else:

```markdown
![Заживший рукав](media/<site>/<hash>.jpg "Три тижні потому, без ретуші")
```

The alt text is heard by whoever cannot see it; **the title slot is the
caption**, printed under the picture. Two sentences, two jobs, two slots that
CommonMark has had all along.

### A figure, and a row

A paragraph holding nothing but pictures becomes a figure, or a row of them:

```markdown
![](one.jpg)                 one paragraph, one picture  → a figure

![](one.jpg)![](two.jpg)     ONE paragraph, three        → a row
![](three.jpg)
```

Images with **no blank line between them are one paragraph** in CommonMark, and
that is already a statement that they belong together — so it is the row, with
no syntax added. A blank line between them is somebody saying they are
separate, and the build believes them.

Written by the editor as `![](a.jpg)![](b.jpg)`, adjacent, because that is the
form that survives a round trip: one per line parses with a space between them
and would be rewritten on the next save. Both forms render identically, so an
entry written by hand may use whichever reads better in the diff.

What comes out — the whole surface, and it is deliberately small:

```html
<figure class="jtk-figure"><img …><figcaption>…</figcaption></figure>

<div class="jtk-row jtk-row--3">…</div>
```

`jtk-row--2`, `--3`, `--4`; four means four or more and the stylesheet wraps.
`src/styles/global.css` ships both, and a site is expected to **restyle them and
not invent a third**: what a body can look like is a decision the kit made once,
so that the editor can offer exactly what exists. `figures.mjs` is the plugin
that makes them, and its header is the argument for why none of this is a
markdown dialect — read it before adding one.

**There is no size, and that is not an oversight.** A row is a row; how wide its
pictures are is the design's answer, not the owner's. They choose which
paragraph a picture follows and what it is captioned, and nothing else.

The build downloads it beside the entry, so Astro resolves and optimises it like
every other picture on the site: with `image.layout` set in `astro.config.mjs`,
one body picture comes out as six webp variants with a `srcset`.

**On a laptop it does not build.** A clone has downloaded no media, and a
markdown image with no file is `ImageNotFound` — a hard failure, not the
labelled placeholder a missing `<Shot>` slot draws. Check against a build made
by the studio: `npx @jtakeit/astro schema --dist ./dist`.

## A listing's tiles are the posts' own words

A tile draws a heading, a date and an excerpt for a post, and every one of them
belongs to **that post's document**, not the listing's. Annotated the ordinary
way they would name a field the listing page has not got — so for a long time
they carried no annotation at all, and the words an owner most wants to fix
were the one place on the site they could not tap.

An entry the door hands out annotates as drawn on another page: the id of its
document is in every path it writes.

```astro
---
import { site } from '../../lib/site';
import { href } from '../../lib/entries';

const post = site.entry('blog', 'healing')!;
---
<a href={href(post)} {...post.fields.at('title')}>{post.fields.text('title')}</a>
```

```html
data-jtk-path="entry:0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21:title"
```

A page's words drawn on another page are the same: `site.page('/prices').elsewhere`
annotates `page:<the page's id>:…`. And the other way round, `entry.here` is
the entry annotated as the page it is on — what its own route draws.

The admin resolves it against that page, writes it there, and the post's own
page updates with it. `jt-check` holds the claim from the other end: an address
this site did not build, or a field that page does not offer, fails.

**Annotate only what the owner taps.** On a tile that is the title and the
cover. The date and the excerpt are `no_tap_target` on the post type — edited
in the panel beside the post — and an `entry:` path to one is refused by the
platform's build (`JTK_E_ANNOTATION_UNKNOWN … has no field for`). Draw them
with `data-jtk-fixed`, which says the words are not this page's to edit, and
the check is satisfied both ways. The scaffold's blog listing does exactly
this.

**Only where a page renders another page's content.** A heading you wrote in
*this* page's document is this page's, however much it looks like a tile.

## Writing an entry by hand

Legitimate, and sometimes the fastest way to write one. The file is
`jtk/entries/<collection>/<slug>.json` — the shape the platform writes, and
the next import takes it as the draft:

```json
{
  "id": "0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21",
  "collection": "blog",
  "slug": "aftercare",
  "visible": false,
  "fields": {
    "title": "Догляд після сеансу", "date": "2026-08-26",
    "excerpt": "Що робити перші два тижні.",
    "body": "## Перший тиждень\n\nНе мочити, не терти рушником."
  }
}
```

**The entry is its `id`**, which the platform matches it by on every import;
leave it out and `npx @jtakeit/astro schema` mints one, as it mints a `_key`
on every block and row that has none. Its address is the route's `detail`
with its `slug`; its own values are `fields`, and `blocks` beside them, where
the collection allows a body, are its body. `visible: false` means the site
builds it and lists it nowhere; the studio's edge serves it only to a session
that is editing the site. Another language is a translation beside it,
`aftercare.de.json` ([languages.md](languages.md)).

## Scheduled entries

An entry's file may say when it is out: `"show_at"` hides it until then,
`"hide_at"` hides it from then on, both RFC 3339 in UTC, beside `visible`:

```json
{ "collection": "blog", "visible": true, "show_at": "2026-10-20T07:00:00Z", "blocks": [ … ] }
```

The owner sets them in the panel. **A build the platform makes needs nothing
from the repository**: it rewrites such an entry to `visible: false` in its
checkout before Astro runs, so the listing, the feed and the sitemap leave it
out like any unfinished entry, and its page is built for the editor as always.

**`astro dev` reads the files as they are**, so the door applies the same
rule with the clock at the moment it reads them: a `show_at` still ahead or a
`hide_at` already behind is not offered, and `visible: false` hides an entry
whatever its dates say. Read when the dev server loads `src/lib/site.ts`, and
again when a file under `jtk/` changes — a post whose hour comes while nothing
changes appears on the next read. A value that is not a time is no schedule;
the platform refuses one where it is written.

**A local `astro build` reads them the same way**, by the build's clock: the
kit (`@jtakeit/kit`'s `lib/schedule.mjs`, which the door asks) leaves a
scheduled entry out of the listings, and `jtk schema --dist` treats it as
hidden — an entry without a page that is not out yet is owed no annotation on
its listing, exactly as one with `visible: false` is not.
