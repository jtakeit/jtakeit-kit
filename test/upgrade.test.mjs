// `jtk upgrade contract-3` (lib/upgrade.mjs) on scaffolds laid out by `jtk
// create --contract 2`: the move, a second run that does nothing, every refusal with the
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
import { closeOver, copyThroughTheDoor, exportsOf, importsOf, namedImportsOf, ownFile, provenanceOf, readsOf, resolveImport, stateFromThePlatform, tokened, untokened } from '../lib/upgrade.mjs';

const bin = resolve('bin/jtk.mjs');
const KIT = resolve('test/fixtures/kit-salon.json');
const id = (n) => `0193a5c3-0000-7000-8000-${String(n).padStart(12, '0')}`;

function scaffold(...flags) {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-upgrade-'));
  const site = join(dir, 'site');
  execFileSync('node', [bin, 'create', 'probe-site', '--name', 'Probe', '--locale', 'de-CH', '--out', site, '--no-git', '--contract', '2', ...flags], { stdio: 'pipe' });
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
    assert.equal(page.name, 'Startseite', 'the home page by the word for it, not its heading');
    assert.deepEqual(page.blocks[0].image, { src: 'media/x/a.jpg', alt: 'Der Laden' });
    assert.match(page.blocks[2].items[0]._key, /^k[0-9a-f]{7}$/);
    assert.deepEqual(read(site, 'jtk/shared.json').blocks.map((one) => one.type), ['contacts']);
    // The form: contract 3's, every word on it the block's — the question's
    // words declared, and what a visitor read written in the site's language.
    assert.match(run.stdout, /↻ src\/components\/LeadForm\.astro — the scaffold's [0-9.]+, untouched: replaced with the door's/);
    assert.equal(readFileSync(join(site, 'src/components/LeadForm.astro'), 'utf8'), readFileSync(resolve('template/contract-3/src/components/LeadForm.astro'), 'utf8'));
    const banner = read(site, 'jtk/schema.json').blocks.find((one) => one.type === 'cta_banner');
    assert.deepEqual(banner.fields.at(-1), { key: 'topic_label', label: 'Label for the “topic” field', kind: 'text', max: 120, client_editable: true });
    assert.equal(banner.asks[0].label, 'Worum es geht', 'the declaration\'s label still names the answer in the inbox');
    assert.match(source, /\/\/ What a visitor reads over each question in asks: the owner's words, since `jtk upgrade contract-3`\.\n\s*\{\n\s*key: 'topic_label',/);
    const form = page.blocks.find((one) => one.type === 'cta_banner');
    assert.deepEqual(
      { cta_label: form.cta_label, name_label: form.name_label, contact_label: form.contact_label, message_label: form.message_label, topic_label: form.topic_label },
      { cta_label: 'Senden', name_label: 'Name', contact_label: 'Telefon oder E-Mail', message_label: 'Nachricht', topic_label: 'Worum es geht' },
    );
    assert.equal(existsSync(join(site, 'jtk/pages/index.en.json')), false, 'a translation only for a language the site has');

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

test('a form the developer changed: left, its questions\' words the declaration\'s, and that said for a person; the owner\'s own words kept', () => {
  const site = scaffold();
  try {
    const form = readFileSync(join(site, 'src/components/LeadForm.astro'), 'utf8');
    write(site, 'src/components/LeadForm.astro', `${form}\n<p class="note">Wir antworten am selben Tag.</p>\n`);
    const home = read(site, 'jtk/content/index.json');
    Object.assign(home.blocks[1], { name_label: 'Ihr Name' });
    write(site, 'jtk/content/index.json', home);
    const run = upgrade(site);
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /✎ src\/components\/LeadForm\.astro — changed here, left as it is/);
    assert.match(run.stdout, /a question whose words are the declaration's — src\/components\/LeadForm\.astro is the developer's, so the words over «topic» stay the declaration's label/);
    assert.equal(read(site, 'jtk/schema.json').blocks.find((one) => one.type === 'cta_banner').fields.some((one) => one.key === 'topic_label'), false);
    const banner = read(site, 'jtk/pages/index.json').blocks.find((one) => one.type === 'cta_banner');
    assert.equal(banner.name_label, 'Ihr Name');
    assert.equal(banner.contact_label, undefined, 'nothing written for a form that is not the scaffold\'s');
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
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
    assert.equal(english.name, 'Home', 'the home page by the word for it in English (B11)');
    assert.deepEqual(english.seo, { title: 'Welcome' });
    assert.deepEqual(english.blocks, [
      { _key: 'hero0001', title: 'Welcome', image: { alt: 'The shop' } },
      { _key: 'ques0001', items: [{ _key: row, question: 'An appointment?', answer: 'Yes.' }] },
      // What the English page's form said, in the kit's English, now the owner's words to tap.
      { _key: 'ctab0001', cta_label: 'Send', name_label: 'Name', contact_label: 'Phone or email', message_label: 'Message', topic_label: 'What it is about' },
    ], 'the words by the original\'s keys — the rows by the key the move gave the original\'s; no file, no cta link; the form\'s words in English');
    assert.equal(Object.keys(english.translated).some((place) => place.startsWith('blocks[ctab0001]')), false, 'the form\'s words written by the move carry no record: the import records them');
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

test('jtk copy: a language\'s words that are not content, in the kit\'s, beside the copy registry; refused for the site\'s own, an unknown language and over one there', () => {
  const site = scaffold();
  try {
    const run = spawnSync('node', [bin, 'copy', 'en', '--root', site], { encoding: 'utf8' });
    assert.equal(run.status, 0, said(run));
    const text = readFileSync(join(site, 'src/copy/en.ts'), 'utf8');
    assert.match(text, /^  lang: 'en',$/m);
    assert.match(text, /skipToContent: 'Skip to content'/);
    assert.match(text, /titleSuffix: ' — Probe'/);
    assert.match(text, /makeCopy\(site\.page\('\/', 'en'\), STRINGS\)/);
    assert.doesNotMatch(text, /\{\{[A-Z_]+\}\}|from '\.\.\/content\/blocks'/);
    assert.match(run.stdout, /contract 2 registers it in src\/copy\/index\.ts by hand/);
    assert.equal(spawnSync('node', [bin, 'copy', 'en', '--root', site]).status, 1, 'not over one that is there');
    assert.equal(spawnSync('node', [bin, 'copy', 'de-CH', '--root', site]).status, 1, 'not the site\'s own');
    assert.match(spawnSync('node', [bin, 'copy', 'nl', '--root', site], { encoding: 'utf8' }).stderr, /the kit has no words for nl/);
    assert.match(readFileSync(join(site, 'src/copy/en.ts'), 'utf8'), /lang: 'en'/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('jtk copy on contract 3: the form\'s words, content, in the language\'s translation and the site\'s own where nobody wrote them — the kit\'s, a label\'s own words for the language, never over the owner\'s', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jtk-copy3-'));
  const site = join(dir, 'site');
  try {
    execFileSync('node', [bin, 'create', 'probe-three', '--name', 'Probe', '--locale', 'de-CH', '--out', site, '--no-git'], { stdio: 'pipe' });
    const home = read(site, 'jtk/pages/index.json');
    const form = home.blocks.find((one) => one.type === 'cta_banner');
    assert.equal(form.topic_label, 'Worum es geht', 'jtk create writes the question\'s words in the site\'s language');
    // A site laid out before the form's words were content: none written, and the owner's own over the message.
    for (const field of ['cta_label', 'name_label', 'contact_label', 'topic_label']) delete form[field];
    form.message_label = 'Ihre Frage';
    write(site, 'jtk/pages/index.json', home);
    // A second question, its words written per language in the declaration.
    const blocks = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8')
      .replace("asks: [{ key: 'topic', label: 'Worum es geht', kind: 'text', max: 120 }],", "asks: [{ key: 'topic', label: 'Worum es geht', kind: 'text', max: 120 }, { key: 'wished_day', label: { 'de-CH': 'Wunschtag', fr: 'Jour souhaité' }, kind: 'date' }],")
      .replace("{ key: 'topic_label', label: 'Label for the “topic” field', kind: 'text', max: 120, client_editable: true },", "{ key: 'topic_label', label: 'Label for the “topic” field', kind: 'text', max: 120, client_editable: true },\n      { key: 'wished_day_label', label: 'Label for the “wished day” field', kind: 'text', max: 120, client_editable: true },")
      .replace('export const LOCALES: string[] = [];', "export const LOCALES: string[] = ['fr'];");
    assert.match(blocks, /wished_day_label/);
    write(site, 'src/content/blocks.ts', blocks);
    spawnSync('node', [bin, 'schema', '--emit-only', '--root', site], { encoding: 'utf8' });

    const run = spawnSync('node', [bin, 'copy', 'fr', '--root', site], { encoding: 'utf8' });
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /src\/copy\/fr\.ts — written in the kit's words for fr/);
    assert.match(run.stdout, /jtk\/pages\/index\.fr\.json: cta_label, name_label, contact_label, topic_label, wished_day_label — the form's words/);
    const own = read(site, 'jtk/pages/index.json').blocks.find((one) => one.type === 'cta_banner');
    assert.deepEqual(
      [own.cta_label, own.name_label, own.contact_label, own.message_label, own.topic_label, own.wished_day_label],
      ['Senden', 'Name', 'Telefon oder E-Mail', 'Ihre Frage', 'Worum es geht', 'Wunschtag'],
      'the site\'s own language where nobody wrote them, and the owner\'s words kept',
    );
    const french = read(site, 'jtk/pages/index.fr.json');
    assert.equal(french.of, home.id);
    assert.equal(french.locale, 'fr');
    assert.deepEqual(french.blocks, [{ _key: form._key, cta_label: 'Envoyer', name_label: 'Nom', contact_label: 'Téléphone ou e-mail', topic_label: 'De quoi il s’agit', wished_day_label: 'Jour souhaité' }], 'the owner\'s «Ihre Frage» is theirs to translate');
    assert.equal(french.translated, undefined);

    // Again: the copy is there, nothing left to write — refused as before, and nothing changed.
    const before = snapshot(site);
    assert.equal(spawnSync('node', [bin, 'copy', 'fr', '--root', site]).status, 1);
    assert.deepEqual(snapshot(site), before);
    // The copy there and the translation's words taken out: written again, the copy left.
    write(site, 'jtk/pages/index.fr.json', { of: home.id, locale: 'fr', name: 'Accueil' });
    const again = spawnSync('node', [bin, 'copy', 'fr', '--root', site], { encoding: 'utf8' });
    assert.equal(again.status, 0, said(again));
    assert.match(again.stdout, /src\/copy\/fr\.ts is there, and it is the site's: left as it is/);
    assert.equal(read(site, 'jtk/pages/index.fr.json').name, 'Accueil');
    assert.equal(read(site, 'jtk/pages/index.fr.json').blocks[0].name_label, 'Nom');
    // A language the schema does not name: no translation the platform would read.
    const unnamed = spawnSync('node', [bin, 'copy', 'it', '--root', site], { encoding: 'utf8' });
    assert.equal(unnamed.status, 0, said(unnamed));
    assert.match(unnamed.stdout, /the form's words in it are written into its translation once LOCALES in src\/content\/blocks\.ts names it/);
    assert.equal(existsSync(join(site, 'jtk/pages/index.it.json')), false);
    // And the tree is one the judge takes.
    const judged = spawnSync('node', [bin, 'schema', '--emit-only', '--root', site], { encoding: 'utf8' });
    assert.equal(judged.status, 0, said(judged));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── what the KAIF move found (16 November 2026) ─────────────────────────────

const OLD = (version, path) => readFileSync(resolve('test/fixtures/scaffold-old', version, path), 'utf8');
/** Every relative import of the site's code that leads nowhere: what the move must never leave. */
function unresolved(site) {
  const out = [];
  const code = [];
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      if (['node_modules', 'dist', '.git'].includes(entry)) continue;
      const file = join(at, entry);
      if (statSync(file).isDirectory()) walk(file);
      else if (/\.(ts|astro|mjs|js)$/.test(entry)) code.push(relative(site, file).split('\\').join('/'));
    }
  };
  walk(join(site, 'src'));
  for (const path of code) {
    for (const spec of importsOf(readFileSync(join(site, path), 'utf8'))) {
      if (resolveImport(path, spec, (one) => existsSync(join(site, one)) && statSync(join(site, one)).isFile()) === undefined) out.push(`${path} → ${spec}`);
    }
  }
  return out;
}

test('B2: a file replaced brings the scaffold\'s files it imports, or is left with the partner the developer changed; nothing imports what is not there; src/live/ only on a site ready to be drawn live (B7)', () => {
  const site = scaffold();
  try {
    // Contract 2's pair, the loader changed by the developer: contract 3's
    // content.config.ts calls entries() with no collection, and cannot go in alone.
    write(site, 'src/content.config.ts', OLD('0.16.0', 'src/content.config.ts'));
    write(site, 'src/lib/entryLoader.ts', `${OLD('0.16.0', 'src/lib/entryLoader.ts')}\n// the developer's\n`);
    // An old sitemap, untouched, and the files contract 3's imports taken away.
    write(site, 'src/pages/sitemap.xml.ts', OLD('0.6.0', 'src/pages/sitemap.xml.ts'));
    rmSync(join(site, 'src/lib/pages.ts'));
    rmSync(join(site, 'src/live'), { recursive: true });
    // The developer's own read of the home page by its file, as KAIF's copy had it.
    write(site, 'src/lib/own.ts', "import home from '../../jtk/content/index.json';\nexport const title = (home as any).blocks[0].title;\n");
    const run = upgrade(site, '--mint-ids', '--no-check');
    assert.equal(run.status, 0, said(run));
    // The pair: left as it was, and said with what keeps it.
    assert.equal(readFileSync(join(site, 'src/content.config.ts'), 'utf8'), OLD('0.16.0', 'src/content.config.ts'));
    assert.match(run.stdout, /· src\/content\.config\.ts — the scaffold's 0\.1\.0–0\.16\.0, untouched, and left — contract 3's content\.config\.ts imports src\/lib\/entryLoader\.ts, which is not the scaffold's as it is now/);
    assert.match(run.stdout, /a scaffold file left as it was — src\/content\.config\.ts .*COLLECTIONS from src\/content\/blocks\.ts/);
    assert.match(run.stdout, /a scaffold file the developer changed — src\/lib\/entryLoader\.ts .*a collection's prefix: .*\(line \d+, \d+/);
    // The sitemap: replaced, and what it imports laid in with it.
    assert.match(run.stdout, /↻ src\/pages\/sitemap\.xml\.ts — the scaffold's 0\.1\.0–0\.6\.0, untouched: replaced with the door's/);
    assert.match(run.stdout, /\+ src\/lib\/pages\.ts — the scaffold's, which a file written here imports and this site has not got/);
    assert.equal(readFileSync(join(site, 'src/lib/pages.ts'), 'utf8'), readFileSync(resolve('template/src/lib/pages.ts'), 'utf8'));
    // A document imported by its file: named where the move put it, and its read listed.
    assert.equal(readFileSync(join(site, 'src/lib/own.ts'), 'utf8').split('\n')[0], "import home from '../../jtk/pages/index.json';");
    assert.match(run.stdout, /↻ src\/lib\/own\.ts — imports jtk\/pages\/index\.json, where the move put jtk\/content\/index\.json/);
    assert.match(run.stdout, /a read the move changes — src\/lib\/own\.ts: jtk\/content\/: .*\(line 1\)/);
    // Not ready to be drawn live: its files not laid in.
    assert.equal(existsSync(join(site, 'src/live')), false);
    assert.match(run.stdout, /the live preview — .*src\/lib\/entryLoader\.ts is not the scaffold's.*src\/live\/ is not laid in/);
    // Where the site came from, by its files, and not by the catalogue's generator.
    assert.match(run.stdout, /the scaffold this site came from, by its files: 0\.17\.0 \(\d+ untouched files, most of them\)/);
    // The planted loader is 0.16.0's, whose own imports (specimens.mjs, ./schedule) a 0.17.0 scaffold has not got: the developer's file, not the move's.
    assert.deepEqual(unresolved(site).filter((one) => !one.startsWith('src/lib/entryLoader.ts ')), []);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('B2: closed over imports — brought where the site lacks a file, not written where a partner is the developer\'s, a name gone, or a file nobody has; what was brought for nothing, not brought', () => {
  const template = new Map([
    ['src/a.ts', "import { b } from './lib/b';\nexport const a = b;\n"],
    ['src/lib/b.ts', "import { c } from './c';\nexport const b = c;\n"],
    ['src/lib/c.ts', 'export const c = 1;\n'],
    ['src/d.ts', "import { e } from './lib/e';\nexport const d = e;\n"],
    ['src/lib/e.ts', 'export const e = 2;\n'],
    ['src/f.ts', "import { g } from './lib/g';\nexport const f = g;\n"],
    ['src/h.ts', 'export const h2 = 3;\n'],
  ]);
  const site = new Map([
    ['src/a.ts', 'old a'],
    ['src/d.ts', 'old d'],
    ['src/lib/e.ts', 'export const e = 2; // changed\n'],
    ['src/f.ts', 'old f'],
    ['src/h.ts', 'export const h = 3;\n'],
    ['src/uses-h.ts', "import { h } from './h';\n"],
  ]);
  const tree = {
    exists: (path) => site.has(path),
    text: (path) => site.get(path),
    template,
    current: (path) => site.get(path) === template.get(path),
    files: [...site.keys()],
  };
  const seeds = new Map([['src/a.ts', template.get('src/a.ts')], ['src/d.ts', template.get('src/d.ts')], ['src/f.ts', template.get('src/f.ts')], ['src/h.ts', template.get('src/h.ts')]]);
  const { writes, brought, dropped } = closeOver(seeds, tree);
  assert.deepEqual([...writes.keys()].sort(), ['src/a.ts', 'src/lib/b.ts', 'src/lib/c.ts']);
  assert.deepEqual(brought, ['src/lib/b.ts', 'src/lib/c.ts']);
  assert.deepEqual(dropped.map((one) => one.path).sort(), ['src/d.ts', 'src/f.ts', 'src/h.ts']);
  assert.match(dropped.find((one) => one.path === 'src/d.ts').why, /imports src\/lib\/e\.ts, which is not the scaffold's/);
  assert.match(dropped.find((one) => one.path === 'src/f.ts').why, /imports \.\/lib\/g, which this site has not got/);
  assert.match(dropped.find((one) => one.path === 'src/h.ts').why, /src\/uses-h\.ts imports h from it/);
  // A file brought that cannot be laid in is not brought again: the one that needs it is not written, and the closure ends.
  const chain = closeOver(new Map([['src/x.ts', "import { y } from './lib/y';\n"]]), {
    exists: (path) => path === 'src/lib/z.ts',
    text: (path) => (path === 'src/lib/z.ts' ? 'export const z = 0; // changed\n' : undefined),
    template: new Map([['src/x.ts', "import { y } from './lib/y';\n"], ['src/lib/y.ts', "import { z } from './z';\nexport const y = z;\n"], ['src/lib/z.ts', 'export const z = 0;\n']]),
    current: () => false,
    files: ['src/lib/z.ts'],
  });
  assert.deepEqual([...chain.writes.keys()], []);
  assert.deepEqual(chain.dropped.map((one) => one.path), ['src/x.ts']);
  assert.match(chain.dropped[0].why, /src\/lib\/y\.ts, which this site has not got and which cannot be laid in: it imports src\/lib\/z\.ts/);
  // What a file imports and exports, as the closure reads it.
  assert.deepEqual(importsOf("// import x from './no'\nimport a, { b as c, type D } from './x';\nexport * from '../y';\nconst z = await import('./z.mjs');\nimport 'astro:content';"), ['./x', '../y', './z.mjs']);
  assert.deepEqual(namedImportsOf("import a, { b as c, type D } from './x';", './x'), ['default', 'b', 'D']);
  assert.equal(namedImportsOf("import * as all from './x';", './x'), undefined);
  assert.deepEqual([...exportsOf('export const { META, HOME } = COPY;\nexport type { Shown } from \'./make\';\nexport async function f() {}\n')].sort(), ['HOME', 'META', 'Shown', 'f']);
  assert.deepEqual([...exportsOf('---\nexport interface Props {}\n---\n<p/>', 'src/X.astro')].sort(), ['Props', 'default']);
});

test('B2: where a site came from is what its untouched files agree on, not what the catalogue\'s generator says', () => {
  const order = ['0.1.0', '0.2.0', '0.9.2', '0.16.0', '0.17.0'];
  assert.deepEqual(provenanceOf([['0.1.0', '0.2.0', '0.9.2'], ['0.1.0', '0.2.0'], ['0.1.0', '0.2.0', '0.9.2', '0.16.0']], order), { versions: ['0.1.0', '0.2.0'], files: 3, all: true });
  assert.deepEqual(provenanceOf([['0.1.0'], ['0.16.0'], ['0.16.0', '0.17.0']], order), { versions: ['0.16.0'], files: 2, all: false });
  assert.equal(provenanceOf([], order), undefined);
});

test('B3: the reads a contract-2 template makes that the detector missed — a path joined, drafts, the declaration\'s collections, a picture\'s words by key, an annotation by address — each with its lines', () => {
  const kinds = { money: new Set(), refs: new Set(), lists: new Set(), pictures: new Set(['cover']), alts: new Set(['cover_alt']) };
  const meta = readsOf(
    [
      "import { join } from 'node:path';",
      'export function meta() {',
      "  return { hooks: { 'astro:build:done': async ({ dir }) => {",
      "    const root = join(process.cwd(), 'jtk', 'content');",
      '    const drafts = [];',
      "    await write(join(dir, '_meta.json'), JSON.stringify({ redirects: [], drafts }));",
      '  } } };',
      '}',
    ].join('\n'),
    kinds,
  );
  assert.deepEqual(meta.changes.map((one) => one.split(':')[0]), ['jtk/content/', 'drafts in _meta.json']);
  assert.match(meta.changes[0], /\(line 4\)$/);
  assert.match(meta.changes[1], /\(line 6\)$/);
  const loader = readsOf(
    [
      "import { COLLECTIONS, type Collection } from '../content/blocks';",
      'export const listed = COLLECTIONS.filter((collection) => collection.pages !== false);',
      "export const at = (collection: Collection) => collection.prefix.replace(/^\\//, '');",
      'const body = collection.body ?? [];',
      "const alt = n.v('cover_alt');",
      'const path = (key) => `page:${prefix}/${entry.id}:blocks[0].${key}`;',
    ].join('\n'),
    kinds,
  );
  assert.deepEqual(loader.changes.map((one) => one.split(':')[0]), [
    "'cover_alt'",
    "a collection's pages",
    "a collection's prefix",
    "a collection's body",
    'an annotation by index, written by hand',
    'an annotation naming another document by its address (page',
  ]);
  assert.equal(loader.weight, 6);
  // Through the door, a collection's prefix and pages are contract 3's own: not reads that move.
  const door = readsOf("import { site } from '../lib/site';\nfor (const one of site.collections.filter((c) => c.pages)) console.log(one.prefix, entry.body);", kinds);
  assert.deepEqual(door.changes, []);
  // A body of an entry is no collection's: not said.
  assert.deepEqual(readsOf("const body = typeof post.body === 'string' ? post.body : '';", kinds).changes, []);
});

test('B3: the list for a person ranks the files that read what moved, and the changed files that read nothing by name are one line', () => {
  const site = scaffold();
  try {
    for (const [path, extra] of [
      ['src/components/Hero.astro', '\n<!-- the developer\'s -->\n'],
      ['src/components/Clip.astro', '\n<!-- the developer\'s -->\n'],
      ['src/lib/entries.ts', "\nexport const a = () => join(process.cwd(), 'jtk', 'content');\nexport const b = () => join(process.cwd(), 'jtk', 'content', 'blog');\nexport const c = '/jtk/content/index.json';\n"],
    ]) {
      write(site, path, `${readFileSync(join(site, path), 'utf8')}${extra}`);
    }
    write(site, 'site-meta.mjs', "export const m = () => ({ hooks: { 'astro:build:done': () => write('_meta.json', { redirects: [], drafts: [] }) } });\n");
    const run = upgrade(site, '--mint-ids', '--no-check', '--dry-run');
    assert.equal(run.status, 0, said(run));
    const list = run.stdout.slice(run.stdout.indexOf('5 · for a person'));
    const at = (what) => list.indexOf(what);
    assert.ok(at('src/lib/entries.ts') > 0 && at('src/lib/entries.ts') < at('site-meta.mjs'), list);
    assert.match(list, /site-meta\.mjs: drafts in _meta\.json: contract 3's _meta\.json says redirects, immutable and cache only/);
    assert.match(list, /2 scaffold files the developer changed that read nothing of the contract by name — left as they are: src\/components\/Clip\.astro, src\/components\/Hero\.astro — build and compare/);
    assert.doesNotMatch(list, /a scaffold file the developer changed — src\/components\/Hero\.astro/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('B15: a page made to back a shown_on whose route does not read it is asked about', () => {
  const site = scaffold('--kit', KIT);
  try {
    write(site, 'src/pages/services.astro', '---\nconst title = "Services";\n---\n<h1>{title}</h1>\n');
    const run = upgrade(site, '--mint-ids', '--no-check', '--dry-run');
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /a page whose route does not read it — jtk\/pages\/services\.json is new — the page the services collection is shown on, which contract 3 names — and src\/pages\/services\.astro does not read it \(site\.page\('\/services'\)\)/);
    write(site, 'src/pages/services.astro', "---\nimport { site } from '../lib/site';\nconst page = site.page('/services');\n---\n<h1>{page?.seo?.title}</h1>\n");
    assert.doesNotMatch(upgrade(site, '--mint-ids', '--no-check', '--dry-run').stdout, /a page whose route does not read it/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

test('--site: the platform\'s state fetched as get_site and get_content read it, with the token jtk schema --judge sends; refused without one', async () => {
  const SITE = '0848daf4-6c94-4932-b797-f9081bff1ce7';
  const asked = [];
  const send = async (url, init) => {
    asked.push({ url, init });
    const body = url.endsWith('/pages') ? { pages: [{ id: id(1), path: '/', collection: '', locale: '', position: 0 }] } : { id: SITE, slug: 'kaif', currency: 'CHF' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const env = { api: process.env.JTK_API, token: process.env.JTK_TOKEN };
  try {
    delete process.env.JTK_API;
    delete process.env.JTK_TOKEN;
    await assert.rejects(stateFromThePlatform(SITE, send), /JTK_API .* JTK_TOKEN .*--state <file>/);
    process.env.JTK_API = 'https://api.stg.example/';
    process.env.JTK_TOKEN = 'jtk_secret';
    const state = await stateFromThePlatform(SITE, send);
    assert.deepEqual(state, { site: { id: SITE, slug: 'kaif', currency: 'CHF' }, pages: [{ id: id(1), path: '/', collection: '', locale: '', position: 0 }] });
    assert.deepEqual(asked.map((one) => one.url).sort(), [`https://api.stg.example/v1/sites/${SITE}`, `https://api.stg.example/v1/sites/${SITE}/pages`]);
    assert.equal(asked[0].init.headers.authorization, 'Bearer jtk_secret');
    process.env.JTK_TOKEN = 'a-session';
    await stateFromThePlatform(SITE, send);
    assert.equal(asked.at(-1).init.headers.cookie, 'sid=a-session');
    process.env.JTK_API = 'http://api.example';
    await assert.rejects(stateFromThePlatform(SITE, send), /over https only/);
  } finally {
    if (env.api === undefined) delete process.env.JTK_API;
    else process.env.JTK_API = env.api;
    if (env.token === undefined) delete process.env.JTK_TOKEN;
    else process.env.JTK_TOKEN = env.token;
  }
});

test('the check at the end: not run where the site is not installed, and said so; --no-check skips it (B14: the declaration\'s notes in contract 3\'s words)', () => {
  const site = scaffold();
  try {
    const declared = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    write(site, 'src/content/blocks.ts', declared.replace(/^/, '// The schema is jtk/catalogue.json, written by npx @jtakeit/astro catalogue.\nconst NOTE = "jtk/catalogue.json stays in a string";\n'));
    const run = upgrade(site, '--mint-ids');
    assert.equal(run.status, 0, said(run));
    assert.match(run.stdout, /6 · the check — not run: the site is not installed here \(npm ci\)\. Then: npm run build && npx @jtakeit\/astro schema/);
    const source = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    assert.match(source, /^\/\/ The schema is jtk\/schema\.json, written by npx @jtakeit\/astro schema\.$/m);
    assert.match(source, /const NOTE = "jtk\/catalogue\.json stays in a string";/);
    assert.doesNotMatch(source, /still say/);
  } finally {
    rmSync(join(site, '..'), { recursive: true, force: true });
  }
});

