/**
 * `jtk copy <locale>` — a language's copy module, `src/copy/<locale>.ts`: the
 * words a page says that are not content (the form's messages, the privacy
 * page, the skip link, a listing's pager), in the kit's words for that
 * language, written from the template's `src/copy/LOCALE.ts` as `jtk create`
 * writes the site's own.
 *
 *   jtk copy en                 write src/copy/en.ts in the kit's English
 *   jtk copy fr-CH --force      and over one that is there
 *
 * On contract 3 the copy registry (`src/copy/index.ts`) finds the file by
 * its name; on contract 2 it is registered there by hand, and this says the
 * two lines. Until a language has its file, its pages say the site's own
 * words, marked with their `lang` — `jtk schema` and `jtkit progress` name
 * the language (the two-language rehearsal on staging, 12 November 2026).
 *
 * ── the words are `jtk create`'s ────────────────────────────────────────────
 *
 * `UI` and `LOCALE_MAP` in lib/create.mjs hold every language the scaffold
 * speaks. They are read out of that file's source, as the data literals they
 * are, rather than copied here: one list of words, which `jtk create` and
 * this both say. When create.mjs exports them (it is being rewritten for
 * contract 3 on its own branch), this imports them instead.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, '..', 'template');

/**
 * A data literal of create.mjs, by its name: `const UI = { … };`.
 * @param {string} source @param {string} name
 */
function literal(source, name) {
  const start = source.indexOf(`\nconst ${name} = {`);
  if (start === -1) throw new Error(`lib/create.mjs has no \`const ${name} = {\``);
  const open = source.indexOf('{', start);
  const close = source.indexOf('\n};', open);
  if (close === -1) throw new Error(`lib/create.mjs: \`const ${name}\` does not end at a line \`};\``);
  // The repository's own data literal: strings and objects, nothing to run.
  return new Function(`return (${source.slice(open, close + 2)});`)();
}

/** `jtk create`'s words: every language's, and how a tag maps to them. */
export function words() {
  const source = readFileSync(join(HERE, 'create.mjs'), 'utf8');
  return { UI: literal(source, 'UI'), LOCALE_MAP: literal(source, 'LOCALE_MAP') };
}

/**
 * The words for a language: its own, or its language's (`en-NL` reads `en`),
 * or none — the kit does not speak it.
 * @param {string} tag the canonical tag, `de-CH`
 */
export function wordsFor(tag) {
  const { UI, LOCALE_MAP } = words();
  const plain = tag.split('-')[0];
  const loc = LOCALE_MAP[tag] ?? (LOCALE_MAP[plain] === undefined ? undefined : { ...LOCALE_MAP[plain], lang: tag, og: tag.replace('-', '_') });
  const ui = loc === undefined ? undefined : UI[loc.ui];
  return loc === undefined || ui === undefined ? undefined : { loc, ui };
}

/**
 * The copy module for a language, as text.
 * @param {string} tag the canonical tag
 * @param {{ name?: string }} [site] the business's name, for the title's suffix where the shared text names nobody
 */
export function copyModule(tag, site = {}) {
  const found = wordsFor(tag);
  if (found === undefined) return undefined;
  const { loc, ui } = found;
  const tokens = {
    OG_LOCALE: loc.og,
    NAME: site.name ?? '',
    UI_SKIP_TO_CONTENT: ui.skipToContent,
    UI_REQUIRED: ui.required,
    UI_PRIVACY: ui.privacy,
    UI_SENDING: ui.sending,
    UI_SUCCESS: ui.success,
    UI_ERROR: ui.error,
    UI_INVALID_NAME: ui.invalidName,
    UI_INVALID_CONTACT: ui.invalidContact,
    UI_INVALID_MESSAGE: ui.invalidMessage,
    UI_DEMO_NOTE: ui.demoNote,
    UI_MORE: ui.more,
    UI_PREVIOUS: ui.previous,
    UI_NEXT: ui.next,
    UI_PAGE_OF: ui.pageOf,
    UI_PRIVACY_TITLE: ui.privacyTitle,
    UI_PRIVACY_INTRO: ui.privacyIntro,
    UI_PRIVACY_FORM_TITLE: ui.privacyFormTitle,
    UI_PRIVACY_FORM_BODY: ui.privacyFormBody,
    UI_PRIVACY_WHO_TITLE: ui.privacyWhoTitle,
    UI_PRIVACY_WHO_BODY: ui.privacyWhoBody,
    UI_PRIVACY_ASK_TITLE: ui.privacyAskTitle,
    UI_PRIVACY_ASK_BODY: ui.privacyAskBody,
    UI_PRIVACY_OWN_TITLE: ui.privacyOwnTitle,
  };
  // As create's: a string is written into a single-quoted literal.
  const quoted = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const text = readFileSync(join(TEMPLATE, 'src', 'copy', 'LOCALE.ts'), 'utf8')
    .replace(/\{\{([A-Z_]+)\}\}/g, (whole, token) => (token in tokens ? quoted(tokens[token]) : whole))
    // The language's own: its tag, and its home page in its language.
    .replace(/^import \{ LOCALE \} from '\.\.\/content\/blocks';\n/m, '')
    .replace(/^(\s*)lang: LOCALE,$/m, `$1lang: '${tag}',`)
    .replace("makeCopy(site.page('/'), STRINGS)", `makeCopy(site.page('/', '${tag}'), STRINGS)`);
  const head = `/**\n * ${tag}: what is not content, in the kit's words for the language — written by\n * \`npx @jtakeit/astro copy ${tag}\`, and the site's to change from here on.\n */\n`;
  return `${head}${text}`;
}

/**
 * The business's name as the site's own copy says it in the title's suffix,
 * and that copy's language: `{ own: 'de-CH', name: 'Salon Probe' }`.
 * @param {string} root
 */
export function ownCopy(root) {
  const registry = join(root, 'src', 'copy', 'index.ts');
  if (!existsSync(registry)) return { own: undefined, name: undefined };
  const own = /import\s*\{\s*COPY as own\b[^}]*\}\s*from\s*['"]\.\/([^'"]+)['"]/.exec(readFileSync(registry, 'utf8'))?.[1];
  const file = own === undefined ? undefined : join(root, 'src', 'copy', `${own}.ts`);
  const text = file !== undefined && existsSync(file) ? readFileSync(file, 'utf8') : '';
  const name = /titleSuffix:\s*' — ((?:[^'\\]|\\.)*)'/.exec(text)?.[1]?.replace(/\\(.)/g, '$1');
  return { own, name };
}

/**
 * Write a language's copy module beside the registry, unless one is there.
 * @param {string} root @param {string} tag the canonical tag
 * @returns {'written' | 'there' | 'own' | 'unknown' | 'no-registry'}
 */
export function writeCopy(root, tag, { force = false } = {}) {
  if (!existsSync(join(root, 'src', 'copy', 'index.ts'))) return 'no-registry';
  const { own, name } = ownCopy(root);
  if (own === tag) return 'own';
  const file = join(root, 'src', 'copy', `${tag}.ts`);
  if (existsSync(file) && !force) return 'there';
  const text = copyModule(tag, { name });
  if (text === undefined) return 'unknown';
  writeFileSync(file, text);
  return 'written';
}

export function usage() {
  return `jtk copy <locale> [--root <dir>] [--force]
                                  write src/copy/<locale>.ts, a language's words that are not
                                  content (the form's, the privacy page's), in the kit's words`;
}

/**
 * @param {string[]} argv the arguments after `copy`
 * @returns {Promise<number>}
 */
export async function main(argv) {
  const flag = (name, fallback) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? fallback : argv[at + 1];
  };
  const root = resolve(flag('root', process.cwd()));
  const { canonicalLocale } = await import('@jtakeit/kit/content');
  const asked = argv.find((one, i) => !one.startsWith('--') && argv[i - 1] !== '--root');
  const tag = canonicalLocale(asked);
  if (tag === null) {
    console.error(`jtk copy: say which language — ${usage()}`);
    return 1;
  }
  const done = writeCopy(root, tag, { force: argv.includes('--force') });
  const { own } = ownCopy(root);
  if (done === 'no-registry') {
    console.error(`jtk copy: ${root} has no src/copy/index.ts — the copy registry this writes beside is the scaffold's`);
    return 1;
  }
  if (done === 'own') {
    console.error(`jtk copy: ${tag} is the site's own language — its words are src/copy/${tag}.ts already`);
    return 1;
  }
  if (done === 'there') {
    console.error(`jtk copy: src/copy/${tag}.ts is there, and it is the site's — --force writes it again from the kit's words`);
    return 1;
  }
  if (done === 'unknown') {
    console.error(`jtk copy: the kit has no words for ${tag} — copy src/copy/${own ?? '<yours>'}.ts to src/copy/${tag}.ts and translate its strings (docs/languages.md)`);
    return 1;
  }
  console.log(`src/copy/${tag}.ts — written in the kit's words for ${tag}; read it, and change what the business says otherwise`);
  const { contractOf } = await import('@jtakeit/kit/content/node');
  if (contractOf(root) !== 3) {
    const id = tag.replace('-', '_').toLowerCase();
    console.log(`contract 2 registers it in src/copy/index.ts by hand:\n  import { COPY as ${id} } from './${tag}';\n  const BY_LOCALE: Record<string, Copy> = { '': own, '${tag}': ${id} };`);
  }
  return 0;
}
