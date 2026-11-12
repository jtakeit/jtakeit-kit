// `jtk upgrade contract-3` (lib/upgrade.mjs) on scaffolds laid out by `jtk
// create`: the move, a second run that does nothing, every refusal with the
// tree left as it was, the platform's state where the files lack it, a kit's
// `does` by id, and a scaffold file the developer changed listed with what
// it reads. The scaffold is not installed here: the codemod reads with this
// package's TypeScript, and `jtk schema --emit-only` judges without a build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { copyThroughTheDoor, ownFile, readsOf, tokened, untokened } from '../lib/upgrade.mjs';

const bin = resolve('bin/jtk.mjs');
const KIT = resolve('test/fixtures/kit-salon.json');
const id = (n) => `0193a5c3-0000-7000-8000-${String(n).padStart(12, '0')}`;

function scaffold(...flags) {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-upgrade-'));
  const site = join(dir, 'site');
  execFileSync('node', [bin, 'create', 'probe-site', '--name', 'Probe', '--locale', 'de-CH', '--out', site, '--no-git', ...flags], { stdio: 'pipe' });
  return site;
}
const upgrade = (site, ...flags) => spawnSync('node', [bin, 'upgrade', 'contract-3', '--root', site, ...flags], { encoding: 'utf8' });
const read = (site, file) => JSON.parse(readFileSync(join(site, file), 'utf8'));
const write = (site, file, value) => {
  mkdirSync(join(site, file, '..'), { recursive: true });
  writeFileSync(join(site, file), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};
/** Every file of a tree and a hash of it, for "nothing was written". */
function snapshot(site) {
  const out = {};
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const file = join(at, entry);
      if (statSync(file).isDirectory()) walk(file);
      else out[relative(site, file)] = createHash('sha256').update(readFileSync(file)).digest('hex');
    }
  };
  walk(site);
  return out;
}
const said = (run) => `${run.stdout}${run.stderr}`;

test('a scaffold moves: the declaration in contract 3\'s words, every file at its place, the schema judged — and a second run does nothing', () => {
  const site = scaffold();
  try {
    const home = read(site, 'jtk/content/index.json');
    Object.assign(home.blocks[0], { title: 'Willkommen', image: 'media/x/a.jpg', image_alt: 'Der Laden' });
    home.blocks[2].items = [{ question: 'Termin?', answer: 'Ja.' }];
    write(site, 'jtk/content/index.json', home);

    const run = upgrade(site);
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /1 · the template reads through the door[\s\S]*2 · the declaration[\s\S]*3 · the documents[\s\S]*4 · the judge[\s\S]*5 · for a person: nothing/);
    const source = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    assert.match(source, /^export const CONTRACT = 3;$/m);
    assert.match(source, /^import type \{ Block, Collection, Field, Modules \} from '@jtakeit\/kit\/schema';$/m);
    assert.doesNotMatch(source, /export interface Field|BUSINESS_FACTS: Field|key: 'image_alt'/);
    assert.match(source, /export const SHARED: string\[\] = \['contacts'\];/);
    // The blog kept ready, not pushed, in contract 3's words all the same.
    assert.match(source, /"route": \{\n    "detail": "\/blog\/\{slug\}",\n    "listing": "\/blog",\n    "per_page": 10\n  \}/);
    assert.equal(existsSync(join(site, 'jtk/catalogue.json')), false);
    assert.equal(existsSync(join(site, 'jtk/content')), false);
    const schema = read(site, 'jtk/schema.json');
    assert.equal(schema.contract, 3);
    assert.equal(schema.locale, 'de-CH');
    const page = read(site, 'jtk/pages/index.json');
    assert.match(page.id, /^[0-9a-f-]{36}$/);
    assert.equal(page.name, 'Willkommen');
    assert.deepEqual(page.blocks[0].image, { src: 'media/x/a.jpg', alt: 'Der Laden' });
    assert.match(page.blocks[2].items[0]._key, /^k[0-9a-f]{7}$/);
    assert.deepEqual(read(site, 'jtk/shared.json').blocks.map((one) => one.type), ['contacts']);

    const before = snapshot(site);
    const again = upgrade(site);
    assert.equal(again.status, 0, said(again));
    assert.match(again.stdout, /on contract 3 already .* Nothing to do\./);
    assert.deepEqual(snapshot(site), before);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('refused, with nothing written: a language nothing declares, a half-moved tree, a catalogue the declaration left, work not committed', () => {
  const site = scaffold();
  try {
    const declared = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    // A copy in a language LOCALES does not name: no translation the platform would read.
    write(site, 'jtk/shared.en.json', { blocks: [] });
    let before = snapshot(site);
    let run = upgrade(site);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /jtk\/ holds documents in en, and src\/content\/blocks\.ts does not declare it in LOCALES.*nothing was written/s);
    assert.deepEqual(snapshot(site), before);
    rmSync(join(site, 'jtk/shared.en.json'));

    // The catalogue is the platform's; the declaration moved on without it.
    write(site, 'src/content/blocks.ts', declared.replace("label: 'Opening screen'", "label: 'First screen'"));
    before = snapshot(site);
    run = upgrade(site);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /jtk\/catalogue\.json is not what src\/content\/blocks\.ts declares \(BLOCKS\)/);
    assert.deepEqual(snapshot(site), before);
    write(site, 'src/content/blocks.ts', declared);

    // Half moved.
    write(site, 'jtk/schema.json', { contract: 3, locale: 'de-CH', blocks: [] });
    run = upgrade(site);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /this tree is half moved — jtk\/schema\.json says contract 3, jtk\/catalogue\.json is still there/);
    rmSync(join(site, 'jtk/schema.json'));

    // Work in progress: the move is its own commit.
    execFileSync('git', ['init', '-q'], { cwd: site });
    execFileSync('git', ['add', '-A'], { cwd: site });
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'scaffold'], { cwd: site });
    write(site, 'jtk/content/index.json', { ...read(site, 'jtk/content/index.json'), seo: { title: 'Neu' } });
    before = snapshot(site);
    run = upgrade(site);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /the move is one commit .*M jtk\/content\/index\.json/s);
    assert.deepEqual(snapshot(site), before);
    run = upgrade(site, '--force');
    assert.equal(run.status, 0, said(run));
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('the platform\'s state: no id made up for a site the platform has saved; --state gives it, --mint-ids says it never was', () => {
  const site = scaffold();
  try {
    write(site, 'jtk/site.json', { schema_version: 2, id: 'site-1', slug: 'probe', media_base: '', business: { name: 'Probe', city: 'Zürich', currency: 'chf' } });
    const before = snapshot(site);
    let run = upgrade(site);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /1 document\(s\) carry no id, and this site has been on the platform \(jtk\/site\.json\)[\s\S]*jtk\/content\/index\.json[\s\S]*--state <file>[\s\S]*--mint-ids/);
    assert.deepEqual(snapshot(site), before);

    const state = join(site, '..', 'state.json');
    writeFileSync(state, JSON.stringify({ site: { id: 'site-1', currency: 'eur' }, pages: [{ id: id(7), path: '/', collection: '', locale: '', kind: 'page', position: 0 }] }));
    run = upgrade(site, '--state', state);
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /ids: 0 kept from the files, 1 from the platform's state, 0 minted/);
    assert.equal(read(site, 'jtk/pages/index.json').id, id(7));
    // The platform's file, as contract 3 has it: the state's currency, the facts gone into the contacts.
    assert.deepEqual(read(site, 'jtk/site.json'), { id: 'site-1', slug: 'probe', media_base: '', currency: 'EUR' });
    const [contacts] = read(site, 'jtk/shared.json').blocks;
    assert.deepEqual([contacts.name, contacts.city], ['Probe', 'Zürich']);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
  const fresh = scaffold();
  try {
    write(fresh, 'jtk/site.json', { id: 'site-2', slug: 'probe', business: {} });
    const run = upgrade(fresh, '--mint-ids');
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /1 minted/);
  } finally {
    rmSync(join(fresh, '..'), { recursive: true, force: true });
  }
});

test('a kit: what a master does as one reference to many, by id; a name nobody has kept and asked; a changed scaffold file listed with its reads', () => {
  const site = scaffold('--kit', KIT);
  try {
    write(site, 'jtk/content/services/cut.json', { id: id(11), path: '/services/cut', collection: 'services', visible: true, blocks: [{ type: 'service', v: 1, title: 'Schnitt', takes: 45, costs: 6500 }] });
    write(site, 'jtk/content/masters/anna.json', { id: id(21), path: '/masters/anna', collection: 'masters', visible: true, blocks: [{ type: 'master', v: 1, title: 'Anna', does: [{ service: 'cut' }, { service: 'wash' }] }] });
    const settings = read(site, 'jtk/bookings.json');
    settings.blocks[0].closed = [{ from: '2026-12-01', until: '2026-12-01', who: 'anna' }];
    write(site, 'jtk/bookings.json', settings);
    // The developer's own read of a price, in a file of the scaffold's.
    const entries = readFileSync(join(site, 'src/lib/entries.ts'), 'utf8');
    write(site, 'src/lib/entries.ts', `${entries}\nexport const priceOf = (entry: Entry) => entry.fields.value('costs');\n`);

    const run = upgrade(site, '--mint-ids');
    assert.equal(run.status, 0, said(run));
    const source = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    assert.match(source, /"key": "does",[\s\S]*?"kind": "ref",\s*"ref": \{\s*"to": \[\s*"services"\s*\],\s*"many": true\s*\}/);
    assert.match(source, /"route": "none",\s*"shown_on": \[\s*"\/services#services-\{slug\}"\s*\]/);
    const anna = read(site, 'jtk/entries/masters/anna.json');
    assert.deepEqual(anna.fields.does, [id(11)]);
    assert.deepEqual(anna.fields._orphans, { does: ['wash'] });
    assert.deepEqual(read(site, 'jtk/entries/services/cut.json').fields.costs, { minor: 6500 });
    assert.equal(read(site, 'jtk/modules/bookings.json').settings.closed[0].who, id(21));
    assert.equal(read(site, 'jtk/pages/services.json').path, '/services');
    assert.match(run.stdout, /a reference to no entry — jtk\/entries\/masters\/anna\.json fields\.does names «wash»/);
    assert.match(run.stdout, /✎ src\/lib\/entries\.ts — changed here, left as it is/);
    assert.match(run.stdout, /a scaffold file the developer changed — src\/lib\/entries\.ts .*value\('costs'\): a price is \{ minor \} in contract 3 — minor\('costs'\)/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('the scaffold\'s own files: which they are, a token put back, the copy\'s read moved to the door, and what a file reads', () => {
  assert.equal(ownFile('src/lib/entries.ts'), true);
  assert.equal(ownFile('src/components/Hero.astro'), true);
  assert.equal(ownFile('src/content/blocks.ts'), false);
  assert.equal(ownFile('src/data/site.ts'), false);
  assert.equal(ownFile('src/styles/global.css'), false);
  assert.equal(tokened("import { COPY as own } from './{{LOCALE}}';"), false);
  assert.equal(tokened("titleSuffix: ' — {{NAME}}',"), true);
  assert.equal(untokened('src/copy/index.ts', "import { COPY as own } from './de-CH';\n", 'de-CH'), "import { COPY as own } from './{{LOCALE}}';\n");
  assert.equal(untokened('src/lib/page.ts', "import type { Shown } from '../copy/de-CH';\n", 'de-CH'), "import type { Shown } from '../copy/{{LOCALE}}';\n");

  const old = [
    '/** The copy. */',
    "import page from '../../jtk/content/index.json';",
    "import { LOCALE } from '../content/blocks';",
    "import { makeCopy, type Strings } from './make';",
    "export const STRINGS: Strings = { lang: LOCALE } as Strings;",
    'export const COPY = makeCopy(page, STRINGS);',
    'export const { META, HOME, FORM, PRIVACY, LISTING, A11Y, PAGE, block, str, rows, picture, gallery, jtkPath, pathAt } = COPY;',
    "export type { Shown } from './make';",
    '',
  ].join('\n');
  const moved = copyThroughTheDoor(old);
  assert.equal(
    moved,
    [
      '/** The copy. */',
      "import { LOCALE } from '../content/blocks';",
      "import { site } from '../lib/site';",
      "import { makeCopy, type Strings } from './make';",
      "export const STRINGS: Strings = { lang: LOCALE } as Strings;",
      "export const COPY = makeCopy(site.page('/'), STRINGS);",
      'export const { META, HOME, FORM, PRIVACY, LISTING, A11Y, PAGE } = COPY;',
      '',
    ].join('\n'),
  );
  assert.equal(copyThroughTheDoor(moved), undefined);

  const kinds = { money: new Set(['costs']), refs: new Set(['mentor']), lists: new Set(['does']), pictures: new Set(['image']), alts: new Set(['image_alt']) };
  const { changes } = readsOf(
    [
      "// value('costs') in a comment is not a read",
      "const a = hero.text('image_alt');",
      "const b = entry.fields.value('costs');",
      "const c = entry.fields.rows('does');",
      "const d = entry.fields.value('mentor');",
      "const e = hero.text('image');",
      "import page from '../../jtk/content/index.json';",
      '<p data-jtk-path="blocks[0].title" />',
    ].join('\n'),
    kinds,
  );
  assert.deepEqual(changes.map((one) => one.split(':')[0]), ["text('image_alt')", "value('costs')", "rows('does')", "value('mentor')", "text('image')", 'jtk/content/', 'an annotation by index, written by hand']);
});

test('a kit taken from somewhere else than the registry — a tarball in the repository, a checkout — is kept as written; a version is bumped', () => {
  const site = scaffold();
  try {
    const pkg = read(site, 'package.json');
    pkg.dependencies['@jtakeit/kit'] = 'file:vendor/jtakeit-kit-0.14.0.tgz';
    write(site, 'package.json', pkg);
    const run = upgrade(site, '--no-install');
    assert.equal(run.status, 0, said(run));
    assert.equal(read(site, 'package.json').dependencies['@jtakeit/kit'], 'file:vendor/jtakeit-kit-0.14.0.tgz');
    assert.match(run.stdout, /package\.json: @jtakeit\/kit file:vendor\/jtakeit-kit-0\.14\.0\.tgz — not from the registry, kept as written/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
  const linked = scaffold();
  try {
    const pkg = read(linked, 'package.json');
    pkg.dependencies['@jtakeit/kit'] = 'link:../kit';
    write(linked, 'package.json', pkg);
    assert.equal(upgrade(linked, '--no-install').status, 0);
    assert.equal(read(linked, 'package.json').dependencies['@jtakeit/kit'], 'link:../kit');
  } finally {
    rmSync(join(linked, '..'), { recursive: true, force: true });
  }
  const versioned = scaffold();
  try {
    const pkg = read(versioned, 'package.json');
    const now = pkg.dependencies['@jtakeit/kit'];
    pkg.dependencies['@jtakeit/kit'] = '0.1.0';
    write(versioned, 'package.json', pkg);
    const run = upgrade(versioned, '--no-install');
    assert.equal(run.status, 0, said(run));
    assert.equal(read(versioned, 'package.json').dependencies['@jtakeit/kit'], now);
    assert.match(run.stdout, new RegExp(`@jtakeit/kit 0\\.1\\.0 → ${now.replaceAll('.', '\\.')}`));
  } finally {
    rmSync(join(versioned, '..'), { recursive: true, force: true });
  }
});

test('jtk upgrade says which contract, or what it does', () => {
  const none = spawnSync('node', [bin, 'upgrade'], { encoding: 'utf8' });
  assert.equal(none.status, 0);
  assert.match(none.stderr, /jtk upgrade contract-3/);
  const four = spawnSync('node', [bin, 'upgrade', 'contract-4'], { encoding: 'utf8' });
  assert.equal(four.status, 1);
});

test('the table of the scaffold\'s versions: every version git names, this one among them, and only files the upgrade may replace', () => {
  const table = JSON.parse(readFileSync(resolve('lib/upgrade/scaffold.json'), 'utf8'));
  const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;
  assert.ok(table.versions.includes(version), `${version} is not in lib/upgrade/scaffold.json — node scripts/scaffold-hashes.mjs`);
  assert.ok(table.versions.includes('0.16.0') && table.versions.includes('0.1.0'));
  for (const [path, hashes] of Object.entries(table.files)) {
    assert.ok(ownFile(path), path);
    for (const [hash, versions] of Object.entries(hashes)) {
      assert.match(hash, /^[0-9a-f]{64}$/);
      assert.ok(versions.every((one) => table.versions.includes(one)), path);
    }
  }
});

test('refused, with nothing written: a schema contract 3\'s judge would refuse — a hint contract 2 measured in characters and the platform measures in bytes', () => {
  const site = scaffold();
  try {
    const declared = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    const hint = 'Ж'.repeat(200);
    write(site, 'src/content/blocks.ts', declared.replace("hint: 'Each answer has to read on its own, away from the page.',", `hint: '${hint}',`));
    execFileSync('node', [bin, 'catalogue', '--emit-only', '--root', site], { stdio: 'pipe' });
    const before = snapshot(site);
    const run = upgrade(site);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /the contract-3 schema this declaration makes is one the platform refuses:\n\s+✗ JTK_E_[A-Z_]+ +blocks\.questions\.hint/);
    assert.deepEqual(snapshot(site), before);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

// ── two languages (M3, wiki/95 §6, wiki/98 §7 · 3) ─────────────────────────

/** A scaffold in de-CH and English, its home page written in both, as contract 2 keeps them: a full copy per language. */
function twoLanguages({ image = 'media/x/a.jpg', localized = false } = {}) {
  const site = scaffold();
  let declared = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8').replace("export const LOCALES: string[] = [];", "export const LOCALES: string[] = ['en'];");
  if (localized) declared = declared.replace("{ key: 'image', label: 'Photograph', kind: 'media', client_editable: true },", "{ key: 'image', label: 'Photograph', kind: 'media', client_editable: true, localized: true },");
  write(site, 'src/content/blocks.ts', declared);
  execFileSync('node', [bin, 'catalogue', '--emit-only', '--root', site], { stdio: 'pipe' });
  const home = read(site, 'jtk/content/index.json');
  Object.assign(home.blocks[0], { title: 'Willkommen', image: 'media/x/a.jpg', image_alt: 'Der Laden' });
  home.blocks[2].items = [{ question: 'Termin?', answer: 'Ja.' }];
  write(site, 'jtk/content/index.json', home);
  const english = structuredClone(home);
  Object.assign(english, { path: '/en', locale: 'en', seo: { title: 'Welcome', description: '' } });
  Object.assign(english.blocks[0], { title: 'Welcome', image, image_alt: 'The shop' });
  english.blocks[2].items = [{ question: 'An appointment?', answer: 'Yes.' }];
  write(site, 'jtk/content/en.json', english);
  return site;
}

test('two languages, the shared values equal: one original, its translation beside it holding only words, each recorded as made from the original as it stands', async () => {
  const { digest } = await import('../kit/lib/translations.mjs');
  const site = twoLanguages();
  try {
    const run = upgrade(site, '--mint-ids');
    assert.equal(run.status, 0, said(run));
    assert.deepEqual(read(site, 'jtk/schema.json').locales, ['en']);
    assert.equal(existsSync(join(site, 'jtk/content')), false);
    const page = read(site, 'jtk/pages/index.json');
    assert.deepEqual(page.blocks[0].image, { src: 'media/x/a.jpg', alt: 'Der Laden' }, 'the photograph once, on the original');
    const row = page.blocks[2].items[0]._key;
    const english = read(site, 'jtk/pages/index.en.json');
    assert.deepEqual(Object.keys(english), ['of', 'locale', 'name', 'seo', 'blocks', 'translated']);
    assert.equal(english.of, page.id);
    assert.equal(english.locale, 'en');
    assert.equal(english.name, 'Welcome');
    assert.deepEqual(english.seo, { title: 'Welcome' });
    assert.deepEqual(english.blocks, [
      { _key: 'hero0001', title: 'Welcome', image: { alt: 'The shop' } },
      { _key: 'ques0001', items: [{ _key: row, question: 'An appointment?', answer: 'Yes.' }] },
    ], 'the words by the original\'s keys — the rows by the key the move gave the original\'s; no file, no cta link');
    assert.deepEqual(english.translated['blocks[hero0001].title'], { from: digest('Willkommen') });
    assert.deepEqual(english.translated['blocks[hero0001].image.alt'], { from: digest('Der Laden') });
    assert.deepEqual(english.translated[`blocks[ques0001].items[${row}].answer`], { from: digest('Ja.') });
    assert.match(run.stdout, /4 · the judge[\s\S]*jtk\/schema\.json — /);
    assert.doesNotMatch(run.stdout, /JTK_E_DOCUMENT_INVALID/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('two languages, a shared value that differs: the move stops and lists it; --take-base keeps the original\'s, or the field marked localized keeps both', () => {
  const site = twoLanguages({ image: 'media/x/b.jpg' });
  try {
    const before = snapshot(site);
    const stopped = upgrade(site, '--mint-ids');
    assert.equal(stopped.status, 1, said(stopped));
    assert.match(stopped.stderr, /1 value\(s\) the schema says are the same in every language differ between the languages' copies/);
    assert.match(stopped.stderr, /✗ jtk\/pages\/index\.en\.json blocks\[hero0001\]\.image \(hero\.image\): the original says \{"src":"media\/x\/a\.jpg"\}, jtk\/content\/en\.json says \{"src":"media\/x\/b\.jpg"\}/);
    assert.match(stopped.stderr, /--take-base=hero\.image/);
    assert.match(stopped.stderr, /localized: true/);
    assert.deepEqual(snapshot(site), before, 'nothing written');

    const taken = upgrade(site, '--mint-ids', '--take-base=hero.image');
    assert.equal(taken.status, 0, said(taken));
    assert.match(taken.stdout, /blocks\[hero0001\]\.image: en's \{"src":"media\/x\/b\.jpg"\} dropped — the original's \{"src":"media\/x\/a\.jpg"\} stands for every language/);
    assert.deepEqual(read(site, 'jtk/pages/index.en.json').blocks[0], { _key: 'hero0001', title: 'Welcome', image: { alt: 'The shop' } });
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
  const marked = twoLanguages({ image: 'media/x/b.jpg', localized: true });
  try {
    const run = upgrade(marked, '--mint-ids');
    assert.equal(run.status, 0, said(run));
    assert.match(readFileSync(join(marked, 'src/content/blocks.ts'), 'utf8'), /key: 'image', label: 'Photograph', kind: 'media', client_editable: true, localized: true/);
    assert.deepEqual(read(marked, 'jtk/pages/index.json').blocks[0].image, { src: 'media/x/a.jpg', alt: 'Der Laden' });
    assert.deepEqual(read(marked, 'jtk/pages/index.en.json').blocks[0].image, { src: 'media/x/b.jpg', alt: 'The shop' }, 'a picture per language: each keeps its own');
  } finally {
    rmSync(join(marked, '..'), { recursive: true, force: true });
  }
});

test('two languages, a page only in English: nothing to be a translation of — the move stops and lists it, nothing written', () => {
  const site = twoLanguages();
  try {
    write(site, 'jtk/content/en/about.json', { path: '/en/about', locale: 'en', seo: { title: 'About us' }, blocks: [] });
    const before = snapshot(site);
    const run = upgrade(site, '--mint-ids');
    assert.equal(run.status, 1, said(run));
    assert.match(run.stderr, /1 document\(s\) are written only in another language, and the site's own \(de-CH\) has no original for them/);
    assert.match(run.stderr, /✗ jtk\/content\/en\/about\.json \(en\): the page \/about, with no jtk\/content\/about\.json in de-CH/);
    assert.deepEqual(snapshot(site), before, 'nothing written');
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});
