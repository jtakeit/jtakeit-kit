/**
 * A product's facts, as the storefront's product page needs them, read
 * through the door (`content()`, contract 3) and decided without a document:
 * its options and what each value is, its variants and what each picks, the
 * questions it asks, which value of which option is sold out given the others
 * chosen, and whether an answer is what the product asks.
 *
 * The page carries the facts as `data-facts` (JSON), and the element works
 * from them with what `GET /api/stock` says is left. The platform decides
 * every sale: a variant it does not hold is `off_sale` in the stock answer,
 * and a line it will not price is refused in the shipping answer. Nothing here
 * judges a product, as nothing in the door does; it reads what the entry says
 * the way the shop's catalog reads it (`modules/shop/catalog.go` of the
 * platform): an option, a value or a row without a `_key` is named by its
 * place, a variant is on sale unless it says `on_sale: false`, a product counts
 * its stock unless it says `tracked: false`.
 *
 * Prices are whole minor units of the site's one currency.
 */

/**
 * @typedef {{ key: string; name: string; values: { key: string; label: string }[] }} Option
 * @typedef {{ key: string; sku: string; price?: number; picks: Record<string, string>; onSale: boolean }} Variant
 * @typedef {{ key: string; name: string; kind: 'choice' | 'yes_no' | 'text'; required: boolean; max?: number; adds?: number; choices: { key: string; label: string; adds?: number }[] }} Customization
 * @typedef {{ id: string; currency: string; tracked: boolean; options: Option[]; variants: Variant[]; customizations: Customization[] }} ProductFacts
 * @typedef {'in_stock' | 'sold_out' | 'none'} ValueState
 */

const KINDS = new Set(['choice', 'yes_no', 'text']);

/** A row's `_key`, or its place where it has none, as the shop's catalog names it. */
const keyOf = (row) => (typeof row.key === 'string' && row.key !== '' ? row.key : String(row.index));

/**
 * A product's facts, from the entry the door hands out.
 *
 * @param {import('../../types/content').Entry} entry a product, in the language of the page
 * @param {string} currency the site's, as `jtk/site.json` says it
 * @returns {ProductFacts}
 */
export function productFacts(entry, currency) {
  const fields = entry.fields;
  const tracked = fields.value('tracked');
  return {
    id: entry.id,
    currency,
    tracked: typeof tracked === 'boolean' ? tracked : true,
    options: fields.rows('options').map((row) => ({
      key: keyOf(row),
      name: row.text('name'),
      values: row.rows('values').map((value) => ({ key: keyOf(value), label: value.text('label') })),
    })),
    variants: fields.rows('variants').map((row) => {
      const price = row.minor('price');
      const onSale = row.value('on_sale');
      return {
        key: keyOf(row),
        sku: row.text('sku'),
        ...(price === undefined ? {} : { price }),
        picks: row.picks('picks'),
        // Without `on_sale`, on sale; one that is not a switch is never on sale.
        onSale: onSale === undefined || onSale === true,
      };
    }),
    customizations: fields.rows('customizations').flatMap((row) => {
      const kind = row.text('kind');
      if (!KINDS.has(kind)) return [];
      const max = row.value('max');
      const adds = row.minor('adds');
      return [{
        key: keyOf(row),
        name: row.text('name'),
        kind: /** @type {'choice' | 'yes_no' | 'text'} */ (kind),
        // A yes-or-no is ticked or not, and is never required.
        required: kind !== 'yes_no' && row.value('required') === true,
        ...(kind === 'text' && Number.isInteger(max) && /** @type {number} */ (max) >= 1 ? { max: /** @type {number} */ (max) } : {}),
        ...(adds === undefined ? {} : { adds }),
        choices: kind === 'choice'
          ? row.rows('choices').map((choice) => {
            const more = choice.minor('adds');
            return { key: keyOf(choice), label: choice.text('label'), ...(more === undefined ? {} : { adds: more }) };
          })
          : [],
      }];
    }),
  };
}

/**
 * The variant whose picks are exactly what is chosen: every option of the
 * product, one value each, and nothing else. A product with no option has one
 * variant, picking nothing, and `{}` chooses it.
 *
 * @param {ProductFacts} facts
 * @param {Record<string, string>} chosen an option's `_key` to a value's `_key`
 * @returns {Variant | undefined}
 */
export function variantFor(facts, chosen) {
  const named = new Set(facts.options.map((option) => option.key));
  return facts.variants.find(
    (variant) =>
      Object.keys(variant.picks).every((key) => named.has(key)) &&
      facts.options.every((option) => chosen[option.key] !== undefined && chosen[option.key] !== '' && variant.picks[option.key] === chosen[option.key]),
  );
}

/**
 * What a stock answer says of a variant, or, where it has not said, what the
 * build says: on sale reads as in stock, taken off sale as none. Only a state
 * the kit knows counts as one.
 *
 * @param {Variant} variant
 * @param {Record<string, string>} stock
 * @returns {ValueState}
 */
function stateOf(variant, stock) {
  if (!Object.hasOwn(stock, variant.key)) return variant.onSale ? 'in_stock' : 'none';
  return stock[variant.key] === 'in_stock' ? 'in_stock' : stock[variant.key] === 'sold_out' ? 'sold_out' : 'none';
}

/**
 * Each option's values, given the others as chosen: `in_stock` where a variant
 * with that value (and the other options as chosen) can be bought, `sold_out`
 * where there are such variants and every one is sold out, `none` where no
 * variant on sale is that value together with what is chosen. An option the
 * buyer has not chosen yet counts for nothing, so a value is read against the
 * choices made, never against its own option's: a buyer may always switch.
 *
 * `stock` is by the variant's `_key`, the stock answer's `key`, with the
 * answer's `state`: `in_stock`, `sold_out` or `off_sale`. A variant the answer
 * has not named (it has not arrived, or it failed) is read as the build says
 * it: on sale is in stock, off sale is none — the shop decides at the cart and
 * the checkout either way.
 *
 * @param {ProductFacts} facts
 * @param {Record<string, 'in_stock' | 'sold_out' | 'off_sale'>} stock
 * @param {Record<string, string>} chosen an option's `_key` to a value's `_key`
 * @returns {Record<string, Record<string, ValueState>>} option, then value
 */
export function valueStates(facts, stock, chosen) {
  /** @type {Record<string, Record<string, ValueState>>} */
  const states = {};
  for (const option of facts.options) {
    /** @type {Record<string, ValueState>} */
    const of = {};
    for (const value of option.values) {
      /** @type {ValueState} */
      let state = 'none';
      for (const variant of facts.variants) {
        if (variant.picks[option.key] !== value.key) continue;
        const fits = facts.options.every((other) => other.key === option.key || !chosen[other.key] || variant.picks[other.key] === chosen[other.key]);
        if (!fits) continue;
        const said = stateOf(variant, stock);
        if (said === 'in_stock') {
          state = 'in_stock';
          break;
        }
        if (said === 'sold_out') state = 'sold_out';
      }
      of[value.key] = state;
    }
    states[option.key] = of;
  }
  return states;
}

/**
 * What a text may be, as the shop reads one: composed, trimmed, and not
 * nothing a person can see — zero-width joiners and white space alone are no
 * answer.
 */
function textOf(raw) {
  const text = typeof raw === 'string' ? raw.normalize('NFC').trim() : '';
  return text.replace(/[\s‌‍]/g, '') === '' ? '' : text;
}

/**
 * What a form gave for the product's questions, held to what it asks: the
 * answers a cart line carries (a choice's `_key`, `true`, or a text) and the
 * faults, by question. A question left unanswered is no answer, and a fault
 * where it is required; a yes-or-no unticked is no answer and never a fault; an
 * answer to a question the product does not ask is left out. A text is
 * counted in characters, as the shop counts it.
 *
 * @param {ProductFacts} facts
 * @param {Record<string, string | boolean>} given a customization's `_key` to what the form says
 * @returns {{ answers: Record<string, string | boolean>; faults: { key: string; word: 'required' | 'too_long' | 'not_a_choice' }[] }}
 */
export function answersOf(facts, given) {
  /** @type {Record<string, string | boolean>} */
  const answers = {};
  /** @type {{ key: string; word: 'required' | 'too_long' | 'not_a_choice' }[]} */
  const faults = [];
  for (const one of facts.customizations) {
    const raw = Object.hasOwn(given, one.key) ? given[one.key] : undefined;
    if (one.kind === 'yes_no') {
      if (raw === true) answers[one.key] = true;
      continue;
    }
    if (one.kind === 'choice') {
      if (raw === undefined || raw === null || raw === false || raw === '') {
        if (one.required) faults.push({ key: one.key, word: 'required' });
      } else if (typeof raw === 'string' && one.choices.some((choice) => choice.key === raw)) {
        answers[one.key] = raw;
      } else {
        faults.push({ key: one.key, word: 'not_a_choice' });
      }
      continue;
    }
    const text = textOf(raw);
    if (text === '') {
      if (one.required) faults.push({ key: one.key, word: 'required' });
    } else if (one.max !== undefined && [...text].length > one.max) {
      faults.push({ key: one.key, word: 'too_long' });
    } else {
      answers[one.key] = text;
    }
  }
  return { answers, faults };
}

/**
 * The lowest price of the variants on sale, for «from CHF 29.90». Nothing for
 * a product none of whose variants on sale has a price.
 *
 * @param {ProductFacts} facts
 * @returns {number | undefined}
 */
export function fromPrice(facts) {
  const prices = facts.variants.filter((variant) => variant.onSale && variant.price !== undefined).map((variant) => /** @type {number} */ (variant.price));
  return prices.length === 0 ? undefined : Math.min(...prices);
}
