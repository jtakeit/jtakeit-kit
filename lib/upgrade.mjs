/**
 * `jtk upgrade contract-3` — a contract-2 site moved to contract 3 in one
 * commit (jtakeit-core wiki/98 §7). Run by the developer's agent in the
 * site's repository; it writes the working tree and commits nothing, so the
 * move is one commit somebody reads before it is pushed.
 *
 *   jtk upgrade contract-3                    move the tree, then run jtk schema on it
 *   jtk upgrade contract-3 --dry-run          say what would move, write nothing
 *   jtk upgrade contract-3 --state <file>     the platform's state, where the files lack it
 *   jtk upgrade contract-3 --site <id>        the same state, fetched (JTK_API, JTK_TOKEN)
 *   jtk upgrade contract-3 --no-check         not the build and jtk schema against it, at the end
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
 * ── the form's words become content ─────────────────────────────────────────
 *
 * Where the site's `src/components/LeadForm.astro` is the scaffold's, it is
 * replaced with contract 3's (`template/contract-3/`), which draws each
 * question in `asks` under its block's `<key>_label` field: the move declares
 * that field on `cta_banner` for every question, and writes the words a
 * visitor read — the label over each question, the name's, the contact's,
 * the message's and the button's, where nobody wrote them — into the form's
 * block in the site's language and into each language's translation, in the
 * kit's words (lib/copies.mjs, `seedFormWords`), as `jtk create` lays a
 * contract-3 site out. Where the developer changed the form, the questions'
 * words stay the declaration's, and that is listed for a person.
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
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { askLabelField, seedFormWords } from './copies.mjs';
import { outsideLibrary } from './media.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = resolve(HERE, '..');
const TEMPLATE = join(PACKAGE, 'template');
/** Contract 3's own files, which a contract-3 site has in place of the template's (lib/create.mjs). */
const TEMPLATE_3 = join(TEMPLATE, 'contract-3');
const JTK = join(PACKAGE, 'bin', 'jtk.mjs');
/** The scaffold's form, which contract 3 draws every word of from the block (template/contract-3). */
const FORM = 'src/components/LeadForm.astro';

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

// ── the draft, rendered live (jtakeit-core wiki/89 §12) ─────────────────────

/**
 * The scaffold's files a draft is drawn live by: the door per request, the
 * copy and the bodies made of the draft, the pictures and the pages read off
 * no disk, and the one route. A site whose every one of them is the
 * scaffold's — and whose Astro config and package.json are the scaffold's
 * enough to say so — is declared ready (`RENDER = 'live'`); one whose files
 * the developer changed is not, and they are listed.
 */
export const LIVE_FILES = [
  'jtakeit-meta.mjs',
  'src/copy/index.ts',
  'src/lib/entries.ts',
  'src/lib/entryLoader.ts',
  'src/lib/icon.ts',
  'src/lib/site.ts',
  'src/lib/uploads.ts',
  'src/live/Route.astro',
  'src/live/build.d.ts',
  'src/live/images.ts',
  'src/live/middleware.ts',
];

/**
 * What each of those files does for the live render — said where a site's is
 * its own, so the developer reads what to make it do rather than «not the
 * scaffold's» (KAIF's move, 16 November 2026: its integration was
 * fastlane-meta.mjs, its routes its own, and the list named no step).
 */
export const LIVE_DUTIES = {
  'jtakeit-meta.mjs':
    "the integration: under JTK_RENDER=live, liveRender(config) makes the config a server's (output server, @astrojs/node in middleware mode, src/live/images.ts as the image service), astro:config:setup adds src/live/middleware.ts (and injects src/live/Route.astro for the scaffold's catch-alls), astro:route:setup prerenders every route that reads Astro.props from its getStaticPaths",
  'src/copy/index.ts': "makes the copy again from each draft's home page (copyFor), never once at a module's top level",
  'src/lib/entries.ts': "gives an entry's body from the draft (bodyOf): the build's while its words are the same, the site's markdown pipeline where the draft changed them",
  'src/lib/entryLoader.ts': "keeps beside each rendered body what it was made of (sourceOf), so bodyOf can tell a body the draft changed",
  'src/lib/icon.ts': "reads no disk at render: whether public/icon.png is there is the build's (virtual:jtk/build), and sharp is imported only where the icons are drawn",
  'src/lib/site.ts': "wraps the door in live() from @jtakeit/kit/live, so `site` answers from the draft a request carries",
  'src/lib/uploads.ts': "draws a picture uploaded since the build as the bucket's file at its measured size (uploaded)",
  'src/live/Route.astro': "draws the scaffold's catch-alls as one route, /[...path], asking each one's getStaticPaths against the draft",
  'src/live/build.d.ts': 'types virtual:jtk/build for the files that read it',
  'src/live/images.ts': 'serves a picture as it is under server output — nothing resized on request',
  'src/live/middleware.ts': 'renders a request inside the draft the renderer hands it (rendering, @jtakeit/kit/live)',
};

/** The scaffold's catch-alls `src/live/Route.astro` draws — it imports all four. */
export const ROUTE_DRAWS = ['src/pages/[...entry].astro', 'src/pages/[...listing].astro', 'src/pages/[...listing]/page/[page].astro', 'src/pages/[...lang]/index.astro'];

/**
 * The routes of `src/pages` a server cannot draw as they are: each takes its
 * props from its own `getStaticPaths`, which a server never runs. Under
 * `JTK_RENDER=live` each is prerendered, or drawn by `src/live/Route.astro`.
 *
 * @param {Map<string, string>} pages path → text, of src/pages
 */
export function propsRoutes(pages) {
  const out = [];
  for (const [path, text] of pages) {
    const code = codeOf(text);
    if (!/\bgetStaticPaths\b/.test(code)) continue;
    if (/\bAstro\.props\b/.test(code) || (!path.endsWith('.astro') && /\bprops\b/.test(code))) out.push(path);
  }
  return out.sort();
}

/**
 * The Astro integration `astro.config.mjs` takes from a file of the site's —
 * `{ file, name }`, `jtakeit-meta.mjs` and `jtakeitMeta` on the scaffold's
 * config — or undefined where it takes none by a `./…meta….mjs` import.
 *
 * @param {string} config
 */
export function integrationOf(config) {
  const found = /^import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w.-]*meta[\w.-]*\.m?js)['"];?\s*$/im.exec(config);
  if (found === null) return undefined;
  const name = found[1].split(',').map((one) => one.trim()).find((one) => /meta/i.test(one) && one !== 'liveRender');
  return { file: found[2], name: name ?? found[1].split(',')[0].trim() };
}

/**
 * What to paste into an integration the upgrade does not know, so the
 * platform's second build makes a server of the site (the KAIF move, 16
 * November 2026: fastlane-meta.mjs, by hand) — or nothing where it says
 * `liveRender` already.
 *
 * @param {{ file: string; name: string }} integration
 * @param {string[]} prerendered the routes to prerender (propsRoutes)
 * @param {string} adapter the version of @astrojs/node
 */
export function liveSnippet(integration, prerendered, adapter) {
  const routes = prerendered.map((one) => `'${one}'`).join(', ');
  return [
    `npm install @astrojs/node@${adapter}`,
    '',
    `// ${integration.file}, beside its imports: import { sep } from 'node:path'; import { fileURLToPath } from 'node:url';`,
    "const LIVE = process.env.JTK_RENDER === 'live';",
    `const PRERENDERED = new Set([${routes}]);`,
    'const own = (file) => fileURLToPath(new URL(file, import.meta.url));',
    'export async function liveRender(config) {',
    '  if (!LIVE) return config;',
    "  const { default: node } = await import('@astrojs/node');",
    "  return { ...config, output: 'server', adapter: node({ mode: 'middleware' }), image: { ...config.image, service: { entrypoint: own('src/live/images.ts') } } };",
    '}',
    `// ${integration.file}, in ${integration.name}()'s hooks (merged into one it has already):`,
    "'astro:route:setup': ({ route }) => { if (LIVE && PRERENDERED.has(route.component.split(sep).join('/'))) route.prerender = true; },",
    "'astro:config:setup': ({ addMiddleware, config }) => { if (LIVE && config.output === 'server') addMiddleware({ entrypoint: own('src/live/middleware.ts'), order: 'pre' }); },",
    '',
    `// astro.config.mjs: import { ${integration.name}, liveRender } from './${integration.file}';`,
    'export default defineConfig(await liveRender({ … }));',
  ];
}

/**
 * The scaffold's `astro.config.mjs`, its config handed to `liveRender` — or
 * undefined where it is not written the scaffold's way, or already says it.
 *
 * @param {string} text
 */
export function liveConfig(text, integration = { file: 'jtakeit-meta.mjs', name: 'jtakeitMeta' }) {
  if (text.includes('liveRender(')) return undefined;
  const importing = `import { ${integration.name} } from './${integration.file}';`;
  const opening = 'export default defineConfig({';
  if (text.split(importing).length !== 2 || text.split(opening).length !== 2 || !/\n\}\);\n?$/.test(text)) return undefined;
  return text
    .replace(importing, `import { ${integration.name}, liveRender } from './${integration.file}';`)
    .replace(
      opening,
      "// `liveRender` hands this back as it is — except to the platform's second\n" +
        "// build of a site whose schema says `render: \"live\"` (JTK_RENDER=live), which\n" +
        "// it makes for a server, for the panel's live preview of the draft\n" +
        `// (${integration.file}). What is published is the static build alone.\n` +
        'export default defineConfig(await liveRender({',
    )
    .replace(/\n\}\);(\n?)$/, '\n}));$1');
}

/**
 * The declaration saying the template is ready, after `CONTRACT = 3` — or
 * undefined where it says so already, or has no such line to follow.
 *
 * @param {string} text
 */
export function declaredLive(text) {
  if (/^export\s+const\s+RENDER\b/m.test(text)) return undefined;
  const line = /^export\s+const\s+CONTRACT\s*(?::\s*\w+\s*)?=\s*3\s*;?[^\n]*\n/m.exec(text);
  if (line === null) return undefined;
  const at = line.index + line[0].length;
  return (
    `${text.slice(0, at)}\n` +
    '/**\n' +
    ' * Keep this line: the template draws a draft live (src/live/, jtakeit-core\n' +
    ' * wiki/89 §12), so the owner previews a change before a build. `jtk schema`\n' +
    ' * writes it as `render: "live"`, and the platform checks it at every build.\n' +
    ' * Take it out only for a page that does at build what a server cannot, and\n' +
    ' * write the reason in BRIEF.md (docs/live.md).\n' +
    ' */\n' +
    "export const RENDER = 'live';\n" +
    text.slice(at)
  );
}

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
 * A file's code without its comments, each comment's lines kept as empty
 * lines, so a match's line is the file's.
 *
 * @param {string} source
 */
export function codeOf(source) {
  const blank = (comment) => comment.replace(/[^\n]/g, '');
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`\w\\])\/\/[^\n]*/g, '$1');
}

/**
 * What a file reads of the contract, said as a list, and which of those
 * reads contract 3 changes — each with the lines it is read at — for a file
 * the developer changed, which is theirs to move to the door by hand (§8),
 * and for any other file of the site's.
 *
 * Contract 2's reads that contract 3 changes, by what the code says:
 *
 *   jtk/content/          the literal path, and `join(…, 'jtk', 'content')`
 *   the declaration's     COLLECTIONS read from blocks.ts: its `prefix`, its
 *     collections         `pages` and its `body`, which contract 3's has not
 *                         got (the door's collection says them, `site.collections`)
 *   drafts                in a writer of `_meta.json` (an astro:build:done hook):
 *                         the build refuses them on contract 3
 *   `<key>_alt`           a picture's words, by their key, through any reader
 *   an annotation         `blocks[0].title`, `page:/afisha/<slug>:…`, written by hand
 *
 * @param {string} source
 * @param {{ money: Set<string>; refs: Set<string>; lists: Set<string>; pictures: Set<string>; alts: Set<string> }} kinds
 *   the contract-2 declaration's keys by what contract 3 changes in their values
 * @returns {{ reads: string[]; changes: string[]; weight: number }} `weight`: how many reads move
 */
export function readsOf(source, kinds) {
  const text = codeOf(source);
  const lineAt = (index) => text.slice(0, index).split('\n').length;
  const reads = new Set();
  /** @type {Map<string, number[]>} what moves → the lines it is read at */
  const moving = new Map();
  const say = (line, index) => {
    const lines = moving.get(line) ?? [];
    const at = lineAt(index);
    if (!lines.includes(at)) lines.push(at);
    moving.set(line, lines);
  };
  const altsSaid = new Set();
  for (const match of text.matchAll(/\.(block|type|text|value|rows|picture|gallery|at|minor|refs|entries|entry|collection|module|settings|rolesOf)\(\s*['"]([a-z][a-z0-9_]*)['"]/g)) {
    const [, call, key] = match;
    reads.add(`${call}('${key}')`);
    if (kinds.alts.has(key)) {
      altsSaid.add(key);
      say(`${call}('${key}'): contract 3 folds ${key} into its picture — read picture('${key.slice(0, -4)}').alt`, match.index);
    } else if ((call === 'value' || call === 'text') && kinds.money.has(key)) say(`${call}('${key}'): a price is { minor } in contract 3 — minor('${key}'), or site.money(value)`, match.index);
    else if ((call === 'value' || call === 'text') && kinds.refs.has(key)) say(`${call}('${key}'): a reference is an entry's id in contract 3, not its slug — refs('${key}')`, match.index);
    else if (call === 'rows' && kinds.lists.has(key)) say(`rows('${key}'): a list of one-ref rows is one reference to many in contract 3 — refs('${key}')`, match.index);
    else if ((call === 'value' || call === 'text') && kinds.pictures.has(key)) say(`${call}('${key}'): one picture is { src, alt } in contract 3 — picture('${key}')`, match.index);
  }
  // A picture's words read by their key through a reader of the site's own:
  // KAIF's `n.v('cover_alt')`, the copy's `str(hero, 'image_alt')`.
  for (const match of text.matchAll(/['"]([a-z][a-z0-9_]*_alt)['"]/g)) {
    const key = match[1];
    if (!kinds.alts.has(key) || altsSaid.has(key)) continue;
    reads.add(`'${key}'`);
    say(`'${key}': contract 3 folds ${key} into its picture — read the picture's alt (picture('${key.slice(0, -4)}').alt, or the door's picture value)`, match.index);
  }
  for (const match of text.matchAll(/jtk\/content\b|['"]jtk['"]\s*,\s*['"]content['"]/g)) {
    reads.add('jtk/content/');
    say('jtk/content/: contract 3 keeps pages in jtk/pages/ and entries in jtk/entries/ (wiki/98 §2) — read them through the door (src/lib/site.ts)', match.index);
  }
  for (const match of text.matchAll(/catalogue\.json/g)) {
    reads.add('jtk/catalogue.json');
    say("jtk/catalogue.json: contract 3's schema is jtk/schema.json — read it through the door", match.index);
  }
  {
    const glob = /import\.meta\.glob\(\s*['"`]\/?jtk\//.exec(text);
    if (glob !== null && !/content\(import\.meta\.glob/.test(text)) {
      reads.add('import.meta.glob(jtk/…)');
      say("import.meta.glob over jtk/: the files are the door's to read — content(import.meta.glob(...)) in src/lib/site.ts", glob.index);
    }
  }
  // The declaration's collections, read as contract 2 wrote them: contract
  // 3's say `route` and `shown_on`, and its door's collection (site.collections)
  // says the prefix and whether entries have pages.
  const declaration = /import\s+(?:type\s+)?\{[^}]*\b(?:COLLECTIONS|Collection)\b[^}]*\}\s*from\s*['"][./]*(?:src\/)?content\/blocks(?:\.ts)?['"]/.test(text);
  const door = /from\s+['"][./]*lib\/site['"]|\bsite\.(page|entries|entry|shared|module|settings|collection|collections)\b/.test(text);
  for (const match of text.matchAll(/\.(prefix|pages|body)\b(?!\s*\()/g)) {
    const what = match[1];
    if (what === 'prefix' ? door : !declaration) continue;
    if (what !== 'prefix' && !/collection|COLLECTIONS/i.test(text.slice(Math.max(0, match.index - 40), match.index))) continue;
    reads.add(`collection.${what}`);
    say(
      what === 'prefix'
        ? "a collection's prefix: contract 3's declaration says its route (detail and listing) and shown_on, no prefix — read where an entry is from the door (site.entries(name), each entry's address and anchor)"
        : what === 'pages'
          ? "a collection's pages: contract 3 says route: 'none' for a collection without pages — read it from the door (site.collections, each one's pages)"
          : "a collection's body: contract 3's collection names the block types an entry may hold in blocks — read an entry's body from the door (entry.body)",
      match.index,
    );
  }
  if (declaration && !reads.has('collection.prefix') && !reads.has('collection.pages') && !reads.has('collection.body') && /\bCOLLECTIONS\b/.test(text.replace(/import[^;]*;/g, ''))) {
    reads.add('COLLECTIONS');
    const at = text.replace(/import[^;]*;/g, (one) => one.replace(/[^\n]/g, ' ')).search(/\bCOLLECTIONS\b/);
    say("COLLECTIONS from src/content/blocks.ts: contract 3's collections are written in its words (route, shown_on) — read them from the door (site.collections)", at);
  }
  // Contract 2's `_meta.json`, written by the site's own hook.
  if (/astro:build:done|_meta\.json/.test(text)) {
    for (const match of text.matchAll(/[{,]\s*drafts\s*(?=[,}:])|\bdrafts\s*:/g)) {
      reads.add('_meta.json drafts');
      say("drafts in _meta.json: contract 3's _meta.json says redirects, immutable and cache only — which entries a visitor may not see is the platform's to say, and the build refuses drafts (JTK_E_META_INVALID); leave them out", match.index);
      break;
    }
  }
  for (const match of text.matchAll(/data-jtk-path=["'`][^"'`]*blocks\[\d|blocks\[\$\{|[`'"][^`'"\n]*?\bblocks\[\d+\]\.[a-z$]/g)) {
    reads.add('an annotation written by hand');
    say('an annotation by index, written by hand: contract 3 names a block and a row by _key — at() writes it', match.index);
  }
  for (const match of text.matchAll(/[`'"](?:page|entry):(?:\/|\$\{)/g)) {
    reads.add('another document by its address');
    say("an annotation naming another document by its address (page:/path:…): contract 3 names an entry or a page by its id — entry:<id>:<field>, page:<id>:…, which the door's at() writes", match.index);
  }
  if (door || /from ['"][./]*lib\/site['"]/.test(text)) reads.add('the door (src/lib/site.ts)');
  const changes = [...moving].map(([line, lines]) => `${line} (line ${lines.sort((a, b) => a - b).join(', ')})`);
  return { reads: [...reads], changes, weight: [...moving.values()].reduce((n, lines) => n + lines.length, 0) };
}

// ── what a file imports, and what the upgrade may write (B2) ────────────────

/** The local modules a file imports — `./x`, `../lib/site` — by the specifier it writes them with. */
export function importsOf(source) {
  const text = codeOf(source);
  const out = new Set();
  for (const match of text.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g)) out.add(match[1]);
  for (const match of text.matchAll(/\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) out.add(match[1]);
  return [...out];
}

/**
 * The names a file imports from one specifier — `default` for a default
 * import — or undefined where it takes the module whole (`* as`, a bare
 * import, a dynamic one).
 */
export function namedImportsOf(source, spec) {
  const text = codeOf(source);
  const quoted = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = new Set();
  let whole = false;
  for (const match of text.matchAll(new RegExp(`\\bimport\\s+(?:type\\s+)?([\\w*{}\\s,$]+?)\\s+from\\s+['"]${quoted}['"]`, 'g'))) {
    const clause = match[1].trim();
    if (/\*\s+as\s+/.test(clause)) whole = true;
    const braces = /\{([^}]*)\}/.exec(clause);
    const head = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
    if (head !== '' && !head.startsWith('*')) names.add('default');
    for (const part of (braces?.[1] ?? '').split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (name !== '') names.add(name);
    }
  }
  if (whole) return undefined;
  return names.size === 0 ? undefined : [...names];
}

/** The names a module exports, or undefined where it cannot be told (`export *`). An Astro component exports its default. */
export function exportsOf(source, path = '') {
  const text = codeOf(path.endsWith('.astro') ? (/^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '') : source);
  if (/\bexport\s*\*\s*from\b/.test(text)) return undefined;
  const names = new Set(path.endsWith('.astro') ? ['default'] : []);
  if (/\bexport\s+default\b/.test(text)) names.add('default');
  for (const match of text.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of text.matchAll(/\bexport\s+(?:const|let|var)\s+\{([^}]*)\}\s*=/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(':').pop().trim().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const match of text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const said = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
      const name = (said[1] ?? said[0]).trim();
      if (name !== '') names.add(name);
    }
  }
  return names;
}

const EXTENSIONS = ['', '.ts', '.mjs', '.js', '.astro', '.tsx', '.jsx', '.json', '/index.ts', '/index.mjs', '/index.js', '/index.astro'];

/** Where a specifier of a file leads, among the paths `exists` says are there; undefined for none, `'..'` for outside the site. */
export function resolveImport(from, spec, exists) {
  const bare = spec.split('?')[0];
  const base = posix.normalize(posix.join(posix.dirname(from), bare));
  if (base.startsWith('../') || base === '..') return '..';
  for (const ext of EXTENSIONS) if (exists(base + ext)) return base + ext;
  if (bare.endsWith('.js') && exists(base.replace(/\.js$/, '.ts'))) return base.replace(/\.js$/, '.ts');
  return undefined;
}

/**
 * What the upgrade may write of the scaffold's files, closed over their
 * imports (B2): a file it replaces or lays in brings the scaffold's files it
 * imports that the site lacks, or is not written — where it imports one the
 * developer changed (contract 3's `content.config.ts` calls `entries()` with
 * no collection; a changed `entryLoader.ts` reads `collection.prefix`), one
 * nobody has, or a name the file it imports no longer exports; and a file
 * the upgrade writes over is not written where a file it leaves imports a
 * name the new one has not got. To a fixed point: a file not written makes
 * the files that need it unwritten in turn. What was brought only for a file
 * that is not written is not brought.
 *
 * @param {Map<string, string>} seeds path → the text the upgrade would write
 * @param {{
 *   exists: (path: string) => boolean;
 *   text: (path: string) => string | undefined;
 *   template: Map<string, string>;
 *   current: (path: string) => boolean;
 *   files: string[];
 * }} tree
 *   `exists` and `text`: the site as it will be but for the template (blocks.ts and the copy as the upgrade writes them);
 *   `template`: the scaffold's files now, as the site would have them; `current`: the site's file is the template's already;
 *   `files`: the site's code, the importers to hold to what is written
 * @returns {{ writes: Map<string, string>; brought: string[]; dropped: { path: string; why: string }[] }}
 */
export function closeOver(seeds, tree) {
  const writes = new Map(seeds);
  const brought = new Set();
  const dropped = [];
  /** A file of the scaffold's that could not be laid in, and why: never brought again. */
  const refused = new Map();
  const there = (path) => writes.has(path) || tree.exists(path);
  const textNow = (path) => (writes.has(path) ? writes.get(path) : tree.text(path));
  const ours = (path) => (writes.has(path) ? writes.get(path) === tree.template.get(path) : tree.current(path));
  const drop = (path, why) => {
    writes.delete(path);
    if (brought.delete(path)) {
      refused.set(path, why);
      return;
    }
    dropped.push({ path, why });
  };
  const exportsAt = new Map();
  const exported = (path) => {
    const text = textNow(path);
    if (text === undefined || !/\.(m?[jt]sx?|astro)$/.test(path)) return undefined;
    const key = `${path}\u0000${text.length}\u0000${writes.has(path)}`;
    if (!exportsAt.has(key)) exportsAt.set(key, exportsOf(text, path));
    return exportsAt.get(key);
  };
  const lacking = (importer, spec, at) => {
    const names = namedImportsOf(textNow(importer) ?? '', spec);
    const has = exported(at);
    if (names === undefined || has === undefined) return [];
    return names.filter((one) => !has.has(one));
  };
  // Each turn writes fewer files or brings one more of the template's, never
  // one refused: it ends. The bound is a guard, not the reason.
  for (let again = true, turns = 0; again && turns < 10_000; turns += 1) {
    again = false;
    for (const path of [...writes.keys()]) {
      if (!writes.has(path)) continue;
      let why;
      for (const spec of importsOf(writes.get(path))) {
        const at = resolveImport(path, spec, there);
        if (at === '..') continue;
        if (at === undefined) {
          const lay = resolveImport(path, spec, (one) => tree.template.has(one));
          if (lay !== undefined && refused.has(lay)) {
            why = `it imports ${lay}, which this site has not got and which cannot be laid in: ${refused.get(lay).replace(/^it /, 'it ')}`;
            break;
          }
          if (lay !== undefined && lay !== '..' && !tree.exists(lay)) {
            writes.set(lay, tree.template.get(lay));
            brought.add(lay);
            again = true;
            continue;
          }
          why = `it imports ${spec}, which this site has not got`;
          break;
        }
        if (tree.template.has(at) && !ours(at)) {
          why = `it imports ${at}, which is ${tree.exists(at) ? 'not the scaffold\'s as it is now — the developer\'s, or an older one kept' : 'not there'}: the two move together`;
          break;
        }
        const missing = lacking(path, spec, at);
        if (missing.length > 0) {
          why = `it imports ${missing.join(', ')} from ${at}, which ${at} does not export`;
          break;
        }
      }
      if (why !== undefined) {
        drop(path, why);
        again = true;
      }
    }
    if (again) continue;
    // The other way: a file the upgrade leaves, importing a name the file it writes over no longer has.
    for (const importer of tree.files) {
      if (writes.has(importer)) continue;
      const text = tree.text(importer);
      if (text === undefined) continue;
      for (const spec of importsOf(text)) {
        const at = resolveImport(importer, spec, there);
        if (at === undefined || at === '..' || !writes.has(at) || brought.has(at)) continue;
        const missing = lacking(importer, spec, at);
        if (missing.length > 0) {
          drop(at, `${importer} imports ${missing.join(', ')} from it, which the scaffold's ${at} now does not export`);
          again = true;
        }
      }
    }
  }
  // What was brought for a file no longer written: not brought.
  for (let again = true; again; ) {
    again = false;
    for (const path of brought) {
      const needed = [...writes.keys(), ...tree.files.filter((one) => !writes.has(one))].some((one) => {
        if (one === path) return false;
        const text = textNow(one);
        return text !== undefined && importsOf(text).some((spec) => resolveImport(one, spec, there) === path);
      });
      if (!needed) {
        writes.delete(path);
        brought.delete(path);
        again = true;
      }
    }
  }
  return { writes, brought: [...brought].sort(), dropped };
}

/**
 * The scaffold's version the site's files came from, by their hashes rather
 * than by `jtk/catalogue.json`'s `generator`, which `jtk catalogue` writes
 * again at every run (KAIF said 0.16.0, and its files hash as 0.1.0–0.9.2):
 * the versions every untouched file of the scaffold agrees on, or, where
 * none is agreed on by all, those most of them agree on.
 *
 * @param {string[][]} known the versions each untouched file is in
 * @param {string[]} order every version, oldest first
 * @returns {{ versions: string[]; files: number; all: boolean } | undefined}
 */
export function provenanceOf(known, order) {
  const lists = known.filter((one) => Array.isArray(one) && one.length > 0);
  if (lists.length === 0) return undefined;
  const count = new Map();
  for (const one of lists) for (const version of new Set(one)) count.set(version, (count.get(version) ?? 0) + 1);
  const most = Math.max(...count.values());
  const versions = order.filter((one) => count.get(one) === most);
  return { versions, files: most, all: most === lists.length };
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
  return `jtk upgrade contract-3 [--dry-run] [--state <file> | --site <id>] [--judge] [--root <dir>]
                       [--force] [--mint-ids] [--no-install] [--no-check] [--take-base[=<type>.<field>,…]]
                                  move a contract-2 site to contract 3 in one commit
                                  (jtakeit-core wiki/98 §7): the template onto the door,
                                  blocks.ts in contract 3's words, every file at its place,
                                  then jtk schema; what a person must answer, listed; then
                                  the site built and checked (--no-check skips it). --site
                                  fetches the platform's state with JTK_API and JTK_TOKEN`;
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
  /** What `jtk catalogue` last wrote into the catalogue — the kit that ran it, which is no provenance (B2). */
  const generatorSaid = /^@jtakeit\/astro@(\d+\.\d+\.\d+)$/.exec(cat.generator ?? '')?.[1];

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

  // The form: the scaffold's, untouched — any version's, or this one's on
  // either contract — is replaced with contract 3's below, which draws every
  // word on it from the block; one the developer changed is left, and with it
  // the questions' words as the declaration says them.
  const hashes = table();
  const formOurs = (() => {
    const at = join(root, FORM);
    if (!existsSync(at)) return false;
    const text = readFileSync(at, 'utf8');
    return [join(TEMPLATE_3, FORM), join(TEMPLATE, FORM)].some((one) => existsSync(one) && readFileSync(one, 'utf8') === text) || hashes.files[FORM]?.[hash(text)] !== undefined;
  })();

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
  /** Fields the move declares besides the mapping's, per block type (the form's questions' words). */
  const addedFields = new Map();
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

    // The words over each question of the form: the block's own, where the
    // scaffold's form will draw them (contract 3's LeadForm.astro reads
    // `<key>_label`), the declaration's `label` left to name the answer in
    // the owner's inbox.
    const form = (tables.BLOCKS ?? []).find((one) => isObject(one) && one.type === 'cta_banner' && typeof one.collects === 'string' && one.collects !== '' && Array.isArray(one.fields));
    const keys = new Set((form?.fields ?? []).map((one) => one?.key));
    const unsaid = (Array.isArray(form?.asks) ? form.asks : []).filter((one) => isObject(one) && typeof one.key === 'string' && !keys.has(`${one.key}_label`));
    if (unsaid.length > 0 && formOurs) {
      const fields = unsaid.map((one) => askLabelField(one.key));
      form.fields.push(...fields);
      addedFields.set('cta_banner', { fields, note: 'What a visitor reads over each question in asks: the owner\'s words, since `jtk upgrade contract-3`.' });
      notes.push(`cta_banner declares ${fields.map((one) => one.key).join(', ')}: the words over the form's question${fields.length === 1 ? '' : 's'}, content from now on — the declaration's label names the answer in the inbox`);
    } else if (unsaid.length > 0) {
      questions.push({
        what: 'a question whose words are the declaration\'s',
        where: FORM,
        ask: `${FORM} is the developer's, so the words over ${unsaid.map((one) => `«${one.key}»`).join(', ')} stay the declaration's label — fixed, untranslatable in the panel. To make them the owner's: declare ${unsaid.map((one) => `${one.key}_label`).join(', ')} on cta_banner and draw each as the scaffold's contract-3 form does (node_modules/@jtakeit/astro/template/contract-3/${FORM}).`,
      });
    }

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
      forms: upgrade.scaffoldFormsOf(declared),
      ownListings,
      contacts,
      shared: tables.SHARED,
      upgraded: `Moved from contract 2 by \`jtk upgrade contract-3\` (${generator}, ${today})`,
      added: addedFields,
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
  if (flag('state') === undefined && flag('site') !== undefined) {
    // The platform's state, fetched: what get_site and get_content hand an
    // agent over MCP, asked of the API with the token jtk schema --judge
    // sends (JTK_API, JTK_TOKEN) — no file to assemble by hand.
    try {
      state = upgrade.stateOf(await stateFromThePlatform(flag('site')));
    } catch (why) {
      return refuse(`--site ${flag('site')}: ${why.message}`);
    }
    if (state.faults.length > 0) return refuse(`--site ${flag('site')}: the platform's answer is not a site's state:\n${state.faults.map((one) => `    ${one}`).join('\n')}`);
    console.log(`the platform's state of ${flag('site')}: ${state.pages.length} page(s) and entr${state.pages.length === 1 ? 'y' : 'ies'}, read from ${process.env.JTK_API.trim().replace(/\/+$/, '')}`);
  } else if (flag('state') !== undefined) {
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
        '  Fetch the state, read-only: --site <id> with JTK_API and JTK_TOKEN, or through the MCP server and hand it over — { "site": get_site, "pages": get_content\'s pages } — with --state <file>;\n' +
        '  or, for a tree the platform has never imported, --mint-ids.',
    );
  }

  // ── the template (§7 · 1) ───────────────────────────────────────────────
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
  // Contract 3's own, in place of the template's: what a contract-3 site has
  // there (lib/create.mjs). The template's own text of such a file is this
  // scaffold's contract 2's, untouched wherever a site still has it.
  const contract2 = new Map();
  for (const path of walk(TEMPLATE_3, TEMPLATE_3)) {
    if (!ownFile(path) || BINARY.test(path)) continue;
    const text = readFileSync(join(TEMPLATE_3, path), 'utf8');
    if (tokened(text)) continue;
    if (current.has(path)) contract2.set(path, current.get(path));
    current.set(path, text);
  }
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

  const template = { replaced: [], current: [], changed: [], added: [], removed: [], left: [], kept: [], copy: undefined, elsewhere: [] };
  const writes = new Map();
  const deletes = new Set();
  const atSite = (path) => join(root, path);
  const candidates = new Set([...Object.keys(hashes.files), ...current.keys()]);
  const stale = [];
  /** The versions each of the site's untouched scaffold files is in: where the site came from (B2). */
  const known = [];
  // The scaffold's files as a contract-3 site has them: the words `jtk
  // create` gives a shared file on contract 3 — `jtk/schema.json` where
  // contract 2's says `jtk/catalogue.json` (B14) — and its language's copy
  // module named.
  const { contract3Words } = await import('./create.mjs');
  const worded = (path, text) => {
    const three = contract3Words(path, text);
    return typeof three === 'string' ? three : text;
  };
  const materialized = (text, path) => (path === undefined ? text : worded(path, text)).replaceAll('{{LOCALE}}', copyLocale ?? '{{LOCALE}}');
  /** The files the scaffold lays out as they are, whose words alone contract 3 says otherwise. */
  const reworded = new Set();
  /** What the upgrade would replace, before its imports are closed over. */
  const seeds = new Map();
  const versionsOf = new Map();
  for (const path of [...candidates].sort()) {
    if (!existsSync(atSite(path))) continue;
    const text = readFileSync(atSite(path), 'utf8');
    const plain = untokened(path, text, copyLocale);
    const versions = hashes.files[path]?.[hash(plain)] ?? (contract2.get(path) === plain ? [version] : undefined);
    if (versions !== undefined) known.push(versions);
    const now = current.get(path);
    if (now !== undefined && plain === now) {
      template.current.push(path);
      if (worded(path, now) !== now) {
        seeds.set(path, materialized(now, path));
        reworded.add(path);
      }
      continue;
    }
    if (versions !== undefined) {
      if (now === undefined) stale.push({ path, versions });
      else {
        seeds.set(path, materialized(now, path));
        versionsOf.set(path, versions);
      }
      continue;
    }
    const { reads, changes, weight } = readsOf(text, kinds);
    template.changed.push({ path, reads, changes, weight });
  }
  // The door every read is moved to (src/lib/site.ts): laid in where the
  // site has none, or each read the list below names has nowhere to go —
  // KAIF's template predated it, and it was the first file written by hand.
  const DOOR = 'src/lib/site.ts';
  const doorLaid = current.has(DOOR) && !existsSync(atSite(DOOR));
  if (doorLaid) seeds.set(DOOR, materialized(current.get(DOOR), DOOR));
  // Where the site came from, by its files' hashes: `generator` is restamped
  // by every run of jtk catalogue, and says the kit that last ran it.
  const came = provenanceOf(known, hashes.versions);
  const cameSaid = came === undefined ? undefined : came.versions.length === 1 ? came.versions[0] : `${came.versions[0]}–${came.versions.at(-1)}`;
  // The copy in the site's language: its read of the home page moved to the door.
  if (copyLocale !== undefined && existsSync(atSite(`src/copy/${copyLocale}.ts`))) {
    const path = `src/copy/${copyLocale}.ts`;
    const moved = copyThroughTheDoor(readFileSync(atSite(path), 'utf8'));
    if (moved !== undefined) {
      template.copy = path;
      writes.set(path, moved);
    }
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

  // What is written of the scaffold's, closed over its imports (B2): a file
  // replaced brings what it imports and the site lacks, or is left as it is
  // with what keeps it; nothing is laid in for itself — a file new to the
  // scaffold comes in only as what a written file imports, or as the live
  // render below — so after the move no file imports what is not there.
  const siteCode = walk(root, root).filter((path) => /\.(ts|astro|mjs|js|tsx|jsx)$/.test(path) && !path.startsWith('src/content/.blocks-upgrade-'));
  const templateNow = new Map([...current].map(([path, text]) => [path, materialized(text, path)]));
  const tree = {
    exists: (path) => writes.has(path) || existsSync(atSite(path)),
    text: (path) => (path === 'src/content/blocks.ts' ? sourceAfter : writes.has(path) ? writes.get(path) : existsSync(atSite(path)) && statSync(atSite(path)).isFile() ? readFileSync(atSite(path), 'utf8') : undefined),
    template: templateNow,
    current: (path) => template.current.includes(path),
    files: siteCode,
  };
  let closed = closeOver(seeds, tree);

  // The draft rendered live: declared where every file it is drawn by is the
  // scaffold's once the template above is written, the Astro config hands
  // itself to liveRender, and the adapter is a dependency (wiki/89 §12). Its
  // own files (src/live/) are laid in only then, with what they import (B7):
  // on a site that is not ready they are files nothing uses, importing what
  // the site has not got. A site whose integration is its own (KAIF's
  // fastlane-meta.mjs) is wired by what that integration says, and its
  // src/live/ by what its routes need: the middleware and the pictures, and
  // Route.astro only beside the scaffold's catch-alls; where it says no
  // liveRender, the lines to paste are printed with the first question.
  const adapterNow = JSON.parse(readFileSync(join(TEMPLATE, 'package.json'), 'utf8')).dependencies['@astrojs/node'];
  const live = { ready: false, why: [], config: undefined, adapter: false, laid: [], check: [], snippet: undefined, integration: undefined, prerender: [] };
  /** Said first for a person: without it the owner previews no change before a build. */
  let liveQuestion;
  {
    const own = (path) => path.startsWith('src/live/');
    const textNow = (path) => (closed.writes.has(path) ? closed.writes.get(path) : existsSync(atSite(path)) ? readFileSync(atSite(path), 'utf8') : undefined);
    const duty = (path) => (LIVE_DUTIES[path] ? ` — it ${LIVE_DUTIES[path]}` : '');
    const config = existsSync(atSite('astro.config.mjs')) ? readFileSync(atSite('astro.config.mjs'), 'utf8') : '';
    const integration = integrationOf(config);
    // An integration of the site's own (KAIF's fastlane-meta.mjs): wired by
    // what it says, not by the scaffold's bytes, and its routes by what they
    // need — Route.astro only where the scaffold's catch-alls are.
    const theirs = integration !== undefined && integration.file !== 'jtakeit-meta.mjs';
    live.integration = integration;
    const pages = new Map(siteCode.filter((path) => path.startsWith('src/pages/')).map((path) => [path, textNow(path) ?? '']));
    const needsProps = propsRoutes(pages);
    const routeDrawn = ROUTE_DRAWS.every((path) => pages.has(path));
    const imported = (path) => siteCode.some((from) => !LIVE_FILES.includes(from) && importsOf(textNow(from) ?? '').some((spec) => resolveImport(from, spec, (one) => one === path) === path));
    if (theirs) {
      live.prerender = needsProps;
      for (const path of LIVE_FILES) {
        if (path === 'jtakeit-meta.mjs' || own(path)) continue;
        const want = templateNow.get(path);
        const have = textNow(path);
        if (have === undefined) {
          if (imported(path)) live.why.push(`${path} is not there and the site imports it${duty(path)}`);
          continue;
        }
        if (want === undefined || have === want) continue;
        // The door: by what it does, which one import says.
        if (path === 'src/lib/site.ts' && /['"]@jtakeit\/kit\/live['"]/.test(have)) continue;
        if (path === 'src/lib/site.ts') live.why.push(`${path} is the site's own${duty(path)}`);
        else live.check.push(`${path}${duty(path)}`);
      }
      const meta = textNow(integration.file) ?? '';
      const wired = /\bliveRender\b/.test(meta) && /JTK_RENDER/.test(meta) && /src\/live\/middleware/.test(meta);
      if (!wired) {
        live.why.push(`${integration.file} is the site's integration, not the scaffold's jtakeit-meta.mjs, and does not wire the live render — paste the lines below into it`);
        live.snippet = liveSnippet(integration, needsProps, adapterNow);
      } else if (!config.includes('liveRender(')) {
        live.config = liveConfig(config, integration);
        if (live.config === undefined) live.why.push(`astro.config.mjs does not hand its config to liveRender from ./${integration.file}: export default defineConfig(await liveRender({ … }))`);
      }
      // Its own files, by what the routes need: the middleware and the
      // pictures always, the one route only for the scaffold's catch-alls.
      const laid = ['src/live/middleware.ts', 'src/live/images.ts', ...(routeDrawn ? ['src/live/Route.astro', 'src/live/build.d.ts'] : [])].filter((path) => templateNow.has(path) && !existsSync(atSite(path)));
      if (laid.length > 0) {
        const trial = closeOver(new Map([...seeds, ...laid.map((path) => [path, templateNow.get(path)])]), tree);
        const lost = trial.dropped.filter((one) => own(one.path));
        if (lost.length > 0) live.why.push(...lost.map((one) => `${one.path} cannot be laid in: ${one.why}`));
        else {
          closed = trial;
          template.added.push(...laid);
          live.laid = laid;
        }
      }
    } else {
      for (const path of LIVE_FILES) {
        const want = templateNow.get(path);
        const have = textNow(path);
        if (have === undefined && own(path) && want !== undefined) continue;
        if (have === undefined) live.why.push(`${path} is not there${duty(path)}`);
        else if (want !== undefined && have !== want) live.why.push(`${path} is the site's own, not the scaffold's${duty(path)}`);
      }
      if (!config.includes('liveRender(')) {
        live.config = liveConfig(config);
        if (live.config === undefined) live.why.push("astro.config.mjs is not the scaffold's: hand its config to liveRender from ./jtakeit-meta.mjs — export default defineConfig(await liveRender({ … }))");
      }
    }
    live.adapter = pkg !== undefined && pkg.dependencies?.['@astrojs/node'] === undefined && pkg.devDependencies?.['@astrojs/node'] === undefined;
    if (pkg === undefined) live.why.push('there is no package.json to add @astrojs/node to');
    if (!theirs && live.why.length === 0) {
      const laid = [...templateNow.keys()].filter((path) => own(path) && !existsSync(atSite(path)));
      if (laid.length > 0) {
        const trial = closeOver(new Map([...seeds, ...laid.map((path) => [path, templateNow.get(path)])]), tree);
        const lost = trial.dropped.filter((one) => own(one.path));
        if (lost.length > 0) live.why.push(...lost.map((one) => `${one.path} cannot be laid in: ${one.why}`));
        else {
          closed = trial;
          template.added.push(...laid);
        }
      }
    }
    live.ready = live.why.length === 0;
    if (live.ready && declaredLive(sourceAfter) !== undefined) sourceAfter = declaredLive(sourceAfter);
    else if (live.ready && !/^export\s+const\s+RENDER\b/m.test(sourceAfter)) live.why.push('src/content/blocks.ts has no `export const CONTRACT = 3` to say it after');
    if (!live.ready || live.why.length > 0) {
      live.ready = false;
      const laidSaid = live.laid.length > 0 ? `${live.laid.join(' and ')} laid in` : 'src/live/ is not laid in';
      liveQuestion = {
        what: 'the site will not be drawn live',
        where: 'src/content/blocks.ts',
        ask: `the panel's preview will not draw this site live — the owner sees a change only after a build, and cannot preview an entry's card before it is saved. RENDER = 'live' is not said, ${laidSaid}, because: ${live.why.map((one, i) => `(${i + 1}) ${one}`).join('; ')}. Wire the site's own pages into src/live as docs/live.md says ("Moving a site"), then say RENDER = 'live' in src/content/blocks.ts and build — the platform checks it. Leave it out only where a page does at build what a server cannot, and say why in BRIEF.md.`,
        snippet: live.snippet,
      };
    }
    // A route a server cannot draw as it is that the integration neither
    // prerenders nor draws (the scaffold's DRAWN, or the site's own list):
    // the platform's check would find its pages differ.
    if (live.snippet === undefined) {
      const meta = textNow(theirs ? integration.file : 'jtakeit-meta.mjs') ?? (theirs ? '' : templateNow.get('jtakeit-meta.mjs') ?? '');
      live.prerender = needsProps.filter((path) => !meta.includes(`'${path}'`));
    } else live.prerender = [];
  }
  for (const [path, text] of closed.writes) {
    writes.set(path, text);
    if (doorLaid && path === DOOR) template.added.push(DOOR);
    else if (seeds.has(path) && !reworded.has(path)) template.replaced.push({ path, versions: versionsOf.get(path) });
  }
  template.added.push(...closed.brought);
  for (const one of closed.dropped) {
    if (!seeds.has(one.path) || reworded.has(one.path) || (doorLaid && one.path === DOOR)) continue;
    const { reads, changes, weight } = readsOf(readFileSync(atSite(one.path), 'utf8'), kinds);
    const why = one.why.startsWith('it ') ? `contract 3's ${one.path.split('/').pop()} ${one.why.slice(3)}` : one.why;
    template.kept.push({ path: one.path, versions: versionsOf.get(one.path), why, reads, changes, weight });
  }

  // A document the site's own code imports by its file — KAIF's copy took
  // the home page as `jtk/content/index.json` — named where the move puts
  // it, so nothing imports a file the move removed; what it reads of the
  // document, whose shape moved too, is listed below with the rest.
  const movedTo = new Map();
  for (const file of moved.remove) {
    const raw = files[file];
    if (!file.startsWith('/jtk/content/') || !isObject(raw) || typeof raw.path !== 'string') continue;
    const slug = raw.path.split('/').filter(Boolean).pop();
    const target = typeof raw.collection === 'string' && raw.collection !== '' ? upgrade.entryFile3(raw.collection, slug) : upgrade.pageFile3(raw.path.replace(/(.)\/+$/, '$1'));
    if (Object.hasOwn(moved.write, target)) movedTo.set(file.slice(1), target.slice(1));
  }
  template.renamed = [];
  for (const path of siteCode) {
    const text = writes.has(path) ? writes.get(path) : readFileSync(atSite(path), 'utf8');
    let out = text;
    for (const spec of importsOf(text)) {
      const at = resolveImport(path, spec, (one) => movedTo.has(one));
      if (at === undefined || at === '..') continue;
      let next = posix.relative(posix.dirname(path), movedTo.get(at));
      if (!next.startsWith('.')) next = `./${next}`;
      out = out.replace(new RegExp(`(['"])${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'), `$1${next}$1`);
      template.renamed.push({ path, from: at, to: movedTo.get(at) });
    }
    if (out !== text) writes.set(path, out);
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
  for (const path of siteCode) {
    if (candidates.has(path) || path === 'src/content/blocks.ts' || path === template.copy || deletes.has(path)) continue;
    const { changes, weight } = readsOf(readFileSync(atSite(path), 'utf8'), kinds);
    if (changes.length > 0) template.elsewhere.push({ path, changes, weight });
  }
  // For a person, the files that read what moved first — the most reads
  // first, each with its lines — and the changed files that read nothing of
  // the contract by name in one line at the end: twenty items said as equals
  // hid the five that broke the build (the KAIF move, B3).
  const readers = [
    ...template.changed.filter((one) => one.changes.length > 0).map((one) => ({ ...one, how: 'changed' })),
    ...template.kept.map((one) => ({ ...one, how: 'kept' })),
    ...template.elsewhere.map((one) => ({ ...one, how: 'elsewhere' })),
  ].sort((a, b) => b.weight - a.weight || (a.path < b.path ? -1 : 1));
  for (const one of readers) {
    if (one.how === 'changed') {
      questions.push({ what: 'a scaffold file the developer changed', where: one.path, ask: `${one.path} is the scaffold's, changed here, so it was left as it is — move these reads to the door by hand: ${one.changes.join('; ')}.` });
    } else if (one.how === 'kept') {
      questions.push({
        what: 'a scaffold file left as it was',
        where: one.path,
        ask: `${one.path} is the scaffold's ${one.versions.length === 1 ? one.versions[0] : `${one.versions[0]}–${one.versions.at(-1)}`}, untouched, and was not replaced: ${one.why}. ${one.changes.length > 0 ? `It reads what moved: ${one.changes.join('; ')} — move it to the door with what it imports, or take the scaffold's pair (node_modules/@jtakeit/astro/template/${one.path}).` : 'It reads nothing of the contract by name; build and compare the pages before and after.'}`,
      });
    } else questions.push({ what: 'a read the move changes', where: one.path, ask: `${one.path}: ${one.changes.join('; ')}.` });
  }
  for (const one of template.left) {
    questions.push({ what: 'a scaffold file no longer laid out', where: one.path, ask: `${one.path} is the scaffold's (${one.versions.join(', ')}), no longer laid out, and ${one.users.join(', ')} still import${one.users.length === 1 ? 's' : ''} it — move ${one.users.length === 1 ? 'that' : 'those'} to the door (src/lib/site.ts), then delete it.` });
  }
  // First for a person, not after the reads: a site moved without it keeps
  // the owner from previewing any change before a build (the owner, 16
  // November 2026: a contract-3 site stays drawable live).
  if (liveQuestion !== undefined) questions.unshift(liveQuestion);
  if (live.prerender.length > 0) {
    const where = live.integration !== undefined && live.integration.file !== 'jtakeit-meta.mjs' ? live.integration.file : 'jtakeit-meta.mjs';
    questions.splice(liveQuestion === undefined ? 0 : 1, 0, {
      what: 'a route the live render cannot draw',
      where: live.prerender.join(', '),
      ask: `${live.prerender.join(', ')} take${live.prerender.length === 1 ? 's' : ''} props from getStaticPaths, which a server never runs, and ${where} neither prerenders nor draws ${live.prerender.length === 1 ? 'it' : 'them'} under JTK_RENDER=live — list ${live.prerender.length === 1 ? 'it' : 'them'} where its astro:route:setup prerenders (DRAWN in the scaffold's), or the platform's check finds ${live.prerender.length === 1 ? 'its' : 'their'} pages differ (docs/live.md).`,
    });
  }
  {
    const quiet = template.changed.filter((one) => one.changes.length === 0).map((one) => one.path);
    if (quiet.length > 0) {
      questions.push({
        what: `${quiet.length} scaffold file${quiet.length === 1 ? '' : 's'} the developer changed that read nothing of the contract by name`,
        where: quiet.join(', '),
        ask: `left as they are: ${quiet.join(', ')} — build and compare the pages before and after.`,
      });
    }
  }

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

  // A page made to back a collection's shown_on (§3.5): its name and its
  // search words are the owner's in the panel from now on, and change
  // nothing where the route at that address does not read the page — KAIF's
  // /afisha wrote its own title (the KAIF move, B15).
  for (const one of moved.backing ?? []) {
    const name = one.path.replace(/^\//, '');
    const routes = [`src/pages/${name}.astro`, `src/pages/${name}/index.astro`, `src/pages/[...lang]/${name}.astro`, `src/pages/[...lang]/${name}/index.astro`].filter((path) => existsSync(atSite(path)));
    const quoted = one.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reads = new RegExp(`\\bpage\\(\\s*['"\`]${quoted}/?['"\`]`);
    const dynamic = () => walk(root, join(root, 'src', 'pages')).some((path) => /\[/.test(path) && /\bsite\.page\(\s*[^'"`\s)]/.test(readFileSync(atSite(path), 'utf8')));
    if (routes.some((path) => reads.test(readFileSync(atSite(path), 'utf8')))) continue;
    if (routes.length === 0 && dynamic()) continue;
    questions.push({
      what: 'a page whose route does not read it',
      where: one.file.slice(1),
      ask: `${one.file.slice(1)} is new — the page the ${one.collection} collection is shown on, which contract 3 names — and ${routes.length > 0 ? `${routes.join(', ')} does not read it (site.page('${one.path}'))` : `no route of src/pages/ draws ${one.path} by name`}: its name and search words in the panel change nothing on the page. Read its seo and name through the door where the route writes its own, or tell the owner the panel's are not the page's.`,
    });
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
  console.log(
    `  the scaffold this site came from, by its files: ${cameSaid === undefined ? 'none of them is the scaffold\'s as any version laid it out' : `${cameSaid} (${came.files} untouched file${came.files === 1 ? '' : 's'}${came.all ? '' : ', most of them'})`}` +
      `${generatorSaid !== undefined && generatorSaid !== cameSaid ? ` — jtk/catalogue.json's generator says ${generatorSaid}, the kit that last wrote it` : ''}; the table knows ${hashes.versions[0]} to ${hashes.versions.at(-1)}`,
  );
  const versionSaid = (versions) => (came !== undefined && came.versions.length === 1 && versions.includes(came.versions[0]) ? came.versions[0] : versions.length === 1 ? versions[0] : `${versions[0]}–${versions.at(-1)}`);
  for (const one of template.replaced) console.log(`  ↻ ${one.path} — the scaffold's ${versionSaid(one.versions)}, untouched: replaced with the door's`);
  for (const path of template.added) console.log(`  + ${path} — the scaffold's, which ${path === 'src/lib/site.ts' ? 'every read below is moved to (the door)' : path.startsWith('src/live/') ? 'the live render draws by' : 'a file written here imports'} and this site has not got`);
  for (const one of template.kept) console.log(`  · ${one.path} — the scaffold's ${versionSaid(one.versions)}, untouched, and left — ${one.why} (listed at the end)`);
  if (template.current.length > 0) {
    const rewritten = [...reworded].filter((path) => writes.has(path));
    console.log(`  = ${template.current.length} file(s) the scaffold lays out as it does now: left as they are${rewritten.length > 0 ? ` — ${rewritten.join(', ')} in contract 3's words for the schema's file` : ''}`);
  }
  if (template.copy !== undefined) console.log(`  ↻ ${template.copy} — the site's words kept; its read of jtk/content/index.json moved to the door, site.page('/')`);
  for (const one of template.renamed ?? []) console.log(`  ↻ ${one.path} — imports ${one.to}, where the move put ${one.from}; what it reads of it is listed at the end`);
  for (const one of template.removed) console.log(`  ✗ ${one.path} — the scaffold's ${versionSaid(one.versions)}, no longer laid out, and nothing imports it`);
  for (const one of template.left) console.log(`  · ${one.path} — the scaffold's ${versionSaid(one.versions)}, no longer laid out, and still imported (listed at the end)`);
  for (const one of template.changed) console.log(`  ✎ ${one.path} — changed here, left as it is (listed at the end)`);
  if (live.ready) {
    if (live.config !== undefined) console.log(`  ↻ astro.config.mjs — its config handed to liveRender (${live.integration?.file ?? 'jtakeit-meta.mjs'}), for the platform's second, server build`);
    if (live.adapter) console.log(`  package.json: @astrojs/node ${adapterNow} — the server build's adapter`);
    console.log("  the draft is drawn live in the panel's preview: RENDER = 'live' (the platform checks it at every build)");
  } else console.log("  ✗ the site will not be drawn live: the owner sees a change only after a build — the first thing for a person below (docs/live.md)");
  for (const one of live.check) console.log(`  · ${one.replace(/ — it /, " — the site's own; the platform's check holds whether it ")}`);
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
  if (live.ready && live.config !== undefined) writeFileSync(atSite('astro.config.mjs'), live.config);
  const addAdapter = live.ready && live.adapter;
  if (addAdapter) pkg.dependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, '@astrojs/node': adapterNow }).sort(([a], [b]) => (a < b ? -1 : 1)));
  if (bump || addAdapter) {
    if (bump) pkg.dependencies['@jtakeit/kit'] = kitNow;
    writeFileSync(sitePackage, `${JSON.stringify(pkg, null, 2)}\n`);
    if (!has('no-install')) {
      const lock = spawnSync('npm', ['install', '--package-lock-only', '--no-audit', '--no-fund'], { cwd: root, encoding: 'utf8' });
      if (lock.status !== 0) {
        const why = (lock.stderr || lock.stdout).trim().split('\n').find((line) => /error/i.test(line)) ?? 'npm said no';
        console.log(`  ! package-lock.json was not refreshed — ${why.replace(/^npm error /, '')}; run npm install --package-lock-only before the commit${bump ? `, once @jtakeit/kit@${kitNow} is on npm` : ''}`);
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
  // The form's words, content, where the scaffold's form draws them: the
  // labels and the button, in the site's language and in each language's
  // translation, where nobody wrote them — what a visitor read, now the
  // owner's to tap and translate.
  if (formOurs) {
    const seeded = seedFormWords(root, { schema });
    if (seeded.said.length > 0) console.log(`\n${seeded.said.map((one) => `  + ${one} — the form's words, in the kit's`).join('\n')}`);
  }

  console.log('\n4 · the judge — jtk schema --emit-only on the whole tree');
  const judged = spawnSync(process.execPath, [JTK, 'schema', '--emit-only', '--root', root, '--generator', generator, ...(has('judge') ? ['--judge'] : [])], { cwd: root, encoding: 'utf8' });
  const said = `${judged.stdout ?? ''}${judged.stderr ?? ''}`.trimEnd();
  if (said !== '') console.log(said.split('\n').map((line) => `  ${line}`).join('\n'));
  if (judged.status !== 0) console.log(`  jtk schema said ${judged.status} thing(s) wrong — the tree is moved; fix them before the push`);

  report(questions);

  // ── the check: the build, and the schema against it ─────────────────────
  //
  // What the platform's build will say of the moved tree, said here before
  // the push: the site built, and jtk schema held against that build — the
  // annotations by key and the _meta.json the site's own hook writes. Its
  // own run, not the person's to remember (the KAIF move: the tree the tool
  // left did not build, and nothing said so until npm run build).
  let checked = 'not run';
  if (has('no-check')) console.log('\n6 · the check — skipped (--no-check): npm run build, then npx @jtakeit/astro schema, before the commit');
  else if (!existsSync(join(root, 'node_modules')) || typeof pkg?.scripts?.build !== 'string') {
    console.log(`\n6 · the check — not run: ${typeof pkg?.scripts?.build !== 'string' ? 'package.json has no build script' : 'the site is not installed here (npm ci)'}. Then: npm run build && npx @jtakeit/astro schema`);
  } else {
    console.log('\n6 · the check — npm run build, then jtk schema against that build, as the platform\'s build will read it');
    const { pullMissing } = await import('./media.mjs');
    await pullMissing(root, { out: (line) => console.log(`  ${line}`) });
    const build = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (build.status !== 0) {
      checked = 'failed';
      const lines = `${build.stdout ?? ''}\n${build.stderr ?? ''}`.split('\n').filter((line) => line.trim() !== '');
      const at = lines.findIndex((line) => /error|Error|✘|failed/.test(line));
      const shown = (at === -1 ? lines.slice(-12) : lines.slice(at, at + 12)).map((line) => `      ${line.trimEnd()}`);
      console.log(`  ✗ npm run build failed — the moved tree does not build:\n${shown.join('\n')}`);
      console.log('  The reads listed above for a person are where to start; run npm run build again after each.');
    } else {
      console.log('  ✓ npm run build');
      const schemaRun = spawnSync(process.execPath, [JTK, 'schema', '--root', root, '--dist', join(root, 'dist'), '--generator', generator], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const lines = `${schemaRun.stdout ?? ''}${schemaRun.stderr ?? ''}`.trimEnd().split('\n');
      console.log(lines.slice(0, 60).map((line) => `    ${line}`).join('\n'));
      if (lines.length > 60) console.log(`    … and ${lines.length - 60} more line(s): npx @jtakeit/astro schema --dist dist`);
      if (schemaRun.status === 0) {
        checked = 'passed';
        console.log('  ✓ jtk schema — the schema and the built pages agree, and dist/_meta.json is what the platform reads');
      } else {
        checked = 'failed';
        console.log(`  ✗ jtk schema said ${schemaRun.status} thing(s) wrong against the build`);
      }
    }
  }
  console.log(`
Next: ${checked === 'passed' ? 'read the diff, run npx @jtakeit/astro schema once more without --dist (it builds again under a path, as the preview serves it)' : checked === 'failed' ? 'fix what the check said, then npm run build and npx @jtakeit/astro schema until both pass' : 'npm run build, then npx @jtakeit/astro schema — it checks the schema against the built page'}, and commit the move
as one commit. If this site is live, the push makes a build that is a candidate: a person
publishes it (wiki/98 §8).`);
  // The pictures the content still names in the code: the move's next step
  // (jtakeit-core wiki/108 §4.2), its own command and its own commit.
  const outside = outsideLibrary(root);
  if (outside.length > 0) {
    console.log(`${outside.length} picture${outside.length === 1 ? ' is' : 's are'} in the code, not the site's media library — run media push next: media_link, then npx @jtakeit/astro media push '<url>' (docs/media.md).`);
  }
  if (judged.status !== 0) return Math.min(judged.status ?? 1, 100);
  return checked === 'failed' ? 1 : 0;
}

/**
 * The platform's state of a site, as `--state` takes it — `{ site, pages }`,
 * get_site's site and get_content's pages — from the API itself:
 * `GET /v1/sites/{id}` and `GET /v1/sites/{id}/pages`, the two reads those
 * tools make, with the credentials `jtk schema --judge` sends: JTK_API, and
 * JTK_TOKEN — an agent's `jtk_…` token as a bearer, anything else as the
 * `sid` cookie of a person signed in to the panel. The one-operation URL of
 * `jtk push` is no credential here: it opens the code, not the site.
 *
 * @param {string} site the site's id
 * @param {typeof fetch} [send]
 */
export async function stateFromThePlatform(site, send = fetch) {
  const api = (process.env.JTK_API ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.JTK_TOKEN ?? '').trim();
  if (site === undefined || !/^[0-9a-f-]{36}$/.test(site)) throw new Error("say the site's id, as get_site names it (a UUID)");
  if (api === '' || token === '') {
    throw new Error(
      "fetching the platform's state needs somewhere to ask and something to ask with: export JTK_API (https://api.stg.jtakeit.com on staging) and JTK_TOKEN (an agent's jtk_… token, or a signed-in session) — " +
        'or hand it over as a file: { "site": get_site, "pages": get_content\'s pages } with --state <file>',
    );
  }
  if (!/^https:\/\//.test(api) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(api)) throw new Error(`JTK_API is ${api}; a token travels over https only (plain http to this machine alone)`);
  const headers = {
    accept: 'application/json',
    'user-agent': `@jtakeit/astro/${JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')).version}`,
    ...(token.startsWith('jtk_') ? { authorization: `Bearer ${token}` } : { cookie: `sid=${token}` }),
  };
  const get = async (path) => {
    let answer;
    try {
      answer = await send(`${api}${path}`, { headers, redirect: 'error' });
    } catch (why) {
      throw new Error(`could not reach ${api} — ${why.message}`);
    }
    if (!answer.ok) {
      const said = (await answer.text().catch(() => '')).trim().slice(0, 300);
      throw new Error(`${api}${path} answered ${answer.status}${said ? ` — ${said}` : ''}${answer.status === 401 || answer.status === 403 ? ' (a token lasts an hour and a session expires: put a current one in JTK_TOKEN)' : ''}`);
    }
    return answer.json();
  };
  const id = encodeURIComponent(site);
  const [about, listed] = await Promise.all([get(`/v1/sites/${id}`), get(`/v1/sites/${id}/pages`)]);
  return { site: about, pages: Array.isArray(listed?.pages) ? listed.pages : [] };
}

/** The questions, as §8 asks them, numbered. */
function report(questions) {
  if (questions.length === 0) {
    console.log('\n5 · for a person: nothing — no value was left undecided');
    return;
  }
  console.log(`\n5 · for a person (wiki/98 §8) — ${questions.length}, each kept where nothing is lost until it is answered`);
  questions.forEach((one, i) => {
    console.log(`  ${i + 1}. ${one.what} — ${one.ask.includes(one.where) ? '' : `${one.where}: `}${one.ask}`);
    if (one.snippet !== undefined) console.log(one.snippet.map((line) => (line === '' ? '' : `       ${line}`)).join('\n'));
  });
}

/** Empty directories under one, and it, removed. */
function pruneEmpty(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const entry of readdirSync(dir)) pruneEmpty(join(dir, entry));
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}
