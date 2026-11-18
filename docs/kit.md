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

**Facts live in the shared text.** On contract 3 the business's name, address in
parts, phone, email, map link and profiles are the `contacts` block of
`jtk/shared.json`, each field with its `role`, which the owner corrects in the
panel; the layout reads them by role (`site.facts(locale)`) for the head, the
structured data, the header, the footer and the imprint, and `src/data/site.ts`
only where a role is empty (contract 2 reads every fact from there). One place,
so the number a visitor reads and the number a phone dials cannot drift apart,
and the structured data cannot disagree with the footer.

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
says the business stopped caring. The example site declares two, `services` and
`team`, and the brief decides which stay (`npx @jtakeit/astro remove team`);
beyond them the bar is a sentence in the brief that names it; not a vertical it
would suit, not room in the design, not "for later". See
[collections.md](collections.md) and [units.md](units.md).

**Everything a page draws answers a tap** (jtakeit-core wiki/111 §3.1). A value
the owner edits is annotated where it is drawn, whatever its kind — a phone, an
email, a choice, a date, a time and a number as well as words and pictures —
with the door's `{...x.at('field')}`. `no_tap_target` means *not drawn as an
element* (a link behind a button, the hour a countdown counts to), never "drawn,
but not tappable here". Values drawn side by side are separate spans — «8000»
and «Zürich», each with its `at()` — and an element drawn from several values,
or worked out from them, names where they live with the door's `from()`:
`{...facts.from()}` on the address card (`shared:blocks[contacts]`),
`{...hours.from()}` on «Open now», `site.settings('bookings').from()` on the
booking form, `entry.from()` on a tile of an entry. A tap on it opens that
source. Design text stays `data-jtk-fixed`; inside a `from()` region a tap on it
opens the region's source. `jtkit lint` says what the platform's lint says, in
its codes: a number, a time, a choice, a phone, an email, a link or a date drawn
without its annotation is advice, `JTK_W_UNANNOTATED_FIELD`; a value the owner
edits drawn as text nothing claims is advice, `JTK_W_DRAWN_UNTAPPABLE`; a
`data-jtk-from` outside its grammar (`blocks[<key>]`, `shared:blocks[<key>]`,
`page:<id>[:blocks[<key>]]`, `entry:<id>[:blocks[<key>]]`, `module:<name>`) or
naming nothing the site has is refused, `JTK_E_ANNOTATION_UNKNOWN`.

**`npm run check` stays at 0 / 0 / 0.** Not "only warnings". The first
tolerated warning is the last useful run of that command.

## The floor

How a site is built, never what it looks like (jtakeit-core wiki/115 §2). It
is the same on every site and in both looks the scaffold lays out — Brumy's
and the bare one — and it never makes two sites alike: each item is something
a visitor feels whatever the design. A design changes the values in its own
tokens; the names stay, because the template's pieces and the kit's checks
read them. Nothing here refuses a build: `jtk schema` (and `jtk catalogue`)
say what they find after the build as advice, `~ JTK_LOCAL`, and count it
nowhere.

| token / rule | what it is for, and why |
| --- | --- |
| `--screen` | **The screen's height.** Set from `innerHeight` before the first paint by an inline script in `Layout.astro`, changed only when the width does (a turned phone); `100svh` in `global.css` for a page without scripts. The browsers inside Telegram, Instagram and WhatsApp — where most of a small business's visitors arrive from — slide their bar away under a scrolling thumb and back, and `vh`, `svh` and `dvh` all follow it there: every hero and band sized by the screen squeezes and stretches while the page only scrolls. Write `min(var(--screen), 56rem)`, `calc(var(--screen) * 0.7)`; never a viewport unit in a height. *Advised:* a `height`, `min-height`, `max-height` or `block-size` in `vh`, `svh` or `dvh` under `src/`, with the line and the expression to write instead. |
| own faces, preloaded, with measured stand-ins | **The type does not jump.** The faces are the site's own files (an `@fontsource` package or a woff2 under `src/`), never Google's servers — a font fetched from there hands the visitor's address to a third party before anybody asked (LG München I, 20 January 2022) and makes the first screen wait on another host. The one or two faces the first screen shows are preloaded (`Look.astro`). And each face has a **stand-in**: a system face set to its proportions with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`, named after it in the stack (`'Inter', 'Inter Fallback', sans-serif`), so the text is laid out at the webfont's size from the first frame and the swap moves nothing. `npx @jtakeit/astro fonts <file.woff2>…` measures them — variable woff2 too, at `--weight` (400 where the face has it), against Arial, Helvetica, Georgia, Times New Roman or Courier New by the face's kind or `--fallback` — and prints the `@font-face` to paste. *Advised:* a family named first in a stack that no `@font-face` provides (the page is drawn in the next face for every visitor — Brumy's own site named Instrument Sans and never loaded it), a face from a third party's host, own faces with no preload, or with no stand-in. |
| `.num`, and the kit's own | **Numbers line up.** `font-variant-numeric: lining-nums tabular-nums` wherever money, times and durations are drawn: a column of prices aligns on its last digit, a list of times stands in columns, a total that changes does not shake the line. The booking form (the kit's `booking.css` and the scaffold's `BookingForm.astro`), the opening hours, the price list's terms, a listing's lengths and prices, an entry's facts and the shop's prices and sums carry it already; `.num` is for what a design adds. |
| `--measure-read`, `--measure-object`, full bleed | **Three measures.** The reading measure is how long a line of text may get — text and photographs on paper — and does not grow with the screen. The object measure is a filled surface — a calendar, a form, a card, a price list — wider, one width with the header's capsule. Full bleed is screen edge to screen edge, for the beginning and the end of a page. `--measure` stays, as the reading measure's old name. The template's pieces that draw a surface take a `surface` — `paper`, `filled` or `bleed` (`src/lib/measure.ts`) — and write `data-measure="read|object|full"`, which `global.css` caps: `BookingForm`, `LeadForm` and the example's price list are `filled` by default, `OpeningHours` is `paper`. A composition of a site's own does the same with the attribute. |
| `--radius`, `--r-1` … `--r-4`, `--r-pill`, `.r-nested` | **One radius family.** One base, the steps derived from it with `calc` — `--r-1` half of it, `--r-2` the base, `--r-3` 1.75×, `--r-4` 2.75× — and the pill; a circle is `50%`, a shape and not a step. A design that wants squarer or softer corners changes `--radius` and every corner follows in proportion (the bare look holds every step at its one 4px). A corner inside a corner is the outer one less the padding between them, or the inner one looks fatter: put `--r-outer` and `--pad` on the outer element and `.r-nested` on the inner. No literal radius in a component. |
| rows on a phone | **Phones by rule** — in [compositions.md](compositions.md), «Phones». |

The same floor is under a site that is not laid out by `jtk create`: the
tokens are `global.css`'s, the script is `Layout.astro`'s, and the advice
reads any site's `src/` and build.

## Layout

```
src/
  assets/          photos, web scale (long side ≤ 1600px)
  components/      one directory per variant + shared/
    motion/        the hero fields — one canvas, no dependencies
  copy/<locale>.ts every user-facing sentence
  data/site.ts     the business's facts where the shared text says none + INDEXABLE
  layouts/         <head>, SEO, the inline pre-paint script
  lib/site.ts      the content, read through the kit's door (@jtakeit/kit/content)
  lib/pages.ts     every page the sitemap and llms.txt list
  lib/photos.ts    slot → file, via import.meta.glob
  pages/           routes; robots.txt.ts and sitemap.xml.ts are routes too
  styles/          tokens and globals
jtk/               the schema, the content and the design document — the owner's half
public/            favicons, the og image, clips
```

## The pieces

- **The lead form and its endpoint** — [lead-form.md](lead-form.md)
- **Online booking** — [booking.md](booking.md): the
  platform's diary drawn by the page — six addresses, a `BookingForm.astro`
  to copy, and why no free time is ever computed in the repository
- **A shop** — [shop.md](shop.md): the platform's shop on the page — four
  addresses, five components to copy (a product, the cart, the checkout, the
  page after payment, a listing), `jtk add shop` and `jtk import products`, and
  why no price is ever worked out in the repository
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
- [catalogue.md](catalogue.md) — what the admin may edit, declared in
  `src/content/blocks.ts`: on contract 3, a new site's, emitted into
  `jtk/schema.json` by `jtk schema`; on contract 2, into `jtk/catalogue.json`
  by `jtk catalogue`. Without it a site cannot be attached to the admin at all.
- **The hero's moving ground** — [hero-motion.md](hero-motion.md)
- **Grounds, edges and entrances** — [surface.md](surface.md)
- **The shapes a page can take** — [shapes.md](shapes.md)
- **Design tokens and CSS discipline** — [css.md](css.md)
- **The scaffold, and what the platform holds it to** — [scaffold.md](scaffold.md)
- **Which look: Brumy's, or bare for a custom design** — [looks.md](looks.md)

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

**The axes: what this site chose, written down.** Every site makes the same
dozen choices — what the first screen is, its ground and pacing, how wide its
text and its objects are, its corners, its header — and the floor above is the
same everywhere precisely so that these are where sites differ (jtakeit-core
wiki/115 §3). `jtk/design.json` records them as `axes`, one string a key,
empty until the design is decided, beside the palette and the surface; the
site critic and, later, the platform read them, and every kit tool that
rewrites the file keeps them. The keys:

| key | the choice |
| --- | --- |
| `hero` | the first screen's anatomy — a portrait dissolving into the words, a split, type over their own film, a live object… |
| `ground` | the ground and the pacing — all light, light with one dark band, a dark room |
| `measures` | the reading and object measures, and why (how many objects the business has) |
| `shape` | the corners — square, small, a scale, soft; pills or not — from the material |
| `header` | strip → capsule, a floating capsule, a strip that hides, the wordmark only |
| `phone_menu` | the menu on a phone — a full-screen wipe, a circle from the button, a card, a popover |
| `overlap` | what crosses an edge — a sheet over the hero's foot, a card over the photograph, none |
| `surfaces` | the materials, from their photographs or their place |
| `mark` | the client's own sign, drawn — always theirs, never compared |
| `motion` | how things move, and how many regions always do |
| `fonts` | the pair — serif + serif, serif + sans, grotesk + grotesk… |
| `hook` | the one question a visitor arrives with, answered on the page |
| `proof` | what the business must prove, and how it does |
| `contact` | who answers, and the one action |

A value is free text — the variant's name and the site it came from, or a new
one's description. The catalogue of variants per axis, each with the site it
came from and when to choose it, is not here: it is the jtakeit-sites skills'
reference (read by `spec` and `variants`) and the platform's design guide
over MCP, for an agent with no skills.

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
  min-block-size: calc(var(--screen) - 4rem);
  align-items: center;
}
/* The frame is measured; the picture crops into it and still fills its column. */
.hero__media :global(.shot) { block-size: calc(var(--screen) * 0.3); }
.hero__media :global(.shot img) { block-size: 100%; object-fit: cover; }
```

Note what the second rule is for: give the frame an `aspect-ratio` instead and
capping its height shrinks its *width* too, so the photograph stops filling its
column and sits there looking accidentally small.

The same measuring, in an anatomy that is not the split — a full-bleed
photograph with the words on it:

```css
.hero { display: grid; min-block-size: min(var(--screen), 56rem); }
/* Both in the same cell: the picture fills the screen, the words sit over it. */
.hero > * { grid-area: 1 / 1; }
.hero :global(.shot img) { block-size: 100%; object-fit: cover; }
/* Contrast that holds over every part of the photograph, not just this part. */
.hero__scrim { background: linear-gradient(to right, #0009 0 45%, transparent 75%); }
```

and one that has no photograph in the first screen at all, where the type is the
picture and the measuring is all in the type scale:

```css
.hero { display: grid; align-content: center; min-block-size: min(calc(var(--screen) * 0.88), 52rem); }
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
.text > * { max-inline-size: var(--measure-read); }   /* ~65ch, so lines stay readable */

/* 2. Type scales, with a ceiling. A vw term alone is unbounded; clamp() gives
      it a floor and a cap and is the whole answer for headings. */
h1   { font-size: clamp(2.25rem, 1.2rem + 3.4vw, 5rem); }
.lead { font-size: clamp(1rem, 0.9rem + 0.5vw, 1.5rem); }

/* 2a. A screen-tall section has a ceiling too. The panel draws the page in a
       frame as tall as the document, where the screen is all of it — a first
       screen of min-height: 100svh filled the whole thumbnail. `jtk schema`
       refuses one with no ceiling. */
.hero { min-block-size: min(var(--screen), 56rem); }

/* 3. Media is a fraction of its column, never a fixed card. A 240px photograph
      on a 2560px screen is a stamp. */
.hero__media :global(.shot) { inline-size: min(100%, 32rem); }

/* 4. Where there is genuinely nothing more to show, stop claiming the screen:
      a band that is 80% empty is worse than a band that ends. */
.hero { min-block-size: min(var(--screen), 56rem); }
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

**Measure the screen with `var(--screen)`, never a viewport unit.** On a phone
`100vh` is taller than the screen — it counts the space the browser chrome is
currently occupying, about the height of a button, which is why the button is the
thing that falls off. `svh` fixes that in Safari and Chrome and not in the
browsers inside Telegram, Instagram and WhatsApp, which move it as their bar
slides; `--screen` holds still in all of them («The floor», above).

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
npx @jtakeit/astro schema         # jtk/schema.json, checked against dist/ both ways
                                  # (a contract-2 site: npx @jtakeit/astro catalogue)
```

The form posts to `/api/lead`, which the platform serves beside the site: locally
it answers 404, and that is not the form being broken. It works on the platform's
preview the moment the site is attached and built.

`npm run check` says the code is sound; it says nothing about whether the page
composes — the first screen at 1440, 1280 and 393, orphans swept from 320 to
1600, anchors landing on their headings, placeholder frames, alt text, stretched
photographs, the page with JavaScript switched off. The sections above are the
rules; measure the built page against them before anybody is asked to look.
