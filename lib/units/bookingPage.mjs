/**
 * The booking page: `jtk create <slug> --kind booking-page` (docs/booking-page.md;
 * the owner, 24 November 2026). One page a specialist books from — a nail
 * artist, a barber, a lash studio, a masseur, a cosmetologist, a tattooist, a
 * coach, a trainer, a therapist — made in a few writes by an agent with no
 * terminal, from a free plan, out of the business's Instagram.
 *
 * It is the example site cut to what such a page needs, by the same units
 * `jtk create` lays a full site with, so it grows into one later without
 * starting over (`jtk add blog`, `add shop`, `add team`, `add questions`):
 *
 *   hero       the name, one line, «Book» — on liquid lacquer, the best photograph in an arch
 *   services   the price list on the page itself, a card each, bookable, the form under it at #book
 *   gallery    «Latest posts»: the business's Instagram posts, each a link to its post, the
 *              handle beside the heading; a picture with no post opens in a lightbox
 *   contact    where: the address and a map link, the hours, the telephone and email, Instagram
 *
 * and the site's skeleton as every site has it: the header and footer, the
 * shared contacts, the imprint and the privacy page. The diary is a booking
 * kit's (`salon` by default — appointments with somebody who does them), its
 * services the example's price list and one person who does them all: a
 * solo business is one resource (the platform's bookings module). The look is
 * `gloss`, and its colours are the vertical's palette (lib/units/palettes.mjs).
 *
 * Everything the business says is content — the page's blocks, the services
 * and the person as entries, the contacts and the hours shared — so an agent
 * fills it with `write_files` or the panel, and never opens a component.
 * Every word written here is a placeholder, the example's until replaced, in
 * the two languages the example is written in.
 */
import { getRandomValues } from 'node:crypto';
import { nameOfPage } from '@jtakeit/kit/upgrade';
import { overlaysOf, pageFile, siteOf } from './index.mjs';
import { exampleLang, wordsIn } from './units.mjs';
import { readFileSync } from 'node:fs';
import { keyOf, said, tableIn, uncommented, withElement } from './source.mjs';
import { BY_NAME } from './units.mjs';
import { PEOPLE } from './booking.mjs';
import { fileOf, lookOf } from './looks.mjs';
import { paletteFor, verticalOf } from './palettes.mjs';

/** The kind's name, as `--kind` says it and `create_site` names it. */
export const BOOKING_PAGE = 'booking-page';
/** The sections of the example it keeps, in the page's order. */
export const KEEPS = ['hero', 'services', 'gallery', 'contact'];
/** The look it is laid out in unless `--look` says another. */
export const LOOK = 'gloss';
/** The booking kit its diary is, unless `--kit` says another. */
export const KIT = 'salon';
/** The person who does every service: a solo business is one resource. */
export const PERSON = { slug: 'alex-muster', title: 'Alex Muster' };

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * The gallery's heading in the site's language — the words the platform writes
 * when it builds the page from Instagram (the owner, 24 November 2026), and
 * words an owner rightly keeps: never fingerprinted as the example's.
 */
export const LATEST_POSTS = {
  en: 'Latest posts',
  de: 'Neueste Beiträge',
  fr: 'Derniers posts',
  it: 'Ultimi post',
  es: 'Últimas publicaciones',
  pt: 'Últimas publicações',
  ru: 'Последние посты',
  pl: 'Najnowsze posty',
  uk: 'Останні пости',
};

/** «Latest posts» in a language tag's language — `de-CH` reads German's — and English's where there are none. */
export const latestPosts = (locale) => LATEST_POSTS[String(locale ?? '').toLowerCase().split('-')[0]] ?? LATEST_POSTS.en;

/** The example's handle and its posts: placeholders, and plainly so, until the platform or the agent writes the business's. */
export const EXAMPLE_HANDLE = 'your_instagram';
export const examplePost = (n) => `https://www.instagram.com/p/your_post_${n}/`;

/**
 * The handle, declared on the gallery block a booking page lays out — beside
 * its heading, not a thing tapped on its own. A picture's post (`href`) is
 * the picture's own, `[{ _key, src, alt, href }]`, and needs no field: the
 * gallery's pictures are the platform's shape.
 */
const INSTAGRAM_FIELD = "{ key: 'instagram', label: 'Instagram handle, without @', kind: 'text', max: 30, client_editable: true, no_tap_target: true, beside: 'title', localized: false },";
const POSTS_NOTE = '// Each picture may carry `href`, its Instagram post: a tap opens the post, not the lightbox.';

/** A new id: a UUID, version 7, as the platform mints one (and lib/units/index.mjs). */
function uuid7() {
  const bytes = getRandomValues(new Uint8Array(16));
  let moment = Date.now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = moment % 256;
    moment = Math.floor(moment / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((one) => one.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The page's words, in a language: what each block, the header, the footer
 * and the page's SEO say on a booking page, over the example's. Placeholders,
 * every one; none names a trade.
 */
export function bookingWords(x, locale = x.lang) {
  return {
    seo: {
      title: x.t(`${x.name} — book online`, `${x.name} — online buchen`),
      description: x.t(`${x.name}: what it costs, recent work, where to find us — and a time to book.`, `${x.name}: was es kostet, aktuelle Arbeiten, wo Sie uns finden — und ein Termin zum Buchen.`),
    },
    blocks: {
      hero0001: {
        eyebrow: x.t('By appointment · Zurich', 'Nach Vereinbarung · Zürich'),
        title: x.name,
        lead: x.t('One line about what you do and for whom — say it in your own words.', 'Eine Zeile darüber, was Sie tun und für wen — in Ihren eigenen Worten.'),
        cta_label: x.t('Book a time', 'Termin wählen'),
        more_label: x.t('Prices', 'Preise'),
      },
      serv0001: {
        eyebrow: x.t('Services and prices', 'Angebot und Preise'),
        title: x.t('Choose what you would like.', 'Wählen Sie, was Sie möchten.'),
        lead: x.t('Every service with how long it takes and what it costs. Choose one, then a time below.', 'Jede Leistung mit Dauer und Preis. Wählen Sie eine aus, darunter dann einen Termin.'),
      },
      // The heading only: the handle sits beside it (`instagram`, FIXED below).
      gall0001: {
        eyebrow: undefined,
        title: latestPosts(locale),
      },
      ctab0001: {
        title: x.t('Where to find us.', 'So finden Sie uns.'),
        lead: x.t('Say how to find you: the entrance, the floor, where to park.', 'Sagen Sie, wie man Sie findet: der Eingang, das Stockwerk, wo man parkt.'),
      },
    },
    nav: [
      { _key: 'nav-services', label: x.t('Prices', 'Preise'), link: '/#services' },
      { _key: 'nav-works', label: x.t('Works', 'Arbeiten'), link: '/#gallery' },
      { _key: 'nav-contact', label: x.t('Location', 'Anfahrt'), link: '/#contact' },
    ],
    cta: x.t('Book a time', 'Termin wählen'),
    tagline: x.t('By appointment, with care.', 'Nach Vereinbarung, mit Sorgfalt.'),
  };
}

/** What a block's values become on a booking page, beside its words: links, the limit, the form. */
const FIXED = {
  hero0001: { cta_href: '#book', more_href: '#services' },
  serv0001: { limit: 0, more_label: undefined },
  gall0001: { arrangement: 'ragged', instagram: EXAMPLE_HANDLE },
  ctab0001: { form: false, cta_href: '#contact' },
};

/** A value's keys set, an `undefined` one taken out. */
function assign(target, values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete target[key];
    else target[key] = value;
  }
  return target;
}

/** Every translation file of a document beside it: `index.de-CH.json` for `index.json`. */
function translationsOf(tree, file) {
  const dir = file.slice(0, file.lastIndexOf('/'));
  const stem = file.slice(dir.length + 1).replace(/\.json$/, '');
  return tree.under(dir).filter((one) => new RegExp(`^${dir}/${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[A-Za-z]{2}(-[A-Za-z]{2})?\\.json$`).test(one));
}

/**
 * Turn the example `jtk create` has just laid — the four sections and a
 * booking kit — into a booking page: the words above in every language the
 * example has, the price list shown on the home page and its own page gone,
 * the diary booking on `/` at `#book`, one person who does every service,
 * the navigation the page's three anchors, the vertical's palette.
 *
 * @param {ReturnType<import('./index.mjs').treeOf>} tree
 * @param {{ vertical?: string }} options
 * @returns {string[]} what it did, part by part
 */
export function layBookingPage(tree, { vertical = '', kind = KIT } = {}) {
  const did = [];
  const site = siteOf(tree);
  keepPriceList(tree, did);
  const x = wordsIn(site.lang, site.name);
  const others = overlaysOf(site).map((locale) => ({ locale, y: wordsIn(exampleLang(locale), site.name) }));
  const ours = bookingWords(x, site.locale);

  // ── the home page: its words, its links, in every language ──────────────
  const home = tree.json(pageFile('/'));
  if (home === undefined) throw new Error(`${pageFile('/')} is not there — the booking page is laid over the example`);
  home.seo = { ...(home.seo ?? {}), ...ours.seo };
  for (const block of home.blocks ?? []) {
    const words = ours.blocks[block?._key];
    if (words === undefined) continue;
    assign(block, { ...words, ...(FIXED[block._key] ?? {}) });
    // Each of the gallery's pictures a post of the example's handle, until the business's are written.
    if (block._key === 'gall0001' && Array.isArray(block.images)) {
      block.images = block.images.map((one, at) => (one !== null && typeof one === 'object' ? { ...one, href: examplePost(at + 1) } : one));
    }
  }
  tree.write(pageFile('/'), json(home));
  did.push(`${pageFile('/')}: the booking page's words — «Book» to #book, the whole price list, «Works», where to find you`);
  for (const { locale, y } of others) {
    const file = pageFile('/', locale);
    const translation = tree.json(file) ?? { of: home.id, locale, name: nameOfPage({}, '/', locale), blocks: [] };
    const theirs = bookingWords(y, locale);
    translation.seo = { ...(translation.seo ?? {}), ...theirs.seo };
    translation.blocks ??= [];
    for (const [key, words] of Object.entries(theirs.blocks)) {
      if (!home.blocks.some((one) => one?._key === key)) continue;
      let over = translation.blocks.find((one) => one?._key === key);
      if (over === undefined) translation.blocks.push((over = { _key: key }));
      // Words only — every one, the name too, so nothing starts untranslated; the links, the limit and the handle are the original's.
      assign(over, words);
      for (const name of Object.keys(FIXED[key] ?? {})) delete over[name];
    }
    tree.write(file, json(translation));
    did.push(`${file}: its words in ${locale}`);
  }

  // ── the price list on the home page, its own page gone ──────────────────
  const blocksTs = 'src/content/blocks.ts';
  const source = tree.read(blocksTs) ?? '';
  const collections = tableIn(source, 'COLLECTIONS');
  if ('refused' in collections) throw new Error(collections.refused);
  const listed = collections.elements.find((one) => said(one, 'name') === 'services');
  const shown = /(["']?shown_on["']?\s*:\s*\[\s*)(["'])\/services#services-\{slug\}\2/;
  if (listed === undefined || !shown.test(listed.text)) {
    if (!/\/#services-\{slug\}/.test(listed?.text ?? '')) throw new Error(`${blocksTs}: the services collection is not shown at /services#services-{slug} — the booking page shows them on the home page; say so by hand`);
  } else {
    const text = listed.text.replace(shown, '$1$2/#services-{slug}$2');
    // The line above it says where they were; it says where they are.
    const lead = source.slice(listed.from, listed.start).replace(/each a row of \/services, at its\n(\s*)\/\/ anchor/, 'each a card on the booking\n$1// page, at its anchor');
    tree.write(blocksTs, `${source.slice(0, listed.from)}${lead}${text}${source.slice(listed.end)}`);
    did.push(`${blocksTs}: services are shown on the home page, at #services-<slug>`);
  }
  // ── the gallery: the business's posts, the handle beside the heading ───
  {
    const source = tree.read(blocksTs) ?? '';
    const table = tableIn(source, 'BLOCKS');
    const type = 'refused' in table ? undefined : table.elements.find((one) => said(one, 'type') === 'gallery');
    const images = type === undefined ? -1 : source.slice(type.start, type.end).search(/\{\s*key:\s*['"]images['"]/);
    if (type !== undefined && images !== -1 && !/key:\s*['"]instagram['"]/.test(type.text)) {
      const at = type.start + images;
      const lineStart = source.lastIndexOf('\n', at) + 1;
      const lineEnd = source.indexOf('\n', at);
      const pad = /^[ \t]*/.exec(source.slice(lineStart))[0];
      const text = `${source.slice(0, lineStart)}${pad}${POSTS_NOTE}\n${source.slice(lineStart, lineEnd + 1)}${pad}${INSTAGRAM_FIELD}\n${source.slice(lineEnd + 1)}`;
      tree.write(blocksTs, text);
      did.push(`${blocksTs}: the gallery says the business's Instagram handle (instagram), each picture its post (href)`);
    }
  }

  const services = pageFile('/services');
  for (const file of [services, ...translationsOf(tree, services)]) {
    if (!tree.exists(file)) continue;
    tree.remove(file);
    did.push(`${file}: deleted — the price list is on the page`);
  }

  // ── the diary books on the page, at #book ───────────────────────────────
  const settingsFile = 'jtk/modules/bookings.json';
  const settings = tree.json(settingsFile);
  if (settings?.settings) {
    settings.settings.page = '/';
    tree.write(settingsFile, json(settings));
    did.push(`${settingsFile}: the diary books on / — the panel's «Try booking» opens the page`);
  }

  // One person who does every service: a solo business is one resource.
  const modules = tableIn(tree.read(blocksTs) ?? '', 'MODULES');
  const element = 'refused' in modules ? undefined : modules.elements.find((one) => keyOf(one) === 'bookings');
  const resources = element ? /["']?resources["']?\s*:\s*["']([^"']+)["']/.exec(uncommented(element.text))?.[1] : undefined;
  // Only where the kit's resources are people (a salon's, a clinic's): a class's timetable is the brief's, never made up.
  if (resources && PEOPLE.has(kind) && tree.under(`jtk/entries/${resources}`).length === 0) {
    const file = `jtk/entries/${resources}/${PERSON.slug}.json`;
    const id = uuid7();
    tree.write(file, json({ id, collection: resources, slug: PERSON.slug, rank: 'a0', visible: true, fields: { title: PERSON.title } }));
    did.push(`${file}: the one who does every service — the business's own name here; another person is another entry`);
    for (const { locale } of others) tree.write(`jtk/entries/${resources}/${PERSON.slug}.${locale}.json`, json({ of: id, locale, fields: { title: PERSON.title } }));
  }

  // ── the shared text: the navigation, the button, the footer ─────────────
  const shared = tree.json('jtk/shared.json');
  const header = shared?.blocks?.find((one) => one?.type === 'header');
  const footer = shared?.blocks?.find((one) => one?.type === 'footer');
  if (header !== undefined) {
    header.nav = ours.nav;
    header.cta_label = ours.cta;
    header.cta_link = '/#book';
  }
  if (footer !== undefined) footer.tagline = ours.tagline;
  if (shared !== undefined) {
    tree.write('jtk/shared.json', json(shared));
    did.push('jtk/shared.json: the navigation is the page\'s three anchors, the button books');
  }
  for (const { locale, y } of others) {
    const file = `jtk/shared.${locale}.json`;
    const translation = tree.json(file) ?? { locale, blocks: [] };
    const theirs = bookingWords(y);
    translation.blocks ??= [];
    const over = (key) => {
      let one = translation.blocks.find((b) => b?._key === key);
      if (one === undefined) translation.blocks.push((one = { _key: key }));
      return one;
    };
    if (header !== undefined) {
      const words = over(header._key);
      words.nav = theirs.nav.map(({ _key, label }) => ({ _key, label }));
      words.cta_label = theirs.cta;
    }
    if (footer !== undefined) over(footer._key).tagline = theirs.tagline;
    tree.write(file, json(translation));
  }

  // ── the colours: the vertical's palette ──────────────────────────────────
  const design = tree.json('jtk/design.json') ?? {};
  design.palette = paletteFor(vertical);
  // The older three follow the palette, for whatever still reads them.
  design.paper = design.palette.bg;
  design.ink = design.palette.ink;
  design.accent = design.palette.accent;
  tree.write('jtk/design.json', json(design));
  did.push(`jtk/design.json: the ${verticalOf(vertical) || 'nails'} palette — ${Object.entries(design.palette).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return did;
}

/**
 * The price list on the page, whatever the kit calls a service. A kit whose
 * price list is another type than the example's `service` — a class, a
 * course — takes the example's services section away as it is laid
 * (lib/units/booking.mjs); a booking page puts the section back over the
 * kit's collection: the `services_list` type, its line in the sections map,
 * its component in the site's look, and its block under the hero. The section
 * reads the diary's price list by its collection, `services` in every kit.
 */
function keepPriceList(tree, did) {
  const home = tree.json(pageFile('/'));
  if (home === undefined || (home.blocks ?? []).some((one) => one?.type === 'services_list')) return;
  const blocksTs = 'src/content/blocks.ts';
  const unit = BY_NAME.services;
  let source = tree.read(blocksTs) ?? '';
  const table = tableIn(source, 'BLOCKS');
  if ('refused' in table) throw new Error(table.refused);
  if (!table.elements.some((one) => said(one, 'type') === 'services_list')) {
    source = withElement(source, table, unit.types.find((one) => one.type === 'services_list').source, (one) => said(one, 'type') === 'hero');
    tree.write(blocksTs, source);
    did.push(`${blocksTs}: BLOCKS gains services_list — the kit's price list on the page`);
  }
  const mapTs = 'src/components/sections/index.ts';
  let map = tree.read(mapTs) ?? '';
  const line = "import ServicesList from './ServicesList.astro';";
  if (!map.split('\n').includes(line)) map = map.replace("import Hero from './Hero.astro';", `import Hero from './Hero.astro';\n${line}`);
  const sections = tableIn(map, 'SECTIONS', mapTs);
  if ('refused' in sections) throw new Error(sections.refused);
  if (!sections.elements.some((one) => keyOf(one) === 'services_list')) map = withElement(map, sections, 'services_list: ServicesList', (one) => keyOf(one) === 'hero');
  tree.write(mapTs, map);
  const component = 'src/components/sections/ServicesList.astro';
  if (!tree.exists(component)) tree.write(component, readFileSync(fileOf(component, lookOf(tree)), 'utf8'));
  const x = wordsIn(siteOf(tree).lang, siteOf(tree).name);
  const block = { ...unit.home[0](x), _key: 'serv0001' };
  const at = home.blocks.findIndex((one) => one?.type === 'hero');
  home.blocks.splice(at + 1, 0, block);
  tree.write(pageFile('/'), json(home));
  did.push(`${pageFile('/')}: the price list under the hero, over the kit's services`);

  // The example's services as the kit's entries, in the fields its type has —
  // placeholders like every other, so the page and its form are whole from the start.
  if (tree.under('jtk/entries/services').length > 0) return;
  const collections = tableIn(tree.read(blocksTs) ?? '', 'COLLECTIONS');
  const type = 'refused' in collections ? undefined : said(collections.elements.find((one) => said(one, 'name') === 'services') ?? { text: '' }, 'type');
  const declared = tableIn(tree.read(blocksTs) ?? '', 'BLOCKS');
  const element = 'refused' in declared ? undefined : declared.elements.find((one) => said(one, 'type') === type);
  let fields = [];
  try {
    fields = new Function(`return (${uncommented(element?.text ?? '{}')});`)().fields ?? [];
  } catch {
    fields = [];
  }
  const keys = new Set(fields.map((one) => one.key));
  if (!keys.has('title') || !keys.has('takes')) return;
  const site = siteOf(tree);
  const others = overlaysOf(site).map((locale) => ({ locale, rows: unit.entries(wordsIn(exampleLang(locale), site.name)) }));
  unit.entries(x).forEach((entry, i) => {
    const id = uuid7();
    const own = Object.fromEntries(Object.entries(entry.fields).filter(([key]) => keys.has(key)));
    tree.write(`jtk/entries/services/${entry.slug}.json`, json({ id, collection: 'services', slug: entry.slug, rank: entry.rank, visible: true, fields: own }));
    for (const { locale, rows } of others) tree.write(`jtk/entries/services/${entry.slug}.${locale}.json`, json({ of: id, locale, fields: { title: rows[i].fields.title } }));
  });
  did.push(`jtk/entries/services/: the example's services, as the kit's ${type}s`);
}
