# The surface: grounds, edges and entrances

Three catalogues, and one decision. The hero is where a page spends its loud
moment — [hero-motion.md](hero-motion.md) is that. This is everything under it:
the paper the page is printed on, the edge a block is drawn with, and how a
block arrives when it is scrolled to.

They are written down together because they are chosen together, and because
each of them is a place where a page quietly acquires somebody else's taste. A
ground picked because it was the example in this file is how fifty sites end up
sharing a background.

```jsonc
// jtk/design.json — the surface, beside the palette
"surface": {
  "pattern": "rules",   // the ground. "" is none, and none is a choice
  "scope": "page",      // one layer behind the document, or one per section
  "opacity": 0.06,      // the volume knob. jt-check measures this one
  "draw": false,        // a drawn ground sets itself out once
  "edge": "corners",    // how a block is drawn
  "reveal": "settle"    // how a block arrives
}
```

Everything is a document rather than props typed into a page, for the same
reason the copy is: it can be changed without an agent, and the studio bar's
live accent drives it.

## The grounds

`src/components/surface/Pattern.astro`, figures in `patterns.ts` beside it.
Six, and they are not six skins of one look — each does something the others
cannot.

| `pattern` | What it is | Wants | Costs |
| --- | --- | --- | --- |
| **none** | The token ground, and nothing else. | A page carrying strong photographs, where anything behind them is noise. | Nothing. It is chosen by leaving `pattern` empty, and it is a real choice — say it out loud rather than defaulting into it. |
| `grain` | Film grain, paper fibre, plaster. No figure at all: its whole job is that a flat token stops reading as a fill. | Any page whose grounds are large and plain. It is the one that goes with everything. | Turned up, it is a grey wash rather than a texture. Under 0.1. |
| `rules` | The ruled plane: ledger paper, a form, a chart. | Trades that measure — clinics, legal, technical, anything whose credibility is the argument. | Reads as cold where warmth is the product. |
| `hatch` | Engraved hatching, one direction, the way a burin goes. | Print, craft, food, barbers, workshops. | On a busy page it fights the photographs. |
| `contour` | Contour lines, the way a landscape is drawn. | Bodies and calm: massage, wellness, anything organic. | Needs height to read — in a 180px band you see two lines and a shrug. |
| `construction` | Setting-out: axes, circles, dotted guides. The register of a studio that shows its process. | Studios, ateliers, anywhere the work is watched being made. | It is the loudest of the six, and it is not anybody's signature — see the last section. |
| `motif` | The client's own mark, tiled: their tile, their fabric, their stamp, the shape off their sign. | Anywhere that mark exists. | **No default.** It does not build without the figure, and the figure is not in this repository. |

Two mechanisms, because they do different work. `grain`, `rules` and `hatch`
are **stencils** — a repeating figure with no beginning and no end, drawn as a
CSS mask, no markup and no bytes past `patterns.ts`. `contour`, `construction`
and `motif` are **drawings** — one composition that bleeds off its box, in SVG,
because a figure has a size and a place and because strokes can draw themselves.

### It is in their ink, or it is somebody else's page

**A ground is a stencil and the ink is a token.** Nothing in `patterns.ts` names
a colour. A stencil is an alpha mask over a layer painted in `--pattern-ink`; a
drawing is line art in `currentColor`, which is the same token. So a variant
that changes its palette repaints its ground with it, the live accent picker
drives it, and a ground can never arrive in a colour somebody else chose — which
is the failure a shipped background image makes inevitable.

The volume is `--pattern-opacity`, and it is the property most likely to be set
too high. A ground is read at a glance and never read *at*. `jt-check` composites
the ink over the paper and fails the page above 1.6:1, because "is the texture
too strong" is a question two people answer differently on two monitors and the
contrast between figure and paper is a number.

### Where the layer goes

`scope="page"` pins one fixed layer behind the whole document — one composited
surface, no repaint on scroll. It is only visible through sections that let it
through: on a stack of full-bleed bands with their own backgrounds, half of them
cover it. Use `scope="block"` there, on the sections that should carry it, and
give each of those `class="has-pattern"` — two properties that make the section a
stacking context, without which the layer disappears behind the band's own
colour and looks exactly like a ground nobody added.

### Every way it fails ends at the paper

No JavaScript, no mask support, a printer, reduced motion: all of them end at
the plain token ground, which is a design rather than a hole. Nothing readable is
ever inside the layer, nothing is positioned against it, it is `aria-hidden`, and
it is never the LCP element. A drawn ground with `draw` sets itself out once and
stops; reduced motion gets the finished drawing, never a missing one.

Unlike a hero field this costs no canvas and no script, which is why it is also
the answer where WebGL is not available, and why a still of the page shows
exactly what a visitor sees.

### And the photographs on it

A ground and the photographs printed on it are one decision. The fourth
catalogue lives in [photos.md](photos.md) — six treatments, chosen once for the
site in the same document — and the pairs that belong together are obvious once
both are on the table: `grain` with `film`, `riso` or `hatch` with `press`,
`construction` with an untouched photograph that has something to say.

The rule there is the same shape as the one here: **one treatment per site**, and
never a strong one on their face.

## The edges

Attributes, not wrappers: `<article class="card" data-edge="corners">`. Delete
the attribute and the block is the block. Drawn on a pseudo-element rather than
as a border, so adding an edge never changes a block's size and never fights the
padding a design already settled.

| `edge` | What it is |
| --- | --- |
| `none` | The edge is where the block's ground stops. |
| `hairline` | One line. Everything else here is a departure from it. |
| `stitch` | Dashed: sewn, ruled, provisional. |
| `corners` | Crop marks — the corners drawn, the sides not. Registered rather than boxed. |
| `notch` | A cut corner: a ticket, a label, a price tag. On the box itself, so the block needs a ground of its own to cut. |
| `offset` | Two frames, one offset from the other, the outer in the accent. A poster's register. |
| `trace` | The perimeter draws itself once, clockwise from the top, as the block arrives. |
| `sweep` | A light travelling around the edge, forever. |
| `lift` | The block answers the hand: shadow and a couple of pixels on hover and focus. |

Two rules, and `jt-check` holds the page to both:

- **An animated edge belongs to something that can be pressed.** Furniture that
  performs is furniture being looked at instead of the words.
- **One thing on a page moves forever**, and the hero has usually already spent
  it. `sweep` on six cards is not a design, it is a component gallery.

`offset` draws its outer frame as an `outline`, which is also how a focus ring
is drawn — keep it on blocks rather than on anything focusable.

## The entrances

Also attributes: `data-reveal`. The hidden start state hangs on `html.js`, which
the layout sets before first paint, so a visitor with JavaScript off gets the
finished page rather than a column of invisible sections. The observer that adds
`.is-in` is in `Layout.astro`; it watches each block once and never again.

| `reveal` | What it is | Wants |
| --- | --- | --- |
| `none` | The page is already there. | Short pages, and any page where the entrance was the only idea. |
| `rise` | Up and in. The default, and the one every site has. | A page with a handful of large blocks. |
| `settle` | Fades and settles a little closer, with no travel. | A dense page: travel makes a long column feel like it is bouncing. |
| `wipe` | Uncovered from one edge rather than moved. | A graphic page, a print register, anything already linear. |
| `develop` | Out of focus, then not. Photographic. | Pages carrying photographs — put it on the picture, not on the section around it. |
| `stagger` | The children in order. `--i` is set by the observer, so a list rendered from a document does not carry an index into its markup. | Grids, price lists, an `index` page form. |
| `draw` | Line art draws itself. Every figure needs `pathLength="1"`, and then one rule covers a circle, a line and a 56-point contour alike. | A page whose signature is drawn rather than photographed. |

Three rules:

- **One entrance per page.** Two is defensible where the second is on the
  photographs. Three is a component gallery, and `jt-check` fails it.
- **Nothing in the first screen is revealed.** It delays the largest paint and
  shows a visitor on a slow line an empty page. Reveal what is scrolled to,
  never what is landed on.
- **It never replays.** A block that animates again on the way back up is what
  clients report as "it keeps flashing".

`Blocks.astro` gives the band immediately under the hero no entrance at all, for
the second of those rules: on a phone, and on any page whose hero is not a full
screen, that band is *in* the first screen. A design that replaces the component
keeps the exception — or gives the hero the height that makes it unnecessary.

Reduced motion means the finished state everywhere: the block in place, the
border closed, the drawing complete.

**`hold` is not in this list on purpose.** A column that stays while the argument
scrolls past it is `position: sticky` — it is the `two-rail` page form in
[shapes.md](shapes.md), a layout decision, not an entrance. Putting it here
would let a page pick it instead of choosing a shape.

## Recording the choice


## A catalogue is not an identity

This file makes it cheap to look designed, and that is exactly its risk: the
easier a page is to finish, the less likely anybody makes the one element that
could not be moved to another site.

`construction` is the case to be careful with. It exists because a build had its
own construction geometry — the guides one tattooist leaves in red inside her own
work, redrawn as the furniture of her page — and that was the best thing on the
site. What is in `patterns.ts` is the generic article, not her drawing. Using it
buys a register; it does not buy a signature.

`motif` is the entry that does. It has no default, it does not build without the
figure, and the figure is theirs: their tile, their stamp, their sign, their
handwriting. If a page's whole visual identity is three values out of these
tables, it is a page that is different from the last one rather than a page that
is theirs — see the last section of [shapes.md](shapes.md).
