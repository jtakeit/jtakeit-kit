/**
 * The modules a site adds on a sentence in the brief, never by default
 * (jtakeit-core wiki/110 §3.5, §3.6): `blog`, `booking` and `shop`. `events`
 * is refused with the page that says when (wiki/106).
 */
import { bodyPath } from './photos.mjs';
import { booking } from './booking.mjs';
import { shop } from './shop.mjs';

// No sentence of the example belongs to one trade: a barber, a clinic and a
// studio read the journal as their own until they write it (a barber's site,
// 17 November 2026, spoke of a workshop and its tables). The photographs are
// the example's, and their words describe them; the two go together.
const POSTS = [
  {
    slug: 'before-the-door-opens',
    date: '2026-10-02',
    title: ['Before the door opens', 'Bevor die Tür aufgeht'],
    excerpt: ['What happens before the first visitor arrives: the light, the coffee, and a look at the day ahead.', 'Was passiert, bevor der erste Besuch kommt: das Licht, der Kaffee und ein Blick auf den Tag.'],
    cover: 'journal-morning',
    body: [
      ['The day starts before anybody arrives. Everything goes back where it belongs, the room is made ready, and there is time for a cup of coffee by the window.', 'Der Tag beginnt, bevor jemand kommt. Alles kommt an seinen Platz, der Raum wird vorbereitet, und es bleibt Zeit für einen Kaffee am Fenster.'],
      ['Then a look at the day: who is coming, what they asked for, and what needs a little more time. Most of what goes well later is decided here.', 'Dann ein Blick auf den Tag: wer kommt, was gewünscht ist und wofür es etwas mehr Zeit braucht. Das meiste, was später gelingt, entscheidet sich hier.'],
    ],
    picture: ['journal-measure', 'Hands measuring paper with a brass ruler', 'Hände messen Papier mit einem Messinglineal'],
  },
  {
    slug: 'what-autumn-brings',
    date: '2026-09-15',
    title: ['What autumn brings', 'Was der Herbst bringt'],
    excerpt: ['What changes in the colder months, and a few things worth knowing before you visit.', 'Was sich in den kälteren Monaten ändert, und ein paar Dinge, die man vor dem Besuch wissen sollte.'],
    cover: 'journal-autumn',
    body: [
      ['When the days get shorter, people ask for different things. We plan a little more time for every visit, and for the details.', 'Wenn die Tage kürzer werden, wünscht man sich anderes. Wir planen für jeden Besuch etwas mehr Zeit ein, auch für die Details.'],
      ['Write to us if you would like to know more before your next visit — we are glad to advise.', 'Schreiben Sie uns, wenn Sie vor Ihrem nächsten Besuch mehr wissen möchten — wir beraten Sie gern.'],
    ],
  },
];

// The journal as 0.18.0 and earlier wrote it: still the example's to `jtk remove blog`.
const FORMER_POSTS = [
  {
    slug: 'a-morning-in-the-workshop',
    date: '2026-10-02',
    title: ['A morning in the workshop', 'Ein Morgen in der Werkstatt'],
    excerpt: ['What happens before the door opens: the light, the coffee, and the first measurements of the day.', 'Was passiert, bevor die Tür aufgeht: das Licht, der Kaffee und die ersten Masse des Tages.'],
    cover: 'journal-morning',
    body: [
      ['The day starts before anybody arrives. The tables are cleared, the tools go back where they belong, and there is time for a cup of coffee by the window.', 'Der Tag beginnt, bevor jemand kommt. Die Tische werden abgeräumt, das Werkzeug kommt an seinen Platz, und es bleibt Zeit für einen Kaffee am Fenster.'],
      ['Then the first measurements: slowly, twice, and written down. Most of what goes well later is decided here.', 'Dann die ersten Masse: langsam, zweimal, und aufgeschrieben. Das meiste, was später gelingt, entscheidet sich hier.'],
    ],
    picture: ['journal-measure', 'Hands measuring paper with a brass ruler', 'Hände messen Papier mit einem Messinglineal'],
  },
  {
    slug: 'what-autumn-brings',
    date: '2026-09-15',
    title: ['What autumn brings', 'Was der Herbst bringt'],
    excerpt: ['New materials for the colder months, and a few things worth knowing before you visit.', 'Neue Materialien für die kälteren Monate, und ein paar Dinge, die man vor dem Besuch wissen sollte.'],
    cover: 'journal-autumn',
    body: [
      ['When the days get shorter, the colours on the table change. Warmer tones, heavier fabrics, and more time for the details.', 'Wenn die Tage kürzer werden, ändern sich die Farben auf dem Tisch. Wärmere Töne, schwerere Stoffe und mehr Zeit für die Details.'],
      ['Write to us if you would like to see them before your next visit — we keep a few samples ready.', 'Schreiben Sie uns, wenn Sie sie vor Ihrem nächsten Besuch sehen möchten — wir halten ein paar Muster bereit.'],
    ],
  },
];

/** A journal's posts as the blog collection's entries, in a language. */
const postsAsEntries = (posts) => (x) =>
  posts.map((post, at) => ({
    collection: 'blog',
    slug: post.slug,
    rank: `a${at}`,
    fields: {
      title: x.t(...post.title),
      date: post.date,
      excerpt: x.t(...post.excerpt),
      cover: x.pic(post.cover),
      body: [
        x.t(...post.body[0]),
        ...(post.picture ? [`![${x.t(post.picture[1], post.picture[2])}](${bodyPath(post.picture[0])})`] : []),
        x.t(...post.body[1]),
      ].join('\n\n') + '\n',
    },
  }));

/** The journal on the home page, under a heading of the example's. */
const postsLatest = (title) => (x) => ({
  _key: 'post0001',
  type: 'posts_latest',
  v: 1,
  eyebrow: x.t('From the journal', 'Aus dem Journal'),
  title: x.t(...title),
  more_label: x.t('All posts', 'Alle Beiträge'),
});

const blog = {
  name: 'blog',
  kind: 'module',
  about: 'a journal: the blog collection at /blog, two example posts, the latest on the home page',
  types: [
    {
      type: 'posts_latest',
      source: `// The journal on the home page: the latest posts of \`blog\`
// (src/components/sections/PostsLatest.astro).
{
  type: 'posts_latest',
  v: 1,
  label: 'Latest posts',
  fields: [
    { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
    { key: 'title', label: 'Heading', kind: 'text', max: 120, client_editable: true },
    { key: 'more_label', label: 'Link to the journal', kind: 'text', max: 40, client_editable: true },
  ],
}`,
    },
  ],
  // The blog's two lines at the foot of blocks.ts, as `--blog` has always written them.
  statements: '// The blog, turned on by `npx @jtakeit/astro add blog` (docs/collections.md).\nBLOCKS.push(BLOG_POST);\nCOLLECTIONS.push(BLOG_COLLECTION);',
  entryCollections: ['blog'],
  sections: [{ type: 'posts_latest', component: 'PostsLatest' }],
  files: ['src/components/sections/PostsLatest.astro'],
  photos: ['journal-morning', 'journal-autumn', 'journal-measure'],
  home: [postsLatest(['News and notes.', 'Neues und Notizen.'])],
  entries: postsAsEntries(POSTS),
  // What an earlier release wrote: still the example's to `jtk remove` (lib/units/index.mjs).
  former: { home: [postsLatest(['Notes from the workshop.', 'Notizen aus der Werkstatt.'])], entries: postsAsEntries(FORMER_POSTS) },
  nav: (x) => ({ _key: 'nav-journal', label: x.t('Journal', 'Journal'), link: '/blog' }),
  present: (tree) => /^BLOCKS\.push\(BLOG_POST\);$/m.test(tree.read('src/content/blocks.ts') ?? ''),
};

export const MODULES = { blog, booking, shop };

/** Modules the platform does not have yet, and where it says when. */
export const LATER = {
  events: 'events come with wiki/106 — not yet',
};
