// The scaffold writes a project with every token filled and nothing of the
// studio's left in it; the catalogue tool emits a file from it.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bin = resolve('bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-smoke-'));
const fail = (m) => { console.error(`smoke: ${m}`); process.exit(1); };

try {
  execFileSync('node', [bin, 'create', 'smoke-salon', '--name', 'Smoke Salon', '--locale', 'de-CH', '--out', join(dir, 'site'), '--no-git'], { stdio: 'pipe' });
  const site = join(dir, 'site');
  for (const must of ['package.json', 'astro.config.mjs', 'src/content/blocks.ts', 'src/copy/de-CH.ts', 'jtk/design.json', '.gitignore', 'jtakeit-meta.mjs']) {
    if (!existsSync(join(site, must))) fail(`missing ${must}`);
  }
  for (const never of ['functions', 'src/copy/LOCALE.ts', 'fastlane-meta.mjs', '.fastlane', 'STATUS.md']) {
    if (existsSync(join(site, never))) fail(`${never} should not be scaffolded`);
  }
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  for (const f of walk(site)) {
    if (/\.(png|jpe?g|webp|avif|gif|ico|woff2?)$/i.test(f)) continue;
    const body = readFileSync(f, 'utf8');
    const left = body.match(/\{\{[A-Z_]+\}\}/g);
    if (left) fail(`${f} still carries ${left.join(', ')}`);
    if (/wrangler|functions\/api|fastlane:/.test(body)) fail(`${f} still names the studio's tooling`);
  }
  const pkg = JSON.parse(readFileSync(join(site, 'package.json'), 'utf8'));
  if (pkg.name !== 'smoke-salon') fail('package name is not the slug');
  if (pkg.scripts.deploy) fail('a deploy script was scaffolded');
  const de = readFileSync(join(site, 'src/copy/de-CH.ts'), 'utf8');
  if (!de.includes('Zum Inhalt springen')) fail('the copy is not in the site\'s language');

  // An element a script makes carries none of Astro's scope attribute, so a
  // scoped rule for its class matches nothing: the booking form's time slots
  // were bare browser buttons and the chosen one looked like the rest
  // (vatra-kyiv, 1 October 2026). Such a class is styled through :global().
  for (const f of walk(join(site, 'src'))) {
    if (!f.endsWith('.astro')) continue;
    const body = readFileSync(f, 'utf8');
    const scoped = [...body.matchAll(/<style(?![^>]*is:global)[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const [, made] of body.matchAll(/\.className\s*=\s*['"]([\w-]+)['"]/g)) {
      const rule = new RegExp(`(^|[\\s,}])\\.${made}(?![\\w-])`, 'm');
      if (rule.test(scoped.replace(/:global\([^)]*\)/g, ''))) fail(`${f}: .${made} is made by a script and styled scoped — it matches nothing; use :global(.${made})`);
    }
  }

  // The catalogue tool, on the scaffold it just wrote: the file is emitted, and
  // a module the site turns on gets its settings seeded in the platform's one
  // shape — once, never over a file that is already there.
  execFileSync('node', [bin, 'catalogue', '--emit-only'], { cwd: site, stdio: 'pipe' });
  if (!existsSync(join(site, 'jtk/catalogue.json'))) fail('jtk catalogue wrote no catalogue');
  if (existsSync(join(site, 'jtk/bookings.json'))) fail('a site without modules was given a diary');

  const blocks = join(site, 'src/content/blocks.ts');
  writeFileSync(blocks, readFileSync(blocks, 'utf8').replace(
    'export const MODULES: Modules = {};',
    "export const MODULES: Modules = { bookings: { services: 'services', resources: 'masters' } };",
  ));
  execFileSync('node', [bin, 'catalogue', '--emit-only'], { cwd: site, stdio: 'pipe' });
  const seeded = JSON.parse(readFileSync(join(site, 'jtk/bookings.json'), 'utf8'));
  if (seeded.blocks?.[0]?.type !== 'bookings_config' || seeded.blocks[0].v !== 1) fail('the diary was not seeded as one bookings_config block');
  if (!JSON.parse(readFileSync(join(site, 'jtk/catalogue.json'), 'utf8')).modules?.bookings) fail('MODULES did not reach the catalogue');

  seeded.blocks[0].zone = 'Europe/Zurich';
  writeFileSync(join(site, 'jtk/bookings.json'), JSON.stringify(seeded));
  execFileSync('node', [bin, 'catalogue', '--emit-only'], { cwd: site, stdio: 'pipe' });
  if (JSON.parse(readFileSync(join(site, 'jtk/bookings.json'), 'utf8')).blocks[0].zone !== 'Europe/Zurich') fail('the tool wrote over a diary that was already there');

  // A blog, turned on by --blog: the two lines at the foot of blocks.ts, and
  // the listing page that builds itself once the collection is there.
  execFileSync('node', [bin, 'create', 'smoke-blog', '--locale', 'en', '--blog', '--out', join(dir, 'blog'), '--no-git'], { stdio: 'pipe' });
  const blogged = readFileSync(join(dir, 'blog', 'src/content/blocks.ts'), 'utf8');
  if (!blogged.includes('BLOCKS.push(BLOG_POST);') || !blogged.includes('COLLECTIONS.push(BLOG_COLLECTION);')) fail('--blog did not turn the blog on');
  if (!existsSync(join(dir, 'blog', 'src/pages/[...lang]/blog/index.astro'))) fail('the blog listing is not scaffolded');
  if (readFileSync(join(site, 'src/content/blocks.ts'), 'utf8').includes('turned on by `jtk create --blog`')) fail('a site without --blog has a blog');
  for (const one of ['src/copy/index.ts', 'src/copy/make.ts', 'src/lib/locale.ts', 'src/components/Languages.astro', 'src/pages/[...lang]/index.astro']) {
    if (!existsSync(join(site, one))) fail(`missing ${one}`);
  }

  // A booking kit, laid out: the kit is the platform's (jtakeit:///kits/<kind>.md);
  // this one is made up and small, to hold the laying out, not the kinds.
  const kitFile = join(dir, 'kit.json');
  writeFileSync(kitFile, JSON.stringify({
    kind: 'car_rental', about: 'A test kit.', ask: ['zone: the time zone'],
    catalogue: {
      blocks: [
        { type: 'tariff', v: 1, label: { uk: 'Тариф', en: 'Rate', de: 'Tarif' }, fields: [
          { key: 'title', label: 'Name', kind: 'text', required: true, max: 80, client_editable: true },
          { key: 'takes', label: 'Takes', kind: 'duration', required: true, client_editable: true },
        ] },
        { type: 'car', v: 1, label: 'Car', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true, max: 80, client_editable: true }] },
      ],
      collections: [
        { name: 'services', label: 'Rates', one: 'rate', prefix: '/rates', type: 'tariff', pages: false },
        { name: 'cars', label: 'Cars', prefix: '/cars', type: 'car' },
      ],
      modules: { bookings: { services: 'services', resources: 'cars' } },
    },
    settings: { kind: 'car_rental', scale: 'daily' },
    entries: [{ collection: 'services', slug: 'day', fields: { title: { uk: 'Доба', en: 'Day', de: 'Tag' }, takes: 1440 } }],
  }));
  const rental = join(dir, 'rental');
  execFileSync('node', [bin, 'create', 'smoke-rental', '--locale', 'de-CH', '--kit', kitFile, '--out', rental, '--no-git'], { stdio: 'pipe' });
  const laid = readFileSync(join(rental, 'src/content/blocks.ts'), 'utf8');
  if (!laid.includes('BLOCKS.push(') || !laid.includes('"prefix": "/rates"') || !laid.includes('"resources": "cars"')) fail('the kit did not reach blocks.ts');
  const diary = JSON.parse(readFileSync(join(rental, 'jtk/bookings.json'), 'utf8')).blocks[0];
  if (diary.type !== 'bookings_config' || diary.kind !== 'car_rental' || diary.page !== '/rates') fail('the kit\'s settings are not the diary\'s, with the form on the rates');
  const day = JSON.parse(readFileSync(join(rental, 'jtk/content/rates/day.json'), 'utf8'));
  if (day.collection !== 'services' || day.path !== '/rates/day' || day.blocks[0].title !== 'Tag' || day.blocks[0].type !== 'tariff') fail('the kit\'s rate is not an entry in the site\'s language');
  execFileSync('node', [bin, 'catalogue', '--emit-only'], { cwd: rental, stdio: 'pipe' });
  const emitted = JSON.parse(readFileSync(join(rental, 'jtk/catalogue.json'), 'utf8'));
  if (emitted.modules?.bookings?.resources !== 'cars' || !emitted.blocks.some((b) => b.type === 'tariff')) fail('the kit did not reach the catalogue');

  if (diary.kit !== 'car_rental' || 'kit_version' in diary) fail('a kit from a file is named, and has no version to record');

  // A kit by its kind, asked of the platform: a stand-in answers on a port of
  // its own, in a process of its own, as /v1/kits does — the kit whole and
  // its version, which the settings record for the judge (JTK_W_KIT_BEHIND).
  const served = JSON.parse(readFileSync(kitFile, 'utf8'));
  const platform = spawn('node', ['-e', `
    const http = require('node:http');
    const kit = ${JSON.stringify(served)};
    http.createServer((q, a) => {
      a.setHeader('content-type', 'application/json');
      if (q.url === '/v1/kits/car_rental') return a.end(JSON.stringify({ kind: 'car_rental', version: 'abc123def456', kit }));
      if (q.url === '/v1/kits') return a.end(JSON.stringify({ kits: [{ kind: 'car_rental', about: '', version: 'abc123def456' }] }));
      a.statusCode = 404; a.end('{}');
    }).listen(0, '127.0.0.1', function () { console.log(this.address().port); });
  `]);
  const port = await new Promise((done, failed) => {
    platform.stdout.once('data', (line) => done(String(line).trim()));
    platform.once('error', failed);
  });
  try {
    const asked = join(dir, 'asked');
    execFileSync('node', [bin, 'create', 'smoke-asked', '--locale', 'uk', '--kit', 'car_rental', '--api', `http://127.0.0.1:${port}`, '--out', asked, '--no-git'], { stdio: 'pipe' });
    const settings = JSON.parse(readFileSync(join(asked, 'jtk/bookings.json'), 'utf8')).blocks[0];
    if (settings.kit !== 'car_rental' || settings.kit_version !== 'abc123def456') fail('a kit asked by its kind did not record which kit and which version');
    if (JSON.parse(readFileSync(join(asked, 'jtk/content/rates/day.json'), 'utf8')).blocks[0].title !== 'Доба') fail('a kit asked by its kind did not lay its rates out');
    const byKind = join(dir, 'by-kind');
    execFileSync('node', [bin, 'create', 'smoke-kind', '--kind', 'car_rental', '--api', `http://127.0.0.1:${port}`, '--out', byKind, '--no-git'], { stdio: 'pipe' });
    if (JSON.parse(readFileSync(join(byKind, 'jtk/bookings.json'), 'utf8')).blocks[0].kit !== 'car_rental') fail('--kind is not --kit');

    let said = '';
    try {
      execFileSync('node', [bin, 'create', 'smoke-none', '--kit', 'hovercraft_hire', '--api', `http://127.0.0.1:${port}`, '--out', join(dir, 'none'), '--no-git'], { stdio: 'pipe' });
    } catch (why) {
      said = String(why.stderr);
    }
    if (!said.includes('no kit of that kind') || !said.includes('car_rental')) fail(`a kind the platform has no kit of was not refused with the kinds: ${said}`);
  } finally {
    platform.kill();
  }

  const refused = (args) => {
    try { execFileSync('node', [bin, 'create', 'smoke-no', ...args, '--out', join(dir, 'no'), '--no-git'], { stdio: 'pipe' }); return false; } catch { return true; }
  };
  writeFileSync(join(dir, 'bad.json'), '{"kind": "car_rental"}');
  if (!refused(['--kit', join(dir, 'bad.json')])) fail('a file that is not a kit was laid out');

  // --out naming a file is refused with a sentence, not a stack trace.
  writeFileSync(join(dir, 'a-file'), 'not a directory');
  let whined = '';
  try {
    execFileSync('node', [bin, 'create', 'smoke-file', '--out', join(dir, 'a-file'), '--no-git'], { stdio: 'pipe' });
  } catch (why) {
    whined = String(why.stderr);
  }
  if (!whined.includes('is a file, not a directory') || whined.includes('readdirSync')) fail(`--out on a file: ${whined || 'was not refused'}`);

  console.log('smoke: the scaffold is whole');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// The template's lockfile names the kit at the version the template depends
// on: a lockfile a version behind is a scaffold every `npm ci` refuses
// (0.5.0, 8 October 2026 — the builder's image failed to build from it).
{
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../template/package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../template/package-lock.json', import.meta.url), 'utf8'));
  const wanted = manifest.dependencies['@jtakeit/kit'];
  const locked = lock.packages?.['node_modules/@jtakeit/kit']?.version;
  if (wanted !== locked) {
    console.error(`smoke: template/package.json wants @jtakeit/kit ${wanted} and template/package-lock.json holds ${locked} — run npm install --package-lock-only in template/`);
    process.exit(1);
  }
  console.log(`smoke: the template's lockfile holds @jtakeit/kit ${locked}, as its manifest wants`);
}
