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

What the platform holds a repository to is in its guide *connecting a site*
(`jtakeit:///guides/connecting-a-site.md`, through the MCP server), under
*On another generator*. This package is the pieces of that list that are
worth not writing twice.

## The booking form

The platform's diary, on the page: the free times fetched, a stay of several
nights, a class of cars, a party, the words in the business's kind, the
payment step, Turnstile when the host has it. The contract it keeps is
the platform's *bookings on the site* (`jtakeit:///guides/bookings-on-the-site.md`);
`preflight` reads `data-sends` off the built page and books in exactly that
shape, so the form says what it sends and the element sends nothing else.

**At build time**, the markup:

```js
import { renderBookingForm } from '@jtakeit/kit/booking';

const html = renderBookingForm({
  services,                 // [{ slug, title, takes, costs, rates, group, lang }], the entries with `takes`; `rates` instead of `costs` says «from …»; `group` is a heading's words (a select's label, a category's title), and the services with none come after every heading; `lang` marks a title in the original's words where nobody translated it
  resources,                // [{ slug, title }] — leave empty for a solo business
  locale: 'uk',             // uk, de or en: the words before the platform has spoken
  combine: settings.combine === true,   // the diary's settings: site.module('bookings'), jtk/modules/bookings.json
  scale: settings.scale ?? '',          // 'daily' for a business that lets by the day
  kind: settings.kind ?? '',            // whose words to wait for
  currency: site.business.currency,
  api: `${base}api/`,       // where /api/ is from this page — under the preview the site is served at /p/<slug>/
});
```

Put the string on the page where the site sends people to book — the one
`page` in the diary's settings names (`jtk/modules/bookings.json`). In
Eleventy that is a shortcode; in a Next export `dangerouslySetInnerHTML`; in
a script, a template literal.

**On the page**, the behaviour, once:

```html
<script type="module">import '@jtakeit/kit/elements/booking';</script>
```

The markup comes wrapped in `<jtk-booking>`, and the element wires the form
when it reaches the document — on load, and when the panel places it later.

**Or write the markup yourself**, in the site's design. The element finds
everything by a hook — a `data-*` attribute or an input's `name`, never a
class — so a form rebuilt in any markup works as long as it keeps them. The
list, with what each is for and which may be left out, is
`@jtakeit/kit/booking/hooks` (`ALWAYS`, `ASKED`, `SAID`); `bookingForm(props)`
gives the facts to write it from — the words, the services in their runs with
«45 min · CHF 95», the days, and the `<form>`'s attributes to spread on it.
`@jtakeit/astro`'s `BookingForm.astro` is such a form, written out, and the
quickest start: copy it and design it. `wireAll()` walks the document at load
and again on the panel's `fl:placed`, so a bare form is wired too.

**By default the form arrives dressed** — two steps, the day as a week of
seven that never offers yesterday, the times by the part of the day, a drawn
choice of whom, a master chosen greying out what they do not do, the time kept
across changes, the end of the visit, a 24-hour clock, and the success showing
the booking's link whole with *Copy* (`@jtakeit/kit/elements/booking-ui`,
switched on by `renderBookingForm`'s `ui`, `false` for the plain form). Pass
`open` (the days the business opens) and each resource's `does` for the week
and the greying to know.

**The look** is the site's to give. `@jtakeit/kit/booking.css` makes
`renderBookingForm`'s markup legible and nothing more; restyle it with the
site's own fields and buttons. The rules the behaviour needs — `[hidden]`,
which step shows, the native control under a drawn one — are put on the page
by the element, not by the stylesheet. What the element draws itself carries
`booking__*` classes (`booking__slot`, `booking__day`, `booking__part`, the
steps, the drawn choice) with its state in ARIA: chosen is
`aria-pressed="true"`.

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
(the platform's contract, `jtakeit:///reference/contract.md`).

```js
import { renderLeadForm } from '@jtakeit/kit/lead';

const html = renderLeadForm({
  action: `${base}api/lead`,      // under the preview the site is served at /p/<slug>/
  copy: { title, lead, name, contact, message, requiredNote, submit, sending, success, error, invalidName, invalidContact },
  asks: [{ key: 'topic', label: 'What it is about', kind: 'text', max: 120, path: 'blocks[ctab0001].topic_label' }],   // the block's `asks`, labels resolved
  paths: { title: 'blocks[ctab0001].title', name_label: 'blocks[ctab0001].name_label', /* … */ },  // the block's fields' data-jtk-path, when annotating
  langs: { message_label: 'de-CH' },  // the original's words on a page in another language, marked with its lang
});
```

```html
<script type="module">import '@jtakeit/kit/elements/lead';</script>
```

`copy` is the collecting block's own words — the owner edits them by tapping,
which is what `paths` annotates, and `langs` says which are the original's on
a page in another language — and `asks` are the schema's: drawn fixed under
their declared label, or under the block's own words where an ask carries a
`path` (a `<key>_label` field of the collecting block, as the scaffold's
contract-3 form draws every question).
A label or the button the block leaves empty says the kit's word in `lang`
(`leadWords`: en, de, fr, it, es, pt, uk, ru), carrying the field's path so a
tap opens it, or `data-jtk-fixed` where there is none: a control is never
drawn without a name.
`@jtakeit/kit/lead.css` is the legible minimum; keep `.trap` off-screen
whatever you restyle.

## The content, read through one door

`@jtakeit/kit/content` is the one place a site reads its `jtk/` files: which
page is which, which entries a collection offers and in what order, which
language a document is in, its groups, its tree and what points at it, the
money in the site's currency — and the annotation of every value, so a
template never writes a path. It reads contract 3 as the platform does: the
schema is `jtk/schema.json`, a page is `jtk/pages/<path>.json` (`/` as
`index.json`) and an entry `jtk/entries/<collection>/<slug>.json`, each with
its `id`, an entry's own values under `fields`, its address from its
collection's `route`; a module's settings are `jtk/modules/<module>.json`, the
text on every page `jtk/shared.json`, and another language a translation
beside each original (`index.en.json`), merged over it. A site made before
contract 3 and not moved yet is read as contract 2, as the platform reads it
there — `jtk/catalogue.json`, a document per page and per language under
`jtk/content/`, its settings a `<module>_config` block — through the same
functions.

```js
import { content } from '@jtakeit/kit/content';

// In a template, the files as Vite's glob hands them — the same line under a later contract:
const site = content(import.meta.glob('/jtk/**/*.json', { eager: true, import: 'default' }));
// In Node, the same map off a disk:
//   import { readJtk } from '@jtakeit/kit/content/node';
//   const site = content(await readJtk());

const hero = site.page('/', 'de').block('hero');
hero.text('title');                    // the words
hero.at('title');                      // { 'data-jtk-path': 'blocks[hero].title' }, the block by its _key — spread it onto the element
site.entries('works', { locale: 'de' }); // offered and ordered; { all: true } for every one
site.facts('de').text('phone');        // the business's facts by role, from the shared text (contract 3); '' under contract 2
```

`site.facts(locale)` reads the fields of the shared text that say a `role`
— the contacts' `name`, `street`, `city`, `phone`… — by that role, each with
its annotation (`facts.at('phone')`). It is what a layout's structured data,
its head and `llms.txt` say of the business, so what the owner edits in the
panel is what search engines are told. Contract 2 declares no roles, and every
answer is empty: a template falls back to its own constants there.

`TAPPABLE` and `tappable(field)` are the platform's kinds that must carry a
tap target, one set for the lint, the schema's check and the scaffold. The
kit's own readers — `jtkit lint`, `progress`, the dev diary, `_meta.json` —
read through the same door.

## `_meta.json`, and the specimen pages

What the edge needs to know that the HTML cannot say: the redirects, and the
directory whose file names carry a content hash, which the edge caches for a
year. Which entries a visitor may not see is the platform's to say, from each
entry's `visible` and its moments, and the file says nothing of them (a site
still on contract 2 lists its unfinished entries there as `drafts`). The
scaffold writes it from an Astro hook; any build step can:

```js
import { writeMeta } from '@jtakeit/kit/meta';

await writeMeta('dist', {
  collections, blocks, locales,      // the declaration: the specimens are derived from it
  // or `site: content(await readJtk())`, the door's reading, as the scaffold passes
  immutable: ['/_next/static/'],     // where this generator keeps its hashed files; absent, the edge assumes Astro's
  cache: [{ prefix: '/clips/', maxAge: 86400 }], // files that keep their names, kept a day; see below
  redirects: [{ from: '/old', to: '/new', status: 301 }],
});
```

### A file a script picks by name

A film or a photograph a script addresses has no attribute pointing at it, so
the generator does not hash it and it lives in `public/`, which the edge
serves for a minute. `keepByName` gives it a name that carries its bytes,
after the build and before `writeMeta`:

```js
import { keepByName } from '@jtakeit/kit/kept';

const { kept, unreferenced } = keepByName('dist', { dirs: ['clips', 'scenes'] });
// /clips/einsatz.mp4 → /_astro/kept/clips/einsatz.3f9a1c2b.mp4, kept for a year
```

Every address the build wrote whole — in a script, `src`, `data-src`,
`url(…)` — is pointed at the copy; the originals stay, and `unreferenced`
names the ones a script assembles and that therefore still go by name.

Or keep the names and declare how long: `cache: [{ prefix: '/clips/', maxAge:
86400 }]` beside `immutable`. The platform then holds every such name to its
contents for that long once the site has an address — other bytes under it are
refused, `JTK_E_CACHED_FILE_CHANGED`, and lowering `maxAge` frees nothing
sooner. A day for names that may be reused; a year only for names that carry
their version.

The **specimen pages** are the one thing in that list a site has to build as
well as declare: one page per block a post may hold, at
`<collection prefix>/_fl-<type>[-<view>]/` and per extra language — the panel
lifts the markup for a block the owner has just put into a post from there,
in the site's own stylesheet. `specimenAddresses(collections, blocks,
locales)` is the rule; build a page at each address that renders the block
once. A stranger never sees one: the edge answers an address with an `_fl-`
segment only to someone editing (on contract 2, `writeMeta` lists them as
drafts).

A script that attaches to a selector attaches again on the markup the panel
places — `onAlive(selector, start)` from `@jtakeit/kit/elements/alive` is the
shape, and it listens for the panel's `fl:placed`.

## A kit, laid out

A business of a kind the platform knows starts from its kit — the
collections, the rates and the settings, judged on the platform's side:

```
npx @jtakeit/kit apply --kit car_rental --locale de-CH   # asked of the platform by its kind
npx @jtakeit/kit apply --kit ./car_rental.json           # or a file of it
```

lays the kit out on contract 3, the latest, which every new site is on: the
platform serves a kit in contract 2's words, and it is put in contract 3's by
the same mapping `jtk create --kit` and `jtk upgrade contract-3` use, then

- its block types, collections and module go into `jtk/schema.json` — a new
  one, in the site's language (`--locale`, English by default), or the site's
  own, beside what it declares already: a type, a collection or a module the
  site has by one of the kit's names is kept where it is the same, and
  refused, with a sentence and nothing written, where it is not;
- its settings into `jtk/modules/bookings.json`, with `page` at the
  services' listing and `kit` / `kit_version` recorded; its rates under
  `jtk/entries/<collection>/`, each with its `id` and `rank`; and the page
  its services are shown on, `jtk/pages/<prefix>.json`, with a new `id` — or
  the site's own page there, kept as it is;
- and the schema is judged as the platform's judge of contract 3 judges it
  before a file is written. A file the site has already at one of those
  places is its own, never written over: the apply is refused.

On a contract-3 tree the kit's words are the schema's language. A site made
before contract 3 and not moved yet — `jtk/catalogue.json` or `jtk/content/`
and no `jtk/schema.json` — takes the kit in contract 2's files, as it always
did: `jtk/bookings.json`, the rates under `jtk/content`, the kit's types into
`jtk/catalogue.json` (the site's own of the same name left alone) without the
keys only contract 3 has, such as a person's name said `"localized": false`.
Run `validate_schema` with the schema and the `jtk/` files beside it before
the push. The scaffold lays a kit out through `jtk create --kit`, writing the
tables into `src/content/blocks.ts` instead. `@jtakeit/kit/kits` has the
pieces — `loadKit`, `kitIn3`, `layKit3Files`, `applyKit`, and for contract 2
`kitSettings`, `kitEntries`, `catalogueIn2`, `layKitFiles` — for a tool of
your own.

## The schema tool

```
npx @jtakeit/kit schema --declaration src/content/blocks.ts --emit-only
npx @jtakeit/kit schema --declaration src/content/blocks.ts --dist ./dist
npx @jtakeit/kit schema … --judge        # and ask the platform's validator whether we agree
```

Writes `jtk/schema.json` from a declaration module that says `CONTRACT = 3`
— the scaffold's `src/content/blocks.ts` shape: `BLOCKS`, `PAGE_SEO`,
`SHARED`, `COLLECTIONS`, `MODULES`, `LOCALE`, `LOCALES`, typed by
`@jtakeit/kit/schema` — judges it offline as the platform does, gives every
page and entry its `id` and every block, row and picture its `_key` where a
file has none, and checks it against a built `dist/` both ways: every
declared field rendered with its `data-jtk-path`, by key, and every
annotated path declared. On an Astro project it also builds once more under
a path to prove every address stays inside the preview; on another generator
build that way yourself (`SITE_URL=https://x.invalid/p/check/`) and pass
`--dist`. `@jtakeit/astro schema` is this tool, signing the file as the
scaffold. A site still on contract 2 writes its `jtk/catalogue.json` with
`npx @jtakeit/kit catalogue` the same way, from a declaration without the
line.

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
- `@jtakeit/kit/codes` — the schema's error codes, a copy of the platform's
  table that `--judge` keeps honest.

`@jtakeit/astro` stays the scaffold and is a thin layer over all of this.
