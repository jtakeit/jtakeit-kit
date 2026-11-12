#!/usr/bin/env node
/**
 * The platform's fixture corpus of the merge, sat by the kit's merge
 * (jtakeit-core wiki/98 §1, 3: one rule, one implementation per runtime, one
 * corpus) — case by case, and where the two part, how.
 *
 *   node scripts/overlays.mjs <dir or file>                    cases on disk
 *   node scripts/overlays.mjs --core <repo> [--ref origin/main] the core's, read out of git
 *
 * The core keeps its cases at backend/api/sites/testdata/overlays/, in the
 * format kit/test/fixtures/overlays/ is written in. `--core` reads them at a
 * ref without checking it out, so a branch nobody merged yet can be sat.
 * Exit code: the number of cases that part, at most 100.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { casesIn, readCases, sitCase } from '../kit/test/overlay-corpus.mjs';

const CORE_DIR = 'backend/api/sites/testdata/overlays';
const argv = process.argv.slice(2);
const flag = (name) => {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? undefined : argv[at + 1];
};

let cases;
const core = flag('core');
if (core !== undefined) {
  const ref = flag('ref') ?? 'origin/main';
  const git = (...args) => execFileSync('git', ['-C', resolve(core), ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let names = [];
  try {
    names = git('ls-tree', '-r', '--name-only', ref, '--', CORE_DIR).split('\n').filter((one) => one.endsWith('.json'));
  } catch (why) {
    console.error(`overlays: ${core} has no ${ref}: ${why.message.split('\n')[0]}`);
    process.exit(1);
  }
  if (names.length === 0) {
    console.error(`overlays: ${ref} of ${core} has no cases at ${CORE_DIR}/`);
    process.exit(1);
  }
  cases = names.flatMap((name) => casesIn(`${ref}:${name}`, JSON.parse(git('show', `${ref}:${name}`))));
} else if (argv[0] !== undefined) {
  cases = readCases(resolve(argv[0]));
} else {
  console.error('overlays: say where the cases are — node scripts/overlays.mjs <dir>, or --core <repo> [--ref <ref>]');
  process.exit(1);
}

let parted = 0;
for (const { file, case: one } of cases) {
  const said = sitCase(one);
  if (said.length === 0) {
    console.log(`  ✓ ${one.name ?? file}`);
    continue;
  }
  parted += 1;
  console.log(`  ✗ ${one.name ?? file}  (${file})`);
  for (const line of said) console.log(`      ${line}`);
}
console.log(`\n${cases.length - parted} of ${cases.length} case(s) agree${parted > 0 ? `; ${parted} part` : ''}`);
process.exit(Math.min(parted, 100));
