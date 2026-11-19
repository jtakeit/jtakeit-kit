// A class whose own hours are outside the business's is never offered by the
// diary, which clips a resource's week to the business's (slots.HoursOf): an
// evening Yin class at a studio open until 18:00 had no time at all, and
// nothing said so (a staging site, 19 November 2026). `jtk schema` says it —
// JTK_W_SESSION_OUTSIDE_HOURS, advice, never a refusal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionsOutsideHours } from '../lib/sessionHours.mjs';
import { ADVICE, W, isAdvice } from '../lib/codes.mjs';

const schema = {
  contract: 3,
  locale: 'de',
  blocks: [
    { type: 'course', v: 1, label: 'Kurs', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true }, { key: 'takes', label: 'Dauer', kind: 'duration' }] },
    {
      type: 'session', v: 1, label: 'Klasse', fields: [
        { key: 'title', label: 'Name', kind: 'text', required: true },
        { key: 'spots', label: 'Plätze', kind: 'number' },
        { key: 'hours', label: 'Zeiten', kind: 'list', of: [{ key: 'day', label: 'Tag', kind: 'select', options: [{ value: 'tuesday' }, { value: 'thursday' }, { value: 'friday' }, { value: 'saturday' }] }, { key: 'opens', label: 'Von', kind: 'time_of_day' }, { key: 'closes', label: 'Bis', kind: 'time_of_day' }] },
      ],
    },
  ],
  collections: [
    { name: 'services', label: 'Kurse', type: 'course', route: 'none', shown_on: ['/services#services-{slug}'] },
    { name: 'sessions', label: 'Klassen', type: 'session', route: 'none', shown_on: ['/timetable#sessions-{slug}'] },
  ],
  modules: { bookings: { services: 'services', resources: 'sessions' } },
};

const hours = (rows) => ({ v: 1, settings: { zone: 'Europe/Zurich', hours: rows.map(([day, opens, closes], i) => ({ _key: `h${i}`, day, opens, closes })) } });
const session = (slug, rows, n) => ({
  id: `0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b5${n}`, collection: 'sessions', slug, rank: `a${n}`, visible: true,
  fields: { title: slug, spots: 3, hours: rows.map(([day, opens, closes], i) => ({ _key: `r${n}${i}`, day, opens, closes })) },
});
/** The tree as readJtk hands it. */
const tree = (business, ...sessions) => ({
  '/jtk/schema.json': schema,
  '/jtk/modules/bookings.json': business,
  ...Object.fromEntries(sessions.map((one) => [`/jtk/entries/sessions/${one.slug}.json`, one])),
});

test('a class after the business closes is said, with its day, its times and the hours that day', () => {
  const said = sessionsOutsideHours(tree(
    hours([['tuesday', 540, 1080], ['thursday', 540, 1080], ['saturday', 540, 840]]),
    session('yin-abend', [['tuesday', 1080, 1155], ['thursday', '18:00', '19:15']], 1),
    session('pilates-samstag', [['saturday', 540, 600]], 2),
  ));
  assert.deepEqual(said.map((one) => one.code), [W.SESSION_OUTSIDE_HOURS, W.SESSION_OUTSIDE_HOURS]);
  assert.equal(said[0].path, 'jtk/entries/sessions/yin-abend.json');
  assert.equal(said[0].says, "sessions/yin-abend: tuesday 18:00–19:15 is outside the business's hours that day (09:00–18:00) — the diary offers only the part inside them; widen the hours in jtk/modules/bookings.json or move the row");
  assert.match(said[1].says, /^sessions\/yin-abend: thursday 18:00–19:15 is outside/, 'HH:MM rows read as minutes are');
  assert.ok(isAdvice(said[0].code) && ADVICE[said[0].code], 'advice, with its sentence in the table');
});

test('a class on a day the business is closed says closed; one partly outside is said too', () => {
  const said = sessionsOutsideHours(tree(
    hours([['tuesday', 540, 1200]]),
    session('friday-class', [['friday', 600, 660]], 1),
    session('late', [['tuesday', 1140, 1230]], 2),
  ));
  assert.equal(said.length, 2);
  assert.match(said[0].says, /friday 10:00–11:00 is outside the business's hours that day \(closed\)/);
  assert.match(said[1].says, /tuesday 19:00–20:30 is outside the business's hours that day \(09:00–20:00\)/);
});

test('inside the hours, across two openings that meet, or past midnight inside a night opening: nothing', () => {
  assert.deepEqual(sessionsOutsideHours(tree(
    hours([['tuesday', 540, 720], ['tuesday', 720, 1200], ['friday', 1200, 120]]),
    session('inside', [['tuesday', 1080, 1155]], 1),
    session('across', [['tuesday', 690, 750]], 2),
    session('night', [['friday', 1380, 60]], 3),
  )), []);
});

test('no hours yet, or no bookings module: nothing to hold a class to, nothing said', () => {
  assert.deepEqual(sessionsOutsideHours(tree({ v: 1, settings: {} }, session('any', [['tuesday', 1080, 1155]], 1))), []);
  assert.deepEqual(sessionsOutsideHours({ '/jtk/schema.json': { ...schema, modules: {} } }), []);
});
