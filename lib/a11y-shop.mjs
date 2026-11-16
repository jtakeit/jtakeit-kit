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
import { money } from '@jtakeit/kit/money';

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
 * then a delivery filled in and pressed — twice while the shop answers, which
 * is one request — with an email the shop refuses, said at its field; the
 * shop's new price, said, the same press going on; an address Stripe cannot
 * tax, which gives the press up; an answer that was lost, retried with the
 * same attempt and the cart, which the shop answers with the same order;
 * Stripe's page not given, asked again with the order's token alone; the
 * shop's own pay page, *Pay*, and the buyer on the order's page in this page's
 * language, with the order on its address; the next press a new attempt; and
 * an order already paid, which sends the buyer to its page.
 *
 * What the shop answers is asked of the shop again by the walk (`x-jtk-walk`)
 * — the total, the methods — and the page is held to it. The answers devShop
 * does not give — a lost answer, Stripe not reached, an address Stripe cannot
 * tax, VAT — are made by holding the page's own request (`route`): the request
 * goes to the shop where it should make what it would, and the answer the page
 * gets is the one under test. What the cart has not got — a pick-up, a
 * country abroad — is not driven, and its check not said. A cart with no line
 * has no checkout to reach: said `quiet`, as the cart's is.
 * @param {import('playwright-core').Page} page a page of its own, at the cart's address
 * @param {(within?: string) => Promise<any[]>} scan axe on the page as it is now, or on the part a selector names
 */
export async function driveCheckout(page, scan) {
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
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  const put = (cart) => page.evaluate(({ k, value }) => localStorage.setItem(k, JSON.stringify(value)), { k: key, value: cart });
  const pressNow = () => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null'), pressKey);
  /** What the shop answers to a body, asked by the walk, never by the page. */
  const shop = async (body) => {
    const answer = await fetch(`${origin}${api}shipping`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-jtk-shop': '1', 'x-jtk-walk': '1' }, body: JSON.stringify(body) });
    return answer.status === 200 ? answer.json() : null;
  };
  const same = (a, b) => String(a ?? '').replace(/\s+/g, ' ').trim() === String(b ?? '').replace(/\s+/g, ' ').trim();
  const settleCart = () => page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && el.getAttribute('data-state') !== 'pricing';
  }, cartRoot, { timeout: 5000 });
  const settle = () => page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el?.getAttribute('data-jtk-wired') === '1' && !el.hasAttribute('aria-busy') && !['pricing', 'paying'].includes(el.getAttribute('data-state') ?? '');
  }, root, { timeout: 5000 });
  const reload = async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await settleCart();
  };
  /** The cart's *To checkout*, by the keyboard, and the step's answer awaited. */
  const toCheckout = async () => {
    await page.waitForSelector(`${cartRoot} [data-to-checkout]:not([disabled])`, { timeout: 5000 });
    await page.focus(`${cartRoot} [data-to-checkout]`);
    await page.keyboard.press('Enter');
    await settle();
  };
  /** *Pay*, by the keyboard, and the answer awaited. */
  const payNow = async () => {
    await page.focus(`${root} [data-pay]`);
    await page.keyboard.press('Enter');
    await settle();
  };
  const NAMES = ['name', 'email', 'phone', 'line1', 'line2', 'postal_code', 'city'];
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
    };
  }, { sel: root, names: NAMES });
  const axeNow = async (state) => states.push({ state, violations: await scan(root) });

  // A cart with no line has no checkout to reach: the cart's drive said so, and nothing is asked here.
  const stored0 = await stored().catch(() => null);
  if (!stored0?.lines?.length) return { states, found, quiet: true };
  // The cart's first line, once: a total under the free-above a method may have, so that the method's price is in it.
  const lines = [{ ...stored0.lines[0], qty: 1 }];
  const cart = { v: 1, lines, country: '', method: '' };

  // The walk goes on with the buyer's cart as the drive found it: the pieces read after this one see it, not the drive's.
  try {
    await drive();
  } finally {
    await put(stored0).catch(() => undefined);
  }
  return { states, found };

  async function drive() {
    // Where the shop sends this cart: the first country it carries it to at home, by a parcel and a pick-up where it has one;
    // and the first abroad, where a parcel and a pick-up are both offered — the customs sentence's two cases.
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
    if (home === undefined) return;
    const totalOf = (theirs, method) => money(theirs.subtotal + method.price, theirs.currency, locale);

    // ── the step opened by the cart's *To checkout* ──────────────────────────
    await put({ ...cart, country: home.country, method: home.parcel.method });
    await reload();
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
    /** A method chosen in the cart by its arrow keys, and *To checkout* again. */
    const choose = async (method) => {
      await page.focus(`${cartRoot} [name=method]:checked`);
      for (let i = 0; i < 10; i += 1) {
        const value = await page.evaluate((sel) => /** @type {HTMLInputElement | null} */ (document.querySelector(`${sel} [name=method]:checked`))?.value, cartRoot);
        if (value === method) break;
        await page.keyboard.press('ArrowDown');
      }
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

    // ── a delivery filled in, and pressed twice while the shop answers ───────
    const fill = async (email) => {
      for (const [name, value] of [['name', 'Ada Lovelace'], ['email', email], ['line1', 'Bahnhofstrasse 1'], ['postal_code', '8001'], ['city', 'Zürich']]) {
        await page.locator(`${root} [name="${name}"]`).fill(value);
      }
    };
    // An email of no domain the shop takes: past the page's own check, which holds back only what is plainly missing.
    await fill('ada@example');
    await page.route('**/checkout', async (route) => {
      await new Promise((done) => setTimeout(done, 300));
      await route.continue();
    }, { times: 1 });
    const first = checkouts.length;
    await page.focus(`${root} [data-pay]`);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await settle();
    now = await read();
    const pressed = checkouts.slice(first);
    const body = pressed[0] ?? {};
    const a1 = String(body.attempt ?? '');
    found.push({
      check: 'checkout: Pay pressed again while the shop answers is the same press, and is sent once (Ruling 92)',
      ok: pressed.length === 1,
      said: `two presses, ${pressed.length} request(s)`,
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
    let kept = await pressNow();
    found.push({
      check: 'checkout: a detail the shop refuses is said at its field, tied to it and focused, and the press is kept for the next (3.3.1, 4.1.3)',
      ok: told(now, ['email']) && quiet(now, ['name', 'line1', 'postal_code', 'city']) && now.focus.name === 'email' && now.error.shown && kept?.attempt === a1 && kept?.order === '',
      said: `${NAMES.filter((name) => now.fields[name].invalid).map((name) => `${name} «${now.fields[name].described}»`).join(', ') || 'no field said'}; focus on ${now.focus.name || 'no field'}; kept ${JSON.stringify(kept)}`,
    });
    await axeNow('checkout: a detail refused by the shop');

    // ── the shop's price changed in between: shown, said, the same press ─────
    await page.locator(`${root} [name="email"]`).fill('ada@example.ch');
    await page.evaluate(() => {
      /** @type {any} */ (window).jtkCartHeard = [];
      document.addEventListener('jtk:cart', (event) => /** @type {any} */ (window).jtkCartHeard.push(/** @type {CustomEvent} */ (event).detail));
    });
    // The press as the page sent it, with a total the shop no longer comes to: its own 409 total, and its quote.
    await page.route('**/checkout', async (route) => {
      const sent = JSON.parse(route.request().postData() ?? '{}');
      await route.continue({ postData: JSON.stringify({ ...sent, total: sent.total + 1 }) });
    }, { times: 1 });
    const second = checkouts.length;
    await payNow();
    now = await read();
    kept = await pressNow();
    const repriced = await page.evaluate(() => /** @type {any} */ (window).jtkCartHeard);
    found.push({
      check: 'checkout: a price that changed is shown and said, the cart above priced again, and the same press goes on (3.3.1, 4.1.3)',
      ok: checkouts.length === second + 1 && checkouts[second].attempt === a1 && same(now.error.text, words['error.total']) && now.error.shown && same(now.total, totalOf(home.theirs, home.parcel)) && !now.held && kept?.attempt === a1 && repriced.includes(key),
      said: `sent with ${checkouts[second]?.attempt === a1 ? 'the same attempt' : `attempt ${checkouts[second]?.attempt}`}; «${now.error.text}», total «${now.total}»; jtk:cart ${JSON.stringify(repriced)}; kept ${JSON.stringify(kept)}`,
    });
    await axeNow('checkout: a new price');

    // ── an address Stripe cannot tax: said, the address focused, the press given up ─
    await page.route('**/checkout', (route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'address', order: 'jtk-walk-given-up' }) }), { times: 1 });
    const third = checkouts.length;
    await payNow();
    const given = await read();
    const forgotten = await pressNow();
    await axeNow('checkout: an address Stripe cannot tax');

    // ── an answer lost: the same press again, with its cart ──────────────────
    /** @type {any} */
    let made = null;
    await page.route('**/checkout', async (route) => {
      made = await (await route.fetch()).json();
      await route.abort('connectionreset');
    }, { times: 1 });
    const fourth = checkouts.length;
    await payNow();
    now = await read();
    kept = await pressNow();
    const a2 = String(checkouts[fourth]?.attempt ?? '');
    found.push({
      check: 'checkout: an address Stripe cannot tax is said, the address focused, and the press given up — the next press is a new one (3.3.1, Ruling 202)',
      ok: checkouts[third]?.attempt === a1 && same(given.error.text, words.address) && given.focus.name === 'line1' && forgotten === null && ATTEMPT.test(a2) && a2 !== a1,
      said: `«${given.error.text}», focus on ${given.focus.name || 'no field'}, the press ${forgotten === null ? 'forgotten' : `kept ${JSON.stringify(forgotten)}`}; the next press ${a2 === a1 ? 'the same attempt' : `a new attempt ${a2}`}`,
    });
    found.push({
      check: 'checkout: an answer that was lost is said, and the press kept as it was — the same attempt, no order known (Ruling 92)',
      ok: typeof made?.order === 'string' && made.order !== '' && same(now.error.text, words['error.try_again']) && now.error.shown && !now.held && kept?.attempt === a2 && kept?.order === '',
      said: `the shop made ${made?.order ?? 'nothing'}; «${now.error.text}»; kept ${JSON.stringify(kept)}`,
    });

    // ── the retry: the same attempt and the cart, and the same order; Stripe's page not given ─
    /** @type {any} */
    let again = null;
    await page.route('**/checkout', async (route) => {
      again = await (await route.fetch()).json();
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again', order: again.order }) });
    }, { times: 1 });
    const fifth = checkouts.length;
    await payNow();
    now = await read();
    kept = await pressNow();
    const retry = checkouts[fifth] ?? {};
    found.push({
      check: 'checkout: a press retried after an answer was lost is the same attempt with its cart, and the shop answers it with the same order (Ruling 92)',
      ok: retry.attempt === a2 && JSON.stringify(retry.lines) === JSON.stringify(lines) && again?.order === made?.order && typeof again?.order === 'string',
      said: `attempt ${retry.attempt === a2 ? 'the same' : retry.attempt}, ${Array.isArray(retry.lines) ? 'its cart' : 'no cart'}; the shop's order ${again?.order === made?.order ? 'the same' : `${again?.order}, not ${made?.order}`}`,
    });

    // ── asked again with the order's token alone; Stripe's page ──────────────
    const sixth = checkouts.length;
    // The shop's answer as the page gets it, read on its way: the page leaves for the address it names.
    /** @type {any} */
    let stripe = null;
    let status = 0;
    await page.route('**/checkout', async (route) => {
      const answer = await route.fetch();
      status = answer.status();
      stripe = await answer.json();
      await route.fulfill({ response: answer });
    }, { times: 1 });
    await page.focus(`${root} [data-pay]`);
    await page.keyboard.press('Enter');
    // A page that never leaves is the check's to say, not the walk's to stop at.
    await page.waitForURL((url) => typeof stripe?.url === 'string' && url.href === stripe.url, { timeout: 5000 }).catch(() => undefined);
    const left = await pressNow();
    found.push({
      check: 'checkout: Stripe\'s page not given, the press keeps the order, and the next ask is its token alone, which holds nothing more (Ruling 92)',
      ok: kept?.attempt === a2 && kept?.order === made?.order && same(now.error.text, words['error.try_again']) && JSON.stringify(checkouts[sixth]) === JSON.stringify({ order: made?.order }),
      said: `kept ${JSON.stringify(kept)}; asked again with ${JSON.stringify(checkouts[sixth])}`,
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

    // ── the press after Stripe's page was given is a new one ─────────────────
    await page.goto(at, { waitUntil: 'networkidle' });
    await settleCart();
    await toCheckout();
    await fill('ada@example.ch');
    await page.route('**/checkout', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'try_again' }) }), { times: 1 });
    const seventh = checkouts.length;
    await payNow();
    const a3 = String(checkouts[seventh]?.attempt ?? '');
    found.push({
      check: 'checkout: after Stripe\'s page was given the next press is a new one, a new attempt (Ruling 92)',
      ok: ATTEMPT.test(a3) && UUID.test(a3) && a3 !== a1 && a3 !== a2 && Array.isArray(checkouts[seventh]?.lines),
      said: `attempt ${a3}${a3 === a2 ? ' — the one Stripe\'s page was given for' : ''}`,
    });

    // ── an order already paid: to its page, not paid again ───────────────────
    await page.evaluate(({ k, order }) => sessionStorage.setItem(k, JSON.stringify({ attempt: crypto.randomUUID(), order })), { k: pressKey, order: made?.order });
    await reload();
    await toCheckout();
    const eighth = checkouts.length;
    await page.focus(`${root} [data-pay]`);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.pathname === back, { timeout: 5000 }).catch(() => undefined);
    const paid = new URL(page.url());
    found.push({
      check: 'checkout: an order already paid is not paid again — asked for by its token, the buyer is sent to its page, and the press is over (409 paid)',
      ok: JSON.stringify(checkouts[eighth]) === JSON.stringify({ order: made?.order }) && paid.searchParams.get('order') === made?.order && (await pressNow()) === null,
      said: `asked with ${JSON.stringify(checkouts[eighth])}, landed on ${paid.pathname}${paid.search}`,
    });
  }
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
