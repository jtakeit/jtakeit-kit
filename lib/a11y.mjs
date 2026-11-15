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
 * exists after a fetch is the part of a site a static check never sees. The
 * shop's addresses are answered by `devShop` from the site's own files, as
 * the dev server answers them, so a product is chosen, refused and added, and
 * a cart is priced, its country and method chosen, and its last line taken out.
 *
 * Two kinds of finding:
 *
 *   axe       axe-core's rules tagged wcag2a, wcag2aa, wcag21a and wcag21aa —
 *             contrast, names, labels, landmarks' structure, `lang`, ARIA
 *   behaviour what axe cannot judge and a script can: the skip link is the
 *             first stop and lands on <main>; every keyboard stop shows a
 *             focus ring; nothing is cut off at 320 px; the booking form moves
 *             focus to the new step and to its answer, and says its errors
 *             beside the field they are about; the shop's pieces say what is
 *             sold out in words, a fault at its field, «added» as a status, a
 *             line the shop refuses with its reason, the customs sentence
 *             where a parcel crosses the border
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
import { devShop } from '@jtakeit/kit/devshop';
import { money } from '@jtakeit/kit/money';

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

/** The booking addresses whose requests name the protocol version. */
const VERSIONED = ['/api/availability', '/api/book', '/api/pay', '/api/turnstile'];
/** The shop's, likewise (shop/1); its local pay page is a page a browser is sent to, and names none. */
const SHOP_VERSIONED = ['/api/stock', '/api/shipping', '/api/checkout', '/api/order'];

/**
 * `dist/` on a port of its own, with the platform's addresses answered — the
 * shop's by `devShop` from the site's files at `root`, with the SKUs in
 * `soldOut` sold out — and every shop request noted (`shopAsked`), and every
 * booking or shop request that did not name its protocol version, for each
 * piece's check to say.
 * @param {string} dist
 * @param {{ root?: string; soldOut?: string[] }} [options]
 * @returns {Promise<{ url: string; close: () => void; unnamed: string[]; unnamedShop: string[]; shopAsked: string[] }>}
 */
export function serve(dist, { root, soldOut } = {}) {
  /** @type {string[]} */ const unnamed = [];
  /** @type {string[]} */ const unnamedShop = [];
  /** @type {string[]} */ const shopAsked = [];
  // A site whose schema does not turn the shop on is answered nothing by it: every address is next()'s.
  const shop = root === undefined ? undefined : devShop(root, { soldOut });
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (VERSIONED.some((one) => url.pathname.endsWith(one)) && !req.headers['x-jtk-booking']) unnamed.push(url.pathname);
    // A question the walk puts to the shop itself (`x-jtk-walk`) is the walk's, not the page's: it names the protocol
    // and is answered like any, but a page that asked nothing is not made to look as if it had.
    if (SHOP_VERSIONED.some((one) => url.pathname.endsWith(one)) && req.headers['x-jtk-walk'] === undefined) {
      shopAsked.push(url.pathname);
      if (!req.headers['x-jtk-shop']) unnamedShop.push(url.pathname);
    }
    const rest = () => {
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
    };
    if (shop !== undefined && url.pathname.includes('/api/')) void shop(req, res, rest);
    else rest();
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => {
    const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
    done({ url: `http://127.0.0.1:${port}`, close: () => server.close(), unnamed, unnamedShop, shopAsked });
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
 * A product's page, driven as a buyer drives it (jtakeit-core wiki/102 stage 9,
 * Ruling 195): drawn and its stock read; each option moved to its next value
 * by the keyboard, and the price shown the variant then chosen, annotated as
 * its own; where that lands on a variant sold out, it is said in words beside
 * every value chosen and *Add* is held; back to the first choice; a question
 * the product must have answered left unanswered and *Add* pressed; answered,
 * and added; then a browser that keeps no cart, and *Add* again. axe reads
 * each state; the script checks where the focus went and what was said. What the product has not got — options, a
 * question it must ask, a variant sold out — is not driven, and its check
 * not said: a walk that must reach one says which (test/a11y-shop.mjs).
 * @param {import('playwright-core').Page} page
 * @param {string} axe
 */
async function driveProduct(page, axe) {
  const states = [];
  const found = [];
  const form = 'form[data-product]';
  // Wired, and what is left read — or the read failed, which says nothing and leaves Add on.
  await page.waitForFunction((sel) => document.querySelector(sel)?.hasAttribute('data-stock-read'), form, { timeout: 5000 });
  states.push({ state: 'product: drawn', violations: await readAxe(page, axe, form) });
  const { options, asked, words, api } = await page.evaluate((sel) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
    const facts = JSON.parse(f.dataset.facts ?? '{}');
    return {
      options: (facts.options ?? []).map((one) => one.key),
      asked: (facts.customizations ?? []).filter((one) => one.required).map((one) => ({ key: one.key, kind: one.kind })),
      words: JSON.parse(f.dataset.words ?? '{}'),
      api: f.dataset.api ?? '/api/',
    };
  }, form);
  const radios = (key) => `${form} input[type=radio][name="option:${key}"]`;

  // Each option to its next value, by the keyboard: the value chosen, the focus kept on it.
  /** @type {Record<string, string>} */ const first = {};
  const moved = [];
  for (const key of options) {
    const checked = page.locator(`${radios(key)}:checked`);
    if ((await checked.count()) === 0 || (await page.locator(`${radios(key)}:not(:disabled):not(:checked)`).count()) === 0) continue;
    first[key] = (await checked.getAttribute('value')) ?? '';
    await checked.focus();
    await page.keyboard.press('ArrowRight');
    const now = await page.evaluate((name) => {
      const el = /** @type {HTMLInputElement | null} */ (document.activeElement);
      return { name: el?.name ?? '', value: el?.value ?? '', checked: el?.checked === true };
    }, `option:${key}`);
    moved.push({ key, ok: now.name === `option:${key}` && now.checked && now.value !== first[key], said: `${key}: ${first[key]} → ${now.value}${now.name === `option:${key}` ? '' : ` (focus on ${now.name || 'nothing'})`}` });
  }
  if (moved.length > 0) {
    found.push({ check: 'product: each option\'s value chosen by the keyboard, the focus kept on it (2.1.1, 2.4.3)', ok: moved.every((one) => one.ok), said: moved.filter((one) => !one.ok).map((one) => one.said).join('; ') });
    states.push({ state: 'product: chosen by the keyboard', violations: await readAxe(page, axe, form) });
    // Not WCAG: the price shown is the variant now chosen, and a tap on it edits that variant's — the
    // build drew each variant's price, annotated, so the one chosen reads the same words there.
    const priced = await page.evaluate((sel) => {
      const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
      const facts = JSON.parse(f.dataset.facts ?? '{}');
      const picks = Object.fromEntries([...f.querySelectorAll('input[type=radio]:checked')].map((el) => [/** @type {HTMLInputElement} */ (el).name.replace(/^option:/, ''), /** @type {HTMLInputElement} */ (el).value]));
      const variant = (facts.variants ?? []).find((one) => (facts.options ?? []).every((option) => one.picks?.[option.key] === picks[option.key]));
      const price = /** @type {HTMLElement | null} */ (f.querySelector('[data-price]'));
      const at = price?.getAttribute('data-jtk-path') ?? '';
      // Every other element the build drew with that annotation — the list of variants, a «from» line — by its words.
      const there = [...document.querySelectorAll('[data-jtk-path]')].filter((el) => el !== price && el.getAttribute('data-jtk-path') === at).map((el) => el.textContent?.trim() ?? '');
      return { key: variant?.key, priced: variant?.price !== undefined, text: price?.textContent?.trim() ?? '', at, there };
    }, form);
    if (priced.priced) {
      const ok = priced.at.endsWith(`variants[${priced.key}].price`) && priced.text !== '' && (priced.there.length === 0 || priced.there.includes(priced.text));
      found.push({ check: 'product: the price shown is the chosen variant\'s, annotated as its own', ok, said: `«${priced.text}» at ${priced.at || 'no annotation'}, the variant ${priced.key}${priced.there.length === 0 ? '' : `, drawn elsewhere as ${priced.there.map((one) => `«${one}»`).join(', ')}`}` });
    }
  }

  // Where that is a variant sold out: said in words beside each value, not only greyed, and Add held.
  const chosen = await page.evaluate((sel) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
    const stock = f.querySelector('[data-stock]');
    return {
      stock: stock?.textContent?.trim() ?? '',
      live: stock?.getAttribute('aria-live') ?? stock?.getAttribute('role') ?? '',
      held: /** @type {HTMLButtonElement | null} */ (f.querySelector('[data-add]'))?.disabled === true,
      values: [...f.querySelectorAll('input[type=radio]:checked')].map((el) => ({
        name: /** @type {HTMLInputElement} */ (el).name,
        state: /** @type {HTMLElement} */ (el).dataset.state ?? '',
        label: (/** @type {HTMLInputElement} */ (el).labels?.[0]?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    };
  }, form);
  if (chosen.stock === words.soldOut) {
    // A variant sold out is sold out by every value chosen: each of them is marked and says so.
    const out = chosen.values.filter((one) => one.state === 'sold_out' && one.label.includes(words.soldOut));
    const ok = chosen.held && chosen.values.length > 0 && out.length === chosen.values.length && /polite|assertive|status/.test(chosen.live);
    found.push({
      check: 'product: a variant sold out is said in words beside its values, not only greyed, and Add is held (1.4.1, 4.1.3)',
      ok,
      said: `stock «${chosen.stock}» (${chosen.live || 'not live'}), Add ${chosen.held ? 'held' : 'on'}, ${chosen.values.map((one) => `«${one.label}» ${one.state || 'unmarked'}`).join(', ') || 'no value chosen'}`,
    });
    states.push({ state: 'product: sold out', violations: await readAxe(page, axe, form) });
  }
  for (const [key, value] of Object.entries(first)) await page.locator(`${radios(key)}[value="${value}"]`).check();

  // A question it must have answered, left unanswered: said, tied to its field, the focus on it.
  const add = page.locator(`${form} [data-add]`);
  if (!(await add.isEnabled())) return { states, found };
  if (asked.length > 0) {
    await add.focus();
    await page.keyboard.press('Enter');
    const refused = await page.evaluate((sel) => {
      const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
      const error = /** @type {HTMLElement | null} */ (f.querySelector('[data-product-error]'));
      const field = /** @type {HTMLInputElement | null} */ (document.activeElement);
      const tied = (field?.getAttribute('aria-describedby') ?? '').split(/\s+/).some((id) => id && document.getElementById(id)?.textContent?.trim());
      const ok = Boolean(error && !error.hidden && error.getAttribute('role') === 'alert' && error.textContent?.trim() && field?.name?.startsWith('answer:') && field.getAttribute('aria-invalid') === 'true' && tied);
      return { ok, said: `alert «${error?.textContent?.trim() ?? ''}», focus on ${field?.name || field?.tagName.toLowerCase()}, aria-invalid=${field?.getAttribute('aria-invalid')}, described=${tied}` };
    }, form);
    found.push({ check: 'product: a question left unanswered is said, tied to its field, and focused (3.3.1, 4.1.3)', ...refused });
    states.push({ state: 'product: refused', violations: await readAxe(page, axe, form) });
    for (const one of asked) {
      const field = page.locator(`${form} [name="answer:${one.key}"]`);
      if (one.kind === 'choice') await field.selectOption({ index: 1 });
      else await field.fill('Ada');
    }
  }

  // Added: said as a status and focused, the line in the browser's cart, and jtk:cart heard.
  await page.evaluate(() => {
    /** @type {any} */ (window).jtkCartHeard = [];
    document.addEventListener('jtk:cart', (event) => /** @type {any} */ (window).jtkCartHeard.push(/** @type {CustomEvent} */ (event).detail));
  });
  await add.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector(`${form} [data-added]:not([hidden])`, { timeout: 5000 }).catch(() => undefined);
  const added = await page.evaluate(({ sel, key }) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
    const told = /** @type {HTMLElement | null} */ (f.querySelector('[data-added]'));
    let lines = [];
    try {
      lines = JSON.parse(localStorage.getItem(key) ?? '{}').lines ?? [];
    } catch {
      lines = [];
    }
    const kept = lines.some((line) => line.product === f.dataset.product);
    const heard = /** @type {any} */ (window).jtkCartHeard ?? [];
    const ok = Boolean(told && !told.hidden && told.textContent?.trim() && /status|polite/.test(told.getAttribute('role') ?? told.getAttribute('aria-live') ?? '') && told.contains(document.activeElement) && kept && heard.includes(key));
    return { ok, said: `«${told?.textContent?.trim() ?? ''}» ${told?.hidden ? 'hidden' : 'shown'}, role=${told?.getAttribute('role')}, focus on ${document.activeElement?.tagName.toLowerCase()}, in the cart ${kept}, jtk:cart ${JSON.stringify(heard)}` };
  }, { sel: form, key: `jtk:cart:${api}` });
  found.push({ check: 'product: «added» is said and takes the focus, the line is in the browser\'s cart and jtk:cart is heard (4.1.3)', ...added });
  states.push({ state: 'product: added', violations: await readAxe(page, axe, form) });

  // A browser that keeps no cart — site data blocked, as Safari or Chrome do when told to — is said, not silent.
  await page.evaluate(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('The site\'s data is blocked', 'SecurityError'); } });
  });
  await add.focus();
  await page.keyboard.press('Enter');
  const unkept = await page.evaluate(({ sel, word }) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
    const error = /** @type {HTMLElement | null} */ (f.querySelector('[data-product-error]'));
    const told = /** @type {HTMLElement | null} */ (f.querySelector('[data-added]'));
    const text = error?.textContent?.trim() ?? '';
    const ok = Boolean(error && !error.hidden && error.getAttribute('role') === 'alert' && text !== '' && (!word || text === word) && told?.hidden);
    return { ok, said: `alert «${text}» ${error?.hidden ? 'hidden' : 'shown'}, role=${error?.getAttribute('role')}, «added» ${told?.hidden ? 'hidden' : 'shown'}` };
  }, { sel: form, word: words.cartUnavailable });
  found.push({ check: 'product: a cart the browser cannot keep is said, not left silent (3.3.1, 4.1.3)', ...unkept });
  states.push({ state: 'product: no cart kept', violations: await readAxe(page, axe, form) });
  return { states, found };
}

/**
 * The cart's page, driven as a buyer drives it (jtakeit-core wiki/102 stage 9,
 * Ruling 195), in the buyer's order: the cart read — each line the shop's own
 * words and money; then each country by the keyboard, and the methods it is
 * offered; a method chosen, and the customs sentence said where the parcel
 * crosses the border and not for a pick-up; a quantity changed and priced
 * again; a line the shop refuses, said with its reason and taken out by the
 * keyboard, and the last one taken out, which leaves the cart empty; a shop
 * that cannot be asked; *To checkout*, which writes the country and the
 * method into the cart and says `jtk:to-checkout`; and a browser that keeps
 * no cart. axe reads each state.
 *
 * What the shop answers is asked of the shop again, by the walk itself, with
 * the cart as it is stored and the country as it is chosen — so what the page
 * draws is held to what the shop says, and a page that drew a line the shop
 * never priced, or priced nothing, is a finding. What the cart has not got —
 * a second country, a second method, a country that is abroad — is not
 * driven, and its check not said: a walk that must reach one says which
 * (test/a11y-shop.mjs). A cart found empty is the empty state alone, unless
 * `line` is given, which is written into it first.
 * @param {import('playwright-core').Page} page
 * @param {string} axe
 * @param {{ line?: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> } }} [options]
 */
async function driveCart(page, axe, options = {}) {
  const states = [];
  const found = [];
  const root = '[data-cart]';
  const { api, locale, words } = await page.evaluate((sel) => {
    const el = /** @type {HTMLElement} */ (document.querySelector(sel));
    return { api: el.dataset.api ?? '/api/', locale: el.dataset.locale ?? 'en', words: JSON.parse(el.dataset.words ?? '{}') };
  }, root);
  const key = `jtk:cart:${api}`;
  const origin = new URL(page.url()).origin;
  /** The bodies of the shipping requests the page makes from here on. */
  const asked = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/shipping')) asked.push(JSON.parse(request.postData() ?? '{}'));
  });
  const settle = () => page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && el.getAttribute('data-state') !== 'pricing';
  }, root, { timeout: 5000 });
  const reload = async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await settle();
  };
  const stored = () => page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null');
    } catch {
      return null;
    }
  }, key);
  const put = (cart) => page.evaluate(({ k, value }) => localStorage.setItem(k, JSON.stringify(value)), { k: key, value: cart });
  /** What the shop answers to a body, asked by the walk (`x-jtk-walk`), never by the page. */
  const shop = async (body) => {
    const answer = await fetch(`${origin}${api}shipping`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-jtk-shop': '1', 'x-jtk-walk': '1' }, body: JSON.stringify(body) });
    return answer.status === 200 ? answer.json() : null;
  };
  const same = (a, b) => String(a ?? '').replace(/\s+/g, ' ').trim() === String(b ?? '').replace(/\s+/g, ' ').trim();
  /** What the cart draws now, as data. */
  const read = () => page.evaluate((sel) => {
    const r = /** @type {HTMLElement} */ (document.querySelector(sel));
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length > 0);
    const at = document.activeElement;
    const row = at?.closest?.('[data-cart-line]');
    const country = /** @type {HTMLSelectElement | null} */ (r.querySelector('[name=country]'));
    const error = r.querySelector('[data-cart-error]');
    const to = /** @type {HTMLButtonElement | null} */ (r.querySelector('[data-to-checkout]'));
    return {
      state: r.dataset.state ?? '',
      rows: [...r.querySelectorAll('[data-cart-line]')].map((one) => {
        const qty = /** @type {HTMLInputElement | null} */ (one.querySelector('[data-line-qty]'));
        const remove = one.querySelector('[data-line-remove]');
        const why = one.querySelector('[data-line-refused]');
        return {
          line: Number(/** @type {HTMLElement} */ (one).dataset.line), state: /** @type {HTMLElement} */ (one).dataset.state ?? '',
          title: text(one.querySelector('[data-line-title]')), labels: text(one.querySelector('[data-line-labels]')), total: text(one.querySelector('[data-line-total]')),
          qty: qty?.value ?? '', refused: text(why), why: why?.id ?? '',
          qtyDescribed: qty?.getAttribute('aria-describedby') ?? '', removeDescribed: remove?.getAttribute('aria-describedby') ?? '',
        };
      }),
      subtotal: text(r.querySelector('[data-subtotal]')), subtotalShown: shown(r.querySelector('[data-subtotal]')),
      country: country?.value ?? '', countries: [...(country?.options ?? [])].map((one) => one.value),
      methods: [...r.querySelectorAll('[name=method]')].map((one) => ({ value: /** @type {HTMLInputElement} */ (one).value, checked: /** @type {HTMLInputElement} */ (one).checked, label: text(one.closest('label')) })),
      abroad: { shown: shown(r.querySelector('[data-abroad]')), text: text(r.querySelector('[data-abroad]')), role: r.querySelector('[data-abroad]')?.getAttribute('role') ?? '' },
      error: { shown: shown(error), text: text(error), role: error?.getAttribute('role') ?? '' },
      empty: { shown: shown(r.querySelector('[data-cart-empty]')), text: text(r.querySelector('[data-cart-empty]')) },
      held: to?.disabled === true,
      focus: {
        country: at === country, method: at instanceof HTMLInputElement && at.name === 'method' ? at.value : null,
        qty: row && at?.matches('[data-line-qty]') ? Number(/** @type {HTMLElement} */ (row).dataset.line) : null,
        remove: row && at?.matches('[data-line-remove]') ? Number(/** @type {HTMLElement} */ (row).dataset.line) : null,
        empty: at === r.querySelector('[data-cart-empty]'), checkout: at === to,
      },
    };
  }, root);
  const axeNow = async (state) => states.push({ state, violations: await readAxe(page, axe, root) });

  await settle();
  let cart = await stored();
  let now = await read();

  // A cart with no line: said, nothing drawn of it, nothing to go on with.
  if (!cart?.lines?.length) {
    found.push({
      check: 'cart: a cart with no line says so, draws nothing of it and holds To checkout (4.1.3)',
      ok: now.state === 'empty' && now.empty.shown && now.empty.text !== '' && now.rows.length === 0 && now.held && !now.subtotalShown,
      said: `state ${now.state}, «${now.empty.text}» ${now.empty.shown ? 'shown' : 'hidden'}, ${now.rows.length} row(s), To checkout ${now.held ? 'held' : 'on'}`,
    });
    await axeNow('cart: empty');
    if (options.line === undefined) return { states, found };
    await put({ v: 1, lines: [options.line], country: '', method: '' });
    await reload();
    cart = await stored();
    now = await read();
  }
  const lines = cart.lines;
  await axeNow('cart: drawn');

  // Each line is the shop's own words and money: the cart keeps no title and no price, so a title on the page was asked of the shop.
  const body = { lines, country: now.country, locale };
  const answer = await shop(body);
  const priced = answer !== null && now.rows.length === lines.length && answer.lines.length === lines.length;
  const wrong = [];
  if (priced) {
    now.rows.forEach((row, i) => {
      const one = answer.lines[i];
      if (!same(row.title, one.title) || !same(row.total, money(one.total, answer.currency, locale)) || !same(row.labels, one.labels.join(' · '))) wrong.push(`line ${i}: «${row.title}» ${row.total} ≠ «${one.title}» ${money(one.total, answer.currency, locale)}`);
    });
    if (!same(now.subtotal, money(answer.subtotal, answer.currency, locale))) wrong.push(`subtotal ${now.subtotal} ≠ ${money(answer.subtotal, answer.currency, locale)}`);
  }
  if (answer !== null && answer.lines.length > 0) {
    found.push({
      check: 'cart: every line is the shop\'s own — its title, its labels and its total in the site\'s money — and the subtotal is theirs (4.1.3)',
      ok: priced && wrong.length === 0,
      said: !priced ? `${now.rows.length} row(s) for ${lines.length} line(s), the shop priced ${answer.lines.length}` : wrong.length > 0 ? wrong.join('; ') : `${now.rows.map((row) => `«${row.title}» ${row.total}`).join(', ')}; subtotal ${now.subtotal}`,
    });
  }

  // A line added on a page in another language is titled as the shop titles it in this page's: the cart keeps no title.
  if (answer !== null) {
    const own = await shop({ ...body, locale: undefined });
    const differing = answer.lines.map((one, i) => ({ i, one, own: own?.lines?.[i] })).filter((each) => each.own !== undefined && each.one.title !== each.own.title);
    if (differing.length > 0) {
      const wronglyTitled = differing.filter((each) => !same(now.rows[each.i]?.title, each.one.title));
      found.push({
        check: 'cart: a line added on a page in another language is titled in this page\'s language, the shop\'s own words for it',
        ok: wronglyTitled.length === 0,
        said: differing.map((each) => `«${now.rows[each.i]?.title}» (the site's own: «${each.own.title}»)`).join(', '),
      });
    }
  }

  // Each country by the keyboard, from a cart nothing is chosen in — a cart the walk read on another page has the country and the method
  // the buyer left in it: the first country, the first method of each.
  if (cart.country !== '' || cart.method !== '') {
    await put({ ...cart, country: '', method: '' });
    await reload();
    now = await read();
  }
  // The one priced, the methods it is offered the shop's, one of them chosen, the focus kept.
  const countries = now.countries;
  const steps = [];
  /** What the customs sentence said where the parcel crosses the border: for a pick-up, and for a parcel. */
  const customs = { pickup: undefined, parcel: undefined };
  if (countries.length > 1) {
    await page.focus(`${root} [name=country]`);
    for (let i = 1; i < countries.length; i += 1) {
      const before = asked.length;
      await page.keyboard.press('ArrowDown');
      await settle();
      const s = await read();
      const sent = asked.at(-1);
      const theirs = await shop({ lines, country: countries[i], locale });
      const methods = theirs?.methods ?? [];
      const chosen = s.methods.filter((one) => one.checked);
      const ok = s.country === countries[i] && asked.length === before + 1 && sent?.country === countries[i] && sent?.locale === locale
        && JSON.stringify(s.methods.map((one) => one.value)) === JSON.stringify(methods.map((one) => one.method)) && s.methods.every((one, at) => one.label.startsWith(methods[at].name) && (methods[at].price === 0 || same(one.label, `${methods[at].name} ${money(methods[at].price, theirs.currency, locale)}`)))
        && chosen.length === 1 && s.focus.country;
      steps.push({ ok, said: `${countries[i]}: asked ${asked.length - before}× for «${sent?.country}», offered ${s.methods.map((one) => one.value + (one.checked ? '*' : '')).join(', ') || 'none'} (the shop: ${methods.map((one) => one.method).join(', ') || 'none'}), focus ${s.focus.country ? 'on the country' : 'lost'}` });
      const pick = chosen[0] === undefined ? undefined : methods.find((one) => one.method === chosen[0].value);
      if (theirs?.abroad === true && pick?.pickup === true) customs.pickup = { ok: !s.abroad.shown, said: `${countries[i]} is abroad, «${pick.method}» is a pick-up, the sentence is ${s.abroad.shown ? 'said' : 'not said'}` };
    }
    found.push({ check: 'cart: a country chosen by the keyboard is the one priced, and the methods it is offered are the shop\'s (2.1.1, 3.3.2)', ok: steps.every((one) => one.ok), said: steps.map((one) => one.said).join('; ') });
  }

  // A method by the keyboard: the radio chosen keeps the focus and is the one kept for the checkout.
  now = await read();
  if (now.methods.length > 1) {
    const checked = now.methods.find((one) => one.checked);
    await page.focus(`${root} [name=method]:checked`);
    await page.keyboard.press('ArrowDown');
    const s = await read();
    const kept = (await stored())?.method;
    const next = s.methods.find((one) => one.checked);
    found.push({
      check: 'cart: a method chosen by the keyboard keeps the focus on it and is kept for the checkout (2.1.1, 2.4.3)',
      ok: next !== undefined && next.value !== checked?.value && s.focus.method === next.value && kept === next.value,
      said: `${checked?.value} → ${next?.value}, focus on ${s.focus.method ?? 'something else'}, kept «${kept}»`,
    });
    const theirs = await shop({ lines, country: s.country, locale });
    const pick = theirs?.methods?.find((one) => one.method === next?.value);
    if (theirs?.abroad === true && pick?.pickup === false) customs.parcel = { ok: s.abroad.shown && s.abroad.text !== '' && (!words.customs || same(s.abroad.text, words.customs)) && s.abroad.role === 'status', said: `${s.country} is abroad, «${pick.method}» is a parcel, the sentence is ${s.abroad.shown ? `«${s.abroad.text}» (${s.abroad.role || 'no role'})` : 'not said'}` };
    await axeNow('cart: country and method chosen');
  }
  if (customs.pickup !== undefined && customs.parcel !== undefined) {
    found.push({ check: 'cart: the customs sentence is said for a parcel that crosses the border, and not for a pick-up (3.3.2, 4.1.3)', ok: customs.pickup.ok && customs.parcel.ok, said: `${customs.pickup.said}; ${customs.parcel.said}` });
  }

  // A quantity by the keyboard: priced again, the cart kept, the focus on its box.
  now = await read();
  if (now.rows.length > 0 && now.rows[0].state === 'priced') {
    const before = asked.length;
    const was = Number(now.rows[0].qty);
    await page.focus(`${root} [data-cart-line][data-line="0"] [data-line-qty]`);
    await page.keyboard.press('ArrowUp');
    await settle();
    const s = await read();
    const kept = await stored();
    const theirs = await shop({ lines: kept.lines, country: s.country, locale });
    const sent = asked.at(-1);
    const ok = asked.length === before + 1 && sent?.lines?.[0]?.qty === was + 1 && kept.lines[0].qty === was + 1 && s.rows[0]?.qty === String(was + 1)
      && theirs !== null && same(s.rows[0].total, money(theirs.lines[0].total, theirs.currency, locale)) && same(s.subtotal, money(theirs.subtotal, theirs.currency, locale)) && s.focus.qty === 0;
    found.push({
      check: 'cart: a quantity changed by the keyboard is priced again, and the focus stays on its box (2.4.3, 4.1.3)',
      ok,
      said: `${was} → ${s.rows[0]?.qty}, asked ${asked.length - before}×, kept ${kept.lines[0].qty}, total ${s.rows[0]?.total}, subtotal ${s.subtotal}, focus ${s.focus.qty === 0 ? 'on its box' : 'lost'}`,
    });
    await axeNow('cart: quantity changed');
  }

  // A line the shop refuses — one it has no variant for — after the others: said with its reason, tied to its row, and the way on held;
  // taken out by the keyboard, the focus goes on to the line before it, which is now the last.
  const saved = await stored();
  const gone = { ...saved.lines[0], variant: 'jtk-a11y-gone' };
  const last = saved.lines.length;
  await put({ ...saved, lines: [...saved.lines, gone] });
  await reload();
  now = await read();
  const refusedRow = now.rows[last];
  found.push({
    check: 'cart: a line the shop refuses is said with its reason, tied to its row, and To checkout is held (3.3.1, 4.1.3)',
    ok: now.rows.length === last + 1 && refusedRow?.state === 'refused' && refusedRow.refused !== '' && (!words['refused.not_sold'] || same(refusedRow.refused, words['refused.not_sold']))
      && refusedRow.why !== '' && refusedRow.qtyDescribed === refusedRow.why && refusedRow.removeDescribed === refusedRow.why
      && now.error.shown && now.error.role === 'alert' && now.error.text !== '' && now.held
      && now.rows.slice(0, last).every((row) => row.state === 'priced' && row.total !== ''),
    said: `«${refusedRow?.refused}» (${refusedRow?.state}), described ${refusedRow?.qtyDescribed === refusedRow?.why && refusedRow?.why !== ''}, alert «${now.error.text}» ${now.error.shown ? 'shown' : 'hidden'} (${now.error.role || 'no role'}), To checkout ${now.held ? 'held' : 'on'}, the other ${last} line(s) ${now.rows.slice(0, last).map((row) => row.state).join('/')}`,
  });
  await axeNow('cart: a line refused');
  await page.focus(`${root} [data-cart-line][data-line="${last}"] [data-line-remove]`);
  await page.keyboard.press('Enter');
  await settle();
  now = await read();
  const left = await stored();
  found.push({
    check: 'cart: a line taken out by the keyboard is gone from the cart, and the focus goes on to the line before it (2.4.3, 4.1.3)',
    ok: left.lines.length === last && !left.lines.some((one) => one.variant === 'jtk-a11y-gone') && now.rows.length === last && now.rows.every((row) => row.state === 'priced')
      && !now.error.shown && !now.held && now.focus.remove === last - 1,
    said: `${now.rows.length} row(s) of ${last + 1}, the cart keeps ${left.lines.length}, alert ${now.error.shown ? 'still shown' : 'gone'}, To checkout ${now.held ? 'held' : 'on'}, focus ${now.focus.remove === last - 1 ? 'on the line before\'s button' : 'lost'}`,
  });

  // The last line taken out: the cart is empty, said, and the focus goes to what says so.
  await put({ ...saved, lines: [gone] });
  await reload();
  const alone = await read();
  await page.focus(`${root} [data-cart-line][data-line="0"] [data-line-remove]`);
  await page.keyboard.press('Enter');
  await settle();
  now = await read();
  found.push({
    check: 'cart: the last line taken out leaves the cart empty, said, and the focus goes to what says so (2.4.3, 4.1.3)',
    ok: alone.rows.length === 1 && alone.rows[0].state === 'refused' && alone.methods.length === 0 && (await stored()).lines.length === 0
      && now.state === 'empty' && now.rows.length === 0 && now.empty.shown && now.empty.text !== '' && (!words.cartEmpty || same(now.empty.text, words.cartEmpty)) && now.focus.empty && now.held && !now.subtotalShown,
    said: `one refused line, ${alone.methods.length} method(s) offered; then state ${now.state}, «${now.empty.text}» ${now.empty.shown ? 'shown' : 'hidden'}, focus ${now.focus.empty ? 'on it' : 'lost'}, To checkout ${now.held ? 'held' : 'on'}`,
  });
  await axeNow('cart: emptied');

  // The shop cannot be asked — the network gone, or the shop down: said, nothing drawn that the shop did not say, the way on held.
  await put(saved);
  await page.route('**/shipping', (route) => route.abort());
  await reload();
  now = await read();
  await page.unroute('**/shipping');
  found.push({
    check: 'cart: a cart the shop cannot be asked about says so, draws nothing it did not say and holds To checkout (3.3.1, 4.1.3)',
    ok: now.state === 'failed' && now.error.shown && now.error.role === 'alert' && now.error.text !== '' && (!words.cartFailed || same(now.error.text, words.cartFailed)) && now.rows.length === 0 && now.methods.length === 0 && now.held && !now.subtotalShown,
    said: `state ${now.state}, alert «${now.error.text}» ${now.error.shown ? 'shown' : 'hidden'} (${now.error.role || 'no role'}), ${now.rows.length} row(s), To checkout ${now.held ? 'held' : 'on'}`,
  });
  await axeNow('cart: not priced');

  // *To checkout*: the country and the method written into the cart — cleared from the browser's storage first, so only the press can have
  // written them — and `jtk:to-checkout` said, with the cart's key and nothing else.
  await put(saved);
  await reload();
  now = await read();
  if (!now.held) {
    const chosen = now.methods.find((one) => one.checked);
    await put({ ...saved, country: '', method: '' });
    await page.evaluate(() => {
      /** @type {any} */ (window).jtkToCheckout = [];
      document.addEventListener('jtk:to-checkout', (event) => /** @type {any} */ (window).jtkToCheckout.push({ detail: /** @type {CustomEvent} */ (event).detail }));
    });
    await page.focus(`${root} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    const heard = await page.evaluate(() => /** @type {any} */ (window).jtkToCheckout);
    const kept = await stored();
    found.push({
      check: 'cart: To checkout writes the country and the method into the cart and says jtk:to-checkout, and passes no quote (Ruling 200)',
      ok: heard.length === 1 && heard[0].detail === key && kept?.country === now.country && now.country !== '' && chosen !== undefined && kept?.method === chosen.value
        && JSON.stringify(Object.keys(kept ?? {}).sort()) === JSON.stringify(['country', 'lines', 'method', 'v']) && JSON.stringify(kept.lines) === JSON.stringify(saved.lines),
      said: `heard ${JSON.stringify(heard)}, the cart keeps country «${kept?.country}» and method «${kept?.method}» (chosen: ${now.country}, ${chosen?.value}), keys ${Object.keys(kept ?? {}).join(', ')}`,
    });
    await axeNow('cart: to checkout');

    // A browser that keeps no cart — site data blocked — is told, and nothing is handed on; and told as the page opens.
    await page.evaluate(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('The site\'s data is blocked', 'SecurityError'); } });
    });
    await page.focus(`${root} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    const after = await read();
    const heardAgain = await page.evaluate(() => /** @type {any} */ (window).jtkToCheckout.length);
    found.push({
      check: 'cart: a cart the browser cannot keep is said, and nothing is handed on (3.3.1, 4.1.3)',
      ok: after.error.shown && after.error.role === 'alert' && after.error.text !== '' && (!words.cartUnavailable || same(after.error.text, words.cartUnavailable)) && heardAgain === 1,
      said: `alert «${after.error.text}» ${after.error.shown ? 'shown' : 'hidden'} (${after.error.role || 'no role'}), jtk:to-checkout heard ${heardAgain}× in all`,
    });
    await axeNow('cart: no cart kept');
  }
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('The site\'s data is blocked', 'SecurityError'); } });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await settle();
  now = await read();
  found.push({
    check: 'cart: a browser that keeps no cart says so when the page opens, and holds To checkout (3.3.1, 4.1.3)',
    ok: now.error.shown && now.error.role === 'alert' && now.error.text !== '' && (!words.cartUnavailable || same(now.error.text, words.cartUnavailable)) && now.held,
    said: `state ${now.state}, alert «${now.error.text}» ${now.error.shown ? 'shown' : 'hidden'}, To checkout ${now.held ? 'held' : 'on'}`,
  });
  return { states, found };
}

/**
 * @typedef {object} PageResult
 * @property {string} path
 * @property {string} scheme
 * @property {{ state: string; violations: any[] }[]} states
 * @property {{ check: string; ok: boolean; said?: string }[]} found
 */

/**
 * Reads every page — or the pages given, in the order given: a shop's in a
 * buyer's, so what the product page put in the cart is in it when the cart's
 * page is read. The site's files are at `from` (the current directory by
 * default), where `devShop` reads the shop; `soldOut` names the SKUs it
 * answers sold out; `cart.line` is the line a cart's drive writes into a cart
 * it finds empty, which a walk in a buyer's order never does.
 * @param {{ dist: string; pages?: string[]; schemes?: string[]; stops?: number; from?: string; soldOut?: string[]; cart?: { line: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> } }; log?: (line: string) => void }} options
 * @returns {Promise<PageResult[]>}
 */
export async function audit(options) {
  const dist = resolve(options.dist);
  if (!existsSync(dist)) throw new Error(`no ${dist} — build the site first`);
  const pages = options.pages?.length ? options.pages : pagesOf(dist);
  const log = options.log ?? (() => undefined);
  const from = resolve(options.from ?? process.cwd());
  const { chromium, axe } = await tools(from);
  // A site whose stylesheets never ask for a scheme looks the same in both:
  // read once, and say so, rather than twice for the same answer.
  const css = readdirSync(dist, { recursive: true }).filter((f) => String(f).endsWith('.css')).map((f) => readFileSync(join(dist, String(f)), 'utf8')).join('\n');
  const html = pages.map((p) => { try { return readFileSync(join(dist, p, 'index.html'), 'utf8'); } catch { return ''; } }).join('\n');
  const schemes = options.schemes ?? (/prefers-color-scheme/.test(css + html) ? ['light', 'dark'] : ['light']);

  const server = await serve(dist, { root: from, soldOut: options.soldOut });
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
        // From before the page loads: a piece of the shop asks as it is wired.
        const shopBefore = server.unnamedShop.length;
        const askedBefore = server.shopAsked.length;
        await page.goto(server.url + path, { waitUntil: 'networkidle' });
        const states = [{ state: 'page', violations: await readAxe(page, axe) }];
        const found = [...(await readKeyboard(page, options.stops ?? 40)), await readReflow(page)];
        if (await page.locator('form[data-lead-form]').count()) found.push(...(await driveLead(page)));
        if (await page.locator('form[data-booking]').count()) {
          const before = server.unnamed.length;
          const booking = await driveBooking(page, axe);
          states.push(...booking.states);
          found.push(...booking.found);
          // Not WCAG, and read on the same drive: a booking page that does not
          // say which protocol it speaks is one the platform cannot keep
          // answering through a change.
          const missed = server.unnamed.slice(before);
          found.push({ check: 'booking: every request names the protocol version (X-Jtk-Booking)', ok: missed.length === 0, said: missed.join(', ') });
        }
        // The shop's pieces, each driven where the page has its root hook.
        let shopped = false;
        if (await page.locator('form[data-product]').count()) {
          shopped = true;
          const product = await driveProduct(page, axe);
          states.push(...product.states);
          found.push(...product.found);
        }
        if (await page.locator('[data-cart]').count()) {
          shopped = true;
          const cart = await driveCart(page, axe, options.cart);
          states.push(...cart.states);
          found.push(...cart.found);
        }
        if (shopped) {
          // Not WCAG, as the booking form's: a page that does not say which shop protocol it speaks.
          // At least one: a piece that asked the shop nothing has not been driven, and names no version.
          const missed = server.unnamedShop.slice(shopBefore);
          const asked = server.shopAsked.length - askedBefore;
          found.push({ check: 'shop: every request names the protocol version (X-Jtk-Shop)', ok: asked > 0 && missed.length === 0, said: asked === 0 ? 'the page asked the shop nothing' : missed.join(', ') });
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
