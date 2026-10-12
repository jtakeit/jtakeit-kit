// Scheduled entries on a laptop (lib/schedule.mjs): show_at and hide_at hide an
// entry as visible:false does, for _meta.json's drafts and for the content the
// check reads — so `jtk catalogue --dist` asks nothing of a listing about an
// entry the listing rightly leaves out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shownAt } from '../lib/schedule.mjs';
import { hiddenEntries } from '../lib/meta.mjs';
import { collectContent } from '../lib/content.mjs';

const now = Date.parse('2026-10-12T12:00:00Z');

test('the rule: visible:false always hides; show_at hides until, hide_at from; a non-time is no schedule', () => {
  assert.equal(shownAt({}, now), true);
  assert.equal(shownAt(undefined, now), true);
  assert.equal(shownAt({ visible: false, show_at: '2020-01-01T00:00:00Z' }, now), false);
  assert.equal(shownAt({ show_at: '2026-10-20T07:00:00Z' }, now), false);
  assert.equal(shownAt({ show_at: '2026-10-12T12:00:00Z' }, now), true);
  assert.equal(shownAt({ hide_at: '2026-10-12T12:00:00Z' }, now), false);
  assert.equal(shownAt({ hide_at: '2026-12-31T00:00:00Z' }, now), true);
  assert.equal(shownAt({ show_at: 'next week', hide_at: 5 }, now), true);
});

function site() {
  const root = mkdtempSync(join(tmpdir(), 'jtk-schedule-'));
  const content = join(root, 'jtk', 'content');
  mkdirSync(join(content, 'blog'), { recursive: true });
  mkdirSync(join(content, 'rates'), { recursive: true });
  const entry = (file, collection, extra) =>
    writeFileSync(join(content, file), JSON.stringify({ path: `/${file.replace(/\.json$/, '')}`, collection, blocks: [{ type: 'x', title: 'T' }], ...extra }));
  entry('blog/out.json', 'blog', { visible: true });
  entry('blog/hidden.json', 'blog', { visible: false });
  entry('blog/soon.json', 'blog', { show_at: '2026-10-20T07:00:00Z' });
  entry('blog/gone.json', 'blog', { hide_at: '2026-10-01T00:00:00Z' });
  entry('blog/window.json', 'blog', { show_at: '2026-10-01T00:00:00Z', hide_at: '2026-10-30T00:00:00Z' });
  entry('rates/later.json', 'rates', { show_at: '2027-01-01T00:00:00Z' });
  writeFileSync(join(content, 'index.json'), JSON.stringify({ path: '/', blocks: [], show_at: '2099-01-01T00:00:00Z' }));
  return { root, content };
}

test("_meta.json's drafts are the entries hidden by visible:false or by a schedule, at the build's clock", async () => {
  const { root, content } = site();
  try {
    assert.deepEqual(await hiddenEntries(content, now), ['/blog/gone/', '/blog/hidden/', '/blog/soon/', '/rates/later/']);
    // Once its hour comes, soon is out; gone and later are what they were.
    assert.deepEqual(await hiddenEntries(content, Date.parse('2026-10-21T00:00:00Z')), ['/blog/gone/', '/blog/hidden/', '/rates/later/']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the content the check reads says hidden for a scheduled entry, so its listing owes it nothing', async () => {
  const { root } = site();
  try {
    const { pages } = await collectContent(root, { now });
    const visible = Object.fromEntries(pages.filter((one) => one.collection).map((one) => [one.path, one.visible]));
    assert.deepEqual(visible, {
      '/blog/gone': false, '/blog/hidden': false, '/blog/out': true, '/blog/soon': false, '/blog/window': true, '/rates/later': false,
    });
    assert.equal(pages.find((one) => one.path === '/').visible, undefined, 'a page is no entry and carries no visible');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
