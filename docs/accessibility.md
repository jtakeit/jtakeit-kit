# Accessibility

The sites this scaffold builds are held to **WCAG 2.1 level AA**, by a machine
on every change to the kit and by the reading below of what a machine cannot
judge. This page says what is checked, what is not, and what stays the
author's — an agent's or a person's — because no template can keep it for
them.

## What is checked on every change

`node test/a11y.mjs` lays out a scaffold with the salon kit and a blog, gives it
the content a real site has (words in the hero, services, masters, a post, the
same in German), builds it, and reads every page it wrote in a real Chrome with
`jtk a11y` (`lib/a11y.mjs`) — then builds it again on a dark palette with a
light accent and reads it again. CI runs it after the probe build.

Two kinds of finding fail it:

- **axe-core**, the rules tagged `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`:
  contrast, names and labels, `lang`, the title, ARIA, structure.
- **Behaviour**, what axe cannot judge and a script can:
  - the first keyboard stop is a skip link, visible, landing on `<main>`
    (2.4.1);
  - every keyboard stop draws a focus ring (2.4.7);
  - nothing is cut off at 320 px wide (1.4.10);
  - the booking form, driven through every state — drawn, times drawn, a time
    picked, the second step, refused, booked — moves focus to the new step and
    to its answer, says its errors on the field they are about (3.3.1, 3.3.2),
    and says «copied» rather than only drawing it (4.1.3);
  - the enquiry form says a missing field on the field and takes the visitor
    to it (3.3.1).

You can run the same on your own build: `npx @jtakeit/astro a11y` reads
`./dist` (`npm i -D playwright-core axe-core` first, and a Chrome installed or
named by `CHROME_PATH`).

## What the scaffold does about it

- A skip link to `<main id="content">` on every page, in the site's language.
- A page's `<title>` is never empty: a page nobody has titled is named after
  the business.
- The quiet ink is derived from the ink and the paper, so it keeps its
  contrast on any palette; the words on an accent-coloured button are chosen
  from the accent's lightness (`--on-accent`).
- The booking form's quiet text is coloured, never faded with opacity; its
  groups of services are named groups; its errors are tied to their fields;
  focus moves to each new step; «copied» is announced.
- `prefers-reduced-motion` stops the entrances and the hero's motion.

## What is the author's

A template cannot know these, and the check above cannot judge them:

- **Alt text** that says what a photograph shows — or empty alt on one that is
  decoration.
- **Link words** that say where a link goes («our prices», not «here»).
- **Heading order** on a page you write: one `h1`, then `h2`s, no skipped level.
- **Contrast of colours you choose.** Set `--ink`, `--paper` and `--accent`
  together, and check text on a photograph or a pattern yourself. If your
  accent is light and the page is light too, set `--on-accent` yourself.
- **Focus styles.** Never remove an outline without drawing another.
- **Language.** Text in another language than the page's carries `lang`.

## What this repository does not cover

The pages the platform serves itself — the visitor's booking page at
`/_booking/<token>`, the letters a booking sends — are the platform's and are
held to the same standard there, not here.
