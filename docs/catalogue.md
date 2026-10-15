# The catalogue

`jtk/catalogue.json` is what lets a site built here be handed to its owner.

The studio's admin edits a site by tapping the text on it. It can do that for a
site built any way at all — any markup, any components, any layout — because it
reads the catalogue rather than knowing anything about the site. **That is what
makes bespoke and editable the same sentence rather than a trade.**

```
src/          the design. Yours. Anything at all.
jtk/          the values. The owner's, edited in the admin.
catalogue     which values there are, and what each one is
```

## Declare, do not write

Nobody edits `catalogue.json`. It is emitted from `src/content/blocks.ts`, which
sits beside the components, is type-checked, and is where the decision actually
belongs:

```bash
npx @jtakeit/astro catalogue
```

**A field declared there can be edited by the owner. A field left out is part of
the design.** Both are right answers — a headline is content, the way a section
is laid out is not — and the choice is per field rather than something a
framework makes for you.

Then it checks itself against the built page, in both directions:

| | what it means |
| --- | --- |
| declared, not rendered | a control in the admin that edits nothing |
| rendered, not declared | text the owner can see and cannot touch |

The second is the one that hides, which is why `jtkit lint` catches it
again at build time. Between them a catalogue cannot drift from the page.

## The codes, and who is right about them

Everything `jtk catalogue` refuses is named:

```
✗ JTK_E_MEDIA_INVALID  hero.clip: accept: 'video' without multiple — …
✗ JTK_LOCAL             src/Nav.astro: "/preise/" is written from the root — …
```

A `JTK_E_…` code is the platform's, not this skill's. What it means and what to
do about it are one row in the admin's generated `docs/reference/errors.md`, and
that page is the one to read — it is written from the validator itself, and
anything restated here would be a second wording of a rule that has one. The
same code comes back from the admin when a site is attached, so the two answers
about one file are legibly the same answer. `JTK_LOCAL` is the handful of checks
that are ours alone: whether the build survives being served under the preview's
`/p/<slug>/` prefix, which the catalogue format has no opinion about.

**The judge is the admin, not this checker.** The rules above are implemented
twice — in Go on the server, and in `lib/catalogue.mjs` so the answer arrives with
a line number before anything is deployed — and two implementations of one
contract drift silently. So the local one sits the other's exam:

```bash
npx @jtakeit/astro catalogue --judge   # needs JTK_API, JTK_TOKEN
```

It posts the emitted catalogue to the real validator and reports every code the
two disagree about. Run it on client projects: those runs are the only thing
keeping the copy true, and a divergence is a bug in the script rather than in the
site.

## What a field is

```ts
{ key: 'title', label: 'Заголовок', kind: 'text', max: 80,
  required: true, client_editable: true, seo_sensitive: true }
```

- **`key`** is permanent. It is the key in the content document, so renaming one
  loses whatever the owner had written in it.
- **`label` is the sentence itself**, in the site's language. The admin's own
  blocks label their fields through a locale file; a bespoke block has no locale
  file, so the text goes here and the admin shows it as written.
- **`kind`** decides the control and the validation: `text`, `textarea`,
  `richtext_lite`, `number`, `money`, `duration`, `time_of_day`, `tel`, `url`,
  `email`, `date`, `select`, `bool`, `media`, `list`.
  - **`money`** is a whole number of **minor units** — `25000` is 250.00. Never a
    decimal: money that is a float is money that is wrong the day somebody sums
    a column, and minor units are what Stripe is handed later. The currency is
    the site's and is not part of the value — the template writes the symbol
    beside the amount it renders.
  - **`duration`** is a whole number of **minutes** — `90` is an hour and a half.
    Minutes because that is the unit slot arithmetic works in, so nothing
    converts on the way. The panel reads it back as "1 год 30 хв".
  - **`time_of_day`** is whole minutes from **local midnight** — `540` is nine in
    the morning, and there is no such value as 1440. No zone travels with it:
    the zone is the site's, declared once.
- **`client_editable`** separates the owner from the studio. A headline is
  theirs; a button's destination points at a section they did not build.
- **`no_tap_target`** is for a value that never appears as its own element — a
  message a script writes later, a string that lands in an attribute, a label
  only a screen reader hears. It is edited in the panel beside the preview, and
  the checks must not look for something to tap.
- **`seo_sensitive`** shows a warning that changing it moves the page in search
  results.

`list` holds rows: `of` is the fields of one row, and a list inside a list is
not something the admin has a control for.

## Attaching the site

Once `jtk catalogue` passes:

1. Push the repository.
2. In the admin, create the site and paste the repository's URL.
3. Import — the admin reads the ref into the draft.

The import refuses a ref with no catalogue, which is the whole reason this file
exists rather than being optional.

## What the owner may break, and what they may not

Nothing in `src/` is reachable from the admin. An owner can empty a headline and
they cannot move a section, change a colour or delete a component — those are
the design, and the design is a commit.

That is also the answer to "what happens when both of us are working": the
developer writes `src/`, the admin writes `jtk/`, and they never touch the
same file.

## Every sentence a visitor reads is content, unless it is machinery

The same rule as photographs, and it catches more sites: a string written into
a component is a string only we can change.

**Content** is anything said in the business's voice — the wordmark and the line
under it, the footer's note about how to book, and, the one that gets missed
every time, **what the form asks for**. "The idea, where it goes on the body,
roughly how big" is a tattooist deciding what she needs before she can answer;
the next business needs a date, a headcount, a registration number. A visitor
reads it and the owner is the only person who knows what it should say.

**Machinery** is the short list around it: "Sending…", "Sent.", the sentence a
browser shows for an empty field, the skip link. There is nothing an owner wants
to say in those, and the server keeps its own copy of the refusals anyway.

The scaffold's form now declares its questions — `name_label`, `contact_label`,
`message_label`, `required_note` on `cta_banner` — and its machinery stays in
the copy adapter.

**The navigation is content too**, and it is the one most often left out. The
labels in the header and the footer are the words a customer navigates by —
«Preise», «Kurse», «Galerie» — and a business renames them: a price list becomes
a menu, courses become workshops. The *addresses* stay the design's, because a
route the owner could retype is a route they could break; so declare the labels
and leave the hrefs out of the catalogue, or declare them `client_editable:
false`. A nav list in `src/data/nav.ts` is fine as the shape; the words in it
come from the shared document.

### Say which, in the repository, for every sentence

The rule above is a judgement, and a judgement that is not written down is not a
decision. Every visible sentence on a built page is one of two things:

| | how it is written | who changes it |
| --- | --- | --- |
| the owner's | declared in the catalogue, annotated `data-jtk-path` | they do, by tapping it |
| the design's | marked `data-jtk-fixed` | we do, in a commit |

`data-jtk-fixed` is a boolean attribute and it silences everything inside the
element it is on, so one attribute covers an ornament made of six spans:

```astro
<a class="skip" href="#main" data-jtk-fixed>Zum Inhalt springen</a>

<div class="trap" aria-hidden="true" data-jtk-fixed>
  <label for="lead-website">Website</label>
  <input id="lead-website" name="website" type="text" tabindex="-1" />
</div>
```

It is for machinery and for ornament: a skip link, a honeypot, a decorative
caption, a counter drawn by the design. It is not a way to make a decision go
away — a nav label marked `data-jtk-fixed` is a nav label the owner cannot change,
and that has to be a thing somebody chose rather than a thing somebody skipped.

**`jtk catalogue` fails on a sentence that is neither.** It used to list them and
pass, which made the decision optional — and optional is how a site shipped with
twenty-six strings belonging to nobody: the navigation, the footer and the
labels on the form, with a line in the handover saying the boundary had been
drawn deliberately. Nothing had been drawn: the strings were simply written into
components, and the owner found out by wanting to change one.

### The wordmark and the footer

They are content and they sit outside `<main>`, which is the only thing that
makes them awkward: **an annotation path is `blocks[i].field`, so a tappable
string has to be a field of a block.** Nothing requires that block to render
inside the article — where a block appears is the design's business, and the
lint looks for its path anywhere on the page.

So a site that wants them editable declares one:

```ts
{
  type: 'signature',
  v: 1,
  label: 'Підпис сайту',
  fields: [
    { key: 'wordmark', label: 'Назва', kind: 'text', max: 60, client_editable: true },
    { key: 'role', label: 'Хто це і де', kind: 'text', max: 90, client_editable: true },
    { key: 'footnote', label: 'Рядок у підвалі', kind: 'text', max: 140, client_editable: true },
  ],
}
```

and the header and the footer read it through `block('signature')`. The same
field can be annotated in both places — a patch reaches every element carrying
the path, so a wordmark in the corner and the same wordmark in the foot stay one
value.

Two things not to do. Do not leave them in a `SITE` constant because they are
"furniture": the owner's own name is not furniture, and neither is the sentence
telling somebody how to book. And do not reach for `business_facts` — it has
`name` and `city`, it is edited in a panel rather than by tapping, and there is
no annotation path shape for it.

**A separator between two values is CSS, never a text node.** The footer joins
the wordmark and the role on one line, and written the obvious way

```astro
<span data-jtk-path={…}>{sign.name}</span> — <span data-jtk-path={…}>{sign.role}</span>
```

the dash and the spaces around it belong to neither field. Nothing on the page
can edit them, and the owner sees two outlined boxes with a dead gap between
them and reasonably asks what the gap is. Put it where it belongs:

```css
.foot__role::before { content: ' — '; }
```

Now nothing between the two is unowned, the line reads as one, and a tap on the
dash opens the role — which is the field it is attached to.

The same trap, one level up: a value repeated in two places is one field
annotated twice, not two fields. A patch reaches every element carrying the
path, so a wordmark in the corner and the same wordmark in the foot stay one
value however many times the design prints it.

## Media: a wall of work, and a set of clips

Two shapes turn up on nearly every site now. Both are `media` fields, and
between them they add two words to the catalogue's vocabulary.

**A gallery is one field, not thirty-seven.**

```ts
{
  key: 'work',
  label: 'Роботи',
  kind: 'media',
  multiple: true,
  max: 120,
  client_editable: true,
  hint: 'Порядок тут — порядок на сторінці.',
}
```

Declared as a `list` of rows it becomes a repeater — add a row, open it, choose
a file, close it, thirty-seven times — and that is the wrong shape for what a
gallery is: a collection you drop pictures into and take pictures out of. One
field, an ordered array of items, each carrying its own `alt`, because a
photograph with no alt text is announced as a file name.

A `list` of rows is still right where every piece has **words** beside it and
the words are the point — the `index` arrangement in [gallery.md](gallery.md).
The question is whether the owner is editing entries or filling a bag.

**The arrangement is not in the catalogue and must not be.** How the work is
shown — drifting columns, a dense contact sheet, a few large pieces — is a
design decision taken from how much work there is, and it is not content.

**A set of clips** is the same field with what it holds declared:

```ts
{
  key: 'clips',
  label: 'Відео процесу',
  kind: 'media',
  accept: 'video',
  multiple: true,
  max: 6,
  client_editable: true,
}
```

`accept: 'video'` is there because what the page does with a clip is different
from what it does with a photograph: it autoplays it, loops it, and falls back
to a poster frame every time autoplay does not happen. The clips and their posters are cut from the client's own video with whatever tooling you have; `<Clip>` plays them.

Both words are for `media` fields and nothing else, and `jtk catalogue` says so.

**A clip is always `multiple`, even when there is one of it.** A clip is stored
with its poster, and a plain media field is one key with nowhere to keep one, so
one clip is `multiple: true, max: 1`. It reads oddly for a moment and it means
every video on every site has the same value shape.

### The frame, and what must survive it

A client uploads a photograph in whatever shape their camera gave it and the
page has a slot of its own. Declare the slot:

```jsonc
{ key: 'work', kind: 'media', multiple: true, ratio: '3:2', client_editable: true }
```

**The frame is yours and the subject is theirs.** How a page is proportioned is
the design's answer, so `ratio` is declared here and there is no handle in the
admin to drag — two pages of one site coming out differently proportioned is
the thing this prevents. What the owner *does* say is which part of their
picture must survive the crop, because that is the one thing the design cannot
know: they press the subject and the frame moves to it.

There is no stretching. A photograph with its geometry changed is a spoiled
photograph, not a laid-out one.

A field with a `ratio` gives each item a **`focus`** — the CSS value itself,
`"50% 25%"`, so it drops straight into `object-position` with nothing to
convert. `Shot.astro` already takes both:

```astro
<Shot name={item.src} ratio="3 / 2" fit="cover" focus={item.focus} … />
```

**A framed field is always `multiple`**, for the same reason a clip is: the
focus is stored beside the picture, and a plain media field is one key with
nowhere to put it. One framed picture is `multiple: true, max: 1`.

### What one item is

```jsonc
"work":  [ { "src": "media/<site>/<hash>.jpg", "alt": "Дракон, передпліччя" } ]
"framed":[ { "src": "media/<site>/<hash>.jpg", "alt": "Дракон", "focus": "50% 25%" } ]
"clips": [ { "src": "media/<site>/<hash>.mp4",
             "poster": "media/<site>/<hash>.jpg", "alt": "Стенсіл" } ]
```

`src`, `alt`, `poster`, and nothing else. **The three keys are not declared per
site** — the admin synthesises them from the field, so a site that named them
`file` and `caption` would be a site the editor cannot follow. `src` is a key in
the studio's bucket, never a URL; `alt` is optional to store and required to be
worth reading, because a photograph without it is announced as a file name; a
clip's `poster` is generated from its own first frame when the owner uploads it,
the same frame the clip's poster is.

Order is position. There is no id and nothing to sort by: the array is the page.

### How a component reads one

The keys are downloaded into `src/assets/<key>` before the build, so a gallery
goes through `astro:assets` exactly as `src/assets` photographs do — variants,
`srcset`, the lot. What a component must not do is address `src` as a URL: that
is our bucket's address and it changes.

### The annotation

```
blocks[3].work[7].src
```

One picture is one tap target, and **the container is not one** — tapping a wall
of thirty-seven and being offered "the wall" to edit is not an edit anybody
means to make. Tapping any picture opens the whole gallery in the admin with
that one selected, which is where add, remove, reorder and re-caption live.

`alt` and `poster` carry no annotation and are not looked for: neither of them
appears on the page as itself. Annotating them anyway is allowed and does
nothing.

### What is served from where

`/media/…` is the studio's prefix on the hosting edge: an owner's uploads are
served from it. A file the site ships under that path is not reachable, which is
why clips go in `public/clips/`. Anything else in `public/` is the site's
own and is served as it always was.

`public/_headers` is a Cloudflare Pages convention the platform's edge does not
read — headers are the platform's, and a site cannot set its own. The scaffold
ships none.

## Turning a wall that was built into a wall that is owned

A site built before galleries were content has its work in the components: a
list of slot names in a page, or a `PHOTOS` registry, and every picture a
decision only we can change. Four steps, in this order, and the site is
attachable at the end of them.

**0. Bring the components that changed.** A site built before this has its own
copies, and the mechanism lives in six files:

```
src/lib/uploads.ts              new — resolves a content key to a local file
src/lib/photos.ts               photo() now answers for keys as well as slots
src/components/Shot.astro       takes `path`, and puts it on the <img>
src/components/Clip.astro       new — one silent looping clip, done properly
src/components/gallery/         Gallery.astro + galleries.ts: path onto the picture
src/copy/<locale>.ts            gallery(), the seam
```

Copy them over the site's own, then reconcile: everything else in those files is
the kit's and unchanged, so a diff shows only what this added.

**1. Declare the fields.** In `src/content/blocks.ts`, on the block the work
belongs to — not a new block. The type name is permanent, so it is the one this
page already uses.

```ts
{ key: 'work',  label: 'Роботи', kind: 'media', multiple: true, max: 120, client_editable: true },
{ key: 'clips', label: 'Відео процесу', kind: 'media', accept: 'video', multiple: true, max: 6, client_editable: true },
```

**2. Move the pictures into the content document**, as items, keeping the order
the page already had and carrying each one's alt text with it. Slot names, not
keys: the files stay exactly where they are.

```js
// One-off, from PHOTOS — thirty-seven of these by hand is thirty-seven chances
// to lose an alt.
const items = PHOTOS.filter((p) => p.name.startsWith('work-'))
  .map((p) => ({ src: p.name, alt: p.alt }));
```

Put them under the block's key in `jtk/content/index.json`. The alt text
now lives in two places — `photos.ts` and the document — and the document is the
one the page reads; leave the registry alone, it still describes the files.

**3. Render through the seam.** `gallery()` for the pictures, `<Clip>` for the
loops — [gallery.md](gallery.md) has both. What the page loses is the hard-coded
list; what it keeps is every visual decision, because the arrangement was never
content.

**4. Check, and push.**

```bash
npx @jtakeit/astro catalogue   # emits, builds, checks both ways
```

Zero means the admin can be handed this repository: every declared field renders
with its path, and nothing on the page is text the owner cannot touch.

One thing to look at with your own eyes before pushing: **the annotation goes on
the `<img>`, never on the frame around it.** The admin replaces a picture by
setting `src` on the element it was told about, and an element that is not an
image gets its *text* replaced instead — so a `data-jtk-path` on a `<figure>`
turns the client's photograph into a URL printed where the picture was. `<Shot
path={...}>` puts it in the right place; a hand-rolled `<figure data-jtk-path>`
does not.
