/**
 * What a built site owes the studio whatever its contract says — read by
 * `jtk catalogue` on contract 2 and `jtk schema` on contract 3 alike.
 *
 *   servedFaults(root)      a build that can only be served at the root of a host
 *   unboundedHeights(root)  a first screen that grows to fill the panel's frame
 *   prefixBuild(root)       the site built again under a path, and what leaves it
 *   builtPages(dir)         every built page, as files
 *   unowned(html)           the sentences on a page nobody has claimed
 *
 * Moved here from `catalogue.mjs` as they were, so that a contract-3 site is
 * held to them by the same lines (jtakeit-core wiki/98 §1, 3: one rule, one
 * implementation). None of them carries a `JTK_E_` code: where a build is
 * served from, and whether every sentence on it is somebody's, are the
 * studio's arrangements and not the format's (codes.mjs, LOCAL).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { LOCAL } from './codes.mjs';

/*
 * ── can the platform serve this at all ─────────────────────────────────────
 *
 * A site is served two ways and the difference is a path. On its own host it is
 * at the root, so `/preise/` and `/favicon.png` mean what they say. In the
 * studio's preview the same build is served under
 * `https://preview…/p/<slug>/`, where the root is not the site: every one of
 * those addresses leaves it, and what the client is shown is a page with no
 * stylesheet, no pictures and navigation that 404s.
 *
 * It reads as a broken build rather than as a wrong prefix, which is why it is
 * checked here rather than written down anywhere: it has cost three separate
 * afternoons, and the third one was a site the kit had already been used to
 * build. Two things are needed and neither is visible in a browser at
 * `localhost:4321`, where the base is `/` and everything works.
 *
 * ── and these carry no JTK_E_ code, on purpose ──────────────────────────────
 *
 * The judge has no opinion about any of it, correctly. Where a build is served
 * from is the studio's arrangement — our preview, our prefix — and not something
 * the format says anything about; a stranger's repository could get every one
 * of these "wrong" and still be a repository the platform can build. Giving them
 * a `JTK_E_…` would put a name in the terminal that the platform's own reference
 * has no row for, and `--judge` would then read the server's silence about them
 * as a false refusal. They are marked LOCAL instead.
 */

/**
 * The studio's preview arrangement, checked in the source: `base` in the Astro
 * config, and every address a person typed from the root.
 *
 * @param {string} root the site's root
 * @returns {{ code: string; where: string; says: string }[]}
 */
export function servedFaults(root) {
  const out = [];
  const fault = (code, where, says) => out.push({ code, where, says });

  const configPath = join(root, 'astro.config.mjs');
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, 'utf8');
    if (!/\bbase\s*:/.test(config)) {
      fault(
        LOCAL,
        'astro.config.mjs',
        'sets no `base`, so this build can only be served at the root of a host — ' +
          "the studio's preview serves it under /p/<slug>/, where every asset it emits is a 404. " +
          'Derive it from the site URL: `const BASE = new URL(SITE).pathname` and `base: BASE`',
      );
    } else if (!/new URL\(\s*SITE\s*\)\.pathname/.test(config) && !/BASE_URL/.test(config)) {
      fault(
        LOCAL,
        'astro.config.mjs',
        'sets `base` from something other than the site URL — the two are one ' +
          'decision, and setting one and forgetting the other is the failure this check exists for',
      );
    }
  }

  /*
   * And the addresses a person typed.
   *
   * `base` fixes what Astro emits — the bundled CSS, the optimised images — and
   * it cannot fix a string. `href="/preise/"` is a link out of the preview and
   * `href="/favicon.png"` is a 404, in a build where everything Astro made is
   * right. src/lib/under.ts is the one way to write these.
   *
   * `/api/…` is exempt: a form posts to the host it is served from, which is the
   * real site in production and is not part of the build.
   */
  const absolute = /(?:href|src|poster|action|content)\s*=\s*"(\/(?!\/)[^"#]*)"/g;
  const cssAbsolute = /url\(\s*['"]?(\/(?!\/)[^)'"]*)/g;

  for (const file of sourceFiles(join(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    const where = relative(root, file);
    const seen = new Set();

    for (const [, address] of [...text.matchAll(absolute), ...text.matchAll(cssAbsolute)]) {
      if (address.startsWith('/api/')) continue;
      if (seen.has(address)) continue;
      seen.add(address);
      fault(
        LOCAL,
        where,
        `"${address}" is written from the root, so it leaves the site wherever the site ` +
          "is not at the root — which is the studio's preview, always. Write it as " +
          `under('${address}') — see src/lib/under.ts`,
      );
    }
  }
  return out;
}

function sourceFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    // Whatever a generator writes a page in: the check is for an address a
    // person typed, and those are typed in any of these.
    if (/\.(astro|ts|tsx|js|jsx|mjs|vue|svelte|html|njk|liquid|hbs|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** Every stylesheet under src, as one string. Crude on purpose: the question is
 *  only whether a name appears at all. */
export function readStyles(dir) {
  if (!existsSync(dir)) return '';

  let found = '';
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found += readStyles(full);
      continue;
    }
    // Astro components carry their styles inside them, which is where a site is
    // as likely to have put these as in a stylesheet.
    if (/\.(css|astro)$/.test(name)) found += readFileSync(full, 'utf8');
  }
  return found;
}

/*
 * A height that is the viewport's, with no ceiling.
 *
 * The panel draws a page in a frame as tall as the whole document — its
 * thumbnails and its comparison of two versions — because a browser does not
 * render what lies below a frame. In that frame `100svh` is the document's
 * height, so a first screen of `min-height: 100svh` grew to fill all of it and
 * the rest of the site was nowhere (Kaif, 30 October 2026). A viewport height
 * with a ceiling — `min(100svh, 56rem)` — is the same screen on a phone and a
 * bounded one in a frame.
 */
/**
 * @param {string} root the site's root
 * @returns {string} the sentence that says it, or '' for a site with none
 */
export function unboundedHeights(root) {
  const unbounded = /(?:^|[;{\s])((?:min-|max-)?(?:height|block-size))\s*:\s*100(?:s|d|l)?vh\s*(?:!important)?\s*[;}]/g;
  const found = new Set();
  for (const [, property] of readStyles(join(root, 'src')).matchAll(unbounded)) found.add(property);
  if (found.size === 0) return '';
  return (
    `${[...found].join(', ')}: 100vh with no ceiling. The panel draws the page in a frame as tall as the document, ` +
    'where a viewport height is all of it — give it one: min(100svh, 56rem).'
  );
}

/*
 * ── and prove it survives being served under a prefix ──────────────────────
 *
 * The source check above catches an address somebody typed. It cannot catch one
 * that arrives as data — a nav list of `{ label, href }`, rendered with
 * `href={item.href}` — and that is how the failure actually shipped: a site with
 * every link in one file, none of them under the base, and a preview where the
 * front page is right and every other page leaves the site.
 *
 * So the build is done a second time with a path in SITE_URL, into a directory
 * that is thrown away, and every address it emitted is held to that path. It is
 * the only proof that does not depend on how the site is written: whatever the
 * link went through, this is what came out. About five seconds on a whole site.
 */
/**
 * Astro's build takes `--outDir`, which is what lets this run into a directory
 * that is thrown away; the caller removes `out` when it is done with it.
 *
 * @param {string} root the site's root, an Astro project
 * @returns {{ prefix: string; out: string; leaks?: { page: string; address: string }[]; failed?: string }}
 *   `leaks` from a build that ran, `failed` with the end of its error output from one that did
 *   not, and neither where the build could not be started at all — not a verdict on the site
 */
export function prefixBuild(root) {
  const prefix = '/p/jtk-check/';
  const out = join(root, '.jtk-prefix-check');
  try {
    execFileSync('npx', ['astro', 'build', '--outDir', out], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, SITE_URL: `https://jtk-check.invalid${prefix}`, PUBLIC_INDEXABLE: 'false' },
    });

    const leaks = [];
    const emitted = /(?:href|src|poster|action|content)="(\/(?!\/)[^"#]*)"/g;

    for (const file of builtPages(out)) {
      const page = relative(out, file);
      for (const [, address] of readFileSync(file, 'utf8').matchAll(emitted)) {
        if (address.startsWith(prefix) || address.startsWith('/api/')) continue;
        if (leaks.some((one) => one.address === address)) continue;
        leaks.push({ page, address });
      }
    }
    return { prefix, out, leaks };
  } catch (err) {
    // A build that fails only with a prefix is worth saying out loud; a build
    // that fails outright has already been reported, and this one is
    // running against a directory nobody will deploy.
    if (err?.status !== undefined) return { prefix, out, failed: String(err.stderr ?? '').slice(-2000) };
    return { prefix, out };
  }
}

/** Every built page, as files. */
export function builtPages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...builtPages(full));
    else if (full.endsWith('.html')) out.push(full);
  }
  return out;
}

// --- and what is on the page that nobody can edit --------------------------
//
// The checks of a declaration compare it with the annotations. Neither
// direction can see the failure that is actually most common: a sentence
// written straight into a component, which carries no annotation, is in
// nobody's declaration and is therefore invisible to both.
//
// It is found by tapping, one string at a time, by whoever is looking at the
// site — "I cannot edit the header", "nor the footer", "nor the labels on the
// form", "nor the word above each section" — and every one of those is a
// message and a deploy.
//
// **This used to be a report and is now a gate.** A report made the decision
// optional, and optional is how twenty-six strings on a real site ended up
// belonging to nobody: the navigation, the footer and the labels on the form,
// with a note in the handover saying the line had been drawn deliberately. It
// had not been drawn at all — nothing was written down, so nothing could be
// changed, and the owner found out by wanting to change one.
//
// So every visible sentence must be one of two things, and both are a decision
// somebody made **in the repository**:
//
//   the owner's   →  declared and annotated: `data-jtk-path` (text on every
//                    page goes in the shared document — one copy, annotated
//                    everywhere it is drawn)
//   the design's  →  marked `data-jtk-fixed`, which says "these words are part
//                    of the composition and not the business's to change"
//
// `data-jtk-fixed` is what a skip link, a honeypot's label and a decorative
// caption carry. It silences a subtree, so one attribute on a wrapper covers a
// whole ornament. The edge takes it off the public copy the same way it takes
// `data-jtk-path` off.

/** Text on the page with no annotated element above it. */
export function unowned(html) {
  const found = [];
  const stack = [];
  let skipping = null;
  let at = 0;

  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const OPAQUE = new Set(['script', 'style', 'svg', 'head', 'template', 'noscript']);

  while (at < html.length) {
    const open = html.indexOf('<', at);
    if (open === -1) break;

    const text = html.slice(at, open);
    if (skipping === null && stack.length > 0 && !stack.some((frame) => frame.annotated)) {
      const words = text.replace(/\s+/g, ' ').trim();
      /*
       * Anything with letters in it, and that bar is low on purpose.
       *
       * The first version asked for a dozen characters and two words, and it
       * missed exactly the ones somebody was complaining about: `Method`,
       * `Evidence`, `One piece` — the word above each section, six letters
       * each, and as much the business's own as the heading under it. A bullet,
       * a dash and a page number have no letters and fall out anyway.
       */
      if (/\p{L}/u.test(words) && words.length >= 3) {
        found.push({ where: stack[stack.length - 1].tag, words });
      }
    }

    const close = html.indexOf('>', open);
    if (close === -1) break;
    const tag = html.slice(open + 1, close);
    at = close + 1;

    if (tag.startsWith('!') || tag.startsWith('?')) continue;

    if (tag.startsWith('/')) {
      const name = tag.slice(1).trim().toLowerCase();
      if (skipping === name) skipping = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const name = tag.split(/[\s/>]/)[0].toLowerCase();
    if (skipping !== null) continue;
    if (OPAQUE.has(name)) {
      skipping = name;
      continue;
    }
    if (VOID.has(name) || tag.endsWith('/')) continue;

    stack.push({
      tag: name,
      /*
       * Either the owner's or the design's — both are decisions, and what is
       * left is the failure: a sentence nobody has claimed.
       *
       * The `|$` is not a flourish. `tag` is held here with its brackets already
       * stripped, so a boolean attribute written last — which is where a person
       * naturally writes it, `<a class="skip" href="#main" data-jtk-fixed>` — has
       * nothing after it to match. Without the alternative the mark was silently
       * ignored and the sentence reported as belonging to nobody. It passed on
       * the two sites it was tried on only because Astro appends its own
       * `data-astro-cid-…` to elements in a component that has styles; the first
       * element without one failed, and was worked around locally rather than
       * reported as a bug for a day.
       *
       * The lookahead itself stays, so `data-jtk-fixedly` is still not a mark.
       */
      annotated: /\sdata-jtk-path=/.test(tag) || /\sdata-jtk-fixed(?=[\s/>=]|$)/.test(tag),
    });
  }

  return found;
}
