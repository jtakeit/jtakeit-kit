import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync } from 'node:zlib';
import { FALLBACKS, fontFaceCSS, metricsOf, readTables, standIn } from '../lib/fonts.mjs';

/*
 * A face made here, table by table, so the reader is held to numbers it did
 * not compute: 1000 units to the em, hhea 900 / −250 / 50, the space 250
 * wide and every lowercase letter 500 — as a TrueType file, and wrapped as a
 * woff2 the way a subsetter writes one, its hmtx plain or transformed.
 */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function face({ family = 'Probe Sans', weight = 400, italic = false, panose = [2, 11] } = {}) {
  const glyphs = 2 + LETTERS.length;
  const head = Buffer.alloc(54);
  head.writeUInt32BE(0x00010000, 0);
  head.writeUInt16BE(1000, 18);
  head.writeUInt16BE(italic ? 2 : 0, 44);

  const hhea = Buffer.alloc(36);
  hhea.writeUInt32BE(0x00010000, 0);
  hhea.writeInt16BE(900, 4);
  hhea.writeInt16BE(-250, 6);
  hhea.writeInt16BE(50, 8);
  hhea.writeUInt16BE(glyphs, 34);

  const hmtx = Buffer.alloc(glyphs * 4);
  hmtx.writeUInt16BE(600, 0);
  hmtx.writeUInt16BE(250, 4);
  for (let g = 2; g < glyphs; g++) hmtx.writeUInt16BE(500, g * 4);

  const os2 = Buffer.alloc(96);
  os2.writeUInt16BE(4, 0);
  os2.writeInt16BE(480, 2);
  os2.writeUInt16BE(weight, 4);
  os2[32] = panose[0];
  os2[33] = panose[1];
  os2.writeUInt16BE(italic ? 0x01 : 0x40, 62);
  os2.writeInt16BE(800, 68);
  os2.writeInt16BE(-200, 70);
  os2.writeInt16BE(0, 72);
  os2.writeInt16BE(500, 86);
  os2.writeInt16BE(700, 88);

  // cmap: one format-4 subtable, the space and a–z, and the closing segment.
  const segments = [[32, 32, 1 - 32], [97, 122, 2 - 97], [0xffff, 0xffff, 1]];
  const sub = Buffer.alloc(16 + segments.length * 8);
  sub.writeUInt16BE(4, 0);
  sub.writeUInt16BE(sub.length, 2);
  sub.writeUInt16BE(segments.length * 2, 6);
  segments.forEach(([start, end, delta], i) => {
    sub.writeUInt16BE(end, 14 + i * 2);
    sub.writeUInt16BE(start, 16 + segments.length * 2 + i * 2);
    sub.writeInt16BE(delta, 16 + segments.length * 4 + i * 2);
  });
  const cmap = Buffer.concat([Buffer.from([0, 0, 0, 1, 0, 3, 0, 1, 0, 0, 0, 12]), sub]);

  const words = Buffer.from(family, 'utf16le').swap16();
  const name = Buffer.alloc(18);
  name.writeUInt16BE(1, 2);
  name.writeUInt16BE(18, 4);
  name.writeUInt16BE(3, 6);
  name.writeUInt16BE(1, 8);
  name.writeUInt16BE(0x0409, 10);
  name.writeUInt16BE(1, 12);
  name.writeUInt16BE(words.length, 14);

  return { head, hhea, hmtx, 'OS/2': os2, cmap, name: Buffer.concat([name, words]) };
}

function sfnt(tables) {
  const tags = Object.keys(tables).sort();
  const header = Buffer.alloc(12 + tags.length * 16);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(tags.length, 4);
  let offset = header.length;
  const bodies = [];
  tags.forEach((tag, i) => {
    const body = tables[tag];
    header.write(tag, 12 + i * 16, 'latin1');
    header.writeUInt32BE(offset, 12 + i * 16 + 8);
    header.writeUInt32BE(body.length, 12 + i * 16 + 12);
    const padded = Buffer.alloc(Math.ceil(body.length / 4) * 4);
    body.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  return Buffer.concat([header, ...bodies]);
}

const KNOWN = { cmap: 0, head: 1, hhea: 2, hmtx: 3, name: 5, 'OS/2': 6 };
const base128 = (n) => {
  const out = [n & 0x7f];
  for (n >>>= 7; n > 0; n >>>= 7) out.unshift(0x80 | (n & 0x7f));
  return out;
};

/** A woff2 of the tables; `transformHmtx` writes hmtx as a woff2 transform does — a flags byte, then the advances alone. */
function woff2(tables, { transformHmtx = false } = {}) {
  const entries = [];
  const stream = [];
  for (const [tag, body] of Object.entries(tables)) {
    if (tag === 'hmtx' && transformHmtx) {
      const advances = Buffer.alloc(1 + body.length / 2);
      advances[0] = 0x03;
      for (let i = 0; i < body.length / 4; i++) advances.writeUInt16BE(body.readUInt16BE(i * 4), 1 + i * 2);
      entries.push(Buffer.from([(1 << 6) | KNOWN[tag], ...base128(body.length), ...base128(advances.length)]));
      stream.push(advances);
    } else {
      entries.push(Buffer.from([KNOWN[tag], ...base128(body.length)]));
      stream.push(body);
    }
  }
  const compressed = brotliCompressSync(Buffer.concat(stream));
  const header = Buffer.alloc(48);
  header.write('wOF2', 0, 'latin1');
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt16BE(entries.length, 12);
  header.writeUInt32BE(compressed.length, 20);
  return Buffer.concat([header, ...entries, compressed]);
}

const FREQ_LETTERS = 8.2 + 1.5 + 2.8 + 4.3 + 12.7 + 2.2 + 2.0 + 6.1 + 7.0 + 0.15 + 0.77 + 4.0 + 2.4 + 6.7 + 7.5 + 1.9 + 0.095 + 6.0 + 6.3 + 9.1 + 2.8 + 0.98 + 2.4 + 0.15 + 2.0 + 0.074;
const AVG = (18 * 250 + FREQ_LETTERS * 500) / (18 + FREQ_LETTERS);

test('a TrueType face is read: units, hhea, the weighted advance, the name and the kind', () => {
  const m = metricsOf(sfnt(face()));
  assert.equal(m.format, 'truetype');
  assert.equal(m.family, 'Probe Sans');
  assert.equal(m.unitsPerEm, 1000);
  assert.deepEqual([m.ascent, m.descent, m.lineGap, m.metrics], [900, -250, 50, 'hhea']);
  assert.ok(Math.abs(m.avg - AVG) < 1e-9, `${m.avg} against ${AVG}`);
  assert.deepEqual([m.xAvgCharWidth, m.xHeight, m.capHeight, m.weight, m.style, m.kind], [480, 500, 700, 400, 'normal', 'sans-serif']);
});

test('a woff2 is read to the same numbers, its hmtx plain or transformed', () => {
  const plain = metricsOf(sfnt(face()));
  for (const transformHmtx of [false, true]) {
    const file = woff2(face(), { transformHmtx });
    const { format, transformed } = readTables(file);
    assert.equal(format, 'woff2');
    assert.equal(transformed.has('hmtx'), transformHmtx);
    const m = metricsOf(file);
    assert.deepEqual({ ...m, format: 'truetype' }, plain);
  }
});

test('the stand-in: size-adjust the ratio of the widths, the overrides the em divided by it', () => {
  const m = metricsOf(woff2(face()));
  const arial = FALLBACKS.Arial.faces['normal 400'];
  const size = AVG / 1000 / (arial.avg / arial.upm);
  const face1 = standIn(m);
  assert.equal(face1.fallback, 'Arial');
  assert.deepEqual(face1.local, ['Arial', 'ArialMT']);
  assert.equal(face1.family, 'Probe Sans Fallback');
  assert.equal(face1.width, 'letters');
  assert.equal(face1.sizeAdjust, `${Math.round(size * 10000) / 100}%`);
  assert.equal(face1.ascentOverride, `${Math.round((0.9 / size) * 10000) / 100}%`);
  assert.equal(face1.descentOverride, `${Math.round((0.25 / size) * 10000) / 100}%`);
  assert.equal(face1.lineGapOverride, `${Math.round((0.05 / size) * 10000) / 100}%`);
  const css = fontFaceCSS(face1);
  assert.match(css, /font-family: 'Probe Sans Fallback';/);
  assert.match(css, /src: local\('Arial'\), local\('ArialMT'\);/);
  assert.match(css, /size-adjust: \d+(\.\d+)?%;\n {2}ascent-override: \d+(\.\d+)?%;\n {2}descent-override: \d+(\.\d+)?%;\n {2}line-gap-override: \d+(\.\d+)?%;/);
});

test('a serif against Georgia, a bold face against the bold stand-in, an italic against the italic, a named fallback where asked', () => {
  assert.equal(standIn(metricsOf(sfnt(face({ family: 'Probe Serif', panose: [2, 2] })))).fallback, 'Georgia');
  assert.equal(standIn(metricsOf(sfnt(face({ family: 'Probe Garamond', panose: [0, 0] })))).fallback, 'Georgia', 'no PANOSE: the name says serif');
  assert.deepEqual(standIn(metricsOf(sfnt(face({ weight: 700 })))).local, ['Arial Bold', 'Arial-BoldMT']);
  const italic = standIn(metricsOf(sfnt(face({ italic: true }))));
  assert.equal(italic.style, 'italic');
  assert.match(fontFaceCSS(italic), /font-style: italic;/);
  assert.equal(standIn(metricsOf(sfnt(face())), { fallback: 'Times New Roman' }).local[0], 'Times New Roman');
  assert.throws(() => standIn(metricsOf(sfnt(face())), { fallback: 'Comic Sans' }), /not one the kit has measured/);
});

test('the stand-in is never named as the face it stands in for, and a face of no known kind is said', () => {
  const m = metricsOf(sfnt(face({ family: 'Gloock', panose: [0, 0] })));
  const named = standIn(m, { family: 'Gloock' });
  assert.equal(named.family, 'Gloock Fallback', "--family Gloock printed 'Gloock', 'Gloock' (20 November 2026)");
  assert.equal(named.renamed, 'Gloock');
  assert.equal(standIn(m, { family: 'gloock ' }).family, 'Gloock Fallback');
  assert.equal(standIn(m, { family: 'Shop Display Stand-in' }).family, 'Shop Display Stand-in');
  assert.equal(standIn(m, { family: 'Shop Display Stand-in' }).renamed, undefined);
  assert.equal(named.kindUnknown, true, 'neither PANOSE, the class nor the name says serif');
  assert.equal(standIn(m, { fallback: 'Georgia' }).kindUnknown, undefined, 'a fallback asked for is not guessed');
  assert.equal(standIn(metricsOf(sfnt(face()))).kindUnknown, undefined);
});

test('what is not a font is said so', () => {
  assert.throws(() => metricsOf(Buffer.from('<!doctype html><html></html>')), /not a font file/);
});
