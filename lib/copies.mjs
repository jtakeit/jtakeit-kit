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
 * ── the form's words are content ───────────────────────────────────────────
 *
 * On contract 3 every word a visitor reads on the form is the form block's:
 * the words over the name, the contact and the message, the button, and the
 * words over each question in `asks` — its `<key>_label` field. So `jtk copy`
 * also writes them, where nobody has, into the home page's form block in the
 * site's language and into the language's translation beside it
 * (`seedFormWords`), as `jtk create` and `jtk upgrade contract-3` do for every
 * language a site has: tappable, and in the language's own words from the
 * first build. An ask's label written once in the declaration stayed German
 * on the English page and could not be tapped (the owner's two-language
 * site, 12 November 2026).
 *
 * ── the words are `jtk create`'s ────────────────────────────────────────────
 *
 * `UI` and `LOCALE_MAP` in lib/create.mjs hold every language the scaffold
 * speaks: one list of words, which `jtk create` and this both say.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalLocale } from '@jtakeit/kit/content';
import { contractOf } from '@jtakeit/kit/content/node';
import { LOCALE_MAP, UI } from './create.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, '..', 'template');

/**
 * The words for a language: its own, or its language's (`en-NL` reads `en`),
 * or none — the kit does not speak it.
 * @param {string} tag the canonical tag, `de-CH`
 */
export function wordsFor(tag) {
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

// ── the form's words, as content (contract 3) ───────────────────────────────

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/**
 * The field of the form's block that keeps the words over a question in
 * `asks` — `topic` → `topic_label` — as the scaffold's contract-3 form reads
 * it and `jtk upgrade contract-3` declares it on a site that moves.
 * @param {string} key the ask's key
 */
export function askLabelField(key) {
  return { key: `${key}_label`, label: `Label for the “${key.replaceAll('_', ' ')}” field`, kind: 'text', max: 120, client_editable: true };
}

/** The form block's own words a visitor reads, by field, and the word in `UI` each one is. */
export const FORM_WORDS = { name_label: 'nameLabel', contact_label: 'contactLabel', message_label: 'messageLabel', cta_label: 'submit' };

/**
 * A declaration's words in one language: a label written once is the site's
 * own, a map says each language's.
 * @param {unknown} text @param {string} tag @param {boolean} own whether `tag` is the site's own language
 */
function textIn(text, tag, own) {
  if (typeof text === 'string') return own && text.trim() !== '' ? text : undefined;
  if (!isObject(text)) return undefined;
  const plain = tag.split('-')[0];
  const found = [text[tag], text[plain]].find((one) => typeof one === 'string' && one.trim() !== '');
  if (found !== undefined || !own) return found;
  // The site's own language reads as the door does where its tag has none: English, then any.
  return [text.en, ...Object.values(text)].find((one) => typeof one === 'string' && one.trim() !== '');
}

/** Every `.json` under a directory, by its path from `root`. */
function jsonUnder(root, dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== 'media') out.push(...jsonUnder(root, file));
    } else if (name.endsWith('.json')) out.push(relative(root, file).split(sep).join('/'));
  }
  return out;
}

/**
 * The form's words as content, where nobody has written them: into the
 * block the scaffold's form reads — the home page's `cta_banner`, the one
 * whose `form` is on — in the site's language, and into each language's
 * translation of the home page (`jtk/pages/index.<locale>.json`, made where
 * there is none), in the kit's words for it.
 *
 *   name_label, contact_label,   `UI`'s words for the language — the site's
 *   message_label, cta_label     own in English where the kit has none, as
 *                                `jtk create` says its interface words
 *   <key>_label of each ask      the site's language: the ask's `label`, as
 *                                the form drew it; another: the label's words
 *                                for that language where it says them, or
 *                                the kit's where the label is the kit's own
 *                                question (`askTopic`)
 *
 * Only what the block's type declares, only where the value is absent, and
 * in a translation only where the original says the words this writes for
 * it — the kit's, the declaration's: a label the owner has written their own
 * way is theirs to translate, and is shown in their words, marked, until
 * they do. Nothing is overwritten, so a second run writes nothing. The
 * translation carries no `translated` record: the import records what an
 * agent wrote as made from the original as it stands (wiki/98 §4.4).
 *
 * Contract 3's alone: a contract-2 tree is left as it is.
 *
 * @param {string} root the site
 * @param {{ locales?: string[]; schema?: any }} [how] the languages whose translations to fill — the schema's
 *   `locales` by default; one it does not name is left out — and the schema, where `jtk/schema.json` is not written yet
 * @returns {{ written: string[]; said: string[] }} the files written, from the root, and what was written into each
 */
export function seedFormWords(root, how = {}) {
  const written = [];
  const said = [];
  let schema = how.schema;
  if (schema === undefined) {
    if (contractOf(root) !== 3) return { written, said };
    try {
      schema = JSON.parse(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8'));
    } catch {
      return { written, said };
    }
  }
  if (!isObject(schema) || schema.contract !== 3) return { written, said };
  const type = (Array.isArray(schema.blocks) ? schema.blocks : []).find((one) => isObject(one) && one.type === 'cta_banner' && typeof one.collects === 'string' && one.collects !== '');
  if (type === undefined) return { written, said };
  const order = (Array.isArray(type.fields) ? type.fields : []).filter(isObject).map((one) => one.key);
  const fields = new Set(order);
  const asks = (Array.isArray(type.asks) ? type.asks : []).filter((one) => isObject(one) && typeof one.key === 'string' && fields.has(`${one.key}_label`));
  const base = canonicalLocale(schema.locale) ?? String(schema.locale ?? '');
  const others = (Array.isArray(schema.locales) ? schema.locales : []).map((one) => canonicalLocale(one)).filter(Boolean);
  const wanted = (how.locales ?? others).map((one) => canonicalLocale(one)).filter((one) => one !== null && others.includes(one) && one !== base);
  const kit = (tag) => wordsFor(tag)?.ui;
  const own = kit(base) ?? UI.en;

  /** What the form says in a language, by field. */
  const wordsIn = (tag) => {
    const ui = tag === base ? own : kit(tag);
    const out = {};
    if (ui !== undefined) for (const [field, word] of Object.entries(FORM_WORDS)) if (fields.has(field)) out[field] = ui[word];
    for (const ask of asks) {
      const field = `${ask.key}_label`;
      if (tag === base) {
        const words = textIn(ask.label, base, true);
        if (words !== undefined) out[field] = words;
        continue;
      }
      const words = textIn(ask.label, tag, false) ?? (ui !== undefined && textIn(ask.label, base, true) === own.askTopic ? ui.askTopic : undefined);
      if (words !== undefined) out[field] = words;
    }
    // In the order the type declares them.
    return Object.fromEntries(order.filter((field) => out[field] !== undefined).map((field) => [field, out[field]]));
  };

  // The home page: the page whose path is `/`, as the door finds it.
  const pages = jsonUnder(root, join(root, 'jtk', 'pages')).map((file) => {
    try {
      return { file, doc: JSON.parse(readFileSync(join(root, file), 'utf8')) };
    } catch {
      return { file, doc: undefined };
    }
  }).filter((one) => isObject(one.doc));
  const home = pages.find((one) => one.doc.of === undefined && (one.doc.path === '/' || (one.doc.path === undefined && one.file === 'jtk/pages/index.json')));
  const block = (Array.isArray(home?.doc.blocks) ? home.doc.blocks : []).find((one) => isObject(one) && one.type === 'cta_banner');
  if (home === undefined || block === undefined || block.form !== true || typeof block._key !== 'string') return { written, said };

  const write = (file, doc, what) => {
    writeFileSync(join(root, file), `${JSON.stringify(doc, null, 2)}\n`);
    written.push(file);
    said.push(`${file}: ${what.join(', ')}`);
  };

  // The site's own language, where the block has none of its words.
  const ownWords = wordsIn(base);
  const filled = [];
  for (const [field, words] of Object.entries(ownWords)) {
    if (!isEmpty(block[field])) continue;
    block[field] = words;
    filled.push(field);
  }
  if (filled.length > 0) write(home.file, home.doc, filled);

  // Each other language: its translation of the home page, beside it.
  if (typeof home.doc.id !== 'string' || home.doc.id === '') return { written, said };
  for (const tag of wanted) {
    const theirs = wordsIn(tag);
    const found = pages.find((one) => one.doc.of === home.doc.id && canonicalLocale(one.doc.locale) === tag);
    const translation = found ?? { file: home.file.replace(/\.json$/, `.${tag}.json`), doc: { of: home.doc.id, locale: tag } };
    const doc = translation.doc;
    const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
    let mine = blocks.find((one) => isObject(one) && one._key === block._key);
    const added = [];
    for (const [field, words] of Object.entries(theirs)) {
      // A translation of the words this writes, and of nothing else.
      if (block[field] !== ownWords[field]) continue;
      if (mine !== undefined && !isEmpty(mine[field])) continue;
      if (mine === undefined) {
        mine = { _key: block._key };
        blocks.push(mine);
      }
      mine[field] = words;
      added.push(field);
    }
    if (added.length === 0) continue;
    doc.blocks = blocks;
    if (found === undefined && existsSync(join(root, translation.file))) continue; // a file there that is no translation of the home: not written over
    write(translation.file, doc, added);
  }
  return { written, said };
}

export function usage() {
  return `jtk copy <locale> [--root <dir>] [--force]
                                  write src/copy/<locale>.ts, a language's words that are not
                                  content (the form's messages, the privacy page's), in the kit's
                                  words; on contract 3 the form's labels and button too, as content,
                                  where nobody wrote them: the site's language, and <locale>'s translation`;
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
  // Contract 3: the form's words, content, in the site's language and in this one where nobody wrote them.
  const three = contractOf(root) === 3;
  const seeded = three ? seedFormWords(root, { locales: [tag] }) : { written: [], said: [] };
  const sayForm = () => {
    for (const line of seeded.said) console.log(`${line} — the form's words, in the kit's: the owner's to change and translate in the panel`);
    if (!three) return;
    let named = [];
    try {
      named = (JSON.parse(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8')).locales ?? []).map((one) => canonicalLocale(one));
    } catch {
      // No schema yet: nothing names the language.
    }
    if (!named.includes(tag)) console.log(`the form's words in ${tag} are written into its translation once LOCALES in src/content/blocks.ts names it: add '${tag}', npx @jtakeit/astro schema, then this again`);
  };
  if (done === 'there') {
    if (seeded.written.length > 0) {
      console.log(`src/copy/${tag}.ts is there, and it is the site's: left as it is`);
      sayForm();
      return 0;
    }
    console.error(`jtk copy: src/copy/${tag}.ts is there, and it is the site's — --force writes it again from the kit's words`);
    sayForm();
    return 1;
  }
  if (done === 'unknown') {
    console.error(`jtk copy: the kit has no words for ${tag} — copy src/copy/${own ?? '<yours>'}.ts to src/copy/${tag}.ts and translate its strings (docs/languages.md)`);
    sayForm();
    return 1;
  }
  console.log(`src/copy/${tag}.ts — written in the kit's words for ${tag}; read it, and change what the business says otherwise`);
  sayForm();
  if (!three) {
    const id = tag.replace('-', '_').toLowerCase();
    console.log(`contract 2 registers it in src/copy/index.ts by hand:\n  import { COPY as ${id} } from './${tag}';\n  const BY_LOCALE: Record<string, Copy> = { '': own, '${tag}': ${id} };`);
  }
  return 0;
}
