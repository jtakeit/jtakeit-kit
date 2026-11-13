/**
 * `jtk add`, `jtk remove`, `jtk units` (jtakeit-core wiki/110 §3.1):
 *
 *   jtk add <unit…> [--after <type> | --before <type>]     a section, again, with the example's words
 *   jtk add blog                                           the journal, two example posts
 *   jtk add booking --kind <kind> [--api <url>]            a booking kit, mapped onto the example
 *   jtk remove <unit…> [--force]                           a section or a module, part by part
 *   jtk units                                              what this site has, what can be added
 *
 * Every one takes `--root <dir>` and `--dry-run`, which prints the plan file
 * by file and writes nothing. Nothing is committed: `git diff` shows exactly
 * the change. A command whose tree is already as asked exits 0 and says so.
 */
import { resolve } from 'node:path';
import { API, loadKit } from '@jtakeit/kit/kits';
// index.mjs before modules.mjs: the modules reach lib/create.mjs, which reaches back here.
import { ORDER, SKELETON, UNITS, addUnit, removeUnit, treeOf, unitPresent } from './index.mjs';
import { LATER } from './modules.mjs';
import { seedFormWords } from '../copies.mjs';

export function usage() {
  return `jtk units [--root <dir>]          what this site has of the example, and what can be added
  jtk add <section|module…> [--after <type>|--before <type>] [--kind <kind>] [--root <dir>] [--dry-run]
                                  ${ORDER.filter((one) => one.kind === 'section').map((one) => one.name).join(' | ')}
                                  — laid in again with the example's words and photographs;
                                  blog | booking --kind <kind> [--api <url>]
  jtk remove <section|module…> [--force] [--root <dir>] [--dry-run]
                                  a unit's types, section, words, entries, navigation and photographs;
                                  words that are not the example's are refused without --force`;
}

const say = (lines) => lines.forEach((one) => console.log(`  ${one}`));

/**
 * @param {'add' | 'remove' | 'units'} command
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function main(command, argv) {
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (name) => argv.includes(`--${name}`);
  const valued = new Set(['--root', '--after', '--before', '--kind', '--kit', '--api', '--page']);
  const names = argv.filter((one, i) => !one.startsWith('--') && !valued.has(argv[i - 1]));
  const root = resolve(flag('root') ?? process.cwd());
  const dryRun = has('dry-run');
  const tree = treeOf(root);
  if (!tree.exists('src/content/blocks.ts') || !tree.exists('jtk/schema.json')) {
    console.error(`jtk ${command}: ${root} is not a contract-3 site laid out by jtk create (no src/content/blocks.ts, or no jtk/schema.json) — --root <dir>`);
    return 1;
  }

  if (command === 'units') {
    console.log(`The example's units on ${root}:\n`);
    for (const unit of ORDER) {
      const on = unitPresent(tree, unit);
      console.log(`  ${on ? '●' : '○'} ${unit.name.padEnd(13)} ${unit.kind.padEnd(8)} ${unit.about}`);
    }
    console.log('\n  ● there — npx @jtakeit/astro remove <name>     ○ not there — npx @jtakeit/astro add <name>');
    console.log(`  The site's own, never removed: ${Object.keys(SKELETON).filter((one) => one !== 'site').join(', ')}.`);
    return 0;
  }

  if (names.length === 0) {
    console.error(`jtk ${command}: which? — ${ORDER.map((one) => one.name).join(', ')}\n\n${usage()}`);
    return 1;
  }
  if (flag('page') !== undefined && flag('page') !== '/') {
    console.error(`jtk ${command}: --page ${flag('page')} — the example's sections are the home page's; another page takes a section by hand (src/components/sections/)`);
    return 1;
  }
  for (const name of names) {
    if (SKELETON[name]) {
      console.error(`jtk ${command}: ${name} is not a unit — ${SKELETON[name]}`);
      return 1;
    }
    if (LATER[name]) {
      console.error(`jtk ${command}: ${LATER[name]}`);
      return 1;
    }
    if (!UNITS[name]) {
      console.error(`jtk ${command}: «${name}» is none of the example's units — ${ORDER.map((one) => one.name).join(', ')} (npx @jtakeit/astro units)`);
      return 1;
    }
  }

  const did = [];
  const kept = [];
  const faults = [];
  const questions = [];
  try {
    for (const name of names) {
      const unit = UNITS[name];
      if (command === 'add') {
        const options = { after: flag('after'), before: flag('before'), force: has('force') };
        if (name === 'booking') {
          const asked = flag('kind') ?? flag('kit');
          if (!asked) {
            console.error('jtk add booking: which kit? --kind salon (or clinic, hotel, car_rental… — the platform\'s GET /v1/kits), or --kit <file>');
            return 1;
          }
          options.kit = await loadKit(asked, flag('api') ?? process.env.JTK_API_URL ?? API);
        }
        const before = unitPresent(tree, unit);
        const parts = addUnit(tree, unit, options);
        if (unit.name === 'contact' && !dryRun) did.push('(the form\'s words are written in every language after)');
        did.push(...parts.map((one) => `${name}: ${one}`));
        if (parts.questions) questions.push(...parts.questions);
        if (parts.length === 0 || (before && parts.length === 0)) did.push(`${name}: already there — nothing to add`);
      } else {
        // A table a module reads may not go while the module reads it.
        if (name === 'services' || name === 'team') {
          const modules = /^export const MODULES[\s\S]*?;\s*$/m.exec(tree.read('src/content/blocks.ts') ?? '')?.[0] ?? '';
          const collection = name === 'services' ? 'services' : 'team';
          if (new RegExp(`["']?(services|resources)["']?\\s*:\\s*["']${collection}["']`).test(modules)) {
            console.error(`jtk remove ${name}: bookings reads \`${collection}\` — npx @jtakeit/astro remove booking first, or point MODULES elsewhere`);
            return 1;
          }
        }
        const result = removeUnit(tree, unit, { force: has('force') });
        did.push(...result.did.map((one) => `${name}: ${one}`));
        kept.push(...result.kept.map((one) => `${name}: ${one}`));
        faults.push(...result.faults);
        if (result.did.length === 0 && result.kept.length === 0) did.push(`${name}: not there — nothing to remove`);
        if (name === 'contact') kept.push('contact: the header\'s button and the hero\'s may still lead to /#contact — change their links in the panel or jtk/shared.json');
      }
    }
  } catch (why) {
    console.error(`jtk ${command}: ${why.message}\nNothing was written.`);
    return 1;
  }

  if (faults.length > 0) {
    console.error(`jtk remove: ${faults.length} value(s) are not the example's — a person's words, which this would delete:\n`);
    for (const one of faults.slice(0, 40)) console.error(`  ${one}`);
    if (faults.length > 40) console.error(`  … and ${faults.length - 40} more`);
    console.error('\nNothing was written. --force removes them anyway. On a launched site the words are the panel\'s: pull first (git pull, or pull_code and npx @jtakeit/astro pull) — a draft ahead of the branch is JTK_E_DRAFT_AHEAD.');
    return 1;
  }

  if (dryRun) {
    console.log(`jtk ${command} --dry-run — would change ${tree.changed.size} file(s):\n`);
    say(did);
    if (kept.length > 0) say(kept);
    for (const [path, value] of tree.changed) console.log(`    ${value === null ? 'delete' : 'write '} ${path}`);
    return 0;
  }
  const written = tree.commit();
  // The form's words, in every language, where a section with the form came back.
  if (command === 'add' && names.includes('contact')) seedFormWords(root);
  console.log(`jtk ${command}: ${written.length} file(s) changed\n`);
  say(did);
  if (kept.length > 0) {
    console.log('\nLeft:');
    say(kept);
  }
  if (questions.length > 0) {
    console.log(`\nThe kit is laid out. Ask, never make up:`);
    say(questions.map((one) => `- ${one}`));
  }
  console.log('\nNext: npx @jtakeit/astro schema, then validate_schema — and git diff shows the change. Nothing is committed.');
  return 0;
}
