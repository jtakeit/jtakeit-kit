# The example's units: `jtk add`, `jtk remove`, `jtk units`

`jtk create` lays out an example site (docs/scaffold.md). Each of its sections,
and each module a brief may add, is a **unit**: a manifest in `lib/units/` of
what it owns, which these commands apply part by part (jtakeit-core wiki/110 §3).

```
npx @jtakeit/astro units                                what the site has, what can be added
npx @jtakeit/astro add <section> [--after <type>|--before <type>]
                                                        hero | values | services | gallery | team
                                                        | testimonials | questions | contact — again,
                                                        with the example's words and photographs
npx @jtakeit/astro add blog                             the journal: /blog, two example posts,
                                                        the latest on the home page, «Journal» in the menu
npx @jtakeit/astro add booking --kind <kind> [--api <url>]
                                                        a booking kit of the platform's, mapped onto
                                                        the example (below); --kit <file> for a file
npx @jtakeit/astro remove <section|module…> [--force]
npx @jtakeit/astro create <slug> --without team,testimonials --blog --kit salon
```

Every command takes `--root <dir>` and `--dry-run`, which prints the plan file by
file and writes nothing. It exits 0 when the tree is already as asked, prints
what it changed and what it left, and the next steps — `npx @jtakeit/astro
schema`, then `validate_schema`. It commits nothing: `git diff` shows exactly its
change. `jtk create` commits, as always.

`create --blog` is `create` then `add blog`; `create --kit <kind>` (or `--kind`)
is `create` then `add booking --kind <kind>`. One implementation, two roads: the
kit's tests hold them equal, ids aside. `shop` and `events` are refused with the
page that says when.

## What a unit owns

| part | where | added | taken away |
| --- | --- | --- | --- |
| block types | `BLOCKS` in `src/content/blocks.ts` | after the nearest unit before it | by `type`, where no other unit uses it |
| collections | `COLLECTIONS` | the same | by `name`, with their entries |
| statements | the foot of `blocks.ts` (the blog's two lines) | appended | taken out |
| the section | `SECTIONS` in `src/components/sections/index.ts`, and its component | a line and its import; the file | the line and the import; the file where it is still the scaffold's |
| page blocks | `jtk/pages/index.json`, at the unit's place in the example's order (or `--after`/`--before`) | with the example's words and a fixed `_key` | every block of its types, from every page |
| translations | `<file>.<locale>.json` beside each | the example's words in each language the example has (German, English) | the unit's `_key`s, from every translation |
| pages | `jtk/pages/services.json` | written | deleted, with their translations |
| entries | `jtk/entries/<collection>/` | the example's | deleted — when still the example's |
| navigation | `header.nav` in `jtk/shared.json` | an item, before the next unit's | every item whose link is the unit's |
| photographs | `src/assets/media/jtk-example/<hash16>.jpg` (git-ignored), a post's beside it | copied | deleted where nothing names them and they are still the example's bytes |

The site's skeleton — the header, the footer, the shared contacts and hours, the
privacy page, the imprint and the form's own block (`cta_banner`) — is no unit:
`jtk remove header` says why, and how to do it by hand. `remove contact` takes the
contact section off the page and keeps the form's block declared.

## When the agent has changed the files

- **`blocks.ts` is edited in place**, by a block's `type`, a collection's `name`
  and a map's key, never by position: comments, blank lines and everything the
  unit does not own stay. A table that is not a literal — a spread, a call, a
  value made elsewhere — is refused with the line to change by hand, and nothing
  is written.
- **A component** whose bytes are the scaffold's — this package's, or any
  released version's (`lib/upgrade/scaffold.json`, `example`) — is deleted by
  `remove`; one the agent changed is taken out of `SECTIONS`, left, and named.
  `--force` deletes it.
- **Content** is removed only where every value is still the example's, in
  either language it is written in. Otherwise `remove` refuses and names what
  it would lose — `jtk/entries/services/the-work.json · fields.title says
  «Herrenschnitt» — not the example's` — and writes nothing; `--force` removes
  them. The form's labels are anybody's and never block a removal. On a launched
  site the words are the panel's: pull first (`git pull`, or `pull_code` and
  `jtk pull`).
- **A collection a module reads** stays while it reads it: `remove services` with
  bookings on is refused — `remove booking` first.

## `add booking`

The kit is the platform's (`GET /v1/kits/<kind>`), laid out by the same mapping
as `jtkit apply` (`@jtakeit/kit/kits`, `kitIn3`), and mapped onto the example:

- **The price list.** Every kit's is `services`. Where the kit's type is the
  example's `service`, the kit's fields join it — the kit's definition where both
  have a field — and the example's services stay, photographs and all. A kit
  whose price list is another type — a hotel's tariffs, a restaurant's seatings,
  a course — takes the collection over: the example's services section, its
  page and its entries give way (refused where a person wrote in them, unless
  `--force`), the hero's second button leads to the kit's page, and the command
  says so.
- **The people.** For a salon or a clinic the example's `team` becomes the kit's
  resources (`masters`, `doctors`): the same ids and files, `portrait` as the
  kit's `cover`, `role` and `bio` kept as fields of the kit's type; `team_list`
  draws them. For any other kind the team stays as it is.
- **The hours.** The shared `hours` rows become the diary's `settings.hours` —
  the same shape, the same `_key`s — and the footer and the form's card read them
  there, so the site never types its hours twice. The note stays shared.
- **The button.** The header's button leads to the page the diary books on, the
  services' page, where the template's booking form is.
- **What the kit asks** is printed: ask, never make up. Paid online or on the
  spot is the brief's question, never a flag.

Every element the kit adds to `blocks.ts` carries a line saying so;
`remove booking` takes those, puts the example's service and team back, moves the
hours back into the shared text, and leaves the price list.

## The photographs

The example's photographs are named in the content as keys of the media
library, of a reserved pseudo-site: `media/jtk-example/<hash16>.jpg`, the
first sixteen hex digits of the file's SHA-256 (jtakeit-core wiki/108,
wiki/110 §2.6). Their files are copied to `src/assets/media/jtk-example/`
(git-ignored), a post's beside the post, so the site draws them on a laptop.
`jtk media push` — or `jtk push --media` — puts them in the site's own library
and writes `media/<site>/<same hash16>.jpg` over them ([media.md](media.md)).
The one function that says where a photograph is and what the content calls it
is `placeOf` in `lib/units/photos.mjs`. A site laid out by 0.17.0 named them by
slot (`example-hero`, `src/assets/example-hero.jpg`); the same push adopts
those. `example/prints.json` holds each photograph's hash, so the platform's
advice recognises it on either side of the move.

## For the platform

The units are pure file transforms (`lib/units/index.mjs`: `treeOf`, `addUnit`,
`removeUnit`) with no network, no `npm` and no TypeScript of the site's — what a
workspace with no shell needs for a later `site_unit` tool (wiki/110 §6).
