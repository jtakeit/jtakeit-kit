# The shapes a page can take

Three catalogues: how the first screen is built, how the page is built under it,
and how the type is paired. Pick one from each, deliberately, and **not the one
the last project used**.

This file exists because of a measurement. Three spec builds for three unrelated
businesses — a massage practice, a manual therapist, a children's clinic — came
out with the same hero, class for class:

```
section.hero > .hero__body > p.eyebrow  h1  p.hero__lead  p.hero__actions > a.btn + a.link
                                                                         + div.hero__media
```

Different words, different palettes, different fonts, one page. Under it, all
three were a stack of full-bleed bands — one of them literally names its
sections `band band band band band band band band`. What varied was the skin and
one bespoke component each.

Nothing chose that. It is what you get when the only worked example in the
documentation is a split hero, and the alternative would have had to be invented
under time pressure. So the alternatives are written down here instead.

Under the hero, each section is built as one of the compositions in
[compositions.md](compositions.md) — the third catalogue, and the one that
decides whether the page reads as made or as a template.

## Hero anatomies

| | What it is | Wants | Costs |
| --- | --- | --- | --- |
| **split** | Text column beside a media column. | A photograph worth half the screen and a headline that needs room. | It is our default and everybody else's — using it needs a reason, not a shrug. |
| **overlay** | One full-bleed photograph; the words sit on it. | A genuinely good picture, and a scrim. | Contrast work in every frame, and the picture has to survive text across its middle. |
| **typographic** | No photograph at all above the fold. The headline is the image. | A sentence strong enough to carry a screen, and type that has been chosen rather than picked. | Nowhere to hide: if the words are ordinary, the page opens on ordinary. |
| **portrait-led** | The person is the hero and the words are its caption — inverted hierarchy, photograph dominant. | A soloist, and a frame of them worth looking at. | Fails badly on a weak portrait, which on the outbound track is common. |
| **masthead** | A journal's top: kicker, rules, a headline across the full width, one dense row of facts, no media in the first screen. | A business whose credibility is the argument — clinics, legal, technical trades. | Reads as cold where warmth is the product. |
| **object** | One thing — the work, the tool, the dish — centred and framed, text orbiting it. | A product, and a photograph that can be cut out or framed cleanly. | Needs a good silhouette; a busy background kills it. |
| **pile** | Four or five photographs laid over each other, each a few degrees off square, the words beside them. `src/components/Pile.astro`. | A feed rather than a photograph — several usable frames and no outstanding one. | Reads as a collage past five cards, and as a mess if the cards have no edge: the overlap needs a hairline, a shadow or a plate to read as layers. |

**`pile` is the answer to the row above it.** `portrait-led` fails on a weak
portrait, and on the outbound track that is the ordinary case: a scraped feed
often has no single frame that can carry a screen. A pile puts four on the
screen so that none of them has to — the strongest use we have for material
nobody would call good. `<Pile>` owns the arrangement because the fault it
prevents is specific: a rotated card whose corner leaves the viewport takes the
whole page sideways on a phone, which is what the site this was measured off
ships with (393px viewport, 404px of page).

Two rules across all seven. The one action stays inside the first screen unless
the anatomy makes that dishonest (a masthead may legitimately put it one line
below), and whatever the anatomy, `jt-check` still measures the fold, the wide
screen and the crop.

## Scattered, then square

A tilt is worth something only against a straight edge.

The composition this comes from reads as *photographs at an angle that then line
up* — and there is no animation anywhere in it: the rotations are identical at
the top of the page and a thousand pixels down. It is a pile in the hero and a
grid under it, and the eye supplies the rest. That is the whole trick, and it
costs no script, no scroll timeline, and nothing at all for a visitor with
JavaScript off.

So: **one register of the page tilts and the rest is set square.** The pile, or
the one signature card, or the price list pinned to the wall — one of them, and
everything around it on a straight line. A page where three unrelated things sit
at three angles nobody chose does not read as casual, it reads as accidental.

The magnitude is `--tilt`, and it is a token because it has to be the same
number everywhere: ±3–6°, measured off the sites that do this well. Past about
8° it stops being a hand and starts being a template. `data-tilt="left"` and
`data-tilt="right"` are in surface.css — they set `rotate` rather than
`transform`, so a tilted block can still be moved by an entrance.

## Page forms

The hero gets attention and the rest of the page gets copied. All three builds
were a vertical stack of full-bleed bands with alternating backgrounds, which is
one form out of several.

- **band stack** — full-bleed sections, alternating grounds. Simple, safe, ours,
  and recognisable from across the room as ours.
- **shell** — everything inside one measure, sections as panels with air between
  them, nothing full-bleed except perhaps a single photograph. Reads as a
  document rather than as a landing page.
- **two-rail** — one column scrolls, one stays: the photograph, the price card
  or the contact details sit still while the argument moves past them. Wants a
  wide screen and degrades to stacked on a phone.
- **single scene** — one environment holds the whole page — their room, their
  wall, one continuous photograph — with the content floating over it in
  panels. The most memorable and the most demanding of the material.
- **index** — the page is a list: services as rows, each with its own line and
  price, like a menu or a treatment card. For a business whose customer already
  knows what they want and is choosing *which*.
- **letter** — one column, one voice, photographs interleaved. A letter from the
  person who does the work. Wants a real writer's material — the captions of
  someone who explains their craft — and nothing else on the page.

## Type pairings

Serif display over sans body is a good pairing and it was used in all three
builds. It is one of six.

- **serif display + sans body** — the default. Warm, editorial, safe.
- **one grotesk** — a single family, contrast made from weight and size only.
  Confident and modern; nowhere to hide a weak layout.
- **all serif** — display serif over a text serif. Slow, human, expensive-looking.
- **mono or technical display + humanist sans** — for trades that measure things.
- **condensed display + wide body** — the tension is the point; strong for
  posters and for food.
- **system stack, deliberately, with one bought display face** — the fastest
  page in the set, and it only works if the display face is genuinely good.

Whatever the pairing: two families at most, both loaded from the same host,
preconnect set. A third family is nearly always why mobile Lighthouse is at 84.

## And what it is printed on

Three catalogues decide what the page *is*. Three more decide what it is made
of — the ground under the content, the edge its blocks are drawn with, and how
they arrive — and they are in [surface.md](surface.md), with the same rule
attached: not the one the last project used. A shape and a surface chosen
together is a direction; either one alone is a skin.

## Recording the choice


## The one thing that cannot be reused

A catalogue produces variety, not identity: seven anatomies over fifty projects is
still eight sites that look like each other. So one element on every page has to
be **impossible to move to another site** — made from this business's own
material rather than from a component.

Their handwriting off a caption, set as a heading. A photograph of their actual
price card. The stripe of colour taken from their wall. Their sign, photographed
and used as the wordmark. The tool they hold in every third post, cut out and
used as the bullet.

That is the difference between a page that is different and a page that is
theirs, and it is the answer to "why does this not look like a template" that a
client can see in one second.
