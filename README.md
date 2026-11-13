# @jtakeit/astro

> **What this is:** the starting point for a client website on [jtakeit](https://jtakeit.com) —
> an Astro project your AI agent writes, and the tool that checks it against the platform.
> **For:** developers and freelancers who build sites for small businesses.
> **Status:** early access. Building and previews are free; a site is paid for once it
> goes live. Connect your agent to the platform's MCP server at
> `https://mcp.jtakeit.com/mcp` (it signs you in through the browser); the steps that
> build, preview and launch a site need it. Everything in this repository runs without it.

The scaffold and the schema tool for a site on [jtakeit](https://jtakeit.com) —
the platform's contract as a working Astro project, ready to build on.

jtakeit is an agent-driven platform for building and running websites for clients:
the site is written by an agent in a repository, and the platform runs the panel the
business owner edits it in, the enquiries and the bookings, the backups and the
domain. What the platform holds a repository to is small — a `jtk/schema.json`
that validates, an annotation on every editable field, a `dist/` from an Astro
build — and this package is that contract with a page already on it.

This is the one scaffold the platform ships, and it is Astro's. The platform
builds whatever writes a `dist/` that keeps the contract; on another generator
the site is laid out by hand — the platform's guide *connecting a site*
(`jtakeit:///guides/connecting-a-site.md`), under *On another generator* — and takes the pieces worth not writing twice from
[`@jtakeit/kit`](https://github.com/jtakeit/jtakeit-kit/tree/main/kit), which this scaffold uses itself: the booking
form and the enquiry form as markup and as elements, `_meta.json` and the
specimen rule, a kit laid out on contract 3 (`npx @jtakeit/kit apply --kit
<kind>`), and the schema tool.

## Scaffold

```
npx @jtakeit/astro create <slug> --name "The Business" --locale de-CH
cd <slug> && npm ci && npm run dev
```

You get a static Astro project laid out as an **example site in the design system of
Brumy** (brumy.ch), the company that makes jtakeit: a header and a footer, a home page
of eight sections — hero, values, services and prices, gallery, team, testimonials,
questions, the form beside the address and the hours — a price list at `/services`,
privacy and imprint pages, every word the owner's in the panel, in the site's language
and English, with the example's own photographs. Keep the look or — as is meant —
adapt it: the tokens are `src/styles/tokens.css` ([docs/scaffold.md](docs/scaffold.md)).
Take out what the brief does not name, add what it does:

```
npx @jtakeit/astro units                  what the site has, what can be added
npx @jtakeit/astro remove testimonials    a section, its words, its photographs
npx @jtakeit/astro add blog               a module the brief asked for
npx @jtakeit/astro create <slug> --without team,testimonials
```

Under it: a lead form posting to `/api/lead` (the platform serves it), a booking form
for the platform's diary, pages for robots, sitemap and llms.txt, and
`src/content/blocks.ts` — the declaration of what the owner may edit. Every component
is yours to replace.

A new site is on **contract 3** (jtakeit-core wiki/98): `src/content/blocks.ts` says
`CONTRACT = 3`, `jtk/schema.json` is written from it, the pages are under `jtk/pages/`,
the entries under `jtk/entries/<collection>/`, the business's facts in `jtk/shared.json`
and a module's settings at `jtk/modules/<module>.json`. `jtk/site.json` is the
platform's: the site's currency is given once, to `create_site`.

```
jtk/schema.json          what the owner may edit — written from src/content/blocks.ts
jtk/pages/index.json     the home page; every page has its id, its path and its name
jtk/shared.json          the text on every page: the business's contacts, by role
jtk/design.json          the design document the panel reads for the editor's chrome
```

Another language is a translation beside each original, holding only its words
(`jtk/pages/index.en.json`). With no language asked for, `create` lays the example out in
English with German (`de-CH`) beside it; `--locale de-CH --locales en` lays a site out in
German with English, its English words that are not content in `src/copy/en.ts`, and
`--locale X` alone a site in X alone
([docs/languages.md](docs/languages.md)). A contract-2 site in several languages moves
with `npx @jtakeit/astro upgrade contract-3`.

A business that takes bookings starts from its **kit**, asked of the platform
by its kind (`GET /v1/kits/<kind>`; the kinds are at `/v1/kits`):

```
npx @jtakeit/astro create <slug> --locale uk --kit car_rental
```

A file of the kit's JSON is taken too — `--kit ./car_rental.json` — and
`--api` points at another platform than `https://api.jtakeit.com`.

The kit's collections, rates and settings are laid out — `blocks.ts` in contract 3's
words, `jtk/modules/bookings.json`, the rates as entries under `jtk/entries/` in the
site's language — and the
page the services are shown on is the booking page — the kit whole, nothing left out quietly. What it
leaves to the brief (the time zone, the prices, the cars) is printed at the end,
with where to read what it chose for the business — confirmation, cancellation,
payment, hand-over hours — to be said back to the developer and confirmed
(`jtakeit:///guides/the-brief.md`). Nothing in it is made up. The settings
record which kit and which version they came from (`kit`, `kit_version`): when
the kit is fixed later, the platform's judge says so to the site
(`JTK_W_KIT_BEHIND`), with what changed.

## The schema

```
npx @jtakeit/astro schema                 # write jtk/schema.json, build, check it against dist/
npx @jtakeit/astro schema --emit-only     # write it and stop
```

`jtk/schema.json` is derived from `src/content/blocks.ts` and checked against the
built pages in both directions: every field the owner edits is drawn with its
annotation, by key, and every annotation names a place the schema declares. It
also gives a page or an entry its `id`, and a block, a row or a picture its `_key`,
where a file has none. The platform's own judge is the authority — `validate_schema`
over MCP, or `--judge` here with `JTK_API` and `JTK_TOKEN` set — and this tool sits its
exam.

A contract-2 site — one made before contract 3 and not moved yet; a new site is
always laid out on the latest contract — has `jtk/catalogue.json` instead, written and
checked the same way by `npx @jtakeit/astro catalogue` ([docs/catalogue.md](docs/catalogue.md));
`npx @jtakeit/astro upgrade contract-3` moves one in one commit.

## Then, on the platform

In the platform's order (`jtakeit:///guides/start.md`), which `jtk create` prints
at the end and writes into the site's README:

1. `create_site` first, with the brief's currency — then `npx @jtakeit/astro create`.
2. The dev server, then `open_dev_session` with its address and the `run` command
   its answer gives — before writing a line.
3. `src/content/blocks.ts`, then `npx @jtakeit/astro schema` (`catalogue` on
   contract 2).
4. `validate_schema` with the schema, the `jtk/` files and the `site_id` — before
   the push.
5. The code: no GitHub remote in the copy → `push_code`, then
   `npx @jtakeit/astro push '<url>'`; a GitHub remote → ask the developer once,
   then our GitHub App on it (a person installs it) and `attach_repo`.
6. `commit_and_build` — nothing public; `get_build` until it settles;
   `get_preview_link` to look (the studio hands the owner's link to the client
   from the panel).
7. `preflight` before saying done.

Later: `push_code` again, or `git push` and `import_branch`, then
`commit_and_build`. `trigger_build` rebuilds a site that has been built once, and
refuses one that has not.

The whole of it, with the reasons, is in [docs/](docs/): `kit.md` first, then
`catalogue.md`, `pages.md`, `collections.md`, `lead-form.md`, `booking.md`,
`photos.md`, and the rest as you need them — `live.md` for how the panel draws a
saved draft at once. The platform's own reference —
field kinds, modules, every error code — is what the MCP server hands an agent on
`initialize`: `jtakeit:///` resources, starting with `jtakeit:///guides/start.md`.
It is not published on the web yet.

## Not here, on purpose

No deploy: the platform builds and serves. No server code: the form and the diary
are the platform's endpoints beside the site. No design system: what the site looks
like is the point of writing it.

## Licence

MIT — see [LICENSE](LICENSE). The example site's photographs in `example/media/` were generated with Higgsfield for Brumy, the company that makes jtakeit, and are released under the same licence ([example/README.md](example/README.md)); its fonts are the SIL Open Font License's, installed from `@fontsource`.
