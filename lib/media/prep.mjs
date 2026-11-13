/**
 * A file made ready to send, as the panel makes one (`downscale.ts` in the
 * admin, wiki/108 §2.4 · 3): no edge longer than 2 400 px, a JPEG at quality
 * 0.82 and a PNG or a WebP as a WebP (which keeps its transparency), only for
 * a picture over 300 KB, and only where the copy is smaller. Everything else
 * goes as it is: a small file, a clip (`jt-clips` has sized it), an SVG, an
 * AVIF. The platform's intake does the same and more — it takes the metadata
 * out losslessly and scales what is still too large — so a file that is not
 * made smaller here is still kept right; this only saves the bytes on the
 * way.
 *
 * `sharp` is the site's own: Astro installs it to optimise the site's
 * pictures, so it is in `node_modules` of every scaffold. Where it is not, the
 * original goes, and the push says so once.
 *
 * The manifest's hash is of the bytes as they are sent, so the same file
 * prepared twice must give the same bytes: sharp does, for the same input and
 * the same sharp.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_EDGE = 2400;
export const SMALL_ENOUGH = 300 * 1024;
export const QUALITY = 82;
/** The most one file may be, as the platform takes it (`maxUploadBytes`). */
export const MAX_BYTES = 8 * 1024 * 1024;

/**
 * What a file is, from its first bytes, as the platform's intake sniffs it.
 * @param {Buffer} data
 * @returns {string | undefined} a content type, or undefined for one the library does not take
 */
export function sniff(data) {
  const at = (offset, text) => data.subarray(offset, offset + text.length).toString('latin1') === text;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (at(0, '\x89PNG\r\n\x1a\n')) return 'image/png';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (at(0, 'GIF8')) return 'image/gif';
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return 'video/webm';
  if (at(4, 'ftyp')) {
    const brand = data.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  const head = data.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return undefined;
}

/** Why the library would refuse a file of this type, or null. */
export function refusalOf(type) {
  if (type === undefined) return 'is not a picture or a clip the library takes (JPEG, PNG, WebP, AVIF, SVG, MP4, WebM) — export it as one of those';
  if (type === 'image/gif') return 'is a GIF, which the library does not take — export a still as JPEG or PNG, or the loop as MP4';
  if (type === 'video/quicktime') return 'is a QuickTime movie, which the library does not take — export it as MP4 (H.264)';
  return null;
}

/**
 * The site's sharp, or the kit's, or none.
 * @param {string} root
 * @returns {Promise<any>}
 */
export async function loadSharp(root) {
  for (const from of [join(root, 'package.json'), import.meta.url]) {
    try {
      const mod = await import(pathToFileURL(createRequire(from).resolve('sharp')).href);
      return mod.default ?? mod;
    } catch {
      // not there
    }
  }
  return null;
}

/**
 * The bytes to send for a file.
 *
 * @param {Buffer} data
 * @param {{ sharp: any }} options
 * @returns {Promise<{ data: Buffer, type: string | undefined, scaled: boolean }>}
 */
export async function prepare(data, { sharp }) {
  const type = sniff(data);
  const raster = type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
  if (!raster || data.length <= SMALL_ENOUGH || !sharp) return { data, type, scaled: false };
  try {
    const image = sharp(data, { failOn: 'none' });
    const meta = await image.metadata();
    // EXIF orientations 5–8 stand the picture on its side: its drawn edges are the other way round.
    const turned = (meta.orientation ?? 1) >= 5;
    const width = turned ? meta.height : meta.width;
    const height = turned ? meta.width : meta.height;
    if (!width || !height || Math.max(width, height) <= MAX_EDGE) return { data, type, scaled: false };
    const resized = image.rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
    const out = type === 'image/jpeg' ? await resized.jpeg({ quality: QUALITY }).toBuffer() : await resized.webp({ quality: QUALITY }).toBuffer();
    if (out.length >= data.length) return { data, type, scaled: false };
    return { data: out, type: type === 'image/jpeg' ? 'image/jpeg' : 'image/webp', scaled: true };
  } catch {
    // A file sharp cannot read goes as it is: the platform says what is wrong with it.
    return { data, type, scaled: false };
  }
}
