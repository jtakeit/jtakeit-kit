// `jtk add`, `jtk remove`, `jtk units` and `create --without` (jtakeit-core
// wiki/110 §3.7), on the files alone — test/live.mjs builds them:
//
//   1  round trips, every unit: `remove X` then `add X` is the tree `create`
//      made, ids aside; `add X` twice is `add X` once, `remove X` twice is
//      once; `create --without X` is `create` then `remove X`
//   2  the modules: `add blog` then `remove blog`, `add booking` then
//      `remove booking`, each the tree before it; `create --blog --kit salon`
//      is `create`, `add blog`, `add booking --kit` — one implementation, two
//      roads; the salon's people are the example's team, the hours the diary's
//   3  the languages: on a site in German, English and French, each removal
//      leaves no translation naming a key the original has not got, and each
//      addition writes the example's English words and no French ones
//   4  the conflicts: a BLOCKS made by a spread is refused with nothing
//      written; a section's component the agent changed is kept and named;
//      an entry with a person's words is refused, and removed with --force;
//      `remove services` while bookings reads it is refused; the skeleton and
//      a module not yet built are refused with why; --dry-run writes nothing
//   5  `jtk units` says what is there
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const bin = resolve('bin/jtk.mjs');
const kitFile = resolve('test/fixtures/kit-salon.json');
const dir = mkdtempSync(join(tmpdir(), 'jtk-units-'));
const fail = (m) => {
  console.error(`units: ${m}`);
  process.exit(1);
};
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECTIONS = ['hero', 'values', 'services', 'gallery', 'team', 'testimonials', 'questions', 'contact'];
const jtk = (...args) => spawnSync('node', [bin, ...args], { encoding: 'utf8' });
const create = (out, ...flags) => {
  const run = jtk('create', 'units-probe', '--name', 'Atelier Probe', '--out', join(dir, out), '--no-git', ...flags);
  if (run.status !== 0) fail(`create ${flags.join(' ')}:\n${run.stderr}`);
  return join(dir, out);
};
const at = (site, ...args) => {
  const run = jtk(...args, '--root', site);
  return run;
};
const ok = (site, ...args) => {
  const run = at(site, ...args);
  if (run.status !== 0) fail(`jtk ${args.join(' ')}:\n${run.stdout}\n${run.stderr}`);
  return run;
};
const walk = (root, from = root) =>
  readdirSync(from, { withFileTypes: true }).flatMap((one) => (one.isDirectory() ? (['node_modules', 'dist', '.git'].includes(one.name) ? [] : walk(root, join(from, one.name))) : [relative(root, join(from, one.name))]));

/**
 * A tree, ids aside: every file by its path — jtk/'s JSON with each minted id
 * and the schema's generator set aside, everything else by its bytes.
 */
function settled(site) {
  const out = {};
  const plain = (value) => {
    if (Array.isArray(value)) return value.map(plain);
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'generator').map(([key, one]) => [key, plain(one)]));
    return typeof value === 'string' && ID.test(value) ? '<id>' : value;
  };
  for (const file of walk(site).sort()) {
    if (file === 'jtk/schema.json' || file === 'README.md' || file === 'BRIEF.md') continue;
    const bytes = readFileSync(join(site, file));
    out[file] = file.startsWith('jtk/') && file.endsWith('.json') ? JSON.stringify(plain(JSON.parse(bytes.toString('utf8')))) : createHash('sha256').update(bytes).digest('hex');
  }
  return out;
}

function same(a, b, said) {
  const left = settled(a);
  const right = settled(b);
  const files = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const differ = files.filter((file) => left[file] !== right[file]);
  if (differ.length > 0) {
    const file = differ[0];
    const show = (one) => (one === undefined ? '(none)' : one.length > 64 ? one.slice(0, 900) : one);
    let note = '';
    if (left[file] && right[file] && !file.endsWith('.json') && /\.(ts|astro|css|mjs|md)$/.test(file)) {
      const x = readFileSync(join(a, file), 'utf8').split('\n');
      const y = readFileSync(join(b, file), 'utf8').split('\n');
      const line = x.findIndex((one, i) => one !== y[i]);
      note = `\n  line ${line + 1}: «${x[line]}» / «${y[line]}»`;
    }
    fail(`${said}: ${differ.length} file(s) differ — ${differ.slice(0, 6).join(', ')}\n  ${file}:\n  ${show(left[file])}\n  ${show(right[file])}${note}`);
  }
}
const copy = (from, to) => {
  const target = join(dir, to);
  rmSync(target, { recursive: true, force: true });
  cpSync(from, target, { recursive: true });
  return target;
};

try {
  // ── 1 · round trips, every section ────────────────────────────────────────
  const base = create('base', '--locale', 'de-CH', '--locales', 'en');
  for (const unit of SECTIONS) {
    const site = copy(base, `trip-${unit}`);
    const removed = ok(site, 'remove', unit);
    if (!removed.stdout.includes('file(s) changed')) fail(`remove ${unit} said nothing:\n${removed.stdout}`);
    const again = ok(site, 'remove', unit);
    if (!again.stdout.includes('not there')) fail(`remove ${unit} twice did something:\n${again.stdout}`);
    const without = create(`without-${unit}`, '--locale', 'de-CH', '--locales', 'en', '--without', unit);
    same(site, without, `create --without ${unit} and create + remove ${unit}`);
    ok(site, 'add', unit);
    same(site, base, `remove ${unit} then add ${unit}`);
    const twice = copy(site, `twice-${unit}`);
    ok(twice, 'add', unit);
    same(twice, base, `add ${unit} twice`);
  }
  console.log(`units: remove then add is create, add twice is once, remove twice is once, --without is remove — ${SECTIONS.length} sections`);

  // ── 2 · the modules ───────────────────────────────────────────────────────
  {
    const site = copy(base, 'blog');
    ok(site, 'add', 'blog');
    const blocks = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    if (!/^BLOCKS\.push\(BLOG_POST\);$/m.test(blocks) || !existsSync(join(site, 'jtk/entries/blog/a-morning-in-the-workshop.json')) || !existsSync(join(site, 'jtk/entries/blog/a-morning-in-the-workshop.en.json'))) fail('add blog did not turn the blog on with its example posts');
    const home = JSON.parse(readFileSync(join(site, 'jtk/pages/index.json'), 'utf8'));
    if (home.blocks.map((one) => one.type).join() !== 'hero,values,services_list,gallery,team_list,testimonials,posts_latest,questions,cta_banner') fail(`add blog did not put the latest posts after the testimonials: ${home.blocks.map((one) => one.type)}`);
    const nav = JSON.parse(readFileSync(join(site, 'jtk/shared.json'), 'utf8')).blocks.find((one) => one.type === 'header').nav.map((one) => one.link).join();
    if (nav !== '/services,/#team,/blog,/#questions,/#contact') fail(`add blog did not put «Journal» in the navigation: ${nav}`);
    ok(site, 'add', 'blog');
    ok(site, 'remove', 'blog');
    same(site, base, 'add blog then remove blog');
  }
  {
    const site = copy(base, 'booking');
    const run = ok(site, 'add', 'booking', '--kit', kitFile);
    if (!run.stdout.includes('Ask, never make up')) fail(`add booking did not print the kit's asks:\n${run.stdout}`);
    const blocks = readFileSync(join(site, 'src/content/blocks.ts'), 'utf8');
    if (!/bookings: \{"services":"services","resources":"masters"\}/.test(blocks)) fail('add booking did not turn the diary on');
    if (!existsSync(join(site, 'jtk/entries/masters/maria-muster.json')) || existsSync(join(site, 'jtk/entries/team'))) fail('the salon\'s people are not the example\'s team');
    const maria = JSON.parse(readFileSync(join(site, 'jtk/entries/masters/maria-muster.json'), 'utf8'));
    if (maria.fields.cover?.src !== 'example-team-apron' || maria.fields.role !== 'Handwerk und Beratung') fail(`a person's portrait and role did not come along: ${JSON.stringify(maria.fields)}`);
    if (!existsSync(join(site, 'jtk/entries/services/the-work.json'))) fail('the example\'s price list did not stay');
    const settings = JSON.parse(readFileSync(join(site, 'jtk/modules/bookings.json'), 'utf8')).settings;
    const hours = JSON.parse(readFileSync(join(site, 'jtk/shared.json'), 'utf8')).blocks.find((one) => one.type === 'hours');
    if (!Array.isArray(settings.hours) || settings.hours.length !== 6 || settings.hours[0]._key !== 'hours-mon' || hours.rows !== undefined) fail(`the hours are not the diary's: ${JSON.stringify({ settings: settings.hours, shared: hours })}`);
    const twice = copy(site, 'booking-twice');
    ok(twice, 'add', 'booking', '--kit', kitFile);
    same(twice, site, 'add booking twice');
    const refused = at(site, 'remove', 'services');
    if (refused.status === 0 || !refused.stderr.includes('bookings reads `services`')) fail(`remove services while bookings reads it was not refused:\n${refused.stderr}`);
    ok(site, 'remove', 'booking');
    same(site, base, 'add booking then remove booking');
  }
  {
    const aliased = create('aliased', '--locale', 'de-CH', '--locales', 'en', '--blog', '--kit', kitFile);
    const commanded = copy(base, 'commanded');
    ok(commanded, 'add', 'blog');
    ok(commanded, 'add', 'booking', '--kit', kitFile);
    same(aliased, commanded, 'create --blog --kit and create + add blog + add booking');
  }
  console.log('units: blog and booking added and removed give the tree back; create --blog --kit is create + add blog + add booking');

  // ── 3 · three languages ───────────────────────────────────────────────────
  {
    const three = create('three', '--locale', 'de-CH', '--locales', 'en,fr');
    if (existsSync(join(three, 'jtk/pages/index.fr.json')) && JSON.parse(readFileSync(join(three, 'jtk/pages/index.fr.json'), 'utf8')).blocks.some((one) => one.title !== undefined)) fail('the example wrote words in French, which it has none of');
    const orphans = (site) => {
      const out = [];
      for (const file of walk(site).filter((one) => /^jtk\/.*\.[a-z]{2}(-[A-Z]{2})?\.json$/.test(one))) {
        const original = file.replace(/\.[a-z]{2}(-[A-Z]{2})?\.json$/, '.json');
        if (!existsSync(join(site, original))) {
          out.push(`${file} has no original`);
          continue;
        }
        const keys = new Set(JSON.parse(readFileSync(join(site, original), 'utf8')).blocks?.map((one) => one._key) ?? []);
        for (const block of JSON.parse(readFileSync(join(site, file), 'utf8')).blocks ?? []) if (block._key && !keys.has(block._key)) out.push(`${file} names ${block._key}`);
      }
      return out;
    };
    for (const unit of SECTIONS) {
      const site = copy(three, `three-${unit}`);
      ok(site, 'remove', unit);
      const left = orphans(site);
      if (left.length > 0) fail(`3 · remove ${unit} on three languages leaves ${left.join('; ')}`);
      ok(site, 'add', unit);
      same(site, three, `3 · remove ${unit} then add ${unit} in three languages`);
    }
  }
  console.log('units: in three languages, each removal leaves no translation orphaned and each addition writes English words and no French');

  // ── 4 · the conflicts ─────────────────────────────────────────────────────
  {
    // A table that is not a literal: refused, nothing written.
    const site = copy(base, 'spread');
    const file = join(site, 'src/content/blocks.ts');
    const source = readFileSync(file, 'utf8').replace('export const BLOCKS: Block[] = [', 'const MINE: Block[] = [];\nexport const BLOCKS: Block[] = [...MINE, ');
    writeFileSync(file, source);
    const before = settled(site);
    const run = at(site, 'remove', 'values');
    if (run.status === 0 || !/spreads «\.\.\.MINE»/.test(run.stderr) || !run.stderr.includes('Nothing was written')) fail(`4 · a BLOCKS made by a spread was not refused:\n${run.stdout}\n${run.stderr}`);
    if (JSON.stringify(settled(site)) !== JSON.stringify(before)) fail('4 · a refused remove wrote something');
  }
  {
    // A component the agent changed: kept, named; --force deletes it.
    const site = copy(base, 'changed');
    const file = join(site, 'src/components/sections/Values.astro');
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n<!-- mine -->\n`);
    const run = ok(site, 'remove', 'values');
    if (!existsSync(file) || !run.stdout.includes('src/components/sections/Values.astro: yours now')) fail(`4 · a changed component was not kept and named:\n${run.stdout}`);
    if (/Values/.test(readFileSync(join(site, 'src/components/sections/index.ts'), 'utf8'))) fail('4 · a kept component is still in SECTIONS');
    const forced = copy(base, 'changed-force');
    writeFileSync(join(forced, 'src/components/sections/Values.astro'), 'mine');
    ok(forced, 'remove', 'values', '--force');
    if (existsSync(join(forced, 'src/components/sections/Values.astro'))) fail('4 · --force did not delete a changed component');
  }
  {
    // A person's words: refused, named; --force removes them.
    const site = copy(base, 'words');
    const file = join(site, 'jtk/entries/services/the-work.json');
    const entry = JSON.parse(readFileSync(file, 'utf8'));
    entry.fields.title = 'Herrenschnitt';
    writeFileSync(file, JSON.stringify(entry, null, 2));
    const before = settled(site);
    let run = at(site, 'remove', 'services');
    if (run.status === 0 || !run.stderr.includes('says «Herrenschnitt» — not the example\'s')) fail(`4 · a person's words were not refused:\n${run.stderr}`);
    if (JSON.stringify(settled(site)) !== JSON.stringify(before)) fail('4 · a refused remove wrote something');
    const home = join(site, 'jtk/pages/index.json');
    const page = JSON.parse(readFileSync(home, 'utf8'));
    page.blocks.find((one) => one.type === 'testimonials').items[0].quote = 'Echt gut.';
    writeFileSync(home, JSON.stringify(page, null, 2));
    run = at(site, 'remove', 'testimonials');
    if (run.status === 0 || !run.stderr.includes('Echt gut.')) fail(`4 · a real testimonial was not refused:\n${run.stderr}`);
    ok(site, 'remove', 'services', '--force');
    if (existsSync(file)) fail('4 · --force did not remove the entry');
  }
  {
    const site = copy(base, 'refusals');
    for (const [args, says] of [
      [['remove', 'header'], 'the header is the site\'s own'],
      [['remove', 'footer'], 'the footer is the site\'s own'],
      [['add', 'shop'], 'wiki/97'],
      [['add', 'pricing'], 'is none of the example\'s units'],
      [['add', 'booking'], 'which kit?'],
      [['add', 'hero', '--page', '/about'], 'the example\'s sections are the home page\'s'],
    ]) {
      const run = at(site, ...args);
      if (run.status === 0 || !run.stderr.includes(says)) fail(`4 · jtk ${args.join(' ')} was not refused with «${says}»:\n${run.stderr}`);
    }
    const before = settled(site);
    const dry = ok(site, 'remove', 'gallery', '--dry-run');
    if (!dry.stdout.includes('delete jtk') && !dry.stdout.includes('write  jtk/pages/index.json')) fail(`4 · --dry-run printed no plan:\n${dry.stdout}`);
    if (JSON.stringify(settled(site)) !== JSON.stringify(before)) fail('4 · --dry-run wrote something');
    ok(site, 'remove', 'questions');
    ok(site, 'add', 'questions', '--after', 'hero');
    const order = JSON.parse(readFileSync(join(site, 'jtk/pages/index.json'), 'utf8')).blocks.map((one) => one.type);
    if (order[1] !== 'questions') fail(`4 · add --after hero did not put the section there: ${order}`);
  }
  console.log('units: a spread refused with nothing written, a changed component kept, a person\'s words refused, services kept while booked, the skeleton refused, --dry-run writes nothing, --after places');

  // ── 5 · jtk units ─────────────────────────────────────────────────────────
  {
    const site = copy(base, 'listed');
    ok(site, 'remove', 'team');
    const run = ok(site, 'units');
    if (!/● hero/.test(run.stdout) || !/○ team/.test(run.stdout) || !/○ blog/.test(run.stdout)) fail(`5 · jtk units does not say what is there:\n${run.stdout}`);
  }
  console.log('units: jtk units says what the site has and what can be added');
} finally {
  if (!process.env.KEEP_UNITS) rmSync(dir, { recursive: true, force: true });
  else console.log(`units: kept ${dir}`);
}
