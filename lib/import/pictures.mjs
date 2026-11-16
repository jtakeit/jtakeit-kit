/**
 * The pictures a sheet's rows name — addresses fetched on this machine, never
 * by the platform, and paths read beside the sheet — kept as the files a slot
 * names, `src/assets/products/<slug>-<n>.<ext>` (jtakeit-core wiki/102 stage 9,
 * decisions 3 and 9, Rulings 179, 184, 240). `jtk media push` then writes the
 * library's key in the slot's place and adopts the file out of `src/assets`
 * (lib/media.mjs); a picture never reaches git.
 *
 * ── what is taken, and what is not ──────────────────────────────────────────
 *
 * A picture is taken by what its first bytes are, never by its name or by the
 * type an address says it is: a path in a sheet could name any file on the
 * machine (`~/.ssh/id_rsa.jpg`) and an address could answer a page. It is taken
 * when `media push` takes it as an image (lib/media/prep.mjs) — JPEG, PNG,
 * WebP, AVIF, SVG — and the file's extension is that kind's. Anything else is
 * said with its row and its address, and left out.
 *
 * An address is fetched over `http:` or `https:` only, with no cache, for at
 * most `TIMEOUT` (the answer and its body together, each address its own time),
 * and its body is read up to `MAX_BYTES` and stopped there — never fetched whole
 * and then measured. A path is read beside the sheet, and only a file: a folder,
 * a device or a pipe is none, and a file over the most is not read.
 *
 * The first picture a product has is its cover, `<slug>-1`; the numbers go by
 * the pictures had, so one that cannot be had leaves no gap.
 */
import { closeSync, mkdirSync, openSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MAX_BYTES, refusalOf, sniff } from '../media/prep.mjs';
import { q } from './util.mjs';

/** Where the files are kept, below the site's root; a slot is `products/<slug>-<n>`, the file one of these without its extension. */
export const FOLDER = 'src/assets/products';
/** The most an address may take, in milliseconds. */
export const TIMEOUT = 20000;
/** Products whose pictures are fetched at once; one product's, one after another. */
const AT_ONCE = 4;
/** The kinds a picture is, by what `sniff` says its bytes are, with the extension each is kept as. */
const KINDS = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/avif', '.avif'], ['image/svg+xml', '.svg']]);

const MOST = `${MAX_BYTES / 1024 / 1024} MB`;
const OVER = `is more than ${MOST}, and the library takes at most ${MOST} a file`;
const BYTES = 'its first bytes are none of a JPEG, PNG, WebP, AVIF or SVG — taken for what it holds, never for its name or its type';

/** What a reference is: an address of the web, a path beside the sheet, or one this import does not read, with the reason. */
function kindOfRef(ref) {
  // A scheme has two letters at least, so that `C:\photos\fox.jpg` is a path.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]+):/.exec(ref)?.[1].toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    try {
      new URL(ref);
      return { kind: 'address' };
    } catch {
      return { kind: 'refused', why: 'is not an address that can be read' };
    }
  }
  if (scheme !== undefined) return { kind: 'refused', why: `uses «${scheme}:», and only http: and https: addresses are fetched` };
  if (ref.startsWith('//')) return { kind: 'refused', why: 'has no scheme: only http: and https: addresses are fetched, so write the whole address' };
  return { kind: 'path' };
}

/** The code a failure carries (`ECONNREFUSED`, `ENOTFOUND`), which is what a person can act on, else its words. */
function reasonOf(why) {
  const cause = /** @type {any} */ (why)?.cause;
  return cause?.code ?? cause?.errors?.[0]?.code ?? cause?.message ?? (why instanceof Error ? why.message : String(why));
}

/**
 * An address's body, up to the most: read as it comes, and stopped once it is over.
 * @returns {Promise<{ data: Buffer, type: string } | { why: string }>}
 */
async function fromAddress(url, { fetch, timeout }) {
  const signal = AbortSignal.timeout(timeout);
  const slow = { why: `took more than ${timeout / 1000} seconds` };
  let answer;
  try {
    answer = await fetch(url, { cache: 'no-store', redirect: 'follow', signal });
  } catch (why) {
    return signal.aborted ? slow : { why: `could not be reached (${reasonOf(why)})` };
  }
  /** What is not read is let go, so that the connection ends. */
  const drop = () => void answer.body?.cancel().catch(() => {});
  if (!answer.ok) {
    drop();
    return { why: `answered ${answer.status}` };
  }
  const length = Number(answer.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    drop();
    return { why: OVER };
  }
  const chunks = [];
  let total = 0;
  try {
    const reader = answer.body?.getReader();
    while (reader !== undefined) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        reader.cancel().catch(() => {});
        return { why: OVER };
      }
      chunks.push(value);
    }
  } catch (why) {
    return signal.aborted ? slow : { why: `was cut off while it was read (${reasonOf(why)})` };
  }
  return { data: Buffer.concat(chunks), type: answer.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '' };
}

/**
 * A path's file, and only a file, of at most the most.
 * @returns {{ data: Buffer } | { why: string }}
 */
function fromPath(ref, from) {
  const file = resolve(from, ref);
  let stat;
  try {
    stat = statSync(file);
  } catch (why) {
    return { why: /** @type {any} */ (why)?.code === 'ENOENT' ? 'is not a file here' : `cannot be read (${reasonOf(why)})` };
  }
  if (!stat.isFile()) return { why: 'is not a file: only a file is read' };
  if (stat.size > MAX_BYTES) return { why: OVER };
  try {
    const data = Buffer.alloc(stat.size);
    const fd = openSync(file, 'r');
    try {
      let read = 0;
      while (read < data.length) {
        const n = readSync(fd, data, read, data.length - read, read);
        if (n === 0) break;
        read += n;
      }
      return { data: data.subarray(0, read) };
    } finally {
      closeSync(fd);
    }
  } catch (why) {
    return { why: `cannot be read (${reasonOf(why)})` };
  }
}

/**
 * What the bytes are, as a picture of a product: the extension it is kept as, or `none` where they are no picture the
 * library takes, or why this kind is not one.
 * @returns {{ ext: string } | { none: true } | { why: string }}
 */
function kindOfBytes(data) {
  const type = sniff(data);
  if (type === undefined) return { none: true };
  const ext = KINDS.get(type);
  if (ext !== undefined) return { ext };
  return { why: refusalOf(type) ?? "is a video, and a product's picture is a still image" };
}

/**
 * Keep a picture as the file its slot names, and no other under that name: one an earlier run left with another extension
 * would be the slot's by the order the extensions are tried in.
 * @returns {string} the slot
 */
function keep(root, slug, n, ext, data) {
  const folder = join(root, FOLDER);
  mkdirSync(folder, { recursive: true });
  for (const other of KINDS.values()) if (other !== ext) rmSync(join(folder, `${slug}-${n}${other}`), { force: true });
  writeFileSync(join(folder, `${slug}-${n}${ext}`), data);
  return `products/${slug}-${n}`;
}

/**
 * The pictures a sheet's rows name — addresses fetched on this machine, never by
 * the platform, and paths read beside the sheet — written to
 * src/assets/products/<slug>-<n>.<ext>; each that cannot be had is said, with its
 * row and its address, and left out.
 *
 * @param {{ slug: string, pictures: { ref: string, line: number, column: string }[] }[]} planned
 *   the products that take pictures, each with the addresses and paths its rows name, in the sheet's order and each once
 * @param {{ root: string, from: string, fetch?: typeof fetch, timeout?: number }} where
 *   `root` the site's; `from` the sheet's folder, which a path is read from; `fetch` the one the caller gives (`io.fetch`);
 *   `timeout` the most an address may take, in milliseconds
 * @returns {Promise<{ slots: Map<string, string[]>, said: string[] }>} per slug, the slots in the sheet's order
 */
export async function fetchPictures(planned, { root, from, fetch = globalThis.fetch, timeout = TIMEOUT }) {
  /** @type {string[][]} */ const slotsOf = planned.map(() => []);
  /** @type {string[][]} */ const saidOf = planned.map(() => []);
  let next = 0;
  const worker = async () => {
    while (next < planned.length) {
      const at = next;
      next += 1;
      const { slug, pictures } = planned[at];
      for (const { ref, line, column } of pictures) {
        const left = (why) => void saidOf[at].push(`row ${line}, column ${q(column)}: ${q(ref)} ${why} — left out of ${slug}`);
        const what = kindOfRef(ref);
        if (what.kind === 'refused') {
          left(what.why);
          continue;
        }
        const address = what.kind === 'address';
        const got = address ? await fromAddress(ref, { fetch, timeout }) : fromPath(ref, from);
        if ('why' in got) {
          left(got.why);
          continue;
        }
        const kind = kindOfBytes(got.data);
        if ('none' in kind) {
          const type = 'type' in got && got.type !== '' ? got.type : 'with no type';
          left(address ? `answered ${type}, and ${BYTES}` : `is not a picture: ${BYTES}`);
        } else if ('why' in kind) {
          left(kind.why);
        } else {
          try {
            slotsOf[at].push(keep(root, slug, slotsOf[at].length + 1, kind.ext, got.data));
          } catch (why) {
            left(`cannot be written under ${FOLDER}/ (${reasonOf(why)})`);
          }
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, planned.length) }, worker));
  return {
    slots: new Map(planned.flatMap((one, at) => (slotsOf[at].length > 0 ? [[one.slug, slotsOf[at]]] : []))),
    said: saidOf.flat(),
  };
}
