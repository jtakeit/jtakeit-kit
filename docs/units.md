# The example's units: `jtk add`, `jtk remove`, `--without`

`jtk create` lays out an example site (docs/scaffold.md). Each of its sections,
and each module a brief may add, is a **unit**: a manifest in
`lib/units/units.mjs` of what it owns, which the commands apply part by part
(jtakeit-core wiki/110 §3).

| part | where | added | taken away |
| --- | --- | --- | --- |
| block types | `BLOCKS` in `src/content/blocks.ts` | after the nearest unit before it | by `type` |
| collections | `COLLECTIONS` | the same | by `name`, with their entries |
| the section | `SECTIONS` in `src/components/sections/index.ts`, and its component | a line and its import; the file | the line and the import; the file where it is still the scaffold's |
| page blocks | `jtk/pages/*.json`, at the unit's place in the example's order | with the example's words and a fixed `_key` | every block of its types, from every page |
| translations | `<file>.<locale>.json` beside each | the example's words in each language the example has (German, English) | the unit's `_key`s, from every translation |
| pages | `jtk/pages/services.json` | written | deleted, with their translations |
| entries | `jtk/entries/<collection>/` | the example's | deleted |
| navigation | `header.nav` in `jtk/shared.json` | an item with its label and link | every item whose link is the unit's |
| photographs | `src/assets/example-<name>.jpg` | copied | deleted where nothing names them and they are still the example's bytes |

The sections: `hero`, `values`, `services`, `gallery`, `team`,
`testimonials`, `questions`, `contact`. The site's skeleton — the header, the
footer, the shared contacts and hours, the privacy page, the imprint and the
form's own block — is no unit and is never removed.

## At create

```
npx @jtakeit/astro create <slug> --without team,testimonials
```

lays the example out without those sections: the same tree as `create`
followed by `remove team testimonials`, ids aside.

## The photographs, now and later

The example's photographs are files of the site (`src/assets/example-*.jpg`)
named in the content by their slot, until the media library has a door for an
agent (jtakeit-core wiki/108, `jtk media push`). Then the one function that
says where a photograph is and what the content calls it — `placeOf` in
`lib/units/photos.mjs` — names them by library keys under
`media/jtk-example/<hash16>.jpg`, and the push adopts the slots already laid.
`example/prints.json` holds each photograph's hash, so the platform's advice
recognises it on either side of the move.
