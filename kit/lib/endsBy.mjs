/**
 * A collection whose entries go by their own date — contract 3's `ends_by`
 * (the owner, 16 November 2026, on KAIF's nights), read the way the
 * platform reads it (`registry.EndsBy`, backend/api/registry/endsBy.go).
 *
 *   "ends_by": {"date": "date", "time": "starts", "after": 480, "zone": "Europe/Zurich", "then": "keep"}
 *
 * `date` names a `date` field of the entry type, `time` a `time_of_day`
 * field (minutes from midnight) or nothing for the start of the day, `after`
 * the minutes after that moment the entry goes — none by default where there
 * is a time, the whole day (1440) where there is not — and `zone` the IANA
 * zone the date and the time are on the clock of, and `then` what becomes of
 * an entry that is over: `keep` (the default) leaves it on the site for the
 * template to place — the next night first, the past ones as an archive —
 * and `hide` takes it off.
 *
 * WHEN an entry is over is the platform's: it works the moment out from the
 * date whenever the entry is written (the panel, an import, a copy, a CSV),
 * keeps it on the document as `ends_at` — never in the jtk/ files — says
 * «over» in the panel and rebuilds the site at it. WHAT then happens is the
 * site's: on `then: "hide"` the moment is the entry's `hide_at` as well; on
 * `keep` the door hands the template `ended` and `endsAt`, so it never
 * compares a date with today itself (the owner, 16 November 2026). The door
 * works the same moment out from the date, on the dev server and in every
 * build.
 *
 * Imports nothing: the judge, the door and the dev server all read it.
 */

/** `endsAfterMax`: the longest an entry may stay after its moment, a week. */
export const ENDS_AFTER_MAX = 7 * 24 * 60;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The clock of each zone, made once: `Intl.DateTimeFormat` is slow to build. */
const clocks = new Map();
function clockOf(zone) {
  if (clocks.has(zone)) return clocks.get(zone);
  let clock = null;
  try {
    clock = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      era: 'short',
    });
  } catch {
    clock = null;
  }
  clocks.set(zone, clock);
  return clock;
}

/**
 * Whether a zone is one the platform loads (`time.LoadLocation`): an IANA
 * name — `Europe/Zurich`, `UTC` — spelt in its own case. Not `Local`, which
 * is whatever machine reads it, and not an offset (`+01:00`), which is no
 * zone's name.
 * @param {unknown} zone
 */
export function isZone(zone) {
  if (typeof zone !== 'string' || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(zone) || zone === 'Local') return false;
  const clock = clockOf(zone);
  if (clock === null) return false;
  // Intl reads a name in any case; the platform's zone files do not. A name
  // that is the canonical one in another case is refused; an alias
  // (`Europe/Kiev`) is taken as written.
  const named = clock.resolvedOptions().timeZone;
  return named.toLowerCase() !== zone.toLowerCase() || named === zone;
}

/** The offset of a zone's clock from UTC at an instant, in milliseconds. */
function offsetAt(clock, instant) {
  const parts = {};
  for (const part of clock.formatToParts(new Date(instant))) parts[part.type] = part.value;
  let year = Number(parts.year);
  if (parts.era === 'BC' || parts.era === 'B') year = 1 - year;
  const asUtc = new Date(0);
  asUtc.setUTCFullYear(year, Number(parts.month) - 1, Number(parts.day));
  asUtc.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
  return asUtc.getTime() - (instant - (((instant % 1000) + 1000) % 1000));
}

/**
 * A wall-clock time in a zone, as an instant — Go's `time.Date`: the offset
 * at the wall time read as UTC, and where the instant that gives is under
 * another offset (a change of the clocks between), that one.
 */
function instantOf(clock, wall) {
  const first = offsetAt(clock, wall);
  return wall - offsetAt(clock, wall - first);
}

/** `time.ParseInLocation("2006-01-02", …)`: the day, or nothing. */
function dayOf(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return undefined;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > days) return undefined;
  return { year, month, day };
}

/**
 * A collection's `ends_by` as the door reads it, or `undefined` where it
 * says none or one nothing could go by (no date, no zone). The judge says
 * what is wrong with one; the door reads rather than judges.
 * @param {unknown} raw
 * @returns {{ date: string; time?: string; after?: number; zone: string; then: 'keep' | 'hide' } | undefined}
 */
export function endsByOf(raw) {
  if (!isObject(raw)) return undefined;
  const { date, time, after, zone } = /** @type {any} */ (raw);
  if (typeof date !== 'string' || date === '' || typeof zone !== 'string' || zone === '') return undefined;
  const out = { date, zone };
  if (typeof time === 'string' && time !== '') out.time = time;
  if (typeof after === 'number' && Number.isInteger(after)) out.after = after;
  // What becomes of an entry that is over: kept, unless the collection says
  // hide. A word that is neither the judge refuses; the door keeps.
  out.then = /** @type {any} */ (raw).then === 'hide' ? 'hide' : 'keep';
  return out;
}

/**
 * The minutes after the moment, with its default: none with a time, the
 * whole day without one.
 * @param {{ time?: string; after?: number }} ends
 */
export function afterOf(ends) {
  if (typeof ends.after === 'number') return ends.after;
  return typeof ends.time === 'string' && ends.time !== '' ? 0 : 24 * 60;
}

/**
 * The moment an entry with these values goes, in milliseconds since the
 * epoch (`EndsAt`): its date at its time — or at the start of the day — on
 * the zone's clock, and `after` minutes. `undefined` where its date is not
 * set, or is not a date, or the zone is none: such an entry stays.
 *
 * @param {{ date: string; time?: string; after?: number; zone: string } | undefined} ends
 * @param {Record<string, unknown> | null | undefined} values the entry's own values (`fields`)
 * @returns {number | undefined}
 */
export function endsAt(ends, values) {
  if (ends === undefined || !isObject(values)) return undefined;
  const held = values[ends.date];
  if (typeof held !== 'string' || held === '') return undefined;
  if (!isZone(ends.zone)) return undefined;
  const day = dayOf(held);
  if (day === undefined) return undefined;
  let minutes = 0;
  if (typeof ends.time === 'string' && ends.time !== '') {
    const at = values[ends.time];
    if (typeof at === 'number' && Number.isInteger(at) && at >= 0 && at < 24 * 60) minutes = at;
  }
  const wall = new Date(0);
  wall.setUTCFullYear(day.year, day.month - 1, day.day);
  wall.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return instantOf(clockOf(ends.zone), wall.getTime()) + afterOf(ends) * 60_000;
}

/**
 * The moment as the platform writes it — the document's `ends_at`, and its
 * `hide_at` on `then: "hide"` — RFC 3339 in UTC, or `undefined` for none.
 * @param {{ date: string; time?: string; after?: number; zone: string } | undefined} ends
 * @param {Record<string, unknown> | null | undefined} values
 */
export function hideAtOf(ends, values) {
  const at = endsAt(ends, values);
  return at === undefined ? undefined : new Date(at).toISOString().replace('.000Z', 'Z');
}
