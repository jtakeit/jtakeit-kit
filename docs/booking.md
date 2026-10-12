# The booking form

The diary is the platform's; the page draws it. Six addresses on the site's
own host answer everything a visitor needs, and nothing about availability is
computed in the repository — which is what lets the owner change their hours
in the admin and have the site offer them the next minute, with no rebuild.

Template: `src/components/BookingForm.astro` — **a working base to copy and
dress in the site's design.** The markup is written out in the file, every
field of it, with the scaffold's look in a `<style>` beside it; the behaviour
is [`@jtakeit/kit`](https://github.com/jtakeit/jtakeit-kit/tree/main/kit)'s
`<jtk-booking>` element, imported at the bottom. The markup, its classes, its
order and its look are the site's; the behaviour is the platform's protocol and
is the kit's to keep, not the site's to rewrite. The contract in full is
[bookings-on-the-site](https://jtakeit.com/docs/guides/bookings-on-the-site)
in the platform's docs.

A site on another generator takes the same pieces without Astro: the markup
from `renderBookingForm(...)` at build time — or written out like the
component, from `bookingForm(...)`'s facts — and
`import '@jtakeit/kit/elements/booking'` once on the page.

## Copy it, keep the hooks, design the rest

The element finds everything in the form by a **hook** — a `data-*` attribute
or an input's `name` — and never by a class. So a form can be rebuilt from the
component in any design: rename every class, put the contact fields in a row,
wrap the times in a card, draw a checkbox as a chip. Keep the hooks and it
books. The list, with what each is for, is `@jtakeit/kit/booking/hooks`:

- **Always** — the form cannot book without them: `form[data-booking]` with the
  attributes `bookingForm` gives (`{...form.attrs}`: `data-api`, `data-sends`,
  `data-locale`, `novalidate`…); `[name=service]` (a `<select>`, or checkboxes
  inside `[data-service-row]` labels for several); `[name=day]`;
  `[data-times]` around `[data-times-hint]` and an empty `[data-slots]`;
  `[name=name]`, `[name=phone]`, `[name=email]`; an empty, hidden
  `[data-challenge]`; `[data-booking-error]`; `[data-submit]`; a hidden
  `[data-done]` holding `[data-done-line]`, `[data-done-when]`,
  `[data-manage]`, `[data-pay-note]` and `[data-pay]`.
- **Asked** — hidden; shown by the element only when the platform's answer
  asks: `[data-party-field]` around `[name=party]`, `[data-quantity-field]`,
  `[data-hours-field]`, `[data-back-field]` with `[name=back]` and
  `[data-length]`, and `[name=resource]` where the visitor chooses whom. A
  business that never asks may leave one out; the platform's preflight fails
  the page where it does ask.
- **Said** — where the element writes what happened: `[data-field]` on each
  field's wrapper (what the two steps sort, and what goes once booked),
  `[data-total]`, `[data-ends]`, `[data-stay-total]`, `[data-done-what]`,
  `[data-keep]` and the link to keep, `[data-telegram]`, `[name=note]`. Left
  out, that line is not said.

A hook left out is said in the browser's console when the page loads. The rules
the behaviour cannot work without — `[hidden]` means hidden, which step shows
(`data-stage`), the native control kept under a drawn one (`data-replaced`), a
focus ring where the site draws none — and the ARIA it depends on are put on
the page by the element itself, so a form restyled from nothing keeps them.

**What the element draws itself** carries `booking__*` classes, to style and
not to rename: a button per free time (`booking__slot`), the week of days
(`booking__days`, `booking__day`, `booking__days-arrow`), the parts of the day
(`booking__parts`, `booking__part`), the two steps (`booking__stepper`,
`booking__step`, `booking__next`, `booking__need`, `booking__summary`,
`booking__back`) and the drawn choice of whom (`booking__dd`,
`booking__dd-trigger`, `booking__dd-option`). Their state is ARIA, not a class:
chosen is `aria-pressed="true"`, the current step `aria-current="step"`, the
chosen option `aria-selected="true"`, what cannot be chosen `disabled`. The
end of the component's `<style>` styles every one of them — start there.

`npx @jtakeit/astro a11y` reads the built pages against WCAG 2.1 AA and drives
the form through every state; run it on the dressed copy before the push.

## Turning it on

A site scaffolded with `--kit <kind>` has all of this already: the collections,
the module pointed at them, the settings with `page` at the services' listing
and `kit`/`kit_version` saying which kit they came from, and
that listing — `src/pages/[...listing].astro` — as the booking page, the rates
above the form. What follows is what a kit is made of, and how to do it by hand.

The site's catalogue declares the module and binds two collections:

```jsonc
"modules": {
  "bookings": {
    "services":  "services",   // entries with `takes` (minutes) and, to be payable, `costs`
    "resources": "masters"     // entries that get occupied; one entry is a solo business
  }
}
```

Both are ordinary collections the owner edits in the admin — the team page and
the diary's masters are the **same entries**. A service entry carries `takes`
as a `duration` field; a master entry may carry its own weekly `hours`. The
business's hours, days off and confirmation mode are the module's settings
document, which the owner edits under the diary; publish writes it to
`jtk/bookings.json`, and a first commit may seed it there (below).

## The page

```astro
---
import BookingForm from '../components/BookingForm.astro';
import { listed, groupsOf, collectionNamed } from '../lib/entries';    // src/lib/entries.ts: the visible entries, in the collection's order
import bookings from '../../jtk/bookings.json';
const all = await listed('services');
// Under the collection's `group` where it has one: the runs in the headings' order,
// each heading the words (a select's label, a category's title), never the stored value.
const runs = (await groupsOf(collectionNamed('services'), all)) ?? [{ entries: all }];
const services = runs.flatMap((run) => run.entries.map((e) => ({
  slug: e.id, title: String(e.data.title),
  takes: e.data.takes, costs: e.data.costs, rates: e.data.rates, group: run.heading?.text, // for the checklist's total and headings; `rates` says «from …»
})));
const masters  = (await listed('masters')).map((e) => ({ slug: e.id, title: String(e.data.title) }));
const combine  = bookings.blocks[0].combine === true;                  // jtk/bookings.json, the owner's setting
const scale    = bookings.blocks[0].scale ?? '';                      // 'daily' for a business that lets things by the day
const kind     = bookings.blocks[0].kind ?? '';                       // 'car_rental', 'clinic'… — whose words the form speaks
```

An entry is `{ id, data }` — the slug and the block's fields — which is what
`src/lib/entries.ts` exports (`listed`, `everyEntry`, `href`); there is no
`entries()` and never was one, which this page used to claim.

And `jtk/bookings.json` says **where the form is** — `"page": "/angebote"` in its
block — because the form is placed by a page template rather than by a block, so
nothing else can tell the panel which page to open when the owner presses *Try
booking*. Empty means the front page.

```ts
---
<BookingForm services={services} resources={masters} locale="de" combine={combine} scale={scale} kind={kind} />
```

**The currency is the site's, never the page's.** It is set once, in
`jtk/site.json` (`"business": {"currency": "chf"}`) or on the Business facts in
the panel, and the form, the price list and the total read it from there —
`siteCurrency` in `src/lib/site.ts`, `money()` in `src/lib/money.ts`. Do not
pass `currency="CHF"` or write a sign into a page: when the business changes its
currency the diary and the payment follow, and a page with its own would go on
saying francs. The platform's preflight reads the built prices and fails one in
another currency. A price is whole minor units of the currency — 18000 is
CHF 180, 1000 is ¥1000 — and `money()` counts the digits each currency has.

The words that depend on the kind of business — «Записатися» or «Орендувати»,
«Майстер» or «Авто», «Ви записані» or «Оренду підтверджено» — are the
platform's: its availability answer carries them as `words`, in every
language, from the kind's dictionary with the site's own `words` over them.
The form asks for them as soon as it loads, and uses them from every answer.
Its own are a salon's, which is what a site with no `kind` is; so with `kind`
set to anything else those few words are held back until the platform has
said them, and shown in the salon's only if it does not answer at all.

With `combine` on — the module's setting, the owner's to flip — the services
are a checklist under their group's headings (the collection's `group`,
docs/collections.md — a select's labels or a category's titles; the services
with none after them) with a running total of minutes
and money, and the visit is booked as one: the same person, the sum of the
lengths, the sum of the prices. Off, the form is one choice, as it always was.
Only services with a `takes` belong on the form; a price-list row without one
is refused by the platform, so filter before passing.

With `scale` set to `'daily'` — a business that lets cars, flats or desks by
the day — the form speaks in days: the offered starts read «сб, 26 вер. — нд,
27 вер.», the confirmation «субота, 26 вересня — неділя, 27 вересня», and none
of the salon's hours. Every letting starts at midnight, so the hourly words
said «00:00» everywhere, which a visitor reads as a broken site. The platform's
answer carries the scale too and wins while the page runs; the prop decides
the words drawn before it answers.

By the day the visitor gives two dates, «від» and «до», and the form books
that many nights: it sends `count` — how many of the service — and never an
end, because the platform computes the end and the price from the service. How
many may be taken is the service's, in `jtk/content`: `fewest` and `most`,
one to thirty when unsaid. A service taken a fixed number of times — a week
as `takes` 10080 with `fewest` and `most` both 1 — asks for the first date
only. The platform's first answer says all of this per service, so a tariff
changed in the panel needs no rebuild.

Pass `resources` only when the visitor should choose; leave it out for a solo
business and the platform assigns. The words are the component's, per locale;
the page's own copy stays in `jtk/content`.

## What the form does by default — and the rules behind it

The element draws its pieces over the form (`@jtakeit/kit/elements/booking-ui`,
on by default; `ui={false}` on `BookingForm` for the plain form, or the pieces
by name: `ui="week parts"`). Each piece is an answer to something a visitor ran
into on a real salon's page on 10 October 2026, and a site that draws its own
form keeps the rules even where it changes the drawing:

1. **Two steps.** What and when first — the services, whom, the day, the
   time — then who is coming, with the choice summarised beside the name
   (what, with whom, when and until when, how long) and a *Change* back. One
   form throughout: with scripts off it is the whole form at once.
2. **The day is a week of seven**, rolling from today, arrows a week either
   way, the business's closed days (`open`, from `jtk/bookings.json`'s hours)
   struck out. **Never yesterday**: the input's `min` is written when the site
   is built, and a site built on Friday is read on Saturday — the floor is the
   browser's today, in the browser's own day, not UTC's.
3. **The times by the part of the day** — morning before noon, afternoon
   before four, evening after — one part showing at a time, so thirty pills
   are a dozen and nothing scrolls; each tab says its hours, not a count. A
   part of one or two times joins its neighbour: no «Evening 16:00–16:00».
4. **A master chosen greys out the services they do not do** («not with
   Noa»), unticks them, and *Anyone* brings them back. The other direction —
   a service chosen, the masters who do not do it — the platform's answer
   says. Pass each resource's `does` (the entry's list) for this to work.
5. **A time picked stays picked** when a service is added or taken away, if
   the same start is still offered; when it is not, a line says why — the
   visit is a different length now — rather than the pick vanishing.
6. **The end of the visit** under the times, from the platform's own `ends`:
   «Until about 10:45 · 1 h 15 min». Never the page's arithmetic.
7. **A 24-hour clock in every language.** The sites are Swiss, German and
   Ukrainian; «11:15 AM» reads as foreign.
8. **The success is a screen of its own**: the steps and the summary go, the
   line says *you are booked* and *with Noa*, and **the link is shown whole,
   with Copy, under a sentence that says to keep it** — it is the booking's
   only key. The platform's visitor page (`/_booking/<token>`) wears the
   site's clothes through `public/_jtk/booking.css`, which the scaffold ships;
   keep its tokens in step with the site's.
9. **The Turnstile widget in the page's colours and language**, from the
   root's `color-scheme` and `lang` — never the browser's. A light site once
   showed a dark box saying «Успешно».
10. **The hint says what is missing**: *pick a service* when a day is chosen
    and no service, *choose a day* the other way round, and never a 404 page.

## Its look is the site's to give

The component's `<style>` is the scaffold's look: neutral, legible, in the
site's tokens. **Restyle it before it goes out**, the way you restyle
everything else the scaffold ships: the site's own fields, the site's own
buttons for the times and the press, the site's panel around it. A booking form
in the scaffold's clothes on a page designed otherwise is the first thing the
studio sees. The classes in the file are scoped to it and are yours to rename;
the hooks above are what the element reads.

## What the component does, in order

1. `GET /api/turnstile` — the widget's key, or `""`. With a key it renders the
   Turnstile widget and sends the token as `turnstile`; without one it renders
   nothing. **The site carries no key**: which widget covers a host is the
   platform's decision, and a client's own domain is put into one the moment it
   is attached.
2. `GET /api/availability?service=&from=&to=[&resource=]` — the free starts
   for one day, as UTC instants, with the business's `zone` beside them for
   the clock. `service` repeats for a visit of several; the platform sums the
   lengths and offers only the resources that do all of them.
3. `POST /api/book` — the visitor's choice, with `services: [...]` for a visit
   of several (`service` alone is the one-service form). `409` means the time went while
   the page was open, and the component reloads the day. The answer carries
   `state` (*confirmed* or *pending*), `manage_path` (the visitor's own page:
   cancel, move, add to calendar) and `telegram_url` (reminders).
4. `POST /api/pay` — only when `amount_minor` is not zero. The slot is held
   thirty minutes; the platform's Checkout page comes back to `manage_path`.

## The band it sits in

The same rule as the lead form: give it something to stand beside — the price
list, the opening line, the master's photograph — or let it use the width.
`fl-check` fails a form band that uses less than 45% of a 1920px screen.

## In the preview

The form works on the studio's preview exactly as on the live site: the
platform answers `/p/<slug>/api/…` behind the preview's session, against the
same demo. A client can book a test appointment in their own diary before they
have paid, which is the sale.

`manage_path` already carries the prefix on a preview — `/p/<slug>/_booking/…`
— and the visitor's page is served there, so the link is used as it arrives.
A "received" page of your own writes every address through `under()`, the
`/_booking/<token>` fallback included: `href="/angebote/"` on it is the one
link a visitor presses right after booking, and on a preview it led to "no
site is attached to this address".

## A record, not a post — and every fact once

What the module reads is a record the diary occupies or offers, and the panel
draws it as a form. Shape the two entry types for that, not for the blog:

- **A service** is short fields — `title`, `takes`, `costs`, the field the
  collection's `group` names if the price list has headings (a `select`, or a
  `ref` to a categories collection the owner extends — docs/collections.md),
  one line — with **no `body`** and **`pages: false`**
  on the collection. It is a row of the price list the form reads, not a page.
- **A resource** — a master, a chair, a table, a room — is a `title` with its
  own `hours`, what it `does`, `seats` or `spots`, a line and a photograph if
  the page wants them. A master may have a page and a paragraph about her; a
  billiard table with an excerpt, a cover and eight thousand characters of
  body is the blog's shape copied without a reason.

And a fact lives once. The owner's opening hours are the module's settings,
which publish writes to `jtk/bookings.json`; the page reads them from there
(`OpeningHours.astro` below). The prices are the services' `costs`, and the
price list on the page is the same entries the form reads. **Never type hours
or prices again as text** on a page block: the copy goes stale the day the
owner changes the panel's.

`validate_catalogue` says both as advice — `JTK_W_MODULE_POST`,
`JTK_W_MODULE_TWIN` — under `advice`, refusing nothing; `jtk catalogue --judge`
prints them. Act on them before the first build.

### Opening hours from the module

```astro
---
import OpeningHours from '../components/OpeningHours.astro';
---
<OpeningHours locale="de" />
```

`src/components/OpeningHours.astro` reads `jtk/bookings.json`
if it is there — a repository nobody has published yet has none, and the
component draws nothing rather than failing the build — and lists the week in
the site's language, two rows for a day with a break. Restyle it like the rest.

## What not to do

- Do not compute free times on the page from the hours in `jtk/content` — the
  diary's bookings live in the platform and the page cannot see them.
- Do not put a Turnstile key in the repository.
- Do not draw your own "your booking" page unless the design needs it; the
  platform's at `manage_path` is the floor and works from day one.
