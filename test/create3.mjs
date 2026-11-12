// `jtk create` lays out a contract-3 site by default (the owner, 12 November
// 2026; jtakeit-core wiki/98):
//
//   1  the tree: jtk/schema.json, the home page under jtk/pages, the contacts
//      in jtk/shared.json, a kit's settings at jtk/modules/bookings.json and its
//      rates under jtk/entries — no jtk/catalogue.json, no jtk/content — and the
//      words it is given are contract 3's
//   2  the tree `--contract 2` and then `jtk upgrade contract-3` make, ids
//      aside: one mapping, two roads to it — in one language and in two
//   3  built, `jtk schema` agrees with the page and `jtkit lint` finds nothing:
//      a plain site, and a salon from the kit's fixture with rates and a blog
//   4  several languages on contract 3 (M3): the others in LOCALES, each one's
//      copy in the kit's words; what it refuses: several at once on contract 2,
//      a site already there
//   6  every word a visitor reads on the form is content: the labels, the
//      question's words and the button, in the site's language on the home
//      page and in each other language's translation, in the kit's words —
//      and on /en the question is English, tappable and annotated
//   7  a kit served with contract 3's words on it — a master's name
//      `"localized": false` (jtakeit-core #223): kept on contract 3, left out
//      on contract 2, whose files are then the kit's without it, byte for byte
//   8  `jtkit apply --kit` into an empty tree — a site on another generator —
//      lays out contract 3, the kit's files and tables the same as `jtk
//      create --kit` lays them, ids aside: one mapping, two layouts
//   5  every kit the platform has, laid out, built, judged and linted — when
//      JTK_KITS_API names a platform (JTK_KITS_API=https://api.stg.jtakeit.com
//      node test/create3.mjs); not in `npm test`, which asks no platform
//
// The kit is this checkout's, packed, as the smoke test installs it.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const bin = resolve('bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-create3-'));
const fail = (m) => {
  console.error(`create3: ${m}`);
  process.exit(1);
};
const json = (site, file) => JSON.parse(readFileSync(join(site, file), 'utf8'));
const text = (site, file) => readFileSync(join(site, file), 'utf8');
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const create = (out, ...flags) => spawnSync('node', [bin, 'create', 'probe-three', '--out', join(dir, out), '--no-git', ...flags], { encoding: 'utf8' });
const walk = (at) => readdirSync(at, { withFileTypes: true }).flatMap((one) => (one.isDirectory() ? (one.name === 'node_modules' || one.name === 'dist' ? [] : walk(join(at, one.name))) : [join(at, one.name)]));

/** A site's jtk/ with every minted name set aside — ids, ranks — and the block types in one order. */
function settled(site) {
  const out = {};
  const plain = (value) => {
    if (Array.isArray(value)) return value.map(plain);
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id' && key !== 'rank').map(([key, one]) => [key, plain(one)]));
    return typeof value === 'string' && ID.test(value) ? '<id>' : value;
  };
  for (const file of walk(join(site, 'jtk'))) {
    const doc = plain(JSON.parse(readFileSync(file, 'utf8')));
    if (file.endsWith('schema.json')) doc.blocks.sort((a, b) => (a.type < b.type ? -1 : 1));
    out[relative(site, file)] = doc;
  }
  return out;
}

/**
 * The next steps in the platform's order (jtakeit:///guides/start.md): the
 * site made, the dev session open before a line is written, the schema
 * written and judged, the code where the copy says, then the build — never
 * «push the repository, then create_site» (a staging rehearsal, 12 November
 * 2026). In the printed steps and in the README alike.
 */
function inOrder(words, tool, said) {
  const steps = ['create_site', 'open_dev_session', `npx @jtakeit/astro ${tool}`, 'validate_schema', 'push_code', "npx @jtakeit/astro push '<url>'", 'attach_repo', 'commit_and_build', 'get_build', 'preflight'];
  let at = 0;
  for (const step of steps) at = at < 0 ? at : words.indexOf(step, at);
  if (at < 0 || /push the repository/.test(words)) fail(`${said} is not in the platform's order — ${steps.join(', ')}:\n${words}`);
}

/** Built, then held to `jtk schema` and `jtkit lint` on its dist/. */
function judged(site, packed, said) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', packed], { cwd: site, stdio: 'pipe' });
  const built = spawnSync('npm', ['run', 'build'], { cwd: site, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://probe.example/' } });
  if (built.status !== 0) fail(`${said}: the scaffold does not build:\n${built.stdout}\n${built.stderr}`);
  const schema = spawnSync('node', [bin, 'schema', '--root', site, '--dist', 'dist'], { encoding: 'utf8' });
  if (schema.status !== 0 || !schema.stdout.includes('the schema and the page agree')) fail(`${said}: jtk schema says ${schema.status} thing(s) wrong:\n${schema.stdout}\n${schema.stderr}`);
  const lint = spawnSync('node', [join(site, 'node_modules/@jtakeit/kit/bin/jtkit.mjs'), 'lint', '--dist', 'dist', '--root', '.'], { cwd: site, encoding: 'utf8' });
  if (lint.status !== 0) fail(`${said}: jtkit lint fails:\n${lint.stdout}\n${lint.stderr}`);
}

try {
  // ── 1 · the tree ──────────────────────────────────────────────────────────
  let run = create('plain', '--locale', 'de-CH');
  if (run.status !== 0) fail(`a default create failed:\n${run.stderr}`);
  const plain = join(dir, 'plain');
  for (const must of ['jtk/schema.json', 'jtk/pages/index.json', 'jtk/shared.json', 'jtk/design.json', 'src/content/blocks.ts', 'src/copy/de-CH.ts', 'README.md', 'BRIEF.md']) {
    if (!existsSync(join(plain, must))) fail(`a contract-3 scaffold has no ${must}`);
  }
  for (const never of ['jtk/catalogue.json', 'jtk/content', 'jtk/bookings.json', 'jtk/site.json', 'contract-3', 'src/copy/LOCALE.ts']) {
    if (existsSync(join(plain, never))) fail(`a contract-3 scaffold has ${never}`);
  }
  for (const file of walk(plain)) {
    if (/\.(png|jpe?g|webp|avif|gif|ico|woff2?)$/i.test(file)) continue;
    const left = readFileSync(file, 'utf8').match(/\{\{[A-Z_]+\}\}/g);
    if (left) fail(`${relative(plain, file)} still carries ${left.join(', ')}`);
  }
  const schema = json(plain, 'jtk/schema.json');
  if (schema.contract !== 3 || schema.locale !== 'de-CH' || JSON.stringify(schema.shared) !== '["contacts"]') fail(`jtk/schema.json is not contract 3's: ${JSON.stringify({ contract: schema.contract, locale: schema.locale, shared: schema.shared })}`);
  if (schema.blocks.find((one) => one.type === 'cta_banner')?.asks?.[0]?.label !== 'Worum es geht') fail('the form\'s question is not in the site\'s language');
  // 6 · the form's words are the block's: the question's declared beside the others.
  if (!schema.blocks.find((one) => one.type === 'cta_banner')?.fields?.some((one) => one.key === 'topic_label' && one.client_editable === true && one.kind === 'text')) fail('the form\'s question has no words of the block\'s, topic_label');
  const home = json(plain, 'jtk/pages/index.json');
  if (!ID.test(home.id) || home.path !== '/' || home.name !== 'Startseite' || home.blocks.map((one) => one._key).join() !== 'hero0001,ctab0001,ques0001') fail(`the home page is not contract 3's: ${JSON.stringify(home)}`);
  if (/"title": ""/.test(text(plain, 'jtk/pages/index.json'))) fail('the home page writes empty values');
  {
    const form = home.blocks.find((one) => one.type === 'cta_banner');
    const said = { cta_label: 'Senden', name_label: 'Name', contact_label: 'Telefon oder E-Mail', message_label: 'Nachricht', topic_label: 'Worum es geht' };
    for (const [field, words] of Object.entries(said)) if (form[field] !== words) fail(`6 · the form's ${field} is not «${words}» in the site's language: ${JSON.stringify(form)}`);
    if (existsSync(join(plain, 'jtk/pages/index.en.json')) || readdirSync(join(plain, 'jtk/pages')).some((one) => /\.[a-z]{2}(-[A-Z]{2})?\.json$/.test(one))) fail('6 · a site in one language has a translation');
  }
  const declaration = text(plain, 'src/content/blocks.ts');
  if (!/^export const CONTRACT = 3;$/m.test(declaration) || /BUSINESS_FACTS|image_alt|catalogue\.json|jtk\/content/.test(declaration)) fail('src/content/blocks.ts is not written in contract 3\'s words');
  // The words it is given: contract 3's, wherever the template names contract 2's files.
  for (const file of walk(plain)) {
    const words = readFileSync(file, 'utf8');
    if (file.endsWith('jtakeit-meta.mjs')) continue; // says both contracts, and which file each writes
    for (const old of ['jtk/catalogue.json', 'npx @jtakeit/astro catalogue', 'jtk/bookings.json', 'jtk/content/index.json is committed']) {
      if (words.includes(old) && !/used to be imported by name/.test(words.slice(Math.max(0, words.indexOf(old) - 200), words.indexOf(old)))) fail(`${relative(plain, file)} teaches a contract-3 site «${old}»`);
    }
  }
  if (!text(plain, 'README.md').includes('npx @jtakeit/astro schema')) fail('the README does not say npx @jtakeit/astro schema');
  if (!run.stdout.includes('then: npx @jtakeit/astro schema') || run.stdout.includes('astro catalogue')) fail(`the next steps are not contract 3's:\n${run.stdout}`);
  inOrder(run.stdout, 'schema', 'the next steps');
  inOrder(text(plain, 'README.md'), 'schema', 'the README');

  // A salon from the kit's fixture, with rates and a master, and a blog.
  const kit = JSON.parse(readFileSync(resolve('test/fixtures/kit-salon.json'), 'utf8'));
  kit.entries = [
    { collection: 'services', slug: 'cut', fields: { title: { de: 'Haarschnitt', en: 'Cut' }, takes: 30, costs: 4500 } },
    { collection: 'masters', slug: 'anna', fields: { title: 'Anna', does: [{ service: 'cut' }] } },
  ];
  const kitFile = join(dir, 'salon.json');
  writeFileSync(kitFile, JSON.stringify(kit));
  run = create('salon', '--locale', 'de-CH', '--kit', kitFile, '--blog', '--name', 'Salon Probe');
  if (run.status !== 0) fail(`create --kit --blog failed:\n${run.stderr}`);
  const salon = join(dir, 'salon');
  const settings = json(salon, 'jtk/modules/bookings.json');
  if (settings.v !== 1 || settings.settings?.kit !== 'salon' || settings.settings.page !== '/services') fail(`the diary's settings are not { v, settings }: ${JSON.stringify(settings)}`);
  const cut = json(salon, 'jtk/entries/services/cut.json');
  const anna = json(salon, 'jtk/entries/masters/anna.json');
  if (!ID.test(cut.id) || cut.slug !== 'cut' || cut.fields.title !== 'Haarschnitt' || cut.fields.costs?.minor !== 4500 || cut.visible !== true) fail(`a rate is not a contract-3 entry: ${JSON.stringify(cut)}`);
  if (JSON.stringify(anna.fields.does) !== JSON.stringify([cut.id])) fail(`what a master does is not the services' ids: ${JSON.stringify(anna.fields.does)}`);
  if (json(salon, 'jtk/pages/services.json').path !== '/services') fail('the page the services are shown on is not laid out');
  const tables = json(salon, 'jtk/schema.json');
  const services = tables.collections.find((one) => one.name === 'services');
  if (services?.route !== 'none' || services.shown_on?.[0] !== '/services#services-{slug}') fail(`the services are not shown on /services: ${JSON.stringify(services)}`);
  if (JSON.stringify(tables.collections.find((one) => one.name === 'blog')?.route) !== '{"detail":"/blog/{slug}","listing":"/blog","per_page":10}') fail('the blog is not turned on in contract 3\'s words');
  if (!/^BLOCKS\.push\(BLOG_POST\);$/m.test(text(salon, 'src/content/blocks.ts'))) fail('--blog did not write its two lines');
  if (existsSync(join(salon, 'jtk/bookings.json')) || existsSync(join(salon, 'jtk/content'))) fail('a kit left contract 2\'s files');

  // ── 2 · the same tree as contract 2, moved ────────────────────────────────
  // Two languages: contract 3 lays them out at once; contract 2 in one, the
  // other said in LOCALES by hand, as docs/languages.md says, then moved.
  const twoRun = create('two', '--locale', 'de-CH', '--locales', 'en', '--name', 'Salon Probe');
  if (twoRun.status !== 0) fail(`create in two languages failed:\n${twoRun.stderr}`);
  for (const [out, flags, other] of [['plain', ['--locale', 'de-CH']], ['salon', ['--locale', 'de-CH', '--kit', kitFile, '--blog', '--name', 'Salon Probe']], ['two', ['--locale', 'de-CH', '--name', 'Salon Probe'], 'en']]) {
    const moved = join(dir, `${out}-moved`);
    run = create(`${out}-moved`, '--contract', '2', ...flags);
    if (run.status !== 0 || !existsSync(join(moved, 'jtk/catalogue.json'))) fail(`--contract 2 did not lay out contract 2:\n${run.stderr}`);
    inOrder(run.stdout, 'catalogue', '--contract 2\'s next steps');
    inOrder(text(moved, 'README.md'), 'catalogue', '--contract 2\'s README');
    if (/astro schema|jtk\/schema\.json/.test(run.stdout)) fail(`--contract 2's next steps say contract 3's schema:\n${run.stdout}`);
    if (other !== undefined) {
      const blocks = join(moved, 'src/content/blocks.ts');
      writeFileSync(blocks, text(moved, 'src/content/blocks.ts').replace('export const LOCALES: string[] = [];', `export const LOCALES: string[] = ['${other}'];`));
      execFileSync('node', [bin, 'catalogue', '--emit-only', '--root', moved], { stdio: 'pipe' });
    }
    const up = spawnSync('node', [bin, 'upgrade', 'contract-3', '--root', moved, '--mint-ids', '--no-install'], { encoding: 'utf8' });
    if (up.status !== 0) fail(`jtk upgrade contract-3 on --contract 2:\n${up.stdout}\n${up.stderr}`);
    const a = settled(join(dir, out));
    const b = settled(moved);
    if (JSON.stringify(Object.keys(a).sort()) !== JSON.stringify(Object.keys(b).sort())) fail(`${out}: create lays out ${Object.keys(a).sort()}, the move ${Object.keys(b).sort()}`);
    for (const file of Object.keys(a)) {
      if (JSON.stringify(a[file]) !== JSON.stringify(b[file])) fail(`${out}: ${file} is not what --contract 2 and jtk upgrade contract-3 make:\n  create ${JSON.stringify(a[file]).slice(0, 600)}\n  moved  ${JSON.stringify(b[file]).slice(0, 600)}`);
    }
    // The other language's words, in the kit's, written alike on both roads.
    if (other !== undefined && text(join(dir, out), `src/copy/${other}.ts`) !== text(moved, `src/copy/${other}.ts`)) fail(`${out}: src/copy/${other}.ts is not what the move writes`);
  }

  // ── 4 · several languages on contract 3, and what it refuses ─────────────
  const two = join(dir, 'two');
  if (JSON.stringify(json(two, 'jtk/schema.json').locales) !== '["en"]') fail(`the schema does not say English: ${JSON.stringify(json(two, 'jtk/schema.json').locales)}`);
  if (!/^export const LOCALES: string\[\] = \['en'\];$/m.test(text(two, 'src/content/blocks.ts'))) fail('LOCALES does not say English');
  if (!/skipToContent: 'Skip to content'/.test(text(two, 'src/copy/en.ts')) || !/makeCopy\(site\.page\('\/', 'en'\), STRINGS\)/.test(text(two, 'src/copy/en.ts'))) fail('src/copy/en.ts is not English\'s words, reading English\'s home');
  if (!twoRun.stdout.includes('en: a translation beside each page and entry')) fail(`the next steps do not say English:\n${twoRun.stdout}`);
  {
    // 6 · the form's words in English: the translation of the home page, beside it, of its id.
    const english = json(two, 'jtk/pages/index.en.json');
    const original = json(two, 'jtk/pages/index.json');
    const form = original.blocks.find((one) => one.type === 'cta_banner');
    const said = { _key: form._key, cta_label: 'Send', name_label: 'Name', contact_label: 'Phone or email', message_label: 'Message', topic_label: 'What it is about' };
    if (english.of !== original.id || english.locale !== 'en' || JSON.stringify(english.blocks) !== JSON.stringify([said])) fail(`6 · the English translation does not hold the form's words: ${JSON.stringify(english)}`);
  }
  run = create('three', '--locale', 'de-CH,fr-ch', '--locales', 'en');
  if (run.status !== 0 || JSON.stringify(json(join(dir, 'three'), 'jtk/schema.json').locales) !== '["fr-CH","en"]' || !existsSync(join(dir, 'three', 'src/copy/fr-CH.ts'))) fail(`--locale with a comma and --locales together:\n${run.stderr}`);
  run = create('nobody', '--locale', 'de', '--locales', 'xx-yy-zz');
  if (run.status === 0 || !run.stderr.includes('is not a language')) fail(`a language that is none was not refused: ${run.stderr}`);
  run = create('two-old', '--contract', '2', '--locale', 'de,en');
  if (run.status === 0 || !run.stderr.includes('docs/languages.md')) fail('two languages at once on contract 2 were not sent to docs/languages.md');
  run = create('four', '--contract', '4');
  if (run.status === 0 || !run.stderr.includes('--contract takes 3')) fail('--contract 4 was not refused');
  // A new site is on the latest contract, always: --help says which, and
  // offers no other — `--contract 2` is the kit's tests' and a move's
  // rehearsal's, not a new site's (the owner, 12 November 2026).
  run = spawnSync('node', [bin, 'create', '--help'], { encoding: 'utf8' });
  if (run.status !== 0 || !run.stdout.includes('contract 3') || run.stdout.includes('--contract') || !run.stdout.includes('--locales') || run.stdout.includes('M3')) fail(`--help does not say which contract and which languages, or offers --contract:\n${run.stdout}`);
  run = spawnSync('node', [bin], { encoding: 'utf8' });
  if (run.stderr.includes('--contract')) fail(`jtk's usage offers --contract:\n${run.stderr}`);
  // A site already there, not even with --force: contract 3 over contract 2's files, either over contract 3's.
  run = create('plain-moved', '--force');
  if (run.status === 0 || !run.stderr.includes('says contract 3')) fail(`a contract-3 tree was scaffolded over: ${run.stderr}`);
  run = create('salon-old', '--contract', '2', '--locale', 'en');
  run = create('salon-old', '--force');
  if (run.status === 0 || !run.stderr.includes('holds a contract-2 site') || existsSync(join(dir, 'salon-old', 'jtk/schema.json'))) fail(`a contract-2 tree was scaffolded over on contract 3: ${run.stderr}`);

  // ── 7 · a kit served with contract 3's words on it ───────────────────────
  // A person's name is the same in every language: the platform says
  // `"localized": false` on the salon's masters' title (jtakeit-core #223)
  // and serves the kit in contract 2's words with it on. Contract 3 keeps
  // it; contract 2 leaves it out — its schema has no such key, and the
  // platform refuses one that writes it — and lays out byte for byte what
  // the kit without it does.
  {
    const said = structuredClone(kit);
    said.catalogue.blocks.find((one) => one.type === 'master').fields.find((one) => one.key === 'title').localized = false;
    const saidFile = join(dir, 'salon-localized.json');
    writeFileSync(saidFile, JSON.stringify(said));
    for (const [out, file] of [['kit-two', kitFile], ['kit-two-said', saidFile]]) {
      run = create(out, '--contract', '2', '--locale', 'de-CH', '--kit', file, '--name', 'Salon Probe');
      if (run.status !== 0 || !existsSync(join(dir, out, 'jtk/catalogue.json'))) fail(`7 · --contract 2 --kit ${file}:\n${run.stderr}`);
    }
    for (const file of ['jtk/catalogue.json', 'src/content/blocks.ts']) {
      const two = text(join(dir, 'kit-two-said'), file);
      if (/"localized"/.test(two)) fail(`7 · contract 2's ${file} says localized, which its schema has no key for`);
      if (two !== text(join(dir, 'kit-two'), file)) fail(`7 · contract 2's ${file} is not what the kit without contract 3's words lays out`);
    }
    run = spawnSync('node', [bin, 'catalogue', '--emit-only', '--root', join(dir, 'kit-two-said')], { encoding: 'utf8' });
    if (run.status !== 0) fail(`7 · jtk catalogue refuses the kit laid out on contract 2:\n${run.stdout}\n${run.stderr}`);
    run = create('kit-three-said', '--locale', 'de-CH', '--kit', saidFile, '--name', 'Salon Probe');
    if (run.status !== 0) fail(`7 · --kit on contract 3:\n${run.stderr}`);
    const title = json(join(dir, 'kit-three-said'), 'jtk/schema.json').blocks.find((one) => one.type === 'master')?.fields?.find((one) => one.key === 'title');
    if (title?.localized !== false) fail(`7 · contract 3 does not keep a master's name the same in every language: ${JSON.stringify(title)}`);
  }
  // ── 8 · jtkit apply --kit, on another generator ──────────────────────────
  // No declaration to write into: the kit's tables go into jtk/schema.json,
  // the rest as jtk create lays it — the same settings, rates and page.
  {
    const applied = join(dir, 'applied');
    run = spawnSync('node', [resolve('kit/bin/jtkit.mjs'), 'apply', '--kit', kitFile, '--root', applied, '--locale', 'de-CH'], { encoding: 'utf8' });
    if (run.status !== 0 || !run.stdout.includes(', on contract 3:')) fail(`8 · jtkit apply into an empty tree:\n${run.stdout}\n${run.stderr}`);
    const created = join(dir, 'kit-three');
    run = create('kit-three', '--locale', 'de-CH', '--kit', kitFile, '--name', 'Salon Probe');
    if (run.status !== 0) fail(`8 · create --kit:\n${run.stderr}`);
    const a = settled(applied);
    const b = settled(created);
    for (const file of Object.keys(a)) {
      if (file === 'jtk/schema.json') continue;
      if (JSON.stringify(a[file]) !== JSON.stringify(b[file])) fail(`8 · jtkit apply's ${file} is not what jtk create --kit lays out:\n  apply  ${JSON.stringify(a[file]).slice(0, 600)}\n  create ${JSON.stringify(b[file]).slice(0, 600)}`);
    }
    const mine = json(applied, 'jtk/schema.json');
    const theirs = json(created, 'jtk/schema.json');
    const types = new Set(kit.catalogue.blocks.map((one) => one.type));
    const names = new Set(kit.catalogue.collections.map((one) => one.name));
    if (mine.contract !== 3 || mine.locale !== theirs.locale) fail(`8 · jtkit apply's schema is not contract 3 in the site's language: ${JSON.stringify({ contract: mine.contract, locale: mine.locale })}`);
    if (JSON.stringify(mine.blocks) !== JSON.stringify(theirs.blocks.filter((one) => types.has(one.type)))) fail('8 · jtkit apply\'s block types are not jtk create\'s');
    if (JSON.stringify(mine.collections) !== JSON.stringify(theirs.collections.filter((one) => names.has(one.name)))) fail('8 · jtkit apply\'s collections are not jtk create\'s');
    if (JSON.stringify(mine.modules) !== JSON.stringify(theirs.modules)) fail('8 · jtkit apply\'s module is not jtk create\'s');
  }
  console.log('create3: the tree, contract 3\'s words, the same as the move in one language and two, several languages, the refusals, a kit\'s contract-3 words on each contract, jtkit apply the same as jtk create --kit');

  // ── 3 · built, judged, linted ─────────────────────────────────────────────
  const packed = join(dir, execFileSync('npm', ['pack', resolve('kit'), '--pack-destination', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop());
  judged(plain, packed, 'the plain scaffold');
  judged(salon, packed, 'the salon with a blog');
  judged(two, packed, 'a site in two languages');
  if (!text(two, 'dist/en/index.html').includes('<html lang="en"')) fail('a site in two languages has no English home');
  // 6 · on /en every word of the form is English, the question's too: tappable, annotated, unmarked.
  {
    const en = text(two, 'dist/en/index.html');
    const de = text(two, 'dist/index.html');
    const key = json(two, 'jtk/pages/index.json').blocks.find((one) => one.type === 'cta_banner')._key;
    const question = (words) => `<label class="field__label" for="lead-topic" data-jtk-path="blocks[${key}].topic_label">${words}</label>`;
    if (!en.includes(question('What it is about'))) fail(`6 · /en's question is not English, tappable and annotated: ${en.match(/<label[^>]*for="lead-topic"[^>]*>[^<]*<\/label>/)?.[0]}`);
    if (!de.includes(question('Worum es geht'))) fail(`6 · /'s question is not the block's: ${de.match(/<label[^>]*for="lead-topic"[^>]*>[^<]*<\/label>/)?.[0]}`);
    for (const [field, words] of [['name_label', 'Name'], ['contact_label', 'Phone or email'], ['message_label', 'Message']]) {
      if (!en.includes(`<span data-jtk-path="blocks[${key}].${field}">${words}</span>`)) fail(`6 · /en's ${field} is not «${words}», annotated`);
    }
    if (!en.includes(`<span data-submit-label data-jtk-path="blocks[${key}].cta_label">Send</span>`)) fail('6 · /en\'s button is not «Send», annotated');
    if (/Worum es geht|Telefon oder E-Mail|Nachricht|Senden/.test(en.slice(en.indexOf('<form class="lead"'), en.indexOf('</form>', en.indexOf('<form class="lead"'))))) fail('6 · /en\'s form says German');
  }
  console.log('create3: built, jtk schema agrees with the page and jtkit lint finds nothing — plain, a salon with a blog, and a site in two languages');

  // ── 5 · every kit the platform has ────────────────────────────────────────
  const api = process.env.JTK_KITS_API;
  if (api) {
    const { kits } = await (await fetch(`${api.replace(/\/+$/, '')}/v1/kits`)).json();
    for (const { kind } of kits) {
      run = create(`kit-${kind}`, '--locale', 'de-CH', '--kit', kind, '--api', api, '--blog');
      if (run.status !== 0) fail(`--kit ${kind}:\n${run.stderr}`);
      const site = join(dir, `kit-${kind}`);
      if (!existsSync(join(site, 'jtk/modules/bookings.json')) || existsSync(join(site, 'jtk/catalogue.json'))) fail(`--kit ${kind} is not laid out in contract 3's files`);
      judged(site, packed, `--kit ${kind} --blog`);
      console.log(`create3: --kit ${kind} --blog — built, judged, linted`);
    }
  }
} finally {
  if (!process.env.KEEP_CREATE3) rmSync(dir, { recursive: true, force: true });
  else console.log(`create3: kept ${dir}`);
}
