/**
 * A booking kit, laid out — the files the platform's `kits.Files` describes,
 * in the same shapes, into any repository.
 *
 * The kit is the platform's (`GET /v1/kits/<kind>`; a page of it at
 * `jtakeit:///kits/<kind>.md`) and it is judged there. What this does is
 * write what a kit says into the `jtk/` files: its settings into
 * `jtk/bookings.json` with `page` at the services' listing and `kit` /
 * `kit_version` saying which kit and which version they came from, its rates
 * as entries in the site's language, and — for a site whose catalogue is a
 * file rather than a declaration — its block types, collections and the
 * module into `jtk/catalogue.json`. `@jtakeit/astro` writes the same into
 * `src/content/blocks.ts` instead, and takes the rest from here.
 *
 * Nothing written is a fact about the business: the rates carry no price and
 * the settings no zone and no hours. What the kit says to take from the brief
 * is in `kit.ask`, for whoever runs this to do next.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Where the platform is, for a kit asked by its kind. */
export const API = 'https://api.jtakeit.com';

/** A kit, read from a file and checked. @param {string} file */
export function readKit(file) {
  let kit;
  try {
    kit = JSON.parse(readFileSync(resolve(file), 'utf8'));
  } catch (why) {
    throw new Error(`--kit ${file} is not a kit: ${why.message}`);
  }
  return checkKit(kit, file);
}

/**
 * A kit asked of the platform by its kind (wiki/64 · §4.1): the kit whole,
 * every part written out, and its version — which the site's settings record
 * as `kit_version`, so the platform's judge can say when a fix to the kit has
 * not reached the site (JTK_W_KIT_BEHIND).
 *
 * @param {string} kind
 * @param {string} [api]
 */
export async function fetchKit(kind, api = process.env.JTK_API_URL || API) {
  const base = api.replace(/\/+$/, '');
  const url = `${base}/v1/kits/${encodeURIComponent(kind)}`;
  let answer;
  try {
    answer = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (why) {
    throw new Error(`--kit ${kind}: the platform did not answer at ${url} (${why.message}) — pass --api, or a file: --kit <file>`);
  }
  if (answer.status === 404) {
    let kinds = '';
    try {
      const list = await (await fetch(`${base}/v1/kits`)).json();
      kinds = ` — the kits are ${list.kits.map((one) => one.kind).join(', ')}`;
    } catch {
      // The list is a courtesy; the refusal stands without it.
    }
    throw new Error(`--kit ${kind}: the platform has no kit of that kind${kinds}`);
  }
  if (!answer.ok) throw new Error(`--kit ${kind}: the platform answered ${answer.status} at ${url}`);
  const body = await answer.json();
  const kit = checkKit(body.kit, kind);
  kit.version = body.version;
  return kit;
}

/**
 * A kit by its kind or by a file, whichever the argument is.
 * @param {string} asked
 * @param {string} [api]
 */
export async function loadKit(asked, api) {
  if (existsSync(resolve(asked)) || asked.endsWith('.json')) return readKit(asked);
  if (/^[a-z][a-z_]*$/.test(asked)) return fetchKit(asked, api);
  throw new Error(`--kit ${asked} is neither a kit's kind nor a file`);
}

/**
 * A kit checked for the shape this lays out, wherever it came from: a wrong
 * file stops here with its name rather than as a broken catalogue.
 * @param {any} kit
 * @param {string} from
 */
export function checkKit(kit, from) {
  const bookings = kit?.catalogue?.modules?.bookings;
  if (typeof kit?.kind !== 'string' || !/^[a-z][a-z_]*$/.test(kit.kind)
    || !Array.isArray(kit.catalogue?.blocks) || !Array.isArray(kit.catalogue?.collections)
    || typeof bookings?.services !== 'string' || typeof bookings?.resources !== 'string'
    || typeof kit.settings !== 'object' || !Array.isArray(kit.entries)) {
    throw new Error(`--kit ${from} is not a kit — save the JSON under «The kit, whole» on the kit's page, jtakeit:///kits/<kind>.md`);
  }
  const services = kit.catalogue.collections.find((one) => one.name === bookings.services);
  if (!services || services.pages !== false) {
    throw new Error(`--kit ${from}: its services are not a collection without pages, and the booking page is their listing`);
  }
  for (const entry of kit.entries) {
    if (!kit.catalogue.collections.some((one) => one.name === entry.collection)) {
      throw new Error(`--kit ${from}: the entry "${entry.slug}" is in "${entry.collection}", which the kit does not declare`);
    }
  }
  return kit;
}

/** The language a kit's words are taken in: the site's, or English where the kit has not got it. */
export function kitLanguage(locale) {
  const lang = String(locale ?? '').slice(0, 2);
  return ['uk', 'en', 'de', 'ru', 'es', 'it', 'pt', 'fr'].includes(lang) ? lang : 'en';
}

/**
 * The diary's settings for a kit, as `jtk/bookings.json` holds them: one
 * block of type `bookings_config`, `page` at the services' listing, and
 * which kit and which version they came from.
 * @param {any} kit
 */
export function kitSettings(kit) {
  const services = kit.catalogue.collections.find((one) => one.name === kit.catalogue.modules.bookings.services);
  return {
    type: 'bookings_config', v: 1, ...kit.settings, page: services.prefix,
    kit: kit.kind, ...(kit.version ? { kit_version: kit.version } : {}),
  };
}

/**
 * The kit's entries as content documents, one per file, in the site's
 * language: `[path, document]` pairs, the path relative to `jtk/content`.
 * @param {any} kit
 * @param {string} locale
 */
export function kitEntries(kit, locale) {
  const lang = kitLanguage(locale);
  return kit.entries.map((entry, i) => {
    const collection = kit.catalogue.collections.find((one) => one.name === entry.collection);
    const block = { _key: `kit${String(i + 1).padStart(5, '0')}`, type: collection.type, v: 1 };
    for (const [key, value] of Object.entries(entry.fields)) {
      // An object is the words per language; a list — a master's `does`, a
      // post's `tags: [{ tag }]` — is the value itself. It was read as a map
      // of languages and laid out as '' (12 October 2026), which broke the
      // listing that maps a resource's `does`.
      block[key] = Array.isArray(value) ? value : value !== null && typeof value === 'object' ? (value[lang] ?? '') : value;
    }
    const path = `${collection.prefix}/${entry.slug}`;
    const doc = { path, collection: collection.name, visible: true, seo: { title: '', description: '' }, blocks: [block] };
    return [path, doc];
  });
}

/**
 * A kit's block types, collections and module put into a catalogue object —
 * for a site whose catalogue is `jtk/catalogue.json` rather than a
 * declaration. A type or a collection the catalogue already has by that name
 * is left as it is: the site's own wins.
 * @param {any} catalogue
 * @param {any} kit
 */
export function mergeKitIntoCatalogue(catalogue, kit) {
  const out = { contract: 2, ...catalogue };
  out.blocks = [...(out.blocks ?? [])];
  for (const block of kit.catalogue.blocks) {
    if (!out.blocks.some((one) => one.type === block.type)) out.blocks.push(block);
  }
  out.collections = [...(out.collections ?? [])];
  for (const collection of kit.catalogue.collections) {
    if (!out.collections.some((one) => one.name === collection.name)) out.collections.push(collection);
  }
  out.modules = { ...(out.modules ?? {}), ...kit.catalogue.modules };
  return out;
}

/**
 * Lays the kit's `jtk/` files out under a repository: the settings and the
 * entries always; the catalogue too when `catalogue` is true (a site that
 * keeps `jtk/catalogue.json` by hand) — `@jtakeit/astro` writes the
 * declaration itself and passes false.
 *
 * @param {string} target     the repository's root
 * @param {any} kit
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {boolean} [options.catalogue]
 * @returns {string[]} the files written
 */
export function layKitFiles(target, kit, { locale = 'en', catalogue = false } = {}) {
  const literal = (value) => JSON.stringify(value, null, 2);
  const written = [];
  const settingsFile = join(target, 'jtk', 'bookings.json');
  mkdirSync(dirname(settingsFile), { recursive: true });
  writeFileSync(settingsFile, `${literal({ blocks: [kitSettings(kit)] })}\n`, 'utf8');
  written.push(settingsFile);

  for (const [path, doc] of kitEntries(kit, locale)) {
    const file = join(target, 'jtk', 'content', ...path.split('/').filter(Boolean)) + '.json';
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${literal(doc)}\n`, 'utf8');
    written.push(file);
  }

  if (catalogue) {
    const file = join(target, 'jtk', 'catalogue.json');
    let had = {};
    if (existsSync(file)) {
      try { had = JSON.parse(readFileSync(file, 'utf8')); } catch (why) { throw new Error(`${file} is not JSON: ${why.message}`); }
    }
    writeFileSync(file, `${literal(mergeKitIntoCatalogue(had, kit))}\n`, 'utf8');
    written.push(file);
  }
  return written;
}
