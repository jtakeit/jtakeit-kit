// The scaffold, built — on contract 2 and, moved by `jtk upgrade contract-3`,
// on contract 3 — and read back: what the contract-3 rehearsal on staging
// found wrong in the template (11 November 2026), each held to the page.
//
//   1  the business's facts from the shared contacts, by role: the structured
//      data, the head and llms.txt — src/data/site.ts only where they say nothing
//   4  the enquiry form's labels in the site's language; one #contact; on
//      contract 3 every word of it the block's, the question's too, tappable
//   5  a button's link from the content under the build's base
//   6  the sitemap: the booking page, the blog's listing, the privacy page
//   7  an Article with its @context, and only a post an Article
//   8  a length and a price in a listing's row, apart
//   9  the booking form's last day the diary's horizon
//
// A salon laid out from the kit's fixture, with a blog, in de-CH, on contract 2
// (`--contract 2`) and moved; the kit is this checkout's, packed, as the smoke
// test installs it. A contract-3 scaffold laid out directly is test/create3.mjs's.
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
  execFileSync('node', [bin, 'create', 'salon-probe', '--name', 'Salon Probe', '--locale', 'de-CH', '--kit', resolve('test/fixtures/kit-salon.json'), '--blog', '--out', site, '--no-git', '--contract', '2'], { stdio: 'pipe' });
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
  write('src/content/blocks.ts', declaration.replace(city, `${city},\n      { key: 'street', label: 'Street', kind: 'text', max: 80, client_editable: true, no_tap_target: true, role: 'street', localized: false, hint: 'The street and the number.' },\n      { key: 'postal_code', label: 'Postal code', kind: 'text', max: 10, client_editable: true, no_tap_target: true, role: 'postal_code', localized: false, hint: 'The postcode.' }`));
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
    // Every word of the form is the block's since the move, the question's too: tappable, in the site's language.
    for (const [field, words] of [['name_label', 'Name'], ['contact_label', 'Telefon oder E-Mail'], ['message_label', 'Nachricht']]) {
      check(index.includes(`<span data-jtk-path="blocks[ctab0001].${field}">${words}</span>`), `4 · contract 3: the form's ${field} is not «${words}», the block's`);
    }
    check(index.includes('<label class="field__label" for="lead-topic" data-jtk-path="blocks[ctab0001].topic_label">Worum es geht</label>'), `4 · contract 3: the question is not the block's words, tappable: ${index.match(/<label[^>]*for="lead-topic"[^>]*>[^<]*<\/label>/)?.[0]}`);
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
  //  15  what people book is in every language: a master nobody translated
  //      is in the English booking form, in German words marked de-CH
  {
    const photos = resolve('lib/showroom/photos');
    mkdirSync(join(site, 'src/assets/media/probe'), { recursive: true });
    writeFileSync(join(site, 'src/assets/media/probe/eins.jpg'), readFileSync(join(photos, 'pexels-11169551.jpg')));
    writeFileSync(join(site, 'src/assets/media/probe/zwei.jpg'), readFileSync(join(photos, 'pexels-13058812.jpg')));
    write('src/content/blocks.ts', read('src/content/blocks.ts').replace('export const LOCALES: string[] = [];', "export const LOCALES: string[] = ['en'];"));
    // The one thing it says: English has no copy of its own yet (17, 22).
    const emitted = spawnSync('node', [bin, 'schema', '--emit-only', '--root', site], { encoding: 'utf8' });
    if (emitted.status !== 1 || !emitted.stderr.includes('src/copy/en.ts is not written')) fail(`jtk schema --emit-only in two languages:\n${emitted.stdout}\n${emitted.stderr}`);
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
    // A second master nobody has translated: what people book is in every
    // language, always (the owner, 12 November 2026) — in the English form,
    // in German words marked as German.
    const cut = json('jtk/entries/services/cut.json');
    write('jtk/entries/masters/beat.json', { id: '0193a5c3-0000-7000-8000-0000000000b1', collection: 'masters', slug: 'beat', rank: 'z', visible: true, fields: { title: 'Beat Keller', does: [cut.id] } });
    // The city is per language; the business's name, street and postcode are
    // the same in every language (localized: false), nothing to translate.
    const shared3 = json('jtk/shared.json');
    write('jtk/shared.en.json', { locale: 'en', blocks: [{ _key: shared3.blocks[0]._key, city: 'Zurich' }] });
    // The page the services are listed on: its SEO, in both languages.
    const services3 = json('jtk/pages/services.json');
    write('jtk/pages/services.json', { ...services3, seo: { title: 'Preise und Termine', description: 'Was es kostet.' } });
    write('jtk/pages/services.en.json', { of: services3.id, locale: 'en', name: 'Prices', seo: { title: 'Prices and times' } });

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
    // 15 · what people book, in every language: the master nobody translated
    // is in the English booking form, in German marked as German, named by
    // the slug the diary books by; the translated one in English, unmarked.
    const form = page('en/services');
    check(/<option value="beat" data-does="cut" lang="de-CH"[^>]*>Beat Keller<\/option>/.test(form), `15 · the untranslated master is not in /en's booking form, marked de-CH: ${form.match(/<select[^>]*name="resource"[\s\S]*?<\/select>/)?.[0]}`);
    check(/<option value="anna" data-does="cut"(?![^>]*\blang=)[^>]*>Anna Meier<\/option>/.test(form), '15 · the translated master is not in /en\'s booking form in its own words');
    check(/value="cut"[^>]*>[\s\S]{0,200}?lang="de-CH"[^>]*>Haarschnitt</.test(form) || /<option value="cut" lang="de-CH"[^>]*>Haarschnitt<\/option>/.test(form), '15 · the untranslated service is not in /en\'s booking form, marked de-CH');
    check(/<option value="beat" data-does="cut"(?![^>]*\blang=)[^>]*>Beat Keller<\/option>/.test(page('services')), '15 · the original\'s form marks its own words');
    check(de.includes('hreflang="en"') && en.includes('hreflang="de-CH"') && de.includes('hreflang="x-default"'), '13 · the home pages do not name each other');
    const sitemap = read('dist/sitemap.xml');
    for (const address of ['en/', 'en/blog/', 'en/privacy/', 'en/masters/anna/', 'en/services/']) {
      check(sitemap.includes(`<loc>https://salon-probe.example/${address}</loc>`), `13 · the sitemap has no /${address}`);
    }
    check(!sitemap.includes('/en/blog/first/'), '13 · the sitemap lists the held-back English post');
    const llms = read('dist/llms.txt');
    check(llms.split('\n').includes('- /en: '), `13 · llms.txt does not list the English home:\n${llms}`);
    check(llms.includes('- /en/masters/anna/: Anna Meier') && !llms.includes('First post'), `13 · llms.txt does not list the English entries as they are out:\n${llms}`);

    // 16 · hreflang names each alternate by its own language, once: on /en/ the
    // original's said `en` (the rehearsal on staging, 12 November 2026).
    for (const [where, html] of [['/en', en], ['/en/services', page('en/services')], ['/', de]]) {
      const named = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((one) => one[1]).sort();
      check(JSON.stringify(named) === JSON.stringify(['de-CH', 'en', 'x-default']), `16 · ${where} names its alternates ${JSON.stringify(named)}`);
    }

    // 17 · with no English copy, what is not content is the original's words, marked.
    check(/<a class="skip-link"[^>]*lang="de-CH"[^>]*>Zum Inhalt springen<\/a>/.test(en), `17 · /en's skip link is not marked de-CH: ${en.match(/<a class="skip-link"[^>]*>[^<]*<\/a>/)?.[0]}`);
    check(/<p class="lead__status" role="status" data-status lang="de-CH">/.test(en), '17 · /en\'s form messages are not marked de-CH');
    check(/<label class="field__label" for="lead-topic"[^>]*lang="de-CH"[^>]*>Worum es geht/.test(en) || !en.includes('Worum es geht'), `17 · /en's ask label is not marked de-CH: ${en.match(/<label[^>]*>Worum es geht/)?.[0]}`);
    // The form's words are content: a translation that has none of them shows the original's, marked, still tappable.
    check(en.includes('<span data-jtk-path="blocks[ctab0001].contact_label" lang="de-CH">Telefon oder E-Mail</span>'), `17 · /en's contact label is not the original's, marked: ${en.match(/<span[^>]*contact_label[^>]*>[^<]*<\/span>/)?.[0]}`);
    check(/<main id="content" class="prose" data-jtk-fixed lang="de-CH"/.test(page('en/privacy')), '17 · /en/privacy is not marked de-CH');
    check(!/(?<![a-z])lang="de-CH"/.test(page('privacy').replace(/<html[^>]*>/, '').replace(/<a [^>]*hreflang[^>]*>/g, '')), '17 · the original\'s privacy page marks its own words');
    const missingCopy = JSON.parse(spawnSync('node', [join(site, 'node_modules/@jtakeit/kit/bin/jtkit.mjs'), 'progress', '--root', site, '--json'], { encoding: 'utf8' }).stdout || '{}').missing ?? [];
    check(missingCopy.some((one) => one.startsWith('src/copy/en.ts is not written')), `17 · jtkit progress does not name the English copy: ${JSON.stringify(missingCopy)}`);
    const schemaSays = spawnSync('node', [bin, 'schema', '--root', site, '--emit-only'], { encoding: 'utf8' });
    check(schemaSays.status === 1 && schemaSays.stderr.includes('src/copy/en.ts is not written') && schemaSays.stderr.includes('npx @jtakeit/astro copy en'), `17 · jtk schema does not name the English copy:\n${schemaSays.stderr}`);

    // 18 · the listing's rows: the untranslated service in German, marked.
    check(/<h[23][^>]*lang="de-CH"[^>]*>Haarschnitt<\/h[23]>/.test(page('en/services')), `18 · /en/services lists the untranslated service unmarked: ${page('en/services').match(/<h[23][^>]*>Haarschnitt<\/h[23]>/)?.[0]}`);

    // 19 · a listing page reads its page's SEO, in its language, and names the business as its shared text does.
    check(page('en/services').includes('<title>Prices and times — Coiffure Langstrasse</title>'), `19 · /en/services' title: ${page('en/services').match(/<title>[^<]*<\/title>/)?.[0]}`);
    check(page('services').includes('<title>Preise und Termine — Coiffure Langstrasse</title>'), `19 · /services' title: ${page('services').match(/<title>[^<]*<\/title>/)?.[0]}`);
    check(page('en/services').includes('<meta name="description" content="Was es kostet.">'), `19 · /en/services' description: ${page('en/services').match(/<meta name="description"[^>]*>/)?.[0]}`);
    check(en.includes('<title>Beautiful hair</title>') || /<title>Beautiful hair[^<]*<\/title>/.test(en), '19 · the English home\'s title');

    // 20 · an entry nobody translated: the switch goes to its English page; no hreflang, no sitemap line.
    const beat = page('masters/beat');
    check(/<a [^>]*href="\/en\/masters\/beat\/?"/.test(beat), `20 · /masters/beat has no switch to English: ${beat.match(/<nav[^>]*languages[\s\S]*?<\/nav>/)?.[0]}`);
    check(!/<link rel="alternate" hreflang="en"/.test(beat), '20 · /masters/beat names an English alternate nobody translated');
    check(/<link rel="alternate" hreflang="en"/.test(page('masters/anna')), '20 · /masters/anna has no English alternate');
    const sitemap3 = read('dist/sitemap.xml');
    check(!sitemap3.includes('/en/masters/beat/') && sitemap3.includes('/en/masters/anna/'), '20 · the sitemap lists an untranslated entry at its English address, or not a translated one');

    // 21 · the privacy page says who «we» are under its last heading.
    check(/<address>Coiffure Langstrasse<br>Langstrasse 12<br>8004 Zürich<br>\+41 44 123 45 67 · hallo@salon-probe\.example<\/address>/.test(page('privacy')), `21 · /privacy says nobody under «Über uns»: ${page('privacy').match(/<h2>[^<]*<\/h2>\s*(<address>[\s\S]*?<\/address>)?\s*<\/main>/)?.[0]}`);

    // 22 · English's copy, written by the kit, and nothing of it falls back.
    const copied = spawnSync('node', [bin, 'copy', 'en', '--root', site], { encoding: 'utf8' });
    check(copied.status === 0 && existsSync(join(site, 'src/copy/en.ts')), `22 · jtk copy en:\n${copied.stdout}\n${copied.stderr}`);
    build('https://salon-probe.example/');
    const en2 = page('en');
    check(/<a class="skip-link" href="#content" data-jtk-fixed>Skip to content<\/a>/.test(en2), `22 · /en's skip link after jtk copy: ${en2.match(/<a class="skip-link"[^>]*>[^<]*<\/a>/)?.[0]}`);
    check(/<p class="lead__status" role="status" data-status>/.test(en2), '22 · /en\'s form messages are still marked after jtk copy');
    check(/<main id="content" class="prose" data-jtk-fixed>/.test(page('en/privacy')) && !page('en/privacy').includes('Datenschutz'), '22 · /en/privacy is not in English after jtk copy');
    check(/<p class="lead" [^>]*lang="de-CH">Seit 1998 an der Langstrasse<\/p>/.test(en2), '22 · the untranslated lead lost its mark');
    // jtk copy writes the form's words into English's translation, in the kit's: English, tappable, unmarked.
    check(json('jtk/pages/index.en.json').title === undefined && json('jtk/pages/index.en.json').name === 'Home', '22 · jtk copy en wrote over the translation');
    check(en2.includes('<label class="field__label" for="lead-topic" data-jtk-path="blocks[ctab0001].topic_label">What it is about</label>'), `22 · /en's question after jtk copy: ${en2.match(/<label[^>]*for="lead-topic"[^>]*>[^<]*<\/label>/)?.[0]}`);
    check(en2.includes('<span data-jtk-path="blocks[ctab0001].contact_label">Phone or email</span>') && en2.includes('<span data-submit-label data-jtk-path="blocks[ctab0001].cta_label">Send</span>'), '22 · /en\'s form labels are not English after jtk copy');

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
