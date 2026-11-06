/**
 * `jtk push` and `jtk pull` — a site's code kept on jtakeit, moved without git
 * on the machine and without a GitHub account (wiki/88 in the admin).
 *
 *   npx @jtakeit/astro push '<url>' [dir]    the working copy → the site's branch
 *   npx @jtakeit/astro pull '<url>' [dir]    the site's branch → the working copy
 *
 * The URL comes from the `push_code` or `pull_code` tool and is good for one
 * operation. After either command the copy equals the branch's tip, and
 * `.jtakeit/code.json` records that tip as the base of the next one.
 *
 *   lib/code/files.mjs   what the copy holds, and what may leave it
 *   lib/code/tar.mjs     the archives of the wire
 *   lib/code/write.mjs   what the server sends, judged and then written
 *   lib/code/wire.mjs    the URL, the token and the requests
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Refusal, STATE_FILE, blobHash, byBytes, holdingsOf, manifestOf } from './code/files.mjs';
import { pack } from './code/tar.mjs';
import { applyChange } from './code/write.mjs';
import { ServerError, client, parseCodeUrl } from './code/wire.mjs';

/** What the tunnel takes in one body, less a margin — used if the server names no size of its own. */
const PART_BYTES = 90 * 1024 * 1024;

export function usage() {
  return `  jtk push '<url>' [dir]          send the working copy (dir, or here) to the site's code on
                                  jtakeit; the URL is push_code's, good for one push
  jtk pull '<url>' [dir]          bring the working copy to the tip of the site's code — an
                                  empty or new dir is a clone; the URL is pull_code's`;
}

/**
 * Where this copy stood after its last push or pull, or an empty position.
 * @param {string} dir
 * @returns {{ site?: string, sha?: string, api?: string }}
 */
function readPosition(dir) {
  const file = join(dir, STATE_FILE);
  if (!existsSync(file)) return {};
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    if (value && typeof value === 'object') return value;
  } catch {
    // reported below
  }
  throw new Error(`${STATE_FILE} is not what jtk writes; delete it, and the next pull treats this copy as having no base`);
}

/**
 * The tip this copy now equals, recorded beside it. The site is the server's
 * if it says, otherwise what was recorded before.
 * @param {string} dir
 * @param {{ site?: string, sha: string, api: string }} position
 */
function writePosition(dir, { site, sha, api }) {
  const file = join(dir, STATE_FILE);
  mkdirSync(dirname(file), { recursive: true });
  const value = site ? { site, sha, api } : { sha, api };
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * A copy belongs to the platform it came from: a base sha from one API means
 * nothing to another, and sending it would read as a copy from nowhere.
 * @param {{ api?: string }} position @param {string} api
 */
function sameApi(position, api) {
  if (position.api && position.api !== api) {
    throw new Error(`this copy was last pushed or pulled at ${position.api}, and the URL is for ${api}. Pull into a fresh directory to work on that one.`);
  }
}

/**
 * Fetch what the branch changed and write it, with the paths it deleted.
 * @param {ReturnType<typeof client>} api @param {string} dir @param {string[]} changed @param {string[]} deleted
 */
async function bringIn(api, dir, changed, deleted) {
  const archive = changed.length ? await api.call('POST', '/fetch', { paths: changed }, 'bytes') : null;
  return applyChange(dir, { archive, asked: changed, deleted });
}

const strings = (value) => (Array.isArray(value) ? value.map(String) : []);
const size = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const count = (value) => (Array.isArray(value) ? value.length : value);

/**
 * @param {string[]} args
 * @param {{ cwd: string, out: (line: string) => void, fetch?: typeof fetch, git?: boolean }} io
 */
export async function push(args, io) {
  const target = parseCodeUrl(args[0]);
  const dir = resolve(io.cwd, args[1] ?? '.');
  if (!existsSync(dir)) throw new Error(`${args[1]} does not exist`);
  const position = readPosition(dir);
  sameApi(position, target.api);

  // Everything is judged before the first request: a refusal here sends nothing.
  const { files } = manifestOf(dir, { git: io.git });
  const byPath = new Map(files.map((f) => [f.path, f]));

  const api = client(target, { fetch: io.fetch });
  const answer = await api.call('POST', '/manifest', { base: position.sha ?? '', files });
  const need = strings(answer.need).sort(byBytes);
  const partBytes = Number.isSafeInteger(answer.part_bytes) && answer.part_bytes > 0 ? answer.part_bytes : PART_BYTES;

  let parts = 0;
  let sent = 0;
  if (need.length) {
    const entries = need.map((path) => {
      const listed = byPath.get(path);
      if (!listed) throw new Error(`the server asked for ${path}, which this copy did not list`);
      const data = readFileSync(join(dir, path));
      if (blobHash(data) !== listed.hash) throw new Error(`${path} changed while it was being pushed; push again`);
      return { path, data, mode: listed.mode === '100755' ? 0o755 : 0o644 };
    });
    const archive = gzipSync(pack(entries));
    sent = archive.length;
    for (let at = 0; at < archive.length; at += partBytes) {
      parts += 1;
      await api.call('PUT', `/parts/${parts}`, archive.subarray(at, at + partBytes), 'none');
    }
  }
  const done = await api.call('POST', '/done', { parts });
  if (typeof done?.sha !== 'string' || !done.sha) throw new Error('the server finished the push without naming its commit');

  const upstream = done.upstream ?? {};
  const moved = await bringIn(api, dir, strings(upstream.changed), strings(upstream.deleted));
  writePosition(dir, { site: done.site ?? position.site, sha: done.sha, api: target.api });

  io.out(`jtk push: ${done.sha}${done.repo ? ` on ${done.repo}` : ''}${done.created ? ', a new repository' : ''}`);
  if (done.nothing_changed) io.out('  nothing changed — the branch already held this copy');
  else io.out(`  sent ${need.length} of ${files.length} files${parts ? ` (${size(sent)}, ${parts} part${parts === 1 ? '' : 's'})` : ''}`);
  if (moved.written.length || moved.deleted.length) {
    io.out(`  the branch had moved; written here from it:`);
    for (const path of moved.written) io.out(`    ${path}`);
    for (const path of moved.deleted) io.out(`    ${path} (deleted)`);
  }
  if (done.imported) io.out(`  imported: ${count(done.imported.pages) ?? 0} pages${done.imported.created ? `, ${count(done.imported.created)} new` : ''}`);
  if (done.import_error) io.out(`  import_error: ${done.import_error}`);
}

/**
 * @param {string[]} args
 * @param {{ cwd: string, out: (line: string) => void, fetch?: typeof fetch, git?: boolean }} io
 */
export async function pull(args, io) {
  const target = parseCodeUrl(args[0]);
  const dir = resolve(io.cwd, args[1] ?? '.');
  mkdirSync(dir, { recursive: true });
  const position = readPosition(dir);
  sameApi(position, target.api);

  const files = holdingsOf(dir, { git: io.git });
  const fresh = !position.sha && readdirSync(dir).length === 0;
  const api = client(target, { fetch: io.fetch });
  const state = await api.call('POST', '/state', { base: position.sha ?? '', files });
  if (typeof state?.tip !== 'string' || !state.tip) throw new Error('the server answered without naming the tip');

  const conflicts = strings(state.conflicts);
  if (conflicts.length) {
    throw new ServerError(
      409,
      'conflict',
      `these files changed here and on the branch${position.sha ? ` since ${position.sha}` : ''}; nothing was written. ` +
        'Ask pull_code for a new URL, pull into an empty directory, carry your changes over, and push from there.',
      conflicts,
    );
  }
  const moved = await bringIn(api, dir, strings(state.changed), strings(state.deleted));
  writePosition(dir, { site: state.site ?? position.site, sha: state.tip, api: target.api });

  if (fresh) {
    io.out(`jtk pull: cloned ${moved.written.length} files at ${state.tip}`);
    return;
  }
  io.out(`jtk pull: at ${state.tip}`);
  if (!moved.written.length && !moved.deleted.length) io.out('  already there — nothing changed');
  for (const path of moved.written) io.out(`  ${path}`);
  for (const path of moved.deleted) io.out(`  ${path} (deleted)`);
}

/**
 * The command, its output and its exit status. Every line printed passes
 * through here with the token taken out, so not even an error quoting a
 * server's answer can put it on the screen.
 * @param {'push' | 'pull'} command
 * @param {string[]} args
 * @param {{ cwd?: string, out?: (line: string) => void, err?: (line: string) => void, fetch?: typeof fetch, git?: boolean }} [io]
 * @returns {Promise<number>}
 */
export async function main(command, args, io = {}) {
  let token = '';
  try {
    token = parseCodeUrl(args[0]).token;
  } catch {
    // reported by the command itself
  }
  const clean = (line) => (token ? line.split(token).join('<token>') : line);
  const out = (line) => (io.out ?? console.log)(clean(line));
  const err = (line) => (io.err ?? console.error)(clean(line));
  if (!args[0] || args[0] === '--help' || args[0] === '-h') {
    err(`usage:\n${usage()}`);
    return args[0] ? 0 : 1;
  }
  try {
    await (command === 'push' ? push : pull)(args, { cwd: io.cwd ?? process.cwd(), out, fetch: io.fetch, git: io.git });
    return 0;
  } catch (why) {
    if (why instanceof ServerError) {
      err(`jtk ${command}: ${why.code}${why.message ? ` — ${why.message}` : ''}`);
      for (const path of why.paths) err(`  ${path}`);
    } else if (why instanceof Refusal) {
      err(`jtk ${command}: ${why.message}`);
      for (const { path, why: reason } of why.problems) err(`  ${path} — ${reason}`);
    } else {
      err(`jtk ${command}: ${why instanceof Error ? why.message : why}`);
    }
    return 1;
  }
}
