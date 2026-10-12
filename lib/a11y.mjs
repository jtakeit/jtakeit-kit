/**
 * `jtk a11y` — a built site read by a machine against WCAG 2.1 A and AA.
 *
 *   npx @jtakeit/astro a11y                   every page in ./dist
 *   npx @jtakeit/astro a11y --dist out / /blog/
 *
 * The pages are served from `dist/` as they were built, in a real Chrome,
 * with the platform's six addresses answered by a stand-in — so the booking
 * form is drawn, a day and a time are picked, the second step is reached and
 * a booking is made, and each of those states is read too. A form that only
 * exists after a fetch is the part of a site a static check never sees.
 *
 * Two kinds of finding:
 *
 *   axe       axe-core's rules tagged wcag2a, wcag2aa, wcag21a and wcag21aa —
 *             contrast, names, labels, landmarks' structure, `lang`, ARIA
 *   behaviour what axe cannot judge and a script can: the skip link is the
 *             first stop and lands on <main>; every keyboard stop shows a
 *             focus ring; nothing is cut off at 320 px; the booking form moves
 *             focus to the new step and to its answer, and says its errors
 *             beside the field they are about
 *
 * What neither can judge — whether an alt text describes its picture, whether
 * a link's words say where it goes — is the author's, and docs/accessibility.md
 * says so.
 *
 * It needs two packages the scaffold does not install, because a site that
 * never runs it should not download them: `npm i -D playwright-core axe-core`.
 * And a Chrome: the one installed (`channel: 'chrome'`), or `CHROME_PATH`.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain',
};

/** The WCAG 2.1 A and AA rules, and nothing else — no best practice dressed as a failure. */
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Every page a build wrote, as addresses: `dist/blog/index.html` is `/blog/`.
 * The editor's specimen pages (`/_fl-…`) are served to an editing session
 * only and are left out.
 * @param {string} dist
 */
export function pagesOf(dist) {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return walk(dist)
    .filter((f) => f.endsWith('.html'))
    .map((f) => '/' + relative(dist, f).split(sep).join('/').replace(/index\.html$/, '').replace(/\.html$/, ''))
    .filter((p) => !/\/_fl-/.test(p))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/**
 * The platform's addresses beside the site, answered as the platform would
 * for a business open every day from nine to five: free times every half
 * hour, a booking confirmed, an enquiry received. Enough for every state of
 * both forms to be drawn; nothing about the answers is checked here.
 * @param {string} path
 * @param {URLSearchParams} query
 */
function platform(path, query) {
  if (path.endsWith('/api/turnstile')) return { sitekey: '' };
  if (path.endsWith('/api/availability')) {
    const from = new Date(query.get('from') ?? Date.now());
    const slots = [];
    for (let m = 9 * 60; m < 17 * 60; m += 30) {
      const start = new Date(from.getTime() + m * 60_000);
      slots.push({ start: start.toISOString(), ends: new Date(start.getTime() + 45 * 60_000).toISOString(), free: ['one'], costs_minor: 0 });
    }
    return { zone: 'UTC', slots, scale: 'hourly', party_max: 0, quantity_max: 1, classes: [], resources: [] };
  }
  if (path.endsWith('/api/book')) {
    const start = new Date(Date.now() + 86_400_000);
    return {
      id: 'a11y', state: 'confirmed', start: start.toISOString(), ends: new Date(start.getTime() + 45 * 60_000).toISOString(),
      amount_minor: 0, currency: 'CHF', token: 'a11y', manage_path: '/_booking/a11y', telegram_url: '',
    };
  }
  if (path.endsWith('/api/lead')) return { ok: true };
  return null;
}

/**
 * `dist/` on a port of its own, with the platform's addresses answered.
 * @param {string} dist
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export function serve(dist) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const answer = url.pathname.includes('/api/') ? platform(url.pathname, url.searchParams) : null;
    if (answer) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(answer));
      return;
    }
    let file = join(dist, decodeURIComponent(url.pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
    if (!file.startsWith(resolve(dist)) || !existsSync(file)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => {
    const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
    done({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
  }));
}

/** playwright-core and axe-core, from the site's own node_modules — or a sentence saying how to get them. */
async function tools(from) {
  const require = createRequire(join(from, 'package.json'));
  const here = createRequire(import.meta.url);
  const find = (name) => { try { return require.resolve(name); } catch { return here.resolve(name); } };
  try {
    const loaded = await import(find('playwright-core'));
    const chromium = loaded.chromium ?? loaded.default?.chromium;
    const axe = readFileSync(find('axe-core/axe.min.js'), 'utf8');
    return { chromium, axe };
  } catch {
    throw new Error('jtk a11y needs playwright-core and axe-core: npm i -D playwright-core axe-core');
  }
}

/** A Chrome: `CHROME_PATH`, the one installed, or Playwright's own. */
async function launch(chromium) {
  const tries = [
    ...(process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : []),
    { channel: 'chrome' },
    {},
  ];
  let last;
  for (const how of tries) {
    try { return await chromium.launch({ headless: true, ...how }); } catch (why) { last = why; }
  }
  throw new Error(`jtk a11y found no Chrome to run: install Google Chrome, or set CHROME_PATH (${String(last?.message ?? last).split('\n')[0]})`);
}

/**
 * axe on the page as it is now.
 * @param {import('playwright-core').Page} page
 * @param {string} axe
 * @param {string} [within] a selector to read only part of the page
 */
async function readAxe(page, axe, within) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: axe });
  return page.evaluate(async ({ tags, within }) => {
    const result = await window.axe.run(within ? { include: [within] } : document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return result.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, tags: v.tags.filter((t) => /^wcag\d/.test(t)),
      nodes: v.nodes.map((n) => ({ target: n.target.join(' '), summary: n.failureSummary })),
    }));
  }, { tags: TAGS, within });
}

/**
 * The keyboard, from the top of the page: the first stop is a skip link that
 * lands on <main>, and every stop — up to `stops` of them — draws a ring.
 * @param {import('playwright-core').Page} page
 * @param {number} stops
 */
async function readKeyboard(page, stops) {
  const found = [];
  await page.evaluate(() => { (document.activeElement instanceof HTMLElement) && document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLAnchorElement)) return { ok: false, said: el ? el.outerHTML.slice(0, 120) : 'nothing' };
    const target = el.hash ? document.getElementById(decodeURIComponent(el.hash.slice(1))) : null;
    const box = el.getBoundingClientRect();
    return {
      ok: Boolean(target && target.tagName === 'MAIN' && box.width > 0 && box.height > 0 && box.top >= 0 && box.top < innerHeight),
      said: `${el.textContent?.trim()} → ${el.hash || '(no target)'}${target ? ` (${target.tagName.toLowerCase()})` : ''}`,
    };
  });
  found.push({ check: 'skip link is the first stop, visible, and lands on <main> (2.4.1)', ok: first.ok, said: first.said });

  const ringless = [];
  for (let i = 0; i < stops; i++) {
    const seen = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const css = getComputedStyle(el);
      const ring = (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0) || (css.boxShadow && css.boxShadow !== 'none');
      return { ring, who: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} «${(el.textContent ?? '').trim().slice(0, 30)}»` };
    });
    if (seen && !seen.ring) ringless.push(seen.who);
    await page.keyboard.press('Tab');
  }
  found.push({ check: 'every keyboard stop shows a focus indicator (2.4.7)', ok: ringless.length === 0, said: ringless.slice(0, 5).join('; ') });
  return found;
}

/**
 * At 320 CSS pixels nothing is cut off or needs a sideways scroll (1.4.10).
 * `overflow-x: hidden` on the body hides such a fault rather than fixing it,
 * so what is measured is the elements, not the scrollbar.
 * @param {import('playwright-core').Page} page
 */
async function readReflow(page) {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(50);
  const over = await page.evaluate(() => {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!(el instanceof HTMLElement) || el.closest('[aria-hidden="true"], .is-replaced, .trap, .languages--corner')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Inside a box that scrolls on its own, wide is allowed: a table, a code block.
      let scroller = el.parentElement;
      while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement;
      if (scroller && scroller !== document.body) continue;
      if (box.right > innerWidth + 1 || box.left < -1) out.push(`${el.tagName.toLowerCase()} «${el.textContent?.trim().slice(0, 30)}»`);
    }
    return out;
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  return { check: 'nothing is cut off at 320 px wide (1.4.10)', ok: over.length === 0, said: over.slice(0, 5).join('; ') };
}

/**
 * The booking form, driven: drawn, a service and a day and a time picked, the
 * second step, a refusal, a booking. axe reads each state; the script checks
 * where focus went and what was said.
 * @param {import('playwright-core').Page} page
 * @param {string} axe
 */
async function driveBooking(page, axe) {
  const states = [];
  const found = [];
  const form = 'form[data-booking]';
  await page.waitForFunction((sel) => {
    const f = document.querySelector(sel);
    return f && !f.classList.contains('booking--unsaid');
  }, form, { timeout: 5000 });
  states.push({ state: 'booking: drawn', violations: await readAxe(page, axe, form) });

  // A service, a day, a time — by the keyboard where the form is drawn for it.
  const box = page.locator(`${form} input[name=service]:not(:disabled)`).first();
  if (await box.count()) await box.check({ force: true });
  const day = page.locator(`${form} .booking__day:not(:disabled)`).first();
  if (await day.count()) {
    await day.focus();
    await page.keyboard.press('Enter');
    const kept = await page.evaluate(() => document.activeElement?.classList.contains('booking__day') ?? false);
    found.push({ check: 'booking: a day picked by the keyboard keeps the focus on the day (2.4.3)', ok: kept, said: kept ? '' : 'focus fell to the page' });
  } else {
    await page.locator(`${form} input[name=day]`).fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
    await page.locator(`${form} input[name=day]`).dispatchEvent('change');
  }
  await page.waitForSelector(`${form} .booking__slot`, { timeout: 5000 });
  const said = await page.evaluate((sel) => document.querySelector(`${sel} [data-times-hint]`)?.getAttribute('aria-live') ?? '', form);
  found.push({ check: 'booking: what the times say is a live region (4.1.3)', ok: said === 'polite' || said === 'assertive', said });
  const slot = page.locator(`${form} .booking__slot:visible`).first();
  await slot.focus();
  await page.keyboard.press('Enter');
  const pressed = await slot.getAttribute('aria-pressed');
  found.push({ check: 'booking: the chosen time says it is chosen (4.1.2)', ok: pressed === 'true', said: `aria-pressed=${pressed}` });
  states.push({ state: 'booking: times drawn', violations: await readAxe(page, axe, form) });

  const next = page.locator(`${form} .booking__next`);
  if (await next.count()) {
    await next.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-stage') === '2', form);
    const at = await page.evaluate(() => {
      const el = document.activeElement;
      return { ok: Boolean(el && (el.getAttribute('aria-current') === 'step' || /^H[1-6]$/.test(el.tagName))), said: el ? `${el.tagName.toLowerCase()} «${el.textContent?.trim().slice(0, 40)}»` : 'nothing' };
    });
    found.push({ check: 'booking: the second step takes the focus to its heading (2.4.3)', ...at });
    states.push({ state: 'booking: second step', violations: await readAxe(page, axe, form) });
  }

  // Refused: no name. The sentence is said, and tied to the field.
  await page.locator(`${form} [data-submit]`).click();
  const refused = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    const name = f?.querySelector('[name=name]');
    const alert = f?.querySelector('[role=alert]:not([hidden])');
    const tied = (name?.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => id && document.getElementById(id)?.textContent?.trim());
    return {
      ok: Boolean(alert?.textContent?.trim() && name?.getAttribute('aria-invalid') === 'true' && tied && document.activeElement === name),
      said: `alert «${alert?.textContent?.trim() ?? ''}», aria-invalid=${name?.getAttribute('aria-invalid')}, described=${tied}, focus on name=${document.activeElement === name}`,
    };
  }, form);
  found.push({ check: 'booking: a missing name is said, tied to the field, and focused (3.3.1, 4.1.3)', ...refused });
  states.push({ state: 'booking: refused', violations: await readAxe(page, axe, form) });

  await page.locator(`${form} [name=name]`).fill('Ada Test');
  await page.locator(`${form} [name=phone]`).fill('+41 44 000 00 00');
  await page.locator(`${form} [data-submit]`).click();
  await page.waitForSelector(`${form} [data-done]:not([hidden])`, { timeout: 5000 });
  await page.waitForTimeout(50);
  const answered = await page.evaluate((sel) => {
    const done = document.querySelector(`${sel} [data-done]`);
    return { ok: Boolean(done && done.contains(document.activeElement) && done.getAttribute('role') === 'status'), said: `focus on ${document.activeElement?.tagName.toLowerCase()}.${document.activeElement?.className}` };
  }, form);
  found.push({ check: 'booking: the answer takes the focus and is a status (2.4.3, 4.1.3)', ...answered });
  const copy = page.locator(`${form} [data-keep-copy]`);
  if (await copy.isVisible()) {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    await copy.click();
    // The words come once the clipboard has answered, which is a promise:
    // up to a second for them, as a screen reader would wait for a status.
    await page.waitForFunction((sel) => [...document.querySelectorAll(`${sel} [data-keep] [role=status], ${sel} [data-keep] [aria-live]`)]
      .some((el) => (el.textContent ?? '').trim() !== ''), form, { timeout: 1000 }).catch(() => undefined);
    const told = await page.evaluate((sel) => {
      const live = [...document.querySelectorAll(`${sel} [data-keep] [role=status], ${sel} [data-keep] [aria-live]`)];
      return live.map((el) => el.textContent?.trim()).filter(Boolean).join(' ');
    }, form);
    found.push({ check: 'booking: «copied» is said, not only drawn (4.1.3)', ok: told !== '', said: told });
  }
  states.push({ state: 'booking: booked', violations: await readAxe(page, axe, form) });
  return { states, found };
}

/**
 * The enquiry form, refused: the sentence beside the field, tied to it, the
 * focus on the first field that is wrong.
 * @param {import('playwright-core').Page} page
 */
async function driveLead(page) {
  const form = 'form[data-lead-form]';
  await page.locator(`${form} [data-submit]`).click();
  const refused = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    const name = f?.querySelector('[name=name]');
    const tied = (name?.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => id && document.getElementById(id)?.textContent?.trim());
    return {
      ok: Boolean(name?.getAttribute('aria-invalid') === 'true' && tied && document.activeElement === name),
      said: `aria-invalid=${name?.getAttribute('aria-invalid')}, described=${tied}, focus on name=${document.activeElement === name}`,
    };
  }, form);
  return [{ check: 'enquiry: a missing field is said, tied to it, and focused (3.3.1, 3.3.2)', ...refused }];
}

/**
 * @typedef {object} PageResult
 * @property {string} path
 * @property {string} scheme
 * @property {{ state: string; violations: any[] }[]} states
 * @property {{ check: string; ok: boolean; said?: string }[]} found
 */

/**
 * Reads every page.
 * @param {{ dist: string; pages?: string[]; schemes?: string[]; stops?: number; from?: string; log?: (line: string) => void }} options
 * @returns {Promise<PageResult[]>}
 */
export async function audit(options) {
  const dist = resolve(options.dist);
  if (!existsSync(dist)) throw new Error(`no ${dist} — build the site first`);
  const pages = options.pages?.length ? options.pages : pagesOf(dist);
  const log = options.log ?? (() => undefined);
  const { chromium, axe } = await tools(options.from ?? process.cwd());
  // A site whose stylesheets never ask for a scheme looks the same in both:
  // read once, and say so, rather than twice for the same answer.
  const css = readdirSync(dist, { recursive: true }).filter((f) => String(f).endsWith('.css')).map((f) => readFileSync(join(dist, String(f)), 'utf8')).join('\n');
  const html = pages.map((p) => { try { return readFileSync(join(dist, p, 'index.html'), 'utf8'); } catch { return ''; } }).join('\n');
  const schemes = options.schemes ?? (/prefers-color-scheme/.test(css + html) ? ['light', 'dark'] : ['light']);

  const server = await serve(dist);
  const browser = await launch(chromium);
  /** @type {PageResult[]} */
  const results = [];
  try {
    for (const scheme of schemes) {
      // Reduced motion: every entrance lands where it finishes, so what is
      // read is the page and not a frame of its arrival.
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: /** @type {any} */ (scheme), reducedMotion: 'reduce' });
      for (const path of pages) {
        const page = await context.newPage();
        await page.goto(server.url + path, { waitUntil: 'networkidle' });
        const states = [{ state: 'page', violations: await readAxe(page, axe) }];
        const found = [...(await readKeyboard(page, options.stops ?? 40)), await readReflow(page)];
        if (await page.locator('form[data-lead-form]').count()) found.push(...(await driveLead(page)));
        if (await page.locator('form[data-booking]').count()) {
          const booking = await driveBooking(page, axe);
          states.push(...booking.states);
          found.push(...booking.found);
        }
        results.push({ path, scheme, states, found });
        const v = states.reduce((n, s) => n + s.violations.length, 0);
        const f = found.filter((x) => !x.ok).length;
        log(`${v + f === 0 ? 'ok  ' : 'FAIL'} ${path} (${scheme})${v ? ` · ${v} axe` : ''}${f ? ` · ${f} behaviour` : ''}`);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return results;
}

/**
 * The findings as lines a person reads.
 * @param {PageResult[]} results
 */
export function report(results) {
  const lines = [];
  for (const r of results) {
    for (const s of r.states) for (const v of s.violations) {
      lines.push(`${r.path} (${r.scheme}) ${s.state} — ${v.id} [${v.tags.join(' ')}] ${v.help}`);
      for (const n of v.nodes.slice(0, 4)) lines.push(`    ${n.target}${n.summary ? ` — ${n.summary.split('\n').slice(1).join(' ').trim().slice(0, 160)}` : ''}`);
      if (v.nodes.length > 4) lines.push(`    … and ${v.nodes.length - 4} more`);
    }
    for (const f of r.found) if (!f.ok) lines.push(`${r.path} (${r.scheme}) — ${f.check}: ${f.said || 'no'}`);
  }
  return lines;
}

/** The command line: `jtk a11y [--dist ./dist] [--stops 40] [/path …]`. */
export async function main(args) {
  const at = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const pages = args.filter((a, i) => a.startsWith('/') && args[i - 1] !== '--dist');
  const results = await audit({
    dist: at('--dist') ?? 'dist',
    pages,
    stops: Number(at('--stops') ?? 40),
    log: (line) => console.log(line),
  });
  const lines = report(results);
  if (lines.length) {
    console.error(`\n${lines.join('\n')}\n`);
    console.error(`jtk a11y: ${lines.filter((l) => !l.startsWith('    ')).length} finding(s) against WCAG 2.1 AA on ${results.length} page read(s)`);
    process.exit(1);
  }
  console.log(`jtk a11y: ${results.length} page read(s), nothing found against WCAG 2.1 AA by machine — the rest is read by a person (docs/accessibility.md)`);
}
