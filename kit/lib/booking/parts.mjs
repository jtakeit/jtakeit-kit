/**
 * The arithmetic behind the form's look, kept pure so it can be tested
 * without a document: which part of the day an hour is, which parts a set
 * of times make, and a clock read on 24 hours.
 */

/** «09:15 AM» as «09:15»; «21:00» or anything else as it was. */
export function to24(text) {
  return String(text ?? '').replace(/\b(\d{1,2}):(\d{2})\s*([AP]M)\b/gi, (_, h, mm, half) => {
    let hour = Number(h);
    if (half.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (half.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${mm}`;
  });
}

/** The three parts of a day, in order. */
export const PARTS = Object.freeze(['morning', 'afternoon', 'evening']);

/**
 * Which part of the day an hour is in: before noon the morning, before four
 * the afternoon, the evening after.
 * @param {number} hour
 * @returns {'morning' | 'afternoon' | 'evening'}
 */
export function partOfHour(hour) {
  return hour < 12 ? 'morning' : hour < 16 ? 'afternoon' : 'evening';
}

/**
 * The part each of a day's times goes under — by its hour, except that a
 * part of one or two times joins the part next to it: «Evening 16:00–16:00»
 * is a tab nobody needs. Fewer than `least` times is small.
 *
 * @param {number[]} hours  the hour of each time, in order
 * @param {number} [least]  how many times make a part of their own
 * @returns {('morning' | 'afternoon' | 'evening')[]} a part per time
 */
export function partsOf(hours, least = 3) {
  const count = { morning: 0, afternoon: 0, evening: 0 };
  for (const hour of hours) count[partOfHour(hour)] += 1;
  const small = (part) => count[part] > 0 && count[part] < least;
  /** @type {Partial<Record<string, string>>} */
  const join = {};
  if (small('evening') && count.afternoon > 0) join.evening = 'afternoon';
  if (small('morning') && count.afternoon > 0) join.morning = 'afternoon';
  if (small('afternoon') && !join.evening && !join.morning) join.afternoon = count.morning >= count.evening ? 'morning' : 'evening';
  return hours.map((hour) => /** @type {'morning' | 'afternoon' | 'evening'} */ (join[partOfHour(hour)] ?? partOfHour(hour)));
}

/** A day's name in the catalogue's spelling, from a date: `monday`. */
export const DAY_NAMES = Object.freeze(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

/** `YYYY-MM-DD` of a date, in the browser's own day — never `toISOString`, which is UTC's. */
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The date `YYYY-MM-DD` names, at local midnight; null for anything else. */
export function parseDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
