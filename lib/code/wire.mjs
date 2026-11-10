/**
 * The wire of `jtk push` and `jtk pull`, version 1 (wiki/88 · §10).
 *
 * A tool hands the shell a URL for one operation, `<api>/v1/code#t=<token>`.
 * The token is in the fragment because no HTTP client sends a fragment: in
 * the path or the query it would be written to the tunnel's logs,
 * Cloudflare's and the API's own. So the kit takes the fragment off before
 * the URL goes anywhere, sends the token only as `Authorization: Bearer`, and
 * never prints the URL it was given — only its origin.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')).version;

/** Hosts a token may travel to over plain HTTP: this machine, as `encore run` and the tests serve it. */
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A refusal from the server: `{"code": "JTK_E_…", "message": "…", "paths": […]}` and its status. */
export class ServerError extends Error {
  /** @param {number} status @param {string} code @param {string} message @param {string[]} paths */
  constructor(status, code, message, paths = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.paths = paths;
  }
}

/**
 * The URL a tool gave, taken apart: where to send, what to send it with, and
 * the API's origin (recorded in `.jtakeit/code.json`). The error messages
 * never repeat the URL, since it carries the token.
 * @param {string | undefined} text
 */
export function parseCodeUrl(text) {
  if (!text) throw new Error('give the URL push_code or pull_code returned, in quotes');
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error('that is not a URL — give the one push_code or pull_code returned, in quotes');
  }
  const token = new URLSearchParams(url.hash.slice(1)).get('t');
  if (!token) throw new Error('the URL carries no token (#t=…) — the shell may have cut it at the "#"; quote the URL, or ask for a new one');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL.has(url.hostname))) {
    throw new Error(`the URL is ${url.protocol}//${url.host}; a token travels over https only (plain http to this machine alone)`);
  }
  // Nothing but the path is kept: the fragment is the token, and a query has
  // no place in this URL — were the token put there by mistake, it would be
  // in the request line.
  url.hash = '';
  url.search = '';
  url.username = '';
  url.password = '';
  return { endpoint: url.href.replace(/\/+$/, ''), token, api: url.origin };
}

/**
 * The requests of one operation, each carrying the token as a bearer. Calls
 * resolve to the parsed JSON (`'json'`), the raw bytes (`'bytes'`) or nothing
 * (`'none'`), and reject with a ServerError for any answer that is not 2xx.
 * @param {{ endpoint: string, token: string }} target
 * @param {{ fetch?: typeof fetch }} [options]
 */
export function client({ endpoint, token }, { fetch: send = fetch } = {}) {
  const origin = new URL(endpoint).origin;
  /**
   * @param {'GET' | 'POST' | 'PUT'} method
   * @param {string} path below the endpoint, e.g. `/manifest`
   * @param {unknown} [body] JSON, or bytes for a part
   * @param {'json' | 'bytes' | 'none'} [want]
   */
  async function call(method, path, body, want = 'json') {
    /** @type {Record<string, string>} */
    const headers = { authorization: `Bearer ${token}`, 'user-agent': `@jtakeit/astro/${VERSION}` };
    /** @type {BodyInit | undefined} */
    let payload;
    if (body instanceof Uint8Array) {
      headers['content-type'] = 'application/octet-stream';
      payload = body;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res;
    try {
      // No redirects: a bearer token is not something to follow anywhere.
      res = await send(endpoint + path, { method, headers, body: payload, redirect: 'error' });
    } catch (why) {
      const cause = /** @type {{ cause?: { code?: string } }} */ (why).cause?.code;
      throw new Error(`could not reach ${origin}${cause ? ` (${cause})` : ''}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let answer;
      try {
        answer = JSON.parse(text);
      } catch {
        answer = null;
      }
      if (answer && typeof answer.code === 'string') {
        throw new ServerError(res.status, answer.code, String(answer.message ?? ''), Array.isArray(answer.paths) ? answer.paths.map(String) : []);
      }
      throw new ServerError(res.status, `HTTP ${res.status}`, text.trim().slice(0, 300) || res.statusText);
    }
    if (want === 'none') {
      await res.arrayBuffer().catch(() => null);
      return undefined;
    }
    if (want === 'bytes') return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${origin} answered ${method} ${path} with something that is not JSON`);
    }
  }
  return { call, origin };
}
