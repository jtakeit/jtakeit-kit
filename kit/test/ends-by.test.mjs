// A collection whose entries go by their own date — contract 3's `ends_by`
// (the owner, 16 November 2026, on KAIF's nights): the moment worked out as
// the platform works it out (registry/endsBy.go), the judge's refusals in its
// words and at its paths, contract 2 without it, the declaration carrying it
// into jtk/schema.json, the door leaving out what has gone, and the advice to
// a template that compares an entry's date with the clock itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content } from '../lib/content/index.mjs';
import { dateHides, datesAgainstClock, dateKeysOf } from '../lib/dateHides.mjs';
import { endsAt, hideAtOf, isZone } from '../lib/endsBy.mjs';
import { judgeSchema } from '../lib/judge3.mjs';
import { catalogueIn2, CONTRACT_3_ONLY } from '../lib/kits.mjs';
import { schemaOf } from '../lib/schema.mjs';

const fixture = readFileSync(new URL('./fixtures/platform/kit-schema.json', import.meta.url), 'utf8');

/** The platform's kit schema with `ends_by` on its works and a time on a work to go at (endsBy_test.go's `kitWith`). */
function kitWith(ends) {
  const schema = JSON.parse(fixture);
  schema.blocks.find((one) => one.type === 'rate').fields.push({ key: 'takes', label: 'Dauer', kind: 'duration' });
  schema.blocks.find((one) => one.type === 'work').fields.push({ key: 'starts', label: 'Beginn', kind: 'time_of_day' });
  schema.collections.find((one) => one.name === 'works').ends_by = ends;
  return schema;
}

test('the moment, on the clock of the zone the schema names (TestACollectionGoesByItsEntriesDate)', () => {
  const ends = { date: 'date', time: 'starts', after: 480, zone: 'Europe/Zurich' };
  // 15 November, 22:00 in Zürich (UTC+1), and eight hours: 16 November, 06:00 there.
  assert.equal(endsAt(ends, { date: '2026-11-15', starts: 22 * 60 }), Date.parse('2026-11-16T05:00:00Z'));
  // In summer the same clock is UTC+2.
  assert.equal(endsAt(ends, { date: '2026-07-04', starts: 22 * 60 }), Date.parse('2026-07-05T04:00:00Z'));
  // No date yet, or not a date: nothing to go by — the entry stays.
  assert.equal(endsAt(ends, { starts: 600 }), undefined);
  assert.equal(endsAt(ends, { date: 'soon' }), undefined);
  assert.equal(endsAt(ends, { date: '2026-02-30' }), undefined, 'a day the month has not got is no date, as to time.Parse');
  // A time that is not one is the start of the day; `after` keeps its default of none with a time named.
  assert.equal(hideAtOf({ date: 'date', time: 'starts', zone: 'Europe/Zurich' }, { date: '2026-11-15', starts: 'late' }), '2026-11-14T23:00:00Z');
  // No time: the start of the day, and by default the whole of it.
  assert.equal(hideAtOf({ date: 'date', zone: 'Europe/Kyiv' }, { date: '2026-11-15' }), '2026-11-15T22:00:00Z', 'the end of the 15th in Kyiv (UTC+2)');
  // A wall time the clocks skip is read as Go's time.Date reads it.
  assert.equal(hideAtOf({ date: 'date', time: 't', zone: 'Europe/Zurich' }, { date: '2026-03-29', t: 150 }), '2026-03-29T01:30:00Z');
});

test('a zone is an IANA name in its own case, never Local or an offset', () => {
  for (const zone of ['Europe/Zurich', 'Europe/Kyiv', 'UTC', 'America/New_York']) assert.equal(isZone(zone), true, zone);
  for (const zone of ['', 'Europe/Zuerich', 'europe/zurich', 'Local', '+01:00', 'Zurich']) assert.equal(isZone(zone), false, zone);
});

test('ends_by is held to the entry it reads, in the platform\'s words and at its paths (TestEndsByIsHeldToTheEntryItReads)', () => {
  assert.deepEqual(judgeSchema(JSON.stringify(kitWith({ date: 'date', time: 'starts', after: 480, zone: 'Europe/Zurich' }))), []);
  assert.deepEqual(judgeSchema(JSON.stringify(kitWith({ date: 'date', zone: 'Europe/Zurich' }))), []);
  for (const [name, ends, path, says, code = 'JTK_E_COLLECTION_INVALID'] of [
    ['no date', { zone: 'Europe/Zurich' }, 'collections.works.ends_by.date', 'collection "works" goes by a date it does not name — "ends_by": {"date": "<a date field>", "time": "<a time_of_day field>", "after": <minutes>, "zone": "Europe/Zurich"}'],
    ['a date nothing declares', { date: 'when', zone: 'Europe/Zurich' }, 'collections.works.ends_by.date', 'collection "works" goes by work.when, which "work" does not declare'],
    ['a date that is no date', { date: 'title', zone: 'Europe/Zurich' }, 'collections.works.ends_by.date', 'collection "works" goes by work.title, which is "text" — ends_by.date names a field of kind "date"'],
    ['a time nothing declares', { date: 'date', time: 'doors', zone: 'Europe/Zurich' }, 'collections.works.ends_by.time', 'collection "works" goes at the time in work.doors, which "work" does not declare'],
    ['a time that is no time', { date: 'date', time: 'title', zone: 'Europe/Zurich' }, 'collections.works.ends_by.time', 'collection "works" goes at the time in work.title, which is "text" — ends_by.time names a field of kind "time_of_day"'],
    ['too long after', { date: 'date', after: 20000, zone: 'Europe/Zurich' }, 'collections.works.ends_by.after', 'collection "works" goes 20000 minutes after its moment — between 0 and 10080 (a week)'],
    ['before its moment', { date: 'date', after: -1, zone: 'Europe/Zurich' }, 'collections.works.ends_by.after', 'collection "works" goes -1 minutes after its moment — between 0 and 10080 (a week)'],
    ['no zone', { date: 'date' }, 'collections.works.ends_by.zone', 'collection "works" goes by a date on no clock — ends_by.zone is the IANA zone the date is in, "Europe/Zurich"'],
    ['no such zone', { date: 'date', zone: 'Europe/Zuerich' }, 'collections.works.ends_by.zone', 'collection "works" goes by a date in "Europe/Zuerich", which is no IANA zone — "Europe/Zurich", "Europe/Kyiv"'],
    ['a key it has not', { date: 'date', zone: 'Europe/Zurich', until: 'x' }, 'collections.works.ends_by.until', "collections.works.ends_by.until is not a key of contract 3's schema, and nothing would read it", 'JTK_E_SCHEMA_KEY_UNKNOWN'],
  ]) {
    const found = judgeSchema(JSON.stringify(kitWith(ends)));
    assert.deepEqual(found, [{ code, path, says }], name);
  }
  // Each part judged on its own, as Go's validateEndsBy adds them.
  assert.deepEqual(judgeSchema(JSON.stringify(kitWith({ date: 'title', after: 99999 }))).map((one) => one.path), [
    'collections.works.ends_by.date', 'collections.works.ends_by.after', 'collections.works.ends_by.zone',
  ]);
  // A shape Go's decoder refuses is one unreadable schema.
  for (const ends of ['soon', { date: 'date', zone: 'Europe/Zurich', after: 1.5 }, { date: 7, zone: 'Europe/Zurich' }]) {
    const found = judgeSchema(JSON.stringify(kitWith(ends)));
    assert.equal(found.length, 1);
    assert.equal(found[0].code, 'JTK_E_SCHEMA_UNREADABLE', JSON.stringify(ends));
  }
});

test('contract 2 has no ends_by: a kit laid out on contract 2 leaves it out, as route and shown_on', () => {
  assert.ok(CONTRACT_3_ONLY.collection.includes('ends_by'));
  const two = catalogueIn2({ blocks: [], collections: [{ name: 'nights', type: 'night', prefix: '/nights', ends_by: { date: 'date', zone: 'Europe/Zurich' } }] });
  assert.deepEqual(two.collections, [{ name: 'nights', type: 'night', prefix: '/nights' }]);
});

test('the declaration carries ends_by into jtk/schema.json as written', () => {
  const ends = { date: 'date', time: 'starts', after: 480, zone: 'Europe/Zurich' };
  const schema = schemaOf({ CONTRACT: 3, LOCALE: 'de', BLOCKS: [], COLLECTIONS: [{ name: 'nights', label: 'Nights', type: 'night', route: { detail: '/nights/{slug}' }, ends_by: ends }] });
  assert.deepEqual(schema.collections[0].ends_by, ends);
});

// ── the door ──────────────────────────────────────────────────────────────

const NIGHT = (n) => `0193a5c3-0a11-7d02-9f3c-1e2d3c4b5a${String(n).padStart(2, '0')}`;
const nightsSchema = (ends) => ({
  contract: 3,
  locale: 'de',
  locales: ['en'],
  blocks: [{ type: 'night', v: 1, label: 'Night', fields: [
    { key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true },
    { key: 'date', label: 'Date', kind: 'date', client_editable: true },
    { key: 'starts', label: 'Doors', kind: 'time_of_day', client_editable: true },
  ] }],
  collections: [{ name: 'nights', label: 'Nights', type: 'night', route: { detail: '/nights/{slug}', listing: '/nights' }, ...(ends === undefined ? {} : { ends_by: ends }) }],
});
const night = (n, slug, fields, more = {}) => ({ id: NIGHT(n), collection: 'nights', slug, visible: true, fields, ...more });
const tree = (ends) => ({
  '/jtk/schema.json': nightsSchema(ends),
  '/jtk/site.json': { currency: 'CHF' },
  // Saturday 14 November, doors at 22:00 in Zürich: over at 06:00 on the 15th, 05:00 UTC.
  '/jtk/entries/nights/gone.json': night(1, 'gone', { title: 'Gone', date: '2026-11-14', starts: 22 * 60 }),
  '/jtk/entries/nights/gone.en.json': { of: NIGHT(1), locale: 'en', fields: { title: 'Gone' } },
  // Tonight: on until 06:00 tomorrow.
  '/jtk/entries/nights/tonight.json': night(2, 'tonight', { title: 'Tonight', date: '2026-11-16', starts: 22 * 60 }),
  // The file says a moment long past, and the date says next week: the date is the one source.
  '/jtk/entries/nights/moved.json': night(3, 'moved', { title: 'Moved', date: '2026-11-21', starts: 22 * 60 }, { hide_at: '2026-01-01T00:00:00Z' }),
  // No date yet: nothing to go by, it stays.
  '/jtk/entries/nights/undated.json': night(4, 'undated', { title: 'Undated' }),
  // Hidden by hand stays hidden whatever its date says.
  '/jtk/entries/nights/held.json': night(5, 'held', { title: 'Held', date: '2026-12-01' }, { visible: false }),
});

test('the door leaves out an entry whose date has gone, as the platform\'s hide_at written from it does', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const ends = { date: 'date', time: 'starts', after: 480, zone: 'Europe/Zurich' };
  const site = content(tree(ends), { now });
  assert.deepEqual(site.entries('nights').map((one) => one.slug), ['moved', 'tonight', 'undated']);
  assert.deepEqual(site.entries('nights', { locale: 'en' }).map((one) => one.slug), ['moved', 'tonight', 'undated'], 'a translation goes with its original');
  assert.deepEqual(site.collection('nights').ends_by, ends);
  // Asked with another clock: at 05:59 UTC on the 15th the night of the 14th is still on.
  assert.ok(site.entries('nights', { now: Date.parse('2026-11-15T04:59:00Z') }).some((one) => one.slug === 'gone'));
  assert.ok(!site.entries('nights', { now: Date.parse('2026-11-15T05:00:00Z') }).some((one) => one.slug === 'gone'));
  // Every entry is still a document, built for the editor, its standing said.
  const gone = site.documents().find((one) => one.slug === 'gone' && one.locale === '');
  assert.equal(gone.shown, false);
  assert.ok(site.entries('nights', { all: true }).some((one) => one.slug === 'gone'));

  // Without ends_by the files' own moments stand: the moved night's hide_at hides it, the gone one shows.
  const plain = content(tree(undefined), { now });
  assert.deepEqual(plain.entries('nights').map((one) => one.slug), ['gone', 'tonight', 'undated']);
});

// ── the advice ────────────────────────────────────────────────────────────

const keys = dateKeysOf(nightsSchema());

test('advice: a template that chooses entries by comparing their date with the clock (KAIF\'s nights)', () => {
  const nights = `export function nextNight(nights: Night[], now = new Date()): Night | undefined {
  const today = now.toISOString().slice(0, 10);
  return nights.find((night) => night.date >= today) ?? nights.at(-1);
}`;
  assert.deepEqual(datesAgainstClock(nights, keys).map((one) => [one.line, one.said]), [[3, 'night.date >= today']]);

  const afisha = `---
// Coming first, soonest on top; then the ones that have been.
const today = new Date().toISOString().slice(0, 10);
const order = [
  ...nights.filter((night) => night.date >= today),
  ...nights.filter((night) => night.date < today).reverse(),
];
---
<p>Don't miss it — doors > 22:00</p>`;
  assert.deepEqual(datesAgainstClock(afisha, keys).map((one) => one.line), [5, 6]);

  const ticket = `<script is:inline>
  var label = \`\${name}'s night\`;
  function paint() {
    var now = Date.now();
    var date = tickets[i].getAttribute('data-date') || '';
    var over = DATE.test(date) && now >= zurich(date, 0) + 30 * 3600 * 1000;
  }
</script>`;
  assert.deepEqual(datesAgainstClock(ticket, keys).map((one) => [one.line, one.said]), [[6, 'now >= zurich(date, 0) + 30 * 3600 * 1000']]);

  const inline = "const coming = site.entries('nights').filter((n) => Date.parse(n.fields.value('date')) - Date.now() > 0);";
  assert.equal(datesAgainstClock(inline, keys).length, 1);
});

test('advice: no word on what only formats, sorts, or compares the clock with something else', () => {
  for (const [why, source] of [
    ['a countdown that works out how long is left', 'const left = Date.parse(night.date) - Date.now();\nconst hours = Math.floor(left / 3600000);\nif (hours > 0) label = `${hours}h`;'],
    ['a sort by date', 'nights.sort((a, b) => (a.date < b.date ? -1 : 1));'],
    ['the year in the footer', 'const year = new Date().getFullYear();'],
    ['open now, by the hours', 'const now = new Date();\nconst open = now.getHours() * 60 >= row.opens && now.getHours() * 60 < row.closes;'],
    ['a date in a string', "const now = Date.now();\nif (now > limit) say('the date is over');"],
    ['a comment', '// night.date >= new Date() would freeze'],
    ['generics and markup', 'const list: Array<Night> = [];\nconst x = <div>{nights.length > 0 && <p>{night.date}</p>}</div>;'],
  ]) {
    assert.deepEqual(datesAgainstClock(source, keys), [], why);
  }
});

test('advice: said as JTK_W_DATE_HIDES, naming the collection that should declare ends_by — or saying it already does', () => {
  const files = { 'src/lib/nights.ts': 'const today = new Date().toISOString().slice(0, 10);\nexport const coming = (all) => all.filter((n) => n.date >= today);', 'src/env.d.ts': 'night.date >= new Date()' };
  const [one, ...rest] = dateHides(files, nightsSchema());
  assert.deepEqual(rest, []);
  assert.equal(one.code, 'JTK_W_DATE_HIDES');
  assert.equal(one.path, 'src/lib/nights.ts:2');
  assert.match(one.says, /^`n\.date >= today` compares an entry's date \(date\) with the clock/);
  assert.match(one.says, /Declare ends_by on "nights" \("ends_by": \{"date": "date", "zone": "Europe\/Zurich"\}/);
  assert.match(one.says, /site\.entries\("nights"\)/);
  const [going] = dateHides(files, nightsSchema({ date: 'date', zone: 'Europe/Zurich' }));
  assert.match(going.says, /"nights" goes by that date already \(ends_by\)/);
});

test('jtk schema says the advice and counts it nowhere', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-ends-by-'));
  try {
    mkdirSync(join(root, 'src', 'content'), { recursive: true });
    mkdirSync(join(root, 'src', 'pages'), { recursive: true });
    writeFileSync(join(root, 'src', 'content', 'blocks.ts'), `export const CONTRACT = 3;
export const LOCALE = 'de';
export const BLOCKS = ${JSON.stringify(nightsSchema().blocks)};
export const COLLECTIONS = ${JSON.stringify(nightsSchema().collections)};
`);
    writeFileSync(join(root, 'src', 'pages', 'afisha.astro'), '---\nconst today = new Date().toISOString().slice(0, 10);\nconst coming = nights.filter((night) => night.date >= today);\n---\n');
    const tool = fileURLToPath(new URL('../lib/schema.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [tool, '--emit-only', '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /~ JTK_W_DATE_HIDES {2}src\/pages\/afisha\.astro:3: `night\.date >= today`/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
