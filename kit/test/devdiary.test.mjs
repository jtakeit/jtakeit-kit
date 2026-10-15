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
