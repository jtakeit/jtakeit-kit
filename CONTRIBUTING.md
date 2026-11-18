# Contributing

Two packages, one repository: `@jtakeit/astro` (the scaffold, at the root)
and `@jtakeit/kit` (the framework-free half, in `kit/`). The platform they
talk to holds the contract: what the kit emits is judged there, and the
reference is the platform's `jtakeit:///reference/contract.md`, read through its MCP
server.

- `npm ci && npm test` runs the smoke test of the scaffold and the kit's
  tests. `node bin/jtk.mjs create /tmp/probe --kit salon` lays a site out
  from the checkout.
- `main` takes no direct push: a branch, a pull request, the checks green,
  a merge. The checks are the tests, a dry pack of both packages, and a
  scaffold laid out and built.
- A release is `npm run release -- bump …` and `npm run release -- publish`
  (`scripts/release.mjs`): the versions in three files and the lockfile move
  together, and nothing is published from a branch. A fix to the kit, the
  scaffold or the example after `bump` changes the tarball the template's
  lockfile names: `npm run release -- bump --again` writes it again at the same
  versions, and `publish` refuses until it has.
- The kit's checker is a copy of the platform's judge, kept honest by
  `jtk catalogue --judge` (see `kit/lib/codes.mjs`); a change to a code or a
  rule starts on the platform's side.
- The example site `jtk create` lays out (`example/`, `lib/units/`) is in
  the design system of Brumy (brumy.ch), the company that makes jtakeit: its
  look was taken from Brumy's own site and published here by Brumy. Its
  words change in `lib/units/units.mjs`, and then `node
  scripts/example-prints.mjs` writes the fingerprints again (append-only;
  `npm test` checks them); its photographs are Brumy's (`example/README.md`).
  Another look (`example/looks/<look>/`, docs/looks.md) holds only the files
  it draws differently, at the same paths; a component's behaviour — its
  annotations, anchors, forms, scripts — changes in both looks at once, and
  the shop, the hours and the declaration are the example's in every look.
