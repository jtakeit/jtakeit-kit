/**
 * The diary on the dev server — so a booking form can be walked on localhost.
 *
 * On the platform `/api/availability`, `/api/book` and the rest are the edge's;
 * on `astro dev` there was nothing there, and every booking form on localhost
 * said nothing at all: no times, no button that did anything (Schorem, 15
 * October 2026). A developer judging a page by walking it could not walk the
 * one thing the page is for.
 *
 * This answers the same requests, in the same shape, from the site's own files:
 * the hours, the zone, the slot length, the lead, the horizon, the largest
 * party and the days off in the diary's settings (`jtk/modules/bookings.json`;
 * `jtk/bookings.json` on contract 2), the services and the people in the
 * entries of the collections the schema names for the bookings module. A
 * booking is kept in memory until the server stops — so the time it took is
 * taken — and nothing ever leaves the machine.
 *
 * The rules are the platform's diary's (`slots.Free` in the core), read the
 * same way:
 *
 *   - a resource's own `hours` narrow the business's, clipped to them; none is
 *     the business's whole week;
 *   - a resource with `spots` is a class: it starts when its row opens, once,
 *     and takes bookings until its places are gone, a party taking as many
 *     places as it has people; one without is booked whole, on a grid every
 *     `slot_every` minutes;
 *   - a day in `closed` shuts the whole business, or the one resource `who`
 *     names, from local midnight to local midnight;
 *   - a row that closes before it opens runs past midnight.
 *
 * A studio of classes came out of here offering every class every fifteen
 * minutes of the business's day, and full after one place was booked (18
 * November 2026). It is still not the platform's diary: no buffers between
 * visits, no rates by the hour of the week, no letting by the day. Close
 * enough to walk; `preflight` with `try_booking` is still the test of the
 * real one.
 *
 *   import { devDiary } from '@jtakeit/kit/devdiary';
 *   server.middlewares.use('/api', devDiary(process.cwd()));
 */
import { content } from './content/index.mjs';
import { readJtk } from './content/node.mjs';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MINUTE = 60000;

/** Minutes a zone is ahead of UTC on a given day, from the platform's own Intl. */
function offsetOf(zone, at) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((local - at.getTime()) / MINUTE);
  } catch {
    return 0;
  }
}

/** The instant a local day begins in the zone: y, m (from 0), d may overflow. */
function midnightOf(zone, y, m, d) {
  const day = Date.UTC(y, m, d);
  return day - offsetOf(zone, new Date(day + 12 * 60 * MINUTE)) * MINUTE;
}

/** Minutes after midnight, from a number or `HH:MM`; NaN for neither. */
function minutesOf(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const clock = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  return clock ? Number(clock[1]) * 60 + Number(clock[2]) : value.trim() === '' ? NaN : Number(value);
}

/**
 * Rows of a week — `{ day, opens, closes }` — as stretches of minutes after
 * the day's midnight. A row closing before it opens runs past midnight; a
 * half-typed row is skipped, as the platform skips it (`Openings`).
 */
export function openings(rows) {
  const out = [];
  for (const row of rows) {
    const from = minutesOf(row.opens);
    let until = minutesOf(row.closes);
    if (!DAYS.includes(row.day) || !Number.isFinite(from) || !Number.isFinite(until) || from === until) continue;
    if (until < from) until += 24 * 60;
    out.push({ day: row.day, from, until });
  }
  return out;
}

/** A resource's own hours clipped to the business's, or the business's when it keeps none (`slots.HoursOf`). */
function hoursOf(own, door) {
  if (own.length === 0) return door;
  const out = [];
  for (const mine of own) {
    for (const open of door) {
      if (open.day !== mine.day) continue;
      const from = Math.max(mine.from, open.from);
      const until = Math.min(mine.until, open.until);
      if (until > from) out.push({ day: mine.day, from, until });
    }
  }
  return out;
}

/**
 * What the site's files say, read fresh on every request so an edit shows at
 * once — through the door, as the booking form on the page reads them.
 *
 * The services and the people are the entries the site lists in its own
 * language, as the platform's diary takes them: a German copy of a service
 * is the same service, and one nobody shows is no choice. What a service
 * costs is the door's `minor('costs')`, in either contract — a number on
 * contract 2, `{ minor }` on contract 3, which was read as no price at all
 * here (12 November 2026). What a person does is read as the scaffold's form
 * reads it: on contract 3 one reference to many services by id, resolved by
 * the door (`refs`); on contract 2 the rows `[{ service }]` the kit and the
 * panel write — it used to be taken for a list of slugs here, so with the
 * rows the kit lays out nobody could do anything (wiki/98 §13). None, as on
 * the form, is everything.
 *
 * A person — a master, a table, a class — may keep their own week (`hours`),
 * places (`spots`, a class's) and seats (`seats`, a table's).
 */
async function read(root) {
  const site = content(await readJtk(root));
  const roles = site.rolesOf('bookings') ?? {};
  const settings = site.module('bookings');
  const services = site.entries(roles.services ?? 'services').map((e) => ({
    slug: e.slug,
    takes: Number(e.fields.value('takes')) || 0,
    costs: e.fields.minor('costs') ?? 0,
    per: e.fields.value('per') === 'person' ? 'person' : 'booking',
    title: e.fields.value('title') ?? e.slug,
  }));
  const people = site.entries(roles.resources ?? 'masters').map((e) => {
    const does = (site.contract === 3 ? e.fields.refs('does').map((one) => one.baseSlug) : e.fields.rows('does').map((row) => row.value('service')))
      .filter((slug) => typeof slug === 'string' && slug !== '');
    const own = openings(e.fields.rows('hours').map((row) => ({ day: row.value('day'), opens: row.value('opens'), closes: row.value('closes') })));
    return {
      slug: e.slug,
      names: [e.slug, e.baseSlug, e.id].filter((one) => typeof one === 'string' && one !== ''),
      does: does.length > 0 ? does : null,
      own,
      spots: Number(e.fields.value('spots')) || 0,
      seats: Number(e.fields.value('seats')) || 0,
    };
  });
  // Where the settings are, for a diary nobody has set up yet.
  const file = site.contract === 3 ? 'jtk/modules/bookings.json' : 'jtk/bookings.json';
  return { settings, services, people, currency: site.currency, file };
}

/**
 * A JSON answer, never cached — the diary's and the shop's stand-in's alike
 * (devshop.mjs shares it rather than copying it).
 */
export const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Jtk-Dev-Diary', '1');
  res.end(JSON.stringify(body));
};

/**
 * The request's body as JSON, `{}` for one that is none — shared with
 * devshop.mjs. `strict` is the shop's: the body must parse to a JSON object
 * (as the edge's `objectOf` holds a shop page's body to), and anything else —
 * text that is not JSON, a form, nothing at all, `null`, a list — is `undefined`
 * for the caller to refuse. The diary's own calls are not strict.
 *
 * @param {any} req
 * @param {{ strict?: boolean }} [options]
 * @returns {Promise<any>}
 */
export const bodyOf = (req, { strict = false } = {}) =>
  new Promise((done) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (strict) {
        try {
          const body = JSON.parse(raw);
          done(body !== null && typeof body === 'object' && !Array.isArray(body) ? body : undefined);
        } catch {
          done(undefined);
        }
        return;
      }
      try {
        done(JSON.parse(raw || '{}'));
      } catch {
        done({});
      }
    });
  });

/** The days off as stretches of instants, each for everybody or for the one `who` names. */
function closures(settings, zone) {
  const out = [];
  for (const row of Array.isArray(settings.closed) ? settings.closed : []) {
    const from = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(row?.from ?? ''));
    const until = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(row?.until ?? ''));
    if (!from || !until || row.until < row.from) continue;
    out.push({
      who: typeof row.who === 'string' ? row.who.trim() : '',
      from: midnightOf(zone, Number(from[1]), Number(from[2]) - 1, Number(from[3])),
      until: midnightOf(zone, Number(until[1]), Number(until[2]) - 1, Number(until[3]) + 1),
    });
  }
  return out;
}

/** A party size, one when absent; undefined for one the site does not take (`partyOf`). */
function partyOf(raw, most) {
  if (raw === undefined || raw === null || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n > 1 && n > most ? undefined : n;
}

/** The largest party any of these could ever take — zero where one takes any (`SeatsOf`). */
function seatsOf(people) {
  let most = 0;
  for (const one of people) {
    const holds = [one.seats, one.spots].filter((n) => n > 0);
    if (holds.length === 0) return 0;
    most = Math.max(most, Math.min(...holds));
  }
  return most;
}

/** @param {string} root the site's directory */
export function devDiary(root) {
  /** @type {{ id: string, who: string, start: number, ends: number, party: number }[]} */
  let booked = [];
  let made = 0;

  /**
   * Whether `person` can take `party` from `start` to `ends`: not off that
   * day, a table they fit at, and — a class — places enough, or — anybody
   * else — nobody already booked across it.
   */
  const room = (person, start, ends, party, shut) => {
    if (shut.some((one) => (one.who === '' || person.names.includes(one.who)) && one.from < ends && start < one.until)) return false;
    if (person.seats > 0 && person.seats < party) return false;
    const across = booked.filter((one) => one.who === person.slug && one.start < ends && start < one.ends);
    if (person.spots > 0) return across.reduce((sum, one) => sum + one.party, 0) + party <= person.spots;
    return across.length === 0;
  };

  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '') || '/';

    if (path === '/turnstile') return send(res, 200, { sitekey: '' });

    if (path === '/lead' && req.method === 'POST') {
      const body = await bodyOf(req);
      console.log(`[dev diary] an enquiry, kept on this machine: ${JSON.stringify(body).slice(0, 200)}`);
      return send(res, 200, { ok: true, dev: true });
    }

    if (path === '/availability') {
      const { settings, services, people, currency, file } = await read(root);
      const door = openings(Array.isArray(settings.hours) ? settings.hours : []);
      if (!settings.zone || door.length === 0) {
        return send(res, 412, {
          code: 'failed_precondition',
          message: !settings.zone ? 'nobody has said which timezone this business keeps' : 'nobody has said when this business is open',
          details: { code: 'JTK_E_DIARY_NOT_READY', means: `${file} needs \`zone\` and \`hours\`.` },
        });
      }
      const partyMax = Number(settings.party) || 0;
      const party = partyOf(url.searchParams.get('party'), partyMax);
      if (party === undefined) return send(res, 400, { code: 'invalid_argument', message: 'that party size cannot be booked here', dev: true });
      const asked = (url.searchParams.get('service') ?? '').split(',').concat(url.searchParams.getAll('services')).filter(Boolean);
      const chosen = services.filter((s) => asked.includes(s.slug));
      const takes = (chosen.reduce((sum, s) => sum + s.takes, 0) || Number(settings.slot_every) || 30) * MINUTE;
      const costs = chosen.reduce((sum, s) => sum + s.costs * (s.per === 'person' ? party : 1), 0);
      const every = (Number(settings.slot_every) || 15) * MINUTE;
      const zone = settings.zone;
      const now = Date.now();
      // The window, clamped as the platform clamps it: nothing sooner than
      // the lead, nothing further out than the horizon.
      const from = Math.max(new Date(url.searchParams.get('from') ?? now).getTime(), now + (Number(settings.lead) || 0) * MINUTE);
      let to = new Date(url.searchParams.get('to') ?? now + 86400000).getTime();
      if (Number(settings.horizon) > 0) to = Math.min(to, now + Number(settings.horizon) * 86400000);
      const resource = url.searchParams.get('resource') ?? '';
      const able = people.filter((p) => (!resource || p.slug === resource) && (!p.does || chosen.every((s) => p.does.includes(s.slug))));
      const shut = closures(settings, zone);
      const nobody = { slug: '', names: [], own: [], spots: 0, seats: 0 };
      /** start → slugs free then, in the order the people are listed */
      const at = new Map();
      // Walk the days in the business's own zone, from the local day before
      // the window: a row that runs past midnight offers the next morning.
      const shifted = new Date(from + offsetOf(zone, new Date(from)) * MINUTE);
      const [y, m, d] = [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
      for (let i = -1; from < to; i++) {
        const midnight = midnightOf(zone, y, m, d + i);
        if (midnight >= to) break;
        const weekday = DAYS[new Date(Date.UTC(y, m, d + i)).getUTCDay()];
        for (const person of people.length > 0 ? able : [nobody]) {
          for (const open of hoursOf(person.own, door)) {
            if (open.day !== weekday) continue;
            const opens = midnight + open.from * MINUTE;
            const closes = midnight + open.until * MINUTE;
            // A class starts when it starts; anything else on a grid.
            const step = person.spots > 0 ? closes - opens + MINUTE : every;
            for (let start = opens; start + takes <= closes; start += step) {
              if (start < from || start >= to) continue;
              if (!room(person, start, start + takes, party, shut)) continue;
              const free = at.get(start) ?? [];
              if (!free.includes(person.slug)) at.set(start, [...free, person.slug]);
            }
          }
        }
      }
      const slots = [...at.entries()]
        .sort(([a], [b]) => a - b)
        .map(([start, free]) => ({ start: new Date(start).toISOString(), ends: new Date(start + takes).toISOString(), free: free.filter(Boolean), costs_minor: costs }));
      return send(res, 200, {
        zone,
        slots,
        party_max: partyMax,
        party_seats: seatsOf(able),
        quantity_max: 1,
        scale: settings.scale ?? 'hourly',
        currency,
        services: services.map((s) => ({ slug: s.slug, scale: settings.scale ?? 'hourly', takes: s.takes, per: s.per, fewest: 1, most: 1 })),
        dev: true,
      });
    }

    if (path === '/book' && req.method === 'POST') {
      const body = await bodyOf(req);
      const { people, services, settings, currency } = await read(root);
      const at = body.start ? new Date(body.start).getTime() : NaN;
      if (!Number.isFinite(at)) return send(res, 400, { code: 'invalid_argument', message: 'a booking needs a start' });
      const party = partyOf(body.party, Number(settings.party) || 0);
      if (party === undefined) return send(res, 400, { code: 'invalid_argument', message: 'that party size cannot be booked here', dev: true });
      const names = [body.service, ...(Array.isArray(body.services) ? body.services : [])].filter(Boolean);
      const takes = services.filter((s) => names.includes(s.slug)).reduce((sum, s) => sum + s.takes, 0) || Number(settings.slot_every) || 30;
      const ends = at + takes * MINUTE;
      const shut = settings.zone ? closures(settings, settings.zone) : [];
      const able = people.filter((p) => (!body.resource || p.slug === body.resource) && (!p.does || names.every((n) => p.does.includes(n))));
      const who = able.find((p) => room(p, at, ends, party, shut));
      // Taken while the page sat open, or a class full: refused, as the
      // platform refuses it, rather than booked twice.
      if (people.length > 0 && who === undefined) return send(res, 409, { code: 'aborted', message: 'that time is no longer free', dev: true });
      made += 1;
      const id = `dev-${made}`;
      booked.push({ id, who: who?.slug ?? '', start: at, ends, party });
      const start = new Date(at).toISOString();
      console.log(`[dev diary] booked ${names.join('+') || 'something'} at ${start}${who ? ` with ${who.slug}` : ''}${party > 1 ? ` for ${party}` : ''} for ${body.name ?? 'somebody'} — on this machine only, nothing reached the platform`);
      // The answer the form draws its last screen from: when, until when, with
      // whom — without `start` and `ends` it cannot say the time, and says
      // the booking failed instead.
      return send(res, 200, { id, state: 'confirmed', start, ends: new Date(ends).toISOString(), amount_minor: 0, currency, token: id, manage_path: '', telegram_url: '', resource: who?.slug ?? '', dev: true });
    }

    if (path === '/booking/cancel' && req.method === 'POST') {
      const body = await bodyOf(req);
      booked = booked.filter((one) => one.id !== body.token && one.id !== body.id);
      return send(res, 200, { ok: true, dev: true });
    }

    return next();
  };
}
