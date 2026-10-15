# The work, shown

`src/components/gallery/Gallery.astro`, recipes in `galleries.ts` beside it.

A body of work is the strongest thing most of these businesses have, and it is
also the thing most likely to be shown badly: eight hundred posts turned into
nine cropped squares, or thirty-seven photographs laid end to end until the
gallery *is* the page.

**The arrangement is decided by the material, not by taste.** Two questions
settle it — how much work there is, and whether the work has an order.

| `arrangement` | What it is | Pieces | For |
| --- | --- | --- | --- |
| `ragged` | Still columns, every picture at its own proportions. | 6–24 | The default, and the one to argue *against* rather than for. A calf is not the shape a forearm is, and a grid of squares takes the tattoo out of half of them. |
| `wall` | Columns drifting in opposite directions inside a window about two photographs tall. | 18–200 | Volume as the argument. The only one that moves — see below. |
| `contact` | Uniform small cells, dense, many at once. | 24–200 | Volume again, said by fitting eighty things on a screen rather than by moving. Wants work that survives being small: silhouettes, not fine line. |
| `strip` | One row, snapped, moved by the visitor. | 3–20 | Work that has an *order* — a process, a before and an after, a series. |
| `spread` | A few pieces, each given the full width. | 3–10 | Six outstanding photographs rather than sixty adequate ones, and the honest answer when the feed has been picked over and there is not much. |
| `index` | Rows: a small frame and the words beside it. | 4–30 | Where what the work *is* — where on the body, how long, what it covered — matters as much as how it looks. It refuses to build without captions, because an index with nothing to read is a worse `ragged`. |

And six a visitor plays with — each one a moment of its own on the page, not a
way to fit more in. Every one of them works without a script (it falls back to
a strip or a sheet of the same pictures), honours reduced motion, and never
advances on its own except `sphere`, which is bounded like the wall.

| `arrangement` | What it is | Pieces | For |
| --- | --- | --- | --- |
| `deck` | A loose pile of prints; the top one is thrown off by a drag, a button or a key, and slides back in at the bottom. | 4–24 | Work held in the hand — a cut, a cake, a ring — looked at one at a time. Not volume. |
| `coverflow` | A scrolled row, snapped to the middle, the pieces either side turned away in depth. | 5–30 | A series the visitor flips through, with one piece given the stage. |
| `focus` | The same row racked like a lens: the middle sharp and full size, the rest softer and smaller by distance. | 4–30 | Photographs worth looking at one by one, without losing sight of the rest. |
| `stage` | One large frame, a row of thumbnails over its foot; a tap brings a piece up. | 4–30 | A portfolio somebody browses: every piece one tap away. |
| `morph` | One frame at a time; the next burns through the last in a noise dissolve (WebGL, one shader, no library). | 3–16 | Pictures that are atmosphere — a room, a light — more than a catalogue. Cross-fades where WebGL is missing. |
| `sphere` | The work spread over a globe the visitor turns; the near side large, a tap opens a piece. Turns slowly by itself. | 20–80 | Volume as a thing to play with. Small round frames: work that reads at thumbnail size. Declares `data-motion`, stops under the pointer, still under reduced motion. |

`ratio` sets the pieces' proportions in `deck`, `coverflow`, `focus`, `stage`
and `morph` — measure the photographs first (`shape()`, `docs/photos.md`): a
feed of portrait phone pictures wants `4 / 5` or `3 / 4`, not the landscape
default.

The count is checked against the range and warns rather than fails: a `spread`
of twelve may be deliberate, and a warning in front of whoever chose it, while
they can still change it, is the whole job.

## Deal, do not slice

Pieces go into columns by position — first to column one, second to column two —
never in slices. Slicing a date-ordered list puts this year in one column and
three years ago in another, so a visitor reading down one column sees one period
of the work. Dealing makes every column a fair sample, which is also what makes
it safe to drop the third column on a phone: what goes is a third of the wall
and not a period of their work.

## The one that moves

`wall` is the exception to the kit's Motion rule, and it is bounded rather than
argued. A wall of photographs is *looked at* rather than read, which is what
makes an exception arguable at all; three conditions make it defensible, and all
three are in the component rather than in somebody's memory:

- **it stops on hover and on keyboard focus** — still whenever anybody is
  actually looking at one frame;
- **reduced motion gets the wall laid out still and in full** — the window opens,
  the animation never starts, and the duplicate pass is not shown;
- **nothing readable is inside it** and nothing is positioned against it.

The loop is seamless because each column is rendered twice and travels exactly
half its own height: the halfway point is pixel-identical to the start. That is
the one place a percentage is the right unit — the distance is a property of the
track, not of the screen.

`--gallery-cycle` is long on purpose. A wall that completes in thirty seconds is
a wall somebody is watching instead of reading the page; a hundred and fifty is
a surface that is *alive* rather than one that is *playing*.

**It declares itself.** The root carries `data-motion="gallery"`, and `jt-check`
counts motion regions rather than animated elements — so three drifting columns
are one decision. Two regions on a page is the ceiling: a hero that moves and a
wall that drifts. A third is a demo.

## Fed from content, which is how the owner keeps it

A gallery hard-coded from `src/assets` is a gallery only we can change. Declare
the field and pass the content, and it is theirs:

```ts
// src/content/blocks.ts — the declaration
{ key: 'work', label: 'Роботи', kind: 'media', multiple: true, max: 120,
  client_editable: true, hint: 'Порядок тут — порядок на сторінці.' }
```

```astro
---
import { block, gallery } from '../copy/uk';
const plates = block('plates');
---
<Gallery arrangement="wall" items={gallery(plates.of, plates.at, 'work')} />
```

`gallery()` is the seam and does three things at once: it reads the field, it
keeps the document's order, and **it gives every picture its `data-jtk-path`**.
That last one is not optional — without it the owner sees their work and cannot
touch it, and `jtk catalogue` fails on exactly that. A gallery is the longest
list on the site to have to fix afterwards.

**A picture is either the repository's or the owner's, and `<Shot>` resolves
both.** An item's `src` is a slot name — `work-dragon`, a file in `src/assets` —
or a key like `media/<site>/<hash>.jpg` that somebody uploaded in the admin. The
build downloads the keys into `src/assets/` before it runs, so both go through
`astro:assets` and come out with variants and a `srcset`. Nothing on the page
has to know which it was given, which is the point: a photograph the owner
swapped in lands in exactly the frame the developer's was in.

That is also what lets a bespoke site be pushed with its work already in it. The
first content document names the slots the repository ships; the owner replaces
them one at a time, or not at all.

### The clips

`<Clip>` rather than `<Gallery>`: five loops in a pile, one behind a heading, a
strip of four — the arrangement is the design's, and a clip has its own rules
(autoplay, no audio track, a poster that is its own first frame, reduced motion
stopped on frame one). All of them live in the component.

```astro
{gallery(of, at, 'clips').map((loop) => (
  <Clip src={loop.name} poster={loop.poster} path={loop.path} />
))}
```

**One label for a set, not one per clip.** Five loops are visually one thing;
five labels read out in a row are worse than one sentence. Put `role="img"` and
an `aria-label` on the container and leave the clips unlabelled.

## What it does not do

No arrangement crops a photograph to a shape it is not, and none of them puts a
caption inside a moving surface. `contact` is the only one that squares its
cells, and it says so — it is a contact sheet, and that is what one looks like.

The pictures come through `<Shot>`, so everything true there is true here: the
treatment, the alt text, the placeholder for a frame that has not arrived, and
the refusal to stretch anything. The duplicate pass a `wall` renders is marked
`decorative`, because the same photograph described twice is worse for a screen
reader than described once.

