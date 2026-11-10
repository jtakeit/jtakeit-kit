/**
 * Writing what the server sent into the working copy — the files a fetch
 * returns and the paths the branch no longer has.
 *
 * The kit checks what it writes as the server checks what it takes (wiki/88
 * · §2). The archive comes from across a network, and the next `npm install`
 * or `astro build` runs what it wrote, so every entry is judged before any of
 * them is written: one bad entry and nothing is touched. Refused are a path
 * that is absolute or climbs out with `..`, anything under `.git` (a hook
 * there runs on this machine at the next commit), anything but a regular
 * file, a path the fetch did not ask for, and a path that would pass through
 * a symbolic link already in the copy — the one way a well-formed relative
 * path still lands outside it.
 */
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Refusal, STATE_FILE, byBytes } from './files.mjs';
import { unpack } from './tar.mjs';

const KINDS = { 1: 'a hard link', 2: 'a symbolic link', 3: 'a character device', 4: 'a block device', 5: 'a directory', 6: 'a named pipe' };

/**
 * Why a path from the server may not be written or deleted here, or null.
 * @param {string} root the working copy
 * @param {string} path
 * @param {Set<string>} gone paths about to be deleted, which no longer stand in the way
 */
function targetProblem(root, path, gone) {
  // eslint-disable-next-line no-control-regex
  if (path === '' || path.startsWith('/') || /^[A-Za-z]:/.test(path) || /[\x00-\x1f\x7f\\]/.test(path)) {
    return 'is absolute or has a backslash or a control character';
  }
  const parts = path.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return 'has an empty, "." or ".." component';
  if (parts.some((p) => p.toLowerCase() === '.git')) return 'is under .git, which git keeps for itself';
  if (path === STATE_FILE) return "is this copy's own position, which the server never sends";
  const abs = resolve(root, path);
  if (!abs.startsWith(resolve(root) + sep)) return 'lands outside this copy';
  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join('/');
    if (gone.has(prefix)) break;
    let st;
    try {
      st = lstatSync(join(root, prefix));
    } catch {
      break; // nothing there yet, and nothing beneath it either
    }
    const last = i === parts.length;
    if (st.isSymbolicLink()) return last ? 'is a symbolic link in this copy' : `passes through ${prefix}, a symbolic link in this copy`;
    if (last && st.isDirectory()) return 'is a directory in this copy';
    if (!last && !st.isDirectory()) return `passes through ${prefix}, which is a file in this copy`;
  }
  return null;
}

/**
 * Judge a fetched archive and the paths to delete, then — only if every one
 * of them is sound — delete and write them. Throws a Refusal naming every
 * problem, having touched nothing.
 * @param {string} root the working copy
 * @param {{ archive?: Buffer | null, asked?: string[], deleted?: string[] }} change
 *   archive: the gzipped tar a fetch returned; asked: the paths the fetch
 *   asked for, which the archive must hold exactly; deleted: paths to remove
 * @returns {{ written: string[], deleted: string[] }}
 */
export function applyChange(root, { archive = null, asked = [], deleted = [] }) {
  /** @type {{ path: string, why: string }[]} */
  const problems = [];
  const gone = new Set(deleted);
  /** @type {string[]} */
  const removals = [];
  for (const path of deleted) {
    const why = targetProblem(root, path, new Set());
    if (why) problems.push({ path, why });
    else removals.push(path);
  }

  /** @type {Map<string, { data: Buffer, exec: boolean }>} */
  const writes = new Map();
  if (asked.length) {
    if (!archive) throw new Error('the server sent no archive for the files it named');
    let entries;
    try {
      entries = unpack(gunzipSync(archive));
    } catch (why) {
      throw new Error(why instanceof Error && why.message.startsWith('the archive') ? why.message : 'the archive from the server is not a gzipped tar');
    }
    const wanted = new Set(asked);
    for (const entry of entries) {
      const path = entry.type === '5' ? entry.path.replace(/\/+$/, '') : entry.path;
      const why = targetProblem(root, path, gone);
      if (why) {
        problems.push({ path, why });
      } else if (entry.type === '5') {
        // A directory entry (git archive writes them) makes nothing: the
        // files beneath it create what they need. Its path is still judged.
      } else if (entry.type !== '0' && entry.type !== '7') {
        problems.push({ path, why: `is ${KINDS[entry.type] ?? `an entry of type "${entry.type}"`} in the archive, not a regular file` });
      } else if (!wanted.has(path)) {
        problems.push({ path, why: 'is in the archive but was not asked for' });
      } else if (writes.has(path)) {
        problems.push({ path, why: 'is in the archive twice' });
      } else {
        writes.set(path, { data: entry.data, exec: (entry.mode & 0o100) !== 0 });
      }
    }
    for (const path of asked) {
      if (!writes.has(path) && !problems.some((p) => p.path === path)) problems.push({ path, why: 'was asked for and is not in the archive' });
    }
  }

  if (problems.length) {
    problems.sort((a, b) => byBytes(a.path, b.path));
    throw new Refusal('refused what the server sent; nothing was written:', problems);
  }

  for (const path of removals) {
    try {
      unlinkSync(join(root, path));
    } catch (why) {
      if (/** @type {NodeJS.ErrnoException} */ (why).code !== 'ENOENT') throw why;
    }
    // Directories the deletion emptied go too, as git leaves none behind.
    for (let dir = dirname(path); dir !== '.'; dir = dirname(dir)) {
      try {
        rmdirSync(join(root, dir));
      } catch {
        break;
      }
    }
  }
  const written = [...writes.keys()].sort(byBytes);
  for (const path of written) {
    const { data, exec } = /** @type {{ data: Buffer, exec: boolean }} */ (writes.get(path));
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    // Written beside the target and renamed over it, so a file is either the
    // old one or the new one — never half of the new one after an interrupt.
    const temp = join(dirname(abs), `.${path.slice(path.lastIndexOf('/') + 1)}.jtk-${randomBytes(4).toString('hex')}`);
    writeFileSync(temp, data, { mode: exec ? 0o755 : 0o644, flag: 'wx' });
    renameSync(temp, abs);
  }
  return { written, deleted: removals };
}
