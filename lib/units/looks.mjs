/**
 * The example's looks (docs/looks.md): Brumy's, the example's own files
 * (example/files/), and each other look's own files under example/looks/<look>/
 * at the same paths — only those it draws differently: its tokens, its look,
 * its header, footer, button and sections. Every other file — the
 * declaration, the hours, the shop, the imprint — is the example's, the same
 * in every look.
 *
 * A module of its own, importing nothing of the kit's: `jtk create` and the
 * units both read it, and lib/copies.mjs, which the units import, imports
 * `jtk create`.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The example's own files, laid out at the same paths in a site — Brumy's look, the default. */
export const FILES = resolve(HERE, '..', '..', 'example', 'files');
/** The other looks' own files. */
export const LOOKS_ROOT = resolve(HERE, '..', '..', 'example', 'looks');
/** The looks: Brumy's first, the default, then each under example/looks/. */
export const LOOKS = ['brumy', ...(existsSync(LOOKS_ROOT) ? readdirSync(LOOKS_ROOT).filter((one) => !one.startsWith('.')).sort() : [])];

/** Where a look's copy of a file of the example is: its own where it has one, else the example's. */
export function fileOf(path, look = 'brumy') {
  if (look !== 'brumy' && LOOKS.includes(look)) {
    const own = join(LOOKS_ROOT, look, path);
    if (existsSync(own)) return own;
  }
  return join(FILES, path);
}

/** The look a site was laid out in, as its `jtk/design.json` says — Brumy's where it says none, or one the kit has not got. */
export function lookOf(tree) {
  let said;
  try {
    said = tree.json('jtk/design.json')?.look;
  } catch {
    said = undefined;
  }
  return typeof said === 'string' && LOOKS.includes(said) ? said : 'brumy';
}
