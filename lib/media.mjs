/**
 * `jtk media push` and `jtk media pull` — the site's pictures in its media
 * library, the one home of every picture a content field names
 * (jtakeit-core wiki/108).
 *
 *   npx @jtakeit/astro media push '<url>' [files or dirs…]   the pictures the content names, and
 *                                                            these, into the library; their keys
 *                                                            written into the content
 *   npx @jtakeit/astro media push --dry-run [files or dirs…] the plan, nothing sent or written
 *   npx @jtakeit/astro media pull ['<url>']                  the library's pictures the content
 *                                                            names, onto this machine — with the
 *                                                            URL, the whole library and its index
 *
 * The URL comes from the `media_link` tool: `<api>/v1/media#t=<token>`, good
 * for fifteen minutes and as many requests as fit. As with the code's, the
 * token is the fragment, sent only as a bearer and never printed
 * (lib/code/wire.mjs).
 *
 * ── the push, in order (wiki/108 §2.4) ──────────────────────────────────────
 *
 *  1. Every picture the content names (lib/media/content.mjs): a slot, a
 *     path in an entry's body, another site's key. A key of this site is
 *     already where it belongs.
 *  2. The files named on the command line, whether or not anything names
 *     them yet — the owner finds them in the library, «Not used anywhere».
 *     A clip and a still with one stem are a clip and its poster.
 *  3. Each made ready as the panel makes it (lib/media/prep.mjs) and hashed
 *     as it will be sent.
 *  4. The manifest: which the library holds already. The rest are sent,
 *     four at a time.
 *  5. Each key written into the content as soon as the library answers with
 *     it, the words kept: a field's own words stay; a picture without any is
 *     given the library's, or else the ones the push knows (the field's
 *     elsewhere, the `PHOTOS` registry's, `--alt`). The library takes words
 *     only for a file that has none — an owner's are never overwritten.
 *  6. A copy of each in `src/assets/media/`, so the dev server goes on
 *     drawing it with no network.
 *  7. A file of src/assets the push adopted and no code names any more is
 *     moved to `.jtakeit/adopted/`, never deleted; one the code still names
 *     is left and listed.
 *
 * Every step is idempotent, and a run cut off — the link's fifteen minutes,
 * the site's hourly budget, the network — has written the keys of every file
 * that reached the library. The same command with a new link carries on.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { STATE_FILE } from './code/files.mjs';
import { ServerError, client, parseCodeUrl } from './code/wire.mjs';
import { CLIP_EXTS, MEDIA_EXTS, besideEntry, classify, contractOf, keyOf, readDocs, readJson, registryWords, rewrite, slotIndex, textOf, usesIn } from './media/content.mjs';
import { ADOPTED, adopt, ensureIgnored, namedByCode, place, readState, writeState } from './media/local.mjs';
import { MAX_BYTES, loadSharp, prepare, refusalOf, sniff } from './media/prep.mjs';

/** The most items one manifest names (`manifestMax`). */
const MANIFEST_MAX = 300;
/** Parts in flight at once. */
const AT_ONCE = 4;
/** Downloads in flight at once. */
const DOWNLOADS = 6;
/** How often a refusal to slow down (429) is waited out before the push stops and says how to carry on. */
const PATIENCE = 6;

export function usage() {
  return `  jtk media push '<url>' [files or dirs…] [--dry-run] [--alt words.json] [--no-tidy]
                                  every picture the content names that is not in the site's
                                  media library yet — a slot, a body's path, another site's key
                                  — and the files given, into the library; the keys written into
                                  the content, the words kept. The URL is media_link's
  jtk media pull ['<url>']        the library's pictures the content names, into
                                  src/assets/media/ (git-ignored) for the dev server; with the
                                  URL, every file of the library and its index in
                                  .jtakeit/media.json`;
}

/** A push or a pull that stopped where it can be carried on, with what to do. */
class Stopped extends Error {}

const size = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const posix = (path) => path.split(sep).join('/');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * @typedef {{
 *   url?: string, dryRun: boolean, root?: string, alt?: string, tidy: boolean,
 *   mediaBase?: string, paths: string[],
 * }} Options
 */

/** @param {string[]} args @returns {Options} */
function optionsOf(args) {
  /** @type {Options} */
  const options = { dryRun: false, tidy: true, paths: [] };
  for (let i = 0; i < args.length; i += 1) {
    const one = args[i];
    const value = () => {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${one} needs a value`);
      i += 1;
      return next;
    };
    if (one === '--dry-run') options.dryRun = true;
    else if (one === '--no-tidy') options.tidy = false;
    else if (one === '--root') options.root = value();
    else if (one === '--alt') options.alt = value();
    else if (one === '--media-base') options.mediaBase = value();
    else if (one.startsWith('--')) throw new Error(`${one} is not an option of jtk media`);
    else if (options.url === undefined && /^[a-z][a-z0-9+.-]*:\/\//i.test(one)) options.url = one;
    else options.paths.push(one);
  }
  return options;
}

/** This site's id, where the copy says it: jtk/site.json, the code's position, the last media run. */
function siteOf(root, state) {
  const facts = readJson(join(root, 'jtk', 'site.json'));
  if (typeof facts?.id === 'string' && facts.id) return facts.id;
  const position = readJson(join(root, STATE_FILE));
  if (typeof position?.site === 'string' && position.site) return position.site;
  return typeof state.site === 'string' && state.site ? state.site : undefined;
}

/** The public host the library's files are served from. */
function mediaBaseOf(root, state, given) {
  const base = given ?? readJson(join(root, 'jtk', 'site.json'))?.media_base ?? state.media_base;
  if (typeof base !== 'string' || base === '') return undefined;
  return base.endsWith('/') ? base : `${base}/`;
}

/** The site a key of the library belongs to. */
const siteOfKey = (key) => keyOf(key)?.site;

/**
 * Ask, and wait out a 429 the server sends — for as long as it says, or
 * longer each time — up to `PATIENCE` times. A dropped connection is tried
 * again too. Anything else is the caller's.
 */
async function patiently(io, what, ask) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await ask();
    } catch (why) {
      const busy = why instanceof ServerError && why.status === 429;
      const dropped = !(why instanceof ServerError) && /could not reach/.test(String(why?.message));
      // The site's hourly budget is not a thing to wait out here: the next hour is.
      const hourly = busy && /hour/i.test(why.message) && why.retryAfter === undefined;
      if (!(busy || dropped) || hourly || attempt >= PATIENCE) throw why;
      const seconds = busy && why.retryAfter !== undefined ? Math.min(why.retryAfter, 300) : Math.min(2 ** attempt, 60);
      io.out(`  ${what}: ${busy ? 'the platform asks to slow down' : 'the connection dropped'} — trying again in ${seconds} s`);
      await io.sleep(seconds * 1000);
    }
  }
}

/** Run `work` over `items`, `limit` at a time; the first failure stops new work, waits for the rest, and is thrown. */
async function inTurn(items, limit, work) {
  let next = 0;
  let failed = null;
  const worker = async () => {
    while (failed === null && next < items.length) {
      const at = next;
      next += 1;
      try {
        await work(items[at], at);
      } catch (why) {
        failed ??= why;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed !== null) throw failed;
}

/** Every media file in a file or a directory given on the command line, relative to the site. */
function filesGiven(root, cwd, paths) {
  const out = [];
  const walk = (abs) => {
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      for (const one of readdirSync(abs).sort()) if (!one.startsWith('.') && one !== 'node_modules') walk(join(abs, one));
    } else if (MEDIA_EXTS.has(extname(abs).toLowerCase())) out.push(abs);
  };
  for (const path of paths) {
    const abs = resolve(cwd, path);
    if (!existsSync(abs)) throw new Error(`${path} does not exist`);
    walk(abs);
  }
  return out.map((abs) => {
    const rel = relative(root, abs);
    return rel.startsWith('..') ? abs : posix(rel);
  });
}

/**
 * @typedef {{
 *   id: string, kind: 'file' | 'key', path?: string, key?: string, name: string,
 *   uses: import('./media/content.mjs').Use[], given: boolean,
 *   words: string, data?: Buffer, sha?: string, scaled?: boolean,
 *   refused?: string, posterOf?: string, from?: string, done?: string,
 * }} Source
 */

/**
 * @param {string[]} args
 * @param {{ cwd: string, out: (line: string) => void, fetch?: typeof fetch, sleep: (ms: number) => Promise<void> }} io
 */
export async function push(args, io) {
  const options = optionsOf(args);
  const root = resolve(io.cwd, options.root ?? '.');
  const contract = contractOf(root);
  if (contract === 0) throw new Error(`${root === io.cwd ? 'here' : root} is not a site: there is no jtk/ — run it in the site's directory, or give --root`);
  if (!options.dryRun && options.url === undefined) throw new Error("give the URL media_link returned, in quotes — or --dry-run to see the plan");
  const target = options.url === undefined ? undefined : parseCodeUrl(options.url, { tool: 'media_link' });
  const api = target === undefined ? undefined : client(target, { fetch: io.fetch });
  const send = (method, path, body, want) => patiently(io, path === '/manifest' ? 'the manifest' : path.replace(/^\//, ''), () => api.call(method, path, body, want));

  const state = readState(root);
  const docs = readDocs(root, contract);
  const uses = usesIn(root, docs, contract);
  let site = siteOf(root, state);

  // Whose key is whose needs this site's id. A copy that has never been
  // imported does not say it; the library does, if it holds anything.
  if (site === undefined && api !== undefined && !options.dryRun && uses.some((use) => keyOf(use.value))) {
    const index = await send('GET', '/index');
    site = (index?.files ?? []).map((one) => siteOfKey(String(one.key))).find(Boolean);
  }

  // ── 1, 2 · what is to go, and where it is named ─────────────────────────
  const slots = slotIndex(root);
  const registry = registryWords(root);
  const given = options.alt === undefined ? {} : readAltFile(resolve(io.cwd, options.alt));
  /** @type {Map<string, Source>} */
  const sources = new Map();
  const own = [];
  const addresses = [];
  const missing = [];
  for (const use of uses) {
    const what = classify(use, { root, site, slots });
    if (what.type === 'own') own.push({ use, key: what.key });
    else if (what.type === 'address') addresses.push(use);
    else if (what.type === 'missing') missing.push({ use, why: what.why });
    else {
      const id = what.type === 'file' ? `file:${what.path}` : `key:${what.key}`;
      if (!sources.has(id)) {
        sources.set(id, what.type === 'file'
          ? { id, kind: 'file', path: what.path, name: basename(what.path), uses: [], given: false, words: '' }
          : { id, kind: 'key', key: what.key, name: what.name, uses: [], given: false, words: '' });
      }
      sources.get(id).uses.push(use);
    }
  }
  for (const path of filesGiven(root, io.cwd, options.paths)) {
    const id = `file:${path}`;
    if (!sources.has(id)) sources.set(id, { id, kind: 'file', path, name: basename(path), uses: [], given: true, words: '' });
    else sources.get(id).given = true;
  }

  // The words each file is given where it has none: the content's own, in
  // the site's language; the registry's for its slot; then --alt's.
  for (const source of sources.values()) {
    const said = source.uses.find((use) => !use.translation && use.alt.trim() !== '')?.alt.trim();
    const slot = source.uses.find((use) => use.kind !== 'body')?.value.trim().toLowerCase();
    const stem = source.name.replace(/\.[^.]+$/, '');
    source.words = said ?? (slot ? registry.get(slot) : undefined) ?? given[source.path ?? ''] ?? given[source.key ?? ''] ?? given[source.name] ?? given[stem] ?? (slot ? given[slot] : undefined) ?? '';
    if (source.uses.length > 0 && source.uses.every((use) => use.kind === 'poster')) source.words = '';
  }

  // ── 3 · each made ready, and hashed as it will be sent ──────────────────
  const sharp = await loadSharp(root);
  let unsharp = false;
  const base = mediaBaseOf(root, state, options.mediaBase);
  for (const source of sources.values()) {
    let data;
    if (source.kind === 'file') {
      data = readFileSync(source.path.startsWith('/') || /^[A-Za-z]:/.test(source.path) ? source.path : join(root, source.path));
    } else {
      const local = [`src/assets/${source.key}`, ...source.uses.filter((use) => use.kind === 'body').map((use) => besideEntry(use.file, source.key))].find((one) => existsSync(join(root, one)));
      if (local) {
        data = readFileSync(join(root, local));
        source.from = local;
      } else if (options.dryRun) {
        source.from = base ? `${base}${source.key}` : 'nowhere: jtk/site.json names no media_base';
        continue;
      } else if (!base) {
        source.refused = 'is not on this machine, and jtk/site.json names no media_base to fetch it from — run jtk media pull where it is, or give --media-base';
        continue;
      } else {
        const answer = await download(io, `${base}${source.key}`);
        if (!answer.ok) {
          source.refused = `could not be fetched from ${base} (${answer.why})`;
          continue;
        }
        data = answer.data;
        source.from = base;
      }
    }
    const type = sniff(data);
    const refusal = refusalOf(type);
    if (refusal) {
      source.refused = refusal;
      continue;
    }
    const ready = await prepare(data, { sharp });
    if (!sharp && data.length > 300 * 1024 && /^image\/(jpeg|png|webp)$/.test(type ?? '')) unsharp = true;
    if (ready.data.length > MAX_BYTES) {
      source.refused = `is ${size(ready.data.length)}, and the library takes at most 8 MB a file${CLIP_EXTS.includes(extname(source.name).toLowerCase()) ? ' — cut the clip shorter or smaller (jt-clips)' : ''}`;
      continue;
    }
    Object.assign(source, { data: ready.data, sha: sha256(ready.data), scaled: ready.scaled });
  }
  // A poster belongs to its clip: in the content by `poster`, on the command line by its stem.
  for (const source of sources.values()) {
    if (!source.sha) continue;
    for (const use of source.uses) {
      if (use.kind !== 'poster' || !use.of) continue;
      const clip = [...sources.values()].find((one) => one.uses.includes(use.of));
      if (clip?.sha) source.posterOf = clip.sha;
    }
    if (source.given && !source.posterOf && /^\.(jpe?g|png|webp|avif)$/i.test(extname(source.name))) {
      const stem = (source.path ?? '').replace(/\.[^./]+$/, '');
      const clip = [...sources.values()].find((one) => one.given && one.sha && CLIP_EXTS.includes(extname(one.name).toLowerCase()) && (one.path ?? '').replace(/\.[^./]+$/, '') === stem);
      if (clip) source.posterOf = clip.sha;
    }
  }

  const list = [...sources.values()];
  const ready = list.filter((one) => one.sha);
  io.out(
    `jtk media ${options.dryRun ? 'push --dry-run' : 'push'}: ${plural(uses.length, 'picture')} named by the content of ${plural(docs.length, 'file')}` +
      `${options.paths.length ? `, ${plural(list.filter((one) => one.given).length, 'file')} given` : ''}`,
  );
  if (own.length) io.out(`  ${plural(own.length, 'value')} already ${own.length === 1 ? 'names' : 'name'} a file of this site's library`);
  if (unsharp) io.out("  sharp is not installed here (npm ci installs it with Astro), so large pictures go as they are — the platform scales them");

  if (options.dryRun) {
    dryPlan(io, { list, own, addresses, missing, site, root, state, options });
    return { left: 0 };
  }

  // ── 4, 5, 6 · the manifest, the parts, the keys written as they come ────
  const dirty = new Set();
  let rewritten = 0;
  let held = 0;
  let sent = 0;
  let sentBytes = 0;
  let taken = 0;
  const flush = () => {
    for (const doc of docs) {
      if (!dirty.has(doc.file)) continue;
      writeFileSync(join(root, doc.file), textOf(doc));
    }
    dirty.clear();
    writeState(root, state);
  };
  /** The library answered for these bytes: write the key everywhere they are named. */
  const settle = (group, key, words) => {
    const keySite = siteOfKey(key);
    if (keySite && site === undefined) site = keySite;
    if (keySite) state.site = keySite;
    if (base) state.media_base = base;
    for (const source of group) {
      source.done = key;
      place(root, `src/assets/${key}`, source.data);
      for (const use of source.uses) {
        if (use.kind === 'body') place(root, besideEntry(use.file, key), source.data);
        if (rewrite(use, key, words || source.words)) {
          dirty.add(use.file);
          rewritten += 1;
        }
        // The library was offered these words with the file: not again.
        if (!use.translation && use.kind !== 'poster') {
          const said = use.kind === 'string' ? use.holder[`${use.prop}_alt`] : use.kind === 'body' ? use.alt : use.holder.alt;
          if (typeof said === 'string' && said.trim()) state.told[key] ??= said.trim();
        }
      }
      if (source.kind === 'file' && source.path.startsWith('src/assets/') && !source.path.startsWith('src/assets/media/')) state.adopted[source.path] = key;
    }
  };

  // One file however many places hold it: grouped by the bytes.
  /** @type {Map<string, Source[]>} */
  const groups = new Map();
  for (const source of ready) groups.set(source.sha, [...(groups.get(source.sha) ?? []), source]);
  const all = [...groups.values()];
  const toSend = [];
  let stopped = null;
  try {
    for (let at = 0; at < all.length; at += MANIFEST_MAX) {
      const chunk = all.slice(at, at + MANIFEST_MAX);
      const manifest = chunk.map(([one, ...more]) => {
        const words = [one, ...more].map((s) => s.words).find(Boolean);
        const posterOf = [one, ...more].map((s) => s.posterOf).find(Boolean);
        return { sha256: one.sha, bytes: one.data.length, name: one.name, ...(words ? { alt: words } : {}), ...(posterOf ? { poster_of: posterOf } : {}) };
      });
      const answer = await send('POST', '/manifest', manifest);
      const items = Array.isArray(answer?.items) ? answer.items : [];
      const heldBefore = held;
      const parts = [];
      chunk.forEach((group, i) => {
        const item = items[i] ?? items.find((one) => one?.sha256 === group[0].sha);
        if (!item || item.sha256 !== group[0].sha) {
          for (const source of group) source.refused = 'the manifest came back without it';
        } else if (item.refused) {
          for (const source of group) source.refused = String(item.refused);
        } else if (item.held && typeof item.key === 'string') {
          held += 1;
          settle(group, item.key, typeof item.alt === 'string' ? item.alt : '');
        } else if (Number.isSafeInteger(item.n) && item.n > 0) {
          parts.push({ group, n: item.n });
        } else {
          for (const source of group) source.refused = 'the manifest answered neither a key nor a part';
        }
      });
      io.out(`  the library holds ${held - heldBefore} of ${plural(chunk.length, 'file')} already; ${parts.length} to send`);
      toSend.push(...parts);
      await inTurn(parts, AT_ONCE, async ({ group, n }) => {
        const [one] = group;
        try {
          const answer = await send('PUT', `/parts/${n}`, one.data);
          if (typeof answer?.key !== 'string' || !answer.key.startsWith('media/')) throw new Error(`the platform took ${one.name} without naming its key`);
          sent += 1;
          sentBytes += one.data.length;
          io.out(`  ↑ ${sent}/${toSend.length} ${one.path ?? one.key} (${size(one.data.length)}${one.scaled ? ', scaled to 2400 px' : ''}) → ${answer.key}${answer.deduplicated ? ' (the library had these bytes)' : ''}`);
          settle(group, answer.key, typeof answer.alt === 'string' ? answer.alt : '');
        } catch (why) {
          // A refusal of this one file is said and the rest go on; the link, the budget or the network stop the run.
          if (why instanceof ServerError && [400, 404, 413, 415, 422].includes(why.status)) {
            for (const source of group) source.refused = why.message || why.code;
            return;
          }
          throw why;
        }
      });
      flush();
    }

    // The library's words for files of this site the content names, where it has none (the owner's win).
    const tell = new Map();
    for (const { use, key } of own) {
      const words = use.translation ? '' : use.alt.trim();
      if (words && !tell.has(key) && state.told[key] !== words) tell.set(key, words);
    }
    const asks = [...tell].map(([key, alt]) => ({ key, alt }));
    for (let at = 0; at < asks.length; at += MANIFEST_MAX) {
      const answer = await send('POST', '/alt', asks.slice(at, at + MANIFEST_MAX));
      for (const item of answer?.items ?? []) {
        if (item?.refused) continue;
        state.told[item.key] = tell.get(item.key);
        if (item.taken) taken += 1;
      }
    }
  } catch (why) {
    stopped = why;
  } finally {
    flush();
  }

  const refused = list.filter((one) => one.refused);
  const left = list.filter((one) => !one.done && !one.refused);
  if (stopped) {
    const done = list.filter((one) => one.done).length;
    io.out(`  ${done} of ${list.length} files are in the library and their keys written`);
    if (stopped instanceof ServerError && stopped.status === 401) {
      throw new Stopped(`the link has ended (fifteen minutes) — ask media_link for a new one and run the same command: it carries on with the ${plural(left.length, 'file')} left`);
    }
    if (stopped instanceof ServerError && stopped.status === 429) {
      throw new Stopped(`${stopped.message || 'the platform asks to slow down'} — ${plural(left.length, 'file')} left: run the same command again later, with a new link from media_link if this one has ended; it carries on`);
    }
    if (stopped instanceof ServerError && stopped.status === 403) {
      throw new Stopped('the link may not upload to this site any more (permission_denied) — the person who manages the site decides who may');
    }
    throw stopped;
  }

  // ── 7 · tidy ────────────────────────────────────────────────────────────
  const moved = [];
  const kept = [];
  if (options.tidy) {
    const stillNamed = new Set(list.filter((one) => one.kind === 'file' && !one.done).map((one) => one.path));
    const candidates = Object.keys(state.adopted).filter((path) => existsSync(join(root, path)) && !stillNamed.has(path));
    const byCode = namedByCode(root, candidates);
    for (const path of candidates) {
      if (byCode.has(path)) {
        kept.push(`${path} — named by ${byCode.get(path).slice(0, 3).join(', ')}${byCode.get(path).length > 3 ? '…' : ''}`);
        continue;
      }
      moved.push(`${path} → ${adopt(root, path)}`);
      delete state.adopted[path];
    }
    for (const path of Object.keys(state.adopted)) if (!existsSync(join(root, path))) delete state.adopted[path];
  }
  const ignored = ensureIgnored(root, contract);
  writeState(root, state);

  // ── what it did ──────────────────────────────────────────────────────────
  const files = new Set(list.filter((one) => one.done).flatMap((one) => one.uses.map((use) => use.file)));
  if (moved.length) {
    io.out(`  moved to ${ADOPTED}/ — nothing names them any more (never deleted; out of git and out of the build):`);
    for (const line of moved) io.out(`    ${line}`);
  }
  if (kept.length) {
    io.out('  left in src/assets — the code still names them: a design asset stays; a photograph the owner may change wants a field:');
    for (const line of kept) io.out(`    ${line}`);
  }
  if (ignored.length) io.out(`  .gitignore: ${ignored.join(', ')}`);
  for (const one of refused) io.out(`  ✗ ${one.path ?? one.key} ${one.refused} — left as it is`);
  for (const { use, why } of missing) io.out(`  ✗ ${use.file} · ${use.where} is "${use.value}", which ${why} — left as it is`);
  for (const use of addresses) io.out(`  · ${use.file} · ${use.where} is an address on the web — the library takes files, not addresses (yet): download it and give it to the push`);
  const wordless = list.filter((one) => one.done && !one.words && one.uses.some((use) => use.kind !== 'poster' && !use.translation && !use.holder?.alt && use.kind === 'picture'));
  if (wordless.length) io.out(`  ${plural(wordless.length, 'picture')} without words: ${wordless.slice(0, 5).map((one) => one.path ?? one.key).join(', ')}${wordless.length > 5 ? '…' : ''} — write them in the field's alt, and the next media push gives them to the library`);
  if (taken) io.out(`  the library took the content's words for ${plural(taken, 'file')} that had none`);

  io.out(
    `done: ${sent} sent (${size(sentBytes)}), ${held} already in the library, ${plural(rewritten, 'value')} rewritten in ${plural(files.size, 'file')}` +
      `${moved.length ? `, ${moved.length} moved to ${ADOPTED}/` : ''}${refused.length + missing.length ? `, ${refused.length + missing.length} left` : ''}`,
  );
  if (rewritten > 0) {
    io.out(contract === 3
      ? "next: npx @jtakeit/astro schema, then validate_schema with site_id — then the code's push (jtk push, or git and import_branch)"
      : "next: commit, and the code's push (jtk push, or git and import_branch)");
  }
  return { left: refused.length + missing.length };
}

/** The plan, said without a request: what would go, from where, and what it would be written over. */
function dryPlan(io, { list, own, addresses, missing, site, root, state, options }) {
  const go = list.filter((one) => !one.refused);
  if (go.length) io.out(`  would send what the library does not hold of ${plural(go.length, 'file')}:`);
  for (const one of go) {
    const where = one.uses.length ? `${plural(one.uses.length, 'place')}: ${[...new Set(one.uses.map((use) => use.file))].slice(0, 3).join(', ')}` : 'named nowhere yet — the owner finds it in the library';
    const whose = one.key?.startsWith('media/jtk-example/') ? "the example's photograph" : site ? "another site's" : 'a key of another site, unless this is that site (jtk/site.json names no id yet)';
    const what = one.kind === 'key' ? `${one.key} — ${whose}, from ${one.from}` : one.path;
    io.out(`    ${what}${one.data ? ` (${size(one.data.length)}${one.scaled ? ', scaled to 2400 px' : ''})` : ''} — ${where}${one.words ? '' : ' — no words'}`);
  }
  for (const one of list.filter((s) => s.refused)) io.out(`  ✗ ${one.path ?? one.key} ${one.refused}`);
  for (const { use, why } of missing) io.out(`  ✗ ${use.file} · ${use.where} is "${use.value}", which ${why}`);
  for (const use of addresses) io.out(`  · ${use.file} · ${use.where} is an address on the web, left as it is`);
  if (options.tidy) {
    const adopted = new Set([...Object.keys(state.adopted), ...go.filter((one) => one.kind === 'file' && one.path.startsWith('src/assets/') && !one.path.startsWith('src/assets/media/')).map((one) => one.path)]);
    const byCode = namedByCode(root, [...adopted].filter((path) => existsSync(join(root, path))));
    const movable = [...adopted].filter((path) => existsSync(join(root, path)) && !byCode.has(path));
    if (movable.length) io.out(`  would move ${plural(movable.length, 'file')} of src/assets to ${ADOPTED}/ once their keys are written (nothing else names them)`);
    for (const [path, by] of byCode) io.out(`  would leave ${path} — named by ${by.slice(0, 3).join(', ')}`);
  }
  if (!go.length && !missing.length) io.out(`  nothing to send${own.length ? ' — every picture is in the library' : ''}`);
  io.out('nothing was sent or written (--dry-run)');
}

/** `--alt words.json`: `{ "<slot, file name, path or key>": "words" }`. */
function readAltFile(file) {
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (why) {
    throw new Error(`--alt ${file}: ${why instanceof SyntaxError ? 'not JSON' : 'cannot be read'} — it is { "<slot or file name>": "the words" }`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`--alt ${file} is { "<slot or file name>": "the words" }`);
  const out = {};
  for (const [name, words] of Object.entries(value)) if (typeof words === 'string' && words.trim()) out[name] = words.trim();
  for (const [name, words] of Object.entries(out)) out[name.toLowerCase()] ??= words;
  return out;
}

/** A public file of the media host — no token goes there. */
async function download(io, url) {
  try {
    const answer = await (io.fetch ?? fetch)(url, { redirect: 'follow' });
    if (!answer.ok) return { ok: false, why: `${answer.status}` };
    return { ok: true, data: Buffer.from(await answer.arrayBuffer()) };
  } catch (why) {
    return { ok: false, why: /** @type {{ cause?: { code?: string } }} */ (why).cause?.code ?? 'unreachable' };
  }
}

/**
 * The library's pictures the content names, onto this machine — and, with a
 * link, every file of the library and its index. The form without a link is
 * what `jtk pull` runs at its end.
 *
 * @param {string[]} args
 * @param {{ cwd: string, out: (line: string) => void, fetch?: typeof fetch, sleep: (ms: number) => Promise<void>, quiet?: boolean }} io
 * @returns {Promise<{ here: number, downloaded: number, failed: string[] }>}
 */
export async function pull(args, io) {
  const options = optionsOf(args);
  const root = resolve(io.cwd, options.root ?? '.');
  const contract = contractOf(root);
  if (contract === 0) throw new Error(`${root === io.cwd ? 'here' : root} is not a site: there is no jtk/ — run it in the site's directory, or give --root`);
  const state = readState(root);
  const base = mediaBaseOf(root, state, options.mediaBase);

  /** @type {Map<string, Set<string>>} key → where its file goes */
  const wanted = new Map();
  const want = (key, path) => wanted.set(key, (wanted.get(key) ?? new Set()).add(path));
  for (const use of usesIn(root, readDocs(root, contract), contract)) {
    const key = keyOf(use.value);
    if (!key) continue;
    want(key.key, `src/assets/${key.key}`);
    if (use.kind === 'body') want(key.key, besideEntry(use.file, key.key));
  }

  if (options.url !== undefined) {
    const target = parseCodeUrl(options.url, { tool: 'media_link' });
    const api = client(target, { fetch: io.fetch });
    const index = await patiently(io, 'the index', () => api.call('GET', '/index'));
    const files = Array.isArray(index?.files) ? index.files : [];
    const thumb = (key, width) => (base ? `${base}${key.replace(/\.[^./]+$/, '')}.w${width}.webp` : undefined);
    state.index = {
      pulled_at: new Date().toISOString(),
      used: index?.used,
      quota: index?.quota,
      files: files.map((one) => ({ ...one, thumbs: (one.thumbs ?? []).map((width) => ({ width, url: thumb(one.key, width) })) })),
    };
    const site = files.map((one) => siteOfKey(String(one.key))).find(Boolean);
    if (site) state.site = site;
    if (base) state.media_base = base;
    for (const one of files) if (typeof one.key === 'string' && keyOf(one.key)) want(one.key, `src/assets/${one.key}`);
  }

  let here = 0;
  let downloaded = 0;
  let placed = 0;
  let bytes = 0;
  const failed = [];
  await inTurn([...wanted], DOWNLOADS, async ([key, paths]) => {
    const absent = [...paths].filter((path) => !existsSync(join(root, path)));
    if (absent.length === 0) {
      here += 1;
      return;
    }
    const present = [...paths].find((path) => existsSync(join(root, path)));
    let data;
    if (present) data = readFileSync(join(root, present));
    else if (!base) {
      failed.push(`${key} — jtk/site.json names no media_base (the platform writes it with the first import); give --media-base`);
      return;
    } else {
      const answer = await download(io, `${base}${key}`);
      if (!answer.ok) {
        failed.push(`${key} — ${answer.why} from ${base}`);
        return;
      }
      data = answer.data;
      downloaded += 1;
      bytes += data.length;
    }
    for (const path of absent) place(root, path, data);
    placed += 1;
    here += 1;
  });
  // Under `jtk pull`, the copy is the branch's: .gitignore changes only when a picture came that it must keep out.
  const ignored = !io.quiet || placed > 0 ? ensureIgnored(root, contract) : [];
  if (options.url !== undefined || state.site || state.media_base) writeState(root, state);

  if (io.quiet && wanted.size === 0) return { here, downloaded, failed };
  io.out(`jtk media pull: ${plural(here, 'picture')} of the library here${downloaded ? `, ${downloaded} downloaded (${size(bytes)})` : ''}${wanted.size === 0 ? ' — the content names none' : ''}`);
  if (options.url !== undefined) io.out(`  the library's index: ${STATE_INDEX} — ${plural(state.index.files.length, 'file')}, each with its words, size, thumbnails and where it is used`);
  if (ignored.length) io.out(`  .gitignore: ${ignored.join(', ')}`);
  for (const line of failed) io.out(`  ✗ ${line}`);
  return { here, downloaded, failed };
}

const STATE_INDEX = '.jtakeit/media.json';

/**
 * The command, its output and its exit status. Every line passes through
 * here with the token taken out.
 * @param {string[]} args `push …` or `pull …`
 * @param {{ cwd?: string, out?: (line: string) => void, err?: (line: string) => void, fetch?: typeof fetch, sleep?: (ms: number) => Promise<void> }} [io]
 * @returns {Promise<number>}
 */
export async function main(args, io = {}) {
  const [command, ...rest] = args;
  const tokens = rest.flatMap((one) => {
    try {
      return [parseCodeUrl(one, { tool: 'media_link' }).token];
    } catch {
      return [];
    }
  });
  const clean = (line) => tokens.reduce((text, token) => text.split(token).join('<token>'), line);
  const out = (line) => (io.out ?? console.log)(clean(line));
  const err = (line) => (io.err ?? console.error)(clean(line));
  if (command !== 'push' && command !== 'pull') {
    err(`usage:\n${usage()}`);
    return command === '--help' || command === '-h' ? 0 : 1;
  }
  try {
    const sleep = io.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
    const context = { cwd: io.cwd ?? process.cwd(), out, fetch: io.fetch, sleep };
    if (command === 'push') return (await push(rest, context)).left > 0 ? 1 : 0;
    return (await pull(rest, context)).failed.length > 0 ? 1 : 0;
  } catch (why) {
    if (why instanceof ServerError) err(`jtk media ${command}: ${why.code}${why.message ? ` — ${why.message}` : ''}`);
    else err(`jtk media ${command}: ${why instanceof Error ? why.message : why}`);
    return 1;
  }
}

export { Stopped };
/** For `jtk push`'s advice: the pictures the content names that are not in this site's library. */
export function outsideLibrary(root) {
  const contract = contractOf(root);
  if (contract === 0) return [];
  const state = readState(root);
  const site = siteOf(root, state);
  const slots = slotIndex(root);
  return usesIn(root, readDocs(root, contract), contract).filter((use) => {
    const what = classify(use, { root, site, slots });
    return what.type === 'file' || (what.type === 'foreign' && site !== undefined) || (what.type === 'foreign' && what.site === 'jtk-example');
  });
}
