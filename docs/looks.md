# Looks — which one a site is laid out in

`jtk create` lays out one site — the same sections, collections, pages,
shared text, booking, shop and lead behaviour, accessibility, live render,
door and schema — in one of three looks:

```bash
npx @jtakeit/astro create <slug> --name "The Business"                 # brumy, the default
npx @jtakeit/astro create <slug> --name "The Business" --look bare     # no art direction
npx @jtakeit/astro create <slug> --name "The Business" --look gloss    # the booking page's
```

| look | what it is | when |
| --- | --- | --- |
| `brumy` | The example in the design system of Brumy (brumy.ch), the company that makes jtakeit: its palette, its three typefaces, the glass, the pill button, the light across the hero's heading, the wordmark at the foot. | The developer is happy to start from Brumy's design: kept, or adapted by its tokens (`src/styles/tokens.css`, [scaffold.md](scaffold.md)). |
| `bare` | The same site with no design: the system's own type, a few neutral colours, one radius, the focus ring, plain sections in the document's order. | **A custom design** — from the business's own site, its brand, or references the person gave. |
| `gloss` | The booking page's ([booking-page.md](booking-page.md)): a porcelain page, Fraunces over Inter, the hero in liquid lacquer (`field: "lacquer"`) with the best photograph in an arch, cards for the services, a wall of the work with a lightbox, every block arriving from a visible rest (`float`). Its colours are the palette, below. Seeded from Lacqué (wiki/117 §3, «a gloss look»). | A specialist's page from Instagram — `--kind booking-page` lays it by default — or a site that wants that feel. It draws the hero, the services, the gallery, the contact, the header and the type; any other section is Brumy's structure in its colours. |

`jtk/design.json` says which (`"look": "brumy"` or `"look": "bare"`), and
`jtk add` lays a section or a module in the look the site says. Once the
design is the site's own, say so: `"look": "custom"`. A section `jtk add`
lays on it comes in the bare look's structure, to be dressed in the site's
design, never in Brumy's; any word the kit does not know is taken the same way.

## A custom design starts on `bare`, never on Brumy's

A design of the site's own is not Brumy's look recoloured. New colours in
`tokens.css` leave Brumy's typefaces, its glass, its button, its hero and its
footer where they were — the page is still Brumy's, and the person who asked
for their own design is shown a template. `jtk/design.json` records the look
a site was laid out in, so a site called custom that still wears the
template's design can be told apart.

So when the brief says the design is the business's — «like our current
site», «in our brand», «something like these» — lay the site out with
`--look bare`. There is nothing in it to recolour: every decision is still to
be made, and it is yours.

## What `bare` gives

Everything the example has that is not a design decision:

- the example's sections — hero, values, services and prices, gallery, team,
  testimonials, questions, the form with the address and the hours — and
  `/services`, privacy, the imprint, a header and a footer;
- every word and photograph the example's, in the site's language and the
  translation beside it, every value annotated and tapped in the panel;
- the template's behaviour unchanged: the lead form, the booking form, the
  shop's components (`jtk add shop`), «open now» on the business's clock, the
  language switch, the live render, the schema and the door;
- WCAG 2.1 AA as the kit's own check reads it (`npx @jtakeit/astro a11y`).

And nothing that is one:

- no typeface: `system-ui`, no `@fontsource` import (the scaffold's three
  packages stay installed, unused, so the lockfile is the platform's);
- `src/styles/tokens.css` — white paper, near-black ink, one grey line, a
  near-black button, one radius (`--radius`), the focus ring (`--focus`),
  plain sizes and spacing;
- `src/styles/look.css` — the body, the headings, `.section`, `.button`,
  `.label`, and nothing else;
- no hero field, ground, edge, entrance, gallery arrangement or treatment
  ([hero-motion.md](hero-motion.md), [surface.md](surface.md),
  [gallery.md](gallery.md), [photos.md](photos.md)): the gallery is a grid of
  the pictures, the hero its words over its photograph.

The files a look draws differently are its own; the rest is the example's,
the same in both:

| the look's own | the same in every look |
| --- | --- |
| `src/styles/tokens.css`, `look.css` | `src/content/blocks.ts`, `src/components/sections/index.ts` |
| `src/components/site/Look.astro`, `Header.astro`, `Footer.astro`, `Button.astro` | `src/components/site/Hours.astro`, `Label.astro`, `Page.astro`, `words.ts` |
| every section in `src/components/sections/` | the imprint, the shop's components and pages, every template component |

## The palette

A site's colours are in one place: `palette` in `jtk/design.json`, eight
names — the palette widget's (`choose_palette`), in its order — a six-digit
hex each. Layout.astro writes them on `<html>` as the look's tokens — every
look's components read the same tokens — so writing that one object
recolours the whole site, the hero's lacquer included; an empty value keeps
the look's own token.

```json
"palette": {
  "bg": "#faf6f3",
  "surface": "#ffffff",
  "ink": "#1c1215",
  "muted": "#6b5a5f",
  "accent": "#7d0f24",
  "accentInk": "#ffffff",
  "lacquerA": "#750b1f",
  "lacquerB": "#c23a52"
}
```

| name | what it colours | the token |
| --- | --- | --- |
| `bg` | the page | `--paper` |
| `surface` | a card, the booking form, the header's capsule | `--panel`, `--paper-lift`, `--surface` |
| `ink` | the words — 7:1 or more on `bg` | `--ink` |
| `muted` | the quieter words: a line under a heading, a length, a label | `--ink-quiet` |
| `accent` | the button that books, every filled control, the one colour | `--accent`, `--accent-deep` |
| `accentInk` | the words on the accent — 4.5:1 or more on it | `--on-accent`, `--on-accent-deep` |
| `lacquerA` | the hero's liquid lacquer, its body in shadow | `--lacquer` |
| `lacquerB` | the same lacquer where the light lands | `--lacquer-light` |

Made from them, not written: the accent as words on the page — a price, a
link — from `accent` and `ink` (`--accent-ink`); the lines and the recessed
ground from `bg` and `ink`; the lacquer's deep and its sheen from the lacquer
pair (`--lacquer-deep`, `--lacquer-sheen` in the gloss look's tokens). Without
`accentInk` the words on the accent are chosen by its lightness.

**A dark palette.** Which way up the page is comes from `bg` alone
(`src/lib/ground.mjs`): dark where near-white words read further from it than
near-black ones. A dark palette's page says so — `data-ground="dark"` on
`<html>` — so every glass a look draws is its dark one, and the header's glass
and words are made from the palette (`--bar-glass`, `--bar-solid`,
`--bar-ink`, `--bar-ink-quiet`): a light glass under dark words, or a dark one
under light words, the palette's `ink` and `muted` where they read at 4.5:1 on
it over whatever passes behind, near-black or near-white where they do not.
The booking card, its chips and the posts' handle are `surface` under `ink`
and `muted`, and a filled control the accent under `accentInk`: a palette
holds each of those pairs at 4.5:1 (the kit's ten do, and the test says so).

**«Use the palette».** The widget's message names the eight with their values —
«Use the palette "Blush": bg #f7ece9, surface #fffaf8, ink #2a1215, muted
#6e4f52, accent #8e1b2c, accentInk #ffffff, lacquerA #b0243a, lacquerB
#f2b8c0» — and the agent writes them into `jtk/design.json`'s `palette`, name
for name, value for value: one file, no component, the rest of the document
as it was. Without a terminal that is one `write_files` of `jtk/design.json`,
then a build. The older `paper`, `ink` and `accent` beside it still work, and
the palette wins over them where both say; a palette written in the CSS-minded
names (`background`, `accent-ink`, `lacquer`, `lacquer-light`) is read as the
same, but the eight above are the ones to write.

A booking page starts from its vertical's palette — nails, hair, barber,
lashes, massage, cosmetology, tattoo, coach, trainer, therapist
(`lib/units/palettes.mjs`) — a starting point for the trade, to be replaced
by the business's own colours.

## A trade's photographs

The example's seventeen photographs of the hero, the gallery, the services and
the team come in a set per trade, generated for jtakeit in one neutral style
(jtakeit-core wiki/117): `sessions` (a yoga and pilates studio), `nails`,
`hair`, `barber`, `clinic` (a dental and medical practice), `lawyers` and
`sport` (a strength gym). `jtk create` takes one by `--photos <set>`; without
it the `--vertical` chooses — nails, manicure; hair, hairdresser, salon;
barber, barbershop; clinic, dental, dentist, medical, practice; law, lawyer,
legal, notary; sport, gym, fitness, training, crossfit; yoga, pilates, studio,
sessions — then the `--kit`'s kind (sessions, clinic; salon is hair).
`--photos default` keeps the example's own, which a trade with no set gets too.

The set is the site's: `jtk/design.json` says it (`photo_set`), and `jtk add`
lays a section's photographs from the same set. The files are not in the
package: they are fetched once from the platform's media host
(`JTK_MEDIA_URL`; else the site's `jtk/site.json` `media_base`; else the one
beside `--api`, so staging's on staging; else production's) into `~/.cache/jtakeit/examples`,
checked against their hash; `JTK_EXAMPLES_DIR` names a directory of them
instead. Where a set cannot be had — offline, say — the site is laid out with
the example's own and that is said, never a failed create.

They are placeholders, as every example photograph is: the fingerprints know
them (`example/prints.json`), `still_to_do` and the launch name them until the
business's own replace them, in either look.

## The design is yours: DESIGN.md first

`bare` is a base, not a direction. Before a line of CSS:

1. **Read the sources.** The business's current site, its brand, the
   references the person sent — screenshots, not adjectives. What its
   colours, its type, its photographs and its tone of voice are.
2. **Write `DESIGN.md`** at the root of the site: the palette (with which
   colour is a fill and which carries words — [css.md](css.md)), the type
   pairing and its scale, the spacing, the radius, the hero's shape
   ([shapes.md](shapes.md)), and for each section the composition it gets
   ([compositions.md](compositions.md)) and the one that carries the page's
   signature. Say where each choice comes from. Choose on every axis of the
   platform's design guide (docs.jtakeit.com/guides/design — the hero, the
   ground, the shape, the overlap, the surfaces, **the mark**: a motif from the
   business's own material repeated in the interface…) and write them under
   `axes` in `jtk/design.json`; a custom design with fewer than ten, or no
   mark, is said by the build (`JTK_W_DESIGN_AXES`). Show it to the developer.
3. **Set the tokens** in `src/styles/tokens.css` and the fonts in
   `src/components/site/Look.astro` (self-hosted, `@fontsource`); write
   `paper`, `ink` and `accent` into `jtk/design.json`.
4. **Compose the sections** — rewrite each component in
   `src/components/sections/` as DESIGN.md says, from the skeletons in
   [compositions.md](compositions.md); the header and the footer in
   `src/components/site/`. Keep what the components do: every
   `{...block.at(…)}` annotation, the anchors, `<LeadForm />`, `<Hours />`,
   `rowId`, the `first`/`contact` props. `jtk schema --dist dist` and
   `jtkit lint` say when a value is no longer drawn or annotated.
5. **Read it** as a visitor and as `npx @jtakeit/astro a11y` does, on a phone
   and wide, before calling it done — and as a demanding designer would: could
   it be any other business's site? The first screen answers (the floor's F8):
   the heading and the one action on a phone's 390 × 844 and a desktop's
   1280 × 800 — `preflight` measures it (`JTK_W_FIRST_SCREEN`).

**Directions to choose from.** To show the person two or three designs before
one is built, declare them in `jtk/design.json` — `"directions": [{"key": "a",
"name": "…", "axes": {…}}, …]`, the first the default — and style the others
under `html[data-direction='b']`. The platform writes the attribute for a page
asked as `?direction=b` by somebody who may see the site, and the previews offer
the directions by name; never a switch of the site's own. Two directions differ
on at least three axes, the hero among them (`JTK_W_DIRECTIONS_ALIKE`). Once
one is chosen, its styles become the site's own and `directions` goes.

**What a model reaches for**, to stay away from unless the business's material
asks for one by name: Fraunces, Playfair or Cormorant over Inter; linen or cream
with terracotta, or sage; the photograph in an arch with a glow behind it; pills
everywhere, every section centred, numbered cards; a hero that is a photograph
first and the words under the fold.

The gallery's `arrangement`, the hero fields, grounds and entrances are there
to be chosen in step 2 — `jtk showroom` draws them in the site's colours —
not to be inherited.
