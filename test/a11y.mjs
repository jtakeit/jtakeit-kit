// The sites the scaffold builds, read against WCAG 2.1 AA by `jtk a11y`
// (lib/a11y.mjs): a scaffold laid out with the salon kit and a blog, given
// the content a real site has — words in the hero, two services, two
// masters, a post, the same in German — built, and read on every page it
// wrote; then built again on a dark palette and read again. A scaffold
// nobody has written in has empty headings and no form, and passes
// everything for the wrong reason.
//
//   node test/a11y.mjs                  lays out its own scaffold (asks the platform for the salon kit)
//   node test/a11y.mjs --site /tmp/probe  seeds and reads one already laid out and installed (CI's probe)
//
// Not in `npm test`: it needs a Chrome and a scaffold's node_modules, which
// CI already has for the probe build; it runs as its own step there.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { audit, report } from '../lib/a11y.mjs';

const args = process.argv.slice(2);
const at = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const started = Date.now();
const root = resolve(import.meta.dirname, '..');

let site = at('--site');
let scratch = '';
if (!site) {
  scratch = mkdtempSync(join(tmpdir(), 'jtk-a11y-'));
  site = join(scratch, 'probe');
  execFileSync('node', [join(root, 'bin/jtk.mjs'), 'create', 'probe', '--out', site, '--kit', 'salon', '--locale', 'en', '--blog', '--no-git'], { stdio: 'pipe' });
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(root, 'kit')], { cwd: site, stdio: 'pipe' });
}
site = resolve(site);

const write = (file, value) => {
  mkdirSync(join(site, file, '..'), { recursive: true });
  writeFileSync(join(site, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
};
const read = (file) => readFileSync(join(site, file), 'utf8');

// ── the content ──────────────────────────────────────────────────────────────
const blocks = read('src/content/blocks.ts');
if (!blocks.includes('COLLECTIONS.push(BLOG_COLLECTION);')) {
  write('src/content/blocks.ts', `${blocks.trimEnd()}\n\nBLOCKS.push(BLOG_POST);\nCOLLECTIONS.push(BLOG_COLLECTION);\n`);
}
write('src/content/blocks.ts', read('src/content/blocks.ts').replace("export const LOCALES: string[] = [];", "export const LOCALES: string[] = ['de'];"));

const home = (de) => ({
  path: de ? '/de' : '/',
  ...(de ? { locale: 'de' } : {}),
  seo: { title: '', description: '' },
  blocks: [
    { _key: 'hero0001', type: 'hero', v: 1,
      eyebrow: de ? 'Salon in Zürich' : 'A salon in Zürich',
      title: de ? 'Haare, ruhig geschnitten' : 'Hair, cut without hurry',
      lead: de ? 'Ein Stuhl, eine Stunde, Ihre Zeit.' : 'One chair, one hour, your time.',
      cta_label: de ? 'Termin buchen' : 'Book a visit', cta_href: '/services', image: '', image_alt: '' },
    { _key: 'ctab0001', type: 'cta_banner', v: 1,
      title: de ? 'Schreiben Sie uns' : 'Write to us', lead: de ? 'Wir antworten am selben Tag.' : 'We answer the same day.',
      name_label: de ? 'Name' : 'Name', contact_label: de ? 'Telefon oder E-Mail' : 'Phone or email',
      message_label: de ? 'Nachricht' : 'Message', required_note: de ? 'Mit * markierte Felder sind Pflicht.' : 'Fields marked * are required.',
      cta_label: de ? 'Senden' : 'Send', cta_href: '#contact', form: true },
    { _key: 'ques0001', type: 'questions', v: 1, title: de ? 'Fragen' : 'Questions',
      items: [{ question: de ? 'Kann ich absagen?' : 'Can I cancel?', answer: de ? 'Bis drei Stunden vorher.' : 'Up to three hours before.' }] },
  ],
});
write('jtk/content/index.json', home(false));
write('jtk/content/de.json', home(true));

const entry = (collection, slug, fields, locale = '') => write(
  `jtk/content/${locale ? `${locale}/` : ''}${collection === 'services' ? 'services' : collection}/${slug}.json`,
  { collection, path: `${locale ? `/${locale}` : ''}/${collection}/${slug}`, ...(locale ? { locale } : {}), blocks: [fields] },
);
entry('services', 'cut', { type: 'service', v: 1, title: 'Cut and finish', takes: 45, costs: 6000 });
entry('services', 'colour', { type: 'service', v: 1, title: 'Colour', takes: 90, costs: 12000 });
entry('masters', 'ada', { type: 'master', v: 1, title: 'Ada', does: [{ service: 'cut' }, { service: 'colour' }] });
entry('masters', 'noa', { type: 'master', v: 1, title: 'Noa', does: [{ service: 'cut' }] });
const post = (de) => ({
  type: 'post', v: 1,
  title: de ? 'Erster Blick' : 'A first look',
  date: '2026-10-01',
  excerpt: de ? 'Wie ein Termin bei uns abläuft.' : 'How a visit with us goes.',
  cover: '',
  body: de
    ? 'Wir beginnen mit einem Gespräch.\n\n## Was Sie mitbringen\n\nNichts. Lesen Sie mehr über [unsere Leistungen](/de/services).'
    : 'We start with a conversation.\n\n## What to bring\n\nNothing. Read more about [our services](/services).',
});
entry('blog', 'first-look', post(false));
entry('blog', 'first-look', post(true), 'de');

// German words that are not content: the site's copy file, pointed at the
// German document and registered (docs/languages.md, «What you write»).
const own = read('src/copy/en.ts');
write('src/copy/de.ts', own
  .replace("import page from '../../jtk/content/index.json';", "import page from '../../jtk/content/de.json';")
  .replace('lang: LOCALE,', "lang: 'de',")
  .replace("skipToContent: 'Skip to content'", "skipToContent: 'Zum Inhalt springen'"));
const index = read('src/copy/index.ts');
if (!index.includes("from './de'")) {
  write('src/copy/index.ts', index
    .replace("import { COPY as own } from './en';", "import { COPY as own } from './en';\nimport { COPY as de } from './de';")
    .replace("{ '': own }", "{ '': own, de }"));
}

const design = JSON.parse(read('jtk/design.json'));
const schemes = {
  // The kit's own tokens: a scaffold nobody has designed.
  light: { ...design, paper: '', ink: '', accent: '', field: '', colors: [], ground: '' },
  // A dark page with a light accent and the hero's field on: the tokens a
  // design pass sets, read the other way up.
  dark: { ...design, paper: '#16130f', ink: '#f3eee6', accent: '#e3b04b', field: 'aurora', ground: '#16130f', colors: ['#2b2620', '#5a4630', '#8a6a3c', '#e3b04b'] },
};

// ── build and read ───────────────────────────────────────────────────────────
const all = [];
for (const [scheme, palette] of Object.entries(schemes)) {
  write('jtk/design.json', palette);
  try {
    execFileSync('npm', ['run', 'build'], { cwd: site, stdio: 'pipe' });
  } catch (why) {
    console.error(String(why.stdout ?? ''), String(why.stderr ?? ''));
    console.error(`a11y: the ${scheme} build failed`);
    process.exit(1);
  }
  const results = await audit({ dist: join(site, 'dist'), schemes: ['light'], from: site, log: (line) => console.log(`[${scheme}] ${line}`) });
  for (const r of results) r.scheme = scheme;
  all.push(...results);
}
write('jtk/design.json', design);

const lines = report(all);
const seconds = ((Date.now() - started) / 1000).toFixed(1);
if (scratch && !args.includes('--keep')) rmSync(scratch, { recursive: true, force: true });
if (lines.length) {
  console.error(`\n${lines.join('\n')}\n`);
  console.error(`a11y: ${lines.filter((l) => !l.startsWith('    ')).length} finding(s) on ${all.length} page read(s), ${seconds}s`);
  process.exit(1);
}
console.log(`a11y: ${all.length} page read(s) in light and dark, nothing found against WCAG 2.1 AA, ${seconds}s`);
