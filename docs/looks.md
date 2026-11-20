# Looks — which one a site is laid out in

`jtk create` lays out one site — the same sections, collections, pages,
shared text, booking, shop and lead behaviour, accessibility, live render,
door and schema — in one of two looks:

```bash
npx @jtakeit/astro create <slug> --name "The Business"                 # brumy, the default
npx @jtakeit/astro create <slug> --name "The Business" --look bare     # no art direction
```

| look | what it is | when |
| --- | --- | --- |
| `brumy` | The example in the design system of Brumy (brumy.ch), the company that makes jtakeit: its palette, its three typefaces, the glass, the pill button, the light across the hero's heading, the wordmark at the foot. | The developer is happy to start from Brumy's design: kept, or adapted by its tokens (`src/styles/tokens.css`, [scaffold.md](scaffold.md)). |
| `bare` | The same site with no design: the system's own type, a few neutral colours, one radius, the focus ring, plain sections in the document's order. | **A custom design** — from the business's own site, its brand, or references the person gave. |

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
   signature. Say where each choice comes from. Show it to the developer.
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
   and wide, before calling it done.

The gallery's `arrangement`, the hero fields, grounds and entrances are there
to be chosen in step 2 — `jtk showroom` draws them in the site's colours —
not to be inherited.
