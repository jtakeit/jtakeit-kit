#!/usr/bin/env node
/**
 * The scaffold's own files, as every version of @jtakeit/astro laid them out:
 * a hash of each, by path, so `jtk upgrade contract-3` can tell a file the
 * developer never touched — which it replaces with the door's — from one
 * they changed, which it lists with what it reads (jtakeit-core wiki/98 §7 · 1).
 *
 *   node scripts/scaffold-hashes.mjs           write lib/upgrade/scaffold.json
 *   node scripts/scaffold-hashes.mjs --check   exit 1 where the file is not what it would write
 *
 * A version is the template as it stood in the first commit of main that
 * carried it in package.json — the commit `release.mjs bump` made, from which
 * `publish` published. A version git does not hold yet, because it was just
 * bumped and is not committed, is the working tree's: `release.mjs bump`
 * runs this after it bumps, so the version going out is in the table it
 * goes out with.
 *
 * Every version git can name is here, back to 0.1.0; which of them the
 * upgrade is proved on is the pull request's to say.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCAFFOLDS, ownFile, tokened, untokened } from '../lib/upgrade.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'lib', 'upgrade', 'scaffold.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const hash = (text) => createHash('sha256').update(text).digest('hex');
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|pdf|zip)$/i;

/** Each version, and the first commit of main's history that says it. */
function versions() {
  const out = new Map();
  let commits = [];
  try {
    commits = git('log', '--first-parent', '--reverse', '--format=%H', 'HEAD', '--', 'package.json').trim().split('\n').filter(Boolean);
  } catch {
    // A tree without its history (a shallow clone in CI) names only the working tree's version.
  }
  for (const commit of commits) {
    let version;
    try {
      version = JSON.parse(git('show', `${commit}:package.json`)).version;
    } catch {
      continue;
    }
    if (typeof version === 'string' && !out.has(version)) out.set(version, commit);
  }
  return out;
}

/** The scaffold's own files of a commit's template: path → text. */
function filesAt(commit) {
  const listed = git('ls-tree', '-r', '--name-only', commit, '--', 'template').trim().split('\n').filter(Boolean);
  const out = new Map();
  for (const name of listed) {
    const path = name.slice('template/'.length);
    if (!ownFile(path) || BINARY.test(path)) continue;
    const text = git('show', `${commit}:${name}`);
    // A file `jtk create` fills a token into is the site's from its first day.
    if (!tokened(text)) out.set(path, text);
  }
  return out;
}

/** The working tree's. */
function filesHere() {
  const out = new Map();
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      if (entry === 'node_modules') continue;
      const file = join(at, entry);
      if (statSync(file).isDirectory()) walk(file);
      else {
        const path = relative(join(ROOT, 'template'), file).split(sep).join('/');
        if (!ownFile(path) || BINARY.test(path) || path.includes('node_modules/')) continue;
        const text = readFileSync(file, 'utf8');
        if (!tokened(text)) out.set(path, text);
      }
    }
  };
  walk(join(ROOT, 'template'));
  return out;
}

const table = { scaffolds: SCAFFOLDS, versions: [], files: {} };
const found = versions();
const here = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const sources = [...found.entries()].map(([version, commit]) => [version, () => filesAt(commit)]);
if (!found.has(here)) sources.push([here, filesHere]);
for (const [version, read] of sources) {
  table.versions.push(version);
  for (const [path, text] of read()) {
    const digest = hash(untokened(path, text));
    table.files[path] ??= {};
    (table.files[path][digest] ??= []).push(version);
  }
}
table.files = Object.fromEntries(Object.entries(table.files).sort(([a], [b]) => (a < b ? -1 : 1)));
const text = `${JSON.stringify(table, null, 1)}\n`;

if (process.argv.includes('--check')) {
  const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (now !== text) {
    console.error('lib/upgrade/scaffold.json is not what node scripts/scaffold-hashes.mjs writes — run it');
    process.exit(1);
  }
  console.log(`lib/upgrade/scaffold.json — ${table.versions.length} version(s), ${Object.keys(table.files).length} file(s), as written`);
  process.exit(0);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, text);
console.log(`lib/upgrade/scaffold.json — ${table.versions.length} version(s) (${table.versions[0]} to ${table.versions.at(-1)}), ${Object.keys(table.files).length} file(s)`);
