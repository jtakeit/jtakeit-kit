/**
 * Languages, as the contract spells them and as an address carries them.
 *
 * ── one tag, two spellings, and the door is where they meet ─────────────────
 *
 * A language is a BCP 47 tag with a lowercase language and, where there is a
 * region, an uppercase region: `de`, `de-CH`. That is how the catalogue writes
 * it (`jtk catalogue` canonicalises), how the platform stores it, and what a
 * page's `<html lang>` and `hreflang` want. An address cannot carry the
 * uppercase — the platform's paths are `[a-z0-9-]` — so the German-Swiss pages
 * live under `/de-ch/`. Until the door, every reader picked one of the two and
 * hoped: the scaffold took `LOCALES` as written for its routes and its content
 * directories, the shared files were matched with a lowercase-only pattern,
 * and a site the platform saved with `shared.de-CH.json` had its Swiss text
 * found by nobody (wiki/98 §0, the kit's inventory §5).
 *
 * So the tag is read in either case and written in one, and the address is
 * always the lowercase of it. Nothing outside this file decides either.
 *
 * Imports nothing: the door runs in a Vite build, in Node and in a test alike.
 */

const TAG = /^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/;

/**
 * The one spelling of a language, given either: `de-ch` → `de-CH`, `DE` → `de`.
 * `null` for what is not a language at all.
 * @param {unknown} tag
 * @returns {string | null}
 */
export function canonicalLocale(tag) {
  if (typeof tag !== 'string') return null;
  const found = TAG.exec(tag.trim());
  if (found === null) return null;
  const language = found[1].toLowerCase();
  return found[2] === undefined ? language : `${language}-${found[2].toUpperCase()}`;
}

/**
 * The segment an address carries for a language: `/de-ch/…` for `de-CH`.
 * @param {string} tag
 */
export function segmentOf(tag) {
  return tag.toLowerCase();
}

/**
 * The languages of a site, read once: the base and the others, canonical, in
 * the order the catalogue declares them, each once.
 *
 * The base is the catalogue's `locale`; a working tree with no catalogue yet
 * falls back to what `jtk/site.json` says the platform holds, and then to
 * nothing — a door with no base language still reads, and every document is
 * in "the base" (`''`).
 *
 * @param {any} catalogue the emitted `jtk/catalogue.json`
 * @param {any} site      `jtk/site.json`
 * @returns {{ base: string; others: string[] }}
 */
export function languagesOf(catalogue, site) {
  const base = canonicalLocale(catalogue?.locale) ?? canonicalLocale(site?.locale) ?? '';
  const others = [];
  for (const one of Array.isArray(catalogue?.locales) ? catalogue.locales : []) {
    const tag = canonicalLocale(one);
    if (tag === null || tag === base || others.includes(tag)) continue;
    others.push(tag);
  }
  return { base, others };
}

/**
 * A language as the door is asked for it, in the form a document carries it:
 * `''` for the base — however it was asked: nothing, `''`, the base's tag in
 * any case — and the canonical tag for any other. What is not a tag at all is
 * passed through, so a question about a language the site lacks gets an
 * honest "nothing" rather than the base's answer.
 *
 * @param {unknown} locale
 * @param {string} base
 * @returns {string}
 */
export function localeArg(locale, base) {
  if (locale === undefined || locale === null || locale === '') return '';
  const tag = canonicalLocale(locale);
  if (tag === null) return String(locale);
  return tag === base ? '' : tag;
}

/**
 * Which of the site's other languages an address is in, by its first
 * segment — `''` for the base, which has no prefix.
 *
 * @param {string} address `/de/prices`, `/de-ch`, `/prices`; no base path in front
 * @param {string[]} others the site's languages besides its own
 */
export function localeOfAddress(address, others) {
  const first = String(address).replace(/^\/+/, '').split(/[/?#]/)[0].toLowerCase();
  if (first === '') return '';
  return others.find((tag) => segmentOf(tag) === first) ?? '';
}

/**
 * An address in a language: `/about` → `/de/about`, the home `/` → `/de`.
 * Unchanged for the base. The pattern is the platform's and fixed: the
 * language goes first and everything after it is the same.
 *
 * @param {string} locale `''` or a canonical tag
 * @param {string} address
 */
export function inLocale(locale, address) {
  const path = address === '' ? '/' : address.startsWith('/') ? address : `/${address}`;
  if (locale === '') return path;
  return path === '/' ? `/${segmentOf(locale)}` : `/${segmentOf(locale)}${path}`;
}

/**
 * An address with its language taken off: `/de/prices` → `/prices`, `/de` →
 * `/`. Only the language it is said to be in is taken off.
 *
 * @param {string} address
 * @param {string} locale `''` or a canonical tag
 */
export function baseAddressOf(address, locale) {
  if (locale === '') return address;
  const segment = `/${segmentOf(locale)}`;
  const lower = address.toLowerCase();
  if (lower === segment || lower === `${segment}/`) return '/';
  if (lower.startsWith(`${segment}/`)) return address.slice(segment.length);
  return address;
}

/**
 * Which language a shared file is, out of its name: `shared.json` the base,
 * `shared.de.json` German, `shared.de-CH.json` and `shared.de-ch.json` both
 * German-Swiss. `null` for a file that is not a shared one.
 *
 * The region is matched in either case (wiki/98 §0): the platform writes the
 * canonical `de-CH`, and the pattern every reader used accepted a lowercase
 * region only — so a regional language's shared text reached no page.
 *
 * @param {string} name the file's name, or its whole path
 * @returns {string | null} `''` for the base, the canonical tag otherwise
 */
export function sharedLocaleOf(name) {
  const found = /(?:^|\/)shared(?:\.([A-Za-z]{2}(?:-[A-Za-z]{2})?))?\.json$/.exec(String(name));
  if (found === null) return null;
  return found[1] === undefined ? '' : canonicalLocale(found[1]);
}
