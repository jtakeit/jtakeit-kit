import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filesBeside } from '../lib/judgeFiles.mjs';

// `jtk catalogue --judge` sends the jtk/ files to the platform's judge. It
// sent jtk/session.json too, which holds the dev session's watch key, and an
// entry's pictures under media/ are not the contract's.
test('the judge is sent the contract files and not the session or the pictures', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-judge-'));
  mkdirSync(join(root, 'jtk', 'content', 'blog', 'media'), { recursive: true });
  writeFileSync(join(root, 'jtk', 'catalogue.json'), '{}');
  writeFileSync(join(root, 'jtk', 'session.json'), '{"key":"secret"}');
  writeFileSync(join(root, 'jtk', 'site.json'), '{}');
  writeFileSync(join(root, 'jtk', 'content', 'index.json'), '{"path":"/"}');
  writeFileSync(join(root, 'jtk', 'content', 'blog', 'media', 'stray.json'), '{}');

  const sent = filesBeside(root).map((one) => one.path);
  assert.deepEqual(sent, ['jtk/content/index.json', 'jtk/site.json']);
});
