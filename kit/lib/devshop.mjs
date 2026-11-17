/**
 * The shop on the dev server — so a storefront can be walked on localhost.
 *
 * On the platform `/api/stock`, `/api/shipping`, `/api/checkout` and
 * `/api/order` are the edge's (docs/reference/shop-protocol.md, `shop/1`); on
 * `astro dev` there is nothing there, and the platform's twin of a dev
 * session answers them 404, since only the site itself or a preview of it
 * takes orders. A developer judging a storefront by walking it could not walk
 * the one thing it is for.
 *
 * This answers the same four addresses, in the same shapes, from the site's
 * own files, read fresh on every request so an edit shows at once: the
 * products are the entries of the collection the schema binds the shop's
 * `products` role to, and the zones and the methods are
 * `jtk/modules/shop.json`. The files carry no stock count, so every variant on
 * sale of a tracked product is in stock, and none says how many are left —
 * except a SKU the caller names sold out, which a walk needs (`soldOut`).
 *
 * Checking out writes an order, held in memory until the server stops, and
 * answers the address of a page of this server's own, `/api/dev-pay`, that
 * says nothing is charged and offers *Pay* and *Leave*. Nothing is ever asked
 * of Stripe, of the platform or of anybody else.
 *
 * It is not the platform's shop, and the answers are close, not the same
 * (jtakeit-core wiki/102 Ruling 182): no hold on a stock, no limit on open
 * checkouts or on an address's checkouts an hour, no challenge, no VAT and no
 * choice of the buyer's own currency (`vat_included` and `own_currency` are
 * false: localhost has neither switch), no tax code in the order, no field
 * refused as outside the contract, and an order never lapses. What the
 * platform decides and this repeats — what makes a variant not hold, a cart
 * priced by weight band and free-above, the customs areas, what a buyer's
 * details may be, a press kept to its buyer, a language that chooses words and
 * never what is sold — is written out again from `modules/shop/*.go` of the
 * platform (at dca045af) and pinned by `test/devshop.test.mjs`. `preflight`
 * with `try_order` is still the test of the real one.
 *
 *   import { devShop } from '@jtakeit/kit/devshop';
 *   server.middlewares.use('/api', devShop(process.cwd()));
 *
 * Mounted beside `devDiary`: `/turnstile` is the diary's, and every address
 * that is not the shop's, and every address on a site whose schema does not
 * turn the shop on, is left to `next()`.
 */
import { randomBytes } from 'node:crypto';
import { content } from './content/index.mjs';
import { readJtk } from './content/node.mjs';
import { canonicalLocale } from './content/locale.mjs';
import { bodyOf, send } from './devdiary.mjs';
import { money } from './money.mjs';
import { answersOf, productFacts } from './shop/product.mjs';
import { SHOP_LOCALES, shopWordsFor } from './shop/words.mjs';

// ── the protocol's limits (docs/reference/shop-protocol.md) ─────────────────

const PROTOCOLS = [1];
const MAX_LINE_QTY = 999;
const MAX_CART_LINES = 100;
/** The most one amount may be: Stripe's ceiling, CHF 999,999.99 (modules/shop/price.go). */
const MAX_CART_MINOR = 99_999_999;
const MAX_STOCK_PRODUCTS = 100;
const MAX_TEXT_CHARS = 500;
const MAX_RETURN = 2048;
const FIRST_NUMBER = 1001;
const PAYMENT_LASTS = 30 * 60000;
const SIZE_CLASSES = ['letter', 'parcel', 'bulky'];
const TAX_CODE = /^txcd_[0-9]{8}$/;
const ATTEMPT = /^[A-Za-z0-9_-]{16,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The sentence a page of the platform's twin says, `modules/shop/checkout.go`: a press's token. */
const ATTEMPT_RULE = "an attempt is a press's own token: 16 to 128 letters, digits, '-' or '_', or none";

// ── the words of the pay page ───────────────────────────────────────────────

/**
 * What the local pay page says besides *Pay*, which is the storefront's own
 * word (`shop/words.mjs`): that nothing is charged, and how to leave. In the
 * kit's eight languages, the site's own, English for any other.
 */
export const DEV_PAY_WORDS = Object.freeze({
  uk: { note: 'Гроші не списуються: ця сторінка замінює платіжну сторінку Stripe, поки сайт працює на localhost.', leave: 'Піти без оплати' },
  de: { note: 'Es wird nichts abgebucht: Diese Seite ersetzt die Zahlungsseite von Stripe, solange die Website auf localhost läuft.', leave: 'Ohne Bezahlung verlassen' },
  en: { note: 'Nothing is charged: this page stands in for Stripe’s payment page while the site runs on localhost.', leave: 'Leave without paying' },
  ru: { note: 'Деньги не списываются: эта страница заменяет платёжную страницу Stripe, пока сайт работает на localhost.', leave: 'Уйти без оплаты' },
  es: { note: 'No se cobra nada: esta página sustituye a la página de pago de Stripe mientras el sitio funciona en localhost.', leave: 'Salir sin pagar' },
  it: { note: 'Non viene addebitato nulla: questa pagina sostituisce la pagina di pagamento di Stripe mentre il sito gira su localhost.', leave: 'Esci senza pagare' },
  pt: { note: 'Nada é cobrado: esta página substitui a página de pagamento da Stripe enquanto o site corre em localhost.', leave: 'Sair sem pagar' },
  fr: { note: 'Rien n’est débité : cette page remplace la page de paiement de Stripe tant que le site tourne sur localhost.', leave: 'Quitter sans payer' },
});

// ── what the platform reads, as it reads it ─────────────────────────────────
//
// The shop reads an entry and its settings as JSON and never more leniently
// than the judge (modules/shop/products.go, price.go, catalog.go, settings.go,
// shipping.go): what does not hold is marked, never priced by guess.

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The rows of a list that are objects, as the shop reads a list: its places count them alone. */
const listRows = (value) => (Array.isArray(value) ? value.filter(isObject) : []);

/** A row's `_key`, or its place where it has none. */
const rowKey = (row, place) => (typeof row._key === 'string' && row._key !== '' ? row._key : String(place));

/** Whether a value says anything: not nothing, not white space, not an empty object or list. */
function said(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

/** A whole number of 0 or more that a float holds exactly, or nothing. */
const wholeOf = (value) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2 ** 53 ? value : undefined);

/** The `money` kind as the shop reads it: a bare whole number or `{ minor }` alone, never negative; nothing else. */
const moneyOf = (value) => (isObject(value) ? (Object.keys(value).length === 1 ? wholeOf(value.minor) : undefined) : wholeOf(value));

/** A row's key as the door and the facts name it. */
const keyOf = (row) => (typeof row.key === 'string' && row.key !== '' ? row.key : String(row.index));

/** A character a one-line text may not hold: a control, a line or paragraph break, a format character — but the zero-width joiners, which are written. */
const breaks = (text) => [...text].some((one) => one !== '\u200c' && one !== '\u200d' && /[\p{Cc}\p{Zl}\p{Zp}\p{Cf}]/u.test(one));

/** A text of zero-width joiners and white space alone: nothing a person can see, so no answer. */
const nothingSeen = (text) => text.replace(/[\s\u200c\u200d]/g, '') === '';

const lengthOf = (text) => [...text].length;

/**
 * One customization as the shop reads it, whatever its kind (`customizationOf`
 * of the platform): what does not hold is said in `fault`, and a customization
 * never reads as unlimited, as adding nothing or as not required by guess.
 */
function customizationOf(row) {
  const faults = [];
  let required = false;
  const rawRequired = row.value('required');
  if (rawRequired !== undefined) {
    if (typeof rawRequired === 'boolean') required = rawRequired;
    else {
      // Neither true nor false is read as required, with a fault: no line is sold until the owner says which.
      required = true;
      faults.push('its required is not true or false');
    }
  }
  const rawKind = row.value('kind');
  const kind = typeof rawKind === 'string' ? rawKind : '';
  const choiceRows = row.rows('choices');
  let max = 0;
  if (kind === 'choice') {
    if (choiceRows.length === 0) faults.push('it is a choice and has no choice to pick');
  } else if (kind === 'text') {
    const limit = wholeOf(row.value('max'));
    if (limit !== undefined && limit >= 1 && limit <= MAX_TEXT_CHARS) max = limit;
    else faults.push(`it is a text and its max is not a whole 1 to ${MAX_TEXT_CHARS}`);
  } else if (kind !== 'yes_no') {
    faults.push(`its kind "${kind}" is not choice, yes_no or text`);
  }
  const adds = (raw, what) => {
    if (!said(raw)) return 0;
    const minor = moneyOf(raw);
    if (minor === undefined) faults.push(`${what} adds what is not a whole amount of 0 or more`);
    return minor ?? 0;
  };
  const own = adds(row.value('adds'), 'it');
  const choices = choiceRows.map((choice) => {
    const key = keyOf(choice);
    return { key, label: choice.text('label'), adds: adds(choice.value('adds'), `the choice "${key}"`) };
  });
  const key = keyOf(row);
  return {
    key,
    name: row.text('name'),
    kind,
    // A yes-or-no is ticked or not, and is never required.
    mustAnswer: required && kind !== 'yes_no',
    max,
    choices,
    adds: own,
    fault: faults.length === 0 ? '' : `the customization ${key} does not hold: ${faults.join('; ')}`,
  };
}

/**
 * One variant row as the shop reads it: on sale unless it says `on_sale:
 * false`, and what does not hold — no SKU, a price that is not money, a weight
 * that is not whole grams of 0 or more, picks that do not name the product's
 * options, an `on_sale` that is not a switch, a tax code that is not Stripe's
 * — said in `fault`, never priced at 0.
 */
function variantOf(variant, row, facts, slug, taxFault) {
  const faults = [];
  const rawOnSale = row.value('on_sale');
  let onSale = true;
  if (rawOnSale !== undefined) {
    if (typeof rawOnSale === 'boolean') onSale = rawOnSale;
    else faults.push('its on_sale is not true or false');
  }
  let weight = 0;
  const rawWeight = row.value('weight');
  if (said(rawWeight)) {
    const grams = wholeOf(rawWeight);
    if (grams === undefined) faults.push('its weight is not a whole number of grams of 0 or more');
    else weight = grams;
  }
  const rawSku = row.value('sku');
  const sku = typeof rawSku === 'string' ? rawSku : '';
  if (sku.trim() === '') faults.push('it has no SKU');
  const price = moneyOf(row.value('price'));
  if (price === undefined) faults.push('its price is not a whole amount of 0 or more');

  // The door reads picks that are not an object of option and value as nothing picked; the file saying something is the fault.
  const rawPicks = row.value('picks');
  if (said(rawPicks) && (!isObject(rawPicks) || Object.keys(rawPicks).length !== Object.keys(variant.picks).length)) {
    faults.push('its picks are not an object of option and value');
  } else {
    for (const option of facts.options) {
      const pick = variant.picks[option.key];
      if (pick === undefined) faults.push(`it does not pick the option "${option.key}"`);
      else if (!option.values.some((value) => value.key === pick)) faults.push(`${pick} is not a value of the option "${option.key}"`);
    }
    for (const name of Object.keys(variant.picks)) {
      if (!facts.options.some((option) => option.key === name)) faults.push(`"${name}" is not an option of ${slug}`);
    }
  }
  if (taxFault) faults.push("its product's tax code is not one of Stripe's (txcd_ and eight digits)");

  // The picked values' labels, in the options' order.
  const labels = facts.options.map((option) => option.values.find((value) => value.key === variant.picks[option.key])?.label ?? '');
  return {
    key: variant.key,
    sku,
    price: price ?? 0,
    weight,
    labels,
    onSale,
    fault: faults.length === 0 ? '' : `the variant ${variant.key} of ${slug} is not sold: ${faults.join('; ')}`,
  };
}

/**
 * A product as the shop reads it from an entry the site serves: the door's
 * facts (the options, the variants' keys and picks, the questions), and what
 * the facts do not say — a variant's price and weight as the shop holds them,
 * the size class, the tax code, and which customizations do not hold.
 *
 * @param {import('../types/content').Entry} entry
 * @param {string} currency
 */
function productOf(entry, currency) {
  const facts = productFacts(entry, currency);
  const fields = entry.fields;
  const rows = fields.rows('variants');
  const rawTax = fields.value('tax_code');
  const tax = said(rawTax) ? (typeof rawTax === 'string' ? rawTax.trim() : String(rawTax)) : '';
  const size = fields.value('size_class');
  return {
    id: entry.id,
    slug: entry.slug,
    title: fields.text('title'),
    facts,
    tracked: facts.tracked,
    class: SIZE_CLASSES.includes(size) ? size : 'parcel',
    customizations: fields.rows('customizations').map(customizationOf),
    variants: facts.variants.map((variant, at) => variantOf(variant, rows[at], facts, entry.slug, tax !== '' && !TAX_CODE.test(tax))),
  };
}

// ── what is left ────────────────────────────────────────────────────────────

/** Whether no line of a product is refused for a question a buyer must answer: one that does not hold refuses every line. */
const answerable = (product) => product.customizations.every((one) => one.fault === '' || !one.mustAnswer);

/** Whether a variant is offered to a buyer at all, as the cart prices them. */
const forSale = (product, variant) => variant.onSale && variant.fault === '' && answerable(product);

/** What a page is told of each variant of a product: in stock, sold out where the walk said so, off sale. */
function stockOf(product, soldOut) {
  return product.variants.map((variant) => {
    const one = { key: variant.key, sku: variant.sku, state: 'in_stock' };
    if (!forSale(product, variant)) one.state = 'off_sale';
    else if (product.tracked && soldOut.has(variant.sku.toLowerCase())) one.state = 'sold_out';
    return one;
  });
}

// ── the cart priced ─────────────────────────────────────────────────────────

/**
 * What a cart line says, held to the contract's shapes: a value in another
 * shape than the contract's is read as nothing, as the platform's decoder
 * reads it.
 */
function lineOf(raw) {
  const line = isObject(raw) ? raw : {};
  return {
    product: typeof line.product === 'string' ? line.product : '',
    variant: typeof line.variant === 'string' ? line.variant : '',
    qty: Number.isInteger(line.qty) ? line.qty : 0,
    answers: isObject(line.answers) ? line.answers : {},
  };
}

const cartOf = (raw) => (Array.isArray(raw) ? raw.map(lineOf) : []);

/**
 * One line priced, or why it is not (`priceLine` of the platform): the
 * variant's price and what each answer adds. The answers are first held to
 * what the protocol refuses and a form would only leave out (an answer of the
 * wrong type, a text on two lines), then to what the storefront holds a form
 * to (`answersOf`: required, too long, not a choice).
 */
function priceLine(find, line) {
  const refuse = (code, says) => ({ refusal: { code, says } });
  const product = find(line.product);
  if (product === undefined) return refuse('not_sold', `the product "${line.product}" is not sold`);
  const variant = product.variants.find((one) => one.key === line.variant);
  if (variant === undefined) return refuse('not_sold', `${product.slug} has no variant "${line.variant}"`);
  if (variant.fault !== '') return refuse('not_sold', variant.fault);
  if (!variant.onSale) return refuse('off_sale', `the variant ${variant.key} (${variant.sku}) of ${product.slug} is not on sale`);
  if (line.qty < 1 || line.qty > MAX_LINE_QTY) return refuse('quantity', `${product.slug}: a line is 1 to ${MAX_LINE_QTY} of a variant, not ${line.qty}`);

  // An answer to a question the product does not ask refuses the line before anything is priced.
  for (const key of Object.keys(line.answers).sort()) {
    if (!product.customizations.some((one) => one.key === key)) return refuse('answer', `${product.slug} asks nothing called "${key}"`);
  }
  const { answers: kept, faults } = answersOf(product.facts, line.answers);
  let unit = variant.price;
  const answered = [];
  for (const one of product.customizations) {
    const value = Object.hasOwn(line.answers, one.key) ? line.answers[one.key] : undefined;
    const isText = typeof value === 'string';
    const trimmed = isText ? (one.kind === 'text' ? value.normalize('NFC') : value).trim() : '';
    const unanswered = value === undefined || value === null || value === false || (isText && (trimmed === '' || (one.kind === 'text' && nothingSeen(trimmed))));
    // A customization that does not hold refuses a line that answers it, or leaves it unanswered where it must be answered.
    if (one.fault !== '') {
      if (!unanswered || one.mustAnswer) return refuse('not_sold', `${product.slug}: ${one.fault}`);
      continue;
    }
    const wrong = (why) => refuse('answer', `${product.slug}: «${one.name}»: ${why}`);
    if (one.kind === 'yes_no') {
      if (value !== undefined && value !== null && typeof value !== 'boolean') return wrong('is answered with true or false');
    } else if (unanswered) {
      // Nothing, `false` or a text of white space is no answer, as the platform reads it: refused only where it is required.
      if (one.mustAnswer) return wrong('is required and was not answered');
      continue;
    } else {
      if (!isText) return wrong(one.kind === 'choice' ? 'is answered with the key of a choice' : 'is answered with a text');
      if (one.kind === 'text' && breaks(trimmed)) return wrong('is one line, with no line break, control or format character');
    }
    const fault = faults.find((found) => found.key === one.key);
    if (fault !== undefined) {
      if (fault.word === 'too_long') return wrong(`is ${lengthOf(trimmed)} characters and at most ${one.max} are taken`);
      return wrong(`"${value}" is not one of its choices`);
    }
    if (!Object.hasOwn(kept, one.key)) continue;
    if (one.kind === 'yes_no') answered.push({ key: one.key, name: one.name, ticked: true, adds: one.adds });
    else if (one.kind === 'choice') {
      const choice = one.choices.find((found) => found.key === kept[one.key]);
      answered.push({ key: one.key, name: one.name, choice: choice.key, label: choice.label, adds: choice.adds });
    } else answered.push({ key: one.key, name: one.name, text: kept[one.key], adds: one.adds });
    unit += answered.at(-1).adds;
    if (unit > MAX_CART_MINOR) return refuse('too_large', `${product.slug}: a unit comes to more than ${MAX_CART_MINOR} minor units, the most one amount may be`);
  }
  if (unit > MAX_CART_MINOR) return refuse('too_large', `${product.slug}: a unit comes to ${unit} minor units, more than the ${MAX_CART_MINOR} one amount may be`);
  const total = unit * line.qty;
  if (total > MAX_CART_MINOR) return refuse('too_large', `${product.slug}: ${line.qty} of ${unit} minor units come to more than the ${MAX_CART_MINOR} one amount may be`);
  return {
    priced: {
      product: product.id,
      variant: variant.key,
      sku: variant.sku,
      title: product.title,
      labels: variant.labels,
      answers: answered,
      unit,
      qty: line.qty,
      total,
      weight: variant.weight,
      class: product.class,
      tracked: product.tracked,
    },
  };
}

const rankOf = (size) => (size === 'letter' ? 0 : size === 'bulky' ? 2 : 1);

/**
 * A cart priced from the products the site serves (`PriceCart` of the
 * platform): each line its variant's price and what its answers add, the lines
 * that were not priced refused with their reason, and a cart of more than 100
 * lines refused whole.
 */
function priceCart(find, cart) {
  const priced = { lines: [], subtotal: 0, weight: 0, class: 'parcel' };
  if (cart.length > MAX_CART_LINES) {
    return { priced, refused: [{ line: -1, code: 'too_large', says: `the cart has ${cart.length} lines and at most ${MAX_CART_LINES} are priced` }] };
  }
  const refused = [];
  let largest = -1;
  cart.forEach((line, at) => {
    const { priced: one, refusal: refusedOne } = priceLine(find, line);
    let refusal = refusedOne;
    if (refusal === undefined && priced.subtotal + one.total > MAX_CART_MINOR) {
      refusal = { code: 'too_large', says: `${one.title}: the cart would come to more than ${MAX_CART_MINOR} minor units, the most one amount may be` };
    }
    if (refusal !== undefined) {
      refused.push({ line: at, ...refusal });
      return;
    }
    priced.lines.push({ line: at, ...one });
    priced.subtotal += one.total;
    priced.weight += one.weight * one.qty;
    if (rankOf(one.class) > largest) {
      largest = rankOf(one.class);
      priced.class = one.class;
    }
  });
  return { priced, refused };
}

// ── the shipping settings, and what a country and a parcel are offered ──────

/**
 * The shipping settings as the shop reads them (`ShippingOf` of the platform):
 * the zones and the methods, with only what the judge would let through. A
 * country is two capital letters, and one listed in two zones is in neither,
 * so its buyers are offered the pick-ups alone; a method is left out when it
 * has no name of one line of at most 60 characters, a zone that is none, a
 * price in a shape the money kind refuses, both a price and bands or neither,
 * or any band that does not hold or does not rise on the one before it in its
 * class; a pick-up is left out when it has any price, bands or free-above.
 */
function shippingOf(settings) {
  const zoneRows = listRows(settings.zones);
  const zones = zoneRows.map((row, at) => ({ key: rowKey(row, at), countries: [] }));
  const zoneKeys = new Set(zones.map((zone) => zone.key));
  /** A country to its zone's key, or '' where it is in two. */
  const inZone = new Map();
  zoneRows.forEach((row, at) => {
    for (const one of listRows(row.countries)) {
      const country = typeof one.country === 'string' ? one.country : '';
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const other = inZone.get(country);
      if (other === undefined) inZone.set(country, zones[at].key);
      else if (other !== zones[at].key) inZone.set(country, '');
    }
  });
  zoneRows.forEach((row, at) => {
    for (const one of listRows(row.countries)) {
      const country = typeof one.country === 'string' ? one.country : '';
      if (inZone.get(country) === zones[at].key && !zones[at].countries.includes(country)) zones[at].countries.push(country);
    }
  });
  const methods = [];
  listRows(settings.methods).forEach((row, at) => {
    const one = methodOf(row, at, zoneKeys);
    if (one !== undefined) methods.push(one);
  });
  return { zones, methods };
}

/** A money field of a method: nothing where it is absent, `false` where it does not hold. */
function moneyField(row, key) {
  const value = row[key];
  if (value === undefined || value === null || value === '') return { present: false, ok: true };
  const minor = moneyOf(value);
  return { present: true, ok: minor !== undefined, minor };
}

/** One method row as it is offered, or nothing for one the shop leaves out. */
function methodOf(row, at, zoneKeys) {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const zone = typeof row.zone === 'string' ? row.zone : '';
  if (name === '' || /[\n\r\v\f\u0085\u2028\u2029]/.test(name) || lengthOf(name) > 60 || zone === '' || !zoneKeys.has(zone)) return undefined;
  const method = { key: rowKey(row, at), zone, name, pickup: row.pickup === true, flat: undefined, bands: [], freeAbove: undefined, freeBulky: false };

  let bandRows = [];
  if (Array.isArray(row.bands)) bandRows = row.bands;
  else if (row.bands !== undefined && row.bands !== null && row.bands !== '') return undefined;
  const price = moneyField(row, 'price');
  const free = moneyField(row, 'free_above');
  if (!price.ok || !free.ok) return undefined;
  if (method.pickup) return price.present || bandRows.length > 0 || free.present ? undefined : method;

  if (free.present) method.freeAbove = free.minor;
  method.freeBulky = row.free_bulky === true;
  if (price.present === (bandRows.length > 0)) return undefined;
  if (price.present) return { ...method, flat: price.minor };
  const last = new Map();
  for (const raw of bandRows) {
    if (!isObject(raw)) return undefined;
    const size = typeof raw.class === 'string' ? raw.class : '';
    const upTo = wholeOf(raw.up_to);
    const cost = moneyField(raw, 'price');
    if (!SIZE_CLASSES.includes(size) || upTo === undefined || upTo < 1 || !cost.present || !cost.ok) return undefined;
    if (last.has(size) && upTo <= last.get(size)) return undefined;
    last.set(size, upTo);
    method.bands.push({ class: size, upTo, price: cost.minor });
  }
  return method;
}

/** The band of a size that first carries a weight. */
const bandFor = (method, size, grams) => method.bands.find((band) => band.class === size && band.upTo >= grams);

/**
 * What a method charges a parcel, or nothing where it does not carry it: a
 * flat price carries anything; with bands, the first of the parcel's class
 * whose weight is up to or past the parcel's. A letter goes as a parcel where
 * its own bands do not carry it; a parcel never goes as a letter, and a bulky
 * parcel as nothing else. Free above is from the amount, and covers bulky
 * goods only where the method says so (`Method.price` of the platform).
 */
function charge(method, parcel) {
  let price;
  if (method.flat !== undefined) price = method.flat;
  else {
    const band = bandFor(method, parcel.class, parcel.weight) ?? (parcel.class === 'letter' ? bandFor(method, 'parcel', parcel.weight) : undefined);
    if (band === undefined) return undefined;
    price = band.price;
  }
  const free = method.freeAbove !== undefined && parcel.subtotal >= method.freeAbove && (parcel.class !== 'bulky' || method.freeBulky);
  return { method: method.key, name: method.name, pickup: false, price: free ? 0 : price, free };
}

/**
 * Which methods a country and a parcel are offered (`OfferFor` of the
 * platform): a pick-up whatever the country and the parcel, the zone's other
 * methods only where they carry it, in the settings' order.
 */
function offerFor(shipping, rawCountry, parcel) {
  const country = rawCountry.trim().toUpperCase();
  const zone = shipping.zones.find((one) => one.countries.includes(country));
  const methods = [];
  let carried = false;
  for (const method of shipping.methods) {
    if (method.pickup) {
      methods.push({ method: method.key, name: method.name, pickup: true, price: 0, free: false });
    } else if (zone !== undefined && method.zone === zone.key) {
      const offered = charge(method, parcel);
      if (offered !== undefined) {
        methods.push(offered);
        carried = true;
      }
    }
  }
  return { country, sends: zone !== undefined, cannotSend: zone !== undefined && !carried, methods };
}

/**
 * The EU's customs union: the 27 member states, Monaco, which is inside
 * France's customs area, and San Marino, in a customs union with the EU —
 * written out again from `modules/shop/quote.go`, which is the platform's.
 */
const CUSTOMS_UNION = new Set(
  'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK MC SM'.split(' '),
);

/** The customs area a country is in: Switzerland and Liechtenstein are one, the union another, any other country its own. */
function customsArea(country) {
  const one = country.trim().toUpperCase();
  if (one === 'CH' || one === 'LI') return 'CH';
  return CUSTOMS_UNION.has(one) ? 'EU' : one;
}

/**
 * A cart priced, and what its country is offered (`QuoteOf` of the platform):
 * a cart with a refused line is offered no method and is not said to be one
 * that cannot be sent; a parcel is abroad when it is sent and leaves the
 * business's customs area.
 */
function quoteOf(find, shipping, cart, rawCountry, home) {
  const { priced, refused } = priceCart(find, cart);
  const offer = offerFor(shipping, rawCountry, { subtotal: priced.subtotal, weight: priced.weight, class: priced.class });
  if (refused.length > 0) {
    offer.methods = [];
    offer.cannotSend = false;
  }
  const abroad = offer.sends && home !== '' && customsArea(offer.country) !== customsArea(home);
  return { priced, refused, offer, abroad };
}

/** A quote as a page is told it, in the site's currency in lower case. */
function quoteAnswer(quote, currency) {
  return {
    currency: currency.toLowerCase(),
    lines: quote.priced.lines.map(quotedLine),
    refused: quote.refused,
    subtotal: quote.priced.subtotal,
    country: quote.offer.country,
    sends: quote.offer.sends,
    cannot_send: quote.offer.cannotSend,
    abroad: quote.abroad,
    methods: quote.offer.methods.map(({ method, name, pickup, price, free }) => ({ method, name, pickup, price, free })),
    // localhost has neither switch: the owner turns them on in the panel, on the platform.
    vat_included: false,
    own_currency: false,
  };
}

/** A priced line as a page reads it, and as an order freezes it. */
function quotedLine(line) {
  return {
    line: line.line,
    product: line.product,
    variant: line.variant,
    sku: line.sku,
    title: line.title,
    labels: [...line.labels],
    answers: line.answers.map((one) => ({ ...one })),
    unit: line.unit,
    qty: line.qty,
    total: line.total,
  };
}

// ── what a buyer may type (`CheckBuyer` of the platform) ────────────────────

const ATEXT = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~\\-\\u0080-\\u{10FFFF}]+";
const EMAIL = new RegExp(`^${ATEXT}(?:\\.${ATEXT})*@${ATEXT}(?:\\.${ATEXT})+$`, 'u');

/** One address and nothing else: of at most 254 bytes, on one line, with a dot in its domain — in any script. */
function isEmail(email) {
  return email !== '' && new TextEncoder().encode(email).length <= 254 && !breaks(email) && EMAIL.test(email);
}

/** A telephone number: digits, spaces and + - ( ), at most 40 characters. */
const isPhone = (phone) => lengthOf(phone) <= 40 && /^[\p{Nd} +\-()]*$/u.test(phone);

/** A text of this many characters on one line. */
function oneLine(text, least, most) {
  const n = lengthOf(text);
  return n >= least && n <= most && !breaks(text);
}

/** What a buyer typed, held to its shape: the paths that are wrong, in the wire's order. A pick-up asks no address. */
function checkBuyer(buyer, address, pickup) {
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const bad = [];
  if (!oneLine(text(buyer.name), 1, 120)) bad.push('buyer.name');
  if (!isEmail(text(buyer.email))) bad.push('buyer.email');
  if (text(buyer.phone) !== '' && !isPhone(text(buyer.phone))) bad.push('buyer.phone');
  if (pickup) return bad;
  for (const [path, value, least, most] of [
    ['address.line1', address.line1, 1, 200],
    ['address.line2', address.line2, 0, 200],
    ['address.postal_code', address.postal_code, 1, 20],
    ['address.city', address.city, 1, 100],
  ]) {
    if (!oneLine(text(value), least, most)) bad.push(path);
  }
  return bad;
}

// ── the answers ─────────────────────────────────────────────────────────────

const json = (res, status, body) => {
  res.setHeader('X-Jtk-Dev-Shop', '1');
  send(res, status, body);
};

/** A refusal of the shop's with no JSON, a sentence for the developer to read. */
function sentence(res, status, text, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Jtk-Dev-Shop', '1');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(text);
}

const escaped = (text) => String(text).replace(/[&<>"']/g, (one) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[one]);

/** The local page that stands in for Stripe's: nothing is charged; *Pay* or *Leave*. */
function payPage(site, order, token) {
  const language = SHOP_LOCALES.includes(String(site.locale).split('-')[0].toLowerCase()) ? String(site.locale).split('-')[0].toLowerCase() : 'en';
  const words = DEV_PAY_WORDS[language];
  const pay = shopWordsFor(language).pay;
  const amount = money(order.total, site.currency || undefined, site.locale || language);
  const action = (name) => `/api/dev-pay?order=${encodeURIComponent(token)}&amp;do=${name}`;
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${escaped(pay)} ${escaped(amount)}</title>
<style>
body { font: 1rem/1.5 system-ui, sans-serif; margin: 0; }
main { max-width: 32rem; margin: 0 auto; padding: 3rem 1rem; }
button { font: inherit; padding: 0.6em 1.2em; cursor: pointer; }
form { display: inline-block; margin: 0.5rem 0.5rem 0 0; }
</style>
</head>
<body>
<main>
<h1>${escaped(amount)}</h1>
<p>${escaped(words.note)}</p>
<form method="post" action="${action('pay')}"><button type="submit">${escaped(pay)}</button></form>
<form method="post" action="${action('leave')}"><button type="submit">${escaped(words.leave)}</button></form>
</main>
</body>
</html>
`;
}

/** The path a buyer is sent back to, as the edge makes it: on this host whatever the page named, with the order on it. */
function backTo(order, left) {
  const back = new URL(order.return, 'http://localhost');
  back.searchParams.set('order', order.token);
  if (left) back.searchParams.set('left', '1');
  return back.pathname + back.search + back.hash;
}

/** The return a page named, as the edge makes it: a path on this host, whatever host the page named. */
function returnOf(value) {
  let back;
  try {
    back = new URL(String(value ?? '/'), 'http://localhost');
  } catch {
    back = new URL('/', 'http://localhost');
  }
  return back.pathname + back.search + back.hash;
}

/**
 * The language a call asks for, as the platform reads it (`LocaleOf`): a tag
 * the site has, in the spelling the site has it, else none — the site's own.
 * Never a refusal: a buyer is not turned away for the page's word.
 */
function localeOf(site, said) {
  const tag = typeof said === 'string' ? said.toLowerCase() : '';
  const canonical = /^[a-z]{2}(-[a-z]{2})?$/.test(tag) ? canonicalLocale(tag) : null;
  return canonical !== null && site.locales.includes(canonical) ? canonical : '';
}

/**
 * What the site's files say, read fresh on every request so an edit shows at
 * once — through the door, as the storefront on the page reads them. Nothing
 * where the schema does not turn the shop on (contract 3's `modules.shop`).
 */
async function read(root) {
  const site = content(await readJtk(root));
  const roles = site.contract === 3 ? site.rolesOf('shop') : undefined;
  if (roles === undefined) return undefined;
  const shipping = shippingOf(site.module('shop'));
  // Where the parcels leave from: the shared field whose role is `country`, else the first zone's first country.
  const shared = site.facts().text('country').trim().toUpperCase();
  const home = /^[A-Z]{2}$/.test(shared) ? shared : (shipping.zones.flatMap((zone) => zone.countries)[0] ?? '');
  const collection = roles.products ?? 'products';

  /**
   * The products offered, in the language asked: a lookup by an entry's id,
   * either case. An entry a module sells is in every language, always (the
   * door's rule, `bookedIn`): so the language chooses the words and never what
   * is sold (Ruling 210) — a product with no words in the language is read in
   * the site's own.
   */
  const productsIn = (locale) => {
    const entries = new Map(site.entries(collection, locale === '' ? {} : { locale }).map((entry) => [entry.id.toLowerCase(), entry]));
    const made = new Map();
    return (id) => {
      const key = String(id).toLowerCase();
      if (!entries.has(key)) return undefined;
      if (!made.has(key)) made.set(key, productOf(entries.get(key), site.currency));
      return made.get(key);
    };
  };
  return { site, shipping, home, productsIn };
}

/**
 * The shop on the dev server: shop/1's four addresses and a local page that
 * pays nothing, answered from the site's files read fresh on every request.
 * Mounted at /api beside devDiary; anything else, and everything on a site
 * whose schema does not turn the shop on, is next()'s.
 *
 * @param {string} root the site's directory
 * @param {{ soldOut?: string[] }} [options] SKUs answered sold out — the files
 *   carry no count, and a walk needs one (Tasks 9.12–9.17)
 * @returns {(req: any, res: any, next: () => void) => Promise<void>}
 */
export function devShop(root, options = {}) {
  // A SKU is keyed in lower case, as the platform's ledger keys it (`SKUKey`): the walk may name it either way.
  const soldOut = new Set((options.soldOut ?? []).map((sku) => sku.toLowerCase()));
  /** token → order; kept until the server stops */
  const orders = new Map();
  /** a press's attempt → its order's token */
  const attempts = new Map();
  let numbered = FIRST_NUMBER - 1;
  let told = false;

  /** The order's pay page: this server's own, on the host the page was fetched from. */
  const payUrl = (req, token) => `http://${req.headers.host ?? 'localhost'}/api/dev-pay?order=${encodeURIComponent(token)}`;
  const paying = (req, order) => ({ order: order.token, url: payUrl(req, order.token), expires_at: new Date(order.made + PAYMENT_LASTS).toISOString() });
  const orderAnswer = (res, req, order) => json(res, 201, paying(req, order));

  /** A second ask for an order already made, answered as billing does: the same page while it waits. */
  function payFor(res, req, token) {
    const order = orders.get(token);
    if (order === undefined) return json(res, 404, { error: 'not_found', order: token });
    if (order.state === 'paid') return json(res, 409, { error: 'paid', order: token });
    return orderAnswer(res, req, order);
  }

  const routes = {
    // ── GET /stock?product=<id>… ──────────────────────────────────────────
    async '/stock'({ res, url, served }) {
      const asked = url.searchParams.getAll('product');
      if (asked.length < 1 || asked.length > MAX_STOCK_PRODUCTS) {
        return sentence(res, 400, `a call asks after 1 to ${MAX_STOCK_PRODUCTS} products, not ${asked.length}`);
      }
      for (const raw of asked) if (!UUID.test(raw)) return sentence(res, 400, `"${raw}" is not a product's id`);
      const find = served.productsIn('');
      return json(res, 200, {
        products: asked.map((id) => {
          const product = find(id);
          return { id, served: product !== undefined, variants: product === undefined ? [] : stockOf(product, soldOut) };
        }),
      });
    },

    // ── POST /shipping ────────────────────────────────────────────────────
    async '/shipping'({ req, res, served }) {
      // The edge refuses what does not parse to a JSON object, before anything is asked.
      const body = await bodyOf(req, { strict: true });
      if (body === undefined) return json(res, 400, { error: 'invalid_body' });
      const find = served.productsIn(localeOf(served.site, body.locale));
      const quote = quoteOf(find, served.shipping, cartOf(body.lines), typeof body.country === 'string' ? body.country : '', served.home);
      return json(res, 200, quoteAnswer(quote, served.site.currency));
    },

    // ── POST /checkout ────────────────────────────────────────────────────
    async '/checkout'({ req, res, served }) {
      // The edge refuses what does not parse to a JSON object, before anything is asked.
      const body = await bodyOf(req, { strict: true });
      if (body === undefined) return json(res, 400, { error: 'invalid_body' });

      // A second ask: an order, and no cart.
      if (typeof body.order === 'string' && body.order.trim() !== '' && (body.lines === undefined || body.lines === null)) {
        return payFor(res, req, body.order.trim());
      }

      const buyer = isObject(body.buyer) ? body.buyer : {};
      const email = typeof buyer.email === 'string' ? buyer.email.trim() : '';
      const attempt = typeof body.attempt === 'string' ? body.attempt : '';
      if (attempt !== '' && !ATTEMPT.test(attempt)) return sentence(res, 400, ATTEMPT_RULE);
      // A press is one order, and its buyer's: the lost answer asked for again, whatever else the body says now.
      const made = attempt === '' ? undefined : orders.get(attempts.get(attempt));
      if (made !== undefined) {
        if (made.email !== email.toLowerCase()) return json(res, 409, { error: 'attempt' });
        return payFor(res, req, made.token);
      }

      // In the buyer's language where the site has it, as the cart was shown: the lines the order freezes are the words they saw.
      const locale = localeOf(served.site, body.locale);
      const currency = served.site.currency;
      if (currency === '') return sentence(res, 409, 'this site has no currency, so it sells nothing');
      const quote = quoteOf(served.productsIn(locale), served.shipping, cartOf(body.lines), typeof body.country === 'string' ? body.country : '', served.home);
      const answer = quoteAnswer(quote, currency);
      if (quote.refused.length > 0) return json(res, 409, { error: 'refused', quote: answer });
      const offered = quote.offer.methods.filter((one) => one.method === body.method);
      if (offered.length !== 1) return json(res, 409, { error: 'method', quote: answer });
      const [method] = offered;

      const address = isObject(body.address) ? body.address : {};
      const bad = checkBuyer(buyer, address, method.pickup);
      if (bad.length > 0) return json(res, 400, { error: 'buyer', fields: bad });
      const back = returnOf(body.return);
      if (back.length > MAX_RETURN) return json(res, 400, { error: 'return' });

      const { subtotal } = quote.priced;
      const shipping = method.price;
      if (quote.priced.lines.length === 0 || (subtotal === 0 && shipping === 0)) return json(res, 400, { error: 'nothing_to_pay' });
      if (shipping > MAX_CART_MINOR || subtotal > MAX_CART_MINOR - shipping) {
        const says = 'the cart and its shipping would come to more than the most one amount may be';
        return json(res, 409, { error: 'refused', quote: { ...answer, refused: [...answer.refused, { line: -1, code: 'too_large', says }] } });
      }
      if (body.total !== subtotal + shipping) return json(res, 409, { error: 'total', quote: answer });

      // The last item goes to the first who goes on to pay: a SKU the walk named sold out is short.
      const wanted = new Map();
      for (const line of quote.priced.lines) if (line.tracked) wanted.set(line.sku, (wanted.get(line.sku) ?? 0) + line.qty);
      const short = [...wanted].filter(([sku]) => soldOut.has(sku.toLowerCase())).map(([sku, qty]) => ({ sku, wanted: qty, available: 0 }));
      if (short.length > 0) return json(res, 409, { error: 'short', short, quote: answer });

      const order = {
        token: randomBytes(24).toString('base64url'),
        email: email.toLowerCase(),
        state: 'waiting',
        number: 0,
        lines: answer.lines,
        subtotal,
        shipping,
        total: subtotal + shipping,
        currency: answer.currency,
        method: method.name,
        pickup: method.pickup,
        return: back,
        made: Date.now(),
      };
      orders.set(order.token, order);
      if (attempt !== '') attempts.set(attempt, order.token);
      return orderAnswer(res, req, order);
    },

    // ── GET /order?token=<order> ──────────────────────────────────────────
    async '/order'({ req, res, url }) {
      const order = orders.get(url.searchParams.get('token') ?? '');
      if (order === undefined) return json(res, 404, { error: 'not_found' });
      const waiting = order.state === 'waiting';
      return json(res, 200, {
        state: order.state,
        ...(order.number > 0 ? { number: order.number } : {}),
        lines: order.lines,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        currency: order.currency,
        method: order.method,
        pickup: order.pickup,
        ...(waiting ? { pay_url: payUrl(req, order.token) } : {}),
      });
    },

    // ── the local page that pays nothing ──────────────────────────────────
    async '/dev-pay'({ req, res, url, served }) {
      const token = url.searchParams.get('order') ?? '';
      const order = orders.get(token);
      if (order === undefined) return sentence(res, 404, 'nobody has this order');
      const redirect = (to) => {
        res.statusCode = 303;
        res.setHeader('Location', to);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Jtk-Dev-Shop', '1');
        res.end();
      };
      if (req.method === 'GET') {
        // An order already paid has nothing to pay: back to its page.
        if (order.state === 'paid') return redirect(backTo(order, false));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Jtk-Dev-Shop', '1');
        return res.end(payPage(served.site, order, token));
      }
      const action = url.searchParams.get('do');
      if (action !== 'pay' && action !== 'leave') return sentence(res, 400, 'do is pay or leave');
      // A paid order was not left, and paying twice is one number.
      if (order.state === 'paid') return redirect(backTo(order, false));
      if (action === 'pay') {
        order.state = 'paid';
        order.number = ++numbered;
        return redirect(backTo(order, false));
      }
      return redirect(backTo(order, true));
    },
  };
  const allowed = { '/stock': 'GET', '/shipping': 'POST', '/checkout': 'POST', '/order': 'GET', '/dev-pay': 'GET, POST' };

  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '') || '/';
    if (!Object.hasOwn(routes, path)) return next();
    try {
      const served = await read(root);
      if (served === undefined) return next();

      // The version a page speaks: absent is version 1, said once so a page that does not name it is told.
      // Not of the pay page, which is no address of the protocol's but a page a browser is sent to.
      const spoken = path === '/dev-pay' ? '1' : String(req.headers?.['x-jtk-shop'] ?? '').trim();
      if (spoken === '') {
        if (!told) {
          told = true;
          console.warn('[dev shop] a request came without X-Jtk-Shop: 1 — the platform reads it as version 1, but a page names the version it speaks (the kit\'s elements do)');
        }
      } else if (!PROTOCOLS.includes(Number(spoken))) {
        return json(res, 400, { error: 'JTK_E_SHOP_PROTOCOL', said: spoken, supported: PROTOCOLS });
      }
      if (!allowed[path].split(', ').includes(req.method ?? 'GET')) return sentence(res, 405, 'method not allowed', { Allow: allowed[path] });
      await routes[path]({ req, res, url, served });
    } catch (why) {
      // A file that is not JSON, as the door reads it: said with its name, where a developer reads it.
      sentence(res, 500, why instanceof Error ? why.message : String(why));
    }
  };
}
