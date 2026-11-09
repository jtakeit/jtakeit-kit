import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The working tree's other jtk/ files, sent beside the catalogue so the
 * second judge — the settings, the entries, a price table's gaps, an add-on
 * nobody can take — answers in the same call, before any push. Everything under jtk/ but the catalogue itself, as
 * `{path, text}`; a site with no jtk/ yet sends none.
 * @param {string} root
 * @returns {{ path: string, text: string }[]}
 */
export function filesBeside(root) {
  const dir = join(root, 'jtk');
  if (!existsSync(dir)) return [];
  /** @type {{ path: string, text: string }[]} */
  const out = [];
  const walk = (/** @type {string} */ at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      // An entry's pictures are not the contract's, as the door's readJtk
      // has it.
      if (entry.isDirectory()) { if (entry.name !== 'media') walk(full); continue; }
      if (!entry.name.endsWith('.json')) continue;
      const rel = relative(root, full).split(sep).join('/');
      if (rel === 'jtk/catalogue.json') continue;
      // The dev session's file holds its watch key: never sent, as it is
      // never committed.
      if (rel === 'jtk/session.json') continue;
      out.push({ path: rel, text: readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
