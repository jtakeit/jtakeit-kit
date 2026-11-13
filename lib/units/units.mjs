/**
 * The example site's units: what each section and module owns, and the
 * example's words for it, in the two languages the example is written in
 * (jtakeit-core wiki/110 §2, §3.2; the owner, 13 November 2026: the site's
 * own language and English — German for a German-speaking site, English for
 * any other).
 *
 * A unit is data. `lib/units/index.mjs` applies one — `jtk add` — and takes
 * one away — `jtk remove` — part by part:
 *
 *   types        block types, as the TypeScript `BLOCKS` element they are
 *   collections  `COLLECTIONS` elements
 *   sections     the `SECTIONS` map's lines: block type → component
 *   files        what it lays from example/files/ (a section's component)
 *   home         its blocks on the home page, with the example's words
 *   pages        pages of its own (/services), whole
 *   entries      a collection's example entries
 *   nav          its item in the header's navigation
 *   photos       the example's photographs it names (lib/units/photos.mjs)
 *
 * Every `_key` is fixed, so a unit removed and added again is the same tree,
 * ids aside. No sentence states a fact about the business: no years, no
 * counts, no awards; the people are «Muster», the address Musterstrasse 1, the
 * testimonials signed «an example».
 */
import { picture } from './photos.mjs';

/** The words of the example in a language: `x.t(en, de)`, and the business's name and photographs. */
export function wordsIn(lang, name) {
  return {
    lang,
    name,
    t: (en, de) => (lang === 'de' ? de : en),
    pic: (photo, more = {}) => picture(photo, lang, more),
  };
}

/** The example's language for a site's: German for German, English for anything else. */
export function exampleLang(locale) {
  return String(locale).toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Whether a language has the example's own words, or would be the site's original standing in. */
export const EXAMPLE_LANGS = ['en', 'de'];

// ── the sections ────────────────────────────────────────────────────────────

const hero = {
  name: 'hero',
  kind: 'section',
  about: 'the first screen: a heading, a photograph, a lead and two buttons',
  types: [
    {
      type: 'hero',
      source: `// The first screen: what this is, for whom, and one action
// (src/components/sections/Hero.astro).
{
  type: 'hero',
  v: 1,
  label: 'Opening screen',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', required: true, max: 80, client_editable: true, seo_sensitive: true },
    { key: 'lead', label: 'Subheading', kind: 'textarea', max: 240, client_editable: true, seo_sensitive: true },
    { key: 'cta_label', label: 'Button text', kind: 'text', max: 40, client_editable: true },
    { key: 'cta_href', label: 'Button link', kind: 'url', no_tap_target: true, beside: 'cta_label' },
    { key: 'more_label', label: 'Second button text', kind: 'text', max: 40, client_editable: true },
    { key: 'more_href', label: 'Second button link', kind: 'url', no_tap_target: true, beside: 'more_label' },
    // One picture: \`{ src, alt }\`, its description its own \`alt\`.
    { key: 'image', label: 'Photograph', kind: 'media', client_editable: true },
  ],
}`,
    },
  ],
  sections: [{ type: 'hero', component: 'Hero' }],
  files: ['src/components/sections/Hero.astro'],
  photos: ['hero'],
  home: [
    (x) => ({
      _key: 'hero0001',
      type: 'hero',
      v: 1,
      eyebrow: x.t(`${x.name} · Zurich`, `${x.name} · Zürich`),
      title: x.t('Good work, done with care.', 'Gute Arbeit, mit Sorgfalt gemacht.'),
      lead: x.t(
        'Tell people in one or two sentences what you do, for whom, and why it is worth the visit.',
        'Sagen Sie in ein, zwei Sätzen, was Sie tun, für wen, und warum sich der Besuch lohnt.',
      ),
      cta_label: x.t('Write to us', 'Schreiben Sie uns'),
      cta_href: '#contact',
      more_label: x.t('Services and prices', 'Angebot und Preise'),
      more_href: '/services',
      image: x.pic('hero'),
    }),
  ],
};

const values = {
  name: 'values',
  kind: 'section',
  about: 'what the business holds to: a statement and three numbered lines',
  types: [
    {
      type: 'values',
      source: `// What the business holds to: a statement and a few numbered lines
// (src/components/sections/Values.astro).
{
  type: 'values',
  v: 1,
  label: 'Values',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', max: 120, client_editable: true },
    {
      key: 'items',
      label: 'Values',
      kind: 'list',
      max: 6,
      of: [
        { key: 'title', label: 'Title', kind: 'text', required: true, max: 60, client_editable: true },
        { key: 'text', label: 'A line about it', kind: 'textarea', max: 240, client_editable: true },
      ],
    },
  ],
}`,
    },
  ],
  sections: [{ type: 'values', component: 'Values' }],
  files: ['src/components/sections/Values.astro'],
  home: [
    (x) => ({
      _key: 'valu0001',
      type: 'values',
      v: 1,
      eyebrow: x.t('What matters to us', 'Was uns wichtig ist'),
      title: x.t('Three promises, kept every day.', 'Drei Versprechen, jeden Tag gehalten.'),
      items: [
        {
          _key: 'valu0101',
          title: x.t('Time for you', 'Zeit für Sie'),
          text: x.t('We listen first and work second. Nobody is rushed, and nothing is decided for you.', 'Erst zuhören, dann arbeiten. Niemand wird gedrängt, und nichts wird über Ihren Kopf hinweg entschieden.'),
        },
        {
          _key: 'valu0102',
          title: x.t('Honest prices', 'Ehrliche Preise'),
          text: x.t('What it costs is written down before we start, and that is what you pay.', 'Was es kostet, steht fest, bevor wir anfangen — und das bezahlen Sie.'),
        },
        {
          _key: 'valu0103',
          title: x.t('Work we stand behind', 'Arbeit, zu der wir stehen'),
          text: x.t('If something is not right, tell us. We put it right, without a discussion.', 'Wenn etwas nicht stimmt, sagen Sie es uns. Wir machen es richtig, ohne Diskussion.'),
        },
      ],
    }),
  ],
};

const SERVICES = [
  ['first-conversation', 'First conversation', 'Erstgespräch', 'We sit down together, look at what you need and say honestly what we would do.', 'Wir setzen uns zusammen, schauen, was Sie brauchen, und sagen ehrlich, was wir tun würden.', 30, 5000, 'service-conversation'],
  ['the-work', 'The work itself', 'Die Arbeit selbst', 'The main thing we do, done properly, with time to get the details right.', 'Das, was wir hauptsächlich tun — richtig gemacht, mit Zeit für die Details.', 90, 18000, 'service-work'],
  ['finishing', 'Finishing touches', 'Der letzte Schliff', 'Small corrections and the last details, for work that is almost there.', 'Kleine Korrekturen und die letzten Details, für Arbeit, die fast fertig ist.', 45, 8500, 'service-finish'],
  ['care-at-home', 'Care at home', 'Pflege für zuhause', 'We show you how to keep it looking good until your next visit.', 'Wir zeigen Ihnen, wie es bis zum nächsten Besuch schön bleibt.', 20, 3500, 'service-objects'],
  ['a-morning-together', 'A morning together', 'Ein Morgen zusammen', 'For two to six people: we show how we work, and everyone makes something of their own.', 'Für zwei bis sechs Personen: Wir zeigen, wie wir arbeiten, und alle machen etwas Eigenes.', 180, 24000, 'service-counter'],
];

const services = {
  name: 'services',
  kind: 'section',
  about: 'the price list: a `services` collection, its ledger on the home page and its own page at /services',
  types: [
    {
      type: 'service',
      source: `// One service and its price — an entry of \`services\`. The salon kit's names,
// \`takes\` and \`costs\`, so \`jtk add booking\` keeps them as the diary's price list.
{
  type: 'service',
  v: 1,
  label: 'Service',
  fields: [
    { key: 'title', label: 'Name', kind: 'text', required: true, max: 80, client_editable: true },
    { key: 'about', label: 'A line about it', kind: 'textarea', max: 280, client_editable: true },
    { key: 'photo', label: 'Photograph', kind: 'media', ratio: '4:3', client_editable: true },
    { key: 'takes', label: 'Takes', kind: 'duration', client_editable: true },
    { key: 'costs', label: 'Price', kind: 'money', client_editable: true },
  ],
}`,
    },
    {
      type: 'services_list',
      source: `// The price list as a section: the \`services\` entries in the owner's order
// (src/components/sections/ServicesList.astro). \`limit\` is the studio's: how
// many the home page shows before «more» leads to /services.
{
  type: 'services_list',
  v: 1,
  label: 'Services and prices',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', max: 120, client_editable: true },
    { key: 'lead', label: 'Subheading', kind: 'textarea', max: 280, client_editable: true },
    { key: 'more_label', label: 'Link to the whole list', kind: 'text', max: 40, client_editable: true },
    { key: 'limit', label: 'How many to show', kind: 'number', min: 0, max: 50 },
  ],
}`,
    },
    {
      type: 'intro',
      source: `// The head of a page of its own: a line, a heading, a lead
// (src/components/sections/Intro.astro).
{
  type: 'intro',
  v: 1,
  label: 'Page heading',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', required: true, max: 80, client_editable: true, seo_sensitive: true },
    { key: 'lead', label: 'Subheading', kind: 'textarea', max: 280, client_editable: true, seo_sensitive: true },
  ],
}`,
    },
  ],
  collections: [
    {
      name: 'services',
      source: `// The price list: no page per service — each a row of /services, at its
// anchor — in the owner's order.
{
  name: 'services',
  label: { en: 'Services', de: 'Angebot' },
  one: { en: 'service', de: 'Leistung' },
  icon: 'lucide:list',
  type: 'service',
  route: 'none',
  shown_on: ['/services#services-{slug}'],
  order: 'manual',
}`,
    },
  ],
  sections: [
    { type: 'services_list', component: 'ServicesList' },
    { type: 'intro', component: 'Intro' },
  ],
  files: ['src/components/sections/ServicesList.astro', 'src/components/sections/Intro.astro'],
  photos: SERVICES.map((one) => one[7]),
  home: [
    (x) => ({
      _key: 'serv0001',
      type: 'services_list',
      v: 1,
      eyebrow: x.t('Services and prices', 'Angebot und Preise'),
      title: x.t('What we do, and what it costs.', 'Was wir tun, und was es kostet.'),
      lead: x.t('Every visit starts with a conversation. These are the things people ask us for most.', 'Jeder Besuch beginnt mit einem Gespräch. Das sind die Dinge, nach denen man uns am häufigsten fragt.'),
      more_label: x.t('All services and prices', 'Alle Leistungen und Preise'),
      limit: 3,
    }),
  ],
  pages: {
    '/services': (x) => ({
      path: '/services',
      name: x.t('Services', 'Angebot'),
      seo: {
        title: x.t('Services and prices', 'Angebot und Preise'),
        description: x.t(`What ${x.name} does, how long it takes and what it costs.`, `Was ${x.name} anbietet, wie lange es dauert und was es kostet.`),
      },
      blocks: [
        {
          _key: 'intr0001',
          type: 'intro',
          v: 1,
          eyebrow: x.name,
          title: x.t('Services and prices', 'Angebot und Preise'),
          lead: x.t('Prices include materials unless it says otherwise. Ask us about anything that is not on the list.', 'Die Preise verstehen sich inklusive Material, wenn nicht anders angegeben. Fragen Sie uns nach allem, was nicht auf der Liste steht.'),
        },
        { _key: 'serv0002', type: 'services_list', v: 1 },
      ],
    }),
  },
  entries: (x) =>
    SERVICES.map(([slug, en, de, aboutEn, aboutDe, takes, minor, photo], at) => ({
      collection: 'services',
      slug,
      rank: `a${at}`,
      fields: { title: x.t(en, de), about: x.t(aboutEn, aboutDe), photo: x.pic(photo), takes, costs: { minor } },
    })),
  nav: (x) => ({ _key: 'nav-services', label: x.t('Services', 'Angebot'), link: '/services' }),
};

// In the order a four-column `ragged` deals them, so the columns end near each other.
const GALLERY = ['gallery-chair', 'gallery-linen', 'gallery-light', 'gallery-ceramics', 'gallery-sideboard', 'gallery-grain', 'gallery-tools', 'gallery-doorway'];

const gallery = {
  name: 'gallery',
  kind: 'section',
  about: 'eight photographs in one of the twelve arrangements',
  types: [
    {
      type: 'gallery',
      source: `// Pictures, in one of the twelve arrangements of the template's Gallery
// (docs/gallery.md; src/components/sections/GallerySection.astro). The
// arrangement is the studio's, chosen for the amount of work.
{
  type: 'gallery',
  v: 1,
  label: 'Gallery',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', max: 120, client_editable: true },
    { key: 'images', label: 'Pictures', kind: 'media', multiple: true, min: 1, max: 24, client_editable: true },
    {
      key: 'arrangement',
      label: 'Arrangement',
      kind: 'select',
      options: [
        { value: 'ragged', label: 'Columns' },
        { value: 'strip', label: 'A row to drag' },
        { value: 'spread', label: 'One at a time, full width' },
        { value: 'stage', label: 'A stage with thumbnails' },
        { value: 'deck', label: 'A pile of prints' },
        { value: 'coverflow', label: 'A row turned in depth' },
      ],
    },
  ],
}`,
    },
  ],
  sections: [{ type: 'gallery', component: 'GallerySection' }],
  files: ['src/components/sections/GallerySection.astro'],
  photos: GALLERY,
  home: [
    (x) => ({
      _key: 'gall0001',
      type: 'gallery',
      v: 1,
      eyebrow: x.t('A look inside', 'Ein Blick hinein'),
      title: x.t('The room, the tools, the details.', 'Der Raum, das Werkzeug, die Details.'),
      images: GALLERY.map((photo, at) => x.pic(photo, { _key: `gall01${String(at + 1).padStart(2, '0')}` })),
      arrangement: 'ragged',
    }),
  ],
};

const PEOPLE = [
  ['alex-muster', 'Alex Muster', 'Founder', 'Gründung und Leitung', 'Started the business to do one thing well, and still does most of it.', 'Hat das Geschäft gegründet, um eine Sache gut zu machen — und macht sie noch immer selbst.', 'team-window'],
  ['maria-muster', 'Maria Muster', 'Craft and advice', 'Handwerk und Beratung', 'Takes the time to understand what you have in mind before she starts.', 'Nimmt sich Zeit zu verstehen, was Sie sich vorstellen, bevor sie anfängt.', 'team-apron'],
  ['sam-muster', 'Sam Muster', 'Appointments and the front desk', 'Termine und Empfang', 'Answers the phone, keeps the calendar and makes sure nobody waits.', 'Nimmt das Telefon ab, führt den Kalender und sorgt dafür, dass niemand wartet.', 'team-silhouette'],
];

const team = {
  name: 'team',
  kind: 'section',
  about: 'the people: a `team` collection drawn as portraits on the home page',
  types: [
    {
      type: 'person',
      source: `// One person — an entry of \`team\`: the name is the same in every language.
{
  type: 'person',
  v: 1,
  label: 'Person',
  fields: [
    { key: 'title', label: 'Name', kind: 'text', required: true, max: 80, client_editable: true, localized: false },
    { key: 'role', label: 'What they do', kind: 'text', max: 80, client_editable: true },
    { key: 'portrait', label: 'Portrait', kind: 'media', ratio: '4:5', client_editable: true },
    { key: 'bio', label: 'A line about them', kind: 'textarea', max: 400, client_editable: true },
  ],
}`,
    },
    {
      type: 'team_list',
      source: `// The people as a section: the \`team\` entries as portraits
// (src/components/sections/TeamList.astro).
{
  type: 'team_list',
  v: 1,
  label: 'Team',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', max: 120, client_editable: true },
    { key: 'lead', label: 'Subheading', kind: 'textarea', max: 280, client_editable: true },
  ],
}`,
    },
  ],
  collections: [
    {
      name: 'team',
      source: `// The people: no page each — portraits on the home page, at their anchors.
{
  name: 'team',
  label: { en: 'Team', de: 'Team' },
  one: { en: 'person', de: 'Person' },
  icon: 'lucide:users',
  type: 'person',
  route: 'none',
  shown_on: ['/#team-{slug}'],
  order: 'manual',
}`,
    },
  ],
  sections: [{ type: 'team_list', component: 'TeamList' }],
  files: ['src/components/sections/TeamList.astro'],
  photos: PEOPLE.map((one) => one[6]),
  home: [
    (x) => ({
      _key: 'team0001',
      type: 'team_list',
      v: 1,
      eyebrow: x.t('Who you will meet', 'Wer Sie empfängt'),
      title: x.t('A small team, one standard.', 'Ein kleines Team, ein Anspruch.'),
      lead: x.t('Three people, each with their own craft, and one way of working.', 'Drei Menschen, jede und jeder mit eigenem Handwerk, und eine Art zu arbeiten.'),
    }),
  ],
  entries: (x) =>
    PEOPLE.map(([slug, name, roleEn, roleDe, bioEn, bioDe, photo], at) => ({
      collection: 'team',
      slug,
      rank: `a${at}`,
      fields: { title: name, role: x.t(roleEn, roleDe), portrait: x.pic(photo), bio: x.t(bioEn, bioDe) },
    })),
  nav: (x) => ({ _key: 'nav-team', label: x.t('Team', 'Team'), link: '/#team' }),
};

const testimonials = {
  name: 'testimonials',
  kind: 'section',
  about: 'three quotations, signed «an example» until real ones replace them',
  types: [
    {
      type: 'testimonials',
      source: `// What people said: quotations, a name and a line — no stars, no rating
// (src/components/sections/Testimonials.astro). A page's own rows: real ones,
// with their source.
{
  type: 'testimonials',
  v: 1,
  label: 'Testimonials',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', max: 120, client_editable: true },
    {
      key: 'items',
      label: 'Quotations',
      kind: 'list',
      max: 6,
      of: [
        { key: 'quote', label: 'What they said', kind: 'textarea', required: true, max: 400, client_editable: true },
        { key: 'name', label: 'Who', kind: 'text', required: true, max: 60, client_editable: true },
        { key: 'detail', label: 'A line under the name', kind: 'text', max: 80, client_editable: true },
      ],
    },
  ],
}`,
    },
  ],
  sections: [{ type: 'testimonials', component: 'Testimonials' }],
  files: ['src/components/sections/Testimonials.astro'],
  home: [
    (x) => ({
      _key: 'test0001',
      type: 'testimonials',
      v: 1,
      eyebrow: x.t('In their words', 'In ihren Worten'),
      title: x.t('What people tell us.', 'Was man uns sagt.'),
      items: [
        { _key: 'test0101', quote: x.t('They listened, explained every step and finished exactly when they said they would.', 'Man hat mir zugehört, jeden Schritt erklärt und war genau dann fertig, wie versprochen.'), name: 'Anna', detail: x.t('an example', 'ein Beispiel') },
        { _key: 'test0102', quote: x.t('Calm, careful and honest about the price. I have recommended them to everyone I know.', 'Ruhig, sorgfältig und ehrlich beim Preis. Ich habe sie allen empfohlen, die ich kenne.'), name: 'Luca', detail: x.t('an example', 'ein Beispiel') },
        { _key: 'test0103', quote: x.t('The kind of place you go back to, because nothing has to be explained twice.', 'Ein Ort, an den man zurückkommt, weil man nichts zweimal erklären muss.'), name: 'Mira', detail: x.t('an example', 'ein Beispiel') },
      ],
    }),
  ],
};

const questions = {
  name: 'questions',
  kind: 'section',
  about: 'five questions and their answers, the heading held beside them',
  types: [
    {
      type: 'questions',
      source: `/*
 * The questions, and the reason they are one of the three.
 *
 * Each answer has to stand up lifted out of the page, because that is
 * exactly what happens to it: an assistant quotes one paragraph with no
 * page around it (docs/pages.md of @jtakeit/astro;
 * src/components/sections/Questions.astro).
 */
{
  type: 'questions',
  v: 1,
  label: 'Questions and answers',
  hint: 'Each answer has to read on its own, away from the page.',
  fields: [
    { key: 'title', label: 'Heading', kind: 'text', max: 80, client_editable: true },
    {
      key: 'items',
      label: 'Questions',
      kind: 'list',
      max: 12,
      of: [
        { key: 'question', label: 'Question', kind: 'text', required: true, max: 140, client_editable: true, seo_sensitive: true },
        { key: 'answer', label: 'Answer', kind: 'textarea', required: true, max: 600, client_editable: true, seo_sensitive: true },
      ],
    },
  ],
}`,
    },
  ],
  sections: [{ type: 'questions', component: 'Questions' }],
  files: ['src/components/sections/Questions.astro'],
  home: [
    (x) => ({
      _key: 'ques0001',
      type: 'questions',
      v: 1,
      title: x.t('Questions, answered.', 'Fragen und Antworten.'),
      items: [
        { _key: 'ques0101', question: x.t('Do I need an appointment?', 'Brauche ich einen Termin?'), answer: x.t('Yes, so that there is time for you when you arrive. Write to us or call, and we will find a time that suits you.', 'Ja, damit bei Ihrer Ankunft Zeit für Sie da ist. Schreiben Sie uns oder rufen Sie an, wir finden einen passenden Termin.') },
        { _key: 'ques0102', question: x.t('How do I pay?', 'Wie kann ich bezahlen?'), answer: x.t('By card or in cash, at the end of the visit.', 'Mit Karte oder bar, am Ende des Besuchs.') },
        { _key: 'ques0103', question: x.t('What if I have to cancel?', 'Was, wenn ich absagen muss?'), answer: x.t('Let us know a day before and it costs nothing. Later than that, we may charge half the price.', 'Sagen Sie bis einen Tag vorher ab, dann kostet es nichts. Danach verrechnen wir unter Umständen die Hälfte.') },
        { _key: 'ques0104', question: x.t('Can I bring someone along?', 'Darf ich jemanden mitbringen?'), answer: x.t('Of course. Tell us when you book, so that there is a chair for them too.', 'Natürlich. Sagen Sie es bei der Anmeldung, damit auch für die Begleitung ein Platz bereit ist.') },
        { _key: 'ques0105', question: x.t('Where can I park?', 'Wo kann ich parken?'), answer: x.t('There is a public car park two minutes away, and the tram stops almost at the door.', 'Zwei Minuten entfernt gibt es ein öffentliches Parkhaus, und das Tram hält fast vor der Tür.') },
      ],
    }),
  ],
  nav: (x) => ({ _key: 'nav-questions', label: x.t('Questions', 'Fragen'), link: '/#questions' }),
};

const contact = {
  name: 'contact',
  kind: 'section',
  about: 'the form, with the address, the hours and the map link beside it (the form\'s own block, `cta_banner`, is the site\'s and stays)',
  types: [],
  sections: [{ type: 'cta_banner', component: 'Contact' }],
  files: ['src/components/sections/Contact.astro'],
  home: [
    (x) => ({
      _key: 'ctab0001',
      type: 'cta_banner',
      v: 1,
      title: x.t('Write to us.', 'Schreiben Sie uns.'),
      lead: x.t('Tell us what you have in mind. We answer within one working day.', 'Sagen Sie uns, was Sie vorhaben. Wir antworten innerhalb eines Arbeitstages.'),
      cta_href: '#contact',
      form: true,
    }),
  ],
  nav: (x) => ({ _key: 'nav-contact', label: x.t('Contact', 'Kontakt'), link: '/#contact' }),
};

/** The sections, in the home page's order: a unit added again goes back to its place in it. */
export const SECTIONS = [hero, values, services, gallery, team, testimonials, questions, contact];

// ── the site: the skeleton, never removed ───────────────────────────────────

/**
 * What every example site has and `jtk remove` refuses to take: the header,
 * the footer, the shared contacts and hours, the legal pages, the form's own
 * block and the look. Laid once, by `jtk create`.
 */
export const SITE = {
  name: 'site',
  kind: 'skeleton',
  files: [
    'src/content/blocks.ts',
    'src/components/sections/index.ts',
    'src/components/site/Look.astro',
    'src/components/site/Header.astro',
    'src/components/site/Footer.astro',
    'src/components/site/Hours.astro',
    'src/components/site/Button.astro',
    'src/components/site/words.ts',
    'src/components/site/Page.astro',
    'src/styles/tokens.css',
    'src/styles/look.css',
    'src/pages/[...lang]/imprint.astro',
    'jtk/design.json',
  ],
  index: (x) => ({
    path: '/',
    seo: {
      title: x.t(`${x.name} — good work, done with care`, `${x.name} — gute Arbeit, mit Sorgfalt gemacht`),
      description: x.t(`${x.name} in Zurich: services and prices, the team, opening hours and how to reach us.`, `${x.name} in Zürich: Angebot und Preise, das Team, Öffnungszeiten und Kontakt.`),
    },
  }),
  shared: (x) => [
    {
      _key: 'contacts',
      type: 'contacts',
      v: 1,
      name: x.name,
      city: x.t('Zurich', 'Zürich'),
      street: 'Musterstrasse 1',
      postal_code: '8000',
      country: 'CH',
      phone: '+41 44 000 00 00',
      email: 'hello@example.com',
      maps: 'https://www.openstreetmap.org/search?query=8000%20Z%C3%BCrich',
      social: [{ _key: 'social-1', url: 'https://www.instagram.com/' }],
    },
    {
      _key: 'header',
      type: 'header',
      v: 1,
      nav: [],
      cta_label: x.t('Get in touch', 'Kontakt aufnehmen'),
      cta_link: '/#contact',
    },
    {
      _key: 'hours',
      type: 'hours',
      v: 1,
      rows: [
        ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => ({ _key: `hours-${day.slice(0, 3)}`, day, opens: 540, closes: 1080 })),
        { _key: 'hours-sat', day: 'saturday', opens: 540, closes: 840 },
      ],
      note: x.t('Sundays by appointment', 'Sonntags nach Vereinbarung'),
    },
    {
      _key: 'footer',
      type: 'footer',
      v: 1,
      tagline: x.t('Good work, close to home.', 'Gute Arbeit, ganz in der Nähe.'),
    },
  ],
  pages: {
    '/imprint': (x) => ({
      path: '/imprint',
      name: x.t('Imprint', 'Impressum'),
      seo: { title: x.t('Imprint', 'Impressum') },
      blocks: [
        {
          _key: 'impr0001',
          type: 'imprint',
          v: 1,
          title: x.t('Imprint', 'Impressum'),
          body: x.t(
            'Commercial register: CHE-000.000.000 — an example: write the business\'s entry here, or delete this line.\nVAT number: CHE-000.000.000 MWST — an example.\nResponsible for the content: the owner of the business.',
            'Handelsregister: CHE-000.000.000 — ein Beispiel: tragen Sie hier den Eintrag des Geschäfts ein, oder löschen Sie die Zeile.\nMehrwertsteuernummer: CHE-000.000.000 MWST — ein Beispiel.\nVerantwortlich für den Inhalt: die Inhaberin oder der Inhaber des Geschäfts.',
          ),
        },
      ],
    }),
  },
};

/** Every unit by its name. Modules join in lib/units/modules.mjs. */
export const BY_NAME = Object.fromEntries(SECTIONS.map((one) => [one.name, one]));
