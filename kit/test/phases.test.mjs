import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phasesOf, sayPhase, meanwhile } from '../lib/phases.mjs';

// The same rules as the panel's card (jtakeit-core, entities/site/writing.ts),
// asserted here so the page and the panel cannot disagree about where a site is.

const progress = (over = {}) => ({
  version: 1, rule: 'exact', kit: { kind: 'salon', version: '1' },
  brief: { sections: { Facts: true, Decisions: true }, facts: 9, open: 0, needsClient: 0, doneWhen: { done: 1, of: 4, items: [] } },
  catalogue: true,
  pages: [{ path: '/', written: true, filled: 6, of: 6 }],
  collections: { services: { entries: 3, expected: 1 } },
  settings: { hours: true, zone: true, payment: 'no' },
  facts: { placeholders: 0 }, media: 2, missing: [], changedAt: '2026-10-09T15:00:00Z',
  ...over,
});
const platform = (over = {}) => ({
  site_id: 's1', name: 'N', until: 'x', attached: false, served: false, steps: [], left: 0, panel: 'https://admin/s/s1',
  ...over,
});
const states = (where) => where.phases.map((one) => one.state).join(' ');

test('nothing read: the brief is the phase to be in, and the platform half is unseen', () => {
  const where = phasesOf(null, null);
  assert.equal(where.current, 'brief');
  assert.equal(states(where), 'current unseen unseen unseen unseen unseen unseen');
});

test('written is the still-to-do list being empty, and a later phase never counts before an earlier one', () => {
  const judged = platform({ judged: { at: 'x', ok: true, findings: 0 }, attached: true });
  const where = phasesOf(progress({ missing: ['no picture yet'] }), judged);
  assert.equal(where.current, 'writing');
  assert.equal(states(where), 'done done current left left left left');
  assert.match(sayPhase(where, progress({ missing: ['no picture yet'] }), judged), /still to do: 1$/);
  const after = phasesOf(progress(), judged);
  assert.equal(after.current, 'building');
  assert.equal(states(after), 'done done done done done current left');
});

test('the build is the phase while one moves or failed, and the preview once served', () => {
  const failed = platform({ judged: { at: 'x', ok: true, findings: 0 }, attached: true, build: { status: 'failed', error: 'JTK_E_X' } });
  const where = phasesOf(progress(), failed);
  assert.equal(where.current, 'building');
  assert.equal(sayPhase(where, progress(), failed), 'The build failed — JTK_E_X');
  const served = platform({ judged: { at: 'x', ok: true, findings: 0 }, attached: true, served: true, build: { status: 'ok' } });
  assert.equal(phasesOf(progress(), served).current, 'preview');
});

test('meanwhile is the panel\'s steps that are not the agent\'s, open first', () => {
  const half = platform({ steps: [
    { key: 'build', done: false, whose: 'agent' },
    { key: 'notifications', done: false, whose: 'business' },
    { key: 'business', done: true, whose: 'client' },
  ] });
  assert.deepEqual(meanwhile(half), {
    open: [{ key: 'notifications', name: 'Where enquiries and bookings go', done: false }],
    done: [{ key: 'business', name: 'Who owns this site', done: true }],
  });
  assert.deepEqual(meanwhile(null), { open: [], done: [] });
});
