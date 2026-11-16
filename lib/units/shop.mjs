/**
 * `jtk add shop` and `jtk remove shop`: the platform's shop kit laid over a
 * contract-3 site (jtakeit-core wiki/102 stage 9, decision 5). The shop is
 * added to a site and never copied into every one: `jtk create` makes no
 * shop, and a salon may add the shop beside its booking kit.
 *
 *   the declaration  the kit's product type in `BLOCKS`, its products
 *                    collection in `COLLECTIONS` and `shop: { products:
 *                    'products' }` in `MODULES` — each under the line
 *                    `// The shop kit (npx @jtakeit/astro add shop): yours
 *                    from here on.`, which is what `remove shop` finds them
 *                    by, in the site's language (`kitLanguage`)
 *   the settings     `jtk/modules/shop.json`: one zone, whose country is the
 *                    site's, and the kit's two methods with no price — the
 *                    owner's rates are a fact only the business has
 *   the storefront   `SHOP_FILES`, the components a product page, the cart,
 *                    the checkout, the page after payment and the products'
 *                    listing are drawn by, to copy and make the site's own —
 *                    and the cart's page, the page after payment and the
 *                    listing at the products' `listing`: the first two are
 *                    built only where the schema turns the shop on, the
 *                    listing wherever the products are listed at `/shop` (the
 *                    scaffold's own listing leaves `/shop` to it, and the
 *                    sitemap names it), asking the shop only where it is on
 *   the navigation   the header's link to the cart (`nav`), which the engine
 *                    gives and takes back as it does a section's
 *
 * No product is written: the products are the business's, by hand or by
 * `jtk import products`, and their stock is the platform's (`set_stock`).
 * What the kit asks of the business is printed, as `add booking` prints it:
 * ask, never make up. A file the scaffold owns is never changed.
 *
 * This file imports nothing of `index.mjs`, which imports it: what it needs
 * of the engine comes in with the call.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kitLanguage } from '@jtakeit/kit/kits';
import { said as nameIn, keyOf, tableIn, uncommented, withElement, withoutElement } from './source.mjs';

const BLOCKS_TS = 'src/content/blocks.ts';
const SETTINGS = 'jtk/modules/shop.json';
const META = 'jtakeit-meta.mjs';
const ENTRY_PAGE = 'src/pages/[...entry].astro';
const MARK = '// The shop kit (npx @jtakeit/astro add shop): yours from here on.';
const COUNTRY = /^[A-Z]{2}$/;
const LANGUAGES = ['uk', 'en', 'de', 'ru', 'es', 'it', 'pt', 'fr'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const refusal = (message) => Object.assign(new Error(message), { refusal: true });

/**
 * The storefront's files the unit lays, by their path in a site (each from
 * example/files/<path>); each piece's task adds its own.
 */
export const SHOP_FILES = [
  'src/components/shop/Product.astro',
  'src/components/shop/Cart.astro',
  'src/components/shop/Checkout.astro',
  'src/components/shop/OrderAfter.astro',
  'src/components/shop/ProductListing.astro',
  'src/pages/[...lang]/cart.astro',
  'src/pages/[...lang]/order.astro',
  'src/pages/[...lang]/shop/index.astro',
];

/** A literal element's value: the declaration's tables are data literals with comments. */
function valueOf(element) {
  try {
    return new Function(`return (${uncommented(element.text)});`)();
  } catch {
    return undefined;
  }
}

const marked = (source, element) => source.slice(element.from, element.start).includes(MARK);

function tableOf(source, name) {
  const table = tableIn(source, name);
  if ('refused' in table) throw refusal(table.refused);
  return table;
}

/** A kit's words per language, in one: the site's language, English where the kit has not got it. */
function inLanguage(value, lang) {
  if (Array.isArray(value)) return value.map((one) => inLanguage(one, lang));
  if (!isObject(value)) return value;
  const entries = Object.entries(value);
  if (entries.length > 0 && entries.every(([key, one]) => LANGUAGES.includes(key) && typeof one === 'string')) return value[lang] ?? value.en ?? entries[0][1];
  return Object.fromEntries(entries.map(([key, one]) => [key, inLanguage(one, lang)]));
}

/** The region of a language tag, upper-cased: `de-CH` → `CH`, `sr-Latn-RS` → `RS`, `en` → nothing. */
const regionOf = (locale) => String(locale).split('-').slice(1).find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();

/** The country of the shared field whose role is `country`, where it holds two capital letters. */
function contactsCountry(tree) {
  const schema = tree.json('jtk/schema.json');
  const shared = tree.json('jtk/shared.json');
  for (const type of Array.isArray(schema?.shared) ? schema.shared : []) {
    const field = schema.blocks?.find((one) => one?.type === type)?.fields?.find((one) => one?.role === 'country');
    const value = field === undefined ? undefined : shared?.blocks?.find((one) => one?.type === type)?.[field.key];
    if (typeof value === 'string' && COUNTRY.test(value)) return value;
  }
  return undefined;
}

/**
 * The country the business sends from: --country; else the region of the
 * site's locale tag (de-CH → CH); else the shared field whose role is
 * `country`, when it holds two capital letters — which is the example's CH on
 * every site jtk create laid out (lib/units/units.mjs:612), so the unit always
 * says which country it took, and from where.
 *
 * @param {{ read: (path: string) => string | undefined; json: (path: string) => any }} tree
 * @param {string | undefined} said what `--country` said
 * @param {string} [locale] the site's language tag; `LOCALE` of `src/content/blocks.ts` where not given
 * @returns {{ country: string; from: '--country' | 'the locale' | 'the shared contacts' }}
 */
export function countryOf(tree, said, locale) {
  if (said !== undefined) {
    if (!COUNTRY.test(said)) throw refusal(`--country «${said}» is not a country: two capital letters (CH, DE, LI…)`);
    return { country: said, from: '--country' };
  }
  locale ??= /^export const LOCALE\s*=\s*['"]([^'"]+)['"]/m.exec(tree.read(BLOCKS_TS) ?? '')?.[1] ?? 'en';
  const region = regionOf(locale);
  if (region !== undefined) return { country: region, from: 'the locale' };
  const contacts = contactsCountry(tree);
  if (contacts !== undefined) return { country: contacts, from: 'the shared contacts' };
  throw refusal(`the shop's zone needs the country the business sends from, and the site's locale «${locale}» has no region and the shared contacts have no country — say it: --country <XX> (CH, DE, LI…)`);
}

const KEPT_ZONE = ['_key', 'name', 'countries'];
const KEPT_METHOD = ['_key', 'zone', 'name', 'pickup'];
const only = (row, keys) => isObject(row) && Object.keys(row).every((key) => keys.includes(key));

/**
 * Whether the settings are still as the kit laid them: nothing the business
 * knows has been added — no rate, no band, no second country, no key the kit
 * has not got. The names are words and are not compared: the kit is not asked
 * again to say them.
 */
function asLaid(doc) {
  const settings = doc?.settings;
  if (!isObject(doc) || !isObject(settings) || Object.keys(doc).some((key) => key !== 'v' && key !== 'settings')) return false;
  if (Object.keys(settings).some((key) => !['zones', 'methods', 'kit', 'kit_version'].includes(key))) return false;
  const zones = settings.zones ?? [];
  const methods = settings.methods ?? [];
  if (!Array.isArray(zones) || !Array.isArray(methods) || zones.length > 1) return false;
  return zones.every((zone) => only(zone, KEPT_ZONE) && (zone.countries ?? []).length <= 1 && (zone.countries ?? []).every((row) => only(row, ['_key', 'country'])))
    && methods.every((method) => only(method, KEPT_METHOD));
}

export const shop = {
  name: 'shop',
  kind: 'module',
  nav: (x) => ({ _key: 'nav-cart', label: x.t('Cart', 'Warenkorb'), link: '/cart' }),
  about: 'the platform\'s shop kit: the products collection bound to the shop module, one zone in the site\'s country and two methods to price, and the storefront to copy',
  present: (tree) => {
    const table = tableIn(tree.read(BLOCKS_TS) ?? '', 'MODULES');
    return !('refused' in table) && table.elements.some((one) => keyOf(one) === 'shop');
  },

  add(tree, { site, did, options, engine }) {
    if (shop.present(tree)) {
      did.push('already there — MODULES turns the shop on');
      return did;
    }
    const kit = options.kit;
    if (!kit) throw refusal('add shop needs the platform\'s shop kit: --kit <file>, or none given and the platform is asked (GET /v1/kits/shop)');
    const lang = kitLanguage(site.locale);
    let source = tree.read(BLOCKS_TS);

    // A type or a collection by the kit's names is the site's own: refused, never written over.
    const clashes = [];
    const blocksNow = tableOf(source, 'BLOCKS');
    const collectionsNow = tableOf(source, 'COLLECTIONS');
    for (const block of kit.catalogue.blocks) if (blocksNow.elements.some((one) => nameIn(one, 'type') === block.type)) clashes.push(`the block type «${block.type}»`);
    for (const collection of kit.catalogue.collections) if (collectionsNow.elements.some((one) => nameIn(one, 'name') === collection.name)) clashes.push(`the collection «${collection.name}»`);
    if (clashes.length > 0) {
      throw refusal(`${BLOCKS_TS} declares ${clashes.join(' and ')} already, by the shop kit's names — rename the site's, or lay the kit out by hand from its page (jtakeit:///kits/shop.md)`);
    }
    const { country, from } = countryOf(tree, options.country, site.locale);

    // ── the declaration ──────────────────────────────────────────────────
    const last = () => true;
    for (const block of kit.catalogue.blocks) {
      source = withElement(source, tableOf(source, 'BLOCKS'), `${MARK}\n${JSON.stringify(inLanguage(block, lang), null, 2)}`, last);
      did.push(`${BLOCKS_TS}: BLOCKS gains the kit's ${block.type}`);
    }
    for (const collection of kit.catalogue.collections) {
      source = withElement(source, tableOf(source, 'COLLECTIONS'), `${MARK}\n${JSON.stringify(inLanguage(collection, lang), null, 2)}`, last);
      did.push(`${BLOCKS_TS}: COLLECTIONS gains the kit's ${collection.name}`);
    }
    const roles = kit.catalogue.modules.shop;
    const literal = `{ ${Object.entries(roles).map(([role, collection]) => `${role}: '${collection}'`).join(', ')} }`;
    source = withElement(source, tableOf(source, 'MODULES'), `${MARK}\nshop: ${literal}`, last);
    did.push(`${BLOCKS_TS}: MODULES turns the shop on — ${Object.entries(roles).map(([role, collection]) => `${role}: ${collection}`).join(', ')}`);
    tree.write(BLOCKS_TS, source);

    // ── the settings ─────────────────────────────────────────────────────
    const held = tree.json(SETTINGS);
    if (Array.isArray(held?.settings?.zones) && held.settings.zones.length > 0) {
      did.push(`${SETTINGS}: the site's own zones are kept, and the kit's settings are not laid over them — the country is yours to say there`);
    } else {
      const settings = inLanguage(kit.settings, lang);
      settings.zones = settings.zones.map((zone, at) => (at === 0 ? { ...zone, countries: [{ _key: 'c1', country }] } : zone));
      tree.write(SETTINGS, json({ v: 1, settings: { ...settings, kit: kit.kind, kit_version: String(kit.version) } }));
      did.push(`${SETTINGS}: the zone's country is ${country}, from ${from}${from === '--country' ? '' : ' (--country <XX> says another)'} — and ${settings.methods.length} methods with no price yet`);
    }

    // ── the storefront ───────────────────────────────────────────────────
    for (const path of SHOP_FILES) {
      if (tree.exists(path)) continue;
      tree.write(path, readFileSync(join(engine.files, path), 'utf8'));
      did.push(`${path}: written`);
    }

    // `jtakeit-meta.mjs` is the scaffold's, and is never changed here: a site laid out before the shop's dev
    // server (`devShop`, which answers shop/1 from the site's files on localhost) is told the two lines to add.
    const meta = tree.read(META);
    const localhost = meta === undefined || meta === null || meta.includes('devShop')
      ? []
      : [`${META} has no devShop, so a storefront is answered nothing on localhost — add \`import { devShop } from '@jtakeit/kit/devshop';\` under devDiary's import, and \`server.middlewares.use('/api', devShop(process.cwd()));\` under the line that mounts devDiary`];

    // The entry page is the scaffold's too, and is never changed here: one laid out before the storefront draws a
    // product as any entry, and is told the two lines that hand a product to the site's own page.
    const entryPage = tree.read(ENTRY_PAGE);
    const drawn = entryPage === undefined || entryPage === null || entryPage.includes('components/shop/Product.astro')
      ? []
      : [`${ENTRY_PAGE} draws a product as any entry, not by src/components/shop/Product.astro — add \`const Product = collection.name === site.rolesOf('shop')?.products ? Object.values(import.meta.glob<{ default: any }>('../components/shop/Product.astro', { eager: true }))[0]?.default : undefined;\` under the line that reads Astro.props, and \`{Product !== undefined && <Product entry={entry} collection={collection} locale={locale} />}\` first in its <main>, its <article> drawn only where Product is undefined`];

    did.questions = kit.ask ?? [];
    did.next = [
      'the products: one file each under jtk/entries/products/, or `npx @jtakeit/astro import products <file.csv> --map <mapping.json>` for a catalogue',
      'their starting stock: `set_stock`, SKU by SKU — stock is never in a file',
      ...localhost,
      ...drawn,
      'what a person does, never an agent: link the business\'s Stripe account, link where new orders go (the Telegram chat or the email), and switch VAT on — in the panel',
    ];
    return did;
  },

  remove(tree, { did, kept, faults, force, scaffolds }) {
    let source = tree.read(BLOCKS_TS) ?? '';
    const element = tableOf(source, 'MODULES').elements.find((one) => keyOf(one) === 'shop');
    if (element === undefined) return { did, kept, faults };

    // The products are the business's: the collection is not taken from under them.
    const collection = valueOf({ text: `{${element.text}}` })?.shop?.products ?? 'products';
    const folder = `jtk/entries/${collection}`;
    const entries = tree.under(folder).filter((file) => file.endsWith('.json') && !file.startsWith(`${folder}/media/`));
    if (entries.length > 0) {
      throw refusal(`${folder}/ holds ${entries.length} file${entries.length === 1 ? '' : 's'} — the products are the business's: move or delete them first`);
    }

    // Every element the kit added, found by the line above it.
    for (const name of ['BLOCKS', 'COLLECTIONS']) {
      for (;;) {
        const table = tableOf(source, name);
        const one = table.elements.find((each) => marked(source, each));
        if (one === undefined) break;
        const value = valueOf(one);
        source = withoutElement(source, one, table);
        did.push(`${BLOCKS_TS}: ${name} loses the kit's ${(name === 'BLOCKS' ? value?.type : value?.name) ?? 'element'}`);
      }
    }
    const modules = tableOf(source, 'MODULES');
    source = withoutElement(source, modules.elements.find((one) => keyOf(one) === 'shop'), modules);
    did.push(`${BLOCKS_TS}: MODULES turns the shop off`);
    tree.write(BLOCKS_TS, source);

    // The settings, where nothing the business knows is in them.
    if (tree.exists(SETTINGS)) {
      if (asLaid(tree.json(SETTINGS))) {
        tree.remove(SETTINGS);
        did.push(`${SETTINGS}: deleted`);
      } else {
        kept.push(`${SETTINGS}: yours now — it holds more than the kit laid (a rate, a band, another zone or country); the schema no longer turns the shop on, so delete it by hand once they are moved`);
      }
    }

    // The storefront's files: the scaffold's are deleted, one the site changed is kept and named.
    for (const path of SHOP_FILES) {
      if (!tree.exists(path)) continue;
      if (force || scaffolds(path, tree.read(path))) {
        tree.remove(path);
        did.push(`${path}: deleted`);
      } else {
        kept.push(`${path}: yours now — left where it is; delete it by hand if nothing uses it (--force deletes it)`);
      }
    }
    return { did, kept, faults };
  },
};
