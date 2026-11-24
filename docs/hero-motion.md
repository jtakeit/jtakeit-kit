# The hero's moving ground

A landing page gets about one second to look like somebody built it. A still
gradient does not buy that second; a field of colour that is visibly *alive*
does, and it costs one canvas and no dependencies.

`src/components/motion/HeroField.astro` is the component — the canvas, the
palette, the sizing budget and every path back to the still ground. `fields.ts`
beside it is what each field actually looks like. Both ship in the scaffold and
are used only where the page chooses them; delete the directory if it never
imported one.

```astro
<HeroField
  field="drift"
  ground="#fbf7f2"
  colors={['#c8632f', '#7a3a18', '#f0e4d8', '#241a12']}
  scrim
>
  <div class="hero__inner">…</div>
</HeroField>
```

`colors` and `ground` are required props. That is the point, not an oversight —
see below.

## The set

Eleven fields, and they are not eleven skins of one look — each is here because it
does something the others cannot. Pick from the design.

| `field` | What it is | Wants |
| --- | --- | --- |
| `drift` | Four lamps of colour on slow orbits through a warped noise field. Calm, wide, plenty of quiet space. | A light or mid ground, a long headline, one photograph beside it. |
| `aurora` | Three layers of simplex noise riding each other, a glow at the centre, a vignette. Denser, more dramatic, obviously moving. | A dark ground, short copy, nothing else competing. |
| `plasma` | Four sine fields summed and read through the palette: bands, rings and interference. The only field with visible structure. | Two colours far apart, and a hero that can carry something graphic. |
| `glow` | One bright filament of light in a dark room — most of the frame stays at the ground colour, which is what makes the lit part read as light rather than as paint. | A dark ground, and a palette with one colour much brighter than the rest. |
| `flow` | A flow field: noise decides a direction at every point and a second noise is read along it. Marbled, like ink pulled through water. | Two or three colours close in tone, and a hero with room — it is busy. |
| `silk` | The coordinate fed back through a cosine of itself four times, folding the plane into creases. The softest field here. | Anything. It is the one that survives a lot of text over it. |
| `smoke` | Two rounds of domain warping: a handful of large plumes folding over each other. The field with an inside. | A palette with a real dark in it — the plumes need somewhere to be deep — and a hero tall enough to show one whole plume. |
| `riso` | A wave through the palette, dithered by a coarse quantised noise *before* the lookup: neighbouring bands of flat colour with a ragged, printed border. The one field that is not a smooth gradient. | Two or three colours far enough apart to make bands, and a design that can carry something graphic. It is the loudest here after `plasma`. |
| `veil` | A curtain hanging from the horizontal, thinning as it rises, the ground showing through where it is not. | A dark ground worth showing through, and copy that sits in the quiet upper part of the frame. |
| `lacquer` | Liquid polish, slowly flowing: a height field warped twice through itself and lit like a wet surface — a broad light, a tight highlight, a rim where it turns away — the light leaning toward the pointer. The one field with depth: a material, not a gradient. Ported from Lacqué's hero on the jtakeit landing. | Its four colours are the polish, not a ramp: `[lacquer, lacquer lit, the deep it is poured over, the sheen of the highlight]` — the palette's `lacquer` and `lacquer-light`, the gloss look making the other two from them. A heading on the lower left, where it is kept quiet. |
| `ribbons` | Stacked sine curves drawn as lines, not as colour. Canvas 2D, so it is also the field that survives where WebGL does not. | A dark ground, thin type, a design that is already linear. |

Two pairs in that table are close, and knowing which is which is the difference
between choosing and picking. **`smoke` and `flow`** are both warped noise: flow
is a flow field, even everywhere, and it reads as marbling; smoke is warped
twice at a wider scale, so it has a few large plumes and a dark core, and it
reads as volume. **`veil` and `aurora`** are both weather: aurora is centred —
a glow in the middle, a vignette around it, everything pointing inward — while
veil is anchored to the horizontal and thins upward, which leaves the top of the
frame quiet for the copy. If a design cannot say which of a pair it wants, it
does not want either yet.

`ribbons` takes an optional `pointer`, which lets the stack lean toward the
cursor with a lag. It is off by default and it should usually stay off: a
background that follows the mouse is a background being looked at instead of the
words. Where a page's whole idea is the interaction, turn it on.

The set is meant to grow. Adding one is a fragment source plus a row in
`FRAGMENT` — the host, the fallback and every degradation path are already
written. Two things a candidate has to clear:

- **A different job.** Another variation on soft coloured blobs is not a sixth
  option, it is `drift` with different constants. Ask what a design could do
  with it that it could not do with the five.
- **No dependency.** A field that arrives as an npm package is a package in
  every client's bundle, a version to keep, and a look somebody else controls.
  The shaders here are a few hundred lines of GLSL we can read and re-tune; that
  is the whole reason they can be repainted in a client's colours.

A field arriving from elsewhere usually needs both of those checked. Most
published hero shaders are a look plus a fixed palette, and the palette is the
part that has to go: what gets adopted here is the *behaviour* — how it moves,
what it does with a colour ramp — rewired onto `u_colors` and `u_bg` so the
client's palette drives it.

`smoke`, `riso` and `veil` arrived exactly that way, out of the 21st.dev shader
builder. What was kept is three `shade()` functions; what was dropped is three
React components, three WebGL hosts we already had, and three fixed palettes —
one of which was a purple-and-cyan gradient that would have shipped on somebody's
site. Each was then retuned against the field it was closest to, because a
shader that is *nearly* one we already have is worse than not adding it.

### Lacquer, the heavy one

`lacquer` costs more a pixel than the rest — three samples of a twice-warped
fbm — so `HeroField` treats it as heavy (`HEAVY` in `fields.ts`):

- **it is not even compiled until the page has loaded**, then fades in over the
  still ground: the heading, the button and the photograph are the first paint
  and the largest, never the canvas;
- **a smaller budget** (a million pixels, not two) and **a measured quality**:
  frames that run long draw it at fewer pixels, down to a floor that still
  reads as liquid, and back up when there is room;
- **no software renderer**: the context is asked with
  `failIfMajorPerformanceCaveat`, and SwiftShader, llvmpipe or a «software»
  renderer that answers anyway is refused — a frame of it on the CPU costs
  seconds of the page's main thread;
- **its still ground is a picture of the lacquer** — the polish pooled where
  the light would be, on the deep, in the same four colours — not a dark
  rectangle: it is what no WebGL, a software renderer, reduced motion and a
  lost context all end at.

Its light leans toward a mouse or a pen (`pointer`, on unless `pointer={false}`);
a phone gets the still light. Any site uses it with `"field": "lacquer"` in
`jtk/design.json` and the four colours in `colors`; the gloss look's hero
draws it from the palette by itself:

```astro
<HeroField
  field="lacquer"
  colors={['var(--lacquer)', 'var(--lacquer-light)', 'var(--lacquer-deep)', 'var(--lacquer-sheen)']}
  ground="var(--lacquer-deep)"
/>
```

A colour given as `color-mix()` works in every field: a value a 2D context does
not take is resolved by the style engine instead.

A canvas is also not the only way to move a hero. A CSS-only ground — two
`radial-gradient`s on long `@keyframes`, a conic sweep, a grain overlay — costs
no canvas and no JavaScript, and on a page whose hero is mostly a photograph it
is often the better answer. Reach for a field when the motion is the point.

And a field is not the only ground. [surface.md](surface.md) is the still
catalogue — six grounds, painted in the same tokens, with no canvas and no
script — for the rest of the page and for the heroes that should not move. A
page with `field: ""` and no ground is a page nobody finished; the two documents
are read together.

## It is in their colours, or it is somebody else's page

**This is the rule the whole component is built around, and it is enforced
rather than advised.** `colors` and `ground` have no defaults: the page does not
type-check until four colours and a ground have been chosen, and `<HeroField>`
throws during the build if fewer than four arrive. `npm run check` at zero is a
gate every stage already passes through, so a field in nobody's colours cannot
reach a client.

The reason is not tidiness. A shader in its gallery palette — the purple-and-cyan
one, the blue one this kit would have defaulted to — is the single loudest tell
that a page was generated rather than designed, and a default is how it happens
every time: it looks fine, so nobody goes back to change it.

Where the colours come from, in order:

1. **Their photographs.** `PORTRAIT.md` and `BRIEF.md` both have a *Colour and
   material* section written off the client's own feed — the wood of the room,
   the oil, the dough, the polish. That section exists for this.
2. **The variant's tokens**, when those tokens were themselves taken from the
   photographs. `colors={['var(--accent)', …]}` is right in that case and only
   in that case — and it keeps the field following the studio bar's live accent
   picker, since the values are read as CSS custom properties.
3. **Nothing else.** Not the shader's original preset, not a palette that suited
   the last project, not something that looks good in isolation.

What makes a palette work here rather than merely be theirs: one dominant brand
colour, one lighter relative of it, one colour far enough away to give the field
somewhere to travel, and a ground the text can actually sit on. Four tokens that
all sit near each other produce a field nobody notices.

Any CSS colour works, including `color-mix()`: the values are normalised through
a 2D context rather than parsed by hand.

## Every way it fails ends in the same place

No JavaScript, no WebGL, a driver that refuses, `prefers-reduced-motion`, a lost
context, a tab in the background, the hero scrolled off screen — all of them end
at the CSS ground painted from the same four colours, and the page is not
missing anything. **Nothing readable is ever inside the canvas**, which is what
makes that true.

Three consequences worth stating, because each one has cost an afternoon
somewhere:

- **The still ground is a design, not a loading state.** It is what a phone with
  WebGL disabled shows, permanently. Look at it once with JavaScript off before
  the stage ends.
- **Reduced motion means the finished picture, not a missing one.** The field is
  painted once and then left alone — not hidden, not blank.
- **The canvas is decorative**, `aria-hidden`, and never the LCP element. Text
  and the call to action paint from HTML and CSS with no dependency on the
  shader.

## Text on a moving ground

Contrast that holds in the frame you are looking at does not hold in the frame
thirty seconds later — the field moves, and a heading that reads over a light
lamp disappears over a dark one. So:

- **`scrim` whenever text sits on the field.** It lays a gradient of the ground
  colour between the canvas and the content, which costs a little of the effect
  and buys legibility in every frame.
- **Check the worst frame, not the first.** Freeze the field at a few different
  times and read the heading in each.
- **Or keep the text off it** — the field behind, the copy in a panel above it.
  That is the reliable answer for long copy, and the only one for small text.

## A photograph and a field, in the same hero

They can share a hero, and they must not fight over it. The field is the ground;
the photograph sits on it in its own frame with its own edge, and the field goes
quiet where the picture lands — that is what `scrim` and a calmer `field="drift"`
are for. Two loud things in one hero read as neither.

For a business run by one person the photograph is usually the more valuable
half of that pair — see [photos.md](photos.md). A field is the right hero on its
own when there is no usable photograph of the person or the work, which on the
outbound track is common.

## What it costs

- **Fill rate.** A full-screen fragment shader is the whole viewport, every
  frame. The component caps device pixel ratio at 2 and the canvas at ~2M
  pixels, which is what keeps a 3× phone from spending its battery on a
  background nobody is looking at. `ribbons` spends CPU instead of GPU — about
  ten thousand line segments a frame at desktop width — which is cheap enough
  and is the trade that lets it run without WebGL at all.
- **Nothing while it is off screen.** An `IntersectionObserver` and
  `visibilitychange` stop the loop; the elapsed clock stops with it, so scrolling
  back does not jump the animation forward.
- **About 4KB of script**, no dependency, no framework. If a page carries a
  framework for this, something has gone wrong.

