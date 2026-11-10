/**
 * What names a contract-3 document and the parts of one, found and minted.
 *
 *   unnamed(files)   every place a name is missing or misspelt, with the file and the fix
 *   mint(files)      the same files with every name that can be minted written in
 *
 * ── why a file carries its names from its first write ───────────────────────
 *
 * Contract 3 names a page or an entry by its `id`, and a block, a row of a list
 * and a gallery's picture by its `_key` (wiki/98 §1, 1). Every annotation is
 * written with them (§5): a block without a key is drawn and annotated
 * nowhere, so the owner taps it and nothing opens, and a document without an
 * id cannot be named from any page but its own. The owner settled that every
 * contract-3 file carries both from its first write (§15 · 12): the platform
 * mints them in each of its saves (sites/keys.go), `jtk catalogue` mints them
 * in what an agent wrote by hand, and the kit's lint refuses a file without
 * them. So nothing is left that the owner cannot tap.
 *
 * ── what is named, and how ──────────────────────────────────────────────────
 *
 * The platform's rule, structural (sites/keys.go, `ensureKeys`): every block
 * of a document, every object inside a list of a block — a list's rows, a
 * gallery's pictures, a module's rows of hours and days off — and the lists
 * inside a row one level down. Here the same, with contract 3's places for
 * them: a page's and the shared text's `blocks`, an entry's `fields` and its
 * body `blocks`, a module's `settings`. An id is a lowercase UUID, v7 when
 * new (§4.3); a key is the platform's spelling, `k` and seven hex digits,
 * a letter first so the grammar can tell it from an index.
 *
 * **A translation names what it translates.** Its blocks and the rows of a
 * list it lays over are the original's, matched by `_key` (§4.4), so a key
 * minted there would name nothing: it is refused with the original's file to
 * copy it from. What is the translation's own gets minted as an original's
 * does — an entry's body, whole per language, and a list that says
 * `localized: true`.
 *
 * A name once given is never changed, here as on the platform: one that is
 * misspelt — an id that is not a lowercase UUID, a key outside the grammar —
 * is said, not replaced, because the platform's rows and every translation
 * may hold it.
 *
 * Imports nothing outside the door: the lint runs it in Node, and `mint` is a
 * pure function of the files, as `content()` is.
 */
import { ID, KEY, TRANSLATION, layOf } from './contract3.mjs';
import { sharedLocaleOf } from './locale.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A name nobody wrote: absent, or empty words. */
const absent = (name) => typeof name !== 'string' || name.trim() === '';

/** What the fix is, wherever a name can be minted. */
const MINTS = 'npx @jtakeit/astro catalogue mints it (jtkit catalogue on another generator)';

/** Bytes nobody can guess, from the platform's and the browser's one source. */
function random(count) {
  const bytes = new Uint8Array(count);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

const hex = (bytes) => [...bytes].map((one) => one.toString(16).padStart(2, '0')).join('');

/**
 * A new id: a UUID, version 7 (RFC 9562) — the moment in its first 48 bits,
 * so ids minted later sort later — in lowercase, as the platform writes its
 * own and as the grammar names a document (§15 · 16).
 *
 * @param {number} [now] the moment, in milliseconds
 */
export function uuid7(now = Date.now()) {
  const bytes = random(16);
  let moment = Math.max(0, Math.floor(now));
  for (let i = 5; i >= 0; i--) {
    bytes[i] = moment % 256;
    moment = Math.floor(moment / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const all = hex(bytes);
  return `${all.slice(0, 8)}-${all.slice(8, 12)}-${all.slice(12, 16)}-${all.slice(16, 20)}-${all.slice(20)}`;
}

/**
 * A new key no sibling holds, held from now on: `k` and seven hex digits,
 * the platform's (sites/document.go, `newBlockKey`).
 *
 * @param {Set<string>} taken the keys of its siblings
 */
export function newKey(taken) {
  for (;;) {
    const key = `k${hex(random(4)).slice(0, 7)}`;
    if (!taken.has(key)) {
      taken.add(key);
      return key;
    }
  }
}

/**
 * @typedef {{
 *   file: string;
 *   place: string;
 *   what: 'id' | 'key';
 *   mintable: boolean;
 *   says: string;
 *   fill: (files: Record<string, any>) => void;
 *   taken?: Set<string>;
 * }} Place
 */

/**
 * Every place in a contract-3 tree where a name is missing or misspelt.
 * Nothing for a tree whose `jtk/schema.json` does not say contract 3:
 * contract 2 keeps no names in its files.
 *
 * @param {Record<string, unknown>} files every file under `jtk/`, keyed `/jtk/…`, as `readJtk` hands them
 * @returns {Place[]}
 */
function places(files) {
  const schema = /** @type {any} */ (files['/jtk/schema.json']);
  if (!isObject(schema) || schema.contract !== 3) return [];
  const names = Object.keys(files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const types = Array.isArray(schema.blocks) ? schema.blocks.filter(isObject) : [];
  const fieldsOfType = (name) => {
    const type = types.find((one) => one.type === name);
    return Array.isArray(type?.fields) ? type.fields : [];
  };
  const collections = Array.isArray(schema.collections) ? schema.collections.filter(isObject) : [];
  const fieldsOfCollection = (name) => fieldsOfType(collections.find((one) => one.name === name)?.type);

  /** @type {Place[]} */
  const out = [];
  const shown = (file) => file.slice(1);

  /** A document's own id: minted where it has none, said where it is misspelt. */
  function idOf(file) {
    const id = /** @type {any} */ (files[file]).id;
    if (absent(id)) {
      out.push({
        file,
        place: 'id',
        what: 'id',
        mintable: true,
        says: `${shown(file)}: no "id" — the platform knows a page or an entry by it, and the panel names it by it on every page but its own; ${MINTS}`,
        fill(tree) {
          const { id: _gone, ...rest } = tree[file];
          tree[file] = { id: uuid7(), ...rest };
        },
      });
    } else if (typeof id !== 'string' || !ID.test(id)) {
      out.push({
        file,
        place: 'id',
        what: 'id',
        mintable: false,
        says: `${shown(file)}: "id" is ${JSON.stringify(id)}, not a lowercase UUID — the panel names a document by its id only in that spelling; write the platform's as the platform has it, or remove it and ${MINTS.replace('mints it', 'mints one')}`,
        fill() {},
      });
    }
  }

  /**
   * The objects of one list, each by its `_key`.
   *
   * @param {string} file
   * @param {any[]} list
   * @param {string} place the list's own place, `blocks` or `blocks[1].items`
   * @param {string | undefined} original where the keys are copied from — the original's file — when they name the original's objects; nothing when they are this file's own
   * @param {(row: any, at: string) => void} [inside] what to look at in each object
   */
  function keysOf(file, list, place, original, inside) {
    const taken = new Set(list.filter(isObject).map((one) => one._key).filter((key) => typeof key === 'string' && key !== ''));
    list.forEach((row, i) => {
      if (!isObject(row)) return;
      const at = `${place}[${i}]`;
      const key = row._key;
      if (absent(key)) {
        const mine = original === undefined;
        out.push({
          file,
          place: at,
          what: 'key',
          mintable: mine,
          taken,
          says: mine
            ? `${shown(file)}: ${at} has no "_key" — the panel names a block, a row and a picture by it, and nothing in one without it can be tapped; ${MINTS}`
            : `${shown(file)}: ${at} has no "_key" — a translation names what it translates by that one's key, so a new one would name nothing; copy it from ${original === '' ? 'the original' : shown(original)}`,
          fill() {
            const { _key: _gone, ...rest } = list[i];
            list[i] = { _key: newKey(taken), ...rest };
          },
        });
      } else if (typeof key !== 'string' || !KEY.test(key)) {
        out.push({
          file,
          place: at,
          what: 'key',
          mintable: false,
          says: `${shown(file)}: ${at} has the "_key" ${JSON.stringify(key)}, which the panel cannot name — a key is a lowercase letter, then lowercase letters, digits and hyphens, 32 at most; rename it, here and in every translation that names it`,
          fill() {},
        });
      }
      inside?.(row, at);
    });
  }

  /**
   * The lists inside one object — a block, a row, an entry's `fields`, a
   * module's `settings` — and inside their rows, one level down: the
   * platform's two levels (`keyRows`).
   *
   * In a translation (`original` said) only what the door lays over the
   * original is looked at: a declared list or gallery, never a value the
   * translation may not hold. Its rows name the original's, unless the list
   * is whole per language (`localized: true`), whose rows are its own.
   *
   * @param {string} file
   * @param {Record<string, unknown>} values
   * @param {string} place this object's place, with a dot to go on: `blocks[1].`
   * @param {number} depth 0 for a block's lists, 1 for a row's
   * @param {any[]} fields the declaration of these values
   * @param {string | undefined} original as in `keysOf`
   */
  function rowsOf(file, values, place, depth, fields, original) {
    if (depth > 1) return;
    for (const [name, value] of Object.entries(values)) {
      if (name === '_orphans' || !Array.isArray(value)) continue;
      const declared = fields.find((one) => isObject(one) && one.key === name);
      let from = original;
      if (original !== undefined) {
        if (declared === undefined) continue;
        const how = layOf(declared);
        if (how === 'whole') from = undefined;
        else if (how !== 'rows' && how !== 'gallery') continue;
      }
      const of = Array.isArray(declared?.of) ? declared.of : [];
      keysOf(file, value, `${place}${name}`, from, (row, at) => rowsOf(file, row, `${at}.`, depth + 1, of, from));
    }
  }

  /** A document's blocks: each by its key, and the lists inside each. */
  function blocksOf(file, blocks, original, typeOf) {
    if (!Array.isArray(blocks)) return;
    keysOf(file, blocks, 'blocks', original, (block, at) => rowsOf(file, block, `${at}.`, 0, typeOf(block), original));
  }

  // ── the files, as the door finds them ────────────────────────────────────

  const originals = new Map();
  const byFile = new Map();
  const translations = [];
  for (const file of names) {
    const kind = file.startsWith('/jtk/pages/') ? 'page' : file.startsWith('/jtk/entries/') ? 'entry' : undefined;
    if (kind === undefined || !file.endsWith('.json')) continue;
    const rel = file.slice((kind === 'page' ? '/jtk/pages/' : '/jtk/entries/').length, -'.json'.length);
    const parts = rel.split('/');
    if (parts.includes('media') || parts.includes('') || (kind === 'entry' && parts.length !== 2)) continue;
    const raw = /** @type {any} */ (files[file]);
    if (!isObject(raw)) continue;
    const tagged = TRANSLATION.exec(parts[parts.length - 1]);
    if (tagged !== null || typeof raw.of === 'string') {
      const sibling = tagged === null ? undefined : `${file.slice(0, file.length - parts[parts.length - 1].length - '.json'.length)}${tagged[1]}.json`;
      translations.push({ kind, file, raw, sibling, collection: kind === 'entry' ? parts[0] : undefined });
      continue;
    }
    const one = { kind, file, raw, collection: kind === 'entry' ? (typeof raw.collection === 'string' && raw.collection !== '' ? raw.collection : parts[0]) : undefined };
    byFile.set(file, one);
    if (typeof raw.id === 'string' && raw.id !== '' && !originals.has(`${kind}:${raw.id}`)) originals.set(`${kind}:${raw.id}`, one);
  }

  for (const one of byFile.values()) {
    idOf(one.file);
    if (one.kind === 'entry') {
      if (isObject(one.raw.fields)) rowsOf(one.file, one.raw.fields, 'fields.', 0, [], undefined);
    }
    blocksOf(one.file, one.raw.blocks, undefined, () => []);
  }

  for (const one of translations) {
    const of = typeof one.raw.of === 'string' && one.raw.of !== '' ? originals.get(`${one.kind}:${one.raw.of}`) : undefined;
    const original = of ?? (one.sibling === undefined ? undefined : byFile.get(one.sibling));
    const source = original?.file ?? '';
    if (one.kind === 'page') {
      // A page's blocks are the original's, their words per language.
      const theirs = Array.isArray(original?.raw.blocks) ? original.raw.blocks.filter(isObject) : [];
      blocksOf(one.file, one.raw.blocks, source, (block) => fieldsOfType(theirs.find((mine) => mine._key === block._key && typeof mine._key === 'string')?.type));
    } else {
      // An entry's own values are laid over the original's; its body is its own, whole per language.
      const collection = original?.collection ?? one.collection;
      if (isObject(one.raw.fields)) rowsOf(one.file, one.raw.fields, 'fields.', 0, fieldsOfCollection(collection), source);
      blocksOf(one.file, one.raw.blocks, undefined, () => []);
    }
  }

  // The shared text: the original's blocks its own, a translation's the original's.
  for (const file of names) {
    if (!/^\/jtk\/[^/]+$/.test(file) || !isObject(files[file])) continue;
    const locale = sharedLocaleOf(file);
    if (locale === null) continue;
    const raw = /** @type {any} */ (files[file]);
    if (locale === '') {
      blocksOf(file, raw.blocks, undefined, () => []);
      continue;
    }
    const base = /** @type {any} */ (files['/jtk/shared.json']);
    const theirs = isObject(base) && Array.isArray(base.blocks) ? base.blocks.filter(isObject) : [];
    blocksOf(file, raw.blocks, isObject(base) ? '/jtk/shared.json' : '', (block) => fieldsOfType(theirs.find((mine) => mine._key === block._key && typeof mine._key === 'string')?.type));
  }

  // A module's settings: its rows, as the platform keys them (§4.6).
  for (const file of names) {
    if (!/^\/jtk\/modules\/[^/]+\.json$/.test(file)) continue;
    const raw = /** @type {any} */ (files[file]);
    if (isObject(raw) && isObject(raw.settings)) rowsOf(file, raw.settings, 'settings.', 0, [], undefined);
  }

  return out;
}

/**
 * Every place in a contract-3 tree that has no name, or one the panel cannot
 * read — with the file, the place, and the fix — for the lint. Empty for a
 * tree that is not contract 3.
 *
 * @param {Record<string, unknown>} files every file under `jtk/`, keyed `/jtk/…`
 * @returns {{ file: string; place: string; what: 'id' | 'key'; mintable: boolean; says: string }[]}
 */
export function unnamed(files) {
  return places(files).map(({ file, place, what, mintable, says }) => ({ file, place, what, mintable, says }));
}

/**
 * The same files with every name that can be minted written in: an `id` on
 * each page and entry without one, a `_key` on each block, row and picture
 * without one, unique among its siblings. Only the files that changed come
 * back, each a new object — what it was handed is not touched. What cannot be
 * minted is left as it is, for `unnamed` to say.
 *
 * @param {Record<string, unknown>} files every file under `jtk/`, keyed `/jtk/…`
 * @returns {{ files: Record<string, any>; minted: { file: string; place: string; what: 'id' | 'key' }[] }}
 */
export function mint(files) {
  const tree = structuredClone(files);
  const found = places(tree).filter((one) => one.mintable);
  for (const one of found) one.fill(tree);
  const changed = new Set(found.map((one) => one.file));
  return {
    files: Object.fromEntries([...changed].sort().map((file) => [file, tree[file]])),
    minted: found.map(({ file, place, what }) => ({ file, place, what })),
  };
}
