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
 */
export function money(minor: number, currency: string | undefined, locale: string): string {
  // In the currency's own minor unit (11 October 2026): a hundredth of a
  // franc, a whole yen — ISO 4217's digits, which `Intl` carries.
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

/** How many digits a currency's minor unit has, by ISO 4217 as `Intl` knows it. */
export function digitsOf(currency: string, locale = 'en'): number {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
