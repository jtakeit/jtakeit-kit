# @jtakeit/astro

> **What this is:** the starting point for a client website on [jtakeit](https://jtakeit.com) —
> an Astro project your AI agent writes, and the tool that checks it against the platform.
> **For:** developers and freelancers who build sites for small businesses.
> **Status:** early access. Building and previews are free; a site is paid for once it
> goes live. Connect your agent to the platform's MCP server at
> `https://mcp.jtakeit.com/mcp` (it signs you in through the browser); the steps that
> build, preview and launch a site need it. Everything in this repository runs without it.

The scaffold and the catalogue tool for a site on [jtakeit](https://jtakeit.com) —
the platform's contract as a working Astro project, ready to build on.

jtakeit is an agent-driven platform for building and running websites for clients:
the site is written by an agent in a repository, and the platform runs the panel the
business owner edits it in, the enquiries and the bookings, the backups and the
domain. What the platform holds a repository to is small — a `jtk/catalogue.json`
that validates, a `data-jtk-path` on every editable field, a `dist/` from an Astro
build — and this package is that contract with a page already on it.

This is the one scaffold the platform ships, and it is Astro's. The platform
builds whatever writes a `dist/` that keeps the contract; on another generator
the site is laid out by hand — the platform's guide *connecting a site*
(`jtakeit:///guides/connecting-a-site.md`), under *On another generator* — and takes the pieces worth not writing twice from
[`@jtakeit/kit`](https://github.com/jtakeit/jtakeit-kit/tree/main/kit), which this scaffold uses itself: the booking
form and the enquiry form as markup and as elements, `_meta.json` and the
specimen rule, a kit laid out, and the catalogue tool.

## Scaffold

```
npx @jtakeit/astro create <slug> --name "The Business" --locale de-CH
cd <slug> && npm ci && npm run dev
```

You get a static Astro project: a layout, a hero, a lead form posting to `/api/lead`
(the platform serves it), a booking form for the platform's diary, opening hours read
from `jtk/bookings.json`, pages for robots, sitemap and llms.txt, and
`src/content/blocks.ts` — the declaration of what the owner may edit. Nothing in it
decides how the site looks; every component is yours to replace.

A business that takes bookings starts from its **kit**, asked of the platform
by its kind (`GET /v1/kits/<kind>`; the kinds are at `/v1/kits`):

```
npx @jtakeit/astro create <slug> --locale uk --kit car_rental
```

A file of the kit's JSON is taken too — `--kit ./car_rental.json` — and
`--api` points at another platform than `https://api.jtakeit.com`.

The kit's collections, rates and settings are laid out — `blocks.ts`,
`jtk/bookings.json`, the rates as entries in the site's language — and the services'
listing is the booking page — the kit whole, nothing left out quietly. What it
leaves to the brief (the time zone, the prices, the cars) is printed at the end,
with where to read what it chose for the business — confirmation, cancellation,
payment, hand-over hours — to be said back to the developer and confirmed
(`jtakeit:///guides/the-brief.md`). Nothing in it is made up. The settings
record which kit and which version they came from (`kit`, `kit_version`): when
the kit is fixed later, the platform's judge says so to the site
(`JTK_W_KIT_BEHIND`), with what changed.

## The catalogue

```
npx @jtakeit/astro catalogue              # write jtk/catalogue.json, build, check it against dist/
npx @jtakeit/astro catalogue --emit-only  # write it and stop
```

`jtk/catalogue.json` is derived from `src/content/blocks.ts` and checked against the
built pages in both directions: every declared field is rendered with its path, and
every annotated path is declared. The platform's own validator is the authority —
`validate_catalogue` over MCP, or `--judge` here with `JTK_API` and `JTK_TOKEN` set —
and this tool sits its exam.

## Then, on the platform

1. Push the repository somewhere the platform's GitHub App can reach, and run
   `validate_catalogue` by site and ref once the site exists.
2. `create_site`, then `attach_repo` — it imports the branch.
3. `commit_and_build` — the first build; `get_build` until it settles. Later:
   commit, `import_branch`, `commit_and_build`. `trigger_build` rebuilds a site
   that has been built once, and refuses one that has not.
4. `get_preview_link` to look; the studio hands the owner's link to the client from
   the panel.

The whole of it, with the reasons, is in [docs/](docs/): `kit.md` first, then
`catalogue.md`, `pages.md`, `collections.md`, `lead-form.md`, `booking.md`,
`photos.md`, and the rest as you need them. The platform's own reference —
field kinds, modules, every error code — is what the MCP server hands an agent on
`initialize`: `jtakeit:///` resources, starting with `jtakeit:///guides/start.md`.
It is not published on the web yet.

## Not here, on purpose

No deploy: the platform builds and serves. No server code: the form and the diary
are the platform's endpoints beside the site. No design system: what the site looks
like is the point of writing it.
