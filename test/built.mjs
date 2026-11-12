// The scaffold, built — on contract 2 and, moved by `jtk upgrade contract-3`,
// on contract 3 — and read back: what the contract-3 rehearsal on staging
// found wrong in the template (11 November 2026), each held to the page.
//
//   1  the business's facts from the shared contacts, by role: the structured
//      data, the head and llms.txt — src/data/site.ts only where they say nothing
//   4  the enquiry form's labels in the site's language; one #contact
//   5  a button's link from the content under the build's base
//   6  the sitemap: the booking page, the blog's listing, the privacy page
//   7  an Article with its @context, and only a post an Article
//   8  a length and a price in a listing's row, apart
//   9  the booking form's last day the diary's horizon
//
// A salon laid out from the kit's fixture, with a blog, in de-CH; the kit is
// this checkout's, packed, as the smoke test installs it.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bin = resolve('bin/jtk.mjs');
const dir = mkdtempSync(join(tmpdir(), 'jtk-built-'));
const site = join(dir, 'site');
const fail = (m) => {
  console.error(`built: ${m}`);
  process.exit(1);
};
const write = (file, value) => {
  mkdirSync(join(site, file, '..'), { recursive: true });
  writeFileSync(join(site, file), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const read = (file) => readFileSync(join(site, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const build = (url) => {
  rmSync(join(site, 'dist'), { recursive: true, force: true });
  const run = spawnSync('npm', ['run', 'build'], { cwd: site, encoding: 'utf8', env: { ...process.env, SITE_URL: url } });
  if (run.status !== 0) fail(`the scaffold did not build at ${url}:\n${run.stdout}\n${run.stderr}`);
};
const page = (address) => read(join('dist', address, 'index.html'));
/** Every JSON-LD document of a page. */
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((one) => JSON.parse(one[1]));
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
/** A page's styles: inlined into it, or in the stylesheets it links. */
const styles = (html) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((one) => one[1]).join('\n') +
  [...html.matchAll(/<link rel="stylesheet" href="[^"]*?(\/_astro\/[^"]+\.css)"/g)].map((one) => read(join('dist', one[1]))).join('\n');
/** A length and a price, two spans side by side, and the dot between them drawn by the stylesheet. */
const apart = (html) =>
  /<span class="listing-row__term"[^>]*>30 Minuten<\/span><span class="listing-row__term"[^>]*>/.test(html) &&
  /\.listing-row__term(\[[^\]]+\])?\+\.listing-row__term(\[[^\]]+\])?:?:before\{content:" · "\}/.test(styles(html));
/** Every fault of a stage said together, then the run stops: one red build says all it found. */
const faults = [];
const check = (ok, said) => {
  if (!ok) faults.push(said);
};
const settle = (stage) => {
  if (faults.length > 0) fail(`${stage}:\n  ${faults.join('\n  ')}`);
};

try {
  execFileSync('node', [bin, 'create', 'salon-probe', '--name', 'Salon Probe', '--locale', 'de-CH', '--kit', resolve('test/fixtures/kit-salon.json'), '--blog', '--out', site, '--no-git'], { stdio: 'pipe' });
  const packed = execFileSync('npm', ['pack', resolve('kit'), '--pack-destination', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(dir, packed)], { cwd: site, stdio: 'pipe' });

  // ── contract 2 ───────────────────────────────────────────────────────────
  const home = json('jtk/content/index.json');
  Object.assign(home.blocks[0], { title: 'Schöne Haare', cta_label: 'Preise', cta_href: '/services' });
  Object.assign(home.blocks[1], { title: 'Fragen?', cta_label: 'Senden' });
  home.blocks[2] = { ...home.blocks[2], title: 'Häufige Fragen', items: [{ _key: 'q1', question: 'Bar?', answer: 'Auch Karte.' }] };
  write('jtk/content/index.json', home);
  write('jtk/content/services/cut.json', { path: '/services/cut', collection: 'services', visible: true, blocks: [{ type: 'service', v: 1, title: 'Haarschnitt', takes: 30, costs: 3000 }] });
  write('jtk/content/masters/anna.json', { path: '/masters/anna', collection: 'masters', visible: true, blocks: [{ type: 'master', v: 1, title: 'Anna Meier', does: [{ service: 'cut' }] }] });
  write('jtk/content/blog/erster.json', { path: '/blog/erster', collection: 'blog', visible: true, blocks: [{ type: 'post', v: 1, title: 'Erster Beitrag', date: '2026-11-01', body: 'Hallo.' }] });

  // Under the preview's path, where an address written straight leaves the site.
  build('https://salon-probe.example/p/probe/');
  {
    const index = page('');
    check(index.includes('<a class="btn" href="/p/probe/services"'), `5 · contract 2: the hero's /services is not under the base: ${index.match(/<a class="btn"[^>]*>/)?.[0]}`);
    check((index.match(/id="contact"/g) ?? []).length === 1, '4 · contract 2: the home page has not one #contact');
    check(/<section class="band band--cta_banner" id="contact">/.test(index), '4 · contract 2: #contact is not the band with the form');
    for (const label of ['>Name</span>', '>Telefon oder E-Mail</span>', '>Nachricht</span>', 'data-jtk-fixed>Worum es geht</label>']) {
      check(index.includes(label), `4 · contract 2: the form does not say ${label}`);
    }
    check(!index.includes('What it is about'), '4 · contract 2: the ask is in English on a de-CH site');
    const sitemap = read('dist/sitemap.xml');
    for (const address of ['', 'services/', 'blog/', 'privacy/', 'masters/anna/', 'blog/erster/']) {
      check(sitemap.includes(`<loc>https://salon-probe.example/p/probe/${address}</loc>`), `6 · contract 2: the sitemap has no /${address}`);
    }
    check(!sitemap.includes('/p/probe/p/probe/'), '6 · contract 2: the sitemap writes the base twice');
    const post = ld(page('blog/erster')).find((one) => one['@type'] === 'Article');
    check(post?.['@context'] === 'https://schema.org', '7 · contract 2: a post\'s Article has no @context');
    check(!ld(page('masters/anna')).some((one) => one['@type'] === 'Article'), '7 · contract 2: a master is typed an Article');
    const services = page('services');
    check(apart(services), `8 · contract 2: the length and the price run together: ${services.match(/30 Minuten<\/span>.{0,60}/)?.[0]}`);
    check(services.includes(`id="booking-day" name="day" type="date" min="${day(0)}" max="${day(60)}"`), `9 · contract 2: the last day is not the diary's horizon of 60: ${services.match(/id="booking-day"[^>]*>/)?.[0]}`);
  }
  settle('contract 2, built under /p/probe/');

  // ── contract 3 ───────────────────────────────────────────────────────────
  const moved = spawnSync('node', [bin, 'upgrade', 'contract-3', '--root', site, '--mint-ids', '--no-install'], { encoding: 'utf8' });
  if (moved.status !== 0) fail(`jtk upgrade contract-3:\n${moved.stdout}\n${moved.stderr}`);
  check(json('package.json').dependencies['@jtakeit/kit'].startsWith('file:'), '3 · the packed kit was rewritten to a version');
  // The address in parts, as the rehearsal's contacts had it: declared with roles, then filled as the owner fills them.
  const declaration = read('src/content/blocks.ts');
  const city = /\{\s*"?key"?: ['"]city['"],[^{}]*?"?role"?: ['"]city['"][^{}]*\}/.exec(declaration)?.[0];
  if (city === undefined) fail('the moved declaration has no contacts city with its role');
  write('src/content/blocks.ts', declaration.replace(city, `${city},\n      { key: 'street', label: 'Street', kind: 'text', max: 80, client_editable: true, no_tap_target: true, role: 'street', hint: 'The street and the number.' },\n      { key: 'postal_code', label: 'Postal code', kind: 'text', max: 10, client_editable: true, no_tap_target: true, role: 'postal_code', hint: 'The postcode.' }`));
  const schema = spawnSync('node', [bin, 'schema', '--emit-only', '--root', site], { encoding: 'utf8' });
  if (schema.status !== 0) fail(`jtk schema --emit-only:\n${schema.stdout}\n${schema.stderr}`);
  const shared = json('jtk/shared.json');
  Object.assign(shared.blocks[0], { name: 'Coiffure Langstrasse', street: 'Langstrasse 12', postal_code: '8004', city: 'Zürich', phone: '+41 44 123 45 67', email: 'hallo@salon-probe.example' });
  write('jtk/shared.json', shared);

  build('https://salon-probe.example/');
  {
    const index = page('');
    const business = ld(index).find((one) => one['@id'] === 'https://salon-probe.example/#business');
    check(business?.name === 'Coiffure Langstrasse', `1 · contract 3: the business is named ${business?.name}, not by its contacts`);
    check(business?.telephone === '+41 44 123 45 67', `1 · contract 3: the telephone is ${business?.telephone}`);
    check(business?.email === 'hallo@salon-probe.example', '1 · contract 3: no email from the contacts');
    check(business?.url === 'https://salon-probe.example/', '1 · contract 3: the business has no url');
    check(JSON.stringify(business?.address) === JSON.stringify({ '@type': 'PostalAddress', streetAddress: 'Langstrasse 12', postalCode: '8004', addressLocality: 'Zürich' }), `1 · contract 3: the address is ${JSON.stringify(business?.address)}`);
    check(index.includes('<meta property="og:site_name" content="Coiffure Langstrasse">'), '1 · contract 3: og:site_name is not the contacts\' name');
    const llms = read('dist/llms.txt');
    for (const line of ['# Coiffure Langstrasse', 'Langstrasse 12, 8004 Zürich', '+41 44 123 45 67', 'hallo@salon-probe.example', '## Mitarbeitende', '## Blog']) {
      check(llms.split('\n').includes(line), `1 · contract 3: llms.txt has no line «${line}»:\n${llms}`);
    }
    check(!llms.includes('[object Object]'), '1 · contract 3: llms.txt says [object Object]');
    check(index.includes('<a class="btn" href="/services"'), '5 · contract 3: the hero\'s /services is not drawn');
    check((index.match(/id="contact"/g) ?? []).length === 1, '4 · contract 3: the home page has not one #contact');
    const sitemap = read('dist/sitemap.xml');
    for (const address of ['', 'services/', 'blog/', 'privacy/', 'masters/anna/', 'blog/erster/']) {
      check(sitemap.includes(`<loc>https://salon-probe.example/${address}</loc>`), `6 · contract 3: the sitemap has no /${address}`);
    }
    check(ld(page('blog/erster')).find((one) => one['@type'] === 'Article')?.['@context'] === 'https://schema.org', '7 · contract 3: a post\'s Article has no @context');
    check(!ld(page('masters/anna')).some((one) => one['@type'] === 'Article'), '7 · contract 3: a master is typed an Article');
    const services = page('services');
    check(apart(services), '8 · contract 3: the length and the price run together');
    check(services.includes(`max="${day(60)}"`), '9 · contract 3: the last day is not the diary\'s horizon');

    // The kit's own check: every contact the owner filled is drawn somewhere.
    const judged = spawnSync('node', [bin, 'schema', '--root', site, '--dist', join(site, 'dist')], { encoding: 'utf8' });
    const said = `${judged.stdout}\n${judged.stderr}`;
    check(!said.includes('no page draws it'), `1 · contract 3: jtk schema says a contact is drawn nowhere:\n${said}`);
    check(said.includes('the schema and the page agree'), `1 · contract 3: jtk schema and the page disagree:\n${said}`);
  }
  settle('contract 3, moved by jtk upgrade contract-3');

  // ── contract 3, in two languages (M3) ────────────────────────────────────
  //
  //  10  a translated page: its words in its language, the original's marked
  //      with the original's lang; <html lang> the page's
  //  11  a picture shared by both languages, changed once in the original
  //  12  an entry held back in a language: built, listed nowhere, no alternate
  //  13  hreflang, the sitemap and llms.txt in every language with a translation
  //  14  jtk schema and jtkit lint and progress read the two languages
  {
    const photos = resolve('lib/showroom/photos');
    mkdirSync(join(site, 'src/assets/media/probe'), { recursive: true });
    writeFileSync(join(site, 'src/assets/media/probe/eins.jpg'), readFileSync(join(photos, 'pexels-11169551.jpg')));
    writeFileSync(join(site, 'src/assets/media/probe/zwei.jpg'), readFileSync(join(photos, 'pexels-13058812.jpg')));
    write('src/content/blocks.ts', read('src/content/blocks.ts').replace('export const LOCALES: string[] = [];', "export const LOCALES: string[] = ['en'];"));
    const emitted = spawnSync('node', [bin, 'schema', '--emit-only', '--root', site], { encoding: 'utf8' });
    if (emitted.status !== 0) fail(`jtk schema --emit-only in two languages:\n${emitted.stdout}\n${emitted.stderr}`);
    if (JSON.stringify(json('jtk/schema.json').locales) !== '["en"]') fail('the schema does not say its second language');

    const home3 = json('jtk/pages/index.json');
    const hero = home3.blocks.find((one) => one.type === 'hero');
    Object.assign(hero, { title: 'Schöne Haare', lead: 'Seit 1998 an der Langstrasse', image: { src: 'media/probe/eins.jpg', alt: 'Der Salon' } });
    write('jtk/pages/index.json', home3);
    write('jtk/pages/index.en.json', { of: home3.id, locale: 'en', name: 'Home', seo: { title: 'Beautiful hair' }, blocks: [{ _key: hero._key, title: 'Beautiful hair', image: { alt: 'The salon' } }] });
    const post = json('jtk/entries/blog/erster.json');
    write('jtk/entries/blog/erster.en.json', { of: post.id, locale: 'en', slug: 'first', visible: false, fields: { title: 'First post' } });
    const anna = json('jtk/entries/masters/anna.json');
    write('jtk/entries/masters/anna.en.json', { of: anna.id, locale: 'en', slug: 'anna', fields: { title: 'Anna Meier' } });
    const shared3 = json('jtk/shared.json');
    write('jtk/shared.en.json', { locale: 'en', blocks: [{ _key: shared3.blocks[0]._key, name: 'Langstrasse Hair' }] });

    // The picture, changed once, in the original only.
    build('https://salon-probe.example/');
    const before = page('en');
    check(/<img[^>]*src="\/_astro\/eins\.[^"]*"/.test(before), '11 · the English home does not draw the original\'s picture');
    const changed = json('jtk/pages/index.json');
    changed.blocks.find((one) => one.type === 'hero').image = { src: 'media/probe/zwei.jpg', alt: 'Der Salon' };
    write('jtk/pages/index.json', changed);
    build('https://salon-probe.example/');

    const de = page('');
    const en = page('en');
    check(/<html lang="en"/.test(en), `10 · /en is not <html lang="en">: ${en.match(/<html[^>]*>/)?.[0]}`);
    check(/<html lang="de-CH"/.test(de), '10 · / is not <html lang="de-CH">');
    check(new RegExp(`<h1 data-jtk-path="blocks\\[${hero._key}\\]\\.title">Beautiful hair</h1>`).test(en), `10 · the English title is not drawn, annotated by key: ${en.match(/<h1[^>]*>[^<]*<\/h1>/)?.[0]}`);
    check(new RegExp(`<p class="lead" data-jtk-path="blocks\\[${hero._key}\\]\\.lead" lang="de-CH">Seit 1998 an der Langstrasse</p>`).test(en), `10 · the untranslated lead is not the original's, marked lang="de-CH": ${en.match(/<p class="lead"[^>]*>[^<]*<\/p>/)?.[0]}`);
    check(/<img[^>]*alt="The salon"/.test(en) && !/<img[^>]*alt="The salon"[^>]*lang=/.test(en), '10 · the English picture does not say its own words');
    check(!/data-jtk-path="[^"]*"[^>]* lang="/.test(de), '10 · the original marks its own words with a lang');
    for (const [where, html] of [['/', de], ['/en', en]]) {
      check(/<img[^>]*src="\/_astro\/zwei\.[^"]*"/.test(html) && !/\/_astro\/eins\./.test(html), `11 · ${where} does not draw the picture changed once in the original`);
    }
    check(existsSync(join(site, 'dist/en/blog/first/index.html')), '12 · the held-back English post is not built (the panel previews it)');
    check(!page('en/blog').includes('First post'), '12 · the held-back English post is listed at /en/blog');
    check(!page('blog/erster').includes('hreflang="en"'), '12 · the post has an English alternate while it is held back');
    check(page('masters/anna').includes('hreflang="en"') && page('en/masters/anna').includes('hreflang="de-CH"'), '13 · a translated entry has no alternates in both languages');
    check(de.includes('hreflang="en"') && en.includes('hreflang="de-CH"') && de.includes('hreflang="x-default"'), '13 · the home pages do not name each other');
    const sitemap = read('dist/sitemap.xml');
    for (const address of ['en/', 'en/blog/', 'en/privacy/', 'en/masters/anna/', 'en/services/']) {
      check(sitemap.includes(`<loc>https://salon-probe.example/${address}</loc>`), `13 · the sitemap has no /${address}`);
    }
    check(!sitemap.includes('/en/blog/first/'), '13 · the sitemap lists the held-back English post');
    const llms = read('dist/llms.txt');
    check(llms.split('\n').includes('- /en: '), `13 · llms.txt does not list the English home:\n${llms}`);
    check(llms.includes('- /en/masters/anna/: Anna Meier') && !llms.includes('First post'), `13 · llms.txt does not list the English entries as they are out:\n${llms}`);

    const judged = spawnSync('node', [bin, 'schema', '--root', site, '--dist', join(site, 'dist')], { encoding: 'utf8' });
    const said = `${judged.stdout}\n${judged.stderr}`;
    check(judged.status === 0 && said.includes('the schema and the page agree') && !said.includes('JTK_E_DOCUMENT_INVALID'), `14 · jtk schema on two languages:\n${said}`);
    const jtkit = join(site, 'node_modules/@jtakeit/kit/bin/jtkit.mjs');
    const linted = spawnSync('node', [jtkit, 'lint', '--root', site, '--dist', join(site, 'dist'), '--site-url', 'https://salon-probe.example/'], { encoding: 'utf8' });
    check(linted.status === 0, `14 · jtkit lint on two languages:\n${linted.stdout}\n${linted.stderr}`);
    const progress = spawnSync('node', [jtkit, 'progress', '--root', site, '--json'], { encoding: 'utf8' });
    const english = JSON.parse(progress.stdout || '{}').languages?.find((one) => one.locale === 'en');
    check(english !== undefined && english.held === 1 && english.missing.includes('jtk/pages/index.en.json blocks[' + hero._key + '].lead'), `14 · jtkit progress does not say what English lacks: ${JSON.stringify(english)}`);
  }
  settle('contract 3, in two languages');
  console.log('built: the scaffold, on contract 2 and contract 3, in one language and two, says what its content says');
} finally {
  if (!process.env.KEEP_BUILT) rmSync(dir, { recursive: true, force: true });
  else console.log(`built: kept ${dir}`);
}
