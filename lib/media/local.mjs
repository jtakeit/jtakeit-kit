/**
 * What `jtk media` keeps on the machine, beside the site and out of git
 * (jtakeit-core wiki/108 §6):
 *
 *   src/assets/media/<site>/<hash>.<ext>   the library's pictures the content names — what
 *                                          the build downloads to the same place
 *   jtk/entries/<c>/media/…                a picture in an entry's body, beside the entry
 *   .jtakeit/media.json                    the library's index (`media pull` with a link), and
 *                                          what the push adopted
 *   .jtakeit/adopted/                      the files of src/assets a push adopted and no code
 *                                          names any more — moved here, never deleted
 *
 * None of it is the site's: the library is. A second copy in git would be a
 * second answer to «what does this site show».
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

export const STATE = '.jtakeit/media.json';
export const ADOPTED = '.jtakeit/adopted';

/** The lines the push and the pull make sure `.gitignore` has. */
const IGNORED = ['src/assets/media/', '.jtakeit/adopted/', '.jtakeit/media.json'];

/**
 * Add what is missing of the lines above, with the reason, and say which.
 * A contract-3 tree also keeps its entries' downloaded pictures out.
 * @param {string} root @param {number} contract
 * @returns {string[]} the lines added
 */
export function ensureIgnored(root, contract) {
  const file = join(root, '.gitignore');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const has = new Set(text.split('\n').map((one) => one.trim()));
  const want = [...IGNORED, contract === 2 ? 'jtk/content/**/media/' : 'jtk/entries/**/media/'];
  const missing = want.filter((one) => !has.has(one));
  if (missing.length === 0) return [];
  const block =
    '\n# The media library\'s pictures, downloaded for the dev server (jtk media pull,\n' +
    '# jtk media push): the library holds them, never the repository. The adopted\n' +
    '# files are the ones a push moved out of src/assets; the index is the library\'s.\n' +
    `${missing.join('\n')}\n`;
  writeFileSync(file, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${block}`);
  return missing;
}

/**
 * `.jtakeit/media.json`: `{ v, site?, media_base?, adopted: { path: key }, told: { key: words }, index? }`.
 * @param {string} root
 */
export function readState(root) {
  const file = join(root, STATE);
  let value = {};
  if (existsSync(file)) {
    try {
      value = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      value = {};
    }
  }
  return { v: 1, adopted: {}, told: {}, ...(value && typeof value === 'object' ? value : {}) };
}

/** @param {string} root @param {ReturnType<typeof readState>} state */
export function writeState(root, state) {
  const file = join(root, STATE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

/** Put bytes at a path of the site, making its directory; a file already there is left. */
export function place(root, path, data) {
  const at = join(root, path);
  if (existsSync(at)) return false;
  mkdirSync(dirname(at), { recursive: true });
  writeFileSync(at, data);
  return true;
}

/** The site's code, as text, for the question «does anything still name this file»: src/ but its assets, and the root's configuration. */
function codeTexts(root) {
  const out = [];
  const TEXT = /\.(astro|ts|tsx|js|jsx|mjs|cjs|mts|cts|md|mdx|css|scss|sass|less|html|vue|svelte|json|yml|yaml)$/i;
  const walk = (at) => {
    const full = join(root, at);
    if (!existsSync(full)) return;
    for (const one of readdirSync(full, { withFileTypes: true })) {
      const path = `${at}/${one.name}`;
      if (one.isDirectory()) {
        if (path === 'src/assets/media' || one.name === 'node_modules') continue;
        walk(path);
      } else if (TEXT.test(one.name)) {
        let text = readFileSync(join(root, path), 'utf8');
        if (path === 'src/lib/photos.ts') text = text.replace(/\{[^{}]*?\bname:\s*(['"`])(?:\\.|(?!\1).)*\1[^{}]*?\}/g, '{}');
        out.push({ path, text });
      }
    }
  };
  walk('src');
  for (const one of readdirSync(root)) {
    if (/^(astro|vite|tailwind|postcss)\.config\.[cm]?[jt]s$|^jtakeit-meta\.mjs$/.test(one)) out.push({ path: one, text: readFileSync(join(root, one), 'utf8') });
  }
  return out;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Which code still names each of these files of src/assets: by its file name
 * (`atelier-raum.jpg`, an import or a URL), or by its slot quoted
 * (`'atelier-raum'`, as `<Shot name="atelier-raum">` names it). A file named
 * so is a design asset, or a photograph that wants a field: it stays where
 * the code draws it.
 *
 * The `PHOTOS` registry of `src/lib/photos.ts` is not a use: it holds a
 * slot's words, which the push has given the field and the library
 * (wiki/108 §4.3). Its entry is left for the developer to take out.
 *
 * @param {string} root @param {string[]} paths `src/assets/…`
 * @returns {Map<string, string[]>} path → the files that name it
 */
export function namedByCode(root, paths) {
  const texts = codeTexts(root);
  const out = new Map();
  for (const path of paths) {
    const rel = path.replace(/^src\/assets\//, '');
    const file = rel.split('/').pop();
    const slot = rel.slice(0, rel.length - extname(rel).length);
    const by = new RegExp(`(^|[^\\w.-])${escape(file)}($|[^\\w-])|['"\`]${escape(slot)}['"\`]`, 'i');
    const names = texts.filter((one) => by.test(one.text)).map((one) => one.path);
    if (names.length) out.set(path, names);
  }
  return out;
}

/**
 * Move a file of src/assets to `.jtakeit/adopted/`, at the same path below
 * it. Never over another: a name taken there gets a number.
 * @param {string} root @param {string} path
 * @returns {string} where it went
 */
export function adopt(root, path) {
  const rel = path.replace(/^src\/assets\//, '');
  let to = `${ADOPTED}/${rel}`;
  for (let n = 2; existsSync(join(root, to)); n += 1) to = `${ADOPTED}/${rel.replace(/(\.[^./]+)?$/, `.${n}$1`)}`;
  mkdirSync(dirname(join(root, to)), { recursive: true });
  renameSync(join(root, path), join(root, to));
  return to;
}
