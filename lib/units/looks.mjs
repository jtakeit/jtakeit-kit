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

/**
 * A design of the site's own (docs/looks.md): `"look": "custom"` in
 * `jtk/design.json`. It has no files of the kit's to lay — the site's are its
 * own — so a section `jtk add` lays on it comes in the bare look's, the
 * structure with no design, to be dressed in the site's. Any other word a
 * site wrote there is taken as the same: a custom site's agent named its look
 * «custom», the kit took it for Brumy's, and `jtk add` would have laid
 * Brumy's sections into it (20 November 2026).
 */
export const CUSTOM = 'custom';
/** The look a custom design's new sections come in. */
export const CUSTOM_BASE = 'bare';

/** Where a look's copy of a file of the example is: its own where it has one, else the example's. */
export function fileOf(path, look = 'brumy') {
  if (look === CUSTOM) look = CUSTOM_BASE;
  if (look !== 'brumy' && LOOKS.includes(look)) {
    const own = join(LOOKS_ROOT, look, path);
    if (existsSync(own)) return own;
  }
  return join(FILES, path);
}

/**
 * The look a site was laid out in, as its `jtk/design.json` says: Brumy's
 * where it says none, a look of the kit's by its name, and `custom` for any
 * other word — a design of the site's own, never taken for Brumy's.
 */
export function lookOf(tree) {
  let said;
  try {
    said = tree.json('jtk/design.json')?.look;
  } catch {
    said = undefined;
  }
  if (typeof said !== 'string' || said.trim() === '') return 'brumy';
  return LOOKS.includes(said) ? said : CUSTOM;
}
