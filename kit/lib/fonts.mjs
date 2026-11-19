/**
 * A typeface and the system face that stands in for it while it loads.
 *
 *   jtk fonts <file.woff2>… [--fallback Arial|Helvetica|Georgia|'Times New Roman'|'Courier New'] [--json]
 *
 * prints, for each face, the `@font-face` of its stand-in: a face the
 * visitor already has (`local('Arial')`), set to the webfont's proportions —
 * `size-adjust` so a line of it is as long, `ascent-override`,
 * `descent-override` and `line-gap-override` so a line of it is as tall. The
 * text is laid out at the webfont's size from the first frame, and the swap
 * moves nothing (wiki/115 F2: fonts don't jump).
 *
 * ── why it reads the file itself ────────────────────────────────────────────
 *
 * fontkit fails on a variable woff2 (wohlfühl-Raum's three faces were measured
 * by hand for it, 18 November 2026), and what a stand-in needs is four tables
 * a few hundred bytes long: `head` (units per em), `hhea` (ascender,
 * descender, line gap, the number of advances), `OS/2` (the weight, the
 * italic bit, whether the typo metrics are the ones to use) and the advances
 * of `hmtx` with `cmap` to find the letters. A woff2 is a table directory and
 * one brotli stream (node:zlib has brotliDecompressSync); `glyf` and `loca`
 * may be transformed there and are never read, and a transformed `hmtx`
 * still begins with its advances. A woff (zlib per table), a TrueType or
 * OpenType file and the first face of a collection are read too.
 *
 * ── the width: what a line of text is made of ───────────────────────────────
 *
 * `size-adjust` is the ratio of two average widths, each the advance of the
 * lowercase letters and the space weighted by how often they occur in text
 * (English letter frequencies, which German shares closely enough at this
 * scale) — the method of Capsize and next/font. OS/2's `xAvgCharWidth` is the
 * fallback where a face maps none of them; it averages every glyph in the
 * font, which in a subset is a figure for glyphs that are not there. The
 * stand-ins' own numbers are below, measured off the faces macOS ships, by
 * this same reader.
 *
 * The overrides are fractions of the em divided by `size-adjust`, because a
 * browser scales the overridden metrics by it too.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { brotliDecompressSync, inflateSync } from 'node:zlib';

/** How often each character occurs in running text, per hundred letters. */
const FREQUENCY = {
  ' ': 18,
  a: 8.2, b: 1.5, c: 2.8, d: 4.3, e: 12.7, f: 2.2, g: 2.0, h: 6.1, i: 7.0, j: 0.15, k: 0.77, l: 4.0, m: 2.4,
  n: 6.7, o: 7.5, p: 1.9, q: 0.095, r: 6.0, s: 6.3, t: 9.1, u: 2.8, v: 0.98, w: 2.4, x: 0.15, y: 2.0, z: 0.074,
};

/**
 * The stand-ins, measured by `metricsOf` off the files macOS 26 ships in
 * /System/Library/Fonts (Supplemental/*.ttf; Helvetica.ttc's first faces):
 * units per em, the frequency-weighted average advance (`avg`) and OS/2's
 * `xAvgCharWidth` (`xavg`) — Helvetica's, garbled in the collection, is
 * Arial's, whose widths it shares. A stand-in's vertical metrics never
 * matter: they are what the overrides replace.
 */
export const FALLBACKS = Object.freeze({
  Arial: {
    kind: 'sans-serif',
    faces: {
      'normal 400': { local: ['Arial', 'ArialMT'], upm: 2048, avg: 915.53, xavg: 904 },
      'normal 700': { local: ['Arial Bold', 'Arial-BoldMT'], upm: 2048, avg: 991.44, xavg: 980 },
      'italic 400': { local: ['Arial Italic', 'Arial-ItalicMT'], upm: 2048, avg: 915.53, xavg: 904 },
      'italic 700': { local: ['Arial Bold Italic', 'Arial-BoldItalicMT'], upm: 2048, avg: 991.44, xavg: 980 },
    },
  },
  Helvetica: {
    kind: 'sans-serif',
    faces: {
      'normal 400': { local: ['Helvetica'], upm: 2048, avg: 915.53, xavg: 904 },
      'normal 700': { local: ['Helvetica Bold', 'Helvetica-Bold'], upm: 2048, avg: 991.44, xavg: 980 },
      'italic 400': { local: ['Helvetica Oblique', 'Helvetica-Oblique'], upm: 2048, avg: 915.53, xavg: 904 },
      'italic 700': { local: ['Helvetica Bold Oblique', 'Helvetica-BoldOblique'], upm: 2048, avg: 991.44, xavg: 980 },
    },
  },
  Georgia: {
    kind: 'serif',
    faces: {
      'normal 400': { local: ['Georgia'], upm: 2048, avg: 913.13, xavg: 901 },
      'normal 700': { local: ['Georgia Bold', 'Georgia-Bold'], upm: 2048, avg: 1065.58, xavg: 1051 },
      'italic 400': { local: ['Georgia Italic', 'Georgia-Italic'], upm: 2048, avg: 932.79, xavg: 920 },
      'italic 700': { local: ['Georgia Bold Italic', 'Georgia-BoldItalic'], upm: 2048, avg: 1088.12, xavg: 1073 },
    },
  },
  'Times New Roman': {
    kind: 'serif',
    faces: {
      'normal 400': { local: ['Times New Roman', 'TimesNewRomanPSMT'], upm: 2048, avg: 829.78, xavg: 821 },
      'normal 700': { local: ['Times New Roman Bold', 'TimesNewRomanPS-BoldMT'], upm: 2048, avg: 883.97, xavg: 874 },
      'italic 400': { local: ['Times New Roman Italic', 'TimesNewRomanPS-ItalicMT'], upm: 2048, avg: 833.02, xavg: 823 },
      'italic 700': { local: ['Times New Roman Bold Italic', 'TimesNewRomanPS-BoldItalicMT'], upm: 2048, avg: 853.53, xavg: 844 },
    },
  },
  'Courier New': {
    kind: 'monospace',
    faces: {
      'normal 400': { local: ['Courier New', 'CourierNewPSMT'], upm: 2048, avg: 1229, xavg: 1229 },
      'normal 700': { local: ['Courier New Bold', 'CourierNewPS-BoldMT'], upm: 2048, avg: 1229, xavg: 1229 },
      'italic 400': { local: ['Courier New Italic', 'CourierNewPS-ItalicMT'], upm: 2048, avg: 1229, xavg: 1229 },
      'italic 700': { local: ['Courier New Bold Italic', 'CourierNewPS-BoldItalicMT'], upm: 2048, avg: 1229, xavg: 1229 },
    },
  },
});

// ── reading the tables ─────────────────────────────────────────────────────

/** The 63 tags a woff2 names by their index (WOFF2 §5.1, Table 1). */
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

const tagAt = (buf, at) => buf.toString('latin1', at, at + 4);

/**
 * A font file's tables, by tag: a woff2, a woff, a TrueType or OpenType file,
 * or the first face of a collection. Only what is asked for is decompressed
 * past the woff2's one stream.
 *
 * @param {Buffer} buf
 * @returns {{ format: string; tables: Map<string, Buffer>; transformed: Set<string> }}
 */
export function readTables(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  const signature = tagAt(buf, 0);
  if (signature === 'wOF2') return woff2Tables(buf);
  if (signature === 'wOFF') return woffTables(buf);
  if (signature === 'ttcf') return sfntTables(buf, buf.readUInt32BE(12), 'collection');
  const version = buf.readUInt32BE(0);
  if (version === 0x00010000 || signature === 'OTTO' || signature === 'true') return sfntTables(buf, 0, signature === 'OTTO' ? 'opentype' : 'truetype');
  throw new Error('not a font file the reader knows — woff2, woff, ttf, otf or ttc');
}

function sfntTables(buf, at, format) {
  const tables = new Map();
  const count = buf.readUInt16BE(at + 4);
  for (let i = 0; i < count; i++) {
    const rec = at + 12 + i * 16;
    const offset = buf.readUInt32BE(rec + 8);
    const length = buf.readUInt32BE(rec + 12);
    tables.set(tagAt(buf, rec), buf.subarray(offset, offset + length));
  }
  return { format, tables, transformed: new Set() };
}

function woffTables(buf) {
  const tables = new Map();
  const count = buf.readUInt16BE(12);
  for (let i = 0; i < count; i++) {
    const rec = 44 + i * 20;
    const offset = buf.readUInt32BE(rec + 4);
    const compressed = buf.readUInt32BE(rec + 8);
    const length = buf.readUInt32BE(rec + 12);
    const data = buf.subarray(offset, offset + compressed);
    tables.set(tagAt(buf, rec), compressed < length ? inflateSync(data) : data);
  }
  return { format: 'woff', tables, transformed: new Set() };
}

/** UIntBase128 (WOFF2 §4.1): at most five bytes, seven bits each. */
function base128(buf, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[at.i++];
    if (i === 0 && byte === 0x80) throw new Error('woff2: a number with a leading zero');
    if (value & 0xfe000000) throw new Error('woff2: a number past 32 bits');
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value >>> 0;
  }
  throw new Error('woff2: a number longer than five bytes');
}

function woff2Tables(buf) {
  const flavor = tagAt(buf, 4);
  const count = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  const at = { i: 48 };
  const directory = [];
  for (let n = 0; n < count; n++) {
    const flags = buf[at.i++];
    let tag;
    if ((flags & 0x3f) === 0x3f) {
      tag = tagAt(buf, at.i);
      at.i += 4;
    } else {
      tag = KNOWN[flags & 0x3f];
    }
    const version = (flags >> 6) & 0x03;
    const length = base128(buf, at);
    // glyf and loca are transformed at version 0 and plain at 3; every other
    // table the other way round.
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const stored = transformed ? base128(buf, at) : length;
    directory.push({ tag, stored, transformed });
  }
  if (flavor === 'ttcf') {
    // A collection's directory follows; its first face is the one read. The
    // tables are numbered into the stream as above whatever face holds them.
    throw new Error('woff2: a collection — unpack it and measure one face');
  }
  const stream = brotliDecompressSync(buf.subarray(at.i, at.i + compressedSize));
  const tables = new Map();
  const transformed = new Set();
  let offset = 0;
  for (const one of directory) {
    tables.set(one.tag, stream.subarray(offset, offset + one.stored));
    if (one.transformed) transformed.add(one.tag);
    offset += one.stored;
  }
  return { format: 'woff2', tables, transformed };
}

// ── the tables a stand-in needs ────────────────────────────────────────────

/** The name table's string for an id: Windows English first, then any Unicode record, then Mac Roman. */
function nameOf(table, id) {
  if (table === undefined) return '';
  const count = table.readUInt16BE(2);
  const strings = table.readUInt16BE(4);
  let found = '';
  let rank = 0;
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12;
    const platform = table.readUInt16BE(rec);
    const language = table.readUInt16BE(rec + 4);
    if (table.readUInt16BE(rec + 6) !== id) continue;
    const r = platform === 3 && language === 0x0409 ? 3 : platform === 3 || platform === 0 ? 2 : platform === 1 ? 1 : 0;
    if (r <= rank) continue;
    const length = table.readUInt16BE(rec + 8);
    const offset = strings + table.readUInt16BE(rec + 10);
    const bytes = table.subarray(offset, offset + length);
    if (r === 1) {
      found = bytes.toString('latin1');
    } else {
      found = '';
      for (let j = 0; j + 1 < bytes.length; j += 2) found += String.fromCharCode(bytes.readUInt16BE(j));
    }
    rank = r;
  }
  return found;
}

/** The glyph a character is drawn with: cmap format 4 or 12, Unicode. */
function glyphFinder(table) {
  if (table === undefined) return () => 0;
  const count = table.readUInt16BE(2);
  let best = -1;
  let rank = -1;
  for (let i = 0; i < count; i++) {
    const platform = table.readUInt16BE(4 + i * 8);
    const encoding = table.readUInt16BE(6 + i * 8);
    const offset = table.readUInt32BE(8 + i * 8);
    const format = table.readUInt16BE(offset);
    const r = format === 12 && (platform === 3 || platform === 0) ? 3 : format === 4 && platform === 3 && encoding === 1 ? 2 : format === 4 && platform === 0 ? 1 : -1;
    if (r > rank) {
      rank = r;
      best = offset;
    }
  }
  if (best === -1) return () => 0;
  const format = table.readUInt16BE(best);
  if (format === 12) {
    const groups = table.readUInt32BE(best + 12);
    return (code) => {
      for (let g = 0; g < groups; g++) {
        const rec = best + 16 + g * 12;
        const start = table.readUInt32BE(rec);
        const end = table.readUInt32BE(rec + 4);
        if (code >= start && code <= end) return table.readUInt32BE(rec + 8) + (code - start);
      }
      return 0;
    };
  }
  const segments = table.readUInt16BE(best + 6) / 2;
  const ends = best + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  return (code) => {
    for (let s = 0; s < segments; s++) {
      const end = table.readUInt16BE(ends + s * 2);
      if (code > end) continue;
      const start = table.readUInt16BE(starts + s * 2);
      if (code < start) return 0;
      const delta = table.readInt16BE(deltas + s * 2);
      const range = table.readUInt16BE(ranges + s * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const at = ranges + s * 2 + range + (code - start) * 2;
      const glyph = table.readUInt16BE(at);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/**
 * Which kind of face: PANOSE, then the IBM family class, then post's fixed
 * pitch, then the name — '' where none of them says.
 */
function kindOf(os2, post, family) {
  if (post !== undefined && post.length >= 16 && post.readUInt32BE(12) !== 0) return 'monospace';
  if (os2 !== undefined && os2.length >= 42) {
    const panose = os2[32];
    const serif = os2[33];
    if (panose === 2 && os2[35] === 9) return 'monospace';
    if (panose === 2 && serif >= 11 && serif <= 13) return 'sans-serif';
    if (panose === 2 && serif >= 2 && serif <= 10) return 'serif';
    if (panose === 3) return 'cursive';
    const sfClass = os2[30];
    if (sfClass >= 1 && sfClass <= 7 && sfClass !== 6) return 'serif';
    if (sfClass === 8) return 'sans-serif';
    if (sfClass === 10) return 'cursive';
  }
  if (/\bmono|code\b/i.test(family)) return 'monospace';
  if (/\bsans\b|grotesk|grotesque|gothic/i.test(family)) return 'sans-serif';
  if (/serif|garamond|caslon|baskerville|bodoni|didot|roman|antiqua|cormorant|newsreader|playfair|lora|merriweather/i.test(family)) return 'serif';
  return '';
}

const f2dot14 = (buf, at) => buf.readInt16BE(at) / 16384;

/** A user value on an axis as a normalised coordinate, through `avar` where the font has one. */
function normalise(axes, avar, user) {
  return axes.map((axis, i) => {
    const v = Math.min(axis.max, Math.max(axis.min, user[axis.tag] ?? axis.default));
    let n = v < axis.default ? (v - axis.default) / (axis.default - axis.min || 1) : v > axis.default ? (v - axis.default) / (axis.max - axis.default || 1) : 0;
    if (avar !== undefined) {
      let at = 8;
      for (let a = 0; a < i; a++) at += 2 + avar.readUInt16BE(at) * 4;
      const pairs = avar.readUInt16BE(at);
      const map = [];
      for (let p = 0; p < pairs; p++) map.push([f2dot14(avar, at + 2 + p * 4), f2dot14(avar, at + 4 + p * 4)]);
      for (let p = 1; p < map.length; p++) {
        if (n > map[p][0]) continue;
        const [x0, y0] = map[p - 1];
        const [x1, y1] = map[p];
        n = x1 === x0 ? y1 : y0 + ((n - x0) * (y1 - y0)) / (x1 - x0);
        break;
      }
    }
    return n;
  });
}

/**
 * The change HVAR makes to a glyph's advance at a normalised position — the
 * item variation store, read for advances only. A font that varies its
 * advances through gvar alone is measured at its default instance.
 */
function advanceDelta(hvar, coords) {
  if (hvar === undefined) return () => 0;
  const store = hvar.readUInt32BE(4);
  const mapAt = hvar.readUInt32BE(8);
  const regions = store + hvar.readUInt32BE(store + 2);
  const axisCount = hvar.readUInt16BE(regions);
  const regionCount = hvar.readUInt16BE(regions + 2);
  const scalars = [];
  for (let r = 0; r < regionCount; r++) {
    let scalar = 1;
    for (let a = 0; a < axisCount; a++) {
      const rec = regions + 4 + (r * axisCount + a) * 6;
      const [start, peak, end] = [f2dot14(hvar, rec), f2dot14(hvar, rec + 2), f2dot14(hvar, rec + 4)];
      const v = coords[a] ?? 0;
      if (peak === 0 || v === peak || start > peak || peak > end || (start < 0 && end > 0)) continue;
      if (v <= start || v >= end) {
        scalar = 0;
        break;
      }
      scalar *= v < peak ? (v - start) / (peak - start) : (end - v) / (end - peak);
    }
    scalars.push(scalar);
  }
  const dataCount = hvar.readUInt16BE(store + 6);
  const data = [];
  for (let d = 0; d < dataCount; d++) data.push(store + hvar.readUInt32BE(store + 8 + d * 4));
  const mapped = (glyph) => {
    if (mapAt === 0) return [0, glyph];
    const format = hvar[mapAt];
    const entryFormat = hvar[mapAt + 1];
    const count = format === 0 ? hvar.readUInt16BE(mapAt + 2) : hvar.readUInt32BE(mapAt + 2);
    const first = mapAt + (format === 0 ? 4 : 6);
    const size = ((entryFormat & 0x30) >> 4) + 1;
    const bits = (entryFormat & 0x0f) + 1;
    const at = first + Math.min(glyph, count - 1) * size;
    let entry = 0;
    for (let b = 0; b < size; b++) entry = entry * 256 + hvar[at + b];
    return [entry >>> bits, entry & ((1 << bits) - 1)];
  };
  return (glyph) => {
    const [outer, inner] = mapped(glyph);
    const at = data[outer];
    if (at === undefined) return 0;
    const items = hvar.readUInt16BE(at);
    if (inner >= items) return 0;
    const wordCount = hvar.readUInt16BE(at + 2);
    const long = (wordCount & 0x8000) !== 0;
    const words = wordCount & 0x7fff;
    const indexCount = hvar.readUInt16BE(at + 4);
    const indexes = [];
    for (let k = 0; k < indexCount; k++) indexes.push(hvar.readUInt16BE(at + 6 + k * 2));
    const wide = long ? 4 : 2;
    const narrow = long ? 2 : 1;
    const row = words * wide + (indexCount - words) * narrow;
    let p = at + 6 + indexCount * 2 + inner * row;
    let delta = 0;
    for (let k = 0; k < indexCount; k++) {
      let d;
      if (k < words) {
        d = long ? hvar.readInt32BE(p) : hvar.readInt16BE(p);
        p += wide;
      } else {
        d = long ? hvar.readInt16BE(p) : hvar.readInt8(p);
        p += narrow;
      }
      delta += d * (scalars[indexes[k]] ?? 0);
    }
    return delta;
  };
}

/**
 * What a stand-in is measured from.
 *
 * A variable face is measured at `weight` (the user value on its wght axis):
 * 400 where its range has it — the weight text is set in — and its default
 * instance otherwise. Its advances are moved by HVAR there; its vertical
 * metrics are the default instance's.
 *
 * @param {Buffer | Uint8Array} bytes a font file
 * @param {{ weight?: number }} [options]
 * @returns {{
 *   format: string; family: string; subfamily: string; style: 'normal' | 'italic'; weight: number;
 *   axes: { tag: string; min: number; default: number; max: number }[];
 *   unitsPerEm: number; ascent: number; descent: number; lineGap: number; metrics: 'hhea' | 'typo';
 *   xAvgCharWidth: number; avg: number; capHeight: number; xHeight: number; kind: string; varied: boolean;
 * }}
 */
export function metricsOf(bytes, options = {}) {
  const { format, tables, transformed } = readTables(Buffer.from(bytes));
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const os2 = tables.get('OS/2');
  if (head === undefined || hhea === undefined) throw new Error('the font has no head or hhea table');
  const unitsPerEm = head.readUInt16BE(18);

  // The vertical metrics a browser lays a line out by: the typo metrics where
  // the font says to use them (USE_TYPO_METRICS, OS/2 fsSelection bit 7),
  // hhea's otherwise — which is what Chrome and Safari read on every
  // platform the visitors have.
  const useTypo = os2 !== undefined && os2.length >= 78 && (os2.readUInt16BE(62) & 0x80) !== 0;
  const ascent = useTypo ? os2.readInt16BE(68) : hhea.readInt16BE(4);
  const descent = useTypo ? os2.readInt16BE(70) : hhea.readInt16BE(6);
  const lineGap = useTypo ? os2.readInt16BE(72) : hhea.readInt16BE(8);

  const axes = [];
  const fvar = tables.get('fvar');
  if (fvar !== undefined) {
    const first = fvar.readUInt16BE(4);
    const count = fvar.readUInt16BE(8);
    const size = fvar.readUInt16BE(10);
    for (let i = 0; i < count; i++) {
      const rec = first + i * size;
      axes.push({ tag: tagAt(fvar, rec), min: fvar.readInt32BE(rec + 4) / 65536, default: fvar.readInt32BE(rec + 8) / 65536, max: fvar.readInt32BE(rec + 12) / 65536 });
    }
  }
  const wght = axes.find((one) => one.tag === 'wght');

  // The family as a stylesheet names it. A variable face's name 1 is its
  // default instance's — «Manrope ExtraLight», «Newsreader 16pt» — and a
  // subset's sometimes another instance's (@fontsource's Space Grotesk 600
  // says «Space Grotesk Light»): the words for an instance are taken off it.
  const name = tables.get('name');
  let family = nameOf(name, 16) || nameOf(name, 1);
  {
    family = family.replace(/(\s+(Thin|Hairline|ExtraLight|Extra Light|UltraLight|Light|Regular|Book|Medium|SemiBold|Semi Bold|DemiBold|Bold|ExtraBold|Extra Bold|Black|Heavy|\d+pt))+$/i, '');
  }
  const subfamily = nameOf(name, 17) || nameOf(name, 2);
  const fsSelection = os2 !== undefined && os2.length >= 64 ? os2.readUInt16BE(62) : 0;
  const macStyle = head.readUInt16BE(44);
  const style = fsSelection & 0x01 || macStyle & 0x02 || /italic|oblique/i.test(subfamily) ? 'italic' : 'normal';

  const asked = options.weight ?? (wght !== undefined && wght.min <= 400 && wght.max >= 400 ? 400 : undefined);
  const weight = wght !== undefined ? Math.min(wght.max, Math.max(wght.min, asked ?? wght.default)) : os2 !== undefined ? os2.readUInt16BE(4) : 400;

  // The advances, read whether or not a woff2 transformed the table: a
  // transformed hmtx is a flags byte and then the same advances — moved by
  // HVAR to the weight measured.
  let avg = 0;
  const hvar = tables.get('HVAR');
  const varied = wght !== undefined && weight !== wght.default && hvar !== undefined;
  const hmtx = tables.get('hmtx');
  if (hmtx !== undefined) {
    const advances = hhea.readUInt16BE(34);
    const start = transformed.has('hmtx') ? 1 : 0;
    const step = transformed.has('hmtx') ? 2 : 4;
    const delta = varied ? advanceDelta(hvar, normalise(axes, tables.get('avar'), { wght: weight })) : () => 0;
    const advance = (glyph) => hmtx.readUInt16BE(start + Math.min(glyph, advances - 1) * step) + delta(glyph);
    const glyphOf = glyphFinder(tables.get('cmap'));
    let sum = 0;
    let weights = 0;
    for (const [char, freq] of Object.entries(FREQUENCY)) {
      const glyph = glyphOf(char.codePointAt(0));
      if (glyph === 0) continue;
      sum += advance(glyph) * freq;
      weights += freq;
    }
    // Most of the letters, or the measure is of something else.
    if (weights > 90) avg = sum / weights;
  }

  return {
    format,
    family,
    subfamily,
    style,
    weight,
    axes,
    unitsPerEm,
    ascent,
    descent,
    lineGap,
    metrics: useTypo ? 'typo' : 'hhea',
    xAvgCharWidth: os2 !== undefined ? os2.readInt16BE(2) : 0,
    avg,
    capHeight: os2 !== undefined && os2.readUInt16BE(0) >= 2 && os2.length >= 90 ? os2.readInt16BE(88) : 0,
    xHeight: os2 !== undefined && os2.readUInt16BE(0) >= 2 && os2.length >= 88 ? os2.readInt16BE(86) : 0,
    kind: kindOf(os2, tables.get('post'), family),
    varied: wght !== undefined && (weight === wght.default || hvar !== undefined),
  };
}

// ── the stand-in ───────────────────────────────────────────────────────────

/** The stand-in a kind of face is measured against when nobody says. */
const BY_KIND = { serif: 'Georgia', 'sans-serif': 'Arial', monospace: 'Courier New', cursive: 'Georgia', '': 'Arial' };

const percent = (n) => `${(Math.round(n * 10000) / 100).toString()}%`;

/**
 * The stand-in's `@font-face` for a measured face.
 *
 * @param {ReturnType<typeof metricsOf>} m
 * @param {{ fallback?: string; family?: string; weight?: number }} [options] `fallback` one of FALLBACKS' names;
 *   `family` the stand-in's name; `weight` the one weight it stands in for — a variable face's whole range where none is said
 */
export function standIn(m, options = {}) {
  const fallback = options.fallback ?? BY_KIND[m.kind] ?? 'Arial';
  const said = FALLBACKS[fallback];
  if (said === undefined) throw new Error(`--fallback: «${fallback}» is not one the kit has measured — ${Object.keys(FALLBACKS).join(', ')}`);
  const face = said.faces[`${m.style} ${m.weight >= 600 ? 700 : 400}`];

  // The width: the weighted average where both have one, xAvgCharWidth
  // where one has not.
  const ours = m.avg > 0 && face.avg > 0 ? m.avg / m.unitsPerEm : m.xAvgCharWidth / m.unitsPerEm;
  const theirs = m.avg > 0 && face.avg > 0 ? face.avg / face.upm : face.xavg / face.upm;
  const size = ours > 0 && theirs > 0 ? ours / theirs : 1;
  const em = m.unitsPerEm * size;

  const family = options.family ?? `${m.family || 'Webfont'} Fallback`;
  const weight = m.axes.find((one) => one.tag === 'wght');
  return {
    family,
    fallback,
    local: face.local,
    style: m.style,
    weight: options.weight === undefined && weight !== undefined ? `${weight.min} ${weight.max}` : String(m.weight),
    sizeAdjust: percent(size),
    ascentOverride: percent(m.ascent / em),
    descentOverride: percent(Math.abs(m.descent) / em),
    lineGapOverride: percent(m.lineGap / em),
    width: m.avg > 0 && face.avg > 0 ? 'letters' : 'xAvgCharWidth',
  };
}

/** The stand-in as CSS. @param {ReturnType<typeof standIn>} face */
export function fontFaceCSS(face) {
  return [
    '@font-face {',
    `  font-family: '${face.family}';`,
    `  src: ${face.local.map((one) => `local('${one}')`).join(', ')};`,
    ...(face.style === 'italic' ? ['  font-style: italic;'] : []),
    `  font-weight: ${face.weight};`,
    `  size-adjust: ${face.sizeAdjust};`,
    `  ascent-override: ${face.ascentOverride};`,
    `  descent-override: ${face.descentOverride};`,
    `  line-gap-override: ${face.lineGapOverride};`,
    '}',
  ].join('\n');
}

export function usage() {
  return `jtk fonts <file.woff2>… [--fallback <face>] [--weight 400] [--family <name>] [--json]
                                  measure each face and print the @font-face of the system
                                  face that stands in for it while it loads (size-adjust,
                                  ascent-, descent- and line-gap-override), against
                                  ${Object.keys(FALLBACKS).join(', ')} — by the face's kind
                                  where --fallback is not said; a variable face at --weight
                                  (400 where it has it)`;
}

/** @param {string[]} args */
export async function main(args) {
  const files = [];
  const options = {};
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const one = args[i];
    if (one === '--json') json = true;
    else if (one === '--fallback' || one === '--family') options[one.slice(2)] = args[++i];
    else if (one === '--weight') options.weight = Number(args[++i]);
    else if (one === '--help' || one === '-h') {
      console.log(usage());
      return 0;
    } else files.push(one);
  }
  if (files.length === 0) {
    console.error(`jtk fonts: name the face's files\n\n  ${usage()}`);
    return 1;
  }
  const out = [];
  let failed = 0;
  for (const file of files) {
    try {
      if (options.weight !== undefined && !(options.weight >= 1 && options.weight <= 1000)) throw new Error('--weight is a number from 1 to 1000');
      const m = metricsOf(readFileSync(file), { weight: options.weight });
      const face = standIn(m, options);
      out.push({ file, metrics: m, face });
      if (json) continue;
      const wght = m.axes.find((one) => one.tag === 'wght');
      const at = wght === undefined ? 'its default instance' : m.varied ? `wght ${m.weight}` : `wght ${wght.default}, its default (the advances do not vary by HVAR)`;
      const variable = m.axes.length > 0 ? `, variable (${m.axes.map((one) => `${one.tag} ${one.min}–${one.max}`).join(', ')}), measured at ${at}` : '';
      console.log(`/* ${m.family || basename(file)} ${m.subfamily} — ${basename(file)}${variable}; against ${face.fallback}${face.width === 'letters' ? '' : ', the width by xAvgCharWidth'} */`);
      console.log(fontFaceCSS(face));
      console.log(`/* then: font-family: '${m.family}', '${face.family}', ${FALLBACKS[face.fallback].kind}; */\n`);
    } catch (why) {
      failed++;
      console.error(`jtk fonts: ${file}: ${why instanceof Error ? why.message : why}`);
    }
  }
  if (json) console.log(JSON.stringify(out, null, 2));
  return failed > 0 ? 1 : 0;
}
