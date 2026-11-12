/**
 * `jtk upgrade contract-3`, the half that is no generator's: a contract-2
 * site's declaration and documents in contract 3's words (jtakeit-core
 * wiki/98 §7 · 2 and 3). Pure functions of what they are handed — the tables
 * a declaration exports, the files under `jtk/` — so the scaffold's command
 * (`@jtakeit/astro`, lib/upgrade.mjs), a test and another generator's tool
 * read one copy of the rules.
 *
 *   tablesOf(declared, ctx)        the contract-3 tables of a contract-2 declaration (§3)
 *   documentsOf(files, how)        the contract-3 tree of a contract-2 one (§2, §4)
 *   stateOf(json)                  the platform's state an agent fetched, checked (§7)
 *
 * ── nothing is lost by default (§7) ─────────────────────────────────────────
 *
 * What cannot be decided from the files is never decided: it is kept where
 * the format keeps what nobody declares, and said as a question for a
 * person (§8), every one of them at the end.
 *
 *   a price written as text      stays text, and goes to a person ("45.00, from?")
 *   a slug no entry has          goes to `_orphans` of the object it was in, and to a person
 *   a day off for nobody         `closed[].who` keeps the slug it had, and goes to a person
 *   a field `deprecated`         leaves the schema, its values to `_orphans`
 *   a business fact with no role stays a field of the shared contacts, and goes to a person
 *
 * ── the platform's state (§7) ───────────────────────────────────────────────
 *
 * The upgrade needs the ids the platform holds, the owner's manual order and
 * the currency. A contract-2 site's files carry them once the platform has
 * saved it: every save writes each page's and entry's `id` (wiki/94 · M1),
 * every move an entry's `rank` (M4), and `jtk/site.json` the currency under
 * `business`. A document the platform has not saved since carries none, and
 * then only the platform can say — `stateOf` reads what the developer's agent
 * fetched for it, read-only, through the MCP server: `get_site` and
 * `get_content`'s list of pages.
 */
import { ID, KEY } from './content/contract3.mjs';
import { uuid7, newKey } from './content/identity.mjs';
import { baseAddressOf, canonicalLocale, localeOfAddress } from './content/locale.mjs';
import { bookedIn, layOf } from './content/overlay.mjs';
import { canonicalJSON, digest } from './translations.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => structuredClone(value);

/** Empty is absent (§1, 6; §4.7): `null`, `""`, whitespace-only text, `[]` and `{}`. */
export function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (isObject(value) && Object.keys(value).length === 0)
  );
}

// ── ranks, as the platform mints them (backend/api/rank) ───────────────────

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

/** A rank between two, compared as bytes; `''` for either end (rank.Between). */
export function rankBetween(a, b) {
  let after = a ?? '';
  let before = b ?? '';
  if (before !== '' && after >= before) before = '';
  let out = '';
  for (let i = 0; ; i++) {
    const lo = i < after.length ? DIGITS.indexOf(after[i]) : 0;
    let hi = BASE;
    if (before !== '' && i < before.length) hi = DIGITS.indexOf(before[i]);
    if (hi - lo > 1) return out + DIGITS[Math.floor((lo + hi) / 2)];
    out += DIGITS[lo];
    if (hi - lo === 1) before = '';
  }
}

/** `n` ranks spread evenly, in order (rank.Spread): what the platform gives a collection on its first move. */
export function rankSpread(n) {
  let width = 1;
  let total = BASE;
  while (total <= n + 1 && width < 6) {
    width++;
    total *= BASE;
  }
  const keys = [];
  for (let i = 0; i < n; i++) {
    let value = Math.floor(((i + 1) * total) / (n + 1));
    const key = new Array(width);
    for (let d = width - 1; d >= 0; d--) {
      key[d] = DIGITS[value % BASE];
      value = Math.floor(value / BASE);
    }
    keys.push(key.join('').replace(/0+$/, ''));
  }
  return keys;
}

// ── the business's facts, as shared text with roles (§4.5) ─────────────────

/**
 * Each contract-2 business fact the scaffolds and the platform have written,
 * and what it becomes in contract 3: a field of the shared `contacts` block,
 * and its role. `null` where it is not content at all — the currency is the
 * site's setting, carried in `site.json`; the legal name and the tax id are
 * the payee's own details (S11).
 */
const FACTS = {
  name: { key: 'name', role: 'name' },
  phone: { key: 'phone', role: 'phone' },
  phone_display: { key: 'phone', role: 'phone' },
  phone_dial: { key: 'phone', role: 'phone' },
  email: { key: 'email', role: 'email' },
  street: { key: 'street', role: 'street' },
  postal_code: { key: 'postal_code', role: 'postal_code' },
  city: { key: 'city', role: 'city' },
  region: { key: 'region', role: 'region' },
  country: { key: 'country', role: 'country' },
  maps_url: { key: 'maps', role: 'maps' },
  maps: { key: 'maps', role: 'maps' },
  instagram: { key: 'social', role: 'social' },
  facebook: { key: 'social', role: 'social' },
  social: { key: 'social', role: 'social' },
  price_range: { key: 'price_range', role: 'price_range' },
  schema_type: { key: 'business_type', role: 'business_type' },
  business_type: { key: 'business_type', role: 'business_type' },
  hours: { key: 'hours', role: 'hours' },
  currency: null,
  legal_name: null,
  tax_id: null,
};

/** The facts each role's value is read from, first found first (`phone_dial` dials as typed, §4.5). */
const READ_FOR = {
  name: ['name'],
  phone: ['phone_dial', 'phone', 'phone_display'],
  email: ['email'],
  street: ['street'],
  postal_code: ['postal_code'],
  city: ['city'],
  region: ['region'],
  country: ['country'],
  maps: ['maps_url', 'maps'],
  price_range: ['price_range'],
  business_type: ['schema_type', 'business_type'],
  hours: ['hours'],
};

/** The roles whose words are the same in every language (`localized: false`): wiki/95 §2 lets a text field say so. */
const SAME_EVERYWHERE = new Set(['name', 'street', 'postal_code', 'business_type', 'price_range']);

/** ISO 3166-1 alpha-2, the codes a `country` select offers (§4.5). */
const COUNTRIES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

/**
 * What each role's field is for, said under it in the panel: a field of the
 * shared text is the owner's and on no page by itself, and the platform's
 * judge asks it to say what it does (JTK_W_HIDDEN_UNEXPLAINED). English, as
 * the scaffold's labels are (src/content/blocks.ts says why).
 */
const HINTS = {
  name: "The business's name, as search engines and assistants are told it.",
  phone: 'The number to call, written as it is dialled; the site shows it formatted.',
  email: 'Where a visitor writes to.',
  street: 'The street and the number, for the address search engines are told.',
  postal_code: 'The postcode of that address.',
  city: 'The town of that address.',
  region: 'The canton, state or region of that address.',
  country: 'The country of that address.',
  maps: 'The link to the business on a map.',
  social: "The business's own profiles, one link each.",
  price_range: "How dear it is, in search engines' words: '€€', 'CHF 30–120'.",
  business_type: 'What kind of business it is, as schema.org names it: HairSalon, Restaurant.',
  hours: 'The opening hours, as search engines are told them.',
};

/** What the shared contacts are called in the panel, in the languages the scaffold's labels come in. */
const CONTACTS_LABEL = { en: 'Contacts', de: 'Kontakt', fr: 'Contact', it: 'Contatti', es: 'Contacto', pt: 'Contactos', pl: 'Kontakt', uk: 'Контакти', ru: 'Контакты' };

/** A country fact's value as its ISO code, where one can be read from it: `ch`, `CH`, `Schweiz`, `Switzerland`. */
function countryCode(value, locale) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const said = value.trim();
  if (/^[A-Za-z]{2}$/.test(said) && COUNTRIES.includes(said.toUpperCase())) return said.toUpperCase();
  for (const language of [locale, 'en', 'de', 'fr', 'it', 'es', 'pt', 'pl', 'uk', 'ru']) {
    let names;
    try {
      names = new Intl.DisplayNames([language], { type: 'region' });
    } catch {
      continue;
    }
    const found = COUNTRIES.find((code) => names.of(code)?.toLowerCase() === said.toLowerCase());
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The `contacts` block type of a contract-2 declaration's business facts
 * (§4.5): each fact a field with its role, `phone_display` and `phone_dial`
 * one `phone`, `instagram` and `facebook` one list of links, the country a
 * select of ISO codes. A fact the table does not know stays a field with no
 * role, and is asked about.
 *
 * @param {any[]} facts BUSINESS_FACTS
 * @param {string} locale the site's language, for the countries' names
 */
export function contactsOf(facts, locale) {
  const fields = [];
  const questions = [];
  const notes = [];
  const byKey = new Map();
  for (const fact of facts.filter(isObject)) {
    const mapped = Object.hasOwn(FACTS, fact.key) ? FACTS[fact.key] : undefined;
    if (mapped === null) {
      notes.push(`BUSINESS_FACTS ${fact.key} is not content in contract 3 — ${fact.key === 'currency' ? "the currency is the site's setting, carried in jtk/site.json" : "the payee's own details, kept by the platform's settings"} (wiki/98 §4.5)`);
      continue;
    }
    const key = mapped?.key ?? fact.key;
    if (byKey.has(key)) continue;
    const { key: _key, label, kind, options: _options, option_labels: _labels, ...rest } = fact;
    let field;
    if (key === 'social') {
      field = { key, label, kind: 'list', of: [{ key: 'url', label: 'Link', kind: 'url' }] };
      for (const attr of ['hint', 'client_editable', 'no_tap_target']) if (fact[attr] !== undefined) field[attr] = fact[attr];
    } else if (key === 'country') {
      let names;
      try {
        names = new Intl.DisplayNames([locale || 'en'], { type: 'region' });
      } catch {
        names = undefined;
      }
      field = { key, label, kind: 'select', options: COUNTRIES.map((value) => ({ value, label: names?.of(value) ?? value })), ...rest };
      delete field.min;
      delete field.max;
    } else if (key === 'phone' || key === 'maps') {
      field = { key, label, kind: key === 'phone' ? 'tel' : 'url', ...rest };
      delete field.min;
      delete field.max;
    } else {
      field = { key, label, kind, ...rest };
      for (const bound of ['min', 'max']) if (field[bound] === 0) delete field[bound];
    }
    if (mapped !== undefined) {
      field.role = mapped.role;
      if (field.hint === undefined && field.no_tap_target === true) field.hint = HINTS[mapped.role];
      // The same in every language, words or not: nobody translates the
      // business's name, its street and postcode, the schema.org type or the
      // price range — counted as «to translate» they were most of a small
      // site's list (the two-language rehearsal, 12 November 2026). The city
      // stays per language: «Zürich», «Zurich».
      if (SAME_EVERYWHERE.has(mapped.role) && ['text', 'textarea'].includes(field.kind)) field.localized = false;
    }
    else {
      questions.push({
        what: 'a business fact with no role',
        where: `BUSINESS_FACTS ${fact.key}`,
        ask: `«${fact.key}» is one of the business's facts and no role says what it means to the outside world — which role (${['name', 'phone', 'email', 'street', 'postal_code', 'city', 'region', 'country', 'maps', 'social', 'price_range', 'business_type', 'hours'].join(', ')}), or plain shared text? It is kept as a field of the contacts with no role.`,
      });
    }
    byKey.set(key, field);
    fields.push(field);
  }
  return { block: { type: 'contacts', v: 1, label: { ...CONTACTS_LABEL }, fields }, questions, notes };
}

/**
 * The values of the contacts block, from the facts the platform wrote into
 * contract 2's `jtk/site.json` (`business`, every save) — empty for a site
 * the platform has not saved, or whose owner has written none.
 *
 * @param {any} contacts the contacts block type
 * @param {Record<string, unknown>} business
 * @param {string} locale
 */
export function contactsValues(contacts, business, locale) {
  const values = {};
  const questions = [];
  const word = (key) => (typeof business[key] === 'string' && business[key].trim() !== '' ? business[key].trim() : undefined);
  for (const field of contacts.fields) {
    if (field.role === 'social') {
      const links = ['instagram', 'facebook'].map(word).filter((one) => one !== undefined);
      const listed = Array.isArray(business.social) ? business.social.filter((one) => typeof one === 'string' && one.trim() !== '') : [];
      const rows = [...links, ...listed].map((url) => ({ url }));
      if (rows.length > 0) values[field.key] = rows;
      continue;
    }
    if (field.role === 'country') {
      const said = word('country');
      if (said === undefined) continue;
      const code = countryCode(said, locale);
      if (code !== undefined) values[field.key] = code;
      else {
        questions.push({
          what: 'a country the select cannot hold',
          where: 'jtk/shared.json blocks[contacts].country',
          ask: `the business's country is written «${said}», and the contacts' country is a select of ISO codes — which one is it? It is left empty until somebody says.`,
        });
      }
      continue;
    }
    const from = field.role === undefined ? [field.key] : READ_FOR[field.role] ?? [field.key];
    for (const key of from) {
      const found = business[key];
      if (found !== undefined && !isEmpty(found)) {
        values[field.key] = typeof found === 'string' ? found.trim() : found;
        break;
      }
    }
  }
  return { values, questions };
}

// ── the declaration (§3) ────────────────────────────────────────────────────

/** The kinds that take no bounds in contract 3: a link, a date, one picture (§3.3). */
const boundless = (field) => field.kind === 'url' || field.kind === 'date' || (field.kind === 'media' && field.multiple !== true);

/** A list whose row is one reference — `does: [{ service }]` — which contract 3 says as one reference to many (§3.3). */
export function oneRefList(field) {
  return isObject(field) && field.kind === 'list' && Array.isArray(field.of) && field.of.length === 1 && isObject(field.of[0]) && field.of[0].kind === 'ref';
}

/** The `<key>_alt` fields of a list of fields: a text beside a single picture of the same name (§3.4), by the picture's key. */
export function altsIn(fields) {
  const out = new Map();
  const byKey = new Map(fields.filter(isObject).map((one) => [one.key, one]));
  for (const field of fields.filter(isObject)) {
    if (typeof field.key !== 'string' || !field.key.endsWith('_alt')) continue;
    if (!['text', 'textarea'].includes(field.kind)) continue;
    const picture = byKey.get(field.key.slice(0, -'_alt'.length));
    if (picture?.kind === 'media' && picture.multiple !== true) out.set(picture.key, field.key);
  }
  return out;
}

/**
 * The count a module's role reads, which contract 3 says is whole (§3.6):
 * the services' fewest and most, a rate's units, a resource's seats and spots.
 */
const WHOLE = { services: ['fewest', 'most'], resources: ['seats', 'spots'], rates: ['from_unit', 'until_unit'] };

/**
 * One field in contract 3's words (§3.3): options as `{ value, label }`, a
 * reference as `{ to }`, a bound of 0 left out (it meant "none" and now means
 * zero), no bounds on a link, a date or one picture, a one-ref list as one
 * reference to many, and its rows' fields the same.
 *
 * @param {any} field
 * @param {{ whole?: string[] }} [how] `whole`: the keys a module reads as counts
 */
export function field3(field, how = {}) {
  if (!isObject(field)) return field;
  if (oneRefList(field)) {
    const row = field.of[0];
    const out = { key: field.key, label: field.label };
    if (field.hint !== undefined) out.hint = field.hint;
    out.kind = 'ref';
    out.ref = { to: [row.ref], many: true };
    for (const attr of ['required', 'min', 'max', 'client_editable', 'no_tap_target', 'beside', 'titled_by', 'seo_sensitive']) {
      if (field[attr] !== undefined && !((attr === 'min' || attr === 'max') && field[attr] === 0)) out[attr] = field[attr];
    }
    return out;
  }
  const out = {};
  for (const [attr, value] of Object.entries(field)) {
    if (attr === 'option_labels' || attr === 'deprecated') continue;
    if ((attr === 'min' || attr === 'max') && (value === 0 || boundless(field))) continue;
    if (attr === 'options' && Array.isArray(value)) {
      const labels = isObject(field.option_labels) ? field.option_labels : {};
      out.options = value.map((one) => (isObject(one) ? one : labels[one] === undefined ? { value: one } : { value: one, label: labels[one] }));
      continue;
    }
    if (attr === 'ref' && typeof value === 'string') {
      out.ref = { to: [value] };
      continue;
    }
    if (attr === 'of' && Array.isArray(value)) {
      out.of = fields3(value, { whole: how.whole });
      continue;
    }
    out[attr] = value;
    if (attr === 'kind' && value === 'number' && (how.whole ?? []).includes(field.key) && field.integer === undefined) out.integer = true;
  }
  return out;
}

/** A list of fields in contract 3's words: `<key>_alt` folded into its picture and `deprecated` gone (§3.3, §3.4). */
export function fields3(fields, how = {}) {
  if (!Array.isArray(fields)) return fields;
  const alts = new Set(altsIn(fields).values());
  return fields.filter((one) => !(isObject(one) && (alts.has(one.key) || one.deprecated === true))).map((one) => field3(one, how));
}

/**
 * A collection's place in contract 3 (§3.5), as the platform's own upgrade
 * reads a contract-2 one (registry/routes.go, `routesFromContract2`): pages
 * at `<prefix>/{slug}`, and a listing at the prefix where it asked for one —
 * or where the repository wrote a page of its own there, which contract 2
 * listed at its prefix all the same (the blog's `/blog`); no pages: shown on
 * the prefix, at the anchor the scaffold draws (`#services-cut`).
 *
 * @param {any} collection
 * @param {Set<string>} [ownListings] the prefixes the repository wrote a listing page at
 */
export function collection3(collection, ownListings = new Set()) {
  if (!isObject(collection)) return collection;
  const prefix = typeof collection.prefix === 'string' ? collection.prefix.replace(/\/+$/, '') : `/${collection.name}`;
  const out = {};
  const moved = new Set(['prefix', 'pages', 'listing', 'per_page', 'body', 'order']);
  for (const [attr, value] of Object.entries(collection)) {
    if (!moved.has(attr)) out[attr] = value;
    if (attr === 'type') {
      if (collection.pages === false) {
        out.route = 'none';
        out.shown_on = [`${prefix}#${collection.name}-{slug}`];
      } else {
        const route = { detail: `${prefix}/{slug}` };
        if (collection.listing === true || ownListings.has(prefix)) route.listing = prefix;
        if (typeof collection.per_page === 'number' && collection.per_page > 0) route.per_page = collection.per_page;
        out.route = route;
      }
    }
  }
  if (isObject(collection.order) && typeof collection.order.by === 'string' && collection.order.by !== '' && collection.order.by !== 'manual') {
    out.order = collection.order.desc === true ? { by: collection.order.by, desc: true } : { by: collection.order.by };
  }
  if (Array.isArray(collection.body) && collection.body.length > 0) out.blocks = collection.body;
  return out;
}

/**
 * A block type in contract 3's words (§3.2): its fields and asks as fields
 * are, a view's `sample` gone and a view's bound of 0 with it.
 */
export function block3(block, how = {}) {
  if (!isObject(block)) return block;
  const out = {};
  for (const [attr, value] of Object.entries(block)) {
    if (attr === 'fields' || attr === 'asks') out[attr] = fields3(value, how);
    else if (attr === 'views' && Array.isArray(value)) {
      out.views = value.map((view) => {
        if (!isObject(view)) return view;
        const { sample: _sample, ...rest } = view;
        for (const bound of ['min', 'max']) if (rest[bound] === 0) delete rest[bound];
        return rest;
      });
    } else out[attr] = value;
  }
  return out;
}

/**
 * Per block type, the counts a module's role reads off it, which contract 3
 * says are whole numbers (§3.6): the services' `fewest`, `most` and their
 * rates' units, a resource's `seats` and `spots`.
 *
 * @param {Record<string, any>} declared
 * @returns {Map<string, string[]>}
 */
export function wholeOf(declared) {
  const modules = isObject(declared.MODULES) ? declared.MODULES : {};
  const collections = Array.isArray(declared.COLLECTIONS) ? declared.COLLECTIONS : [];
  const out = new Map();
  for (const roles of Object.values(modules)) {
    if (!isObject(roles)) continue;
    for (const [role, name] of Object.entries(roles)) {
      const type = collections.find((one) => isObject(one) && one.name === name)?.type;
      if (type === undefined || WHOLE[role] === undefined) continue;
      out.set(type, [...(out.get(type) ?? []), ...WHOLE[role], ...(role === 'services' ? WHOLE.rates : [])]);
    }
  }
  return out;
}

/**
 * The contract-3 tables of a contract-2 declaration (§3, §7 · 2): what
 * `src/content/blocks.ts` exports once the codemod has rewritten it, and
 * what `jtk schema` then writes into `jtk/schema.json`.
 *
 * @param {Record<string, any>} declared the contract-2 declaration's exports (or its catalogue's tables, upper-cased)
 * @param {{ sharedTypes?: string[]; ownListings?: Set<string> }} [ctx]
 *   `sharedTypes`: the block types the shared text holds; `ownListings`: the prefixes the repository lists at itself
 * @returns {{ tables: Record<string, any>; questions: any[]; notes: string[]; contacts?: any; refused?: string }}
 */
export function tablesOf(declared, ctx = {}) {
  const questions = [];
  const notes = [];
  const locale = canonicalLocale(declared.LOCALE) ?? declared.LOCALE;
  // Its other languages, as declared: each document in one of them becomes
  // a translation beside its original (M3, wiki/95 §6), in documentsOf.
  const locales = Array.isArray(declared.LOCALES) ? declared.LOCALES : [];
  const modules = isObject(declared.MODULES) ? declared.MODULES : {};
  const collections = Array.isArray(declared.COLLECTIONS) ? declared.COLLECTIONS : [];
  const whole = wholeOf(declared);
  const blocks = (Array.isArray(declared.BLOCKS) ? declared.BLOCKS : []).map((one) => block3(one, { whole: whole.get(one?.type) ?? [] }));
  const shared = [...new Set(ctx.sharedTypes ?? [])];
  const facts = Array.isArray(declared.BUSINESS_FACTS) ? declared.BUSINESS_FACTS : [];
  let contacts;
  if (facts.length > 0) {
    if (blocks.some((one) => one?.type === 'contacts')) {
      return {
        tables: {},
        questions,
        notes,
        refused: 'the business facts become a shared block type called `contacts` (wiki/98 §4.5), and BLOCKS declares a type of that name already — rename it, or move the facts into it by hand; nothing was written.',
      };
    }
    const made = contactsOf(facts, locale);
    contacts = made.block;
    questions.push(...made.questions);
    notes.push(...made.notes);
    blocks.push(contacts);
    if (!shared.includes('contacts')) shared.push('contacts');
  }
  for (const one of Array.isArray(declared.BLOCKS) ? declared.BLOCKS : []) {
    for (const field of Array.isArray(one?.fields) ? one.fields : []) {
      if (field?.deprecated === true) notes.push(`blocks ${one.type}.${field.key} was deprecated and leaves the schema; its values go to _orphans (wiki/98 §3.3)`);
    }
  }
  const tables = {
    CONTRACT: 3,
    LOCALE: locale,
    LOCALES: locales,
    BLOCKS: blocks,
    PAGE_SEO: fields3(Array.isArray(declared.PAGE_SEO) ? declared.PAGE_SEO : []),
    SHARED: shared,
    COLLECTIONS: collections.map((one) => collection3(one, ctx.ownListings)),
    MODULES: modules,
  };
  return { tables, questions, notes, contacts };
}

// ── the platform's state (§7) ───────────────────────────────────────────────

/**
 * The platform's state an agent fetched for the upgrade, read-only, through
 * the MCP server, and handed over as a file (`--state <file>`):
 *
 *   {
 *     "site":  { … get_site's answer: id, slug, currency, business … },
 *     "pages": [ … get_content's `pages` (no path asked): id, path, collection, locale, kind, position … ]
 *   }
 *
 * Each part is optional, and a file carries what it lacks: an `id` the
 * platform has not written into a file yet, the manual order of entries no
 * move has ranked (`position`), the currency, the facts.
 *
 * @param {unknown} json
 * @returns {{ site: Record<string, any>; pages: { id: string; path: string; collection: string; locale: string; position: number }[]; faults: string[] }}
 */
export function stateOf(json) {
  const faults = [];
  if (!isObject(json)) return { site: {}, pages: [], faults: ['the state is not an object — { "site": get_site, "pages": get_content\'s pages }'] };
  const site = isObject(json.site) ? json.site : isObject(json.site?.site) ? json.site.site : {};
  const listed = Array.isArray(json.pages) ? json.pages : Array.isArray(json.content?.pages) ? json.content.pages : [];
  const pages = [];
  listed.forEach((one, i) => {
    if (!isObject(one)) return faults.push(`pages[${i}] is not a page`);
    if (typeof one.id !== 'string' || !ID.test(one.id)) return faults.push(`pages[${i}] has no id the platform writes (a lowercase UUID)`);
    if (typeof one.path !== 'string') return faults.push(`pages[${i}] has no path`);
    pages.push({
      id: one.id,
      path: one.path,
      collection: typeof one.collection === 'string' ? one.collection : '',
      locale: typeof one.locale === 'string' ? one.locale : '',
      position: typeof one.position === 'number' ? one.position : Number.MAX_SAFE_INTEGER,
    });
  });
  return { site, pages, faults };
}

// ── the documents (§2, §4) ──────────────────────────────────────────────────

/** A file's place in contract 3 (§2): a page under `jtk/pages/` at its path, `/` as `index.json`. */
export const pageFile3 = (path) => (path === '/' ? '/jtk/pages/index.json' : `/jtk/pages${path}.json`);
/** An entry under `jtk/entries/<collection>/` by its slug. */
export const entryFile3 = (collection, slug) => `/jtk/entries/${collection}/${slug}.json`;

/**
 * A page's name, once (§4.1): the first that exists of its navigation label,
 * its SEO title, its first heading, its address made readable.
 */
const HOME = { en: 'Home', de: 'Startseite', fr: 'Accueil', it: 'Home', es: 'Inicio', pt: 'Início', pl: 'Strona główna', uk: 'Головна', ru: 'Главная' };
export function nameOfPage(raw, path, locale) {
  const words = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);
  const nav = words(raw.name) ?? words(raw.nav_label) ?? words(raw.nav?.label);
  if (nav !== undefined) return nav;
  const title = words(raw.seo?.title);
  if (title !== undefined) return title;
  for (const block of Array.isArray(raw.blocks) ? raw.blocks : []) {
    const heading = isObject(block) ? words(block.title) ?? words(block.heading) : undefined;
    if (heading !== undefined) return heading;
  }
  if (path === '/') return HOME[(locale ?? '').split('-')[0]] ?? HOME.en;
  const last = path.split('/').filter(Boolean).pop() ?? '';
  const readable = last.replace(/[-_]+/g, ' ').trim();
  return readable === '' ? path : readable[0].toLocaleUpperCase(locale || undefined) + readable.slice(1);
}

/**
 * The contract-3 tree of a contract-2 one (§7 · 3): every document at its §2
 * place with the id it carries (or the platform's, or a new one), entries
 * ranked in the order the site lists them where the owner orders by hand,
 * `_key`s minted where absent and re-minted where the grammar cannot name
 * them (§16 · 5), money typed, references by id, `<key>_alt` folded into its
 * picture, the business's facts as the shared contacts, empty folded away.
 *
 * Pure: it is handed the files as `readJtk` reads them and the two schemas,
 * and hands back the files to write and to remove, with what a person must
 * answer.
 *
 * @param {Record<string, any>} files the tree, keyed `/jtk/…`
 * @param {{
 *   from: any;                        the contract-2 schema the files were saved against (jtk/catalogue.json)
 *   to: any;                          the contract-3 schema (what jtk/schema.json will say)
 *   order: Record<string, string[]>;  each collection's entries in the order the site lists them, by file
 *   state?: ReturnType<typeof stateOf>;
 *   contacts?: any;                   the contacts block type, where the facts became one
 *   mint?: { id?: () => string; key?: (taken: Set<string>) => string };
 * }} how
 */
export function documentsOf(files, how) {
  const from = how.from ?? {};
  const to = how.to ?? {};
  const state = how.state ?? { site: {}, pages: [], faults: [] };
  const mintId = how.mint?.id ?? (() => uuid7());
  const mintKey = how.mint?.key ?? ((taken) => newKey(taken));
  const questions = [];
  const notes = [];
  const write = new Map();
  const remove = new Set();
  const minted = { ids: [], ranks: [], keys: 0, rekeyed: 0 };
  /** The text fields already asked about as prices, one question a field. */
  const priced = new Set();
  /**
   * A question about a value, asked while the originals are read; a copy in
   * another language is read quietly — its shared values are judged against
   * the original's, and its words stay words — so nothing is asked twice.
   */
  let quiet = false;
  const ask = (question) => {
    if (!quiet) questions.push(question);
  };

  const typesFrom = new Map((Array.isArray(from.blocks) ? from.blocks : []).filter(isObject).map((one) => [one.type, one]));
  const typesTo = new Map((Array.isArray(to.blocks) ? to.blocks : []).filter(isObject).map((one) => [one.type, one]));
  const collectionsFrom = new Map((Array.isArray(from.collections) ? from.collections : []).filter(isObject).map((one) => [one.name, one]));
  const collectionsTo = new Map((Array.isArray(to.collections) ? to.collections : []).filter(isObject).map((one) => [one.name, one]));
  const locale = to.locale ?? '';

  // ── the documents, as contract 2 holds them ──────────────────────────────
  //
  // One full copy per language (wiki/95 §0): the original in the site's own
  // language, and each other language's copy at its own path (`/en/prices`),
  // saying its `locale`. The originals move as they are; each copy becomes a
  // translation beside its original (M3, wiki/95 §6), below.
  const others = (Array.isArray(to.locales) ? to.locales : []).map(canonicalLocale).filter((one) => one !== null);
  const documents = [];
  /** The copies in another language, each to be laid beside its original. */
  const copies = [];
  for (const [file, raw] of Object.entries(files)) {
    if (!file.startsWith('/jtk/content/') || !isObject(raw)) continue;
    const said = typeof raw.path === 'string' && raw.path.length > 1 ? raw.path.replace(/\/+$/, '') : raw.path;
    const language = languageOfDocument(raw, others, to.locale);
    const path = typeof said === 'string' ? baseAddressOf(said, language) : said;
    const collection = typeof raw.collection === 'string' && raw.collection !== '' ? raw.collection : undefined;
    let slug;
    if (collection !== undefined) {
      const prefix = (collectionsFrom.get(collection)?.prefix ?? '').replace(/\/+$/, '');
      slug = prefix !== '' && path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : path.split('/').filter(Boolean).pop() ?? '';
    }
    (language === '' ? documents : copies).push({ file, raw, path, collection, slug, language });
  }
  // A copy with no original — a page or an entry written only in another
  // language — has nothing to be a translation of: contract 3 has every
  // document in the site's own language first, and a translation without its
  // original is refused. It is not made up here: listed in `alone`, and the
  // command stops (lib/upgrade.mjs) until somebody writes the original or
  // removes the copy.
  for (const copy of copies) {
    copy.original = documents.find((doc) => doc.collection === copy.collection && (copy.collection === undefined ? doc.path === copy.path : doc.slug === copy.slug));
  }
  const alone = copies
    .filter((one) => one.original === undefined)
    .map((one) => ({ file: one.file.slice(1), locale: one.language, kind: one.collection === undefined ? 'page' : 'entry', ...(one.collection === undefined ? { path: one.path } : { collection: one.collection, slug: one.slug }) }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const translationCopies = copies.filter((one) => one.original !== undefined);
  /** The collections somebody books: their entries are in every language, always. */
  const booked = bookedIn(to);

  // ── the ids (§4.3): the file's, the platform's, or a new one ─────────────
  const platformId = (doc) =>
    state.pages.find((one) => one.path === doc.path && one.locale === '' && (one.collection || undefined) === doc.collection)?.id;
  const taken = new Set();
  for (const doc of documents) {
    const own = typeof doc.raw.id === 'string' && ID.test(doc.raw.id) ? doc.raw.id : undefined;
    const theirs = platformId(doc);
    if (own !== undefined && theirs !== undefined && own !== theirs) {
      notes.push(`${doc.file.slice(1)} says the id ${own} and the platform holds ${theirs} at ${doc.path} — the file's is kept, as the import matches by it first`);
    }
    doc.id = own ?? theirs;
    if (doc.id === undefined) {
      doc.id = mintId();
      minted.ids.push(doc.file);
    }
    if (taken.has(doc.id)) {
      questions.push({ what: 'an id held twice', where: doc.file.slice(1), ask: `${doc.file.slice(1)} says the id ${doc.id}, which another document says too — which of the two is the platform's? A new id is minted for this one.` });
      doc.id = mintId();
      minted.ids.push(doc.file);
    }
    taken.add(doc.id);
  }

  // Each collection's names to ids: a slug, or an id written already.
  const byName = new Map();
  for (const doc of documents) {
    if (doc.collection === undefined) continue;
    if (!byName.has(doc.collection)) byName.set(doc.collection, new Map());
    byName.get(doc.collection).set(doc.slug, doc.id);
    byName.get(doc.collection).set(doc.id, doc.id);
  }
  const resolve = (targets, name) => {
    for (const collection of targets) {
      const found = byName.get(collection)?.get(name);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  // ── values ────────────────────────────────────────────────────────────────
  const fieldIn = (fields, key) => (Array.isArray(fields) ? fields.find((one) => isObject(one) && one.key === key) : undefined);
  const targetsOf = (field) => (isObject(field?.ref) && Array.isArray(field.ref.to) ? field.ref.to : typeof field?.ref === 'string' ? [field.ref] : []);
  const RESERVED = new Set(['_key', '_orphans', 'type', 'v', 'view']);

  /**
   * One object's values — a block, an entry's own, a row — from the fields
   * contract 2 declared to the fields contract 3 declares.
   *
   * @param {Record<string, any>} values
   * @param {any[]} before the contract-2 fields
   * @param {any[]} after the contract-3 fields
   * @param {string} where for a question: the file and the place
   */
  function values3(values, before, after, where) {
    const out = {};
    const orphans = isObject(values._orphans) ? { ...values._orphans } : {};
    const alts = altsIn(Array.isArray(before) ? before : []);
    const altKeys = new Set(alts.values());
    for (const [key, held] of Object.entries(values)) {
      if (key === '_orphans') continue;
      if (RESERVED.has(key)) {
        if (!isEmpty(held)) out[key] = held;
        continue;
      }
      if (altKeys.has(key)) continue;
      if (isEmpty(held)) continue;
      const was = fieldIn(before, key);
      const now = fieldIn(after, key);
      if (now === undefined) {
        // Declared no longer — `deprecated`, removed, or never — and kept (§4.7).
        orphans[key] = held;
        continue;
      }
      const value = value3(held, was, now, `${where}.${key}`, orphans, key);
      if (value !== undefined && !isEmpty(value)) out[key] = value;
    }
    // The words of a picture, folded into it (§3.4).
    for (const [picture, alt] of alts) {
      const words = values[alt];
      if (isEmpty(words)) continue;
      const media = out[picture];
      if (isObject(media)) {
        if (isEmpty(media.alt)) media.alt = typeof words === 'string' ? words.trim() : words;
      } else {
        // Words with no picture: nothing to fold into, and kept.
        orphans[alt] = words;
      }
    }
    if (Object.keys(orphans).length > 0) out._orphans = orphans;
    return out;
  }

  function value3(held, was, now, where, orphans, key) {
    switch (now.kind) {
      case 'money': {
        if (typeof held === 'number') return Number.isInteger(held) ? { minor: held } : (ask({ what: 'a price that is not whole minor units', where, ask: `${where} is ${held}, and a price is whole minor units (4500 is 45.00) — what is the amount? It is kept as it was.` }), held);
        if (isObject(held)) return held;
        ask({
          what: 'a price written as text',
          where,
          ask: `${where} says «${String(held)}» in a price — the amount and whether it is «from» or «on request» have to be read by someone: ${guessPrice(held)}? It stays as it is until then, and the platform refuses the tree while a price holds words (JTK_E_CONTENT_FILE_INVALID).`,
        });
        return held;
      }
      case 'media': {
        if (now.multiple === true) {
          if (!Array.isArray(held)) return held;
          return held.filter((one) => isObject(one) && !isEmpty(one.src)).map((one) => folded(one));
        }
        if (typeof held === 'string') return held.trim() === '' ? undefined : { src: held.trim() };
        return isObject(held) ? folded(held) : held;
      }
      case 'ref': {
        const targets = targetsOf(now);
        if (oneRefList(was)) {
          // A list of one-ref rows, one reference to many now (§3.3).
          const sub = was.of[0];
          const names = (Array.isArray(held) ? held : []).map((row) => (isObject(row) ? row[sub.key] : undefined)).filter((one) => typeof one === 'string' && one.trim() !== '');
          return refs(names, targets, where, orphans, key, true);
        }
        if (now.ref?.many === true) return refs(Array.isArray(held) ? held : [held], targets, where, orphans, key, true);
        if (typeof held !== 'string') return held;
        return refs([held], targets, where, orphans, key, false);
      }
      case 'list': {
        if (!Array.isArray(held)) return held;
        const rows = held
          .filter((row) => isObject(row))
          .map((row, i) => values3(row, Array.isArray(was?.of) ? was.of : [], Array.isArray(now.of) ? now.of : [], `${where}[${typeof row._key === 'string' ? row._key : i}]`))
          .filter((row) => Object.keys(row).some((one) => one !== '_key'));
        return rows;
      }
      case 'number': {
        if (now.integer === true && typeof held === 'number' && !Number.isInteger(held)) {
          ask({ what: 'a count that is not whole', where, ask: `${where} is ${held}, and contract 3 reads it as a whole number — which? It is kept as it was.` });
        }
        return held;
      }
      case 'text':
      case 'textarea': {
        // A price kept as words (the contract-1 scaffold's priced_list): it stays words, and is asked about once a field (§7, §8).
        if (typeof held === 'string' && looksLikePrice(key, held)) {
          const field = where.replace(/^\S+ /, '').replace(/\[[^\]]*\]/g, '[…]');
          if (!priced.has(field)) {
            priced.add(field);
            ask({
              what: 'a price written as text',
              where,
              ask: `${where} says «${held}», a price in words — the amount and whether it is «from» or «on request» have to be read by someone: ${guessPrice(held)}? The field stays text, as it was; a price the panel and a booking can read is a money field (kind "money", qualifiers ["from", "on_request"]), and moving to one is a change of the declaration and of every value in it.`,
            });
          }
        }
        return held;
      }
      default:
        return held;
    }
  }

  /** A picture's own parts, empty ones folded away. */
  function folded(picture) {
    const out = {};
    for (const [part, value] of Object.entries(picture)) if (!isEmpty(value)) out[part] = value;
    return out;
  }

  /** Names to ids; a name no entry has to `_orphans` and to a person (§7, §8). */
  function refs(names, targets, where, orphans, key, many) {
    const ids = [];
    const lost = [];
    for (const name of names) {
      const id = typeof name === 'string' ? resolve(targets, name.trim()) : undefined;
      if (id !== undefined) ids.push(id);
      else lost.push(name);
    }
    if (lost.length > 0) {
      orphans[key] = many ? lost : lost[0];
      ask({
        what: 'a reference to no entry',
        where,
        ask: `${where} names ${lost.map((one) => `«${one}»`).join(', ')}, which no entry of ${targets.join(' or ')} is — renamed or deleted outside the panel? Which entry, or none? Kept in _orphans until somebody says.`,
      });
    }
    if (ids.length === 0) return undefined;
    return many ? ids : ids[0];
  }

  // ── keys (§1, 1; §15 · 12; §16 · 5) ──────────────────────────────────────
  /** Every block, row and gallery picture keyed, a key the grammar cannot name minted again. */
  function keyed(list, depth = 0) {
    if (!Array.isArray(list)) return list;
    const takenKeys = new Set(list.filter((one) => isObject(one) && typeof one._key === 'string' && KEY.test(one._key)).map((one) => one._key));
    const seen = new Set();
    return list.map((one) => {
      if (!isObject(one)) return one;
      const out = { ...one };
      const own = typeof out._key === 'string' ? out._key : undefined;
      if (own === undefined || !KEY.test(own) || seen.has(own)) {
        if (own === undefined) minted.keys += 1;
        else minted.rekeyed += 1;
        const fresh = mintKey(takenKeys);
        // The key first, as the platform writes a row.
        const { _key: _old, ...rest } = out;
        seen.add(fresh);
        return keyedInside({ _key: fresh, ...rest }, depth);
      }
      seen.add(own);
      return keyedInside(out, depth);
    });
  }
  function keyedInside(object, depth) {
    if (depth >= 2) return object;
    for (const [key, value] of Object.entries(object)) {
      if (key === '_orphans') continue;
      if (Array.isArray(value) && value.some((one) => isObject(one))) object[key] = keyed(value, depth + 1);
    }
    return object;
  }
  /** The values of an entry or the settings: the lists in them keyed, the object itself not. */
  function keyedValues(values) {
    const out = { ...values };
    for (const [key, value] of Object.entries(out)) {
      if (key === '_orphans') continue;
      if (Array.isArray(value) && value.some((one) => isObject(one))) out[key] = keyed(value, 1);
    }
    return out;
  }

  /** A block of a document in contract 3's words. */
  function block3Values(block, where) {
    const type = typeof block.type === 'string' ? block.type : '';
    const out = values3(block, typesFrom.get(type)?.fields ?? [], typesTo.get(type)?.fields ?? [], where);
    // The block's own parts first, as the platform writes them.
    const { _key, type: t, v, view, ...rest } = out;
    const head = {};
    if (_key !== undefined) head._key = _key;
    if (t !== undefined) head.type = t;
    head.v = v ?? typesTo.get(type)?.v ?? 1;
    if (view !== undefined) head.view = view;
    return { ...head, ...rest };
  }

  const foldedSeo = (seo) => {
    if (!isObject(seo)) return undefined;
    const out = {};
    for (const [key, value] of Object.entries(seo)) if (!isEmpty(value)) out[key] = value;
    return Object.keys(out).length > 0 ? out : undefined;
  };

  // ── pages and entries ─────────────────────────────────────────────────────
  const rankOf = new Map();
  for (const [name, collection] of collectionsTo) {
    const order = collection.order;
    if (isObject(order) && order.by !== undefined && order.by !== 'manual') continue;
    const listed = (how.order?.[name] ?? []).filter((file) => documents.some((doc) => doc.file === file));
    // The platform's order for those no move ranked, where it was handed it (§7).
    const position = (file) => {
      const doc = documents.find((one) => one.file === file);
      return state.pages.find((one) => one.id === doc?.id)?.position;
    };
    const ranked = listed.filter((file) => typeof files[file]?.rank === 'string' && files[file].rank !== '');
    const unranked = listed.filter((file) => !ranked.includes(file));
    if (state.pages.length > 0) unranked.sort((a, b) => (position(a) ?? Number.MAX_SAFE_INTEGER) - (position(b) ?? Number.MAX_SAFE_INTEGER));
    for (const file of ranked) rankOf.set(file, files[file].rank);
    if (unranked.length === 0) continue;
    if (ranked.length === 0) {
      rankSpread(unranked.length).forEach((rank, i) => rankOf.set(unranked[i], rank));
    } else {
      let last = ranked.map((file) => files[file].rank).sort().pop();
      for (const file of unranked) {
        last = rankBetween(last, '');
        rankOf.set(file, last);
      }
    }
    minted.ranks.push(...unranked);
  }

  const pagesAt = new Set();
  for (const doc of documents) {
    // A question names the file the value is in now.
    const target = doc.collection === undefined ? pageFile3(doc.path) : entryFile3(doc.collection, doc.slug);
    const where = (place) => `${target.slice(1)} ${place}`;
    if (doc.collection === undefined) {
      const out = { id: doc.id, path: doc.path, name: nameOfPage(doc.raw, doc.path, locale) };
      const seo = foldedSeo(doc.raw.seo);
      if (seo !== undefined) out.seo = seo;
      const blocks = (Array.isArray(doc.raw.blocks) ? doc.raw.blocks : []).filter(isObject).map((one, i) => block3Values(one, where(`blocks[${typeof one._key === 'string' ? one._key : i}]`)));
      if (blocks.length > 0) out.blocks = keyed(blocks);
      write.set(pageFile3(doc.path), out);
      doc.out = out;
      doc.target = pageFile3(doc.path);
      pagesAt.add(doc.path);
      remove.add(doc.file);
      continue;
    }
    const collection = collectionsTo.get(doc.collection);
    const type = collection?.type ?? collectionsFrom.get(doc.collection)?.type;
    const out = { id: doc.id, collection: doc.collection, slug: doc.slug };
    if (rankOf.has(doc.file)) out.rank = rankOf.get(doc.file);
    out.visible = doc.raw.visible !== false;
    for (const moment of ['show_at', 'hide_at']) if (!isEmpty(doc.raw[moment])) out[moment] = doc.raw[moment];
    const seo = foldedSeo(doc.raw.seo);
    const blocks = (Array.isArray(doc.raw.blocks) ? doc.raw.blocks : []).filter(isObject);
    let own = {};
    let body = blocks;
    if (blocks.length > 0 && blocks[0].type === type) {
      const values = values3(blocks[0], typesFrom.get(type)?.fields ?? [], typesTo.get(type)?.fields ?? [], where('fields'));
      const { _key, type: _t, v: _v, view: _view, ...rest } = values;
      own = rest;
      body = blocks.slice(1);
    } else if (blocks.length > 0) {
      notes.push(`${doc.file.slice(1)} does not open with a ${type} block, so it has no values of its own; its blocks are its body`);
    }
    if (seo !== undefined) {
      if (collection?.route === 'none') {
        questions.push({ what: 'search words on an entry without a page', where: where('seo'), ask: `${where('seo')} says ${JSON.stringify(seo)}, and an entry of ${doc.collection} has no page of its own for a search engine to read them on — contract 3 refuses them there (wiki/98 §16 · 5). They are not carried over; put them on the page it is shown on, or say where they belong.` });
      } else out.seo = seo;
    }
    if (Object.keys(own).length > 0) out.fields = keyedValues(own);
    const bodyBlocks = body.map((one, i) => block3Values(one, where(`blocks[${typeof one._key === 'string' ? one._key : i}]`)));
    if (bodyBlocks.length > 0) out.blocks = keyed(bodyBlocks);
    if (typeof doc.slug !== 'string' || doc.slug === '') {
      questions.push({ what: 'an entry with no slug', where: doc.file.slice(1), ask: `${doc.file.slice(1)} is at ${doc.path}, which is not under its collection's prefix — what is its slug?` });
      continue;
    }
    write.set(entryFile3(doc.collection, doc.slug), out);
    doc.out = out;
    doc.target = entryFile3(doc.collection, doc.slug);
    remove.add(doc.file);
  }

  // A page each collection without pages is shown on (§16 · 5: the judge refuses a `shown_on` page that is not there).
  for (const collection of collectionsTo.values()) {
    if (collection.route !== 'none') continue;
    for (const place of Array.isArray(collection.shown_on) ? collection.shown_on : []) {
      const at = typeof place === 'string' ? place.split('#')[0] : undefined;
      if (at === undefined || at === '' || at.includes('{slug}') || pagesAt.has(at)) continue;
      const label = collection.label;
      const name = typeof label === 'string' ? label : isObject(label) ? label[locale] ?? label[locale.split('-')[0]] ?? label.en ?? Object.values(label)[0] : undefined;
      const theirs = state.pages.find((one) => one.path === at && one.locale === '' && one.collection === '')?.id;
      const id = theirs ?? mintId();
      if (theirs === undefined) minted.ids.push(pageFile3(at));
      write.set(pageFile3(at), { id, path: at, name: typeof name === 'string' && name.trim() !== '' ? name : nameOfPage({}, at, locale) });
      pagesAt.add(at);
      notes.push(`${pageFile3(at).slice(1)} — the page the ${collection.name} collection is shown on, which contract 2 drew from the collection alone and contract 3 names (wiki/98 §3.5)`);
    }
  }

  // ── the shared text, and the business's facts in it (§4.5) ──────────────
  const sharedRaw = isObject(files['/jtk/shared.json']) ? files['/jtk/shared.json'] : undefined;
  const sharedBlocks = (Array.isArray(sharedRaw?.blocks) ? sharedRaw.blocks : []).filter(isObject).map((one, i) => block3Values(one, `jtk/shared.json blocks[${typeof one._key === 'string' ? one._key : i}]`));
  const siteFile = isObject(files['/jtk/site.json']) ? files['/jtk/site.json'] : undefined;
  const business = { ...(isObject(siteFile?.business) ? siteFile.business : {}), ...(isObject(state.site.business) ? state.site.business : {}) };
  if (how.contacts !== undefined && !sharedBlocks.some((one) => one.type === 'contacts')) {
    const { values, questions: asked } = contactsValues(how.contacts, business, locale);
    questions.push(...asked);
    const block = { _key: 'contacts', type: 'contacts', v: 1 };
    for (const [key, value] of Object.entries(values)) block[key] = value;
    sharedBlocks.push(block);
    const declared = new Set((Array.isArray(from.business_facts) ? from.business_facts : []).map((one) => one?.key));
    for (const [key, value] of Object.entries(business)) {
      if (declared.has(key) || isEmpty(value)) continue;
      if (Object.hasOwn(FACTS, key) && FACTS[key] === null) continue;
      if (Object.hasOwn(FACTS, key) && how.contacts.fields.some((one) => one.role === FACTS[key].role)) continue;
      questions.push({
        what: 'a business fact the scaffold did not declare',
        where: `jtk/site.json business.${key}`,
        ask: `the platform holds «${key}»: ${JSON.stringify(value)} among the business's facts, and the declaration has no field for it — which role, or plain shared text? It is not carried into the contacts until somebody says.`,
      });
    }
  }
  if (sharedBlocks.length > 0 || sharedRaw !== undefined) {
    write.set('/jtk/shared.json', sharedBlocks.length > 0 ? { blocks: keyed(sharedBlocks) } : {});
  }

  // ── the other languages: a translation beside each original (M3) ───────
  //
  // wiki/95 §6, wiki/98 §7 · 3: each copy in another language is read as
  // the original is — money typed, pictures folded, references by id — and
  // then split, field by field, by what the schema says is per language:
  //
  //   a localized value     the translation's, recorded as made from the
  //                         original as it stands (`translated[place].from`)
  //   a shared value equal  kept once, on the original
  //   a shared value that   not decided here: listed in `differing`, and the
  //   differs               command stops, unless it was told to take the
  //                         original's (`takeBase`) — or the developer marks
  //                         the field `localized` and runs it again
  //
  // A shared value the copy leaves empty differs from nothing: the
  // original's fills it, as the merge would.
  const differing = [];
  const takeBase = typeof how.takeBase === 'function' ? how.takeBase : () => false;
  const typesOfTo = (type) => typesTo.get(type)?.fields ?? [];
  const pageSeo = Array.isArray(to.page_seo) ? to.page_seo.filter(isObject) : [];
  const same = (a, b) => canonicalJSON(a ?? null) === canonicalJSON(b ?? null);
  const pictureFile = (picture) => (isObject(picture) ? { src: picture.src, focus: picture.focus, poster: picture.poster } : picture);

  /**
   * One object of a copy against the original's, its words into `out`.
   * @param {Record<string, any>} base the original's, as written
   * @param {Record<string, any>} theirs the copy's, read the same way
   * @param {any[]} fields
   * @param {string} trail the place, `blocks[hero].`, `fields.` for an entry's own
   * @param {Record<string, any>} out
   * @param {{ field: string; record: (place: string, value: unknown) => void; differ: (place: string, field: string, base: unknown, theirs: unknown) => void }} ctx
   *   `field`: what a field is called for the flag that answers it, `hero` → `hero.image`
   */
  function split(base, theirs, fields, trail, out, ctx) {
    for (const field of fields) {
      if (!isObject(field) || typeof field.key !== 'string') continue;
      const key = field.key;
      const mine = base[key];
      const their = theirs[key];
      if (isEmpty(their)) continue;
      const place = `${trail}${key}`;
      const id = `${ctx.field}.${key}`;
      const how = layOf(field);
      if (how === 'whole') {
        out[key] = their;
        ctx.record(place, mine);
      } else if (how === 'shared') {
        if (!same(mine, their)) ctx.differ(place, id, mine, their);
      } else if (how === 'media') {
        if (!isObject(their) || !same(pictureFile(mine), pictureFile(their))) ctx.differ(place, id, pictureFile(mine), pictureFile(their));
        if (isObject(mine) && isObject(their) && !isEmpty(their.alt)) {
          out[key] = { alt: their.alt };
          ctx.record(`${place}.alt`, mine.alt);
        }
      } else if (how === 'gallery' || how === 'rows') {
        if (!Array.isArray(their)) continue;
        const list = Array.isArray(mine) ? mine.filter(isObject) : [];
        const rows = their.filter(isObject);
        const pairs = paired(list, rows);
        const files = (items) => items.map(pictureFile);
        if (how === 'gallery' ? !same(files(list), files(rows)) : pairs.length !== rows.length || rows.length !== list.length) {
          ctx.differ(place, id, how === 'gallery' ? files(list) : `${list.length} row(s)`, how === 'gallery' ? files(rows) : `${rows.length} row(s)`);
        }
        const kept = [];
        for (const [one, other] of pairs) {
          if (typeof one._key !== 'string') continue;
          if (how === 'gallery') {
            if (!isEmpty(other.alt)) {
              kept.push({ _key: one._key, alt: other.alt });
              ctx.record(`${place}[${one._key}].alt`, one.alt);
            }
            continue;
          }
          const row = { _key: one._key };
          split(one, other, Array.isArray(field.of) ? field.of.filter(isObject) : [], `${place}[${one._key}].`, row, { ...ctx, field: id });
          if (Object.keys(row).length > 1) kept.push(row);
        }
        if (kept.length > 0) out[key] = kept;
      }
    }
  }

  /**
   * The original's objects and the copy's, paired: by `_key` where the copy
   * kept the original's, else by place. A copy holds the original's rows in
   * the original's order unless somebody changed one language alone.
   */
  function paired(list, rows) {
    const out = [];
    const used = new Set();
    rows.forEach((row, i) => {
      let match = typeof row._key === 'string' ? list.find((one) => one._key === row._key) : undefined;
      if (match === undefined && i < list.length && !used.has(list[i]) && (row.type === undefined || row.type === list[i].type)) match = list[i];
      if (match !== undefined && !used.has(match)) {
        used.add(match);
        out.push([match, row]);
      }
    });
    return out;
  }

  /** Blocks of a copy against the original's, as `split` does a list's rows; the page's structure is the original's. */
  function splitBlocks(base, theirs, ctx, rawBase) {
    const out = [];
    // Paired on what the files said, so a key the original kept pairs, then
    // named by the key the original has now.
    const pairs = paired(rawBase, theirs);
    if (pairs.length !== theirs.length || theirs.length !== base.length || pairs.some(([one, other]) => other.type !== undefined && one.type !== other.type)) {
      ctx.differ('blocks', ctx.field, base.map((one) => one.type), theirs.map((one) => one.type));
    }
    for (const [one, other] of pairs) {
      const written = base[rawBase.indexOf(one)];
      if (!isObject(written) || typeof written._key !== 'string' || written.type !== other.type) continue;
      const block = { _key: written._key };
      split(written, other, typesOfTo(written.type), `blocks[${written._key}].`, block, { ...ctx, field: written.type });
      if (Object.keys(block).length > 1) out.push(block);
    }
    return out;
  }

  /** What one copy's file becomes: the translation and where it goes. */
  function translationOf(copy) {
    const doc = copy.original;
    const locale = copy.language;
    const target = doc.target.replace(/\.json$/, `.${locale}.json`);
    const translated = {};
    const ctx = {
      field: '',
      record: (place, value) => {
        // Made from the original as it stands; from nothing, no record.
        const from = digest(value);
        if (from !== '') translated[place] = { from };
      },
      differ: (place, field, base, theirs) => {
        const answered = takeBase(field) || takeBase(`${locale}:${field}`);
        const one = { file: target.slice(1), from: copy.file.slice(1), locale, place, field, base, theirs };
        if (answered) notes.push(`${target.slice(1)} ${place}: ${locale}'s ${JSON.stringify(theirs)} dropped — the original's ${JSON.stringify(base)} stands for every language (--take-base ${field})`);
        else differing.push(one);
      },
    };
    quiet = true;
    let out;
    if (doc.collection === undefined) {
      const raw = (Array.isArray(copy.raw.blocks) ? copy.raw.blocks : []).filter(isObject);
      const theirs = raw.map((one, i) => ({ ...block3Values(one, `${copy.file} blocks[${i}]`), ...(typeof one._key === 'string' ? { _key: one._key } : {}) }));
      out = { of: doc.out.id, locale, name: nameOfPage(copy.raw, doc.path, locale) };
      ctx.record('name', doc.out.name);
      const seo = {};
      split(isObject(doc.out.seo) ? doc.out.seo : {}, foldedSeo(copy.raw.seo) ?? {}, pageSeo, 'seo.', seo, { ...ctx, field: 'seo' });
      if (Object.keys(seo).length > 0) out.seo = seo;
      const rawBase = (Array.isArray(doc.raw.blocks) ? doc.raw.blocks : []).filter(isObject);
      const blocks = splitBlocks(Array.isArray(doc.out.blocks) ? doc.out.blocks : [], theirs, { ...ctx, field: `page:${doc.path}` }, rawBase);
      if (blocks.length > 0) out.blocks = blocks;
    } else {
      const collection = collectionsTo.get(doc.collection);
      const type = collection?.type ?? collectionsFrom.get(doc.collection)?.type;
      const raw = (Array.isArray(copy.raw.blocks) ? copy.raw.blocks : []).filter(isObject);
      let own = {};
      let body = raw;
      if (raw.length > 0 && raw[0].type === type) {
        const { _key, type: _t, v: _v, view: _view, ...rest } = values3(raw[0], typesFrom.get(type)?.fields ?? [], typesTo.get(type)?.fields ?? [], `${copy.file} fields`);
        own = rest;
        body = raw.slice(1);
      }
      out = { of: doc.out.id, locale, slug: copy.slug };
      ctx.record('slug', doc.out.slug);
      // Held back in this language; or shown where the original is hidden,
      // which a translation cannot say. Never an entry somebody books: it is
      // in every language, always (the owner, 12 November 2026) — a copy
      // contract 2 hid is shown, in its own words.
      if (doc.out.visible !== false && copy.raw.visible === false) {
        if (booked.has(doc.collection)) {
          notes.push(`${target.slice(1)}: the ${locale} copy of ${doc.collection} «${doc.slug}» was hidden, and what people book is in every language — it is shown in ${locale} from now on, in its own words`);
        } else out.visible = false;
      }
      if (doc.out.visible === false && copy.raw.visible !== false) {
        questions.push({ what: 'a language shown where the original is hidden', where: copy.file.slice(1), ask: `${copy.file.slice(1)} is out in ${locale}, and the original is hidden — a language is out only where the original is (wiki/98 §4.4): show the original, or the entry stays hidden in every language.` });
      }
      if (collection?.route !== 'none') {
        const seo = {};
        split(isObject(doc.out.seo) ? doc.out.seo : {}, foldedSeo(copy.raw.seo) ?? {}, pageSeo, 'seo.', seo, { ...ctx, field: 'seo' });
        if (Object.keys(seo).length > 0) out.seo = seo;
      }
      const fields = {};
      split(isObject(doc.out.fields) ? doc.out.fields : {}, own, typesOfTo(type), 'fields.', fields, { ...ctx, field: type });
      if (Object.keys(fields).length > 0) out.fields = fields;
      // The body, whole per language: the copy's own, keyed as its own.
      const own3 = body.map((one, i) => block3Values(one, `${copy.file} blocks[${i}]`));
      if (own3.length > 0) {
        out.blocks = keyed(own3);
        ctx.record('blocks', doc.out.blocks);
      }
    }
    quiet = false;
    if (Object.keys(translated).length > 0) out.translated = translated;
    return { target, out };
  }

  for (const copy of translationCopies) {
    if (copy.original.out === undefined) continue;
    const { target, out } = translationOf(copy);
    write.set(target, out);
    remove.add(copy.file);
  }

  // The shared text in another language: `shared.<locale>.json`, its blocks
  // laid over the original's by key.
  for (const [file, raw] of Object.entries(files)) {
    const found = /^\/jtk\/shared\.([^/]+)\.json$/.exec(file);
    const locale = found === null ? null : canonicalLocale(found[1]);
    if (locale === null || !isObject(raw) || !others.includes(locale)) continue;
    const written = write.get('/jtk/shared.json');
    const target = `/jtk/shared.${locale}.json`;
    const translated = {};
    const theirs = (Array.isArray(raw.blocks) ? raw.blocks : []).filter(isObject);
    quiet = true;
    const read = theirs.map((one, i) => ({ ...block3Values(one, `${file} blocks[${i}]`), ...(typeof one._key === 'string' ? { _key: one._key } : {}) }));
    quiet = false;
    const rawBase = (Array.isArray(sharedRaw?.blocks) ? sharedRaw.blocks : []).filter(isObject);
    const base = (Array.isArray(written?.blocks) ? written.blocks : []).slice(0, rawBase.length);
    const blocks = splitBlocks(base, read, {
      field: 'shared',
      record: (place, value) => {
        // Made from the original as it stands; from nothing, no record.
        const from = digest(value);
        if (from !== '') translated[place] = { from };
      },
      differ: (place, field, mine, other) => {
        if (takeBase(field) || takeBase(`${locale}:${field}`)) notes.push(`${target.slice(1)} ${place}: ${locale}'s ${JSON.stringify(other)} dropped — the original's ${JSON.stringify(mine)} stands for every language (--take-base ${field})`);
        else differing.push({ file: target.slice(1), from: file.slice(1), locale, place, field, base: mine, theirs: other });
      },
    }, rawBase);
    const out = { locale };
    if (blocks.length > 0) out.blocks = blocks;
    if (Object.keys(translated).length > 0) out.translated = translated;
    write.set(target, out);
    // A name in another spelling (`shared.de-ch.json`) is the same file on a
    // disk that folds case: removed only where it is another file.
    if (file.toLowerCase() !== target.toLowerCase()) remove.add(file);
  }

  // ── module settings (§4.6) ───────────────────────────────────────────────
  const modules = isObject(to.modules) ? Object.keys(to.modules) : [];
  for (const module of modules) {
    const file = `/jtk/${module}.json`;
    const raw = files[file];
    if (!isObject(raw)) continue;
    const config = (Array.isArray(raw.blocks) ? raw.blocks : []).find((one) => isObject(one) && one.type === `${module}_config`);
    if (config === undefined) {
      notes.push(`${file.slice(1)} holds no ${module}_config block — nothing carried into jtk/modules/${module}.json`);
      continue;
    }
    const { type: _type, v, _key, schema_version: _sv, module: _m, ...rest } = config;
    const settings = {};
    for (const [key, value] of Object.entries(rest)) {
      if (isEmpty(value)) continue;
      if (Array.isArray(value)) {
        const rows = value.filter(isObject).map((row) => {
          const kept = {};
          for (const [cell, held] of Object.entries(row)) if (!isEmpty(held)) kept[cell] = held;
          return kept;
        }).filter((row) => Object.keys(row).some((one) => one !== '_key'));
        if (rows.length > 0) settings[key] = rows;
        continue;
      }
      settings[key] = value;
    }
    // A day off names its resource by id (§4.6).
    const resources = to.modules[module]?.resources;
    if (Array.isArray(settings.closed) && typeof resources === 'string') {
      settings.closed.forEach((row, i) => {
        if (typeof row.who !== 'string' || row.who.trim() === '') return;
        const id = resolve([resources], row.who.trim());
        if (id !== undefined) row.who = id;
        else {
          questions.push({
            what: 'a day off for nobody',
            where: `jtk/modules/${module}.json settings.closed[${typeof row._key === 'string' ? row._key : i}].who`,
            ask: `a day off names «${row.who}», which no entry of ${resources} is — renamed or deleted outside the panel? Which one, or the whole business? It keeps «${row.who}» until somebody says, so the day stays off for whom it was off before.`,
          });
        }
      });
    }
    write.set(`/jtk/modules/${module}.json`, { v: typeof v === 'number' ? v : 1, settings: keyedValues(settings) });
    remove.add(file);
  }

  // ── site.json, the platform's to the site (§6) ───────────────────────────
  const currency = String(state.site.currency ?? (isObject(siteFile?.business) ? siteFile.business.currency : undefined) ?? siteFile?.currency ?? '').trim().toUpperCase();
  if (siteFile !== undefined || Object.keys(state.site).length > 0) {
    const out = {};
    const id = siteFile?.id ?? state.site.id;
    const slug = siteFile?.slug ?? state.site.slug;
    if (id !== undefined) out.id = id;
    if (slug !== undefined) out.slug = slug;
    if (siteFile?.media_base !== undefined) out.media_base = siteFile.media_base;
    if (currency !== '') out.currency = currency;
    write.set('/jtk/site.json', out);
  }
  // The currency is the site's setting (§6, §14 · 4), not content: nothing
  // here makes one up, and nothing promises that a save will — a new site's
  // setting is empty, and the platform writes what it holds. It was said as
  // "until the platform writes one (its next save does)", which a new site's
  // next save never did (the contract-3 rehearsal, 11 November 2026). The
  // agent gives it once (jtakeit-core #212, the owner, 11 November 2026):
  // `currency` at the top of jtk/site.json, which an import takes while the
  // site has none, or create_site's `currency` for a new site; once the site
  // has one, a person changes it in the panel, and an import that brings a
  // new one is refused (JTK_E_CURRENCY_SET). So the note says where to write it.
  if (currency === '' && (to.modules !== undefined || hasMoney(to))) {
    notes.push(
      `no currency: ${Object.keys(state.site).length > 0 ? "the platform's state says none" : 'jtk/site.json carries none and no state was handed over'} — ` +
        'write it at the top of jtk/site.json ("currency": "CHF") and the next import takes it while the site has none (create_site\'s `currency` for a new site); ' +
        'once set, a person changes it in the panel (The site → The business); until then prices are drawn with no currency',
    );
  }

  remove.add('/jtk/catalogue.json');
  for (const file of write.keys()) remove.delete(file);
  return {
    write: Object.fromEntries([...write.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    remove: [...remove].filter((file) => Object.hasOwn(files, file)).sort(),
    questions,
    notes,
    minted,
    differing,
    alone,
  };
}

/**
 * Which language a contract-2 document is in: `''` for the site's own, else
 * the canonical tag — its `locale`, or the language its path starts with, as
 * contract 2's door reads it.
 *
 * @param {Record<string, any>} raw
 * @param {string[]} others the site's other languages, canonical
 * @param {string} [base] the site's own
 */
export function languageOfDocument(raw, others, base) {
  const said = canonicalLocale(raw?.locale);
  const own = canonicalLocale(base);
  if (said !== null) return said === own ? '' : said;
  return typeof raw?.path === 'string' ? localeOfAddress(raw.path, others) : '';
}

/** Whether a schema declares a price anywhere. */
function hasMoney(schema) {
  const walk = (fields) => (Array.isArray(fields) ? fields : []).some((one) => isObject(one) && (one.kind === 'money' || walk(one.of)));
  return (Array.isArray(schema.blocks) ? schema.blocks : []).some((one) => walk(one?.fields));
}

/** Whether words are a price: a field named for one, or an amount with a currency or the Swiss «.–». */
function looksLikePrice(key, words) {
  if (/(^|_)(price|preis|prix|prezzo|precio|preco|cost|costs|tarif|ціна|цена)(_|$)/i.test(key)) return /\d/.test(words);
  return /(\d[\d'’ ]*([.,]\d{1,2}|\.–|\.-)\s*(chf|fr\.?|€|eur|\$|£)?)|((chf|fr\.|€|eur)\s*\d)/i.test(words) && /(chf|fr\.|€|eur|\$|£|\.–)/i.test(words);
}

/** What a price written as text may say, for the question: «ab 45.–» is 4500, from. */
function guessPrice(text) {
  const said = String(text);
  const number = said.replace(/[’'\s]/g, '').match(/(\d+)(?:[.,](\d{1,2}|–|-))?/);
  if (number === null) return 'on request';
  const whole = Number(number[1]);
  const cents = number[2] !== undefined && /^\d+$/.test(number[2]) ? Number(number[2].padEnd(2, '0')) : 0;
  const from = /\b(ab|from|dès|da|desde|a partir|от|від|od)\b/i.test(said);
  return `{ "minor": ${whole * 100 + cents}${from ? ', "from": true' : ''} }`;
}
