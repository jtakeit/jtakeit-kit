#!/usr/bin/env node
/**
 * The release, without touching a file by hand.
 *
 *   node scripts/release.mjs bump --kit minor --astro minor   [--dry-run]
 *   node scripts/release.mjs bump --kit 0.3.0 --astro 0.5.0   [--dry-run]
 *   node scripts/release.mjs publish                          [--dry-run]
 *
 * `bump` sets the kit's version, the scaffold's version, and the kit as a
 * dependency in the two places that name it — the root package and the
 * template a new site is laid out from — then refreshes the lockfile and
 * runs the tests. A version has to be above both what git holds and what
 * npm already has, because a release once went out from a working tree that
 * was never merged, and git said 0.3.0 while npm said 0.4.0.
 *
 * `publish` publishes the kit first and the scaffold second (the scaffold
 * depends on the kit), from a clean tree on main, refusing a version npm
 * already has, and checks each publish by asking npm back.
 *
 * Neither touches git beyond reading it: the commit, the branch and the pull
 * request are yours, so the release is reviewed like anything else.
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name) => { const at = argv.indexOf(`--${name}`); return at === -1 ? undefined : argv[at + 1]; };
const dry = argv.includes('--dry-run');

const FILES = {
  root: join(ROOT, 'package.json'),
  kit: join(ROOT, 'kit', 'package.json'),
  template: join(ROOT, 'template', 'package.json'),
};
const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJSON = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  if (dry) return;
  const out = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (out.status !== 0) { console.error(`${cmd} failed`); process.exit(out.status ?? 1); }
};

/** What npm has, or 0.0.0 for a package not yet there. */
function onNpm(name) {
  try { return sh(`npm view ${name} version`); } catch { return '0.0.0'; }
}

/**
 * npm says a published version "may take a few minutes to become
 * available", and it means it: the first release stopped here with the kit
 * published and the scaffold not, because the registry answered the old
 * version for a minute. So: ask again, every ten seconds, for three minutes.
 */
async function untilNpmHas(name, version) {
  for (let tried = 0; tried < 18; tried++) {
    if (onNpm(name) === version) return true;
    await new Promise((done) => setTimeout(done, 10_000));
    process.stdout.write('.');
  }
  return false;
}
/**
 * The kit as `npm publish` will upload it: `npm pack` makes the same bytes
 * publish does (fixed mtimes, sorted entries), so its integrity is the
 * integrity npm will record.
 */
function packedKit() {
  const [packed] = JSON.parse(sh('npm pack --workspace kit --dry-run --json'));
  return { version: packed.version, integrity: packed.integrity };
}

const TEMPLATE_LOCK = join(ROOT, 'template', 'package-lock.json');
const KIT_IN_LOCK = 'node_modules/@jtakeit/kit';

/**
 * The template's lockfile names the kit by version, and npm cannot lock a
 * version that is not on the registry — which the kit about to be released
 * is not: the first release of a new kit stopped here with ETARGET
 * (9 October 2026). So, before the kit is published, its entry is written
 * from the tarball publish will upload: the same integrity, the registry's
 * address. `publish` checks the tree still packs to that tarball before the
 * kit goes out, and that npm holds the same bytes afterwards.
 */
function templateLockNamesKit(version, integrity) {
  const lock = JSON.parse(readFileSync(TEMPLATE_LOCK, 'utf8'));
  const entry = lock.packages[KIT_IN_LOCK];
  if (entry === undefined) { console.error(`${TEMPLATE_LOCK} has no ${KIT_IN_LOCK}; install the template once`); process.exit(1); }
  lock.packages[''].dependencies['@jtakeit/kit'] = version;
  lock.packages[KIT_IN_LOCK] = {
    ...entry,
    version,
    resolved: `https://registry.npmjs.org/@jtakeit/kit/-/kit-${version}.tgz`,
    integrity,
  };
  writeFileSync(TEMPLATE_LOCK, JSON.stringify(lock, null, 2) + '\n');
}

function kitInTemplateLock() {
  const lock = JSON.parse(readFileSync(TEMPLATE_LOCK, 'utf8'));
  return lock.packages[KIT_IN_LOCK] ?? { version: '', integrity: '' };
}

const parse = (v) => v.split('.').map(Number);
const greater = (a, b) => { const [x, y] = [parse(a), parse(b)]; for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; };
const max = (a, b) => (greater(a, b) ? a : b);
function next(current, asked) {
  if (/^\d+\.\d+\.\d+$/.test(asked)) return asked;
  const [major, minor, patch] = parse(current);
  switch (asked) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: console.error(`--kit/--astro take major, minor, patch or a version, not "${asked}"`); process.exit(1);
  }
}

if (command === 'bump') {
  const root = readJSON(FILES.root), kit = readJSON(FILES.kit), template = readJSON(FILES.template);
  // From the higher of git's and npm's: a release that went out unmerged
  // must not be released again under the same number.
  const kitNow = max(kit.version, onNpm(kit.name));
  const astroNow = max(root.version, onNpm(root.name));
  const kitNext = flag('kit') ? next(kitNow, flag('kit')) : kitNow;
  const astroNext = flag('astro') ? next(astroNow, flag('astro')) : undefined;
  if (!flag('kit') && !flag('astro')) { console.error('say what to bump: --kit minor and/or --astro minor'); process.exit(1); }
  if (flag('kit') && !greater(kitNext, kitNow)) { console.error(`kit ${kitNext} is not above ${kitNow}`); process.exit(1); }
  if (astroNext && !greater(astroNext, astroNow)) { console.error(`astro ${astroNext} is not above ${astroNow}`); process.exit(1); }
  if (flag('kit') && !astroNext) { console.error('a new kit needs a new scaffold too (its dependency moves): add --astro patch'); process.exit(1); }

  console.log(`kit   ${kit.version} (npm ${onNpm(kit.name)}) → ${kitNext}`);
  console.log(`astro ${root.version} (npm ${onNpm(root.name)}) → ${astroNext ?? root.version}`);
  console.log(`the kit as a dependency: root ${root.dependencies['@jtakeit/kit']} → ${kitNext}, template ${template.dependencies['@jtakeit/kit']} → ${kitNext}`);
  if (!dry) {
    kit.version = kitNext; writeJSON(FILES.kit, kit);
    root.version = astroNext ?? root.version; root.dependencies['@jtakeit/kit'] = kitNext; writeJSON(FILES.root, root);
    template.dependencies['@jtakeit/kit'] = kitNext; writeJSON(FILES.template, template);
  }
  run('npm', ['install', '--no-audit', '--no-fund']);
  // The template's own lockfile too: it is what every new site runs `npm ci`
  // against, and a release went out with it a version behind — the builder's
  // image refused to install, and so would every site laid out from it. npm
  // writes it when the kit is on the registry; before that, the entry is
  // written from the tarball publish will upload (templateLockNamesKit).
  if (onNpm(kit.name) === kitNext) {
    run('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund', '--prefix', 'template']);
  } else {
    console.log(`${kit.name}@${kitNext} is not on npm yet: the template's lockfile names the tarball publish will upload`);
    if (!dry) templateLockNamesKit(kitNext, packedKit().integrity);
  }
  // The scaffold this release lays out, hashed beside every one before it,
  // so `jtk upgrade` can tell a site's untouched files from its own
  // (scripts/scaffold-hashes.mjs; jtakeit-core wiki/98 §7 · 1).
  run('node', ['scripts/scaffold-hashes.mjs']);
  run('npm', ['test']);
  console.log(`
Done. What is left is yours:
  git checkout -b release/${astroNext ?? root.version}
  git commit -am "kit ${kitNext}, astro ${astroNext ?? root.version}"
  git push -u origin release/${astroNext ?? root.version}      # then the pull request, then merge
  git checkout main && git pull
  node scripts/release.mjs publish`);
  process.exit(0);
}

if (command === 'publish') {
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  const dirty = sh('git status --porcelain');
  if (branch !== 'main' || dirty !== '') { console.error(`publish from a clean main: on ${branch}, ${dirty === '' ? 'clean' : 'with changes'}`); process.exit(1); }
  sh('git fetch -q origin main');
  if (sh('git rev-parse HEAD') !== sh('git rev-parse origin/main')) { console.error('main is not what origin has: git pull first'); process.exit(1); }
  const root = readJSON(FILES.root), kit = readJSON(FILES.kit), template = readJSON(FILES.template);
  if (root.dependencies['@jtakeit/kit'] !== kit.version || template.dependencies['@jtakeit/kit'] !== kit.version) {
    console.error(`the kit is ${kit.version} and is depended on as ${root.dependencies['@jtakeit/kit']} (root) / ${template.dependencies['@jtakeit/kit']} (template): run bump`); process.exit(1);
  }
  if (onNpm(kit.name) === kit.version && onNpm(root.name) === root.version) {
    console.error(`${kit.name}@${kit.version} and ${root.name}@${root.version} are both on npm already: nothing to publish`); process.exit(1);
  }
  run('npm', ['test']);
  // One at a time, the kit first; a package npm already has at this version
  // is skipped, so a run that stopped halfway is picked up where it stopped.
  if (onNpm(kit.name) === kit.version) {
    console.log(`${kit.name}@${kit.version} is on npm already — skipping`);
  } else {
    // The template's lockfile was written from a tarball before the kit
    // existed on npm (bump); the tree must still pack to that tarball, or
    // every new site's `npm ci` fails on the integrity.
    const named = kitInTemplateLock();
    const packed = packedKit();
    if (named.version === kit.version && named.integrity !== packed.integrity) {
      console.error(`the template's lockfile names a ${kit.name}@${kit.version} tarball this tree no longer packs — the kit changed since bump; run bump again (same versions) and merge that`); process.exit(1);
    }
    run('npm', ['publish', '--workspace', 'kit', '--access', 'public']);
    if (!dry && !(await untilNpmHas(kit.name, kit.version))) { console.error(`\nnpm still does not have ${kit.name}@${kit.version}; look at npmjs.com, then run publish again`); process.exit(1); }
    if (!dry) {
      const held = sh(`npm view ${kit.name}@${kit.version} dist.integrity`);
      if (held !== named.integrity) {
        console.error(`npm holds ${kit.name}@${kit.version} with a different integrity than the template's lockfile names:\n  lockfile ${named.integrity}\n  npm      ${held}\nRefresh the lockfile — npm install --package-lock-only --no-audit --no-fund --prefix template — commit, merge, then run publish again for the scaffold.`);
        process.exit(1);
      }
    }
  }
  if (onNpm(root.name) === root.version) {
    console.log(`${root.name}@${root.version} is on npm already — skipping`);
  } else {
    run('npm', ['publish', '--access', 'public']);
    if (!dry && !(await untilNpmHas(root.name, root.version))) { console.error(`\nnpm still does not have ${root.name}@${root.version}; look at npmjs.com, then run publish again`); process.exit(1); }
  }
  console.log(`
Published ${kit.name}@${kit.version} and ${root.name}@${root.version}.
Next, in jtakeit-core: backend/api/sitebuild/scaffold.version → ${root.version}`);
  process.exit(0);
}

console.error(`node scripts/release.mjs bump --kit <minor|patch|x.y.z> --astro <minor|patch|x.y.z> [--dry-run]
node scripts/release.mjs publish [--dry-run]`);
process.exit(1);
