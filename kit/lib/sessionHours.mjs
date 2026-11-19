/**
 * A resource's own hours outside the business's — `JTK_W_SESSION_OUTSIDE_HOURS`,
 * advice, never a refusal.
 *
 * The diary offers a resource — a class, a master, a table — only inside the
 * business's hours that day: its own week is clipped to them (the platform's
 * `slots.HoursOf`, the dev diary's `hoursOf`). An evening class on Tuesdays
 * 18:00–19:15 at a studio open 09:00–18:00 has no time at all, and nothing
 * said it: the schema was valid, the settings were valid, and the form
 * answered «nothing free» (a staging site, 19 November 2026). The platform's
 * judge says the same, in the same words.
 */
import { content } from './content/index.mjs';
import { openings } from './devdiary.mjs';
import { W } from './codes.mjs';

/** 1080 → «18:00»; past midnight, the clock's. @param {number} minutes */
const clock = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Each row of a resource's own week that runs outside the business's hours on
 * its day, said once per row.
 *
 * @param {Record<string, unknown>} files  the working tree's jtk/, as `readJtk` hands it, the schema among them
 * @returns {{ code: string, path: string, says: string }[]}
 */
export function sessionsOutsideHours(files) {
  let site;
  try {
    site = content(files);
  } catch {
    return [];
  }
  const roles = site.rolesOf('bookings');
  if (!roles) return [];
  const settings = site.module('bookings') ?? {};
  // No hours yet is a diary not set up: the still-to-do list says that.
  const door = openings(Array.isArray(settings.hours) ? settings.hours : []);
  if (door.length === 0) return [];
  const collection = roles.resources ?? 'masters';
  const where = site.contract === 3 ? (slug) => `jtk/entries/${collection}/${slug}.json` : (slug) => `jtk/content/${collection}/${slug}.json`;
  const out = [];
  for (const entry of site.entries(collection)) {
    const own = openings(entry.fields.rows('hours').map((row) => ({ day: row.value('day'), opens: row.value('opens'), closes: row.value('closes') })));
    for (const mine of own) {
      const same = door.filter((open) => open.day === mine.day).sort((a, b) => a.from - b.from);
      // What of the row no opening of its day covers.
      let at = mine.from;
      let outside = false;
      for (const open of same) {
        if (open.until <= at) continue;
        if (open.from >= mine.until) break;
        if (open.from > at) outside = true;
        at = Math.max(at, open.until);
        if (at >= mine.until) break;
      }
      if (at < mine.until) outside = true;
      if (!outside) continue;
      const hours = same.length === 0 ? 'closed' : same.map((open) => `${clock(open.from)}–${clock(open.until)}`).join(', ');
      out.push({
        code: W.SESSION_OUTSIDE_HOURS,
        path: where(entry.slug),
        says: `${collection}/${entry.slug}: ${mine.day} ${clock(mine.from)}–${clock(mine.until)} is outside the business's hours that day (${hours}) — the diary offers only the part inside them; widen the hours in jtk/modules/bookings.json or move the row`,
      });
    }
  }
  return out;
}
