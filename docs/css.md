# Tokens and CSS discipline

The design direction comes from `frontend-design`. This is how it is written
down so that it survives three weeks of edits.

## One file names the colours

`src/styles/global.css` (or the variant's stylesheet) holds every colour, and
nothing outside it names a colour that is not a token. The exception is a
component that deliberately owns a foreign palette — a demo screenshot, an
embedded third-party card — and it says so in a comment.

## The mistake this catches

A brand colour is one value doing two jobs, and the two jobs need different
values:

- **the fill** — buttons, bars, badges, anything ink sits *on*;
- **the text form** — links, small labels, numbers.

On a light ground the text form is usually a step *darker*; on a dark ground it
inverts. `nails` names them `--accent` and `--accent-strong`: the first is 3.5:1
and may never carry text, the second is 5.7:1 and carries all of it. `main`
names them `--accent` and `--accent-ink` for the same split. A new component
that puts words on the fill token is a contrast bug, not a style preference.

Write which is which in a comment at the token. It is the single rule most
likely to be broken by whoever touches the file next.

## Surfaces run in one direction

On a light page: the background is the **middle** tone, panels and cards are
**lifted** above it, inputs and footer bands are **recessed** below it. "Deep"
means recessed, not dark. Name the tokens so that is obvious — `--paper`,
`--panel`, `--paper-deep` — because a token called `--bg-dark` on a light theme
will be used for the wrong thing within a week.

## Warm grounds need warm shadows

A neutral black shadow on a warm ground turns the area under every card grey,
and grey under warm beige is what makes a page look dirty rather than
photographed. Define `--shadow-1/2/3` with the ground's hue in them and use
nothing else.

## Everything else is a token too

Radii — one base `--radius`, the steps `--r-1…--r-4` derived from it and
`--r-pill` — the screen's height `--screen`, the measures `--measure-read` and
`--measure-object`, motion `--dur` / `--ease`, type scale, spacing: the floor
([kit.md](kit.md), «The floor»). A bare `150ms ease`, a hand-typed `12px`
radius or a `70svh` in a new component is a drift, not a choice — and drift is
precisely what makes a site stop looking designed after the third round of
edits.

## Responsive

Real breakpoints, one activation point each. If a preview mode ever needs to
force a viewport, do it by changing the element's actual width (an iframe, a
container query), not by mirroring every breakpoint into a second selector —
`duckit` mirrors `@media` and `html[data-vp]`, and every layout change there has
to be made in two places for the rest of the project's life.

Small screens **drop** what stops earning its space; they do not shrink
everything uniformly. Timestamps, decorative cursors, secondary chips, a
photo collage — each goes at the width where it stops helping, with a comment at
the rule saying why.

Nothing on the page scrolls sideways on its own, and nothing overflows the
viewport at 360px. Wide things — tables, code, diagrams — scroll inside their
own container, never taking the body with them.

## Specificity

Section-level and element-level selectors cancelling each other out is the most
common way generated CSS goes wrong, usually on the padding between sections.
Keep one owner per property: if `.section` sets the vertical rhythm, a `.cta`
inside it does not also set it.

## Scroll behaviour

Do not put `scroll-behavior: smooth` on `html`. A long smooth scroll past six
sections reads as a broken page. Handle anchors in script: jump instantly when
the target is more than two viewports away, glide when it is near, honour
`prefers-reduced-motion`, and move focus to the target so the keyboard follows
the eye.

`scroll-padding-top` must clear every fixed bar stacked above the content, per
viewport. An anchor that lands under a sticky header is the most-reported bug
that nobody can describe.
