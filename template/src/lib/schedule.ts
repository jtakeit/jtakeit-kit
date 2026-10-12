/**
 * Whether an entry is out yet, and still out — the platform's scheduled
 * publishing, read the way the platform reads it.
 *
 * ── the platform's rule, repeated for `astro dev` ───────────────────────────
 *
 * An entry's file may carry `"show_at"` (hidden until then) and `"hide_at"`
 * (hidden from then on), both RFC 3339 in UTC — `"2026-10-20T07:00:00Z"`. In a
 * build the platform makes, it rewrites such an entry to `visible: false` in
 * the checkout before Astro runs, so a built site needs nothing from here and
 * the listing, the feed and the sitemap leave it out as they leave out any
 * unfinished entry.
 *
 * `astro dev` reads the files as they are, and showed next week's post on the
 * listing today. So the entry loader asks this too, with the clock at the
 * moment it loads: the same two fields, the same answer, and `visible: false`
 * still hides an entry whatever its dates say.
 *
 * A value that is not a time is no schedule. The platform refuses one where it
 * is written; a file edited by hand that says `"next week"` is shown, rather
 * than hidden for a reason nobody can see.
 *
 * The kit asks the same question for `_meta.json`'s drafts and the content its
 * check reads (`@jtakeit/kit`'s lib/schedule.mjs). A copy, not an import: this
 * scaffold is built against the published kit, which may not have that file
 * yet. `test/schedule.test.mjs` holds the two to one answer, case for case.
 *
 * Imports nothing, so Node tests it on its own.
 */

/** What this reads of an entry's file. */
export interface Scheduled {
  visible?: boolean;
  show_at?: unknown;
  hide_at?: unknown;
}

/** Whether the site lists the entry at `now` (milliseconds since the epoch). */
export function shownAt(document: Scheduled, now: number): boolean {
  if (document.visible === false) return false;
  const show = instant(document.show_at);
  if (show !== undefined && now < show) return false;
  const hide = instant(document.hide_at);
  if (hide !== undefined && now >= hide) return false;
  return true;
}

/** A time written down, or `undefined` for none and for one that is not a time. */
function instant(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : at;
}
