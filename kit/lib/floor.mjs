/**
 * The design floor, read off a site (jtakeit-core wiki/115 §2): how a site
 * is built, never what it looks like — the things a visitor feels whatever
 * the design. Advice, every one of them: `jtk schema` and `jtk catalogue`
 * print them with a `~` after the build, nothing refuses, and they carry
 * `JTK_LOCAL` because the platform has no code for them (codes.mjs, LOCAL).
 *
 *   F1  a height in vh, svh or dvh — `screenHeights`: the in-app browsers of
 *       Telegram, Instagram and WhatsApp resize the viewport under every one
 *       of them as their bar slides under a scrolling thumb, and the page
 *       jumps. The scaffold sets `--screen` from innerHeight before paint.
 *   F2  a font that jumps — `fontFaults`: a family the stylesheet names that
 *       no @font-face provides (Brumy's headings named Instrument Sans and
 *       never loaded it, 18 November 2026), a face fetched from a third
 *       party's host, own faces with no preload or no measured stand-in.
 *
 *   floorAdvice(root, dist?)   both, the heights from src/, the fonts from the
 *                              build where there is one (a package's faces —
 *                              @fontsource — are only in the build) and from
 *                              src/ and public/ where there is none
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Comments out, their lines kept, so a finding's line is the file's. */
function uncomment(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
}

/**
 * The parts of a file a browser reads as CSS, each with its offset: the
 * whole of a stylesheet; a component's <style> blocks and its style="…"
 * attributes. A component's script and its prose say «100svh» as often as
 * its styles do, and are not styles.
 */
function styleParts(text, file) {
  if (/\.(css|scss|sass|less|pcss)$/.test(file)) return [{ at: 0, css: text }];
  const parts = [];
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) parts.push({ at: m.index + m[0].indexOf(m[1]), css: m[1] });
  for (const m of text.matchAll(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) parts.push({ at: m.index + m[0].indexOf(m[2]), css: m[2] });
  return parts.sort((a, b) => a.at - b.at);
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/*
 * ── F1 · the screen's height ───────────────────────────────────────────────
 *
 * A height measured against the screen reads `var(--screen)`, which the
 * scaffold's Layout.astro sets from innerHeight before the first paint and
 * changes only when the width does (a turned phone). `vh` follows the
 * browser's bar in and out; `svh` is specified not to, and the in-app
 * browsers move it anyway; `dvh` is meant to. The fallback inside
 * `var(--screen, 100svh)` is the one place a viewport unit belongs — a page
 * without scripts — and is not a finding.
 */
const HEIGHT = /(?:^|[;{\s"'])((?:min-|max-)?(?:height|block-size))\s*:\s*([^;}"']+)/g;
const VIEWPORT = /(?<![\w-])\d*\.?\d+(?:s|d|l)?vh\b/;

/**
 * Every height in vh, svh or dvh in one file's styles.
 *
 * @param {string} text the file
 * @param {string} where its path, as the finding names it
 * @returns {{ where: string; says: string }[]}
 */
export function screenHeightsIn(text, where) {
  const out = [];
  const clean = uncomment(text);
  for (const part of styleParts(clean, where)) {
    for (const m of part.css.matchAll(HEIGHT)) {
      const value = m[2].trim();
      const bare = value.replace(/var\(\s*--screen\s*,\s*[^()]*\)/g, 'var(--screen)');
      const unit = VIEWPORT.exec(bare);
      if (unit === null) continue;
      const line = lineAt(clean, part.at + m.index + m[0].indexOf(m[1]));
      out.push({
        where: `${where}:${line}`,
        says:
          `${m[1]}: ${value} — ${unit[0]} follows the bar of the in-app browsers (Telegram, Instagram, WhatsApp) as it slides under a scrolling thumb, and the page jumps. ` +
          `Write the screen as var(--screen), set before paint from innerHeight (100svh without scripts): ${bare.replace(/(?<![\w-])(\d*\.?\d+)(?:s|d|l)?vh\b/g, (_, n) => (Number(n) === 100 ? 'var(--screen)' : `calc(var(--screen) * ${Number(n) / 100})`))}`,
      });
    }
  }
  return out;
}

/** Every file under a directory a site keeps styles in. */
function styleFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...styleFiles(full));
    else if (/\.(css|scss|sass|less|pcss|astro|vue|svelte|html)$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * F1 over a site's source: src/.
 *
 * @param {string} root
 */
export function screenHeights(root) {
  return styleFiles(join(root, 'src')).flatMap((file) => screenHeightsIn(readFileSync(file, 'utf8'), relative(root, file)));
}

/*
 * ── F2 · fonts that don't jump ─────────────────────────────────────────────
 */

/** What every visitor has, or what a stack names as a last resort: never a finding. */
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong', 'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'none']);
const SYSTEM = new Set([
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'segoe ui emoji', 'segoe ui symbol', 'roboto', 'helvetica neue', 'helvetica', 'arial', 'georgia',
  'times new roman', 'times', 'courier new', 'courier', 'menlo', 'monaco', 'consolas', 'sfmono-regular', 'sf mono', 'liberation mono', 'liberation sans',
  'liberation serif', 'dejavu sans', 'dejavu serif', 'dejavu sans mono', 'verdana', 'tahoma', 'trebuchet ms', 'noto sans', 'noto serif', 'ubuntu', 'cantarell',
  'oxygen', 'oxygen-sans', 'droid sans', 'apple color emoji', 'noto color emoji', 'iowan old style', 'palatino', 'palatino linotype', 'book antiqua',
  'cambria', 'calibri', 'candara', 'optima', 'avenir', 'avenir next', 'gill sans', 'charter', 'bitstream charter', 'sitka text', 'source-serif-pro',
]);

/** The hosts a page should not fetch its type from. */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'p.typekit.net', 'fonts.bunny.net', 'fast.fonts.net', 'cloud.typography.com', 'rsms.me', 'fonts.cdnfonts.com', 'api.fontshare.com'];

/** A family list's names, unquoted and lowercased, in order. */
function familiesOf(list) {
  return list
    .split(',')
    .map((one) => one.trim().replace(/!important$/, '').trim())
    .filter((one) => one !== '')
    .map((one) => ({ said: one.replace(/^["']|["']$/g, ''), quoted: /^["']/.test(one) }));
}

/**
 * F2 over a site's styles and pages.
 *
 * @param {{ css: { where: string; text: string }[]; html?: { where: string; text: string }[] }} input
 *   every stylesheet (a built one, or a component's source) and every page
 * @returns {{ where: string; says: string }[]}
 */
export function fontFaults({ css, html = [] }) {
  const out = [];
  const provided = new Set();
  const own = [];
  let measured = false;
  const named = new Map();

  for (const sheet of css) {
    const text = uncomment(sheet.text);
    for (const face of text.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      const family = /font-family\s*:\s*([^;]+)/i.exec(face[1]);
      if (family) provided.add(familiesOf(family[1])[0]?.said.toLowerCase() ?? '');
      const src = /\bsrc\s*:\s*([^;]+)/i.exec(face[1])?.[1] ?? '';
      if (/size-adjust|ascent-override/i.test(face[1]) && /local\(/i.test(src)) measured = true;
      for (const url of src.matchAll(/url\(\s*["']?([^"')]+)/gi)) {
        const host = /^(?:https?:)?\/\/([^/]+)/i.exec(url[1])?.[1];
        if (host !== undefined) out.push({ where: sheet.where, says: thirdParty(host) });
        else if (/\.woff2?(?:[?#].*)?$/i.test(url[1])) own.push(url[1]);
      }
    }
    for (const m of text.matchAll(/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\/([^/"')\s]+)/gi)) {
      if (FONT_HOSTS.includes(m[1].toLowerCase())) out.push({ where: sheet.where, says: thirdParty(m[1]) });
    }
    // The families a declaration names first: what it means to be seen in.
    // A custom property that holds a stack — `--font-display: 'Space
    // Grotesk', …` — names one as much as `font-family` does.
    const outside = text.replace(/@font-face\s*\{[^}]*\}/gi, (m) => m.replace(/[^\n]/g, ' '));
    for (const m of outside.matchAll(/(?:^|[;{\s"'])(font-family|--[\w-]*(?:font|family|typeface)[\w-]*)\s*:\s*([^;}]+)/gi)) {
      const first = familiesOf(m[2]).find((one) => !/^var\(/i.test(one.said));
      if (first === undefined) continue;
      if (/^var\(/i.test(familiesOf(m[2])[0].said)) continue;
      const key = first.said.toLowerCase();
      if (GENERIC.has(key) || SYSTEM.has(key) || /^-/.test(key)) continue;
      // A custom property's value is a stack only when it says so: quoted, or a list.
      if (m[1].startsWith('--') && !first.quoted && !m[2].includes(',')) continue;
      if (!named.has(key)) named.set(key, { said: first.said, where: `${sheet.where}:${lineAt(text, m.index)}` });
    }
  }

  // A third party's stylesheet provides faces too — said once, as its own
  // finding, and not again as each family it serves. Google's names them in
  // its address; another host's cannot be read, and nothing is said of a
  // family missing beside it.
  let unread = false;
  const linked = [
    ...html.flatMap((page) =>
      [...page.text.matchAll(/<link\b[^>]*>/gi)].filter((m) => /\srel\s*=\s*["']?stylesheet/i.test(m[0])).map((m) => /\shref\s*=\s*["']?([^"'\s>]+)/i.exec(m[0])?.[1] ?? ''),
    ),
    ...css.flatMap((sheet) => [...sheet.text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)].map((m) => m[1])),
  ];
  for (const address of linked) {
    const host = /^(?:https?:)?\/\/([^/]+)/i.exec(address)?.[1]?.toLowerCase();
    if (host === undefined || !FONT_HOSTS.includes(host)) continue;
    if (host !== 'fonts.googleapis.com') {
      unread = true;
      continue;
    }
    for (const m of address.replace(/&amp;/g, '&').matchAll(/[?&]family=([^&:]+)/g)) {
      for (const one of decodeURIComponent(m[1].replace(/\+/g, ' ')).split('|')) provided.add(one.split(':')[0].trim().toLowerCase());
    }
  }

  for (const [key, one] of named) {
    if (provided.has(key) || unread) continue;
    out.push({
      where: one.where,
      says:
        `«${one.said}» is named first in a font stack and no @font-face provides it, so every visitor reads the face after it instead. ` +
        'Load it — its own woff2, or an @fontsource package — or name the face that is loaded',
    });
  }

  for (const page of html) {
    // What is fetched — a stylesheet, a preload — and not a preconnect,
    // which only says where the fetch will go.
    for (const link of page.text.matchAll(/<link\b[^>]*>/gi)) {
      if (!/\srel\s*=\s*["']?(?:stylesheet|preload)/i.test(link[0])) continue;
      const href = /\shref\s*=\s*["']?(?:https?:)?\/\/([^/"'\s>]+)/i.exec(link[0])?.[1];
      if (href !== undefined && FONT_HOSTS.includes(href.toLowerCase())) out.push({ where: page.where, says: thirdParty(href) });
    }
  }

  // Own faces: the first screen's preloaded, and a stand-in measured for the swap.
  if (own.length > 0 && html.length > 0) {
    const preloads = html.some((page) => /<link\b(?=[^>]*\srel\s*=\s*["']?preload)(?=[^>]*\sas\s*=\s*["']?font)[^>]*>/i.test(page.text));
    if (!preloads) {
      out.push({
        where: html[0].where,
        says: "the site's own faces are not preloaded, so the first screen is drawn in the fallback and drawn again: <link rel=\"preload\" as=\"font\" type=\"font/woff2\" crossorigin> for the faces the first screen shows (one or two)",
      });
    }
  }
  if (own.length > 0 && !measured) {
    out.push({
      where: css.find((sheet) => /@font-face/i.test(sheet.text))?.where ?? '(the styles)',
      says: 'no stand-in is measured for the swap — an @font-face of a local face with size-adjust and ascent-override — so the text reflows when the font arrives: `npx @jtakeit/astro fonts <the face.woff2>` prints one; name it after the face in the stack',
    });
  }

  // One finding a host, and one a place for the rest: a third party linked
  // from every page is one decision, said where it is first seen.
  const seen = new Set();
  return out.filter((one) => {
    const key = one.says.startsWith('a font is fetched from') ? one.says : `${one.where}|${one.says}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function thirdParty(host) {
  return (
    `a font is fetched from ${host}: the visitor's address goes to a third party before anybody asked them (LG München I, 20 January 2022, 3 O 17493/20), and the first screen waits on another host. ` +
    'Serve the woff2 with the site — an @fontsource package, or the file under src/ — and preload the first screen\'s faces'
  );
}

/** Every file under a directory with one of the extensions. */
function filesUnder(dir, pattern) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full, pattern));
    else if (pattern.test(name)) found.push(full);
  }
  return found;
}

/**
 * What a site's type is, read off its build: every stylesheet, every page's
 * <style> blocks, and the pages for their <link>s.
 *
 * @param {string} dist
 */
export function builtType(dist) {
  const css = [];
  const html = [];
  for (const file of filesUnder(dist, /\.(css|html)$/)) {
    const text = readFileSync(file, 'utf8');
    const where = relative(dist, file);
    if (file.endsWith('.css')) css.push({ where: `dist/${where}`, text });
    else {
      html.push({ where: `dist/${where}`, text });
      for (const part of styleParts(text, file)) css.push({ where: `dist/${where}`, text: part.css });
    }
  }
  // The home page first: it is where a preload is looked for and named.
  html.sort((a, b) => (a.where === 'dist/index.html' ? -1 : b.where === 'dist/index.html' ? 1 : 0));
  return { css, html };
}

/** The same off the source, where there is no build: src/ and public/. */
export function sourceType(root) {
  const css = [];
  for (const dir of ['src', 'public']) {
    for (const file of styleFiles(join(root, dir))) {
      const text = readFileSync(file, 'utf8');
      const where = relative(root, file);
      for (const part of styleParts(text, file)) css.push({ where, text: part.css });
    }
  }
  return { css, html: [] };
}

/**
 * The floor's advice on a site.
 *
 * @param {string} root the site's root
 * @param {string} [dist] its build, where there is one
 * @returns {{ where: string; says: string }[]}
 */
export function floorAdvice(root, dist) {
  const built = dist !== undefined && existsSync(dist) && statSync(dist).isDirectory();
  return [...screenHeights(root), ...fontFaults(built ? builtType(dist) : sourceType(root))];
}
