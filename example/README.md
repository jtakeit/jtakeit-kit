# The example site

What `npx @jtakeit/astro create` lays out: an example site in the design
system of Brumy (brumy.ch), the company that makes jtakeit — a home page of
sections, a price list at `/services`, the privacy page and an imprint, a
header and a footer, in the site's own language and English (German and
English for a German-speaking site). Every word is the owner's to change in
the panel; `npx @jtakeit/astro add` and `remove` take sections and modules in
and out (docs/units.md).

- `files/` — the example's own files, laid at the same paths in a site: its
  declaration (`src/content/blocks.ts`), its look (`src/styles/tokens.css`,
  `look.css`, `src/components/site/`), its sections
  (`src/components/sections/`) and the imprint's route.
- `media/` — its photographs.
- `prints.json` — the fingerprints of its words and photographs
  (`scripts/example-prints.mjs`), for the platform's advice that a site still
  shows them. The hash is described in the file itself.

The words of each section, and what each unit owns, are `lib/units/`.

## The photographs

The twenty photographs in `media/` were generated for Brumy with Higgsfield
(GPT Image 2.6, 13 November 2026) — interiors, hands at work, materials,
objects and light, with no identifiable face, no logo and no text — then
scaled to at most 2,400 pixels on their long edge and stripped of their
metadata. They are Brumy's, and released with this package under its licence
(MIT, `LICENSE`). They replace the showroom's Pexels set, which was not ours
to ship.

They are laid into a site as files of its own — `src/assets/example-<name>.jpg`,
named in the content by that slot — until the media library has a door for an
agent (jtakeit-core wiki/108, `jtk media push`). Then `lib/units/photos.mjs`
alone changes, to library keys under `media/jtk-example/`, and the push adopts
the slots already laid out.

## The look

Brumy's own design — the glass, the pill button with its accent disc, the
display type with the light that crosses it, the mono labels, the giant
wordmark at the foot — taken from brumy-www as design, rebound to tokens and
to the kit's door, and published by Brumy in this package. The mark, the
words, the photographs and the films of brumy.ch are not here.

The fonts are Space Grotesk, Inter and JetBrains Mono, under the SIL Open
Font License 1.1, installed from `@fontsource/*` with the scaffold and served
with the site — never from Google's servers.
