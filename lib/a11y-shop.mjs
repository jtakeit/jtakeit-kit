/**
 * The shop's drives for `jtk a11y` (jtakeit-core wiki/102 stage 9, Ruling 195):
 * each piece of the storefront driven in a real Chrome as a buyer drives it,
 * with axe reading each state and the script holding what axe cannot — where
 * the focus went, what was said, what the shop was asked. `lib/a11y.mjs` has
 * the server, the booking's and the enquiry's drives and `audit`, which calls
 * these where a page has a piece's root hook; the shop's pieces are here so that
 * each new one is a function in this file and not a longer `audit`.
 *
 * A drive takes the page and `scan`, axe on the page as it is now or on the part
 * a selector names, and answers `{ states, found }`: the axe findings by state,
 * and the script's checks, each `{ check, ok, said }`. What a piece has not got
 * — an option, a second country, a variant sold out — is not driven, and its
 * check not said: a walk that must reach one says which (test/a11y-shop.mjs).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { money, priceWords } from '@jtakeit/kit/money';
import { shopWordsFor } from '@jtakeit/kit/shop/words';
import { ASKS_MOST, ASK_DEADLINE_MS, ASK_EVERY_MS, paidFromKey } from '@jtakeit/kit/shop/order';
import { STOCK_ASKS_MOST, STOCK_DEADLINE_MS } from '@jtakeit/kit/shop/listing';

/** Text as a reader has it, whitespace in a run and trimmed: what a check compares the words of a page by. */
const same = (a, b) => String(a ?? '').replace(/\s+/g, ' ').trim() === String(b ?? '').replace(/\s+/g, ' ').trim();

/** The cart a page's browser keeps under `key`, or `null` where there is none or the browser would not say. */
const storedCart = (page, key) => page.evaluate((k) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null');
  } catch {
    return null;
  }
}, key);

/** A cart written into the page's browser under `key`. */
const putCart = (page, key, cart) => page.evaluate(({ k, value }) => localStorage.setItem(k, JSON.stringify(value)), { k: key, value: cart });

/** The headers of a question the walk puts to the shop itself: it names the protocol, and is not the page's, so no count of the page's counts it. */
const WALK = { 'content-type': 'application/json', 'x-jtk-shop': '1', 'x-jtk-walk': '1' };

/** What the shop answers to a cart, asked by the walk (`x-jtk-walk`), never by the page: `null` for no answer. */
async function pricedBy(origin, api, body) {
  const answer = await fetch(`${origin}${api}shipping`, { method: 'POST', headers: WALK, body: JSON.stringify(body) });
  return answer.status === 200 ? answer.json() : null;
}

/** Time stops where it is, on a page whose clock is installed (`page.clock.install()`): nothing fires unless the walk runs the clock. */
async function pauseClock(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
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
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 */
export async function driveProduct(page, scan) {
  const states = [];
  const found = [];
  const form = 'form[data-product]';
  // Wired, and what is left read — or the read failed, which says nothing and leaves Add on.
  await page.waitForFunction((sel) => document.querySelector(sel)?.hasAttribute('data-stock-read'), form, { timeout: 5000 });
  states.push({ state: 'product: drawn', violations: await scan(form) });
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
    states.push({ state: 'product: chosen by the keyboard', violations: await scan(form) });
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
    states.push({ state: 'product: sold out', violations: await scan(form) });
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
    states.push({ state: 'product: refused', violations: await scan(form) });
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
  states.push({ state: 'product: added', violations: await scan(form) });

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
    const ok = Boolean(error && !error.hidden && error.getAttribute('role') === 'alert' && text !== '' && text === word && told?.hidden);
    return { ok, said: `alert «${text}» ${error?.hidden ? 'hidden' : 'shown'}, role=${error?.getAttribute('role')}, «added» ${told?.hidden ? 'hidden' : 'shown'}` };
  }, { sel: form, word: words.cartUnavailable });
  found.push({ check: 'product: a cart the browser cannot keep is said, not left silent (3.3.1, 4.1.3)', ...unkept });
  states.push({ state: 'product: no cart kept', violations: await scan(form) });
  return { states, found };
}

/**
 * The cart's page, driven as a buyer drives it (jtakeit-core wiki/102 stage 9,
 * Ruling 195), in the buyer's order: the cart read — each line the shop's own
 * words and money; then each country by the keyboard, and the methods it is
 * offered; a method chosen, and the customs sentence said where the parcel
 * crosses the border and not for a pick-up; a quantity changed and priced
 * again; a line the shop refuses, said with its reason and taken out by the
 * keyboard, two of them told apart by their place, and the last one taken
 * out, which leaves the cart empty; a quantity and removals made while the
 * shop is still answering; the first ask not yet answered; a shop that cannot
 * be asked, after it has priced the cart and at the first ask, and the button
 * that asks again; *To checkout*, which writes the country and the method
 * into the cart and says `jtk:to-checkout`; and a browser that keeps no cart.
 * axe reads each state.
 *
 * What the shop answers is asked of the shop again, by the walk itself, with
 * the cart as it is stored and the country as it is chosen — so what the page
 * draws is held to what the shop says, and a page that drew a line the shop
 * never priced, or priced nothing, is a finding. What the cart has not got —
 * a second country, a second method, a country that is abroad — is not
 * driven, and its check not said: a walk that must reach one says which
 * (test/a11y-shop.mjs). A cart found empty is the empty state alone — said
 * `quiet`, for it asks the shop nothing, and `audit` does not demand a request
 * of it — unless `line` is given, which is written into it first; `second`, a
 * second variant of the same product, is what two variants named apart are
 * walked with.
 * @param {import('playwright-core').Page} page
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 * @param {{ line?: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> }; second?: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> } }} [options]
 */
export async function driveCart(page, scan, options = {}) {
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
  const stored = () => storedCart(page, key);
  const put = (cart) => putCart(page, key, cart);
  const shop = (body) => pricedBy(origin, api, body);
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
          title: text(one.querySelector('[data-line-title]')), place: text(one.querySelector('[data-line-place]')), labels: text(one.querySelector('[data-line-labels]')), total: text(one.querySelector('[data-line-total]')),
          qty: qty?.value ?? '', refused: text(why), why: why?.id ?? '',
          qtyDescribed: qty?.getAttribute('aria-describedby') ?? '', removeDescribed: remove?.getAttribute('aria-describedby') ?? '',
          qtyName: qty?.getAttribute('aria-label') ?? '', removeName: remove?.getAttribute('aria-label') ?? '',
        };
      }),
      subtotal: text(r.querySelector('[data-subtotal]')),
      busy: r.hasAttribute('aria-busy'),
      pricing: text(r.querySelector('[data-cart-pricing]')),
      // The sentence that the shop is being asked sits in the list as one of its items, not beside them.
      pricingInList: (() => {
        const note = r.querySelector('[data-cart-pricing]');
        const list = r.querySelector('[data-cart-lines]');
        return Boolean(note && list && note.parentElement === list && (!/^(UL|OL)$/.test(list.tagName) || note.tagName === 'LI'));
      })(),
      retry: { shown: shown(r.querySelector('[data-cart-retry]')), text: text(r.querySelector('[data-cart-retry]')) },
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
  const axeNow = async (state) => states.push({ state, violations: await scan(root) });

  await settle();
  let cart = await stored();
  let now = await read();

  // A cart with no line: said, nothing drawn of it, nothing to go on with.
  if (!cart?.lines?.length) {
    found.push({
      check: 'cart: a cart with no line says so, draws nothing of it and holds To checkout (4.1.3)',
      ok: now.state === 'empty' && now.empty.shown && same(now.empty.text, words.cartEmpty) && now.rows.length === 0 && now.subtotal === '' && now.held,
      said: `state ${now.state}, «${now.empty.text}» ${now.empty.shown ? 'shown' : 'hidden'}, ${now.rows.length} row(s), subtotal «${now.subtotal}», To checkout ${now.held ? 'held' : 'on'}`,
    });
    await axeNow('cart: empty');
    // No line to put in it — no product page read, or a product the walk cannot answer — and nothing to ask the shop: said, and held to this.
    if (options.line === undefined) return { states, found, quiet: true };
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
    if (theirs?.abroad === true && pick?.pickup === false) customs.parcel = { ok: s.abroad.shown && same(s.abroad.text, words.customs) && s.abroad.role === 'status', said: `${s.country} is abroad, «${pick.method}» is a parcel, the sentence is ${s.abroad.shown ? `«${s.abroad.text}» (${s.abroad.role || 'no role'})` : 'not said'}` };
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

  // A quantity changed again and again while the shop is still answering: every press is kept, the shop is asked after each, and the
  // newest answer is what is shown — the keyboard's repeated arrow and the spinner's clicks are never dropped.
  now = await read();
  if (now.rows.length > 0 && now.rows[0].state === 'priced') {
    const slow = async (route) => {
      await new Promise((done) => setTimeout(done, 300));
      await route.continue();
    };
    await page.route('**/shipping', slow);
    const before = asked.length;
    const was = Number(now.rows[0].qty);
    await page.focus(`${root} [data-cart-line][data-line="0"] [data-line-qty]`);
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowUp');
    await settle();
    await page.unroute('**/shipping', slow);
    const s = await read();
    const kept = await stored();
    const theirs = await shop({ lines: kept.lines, country: s.country, locale });
    found.push({
      check: 'cart: a quantity changed while the shop is still answering is kept, and the newest answer is what is shown (2.1.1, 4.1.3)',
      ok: kept.lines[0].qty === was + 3 && s.rows[0]?.qty === String(was + 3) && asked.length === before + 3 && asked.at(-1)?.lines?.[0]?.qty === was + 3
        && theirs !== null && same(s.rows[0].total, money(theirs.lines[0].total, theirs.currency, locale)) && same(s.subtotal, money(theirs.subtotal, theirs.currency, locale)) && s.focus.qty === 0,
      said: `${was} → ${s.rows[0]?.qty} by three presses, kept ${kept.lines[0].qty}, asked ${asked.length - before}×, total ${s.rows[0]?.total}, subtotal ${s.subtotal}, focus ${s.focus.qty === 0 ? 'on its box' : 'lost'}`,
    });
  }

  // Two lines the shop refuses — ones it has no variant for, the very same twice — after the others: said with their reason, tied to
  // their rows, the way on held; and told apart by their place, which is all that differs: a line the cart keeps no title for has none.
  const saved = await stored();
  const gone = { ...saved.lines[0], variant: 'jtk-a11y-gone' };
  const last = saved.lines.length;
  await put({ ...saved, lines: [...saved.lines, gone, gone] });
  await reload();
  now = await read();
  const [first, second] = [now.rows[last], now.rows[last + 1]];
  const refusedOk = (row) => row?.state === 'refused' && same(row.refused, words['refused.not_sold']) && row.why !== '' && row.qtyDescribed === row.why && row.removeDescribed === row.why;
  found.push({
    check: 'cart: a line the shop refuses is said with its reason, tied to its row, and To checkout is held (3.3.1, 4.1.3)',
    ok: now.rows.length === last + 2 && refusedOk(first) && refusedOk(second) && now.error.shown && now.error.role === 'alert' && now.error.text !== '' && now.held
      && now.rows.slice(0, last).every((row) => row.state === 'priced' && row.total !== ''),
    said: `«${first?.refused}» ×${now.rows.slice(last).filter((row) => row.state === 'refused').length}, described ${refusedOk(first) && refusedOk(second)}, alert «${now.error.text}» ${now.error.shown ? 'shown' : 'hidden'} (${now.error.role || 'no role'}), To checkout ${now.held ? 'held' : 'on'}, the other ${last} line(s) ${now.rows.slice(0, last).map((row) => row.state).join('/')}`,
  });
  const tree = async (at) => page.locator(`${root} [data-cart-line][data-line="${at}"]`).ariaSnapshot();
  const [treeOfFirst, treeOfSecond] = [await tree(last), await tree(last + 1)];
  const placed = (row, at) => row !== undefined && same(row.place, words.itemNumber.replace('{n}', () => String(at + 1))) && row.qtyName.includes(row.place) && row.removeName.includes(row.place);
  found.push({
    check: 'cart: two lines the shop refuses are told apart — each says its place, its box and its button are named by it, and the accessibility tree of the one is not the other\'s (1.3.1, 2.4.6, 4.1.2)',
    ok: placed(first, last) && placed(second, last + 1) && first.qtyName !== second.qtyName && first.removeName !== second.removeName
      && treeOfFirst !== treeOfSecond && treeOfFirst.includes(first.place) && treeOfSecond.includes(second.place),
    said: `«${first?.place}» and «${second?.place}»; boxes «${first?.qtyName}» / «${second?.qtyName}»; buttons «${first?.removeName}» / «${second?.removeName}»; the trees ${treeOfFirst === treeOfSecond ? 'are the same' : 'differ'}`,
  });
  await axeNow('cart: a line refused');

  // Taken out by the keyboard, the last of them first: the focus goes on to the line before it, which is now the last — here the other
  // refused one — and from it, to the line before that.
  await page.focus(`${root} [data-cart-line][data-line="${last + 1}"] [data-line-remove]`);
  await page.keyboard.press('Enter');
  await settle();
  const middle = await read();
  await page.keyboard.press('Enter');
  await settle();
  now = await read();
  const left = await stored();
  found.push({
    check: 'cart: a line taken out by the keyboard is gone from the cart, and the focus goes on to the line before it (2.4.3, 4.1.3)',
    ok: middle.rows.length === last + 1 && middle.focus.remove === last && left.lines.length === last && !left.lines.some((one) => one.variant === 'jtk-a11y-gone')
      && now.rows.length === last && now.rows.every((row) => row.state === 'priced') && !now.error.shown && !now.held && now.focus.remove === last - 1,
    said: `${middle.rows.length} row(s) after the first, focus on ${middle.focus.remove === last ? 'the line before\'s button' : 'nothing of the cart\'s'}; ${now.rows.length} of ${last + 2} after the second, the cart keeps ${left.lines.length}, alert ${now.error.shown ? 'still shown' : 'gone'}, To checkout ${now.held ? 'held' : 'on'}, focus ${now.focus.remove === last - 1 ? 'on the line before\'s button' : 'lost'}`,
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
      && now.state === 'empty' && now.rows.length === 0 && now.empty.shown && same(now.empty.text, words.cartEmpty) && now.subtotal === '' && now.focus.empty && now.held,
    said: `one refused line, ${alone.methods.length} method(s) offered; then state ${now.state}, «${now.empty.text}» ${now.empty.shown ? 'shown' : 'hidden'}, subtotal «${now.subtotal}», focus ${now.focus.empty ? 'on it' : 'lost'}, To checkout ${now.held ? 'held' : 'on'}`,
  });
  await axeNow('cart: emptied');

  // Two variants of one product: the box and the button of each are named by the title and its own labels — «Fox T-shirt, S, Red» —
  // and where two rows would still be named the same, the very same line twice, the place is added as well.
  if (options.line !== undefined && options.second !== undefined) {
    const nameOf = (one, at, many) => {
      const base = [one.title, ...one.labels].filter((each) => each !== '').join(', ');
      return many ? `${base}, ${words.itemNumber.replace('{n}', () => String(at + 1))}` : base;
    };
    const named = async (cart, many) => {
      await put({ v: 1, lines: cart, country: '', method: '' });
      await reload();
      const s = await read();
      const theirs = await shop({ lines: cart, country: s.country, locale });
      const expected = theirs?.lines?.map((one, at) => nameOf(one, at, many)) ?? [];
      return {
        s, expected,
        ok: theirs !== null && s.rows.length === cart.length && expected.length === cart.length
          && s.rows.every((row, at) => row.state === 'priced' && row.removeName === words.removeNamed.replace('{title}', () => expected[at]) && row.qtyName === `${words.quantity}: ${expected[at]}`)
          && new Set(s.rows.map((row) => row.removeName)).size === cart.length && new Set(s.rows.map((row) => row.qtyName)).size === cart.length,
        said: s.rows.map((row) => `«${row.removeName}»`).join(' / '),
      };
    };
    const variants = await named([options.line, options.second], false);
    const alike = await named([options.line, options.line], true);
    found.push({
      check: 'cart: two variants of one product are named apart — the box and the button of each carry the title and its labels, and the very same line twice, the place as well (2.4.6, 4.1.2)',
      ok: variants.ok && alike.ok,
      said: `two variants: ${variants.said}; the same line twice: ${alike.said}`,
    });
    await axeNow('cart: two variants');
  }

  // Lines taken out while the shop is still answering: each is gone at once, the lines after it take its place, and the next press is on
  // the line it looks at — two presses of the same key take out two lines, whatever the shop's speed.
  await put(saved);
  await reload();
  now = await read();
  if (now.rows.length >= 3) {
    const n = now.rows.length;
    const slow = async (route) => {
      await new Promise((done) => setTimeout(done, 300));
      await route.continue();
    };
    await page.route('**/shipping', slow);
    await page.focus(`${root} [data-cart-line][data-line="${n - 1}"] [data-line-remove]`);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await settle();
    await page.unroute('**/shipping', slow);
    const s = await read();
    const kept = await stored();
    const theirs = await shop({ lines: kept.lines, country: s.country, locale });
    found.push({
      check: 'cart: a line taken out while the shop is still answering is gone at once, and the next press takes out the next (2.1.1, 2.4.3)',
      ok: kept.lines.length === n - 2 && JSON.stringify(kept.lines) === JSON.stringify(saved.lines.slice(0, n - 2)) && s.rows.length === n - 2
        && theirs !== null && same(s.subtotal, money(theirs.subtotal, theirs.currency, locale)) && s.focus.remove === n - 3,
      said: `${n} → ${s.rows.length} row(s), the cart keeps ${kept.lines.length} of ${n}, subtotal ${s.subtotal}, focus ${s.focus.remove === n - 3 ? 'on the line before\'s button' : 'lost'}`,
    });
  }

  // The first ask not yet answered: the cart says it is checking — in the list, as an item of it — and holds *To checkout*.
  await put(saved);
  let release = () => undefined;
  const slowest = new Promise((done) => { release = () => done(undefined); });
  const holdAll = async (route) => {
    await slowest;
    await route.continue();
  };
  await page.route('**/shipping', holdAll);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-state') === 'pricing', root, { timeout: 5000 });
  const waiting = await read();
  await axeNow('cart: pricing');
  release();
  await settle();
  await page.unroute('**/shipping', holdAll);
  found.push({
    check: 'cart: while the shop is being asked the cart says it is checking, in the list, and holds To checkout (1.3.1, 4.1.3)',
    ok: waiting.state === 'pricing' && waiting.busy && same(waiting.pricing, words.pricing) && waiting.pricingInList && waiting.rows.length === 0 && waiting.held,
    said: `state ${waiting.state}, «${waiting.pricing}» ${waiting.pricingInList ? 'in the list' : 'outside it'}, busy ${waiting.busy}, To checkout ${waiting.held ? 'held' : 'on'}`,
  });

  // The shop cannot be asked again — the network gone, or the shop down — after it has priced the cart: the rows stay as they were, held,
  // the change the buyer made is kept, it is said, and a button asks again.
  now = await read();
  if (now.rows.length > 0 && now.rows[0].state === 'priced') {
    const was = Number(now.rows[0].qty);
    await page.route('**/shipping', (route) => route.abort());
    await page.focus(`${root} [data-cart-line][data-line="0"] [data-line-qty]`);
    await page.keyboard.press('ArrowUp');
    await settle();
    const s = await read();
    const kept = await stored();
    found.push({
      check: 'cart: a shop that cannot be asked again leaves the rows as they were, holds To checkout, says so and offers to ask again (3.3.1, 4.1.3)',
      ok: s.state === 'stale' && s.rows.length === now.rows.length && s.rows.every((row) => row.state === 'priced' && row.total !== '') && s.subtotal !== '' && s.held
        && s.error.shown && s.error.role === 'alert' && same(s.error.text, words.cartFailed) && s.retry.shown && same(s.retry.text, words.tryAgain) && kept.lines[0].qty === was + 1,
      said: `state ${s.state}, ${s.rows.length} row(s) of ${now.rows.length}, subtotal «${s.subtotal}», To checkout ${s.held ? 'held' : 'on'}, alert «${s.error.text}» ${s.error.shown ? 'shown' : 'hidden'}, «${s.retry.text}» ${s.retry.shown ? 'offered' : 'not offered'}, the change kept ${kept.lines[0].qty === was + 1}`,
    });
    await axeNow('cart: not priced, the last rows kept');
    await page.unroute('**/shipping');
    await page.focus(`${root} [data-cart-retry]`);
    await page.keyboard.press('Enter');
    await settle();
    const again = await read();
    const theirs = await shop({ lines: kept.lines, country: again.country, locale });
    found.push({
      check: 'cart: the button that asks again prices the cart, and the focus goes on to its first box (2.1.1, 2.4.3)',
      ok: again.state === 'priced' && !again.error.shown && !again.retry.shown && !again.held && theirs !== null && same(again.rows[0].total, money(theirs.lines[0].total, theirs.currency, locale)) && again.focus.qty === 0,
      said: `state ${again.state}, alert ${again.error.shown ? 'still shown' : 'gone'}, «${again.retry.text}» ${again.retry.shown ? 'still offered' : 'gone'}, To checkout ${again.held ? 'held' : 'on'}, total ${again.rows[0]?.total}, focus ${again.focus.qty === 0 ? 'on the first box' : 'lost'}`,
    });
  }

  // The same at the first ask, when there is nothing to keep: nothing is drawn that the shop did not say, and the button is offered.
  await put(saved);
  await page.route('**/shipping', (route) => route.abort());
  await reload();
  now = await read();
  await page.unroute('**/shipping');
  found.push({
    check: 'cart: a shop that cannot be asked at the first ask leaves nothing drawn that it did not say, holds To checkout and offers to ask again (3.3.1, 4.1.3)',
    ok: now.state === 'failed' && now.error.shown && now.error.role === 'alert' && same(now.error.text, words.cartFailed) && now.rows.length === 0 && now.methods.length === 0 && now.subtotal === '' && now.held && now.retry.shown,
    said: `state ${now.state}, alert «${now.error.text}» ${now.error.shown ? 'shown' : 'hidden'} (${now.error.role || 'no role'}), ${now.rows.length} row(s), «${now.retry.text}» ${now.retry.shown ? 'offered' : 'not offered'}, To checkout ${now.held ? 'held' : 'on'}`,
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
      ok: after.error.shown && after.error.role === 'alert' && same(after.error.text, words.cartUnavailable) && heardAgain === 1,
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
    ok: now.error.shown && now.error.role === 'alert' && same(now.error.text, words.cartUnavailable) && now.held,
    said: `state ${now.state}, alert «${now.error.text}» ${now.error.shown ? 'shown' : 'hidden'}, To checkout ${now.held ? 'held' : 'on'}`,
  });
  return { states, found };
}

/**
 * Where the shop sends a cart: the first country it carries it to at home, by a parcel and a pick-up where it has one; and the
 * first abroad, where a parcel and a pick-up are both offered — the customs sentence's two cases. What the shop says of each is
 * asked of the shop itself, by the walk.
 * @param {(body: object) => Promise<any>} shop what the shop answers to `POST /api/shipping`, or null
 * @param {object[]} lines
 * @param {string[]} countries
 * @param {string} locale
 */
async function routesOf(shop, lines, countries, locale) {
  let home;
  let away;
  for (const country of countries) {
    const theirs = await shop({ lines, country, locale });
    const parcel = theirs?.methods?.find((one) => one.pickup === false);
    const pickup = theirs?.methods?.find((one) => one.pickup === true);
    if (theirs === null || parcel === undefined || (theirs.refused ?? []).length > 0) continue;
    if (theirs.abroad === false && home === undefined) home = { country, parcel, pickup, theirs };
    if (theirs.abroad === true && pickup !== undefined && away === undefined) away = { country, parcel, pickup };
  }
  return { home, away };
}

/** What an attempt is, as the shop holds it (Ruling 92), and the UUID `crypto.randomUUID()` makes one of. */
const ATTEMPT = /^[A-Za-z0-9_-]{16,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The checkout step, driven as a buyer drives it (jtakeit-core wiki/102 stage
 * 9, Ruling 195), after the cart's: on a page of its own in the same browser,
 * so the cart's lines are there, the cart's *To checkout* pressed by the
 * keyboard — the step opened, its heading focused, the stored cart priced
 * again and its total the shop's; *Pay* pressed with nothing filled in, each
 * missing detail said at its field; a pick-up chosen in the cart, the address
 * no longer asked; the customs sentence for a parcel abroad and not for a
 * pick-up; *incl. VAT* and the buyer's own currency where the shop says them;
 * the cart changed above the open step, and in another tab, and the step's
 * total following it (Ruling 224); *Pay* pressed while the shop is pricing,
 * which goes on once it has answered; pressed twice while the shop answers,
 * which is one request, the cart changed meanwhile priced only once it has; an
 * email the shop refuses, said at its field; the shop's new price, said, the
 * cart above priced again with it, the same press going on; an address Stripe
 * cannot tax, which gives the press up; answers that were lost, and *Pay*
 * pressed again on the same body — the same attempt, the same order — and
 * Stripe's page not given, asked again with the order's token alone; the
 * shop's own pay page, *Pay*, and the buyer on the order's page in this page's
 * language; the next press a new attempt; a line taken out after an answer
 * was lost, a new press (Ruling 223); a press holding an order once the step
 * shows another total, a new press, not the order's token (Ruling 225); an
 * order already paid, which sends the buyer to its page; a browser whose
 * storage throws; and the challenge — its key that could not be asked, asked
 * again after `403 challenge`, a fresh token for every call that carries the
 * cart and none for the order's token, *Pay* waiting for one, and a widget
 * that does not load, said.
 *
 * What the shop answers is asked of the shop again by the walk (`x-jtk-walk`)
 * — the total, the methods — and the page is held to it. The answers devShop
 * does not give — a lost answer, Stripe not reached, an address Stripe cannot
 * tax, VAT, a challenge — are made by holding the page's own request
 * (`route`): the request goes to the shop where it should make what it would,
 * and the answer the page gets is the one under test; the challenge's widget
 * is a stand-in the walk gives tokens from. What the cart has not got — a
 * pick-up, a country abroad — is not driven, and its check not said. A cart
 * with no line has no checkout to reach: said `quiet`, as the cart's is.
 * @param {import('playwright-core').Page} page a page of its own, at the cart's address
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 * @param {{ second?: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> } }} [options] a second line for the cart, as `audit` has one
 */
export async function driveCheckout(page, scan, options = {}) {
  const states = [];
  const found = [];
  const root = 'form[data-checkout]';
  const cartRoot = '[data-cart]';
  const at = page.url();
  const origin = new URL(at).origin;
  const { api, locale, back, words, countries } = await page.evaluate(({ form, cart }) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(form));
    const c = /** @type {HTMLElement | null} */ (document.querySelector(cart));
    return { api: f.dataset.api ?? '/api/', locale: f.dataset.locale ?? 'en', back: f.dataset.return ?? '', words: JSON.parse(f.dataset.words ?? '{}'), countries: JSON.parse(c?.dataset.countries ?? '[]') };
  }, { form: root, cart: cartRoot });
  const key = `jtk:cart:${api}`;
  const pressKey = `jtk:checkout:${api}`;
  /** The bodies the page sent the checkout, and the shipping asks it made, from here on. */
  const checkouts = [];
  const shippings = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST' || request.headers()['x-jtk-walk'] !== undefined) return;
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/checkout')) checkouts.push(JSON.parse(request.postData() ?? '{}'));
    if (path.endsWith('/shipping')) shippings.push(JSON.parse(request.postData() ?? '{}'));
  });
  const stored = () => storedCart(page, key);
  const put = (cart) => putCart(page, key, cart);
  const pressRaw = () => page.evaluate((k) => {
    try {
      return sessionStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  }, pressKey);
  const pressNow = () => page.evaluate((k) => {
    try {
      return JSON.parse(sessionStorage.getItem(k) ?? 'null');
    } catch {
      return 'unreadable';
    }
  }, pressKey);
  const shop = (body) => pricedBy(origin, api, body);
  const settleCart = () => page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && el.getAttribute('data-state') !== 'pricing';
  }, cartRoot, { timeout: 5000 });
  const settle = () => page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && !['pricing', 'paying'].includes(el.getAttribute('data-state') ?? '');
  }, root, { timeout: 5000 });
  /** Both pieces at rest: the cart's answer drawn, and the step's. */
  const settleBoth = async () => {
    await settleCart();
    await settle();
  };
  const reload = async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await settleCart();
  };
  const fresh = async () => {
    await page.goto(at, { waitUntil: 'networkidle' });
    await settleCart();
  };
  /**
   * The buyer is on the order's page, which empties the cart once it reads the order paid (Task 9.15): its answer awaited, and the
   * cart the drive had put back, so that the page it goes on to has one.
   */
  const cameBack = async (cartThen) => {
    await page.waitForFunction(() => {
      const state = document.querySelector('[data-order]')?.getAttribute('data-state');
      return state !== undefined && state !== null && state !== 'loading';
    }, undefined, { timeout: 5000 }).catch(() => undefined);
    await put(cartThen);
  };
  /** The cart's *To checkout*, by the keyboard, and the step's answer awaited. */
  const toCheckout = async () => {
    await page.waitForSelector(`${cartRoot} [data-to-checkout]:not([disabled])`, { timeout: 5000 });
    await page.focus(`${cartRoot} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    await settle();
  };
  /** *Pay*, by the keyboard. */
  const press = async () => {
    await page.focus(`${root} [data-pay]`);
    await page.keyboard.press('Enter');
  };
  /** *Pay*, and the answer awaited. */
  const payNow = async () => {
    await press();
    await settle();
  };
  /** The page's next request to the checkout, held: `answer` is given the route, and says what the page is answered. */
  const once = (answer) => page.route('**/checkout', answer, { times: 1 });
  const lost = () => once((route) => route.abort('connectionreset'));
  const NAMES = ['name', 'email', 'phone', 'line1', 'line2', 'postal_code', 'city'];
  const fill = async (email) => {
    for (const [name, value] of [['name', 'Ada Lovelace'], ['email', email], ['line1', 'Bahnhofstrasse 1'], ['postal_code', '8001'], ['city', 'Zürich']]) {
      await page.locator(`${root} [name="${name}"]`).fill(value);
    }
  };
  /** What the step draws now, as data. */
  const read = () => page.evaluate(({ sel, names }) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length > 0);
    const sentence = (el) => ({ shown: shown(el), text: text(el), role: el?.getAttribute('role') ?? '' });
    const at = document.activeElement;
    const pay = /** @type {HTMLButtonElement | null} */ (f.querySelector('[data-pay]'));
    const challenge = f.querySelector('[data-challenge]');
    const field = (name) => {
      const el = f.querySelector(`[name="${name}"]`);
      const ids = (el?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      return { invalid: el?.getAttribute('aria-invalid') === 'true', described: ids.map((id) => text(document.getElementById(id))).join(' ') };
    };
    return {
      shown: shown(f),
      state: f.dataset.state ?? '',
      busy: f.hasAttribute('aria-busy'),
      total: text(f.querySelector('[data-total]')),
      vat: sentence(f.querySelector('[data-vat]')),
      abroad: sentence(f.querySelector('[data-abroad]')),
      own: sentence(f.querySelector('[data-own-currency]')),
      address: shown(f.querySelector('[data-address]')),
      challenge: { shown: shown(challenge), empty: (challenge?.childElementCount ?? 0) === 0 },
      error: sentence(f.querySelector('[data-checkout-error]')),
      fields: Object.fromEntries(names.map((name) => [name, field(name)])),
      focus: { opening: at === (f.querySelector('h1, h2, h3, h4, h5, h6') ?? f), name: at instanceof HTMLInputElement && f.contains(at) ? at.name : '' },
      held: pay?.getAttribute('aria-disabled') === 'true' || pay?.disabled === true,
      cart: { state: document.querySelector('[data-cart]')?.getAttribute('data-state') ?? '', subtotal: text(document.querySelector('[data-cart] [data-subtotal]')) },
    };
  }, { sel: root, names: NAMES });
  const axeNow = async (state) => states.push({ state, violations: await scan(root) });

  // A cart with no line has no checkout to reach: the cart's drive said so, and nothing is asked here.
  const stored0 = await stored().catch(() => null);
  if (!stored0?.lines?.length) return { states, found, quiet: true };
  // Two lines, once each — the cart's first and a second, or the first again — so one can be taken out, and a total under the
  // free-above a method may have, so that the method's price is in it.
  const first = { ...stored0.lines[0], qty: 1 };
  const lines = [first, options.second !== undefined && JSON.stringify(options.second) !== JSON.stringify(first) ? { ...options.second, qty: 1 } : { ...first }];
  const cart = { v: 1, lines, country: '', method: '' };

  // The walk goes on with the buyer's cart as the drive found it: the pieces read after this one see it, not the drive's.
  try {
    await drive();
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
    if (!page.url().startsWith(origin)) await page.goto(at).catch(() => undefined);
    await put(stored0).catch(() => undefined);
  }
  return { states, found };

  async function drive() {
    const { home, away } = await routesOf(shop, lines, countries, locale);
    if (home === undefined) return;
    const totalOf = (theirs, method) => money(theirs.subtotal + method.price, theirs.currency, locale);
    /** The total the shop says for the cart as it is stored now, by the home's parcel. */
    const shopTotal = async () => {
      const now = await stored();
      const theirs = await shop({ lines: now.lines, country: now.country, locale });
      const method = theirs?.methods?.find((one) => one.method === now.method);
      return theirs === null || method === undefined ? '' : totalOf(theirs, method);
    };

    // ── Pay pressed on a step that shows no total yet — the first price still out: the total shown, nothing sent (N1) ─
    await put({ ...cart, country: home.country, method: home.parcel.method });
    await fresh();
    // The buyer's details in the step before it opens, as the browser fills them in, so that a press that went on would be sent.
    await page.evaluate(({ sel, values }) => {
      const f = /** @type {HTMLFormElement} */ (document.querySelector(sel));
      for (const [name, value] of Object.entries(values)) {
        const field = /** @type {HTMLInputElement | null} */ (f.querySelector(`[name="${name}"]`));
        if (!field) continue;
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, { sel: root, values: { name: 'Ada Lovelace', email: 'ada@example.ch', line1: 'Bahnhofstrasse 1', postal_code: '8001', city: 'Zürich' } });
    let opened0 = () => undefined;
    const firstPrice = new Promise((done) => { opened0 = () => done(undefined); });
    await page.route('**/shipping', async (route) => {
      await firstPrice;
      await route.continue();
    }, { times: 1 });
    // Were the press to go on, this is what it would reach: answered so that nothing is made, and the count says it went.
    await page.route('**/checkout', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again' }) }));
    const blankFrom = checkouts.length;
    await page.focus(`${cartRoot} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-state') === 'pricing', root, { timeout: 5000 });
    const blank = await read();
    await press();
    opened0();
    await page.waitForFunction((sel) => (document.querySelector(`${sel} [data-total]`)?.textContent ?? '').trim() !== '', root, { timeout: 5000 }).catch(() => undefined);
    await settle();
    // Time for a press that went on to have been sent.
    await page.waitForTimeout(300);
    const shownNow = await read();
    const sentOnBlank = checkouts.length - blankFrom;
    // The buyer presses on the total they now see: that is sent.
    await payNow();
    const sentOnShown = checkouts.slice(blankFrom + sentOnBlank);
    await page.unroute('**/checkout');
    found.push({
      check: 'checkout: Pay pressed while the step shows no total yet sends nothing — the total is shown, and the press on it is what is sent (N1)',
      ok: blank.total === '' && blank.state === 'pricing' && sentOnBlank === 0 && same(shownNow.total, totalOf(home.theirs, home.parcel)) && shownNow.state === 'priced'
        && sentOnShown.length === 1 && sentOnShown[0].total === home.theirs.subtotal + home.parcel.price,
      said: `pressed on «${blank.total}» (${blank.state}): sent ${sentOnBlank}; the total then shown «${shownNow.total}»; pressed on it: sent ${sentOnShown.length}, total ${sentOnShown[0]?.total}`,
    });
    await page.evaluate((k) => sessionStorage.removeItem(k), pressKey);

    // ── the step opened by the cart's *To checkout* ──────────────────────────
    await put({ ...cart, country: home.country, method: home.parcel.method });
    // A navigation of its own, not a reload: the fields come back empty, as a new visit has them.
    await fresh();
    const asked = shippings.length;
    await toCheckout();
    let now = await read();
    const sent = shippings.slice(asked);
    found.push({
      check: 'checkout: To checkout opens the step, takes the focus to its heading, and asks the shop again for the stored cart (2.4.3, Ruling 200)',
      ok: now.shown && now.focus.opening && sent.length === 1 && JSON.stringify(sent[0].lines) === JSON.stringify(lines) && sent[0].country === home.country && sent[0].locale === locale,
      said: `${now.shown ? 'shown' : 'hidden'}, focus ${now.focus.opening ? 'on its heading' : 'elsewhere'}, asked ${sent.length}× for ${sent.map((one) => `${one.country}/${one.locale}, ${one.lines?.length} line(s)`).join('; ') || 'nothing'}`,
    });
    // Said where the method costs something: a total that left out the method's price would be the subtotal's, and pass.
    if (home.parcel.price > 0) {
      found.push({
        check: 'checkout: the total is the shop\'s — the subtotal and the method\'s price — in the site\'s money (4.1.3)',
        ok: now.state === 'priced' && same(now.total, totalOf(home.theirs, home.parcel)) && !now.held,
        said: `«${now.total}», the shop's ${totalOf(home.theirs, home.parcel)} (${home.theirs.subtotal} + ${home.parcel.price} by ${home.parcel.method}), state ${now.state}, Pay ${now.held ? 'held' : 'on'}`,
      });
    }
    await axeNow('checkout: opened');

    // ── Pay with nothing filled in ───────────────────────────────────────────
    const before = checkouts.length;
    await payNow();
    now = await read();
    const asks = ['name', 'email', 'line1', 'postal_code', 'city'];
    const told = (state, names) => names.every((name) => state.fields[name].invalid && same(state.fields[name].described, words[`fault.${name}`]));
    const quiet = (state, names) => names.every((name) => !state.fields[name].invalid);
    found.push({
      check: 'checkout: Pay pressed with nothing filled in says what is missing at each field, tied to it, focuses the first, and sends nothing (3.3.1, 3.3.2, 4.1.3)',
      ok: told(now, asks) && quiet(now, ['phone', 'line2']) && now.error.shown && now.error.role === 'alert' && now.error.text !== '' && now.focus.name === 'name' && checkouts.length === before && (await pressNow()) === null,
      said: `${NAMES.filter((name) => now.fields[name].invalid).map((name) => `${name} «${now.fields[name].described}»`).join(', ') || 'no field said'}; alert «${now.error.text}»; focus on ${now.focus.name || 'no field'}; sent ${checkouts.length - before}`,
    });
    await axeNow('checkout: nothing filled in');

    // ── a pick-up chosen in the cart: no address asked ───────────────────────
    /** A method chosen in the cart by its arrow keys — which the step hears, and prices — and *To checkout* again. */
    const choose = async (method) => {
      await page.focus(`${cartRoot} [name=method]:checked`);
      for (let i = 0; i < 10; i += 1) {
        const value = await page.evaluate((sel) => /** @type {HTMLInputElement | null} */ (document.querySelector(`${sel} [name=method]:checked`))?.value, cartRoot);
        if (value === method) break;
        await page.keyboard.press('ArrowDown');
      }
      await settle();
      await toCheckout();
    };
    if (home.pickup !== undefined) {
      await choose(home.pickup.method);
      const picked = await read();
      await payNow();
      now = await read();
      found.push({
        check: 'checkout: a pick-up asks no address — it is hidden, its faults gone, the total the pick-up\'s, and Pay asks for the buyer alone (1.3.1, 3.3.2)',
        ok: !picked.address && quiet(picked, ['line1', 'postal_code', 'city']) && same(picked.total, totalOf(home.theirs, home.pickup)) && !now.address && told(now, ['name', 'email']) && quiet(now, ['line1', 'postal_code', 'city']) && checkouts.length === before,
        said: `address ${picked.address ? 'asked' : 'hidden'}, total «${picked.total}» (${totalOf(home.theirs, home.pickup)}); pressed: ${NAMES.filter((name) => now.fields[name].invalid).join(', ') || 'nothing'} said, sent ${checkouts.length - before}`,
      });
      await axeNow('checkout: a pick-up');
      await choose(home.parcel.method);
    }

    // ── the customs sentence beside the total: for a parcel abroad, never for a pick-up ─
    if (away !== undefined) {
      await put({ ...cart, country: away.country, method: away.pickup.method });
      await reload();
      await toCheckout();
      const pickup = await read();
      await put({ ...cart, country: away.country, method: away.parcel.method });
      await reload();
      await toCheckout();
      const parcel = await read();
      found.push({
        check: 'checkout: the customs sentence is said beside the total for a parcel that crosses the border, and not for a pick-up (3.3.2, 4.1.3)',
        ok: !pickup.abroad.shown && parcel.abroad.shown && same(parcel.abroad.text, words.customs) && parcel.abroad.role === 'status',
        said: `${away.country} by ${away.pickup.method}: ${pickup.abroad.shown ? 'said' : 'not said'}; by ${away.parcel.method}: ${parcel.abroad.shown ? `«${parcel.abroad.text}» (${parcel.abroad.role || 'no role'})` : 'not said'}`,
      });
      await axeNow('checkout: abroad');
    }

    // ── incl. VAT, and the buyer's own currency, where the shop says them ────
    await put({ ...cart, country: home.country, method: home.parcel.method });
    await reload();
    await page.route('**/shipping', async (route) => {
      const answer = await route.fetch();
      await route.fulfill({ response: answer, json: { ...(await answer.json()), vat_included: true, own_currency: true } });
    }, { times: 1 });
    await toCheckout();
    const switched = await read();
    await axeNow('checkout: incl. VAT, and the own currency');
    await toCheckout();
    now = await read();
    found.push({
      check: 'checkout: incl. VAT is said beside the total, and the buyer\'s own currency beside Pay, where the shop says them, and neither where it does not (3.3.2, 4.1.3)',
      ok: switched.vat.shown && same(switched.vat.text, words.vat) && switched.own.shown && same(switched.own.text, words.ownCurrency) && !now.vat.shown && !now.own.shown,
      said: `the shop's switches on: «${switched.vat.text}» ${switched.vat.shown ? 'shown' : 'hidden'}, «${switched.own.text}» ${switched.own.shown ? 'shown' : 'hidden'}; off: ${now.vat.shown || now.own.shown ? 'still said' : 'neither said'}`,
    });

    // ── the cart changed above the open step, and in another tab: the total follows it (Ruling 224) ─
    const opened = now.total;
    await page.focus(`${cartRoot} [data-cart-line][data-line="0"] [data-line-qty]`);
    await page.keyboard.press('ArrowUp');
    await settleBoth();
    const raised = await read();
    const raisedTheirs = await shopTotal();
    // Another tab of the same browser puts the cart back as it was: this one hears it as `storage`.
    const tab = await page.context().newPage();
    await tab.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await tab.evaluate(({ k, value }) => localStorage.setItem(k, JSON.stringify(value)), { k: key, value: { ...cart, country: home.country, method: home.parcel.method } });
    await tab.close();
    await page.waitForFunction(({ sel, was }) => (document.querySelector(`${sel} [data-total]`)?.textContent ?? '').replace(/\s+/g, ' ').trim() !== was, { sel: root, was: raised.total }, { timeout: 5000 }).catch(() => undefined);
    await settleBoth();
    const putBack = await read();
    const putBackTheirs = await shopTotal();
    found.push({
      check: 'checkout: a cart changed while the step is open — on this page, and in another tab — is priced again, and the total beside Pay is the cart\'s as shown (Ruling 224)',
      ok: raisedTheirs !== '' && raisedTheirs !== opened && same(raised.total, raisedTheirs) && raised.state === 'priced'
        && same(putBack.total, putBackTheirs) && same(putBack.total, opened) && putBack.state === 'priced',
      said: `«${opened}», a quantity raised in the cart: «${raised.total}» (the shop's ${raisedTheirs}); put back from another tab: «${putBack.total}» (the shop's ${putBackTheirs})`,
    });
    await axeNow('checkout: priced again as the cart changed');

    // ── Pay pressed while the shop is pricing, the cart changed again meanwhile: the newest price is what it goes on with (M3) ─
    let freed = () => undefined;
    const holding0 = new Promise((done) => { freed = () => done(undefined); });
    await page.route('**/shipping', async (route) => {
      await holding0;
      await route.continue();
    }, { times: 1 });
    // Every shipping answer the page reads, counted as its reader is handed it: the walk waits on the older one being read.
    await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      if (w.jtkWalkReads !== undefined) return;
      w.jtkWalkReads = 0;
      const text = Response.prototype.text;
      Response.prototype.text = async function read() {
        const out = await text.call(this);
        if (new URL(this.url).pathname.endsWith('/shipping')) w.jtkWalkReads += 1;
        return out;
      };
    });
    const supersededFrom = checkouts.length;
    await page.focus(`${cartRoot} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    await page.waitForFunction((sel) => document.querySelector(sel)?.hasAttribute('aria-busy'), root, { timeout: 5000 });
    const pressedOn = (await read()).total;
    await press();
    // The cart changed while that first price is still out: the step asks again, and the older answer is to count for nothing.
    await page.focus(`${cartRoot} [data-cart-line][data-line="0"] [data-line-qty]`);
    await page.keyboard.press('ArrowUp');
    await settleCart();
    await page.waitForFunction(({ sel, was }) => (document.querySelector(`${sel} [data-total]`)?.textContent ?? '').replace(/\s+/g, ' ').trim() !== was, { sel: root, was: pressedOn }, { timeout: 5000 }).catch(() => undefined);
    // The newer answer, and the cart's own, are read: what is read from here on is the older one.
    const readsBefore = await page.evaluate(() => /** @type {any} */ (window).jtkWalkReads);
    freed();
    // Polled a frame at a time, so the step has done with the older answer — whatever it does with it — before it is read.
    const olderRead = await page.waitForFunction((n) => /** @type {any} */ (window).jtkWalkReads > n, readsBefore, { timeout: 5000 }).then(() => true, () => false);
    await settleBoth();
    const superseded = await read();
    const supersededTheirs = await shopTotal();
    found.push({
      check: 'checkout: Pay pressed while the shop is pricing, the cart changed again meanwhile, goes on with the newest price — which it says changed, and sends nothing (M3)',
      ok: olderRead && checkouts.length === supersededFrom && supersededTheirs !== pressedOn && same(superseded.total, supersededTheirs) && same(superseded.error.text, words['error.total']) && superseded.error.shown,
      said: `pressed on «${pressedOn}»; the cart changed, the step at «${superseded.total}» (the shop's ${supersededTheirs}), the older answer ${olderRead ? 'read after it' : 'never read'}; «${superseded.error.text}»; sent ${checkouts.length - supersededFrom}`,
    });
    // The cart as it was, and the step with it.
    await page.focus(`${cartRoot} [data-cart-line][data-line="0"] [data-line-qty]`);
    await page.keyboard.press('ArrowDown');
    await settleBoth();
    await page.waitForFunction(({ sel, was }) => (document.querySelector(`${sel} [data-total]`)?.textContent ?? '').replace(/\s+/g, ' ').trim() === was, { sel: root, was: opened }, { timeout: 5000 }).catch(() => undefined);

    // ── Pay pressed while the shop is pricing: kept, and gone on with once it has answered ─
    // An email of no domain the shop takes: past the page's own check, which holds back only what is plainly missing.
    await fill('ada@example');
    let released = () => undefined;
    const held = new Promise((done) => { released = () => done(undefined); });
    await page.route('**/shipping', async (route) => {
      await held;
      await route.continue();
    }, { times: 1 });
    const pricingFrom = checkouts.length;
    await page.focus(`${cartRoot} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    await page.waitForFunction((sel) => document.querySelector(sel)?.hasAttribute('aria-busy'), root, { timeout: 5000 });
    await press();
    const whilePricing = { sent: checkouts.length - pricingFrom, state: await read() };
    released();
    // The answer, then the press it was waiting for, in one go: the step is at rest only once the shop has answered the press.
    await settle();
    now = await read();
    const queued = checkouts.slice(pricingFrom);
    const body = queued[0] ?? {};
    const a1 = String(body.attempt ?? '');
    found.push({
      check: 'checkout: Pay pressed while the shop is pricing is kept, and goes on once the shop has answered (I1)',
      ok: whilePricing.sent === 0 && whilePricing.state.busy && whilePricing.state.held && queued.length === 1,
      said: `pressed while ${whilePricing.state.busy ? 'pricing' : 'not pricing'} (Pay ${whilePricing.state.held ? 'held' : 'on'}), sent ${whilePricing.sent} then; ${queued.length} request(s) once the shop answered`,
    });
    const keys = ['lines', 'country', 'method', 'buyer', 'address', 'total', 'attempt', 'return', 'locale', 'turnstile'];
    found.push({
      check: 'checkout: Pay sends the protocol\'s body — the cart\'s lines, its country and method, the buyer and the address as typed, the total shown, a new attempt, the return, the page\'s language and the challenge\'s token (Ruling 92, 202)',
      ok: JSON.stringify(Object.keys(body)) === JSON.stringify(keys) && JSON.stringify(body.lines) === JSON.stringify(lines) && body.country === home.country && body.method === home.parcel.method
        && JSON.stringify(body.buyer) === JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example' }) && JSON.stringify(body.address) === JSON.stringify({ line1: 'Bahnhofstrasse 1', postal_code: '8001', city: 'Zürich' })
        && body.total === home.theirs.subtotal + home.parcel.price && ATTEMPT.test(a1) && UUID.test(a1) && body.return === back && body.locale === locale
        // Where the host has no challenge — devShop's /api/turnstile says none — nothing is drawn for it and its token is empty.
        && body.turnstile === '' && !now.challenge.shown && now.challenge.empty,
      said: `keys ${Object.keys(body).join(', ')}; ${body.country}/${body.method}, total ${body.total}, attempt ${a1}, return ${body.return}, locale ${body.locale}, turnstile «${body.turnstile}», the challenge ${now.challenge.shown ? 'drawn' : 'not drawn'}`,
    });

    // ── Pay pressed twice while the shop answers; the cart changed meanwhile ─
    // Every submit counted as it happens, with whether Pay was held then.
    await page.evaluate(() => {
      /** @type {any} */ (window).jtkSubmits = [];
      document.addEventListener('submit', () => /** @type {any} */ (window).jtkSubmits.push(document.querySelector('[data-pay]')?.getAttribute('aria-disabled')), true);
    });
    let answered = () => undefined;
    const answering = new Promise((done) => { answered = () => done(undefined); });
    await once(async (route) => {
      await answering;
      await route.continue();
    });
    // The shop says a new price while the press is with it: what the cart above hears, the step must not draw under the press.
    await page.route('**/shipping', async (route) => {
      const answer = await route.fetch();
      const priced = await answer.json();
      await route.fulfill({ response: answer, json: { ...priced, subtotal: priced.subtotal + 100 } });
    });
    const twiceFrom = checkouts.length;
    await press();
    await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-state') === 'paying', root, { timeout: 5000 });
    await page.keyboard.press('Enter');
    const holdFrom = shippings.length;
    await page.evaluate((k) => document.dispatchEvent(new CustomEvent('jtk:cart', { detail: k })), key);
    await settleCart();
    // Time for any ask the step might wrongly make under the press to be made, and answered.
    await page.waitForTimeout(300);
    const underPress = await read();
    const askedUnder = shippings.length - holdFrom;
    answered();
    await settleBoth();
    const afterPress = await read();
    await page.unroute('**/shipping');
    const submits = await page.evaluate(() => /** @type {any} */ (window).jtkSubmits);
    const twice = checkouts.slice(twiceFrom);
    found.push({
      check: 'checkout: Pay pressed again while the shop answers is the same press, received while Pay was held, and sent once (Ruling 92)',
      ok: JSON.stringify(submits) === JSON.stringify(['false', 'true']) && twice.length === 1 && twice[0].attempt === a1,
      said: `submits with Pay held: ${JSON.stringify(submits)}; ${twice.length} request(s), ${twice[0]?.attempt === a1 ? 'the same attempt' : `attempt ${twice[0]?.attempt}`} for the same body`,
    });
    const movedTotal = money(home.theirs.subtotal + 100 + home.parcel.price, home.theirs.currency, locale);
    found.push({
      check: 'checkout: a cart change heard while a press is with the shop leaves the total beside it as it was, and is priced once the press is answered (Ruling 224)',
      ok: askedUnder === 1 && same(underPress.cart.subtotal, money(home.theirs.subtotal + 100, home.theirs.currency, locale)) && same(underPress.total, totalOf(home.theirs, home.parcel)) && underPress.state === 'paying'
        && same(afterPress.total, movedTotal),
      said: `the cart above at «${underPress.cart.subtotal}» while the press was with the shop, asked ${askedUnder}× then, the step at «${underPress.total}» (${underPress.state}); answered: «${afterPress.total}» (${movedTotal})`,
    });
    await toCheckout();
    now = await read();
    let kept = await pressNow();
    const keptRaw = await pressRaw();
    // What the tab keeps of the press: a digest of what it was sent with, and nothing of the buyer's to read back (Ruling 226).
    const told226 = ['Ada', 'Lovelace', 'ada@example', 'Bahnhofstrasse', 'Zürich', '8001'].filter((detail) => keptRaw.includes(detail));
    found.push({
      check: 'checkout: a detail the shop refuses is said at its field, tied to it and focused, and the press is kept for the next — with a digest of what it was sent with, none of the buyer\'s details, and when (3.3.1, 4.1.3, Rulings 223, 226)',
      ok: told(afterPress, ['email']) && quiet(afterPress, ['name', 'line1', 'postal_code', 'city']) && afterPress.focus.name === 'email' && afterPress.error.shown && kept?.attempt === a1 && kept?.order === ''
        && typeof kept?.sent === 'string' && /^b1:[0-9a-f]{28}$/.test(kept.sent) && told226.length === 0 && typeof kept?.at === 'number',
      said: `${NAMES.filter((name) => afterPress.fields[name].invalid).map((name) => `${name} «${afterPress.fields[name].described}»`).join(', ') || 'no field said'}; focus on ${afterPress.focus.name || 'no field'}; the tab keeps ${keptRaw}${told226.length > 0 ? ` — holding ${told226.join(', ')}` : ''}`,
    });
    await axeNow('checkout: a detail refused by the shop');

    // ── the email corrected, and the shop's price changed in between: shown, said, the cart above priced again ─
    await page.locator(`${root} [name="email"]`).fill('ada@example.ch');
    /** @type {any} */
    let requoted = null;
    // The press as the page sent it, with a total the shop no longer comes to: its own 409 total, and its quote.
    await once(async (route) => {
      const sent = JSON.parse(route.request().postData() ?? '{}');
      const answer = await route.fetch({ postData: JSON.stringify({ ...sent, total: sent.total + 1 }) });
      requoted = await answer.json();
      await route.fulfill({ response: answer });
    });
    const second = checkouts.length;
    const repricedFrom = shippings.length;
    await payNow();
    await settleBoth();
    now = await read();
    const a1b = String(checkouts[second]?.attempt ?? '');
    const quotedTotal = requoted?.quote === undefined ? '' : money(requoted.quote.subtotal + (requoted.quote.methods.find((one) => one.method === home.parcel.method)?.price ?? 0), requoted.quote.currency, locale);
    const cartAsked = shippings.slice(repricedFrom);
    found.push({
      check: 'checkout: a price that changed is shown and said, and the cart above is priced again with it — asked once, by the cart, and showing the shop\'s subtotal (3.3.1, 4.1.3)',
      ok: requoted?.error === 'total' && same(now.error.text, words['error.total']) && now.error.shown && quotedTotal !== '' && same(now.total, quotedTotal) && !now.held
        && cartAsked.length === 1 && now.cart.state === 'priced' && same(now.cart.subtotal, money(requoted.quote.subtotal, requoted.quote.currency, locale)),
      said: `«${now.error.text}», total «${now.total}» (the quote's ${quotedTotal}); the cart asked ${cartAsked.length}× and shows «${now.cart.subtotal}» (${now.cart.state})`,
    });
    await axeNow('checkout: a new price');

    // ── an address Stripe cannot tax: said, the address focused, the press given up ─
    await once((route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'address', order: 'jtk-walk-given-up' }) }));
    const third = checkouts.length;
    await payNow();
    const given = await read();
    const forgotten = await pressNow();
    await axeNow('checkout: an address Stripe cannot tax');

    // ── an answer lost, and Pay pressed again on the same body: the same press ─
    await lost();
    const fourth = checkouts.length;
    await payNow();
    now = await read();
    kept = await pressNow();
    const a2 = String(checkouts[fourth]?.attempt ?? '');
    found.push({
      check: 'checkout: an address Stripe cannot tax is said, the address focused, and the press given up — the next press is a new one (3.3.1, Ruling 202)',
      ok: a1b !== a1 && checkouts[third]?.attempt === a1b && same(given.error.text, words.address) && given.focus.name === 'line1' && forgotten === null && ATTEMPT.test(a2) && a2 !== a1b,
      said: `the corrected email a new press (${a1b === a1 ? 'no: the same attempt' : 'a new attempt'}), the same after the new price (${checkouts[third]?.attempt === a1b ? 'yes' : 'no'}); «${given.error.text}», focus on ${given.focus.name || 'no field'}, the press ${forgotten === null ? 'forgotten' : `kept ${JSON.stringify(forgotten)}`}; the next press ${a2 === a1b ? 'the same attempt' : `a new attempt ${a2}`}`,
    });
    found.push({
      check: 'checkout: an answer that was lost is said, and the press kept as it was — the same attempt, no order known (Ruling 92)',
      ok: same(now.error.text, words['error.try_again']) && now.error.shown && !now.held && kept?.attempt === a2 && kept?.order === '',
      said: `«${now.error.text}»; kept ${JSON.stringify({ attempt: kept?.attempt, order: kept?.order })}`,
    });
    /** @type {any} */
    let made = null;
    await once(async (route) => {
      made = await (await route.fetch()).json();
      await route.abort('connectionreset');
    });
    const fifth = checkouts.length;
    await payNow();
    found.push({
      check: 'checkout: an answer lost, then Pay pressed with nothing changed, is the same press — the same attempt, with its cart (Ruling 223)',
      ok: checkouts[fifth]?.attempt === a2 && JSON.stringify(checkouts[fifth]?.lines) === JSON.stringify(lines) && typeof made?.order === 'string',
      said: `attempt ${checkouts[fifth]?.attempt === a2 ? 'the same' : checkouts[fifth]?.attempt}, ${Array.isArray(checkouts[fifth]?.lines) ? 'its cart' : 'no cart'}; the shop made ${made?.order ?? 'nothing'}, and the answer was lost`,
    });

    // ── the retry: the same attempt and the cart, and the same order; Stripe's page not given ─
    /** @type {any} */
    let again = null;
    await once(async (route) => {
      again = await (await route.fetch()).json();
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again', order: again.order }) });
    });
    const sixth = checkouts.length;
    await payNow();
    kept = await pressNow();
    const retry = checkouts[sixth] ?? {};
    found.push({
      check: 'checkout: a press retried after an answer was lost is the same attempt with its cart, and the shop answers it with the same order (Ruling 92)',
      ok: retry.attempt === a2 && JSON.stringify(retry.lines) === JSON.stringify(lines) && again?.order === made?.order && typeof again?.order === 'string',
      said: `attempt ${retry.attempt === a2 ? 'the same' : retry.attempt}, ${Array.isArray(retry.lines) ? 'its cart' : 'no cart'}; the shop's order ${again?.order === made?.order ? 'the same' : `${again?.order}, not ${made?.order}`}`,
    });

    // ── asked again with the order's token alone; Stripe's page ──────────────
    const seventh = checkouts.length;
    /** @type {any} */
    let stripe = null;
    let status = 0;
    await once(async (route) => {
      const answer = await route.fetch();
      status = answer.status();
      stripe = await answer.json();
      await route.fulfill({ response: answer });
    });
    const cartAtPay = await stored();
    await press();
    // A page that never leaves is the check's to say, not the walk's to stop at.
    await page.waitForURL((url) => typeof stripe?.url === 'string' && url.href === stripe.url, { timeout: 5000 }).catch(() => undefined);
    const left = await pressNow();
    found.push({
      check: 'checkout: Stripe\'s page not given, the press keeps the order, and the next ask on the same body is its token alone, which holds nothing more (Ruling 92, 225)',
      ok: kept?.attempt === a2 && kept?.order === made?.order && JSON.stringify(checkouts[seventh]) === JSON.stringify({ order: made?.order }),
      said: `kept ${JSON.stringify({ attempt: kept?.attempt, order: kept?.order })}; asked again with ${JSON.stringify(checkouts[seventh])}`,
    });
    found.push({
      check: 'checkout: the buyer is sent to Stripe\'s page the shop gave, and the press is over and forgotten (Ruling 92)',
      ok: status === 201 && stripe?.order === made?.order && page.url() === stripe?.url && left === null,
      said: `${status} for ${stripe?.order}, the page at ${page.url()}, the press ${left === null ? 'forgotten' : `kept ${JSON.stringify(left)}`}`,
    });

    // ── the shop's own pay page, Pay: the order's page in this page's language ─
    if (page.url() === stripe?.url) {
      await page.locator('button[type=submit]').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForURL((url) => url.pathname === back, { timeout: 5000 }).catch(() => undefined);
    }
    const landed = new URL(page.url());
    found.push({
      check: 'checkout: paid, the buyer comes back to the order\'s page in this page\'s language, with the order on its address (Ruling 202)',
      ok: landed.pathname === back && landed.searchParams.get('order') === made?.order,
      said: `${landed.pathname}${landed.search}`,
    });
    await cameBack(cartAtPay);

    // ── the press after Stripe's page was given is a new one ─────────────────
    await fresh();
    await toCheckout();
    await fill('ada@example.ch');
    await lost();
    const eighth = checkouts.length;
    await payNow();
    const a3 = String(checkouts[eighth]?.attempt ?? '');
    found.push({
      check: 'checkout: after Stripe\'s page was given the next press is a new one, a new attempt (Ruling 92)',
      ok: ATTEMPT.test(a3) && UUID.test(a3) && a3 !== a1 && a3 !== a2 && Array.isArray(checkouts[eighth]?.lines),
      said: `attempt ${a3}${a3 === a2 ? ' — the one Stripe\'s page was given for' : ''}`,
    });

    // ── an answer lost, then a line taken out of the cart: a new press (Ruling 223) ─
    kept = await pressNow();
    const lostOn = kept?.attempt;
    await page.focus(`${cartRoot} [data-cart-line][data-line="1"] [data-line-remove]`);
    await page.keyboard.press('Enter');
    await settleBoth();
    const oneLine = await read();
    /** @type {any} */
    let made2 = null;
    await once(async (route) => {
      made2 = await (await route.fetch()).json();
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again', order: made2.order }) });
    });
    const ninth = checkouts.length;
    await payNow();
    const a4 = String(checkouts[ninth]?.attempt ?? '');
    found.push({
      check: 'checkout: an answer lost, then a line taken out of the cart, then Pay is a new press — a new attempt for the new body (Ruling 223)',
      ok: lostOn === a3 && a4 !== a3 && ATTEMPT.test(a4) && checkouts[ninth]?.lines?.length === 1 && same(oneLine.total, await shopTotal()),
      said: `lost on ${lostOn === a3 ? 'the press' : lostOn}; a line taken out, the step at «${oneLine.total}»; then ${a4 === a3 ? 'the same attempt' : `a new attempt ${a4}`} with ${checkouts[ninth]?.lines?.length} line(s)`,
    });

    // ── a press holding an order, and the step showing another total: a new press, not the order's token (Ruling 225) ─
    const holding = await pressNow();
    await page.route('**/shipping', async (route) => {
      const answer = await route.fetch();
      const priced = await answer.json();
      await route.fulfill({ response: answer, json: { ...priced, subtotal: priced.subtotal + 100 } });
    }, { times: 1 });
    await toCheckout();
    const moved = await read();
    await once((route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again' }) }));
    const tenth = checkouts.length;
    await payNow();
    const asNew = checkouts[tenth] ?? {};
    found.push({
      check: 'checkout: a press that holds an order is not asked for by the order\'s token once the step shows another total — a new attempt, with the cart and the total shown (Ruling 225)',
      ok: holding?.attempt === a4 && holding?.order === made2?.order && typeof made2?.order === 'string' && asNew.order === undefined && asNew.attempt !== a4 && ATTEMPT.test(String(asNew.attempt ?? ''))
        && Array.isArray(asNew.lines) && asNew.total === checkouts[ninth]?.total + 100 && same(moved.total, money(asNew.total, home.theirs.currency, locale)),
      said: `the press held ${holding?.order === made2?.order ? 'the order' : JSON.stringify(holding?.order)} made at ${checkouts[ninth]?.total}; the step at «${moved.total}»; Pay sent ${asNew.order !== undefined ? `{ order: ${asNew.order} }` : `attempt ${asNew.attempt === a4 ? 'the same' : 'a new one'}, total ${asNew.total}`}`,
    });

    // ── an order already paid: to its page, not paid again ───────────────────
    await toCheckout();
    /** @type {any} */
    let made3 = null;
    await once(async (route) => {
      made3 = await (await route.fetch()).json();
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again', order: made3.order }) });
    });
    await payNow();
    // Paid meanwhile — on Stripe's page in another tab, as the shop's own pay page stands for it here.
    await fetch(`${origin}${api}dev-pay?order=${encodeURIComponent(made3?.order ?? '')}&do=pay`, { method: 'POST', redirect: 'manual' }).catch(() => undefined);
    const eleventh = checkouts.length;
    const cartAtPaid = await stored();
    await press();
    await page.waitForURL((url) => url.pathname === back, { timeout: 5000 }).catch(() => undefined);
    const paid = new URL(page.url());
    found.push({
      check: 'checkout: an order already paid is not paid again — asked for by its token, the buyer is sent to its page, and the press is over (409 paid)',
      ok: typeof made3?.order === 'string' && JSON.stringify(checkouts[eleventh]) === JSON.stringify({ order: made3.order }) && paid.pathname === back && paid.searchParams.get('order') === made3.order && (await pressNow()) === null,
      said: `asked with ${JSON.stringify(checkouts[eleventh])}, landed on ${paid.pathname}${paid.search}`,
    });
    await cameBack(cartAtPaid);

    // ── a browser whose storage throws ───────────────────────────────────────
    const blocked = (store) => page.evaluate((name) => {
      Object.defineProperty(window, name, { configurable: true, get: () => { throw new DOMException('The site\'s data is blocked', 'SecurityError'); } });
    }, store);
    // The cart cannot be read as the step opens: said, and nothing shown to pay.
    await fresh();
    await toCheckout();
    await blocked('localStorage');
    await page.evaluate((k) => document.dispatchEvent(new CustomEvent('jtk:to-checkout', { detail: k })), key);
    await settle();
    const atOpening = await read();
    found.push({
      check: 'checkout: a browser that keeps no cart is told so as the step opens, and is shown no total to pay (3.3.1, 4.1.3)',
      ok: atOpening.error.shown && same(atOpening.error.text, words.cartUnavailable) && atOpening.total === '' && atOpening.state === 'failed',
      said: `«${atOpening.error.text}», total «${atOpening.total}», state ${atOpening.state}`,
    });
    await axeNow('checkout: no cart kept, opening');
    // …and as Pay is pressed, which sends nothing.
    await fresh();
    await toCheckout();
    await fill('ada@example.ch');
    await blocked('localStorage');
    const twelfth = checkouts.length;
    await payNow();
    const atPay = await read();
    found.push({
      check: 'checkout: a browser that keeps no cart is told so as Pay is pressed, and nothing is sent (3.3.1, 4.1.3)',
      ok: atPay.error.shown && same(atPay.error.text, words.cartUnavailable) && checkouts.length === twelfth,
      said: `«${atPay.error.text}», sent ${checkouts.length - twelfth}`,
    });
    // A tab that keeps nothing: the press is kept by the page, and Pay pressed again on the same body is the same press.
    await fresh();
    await toCheckout();
    await fill('ada@example.ch');
    await blocked('sessionStorage');
    await lost();
    const thirteenth = checkouts.length;
    await payNow();
    await once((route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again' }) }));
    await payNow();
    const inMemory = checkouts.slice(thirteenth);
    const memoryNow = await read();
    found.push({
      check: 'checkout: a tab that keeps nothing keeps the press in the page — Pay pressed again after a lost answer is the same attempt (Ruling 92)',
      ok: (await pressNow()) === 'unreadable' && inMemory.length === 2 && ATTEMPT.test(String(inMemory[0].attempt ?? '')) && inMemory[1].attempt === inMemory[0].attempt && same(memoryNow.error.text, words['error.try_again']),
      said: `${inMemory.length} request(s), ${inMemory[1]?.attempt === inMemory[0]?.attempt ? 'the same attempt' : `attempts ${inMemory.map((one) => one.attempt).join(' / ')}`}; «${memoryNow.error.text}»`,
    });

    // ── the challenge: a stand-in widget, whose tokens the walk gives ─────────
    let keyAsks = 0;
    let keyAnswers = 'none';
    await page.route('**/api/turnstile', async (route) => {
      keyAsks += 1;
      if (keyAnswers === 'none') return route.abort('connectionreset');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sitekey: 'jtk-walk-key' }) });
    });
    let script = 'widget';
    await page.route('https://challenges.cloudflare.com/**', (route) => (script === 'blocked' ? route.abort('blockedbyclient') : route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `window.turnstile = {
  render(el, opts) {
    const box = document.createElement('p');
    box.dataset.walkWidget = '';
    box.textContent = 'jtk walk: a stand-in for the challenge';
    el.append(box);
    window.jtkWalkWidget = { opts, resets: 0, n: 0, give() { this.n += 1; opts.callback('jtk-walk-token-' + this.n); } };
    return 'jtk-walk-widget';
  },
  reset() { window.jtkWalkWidget.resets += 1; },
};`,
    })));
    await fresh();
    await toCheckout();
    await fill('ada@example.ch');
    // Its key could not be asked: the step draws nothing, and the shop says 403 challenge — the key is asked again, and the widget drawn.
    keyAnswers = 'key';
    await once((route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'challenge' }) }));
    const fourteenth = checkouts.length;
    await payNow();
    await page.waitForSelector(`${root} [data-challenge] [data-walk-widget]`, { timeout: 5000 }).catch(() => undefined);
    const drawn = await read();
    found.push({
      check: 'checkout: a challenge whose key could not be asked is asked for again when the shop says 403 challenge, and drawn (Ruling 225, M1)',
      ok: checkouts[fourteenth]?.turnstile === '' && keyAsks === 2 && drawn.challenge.shown && !drawn.challenge.empty && same(drawn.error.text, words['error.challenge']),
      said: `sent with turnstile «${checkouts[fourteenth]?.turnstile}»; the key asked ${keyAsks}×; the widget ${drawn.challenge.shown && !drawn.challenge.empty ? 'drawn' : 'not drawn'}; «${drawn.error.text}»`,
    });
    await axeNow('checkout: the challenge drawn');
    // Drawn and no token yet: Pay waits for one, and sends nothing.
    const fifteenth = checkouts.length;
    await payNow();
    const waiting = await read();
    // A token, and a call that carries the cart: it spends it; Pay again waits for a fresh one; with it, the same press again.
    const give = () => page.evaluate(() => /** @type {any} */ (window).jtkWalkWidget.give());
    await give();
    await once((route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again' }) }));
    await payNow();
    const spentFrom = checkouts.length;
    await payNow();
    const spentHeld = checkouts.length - spentFrom;
    await give();
    await once((route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again', order: 'jtk-walk-order' }) }));
    await payNow();
    // The order's token alone holds nothing and needs no token: sent without one, though none was given.
    await once((route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found', order: 'jtk-walk-order' }) }));
    await payNow();
    const tokens = checkouts.slice(fifteenth);
    const resets = await page.evaluate(() => /** @type {any} */ (window).jtkWalkWidget.resets);
    found.push({
      check: 'checkout: Pay waits for the challenge\'s token; every call that carries the cart takes a fresh one, and the order\'s token alone none (Ruling 202, M1)',
      ok: same(waiting.error.text, words['error.challenge']) && spentHeld === 0 && tokens.length === 3
        && tokens[0].turnstile === 'jtk-walk-token-1' && tokens[1].turnstile === 'jtk-walk-token-2' && tokens[1].attempt === tokens[0].attempt
        && JSON.stringify(tokens[2]) === JSON.stringify({ order: 'jtk-walk-order' }) && resets === 2,
      said: `with no token: «${waiting.error.text}», ${spentHeld} sent after one was spent; sent ${tokens.map((one) => (one.order !== undefined ? `{ order }` : `«${one.turnstile}»`)).join(', ')}; the widget reset ${resets}×`,
    });
    // A widget that does not load — its script blocked — is said, not left to wait for a token that never comes.
    script = 'blocked';
    keyAsks = 0;
    await fresh();
    await toCheckout();
    await page.waitForFunction((sel) => (document.querySelector(`${sel} [data-checkout-error]`)?.textContent ?? '') !== '', root, { timeout: 5000 }).catch(() => undefined);
    const unloaded = await read();
    found.push({
      check: 'checkout: a challenge whose widget does not load is said to the buyer (3.3.1, M1)',
      ok: keyAsks === 1 && same(unloaded.error.text, words.challengeUnavailable) && !unloaded.challenge.shown,
      said: `the key asked ${keyAsks}×; «${unloaded.error.text}»; the challenge ${unloaded.challenge.shown ? 'shown' : 'hidden'}`,
    });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await fresh();
  }
}

/**
 * The page after payment, driven as a buyer reaches it (jtakeit-core wiki/102
 * stage 9, Ruling 195), after the checkout's: on a page of its own at the cart's
 * address, in the same browser, with the buyer's cart in it. Three orders are
 * pressed through the shop's own pay page, which stands for Stripe's:
 *
 *   the first is paid there — the order's page reads it paid, with its number, the
 *   lines, what they came to and the method as the shop froze them, and the
 *   cart is emptied;
 *
 *   the second, another buyer's details than the first's — a press is for one body —
 *   is left there: back on the order's page with `left=1` the buyer is told so,
 *   offered the shop's page again (a link to it, which goes there) and the cart is
 *   kept, which *Back to your cart* goes to; and
 *
 *   the third, pressed from that cart, is a new order: another attempt, another
 *   token than the second's — which the shop would have answered again for the
 *   attempt kept.
 *
 * A browser whose storage throws is told the paid order's cart could not be emptied.
 * Then, with the page's clock in the walk's hands (`page.clock`, so that two
 * minutes take no time and every wait is for an event, not for a time): the third
 * order, waiting, is asked after again every three seconds — never while the tab is
 * hidden, and once however often it is hidden and shown — until the fortieth ask,
 * when the page says it is still waiting, keeps Stripe's page, and asks no more,
 * whatever the tab does; a paid, lapsed, cancelled or unknown order is asked after
 * once; the shop's answers it never gives — lapsed, cancelled, with the answers a
 * customization gave — are made by holding the page's own request (`route`). A
 * token that is nobody's, and an address with none, say so and leave the cart as it
 * is. axe reads each state. A cart with no line has no order to reach: said `quiet`.
 * @param {import('playwright-core').Page} page a page of its own, at the cart's address
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 * @param {{ second?: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> } }} [options] a second line for the cart, as `audit` has one
 */
export async function driveOrder(page, scan, options = {}) {
  const states = [];
  const found = [];
  const root = 'form[data-checkout]';
  const cartRoot = '[data-cart]';
  const orderRoot = '[data-order]';
  const at = page.url();
  const origin = new URL(at).origin;
  const { api, locale, back, countries } = await page.evaluate(({ form, cart }) => {
    const f = /** @type {HTMLFormElement} */ (document.querySelector(form));
    const c = /** @type {HTMLElement | null} */ (document.querySelector(cart));
    return { api: f.dataset.api ?? '/api/', locale: f.dataset.locale ?? 'en', back: f.dataset.return ?? '', countries: JSON.parse(c?.dataset.countries ?? '[]') };
  }, { form: root, cart: cartRoot });
  const W = shopWordsFor(locale);
  const key = `jtk:cart:${api}`;
  /** The cart in this page's language, as the order's way back to it says it: `/cart`, `/en/cart`. */
  const cartPath = new URL(at).pathname.replace(/\/$/, '');
  /** The bodies the page sent the checkout, from here on. */
  const checkouts = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['x-jtk-walk'] === undefined && new URL(request.url()).pathname.endsWith('/checkout')) checkouts.push(JSON.parse(request.postData() ?? '{}'));
  });
  const stored = () => storedCart(page, key);
  const put = (cart) => putCart(page, key, cart);
  const shop = (body) => pricedBy(origin, api, body);
  const postShop = async (path, body) => {
    const answer = await fetch(`${origin}${api}${path}`, { method: 'POST', headers: WALK, body: JSON.stringify(body) });
    return { status: answer.status, body: await answer.json().catch(() => null) };
  };
  /** The order as the shop tells it: `null` for a token that is nobody's. */
  const theirs = async (token) => {
    const answer = await fetch(`${origin}${api}order?token=${encodeURIComponent(token)}`, { headers: WALK });
    return answer.status === 200 ? answer.json() : null;
  };

  // A cart with no line has no order to reach: the cart's drive said so, and nothing is asked here.
  const stored0 = await stored().catch(() => null);
  if (!stored0?.lines?.length) return { states, found, quiet: true };
  const first = { ...stored0.lines[0], qty: 1 };
  const lines = [first, options.second !== undefined && JSON.stringify(options.second) !== JSON.stringify(first) ? { ...options.second, qty: 1 } : { ...first }];
  const { home } = await routesOf(shop, lines, countries, locale);
  if (home === undefined) return { states, found };
  const cart = { v: 1, lines, country: home.country, method: home.parcel.method };

  /** The drive cannot go on: said as the finding it is, and the rest is not walked. */
  const STUCK = new Error('the order drive cannot go on');
  const stuck = (check, said) => {
    found.push({ check, ok: false, said });
    throw STUCK;
  };
  // The walk goes on with the buyer's cart as the drive found it, and with the page's clock running as it was.
  try {
    await drive();
  } catch (why) {
    if (why !== STUCK) throw why;
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
    await page.clock.resume().catch(() => undefined);
    if (!page.url().startsWith(origin)) await page.goto(at).catch(() => undefined);
    await put(stored0).catch(() => undefined);
  }
  return { states, found };

  async function drive() {
    const settleCart = () => page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && el.getAttribute('data-state') !== 'pricing';
    }, cartRoot, { timeout: 5000 });
    const settleStep = () => page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && !['pricing', 'paying'].includes(el.getAttribute('data-state') ?? '');
    }, root, { timeout: 5000 });
    /** The order's page has read its order: asked, and answered and drawn — or, with no order on the address, said. */
    const settleOrder = (on = page) => on.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      const state = el?.getAttribute('data-state');
      return el?.getAttribute('data-jtk-wired') === '1' && state !== null && state !== 'loading' && (new URLSearchParams(location.search).get('order') === null || el.hasAttribute('data-asked'));
    }, orderRoot, { timeout: 5000 });
    /** The shop has been asked, and has answered, this many times. */
    const askedTimes = (n) => page.waitForFunction(({ sel, n }) => document.querySelector(sel)?.getAttribute('data-asked') === String(n), { sel: orderRoot, n }, { timeout: 5000 });

    /** From the cart's page: *To checkout*, the buyer's details, *Pay* — the shop's own pay page, and the body the press sent. */
    const through = async (email) => {
      await page.waitForSelector(`${cartRoot} [data-to-checkout]:not([disabled])`, { timeout: 5000 });
      await page.focus(`${cartRoot} [data-to-checkout]`);
      await page.keyboard.press('Enter');
      await settleStep();
      for (const [name, value] of [['name', 'Ada Lovelace'], ['email', email], ['line1', 'Bahnhofstrasse 1'], ['postal_code', '8001'], ['city', 'Zürich']]) {
        await page.locator(`${root} [name="${name}"]`).fill(value);
      }
      const from = checkouts.length;
      await page.focus(`${root} [data-pay]`);
      await page.keyboard.press('Enter');
      await page.waitForURL((url) => url.pathname.endsWith('/dev-pay'), { timeout: 5000 })
        .catch(() => stuck('order: Pay reaches the shop\'s own pay page', `the buyer is at ${page.url()}, ${checkouts.length - from} request(s) to the checkout`));
      return { body: checkouts[from], token: new URL(page.url()).searchParams.get('order') ?? '' };
    };
    /** The buyer's cart put in, the cart's page, and through it. */
    const buy = async (email) => {
      await put(cart);
      await page.goto(at, { waitUntil: 'networkidle' });
      await settleCart();
      return through(email);
    };
    /** On the shop's own pay page: *Pay* or *Leave*, and the order's page the buyer is sent back to, with its answer read. */
    const choose = async (which) => {
      await page.locator('button[type=submit]').nth(which === 'pay' ? 0 : 1).focus();
      await page.keyboard.press('Enter');
      await page.waitForURL((url) => url.pathname === back, { timeout: 5000 })
        .catch(() => stuck('order: the shop\'s pay page sends the buyer back to the order\'s page', `${which} pressed, the buyer is at ${page.url()}`));
      await settleOrder();
    };
    /** What the order's page draws now, as data. */
    const read = (on = page) => on.evaluate(({ sel, k }) => {
      const r = /** @type {HTMLElement} */ (document.querySelector(sel));
      const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length > 0);
      const link = (el) => ({ shown: shown(el), href: el?.getAttribute('href') ?? null, text: text(el), tag: el?.tagName.toLowerCase() ?? '' });
      const said = r.querySelector('[data-order-state]');
      let cart;
      try {
        cart = JSON.parse(localStorage.getItem(k) ?? 'null');
      } catch {
        cart = 'unreadable';
      }
      return {
        state: r.dataset.state ?? '',
        asked: r.dataset.asked ?? '',
        busy: r.hasAttribute('aria-busy'),
        said: { text: text(said), role: said?.getAttribute('role') ?? '' },
        number: { shown: shown(r.querySelector('[data-order-number]')), text: text(r.querySelector('[data-order-number]')) },
        rows: [...r.querySelectorAll('[data-order-line]')].map((row) => ({
          title: text(row.querySelector('[data-order-line-title]')),
          labels: text(row.querySelector('[data-order-line-labels]')),
          answers: [...row.querySelectorAll('[data-order-line-answer]')].map(text),
          qty: text(row.querySelector('[data-order-line-qty]')),
          total: text(row.querySelector('[data-order-line-total]')),
        })),
        total: text(r.querySelector('[data-order-total]')),
        method: text(r.querySelector('[data-order-method]')),
        again: link(r.querySelector('[data-pay-again]')),
        back: link(r.querySelector('[data-back-to-cart]')),
        cart,
      };
    }, { sel: orderRoot, k: key });
    /** What a customization a frozen line answers says: «Engraving: Ada (+ CHF 5)». */
    const answerSaid = (one, say) => {
      const value = one.ticked === true ? W.yes : typeof one.text === 'string' && one.text !== '' ? one.text : String(one.label ?? '');
      return `${one.name}: ${value}${one.adds ? ` (+ ${say(one.adds)})` : ''}`;
    };
    /** Whether the page draws the order as the shop froze it: each line, what they came to, and the method with what it cost. */
    const drawnAs = (now, truth) => {
      const say = (minor) => money(minor, truth.currency, locale);
      const expected = truth.lines.map((one) => ({ title: one.title, labels: one.labels.join(' · '), answers: one.answers.map((a) => answerSaid(a, say)), qty: `${W.quantity}: ${one.qty}`, total: say(one.total) }));
      const method = `${truth.method}: ${truth.shipping === 0 ? W.free : say(truth.shipping)}`;
      const total = say(truth.total);
      const rows = expected.length === now.rows.length && expected.every((one, i) => ['title', 'labels', 'qty', 'total'].every((k) => same(one[k], now.rows[i][k])) && same(one.answers.join(' | '), now.rows[i].answers.join(' | ')));
      return {
        ok: expected.length > 0 && rows && same(total, now.total) && same(method, now.method),
        said: `${now.rows.length} line(s) of the shop's ${expected.length}${now.rows.length > 0 ? ` (${now.rows.map((one) => `«${one.title}» ${one.qty} ${one.total}${one.answers.length > 0 ? ` ${one.answers.join(', ')}` : ''}`).join('; ')})` : ''}, total «${now.total}» (the shop's ${total}), method «${now.method}» (the shop's ${method})`,
      };
    };
    const cartIs = (now, expected) => JSON.stringify(now.cart) === JSON.stringify(expected);

    // ── the first order, paid on the shop's pay page ─────────────────────────
    const o1 = await buy('ada@example.ch');
    await choose('pay');
    const truth1 = await theirs(o1.token);
    const now1 = await read();
    const drawn1 = drawnAs(now1, truth1 ?? { lines: [] });
    found.push({
      check: "order: paid — the page says so as a status with the order's number, draws its lines, what they came to and the method as the shop froze them, and the cart is empty, the press having gone to Stripe from this tab (4.1.3, Rulings 195, 227)",
      ok: truth1?.state === 'paid' && Number.isInteger(truth1.number) && truth1.number >= 1001 && now1.state === 'paid' && !now1.busy && same(now1.said.text, W['state.paid']) && now1.said.role === 'status'
        && now1.number.shown && same(now1.number.text, W.orderNumber.replace('{number}', () => String(truth1.number))) && drawn1.ok && !now1.again.shown && !now1.back.shown && now1.cart === null,
      said: `${now1.state}, «${now1.said.text}», ${now1.number.shown ? `«${now1.number.text}»` : 'no number'} (the shop's ${truth1?.number}); ${drawn1.said}; the cart ${now1.cart === null ? 'empty' : 'still holds a line'} (it had ${cart.lines.length})`,
    });
    states.push({ state: 'order: paid', violations: await scan() });

    // ── the cart is emptied for the press that went to Stripe from this tab, and for no other (Ruling 227) ─
    // The same page opened again in this tab, with a new cart in the browser: the mark was spent with the first reading.
    await put(cart);
    await page.reload({ waitUntil: 'networkidle' });
    await settleOrder();
    const again1 = await read();
    found.push({
      check: "order: a paid order's page opened again in the same tab keeps the cart — the mark of the press that went to Stripe was spent with the first reading (Ruling 227)",
      ok: cart.lines.length > 0 && now1.cart === null && again1.state === 'paid' && same(again1.said.text, W['state.paid']) && again1.number.shown && cartIs(again1, cart),
      said: `${again1.state}, «${again1.said.text}»; the cart ${cartIs(again1, cart) ? 'kept' : `not as it was: ${JSON.stringify(again1.cart)}`} (the first reading emptied one of ${cart.lines.length} line(s))`,
    });
    // The same order's link in another tab — another device is the same, for it has no mark — with the same cart in the browser.
    const elsewhere = await page.context().newPage();
    await elsewhere.goto(`${origin}${back}?order=${encodeURIComponent(o1.token)}`, { waitUntil: 'networkidle' });
    await settleOrder(elsewhere);
    const there = await read(elsewhere);
    await elsewhere.close();
    found.push({
      check: "order: a paid order's link opened in another tab is read as paid, and keeps the cart there — nothing in that tab says its press went to Stripe (Ruling 227)",
      ok: cart.lines.length > 0 && there.state === 'paid' && same(there.said.text, W['state.paid']) && there.number.shown && same(there.number.text, W.orderNumber.replace('{number}', () => String(truth1?.number))) && drawnAs(there, truth1 ?? { lines: [] }).ok && cartIs(there, cart),
      said: `${there.state}, «${there.said.text}», ${there.number.shown ? `«${there.number.text}»` : 'no number'}; the cart ${cartIs(there, cart) ? 'kept' : `not as it was: ${JSON.stringify(there.cart)}`}`,
    });

    // ── the second, left on the shop's pay page ──────────────────────────────
    // Another buyer's details than the first order's: a press is for one body, so the second is a press of its own even where the first
    // was not forgotten — and the third, on the second's body, is the one a press kept would show.
    const o2 = await buy('grace@example.ch');
    await choose('leave');
    const truth2 = await theirs(o2.token);
    const now2 = await read();
    const drawn2 = drawnAs(now2, truth2 ?? { lines: [] });
    const at2 = new URL(page.url());
    found.push({
      check: "order: back from Stripe's page without paying — the page says so, offers Stripe's page again as a link to it, offers the cart, and the cart is kept (4.1.3, Ruling 195)",
      ok: at2.pathname === back && at2.searchParams.get('left') === '1' && at2.searchParams.get('order') === o2.token && truth2?.state === 'waiting' && typeof truth2.pay_url === 'string'
        && now2.state === 'waiting' && same(now2.said.text, W['state.left']) && now2.said.role === 'status' && !now2.number.shown && drawn2.ok
        && now2.again.shown && now2.again.tag === 'a' && now2.again.href === truth2.pay_url && same(now2.again.text, W.payAgain)
        && now2.back.shown && now2.back.tag === 'a' && now2.back.href === cartPath && same(now2.back.text, W.backToCart) && cartIs(now2, cart),
      said: `${at2.pathname}${at2.search}: ${now2.state}, «${now2.said.text}»; Back to paying ${now2.again.shown ? `«${now2.again.text}» → ${now2.again.href}` : 'not offered'} (the shop's ${truth2?.pay_url}); to the cart ${now2.back.shown ? `«${now2.back.text}» → ${now2.back.href}` : 'not offered'}; ${drawn2.said}; the cart ${cartIs(now2, cart) ? 'kept' : `not as it was: ${JSON.stringify(now2.cart)}`}`,
    });
    states.push({ state: 'order: left Stripe\'s page', violations: await scan() });

    // ── Back to paying goes there; and back again ────────────────────────────
    await page.focus(`${orderRoot} [data-pay-again]`);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.href === truth2?.pay_url, { timeout: 5000 }).catch(() => undefined);
    const atPay = page.url();
    const buttons = await page.locator('button[type=submit]').count();
    found.push({
      check: "order: Back to paying, by the keyboard, goes to the shop's own pay page for the order (Ruling 195)",
      ok: typeof truth2?.pay_url === 'string' && atPay === truth2.pay_url && buttons === 2,
      said: `the buyer is at ${atPay} (the shop's ${truth2?.pay_url}), ${buttons} button(s) there`,
    });
    if (atPay !== truth2?.pay_url) stuck('order: Back to paying reaches the shop\'s pay page, to leave it again', `the buyer is at ${atPay}`);
    await choose('leave');

    // ── Back to your cart: the cart in this language, as it was left ─────────
    await page.focus(`${orderRoot} [data-back-to-cart]`);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.pathname === cartPath, { timeout: 5000 }).catch(() => undefined);
    await settleCart().catch(() => undefined);
    const inCart = await page.locator(`${cartRoot} [data-cart-line]`).count();
    const kept = await stored();
    found.push({
      check: "order: Back to your cart, by the keyboard, goes to the cart in this page's language, with the cart as it was left (Ruling 195)",
      ok: new URL(page.url()).pathname === cartPath && inCart === cart.lines.length && JSON.stringify(kept) === JSON.stringify(cart),
      said: `${new URL(page.url()).pathname}: ${inCart} line(s) drawn of the cart's ${cart.lines.length}; the cart ${JSON.stringify(kept) === JSON.stringify(cart) ? 'kept' : `not as it was: ${JSON.stringify(kept)}`}`,
    });
    if (new URL(page.url()).pathname !== cartPath) stuck('order: Back to your cart reaches the cart, to press again', `the buyer is at ${page.url()}`);

    // ── the third, pressed from that cart: a new order ───────────────────────
    const o3 = await through('grace@example.ch');
    const again = await postShop('checkout', o2.body);
    const a2 = String(o2.body?.attempt ?? '');
    const a3 = String(o3.body?.attempt ?? '');
    found.push({
      check: "order: a press after the buyer left Stripe's page is a new order — a new attempt, and another token than the second's, which the shop would have answered again for the attempt kept (Ruling 92)",
      ok: ATTEMPT.test(a2) && ATTEMPT.test(a3) && a3 !== a2 && o3.token !== '' && o3.token !== o2.token && again.status === 201 && again.body?.order === o2.token,
      said: `attempts ${a2} then ${a3 === a2 ? 'the same' : a3}; orders ${o2.token} then ${o3.token === o2.token ? 'the same' : o3.token}; the second's attempt asked again answers ${again.status} for ${again.body?.order}`,
    });
    const truth3 = await theirs(o3.token);

    // ── a browser that will not let the page empty the cart, or will not say whether the order is this tab's ─
    // Each on a page of its own — an init script cannot be taken back. First a tab the press went to Stripe from — the walk writes the
    // mark the checkout would have — whose `localStorage` throws: the order is shown paid, the buyer is told the cart could not be
    // emptied, and the console says why.
    const blocked = await page.context().newPage();
    /** @type {string[]} */
    const errors = [];
    blocked.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await blocked.addInitScript(({ mark, token }) => {
      sessionStorage.setItem(mark, token);
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('The site\'s data is blocked', 'SecurityError'); } });
    }, { mark: paidFromKey(api), token: o1.token });
    await blocked.goto(`${origin}${back}?order=${encodeURIComponent(o1.token)}`, { waitUntil: 'networkidle' });
    await settleOrder(blocked);
    const noStorage = await read(blocked);
    await blocked.close();
    found.push({
      check: "order: a browser that will not let the page empty the cart is told so beside what the order is, which is still shown paid, and the console says why (3.3.1, 4.1.3)",
      ok: truth1?.state === 'paid' && noStorage.state === 'paid' && same(noStorage.said.text, `${W['state.paid']}. ${W.orderCartKept}`) && noStorage.number.shown && drawnAs(noStorage, truth1).ok
        && errors.some((one) => /would not let this page empty the cart/.test(one)),
      said: `${noStorage.state}, «${noStorage.said.text}»; the console: ${errors.filter((one) => /empty the cart/.test(one)).join(' | ') || 'nothing about the cart'}`,
    });
    // Then a tab whose `sessionStorage` throws: it cannot say whether its press sent the buyer to pay for this order, so the cart is
    // kept — the cart of the browser, which it can read — and the buyer is told, and the console says why.
    const unsure = await page.context().newPage();
    /** @type {string[]} */
    const unsureErrors = [];
    unsure.on('console', (message) => message.type() === 'error' && unsureErrors.push(message.text()));
    await unsure.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => { throw new DOMException('The site\'s data is blocked', 'SecurityError'); } });
    });
    await put(cart);
    await unsure.goto(`${origin}${back}?order=${encodeURIComponent(o1.token)}`, { waitUntil: 'networkidle' });
    await settleOrder(unsure);
    const unsureNow = await read(unsure);
    await unsure.close();
    found.push({
      check: "order: a browser that will not say whether the order is this tab's keeps the cart, says so beside what the order is, which is still shown paid, and the console says why (3.3.1, 4.1.3, Ruling 227)",
      ok: cart.lines.length > 0 && unsureNow.state === 'paid' && same(unsureNow.said.text, `${W['state.paid']}. ${W.orderCartKept}`) && unsureNow.number.shown && cartIs(unsureNow, cart)
        && unsureErrors.some((one) => /would not say whether this tab sent the buyer/.test(one)),
      said: `${unsureNow.state}, «${unsureNow.said.text}»; the cart ${cartIs(unsureNow, cart) ? 'kept' : `not as it was: ${JSON.stringify(unsureNow.cart)}`}; the console: ${unsureErrors.filter((one) => /whether this tab/.test(one)).join(' | ') || 'nothing about the mark'}`,
    });

    // ── the page's clock in the walk's hands ─────────────────────────────────
    await page.addInitScript(() => {
      const real = window.fetch;
      /** @type {any} */ (window).__jtkAsked = 0;
      window.fetch = function (input, ...rest) {
        if (String(/** @type {any} */ (input)?.url ?? input).includes('/order?')) /** @type {any} */ (window).__jtkAsked += 1;
        return real.call(this, input, ...rest);
      };
    });
    await page.clock.install();
    /** The order's page for a query, the buyer's cart in the browser, time stopped. */
    const visit = async (search) => {
      await put(cart);
      await pauseClock(page);
      await page.goto(`${origin}${back}${search}`, { waitUntil: 'networkidle' });
      await settleOrder();
    };
    /** axe reads the page as it is: with time running again — axe waits on timers of its own. */
    const axeNow = async (state) => {
      await page.clock.resume();
      states.push({ state, violations: await scan() });
    };
    const asks = () => page.evaluate(() => /** @type {any} */ (window).__jtkAsked ?? 0);
    const now = () => page.evaluate(() => Date.now());
    /** Time runs this many asks' worth: the timers that are due fire. */
    const tick = (times) => page.clock.runFor(ASK_EVERY_MS * times);
    const showing = (hidden) => page.evaluate((hide) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hide });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hide ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    const token = encodeURIComponent(o3.token);

    // A buyer who has just paid, waiting for Stripe to say: told so, and offered no way to the cart yet.
    await visit(`?order=${token}`);
    const waiting = await read();
    found.push({
      check: 'order: a buyer who has just paid and waits for Stripe to say is told it is waiting, and offered Stripe\'s page, and no way back to the cart (4.1.3)',
      ok: waiting.state === 'waiting' && same(waiting.said.text, W['state.waiting']) && waiting.again.shown && waiting.again.href === truth3?.pay_url && !waiting.back.shown && !waiting.number.shown && cartIs(waiting, cart),
      said: `${waiting.state}, «${waiting.said.text}»; Back to paying ${waiting.again.shown ? `→ ${waiting.again.href}` : 'not offered'}; to the cart ${waiting.back.shown ? 'offered' : 'not offered'}; the cart ${cartIs(waiting, cart) ? 'kept' : 'not as it was'}`,
    });
    await axeNow('order: waiting');

    // ── a hidden tab asks nothing; a tab shown again asks once, and goes on ──
    await visit(`?order=${token}&left=1`);
    const loaded = await asks();
    const beforeHiding = await read();
    const hiddenFrom = await now();
    await showing(true);
    await tick(4);
    const whileHidden = { sent: await asks(), asked: (await read()).asked, passed: (await now()) - hiddenFrom };
    found.push({
      check: 'order: a hidden tab asks the shop nothing, however long it stays hidden',
      ok: beforeHiding.state === 'waiting' && same(beforeHiding.said.text, W['state.left']) && loaded === 1 && whileHidden.passed === ASK_EVERY_MS * 4 && whileHidden.sent === 1 && whileHidden.asked === '1',
      said: `${beforeHiding.state}, «${beforeHiding.said.text}», asked ${loaded}× as the page loaded; the tab hidden for ${whileHidden.passed / 1000} s, in which a visible tab would have asked 4× more: ${whileHidden.sent} ask(s) in all, ${whileHidden.asked} answered`,
    });
    // Hidden and shown again, three times over: one ask, and then one every three seconds — a single loop, however often it was shown.
    await showing(false);
    await showing(true);
    await showing(false);
    await askedTimes(2);
    const afterShown = await asks();
    await tick(1);
    await askedTimes(3);
    const oneTick = await asks();
    await tick(1);
    await askedTimes(4);
    const twoTicks = await asks();
    found.push({
      check: 'order: a tab shown again asks once, however often it was hidden and shown, and then every three seconds — one loop, not several',
      ok: afterShown === 2 && oneTick === 3 && twoTicks === 4,
      said: `after being shown three times: ${afterShown} ask(s) in all; three seconds on: ${oneTick}; three more: ${twoTicks} (one loop asks once in each)`,
    });

    // ── two minutes of asking, and then said and stopped ─────────────────────
    for (let n = 5; n <= ASKS_MOST - 1; n += 1) {
      await tick(1);
      await askedTimes(n);
    }
    const before = await read();
    const sentBefore = await asks();
    await tick(1);
    await askedTimes(ASKS_MOST);
    const stopped = await read();
    const sentStopped = await asks();
    const drawn3 = drawnAs(stopped, truth3 ?? { lines: [] });
    found.push({
      check: "order: after two minutes of asking — forty asks, every three seconds — the page says the order is still waiting and stops, with Stripe's page and the cart offered, and the cart kept (4.1.3, Ruling 195)",
      ok: before.state === 'waiting' && same(before.said.text, W['state.left']) && sentBefore === ASKS_MOST - 1
        && stopped.state === 'stopped' && same(stopped.said.text, W['state.stillWaiting']) && stopped.asked === String(ASKS_MOST) && sentStopped === ASKS_MOST
        && stopped.again.shown && stopped.again.href === truth3?.pay_url && stopped.back.shown && stopped.back.href === cartPath && drawn3.ok && cartIs(stopped, cart),
      said: `at ${sentBefore} asks ${before.state} «${before.said.text}»; at ${sentStopped} ${stopped.state} «${stopped.said.text}»; Back to paying ${stopped.again.shown ? `→ ${stopped.again.href}` : 'not offered'}; to the cart ${stopped.back.shown ? 'offered' : 'not offered'}; ${drawn3.said}; the cart ${cartIs(stopped, cart) ? 'kept' : 'not as it was'}`,
    });
    // Stopped is stopped: a long time on, the tab hidden and shown, a page restored from the browser's cache — no ask.
    await tick(40);
    await showing(true);
    await showing(false);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await tick(40);
    const lateSent = await asks();
    const late = await read();
    found.push({
      check: 'order: a page that has stopped asking asks no more — not as time goes on, not when the tab is hidden and shown, not when the browser restores the page',
      ok: lateSent === ASKS_MOST && late.asked === String(ASKS_MOST) && late.state === 'stopped',
      said: `${ASKS_MOST} ask(s) when it stopped; after ${ASK_EVERY_MS * 80 / 1000} s more, the tab hidden and shown and the page restored: ${lateSent} in all, ${late.asked} answered, ${late.state}`,
    });
    await axeNow('order: still waiting, stopped');

    // ── the answers the shop's stand-in never gives — made by holding the page's own request ─
    /** @type {any} */
    let faked = null;
    /** The next this many asks are held, and never answered. */
    let stalled = 0;
    await page.route((url) => url.pathname === `${api}order` && url.searchParams.has('token'), (route) => {
      if (stalled > 0) {
        stalled -= 1;
        return undefined;
      }
      return faked === null ? route.continue() : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(faked) });
    });

    // ── a request that never answers (Ruling 228) ────────────────────────────
    // The first ask is held: the page is loading, and at its deadline it counts as no answer — waiting, as it says — and the page
    // asks again, and draws the shop's answer when it comes.
    /** The page's next load, its first ask held where it is: not waited for, since the ask never answers. */
    const visitHeld = async () => {
      await put(cart);
      await pauseClock(page);
      await page.goto(`${origin}${back}?order=${token}&left=1`, { waitUntil: 'domcontentloaded' });
    };
    const asksSent = (n) => page.waitForFunction((count) => /** @type {any} */ (window).__jtkAsked === count, n, { timeout: 5000 });
    stalled = 1;
    await visitHeld();
    await asksSent(1);
    const held = await read();
    await page.clock.runFor(ASK_DEADLINE_MS);
    await askedTimes(1);
    const givenUp = await read();
    const sentGivenUp = await asks();
    await tick(1);
    await askedTimes(2);
    const answeredAfter = await read();
    found.push({
      check: 'order: a request that never answers is given up at its deadline and counts as no answer — the page says it is waiting, asks again, and draws the shop\'s answer when it comes (Ruling 228)',
      ok: held.state === 'loading' && held.busy && same(held.said.text, W.loading) && givenUp.state === 'waiting' && !givenUp.busy && same(givenUp.said.text, W['state.left']) && !givenUp.again.shown && givenUp.asked === '1' && sentGivenUp === 1
        && answeredAfter.state === 'waiting' && answeredAfter.asked === '2' && answeredAfter.again.shown && answeredAfter.again.href === truth3?.pay_url && drawnAs(answeredAfter, truth3 ?? { lines: [] }).ok && (await asks()) === 2,
      said: `held: ${held.state}${held.busy ? ' (busy)' : ''}; after ${ASK_DEADLINE_MS / 1000} s: ${givenUp.state}, «${givenUp.said.text}», ${givenUp.asked || 'no'} answered; next ask: ${answeredAfter.state}, Back to paying ${answeredAfter.again.shown ? `→ ${answeredAfter.again.href}` : 'not offered'}, ${answeredAfter.asked} answered`,
    });
    // Not one of the forty asks is ever answered: the loop goes on, each ask given up at its deadline, and the stop is reached.
    stalled = ASKS_MOST;
    await visitHeld();
    for (let n = 1; n <= ASKS_MOST; n += 1) {
      await asksSent(n);
      await page.clock.runFor(ASK_DEADLINE_MS);
      await askedTimes(n);
      if (n < ASKS_MOST) await tick(1);
    }
    const never = await read();
    const sentNever = await asks();
    await tick(40);
    found.push({
      check: 'order: asks that never answer end in the stop all the same — forty asks, each given up at its deadline, and then said and stopped (Ruling 228)',
      ok: never.state === 'stopped' && same(never.said.text, W['state.stillWaiting']) && never.asked === String(ASKS_MOST) && sentNever === ASKS_MOST && never.back.shown && !never.again.shown && (await asks()) === ASKS_MOST,
      said: `${never.state}, «${never.said.text}»; ${sentNever} ask(s) sent, ${never.asked} given up; ${await asks()} in all after ${ASK_EVERY_MS * 40 / 1000} s more`,
    });

    // ── lapsed, cancelled — and what a customization says — and a paid answer with no lines ─
    stalled = 0;
    /** What a state that is not waiting did: read once the clock has run well past three asks' time. */
    const settled = [];
    const lone = async (label) => {
      await tick(5);
      const now = await read();
      settled.push({ label, state: now.state, sent: await asks(), asked: now.asked, kept: cartIs(now, cart) });
    };
    // Paid, again — in this tab, whose mark is the third order's and not this one's: read paid, and the cart is kept.
    await visit(`?order=${encodeURIComponent(o1.token)}`);
    await lone('paid');

    faked = { ...truth2, state: 'lapsed' };
    await visit(`?order=${token}`);
    await lone('lapsed');
    const lapsed = await read();
    const drawnLapsed = drawnAs(lapsed, faked);
    found.push({
      check: "order: a lapsed order is said, draws what was frozen, offers no Stripe's page though the answer carries one, and the cart is kept to pay again (4.1.3, Ruling 195)",
      ok: typeof faked.pay_url === 'string' && lapsed.state === 'lapsed' && same(lapsed.said.text, W['state.lapsed']) && drawnLapsed.ok && !lapsed.number.shown && !lapsed.again.shown && lapsed.back.shown && lapsed.back.href === cartPath && cartIs(lapsed, cart),
      said: `${lapsed.state}, «${lapsed.said.text}»; Back to paying ${lapsed.again.shown ? 'offered' : 'not offered'} (the answer carried ${faked.pay_url}); to the cart ${lapsed.back.shown ? 'offered' : 'not offered'}; ${drawnLapsed.said}; the cart ${cartIs(lapsed, cart) ? 'kept' : 'not as it was'}`,
    });
    await axeNow('order: lapsed');

    faked = {
      ...truth1,
      state: 'cancelled',
      lines: truth1.lines.map((line, i) => (i === 0 ? { ...line, answers: [{ key: 'tag', name: 'Gravur', text: 'Ada', adds: 500 }, { key: 'gift', name: 'Geschenk', ticked: true, adds: 0 }] } : line)),
    };
    await visit(`?order=${token}`);
    await lone('cancelled');
    const cancelled = await read();
    const drawnCancelled = drawnAs(cancelled, faked);
    found.push({
      check: "order: a cancelled order is said with the number it had, draws what was frozen with what each customization answered, and the cart is kept (4.1.3, Ruling 195)",
      ok: cancelled.state === 'cancelled' && same(cancelled.said.text, W['state.cancelled']) && cancelled.number.shown && same(cancelled.number.text, W.orderNumber.replace('{number}', () => String(faked.number)))
        && drawnCancelled.ok && cancelled.rows[0]?.answers.length === 2 && !cancelled.again.shown && cancelled.back.shown && cartIs(cancelled, cart),
      said: `${cancelled.state}, «${cancelled.said.text}», ${cancelled.number.shown ? `«${cancelled.number.text}»` : 'no number'}; ${drawnCancelled.said}; the cart ${cartIs(cancelled, cart) ? 'kept' : 'not as it was'}`,
    });
    await axeNow('order: cancelled');

    // A paid answer with no lines — the number is the buyer's reference, and does not wait on them. A token this tab did not send
    // the buyer to pay for: the cart is kept.
    faked = { state: 'paid', number: 1002 };
    await visit('?order=walk-paid-with-no-lines');
    const bare = await read();
    found.push({
      check: "order: a paid answer with no lines still says it is paid and shows the order's number (4.1.3, Ruling 228)",
      ok: bare.state === 'paid' && same(bare.said.text, W['state.paid']) && bare.number.shown && same(bare.number.text, W.orderNumber.replace('{number}', () => '1002')) && bare.rows.length === 0 && cartIs(bare, cart),
      said: `${bare.state}, «${bare.said.text}», ${bare.number.shown ? `«${bare.number.text}»` : 'no number'}; ${bare.rows.length} line(s); the cart ${cartIs(bare, cart) ? 'kept' : 'not as it was'}`,
    });

    // A token that is nobody's: the shop says 404, and the page says so and asks nothing more.
    faked = null;
    await visit('?order=walk-nobody-has-this-order');
    await lone('unknown');
    const unknown = await read();
    found.push({
      check: "order: a token that is nobody's is said so, draws no order, offers the cart, and leaves the cart as it is (4.1.3, Ruling 195)",
      ok: unknown.state === 'unknown' && same(unknown.said.text, W['state.unknown']) && unknown.rows.length === 0 && unknown.total === '' && unknown.method === '' && !unknown.number.shown && !unknown.again.shown
        && unknown.back.shown && unknown.back.href === cartPath && cartIs(unknown, cart),
      said: `${unknown.state}, «${unknown.said.text}»; ${unknown.rows.length} line(s), total «${unknown.total}»; Back to paying ${unknown.again.shown ? 'offered' : 'not offered'}; to the cart ${unknown.back.shown ? 'offered' : 'not offered'}; the cart ${cartIs(unknown, cart) ? 'kept' : 'not as it was'}`,
    });
    await axeNow('order: not found');

    found.push({
      check: 'order: an order that is paid, lapsed, cancelled or not found is asked after once, and is what it was said to be, the cart kept — time running well past three asks, no more',
      ok: settled.length === 4 && settled.every((one) => one.state === one.label && one.sent === 1 && one.asked === '1' && one.kept),
      said: settled.map((one) => `${one.label}: ${one.state}, ${one.sent} ask(s), ${one.asked} answered, the cart ${one.kept ? 'kept' : 'not as it was'}`).join('; '),
    });
  }
}

/**
 * The page after payment opened with no order on its address, as `jtk a11y`
 * reads `/order/` and `/en/order/`: it says no order was found, asks the shop
 * nothing — no request for an order was made — and leaves the cart as it is,
 * though there is one: a cart is written first, and it is there after the page
 * has been loaded again. axe reads it. It asks the shop nothing by design: said
 * `quiet`.
 * @param {import('playwright-core').Page} page a page of its own, at the order page's address
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 */
export async function driveOrderWithNone(page, scan) {
  const states = [];
  const found = [];
  const root = '[data-order]';
  const { api, locale } = await page.evaluate((sel) => {
    const el = /** @type {HTMLElement} */ (document.querySelector(sel));
    return { api: el.dataset.api ?? '/api/', locale: el.dataset.locale ?? 'en' };
  }, root);
  const W = shopWordsFor(locale);
  const key = `jtk:cart:${api}`;
  const cart = { v: 1, lines: [{ product: 'walk-product', variant: 'walk-variant', qty: 1, answers: {} }], country: '', method: '' };
  const settle = () => page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('data-jtk-wired') === '1' && el.getAttribute('data-state') === 'unknown';
  }, root, { timeout: 5000 });
  await settle();
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  // The buyer has a cart: the page, loaded again, leaves it be.
  await page.evaluate(({ k, value }) => localStorage.setItem(k, JSON.stringify(value)), { k: key, value: cart });
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await settle();
    const now = await page.evaluate(({ sel, k, address }) => {
      const r = /** @type {HTMLElement} */ (document.querySelector(sel));
      const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length > 0);
      return {
        said: text(r.querySelector('[data-order-state]')),
        role: r.querySelector('[data-order-state]')?.getAttribute('role') ?? '',
        asked: r.dataset.asked ?? '',
        busy: r.hasAttribute('aria-busy'),
        rows: r.querySelectorAll('[data-order-line]').length,
        again: shown(r.querySelector('[data-pay-again]')),
        back: shown(r.querySelector('[data-back-to-cart]')),
        requests: performance.getEntriesByType('resource').filter((one) => new URL(one.name).pathname === address).length,
        cart: localStorage.getItem(k),
      };
    }, { sel: root, k: key, address: `${api}order` });
    found.push({
      check: 'order: an address with no order says no order was found, asks the shop nothing, and leaves the cart as it is (4.1.3, Ruling 195)',
      ok: same(now.said, W['state.unknown']) && now.role === 'status' && !now.busy && now.asked === '' && now.requests === 0 && now.rows === 0 && !now.again && now.back && now.cart === JSON.stringify(cart),
      said: `«${now.said}»; ${now.requests} request(s) for an order, ${now.asked === '' ? 'none answered' : `${now.asked} answered`}; the cart ${now.cart === JSON.stringify(cart) ? 'as it was' : `not as it was: ${now.cart}`}`,
    });
    states.push({ state: 'order: no order on the address', violations: await scan() });
  } finally {
    await page.evaluate(({ k, was }) => (was === null ? localStorage.removeItem(k) : localStorage.setItem(k, was)), { k: key, was: before }).catch(() => undefined);
  }
  return { states, found, quiet: true };
}

/**
 * The products' listing, driven (jtakeit-core wiki/102 stage 9, Ruling 195): every tile
 * says its product, links to its page and says its lowest price on sale as the product's own
 * page does; and then, by whether the listing says `data-hide-sold-out`:
 *
 *   - where it does not, the listing asks the shop nothing and hides nothing, even where the
 *     shop says everything is sold out — the page's own request is answered so, by the walk;
 *   - where it does, once the page has loaded the tiles the shop says nobody can buy are
 *     `hidden` and the others are not — the shop asked the same question by the walk (`x-jtk-walk`),
 *     read by the walk's own rule — the built page still lists every product, a group made
 *     empty by hiding is `hidden` with its heading, the keyboard reaches the tiles shown and
 *     none that is hidden, and axe reads the page as it is. Then a shop that cannot be asked
 *     — the network gone, a sentence, a gateway's page, an answer that never comes — hides
 *     nothing, and a page of more than a hundred products asks a hundred at a time, each once.
 *
 * What a page has not got — a group made empty by hiding, a product the shop says is sold
 * out — is not driven, and its check not said: a walk that must reach one says which
 * (test/a11y-shop.mjs). The drive asks the shop nothing where the listing does not hide: said
 * `quiet`.
 * @param {import('playwright-core').Page} page a page of its own, at the listing's address
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 */
export async function driveListing(page, scan) {
  const states = [];
  const found = [];
  const root = '[data-listing]';
  const here = page.url();
  const origin = new URL(here).origin;
  /** Wired, and the shop asked and answered where the listing asks it. */
  const wired = () => page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-jtk-wired') === '1', root, { timeout: 5000 });
  await wired();
  const { api, hides, locale } = await page.evaluate((sel) => {
    const el = /** @type {HTMLElement} */ (document.querySelector(sel));
    return { api: el.dataset.api ?? '/api/', hides: el.hasAttribute('data-hide-sold-out'), locale: el.dataset.locale ?? 'en' };
  }, root);
  const W = shopWordsFor(locale);
  /** The listing as it is now: the tiles in the order drawn, and the groups with what each holds. */
  const read = () => page.evaluate((sel) => {
    const r = /** @type {HTMLElement} */ (document.querySelector(sel));
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const price = (tile) => tile.querySelector('[data-jtk-path$=".price"]');
    const empty = r.querySelector('[data-listing-empty]');
    return {
      stock: r.getAttribute('data-stock-read'),
      // The sentence for a listing hiding leaves empty: where the page has the place for it, whether it is shown and what it says.
      empty: { present: empty !== null, shown: empty !== null && !empty.hasAttribute('hidden'), said: text(empty), role: empty?.getAttribute('role') ?? '' },
      // Every heading of the listing outside a tile, and whether it is left showing (no hidden ancestor).
      headings: [...r.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => h.closest('[data-product-tile]') === null).map((h) => ({ text: text(h), shown: h.closest('[hidden]') === null })),
      tiles: [...r.querySelectorAll('[data-product-tile]')].map((tile) => {
        const title = text(tile.querySelector('h1, h2, h3, h4, h5, h6'));
        return {
          id: tile.getAttribute('data-product') ?? '',
          title,
          href: tile.querySelector('a[href]')?.getAttribute('href') ?? '',
          // Its price, where the build annotated it; else what the tile says beside its title.
          said: price(tile) === null ? text(tile).replace(title, '').trim() : text(price(tile)),
          hidden: tile.hasAttribute('hidden'),
          display: getComputedStyle(tile).display,
          links: [...tile.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
        };
      }),
      groups: [...r.querySelectorAll('[data-listing-group]')].map((group) => {
        const own = [...group.querySelectorAll('[data-product-tile]')];
        return {
          hidden: group.hasAttribute('hidden'),
          heading: text([...group.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((h) => h.closest('[data-product-tile]') === null)),
          tiles: own.length,
          shown: own.filter((tile) => !tile.hasAttribute('hidden')).length,
        };
      }),
    };
  }, root);
  const first = await read();

  // The listing as the build wrote it, which a crawler and a page without its script see: every tile, none hidden.
  const builtTiles = async (address = here) => {
    const html = await (await fetch(address)).text();
    return [...html.matchAll(/<[a-z]+\b[^>]*\sdata-product-tile(?=[\s>=])[^>]*>/g)].map((one) => ({ id: /\sdata-product="([^"]*)"/.exec(one[0])?.[1] ?? '', hidden: /\shidden(?=[\s>=])/.test(one[0]) }));
  };
  const built = await builtTiles();

  // Each tile, against the page of the product it links to: its lowest price on sale, as that page's own facts say it — and nothing
  // where the product has no variant on sale with a price.
  const lowest = [];
  for (const tile of first.tiles) {
    const product = await page.evaluate(async (href) => {
      const html = await (await fetch(href)).text();
      const form = new DOMParser().parseFromString(html, 'text/html').querySelector('form[data-product]');
      return form === null ? null : { facts: JSON.parse(form.getAttribute('data-facts') ?? 'null'), locale: form.getAttribute('data-locale') ?? 'en' };
    }, tile.href || '/');
    const prices = (product?.facts?.variants ?? []).filter((one) => one.onSale === true && Number.isInteger(one.price)).map((one) => one.price);
    const least = prices.length === 0 ? undefined : Math.min(...prices);
    const said = least === undefined ? '' : money(least, product.facts.currency, product.locale);
    lowest.push({ product: product !== null, says: least === undefined ? '' : new Set(prices).size > 1 ? priceWords(product.locale).from.replace('{amount}', () => said) : said });
  }
  found.push({
    check: "listing: every tile names its product, links to its page and says its lowest price on sale as that page's own facts do (2.4.4, 1.3.1)",
    ok: first.tiles.length > 0 && new Set(first.tiles.map((one) => one.id)).size === first.tiles.length
      && first.tiles.every((one, i) => one.id !== '' && one.title !== '' && one.href !== '' && lowest[i].product && same(one.said, lowest[i].says)),
    said: first.tiles.map((one, i) => `«${one.title}» ${one.id.slice(-4) || 'no id'} → ${one.href || 'no link'}${lowest[i].product ? '' : ' (no product page)'}, says «${one.said}», its page says «${lowest[i].says}»`).join('; ') || 'no tile',
    tiles: first.tiles.map((one) => ({ id: one.id, title: one.title })),
  });

  /** What the walk's own route says to the page's stock call, and what it counts. */
  let answerWith = null;
  let sent = 0;
  const stock = (url) => url.pathname === `${api}stock`;
  await page.route(stock, (route) => {
    sent += 1;
    return answerWith === null ? route.continue() : answerWith(route);
  });
  const reload = () => page.reload({ waitUntil: 'networkidle' }).then(wired);
  /**
   * Whether the listing has said what it did with the shop's answer — `data-stock-read`, any or the state given — within five
   * seconds: the event a check waits on. A listing that never says is a finding of the check whose subject it is, and not a thrown
   * timeout.
   */
  const stockSaid = (state) => page.waitForFunction(({ sel, state }) => {
    const value = document.querySelector(sel)?.getAttribute('data-stock-read');
    return state === undefined ? value !== null && value !== undefined : value === state;
  }, { sel: root, state }, { timeout: 5000 }).then(() => true, () => false);
  /** The shop's own answer for these products, asked by the walk, a hundred at a time. */
  const shopSays = async (ids) => {
    /** @type {Record<string, any>} */
    const said = {};
    for (let from = 0; from < ids.length; from += STOCK_ASKS_MOST) {
      const answer = await fetch(`${origin}${api}stock?${ids.slice(from, from + STOCK_ASKS_MOST).map((id) => `product=${encodeURIComponent(id)}`).join('&')}`, { headers: WALK });
      if (answer.status !== 200) return null;
      for (const one of (await answer.json()).products) said[one.id] = one;
    }
    return said;
  };
  /** The walk's own rule: a product nobody can buy is one the shop does not serve, or serves with no variant in stock. */
  const nobodyCanBuy = (said) => new Set(Object.values(said).filter((one) => one.served === false || !(one.variants ?? []).some((variant) => variant.state === 'in_stock')).map((one) => one.id));

  try {
    if (!hides) {
      // A listing that chooses nothing asks nothing: the shop is made to say everything is sold out, and nothing is hidden.
      const ids = first.tiles.map((one) => one.id);
      answerWith = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: ids.map((id) => ({ id, served: true, variants: [{ key: 'v1', sku: 'walk', state: 'sold_out' }] })) }) });
      sent = 0;
      await reload();
      const now = await read();
      const requested = await page.evaluate((path) => performance.getEntriesByType('resource').filter((one) => new URL(one.name).pathname === path).length, `${api}stock`);
      found.push({
        check: 'listing: a listing that does not choose to hide what is sold out asks the shop nothing, and hides nothing though the shop says everything is — as the build wrote it, every product (Ruling 195)',
        ok: now.tiles.length > 0 && now.tiles.length === built.length && sent === 0 && requested === 0 && now.stock === null && now.tiles.every((one) => !one.hidden && one.display !== 'none') && now.groups.every((one) => !one.hidden) && !now.empty.shown,
        said: `${now.tiles.length} tile(s) of the build's ${built.length}, ${now.tiles.filter((one) => one.hidden).length} hidden; ${sent} stock call(s) reached the walk's route, ${requested} left the page; data-stock-read ${now.stock === null ? 'not said' : `«${now.stock}»`}`,
      });
      return { states, found, quiet: true };
    }

    // ── a listing that hides what is sold out ──────────────────────────────
    await stockSaid();
    const loaded = await read();
    const shop = await shopSays(loaded.tiles.map((one) => one.id));
    const expected = shop === null ? new Set() : nobodyCanBuy(shop);
    const sameIds = (tiles) => tiles.length === built.length && tiles.every((one, i) => one.id === built[i].id);
    if (expected.size > 0) {
      found.push({
        check: 'listing: once the page has loaded the tiles of what the shop says nobody can buy are hidden and the others are not — and the built page lists every product (Ruling 195)',
        ok: loaded.stock === 'yes' && loaded.tiles.length > 0 && sameIds(loaded.tiles) && built.every((one) => !one.hidden) && !loaded.empty.shown
          && loaded.tiles.every((one) => one.hidden === expected.has(one.id) && (one.hidden ? one.display === 'none' : one.display !== 'none')),
        said: `${loaded.tiles.length} tile(s), the build's ${built.length}; hidden: ${loaded.tiles.filter((one) => one.hidden).map((one) => `«${one.title}»`).join(', ') || 'none'}; the shop says nobody can buy: ${loaded.tiles.filter((one) => expected.has(one.id)).map((one) => `«${one.title}»`).join(', ')}; data-stock-read «${loaded.stock}»; the sentence for an empty listing ${loaded.empty.shown ? 'shown' : 'not shown'}`,
        tiles: loaded.tiles.map((one) => ({ id: one.id, title: one.title, hidden: one.hidden })),
      });
      // A group made empty by hiding is hidden with its heading, and one with a tile left is shown.
      if (loaded.groups.some((one) => one.tiles > 0 && one.shown === 0)) {
        found.push({
          check: "listing: a group made empty by hiding is hidden, its heading with it, and a group with a tile left is shown — a heading is never left over nothing (Ruling 195)",
          ok: loaded.groups.every((one) => one.hidden === (one.shown === 0)) && loaded.groups.some((one) => one.hidden && one.heading !== '') && loaded.groups.some((one) => !one.hidden && one.shown > 0),
          said: loaded.groups.map((one) => `«${one.heading || 'no heading'}» ${one.shown} of ${one.tiles} shown, ${one.hidden ? 'hidden' : 'shown'}`).join('; '),
          groups: loaded.groups,
        });
      }
      // The keyboard goes through the tiles shown, in order, and never lands on one that is hidden.
      const shown = loaded.tiles.filter((one) => !one.hidden).flatMap((one) => one.links);
      if (shown.length > 0) {
        await page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
        await page.locator('[data-product-tile]:not([hidden]) a[href]').first().focus();
        const reached = [];
        for (let i = 0; i < shown.length; i += 1) {
          reached.push(await page.evaluate(() => document.activeElement?.getAttribute('href') ?? ''));
          await page.keyboard.press('Tab');
        }
        found.push({
          check: 'listing: the keyboard goes through the tiles shown, in order, and never lands on one that is hidden (2.4.3)',
          ok: JSON.stringify(reached) === JSON.stringify(shown),
          said: `Tab reaches ${reached.join(' → ')}; the tiles shown link to ${shown.join(' → ')}`,
        });
      }
    }
    states.push({ state: 'listing: what is sold out hidden', violations: await scan() });

    if (expected.size > 0) {
      // ── a shop that cannot be asked hides nothing ─────────────────────────
      const outcomes = [];
      for (const [label, answer] of [
        ['the network gone', (route) => route.abort()],
        ['a sentence with a 500', (route) => route.fulfill({ status: 500, contentType: 'text/plain', body: 'internal error' })],
        ["a gateway's page with a 200", (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Bad gateway</title><p>try again</p>' })],
      ]) {
        answerWith = answer;
        sent = 0;
        await reload();
        await stockSaid('failed');
        const now = await read();
        outcomes.push({ label, sent, now, kept: now.tiles.length > 0 && sameIds(now.tiles) && now.tiles.every((one) => !one.hidden && one.display !== 'none') && now.groups.every((one) => !one.hidden) });
        if (outcomes.length === 1) states.push({ state: 'listing: the shop could not be asked', violations: await scan() });
      }
      found.push({
        check: 'listing: a shop that cannot be asked, or answers with no stock, hides nothing, though it would have hidden what is sold out — every tile shown, and said failed (Ruling 195)',
        ok: outcomes.every((one) => one.sent > 0 && one.now.stock === 'failed' && one.kept),
        said: outcomes.map((one) => `${one.label}: ${one.sent} call(s), data-stock-read «${one.now.stock}», ${one.now.tiles.filter((tile) => tile.hidden).length} of ${one.now.tiles.length} tile(s) hidden`).join('; ') + `; the shop would have hidden ${expected.size}`,
      });

      // ── a shop that never answers is given up at its deadline: the page's clock in the walk's hands ─
      const STALL = 'listing: a shop that never answers is given up at its deadline and hides nothing — every tile shown, and said failed (Ruling 195)';
      /** @type {(route: import('playwright-core').Route) => void} */
      let holding = () => undefined;
      const held = new Promise((done) => { holding = done; });
      answerWith = (route) => holding(route);
      await page.clock.install();
      await pauseClock(page);
      await page.goto(here, { waitUntil: 'domcontentloaded' });
      // The call is awaited as an event, with a bound: a page that never asks is a finding, not a walk that hangs.
      /** @type {ReturnType<typeof setTimeout> | undefined} */
      let bound;
      const stalled = await Promise.race([held, new Promise((done) => { bound = setTimeout(() => done(null), 5000); })]);
      clearTimeout(bound);
      if (stalled === null) {
        found.push({ check: STALL, ok: false, said: 'the page made no stock call within 5 s, so there was none to hold and give up' });
      } else {
        const waiting = await read();
        await page.clock.runFor(STOCK_DEADLINE_MS);
        await stockSaid('failed');
        const gaveUp = await read();
        found.push({
          check: STALL,
          ok: waiting.stock === null && waiting.tiles.length > 0 && waiting.tiles.every((one) => !one.hidden)
            && gaveUp.stock === 'failed' && sameIds(gaveUp.tiles) && gaveUp.tiles.every((one) => !one.hidden && one.display !== 'none') && gaveUp.groups.every((one) => !one.hidden),
          said: `while the call was held: data-stock-read ${waiting.stock === null ? 'not said' : `«${waiting.stock}»`}, ${waiting.tiles.filter((one) => one.hidden).length} hidden; after ${STOCK_DEADLINE_MS / 1000} s: «${gaveUp.stock}», ${gaveUp.tiles.filter((one) => one.hidden).length} of ${gaveUp.tiles.length} hidden; the shop would have hidden ${expected.size}`,
        });
        await /** @type {import('playwright-core').Route} */ (stalled).abort().catch(() => undefined);
      }
      await page.clock.resume();
    }

    // ── everything sold out: no tile is left, no heading is left over nothing, and a buyer is told ─
    // The page's own stock call is answered by the walk's route: every product sold out.
    if (loaded.tiles.length > 0) {
      const ids = loaded.tiles.map((one) => one.id);
      answerWith = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: ids.map((id) => ({ id, served: true, variants: [{ key: 'v1', sku: 'walk', state: 'sold_out' }] })) }) });
      await reload();
      await stockSaid();
      answerWith = null;
      const none = await read();
      found.push({
        check: 'listing: where hiding leaves no tile, every group is hidden and no heading is left over nothing (Ruling 195, 229)',
        ok: none.stock === 'yes' && sameIds(none.tiles) && none.tiles.every((one) => one.hidden && one.display === 'none') && none.groups.every((one) => one.hidden) && none.headings.every((one) => !one.shown),
        said: `${none.tiles.filter((one) => one.hidden).length} of ${none.tiles.length} tile(s) hidden; ${none.groups.filter((one) => one.hidden).length} of ${none.groups.length} group(s) hidden; headings ${none.headings.map((one) => `«${one.text}» ${one.shown ? 'left showing' : 'hidden'}`).join(', ') || 'none'}`,
        groups: none.groups,
        headings: none.headings,
      });
      // The place the page keeps for the sentence says it, in the page's language, as a status — where the page has one.
      if (none.empty.present) {
        found.push({
          check: 'listing: where hiding leaves no tile the sentence for it is shown, in the page\'s language, as a status (4.1.3, Ruling 229)',
          ok: none.tiles.length > 0 && none.tiles.every((one) => one.hidden) && none.empty.shown && same(none.empty.said, W.listingEmpty) && none.empty.role === 'status',
          said: `«${none.empty.said}» ${none.empty.shown ? 'shown' : 'hidden'} (role ${none.empty.role || 'none'}); the page's word is «${W.listingEmpty}»`,
        });
      }
      states.push({ state: 'listing: everything sold out', violations: await scan() });
    }

    // ── no tile at all: nothing to ask, and the listing says it is done ──────
    // The listing's own page with every tile taken out, as the build writes one for an empty catalogue; its groups left where they were.
    const bare = await (await fetch(here)).text();
    const tiles = [...bare.matchAll(/<([a-z]+)\b[^>]*\sdata-product-tile(?=[\s>=])[^>]*>[\s\S]*?<\/\1>/g)];
    if (tiles.length > 0) {
      const asked = [];
      const noted = (request) => /\/stock\?/.test(request.url()) && asked.push(request.url());
      const itself = (url) => url.href === here;
      page.on('request', noted);
      await page.route(itself, async (route) => route.fulfill({ response: await route.fetch(), body: tiles.reduce((html, one) => html.replace(one[0], ''), bare) }));
      await reload();
      await stockSaid();
      page.off('request', noted);
      await page.unroute(itself);
      const nothing = await read();
      found.push({
        check: 'listing: a listing with no tile asks the shop nothing, says it is done, and leaves no group over its heading (Ruling 230)',
        ok: nothing.tiles.length === 0 && asked.length === 0 && nothing.stock === 'yes' && nothing.groups.every((one) => one.hidden) && !nothing.empty.shown,
        said: `${nothing.tiles.length} tile(s); ${asked.length} stock call(s); data-stock-read ${nothing.stock === null ? 'not said' : `«${nothing.stock}»`}; ${nothing.groups.filter((one) => one.hidden).length} of ${nothing.groups.length} group(s) hidden; the sentence ${nothing.empty.shown ? 'shown' : 'not shown'}`,
      });
    }

    // ── more than a hundred products: a hundred at a time, each once ────────
    // The listing's own page, given 150 tiles of products the shop does not know and two of one it does, ids that are no product's.
    answerWith = null;
    const html = await (await fetch(here)).text();
    const tags = [...html.matchAll(/<([a-z]+)\b[^>]*\sdata-product-tile(?=[\s>=])[^>]*>[\s\S]*?<\/\1>/g)];
    if (tags.length > 0) {
      const last = tags[tags.length - 1];
      const copyOf = (id) => tags[0][0].replace(/(\sdata-product=")[^"]*"/, `$1${id}"`);
      const strangers = Array.from({ length: 150 }, (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`);
      const doctored = html.slice(0, last.index + last[0].length) + [...strangers, loaded.tiles[0].id, loaded.tiles[0].id].map(copyOf).join('') + html.slice(last.index + last[0].length);
      const asks = [];
      const noted = (request) => /\/stock\?/.test(request.url()) && asks.push(request.url());
      const itself = (url) => url.href === here;
      page.on('request', noted);
      await page.route(itself, async (route) => route.fulfill({ response: await route.fetch(), body: doctored }));
      await reload();
      await stockSaid();
      page.off('request', noted);
      await page.unroute(itself);
      const many = await read();
      const asked = asks.map((address) => new URL(address).searchParams.getAll('product'));
      const distinct = [...new Set(many.tiles.map((one) => one.id))];
      const unknown = many.tiles.filter((one) => strangers.includes(one.id));
      found.push({
        check: `listing: more than ${STOCK_ASKS_MOST} products are asked ${STOCK_ASKS_MOST} at a time, each once, and a product the shop does not serve is hidden (Ruling 195)`,
        ok: many.tiles.length === loaded.tiles.length + strangers.length + 2 && distinct.length === loaded.tiles.length + strangers.length
          && asked.length === Math.ceil(distinct.length / STOCK_ASKS_MOST) && asked.every((ids) => ids.length > 0 && ids.length <= STOCK_ASKS_MOST) && asked[0]?.length === STOCK_ASKS_MOST
          && JSON.stringify([...asked.flat()].sort()) === JSON.stringify([...distinct].sort())
          && many.stock === 'yes' && unknown.length === strangers.length && unknown.every((one) => one.hidden)
          && many.tiles.filter((one) => loaded.tiles.some((own) => own.id === one.id)).every((one) => one.hidden === loaded.tiles.find((own) => own.id === one.id)?.hidden),
        said: `${many.tiles.length} tile(s) of ${distinct.length} products; ${asked.length} call(s) of ${asked.map((ids) => ids.length).join(' + ')}; ${unknown.filter((one) => one.hidden).length} of ${unknown.length} unknown hidden; the real tiles as before`,
      });
    }
  } finally {
    await page.unroute(stock).catch(() => undefined);
    await page.clock.resume().catch(() => undefined);
  }
  return { states, found };
}

/** What a page's HTML says in an attribute of a tag, its entities read. */
function attrOf(tag, name) {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return found === null ? undefined : found[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * The lines a product page's form gives a cart to be walked with: its first
 * two variants on sale, once each, with the answer each question it must have
 * answered wants — a choice's first, a text that fits. The second is what a
 * cart with two variants of one product is walked with. Nothing where the page
 * has no product form, or the product has no variant on sale or asks what the
 * walk cannot answer: that page puts nothing in a cart.
 *
 * @param {string} html a built page
 * @returns {{ product: string; variant: string; qty: number; answers: Record<string, string | boolean> }[]}
 */
export function productLines(html) {
  const tag = /<form\b[^>]*\sdata-product="[^"]*"[^>]*>/.exec(html)?.[0];
  if (tag === undefined) return [];
  let facts;
  try {
    facts = JSON.parse(attrOf(tag, 'data-facts') ?? '');
  } catch {
    return [];
  }
  if (typeof facts?.id !== 'string' || !Array.isArray(facts.variants) || !Array.isArray(facts.customizations)) return [];
  /** @type {Record<string, string | boolean>} */
  const answers = {};
  for (const one of facts.customizations.filter((each) => each?.required === true)) {
    if (one.kind === 'choice' && one.choices?.[0]?.key !== undefined) answers[one.key] = one.choices[0].key;
    else if (one.kind === 'text' && Number.isInteger(one.max) && one.max >= 1) answers[one.key] = 'Ada'.slice(0, one.max);
    else return [];
  }
  return facts.variants.filter((one) => one?.onSale === true && one.price !== undefined).slice(0, 2).map((one) => ({ product: facts.id, variant: one.key, qty: 1, answers: { ...answers } }));
}

/**
 * The first product page of the pages given that gives a line (`productLines`),
 * as built in `dist` — the line a cart page is walked with where it is read
 * before any product page, with a new browser and a cart of its own — and a
 * second variant of the same product where it has one.
 *
 * @param {string} dist
 * @param {string[]} pages addresses, as `audit` reads them: `/shop/t-shirt-fox/`
 * @returns {{ line: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> }; second?: { product: string; variant: string; qty: number; answers: Record<string, string | boolean> } } | undefined}
 */
export function linesFromPages(dist, pages) {
  for (const path of pages) {
    let html;
    try {
      html = readFileSync(join(dist, path, 'index.html'), 'utf8');
    } catch {
      continue;
    }
    const [line, second] = productLines(html);
    if (line !== undefined) return { line, ...(second === undefined ? {} : { second }) };
  }
  return undefined;
}
