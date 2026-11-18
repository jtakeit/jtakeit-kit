import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { devDiary } from '../lib/devdiary.mjs';

/** A site with two services, two people, and Zürich's hours. */
function site() {
  const root = mkdtempSync(join(tmpdir(), 'devdiary-'));
  mkdirSync(join(root, 'jtk', 'content', 'services'), { recursive: true });
  mkdirSync(join(root, 'jtk', 'content', 'masters'), { recursive: true });
  writeFileSync(join(root, 'jtk', 'catalogue.json'), JSON.stringify({ modules: { bookings: { services: 'services', resources: 'masters' } } }));
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  writeFileSync(join(root, 'jtk', 'bookings.json'), JSON.stringify({ blocks: [{ type: 'bookings_config', zone: 'Europe/Zurich', slot_every: 15, hours: days.map((day) => ({ day, opens: 540, closes: 1080 })) }] }));
  const entry = (collection, path, block) => JSON.stringify({ collection, path, blocks: [block] });
  writeFileSync(join(root, 'jtk', 'content', 'services', 'cut.json'), entry('services', '/services/cut', { type: 'service', title: 'Cut', takes: 45, costs: 4800 }));
  writeFileSync(join(root, 'jtk', 'content', 'masters', 'anna.json'), entry('masters', '/masters/anna', { type: 'master', title: 'Anna' }));
  writeFileSync(join(root, 'jtk', 'content', 'masters', 'ben.json'), entry('masters', '/masters/ben', { type: 'master', title: 'Ben' }));
  return root;
}

/** One request through the middleware, as connect would make it under /api. */
function ask(handler, method, url, body) {
  return new Promise((done) => {
    const listeners = {};
    const req = { method, url, on: (event, fn) => ((listeners[event] = fn), req) };
    const res = { statusCode: 200, setHeader() {}, end: (text) => done({ status: res.statusCode, body: JSON.parse(text) }) };
    handler(req, res, () => done({ status: 404 }));
    queueMicrotask(() => {
      listeners.data?.(body ? JSON.stringify(body) : '');
      listeners.end?.();
    });
  });
}

test('the dev diary offers times from the site\'s own hours, in its zone, and takes the one booked', async () => {
  const handler = devDiary(site());
  const from = new Date(Date.now() + 2 * 86400000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000);
  const q = `/availability?service=cut&from=${from.toISOString()}&to=${to.toISOString()}`;

  const first = await ask(handler, 'GET', q);
  assert.equal(first.status, 200);
  assert.equal(first.body.zone, 'Europe/Zurich');
  assert.ok(first.body.slots.length > 10);
  const slot = first.body.slots[0];
  assert.deepEqual(slot.free, ['anna', 'ben']);
  assert.equal(slot.costs_minor, 4800);
  // 09:00 in Zürich is 07:00 or 08:00 UTC, by the season.
  assert.ok(['07:00', '08:00'].includes(slot.start.slice(11, 16)), slot.start);
  assert.equal(new Date(slot.ends) - new Date(slot.start), 45 * 60000);

  const booked = await ask(handler, 'POST', '/book', { service: 'cut', start: slot.start, name: 'Test' });
  assert.equal(booked.body.state, 'confirmed');
  assert.equal(booked.body.start, slot.start);
  assert.equal(booked.body.ends, slot.ends);

  const again = await ask(handler, 'GET', q);
  assert.deepEqual(again.body.slots[0].free, ['ben']);
});

test('a diary with no zone says so, the way the platform does', async () => {
  const root = site();
  writeFileSync(join(root, 'jtk', 'bookings.json'), JSON.stringify({ blocks: [{ type: 'bookings_config', hours: [] }] }));
  const answer = await ask(devDiary(root), 'GET', '/availability?service=cut');
  assert.equal(answer.status, 412);
  assert.match(answer.body.message, /timezone/);
});

// What a person does is the rows the kit and the panel write — `[{ service }]`
// — read as the booking form reads them. It used to be taken for a list of
// slugs here, so with the rows nobody could do anything (wiki/98 §13).
test('a person who does other things is not offered; the rows are read as rows', async () => {
  const root = site();
  const entry = (collection, path, block, extra = {}) => JSON.stringify({ collection, path, ...extra, blocks: [block] });
  writeFileSync(join(root, 'jtk', 'content', 'services', 'dye.json'), entry('services', '/services/dye', { type: 'service', title: 'Dye', takes: 60, costs: 9000 }));
  writeFileSync(join(root, 'jtk', 'content', 'masters', 'anna.json'), entry('masters', '/masters/anna', { type: 'master', title: 'Anna', does: [{ service: 'cut' }] }));
  writeFileSync(join(root, 'jtk', 'content', 'masters', 'ben.json'), entry('masters', '/masters/ben', { type: 'master', title: 'Ben', does: [{ service: 'dye' }] }));
  // Hidden, and a German copy of a service: neither is a choice of its own.
  writeFileSync(join(root, 'jtk', 'content', 'masters', 'cleo.json'), entry('masters', '/masters/cleo', { type: 'master', title: 'Cleo' }, { visible: false }));
  mkdirSync(join(root, 'jtk', 'content', 'de', 'services'), { recursive: true });
  writeFileSync(join(root, 'jtk', 'content', 'de', 'services', 'cut.json'), entry('services', '/de/services/cut', { type: 'service', title: 'Schnitt', takes: 45 }, { locale: 'de' }));
  const handler = devDiary(root);
  const from = new Date(Date.now() + 2 * 86400000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000);
  const asked = (service) => ask(handler, 'GET', `/availability?service=${service}&from=${from.toISOString()}&to=${to.toISOString()}`);
  assert.deepEqual((await asked('cut')).body.slots[0].free, ['anna']);
  assert.deepEqual((await asked('dye')).body.slots[0].free, ['ben']);
  assert.deepEqual((await asked('cut')).body.services.map((one) => one.slug), ['cut', 'dye']);
});

// Contract 3, every new site's: a price is `{ minor }` and what a person does
// one reference to many services by id — read as no price and as everything
// until 12 November 2026. Its settings are jtk/modules/bookings.json, and a
// diary nobody has set up says that file.
test('on contract 3 a price is its minor units and what a person does is the services they name by id', async () => {
  const root = mkdtempSync(join(tmpdir(), 'devdiary-3-'));
  const put = (file, value) => {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(value));
  };
  const ids = { cut: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b51', dye: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b52', anna: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b53', ben: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b54' };
  put('jtk/schema.json', {
    contract: 3,
    locale: 'de',
    blocks: [
      { type: 'service', v: 1, label: 'Service', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true }, { key: 'takes', label: 'Takes', kind: 'duration' }, { key: 'costs', label: 'Costs', kind: 'money' }] },
      { type: 'master', v: 1, label: 'Master', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true }, { key: 'does', label: 'Does', kind: 'ref', ref: { to: ['services'], many: true } }] },
    ],
    collections: [
      { name: 'services', label: 'Services', type: 'service', route: 'none', shown_on: ['/services#services-{slug}'] },
      { name: 'masters', label: 'Masters', type: 'master', route: { detail: '/masters/{slug}' } },
    ],
    modules: { bookings: { services: 'services', resources: 'masters' } },
  });
  put('jtk/modules/bookings.json', { v: 1, settings: { hours: [] } });
  put('jtk/entries/services/cut.json', { id: ids.cut, collection: 'services', slug: 'cut', rank: 'V', visible: true, fields: { title: 'Schnitt', takes: 45, costs: { minor: 4800 } } });
  put('jtk/entries/services/dye.json', { id: ids.dye, collection: 'services', slug: 'dye', rank: 'W', visible: true, fields: { title: 'Farbe', takes: 60, costs: { minor: 9000 } } });
  put('jtk/entries/masters/anna.json', { id: ids.anna, collection: 'masters', slug: 'anna', rank: 'V', visible: true, fields: { title: 'Anna', does: [ids.cut] } });
  put('jtk/entries/masters/ben.json', { id: ids.ben, collection: 'masters', slug: 'ben', rank: 'W', visible: true, fields: { title: 'Ben', does: [ids.dye] } });

  const unset = await ask(devDiary(root), 'GET', '/availability?service=cut');
  assert.equal(unset.status, 412);
  assert.equal(unset.body.details.means, 'jtk/modules/bookings.json needs `zone` and `hours`.');

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  put('jtk/modules/bookings.json', { v: 1, settings: { zone: 'Europe/Zurich', slot_every: 15, hours: days.map((day) => ({ _key: `h${day.slice(0, 3)}`, day, opens: 540, closes: 1080 })) } });
  const handler = devDiary(root);
  const from = new Date(Date.now() + 2 * 86400000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86400000);
  const asked = (service) => ask(handler, 'GET', `/availability?service=${service}&from=${from.toISOString()}&to=${to.toISOString()}`);
  const cut = (await asked('cut')).body.slots[0];
  assert.deepEqual(cut.free, ['anna']);
  assert.equal(cut.costs_minor, 4800);
  const dye = (await asked('dye')).body.slots[0];
  assert.deepEqual(dye.free, ['ben']);
  assert.equal(dye.costs_minor, 9000);
});

// A studio of classes — the `sessions` kit: a class keeps its own week in its
// rows, starts when its row opens, and has places. The diary here offered the
// business's whole day every fifteen minutes and was full after one place
// (18 November 2026); the platform's `slots.Free` is what it now follows.
function studio({ closed = [], party = 2 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'devdiary-classes-'));
  mkdirSync(join(root, 'jtk', 'content', 'services'), { recursive: true });
  mkdirSync(join(root, 'jtk', 'content', 'sessions'), { recursive: true });
  writeFileSync(join(root, 'jtk', 'catalogue.json'), JSON.stringify({ modules: { bookings: { services: 'services', resources: 'sessions' } } }));
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  writeFileSync(join(root, 'jtk', 'bookings.json'), JSON.stringify({ blocks: [{ type: 'bookings_config', zone: 'Europe/Zurich', slot_every: 15, party, closed, hours: days.map((day) => ({ day, opens: 570, closes: 1260 })) }] }));
  const entry = (collection, path, block) => JSON.stringify({ collection, path, blocks: [block] });
  writeFileSync(join(root, 'jtk', 'content', 'services', 'yinyoga.json'), entry('services', '/services/yinyoga', { type: 'course', title: 'Yin Yoga', takes: 75, costs: 2500, per: 'person' }));
  // Every day at 18:00, and on no day at 07:00 — before the door opens, so clipped away.
  writeFileSync(join(root, 'jtk', 'content', 'sessions', 'evening.json'), entry('sessions', '/sessions/evening', { type: 'session', title: 'Evening', spots: 3, hours: days.flatMap((day) => [{ day, opens: '18:00', closes: '19:15' }, { day, opens: 420, closes: 495 }]), does: [{ service: 'yinyoga' }] }));
  return root;
}

const ahead = (days = 2) => {
  const from = new Date(Date.now() + days * 86400000);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to: new Date(from.getTime() + 86400000) };
};

test('a class is offered once, when its own row starts, inside the business\'s hours', async () => {
  const handler = devDiary(studio());
  const { from, to } = ahead();
  const answer = await ask(handler, 'GET', `/availability?service=yinyoga&from=${from.toISOString()}&to=${to.toISOString()}`);
  assert.equal(answer.status, 200);
  assert.equal(answer.body.slots.length, 1, JSON.stringify(answer.body.slots));
  const [slot] = answer.body.slots;
  assert.deepEqual(slot.free, ['evening']);
  // 18:00 in Zürich is 16:00 or 17:00 UTC, by the season.
  assert.ok(['16:00', '17:00'].includes(slot.start.slice(11, 16)), slot.start);
  assert.equal(new Date(slot.ends) - new Date(slot.start), 75 * 60000);
  assert.equal(answer.body.party_max, 2);
  assert.equal(answer.body.party_seats, 3);
  assert.equal(answer.body.services[0].per, 'person');
});

test('a class takes bookings until its places are gone, a party taking one each', async () => {
  const handler = devDiary(studio());
  const { from, to } = ahead();
  const q = (party) => `/availability?service=yinyoga&party=${party}&from=${from.toISOString()}&to=${to.toISOString()}`;
  const [slot] = (await ask(handler, 'GET', q(1))).body.slots;
  assert.equal((await ask(handler, 'GET', q(2))).body.slots[0].costs_minor, 5000);

  assert.equal((await ask(handler, 'POST', '/book', { service: 'yinyoga', start: slot.start, party: 2 })).status, 200);
  assert.equal((await ask(handler, 'GET', q(1))).body.slots.length, 1, 'one place is left');
  assert.equal((await ask(handler, 'GET', q(2))).body.slots.length, 0, 'not two');
  assert.equal((await ask(handler, 'POST', '/book', { service: 'yinyoga', start: slot.start, party: 2 })).status, 409);

  const last = await ask(handler, 'POST', '/book', { service: 'yinyoga', start: slot.start });
  assert.equal(last.status, 200);
  assert.equal(last.body.resource, 'evening');
  assert.equal((await ask(handler, 'GET', q(1))).body.slots.length, 0, 'full');
  assert.equal((await ask(handler, 'POST', '/book', { service: 'yinyoga', start: slot.start })).status, 409);

  await ask(handler, 'POST', '/booking/cancel', { token: last.body.token });
  assert.equal((await ask(handler, 'GET', q(1))).body.slots.length, 1, 'a cancelled place is free again');
});

test('a party larger than the site takes is refused, as the platform refuses it', async () => {
  const { from, to } = ahead();
  const answer = await ask(devDiary(studio()), 'GET', `/availability?service=yinyoga&party=3&from=${from.toISOString()}&to=${to.toISOString()}`);
  assert.equal(answer.status, 400);
});

test('a day off shuts the business, or only the one it names', async () => {
  const { from, to } = ahead(3);
  const day = new Date(from.getTime() + 12 * 3600000).toISOString().slice(0, 10);
  const q = `/availability?service=yinyoga&from=${from.toISOString()}&to=${to.toISOString()}`;
  assert.equal((await ask(devDiary(studio({ closed: [{ from: day, until: day, who: '' }] })), 'GET', q)).body.slots.length, 0);
  assert.equal((await ask(devDiary(studio({ closed: [{ from: day, until: day, who: 'evening' }] })), 'GET', q)).body.slots.length, 0);
  assert.equal((await ask(devDiary(studio({ closed: [{ from: day, until: day, who: 'morning' }] })), 'GET', q)).body.slots.length, 1);
});

// Contract 3: the rows are keyed, a day off names its class by id (upgrade3 §4.6).
test('on contract 3 a class\'s own keyed rows and a day off by id are read', async () => {
  const root = mkdtempSync(join(tmpdir(), 'devdiary-classes-3-'));
  const put = (file, value) => {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(value));
  };
  const ids = { yin: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4c51', evening: '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4c52' };
  const week = (field) => ({ key: field, label: field, kind: 'list', of: [{ key: 'day', label: 'Day', kind: 'select', options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }, { key: 'opens', label: 'Opens', kind: 'time_of_day' }, { key: 'closes', label: 'Closes', kind: 'time_of_day' }] });
  put('jtk/schema.json', {
    contract: 3,
    locale: 'de',
    blocks: [
      { type: 'course', v: 1, label: 'Course', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true }, { key: 'takes', label: 'Takes', kind: 'duration' }, { key: 'costs', label: 'Costs', kind: 'money' }, { key: 'per', label: 'Per', kind: 'select', options: ['booking', 'person'] }] },
      { type: 'session', v: 1, label: 'Class', fields: [{ key: 'title', label: 'Title', kind: 'text', required: true }, { key: 'spots', label: 'Spots', kind: 'number' }, week('hours'), { key: 'does', label: 'Does', kind: 'ref', ref: { to: ['services'], many: true } }] },
    ],
    collections: [
      { name: 'services', label: 'Services', type: 'course', route: 'none', shown_on: ['/kurse#services-{slug}'] },
      { name: 'sessions', label: 'Classes', type: 'session', route: 'none', shown_on: ['/kurse#sessions-{slug}'] },
    ],
    modules: { bookings: { services: 'services', resources: 'sessions' } },
  });
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const settings = (closed) => ({ v: 1, settings: { zone: 'Europe/Zurich', slot_every: 15, party: 2, closed, hours: days.map((day) => ({ _key: `h${day.slice(0, 3)}`, day, opens: 570, closes: 1260 })) } });
  put('jtk/modules/bookings.json', settings([]));
  put('jtk/entries/services/yinyoga.json', { id: ids.yin, collection: 'services', slug: 'yinyoga', rank: 'V', visible: true, fields: { title: 'Yin Yoga', takes: 75, costs: { minor: 2500 }, per: 'person' } });
  put('jtk/entries/sessions/evening.json', { id: ids.evening, collection: 'sessions', slug: 'evening', rank: 'V', visible: true, fields: { title: 'Abend', spots: 1, does: [ids.yin], hours: days.map((day) => ({ _key: `s${day.slice(0, 3)}`, day, opens: 1080, closes: 1155 })) } });

  const { from, to } = ahead(3);
  const q = `/availability?service=yinyoga&from=${from.toISOString()}&to=${to.toISOString()}`;
  const handler = devDiary(root);
  const [slot] = (await ask(handler, 'GET', q)).body.slots;
  assert.deepEqual(slot.free, ['evening']);
  assert.ok(['16:00', '17:00'].includes(slot.start.slice(11, 16)), slot.start);
  assert.equal((await ask(handler, 'POST', '/book', { service: 'yinyoga', start: slot.start })).status, 200);
  assert.equal((await ask(handler, 'GET', q)).body.slots.length, 0, 'one place, taken');

  const day = new Date(from.getTime() + 12 * 3600000).toISOString().slice(0, 10);
  put('jtk/modules/bookings.json', settings([{ _key: 'c1', from: day, until: day, who: ids.evening }]));
  assert.equal((await ask(devDiary(root), 'GET', q)).body.slots.length, 0, 'off by id');
});
