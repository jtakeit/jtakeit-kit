// jtk push / jtk pull against a stand-in for the API that speaks the wire of
// wiki/88 · §10: tokens for one operation, a manifest answered with what is
// needed, parts, done with a three-way merge on paths, state, fetch. What the
// real server adds (git, the limits, the secrets, the import) is its own
// tests'; this one holds the kit to the protocol both are written to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';
import { main } from '../lib/code.mjs';
import { blobHash } from '../lib/code/files.mjs';
import { pack, unpack } from '../lib/code/tar.mjs';

const JTK = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'jtk.mjs');
const temp = () => mkdtempSync(join(tmpdir(), 'jtk-wire-'));
const put = (root, path, data = `${path}\n`) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), data);
};
const read = (root, path) => readFileSync(join(root, path), 'utf8');

/**
 * The API's half, in memory. Commits are trees (path → hash, mode, bytes);
 * the branch is `tip`. Every request is recorded as it arrived, so a test can
 * read the request lines and the headers.
 */
async function fakeApi({ partBytes = 4096 } = {}) {
  /** @type {Map<string, Map<string, { hash: string, mode: string, data: Buffer }>>} */
  const commits = new Map();
  let tip = '';
  /** @type {Map<string, { kind: 'push' | 'pull', manifest?: any, need?: string[], parts: Buffer[], named: string[], ended: boolean }>} */
  const tokens = new Map();
  const requests = [];
  const api = { refuse: null, tokens, requests, get tip() { return tip; } };

  const tree = (sha) => commits.get(sha) ?? new Map();
  const commit = (files) => {
    const sha = createHash('sha1').update(JSON.stringify([...files].sort().map(([p, f]) => [p, f.hash, f.mode]))).update(String(commits.size)).digest('hex');
    commits.set(sha, files);
    tip = sha;
    return sha;
  };
  /** A save in the panel: these paths set (or deleted, with null) on top of the tip. */
  api.save = (changes) => {
    const files = new Map(tree(tip));
    for (const [path, data] of Object.entries(changes)) {
      if (data === null) files.delete(path);
      else files.set(path, { hash: blobHash(Buffer.from(data)), mode: '100644', data: Buffer.from(data) });
    }
    return commit(files);
  };
  api.files = () => Object.fromEntries([...tree(tip)].map(([p, f]) => [p, f.data.toString()]));
  api.mint = (kind) => {
    const token = randomBytes(32).toString('base64url');
    tokens.set(token, { kind, parts: [], named: [], ended: false });
    return `${api.origin}/v1/code#t=${token}`;
  };

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    requests.push({ line: `${req.method} ${req.url} HTTP/${req.httpVersion}`, headers: req.headers });
    const answer = (status, value) => {
      res.writeHead(status, value === undefined ? {} : { 'content-type': 'application/json' });
      res.end(value === undefined ? undefined : JSON.stringify(value));
    };
    const refuse = (status, code, message, paths = []) => answer(status, { code, message, paths });

    const op = tokens.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (!op || op.ended) return refuse(401, 'JTK_E_CODE_TOKEN', 'this URL has ended; ask for a new one');
    const route = req.url ?? '';
    const json = () => JSON.parse(body.toString() || '{}');

    if (req.method === 'POST' && route === '/v1/code/manifest' && op.kind === 'push') {
      if (api.refuse) return refuse(api.refuse.status, api.refuse.code, api.refuse.message, api.refuse.paths);
      const manifest = json();
      if (manifest.base && !commits.has(manifest.base)) return refuse(409, 'JTK_E_CODE_BASE', 'that base is not in the branch');
      const base = tree(manifest.base);
      op.manifest = manifest;
      op.need = manifest.files.filter((f) => base.get(f.path)?.hash !== f.hash).map((f) => f.path);
      return answer(200, { need: op.need, part_bytes: partBytes });
    }
    const part = /^\/v1\/code\/parts\/(\d+)$/.exec(route);
    if (req.method === 'PUT' && part && op.manifest) {
      if (Number(part[1]) !== op.parts.length + 1) return refuse(400, 'JTK_E_CODE_PART', 'parts come in order');
      op.parts.push(body);
      return answer(204);
    }
    if (req.method === 'POST' && route === '/v1/code/done' && op.manifest) {
      const { parts } = json();
      if (parts !== op.parts.length) return refuse(400, 'JTK_E_CODE_PART', 'parts missing');
      const listed = new Map(op.manifest.files.map((f) => [f.path, f]));
      const base = tree(op.manifest.base);
      const uploaded = new Map();
      if (parts) {
        for (const e of unpack(gunzipSync(Buffer.concat(op.parts)))) {
          if (e.type !== '0' || !op.need.includes(e.path) || blobHash(e.data) !== listed.get(e.path).hash) return refuse(422, 'JTK_E_CODE_REFUSED', 'archive', [e.path]);
          uploaded.set(e.path, e.data);
        }
      }
      const missing = op.need.filter((p) => !uploaded.has(p));
      if (missing.length) return refuse(422, 'JTK_E_CODE_REFUSED', 'missing from the archive', missing);
      const upload = new Map([...listed].map(([p, f]) => [p, { hash: f.hash, mode: f.mode, data: uploaded.get(p) ?? base.get(p).data }]));
      const head = tree(tip);
      const merged = new Map();
      const changed = [];
      const deleted = [];
      const conflicts = [];
      for (const path of new Set([...base.keys(), ...head.keys(), ...upload.keys()])) {
        const b = base.get(path)?.hash;
        const t = head.get(path)?.hash;
        const u = upload.get(path)?.hash;
        let take;
        if (u === b) {
          take = head.get(path);
          if (t !== b) (t ? changed : deleted).push(path);
        } else if (t === b || t === u) take = upload.get(path);
        else conflicts.push(path);
        if (take) merged.set(path, take);
      }
      if (conflicts.length) return refuse(409, 'JTK_E_CODE_CONFLICT', 'changed here and on the branch', conflicts.sort());
      const same = merged.size === head.size && [...merged].every(([p, f]) => head.get(p)?.hash === f.hash && head.get(p)?.mode === f.mode);
      const created = tip === '';
      const sha = same ? tip : commit(merged);
      op.named = changed;
      if (!changed.length) op.ended = true;
      return answer(200, {
        sha, repo: 'jtakeit-sites/fixture', created, nothing_changed: same,
        upstream: { changed: changed.sort(), deleted: deleted.sort() },
        imported: { pages: 3, created: 0 }, import_error: null,
      });
    }
    if (req.method === 'POST' && route === '/v1/code/state' && op.kind === 'pull') {
      const { base: baseSha, files } = json();
      if (baseSha && !commits.has(baseSha)) return refuse(409, 'JTK_E_CODE_BASE', 'that base is not in the branch');
      const base = tree(baseSha);
      const head = tree(tip);
      const local = new Map(files.map((f) => [f.path, f.hash]));
      const changed = [];
      const deleted = [];
      const conflicts = [];
      for (const path of new Set([...local.keys(), ...head.keys()])) {
        const l = local.get(path);
        const b = base.get(path)?.hash;
        const t = head.get(path)?.hash;
        if (l === t) continue;
        if (l === b) (t ? changed : deleted).push(path);
        else if (t !== b) conflicts.push(path);
      }
      op.named = conflicts.length ? [] : changed;
      if (!op.named.length) op.ended = true;
      return answer(200, { tip, changed: changed.sort(), deleted: deleted.sort(), conflicts: conflicts.sort() });
    }
    if (req.method === 'POST' && route === '/v1/code/fetch') {
      const { paths } = json();
      if (!paths.every((p) => op.named.includes(p))) return refuse(403, 'JTK_E_CODE_REFUSED', 'not named by the last answer');
      op.ended = true;
      const head = tree(tip);
      res.writeHead(200, { 'content-type': 'application/gzip' });
      return res.end(gzipSync(pack(paths.map((p) => ({ path: p, data: head.get(p).data, mode: head.get(p).mode === '100755' ? 0o755 : 0o644 })))));
    }
    return refuse(404, 'JTK_E_NOT_FOUND', `no ${req.method} ${route} for this token`);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  api.origin = `http://127.0.0.1:${server.address().port}`;
  api.close = () => new Promise((ok) => server.close(ok));
  return api;
}

/** Run a command in-process and keep what it printed. */
async function jtk(command, url, dir, extra = []) {
  const lines = [];
  const status = await main(command, [url, ...extra], { cwd: dir, out: (l) => lines.push(l), err: (l) => lines.push(l) });
  return { status, output: lines.join('\n') };
}

/** No request line carried a token, every request carried one as a bearer, and no output named it. */
function assertTokenKept(api, ...outputs) {
  for (const token of api.tokens.keys()) {
    for (const r of api.requests) assert.ok(!r.line.includes(token), `a token in the request line: ${r.line}`);
    for (const out of outputs) assert.ok(!out.includes(token), 'a token in the output');
  }
  for (const r of api.requests) assert.match(r.headers.authorization ?? '', /^Bearer [A-Za-z0-9_-]{43}$/);
}

const position = (dir) => JSON.parse(read(dir, '.jtakeit/code.json'));

function siteCopy() {
  const dir = temp();
  put(dir, '.gitignore', 'node_modules/\n');
  put(dir, 'package.json', '{"name":"fixture"}\n');
  put(dir, 'src/pages/index.astro', '<h1>Salon</h1>\n');
  put(dir, `src/content/${'deep-directory-name/'.repeat(6)}entry.md`, '# Long\n');
  put(dir, 'jtk/content/home.json', '{"title":"Home"}\n');
  put(dir, 'scripts/build.sh', '#!/bin/sh\n');
  chmodSync(join(dir, 'scripts/build.sh'), 0o755);
  put(dir, 'node_modules/x/index.js');
  put(dir, 'public/photo.bin', randomBytes(20_000)); // more than one 4 KB part, gzipped
  return dir;
}

test('first push: the manifest, every file in parts, done, and the position recorded', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const dir = siteCopy();
  const { status, output } = await jtk('push', api.mint('push'), dir);
  assert.equal(status, 0, output);
  assert.match(output, new RegExp(`jtk push: ${api.tip} on jtakeit-sites/fixture, a new repository`));
  assert.match(output, /sent 7 of 7 files .* [2-9] parts\)/);
  assert.deepEqual(Object.keys(api.files()).sort(), [
    '.gitignore', 'jtk/content/home.json', 'package.json', 'public/photo.bin', 'scripts/build.sh',
    `src/content/${'deep-directory-name/'.repeat(6)}entry.md`, 'src/pages/index.astro',
  ]);
  assert.deepEqual(position(dir), { sha: api.tip, api: api.origin });
  const lines = api.requests.map((r) => r.line.split(' ').slice(0, 2).join(' '));
  assert.equal(lines[0], 'POST /v1/code/manifest');
  assert.ok(lines.slice(1, -1).every((l, i) => l === `PUT /v1/code/parts/${i + 1}`));
  assert.equal(lines.at(-1), 'POST /v1/code/done');
  assertTokenKept(api, output);
});

test('a push with nothing needed sends no parts and says nothing changed', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const dir = siteCopy();
  assert.equal((await jtk('push', api.mint('push'), dir)).status, 0);
  const tip = api.tip;
  api.requests.length = 0;
  const { status, output } = await jtk('push', api.mint('push'), dir);
  assert.equal(status, 0, output);
  assert.match(output, /nothing changed/);
  assert.equal(api.tip, tip);
  assert.deepEqual(api.requests.map((r) => r.line.split(' ')[1]), ['/v1/code/manifest', '/v1/code/done']);
  assertTokenKept(api, output);
});

test('a push after the panel saved: merged, and what the panel changed written here so the copy ends at the tip', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const dir = siteCopy();
  await jtk('push', api.mint('push'), dir);
  api.save({ 'jtk/content/home.json': '{"title":"Willkommen"}\n', 'jtk/content/new.json': '{"n":1}\n', 'package.json': null });
  put(dir, 'src/pages/index.astro', '<h1>Salon Zürich</h1>\n');
  const { status, output } = await jtk('push', api.mint('push'), dir);
  assert.equal(status, 0, output);
  assert.match(output, /sent 1 of 7 files/);
  assert.match(output, /jtk\/content\/home\.json\n.*jtk\/content\/new\.json\n.*package\.json \(deleted\)/);
  assert.equal(read(dir, 'jtk/content/home.json'), '{"title":"Willkommen"}\n');
  assert.equal(read(dir, 'jtk/content/new.json'), '{"n":1}\n');
  assert.equal(existsSync(join(dir, 'package.json')), false);
  assert.equal(api.files()['src/pages/index.astro'], '<h1>Salon Zürich</h1>\n');
  assert.equal(position(dir).sha, api.tip);
  assertTokenKept(api, output);
});

test('pull into an empty directory is a clone: every file, its executable bit, the tip recorded', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const source = siteCopy();
  await jtk('push', api.mint('push'), source);
  const parent = temp();
  const { status, output } = await jtk('pull', api.mint('pull'), parent, ['clone']);
  assert.equal(status, 0, output);
  const dir = join(parent, 'clone');
  assert.match(output, new RegExp(`cloned 7 files at ${api.tip}`));
  for (const [path, data] of Object.entries(api.files())) assert.equal(read(dir, path), data, path);
  assert.ok(statSync(join(dir, 'scripts/build.sh')).mode & 0o100);
  assert.deepEqual(position(dir), { sha: api.tip, api: api.origin });

  // Up to date: the state names nothing, nothing is fetched, and the URL has ended.
  api.requests.length = 0;
  const again = await jtk('pull', api.mint('pull'), dir);
  assert.equal(again.status, 0, again.output);
  assert.match(again.output, /already there/);
  assert.deepEqual(api.requests.map((r) => r.line.split(' ')[1]), ['/v1/code/state']);
  assertTokenKept(api, output, again.output);
});

test('pull with a conflict names the paths, exits non-zero and writes nothing', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const dir = siteCopy();
  await jtk('push', api.mint('push'), dir);
  const before = position(dir);
  put(dir, 'jtk/content/home.json', '{"title":"Mine"}\n');
  api.save({ 'jtk/content/home.json': '{"title":"Theirs"}\n', 'src/pages/index.astro': '<h1>Theirs</h1>\n' });
  const { status, output } = await jtk('pull', api.mint('pull'), dir);
  assert.equal(status, 1);
  assert.match(output, /jtk pull: conflict — .*nothing was written[^]*\n {2}jtk\/content\/home\.json$/);
  assert.equal(read(dir, 'jtk/content/home.json'), '{"title":"Mine"}\n');
  assert.equal(read(dir, 'src/pages/index.astro'), '<h1>Salon</h1>\n', 'not even the file without a conflict');
  assert.deepEqual(position(dir), before);
  assert.ok(!api.requests.some((r) => r.line.includes('/fetch')));
});

test('a refusal from the server is printed with its code, message and paths — and the token taken out of it', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const dir = siteCopy();
  const url = api.mint('push');
  const token = new URL(url).hash.slice(3);
  api.refuse = { status: 422, code: 'JTK_E_CODE_REFUSED', message: `a path the platform does not take (token ${token})`, paths: ['public/photo.bin'] };
  const { status, output } = await jtk('push', url, dir);
  assert.equal(status, 1);
  assert.equal(output, 'jtk push: JTK_E_CODE_REFUSED — a path the platform does not take (token <token>)\n  public/photo.bin');
  assert.equal(existsSync(join(dir, '.jtakeit/code.json')), false);
  assertTokenKept(api, output);
});

test('the command line: .env or a symlink refused with its path before any request, exit 1', async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const dir = siteCopy();
  put(dir, '.env', 'STRIPE_KEY=x\n');
  const run = promisify(execFile);
  const url = api.mint('push');
  const failed = await run(process.execPath, [JTK, 'push', url], { cwd: dir }).then(() => null, (why) => why);
  assert.ok(failed, 'exits non-zero');
  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /refused here, before anything was sent:\n {2}\.env — is an environment file/);
  assert.equal(api.requests.length, 0, 'nothing reached the server');
  assertTokenKept(api, failed.stdout, failed.stderr);

  rmSync(join(dir, '.env'));
  const { symlinkSync } = await import('node:fs');
  symlinkSync('../package.json', join(dir, 'src/pages/link.json'));
  const linked = await run(process.execPath, [JTK, 'push', url], { cwd: dir }).then(() => null, (why) => why);
  assert.equal(linked?.code, 1);
  assert.match(linked.stderr, /src\/pages\/link\.json — is a symbolic link/);
  assert.equal(api.requests.length, 0);
});

test('a URL that would leak or mislead is refused before any request', async () => {
  const dir = temp();
  for (const [url, why] of [
    ['http://api.example.com/v1/code#t=abc', /https only/],
    ['https://api.example.com/v1/code', /no token/],
    ['not a url', /not a URL/],
  ]) {
    const { status, output } = await jtk('push', url, dir);
    assert.equal(status, 1);
    assert.match(output, why);
    assert.ok(!output.includes('abc'));
  }
  // A copy that came from another API is not pushed to this one with its base.
  put(dir, '.jtakeit/code.json', JSON.stringify({ sha: 'a'.repeat(40), api: 'https://api.jtakeit.com' }));
  const { status, output } = await jtk('pull', 'http://127.0.0.1:1/v1/code#t=abc', dir);
  assert.equal(status, 1);
  assert.match(output, /last pushed or pulled at https:\/\/api\.jtakeit\.com/);
  assert.deepEqual(readdirSync(dir), ['.jtakeit']);
});
