# Photos

A small-business site is mostly photographs, and they arrive late, wrong-sized
and one at a time. The pipeline is built so that a missing photo is never a
build failure and swapping one never requires touching a page.

Template: `src/lib/photos.ts` and
`src/components/Shot.astro`.

## Slots, not paths

```
src/assets/<slot>.<ext>   →  src/lib/photos.ts (import.meta.glob, eager)  →  <Shot name="hero" />
```

The file name is the slot. Any of `jpg jpeg png webp avif`, case-insensitive;
first match wins, so `hero.jpg` and `hero.webp` cannot fight over one slot.
Replacing a photo is dropping a file with the same name and rebuilding — no code
change, no page edit.

**A missing file must never break the build.** `photo()` returns `undefined` and
`<Shot>` renders a labelled placeholder that keeps the frame's aspect ratio, so
the layout survives and the gap is visible and named. This is what lets stage 1
proceed while the client is still looking for their photos, and it is the single
most useful thing in this file.

Do not move photos into `public/`. They need `astro:assets`, which is what
produces the webp variants, the `srcset` and the intrinsic dimensions.

## Every photograph is either a field or the design

There is no third kind, and the difference is not how a picture is stored — it
is what the owner can do about it.

| | |
| --- | --- |
| **a field** | declared in `src/content/blocks.ts`, annotated on the page, tappable in the admin |
| **the design** | in a component, and only a commit changes it |

**A photograph that is on the page on purpose gets a field.** The portrait, the
room, the work in progress, the three frames of one piece: those are the
business, and a business whose owner cannot change their own portrait is one who
sends us a message and waits for a deploy. What stays out is a picture that is
structure rather than subject — a texture, a rule, a shape behind a heading.

Declaring one costs two lines and changes nothing about the page:

```ts
// src/content/blocks.ts
{ key: 'portrait', label: 'Світлина майстра', kind: 'media', client_editable: true },
{ key: 'portrait_alt', label: 'Опис світлини', kind: 'text', max: 140,
  client_editable: true, seo_sensitive: true, no_tap_target: true },
```

```astro
const { at, of } = block('artist');
const portrait = picture(of, at, 'portrait');
<Shot name={portrait.name} alt={portrait.alt} path={portrait.path} ratio="4 / 5" />
```

The value in the content document is **the slot the repository already ships** —
`artist-at-work` — so the page looks exactly as it did, and the owner replaces
it when they want to. `<Shot>` resolves a slot and an uploaded key through the
same door, so what lands afterwards falls into the same frame.

`picture()` returns the slot, its words and its `data-jtk-path` together, and the
path is the half that cannot be skipped: without it the photograph is on the
page and nothing happens when the owner taps it. `jtkit lint` fails the
build for exactly that, and `<Shot path={...}>` puts it on the `<img>` — never
on the figure around it, because the admin replaces a picture by setting `src`
and an element that is not an image gets its *text* replaced instead.

A gallery is the other shape of the same rule — one field holding many, each
item with its own alt. See [gallery.md](gallery.md).

## Alt text is registered, not improvised

(For a picture that is a field, the alt text is a sibling `<key>_alt` field and
the content document is what the page reads. The registry below still describes
the files, and is what a picture rendered straight from `src/assets` uses.)

Every slot is registered in `photos.ts` with alt text in the site's language and
a category. A photo with no alt is announced by its file name. Alt text is
written from what is actually in the frame; it does not repeat the caption and
it does not sell.

Two things not to assert: who a person is, unless the client confirmed it, and
what a photo proves. Do not pair two photographs of different subjects and label
them "before" and "after" — that is a claim about a result, and it needs to be
one client, one sequence, dated by them.

### A picture that says nothing

`<Shot decorative>` renders `alt=""`, and that is not a missing alt — it is the
correct marking for a picture the page has already said in words. A screen
reader skips it, which is the point.

The case that makes it necessary is the `pile` hero: four photographs are one
thing to look at and four alt texts read out in a row, which is worse than one.
So the frame that carries the meaning keeps its alt and the rest are marked. It
is a composition decision, so it is per use rather than per file — the same
photograph is described in the section about it and decorative in the pile.

`jt-check` tells the two apart by reading the attribute rather than the
property: absent is the fault that gets announced as a file name, empty is a
decision. It still fails a page where *every* image is decorative, which is the
attribute being used to pass the check rather than to describe anything.

## Scale

`src/assets/` is web scale: long side ≤ 1600px. Astro emits the source file
alongside the generated variants, so a 26MB camera JPEG ships 26MB whether or
not a browser ever asks for it — and it will be the reason mobile Lighthouse is
at 71.

Camera-scale originals live in `_photos-original/`, which nothing imports and
which stays out of the repository. Hand them to the client separately if
they want them.

```bash
# ffmpeg is already a requirement and behaves the same everywhere:
for f in _photos-original/*.jpg; do
  ffmpeg -loglevel error -y -i "$f" -vf "scale='min(1600,iw)':-2" "src/assets/$(basename "$f")"
done

sips -Z 1600 _photos-original/*.jpg --out src/assets/      # macOS shortcut
```

## Measure the photograph before you frame it

**A photograph is never stretched.** Not by a pixel. Distortion is the one image
fault a client always notices and never has words for — "it looks weird, but I
don't know why" — and it happens the same way every time: an `<img>` is given
both a width and a height by a layout that wanted a shape, and nothing tells it
to crop instead of squeeze. `<Shot>` sets `object-fit` in every branch so that
cannot happen; a variant that writes its own `<img>` has taken the rule off.

The other half of the rule is that the frame is *chosen*, not assumed. Ask the
picture what it is first:

```astro
const owner = shape('owner');   // { width, height, ratio, orientation }
<Shot name="owner" ratio={owner?.orientation === 'portrait' ? '4 / 5' : '3 / 2'} />
```

A 4:5 phone portrait dropped into a 16:9 band keeps 45% of itself, and the half
it loses is the half with the person in it. The build says so — `<Shot>` prints
the number whenever a `cover` crop would throw away more than 40% of a picture —
but it prints it after the decision, and `shape()` is how the decision is made
correctly in the first place.

## `<Shot>`

Props: `name`, optional `alt` override, optional `ratio`, `fit`, `focus`,
`width`, `eager`, `sizes`, `caption`.

- **Omit `ratio` where the photograph's own proportions matter.** Client photos
  are phone snapshots of small things shot in every orientation; a square crop
  cuts the subject out of half of them. Use a fixed ratio only for fixed-size
  previews, where a ragged bottom edge reads as a bug.
- **`focus` decides what a crop keeps.** The default centres, which is wrong for
  nearly every photograph of a person: a face sits in the top third and a wide
  frame crops it off at the chin. `focus="50% 25%"` is the usual fix, and it is
  worth looking at rather than assuming — the subject is not always where the
  camera put it.
- **`fit="contain"` where nothing may be cropped** — a logo, a document, a
  photograph of something long. The plate shows around it, which is the honest
  trade and not a bug.
- **`eager` on the first contentful image only.** Everything else lazy. One
  `fetchpriority="high"` per page; two means neither is prioritised.
- **`sizes` describes the layout, not the file.** A wrong `sizes` is why a
  correctly generated `srcset` still downloads the 2400px variant on a phone.

## Grouped galleries

A gallery of client photos wants a column layout that keeps every photo whole
and ends ragged, not a grid that crops to squares and ends flush. The ragged
edge is worth the honesty: cropping is how a close-up of one fingertip loses the
fingertip.

## Whose face is in the hero

For a business run by one person, **the hero photograph is that person**, and
finding one is worth real effort. It is their business, they are what a customer
is actually choosing, and a stranger's decision to book is made about a face
long before it is made about a service list. A hero showing hands, a room or a
product is the fallback, not the target.

Two things this is not. It is not permission to use a *customer's* face — that
belongs to somebody who never agreed to appear in anybody's sales material. And
on the outbound track it is not a claim about who the person is: a portrait
lifted from their own feed goes in the hero because it is theirs, with alt text
that describes the frame rather than naming them.

Where the photograph is a person, the frame is chosen with more care than
anywhere else on the page: a portrait keeps portrait proportions, `focus` keeps
the face out of the crop, and the picture is looked at at phone width, where the
hero is tallest and narrowest.

## Sensitive photographs

Some trades document damage — medical, cosmetic, repair. Those pictures are
often the strongest evidence a business has, and they belong on the page that
describes that treatment, where the visitor chose to look. Not in a hero, not on
a card, not in a preview thumbnail. Ask before publishing anyone recognisable.

## Treatment

Cropping them well leaves them still disagreeing.

A client's photographs arrive as a feed: twenty pictures in twenty lights, shot
on three phones over two years, with white balance disagreeing between every
pair. That disagreement is what makes a page read as *not art-directed* — which
is exactly what it is. Framing does not fix it, because it is not a framing
fault.

A treatment is what makes them one set. `<Shot treatment="…">`, chosen once for
the site in `jtk/design.json`:

```jsonc
"photos": { "treatment": "grade", "amount": 0.8 }
```

It is two blended layers over the picture and a filter on it — no build step, no
second copy of any file, nothing to re-run when a photo is replaced, and where
the blend modes do not land what is left is the photograph.

| `treatment` | What it is | Wants |
| --- | --- | --- |
| `none` | The photograph. | Photographs that already agree — one shoot, one light. Rare, and worth checking rather than assuming. |
| `grade` | The page's own light: colour kept, shadows pulled toward the ground's hue, highlights toward the paper. | Nearly every site. It is the one that fixes the disagreement without announcing itself, and the only one that is safe on a face. |
| `duotone` | The colour is thrown away and the tonal range remapped onto two tokens. | A page whose photographs disagree badly — because their original colour is precisely what was disagreeing. Strongest, loudest, and forbidden on their face. |
| `film` | Lifted blacks, a milky highlight, grain. | Making a phone photograph look like it was taken on purpose. Pairs with the `grain` ground, which is the same noise tile. |
| `press` | One ink, hard contrast, a dot lattice. The photograph stops pretending to be a photograph. | A page whose ground is already `riso`, `hatch` or `press`-shaped. Forbidden on their face. |
| `recede` | The picture pushed back into the page under a veil of the ground. | A photograph that copy has to sit on. It is the band-sized answer to what `scrim` does for the hero's canvas. |

### One treatment per site

Two looks on one page is the same disagreement arrived at from the other
direction, and it is the shape a page takes when each section was styled on the
day it was written rather than decided once. `jt-check` fails it.

`recede` does not count: it is a photograph doing a job, not a look, and it sits
alongside whichever one the page chose.

### Never a strong one on their face

`duotone` and `press` replace skin colour. On a one-person business that face is
what the customer is choosing — turned two-tone it reads as stock art, which is
the opposite of everything the photograph is there to say.

So the slot is registered, and the component refuses:

```ts
{ name: 'owner', alt: '…', person: true }
```

`<Shot>` fails the build rather than shipping it. The escape is explicit and per
photo — `treatment="grade"`, which is allowed on a face and does most of the
work anyway.

The check is one-way on purpose: it can stop a treatment reaching a face
somebody registered, and it cannot know about one nobody did. Registering
`person` is part of registering the photograph, like its alt text.

### It is in their ink

Nothing in a treatment names a colour. The layers are `--photo-shadow`,
`--photo-light`, `--photo-ink` and `--photo-veil`, which are tokens — so a
treatment follows the variant's palette and the studio bar's live accent the
same way a ground does, and a photograph cannot end up graded into somebody
else's brand.

`--photo-shadow` carries the ground's hue on purpose: a neutral black in the
shadows of a photograph on a warm page turns them grey, which reads as dirty
rather than photographed. It is the same rule as the shadow tokens in
[css.md](css.md).

`--photo-amount` is the volume knob and multiplies every layer. At 0 the
photograph is untouched, which is what makes "a bit less" a number rather than
an argument.

**On a dark page the two ends swap over.** A photograph's shadows are dark on
any page, but `--ink` and `--paper` invert — so a treatment derived from them
comes out upside down, and `duotone` folds a photograph into a flat rectangle.
It looks like a broken blend mode and it is a palette read the wrong way up.
`Layout.astro` compares the luminance of `paper` and `ink` in the design
document and swaps the two tokens itself; a variant that sets its palette some
other way has to do the same.

### What it costs, and what it does not

No extra bytes: the layers are two empty spans and the noise tile is the same
one the `grain` ground uses (`src/lib/noise.ts` — one copy, because two copies
of a texture is how one of them gets retuned and the other does not).

It is `mix-blend-mode` and `filter`, which are composited: cheap on a handful of
photographs, and worth a look on a gallery of twenty. Print drops all of it —
ink is expensive and a treatment is not the picture.

True film halation — the bright pass blurred back over the picture — is
deliberately absent. It costs a second copy of every image and a full-width blur
to composite, and on a page of eight photographs that is paid eight times for the
last tenth of the effect.

## The social card

`public/og.png` (or `.jpg`), 1200×630, regenerated whenever the hero photograph
or the wordmark changes. A photograph belongs in a JPEG — the same card as a PNG
was 600KB, and every social crawler downloads it.

Generate it from the site's own assets with a script rather than by hand, so it
cannot fall out of step. Check it on the served site, because a broken
card is the first impression on every share.
