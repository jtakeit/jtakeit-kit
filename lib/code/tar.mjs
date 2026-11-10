/**
 * The archives of the wire (wiki/88 · §10): ustar, with a PAX header for a
 * path ustar cannot hold, gzipped by the caller.
 *
 * Written by hand rather than by a package because the kit needs very little
 * of tar — regular files one way, regular files the other — and what it reads
 * comes from a server and is checked entry by entry before anything is
 * written (write.mjs). A general tar library would also understand links,
 * devices and sparse files, which is exactly what must not be understood here.
 */

const BLOCK = 512;

/** @param {Buffer} h @param {number} at @param {number} width @param {number} n */
function octal(h, at, width, n) {
  h.write(`${n.toString(8).padStart(width - 1, '0')}\0`, at, width, 'latin1');
}

/**
 * One 512-byte header. Owner, group and time are zero so the same files make
 * the same archive on every machine.
 * @param {{ name: string, size: number, mode: number, type: string, linkname?: string }} entry
 */
function header({ name, size, mode, type, linkname = '' }) {
  const h = Buffer.alloc(BLOCK);
  h.write(name, 0, 100, 'utf8');
  octal(h, 100, 8, mode);
  octal(h, 108, 8, 0);
  octal(h, 116, 8, 0);
  octal(h, 124, 12, size);
  octal(h, 136, 12, 0);
  h.fill(0x20, 148, 156);
  h.write(type, 156, 1, 'latin1');
  h.write(linkname, 157, 100, 'utf8');
  h.write('ustar\0', 257, 6, 'latin1');
  h.write('00', 263, 2, 'latin1');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1');
  return h;
}

/**
 * A PAX record, `"<len> <key>=<value>\n"`, where the length counts itself.
 * @param {string} key @param {string} value
 */
function paxRecord(key, value) {
  const body = Buffer.byteLength(` ${key}=${value}\n`);
  let len = body;
  for (let next = body + String(len).length; next !== len; next = body + String(len).length) len = next;
  return `${len} ${key}=${value}\n`;
}

const pad = (n) => Buffer.alloc((BLOCK - (n % BLOCK)) % BLOCK);

/**
 * A tar of these entries, in the order given. A path that is not ASCII or is
 * longer than ustar's 100-byte name goes in a PAX `path` record, which Go's
 * archive/tar, GNU tar and bsdtar all read; the ustar name beside it is a
 * truncated stand-in for a reader that knows no PAX.
 *
 * Nothing is checked here: what may go into an archive is decided before it
 * is packed. `type` and `linkname` exist so the tests can build the archives
 * a hostile server would send.
 * @param {{ path: string, data?: Uint8Array, mode?: number, type?: string, linkname?: string }[]} entries
 */
export function pack(entries) {
  /** @type {Buffer[]} */
  const out = [];
  for (const { path, data = Buffer.alloc(0), mode = 0o644, type = '0', linkname = '' } of entries) {
    let name = path;
    if (Buffer.byteLength(path) > 100 || /[^\x20-\x7e]/.test(path)) {
      const records = Buffer.from(paxRecord('path', path), 'utf8');
      out.push(header({ name: 'PaxHeader', size: records.length, mode: 0o644, type: 'x' }), records, pad(records.length));
      name = path.replace(/[^\x20-\x7e]/g, '_').slice(-100);
    }
    out.push(header({ name, size: data.length, mode, type, linkname }), Buffer.from(data), pad(data.length));
  }
  out.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(out);
}

/** A NUL-terminated field, as UTF-8. @param {Buffer} b */
const cstr = (b) => {
  const end = b.indexOf(0);
  return b.subarray(0, end === -1 ? b.length : end).toString('utf8');
};

/** An octal field, or a base-256 one (the high bit set), as tar writes sizes over 8 GB. @param {Buffer} b */
function number(b) {
  if (b[0] & 0x80) {
    let n = BigInt(b[0] & 0x7f);
    for (const byte of b.subarray(1)) n = (n << 8n) | BigInt(byte);
    return Number(n);
  }
  const text = b.toString('latin1').replace(/[\0 ]+$/g, '').replace(/^[\0 ]+/, '');
  if (text === '') return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error('the archive from the server is malformed (a number field is not octal)');
  return parseInt(text, 8);
}

/** @param {Buffer} data */
function paxRecords(data) {
  /** @type {Record<string, string>} */
  const out = {};
  let at = 0;
  while (at < data.length) {
    const space = data.indexOf(0x20, at);
    if (space === -1) break;
    const len = parseInt(data.subarray(at, space).toString('latin1'), 10);
    if (!Number.isInteger(len) || len <= 0 || at + len > data.length) throw new Error('the archive from the server is malformed (a PAX record)');
    const record = data.subarray(space + 1, at + len - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    at += len;
  }
  return out;
}

/**
 * The entries of a tar, as they are: path, type, mode, bytes. A PAX `x`
 * header's `path` and `size` apply to the entry after it, a GNU `L` header's
 * long name likewise, and a ustar `prefix` is joined to the name. A global
 * PAX header (`g`, which `git archive` writes with the commit id) says
 * nothing about any one file and is passed over. Nothing about the paths is
 * judged here; write.mjs does that.
 * @param {Buffer} buf an uncompressed tar
 * @returns {{ path: string, type: string, mode: number, data: Buffer, linkname: string }[]}
 */
export function unpack(buf) {
  const out = [];
  /** @type {Record<string, string> | null} */
  let pax = null;
  /** @type {string | null} */
  let longName = null;
  let at = 0;
  while (at + BLOCK <= buf.length) {
    const h = buf.subarray(at, at + BLOCK);
    if (h.every((b) => b === 0)) break;
    // Unsigned, as POSIX says; some old writers summed signed bytes, and both are accepted.
    let sum = 0;
    let signed = 0;
    for (let i = 0; i < BLOCK; i++) {
      const b = i >= 148 && i < 156 ? 0x20 : h[i];
      sum += b;
      signed += b > 127 ? b - 256 : b;
    }
    const stated = number(h.subarray(148, 156));
    if (stated !== sum && stated !== signed) throw new Error('the archive from the server is malformed (a header checksum)');
    const type = h[156] === 0 ? '0' : String.fromCharCode(h[156]);
    const meta = type === 'x' || type === 'g' || type === 'L' || type === 'K';
    const size = !meta && pax?.size !== undefined ? Number(pax.size) : number(h.subarray(124, 136));
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('the archive from the server is malformed (a size)');
    const start = at + BLOCK;
    if (start + size > buf.length) throw new Error('the archive from the server is cut short');
    const data = buf.subarray(start, start + size);
    at = start + Math.ceil(size / BLOCK) * BLOCK;
    if (type === 'x') {
      pax = { ...(pax ?? {}), ...paxRecords(data) };
      continue;
    }
    if (type === 'g' || type === 'K') continue;
    if (type === 'L') {
      longName = cstr(data);
      continue;
    }
    let path = cstr(h.subarray(0, 100));
    if (h.subarray(257, 262).toString('latin1') === 'ustar') {
      const prefix = cstr(h.subarray(345, 500));
      if (prefix) path = `${prefix}/${path}`;
    }
    if (longName !== null) path = longName;
    if (pax?.path !== undefined) path = pax.path;
    const linkname = pax?.linkpath ?? cstr(h.subarray(157, 257));
    out.push({ path, type, mode: number(h.subarray(100, 108)), data, linkname });
    pax = null;
    longName = null;
  }
  return out;
}
