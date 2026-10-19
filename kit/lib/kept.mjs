/**
 * Files a script addresses by name, given a name that carries their contents.
 *
 * ── why ─────────────────────────────────────────────────────────────────────
 *
 * The generator hashes what the HTML refers to — a stylesheet, an `<img>` —
 * and puts it under `/_astro/`, which the edge keeps in browsers for a year.
 * A film or a photograph a script picks by name is not referred to by any
 * attribute, so it has to live in `public/`, and `public/` keeps its names:
 * the edge serves it for a minute, and every returning visitor downloads the
 * hero film again (railtec, 19 October 2026: two megabytes).
 *
 * Declaring a lifetime for the directory (`cache` in `_meta.json`) is one
 * answer, and it costs the names: the platform then holds each one to its
 * contents for as long as was declared. This is the other answer, and the one
 * that costs nothing later — after the build, each file under the named
 * directories is copied under `/_astro/kept/` with a hash of its bytes in its
 * name, and every place the build wrote its address as a literal is pointed
 * at the copy. A new photograph is a new name by construction.
 *
 * ── what it does not do ─────────────────────────────────────────────────────
 *
 * It rewrites an address only where the build wrote it whole — `"/clips/
 * einsatz.mp4"` in a script, `src`, `data-src`, `url(…)`. An address a script
 * assembles (`'/scenes/scene-' + i + '.webp'`) cannot be found, so the
 * original stays where it was and keeps working, at its minute; the result
 * names every file nothing pointed at, so the site can write those addresses
 * out in full. The originals are never removed.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';

/** Where the copies go: under Astro's hashed directory, which the edge keeps for a year. */
export const KEPT_DIR = '_astro/kept';

/** The files whose text may name an address. */
const TEXT = new Set(['.html', '.js', '.mjs', '.css']);

const posix = (path) => path.split(sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** `scene-1.webp` and its bytes → `scene-1.3f9a1c2b.webp`. */
export function keptName(name, bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const ext = extname(name);
  return `${name.slice(0, name.length - ext.length)}.${hash}${ext}`;
}

/**
 * Copies the files under `dirs` of a build directory to hashed names and
 * points the build's literal references at them.
 *
 * @param {string} dist  the build directory
 * @param {{ dirs: string[]; base?: string }} options
 *   `dirs`, as they sit under `public/` — `['clips', 'scenes']`; `base`, the
 *   site's base path when it is not `/` (Astro's `base`)
 * @returns {{ kept: { from: string; to: string }[]; rewritten: number; unreferenced: string[] }}
 *   every copy as addresses, how many references were pointed at one, and the
 *   addresses no file named whole — still served by name, at the edge's minute
 */
export function keepByName(dist, { dirs, base = '/' } = {}) {
  if (!Array.isArray(dirs) || dirs.length === 0) return { kept: [], rewritten: 0, unreferenced: [] };
  const root = `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

  const kept = [];
  for (const one of dirs) {
    const dir = one.replace(/^\/+|\/+$/g, '');
    if (dir === '' || dir.startsWith('_astro') || dir.startsWith('.')) {
      throw new TypeError(`keepByName: "${one}" is not a directory of public/ (not the root, not _astro, not hidden)`);
    }
    const from = join(dist, dir);
    if (!existsSync(from)) continue;
    for (const file of walk(from)) {
      if (extname(file).toLowerCase() === '.html') continue;
      const inside = posix(relative(from, file));
      const hashed = posix(join(dirname(inside), keptName(inside.split('/').pop(), readFileSync(file))));
      const to = join(dist, KEPT_DIR, dir, hashed);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(file, to);
      kept.push({ from: `${root}${dir}/${inside}`, to: `${root}${KEPT_DIR}/${dir}/${hashed.replace(/^\.\//, '')}` });
    }
  }
  if (kept.length === 0) return { kept, rewritten: 0, unreferenced: [] };

  // One pattern for every address, longest first, bounded the way an address
  // is written: after a quote, a bracket, a space, `=` or `,` — or `&quot;`,
  // which is how a JSON list in a `data-` attribute reaches the HTML — and
  // before a quote, a bracket, a space, `,`, `?`, `#` or `&`. `/clips/a.mp4`
  // must not match inside `/clips/a.mp4.old` or `/x/clips/a.mp4`.
  const to = new Map(kept.map((one) => [one.from, one.to]));
  const escaped = [...to.keys()].sort((a, b) => b.length - a.length).map((one) => one.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<=["'\`(\\s=,]|&quot;|&#34;|&#39;)(${escaped.join('|')})(?=["'\`)\\s,?#&])`, 'g');

  const used = new Set();
  let rewritten = 0;
  const copies = join(dist, KEPT_DIR) + sep;
  for (const file of walk(dist)) {
    if (file.startsWith(copies) || !TEXT.has(extname(file).toLowerCase())) continue;
    const text = readFileSync(file, 'utf8');
    let changed = false;
    const next = text.replace(pattern, (address) => {
      used.add(address);
      rewritten += 1;
      changed = true;
      return to.get(address);
    });
    if (changed) writeFileSync(file, next);
  }

  return { kept, rewritten, unreferenced: kept.map((one) => one.from).filter((one) => !used.has(one)) };
}
