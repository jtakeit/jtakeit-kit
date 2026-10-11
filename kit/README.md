# @jtakeit/kit

The half of a site on [jtakeit](https://jtakeit.com) that does not depend on
how the site is built.

[`@jtakeit/astro`](https://www.npmjs.com/package/@jtakeit/astro) is the
scaffold the platform ships: an Astro project with the contract already on
it. Everything in it that is not Astro's lives here, so a site on any other
static generator — Eleventy, a Next export, Nuxt, SvelteKit, a Node script —
takes the same pieces instead of reproducing them. The scaffold itself
imports this package; there is one implementation of each piece and two
homes for it.

What the platform holds a repository to is in
[connecting a site](https://jtakeit.com/docs/guides/connecting-a-site), under
*On another generator*. This package is the pieces of that list that are
worth not writing twice.

## The booking form

The platform's diary, on the page: the free times fetched, a stay of several
nights, a class of cars, a party, the words in the business's kind, the
payment step, Turnstile when the host has it. The contract it keeps is
[bookings on the site](https://jtakeit.com/docs/guides/bookings-on-the-site);
`preflight` reads `data-sends` off the built page and books in exactly that
shape, so the form says what it sends and the element sends nothing else.

**At build time**, the markup:

```js
import { renderBookingForm } from '@jtakeit/kit/booking';

const html = renderBookingForm({
  services,                 // [{ slug, title, takes, costs, rates, group }], the entries with `takes`; `rates` instead of `costs` says «from …»
  resources,                // [{ slug, title }] — leave empty for a solo business
  locale: 'uk',             // uk, de or en: the words before the platform has spoken
  combine: settings.combine === true,   // jtk/bookings.json
  scale: settings.scale ?? '',          // 'daily' for a business that lets by the day
  kind: settings.kind ?? '',            // whose words to wait for
  currency: site.business.currency,
  api: `${base}api/`,       // where /api/ is from this page — under the preview the site is served at /p/<slug>/
});
```

Put the string on the page where the site sends people to book — the one
`page` in `jtk/bookings.json` names. In Eleventy that is a shortcode; in a
Next export `dangerouslySetInnerHTML`; in a script, a template literal.

**On the page**, the behaviour, once:

```html
<script type="module">import '@jtakeit/kit/elements/booking';</script>
```

The markup comes wrapped in `<jtk-booking>`, and the element wires the form
when it reaches the document — on load, and when the panel places it later.
A form written by hand is wired too, as long as it keeps the `data-*` hooks
and the input `name`s of the rendered one: `wireAll()` walks the document at
load and again on the panel's `fl:placed`.

**By default the form arrives dressed** — two steps, the day as a week of
seven that never offers yesterday, the times by the part of the day, a drawn
choice of whom, a master chosen greying out what they do not do, the time kept
across changes, the end of the visit, a 24-hour clock, and the success showing
the booking's link whole with *Copy* (`@jtakeit/kit/elements/booking-ui`,
switched on by `renderBookingForm`'s `ui`, `false` for the plain form). Pass
`open` (the days the business opens) and each resource's `does` for the week
and the greying to know.

**The look** is the site's to give. `@jtakeit/kit/booking.css` makes the form
legible and nothing more; `field`, `field__input`, `booking__slot`,
`booking__submit` are names to restyle with the site's own fields and
buttons. Keep the `[hidden]` rule.

Under `base` — a site served from a path, which every preview is — pass
`api` as your generator writes a root-relative address, so the form posts to
`/p/<slug>/api/book` on the preview and to `/api/book` on the site's own host.

## The enquiry form

`/api/lead`, which the platform serves beside every site. The form is a real
`<form method="post">` first — with scripts off the browser posts it and the
platform answers with a page — and the element only spares a working browser
the navigation. What the build's lint holds it to: a `name` control, one of
`contact`, `phone` or `email`, the honeypot `website`, and nothing else that
the collecting block does not declare in `asks`
([the contract](https://jtakeit.com/docs/reference/contract.md)).

```js
import { renderLeadForm } from '@jtakeit/kit/lead';

const html = renderLeadForm({
  action: `${base}api/lead`,      // under the preview the site is served at /p/<slug>/
  copy: { title, lead, name, contact, message, requiredNote, submit, sending, success, error, invalidName, invalidContact },
  asks: [{ key: 'topic', label: 'What it is about', kind: 'text', max: 120 }],   // the block's `asks`, labels resolved
  paths: { title: 'blocks[3].title', lead: 'blocks[3].lead', name_label: 'blocks[3].name_label', /* … */ },  // the block's fields' data-jtk-path, when annotating
});
```

```html
<script type="module">import '@jtakeit/kit/elements/lead';</script>
```

`copy` is the collecting block's own words — the owner edits them by tapping,
which is what `paths` annotates — and `asks` are the catalogue's, drawn fixed.
`@jtakeit/kit/lead.css` is the legible minimum; keep `.trap` off-screen
whatever you restyle.

## `_meta.json`, and the specimen pages

What the edge needs to know that the HTML cannot say: the redirects, the
unfinished entries (built, and served only to an editing session), and the
directory whose file names carry a content hash, which the edge caches for a
year. The scaffold writes it from an Astro hook; any build step can:

```js
import { writeMeta } from '@jtakeit/kit/meta';

await writeMeta('dist', {
  collections, blocks, locales,      // the declaration: the specimens are derived from it
  immutable: ['/_next/static/'],     // where this generator keeps its hashed files; absent, the edge assumes Astro's
  redirects: [{ from: '/old', to: '/new', status: 301 }],
});
```

The **specimen pages** are the one thing in that list a site has to build as
well as declare: one page per block a post may hold, at
`<collection prefix>/_fl-<type>[-<view>]/` and per extra language — the panel
lifts the markup for a block the owner has just put into a post from there,
in the site's own stylesheet. `specimenAddresses(collections, blocks,
locales)` is the rule; build a page at each address that renders the block
once, and `writeMeta` lists them as drafts so a stranger never sees one.

A script that attaches to a selector attaches again on the markup the panel
places — `onAlive(selector, start)` from `@jtakeit/kit/elements/alive` is the
shape, and it listens for the panel's `fl:placed`.

## A kit, laid out

A business of a kind the platform knows starts from its kit — the
collections, the rates and the settings, judged on the platform's side:

```
npx @jtakeit/kit apply --kit car_rental --locale uk      # asked of the platform by its kind
npx @jtakeit/kit apply --kit ./car_rental.json           # or a file of it
```

writes `jtk/bookings.json` with `page` at the services' listing and `kit` /
`kit_version` recorded, the rates as entries under `jtk/content`, and the
kit's block types, collections and module into `jtk/catalogue.json` (a type
or a collection the site already has by that name is left alone). The
scaffold does the same through `jtk create --kit`, writing the declaration
into `src/content/blocks.ts` instead of the catalogue file. `@jtakeit/kit/kits`
has the pieces — `loadKit`, `kitSettings`, `kitEntries`,
`mergeKitIntoCatalogue`, `layKitFiles` — for a tool of your own.

## The catalogue tool

```
npx @jtakeit/kit catalogue --declaration src/content/blocks.ts --emit-only
npx @jtakeit/kit catalogue --declaration src/content/blocks.ts --dist ./dist
npx @jtakeit/kit catalogue … --judge        # and ask the platform's validator whether we agree
```

Derives `jtk/catalogue.json` from a declaration module — the scaffold's
`src/content/blocks.ts` shape: `BLOCKS`, `PAGE_SEO`, `BUSINESS_FACTS`,
`COLLECTIONS`, `MODULES`, `LOCALES` — and checks it against a built `dist/`
both ways: every declared field rendered with its `data-jtk-path`, every
annotated path declared. On an Astro project it also builds once more under
a path to prove every address stays inside the preview; on another generator
build that way yourself (`SITE_URL=https://x.invalid/p/check/`) and pass
`--dist`. `@jtakeit/astro catalogue` is this tool, signing the file as the
scaffold.

## The page says where it is

```
npx jtkit session <session_id> <watch_key>      # --api https://api.stg.jtakeit.com on staging
npx jtkit session --forget
```

Under `astro dev` every page carries a small card, bottom right: the seven
phases of a site being written — the brief, the layout, the writing, read
off the files; the judge's word, the repository, the build and the preview
from the platform — and the steps of the panel's setting up the developer
can take meanwhile, with the way there. The platform's half comes through
the dev session: `open_dev_session` answers with a `watch_key`, and this
command keeps it in `jtk/session.json`, out of git, for the dev server to
present. The key reads that one session's progress and nothing else, and
dies with the session. The card is `@jtakeit/kit/writing`; the rules it
draws by are `@jtakeit/kit/phases`, the panel's own; and nothing of it is in
a build.

## Also here

- `@jtakeit/kit/progress` — where the site is, read off the files: the brief's
  fill, the pages written, the entries, the settings, what is missing. The
  scaffold's dev server serves it as `/_jtk/progress.json` for the panel, and
  `jtkit progress` prints the same list for the agent; a rule in one is a
  rule in both, and nothing in it is declared.
- `@jtakeit/kit/phases` — the seven phases from the two halves, by the panel's
  rules: a later phase counts only once every one before it does; written is
  the still-to-do list being empty.
- `@jtakeit/kit/money` — a price as the page says it: «2 300 ₴», no kopecks
  on a whole price, no sign where the site has not said its currency.
- `@jtakeit/kit/booking/words` — the form's words per language, the salon's
  and the letting business's by the day, before the platform corrects them.
- `@jtakeit/kit/codes` — the catalogue's error codes, a copy of the platform's
  table that `--judge` keeps honest.

`@jtakeit/astro` stays the scaffold and is a thin layer over all of this.
