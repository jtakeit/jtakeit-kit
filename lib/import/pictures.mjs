/**
 * The pictures a sheet's rows name — addresses fetched on this machine, never
 * by the platform, and paths read inside the sheet's folder — kept as the files a
 * slot names, `src/assets/products/<slug>-<n>.<ext>` (jtakeit-core wiki/102
 * stage 9, decisions 3 and 9, Rulings 179, 184, 240, 242, 243, 244). `jtk media
 * push` then writes the library's key in the slot's place and adopts the file out
 * of `src/assets` (lib/media.mjs); a picture never reaches git.
 *
 * ── what is taken, and what is not ──────────────────────────────────────────
 *
 * A picture is taken by what its first bytes are, never by its name or by the
 * type an address says it is: an address could answer a page, and a path could
 * lead to any file on the machine (`~/.ssh/id_rsa.jpg`). It is taken when it is a
 * photograph `media push` takes (lib/media/prep.mjs) — JPEG, PNG, WebP, AVIF —
 * and the file's extension is that kind's. An SVG is none: a drawing from a
 * stranger's sheet may carry script that the library would serve, so it is added
 * by hand. Anything else is said with its row and its address, and left out.
 *
 * A path is read only inside the sheet's folder: resolved, then its real path
 * must be inside the folder's real path — no `..` out of it, no absolute path,
 * no link out of it. An address is fetched over `http:` or `https:` only, with
 * no cache, for at most `TIMEOUT` (the answer and its body together, each address
 * its own time), and its body is read up to `MAX_BYTES` and stopped there —
 * never fetched whole and then measured. A file is read only if it is a file
 * (a folder, a device or a pipe is none) and not over the most.
 *
 * An address that several products name is fetched once in a run. The first
 * picture a product has is its cover, `<slug>-1`; the numbers go by the pictures
 * had, so one that cannot be had leaves no gap.
 */
import { closeSync, mkdirSync, openSync, readSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { PICTURE_EXTS } from '../media/content.mjs';
import { MAX_BYTES, refusalOf, sniff } from '../media/prep.mjs';
import { SLUG } from './sheet.mjs';
import { SLUG_MOST, count, q } from './util.mjs';

/** Where the files are kept, below the site's root; a slot is `products/<slug>-<n>`, the file one of these without its extension. */
export const FOLDER = 'src/assets/products';
/** The most an address may take, in milliseconds. */
export const TIMEOUT = 20000;
/** Products whose pictures are fetched at once; one product's, one after another. */
const AT_ONCE = 4;
/** The kinds a picture is, by what `sniff` says its bytes are, with the extension each is kept as. No SVG: it is added by hand. */
const KINDS = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/avif', '.avif']]);
/** What `sniff` calls an MP4 whatever its `ftyp` brand is: the brands that are photographs, and those that are video. */
const HEIF = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);
const VIDEO = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'mp71', 'avc1', 'dash', 'm4v', 'm4vh', 'm4vp', '3gp4', '3gp5', '3gp6', '3gp7', '3g2a', '3g2b', '3g2c', 'f4v', 'mmp4']);

const MOST = `${MAX_BYTES / 1024 / 1024} MB`;
const OVER = `is more than ${MOST}, and the library takes at most ${MOST} a file`;
const BYTES = 'its first bytes are none of a JPEG, PNG, WebP or AVIF — taken for what it holds, never for its name or its type';
const A_VIDEO = "is a video, and a product's picture is a still image";

/** What a reference is: an address of the web, a path in the sheet's folder, or one this import does not read, with the reason. */
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
  const seconds = timeout / 1000;
  const slow = { why: `took more than ${seconds} ${seconds === 1 ? 'second' : 'seconds'}` };
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

/** Whether a path is the folder or below it. */
function inside(folder, path) {
  const way = relative(folder, path);
  return way === '' || (way !== '..' && !way.startsWith(`..${sep}`) && !isAbsolute(way));
}

const INSIDE = 'a path is read only inside the sheet\'s folder';

/**
 * A path's file, only inside the sheet's folder, only a file, of at most the most.
 * @param {string} ref @param {string} folder the sheet's folder, as its real path
 * @returns {{ data: Buffer } | { why: string }}
 */
function fromPath(ref, folder) {
  if (isAbsolute(ref)) return { why: `is an absolute path: ${INSIDE}, and written relative to it` };
  const file = resolve(folder, ref);
  if (!inside(folder, file)) return { why: `is outside the sheet's folder: ${INSIDE}` };
  let real;
  try {
    real = realpathSync(file);
  } catch (why) {
    return { why: /** @type {any} */ (why)?.code === 'ENOENT' ? 'is not a file here' : `cannot be read (${reasonOf(why)})` };
  }
  if (!inside(folder, real)) return { why: `leads out of the sheet's folder by a link: ${INSIDE}, links too` };
  let stat;
  try {
    stat = statSync(real);
  } catch (why) {
    return { why: `cannot be read (${reasonOf(why)})` };
  }
  if (!stat.isFile()) return { why: 'is not a file: only a file is read' };
  if (stat.size > MAX_BYTES) return { why: OVER };
  try {
    const data = Buffer.alloc(stat.size);
    const fd = openSync(real, 'r');
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
 * library takes at all, or why this kind is not one.
 * @returns {{ ext: string } | { none: true } | { why: string }}
 */
function kindOfBytes(data) {
  const type = sniff(data);
  if (type === undefined) return { none: true };
  const ext = KINDS.get(type);
  if (ext !== undefined) return { ext };
  if (type === 'image/svg+xml') return { why: "is an SVG drawing; a product's picture is a photograph: add it by hand" };
  if (type === 'video/mp4') {
    // `sniff` calls every `ftyp` an MP4, and a phone's HEIC photograph is one: the brand says which it is.
    const brand = data.subarray(8, 12).toString('latin1').replace(/[^ -~]/g, '?');
    if (HEIF.has(brand.toLowerCase())) return { why: 'is a HEIC photograph, which the library does not take — export it as a JPEG' };
    if (VIDEO.has(brand.trim().toLowerCase())) return { why: A_VIDEO };
    return { why: `is a file of a kind (ftyp «${brand}») that is no photograph the library takes — export a JPEG` };
  }
  if (type === 'video/webm') return { why: A_VIDEO };
  return { why: refusalOf(type) ?? A_VIDEO };
}

/**
 * Keep a picture as the file its slot names, and no other under that name: one an earlier run left with another extension
 * would be the slot's by the order the extensions are tried in.
 * @returns {string} the slot
 */
function keep(root, slug, n, ext, data) {
  const folder = join(root, FOLDER);
  mkdirSync(folder, { recursive: true });
  for (const other of PICTURE_EXTS) if (other !== ext) rmSync(join(folder, `${slug}-${n}${other}`), { force: true });
  writeFileSync(join(folder, `${slug}-${n}${ext}`), data);
  return `products/${slug}-${n}`;
}

/**
 * The pictures a sheet's rows name — addresses fetched on this machine, never by
 * the platform, and paths read inside the sheet's folder — written to
 * src/assets/products/<slug>-<n>.<ext>; each that cannot be had is said, with its
 * row and its address, and left out.
 *
 * @param {{ slug: string, pictures: { ref: string, line: number, column: string }[] }[]} planned
 *   the products that take pictures, each with the addresses and paths its rows name, in the sheet's order and each once
 * @param {{ root: string, from: string, fetch?: typeof fetch, timeout?: number, progress?: (line: string) => void, beforeFirstFile?: () => void }} where
 *   `root` the site's; `from` the sheet's folder, which a path is read from, and kept inside; `fetch` the one the caller gives
 *   (`io.fetch`); `timeout` the most an address may take, in milliseconds; `progress` is given a line as each product's pictures
 *   are begun; `beforeFirstFile` is called once, before the first file is written, so that the caller can keep it out of git first
 * @returns {Promise<{ slots: Map<string, string[]>, said: string[] }>} per slug, the slots in the sheet's order
 */
export async function fetchPictures(planned, { root, from, fetch = globalThis.fetch, timeout = TIMEOUT, progress, beforeFirstFile }) {
  /** @type {string[][]} */ const slotsOf = planned.map(() => []);
  /** @type {string[][]} */ const saidOf = planned.map(() => []);
  let folder;
  try {
    folder = realpathSync(from);
  } catch {
    folder = resolve(from);
  }

  // One fetch for an address that several products name, kept only while a product still waits for it.
  /** @type {Map<string, number>} */ const waiting = new Map();
  for (const { pictures } of planned) for (const { ref } of pictures) waiting.set(ref, (waiting.get(ref) ?? 0) + 1);
  const shared = new Set([...waiting].filter(([, n]) => n > 1).map(([ref]) => ref));
  /** @type {Map<string, Promise<any>>} */ const had = new Map();
  const load = (ref, address) => (address ? fromAddress(ref, { fetch, timeout }) : Promise.resolve(fromPath(ref, folder)));
  const get = async (ref, address) => {
    if (!shared.has(ref)) return load(ref, address);
    if (!had.has(ref)) had.set(ref, load(ref, address));
    const got = await had.get(ref);
    waiting.set(ref, /** @type {number} */ (waiting.get(ref)) - 1);
    if (waiting.get(ref) === 0) had.delete(ref);
    return got;
  };

  let ignored = false;
  let next = 0;
  const worker = async () => {
    while (next < planned.length) {
      const at = next;
      next += 1;
      const { slug, pictures } = planned[at];
      progress?.(`  fetching ${pictures.length} ${pictures.length === 1 ? 'picture' : 'pictures'} of ${slug} (product ${at + 1} of ${planned.length})`);
      const kept = SLUG.test(slug) && count(slug) <= SLUG_MOST;
      for (const { ref, line, column } of pictures) {
        const left = (why) => void saidOf[at].push(`row ${line}, column ${q(column)}: ${q(ref)} ${why} — left out of ${slug}`);
        if (!kept) {
          left(`cannot be kept: the product's address ${q(slug)} is not one a file name is made of (lowercase letters, digits and single dashes)`);
          continue;
        }
        const what = kindOfRef(ref);
        if (what.kind === 'refused') {
          left(what.why);
          continue;
        }
        const address = what.kind === 'address';
        const got = await get(ref, address);
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
          // Kept out of git before the first file is on the disk; where that cannot be done, no file is written.
          if (!ignored) {
            beforeFirstFile?.();
            ignored = true;
          }
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
