/**
 * `@jtakeit/kit/live` — a draft rendered live, the request's own door
 * (jtakeit-core wiki/89 §9–§12).
 *
 * A static build reads `jtk/` once: the door is made of the build's files and
 * every page is drawn from it. The panel's preview of a draft is drawn by the
 * same code under server output, per request, from the draft the platform
 * hands the renderer — so the one import every template reads, `site`, has to
 * be the request's door while a request with a draft renders, and the build's
 * at every other moment.
 *
 *   // src/lib/site.ts
 *   const annotate = import.meta.env.PUBLIC_JTK_ANNOTATE !== 'false';
 *   export const site = live(content(import.meta.glob(…), { annotate }), (files) => content(files, { annotate }));
 *
 *   // a middleware, under server output only
 *   export const onRequest = (context, next) => rendering(context.locals, next);
 *
 * A static build never has a draft: `site` answers exactly what the door it
 * wraps answers, and the pages are the same bytes (the scaffold's test holds
 * it). Nothing here reads a file or the network; the renderer hands the draft
 * over as `locals.jtkDraft`, a map of `jtk/` files in the shape the door
 * takes.
 *
 * Framework-free: an Astro middleware is a function of `locals` and `next`,
 * and nothing else of Astro's is asked.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * One store for the process, whatever copies of this module a bundler made:
 * the middleware and `site` must read the same one, or a page renders the
 * build's words while its middleware holds the draft.
 */
const KEY = Symbol.for('jtakeit.kit.live.drafts');
/** @type {AsyncLocalStorage<Draft>} */
const drafts = /** @type {any} */ (globalThis)[KEY] ?? (/** @type {any} */ (globalThis)[KEY] = new AsyncLocalStorage());

/**
 * @typedef {object} Draft
 * @property {Record<string, unknown>} files every file of the draft's `jtk/`, keyed `/jtk/…`
 * @property {Record<string, { width: number; height: number }>} media a picture's size, by its key, where the platform knows it
 * @property {Map<string, unknown>} memo what was made of this draft once (inDraft)
 */

/** The draft the request being rendered carries, or undefined: a build, or a request without one. */
export function draft() {
  return drafts.getStore();
}

/**
 * Something made of the draft once per request — the door, a language's copy
 * — or undefined where there is no draft, for the caller to use the build's.
 *
 * @template T
 * @param {string} key
 * @param {(now: Draft) => T} make
 * @returns {T | undefined}
 */
export function inDraft(key, make) {
  const now = drafts.getStore();
  if (now === undefined) return undefined;
  if (!now.memo.has(key)) now.memo.set(key, make(now));
  return /** @type {T} */ (now.memo.get(key));
}

/**
 * The door every template imports, as the request's: the build's door where
 * there is no draft, and one made of the draft's files — once a request —
 * where there is.
 *
 * @template {object} Door
 * @param {Door} built the door of the build's own files
 * @param {(files: Record<string, unknown>) => Door} doorOf the same door, of other files
 * @returns {Door}
 */
export function live(built, doorOf) {
  return new Proxy(built, {
    get(target, key) {
      const door = inDraft('door', (now) => doorOf(now.files)) ?? target;
      const value = Reflect.get(door, key, door);
      return typeof value === 'function' ? value.bind(door) : value;
    },
    has(target, key) {
      return Reflect.has(inDraft('door', (now) => doorOf(now.files)) ?? target, key);
    },
  });
}

/**
 * A request rendered inside its draft, where it carries one
 * (`locals.jtkDraft`); untouched where it does not.
 *
 * The whole body is read inside the draft: a page is streamed, and the last of
 * its components would otherwise render after the store has gone — from the
 * build's door, in the middle of the draft's page.
 *
 * @param {Record<string, unknown>} locals
 * @param {() => Promise<Response>} next
 * @returns {Promise<Response>}
 */
export async function rendering(locals, next) {
  const handed = /** @type {{ files?: unknown; media?: unknown } | undefined} */ (locals?.jtkDraft);
  if (handed === undefined || handed === null || typeof handed.files !== 'object' || handed.files === null) return next();
  /** @type {Draft} */
  const now = {
    files: /** @type {Record<string, unknown>} */ (handed.files),
    media: typeof handed.media === 'object' && handed.media !== null ? /** @type {any} */ (handed.media) : {},
    memo: new Map(),
  };
  return drafts.run(now, async () => {
    const answer = await next();
    const body = await answer.text();
    return new Response(body, { status: answer.status, statusText: answer.statusText, headers: answer.headers });
  });
}

/**
 * The address a picture the draft names is served from while no build has
 * fetched it: the platform's bucket (`media_base` of `jtk/site.json`), the
 * key after it. Undefined for a key that is not an upload, or a draft that
 * says no bucket.
 *
 * @param {string} key `media/<site>/<hash>.jpg`
 * @returns {string | undefined}
 */
export function fromBucket(key) {
  const now = drafts.getStore();
  if (now === undefined || !key.startsWith('media/')) return undefined;
  const site = now.files['/jtk/site.json'];
  const base = site !== null && typeof site === 'object' ? /** @type {{ media_base?: unknown }} */ (site).media_base : undefined;
  if (typeof base !== 'string' || base === '') return undefined;
  return `${base.endsWith('/') ? base : `${base}/`}${key}`;
}

/**
 * A picture's size where the platform said it with the draft, for a picture
 * no build has measured. Undefined where it did not.
 *
 * @param {string} key
 * @returns {{ width: number; height: number } | undefined}
 */
export function sizeOf(key) {
  const one = drafts.getStore()?.media?.[key];
  return one !== undefined && Number.isFinite(one.width) && Number.isFinite(one.height) && one.width > 0 && one.height > 0 ? one : undefined;
}
