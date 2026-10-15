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
 * the hours, the zone and the slot length in `jtk/bookings.json`, the services
 * and the people in `jtk/content` (the collections `jtk/catalogue.json` names
 * for the bookings module). A booking is kept in memory until the server
 * stops — so the time it took is taken — and nothing ever leaves the machine.
 * It is not the platform's diary: no buffers between visits, no resource's own
 * hours, no rates by the hour of the week. Close enough to walk; `preflight`
 * with `try_booking` is still the test of the real one.
 *
 *   import { devDiary } from '@jtakeit/kit/devdiary';
 *   server.middlewares.use('/api', devDiary(process.cwd()));
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function json(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Every content file under jtk/content, with its slug. */
async function entries(root) {
  const out = [];
  const walk = async (dir) => {
    let names = [];
    try {
      names = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const one of names) {
      const full = join(dir, one.name);
      if (one.isDirectory()) await walk(full);
      else if (one.name.endsWith('.json')) {
        const doc = await json(full);
        if (doc?.collection) out.push({ ...doc, slug: String(doc.path ?? one.name).split('/').filter(Boolean).pop()?.replace(/\.json$/, '') });
      }
    }
  };
  await walk(join(root, 'jtk', 'content'));
  return out;
}

/** Minutes a zone is ahead of UTC on a given day, from the platform's own Intl. */
function offsetOf(zone, at) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((local - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/** What the site's files say, read fresh on every request so an edit shows at once. */
async function read(root) {
  const catalogue = (await json(join(root, 'jtk', 'catalogue.json'))) ?? {};
  const roles = catalogue.modules?.bookings ?? {};
  const settings = (await json(join(root, 'jtk', 'bookings.json')))?.blocks?.[0] ?? {};
  const all = await entries(root);
  const servicesOf = all.filter((e) => e.collection === (roles.services ?? 'services'));
  const peopleOf = all.filter((e) => e.collection === (roles.resources ?? 'masters'));
  const services = servicesOf.map((e) => {
    const b = e.blocks?.[0] ?? {};
    return { slug: e.slug, takes: Number(b.takes) || 0, costs: Number(b.costs) || 0, title: b.title ?? e.slug };
  });
  const people = peopleOf.map((e) => ({ slug: e.slug, does: e.blocks?.[0]?.does ?? null }));
  return { settings, services, people };
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Jtk-Dev-Diary', '1');
  res.end(JSON.stringify(body));
};

const bodyOf = (req) =>
  new Promise((done) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        done(JSON.parse(raw || '{}'));
      } catch {
        done({});
      }
    });
  });

/** @param {string} root the site's directory */
export function devDiary(root) {
  /** start ISO → slugs of the people taken then */
  const taken = new Map();
  let made = 0;

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
      const { settings, services, people } = await read(root);
      if (!settings.zone || !Array.isArray(settings.hours) || settings.hours.length === 0) {
        return send(res, 412, {
          code: 'failed_precondition',
          message: !settings.zone ? 'nobody has said which timezone this business keeps' : 'nobody has said when this business is open',
          details: { code: 'JTK_E_DIARY_NOT_READY', means: 'jtk/bookings.json needs `zone` and `hours`.' },
        });
      }
      const asked = (url.searchParams.get('service') ?? '').split(',').concat(url.searchParams.getAll('services')).filter(Boolean);
      const chosen = services.filter((s) => asked.includes(s.slug));
      const takes = chosen.reduce((sum, s) => sum + s.takes, 0) || Number(settings.slot_every) || 30;
      const costs = chosen.reduce((sum, s) => sum + s.costs, 0);
      const every = Number(settings.slot_every) || 15;
      const lead = Number(settings.lead) || 0;
      const zone = settings.zone;
      const from = new Date(url.searchParams.get('from') ?? Date.now());
      const to = new Date(url.searchParams.get('to') ?? Date.now() + 86400000);
      const resource = url.searchParams.get('resource') ?? '';
      const able = people.filter((p) => (!resource || p.slug === resource) && (!p.does || chosen.every((s) => p.does.includes(s.slug))));
      const earliest = Date.now() + lead * 60000;
      const slots = [];
      // Walk the days in the business's own zone, from its local midnight.
      for (let day = new Date(from.getTime()); day < to; day = new Date(day.getTime() + 86400000)) {
        const offset = offsetOf(zone, day);
        const local = new Date(day.getTime() + offset * 60000);
        const midnightUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset * 60000;
        const weekday = DAYS[new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())).getUTCDay()];
        for (const span of settings.hours.filter((h) => h.day === weekday)) {
          for (let m = Number(span.opens); m + takes <= Number(span.closes); m += every) {
            const start = midnightUtc + m * 60000;
            if (start < earliest || start < from.getTime() || start >= to.getTime()) continue;
            const iso = new Date(start).toISOString();
            const busy = taken.get(iso) ?? [];
            const free = (able.length ? able : [{ slug: '' }]).map((p) => p.slug).filter((s) => !busy.includes(s));
            slots.push({ start: iso, ends: new Date(start + takes * 60000).toISOString(), free: free.filter(Boolean), costs_minor: costs });
          }
        }
      }
      return send(res, 200, {
        zone,
        slots: slots.filter((s) => s.free.length > 0 || people.length === 0),
        party_max: 0,
        quantity_max: 1,
        scale: settings.scale ?? 'hourly',
        currency: settings.currency ?? '',
        services: services.map((s) => ({ slug: s.slug, scale: settings.scale ?? 'hourly', takes: s.takes, fewest: 1, most: 1 })),
        dev: true,
      });
    }

    if (path === '/book' && req.method === 'POST') {
      const body = await bodyOf(req);
      const { people, services, settings } = await read(root);
      const start = body.start ? new Date(body.start).toISOString() : '';
      if (!start) return send(res, 400, { code: 'invalid_argument', message: 'a booking needs a start' });
      const busy = taken.get(start) ?? [];
      const who = body.resource || people.map((p) => p.slug).find((s) => !busy.includes(s)) || '';
      taken.set(start, [...busy, who]);
      made += 1;
      console.log(`[dev diary] booked ${body.service ?? (body.services ?? []).join('+')} at ${start}${who ? ` with ${who}` : ''} for ${body.name ?? 'somebody'} — on this machine only, nothing reached the platform`);
      // The answer the form draws its last screen from: when, until when, with
      // whom — without `start` and `ends` it cannot say the time, and says
      // the booking failed instead.
      const names = [body.service, ...(Array.isArray(body.services) ? body.services : [])].filter(Boolean);
      const takes = services.filter((s) => names.includes(s.slug)).reduce((sum, s) => sum + s.takes, 0) || Number(settings.slot_every) || 30;
      const ends = new Date(new Date(start).getTime() + takes * 60000).toISOString();
      return send(res, 200, { id: `dev-${made}`, state: 'confirmed', start, ends, amount_minor: 0, currency: settings.currency ?? '', token: `dev-${made}`, manage_path: '', telegram_url: '', resource: who, dev: true });
    }

    if (path === '/booking/cancel' && req.method === 'POST') return send(res, 200, { ok: true, dev: true });

    return next();
  };
}
