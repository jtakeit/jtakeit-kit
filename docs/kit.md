# The kit

The stack, and the conventions that came out of building a dozen of these. Every
rule here exists because something broke without it.

```
Astro 7, static output           no adapter, no SSR, no server to keep alive
jtakeit builds and serves it     and answers /api/lead and the diary's endpoints beside the site
TypeScript, astro check at zero  errors, warnings and hints
No UI framework by default       React only for an island that earns it
```

Add a framework when a component genuinely needs state across interactions, not
before.

> Sentences below that name `jt-check` refer to the composition check in the
> [jtakeit-sites](https://github.com/jtakeit/skills) Claude Code plugin, which
> this package does not ship. Without the plugin, read each one as a rule to
> hold the page to — by measuring the built page yourself.

## The rules that are not negotiable

**Comments and identifiers are English. User-facing copy is not.** Every
sentence a visitor reads lives in one copy module — `src/copy/<locale>.ts` or
`src/data/content.ts` — and never inside a component. A string in a client
script is passed through a `data-*` attribute, never hardcoded. This is what
makes a round of revisions a series of one-line edits instead of a grep.

**Facts live in `src/data/site.ts`.** Name, address in parts, both forms of the
phone number, email, socials, price range, map link. Rendered from there
everywhere, so the number a visitor reads and the number a phone dials cannot
drift apart, and structured data cannot disagree with the footer.

**The page works with JavaScript off.** Text, photos, layout and navigation are
static HTML. The form posts to its endpoint and gets a plain HTML answer back.
Script adds reveals, in-place submission and niceties — it is never the reason
something is visible. Mark the document scripted before first paint with a
blocking inline `document.documentElement.classList.add('js')`, and hang every
hidden start state on `html.js`, or a no-JS visitor stares at `opacity: 0`
forever.

**One flag controls indexability.** `INDEXABLE` in `src/data/site.ts` feeds the
robots meta tag, `robots.txt` and the sitemap. Three hand-maintained places is
how a site ships still telling Google to go away.

**The host is a build input.** `astro.config.mjs` reads `SITE_URL`;
`src/data/site.ts` reads it back out of `import.meta.env.SITE`. Canonicals, OG
tags and the sitemap then follow whatever host the build was made for, and
there is no second place to forget.

**A collection is added only when it was asked for.** A blog, a portfolio, a
price list — a set of entries the owner keeps adding to — is a standing weekly
obligation on somebody who did not ask for one, and an empty one on a live page
says the business stopped caring. The scaffold declares none, and that is the
right state for almost every site. The bar is a sentence in the brief that names
it; not a vertical it would suit, not room in the design, not "for later". See
[collections.md](collections.md).

**`npm run check` stays at 0 / 0 / 0.** Not "only warnings". The first
tolerated warning is the last useful run of that command.

## Layout

```
src/
  assets/          photos, web scale (long side ≤ 1600px)
  components/      one directory per variant + shared/
    motion/        the hero fields — one canvas, no dependencies
  copy/<locale>.ts every user-facing sentence
  data/site.ts     the business's facts + INDEXABLE
  layouts/         <head>, SEO, the inline pre-paint script
  lib/photos.ts    slot → file, via import.meta.glob
  pages/           routes; robots.txt.ts and sitemap.xml.ts are routes too
  styles/          tokens and globals
jtk/               the catalogue, the content and the design document — the owner's half
public/            favicons, the og image, clips
```

## The pieces

- **The lead form and its endpoint** — [lead-form.md](lead-form.md)
- **Online booking** — [booking.md](booking.md): the
  platform's diary drawn by the page — six addresses, a `BookingForm.astro`
  to copy, and why no free time is ever computed in the repository
- **Photos, and how they are printed** — [photos.md](photos.md)
- **A site in more than one language** — [languages.md](languages.md):
  the address that pairs translations, and the `hreflang` that stops them competing
- **A second page** — [pages.md](pages.md): what one costs,
  why the admin cannot make one, and **why every internal address goes through
  `under()`** — the studio's preview serves this build under `/p/<slug>/`, where
  a link written from the root leaves the site
- **A blog, a portfolio, a price list** — [collections.md](collections.md):
  sets of entries the owner creates and this repository renders
- **The work, shown** — [gallery.md](gallery.md): six
  arrangements for a body of work, the one of them that is allowed to move, and
  how a gallery is fed from content so the owner keeps it rather than us.
- **Their own video, cut into loops** — `<Clip>`, which carries every rule a
  silent autoplaying loop has to meet; the cutting is yours.
- [catalogue.md](catalogue.md) — `jtk/catalogue.json`: what the admin
  may edit, declared in `src/content/blocks.ts` and emitted by `jtk catalogue`.
  Without it a site cannot be attached to the admin at all.
- **The hero's moving ground** — [hero-motion.md](hero-motion.md)
- **Grounds, edges and entrances** — [surface.md](surface.md)
- **The shapes a page can take** — [shapes.md](shapes.md)
- **Design tokens and CSS discipline** — [css.md](css.md)
- **The scaffold, and what the platform holds it to** — [scaffold.md](scaffold.md)

## Motion

Animation is welcome and it is cheap to overdo. Three rules keep it on the right
side, and one component is allowed to be louder than all of them:

- **`prefers-reduced-motion: reduce` is honoured everywhere**, including
  scroll-driven and sprite animations. Reduced motion means the finished state,
  not a broken one.
- **Motion comes from tokens** — `--dur`, `--ease`. A bare `150ms ease` in a new
  component is a drift, not a choice.
- **Nothing moves while it is being *read*.** No carousels that advance past a
  sentence somebody is halfway through. A row that does not fit reflows:
  4 → 2 → 1.

  A wall of photographs is looked at rather than read, and that is the one
  arguable exception — `<Gallery arrangement="wall">` takes it, on three
  conditions written into the component: it stops on hover and on keyboard
  focus, reduced motion gets the whole thing laid out still, and nothing
  readable is inside it. A rail carrying words does not get the same exception,
  because the first condition cannot save it.

- **Anything a script starts is started through `onAlive`** (`src/lib/alive.ts`).
  Not a style rule — a working one. The admin shows the client this site while
  they write, and when they put a gallery into a post it takes the arrangement
  from a specimen page this build made and puts it on the page. Everything
  declarative arrives right; anything a script was meant to do to it does not,
  unless the script can be asked for one subtree. `onAlive` is that shape, and
  it is also what survives a view transition. Where an arrangement genuinely
  cannot be — a script that measures the whole article — say `needs_build: true`
  on the view and the preview will not pretend.

- **Whatever moves forever declares itself.** A component that owns continuous
  motion marks its root `data-motion="<name>"`; `jt-check` counts those regions
  rather than counting animated elements, so a wall of three drifting columns is
  one decision rather than three faults. Two regions is the ceiling — a hero that
  moves and a wall that drifts — and anything moving forever that neither
  declares itself nor can be pressed is the fault the check is for.

**The hero is the first "wow", not the only one.** Below it, the moments are
the ones a visitor *does*: a gallery thrown, turned, scrolled through a lens
(`deck`, `coverflow`, `focus`, `stage`, `morph`, `sphere` in
[gallery.md](gallery.md)), a picture that answers the pointer. Those are not
motion that runs forever — nothing moves until somebody moves it — so the
ceiling above does not count them, and a page with two or three of them, each
doing something different, is a page that feels made. What stays limited is
what moves on its own. A landing gets about a
second to look built rather than assembled, and a field of colour that is
visibly alive buys that second where a still gradient does not.
`src/components/motion/HeroField.astro` is the set — ten fields, nine shaders
and a line field, no dependencies, with every failure path ending at the same
still CSS ground. It is the exception to "restrained", not a licence to animate
the rest.

**Its colours are a required argument, not a default.** The page does not
type-check until four colours and a ground have been chosen for this business,
off their own photographs — a field in a shader's gallery palette is the
loudest tell that a page was generated. Read
[hero-motion.md](hero-motion.md) before using it: the
parts that matter are the palette it is given and the ways it is allowed to
fail.

**Everything below the hero is the surface, and it has three catalogues of its
own** — the ground the page is printed on, the edge a block is drawn with, and
how a block arrives — and, in [photos.md](photos.md), how
its photographs are printed. Six grounds, nine edges, seven entrances, six
treatments, all chosen in `jtk/design.json` and all of which can be *none*:
[surface.md](surface.md). They cost no canvas and no
script, they are painted in the variant's own tokens, and they are the answer to
a page that reads as bare without turning the hero up.

Four of the rules there are measured rather than argued about, because each was
invisible in the window it was built in: a reveal that never fires is content
nobody can read, a reveal above the fold delays the largest paint, more than one
thing moving forever is a demo, and a ground turned up past 1.6:1 against its
paper competes with the text on it. `jt-check` fails all four.

Scroll-driven CSS animation is the good tool here, with two traps learned the
hard way. Time an element at the top of the page against `scroll(root block)`,
not `view()` — a view timeline counts an element already on screen as partly
spent. And measure vertical travel in `vh`, never `%`: the element scrolls away
while it animates, so what is seen is its travel minus the scroll distance, and
a percentage measures against the element's own box, which is a quarter the size
on a phone.

## Not the same page every time

Everything below this line is a floor: things that are wrong on any page,
measured rather than argued about. None of it decides what the page *is*.

That distinction matters more than it sounds, because the examples in a floor
are the thing that gets copied. Measured across three consecutive spec builds
for three unrelated businesses: the same hero markup class for class, the same
stack of full-bleed bands under it, the same serif-display-over-sans pairing.
What actually differed was the palette, the fonts and one bespoke component.

So before writing any of it, choose the shape from
[shapes.md](shapes.md) — one hero anatomy of seven, one page
form of six, one type pairing of six — and record the choice in the state file.
A shape chosen because it was the example printed in this document is how a
studio acquires a house style nobody designed.

## Composition floor

A page is not finished because it looks finished in the window it was built in.
The same faults turn up on every project, none of them visible without
measuring, and all of them cost minutes to check and an afternoon to discover
late.

**The first screen holds the whole hero, the one action included.** Eyebrow,
heading, lead and the button that does the thing all land inside the viewport on
a short laptop — 1280×800, which is most of them — as much as on a phone. A call
to action half a thumb below the fold is a call to action that does not exist,
and it is the commonest defect in a page that "looked fine on my monitor". The
photograph is the part that gives way: measure the frame against the viewport and
let the picture crop into it, rather than padding by feel and hoping it lands.

```css
/* One anatomy of six — the split hero, text beside media. It is written out
   here because it is the one where the measuring is hardest to get right, NOT
   because it is the one to build. Three consecutive spec builds shipped this
   exact markup with different colours on it; the other five anatomies are in
   references/shapes.md and one of them is probably the right answer. */
.hero {
  min-block-size: calc(100svh - 4rem);
  align-items: center;
}
/* The frame is measured; the picture crops into it and still fills its column. */
.hero__media :global(.shot) { block-size: 30svh; }
.hero__media :global(.shot img) { block-size: 100%; object-fit: cover; }
```

Note what the second rule is for: give the frame an `aspect-ratio` instead and
capping its height shrinks its *width* too, so the photograph stops filling its
column and sits there looking accidentally small.

The same measuring, in an anatomy that is not the split — a full-bleed
photograph with the words on it:

```css
.hero { display: grid; min-block-size: 100svh; }
/* Both in the same cell: the picture fills the screen, the words sit over it. */
.hero > * { grid-area: 1 / 1; }
.hero :global(.shot img) { block-size: 100%; object-fit: cover; }
/* Contrast that holds over every part of the photograph, not just this part. */
.hero__scrim { background: linear-gradient(to right, #0009 0 45%, transparent 75%); }
```

and one that has no photograph in the first screen at all, where the type is the
picture and the measuring is all in the type scale:

```css
.hero { display: grid; align-content: center; min-block-size: 88svh; }
.hero h1 { font-size: clamp(2.5rem, 1rem + 7vw, 8rem); text-wrap: balance; }
```

**A photograph is cropped by its frame, never squeezed into it.** The frame is
chosen from the picture's own proportions rather than the other way round —
`shape()` before `<Shot>`, and `focus` where a face is involved. A stretched
photograph is the one image fault a client always notices and never has words
for, and it is measured rather than eyeballed. See
[photos.md](photos.md).

**The other end of the range is a 27-inch monitor, and it is the one nobody
opens.** Every rule above is about fitting into a screen that is too small; this
is the opposite fault and it ships more often, because the page is built at 1440
and never widened. Measured on a real build at 2560×1440: the content spanned
**38% of the width**, the full-height hero was **78% empty**, and the headline
was 48px — exactly what it had been on a laptop.

The principle is that **on a big screen the design gets bigger, it does not get
more centred.** Space is not a layout. Four patterns do nearly all of it:

```css
/* 1. The shell grows with the screen; the measure does not. A 1200px cap is
      47% of a 2560px monitor, and everything inside it looks stranded. */
.shell  { inline-size: min(92rem, 92vw); margin-inline: auto; }
.text > * { max-inline-size: 34rem; }        /* ~65ch, so lines stay readable */

/* 2. Type scales, with a ceiling. A vw term alone is unbounded; clamp() gives
      it a floor and a cap and is the whole answer for headings. */
h1   { font-size: clamp(2.25rem, 1.2rem + 3.4vw, 5rem); }
.lead { font-size: clamp(1rem, 0.9rem + 0.5vw, 1.5rem); }

/* 2a. A screen-tall section has a ceiling too. The panel draws the page in a
       frame as tall as the document, where 100svh is all of it — a first
       screen of min-height: 100svh filled the whole thumbnail. `jtk catalogue`
       refuses one with no ceiling. */
.hero { min-block-size: min(100svh, 56rem); }

/* 3. Media is a fraction of its column, never a fixed card. A 240px photograph
      on a 2560px screen is a stamp. */
.hero__media :global(.shot) { inline-size: min(100%, 32rem); }

/* 4. Where there is genuinely nothing more to show, stop claiming the screen:
      a band that is 80% empty is worse than a band that ends. */
.hero { min-block-size: min(100svh, 56rem); }
```

Gaps and padding scale the same way — `gap: clamp(2rem, 4vw, 6rem)` — so the
composition breathes with the window instead of holding a 1440px pose inside a
2560px frame.

**And it is every band, not only the hero.** Two faults, both measured at 1920:

- **A lopsided band** — content against one edge and a void beside it. Nobody
  chooses that; it is a two-column grid whose second column ended up empty, or a
  row that stopped short. Measured on a real build: 814px of air on one side of
  a section and 336 on the other.
- **A form floating in a third of the screen.** A column of prose may be narrow —
  that is what a measure is for, and a long block of questions reads as a
  document — but the contact band is the block the whole page exists to deliver
  somebody to, and a 600px form centred in 1920px of colour with two thirds of
  the screen empty reads as a page that ran out of ideas. Measured on a real
  build: 31%. Give it something to stand beside — the contact details, a
  photograph, the questions — or let the fields use the width.

```css
/* The form band, using the space it is in. */
.contact__inner {
  display: grid;
  gap: clamp(2rem, 4vw, 5rem);
  grid-template-columns: 1fr;
}
@media (min-width: 60rem) {
  /* Form beside something that belongs next to it, not beside nothing. */
  .contact__inner { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
}
```

`jt-check` measures the hero at 2560×1440 — how much of the width its ink spans,
how much of a full-height hero is empty, whether the headline grew at all — and
every band at 1920 for the two faults above.

**Measure in `svh`, never `vh`.** On a phone `100vh` is taller than the screen —
it counts the space the browser chrome is currently occupying. The difference is
about the height of a button, which is why the button is the thing that falls
off.

**No orphans, and do not fix them by counting.** A row that leaves one chip
alone on its last line reads as a mistake rather than a rhythm, and a heading
whose last line is one word reads as a typo.

The tempting fix — drop an item, tighten the gap, shorten a label — is
whack-a-mole: free wrap packs by measured width, so removing the ninth chip
moves the orphan from 1440px to 1280px and it returns the first time a label
gets longer. Free wrap is the wrong tool for a set whose shape matters. Use
fixed columns that reflow instead — the same `4 → 2 → 1` the Motion section asks
of every row — and keep the set even, so it divides exactly at every width:

```css
.chips { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.chip  { justify-self: start; }              /* pills keep their own width */
@media (min-width: 60rem) { .chips { grid-template-columns: repeat(4, 1fr); } }
```

Centring the row is the fallback when the set genuinely cannot be made even: a
short last line reads as deliberate when it is centred and as a bug when it is
flush left. For prose, `text-wrap: balance` on headings and `pretty` on body
copy.

**In-page links scroll, they do not jump, and they land on content.** A bare
`href="#work"` teleports, which on a long page reads as a reload; and the
target's border box going to the top of the screen means arriving at a section's
top padding, with the heading still below the fold. `scroll-behavior: smooth`
belongs on `html` under `prefers-reduced-motion: no-preference`, and every
anchor target sets its own `scroll-margin-block-start` — positive to keep air
above a panel whose edge is drawn, negative to pull past padding that carries no
meaning:

```css
#work    { scroll-margin-block-start: calc(2.5rem - var(--band)); }
#contact { scroll-margin-block-start: 2rem; }
```

Check it by clicking, not by reading the CSS: what has to be on screen after the
scroll settles is the heading the link promised.

None of this is a matter of taste, so do not settle it by looking. Ask the page,
with the dev server running:

```js
const { chromium } = require('playwright');
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [1280, 800], [393, 852]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  const m = await p.evaluate(() => ({
    vh: innerHeight,
    hero: Math.round(document.querySelector('.hero').getBoundingClientRect().bottom),
    cta: Math.round(document.querySelector('.hero .btn').getBoundingClientRect().bottom),
    orphans: [...document.querySelectorAll('[data-row]')].filter((row) => {
      const tops = [...row.children].map((c) => Math.round(c.getBoundingClientRect().top));
      const perLine = [...new Set(tops)].map((t) => tops.filter((x) => x === t).length);
      // One item alone on the last line is only an orphan when the other lines
      // hold more. A single-column list is a list, not a broken row — miss that
      // and the check cries wolf at every narrow width.
      return perLine.length > 1 && perLine.at(-1) === 1 && Math.max(...perLine) > 1;
    }).length,
  }));
  console.log(`${w}×${h}`,
    m.hero <= m.vh ? 'hero fits' : `HERO OVERFLOWS ${m.hero - m.vh}px`,
    m.cta <= m.vh ? 'cta visible' : 'CTA BELOW THE FOLD',
    m.orphans ? `ORPHAN in ${m.orphans} row(s)` : '');
  await p.close();
}
await b.close();
```

Three viewports catch the hero. Orphans need a sweep — they appear at widths
nobody thinks to open, so step the width from 320 to 1600 in twenties and let the
same check run at each. Mark the rows you want watched with `data-row` and this
stays honest as the copy changes — an orphan is created by a longer word, not by a code change, so it
comes back on its own after a round of revisions.

**Screenshotting a page with scroll reveals needs a walk, not a jump.** Scroll
straight to the bottom and back and the `IntersectionObserver` never sees the
middle of the page: the full-page screenshot then shows empty bands, and half an
hour goes into debugging a layout that was never broken. Step down half a
viewport at a time with a pause, then shoot.

## Performance

- Images through `astro:assets`, never a raw `<img src="/photo.jpg">` out of
  `public/`. Keep `src/assets/` at web scale — Astro emits the source file
  alongside the generated webp variants, so a 26MB PNG ships 26MB whether or not
  a browser requests it.
- The first contentful image gets `eager` / `fetchpriority="high"`. Everything
  else is lazy.
- Two webfont families at most, and preconnect to the font host. A third family
  is nearly always the reason mobile Lighthouse is at 84.
- No client JS on a page that does not need it. Islands are `client:visible`,
  not `client:load`.
- Target: Lighthouse ≥ 95 desktop, ≥ 90 mobile, measured on the deployed site.

## Accessibility floor

Not a feature, a floor. Visible keyboard focus. Real alt text, not file names —
a photo with no alt is announced by its filename, and these sites are mostly
photographs. Skip link to the main content. Colour contrast checked for the
token that carries text, which is usually a step darker than the one that fills
a button; a component that puts words on the fill token is a contrast bug.
`<html lang>` set from the locale.

## The loop

```bash
npm run dev                       # http://localhost:4321
npm run check                     # 0 errors / 0 warnings / 0 hints
npm run build
npx @jtakeit/astro catalogue      # jtk/catalogue.json, checked against dist/ both ways
```

The form posts to `/api/lead`, which the platform serves beside the site: locally
it answers 404, and that is not the form being broken. It works on the platform's
preview the moment the site is attached and built.

`npm run check` says the code is sound; it says nothing about whether the page
composes — the first screen at 1440, 1280 and 393, orphans swept from 320 to
1600, anchors landing on their headings, placeholder frames, alt text, stretched
photographs, the page with JavaScript switched off. The sections above are the
rules; measure the built page against them before anybody is asked to look.
