import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The working tree's other jtk/ files, sent beside the catalogue so the
 * second judge — the settings, the entries, a price table's gaps, an add-on
 * nobody can take — answers in the same call, before any push. Everything under jtk/ but the catalogue itself, as
 * `{path, text}`; a site with no jtk/ yet sends none.
 *
 * `schema: true` for `jtk schema --judge`, which sends contract 3's schema as
 * the text: `jtk/schema.json` is then left out of the files as well, since
 * the platform refuses it among them (sites/layout3read.go, `sent`).
 * @param {string} root
 * @param {{ schema?: boolean }} [options]
 * @returns {{ path: string, text: string }[]}
 */
export function filesBeside(root, options = {}) {
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
      if (options.schema === true && rel === 'jtk/schema.json') continue;
      // The dev session's file holds its watch key: never sent, as it is
      // never committed.
      if (rel === 'jtk/session.json') continue;
      out.push({ path: rel, text: readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * What `--judge` sends to `POST /v1/registry/validate`: the catalogue or the
 * schema as text — in the field `catalogue` either way, the platform reading
 * the text as the contract it says — the files beside it, and the
 * credential, presented the way the admin API reads it. `jtk catalogue` and
 * `jtk schema` both send it.
 * @param {string} text
 * @param {{ path: string, text: string }[]} files
 */
export function judgeRequest(text, files) {
  const api = (process.env.JTK_API ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.JTK_TOKEN ?? '').trim();
  return {
    url: `${api}/v1/registry/validate`,
    init: {
      method: 'POST',
      headers: {
        // Two credentials, and the API reads each in its own place
        // (auth/authHandler.go): an agent's `jtk_…` token as a bearer, a
        // person's signed-in session as the `sid` cookie. This said once that
        // there were no bearer tokens in the app, which stopped being true
        // when agents got theirs; a `jtk_…` token sent as a cookie
        // is not read at all.
        ...(token.startsWith('jtk_') ? { authorization: `Bearer ${token}` } : { cookie: `sid=${token}` }),
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(files.length > 0 ? { catalogue: text, files } : { catalogue: text }),
    },
  };
}
