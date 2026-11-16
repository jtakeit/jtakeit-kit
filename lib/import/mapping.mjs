/**
 * The mapping `jtk import products --map` reads: which column of the sheet is
 * which field of a product, and how its cells are read — and the readers of
 * those cells, because what a mapping says (`decimal`, a weight's unit, what
 * means yes) is what makes a cell an amount, a weight or a switch.
 *
 *   { "v": 1, "collection"?, "delimiter"?, "decimal": "." | ",", "group"?, "skip"?, "fields": {…} }
 *
 * Nothing in the file is guessed at. A key the import does not read is
 * refused — a misspelt `"prize"` is a price the business never gets — and so is
 * a column the sheet has not got, naming the key that names it. Nothing a
 * reader here answers is rounded: a number is read exactly or it is refused.
 */

const DECIMALS = ['.', ','];
const DELIMITERS = new Map([[',', ','], [';', ';'], ['\t', '\t'], ['tab', '\t']]);
const TOP = ['v', 'collection', 'delimiter', 'decimal', 'group', 'skip', 'fields'];
const FIELDS = ['title', 'description', 'slug', 'sku', 'price', 'options', 'weight', 'size_class', 'tax_code', 'tariff_number', 'made_in', 'stock', 'on_sale', 'visible', 'tracked'];
/** Fields this version does not read yet: named, so that a mapping that has them is told so and not left to guess. */
const LATER = { pictures: 'the pictures are not read by this version of the import: take the key out of the mapping' };
const UNITS = ['g', 'kg'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const quoted = (name) => `«${name}»`;

/** A mapping that cannot be used, with every fault it has. */
export class MappingError extends Error {}

/**
 * The mapping, as the import reads it: every field's column checked against
 * the sheet's header, a field that says one thing in a short way made to say
 * it in the long one.
 *
 * @param {string} text the mapping file
 * @param {string[]} header the sheet's columns
 * @returns {{
 *   v: 1, collection: string | undefined, delimiter: string | undefined, decimal: '.' | ',',
 *   group: undefined | { by: string } | { parent: string, of: string[] },
 *   skip: undefined | { column: string, values: string[] },
 *   fields: {
 *     title: { locale: string | null, column: string }[],
 *     description: { locale: string | null, column: string }[],
 *     slug?: string, sku?: string, price: string,
 *     options: { name: { column: string } | { is: string }, value: string, none: string[] }[],
 *     weight?: { column: string, unit: 'g' | 'kg' },
 *     size_class?: string, tax_code?: string, tariff_number?: string, made_in?: string, stock?: string,
 *     on_sale?: Switch, visible?: Switch, tracked?: Switch,
 *   },
 * }}
 * @typedef {{ column: string, yes: string[] | null }} Switch
 */
export function readMapping(text, header) {
  let given;
  try {
    given = JSON.parse(text);
  } catch (why) {
    throw new MappingError(`the mapping is not JSON: ${why instanceof Error ? why.message : why}`);
  }
  if (!isObject(given)) throw new MappingError('the mapping is not an object: { "v": 1, "decimal": ".", "fields": { … } }');

  const problems = [];
  const fault = (where, why) => problems.push(`${where}: ${why}`);
  const known = new Set(header);
  /** A column the sheet has, said once: by the key that names it. */
  const column = (where, name) => {
    if (typeof name !== 'string' || name.trim() === '') {
      fault(where, 'names no column: a column is the name of one of the sheet\'s, in quotes');
      return '';
    }
    const one = name.trim();
    if (!known.has(one)) fault(where, `names the column ${quoted(one)} and the sheet has not got one (its columns: ${header.filter((each) => each !== '').join(', ')})`);
    else if (header.filter((each) => each === one).length > 1) fault(where, `names the column ${quoted(one)}, which the sheet has twice — the mapping cannot say which`);
    return one;
  };

  for (const key of Object.keys(given)) {
    if (!TOP.includes(key)) fault(key, `is not a key of a mapping (${TOP.join(', ')})`);
  }
  if (given.v !== 1) fault('v', 'is 1: the mapping\'s version, `{ "v": 1, … }`');
  if (!DECIMALS.includes(given.decimal)) fault('decimal', 'says how the sheet writes 12.50: `"decimal": "."` or `"decimal": ","`, and the mapping must say it — prices are never guessed');
  if (given.collection !== undefined && (typeof given.collection !== 'string' || given.collection.trim() === '')) fault('collection', 'is the name of the collection the products go into, or is left out for the shop\'s products');
  let delimiter;
  if (given.delimiter !== undefined) {
    delimiter = DELIMITERS.get(given.delimiter);
    if (delimiter === undefined) fault('delimiter', 'is `","`, `";"` or `"\\t"` (a tab), or is left out for the one the header says');
  }

  let group;
  if (given.group !== undefined) {
    const one = given.group;
    if (isObject(one) && Object.keys(one).join() === 'by') group = { by: column('group.by', one.by) };
    else if (isObject(one) && Object.keys(one).sort().join() === 'of,parent') {
      const of = Array.isArray(one.of) && one.of.length > 0 ? one.of.map((name, at) => column(`group.of[${at}]`, name)) : (fault('group.of', 'names the columns a parent is told by: ["ID", "SKU"]'), []);
      group = { parent: column('group.parent', one.parent), of };
    } else fault('group', 'is `{ "by": "<column>" }` (rows with one value are one product) or `{ "parent": "<column>", "of": ["<column>", …] }` (a row names its parent by one of those columns)');
  }

  let skip;
  if (given.skip !== undefined) {
    const one = given.skip;
    if (isObject(one) && Object.keys(one).sort().join() === 'column,values' && Array.isArray(one.values) && one.values.length > 0 && one.values.every((each) => typeof each === 'string' && each.trim() !== '')) {
      // Compared without regard to case or the spaces round them: a WooCommerce `Type` is `grouped` and a person writes `Grouped`.
      skip = { column: column('skip.column', one.column), values: one.values.map((each) => each.trim().toLowerCase()) };
    } else fault('skip', 'is `{ "column": "<column>", "values": ["…"] }`: a row whose cell in that column is one of the values is left out, and said');
  }

  const fields = given.fields;
  if (!isObject(fields)) {
    fault('fields', 'is the object that says which column is which field of a product');
    throw new MappingError(problems.join('\n'));
  }
  for (const key of Object.keys(fields)) {
    if (Object.hasOwn(LATER, key)) fault(`fields.${key}`, LATER[key]);
    else if (!FIELDS.includes(key)) fault(`fields.${key}`, `is not a field of a product the import reads (${FIELDS.join(', ')})`);
  }

  /** Words: a column, or `{ "<locale>": "<column>" }`; a column alone is the site's own language. */
  const words = (key, required) => {
    const one = fields[key];
    if (one === undefined) {
      if (required) fault(`fields.${key}`, 'is required: the column of the product\'s name');
      return [];
    }
    if (typeof one === 'string') return [{ locale: null, column: column(`fields.${key}`, one) }];
    if (isObject(one) && Object.keys(one).length > 0) return Object.entries(one).map(([locale, name]) => ({ locale, column: column(`fields.${key}.${locale}`, name) }));
    fault(`fields.${key}`, 'is a column, or `{ "<language>": "<column>", … }` for each language the sheet has the words in');
    return [];
  };
  const one = (key, required = false) => {
    if (fields[key] === undefined) {
      if (required) fault(`fields.${key}`, 'is required');
      return undefined;
    }
    return column(`fields.${key}`, fields[key]);
  };
  const switchOf = (key) => {
    const value = fields[key];
    if (value === undefined) return undefined;
    if (typeof value === 'string') return { column: column(`fields.${key}`, value), yes: null };
    if (isObject(value) && Object.keys(value).sort().join() === 'column,yes' && Array.isArray(value.yes) && value.yes.length > 0 && value.yes.every((each) => typeof each === 'string')) {
      return { column: column(`fields.${key}.column`, value.column), yes: value.yes.map((each) => each.trim()) };
    }
    fault(`fields.${key}`, 'is a column, whose yes and no are read as `yes`/`no`, `true`/`false`, `1`/`0`; or `{ "column": "…", "yes": ["…"] }`, whose listed values are yes and every other no');
    return undefined;
  };

  const out = {
    title: words('title', true),
    description: words('description', false),
    slug: one('slug'),
    sku: one('sku'),
    price: one('price', true),
    options: [],
    weight: undefined,
    size_class: one('size_class'),
    tax_code: one('tax_code'),
    tariff_number: one('tariff_number'),
    made_in: one('made_in'),
    stock: one('stock'),
    on_sale: switchOf('on_sale'),
    visible: switchOf('visible'),
    tracked: switchOf('tracked'),
  };

  if (fields.weight !== undefined) {
    const weight = fields.weight;
    if (typeof weight === 'string') out.weight = { column: column('fields.weight', weight), unit: 'g' };
    else if (isObject(weight) && Object.keys(weight).sort().join() === 'column,unit' && UNITS.includes(weight.unit)) out.weight = { column: column('fields.weight.column', weight.column), unit: weight.unit };
    else fault('fields.weight', 'is a column of grams, or `{ "column": "…", "unit": "g" | "kg" }`');
  }

  if (fields.options !== undefined) {
    if (!Array.isArray(fields.options)) fault('fields.options', 'is a list of `{ "name": "<column>" | { "is": "<name>" }, "value": "<column>" }`, one for each option a product may have');
    else {
      fields.options.forEach((option, at) => {
        const where = `fields.options[${at}]`;
        if (!isObject(option) || !Object.keys(option).every((key) => ['name', 'value', 'none'].includes(key))) {
          fault(where, 'is `{ "name": "<column>" | { "is": "<name>" }, "value": "<column>" }`, with `"none": ["…"]` for the values that say a variant has no value of the option');
          return;
        }
        let name;
        if (isObject(option.name) && Object.keys(option.name).join() === 'is' && typeof option.name.is === 'string' && option.name.is.trim() !== '') name = { is: option.name.is.trim() };
        else name = { column: column(`${where}.name`, option.name) };
        const none = option.none === undefined ? [] : Array.isArray(option.none) && option.none.every((each) => typeof each === 'string') ? option.none.map((each) => each.trim()) : (fault(`${where}.none`, 'is a list of the values that mean the option has no value, such as Shopify\'s "Default Title"'), []);
        out.options.push({ name, value: column(`${where}.value`, option.value), none });
      });
    }
  }

  if (problems.length > 0) throw new MappingError(problems.join('\n'));
  return { v: 1, collection: given.collection?.trim(), delimiter, decimal: given.decimal, group, skip, fields: out };
}

// ── what a cell is ────────────────────────────────────────────────────────

/**
 * A number as a sheet writes one: digits, and the mapping's decimal with digits
 * after it. No sign, no thousands, no currency: what is not exactly that is
 * not read.
 * @returns {{ whole: string, fraction: string } | undefined}
 */
function numberOf(text, decimal) {
  const found = (decimal === ',' ? /^(\d+)(?:,(\d+))?$/ : /^(\d+)(?:\.(\d+))?$/).exec(text);
  return found === null ? undefined : { whole: found[1], fraction: found[2] ?? '' };
}

/**
 * A number moved `places` digits to the left, exactly: the whole of it, and
 * what is left of the fraction past the places, which is nothing for a number
 * that is whole in them.
 * @returns {{ value: bigint, rest: string }}
 */
function scaled({ whole, fraction }, places) {
  return { value: BigInt(`${whole}${fraction.slice(0, places).padEnd(places, '0')}`), rest: fraction.slice(places) };
}

/** `12,505`-style hint: what the other decimal would have read, where it would have read it. */
function otherReading(text, decimal, read) {
  const other = decimal === ',' ? '.' : ',';
  const number = numberOf(text, other);
  if (number === undefined) return '';
  const got = read(number);
  return got === undefined ? '' : ` — \`"decimal": "${other}"\` would read it as ${got}`;
}

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * More digits after the separator than a currency or a unit has: never rounded, and a zero at the end is no way round
 * (`180.0` g is no 180 g, `12.500` no 12.50). Where the comma is the decimal and what stands before it is up to three digits,
 * `1,250` and `1,000` could as well be a thousand, and are said to be.
 * @param {string} text @param {'.' | ','} decimal @param {{ whole: string, fraction: string }} number
 * @param {number} has the digits the currency or the unit has below its unit @param {string} rule what says it, after «and»
 */
function tooMany(text, decimal, number, has, rule) {
  const { whole, fraction } = number;
  const digits = (n) => `${n} digit${n === 1 ? '' : 's'}`;
  const zeros = !/[1-9]/.test(fraction.slice(has));
  const thousand = decimal === ',' && fraction.length === 3 && whole.length <= 3;
  let tail = '';
  if (zeros) tail += ', and a zero at the end is no way round it';
  if (thousand) tail += zeros ? ': it could as well be a thousands separator' : ' — and it could as well be a thousands separator';
  return `«${text}» has ${digits(fraction.length)} after the ${decimal === ',' ? 'comma' : 'point'} and ${rule} — nothing is rounded${tail}`;
}

/**
 * A price in minor units: `12,50` with `","` is 1250 in a currency of two
 * digits. Never rounded, and never read by guessing what the digits after the
 * separator are: more of them than the currency has is refused, zeros
 * included — `1,250` under `","` is no 1.25, nor 1250, since three digits after
 * a separator is also how a thousands separator looks.
 * @param {string} text @param {'.' | ','} decimal @param {number} digits the currency's minor unit
 * @param {string} currency
 * @returns {{ minor: number } | { error: string }}
 */
export function readAmount(text, decimal, digits, currency) {
  const exact = (number) => {
    const { value, rest } = scaled(number, digits);
    return rest !== '' || value > SAFE ? undefined : Number(value);
  };
  const number = numberOf(text, decimal);
  if (number === undefined) {
    return { error: `«${text}» is not an amount in \`"decimal": "${decimal}"\` — digits and one ${decimal === ',' ? 'comma' : 'point'}, no sign, no thousands separator, no currency${otherReading(text, decimal, exact)}` };
  }
  if (number.fraction.length > digits) {
    return { error: tooMany(text, decimal, number, digits, `${currency} has ${digits === 0 ? 'none' : digits}`) };
  }
  const { value } = scaled(number, digits);
  if (value > SAFE) return { error: `«${text}» is more than an amount can hold` };
  return { minor: Number(value) };
}

/**
 * A weight in whole grams: `0.18` kg is 180. A weight has at most the digits
 * its unit has below a gram — three in kilograms, none in grams — and more is
 * refused, zeros included (`0.1800` kg, `180.0` g, `1,000` g): a number that is
 * not exactly grams is never rounded to them, and a zero at the end could be a
 * thousands separator. Where the digits are within that, they are grams
 * exactly.
 * @param {string} text @param {'.' | ','} decimal @param {'g' | 'kg'} unit
 * @returns {{ grams: number } | { error: string }}
 */
export function readGrams(text, decimal, unit) {
  const places = unit === 'kg' ? 3 : 0;
  const exact = (number) => (number.fraction.length > places || scaled(number, places).value > SAFE ? undefined : `${scaled(number, places).value} g`);
  const number = numberOf(text, decimal);
  if (number === undefined) return { error: `«${text}» is not a number in \`"decimal": "${decimal}"\`${otherReading(text, decimal, exact)}` };
  const { value, rest } = scaled(number, places);
  if (/[1-9]/.test(rest) && unit === 'kg') {
    return { error: `«${text}» kg is ${value}.${rest.replace(/0+$/, '')} g, not whole grams — nothing is rounded` };
  }
  if (rest !== '') return { error: tooMany(text, decimal, number, places, unit === 'kg' ? 'kilograms take at most 3' : 'grams take no decimals') };
  if (value > SAFE) return { error: `«${text}» is more than a weight can hold` };
  return { grams: Number(value) };
}

/**
 * A count of what is in stock: whole, from 0 to 999,999, as `set_stock` takes it.
 * @returns {{ count: number } | { error: string }}
 */
export function readCount(text) {
  if (!/^\d+$/.test(text)) return { error: `«${text}» is not a whole number of items on hand` };
  const count = Number(text);
  if (count > 999999) return { error: `«${text}» is more than the 999,999 a SKU's stock may be` };
  return { count };
}

const YES = ['yes', 'y', 'true', '1', 'on'];
const NO = ['no', 'n', 'false', '0', 'off'];

/**
 * A switch. An empty cell says nothing (`undefined`): a new product has its
 * default and a matched one keeps what it has. With a list of `yes` values
 * every other value is no; without one, only the plain words are read.
 * @param {string} text @param {Switch} spec
 * @returns {{ value: boolean } | { error: string } | undefined}
 */
export function readSwitch(text, spec) {
  if (text === '') return undefined;
  const word = text.toLowerCase();
  if (spec.yes !== null) return { value: spec.yes.some((each) => each.toLowerCase() === word) };
  if (YES.includes(word)) return { value: true };
  if (NO.includes(word)) return { value: false };
  return { error: `«${text}» is not yes or no — say which values mean yes: { "column": "${spec.column}", "yes": ["${text}"] }` };
}
