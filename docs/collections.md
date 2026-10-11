# Collections — a blog, a portfolio, a price list

## Only when it is asked for

**Never add a collection because a site could have one.** No brief that does not
name it gets a blog, and no site gets one "for later". The scaffold declares
none, and that is the correct state for almost every site this studio ships.

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
prefix is `/blog`, ordered by date. A portfolio, a menu, a vacancy board and a
price list are the same mechanism with different words.

---

## A blog, turned on

The scaffold keeps one ready and off. `jtk create --blog` turns it on, or two
lines at the foot of `src/content/blocks.ts` do:

```ts
BLOCKS.push(BLOG_POST);
COLLECTIONS.push(BLOG_COLLECTION);
```

`BLOG_POST` is the post type with the five reserved keys; `BLOG_COLLECTION` is
`blog` at `/blog`, newest first. The listing is
`src/pages/[...lang]/blog/index.astro`, which builds itself once the collection
is there (and at `/de/blog` for a site in German); a post's page is
`[...entry].astro`, the feed `/blog/rss.xml`. Write the first posts as
`jtk/content/blog/<slug>.json` — a blog launched empty says the business
stopped caring before it started. What follows is how any other collection is
made.

## What you write

**One entry in `src/content/blocks.ts`**, beside the blocks:

```ts
export const COLLECTIONS: Collection[] = [
  { name: 'blog', label: 'Блог', prefix: '/blog', type: 'post',
    order: { by: 'date', desc: true }, per_page: 10 },
];
```

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

**And the listing page** — `src/pages/blog/index.astro` — which is an ordinary
page of yours, designed like every other:

```astro
---
import { listed, href, collectionNamed } from '../../lib/entries';
const blog = collectionNamed('blog');
const posts = await listed('blog');
---
```

`listed()` is the only thing that enumerates entries, and it does two things you
must not do by hand: it drops the ones nobody has finished, and it sorts by the
collection's own order.

## What you get without writing it

| | |
| --- | --- |
| `src/pages/[...entry].astro` | one entry of **any** collection. Ships with the scaffold; a new collection needs no new route |
| `/blog/rss.xml` | one feed per collection |
| `sitemap.xml`, `llms.txt` | the entries are in both, the unfinished ones in neither |
| `dist/_meta.json` | the list of unfinished entries, which is what lets the studio's edge keep them private |

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
not do is give one of those names to something else; `jtk catalogue` refuses it.

Four more names belong to the entry's *file* rather than to a field of it, and
are refused as field keys for the same reason: `collection`, `visible`, `seo`,
`path`.

## Annotation: two rules

**An entry's document is one block**, so its paths are always
`blocks[0].<field>` — `blocks[0].title`, `blocks[0].body`.

**A listing page carries no annotations at all.** The titles on it are other
pages' words; a tap there would send a path the admin resolves against the
listing's own document, which is a different page. `jtk catalogue` refuses a
built page that has annotations and no content document of its own. The owner
edits an entry by opening it.

A field the entry page does not render is `no_tap_target: true` — that is
usually `date` and `excerpt`, which live on the listing rather than on the post.

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
<figure class="fl-figure"><img …><figcaption>…</figcaption></figure>

<div class="fl-row fl-row--3">…</div>
```

`fl-row--2`, `--3`, `--4`; four means four or more and the stylesheet wraps.
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
by the studio: `npx @jtakeit/astro catalogue --dist ./dist`.

## A listing's tiles are the posts' own words

A tile draws a heading, a date and an excerpt for a post, and every one of them
belongs to **that post's document**, not the listing's. Annotated the ordinary
way they would name a field the listing page has not got — so for a long time
they carried no annotation at all, and the words an owner most wants to fix
were the one place on the site they could not tap.

`readOther` reads another page's document and writes the address into every
path it hands back:

```astro
---
import { readOther } from '../../lib/page';

const post = readOther('/blog/healing');
const { at, of } = post.block('post');
---
<a href="/blog/healing" data-jtk-path={post.pathAt(at, 'title')}>{post.str(of, 'title')}</a>
```

```html
data-jtk-path="page:/blog/healing:blocks[0].title"
```

The admin resolves it against that page, writes it there, and the post's own
page updates with it. `fl-check` holds the claim from the other end: an address
this site did not build, or a field that page does not offer, fails.

**Annotate only what the owner taps.** On a tile that is the title and the
cover. The date and the excerpt are `no_tap_target` on the post type — edited
in the panel beside the post — and a `page:` path to one is refused by the
platform's build (`JTK_E_ANNOTATION_UNKNOWN … has no field for`). Draw them
with `data-jtk-fixed`, which says the words are not this page's to edit, and
the check is satisfied both ways. The scaffold's blog listing does exactly
this.

**Only where a page renders another page's content.** A heading you wrote in
*this* page's document is this page's, however much it looks like a tile.

## Writing an entry by hand

Legitimate, and sometimes the fastest way to write one. The file is
`jtk/content/<prefix>/<slug>.md`, its address is where it sits, and the
next publish imports it back as the draft:

```markdown
---
collection: blog
visible: false
type: post
v: 1
title: Догляд після сеансу
date: "2026-08-26"
excerpt: Що робити перші два тижні.
---

## Перший тиждень

Не мочити, не терти рушником.
```

`visible: false` means the site builds it and lists it nowhere; the studio's
edge serves it only to a session that is editing the site. Quote the date —
unquoted, YAML makes it a timestamp.
