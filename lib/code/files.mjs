/**
 * The working copy as git would track it, and what of it may leave the machine.
 *
 * A push sends the files git would commit: the ones it tracks and the
 * untracked ones `.gitignore` does not exclude. Inside a git work tree git
 * itself answers (`git ls-files -co --exclude-standard`); outside one the kit
 * reads every `.gitignore` the way git does. Git on the machine is optional —
 * the server runs git, the machine only needs Node (wiki/88 · §1).
 *
 * The server refuses a manifest whole when one path in it is wrong (§3). Every
 * check here is that refusal said earlier, on the developer's machine and
 * before a byte leaves it, with every offending path at once. It is a
 * courtesy and not the gate: the server checks all of it again.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ignore from 'ignore';

/** The limits of §3, in the units the server counts them in (MiB, as `part_bytes` is). */
export const LIMITS = {
  files: 20_000,
  file: 50 * 1024 * 1024,
  total: 200 * 1024 * 1024,
  path: 4096,
};

/** Where this copy stands: a machine's position, not the site's, so it is never sent. */
export const STATE_FILE = '.jtakeit/code.json';

/** A refusal made here, before anything was sent: every offending path, each with its reason. */
export class Refusal extends Error {
  /** @param {string} message @param {{ path: string, why: string }[]} problems */
  constructor(message, problems = []) {
    super(message);
    this.problems = problems;
  }
}

/**
 * The git blob hash of a file's bytes — what `git hash-object` prints, so the
 * server can compare a manifest with a tree without being sent the file.
 * @param {Uint8Array} bytes
 */
export function blobHash(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/** Paths compared as git compares them: by their bytes, not by the locale. */
export const byBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

/**
 * What is never sent, and never mentioned: git's own directory, the installed
 * packages, the build output at the root, and this machine's position. These
 * are dropped silently because they are never source — a `.gitignore` that
 * forgot `node_modules` should not turn a push into a 300 MB upload.
 * @param {string} path
 */
export function neverSent(path) {
  const parts = path.split('/');
  return parts.includes('.git') || parts.includes('node_modules') || parts[0] === 'dist' || path === STATE_FILE;
}

/**
 * Why the server would refuse this path whatever the file holds, or null.
 * Mirrors §3: absolute, `..`, a backslash, a control character, longer than
 * 4096 bytes, a `.git` component in any case, `.gitmodules`.
 * @param {string} path
 */
export function pathProblem(path) {
  if (Buffer.byteLength(path) > LIMITS.path) return `is longer than ${LIMITS.path} bytes`;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f\\]/.test(path)) return 'has a backslash or a control character in its name';
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return 'is an absolute path';
  for (const part of path.split('/')) {
    if (part === '' || part === '.' || part === '..') return 'has an empty, "." or ".." component';
    const lower = part.toLowerCase();
    if (lower === '.git') return 'has a ".git" component (in any case), which git keeps for itself';
    if (lower === '.gitmodules') return 'is .gitmodules — the platform keeps no submodules';
  }
  return null;
}

/**
 * Why a file's name or bytes look like a secret, or null. The patterns are
 * the server's cheap ones (§3): GitHub's secret scanning is not there on our
 * private repositories, so this pair of checks is the only one there is.
 * @param {string} name the file's base name
 * @param {Buffer} bytes
 */
export function secretProblem(name, bytes) {
  if (name === '.env' || name.startsWith('.env.')) {
    return 'is an environment file, and secrets are never sent — add it to .gitignore (an example file can be called env.example)';
  }
  if (name === '.npmrc' && bytes.includes('_auth')) {
    return 'is an .npmrc with a registry credential (_authToken or _auth) — keep it out of the repository';
  }
  if (bytes.includes('PRIVATE KEY-----') && /-----BEGIN ([A-Z0-9]+ )*PRIVATE KEY-----/.test(bytes.toString('latin1'))) {
    return 'holds a private key (-----BEGIN … PRIVATE KEY-----)';
  }
  // The token shapes a scanner would recognise. Only the ones with a prefix
  // nothing else carries: a false alarm here stops a push with no way round.
  const text = bytes.includes('gh') || bytes.includes('_live_') ? bytes.toString('latin1') : '';
  if (/\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/.test(text)) return 'holds what looks like a GitHub token';
  if (/\b[sr]k_live_[A-Za-z0-9]{20,}\b/.test(text)) return 'holds what looks like a live Stripe secret key';
  return null;
}

/**
 * The paths git would commit, relative to `dir` and with `/` between parts —
 * or null when `dir` is not inside a git work tree (or git is not installed).
 * Run from `dir`, `ls-files` lists only what is beneath it, relative to it,
 * which is what a site inside a larger repository wants.
 * @param {string} dir
 */
function gitPaths(dir) {
  const run = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
  try {
    if (run(['rev-parse', '--is-inside-work-tree']).toString().trim() !== 'true') return null;
  } catch {
    return null;
  }
  // `-c` also lists a tracked file deleted from the disk; the caller skips
  // what is not there. An untracked repository inside this one is listed as
  // `dir/`, which the caller refuses as the directory it is.
  const out = run(['ls-files', '-co', '--exclude-standard', '-z']).toString('utf8');
  return [...new Set(out.split('\0').filter(Boolean))];
}

/**
 * Git's reading of `.gitignore`, done by hand for a copy without git: each
 * directory's file applies beneath it, a deeper file's rule outranks a
 * shallower one's, and an ignored directory is not descended into — so, as
 * with git, a file inside it cannot be un-ignored.
 * @param {string} root
 */
function walkPaths(root) {
  /** @type {string[]} */
  const out = [];
  /** @param {{ base: string, ig: ReturnType<typeof ignore> }[]} rules @param {string} path @param {boolean} isDir */
  const ignored = (rules, path, isDir) => {
    let verdict = false;
    for (const { base, ig } of rules) {
      const rel = base ? path.slice(base.length + 1) : path;
      const { ignored: yes, unignored: no } = ig.test(isDir ? `${rel}/` : rel);
      if (yes) verdict = true;
      else if (no) verdict = false;
    }
    return verdict;
  };
  /** @param {string} rel @param {{ base: string, ig: ReturnType<typeof ignore> }[]} inherited */
  const walk = (rel, inherited) => {
    const abs = rel ? join(root, rel) : root;
    const rules = [...inherited];
    const file = join(abs, '.gitignore');
    if (existsSync(file) && lstatSync(file).isFile()) rules.push({ base: rel, ig: ignore().add(readFileSync(file, 'utf8')) });
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (neverSent(path)) continue;
      const isDir = entry.isDirectory();
      if (ignored(rules, path, isDir)) continue;
      if (isDir) walk(path, rules);
      else out.push(path);
    }
  };
  walk('', []);
  return out;
}

/**
 * Every path of the working copy that git would commit, sorted by bytes.
 * `git: false` reads `.gitignore` by hand even inside a work tree (the tests
 * use it to show the two readings agree).
 * @param {string} dir
 * @param {{ git?: boolean }} [options]
 * @returns {{ paths: string[], via: 'git' | 'gitignore' }}
 */
export function listCopy(dir, { git = true } = {}) {
  const fromGit = git ? gitPaths(dir) : null;
  const paths = (fromGit ?? walkPaths(dir)).filter((p) => !neverSent(p.replace(/\/$/, '')));
  return { paths: paths.sort(byBytes), via: fromGit ? 'git' : 'gitignore' };
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * The manifest a push sends, or a Refusal naming every path that stops it.
 * Two passes: the first looks only at names and sizes, so a copy with 30 000
 * files or a 2 GB video is refused before a byte of it is read; the second
 * reads, hashes and looks for secrets.
 * @param {string} dir
 * @param {{ git?: boolean }} [options]
 * @returns {{ files: { path: string, mode: '100644' | '100755', hash: string, size: number }[], via: string }}
 */
export function manifestOf(dir, options) {
  const { paths, via } = listCopy(dir, options);
  if (paths.length > LIMITS.files) {
    throw new Refusal(`this copy lists ${paths.length} files; a site holds at most ${LIMITS.files} — is something that belongs in .gitignore missing from it?`);
  }
  /** @type {{ path: string, why: string }[]} */
  const problems = [];
  /** @type {{ path: string, mode: '100644' | '100755' }[]} */
  const regular = [];
  let total = 0;
  for (const listed of paths) {
    const path = listed.replace(/\/$/, '');
    const why = pathProblem(path);
    if (why) {
      problems.push({ path, why });
      continue;
    }
    let st;
    try {
      st = lstatSync(join(dir, path));
    } catch {
      continue; // tracked by git and deleted on disk: the push deletes it
    }
    if (st.isSymbolicLink()) {
      problems.push({ path, why: 'is a symbolic link — the platform keeps regular files only; put the file it points to in its place' });
    } else if (st.isDirectory()) {
      problems.push({ path, why: 'is a repository inside this one — the platform keeps regular files only' });
    } else if (!st.isFile()) {
      problems.push({ path, why: 'is not a regular file' });
    } else if (st.size > LIMITS.file) {
      problems.push({ path, why: `is ${mb(st.size)}; a file is at most 50 MB — video belongs in the media bucket` });
    } else {
      total += st.size;
      regular.push({ path, mode: st.mode & 0o100 ? '100755' : '100644' });
    }
  }
  if (total > LIMITS.total) {
    throw new Refusal(`this copy is ${mb(total)}; a site's code is at most 200 MB — video and large pictures belong in the media bucket`);
  }
  const files = [];
  for (const { path, mode } of regular) {
    const bytes = readFileSync(join(dir, path));
    const why = secretProblem(path.slice(path.lastIndexOf('/') + 1), bytes);
    if (why) problems.push({ path, why });
    else files.push({ path, mode, hash: blobHash(bytes), size: bytes.length });
  }
  if (problems.length) {
    problems.sort((a, b) => byBytes(a.path, b.path));
    throw new Refusal('refused here, before anything was sent:', problems);
  }
  return { files, via };
}

/**
 * What a pull tells the server this copy holds: every regular file git
 * would commit, with its hash. Nothing leaves but the hashes, so nothing
 * here is refused — a symlink or an `.env` is simply left out of the
 * comparison, and a write through a link is refused later, at the write.
 * @param {string} dir
 * @param {{ git?: boolean }} [options]
 */
export function holdingsOf(dir, options) {
  const files = [];
  for (const listed of listCopy(dir, options).paths) {
    const path = listed.replace(/\/$/, '');
    if (pathProblem(path)) continue;
    let st;
    try {
      st = lstatSync(join(dir, path));
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    // Not even the hash of an environment file leaves: a short secret's sha1
    // is a guess away from the secret, and the branch never holds one anyway.
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (name === '.env' || name.startsWith('.env.')) continue;
    files.push({ path, hash: blobHash(readFileSync(join(dir, path))) });
  }
  return files;
}
