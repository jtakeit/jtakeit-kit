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

`node test/a11y-shop.mjs` is **the shop's walk**, beside the booking form's: it
lays out a site for a business in German with English beside it, adds the shop
(`jtk add shop`) and gives it the products, the zones and the methods a shop has,
builds it, and walks the storefront in a real Chrome over `devShop` — the shop's
four addresses answered from the site's own files, one variant sold out — in both
languages and on the light and the dark palette, then again as an agent leaves the
copy, every class renamed and only the hooks kept. It reads each page of the
shop — the listing, three products, the cart with the checkout below it, the page
after payment — with that piece's drive (below). CI runs it as a step of its own,
since it needs a Chrome and takes some minutes.

Two kinds of finding fail either walk:

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
    to it (3.3.1);
  - **the shop**, each piece driven as a buyer drives it, by the keyboard, with
    axe reading every state and the script holding what axe cannot:
    - the product's page: a value sold out is said in words beside the value and
      *Add* is held, a question the product asks that was left unanswered is said
      on its field and takes the focus (3.3.1, 3.3.2), «added» is a status (4.1.3),
      and a browser that keeps no cart says so;
    - the cart: each row's quantity box and *Remove* button are named by the
      product and its labels, a line the shop refuses is said with its reason, a
      country and a method are chosen by the keyboard and drawn chosen in forced
      colors (1.4.1, 1.4.11), the customs sentence, *incl. VAT* and a country the
      shop does not send to are said where they hold, nothing is cut off at 320 px
      with its rows drawn (1.4.10), and a shop that cannot be asked leaves the rows
      as they were and says so;
    - the checkout step: *Pay* pressed with nothing filled in says each missing
      detail on its field, a detail the shop refuses is said at its field, a price
      that changed is shown and said, and one press of *Pay* is one order however
      often it is retried;
    - the page after payment: its state is said as a status and only when it
      changes, never again every three seconds; a waiting order is asked after for
      two minutes and then said to be still waiting; a paid order empties the cart
      and one opened elsewhere does not;
    - a listing that hides what is sold out hides exactly what the shop says, and
      nothing where the shop cannot be asked;
  - **the shop's protocol check**, which is not WCAG, as the booking form's is
    not: every request a shop's page makes names the protocol, `X-Jtk-Shop: 1`.
    A page that sends one without it fails (*shop: every request names the
    protocol version*), as a booking form fails without `X-Jtk-Booking`: the
    platform cannot keep a page that does not say which protocol it speaks;
  - a drive that cannot go on — a hook the page lost — is a finding on its page,
    said with where it stopped.

You can run the same on your own build: `npx @jtakeit/astro a11y` reads
`./dist` (`npm i -D playwright-core axe-core` first, and a Chrome installed or
named by `CHROME_PATH`). It drives every piece it finds on a page by its root
hook — the booking form's and the shop's — so a storefront copied and dressed in
the site's design is walked the same way: run it before the push. A cart page is
given a line from the first product's page and driven; read alone, it is held to
its empty state.

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
- The storefront's pieces say what is sold out in words, a fault at its field, a
  line the shop refuses with its reason, and the state of an order as a status;
  the chosen option and shipping method are drawn from the page's tokens, not by
  the browser, so they are still drawn chosen in forced colors. The words are the
  kit's, in eight languages (`@jtakeit/kit/shop/words`), and a native speaker of
  the site's language should read them before it goes live.
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
`/_booking/<token>`, the letters a booking and a shop send, Stripe's payment
page — are the platform's and are held to the same standard there, not here.
