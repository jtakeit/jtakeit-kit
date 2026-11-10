// jtk push / jtk pull on this machine alone (wiki/88 · §11, layer 3): what a
// copy lists with git and without, what never leaves it, what is refused
// before a request, the blob hashes, the archives both ways, and what a
// fetched archive may not write. The wire itself is in code-wire.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { LIMITS, Refusal, blobHash, holdingsOf, listCopy, manifestOf, pathProblem } from '../lib/code/files.mjs';
import { pack, unpack } from '../lib/code/tar.mjs';
import { applyChange } from '../lib/code/write.mjs';

const temp = () => mkdtempSync(join(tmpdir(), 'jtk-code-'));
const put = (root, path, data = `${path}\n`) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), data);
};
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const refusedPaths = (fn) => {
  try {
    fn();
  } catch (why) {
    assert.ok(why instanceof Refusal, `a Refusal, not ${why}`);
    return why.problems.map((p) => p.path);
  }
  assert.fail('expected a refusal');
};

/** A copy with something of every kind: kept, ignored by the root, re-included deeper, and never sent. */
function sampleCopy() {
  const root = temp();
  put(root, '.gitignore', '*.log\nsecret/\n');
  put(root, 'index.html');
  put(root, 'src/a.ts');
  put(root, 'src/.gitignore', '!keep.log\n');
  put(root, 'src/keep.log');
  put(root, 'debug.log');
  put(root, 'secret/x.txt');
  put(root, 'node_modules/p/index.js');
  put(root, 'src/node_modules/q/index.js');
  put(root, 'dist/index.html');
  put(root, '.jtakeit/code.json', '{}');
  put(root, '.jtakeit/state.json', '{}');
  return root;
}
const KEPT = ['.gitignore', '.jtakeit/state.json', 'index.html', 'src/.gitignore', 'src/a.ts', 'src/keep.log'];

test('without git: .gitignore read as git reads it, and .git, node_modules, dist and code.json never listed', () => {
  const root = sampleCopy();
  put(root, '.git/config', '[core]\n'); // not a repository git would recognise, but never sent all the same
  const { paths, via } = listCopy(root);
  assert.equal(via, 'gitignore');
  assert.deepEqual(paths, KEPT);
});

test('with git: ls-files decides, the never-sent paths are dropped even when not ignored, and both readings agree', () => {
  const root = sampleCopy();
  git(root, 'init', '-q');
  const { paths, via } = listCopy(root);
  assert.equal(via, 'git');
  assert.deepEqual(paths, KEPT);
  assert.deepEqual(listCopy(root, { git: false }).paths, KEPT, 'the hand reading equals git');
  // A tracked file deleted from the disk is not sent: the push deletes it.
  git(root, 'add', 'index.html');
  execFileSync('rm', [join(root, 'index.html')]);
  assert.deepEqual(manifestOf(root).files.map((f) => f.path), KEPT.filter((p) => p !== 'index.html'));
});

test('the manifest: git blob hashes equal to git hash-object, sizes, and 100755 for an executable', () => {
  const root = temp();
  put(root, 'empty.txt', '');
  put(root, 'text.md', 'Grüezi\n');
  put(root, 'bin.dat', randomBytes(70_000));
  put(root, 'run.sh', '#!/bin/sh\necho hi\n');
  chmodSync(join(root, 'run.sh'), 0o755);
  const { files } = manifestOf(root);
  assert.deepEqual(files.map((f) => f.path), ['bin.dat', 'empty.txt', 'run.sh', 'text.md']);
  for (const f of files) {
    assert.equal(f.hash, git(root, 'hash-object', f.path).trim(), f.path);
    assert.equal(f.size, statSync(join(root, f.path)).size);
    assert.equal(f.mode, f.path === 'run.sh' ? '100755' : '100644');
  }
  assert.equal(blobHash(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('refused before anything is sent, every path at once: .env, a symlink, credentials, keys, .git in any case, .gitmodules', () => {
  const root = temp();
  put(root, 'ok.txt');
  put(root, '.env', 'SECRET=1\n');
  put(root, 'config/.env.local', 'SECRET=1\n');
  symlinkSync('/etc/hosts', join(root, 'hosts'));
  put(root, '.npmrc', '//registry.npmjs.org/:_authToken=abc\n');
  put(root, 'keys/site.pem', '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----\n');
  put(root, 'keys/pkcs8.pem', '-----BEGIN PRIVATE KEY-----\nAAAA\n');
  put(root, 'src/token.ts', `export const t = 'ghp_${'a'.repeat(36)}';\n`);
  put(root, 'vendor/.GIT/config', '[core]\n');
  put(root, '.gitmodules', '');
  assert.deepEqual(refusedPaths(() => manifestOf(root)), [
    '.env', '.gitmodules', '.npmrc', 'config/.env.local', 'hosts', 'keys/pkcs8.pem', 'keys/site.pem', 'src/token.ts', 'vendor/.GIT/config',
  ]);
  // An .npmrc without a credential, a public key and the env templates are ordinary files.
  const fine = temp();
  put(fine, '.npmrc', 'engine-strict=true\n');
  put(fine, 'id.pub', '-----BEGIN PUBLIC KEY-----\n');
  put(fine, '.env.example', 'STRIPE_KEY=\n');
  put(fine, 'a/.env.sample', 'X=\n');
  put(fine, 'b/.ENV.Template', 'X=\n');
  assert.deepEqual(manifestOf(fine).files.map((f) => f.path), ['.env.example', '.npmrc', 'a/.env.sample', 'b/.ENV.Template', 'id.pub']);
});

test("the server's secret shapes, character for character: Stripe live and test keys, AWS keys, keys, .npmrc credentials", () => {
  const root = temp();
  put(root, 'a.ts', `const k = 'sk_test_${'a1'.repeat(12)}';\n`);
  put(root, 'b.ts', `const k = 'rk_live_${'Z9'.repeat(12)}';\n`);
  put(root, 'c.ini', 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE\n');
  put(root, 'd.pem', '-----BEGIN EC PRIVATE KEY-----\n');
  put(root, 'e/.npmrc', 'always-auth=true\n//npm.pkg.github.com/:_auth = abc\n');
  put(root, '.ENV.local', 'X=1\n');
  put(root, 'f.ts', `const k = 'pk_live_${'a'.repeat(24)}'; // a publishable key is public\n`);
  put(root, 'g/.npmrc', '# _authToken is set in CI\n');
  assert.deepEqual(refusedPaths(() => manifestOf(root)), ['.ENV.local', 'a.ts', 'b.ts', 'c.ini', 'd.pem', 'e/.npmrc']);
});

test('the limits of §3: a path over 4096 bytes, a file over 50 MB, a copy over 200 MB — refused without reading them', () => {
  assert.match(pathProblem(`${'a/'.repeat(2048)}b`) ?? '', /4096/);
  assert.equal(pathProblem(`${'a/'.repeat(2047)}b`), null);
  for (const bad of ['/etc/passwd', 'a/../b', 'a\\b', 'a\0b', 'a\nb', '.git/config', 'x/.Git/HEAD', 'sub/.gitmodules']) assert.ok(pathProblem(bad), bad);

  const big = temp();
  put(big, 'small.txt');
  writeFileSync(join(big, 'video.mp4'), '');
  truncateSync(join(big, 'video.mp4'), LIMITS.file + 1); // sparse: nothing is written or read
  assert.deepEqual(refusedPaths(() => manifestOf(big)), ['video.mp4']);

  const heavy = temp();
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(heavy, `part${i}.bin`), '');
    truncateSync(join(heavy, `part${i}.bin`), 45 * 1024 * 1024);
  }
  assert.throws(() => manifestOf(heavy), (why) => why instanceof Refusal && /200 MB/.test(why.message));
});

test('a pull compares only regular files, sends no hash of an .env, and refuses nothing it does not send', () => {
  const root = temp();
  put(root, 'a.txt', 'a');
  put(root, '.env', 'x');
  symlinkSync('/etc/hosts', join(root, 'hosts'));
  put(root, '.env.example', 'X=\n');
  assert.deepEqual(holdingsOf(root), [
    { path: '.env.example', hash: blobHash(Buffer.from('X=\n')) },
    { path: 'a.txt', hash: blobHash(Buffer.from('a')) },
  ], 'not even the hash of .env leaves; its template is an ordinary file');
});

const LONG = `src/content/${'a-rather-long-directory-name/'.repeat(5)}page.md`;

test('the tar it writes is read by the system tar: the paths, the bytes, the executable bit, a long and a non-ASCII name', () => {
  const entries = [
    { path: 'index.html', data: Buffer.from('<h1>hi</h1>\n'), mode: 0o644 },
    { path: 'bin/run.sh', data: Buffer.from('#!/bin/sh\n'), mode: 0o755 },
    { path: LONG, data: Buffer.from('# long\n'), mode: 0o644 },
    { path: 'src/content/zürich.md', data: Buffer.from('Grüezi\n'), mode: 0o644 },
    { path: 'big.bin', data: randomBytes(5000), mode: 0o644 },
  ];
  assert.ok(Buffer.byteLength(LONG) > 100);
  const dir = temp();
  writeFileSync(join(dir, 'a.tgz'), gzipSync(pack(entries)));
  const listed = execFileSync('tar', ['-tzf', join(dir, 'a.tgz')]).toString('utf8').trim().split('\n');
  // GNU tar prints a non-ASCII byte as an octal escape outside a UTF-8 locale; bsdtar prints it as is.
  const literal = (line) => (/\\[0-7]{3}/.test(line) ? Buffer.from(line.replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))), 'latin1').toString('utf8') : line);
  assert.deepEqual(listed.map((l) => literal(l).normalize('NFC')).sort(), entries.map((e) => e.path).sort());
  const out = join(dir, 'out');
  mkdirSync(out);
  execFileSync('tar', ['-xzf', join(dir, 'a.tgz'), '-C', out]);
  for (const e of entries) {
    assert.deepEqual(readFileSync(join(out, e.path)), e.data, e.path);
    assert.equal(statSync(join(out, e.path)).mode & 0o100, e.mode & 0o100, e.path);
  }
  // Deterministic: the same files make the same bytes.
  assert.deepEqual(pack(entries), pack(entries));
  assert.deepEqual(unpack(pack(entries)).map((e) => [e.path, e.mode, e.data.toString('base64')]), entries.map((e) => [e.path, e.mode, e.data.toString('base64')]));
});

test('reads a tar with a PAX long name written by the system tar', () => {
  const dir = temp();
  put(dir, `src/${LONG}`, 'long\n');
  put(dir, 'short.txt', 'short\n');
  execFileSync('tar', ['--format=pax', '-czf', join(dir, 'b.tgz'), '-C', dir, `src/${LONG}`, 'short.txt'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  const files = unpack(gunzipSync(readFileSync(join(dir, 'b.tgz')))).filter((e) => e.type === '0');
  assert.deepEqual(files.map((e) => [e.path, e.data.toString()]), [[`src/${LONG}`, 'long\n'], ['short.txt', 'short\n']]);
});

test('reads a ustar prefix and a GNU long name too', () => {
  // A ustar header whose path is split into prefix and name, as GNU tar writes 101–255 bytes in ustar.
  const raw = pack([{ path: 'x', data: Buffer.from('p') }]);
  const h = raw.subarray(0, 512);
  h.fill(0, 0, 100);
  h.write('file.txt', 0);
  h.write('deep/prefix/dir', 345);
  h.fill(0x20, 148, 156);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1');
  assert.equal(unpack(raw)[0].path, 'deep/prefix/dir/file.txt');
  const gnu = pack([{ path: 'ignored-L', data: Buffer.from(`${LONG}\0`), type: 'L' }, { path: 'stub', data: Buffer.from('g') }]);
  assert.equal(unpack(gnu)[0].path, LONG);
});

/** A copy, an archive of these entries, and the result of writing it: the refusal's paths, or null. */
function writeBack(entries, { asked = entries.filter((e) => (e.type ?? '0') === '0').map((e) => e.path), deleted = [], setup = () => {} } = {}) {
  const root = temp();
  put(root, 'existing.txt', 'old\n');
  setup(root);
  const before = snapshot(root);
  let refused = null;
  try {
    applyChange(root, { archive: gzipSync(pack(entries)), asked, deleted });
  } catch (why) {
    if (!(why instanceof Refusal)) throw why;
    refused = why.problems.map((p) => p.path);
    assert.deepEqual(snapshot(root), before, 'a refusal writes nothing');
  }
  return { root, refused };
}
function snapshot(root) {
  const out = {};
  const walk = (rel) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else out[p] = e.isSymbolicLink() ? '->' : readFileSync(join(root, p), 'utf8');
    }
  };
  walk('');
  return out;
}
const good = { path: 'src/good.txt', data: Buffer.from('good\n') };

test('a fetched archive is written only when every entry is sound: the files, their bits, the deletions', () => {
  const { root, refused } = writeBack(
    [good, { path: 'bin/run.sh', data: Buffer.from('#!/bin/sh\n'), mode: 0o755 }, { path: 'src', type: '5', mode: 0o755 }, { path: 'existing.txt', data: Buffer.from('new\n') }],
    { asked: ['bin/run.sh', 'existing.txt', 'src/good.txt'], deleted: ['old/deep/gone.txt'], setup: (r) => put(r, 'old/deep/gone.txt') },
  );
  assert.equal(refused, null);
  assert.equal(readFileSync(join(root, 'src/good.txt'), 'utf8'), 'good\n');
  assert.equal(readFileSync(join(root, 'existing.txt'), 'utf8'), 'new\n');
  assert.ok(statSync(join(root, 'bin/run.sh')).mode & 0o100);
  assert.equal(statSync(join(root, 'src/good.txt')).mode & 0o100, 0);
  assert.equal(existsSync(join(root, 'old')), false, 'a directory the deletion emptied goes too');
});

test('a fetched archive is refused whole for "..", .git, an absolute path, a link entry, a write through a link in the copy', () => {
  assert.deepEqual(writeBack([good, { path: '../evil.txt', data: Buffer.from('x') }]).refused, ['../evil.txt']);
  assert.deepEqual(writeBack([good, { path: 'a/../../evil.txt', data: Buffer.from('x') }]).refused, ['a/../../evil.txt']);
  assert.deepEqual(writeBack([good, { path: '.git/hooks/post-commit', data: Buffer.from('x'), mode: 0o755 }]).refused, ['.git/hooks/post-commit']);
  assert.deepEqual(writeBack([good, { path: 'sub/.GIT/config', data: Buffer.from('x') }]).refused, ['sub/.GIT/config']);
  assert.deepEqual(writeBack([good, { path: '/tmp/evil.txt', data: Buffer.from('x') }]).refused, ['/tmp/evil.txt']);
  assert.deepEqual(writeBack([good, { path: 'link', type: '2', linkname: '/etc/passwd' }], { asked: ['src/good.txt', 'link'] }).refused, ['link']);
  assert.deepEqual(writeBack([good, { path: 'hard', type: '1', linkname: 'existing.txt' }], { asked: ['src/good.txt', 'hard'] }).refused, ['hard']);

  const outside = temp();
  const through = writeBack([good, { path: 'out/evil.txt', data: Buffer.from('x') }], { setup: (r) => symlinkSync(outside, join(r, 'out')) });
  assert.deepEqual(through.refused, ['out/evil.txt']);
  assert.deepEqual(readdirSync(outside), [], 'nothing landed beyond the link');
  assert.deepEqual(writeBack([good, { path: 'ln.txt', data: Buffer.from('x') }], { setup: (r) => symlinkSync('/etc/hosts', join(r, 'ln.txt')) }).refused, ['ln.txt']);
  assert.deepEqual(writeBack([good], { deleted: ['out/x.txt'], setup: (r) => symlinkSync(outside, join(r, 'out')) }).refused, ['out/x.txt']);
});

test('a fetched archive must hold exactly what was asked for', () => {
  assert.deepEqual(writeBack([good, { path: 'extra.txt', data: Buffer.from('x') }], { asked: ['src/good.txt'] }).refused, ['extra.txt']);
  assert.deepEqual(writeBack([good], { asked: ['src/good.txt', 'missing.txt'] }).refused, ['missing.txt']);
  assert.deepEqual(writeBack([good, good]).refused, ['src/good.txt']);
});
