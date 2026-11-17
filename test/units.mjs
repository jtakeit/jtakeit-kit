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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { judgeSchema } from '../kit/lib/judge3.mjs';
import { loadShopKit } from '../kit/lib/kits.mjs';
import { placeOf } from '../lib/units/photos.mjs';

const bin = resolve('bin/jtk.mjs');
const kitFile = resolve('test/fixtures/kit-salon.json');
const shopFile = resolve('kit/test/fixtures/kits/shop.json');
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
    if (maria.fields.cover?.src !== placeOf('team-apron').value || maria.fields.role !== 'Handwerk und Beratung') fail(`a person's portrait and role did not come along: ${JSON.stringify(maria.fields)}`);
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
      [['add', 'events'], 'wiki/106'],
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
    if (!/○ shop/.test(run.stdout)) fail(`5 · jtk units does not list the shop as a unit that can be added:\n${run.stdout}`);
    ok(site, 'add', 'shop', '--kit', shopFile);
    if (!/● shop/.test(ok(site, 'units').stdout)) fail('5 · jtk units does not say the shop is there once it is added');
  }
  console.log('units: jtk units says what the site has and what can be added');

  // ── 6 · the shop ──────────────────────────────────────────────────────────
  const MARK = '// The shop kit (npx @jtakeit/astro add shop): yours from here on.';
  const shopKit = JSON.parse(readFileSync(shopFile, 'utf8'));
  const read = (site, file) => readFileSync(join(site, file), 'utf8');
  const jsonOf = (site, file) => JSON.parse(read(site, file));
  const shopSettings = (site) => jsonOf(site, 'jtk/modules/shop.json');
  const judged = (site) => {
    const copied = copy(site, `${site.split('/').at(-1)}-judged`);
    const run = ok(copied, 'schema', '--emit-only');
    return { schema: jsonOf(copied, 'jtk/schema.json'), findings: judgeSchema(read(copied, 'jtk/schema.json')), run };
  };
  /** The header's links to the shop's listing and to the cart, in the file given. */
  const cartLinks = (site, file) => jsonOf(site, file).blocks.find((one) => one.type === 'header').nav.filter((one) => one.link === '/shop' || one.link === '/cart');
  const shopAt = copy(base, 'shop');
  {
    // The kit laid over a fresh site in German: its words the site's, the country the locale's.
    const run = ok(shopAt, 'add', 'shop', '--kit', shopFile);
    if (!/CH, from the locale/.test(run.stdout)) fail(`6 · add shop did not say it took CH from the locale:\n${run.stdout}`);
    if (!run.stdout.includes(shopKit.ask[0])) fail(`6 · add shop did not print the kit's asks:\n${run.stdout}`);
    for (const next of ['npx @jtakeit/astro schema', 'import products', 'set_stock', 'Stripe']) if (!run.stdout.includes(next)) fail(`6 · add shop's next steps do not say «${next}»:\n${run.stdout}`);
    const blocks = read(shopAt, 'src/content/blocks.ts');
    if (blocks.split(MARK).length - 1 !== 3) fail(`6 · add shop did not mark its three elements: ${blocks.split(MARK).length - 1}`);
    if (!/shop: \{ products: 'products' \}/.test(blocks) || !/"label": "Produkt"/.test(blocks) || !/"label": "Produkte"/.test(blocks) || /"label": \{/.test(blocks.slice(blocks.indexOf(MARK), blocks.indexOf(MARK) + 400))) fail('6 · add shop did not lay the product type and the products collection in the site\'s language, and turn the shop on');
    const { settings } = shopSettings(shopAt);
    if (settings.zones.length !== 1 || settings.zones[0].name !== 'Inland' || JSON.stringify(settings.zones[0].countries) !== JSON.stringify([{ _key: 'c1', country: 'CH' }])) fail(`6 · the zone is not the site's country, in the site's words: ${JSON.stringify(settings.zones)}`);
    if (settings.methods.map((one) => one._key).join() !== 'post,pickup' || settings.methods.some((one) => 'price' in one || 'bands' in one || 'free_above' in one) || settings.methods[0].name !== 'Post') fail(`6 · the methods are not the kit's, without a price: ${JSON.stringify(settings.methods)}`);
    if (settings.kit !== 'shop' || settings.kit_version !== '1' || Object.keys(settings).join() !== 'zones,methods,kit,kit_version') fail(`6 · the kit's version is not text: ${JSON.stringify(settings)}`);
    const { schema, findings } = judged(shopAt);
    if (schema.modules?.shop?.products !== 'products') fail(`6 · the schema does not bind the products role: ${JSON.stringify(schema.modules)}`);
    if (findings.length > 0) fail(`6 · the platform's judge finds the shop's schema wanting: ${JSON.stringify(findings)}`);
    // The header's links to the products and to the cart, side by side: each given once, in the site's
    // words and in the English overlay's. Without the first nothing led to the products (16 November 2026).
    const links = (site) => cartLinks(site, 'jtk/shared.json');
    const both = [{ _key: 'nav-shop', label: 'Shop', link: '/shop' }, { _key: 'nav-cart', label: 'Warenkorb', link: '/cart' }];
    if (JSON.stringify(links(shopAt)) !== JSON.stringify(both)) fail(`6 · add shop did not give the header one link to the products and one to the cart, in German: ${JSON.stringify(links(shopAt))}`);
    const header = jsonOf(shopAt, 'jtk/shared.json').blocks.find((one) => one.type === 'header');
    const shopAtNav = header.nav.findIndex((one) => one._key === 'nav-shop');
    if (header.nav[shopAtNav + 1]?._key !== 'nav-cart') fail(`6 · the products' link and the cart's are not side by side: ${JSON.stringify(header.nav)}`);
    const overlaid = jsonOf(shopAt, 'jtk/shared.en.json').blocks.find((one) => one._key === header._key);
    if (JSON.stringify(overlaid?.nav?.filter((one) => one._key === 'nav-shop' || one._key === 'nav-cart')) !== JSON.stringify([{ _key: 'nav-shop', label: 'Shop' }, { _key: 'nav-cart', label: 'Cart' }])) fail(`6 · the English overlay does not say the products' and the cart's links in English: ${JSON.stringify(overlaid)}`);
    const twice = copy(shopAt, 'shop-twice');
    const again = ok(twice, 'add', 'shop', '--kit', shopFile);
    if (!again.stdout.includes('already there')) fail(`6 · add shop twice did not say it is already there:\n${again.stdout}`);
    same(twice, shopAt, 'add shop twice');
    if (links(twice).length !== 2) fail(`6 · add shop twice gave the header another link to the products or the cart: ${JSON.stringify(links(twice))}`);
    // A site whose header links to /cart already has its own: not given a second.
    const owned = copy(base, 'shop-own-link');
    const shared = jsonOf(owned, 'jtk/shared.json');
    shared.blocks.find((one) => one.type === 'header').nav.push({ _key: 'my-cart', label: 'Korb', link: '/cart' });
    writeFileSync(join(owned, 'jtk/shared.json'), `${JSON.stringify(shared, null, 2)}\n`);
    ok(owned, 'add', 'shop', '--kit', shopFile);
    // It is given the products' link still, before its own cart's.
    if (JSON.stringify(links(owned)) !== JSON.stringify([{ _key: 'nav-shop', label: 'Shop', link: '/shop' }, { _key: 'my-cart', label: 'Korb', link: '/cart' }])) fail(`6 · add shop gave a second link to the cart to a header that had its own, or no link to the products: ${JSON.stringify(links(owned))}`);
    // One that is there is not asked of the platform again.
    const offline = ok(copy(shopAt, 'shop-offline'), 'add', 'shop', '--api', 'http://127.0.0.1:1');
    if (!offline.stdout.includes('already there')) fail(`6 · add shop on a site that has it asked the platform:\n${offline.stdout}`);
  }
  {
    // The country: --country, else the locale's region, else the shared contacts — and always said.
    const en = create('shop-en', '--locale', 'en');
    const run = ok(en, 'add', 'shop', '--kit', shopFile);
    if (!/CH, from the shared contacts/.test(run.stdout) || shopSettings(en).settings.zones[0].countries[0].country !== 'CH') fail(`6 · an en site did not take CH from the shared contacts, said:\n${run.stdout}`);
    if (shopSettings(en).settings.zones[0].name !== 'Domestic') fail(`6 · an en site's zone is not in English: ${JSON.stringify(shopSettings(en).settings.zones[0])}`);
    const bare = create('shop-bare', '--locale', 'en');
    const shared = jsonOf(bare, 'jtk/shared.json');
    delete shared.blocks.find((one) => one.type === 'contacts').country;
    writeFileSync(join(bare, 'jtk/shared.json'), `${JSON.stringify(shared, null, 2)}\n`);
    const before = settled(bare);
    const none = at(bare, 'add', 'shop', '--kit', shopFile);
    if (none.status === 0 || !none.stderr.includes('--country') || !none.stderr.includes('Nothing was written')) fail(`6 · a site with no country anywhere was not refused, naming --country:\n${none.stdout}\n${none.stderr}`);
    if (JSON.stringify(settled(bare)) !== JSON.stringify(before)) fail('6 · a refused add shop wrote something');
    const named = ok(bare, 'add', 'shop', '--kit', shopFile, '--country', 'DE');
    if (!/DE, from --country/.test(named.stdout) || shopSettings(bare).settings.zones[0].countries[0].country !== 'DE') fail(`6 · --country DE was not the zone's country, said:\n${named.stdout}`);
    const low = at(create('shop-low', '--locale', 'en'), 'add', 'shop', '--kit', shopFile, '--country', 'ch');
    if (low.status === 0 || !low.stderr.includes('two capital letters')) fail(`6 · --country ch was not refused:\n${low.stderr}`);
    // --country beats the locale's region.
    const over = copy(base, 'shop-over');
    ok(over, 'add', 'shop', '--kit', shopFile, '--country', 'LI');
    if (shopSettings(over).settings.zones[0].countries[0].country !== 'LI') fail('6 · --country did not beat the locale');
  }
  {
    // The dev server answers the shop from the site's own files (devShop): a site laid out by this release has it
    // mounted, and the unit says nothing; one laid out before is told the two lines — and its jtakeit-meta.mjs,
    // which the scaffold owns, is left as it is.
    if (!/devShop/.test(read(base, 'jtakeit-meta.mjs'))) fail('6 · a site create lays out does not mount devShop beside devDiary');
    const fresh = ok(copy(base, 'shop-dev'), 'add', 'shop', '--kit', shopFile);
    if (fresh.stdout.includes('devShop')) fail(`6 · add shop told a site that mounts devShop to add it:\n${fresh.stdout}`);
    const older = copy(base, 'shop-older');
    const meta = read(older, 'jtakeit-meta.mjs').split('\n').filter((one) => !one.includes('devShop')).join('\n');
    writeFileSync(join(older, 'jtakeit-meta.mjs'), meta);
    const run = ok(older, 'add', 'shop', '--kit', shopFile);
    for (const line of ["import { devShop } from '@jtakeit/kit/devshop';", "server.middlewares.use('/api', devShop(process.cwd()));"]) {
      if (!run.stdout.includes(line)) fail(`6 · add shop on a site with no devShop did not say «${line}»:\n${run.stdout}`);
    }
    if (read(older, 'jtakeit-meta.mjs') !== meta) fail('6 · add shop changed the scaffold\'s jtakeit-meta.mjs');
  }
  {
    // A block type or a collection by the kit's names is refused, naming it, with nothing written.
    for (const [name, replace, says] of [
      ['type', "export const BLOCKS: Block[] = [", "the block type «product»"],
      ['collection', "export const COLLECTIONS: Collection[] = [", "the collection «products»"],
    ]) {
      const site = copy(base, `shop-own-${name}`);
      const file = join(site, 'src/content/blocks.ts');
      const own = name === 'type' ? "{ type: 'product', v: 1, label: 'Mine', fields: [] }," : "{ name: 'products', label: 'Mine', type: 'text', route: 'none' },";
      writeFileSync(file, readFileSync(file, 'utf8').replace(replace, `${replace}\n  ${own}`));
      const before = settled(site);
      const run = at(site, 'add', 'shop', '--kit', shopFile);
      if (run.status === 0 || !run.stderr.includes(says) || !run.stderr.includes('Nothing was written')) fail(`6 · a site with its own ${name} by the kit's name was not refused, naming it:\n${run.stdout}\n${run.stderr}`);
      if (JSON.stringify(settled(site)) !== JSON.stringify(before)) fail('6 · a refused add shop wrote something');
    }
  }
  {
    // Beside a booking kit, in either order; each taken out leaves the other.
    const both = copy(base, 'shop-booking');
    ok(both, 'add', 'shop', '--kit', shopFile);
    ok(both, 'add', 'booking', '--kit', kitFile);
    const { schema, findings } = judged(both);
    if (!schema.modules?.shop || !schema.modules?.bookings || findings.length > 0) fail(`6 · the shop beside bookings is not a clean schema: ${JSON.stringify(schema.modules)} ${JSON.stringify(findings)}`);
    const other = copy(base, 'booking-shop');
    ok(other, 'add', 'booking', '--kit', kitFile);
    ok(other, 'add', 'shop', '--kit', shopFile);
    const second = judged(other);
    if (!second.schema.modules?.shop || !second.schema.modules?.bookings || second.findings.length > 0) fail(`6 · bookings then the shop is not a clean schema: ${JSON.stringify(second.findings)}`);
    ok(both, 'remove', 'booking');
    if (!/shop: \{ products: 'products' \}/.test(read(both, 'src/content/blocks.ts')) || !existsSync(join(both, 'jtk/modules/shop.json'))) fail('6 · remove booking took the shop out');
    ok(both, 'remove', 'shop');
    same(both, base, 'add shop, add booking, remove booking, remove shop');
    // A booking kit is no shop's, and a shop's kit is no booking's.
    const refused = at(copy(base, 'booking-with-shop-kit'), 'add', 'booking', '--kit', shopFile);
    if (refused.status === 0 || !refused.stderr.includes('add shop')) fail(`6 · add booking --kit <the shop's kit> was not refused, naming add shop:\n${refused.stderr}`);
    const wrong = at(copy(base, 'shop-with-booking-kit'), 'add', 'shop', '--kit', kitFile);
    if (wrong.status === 0 || !wrong.stderr.includes('add booking')) fail(`6 · add shop --kit <a booking kit> was not refused, naming add booking:\n${wrong.stderr}`);
    const created = jtk('create', 'units-probe', '--out', join(dir, 'create-with-shop-kit'), '--no-git', '--kit', shopFile);
    if (created.status === 0 || !created.stderr.includes('add shop')) fail(`6 · create --kit <the shop's kit> was not refused, naming add shop:\n${created.stderr}`);
  }
  {
    // Removal: the tree create left; refused while a product is there; the settings the owner priced kept.
    const site = copy(shopAt, 'shop-out');
    const run = ok(site, 'remove', 'shop');
    if (!run.stdout.includes('file(s) changed')) fail(`6 · remove shop said nothing:\n${run.stdout}`);
    if (cartLinks(site, 'jtk/shared.json').length !== 0 || /nav-cart|nav-shop/.test(read(site, 'jtk/shared.en.json'))) fail(`6 · remove shop left the header's link to the products or the cart, or their English words:\n${run.stdout}`);
    same(site, base, 'add shop then remove shop');
    const again = ok(site, 'remove', 'shop');
    if (!again.stdout.includes('not there')) fail(`6 · remove shop twice did something:\n${again.stdout}`);
    ok(site, 'add', 'shop', '--kit', shopFile);
    same(site, shopAt, 'remove shop then add shop');

    const stocked = copy(shopAt, 'shop-stocked');
    mkdirSync(join(stocked, 'jtk/entries/products'), { recursive: true });
    writeFileSync(join(stocked, 'jtk/entries/products/fox.json'), `${JSON.stringify({ id: '0193a5c3-6b1c-7d20-9a31-5e4d3c2b1b03', collection: 'products', slug: 'fox', visible: true, fields: { title: 'Fuchs' } }, null, 2)}\n`);
    const before = settled(stocked);
    for (const flags of [[], ['--force']]) {
      const refused = at(stocked, 'remove', 'shop', ...flags);
      if (refused.status === 0 || !refused.stderr.includes('jtk/entries/products') || !refused.stderr.includes('the products are the business\'s: move or delete them first') || !refused.stderr.includes('Nothing was written')) fail(`6 · remove shop ${flags.join(' ')} with a product there was not refused:\n${refused.stdout}\n${refused.stderr}`);
    }
    if (JSON.stringify(settled(stocked)) !== JSON.stringify(before)) fail('6 · a refused remove shop took something out');

    const priced = copy(shopAt, 'shop-priced');
    const settings = shopSettings(priced);
    settings.settings.methods[0].price = { minor: 900 };
    writeFileSync(join(priced, 'jtk/modules/shop.json'), `${JSON.stringify(settings, null, 2)}\n`);
    const kept = ok(priced, 'remove', 'shop');
    if (!kept.stdout.includes('jtk/modules/shop.json: yours now') || !existsSync(join(priced, 'jtk/modules/shop.json')) || read(priced, 'src/content/blocks.ts').includes(MARK)) fail(`6 · the owner's rates were not kept and named, or the elements stayed:\n${kept.stdout}`);
  }
  {
    // The kit's settings are kept where the site already has zones: said, and not written over.
    const site = copy(base, 'shop-zoned');
    mkdirSync(join(site, 'jtk/modules'), { recursive: true });
    const own = { v: 1, settings: { zones: [{ _key: 'z1', name: 'Europa', countries: [{ _key: 'c1', country: 'DE' }] }], methods: [] } };
    writeFileSync(join(site, 'jtk/modules/shop.json'), `${JSON.stringify(own, null, 2)}\n`);
    const run = ok(site, 'add', 'shop', '--kit', shopFile);
    if (JSON.stringify(shopSettings(site)) !== JSON.stringify(own) || !/jtk\/modules\/shop\.json: .*zones.*kept/.test(run.stdout)) fail(`6 · a settings file with zones was written over, or not said:\n${run.stdout}`);
    // One `jtk schema` seeded empty is not anybody's yet.
    const seeded = copy(base, 'shop-seeded');
    mkdirSync(join(seeded, 'jtk/modules'), { recursive: true });
    writeFileSync(join(seeded, 'jtk/modules/shop.json'), `${JSON.stringify({ v: 1, settings: {} }, null, 2)}\n`);
    ok(seeded, 'add', 'shop', '--kit', shopFile);
    if (shopSettings(seeded).settings.zones?.[0]?.countries?.[0]?.country !== 'CH') fail('6 · an empty settings file was not filled');
  }
  {
    // The storefront's files: laid where the site has none, from the files the unit is handed; taken out only
    // while the scaffold's, and one the site had of its own before the kit is left where it is. The unit is
    // driven with a files directory of this test's own and a stub of `scaffolds`, so the repository's
    // example/files is never written.
    const { shop, SHOP_FILES } = await import('../lib/units/shop.mjs');
    const { siteOf, treeOf: treeIn } = await import('../lib/units/index.mjs');
    for (const path of ['src/components/shop/Product.astro', 'src/components/shop/Cart.astro', 'src/components/shop/Checkout.astro', 'src/components/shop/OrderAfter.astro', 'src/components/shop/ProductListing.astro', 'src/pages/[...lang]/cart.astro', 'src/pages/[...lang]/order.astro', 'src/pages/[...lang]/shop/index.astro']) {
      if (!SHOP_FILES.includes(path)) fail(`6 · the storefront's files do not name ${path}: ${SHOP_FILES}`);
    }
    const files = join(dir, 'storefront-files');
    const theExample = (path) => `<p>the example's ${path}</p>\n`;
    for (const path of SHOP_FILES) {
      mkdirSync(join(files, path, '..'), { recursive: true });
      writeFileSync(join(files, path), theExample(path));
    }
    const scaffolds = (path, text) => text === theExample(path);
    const kit = await loadShopKit(shopFile);
    const laid = (site) => {
      const tree = treeIn(site);
      const did = shop.add(tree, { site: siteOf(tree), did: [], options: { kit }, engine: { files } });
      tree.commit();
      return did;
    };
    const taken = (site, force, commit = true) => {
      const tree = treeIn(site);
      const out = shop.remove(tree, { did: [], kept: [], faults: [], force, scaffolds });
      if (commit) tree.commit();
      return out;
    };
    const [probe] = SHOP_FILES;

    const site = copy(base, 'shop-files');
    const did = laid(site);
    for (const path of SHOP_FILES) if (read(site, path) !== theExample(path) || !did.includes(`${path}: written`)) fail(`6 · a storefront file was not laid from the files the unit is handed: ${path} — ${did}`);
    writeFileSync(join(site, probe), '<p>mine</p>\n');
    const kept = taken(site, false, false);
    if (!kept.kept.some((one) => one.startsWith(`${probe}: yours now`)) || kept.did.some((one) => one === `${probe}: deleted`)) fail(`6 · a changed storefront file was not kept and named: ${JSON.stringify(kept)}`);
    taken(site, true);
    if (existsSync(join(site, probe))) fail('6 · --force did not delete a changed storefront file');
    // Untouched, it goes without --force.
    const clean = copy(base, 'shop-files-clean');
    laid(clean);
    const out = taken(clean, false);
    if (existsSync(join(clean, probe)) || !out.did.includes(`${probe}: deleted`)) fail(`6 · an untouched storefront file was not taken out: ${JSON.stringify(out)}`);
    // One the site had before the kit is not written over.
    const theirs = copy(base, 'shop-files-theirs');
    mkdirSync(join(theirs, probe, '..'), { recursive: true });
    writeFileSync(join(theirs, probe), '<p>theirs</p>\n');
    const left = laid(theirs);
    if (read(theirs, probe) !== '<p>theirs</p>\n' || left.includes(`${probe}: written`)) fail('6 · a storefront file the site had was written over');

    // Through the command, the example's own: the product's page laid as example/files has it, and gone again with the shop.
    const real = copy(base, 'shop-files-real');
    const run = ok(real, 'add', 'shop', '--kit', shopFile);
    for (const path of SHOP_FILES) {
      if (!existsSync(join(real, path)) || read(real, path) !== readFileSync(resolve('example/files', path), 'utf8') || !run.stdout.includes(`${path}: written`)) fail(`6 · add shop did not lay ${path} as the example has it:\n${run.stdout}`);
    }
    ok(real, 'remove', 'shop');
    for (const path of SHOP_FILES) if (existsSync(join(real, path))) fail(`6 · remove shop left the scaffold's ${path}`);
  }
  {
    // The entry page hands a product to the site's own page: a site laid out by this release has the lines and is
    // told nothing; one laid out before is told them — and its entry page, which the scaffold owns, is left as it is.
    const page = 'src/pages/[...entry].astro';
    if (!read(base, page).includes("import.meta.glob<{ default: any }>('../components/shop/Product.astro', { eager: true })")) fail('6 · the entry page create lays out does not draw a product by the site\'s Product.astro');
    const fresh = ok(copy(base, 'shop-entry-fresh'), 'add', 'shop', '--kit', shopFile);
    if (fresh.stdout.includes('draws a product as any entry')) fail(`6 · add shop told a site whose entry page draws its products to change it:\n${fresh.stdout}`);
    const older = copy(base, 'shop-entry-older');
    const before = read(older, page).split('\n').filter((one) => !/Product/.test(one)).join('\n');
    writeFileSync(join(older, page), before);
    const run = ok(older, 'add', 'shop', '--kit', shopFile);
    for (const line of ["const Product = collection.name === site.rolesOf('shop')?.products", '<Product entry={entry} collection={collection} locale={locale} />']) {
      if (!run.stdout.includes(line)) fail(`6 · add shop on a site with an older entry page did not say «${line}»:\n${run.stdout}`);
    }
    if (read(older, page) !== before) fail('6 · add shop changed the scaffold\'s entry page');
  }
  console.log('units: the shop laid over a contract-3 site — the country said, the kit beside a booking kit, refused where the site has the names, taken out while no product is there');
} finally {
  if (!process.env.KEEP_UNITS) rmSync(dir, { recursive: true, force: true });
  else console.log(`units: kept ${dir}`);
}
