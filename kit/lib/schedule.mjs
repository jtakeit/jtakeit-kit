/**
 * Whether an entry is out yet, and still out — the platform's scheduled
 * publishing, read the way the platform reads it.
 *
 * An entry's file may carry `"show_at"` (hidden until then) and `"hide_at"`
 * (hidden from then on), both RFC 3339 in UTC. A build the platform makes
 * rewrites such an entry to `visible: false` in its checkout before the
 * generator runs, so on the platform this changes nothing. On a laptop the
 * files are read as they are, and every reader here that asks `visible` — the
 * drafts in `_meta.json` (meta.mjs), the content the check reads (content.mjs,
 * and so lint.mjs) — asks this instead, so a post scheduled for next week is a
 * draft and not a listing's missing row.
 *
 * `visible: false` hides an entry whatever its dates say. A value that is not
 * a time is no schedule: the platform refuses one where it is written, and a
 * file edited by hand that says `"next week"` is shown rather than hidden for
 * a reason nobody can see.
 *
 * The scaffold's entry loader asks the same question in
 * `template/src/lib/schedule.ts` — a copy, not an import: a scaffold is built
 * against the published kit, which may not have this file yet. The two are
 * held to one answer by `test/schedule.test.mjs` at the repository's root.
 */

/**
 * Whether the site lists the entry at `now` (milliseconds since the epoch).
 * @param {{ visible?: boolean; show_at?: unknown; hide_at?: unknown } | null | undefined} document
 * @param {number} [now]
 * @returns {boolean}
 */
export function shownAt(document, now = Date.now()) {
  if (document == null) return true;
  if (document.visible === false) return false;
  const show = instant(document.show_at);
  if (show !== undefined && now < show) return false;
  const hide = instant(document.hide_at);
  if (hide !== undefined && now >= hide) return false;
  return true;
}

/** A time written down, or `undefined` for none and for one that is not a time. */
function instant(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : at;
}
