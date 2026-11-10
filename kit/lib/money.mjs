/**
 * A price as the page says it: «2 300 ₴», not «2 300,00 UAH».
 *
 * Minor units in, as the platform stores them. The narrow sign, because a
 * language's own data may write a currency as its code; no kopecks on a whole
 * price, because «,00» on a price list reads like a spreadsheet. And no sign
 * at all where the site has not said what its prices are in — one made up
 * here is a lie on every price: a hotel's hryvnias read as francs (2 October
 * 2026). The currency is the site's, from the brief, written into
 * jtk/site.json by the platform; it is for showing a price, nothing more.
 *
 * The amount alone: a price «from» or «on request» says so in words
 * (`priceWords` below), which the door puts around it.
 *
 * @param {number} minor
 * @param {string | undefined} currency
 * @param {string} locale
 * @returns {string}
 */
export function money(minor, currency, locale) {
  // In the currency's own minor unit (11 October 2026): a hundredth of a
  // franc, a whole yen, a thousandth of a dinar — ISO 4217's digits, which
  // `Intl` carries and the platform counts by too. A hundredth everywhere
  // showed ¥1000 as «¥10».
  const places = currency ? digitsOf(currency, locale) : 2;
  const value = minor / 10 ** places;
  const digits = Number.isInteger(value) ? 0 : places;
  if (!currency) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: places }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: places,
  }).format(value);
}

/**
 * The words a price's qualifiers are said in, per language: «ab {amount}» for
 * a price `from`, «auf Anfrage» for one `on_request` — the two contract 3
 * writes beside the amount, `{ "minor": 4500, "from": true }` and
 * `{ "on_request": true }` (wiki/98 §3.4). `{amount}` is where the price
 * goes.
 *
 * Kept as the booking form keeps its words (`booking/words.mjs`): a table by
 * language, in the languages the form carries, read through a function that
 * hands out a fresh object. `from` is the form's own word, the one it puts
 * before its least price, so the form and the price list on one site say one
 * thing; a test holds the two equal. It is a copy rather than an import
 * because this file is in every page that draws a price in the browser, and
 * the form's words are not.
 */
const QUALIFIERS = {
  uk: { from: 'від {amount}', on_request: 'за запитом' },
  de: { from: 'ab {amount}', on_request: 'auf Anfrage' },
  en: { from: 'from {amount}', on_request: 'on request' },
  ru: { from: 'от {amount}', on_request: 'по запросу' },
  es: { from: 'desde {amount}', on_request: 'a consultar' },
  it: { from: 'da {amount}', on_request: 'su richiesta' },
  pt: { from: 'desde {amount}', on_request: 'sob consulta' },
  fr: { from: 'à partir de {amount}', on_request: 'sur demande' },
};

/**
 * A price's qualifiers in a language (wiki/98 §15 · 11), as a fresh object
 * the caller may write over — a template that says its own passes them to
 * `site.money`. A regional language reads its language's words (`de-CH` is
 * German); a language the kit has no words in reads English, as the booking
 * form does.
 *
 * @param {string | undefined} locale
 * @returns {{ from: string; on_request: string }}
 */
export function priceWords(locale) {
  const plain = String(locale ?? '').split('-')[0].toLowerCase();
  return { ...(Object.hasOwn(QUALIFIERS, plain) ? QUALIFIERS[plain] : QUALIFIERS.en) };
}

/**
 * How many digits a currency's minor unit has, by ISO 4217 as `Intl` knows it.
 *
 * @param {string} currency
 * @param {string} [locale]
 * @returns {number}
 */
export function digitsOf(currency, locale = 'en') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
