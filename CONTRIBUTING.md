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
  together, and nothing is published from a branch.
- The kit's checker is a copy of the platform's judge, kept honest by
  `jtk catalogue --judge` (see `kit/lib/codes.mjs`); a change to a code or a
  rule starts on the platform's side.
