/**
 * `jtk upgrade contract-3` — a contract-2 site moved to contract 3 in one
 * commit (jtakeit-core wiki/98 §7). Run by the developer's agent in the
 * site's repository; it writes the working tree and commits nothing, so the
 * move is one commit somebody reads before it is pushed.
 *
 *   jtk upgrade contract-3                    move the tree, then run jtk schema on it
 *   jtk upgrade contract-3 --dry-run          say what would move, write nothing
 *   jtk upgrade contract-3 --state <file>     the platform's state, where the files lack it
 *   jtk upgrade contract-3 --judge            and jtk schema --judge (JTK_API, JTK_TOKEN)
 *   jtk upgrade contract-3 --take-base[=hero.image,…]
 *                                             a shared value that differs between languages:
 *                                             the original's stands for every language
 *
 * The five steps of §7, the first four here (the fifth is the push):
 *
 *   1  the template    the kit bumped; the scaffold's own files replaced where
 *                      they are byte for byte the version the site came from
 *                      (lib/upgrade/scaffold.json); every other read of the
 *                      contract listed, with what it reads
 *   2  the declaration src/content/blocks.ts rewritten in §3's words (a codemod,
 *                      lib/upgrade/codemod.mjs), held to the tables the kit's
 *                      mapping makes of the old one; jtk/catalogue.json removed
 *   3  the documents   every file at its §2 place, by @jtakeit/kit/upgrade
 *   4  the judge       jtk schema on the whole tree, before anything is pushed
 *
 * What only a person can answer is listed at the end (§8), and nothing is
 * decided for them: the values stay where nothing is lost. A second run on
 * a moved tree does nothing and says so.
 *
 * ── what it refuses, writing nothing ────────────────────────────────────────
 *
 *   a shared value that differs        between the languages' copies — two photographs, two
 *     between languages                prices: listed, for the agent or a person to choose
 *                                      (--take-base, or the field marked localized in blocks.ts)
 *   a language nothing declares        a document in a language LOCALES does not name
 *   a copy with no original            a page or an entry only in another language: nothing
 *                                      for a translation to be beside
 *   a tree half moved                  jtk/schema.json beside jtk/catalogue.json, or one without the other
 *   a catalogue the declaration left   jtk/catalogue.json is the platform's; run jtk catalogue first
 *   work in progress                   the upgrade is its own commit (--force to go on)
 *   ids it would have to make up       for a site the platform has saved; --state, or --mint-ids
 *   a schema contract 3's judge refuses judge3.mjs's verdict, before a file is touched
 *   a declaration it cannot rewrite    a table that is no data literal, or a rewrite that
 *                                      says other than the mapping — rewrite it by hand,
 *                                      say CONTRACT = 3, and run it again
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = resolve(HERE, '..');
const TEMPLATE = join(PACKAGE, 'template');
const JTK = join(PACKAGE, 'bin', 'jtk.mjs');

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// ── the scaffold's own files (§7 · 1) ───────────────────────────────────────

/**
 * What the scaffold lays out and the upgrade may replace: every file of the
 * template but the ones that are the site's from the first day — the
 * declaration (rewritten by the codemod instead), the business's facts, the
 * copy in the site's language (its reads moved by `copyThroughTheDoor`), the
 * styles, the content, the package files and anything a token is filled into
 * at `jtk create`. §7 names the ones that read the contract — `src/lib/*.ts`,
 * the entry and listing routes, `EntryCard`, the copy registry — and a site
 * laid out before the door (0.16.0 and earlier, every site npm has given) has
 * components and hooks that read it too: `Blocks`, `Hero`, `LeadForm`, the
 * layout, `jtakeit-meta.mjs`. A version's copy of each is hashed in
 * lib/upgrade/scaffold.json (scripts/scaffold-hashes.mjs).
 */
const NOT_OWN = [
  /^src\/content\/blocks\.ts$/,
  /^src\/data\//,
  /^src\/copy\/LOCALE\.ts$/,
  /^src\/styles\//,
  /^jtk\//,
  /^public\/favicon/,
  /^package(-lock)?\.json$/,
  /^gitignore$/,
  /^astro\.config\.mjs$/,
  // Contract 3's own files, which `jtk create` lays in contract 2's places: no site has this path.
  /^contract-3\//,
];

/** The parts of §7 · 1's list, said in the summary. */
export const SCAFFOLDS = ['src/lib/*.ts', 'src/pages/**', 'src/components/**', 'src/layouts/**', 'src/copy/index.ts', 'src/copy/make.ts', 'src/content.config.ts', '*.mjs', 'tsconfig.json', 'public/_jtk/**'];

/** Whether a path of the template, from its root, is one the upgrade may replace. */
export function ownFile(path) {
  return !NOT_OWN.some((one) => one.test(path));
}

/** Whether a template text has a token `jtk create` fills in, besides the copy module's name, which `untokened` puts back. */
export function tokened(text) {
  return /\{\{(?!LOCALE\}\})[A-Z_]+\}\}/.test(text);
}

/**
 * A file's text with the site's own language put back as the scaffold's
 * token: the copy module is named for it (`src/copy/de-CH.ts`), so the
 * lines that import it say it, and a version's file is hashed as the
 * template holds it, `{{LOCALE}}` and all.
 *
 * @param {string} path
 * @param {string} text
 * @param {string} [locale] the copy module's name; none for the template's own text
 */
export function untokened(path, text, locale) {
  if (locale === undefined || locale === '') return text;
  const quoted = (one) => one.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`(['"])\\./${quoted(locale)}\\1`, 'g'), path === 'src/copy/index.ts' ? '$1./{{LOCALE}}$1' : `$1./${locale}$1`)
    .replace(new RegExp(`(['"])((?:\\.\\./)+copy)/${quoted(locale)}\\1`, 'g'), '$1$2/{{LOCALE}}$1');
}

/**
 * The copy in the site's language (`src/copy/<locale>.ts`, the template's
 * `LOCALE.ts`, its words filled in at `jtk create` and often the
 * developer's since): before the door it imported `jtk/content/index.json`
 * by name, a file contract 3 has not got. Its read is moved to the door —
 * the home page by its address, `site.page('/')` — and the rest of it, the
 * site's words, is left as it is. `undefined` where it reads the door
 * already, or reads in a way this does not know.
 *
 * @param {string} text
 */
export function copyThroughTheDoor(text) {
  const importing = /^import\s+(\w+)\s+from\s+['"](?:\.\.\/)+jtk\/content\/index\.json['"];?\n/m.exec(text);
  if (importing === null) return undefined;
  const name = importing[1];
  const made = new RegExp(`makeCopy\\(\\s*${name}\\s*,`);
  if (!made.test(text)) return undefined;
  let out = text.replace(importing[0], '');
  out = out.replace(/^(import \{ LOCALE \} from ['"]\.\.\/content\/blocks['"];?\n)/m, `$1import { site } from '../lib/site';\n`);
  if (!/from ['"]\.\.\/lib\/site['"]/.test(out)) out = `import { site } from '../lib/site';\n${out}`;
  out = out.replace(made, "makeCopy(site.page('/'),");
  // What the copy hands out now: make.ts's, which hands out no reader of its own.
  out = out.replace(/^export const \{[^}]*\} = COPY;\n(export type \{ Shown \} from '\.\/make';\n)?/m, 'export const { META, HOME, FORM, PRIVACY, LISTING, A11Y, PAGE } = COPY;\n');
  return out;
}

const hash = (text) => createHash('sha256').update(text).digest('hex');

/** The scaffold versions' hashes. */
function table() {
  return JSON.parse(readFileSync(join(HERE, 'upgrade', 'scaffold.json'), 'utf8'));
}

/** Every file under a directory, by its path from `root`. */
function walk(root, dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'jtk'].includes(entry.name) && !entry.name.startsWith('.')) walk(root, file, out);
    } else out.push(relative(root, file).split(sep).join('/'));
  }
  return out;
}

/**
 * What a file reads of the contract, said as a list, and which of those
 * reads contract 3 changes — for a file the developer changed, which is
 * theirs to move to the door by hand (§8), and for any other file in src/.
 *
 * @param {string} text
 * @param {{ money: Set<string>; refs: Set<string>; lists: Set<string>; pictures: Set<string>; alts: Set<string> }} kinds
 *   the contract-2 declaration's keys by what contract 3 changes in their values
 */
export function readsOf(source, kinds) {
  // What the code says, not what its comments say of it.
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/[^\n]*/g, '$1');
  const reads = new Set();
  const changes = [];
  const say = (line) => {
    if (!changes.includes(line)) changes.push(line);
  };
  for (const match of text.matchAll(/\.(block|type|text|value|rows|picture|gallery|at|minor|refs|entries|entry|collection|module|settings|rolesOf)\(\s*['"]([a-z][a-z0-9_]*)['"]/g)) {
    const [, call, key] = match;
    reads.add(`${call}('${key}')`);
    if (kinds.alts.has(key)) say(`${call}('${key}'): contract 3 folds ${key} into its picture — read picture('${key.slice(0, -4)}').alt`);
    else if ((call === 'value' || call === 'text') && kinds.money.has(key)) say(`${call}('${key}'): a price is { minor } in contract 3 — minor('${key}'), or site.money(value)`);
    else if ((call === 'value' || call === 'text') && kinds.refs.has(key)) say(`${call}('${key}'): a reference is an entry's id in contract 3, not its slug — refs('${key}')`);
    else if (call === 'rows' && kinds.lists.has(key)) say(`rows('${key}'): a list of one-ref rows is one reference to many in contract 3 — refs('${key}')`);
    else if ((call === 'value' || call === 'text') && kinds.pictures.has(key)) say(`${call}('${key}'): one picture is { src, alt } in contract 3 — picture('${key}')`);
  }
  if (/jtk\/content\b/.test(text)) {
    reads.add('jtk/content/');
    say('jtk/content/: contract 3 keeps pages in jtk/pages/ and entries in jtk/entries/ (wiki/98 §2) — read them through the door (src/lib/site.ts)');
  }
  if (/catalogue\.json/.test(text)) {
    reads.add('jtk/catalogue.json');
    say("jtk/catalogue.json: contract 3's schema is jtk/schema.json — read it through the door");
  }
  if (/import\.meta\.glob\(\s*['"`]\/?jtk\//.test(text) && !/content\(import\.meta\.glob/.test(text)) {
    reads.add('import.meta.glob(jtk/…)');
    say('import.meta.glob over jtk/: the files are the door\'s to read — content(import.meta.glob(...)) in src/lib/site.ts');
  }
  if (/data-jtk-path=["'`][^"'`]*blocks\[\d|blocks\[\$\{/.test(text)) {
    reads.add('an annotation written by hand');
    say('an annotation by index, written by hand: contract 3 names a block and a row by _key — at() writes it');
  }
  if (/site\.(page|entries|entry|shared|module|settings|collection)\(|from ['"][./]*lib\/site['"]/.test(text)) reads.add('the door (src/lib/site.ts)');
  return { reads: [...reads], changes };
}

/**
 * The addresses a repository draws a page of its own at — the blog's
 * `src/pages/[...lang]/blog/index.astro` gives `/blog` — read off its routes:
 * where contract 2 listed a collection at its prefix all the same, contract 3
 * declares the listing there (`tablesOf`'s `ownListings`). `jtk create` reads
 * a fresh scaffold's the same way, for a kit it lays out on contract 3.
 *
 * @param {string} root the site's root
 * @returns {Set<string>}
 */
export function ownListingsOf(root) {
  const out = new Set();
  for (const path of walk(root, join(root, 'src', 'pages'))) {
    if (!path.endsWith('.astro')) continue;
    const parts = path.slice('src/pages/'.length).replace(/\.astro$/, '').split('/').filter((one) => one !== '[...lang]');
    if (parts.at(-1) === 'index') parts.pop();
    if (parts.length === 0 || parts.some((one) => one.includes('['))) continue;
    out.add(`/${parts.join('/')}`);
  }
  return out;
}

// ── the command ─────────────────────────────────────────────────────────────

export function usage() {
  return `jtk upgrade contract-3 [--dry-run] [--state <file>] [--judge] [--root <dir>]
                       [--force] [--mint-ids] [--no-install] [--take-base[=<type>.<field>,…]]
                                  move a contract-2 site to contract 3 in one commit
                                  (jtakeit-core wiki/98 §7): the template onto the door,
                                  blocks.ts in contract 3's words, every file at its place,
                                  then jtk schema; what a person must answer, listed last`;
}

/**
 * @param {string[]} argv the arguments after `upgrade`
 * @returns {Promise<number>} the exit code
 */
export async function main(argv) {
  const has = (name) => argv.includes(`--${name}`);
  const flag = (name, fallback) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? fallback : argv[at + 1];
  };
  if (argv[0] !== 'contract-3') {
    console.error(`jtk upgrade: say which contract — jtk upgrade contract-3\n\n${usage()}`);
    return argv.length === 0 || has('help') ? 0 : 1;
  }
  const root = resolve(flag('root', process.cwd()));
  const dry = has('dry-run');
  const refuse = (says) => {
    console.error(`jtk upgrade contract-3: ${says}`);
    return 1;
  };

  const { contractOf, readJtk } = await import('@jtakeit/kit/content/node');
  const { content } = await import('@jtakeit/kit/content');
  const { schemaOf, schemaText, judgeSchema } = await import('@jtakeit/kit/schema');
  const upgrade = await import('@jtakeit/kit/upgrade');

  const declarationPath = join(root, 'src', 'content', 'blocks.ts');
  const catalogueFile = join(root, 'jtk', 'catalogue.json');
  const schemaFile = join(root, 'jtk', 'schema.json');
  if (!existsSync(join(root, 'jtk'))) return refuse(`${root} has no jtk/ — run it in the site's repository, or pass --root`);
  if (!existsSync(declarationPath)) return refuse('no src/content/blocks.ts — the declaration this command rewrites is the scaffold\'s; a site on another generator moves with @jtakeit/kit/upgrade by its own tool');

  // ── where the tree is ───────────────────────────────────────────────────
  const sourceBefore = readFileSync(declarationPath, 'utf8');
  const saysThree = /export\s+const\s+CONTRACT\s*(?::\s*\w+\s*)?=\s*3\b/.test(sourceBefore);
  const three = contractOf(root) === 3;
  const catalogue = existsSync(catalogueFile);
  if (three && !catalogue && saysThree) {
    console.log('jtk upgrade contract-3: this site is on contract 3 already — jtk/schema.json says so, there is no jtk/catalogue.json, and blocks.ts says CONTRACT = 3. Nothing to do.');
    return 0;
  }
  if (three || (existsSync(schemaFile) && catalogue)) {
    return refuse(
      'this tree is half moved — ' +
        [three ? 'jtk/schema.json says contract 3' : 'jtk/schema.json is there', catalogue ? 'jtk/catalogue.json is still there' : 'there is no jtk/catalogue.json', saysThree ? 'blocks.ts says CONTRACT = 3' : 'blocks.ts is contract 2\'s'].join(', ') +
        '. Put the tree back as it was before the move (git checkout -- jtk src; git clean jtk), and run it again.',
    );
  }
  if (!catalogue) return refuse("there is no jtk/catalogue.json — contract 2's schema, which the documents were saved against. Run npx @jtakeit/astro catalogue first, commit it, then this.");

  // One commit: nothing else in it.
  if (!has('force') && existsSync(join(root, '.git'))) {
    const status = spawnSync('git', ['status', '--porcelain', '--', 'jtk', 'src', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' });
    if (status.status === 0 && status.stdout.trim() !== '') {
      return refuse(`the move is one commit (wiki/98 §7), and the tree has work in it that is not committed:\n${status.stdout.trimEnd().split('\n').map((one) => `    ${one}`).join('\n')}\n  Commit it or put it aside, then run this again — or --force to move it all together.`);
    }
  }

  const files = await readJtk(root);
  const cat = JSON.parse(readFileSync(catalogueFile, 'utf8'));
  const versionOfSite = /^@jtakeit\/astro@(\d+\.\d+\.\d+)$/.exec(cat.generator ?? '')?.[1];

  // The languages the files are in: each one a translation beside its
  // original from now on (M3, wiki/95 §6), and each one the declaration has
  // to name — a copy in a language nothing declares is no translation the
  // platform would read.
  const languages = new Set();
  for (const [file, raw] of Object.entries(files)) {
    if (file.startsWith('/jtk/content/') && isObject(raw) && typeof raw.locale === 'string' && raw.locale !== '') languages.add(raw.locale);
    const shared = /^\/jtk\/shared\.([^/]+)\.json$/.exec(file);
    if (shared) languages.add(shared[1]);
  }

  // ── the declaration (§7 · 2) ────────────────────────────────────────────
  let declared;
  try {
    declared = { ...(await import(`${pathToFileURL(declarationPath).href}?before=${Date.now()}`)) };
  } catch (why) {
    return refuse(`could not read src/content/blocks.ts: ${why.message}`);
  }
  {
    const { canonicalLocale } = await import('@jtakeit/kit/content');
    const own = canonicalLocale(declared.LOCALE ?? cat.locale);
    const named = new Set((Array.isArray(declared.LOCALES) ? declared.LOCALES : []).map(canonicalLocale));
    const stray = [...languages].filter((one) => canonicalLocale(one) !== own && !named.has(canonicalLocale(one)));
    if (stray.length > 0) {
      return refuse(
        `jtk/ holds documents in ${stray.join(', ')}, and src/content/blocks.ts does not declare ${stray.length === 1 ? 'it' : 'them'} in LOCALES — each language the site has becomes translations beside the originals, and only a language the schema names is read: ` +
          `add ${stray.map((one) => `'${one}'`).join(', ')} to LOCALES, or remove those documents; nothing was written.`,
      );
    }
  }
  if (!saysThree) {
    // The platform holds the catalogue; the documents were saved against it.
    // A field the developer has marked `localized` since — contract 3's
    // answer to a shared value that differs between languages (below) — is
    // no drift: contract 2 has no such attribute, and the move carries it.
    const keys = [['BLOCKS', 'blocks'], ['PAGE_SEO', 'page_seo'], ['BUSINESS_FACTS', 'business_facts'], ['COLLECTIONS', 'collections'], ['MODULES', 'modules']];
    const unmarked = (value) => JSON.stringify(value, (key, inner) => (key === 'localized' ? undefined : inner));
    const drift = keys.filter(([mine, theirs]) => {
      const a = declared[mine] ?? (mine === 'MODULES' ? {} : []);
      const b = cat[theirs] ?? (theirs === 'modules' ? {} : []);
      return unmarked(a) !== unmarked(b);
    });
    if (drift.length > 0) {
      return refuse(
        `jtk/catalogue.json is not what src/content/blocks.ts declares (${drift.map(([mine]) => mine).join(', ')}): the platform holds the catalogue, and the documents were saved against it. ` +
          'Run npx @jtakeit/astro catalogue, commit and push it, then move.',
      );
    }
  }

  const sharedTypes = (Array.isArray(files['/jtk/shared.json']?.blocks) ? files['/jtk/shared.json'].blocks : []).map((one) => one?.type).filter((one) => typeof one === 'string');
  // The addresses the repository draws a page of its own at — the blog's
  // `src/pages/[...lang]/blog/index.astro` — where contract 2 listed a
  // collection at its prefix all the same: contract 3 declares the listing
  // there, so its feed and its alternates keep their address. Read off the
  // routes, so a collection kept ready and not pushed (the blog's) is
  // rewritten with it too.
  const ownListings = ownListingsOf(root);
  const version = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')).version;
  const generator = `@jtakeit/astro@${version}`;
  const questions = [];
  const notes = [];
  let tables;
  let contacts;
  let sourceAfter = sourceBefore;
  if (saysThree) {
    // Rewritten by hand already: taken as it is, and judged below.
    notes.push('src/content/blocks.ts says CONTRACT = 3 already — taken as written; jtk/catalogue.json is read for the kinds the documents were saved in');
    tables = declared;
    contacts = (declared.BLOCKS ?? []).find((one) => one?.type === 'contacts');
  } else {
    const made = upgrade.tablesOf({ ...declared, LOCALE: declared.LOCALE ?? cat.locale }, { sharedTypes, ownListings });
    if (made.refused) return refuse(made.refused);
    tables = made.tables;
    contacts = made.contacts;
    questions.push(...made.questions);
    notes.push(...made.notes);

    // The site's own TypeScript (every scaffold has it), else the one this package was installed with.
    let ts;
    for (const from of [join(root, 'package.json'), fileURLToPath(import.meta.url)]) {
      try {
        ts = createRequire(from)('typescript');
        break;
      } catch {
        // The next.
      }
    }
    if (ts === undefined) return refuse("the codemod reads blocks.ts with TypeScript's parser, and neither the site nor this package has it — run npm ci in the site first");
    const today = new Date().toISOString().slice(0, 10);
    const rewritten = (await import('./upgrade/codemod.mjs')).rewriteDeclaration(sourceBefore, ts, {
      whole: upgrade.wholeOf(declared),
      ownListings,
      contacts,
      shared: tables.SHARED,
      upgraded: `Moved from contract 2 by \`jtk upgrade contract-3\` (${generator}, ${today})`,
    });
    if (rewritten.faults.length > 0) {
      return refuse(`src/content/blocks.ts cannot be rewritten as it is:\n${rewritten.faults.map((one) => `    ${one}`).join('\n')}\n  Rewrite those in contract 3's words by hand (@jtakeit/kit/schema types them), say CONTRACT = 3, and run this again: a declaration that says so is taken as written.`);
    }
    sourceAfter = rewritten.source;

    // Held to the mapping: the rewritten file, imported, says the tables.
    const probe = join(root, 'src', 'content', `.blocks-upgrade-${process.pid}.ts`);
    writeFileSync(probe, sourceAfter);
    let after;
    try {
      after = { ...(await import(`${pathToFileURL(probe).href}?after=${Date.now()}`)) };
    } catch (why) {
      rmSync(probe, { force: true });
      return refuse(`the rewritten blocks.ts does not load (${why.message}) — this is the codemod's fault; nothing was written`);
    } finally {
      rmSync(probe, { force: true });
    }
    const wanted = schemaText(schemaOf(tables, { generator }));
    const got = schemaText(schemaOf(after, { generator }));
    if (wanted !== got) {
      const a = wanted.split('\n');
      const b = got.split('\n');
      const at = a.findIndex((line, i) => line !== b[i]);
      return refuse(`the rewritten blocks.ts says something other than the mapping of the old one, from line ${at + 1} of the schema:\n    wanted ${a[at]?.trim()}\n    wrote  ${b[at]?.trim()}\n  Nothing was written. Rewrite the declaration by hand in contract 3's words, say CONTRACT = 3, and run this again.`);
    }
  }
  const schema = schemaOf(tables, { generator });
  const text = schemaText(schema);
  const faults = judgeSchema(text);
  if (faults.length > 0) {
    return refuse(`the contract-3 schema this declaration makes is one the platform refuses:\n${faults.map((one) => `    ✗ ${one.code}  ${one.path || '(the file)'}: ${one.says}`).join('\n')}\n  Nothing was written.`);
  }

  // ── the documents (§7 · 3) ──────────────────────────────────────────────
  let state;
  if (flag('state') !== undefined) {
    try {
      state = upgrade.stateOf(JSON.parse(readFileSync(resolve(flag('state')), 'utf8')));
    } catch (why) {
      return refuse(`--state ${flag('state')}: ${why.message}`);
    }
    if (state.faults.length > 0) return refuse(`--state ${flag('state')} is not the platform's state:\n${state.faults.map((one) => `    ${one}`).join('\n')}`);
  }
  const door = content(files, { annotate: false });
  const order = {};
  for (const collection of door.collections) order[collection.name] = door.entries(collection.name, { locale: '', all: true }).map((one) => one.file);
  // A shared value that differs between the languages is the original's
  // where the agent said so: --take-base for all of them, or
  // --take-base=hero.image,en:service.costs for those fields.
  const took = argv.find((one) => one === '--take-base' || one.startsWith('--take-base='));
  const taken = took === undefined ? undefined : took === '--take-base' ? true : new Set(took.slice('--take-base='.length).split(',').map((one) => one.trim()).filter(Boolean));
  const takeBase = (field) => taken === true || (taken instanceof Set && taken.has(field));
  const moved = upgrade.documentsOf(files, { from: cat, to: schema, order, state, contacts, takeBase });
  questions.push(...moved.questions);
  notes.push(...moved.notes);

  // A copy with no original has nothing to be a translation of (wiki/98
  // §4.4): not made up, and not moved.
  if (moved.alone.length > 0) {
    return refuse(
      `${moved.alone.length} document(s) are written only in another language, and the site's own (${schema.locale}) has no original for them — a translation sits beside its original, and is nothing without one; nothing was written:\n` +
        `${moved.alone.map((one) => `    ✗ ${one.file} (${one.locale}): ${one.kind === 'page' ? `the page ${one.path}` : `${one.collection} «${one.slug}»`}, with no ${one.kind === 'page' ? `jtk/content${one.path === '/' ? '/index' : one.path}.json` : 'original'} in ${schema.locale}`).join('\n')}\n` +
        `  Write each one's original in ${schema.locale} — in the copy's words until somebody translates them — or remove the copy, and run this again.`,
    );
  }

  // Not decided here (wiki/95 §6, wiki/98 §8): which of two values is the
  // business's is a fact about the business.
  if (moved.differing.length > 0) {
    const fields = [...new Set(moved.differing.map((one) => one.field))];
    const shown = (value) => {
      const said = JSON.stringify(value) ?? 'nothing';
      return said.length > 70 ? `${said.slice(0, 67)}…` : said;
    };
    return refuse(
      `${moved.differing.length} value(s) the schema says are the same in every language differ between the languages' copies — which one stands for every language is the business's to say, so nothing was written:\n` +
        `${moved.differing.slice(0, 20).map((one) => `    ✗ ${one.file} ${one.place} (${one.field}): the original says ${shown(one.base)}, ${one.from} says ${shown(one.theirs)}`).join('\n')}` +
        `${moved.differing.length > 20 ? `\n    … and ${moved.differing.length - 20} more` : ''}\n` +
        '  Answer each field one of two ways, and run this again:\n' +
        `    · the original's value stands for every language, the others' dropped: --take-base=${fields.join(',')} (or --take-base for all of them);\n` +
        "    · the field is per language: mark it `localized: true` in src/content/blocks.ts (a picture, a link or a list; wiki/98 §3.3) — each language keeps its own.",
    );
  }

  // Ids the platform holds and the files do not: never made up for a site it
  // has saved. The originals' only: a copy in another language becomes a
  // translation, named by its original's id.
  const others = (schema.locales ?? []);
  const documents = Object.entries(files).filter(([file, raw]) => file.startsWith('/jtk/content/') && isObject(raw) && upgrade.languageOfDocument(raw, others, schema.locale) === '');
  const nameless = documents.filter(([, raw]) => typeof raw.id !== 'string' || raw.id === '').map(([file]) => file);
  const onPlatform = isObject(files['/jtk/site.json']) || documents.some(([, raw]) => typeof raw.id === 'string' && raw.id !== '');
  const covered = new Set((state?.pages ?? []).map((one) => `${one.collection}\u0000${one.path}`));
  const unknown = nameless.filter((file) => !covered.has(`${files[file].collection ?? ''}\u0000${String(files[file].path).replace(/(.)\/+$/, '$1')}`));
  if (onPlatform && unknown.length > 0 && !has('mint-ids')) {
    return refuse(
      `${unknown.length} document(s) carry no id, and this site has been on the platform (${isObject(files['/jtk/site.json']) ? 'jtk/site.json' : 'other files carry ids'}) — the platform gave each one an id at its import and writes it into the file only at its next save:\n` +
        `${unknown.slice(0, 12).map((one) => `    ${one.slice(1)}`).join('\n')}${unknown.length > 12 ? `\n    … and ${unknown.length - 12} more` : ''}\n` +
        '  A made-up id names nothing the platform has: the import would match the page by its path and keep its own id, and every reference to it would point nowhere.\n' +
        '  Fetch the state, read-only, through the MCP server and hand it over — { "site": get_site, "pages": get_content\'s pages } — with --state <file>;\n' +
        '  or, for a tree the platform has never imported, --mint-ids.',
    );
  }

  // ── the template (§7 · 1) ───────────────────────────────────────────────
  const hashes = table();
  const copyLocale = (() => {
    const index = join(root, 'src', 'copy', 'index.ts');
    if (!existsSync(index)) return undefined;
    // `{ COPY as own }`, and since M3 `{ COPY as own, STRINGS }`.
    return /import\s*\{\s*COPY as own\b[^}]*\}\s*from\s*['"]\.\/([^'"]+)['"]/.exec(readFileSync(index, 'utf8'))?.[1];
  })();
  const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|pdf|zip)$/i;
  /** The scaffold's own files now, by their path in a site (the template's `gitignore` is never one). */
  const current = new Map(
    walk(TEMPLATE, TEMPLATE)
      .filter((path) => ownFile(path) && !BINARY.test(path))
      .map((path) => [path, readFileSync(join(TEMPLATE, path), 'utf8')])
      .filter(([, text]) => !tokened(text)),
  );
  const kinds = { money: new Set(), refs: new Set(), lists: new Set(), pictures: new Set(), alts: new Set() };
  const sortKinds = (fields) => {
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!isObject(field)) continue;
      if (field.kind === 'money') kinds.money.add(field.key);
      if (field.kind === 'ref') kinds.refs.add(field.key);
      if (upgrade.oneRefList(field)) kinds.lists.add(field.key);
      if (field.kind === 'media' && field.multiple !== true) kinds.pictures.add(field.key);
      sortKinds(field.of);
    }
    for (const alt of upgrade.altsIn(Array.isArray(fields) ? fields : []).values()) kinds.alts.add(alt);
  };
  for (const block of Array.isArray(cat.blocks) ? cat.blocks : []) sortKinds(block?.fields);

  const template = { replaced: [], current: [], changed: [], added: [], removed: [], left: [], copy: undefined, elsewhere: [] };
  const writes = new Map();
  const deletes = new Set();
  const atSite = (path) => join(root, path);
  const candidates = new Set([...Object.keys(hashes.files), ...current.keys()]);
  const stale = [];
  for (const path of [...candidates].sort()) {
    if (!existsSync(atSite(path))) continue;
    const text = readFileSync(atSite(path), 'utf8');
    const plain = untokened(path, text, copyLocale);
    const known = hashes.files[path]?.[hash(plain)];
    const now = current.get(path);
    if (now !== undefined && plain === now) {
      template.current.push(path);
      continue;
    }
    if (known !== undefined) {
      if (now === undefined) stale.push({ path, versions: known });
      else {
        template.replaced.push({ path, versions: known });
        writes.set(path, now.replaceAll('{{LOCALE}}', copyLocale ?? '{{LOCALE}}'));
      }
      continue;
    }
    const { reads, changes } = readsOf(text, kinds);
    template.changed.push({ path, reads, changes });
  }
  // A file the scaffold has now and the version the site came from had not: laid out.
  if (versionOfSite !== undefined && hashes.versions.includes(versionOfSite)) {
    for (const [path, text] of current) {
      if (existsSync(atSite(path))) continue;
      const inTheirs = Object.values(hashes.files[path] ?? {}).some((versions) => versions.includes(versionOfSite));
      if (inTheirs) continue;
      template.added.push(path);
      writes.set(path, text.replaceAll('{{LOCALE}}', copyLocale ?? '{{LOCALE}}'));
    }
  }
  // The copy in the site's language: its read of the home page moved to the door.
  if (copyLocale !== undefined && existsSync(atSite(`src/copy/${copyLocale}.ts`))) {
    const path = `src/copy/${copyLocale}.ts`;
    const moved = copyThroughTheDoor(readFileSync(atSite(path), 'utf8'));
    if (moved !== undefined) {
      template.copy = path;
      writes.set(path, moved);
    }
  }
  // What the scaffold laid out once and lays out no more, untouched: removed
  // where nothing that stays imports it — a stale src/lib/page.ts would
  // still be type-checked — and left, and said, where something does.
  const staying = walk(root, root).filter((path) => /\.(ts|astro|mjs|js|tsx|jsx)$/.test(path) && !stale.some((one) => one.path === path));
  const textOf = (path) => (writes.has(path) ? writes.get(path) : readFileSync(atSite(path), 'utf8'));
  for (const one of stale) {
    const base = one.path.split('/').pop().replace(/\.(m?[jt]s|astro)$/, '');
    const named = new RegExp(`['"][^'"]*/${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.m?[jt]s)?['"]`);
    const users = staying.filter((path) => named.test(textOf(path)));
    if (users.length === 0) {
      template.removed.push(one);
      deletes.add(one.path);
    } else template.left.push({ ...one, users });
  }
  // Every other file of the site's that reads what contract 3 changes.
  for (const path of walk(root, root)) {
    if (!/\.(ts|astro|mjs|js|tsx|jsx)$/.test(path) || candidates.has(path) || path === 'src/content/blocks.ts' || path === template.copy || deletes.has(path)) continue;
    if (path.startsWith('src/content/.blocks-upgrade-')) continue;
    const { changes } = readsOf(readFileSync(atSite(path), 'utf8'), kinds);
    if (changes.length > 0) template.elsewhere.push({ path, changes });
  }
  for (const one of template.changed) {
    questions.push({
      what: 'a scaffold file the developer changed',
      where: one.path,
      ask: `${one.path} is the scaffold's, changed here, so it was left as it is — ${one.changes.length > 0 ? `move these reads to the door by hand: ${one.changes.join('; ')}` : `it reads ${one.reads.length > 0 ? one.reads.join(', ') : 'nothing of the contract by name'}; build and compare the page before and after`}.`,
    });
  }
  for (const one of template.left) {
    questions.push({ what: 'a scaffold file no longer laid out', where: one.path, ask: `${one.path} is the scaffold's (${one.versions.join(', ')}), no longer laid out, and ${one.users.join(', ')} still import${one.users.length === 1 ? 's' : ''} it — move ${one.users.length === 1 ? 'that' : 'those'} to the door (src/lib/site.ts), then delete it.` });
  }
  for (const one of template.elsewhere) {
    questions.push({ what: 'a read the move changes', where: one.path, ask: `${one.path}: ${one.changes.join('; ')}.` });
  }

  // The kit, bumped to the one this scaffold lays out.
  const sitePackage = join(root, 'package.json');
  const pkg = existsSync(sitePackage) ? JSON.parse(readFileSync(sitePackage, 'utf8')) : undefined;
  const kitNow = JSON.parse(readFileSync(join(TEMPLATE, 'package.json'), 'utf8')).dependencies['@jtakeit/kit'];
  const kitThen = pkg?.dependencies?.['@jtakeit/kit'];
  // A kit the site takes from somewhere else than the registry — a tarball
  // in the repository (`file:vendor/jtakeit-kit-0.14.0.tgz`), a checkout
  // (`link:`, `file:../kit`), a workspace, git — is the developer's choice of
  // which kit, kept as written: a staging fixture takes the unpublished kit
  // so (wiki/98 §14 · 2), and a version written over it names one npm has
  // not got (the contract-3 rehearsal, 11 November 2026).
  const local = typeof kitThen === 'string' && !/^[\^~=v]?\d/.test(kitThen.trim()) && !/^(latest|next|\*|[<>])/.test(kitThen.trim());
  const bump = pkg !== undefined && kitThen !== undefined && kitThen !== kitNow && !local;

  // Pictures with no words of their own, which contract 2 drew with the entry's title (§13).
  for (const [file, doc] of Object.entries(moved.write)) {
    if (!file.startsWith('/jtk/entries/') || !isObject(doc.fields)) continue;
    const type = schema.collections?.find((one) => one.name === doc.collection)?.type;
    const fields = schema.blocks.find((one) => one.type === type)?.fields ?? [];
    for (const field of fields) {
      if (field.kind !== 'media') continue;
      const held = doc.fields[field.key];
      const bare = field.multiple === true ? (Array.isArray(held) ? held.filter((one) => isObject(one) && !one.alt).length : 0) : isObject(held) && !held.alt ? 1 : 0;
      if (bare > 0) {
        questions.push({
          what: 'a picture with no words',
          where: `${file.slice(1)} fields.${field.key}`,
          ask: `${bare} picture(s) of ${file.slice(1)} at ${field.key} have no alt of their own; contract 2 drew them with the entry's title, contract 3 draws what the picture says — write the words, in the panel or in the file.`,
        });
      }
    }
  }

  // ── what moves ──────────────────────────────────────────────────────────
  const rel = (file) => file.replace(/^\//, '');
  console.log(`jtk upgrade contract-3 — ${relative(process.cwd(), root) || '.'}${dry ? '  (a dry run: nothing is written)' : ''}\n`);
  console.log('1 · the template reads through the door');
  console.log(
    bump
      ? `  package.json: @jtakeit/kit ${kitThen} → ${kitNow}`
      : local && kitThen !== kitNow
        ? `  package.json: @jtakeit/kit ${kitThen} — not from the registry, kept as written; the template laid out here reads the door of @jtakeit/kit ${kitNow}: put that kit, or a later one, where it points before the build`
        : `  package.json: @jtakeit/kit ${kitThen ?? '(none)'} — the one this scaffold lays out`,
  );
  console.log(`  the scaffold this site came from: ${versionOfSite ?? 'not said'} (jtk/catalogue.json's generator); the table knows ${hashes.versions[0]} to ${hashes.versions.at(-1)}`);
  const versionSaid = (versions) => (versionOfSite !== undefined && versions.includes(versionOfSite) ? versionOfSite : versions.length === 1 ? versions[0] : `${versions[0]}–${versions.at(-1)}`);
  for (const one of template.replaced) console.log(`  ↻ ${one.path} — the scaffold's ${versionSaid(one.versions)}, untouched: replaced with the door's`);
  for (const path of template.added) console.log(`  + ${path} — new in the scaffold since ${versionOfSite}`);
  if (template.current.length > 0) console.log(`  = ${template.current.length} file(s) the scaffold lays out as it does now: left as they are`);
  if (template.copy !== undefined) console.log(`  ↻ ${template.copy} — the site's words kept; its read of jtk/content/index.json moved to the door, site.page('/')`);
  for (const one of template.removed) console.log(`  ✗ ${one.path} — the scaffold's ${versionSaid(one.versions)}, no longer laid out, and nothing imports it`);
  for (const one of template.left) console.log(`  · ${one.path} — the scaffold's ${versionSaid(one.versions)}, no longer laid out, and still imported (listed at the end)`);
  for (const one of template.changed) console.log(`  ✎ ${one.path} — changed here, left as it is (listed at the end)`);
  console.log('\n2 · the declaration');
  console.log(saysThree ? '  src/content/blocks.ts says CONTRACT = 3 already: taken as written' : '  src/content/blocks.ts rewritten in contract 3\'s words, and it says the tables the kit\'s mapping makes of the old one');
  console.log(`  jtk/schema.json: ${schema.blocks.length} block type(s), ${(schema.collections ?? []).length} collection(s)${schema.shared ? `, shared ${schema.shared.join(', ')}` : ''} — written by jtk schema below`);
  console.log('  jtk/catalogue.json removed');
  console.log('\n3 · the documents');
  for (const file of Object.keys(moved.write)) console.log(`  → ${rel(file)}`);
  for (const file of moved.remove) console.log(`  ✗ ${rel(file)}`);
  const kept = documents.length - nameless.length;
  console.log(`  ids: ${kept} kept from the files, ${nameless.length - moved.minted.ids.filter((one) => one.startsWith('/jtk/content/')).length} from the platform's state, ${moved.minted.ids.length} minted${state === undefined ? ' (no --state: the files carried what there was)' : ''}`);
  if (moved.minted.ranks.length > 0) console.log(`  ranks: ${moved.minted.ranks.length} entr${moved.minted.ranks.length === 1 ? 'y' : 'ies'} ranked in the order ${state === undefined ? 'the site lists them' : "the platform's panel lists them"}`);
  if (moved.minted.keys + moved.minted.rekeyed > 0) console.log(`  keys: ${moved.minted.keys} minted, ${moved.minted.rekeyed} minted again where the grammar cannot name them (wiki/98 §16 · 5)`);
  for (const note of notes) console.log(`  · ${note}`);

  if (dry) {
    report(questions);
    console.log('\nA dry run: nothing was written.');
    return 0;
  }

  // ── written, all of it, then judged ─────────────────────────────────────
  writeFileSync(declarationPath, sourceAfter);
  for (const [file, doc] of Object.entries(moved.write)) {
    const at = join(root, rel(file));
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, `${JSON.stringify(doc, null, 2)}\n`);
  }
  for (const file of moved.remove) rmSync(join(root, rel(file)), { force: true });
  pruneEmpty(join(root, 'jtk', 'content'));
  for (const [path, text] of writes) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  for (const path of deletes) rmSync(join(root, path), { force: true });
  if (bump) {
    pkg.dependencies['@jtakeit/kit'] = kitNow;
    writeFileSync(sitePackage, `${JSON.stringify(pkg, null, 2)}\n`);
    if (!has('no-install')) {
      const lock = spawnSync('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund'], { cwd: root, encoding: 'utf8' });
      if (lock.status !== 0) {
        const why = (lock.stderr || lock.stdout).trim().split('\n').find((line) => /error/i.test(line)) ?? 'npm said no';
        console.log(`  ! package-lock.json was not refreshed — ${why.replace(/^npm error /, '')}; run npm install --package-lock-only before the commit, once @jtakeit/kit@${kitNow} is on npm`);
      } else console.log('  package-lock.json refreshed');
    }
  }

  // Each other language's words that are not content, in the kit's, where
  // the site has none: contract 2 said the site's own on those pages unless
  // the developer wrote a copy and registered it, which is kept.
  {
    const { writeCopy } = await import('./copies.mjs');
    for (const tag of Array.isArray(schema.locales) ? schema.locales : []) {
      const done = writeCopy(root, tag);
      if (done === 'written') console.log(`\n  + src/copy/${tag}.ts — ${tag}'s words that are not content (the form's, the privacy page's), in the kit's: read them`);
      if (done === 'unknown') console.log(`\n  ! src/copy/${tag}.ts — the kit has no words for ${tag}: write them (docs/languages.md)`);
    }
  }

  console.log('\n4 · the judge — jtk schema --emit-only on the whole tree');
  const judged = spawnSync(process.execPath, [JTK, 'schema', '--emit-only', '--root', root, '--generator', generator, ...(has('judge') ? ['--judge'] : [])], { cwd: root, encoding: 'utf8' });
  const said = `${judged.stdout ?? ''}${judged.stderr ?? ''}`.trimEnd();
  if (said !== '') console.log(said.split('\n').map((line) => `  ${line}`).join('\n'));
  if (judged.status !== 0) console.log(`  jtk schema said ${judged.status} thing(s) wrong — the tree is moved; fix them before the push`);

  report(questions);
  console.log(`
Next: npm run build, then npx @jtakeit/astro schema — it checks the schema against the
built page — and commit the move as one commit. If this site is live, the push makes a
build that is a candidate: a person publishes it (wiki/98 §8).`);
  return judged.status === 0 ? 0 : Math.min(judged.status ?? 1, 100);
}

/** The questions, as §8 asks them, numbered. */
function report(questions) {
  if (questions.length === 0) {
    console.log('\n5 · for a person: nothing — no value was left undecided');
    return;
  }
  console.log(`\n5 · for a person (wiki/98 §8) — ${questions.length}, each kept where nothing is lost until it is answered`);
  questions.forEach((one, i) => console.log(`  ${i + 1}. ${one.what} — ${one.ask.includes(one.where) ? '' : `${one.where}: `}${one.ask}`));
}

/** Empty directories under one, and it, removed. */
function pruneEmpty(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const entry of readdirSync(dir)) pruneEmpty(join(dir, entry));
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}
