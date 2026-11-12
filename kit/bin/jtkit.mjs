#!/usr/bin/env node
/**
 * jtkit — the command line of @jtakeit/kit, for a site on any generator.
 *
 *   jtkit apply --kit <kind>|<file> [--locale de-CH] [--api <url>] [--root <dir>]
 *       lay a booking kit into the tree, in the words of its contract: on a new tree
 *       and a contract-3 one, the kit's types, collections and module into
 *       jtk/schema.json beside the site's own — judged as the platform judges it —
 *       the settings at jtk/modules/bookings.json, the rates under jtk/entries with
 *       their ids, the page the services are shown on under jtk/pages; on a site
 *       still on contract 2, jtk/bookings.json, the rates under jtk/content and the
 *       kit's types into jtk/catalogue.json, without the keys only contract 3 has
 *   jtkit schema [--declaration src/content/blocks.ts] [--emit-only] [--dist ./dist] [--judge]
 *       write jtk/schema.json from a declaration that says CONTRACT = 3, mint the ids and
 *       _keys, and check it against the built pages in the grammar by key
 *   jtkit catalogue [--declaration src/content/blocks.ts] [--emit-only] [--dist ./dist] [--judge]
 *       a site still on contract 2: write jtk/catalogue.json from a declaration and check it
 *       against the built pages; on a contract-3 tree, mint the ids and _keys and write no catalogue
 *   jtkit lint [--dist dist] [--root .] [--site-url https://…]
 *       the annotation lint the platform's build runs, on this working tree; on a contract-3 tree,
 *       by key and by id against jtk/schema.json, and every price in the site's currency
 *   jtkit progress [--root .] [--json]
 *       where the site is, read off the files: the brief, the pages, the entries, what is missing —
 *       contract 2's tree or contract 3's
 *   jtkit session <session_id> <watch_key> [--api <url>] [--root .]   |   jtkit session --forget
 *       let the page the dev server serves read the platform's half through the dev session
 */
import { pathToFileURL } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const [command, ...rest] = process.argv.slice(2);
const has = (name) => rest.includes(`--${name}`);
const flag = (name, fallback) => {
  const at = rest.indexOf(`--${name}`);
  return at === -1 ? fallback : rest[at + 1];
};

switch (command) {
  case 'apply': {
    // The tree says which contract: a new one and a contract-3 one take the
    // kit in contract 3's files, a site still on contract 2 in its own.
    const { loadKit, applyKit } = await import(pathToFileURL(join(HERE, '..', 'lib', 'kits.mjs')).href);
    const asked = has('kit') ? flag('kit', '') : has('kind') ? flag('kind', '') : '';
    if (asked === '') {
      console.error('jtkit apply: --kit <kind> or --kit <file> says which kit');
      process.exit(1);
    }
    const root = resolve(flag('root', process.cwd()));
    try {
      const kit = await loadKit(asked, flag('api', undefined));
      const { contract, written, questions } = applyKit(root, kit, { locale: flag('locale', undefined) });
      console.log(`${written.length} files written under ${relative(process.cwd(), root) || '.'}${contract === 3 ? ', on contract 3' : ''}:`);
      for (const file of written) console.log(`  ${relative(root, file)}`);
      console.log(`\nThe «${kit.kind}» kit is laid out. Ask, never make up:`);
      for (const line of kit.ask ?? []) console.log(`  - ${line}`);
      for (const one of questions) console.log(`  - ${one.ask}`);
      console.log(`What the kit chose for the business — say each back and get a yes: jtakeit:///kits/${kit.kind}.md, «Taken by default».`);
      if (contract === 3) console.log('jtk/schema.json is judged as the platform judges it; before the push, validate_schema with it and the jtk/ files beside it.');
    } catch (why) {
      console.error(`jtkit apply: ${why.message}`);
      process.exit(1);
    }
    break;
  }
  case 'session': {
    // The dev session's watch key, kept beside the content and out of git:
    // the dev server presents it for one read-only answer — where the site
    // is on the platform and what the developer can do in the panel — which
    // the page then shows bottom right (elements/writing.js).
    const { writeFileSync, unlinkSync, mkdirSync, existsSync } = await import('node:fs');
    const root = resolve(flag('root', process.cwd()));
    const file = join(root, 'jtk', 'session.json');
    if (has('forget')) {
      if (existsSync(file)) unlinkSync(file);
      console.log('forgotten: the page no longer reads the platform');
      break;
    }
    const takesValue = new Set(['--api', '--root']);
    const positional = [];
    for (let i = 0; i < rest.length; i++) {
      if (takesValue.has(rest[i])) { i++; continue; }
      if (rest[i].startsWith('--')) continue;
      positional.push(rest[i]);
    }
    const [session, key] = positional;
    if (!session || !key) {
      console.error("jtkit session <session_id> <watch_key> [--api <url>] — both are in open_dev_session's answer");
      process.exit(1);
    }
    const api = flag('api', process.env.JTK_API_URL || 'https://api.jtakeit.com').replace(/\/$/, '');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ session, key, api }, null, 2) + '\n');
    console.log(`${relative(process.cwd(), file)} written — the page the dev server serves now shows the platform's half through session ${session} at ${api}. Not in git; jtkit session --forget drops it.`);
    break;
  }
  case 'progress': {
    // The same reading the scaffold's dev server serves the panel as
    // /_jtk/progress.json — what the owner sees as missing is what this
    // prints.
    const { readProgress, sayProgress } = await import(pathToFileURL(join(HERE, '..', 'lib', 'progress.mjs')).href);
    const progress = await readProgress(resolve(flag('root', '.')));
    console.log(has('json') ? JSON.stringify(progress, null, 2) : sayProgress(progress));
    process.exit(progress.missing.length === 0 ? 0 : 1);
  }
  case 'lint': {
    // The annotation lint the platform's build runs, on this working tree:
    // `dist/` against `jtk/` and the catalogue — or, on contract 3, the
    // schema — every finding at once, before any push.
    const { lintCommand } = await import(pathToFileURL(join(HERE, '..', 'lib', 'lint.mjs')).href);
    const root = resolve(flag('root', process.cwd()));
    const dist = resolve(root, flag('dist', 'dist'));
    try {
      process.exit(await lintCommand({ root, dist, siteURL: flag('site-url', process.env.SITE_URL ?? '') }));
    } catch (why) {
      console.error(`jtkit lint: ${why.message}`);
      process.exit(1);
    }
    break;
  }
  case 'catalogue':
  case 'catalog': {
    process.argv = [process.argv[0], process.argv[1], ...rest];
    await import(pathToFileURL(join(HERE, '..', 'lib', 'catalogue.mjs')).href);
    break;
  }
  case 'schema': {
    // Contract 3's file, from a declaration that says it is contract 3's.
    const { main } = await import(pathToFileURL(join(HERE, '..', 'lib', 'schema.mjs')).href);
    process.exit(await main(rest));
  }
  default: {
    console.error(`@jtakeit/kit — the framework-free half of a site on jtakeit

  jtkit apply --kit <kind>|<file> [--locale de-CH] [--api <url>] [--root <dir>]
  jtkit schema [--declaration src/content/blocks.ts] [--emit-only] [--dist ./dist] [--judge]
  jtkit catalogue [--declaration src/content/blocks.ts] [--emit-only] [--dist ./dist] [--judge]   (a contract-2 site)

The contract the platform holds a repository to: jtakeit:///guides/connecting-a-site.md
(the platform's MCP server, https://mcp.jtakeit.com/mcp, hands it to your agent)`);
    process.exit(command === undefined || command === '--help' || command === '-h' ? 0 : 1);
  }
}
