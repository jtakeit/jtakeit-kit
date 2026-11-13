// `jtkit lint` on a contract-3 tree: the build's lint3 (jtakeit-core
// sitebuild/annotation-lint.mjs, wiki/98 §16 · 6) before the push — the
// grammar by key, documents by id, `data-jtk-href`, `_meta.json` without
// drafts — and the preflight's currency check. A tree laid out in a temporary
// directory, one rule a test: each test breaks the clean tree in one way and
// asserts the build's code and sentence for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lint, CODES, placeOf, pricePaths } from '../lib/lint.mjs';
import { LOCAL } from '../lib/codes.mjs';

const HOME = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21';
const PRICES = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e22';
const OAK = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55';
const LANE = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b56';
const HIDDEN = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b57';
const NOBODY = '0193a5c3-0000-7000-8000-000000000000';

const ce = (key, kind, more = {}) => ({ key, label: key, kind, client_editable: true, ...more });

const SCHEMA = {
  contract: 3,
  locale: 'de',
  blocks: [
    { type: 'hero', v: 1, label: 'Hero', fields: [ce('title', 'text'), ce('lead', 'textarea'), ce('image', 'media'), { key: 'link', label: 'Link', kind: 'url' }, { key: 'note', label: 'Note', kind: 'text' }] },
    {
      type: 'prices', v: 1, label: 'Prices',
      fields: [ce('title', 'text'), { key: 'items', label: 'Items', kind: 'list', of: [ce('title', 'text'), ce('price', 'money'), { key: 'extras', label: 'Extras', kind: 'list', of: [ce('name', 'text'), ce('extra', 'money')] }] }],
    },
    { type: 'gallery', v: 1, label: 'Gallery', fields: [ce('pictures', 'media', { multiple: true })] },
    { type: 'contacts', v: 1, label: 'Contacts', fields: [ce('name', 'text'), ce('phone', 'tel')] },
    { type: 'cta', v: 1, label: 'Form', collects: 'enquiry', asks: [{ key: 'lanes', label: 'Lanes', kind: 'number' }], fields: [ce('title', 'text')] },
    { type: 'work', v: 1, label: 'Work', fields: [ce('title', 'text', { required: true }), { key: 'date', label: 'Date', kind: 'date' }, ce('cover', 'media'), ce('price', 'money')] },
    { type: 'rate', v: 1, label: 'Rate', fields: [ce('title', 'text', { required: true }), ce('costs', 'money')] },
  ],
  shared: ['contacts'],
  collections: [
    { name: 'works', label: 'Works', type: 'work', route: { detail: '/werke/{slug}', listing: '/werke' }, blocks: ['gallery'] },
    { name: 'rates', label: 'Rates', type: 'rate', route: 'none', shown_on: ['/preise#{slug}'] },
  ],
};

const FILES = {
  'jtk/schema.json': SCHEMA,
  'jtk/site.json': { id: 's-1', slug: 'probe', media_base: '', currency: 'CHF' },
  'jtk/pages/index.json': {
    id: HOME, path: '/', name: 'Start',
    blocks: [
      { _key: 'hero', type: 'hero', v: 1, title: 'Willkommen', lead: 'Ein Laden.', image: { src: 'media/a.jpg', alt: 'Der Laden' }, link: 'https://x.ch', note: 'nicht getippt' },
      { _key: 'form', type: 'cta', v: 1, title: 'Schreiben' },
    ],
  },
  'jtk/pages/preise.json': {
    id: PRICES, path: '/preise', name: 'Preise',
    blocks: [{ _key: 'list', type: 'prices', v: 1, title: 'Preise', items: [{ _key: 'r1', title: 'Schnitt', price: { minor: 4500 }, extras: [{ _key: 'x1', name: 'Waschen', extra: { minor: 500 } }] }] }],
  },
  'jtk/entries/works/eiche.json': {
    id: OAK, collection: 'works', slug: 'eiche', visible: true,
    fields: { title: 'Eiche', cover: { src: 'media/oak.jpg', alt: 'Eiche' }, price: { minor: 12000 } },
    blocks: [{ _key: 'b1', type: 'gallery', v: 1, pictures: [{ _key: 'g1', src: 'media/1.jpg' }, { _key: 'g2', src: 'media/2.jpg' }] }],
  },
  'jtk/entries/rates/bahn.json': { id: LANE, collection: 'rates', slug: 'bahn', visible: true, fields: { title: 'Bahn', costs: { minor: 2500 } } },
  'jtk/entries/rates/zu.json': { id: HIDDEN, collection: 'rates', slug: 'zu', visible: false, fields: { title: 'Zu', costs: { minor: 100 } } },
  'jtk/shared.json': { blocks: [{ _key: 'contacts', type: 'contacts', v: 1, name: 'Laden', phone: '+41 44 000 00 00' }] },
};

const footer = '<footer><span data-jtk-path="shared:blocks[contacts].name">Laden</span><a data-jtk-path="shared:blocks[contacts].phone">+41 44 000 00 00</a></footer>';
const PAGES = {
  'index.html':
    '<html><body><h1 data-jtk-path="blocks[hero].title">Willkommen</h1><p data-jtk-path="blocks[hero].lead">Ein Laden.</p>' +
    '<img data-jtk-path="blocks[hero].image.src" src="a.jpg"><a href="https://x.ch" data-jtk-href="blocks[hero].link">mehr</a>' +
    '<form action="/api/lead"><h2 data-jtk-path="blocks[form].title">Schreiben</h2><input name="name"><input name="phone"><input name="website"><input name="lanes"></form>' +
    `<a data-jtk-path="entry:${OAK}:title">Eiche</a>${footer}</body></html>`,
  'preise/index.html':
    '<html><body><h1 data-jtk-path="blocks[list].title">Preise</h1><ul><li><span data-jtk-path="blocks[list].items[r1].title">Schnitt</span>' +
    '<span data-jtk-path="blocks[list].items[r1].price">CHF 45.–</span><i data-jtk-path="blocks[list].items[r1].extras[x1].name">Waschen</i>' +
    '<i data-jtk-path="blocks[list].items[r1].extras[x1].extra">CHF 5.–</i></li></ul>' +
    `<div id="bahn"><b data-jtk-path="entry:${LANE}:title">Bahn</b><b data-jtk-path="entry:${LANE}:costs">CHF 25.–</b></div>` +
    `<a data-jtk-path="page:${HOME}:blocks[hero].title">Willkommen</a>${footer}</body></html>`,
  'werke/index.html': `<html><body><a data-jtk-path="entry:${OAK}:title">Eiche</a><img data-jtk-path="entry:${OAK}:cover.src">${footer}</body></html>`,
  'werke/eiche/index.html':
    '<html><body data-price="12000" data-jtk-bind="data-price:price"><h1 data-jtk-path="title">Eiche</h1><img data-jtk-path="cover.src"><b data-jtk-path="price">CHF 120.–</b>' +
    `<img data-jtk-path="blocks[b1].pictures[g1].src"><img data-jtk-path="blocks[b1].pictures[g2].src">${footer}</body></html>`,
  '_meta.json': JSON.stringify({ redirects: [{ from: '/alt', to: '/', status: 301 }], immutable: ['/_astro/'] }),
};

/** The clean tree, with `files` and `pages` laid over it — a value of `null` removes that file. */
function tree({ files = {}, pages = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-lint3-'));
  const lay = (dir, map, asText) => {
    for (const [path, value] of Object.entries(map)) {
      if (value === null) continue;
      mkdirSync(join(root, dir, path, '..'), { recursive: true });
      writeFileSync(join(root, dir, path), asText ? value : `${JSON.stringify(value, null, 2)}\n`);
    }
  };
  lay('', { ...FILES, ...files }, false);
  lay('dist', { ...PAGES, ...pages }, true);
  return root;
}
const page = (name, from, to) => ({ [name]: PAGES[name].replace(from, to) });
const said = (out) => out.findings.map((one) => `${one.code} ${one.says}`);

test('a contract-3 tree the page agrees with: clean, in the build\'s words', async () => {
  const out = await lint({ root: tree() });
  assert.deepEqual(said(out), []);
  assert.equal(out.ok, true);
  assert.equal(out.contract, 3);
  assert.equal(out.pages, 2);
  assert.equal(out.entries, 3);
  assert.equal(out.shared, true);
  assert.equal(out.line, 'every content field on 2 page(s) and 3 entries and the shared text is annotated');
});

test('every filled value the owner taps is annotated where it is drawn, by key — a picture by its file, a row and a row\'s row, an entry\'s own value', async () => {
  const strip = (name, path) => page(name, ` data-jtk-path="${path}"`, '');
  const out = await lint({
    root: tree({
      pages: {
        ...strip('index.html', 'blocks[hero].image.src'),
        'preise/index.html': PAGES['preise/index.html'].replace(' data-jtk-path="blocks[list].items[r1].price"', '').replace(' data-jtk-path="blocks[list].items[r1].extras[x1].extra"', ''),
        'werke/eiche/index.html': PAGES['werke/eiche/index.html'].replace(' data-jtk-path="price"', '').replace(' data-jtk-path="blocks[b1].pictures[g2].src"', ''),
      },
    }),
  });
  assert.deepEqual(said(out), [
    `${CODES.UNANNOTATED_FIELD} /: blocks[hero].image.src is not annotated`,
    `${CODES.UNANNOTATED_FIELD} /preise: blocks[list].items[r1].price is not annotated`,
    `${CODES.UNANNOTATED_FIELD} /preise: blocks[list].items[r1].extras[x1].extra is not annotated`,
    `${CODES.UNANNOTATED_FIELD} /werke/eiche: price is not annotated`,
    `${CODES.UNANNOTATED_FIELD} /werke/eiche: blocks[b1].pictures[g2].src is not annotated`,
  ]);
  assert.equal(out.line, '5 unannotated field(s) — the visual editor would silently stop working on them');
});

test('only what says client_editable: true is asked for, and contract 2\'s place by index answers nothing', async () => {
  // `note` is text without client_editable (absent is false, §3.3); `link` is a url.
  const byIndex = await lint({ root: tree({ pages: page('index.html', 'data-jtk-path="blocks[hero].title"', 'data-jtk-path="blocks[0].title"') }) });
  assert.deepEqual(said(byIndex), [`${CODES.UNANNOTATED_FIELD} /: blocks[hero].title is not annotated`]);
  // Spaces are empty (§15 · 15): nothing to annotate.
  const home = structuredClone(FILES['jtk/pages/index.json']);
  home.blocks[0].lead = '   ';
  const spaces = await lint({ root: tree({ files: { 'jtk/pages/index.json': home }, pages: page('index.html', ' data-jtk-path="blocks[hero].lead"', '') }) });
  assert.deepEqual(said(spaces), []);
});

test('an entry without a page of its own is annotated as entry:<id>: where it is shown — unless it is hidden, or not yet out', async () => {
  const out = await lint({ root: tree({ pages: page('preise/index.html', ` data-jtk-path="entry:${LANE}:costs"`, '') }) });
  assert.deepEqual(said(out), [
    `${CODES.UNANNOTATED_FIELD} /preise#bahn: entry:${LANE}:costs is on no page — rates "bahn" has no page of its own, and has to be annotated where it is shown`,
  ]);
  // Not yet out: shown from tomorrow, read by the lint's clock.
  const later = { ...FILES['jtk/entries/rates/bahn.json'], show_at: '2026-11-12T00:00:00Z' };
  const scheduled = await lint({ root: tree({ files: { 'jtk/entries/rates/bahn.json': later }, pages: page('preise/index.html', ` data-jtk-path="entry:${LANE}:costs"`, '') }), now: Date.parse('2026-11-11T12:00:00Z') });
  assert.deepEqual(said(scheduled), []);
});

test('the pages the content says are built: a page, an entry\'s own, and the page a collection\'s shown_on names', async () => {
  const root = tree();
  rmSync(join(root, 'dist', 'werke', 'eiche'), { recursive: true });
  const out = await lint({ root });
  assert.deepEqual(said(out), [`${CODES.PAGE_NOT_BUILT} /werke/eiche: the content has this page, works "eiche"'s own, and the build did not produce it`]);

  const elsewhere = structuredClone(SCHEMA);
  elsewhere.collections[1].shown_on = ['/tarife#{slug}'];
  const shownOn = await lint({ root: tree({ files: { 'jtk/schema.json': elsewhere }, pages: { 'preise/index.html': PAGES['preise/index.html'].replace(/<div id="bahn">.*?<\/div>/, '') } }) });
  assert.deepEqual(said(shownOn), [
    `${CODES.UNANNOTATED_FIELD} /tarife#bahn: entry:${LANE}:title is on no page — rates "bahn" has no page of its own, and has to be annotated where it is shown`,
    `${CODES.UNANNOTATED_FIELD} /tarife#bahn: entry:${LANE}:costs is on no page — rates "bahn" has no page of its own, and has to be annotated where it is shown`,
    `${CODES.PAGE_NOT_BUILT} /tarife: the collection "rates" shows its entries here (its shown_on), and the build did not produce this page — build it, or name in shown_on the page that shows them`,
  ]);
});

test('a shared field the whole site annotates nowhere — a phone is no tap target (tel), its name is', async () => {
  const root = tree();
  for (const name of ['index.html', 'preise/index.html', 'werke/index.html', 'werke/eiche/index.html']) {
    writeFileSync(join(root, 'dist', name), PAGES[name].replace(' data-jtk-path="shared:blocks[contacts].name"', '').replace(' data-jtk-path="shared:blocks[contacts].phone"', ''));
  }
  const out = await lint({ root });
  assert.deepEqual(said(out), [`${CODES.SHARED_NOT_RENDERED} shared:blocks[contacts].name is on no page — a shared field nothing renders is a control that edits nothing`]);
});

test('wiki/111 §3.3 as the platform\'s lint has it: E1 and E2 are advice, E3 refuses a source nothing has', async () => {
  // The tree's phone is annotated in the footer: clean, no advice.
  let out = await lint({ root: tree() });
  assert.deepEqual(out.warnings, []);
  // Drawn without it: still ok — advice, by its own code: unannotated (E1), and drawn but untappable (E2).
  const unannotated = Object.fromEntries(Object.entries(PAGES).map(([name, html]) => [name, typeof html === 'string' ? html.replace('<a data-jtk-path="shared:blocks[contacts].phone">', '<a>') : html]));
  out = await lint({ root: tree({ pages: unannotated }) });
  assert.equal(out.ok, true);
  assert.deepEqual(out.warnings.map((one) => one.code), ['JTK_W_UNANNOTATED_FIELD', 'JTK_W_DRAWN_UNTAPPABLE']);
  assert.match(out.warnings[0].says, /shared:blocks\[contacts\]\.phone is drawn on no page with its annotation/);
  assert.match(out.warnings[1].says, /shared:blocks\[contacts\]\.phone \(«\+41 44 000 00 00»\) is drawn and nothing makes it tappable/);
  // Under a source named with data-jtk-from it is claimed: no E2; and a source that exists is fine.
  const claimed = Object.fromEntries(Object.entries(unannotated).map(([name, html]) => [name, typeof html === 'string' ? html.replace('<footer>', '<footer data-jtk-from="shared:blocks[contacts]">') : html]));
  out = await lint({ root: tree({ pages: claimed }) });
  assert.equal(out.ok, true);
  assert.deepEqual(out.warnings.map((one) => one.code), ['JTK_W_UNANNOTATED_FIELD']);
  // E3: a source the grammar has not got, or the site has not got, is refused.
  for (const from of ['module:nothing', 'shared:blocks[nowhere]', 'blocks[Hero]', `entry:${NOBODY}`]) {
    out = await lint({ root: tree({ pages: page('index.html', '<footer>', `<footer data-jtk-from="${from}">`) }) });
    assert.equal(out.ok, false, from);
    assert.deepEqual(said(out), [`${CODES.ANNOTATION_UNKNOWN} /: names its source ${from}, which ${from === 'blocks[Hero]' ? 'is not one the grammar has — blocks[<key>], shared:blocks[<key>], page:<id>[:blocks[<key>]], entry:<id>[:blocks[<key>]], module:<name>' : 'this site has not got'}`]);
  }
  for (const from of ['shared:blocks[contacts]', 'blocks[hero]', `entry:${OAK}`, `page:${PRICES}:blocks[list]`]) {
    out = await lint({ root: tree({ pages: page('index.html', '<footer>', `<footer data-jtk-from="${from}">`) }) });
    assert.equal(out.ok, true, from);
  }
});

test('page:<id>: and entry:<id>: name a document by the id its file carries, and a place it declares', async () => {
  const tiles = [
    `<i data-jtk-path="page:${NOBODY}:blocks[hero].title">x</i>`,
    // A page's id is no entry's, nor an entry's a page's.
    `<i data-jtk-path="entry:${HOME}:blocks[hero].title">x</i>`,
    `<i data-jtk-path="page:${OAK}:title">x</i>`,
    `<i data-jtk-path="entry:${OAK}:subtitle">x</i>`,
    `<i data-jtk-path="page:${PRICES}:blocks[hero].title">x</i>`,
    '<i data-jtk-path="page:/preise:blocks[0].title">x</i>',
    `<i data-jtk-path="entry:${OAK}:shared:blocks[contacts].name">x</i>`,
    // Declared and empty is still the place a tap opens: the oak has no date.
    `<i data-jtk-path="entry:${OAK}:date">x</i>`,
    `<i data-jtk-path="page:${PRICES}:blocks[list].items[r9].extras[x9].name">x</i>`,
    `<i data-jtk-path="entry:${OAK}:blocks[b1].pictures[g1].src">x</i>`,
  ].join('');
  const out = await lint({ root: tree({ pages: { 'werke/index.html': PAGES['werke/index.html'].replace('</body>', `${tiles}</body>`) } }) });
  assert.deepEqual(said(out), [
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates page:${NOBODY}: and this site has no such page`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates entry:${HOME}: and this site has no such entry`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates page:${OAK}: and this site has no such page`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates subtitle on entry:${OAK}, which that entry's document has no field for`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates blocks[hero].title on page:${PRICES}, which that page's document has no field for`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates page:/preise:blocks[0].title, which names no document by its id — contract 3 names another page or an entry by its id: page:<id>:… and entry:<id>:…`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: annotates shared:blocks[contacts].name on entry:${OAK}, which that entry's document has no field for`,
  ]);
});

test('a bind and a link name a place by key in the page\'s own document or the shared text', async () => {
  const binds = [
    'data-a:blocks[hero].note', // declared, not tapped: binds may name it
    'data-b:shared:blocks[contacts].phone',
    'data-c:blocks[0].title', // by index
    'data-d:title', // an entry's own value, on a page that is no entry's
    'href:blocks[hero].link', // not a data- attribute
    `data-e:entry:${OAK}:title`, // another document: the build reads a bind in the page's own
  ].join(' ');
  const out = await lint({
    root: tree({
      pages: {
        'index.html': PAGES['index.html'].replace('<body>', `<body data-jtk-bind="${binds}">`).replace('data-jtk-href="blocks[hero].link"', 'data-jtk-href="blocks[hero].href"'),
        'werke/index.html': PAGES['werke/index.html'].replace('<body>', '<body data-jtk-bind="data-f:title"><a data-jtk-href="shared:blocks[contacts].phone">x</a>'),
      },
    }),
  });
  assert.deepEqual(said(out), [
    `${CODES.ANNOTATION_UNKNOWN} /: binds data-c to blocks[0].title, which this page's document has no field for`,
    `${CODES.ANNOTATION_UNKNOWN} /: binds data-d to title, which this page's document has no field for`,
    `${CODES.ANNOTATION_UNKNOWN} /: binds "href:blocks[hero].link" — a bind is data-<name>:<path>, and the editor writes only data- attributes`,
    `${CODES.ANNOTATION_UNKNOWN} /: binds data-e to entry:${OAK}:title, which this page's document has no field for`,
    `${CODES.ANNOTATION_UNKNOWN} /: leads a link to where blocks[hero].href says, which this page's document has no field for`,
    `${CODES.ANNOTATION_UNKNOWN} /werke: binds data-f to title, which this page's document has no field for`,
  ]);
});

test('names: a page or an entry without its id, a block or a row without its _key — JTK_E_UNNAMED with the file and the fix, and the rest still read', async () => {
  const home = structuredClone(FILES['jtk/pages/index.json']);
  delete home.id;
  const oak = structuredClone(FILES['jtk/entries/works/eiche.json']);
  delete oak.blocks[0].pictures[1]._key;
  const out = await lint({ root: tree({ files: { 'jtk/pages/index.json': home, 'jtk/entries/works/eiche.json': oak } }) });
  assert.deepEqual(out.findings.map((one) => [one.code, one.says.split(' — ')[0]]), [
    [CODES.UNNAMED, 'jtk/entries/works/eiche.json: blocks[0].pictures[1] has no "_key"'],
    [CODES.UNNAMED, 'jtk/pages/index.json: no "id"'],
    // The tile names the home by an id it no longer carries.
    [CODES.ANNOTATION_UNKNOWN, `/preise: annotates page:${HOME}: and this site has no such page`],
  ]);
});

test('dist/_meta.json in the shape the platform reads: drafts are contract 2\'s, and it stops the lint', async () => {
  const out = await lint({
    root: tree({
      pages: {
        '_meta.json': JSON.stringify({ drafts: ['/blog/_fl-text/'], redirects: [{ from: 'alt', to: '/' }], cache: [{ prefix: '/', maxAge: 60 }], extra: 1 }),
        'index.html': PAGES['index.html'].replace(' data-jtk-path="blocks[hero].title"', ''),
      },
    }),
  });
  assert.deepEqual(said(out), [
    `${CODES.META_INVALID} dist/_meta.json: "drafts" is contract 2's — on contract 3 which entries a visitor may not see is the platform's to say, from each entry's visible and its moments, for every build; leave it out`,
    `${CODES.META_INVALID} dist/_meta.json: "extra" is no key of it — the platform reads redirects, immutable and cache, and nothing else`,
    `${CODES.META_INVALID} dist/_meta.json: redirects[0] is not {"from": "/an/address", "to": "<where it leads>"}`,
    `${CODES.META_INVALID} dist/_meta.json: cache[0] names no directory — {"prefix": "/clips/", "maxAge": 86400}, never the whole site`,
  ]);
});

test('the enquiry form: only collects: "enquiry" collects, and a form fault stops the lint', async () => {
  const out = await lint({ root: tree({ pages: page('index.html', '<input name="lanes">', '<input name="lanes"><input name="shoes">') }) });
  assert.deepEqual(said(out), [`${CODES.FORM_FIELD_UNDECLARED} /: the enquiry form asks for "shoes" and no block declares it in asks — the inbox would show a key, not a label`]);
  assert.equal(out.line, '1 enquiry form fault(s)');

  // Contract 1's `form` switch is not read on contract 3 (§3.2).
  const switched = structuredClone(SCHEMA);
  const cta = switched.blocks.find((one) => one.type === 'cta');
  delete cta.collects;
  cta.fields.push({ key: 'form', label: 'Form', kind: 'bool' });
  const undeclared = await lint({ root: tree({ files: { 'jtk/schema.json': switched } }) });
  assert.deepEqual(said(undeclared), [`${CODES.FORM_UNDECLARED} /: a form posts to /api/lead and no block says collects: "enquiry"`]);
});

test('what stops the build before it builds stops the lint, in the build\'s words: a catalogue beside the schema, contract 2\'s jtk/content/, an entry of no collection — and a translation no longer does (M3)', async () => {
  await assert.rejects(lint({ root: tree({ files: { 'jtk/catalogue.json': { contract: 2, blocks: [] } } }) }), /jtk\/ holds both schema\.json and catalogue\.json.*git rm jtk\/catalogue\.json/);
  await assert.doesNotReject(lint({ root: tree({ files: { 'jtk/pages/index.en.json': { of: HOME, locale: 'en', blocks: [{ _key: 'hero', title: 'Welcome' }] }, 'jtk/shared.en.json': { blocks: [] } } }) }));
  await assert.rejects(lint({ root: tree({ files: { 'jtk/content/index.json': { path: '/', blocks: [] } } }) }), /jtk\/content\/index\.json: jtk\/content\/ is contract 2's, and this tree says contract 3/);
  await assert.rejects(lint({ root: tree({ files: { 'jtk/modules/bookings.json': [] } }) }), /jtk\/modules\/bookings\.json is not a document — a JSON object is/);
  await assert.rejects(
    lint({ root: tree({ files: { 'jtk/entries/posts/eins.json': { id: NOBODY, collection: 'posts', slug: 'eins', visible: true, fields: {} } } }) }),
    /jtk\/entries\/posts\/eins\.json: the schema declares no collection "posts"/,
  );
});

test('the promises to search engines come first, as on contract 2', async () => {
  const out = await lint({ root: tree({ pages: { 'index.html': PAGES['index.html'].replace('<body>', '<head><meta name="robots" content="noindex"></head><body>') } }) });
  assert.deepEqual(out.findings.map((one) => one.code), [CODES.NOINDEX]);
});

test('a price says the site\'s currency, from site.json\'s top — the preflight\'s check, marked JTK_LOCAL', async () => {
  // A sign and a code of another currency, in a row's own list and on an entry's own page.
  const out = await lint({
    root: tree({
      pages: {
        'preise/index.html': PAGES['preise/index.html'].replace('CHF 5.–', '€ 5'),
        'werke/eiche/index.html': PAGES['werke/eiche/index.html'].replace('CHF 120.–', 'EUR 120'),
      },
    }),
  });
  assert.deepEqual(out.findings.map((one) => one.code), [LOCAL, LOCAL]);
  assert.equal(LOCAL, 'JTK_LOCAL');
  assert.match(out.findings[0].says, /^\/preise: «€ 5» is a price in €, and the site prices in CHF \(jtk\/site\.json\): draw a price with site\.money\(\)/);
  assert.match(out.findings[1].says, /^\/werke\/eiche: «EUR 120» is a price in EUR, and the site prices in CHF/);
  // Who sets it (jtakeit-core #212): the agent once, while the site has none; a person after.
  assert.match(out.findings[0].says, /the currency is the site's, given once \("currency" at the top of jtk\/site\.json while the site has none, or create_site's `currency`\) and changed after by a person, in the panel$/);
  assert.equal(out.line, "2 price(s) in a currency that is not the site's — the platform's preflight refuses them at the launch");

  // Contract 3's currency is site.json's top level, never `business` (§6, §15 · 14).
  const old = await lint({ root: tree({ files: { 'jtk/site.json': { slug: 'probe', business: { currency: 'CHF' } } } }) });
  assert.equal(old.findings.length, 4);
  assert.match(old.findings[0].says, /^\/preise: «CHF 45\.–» is a price in CHF, and the site has no currency — jtk\/site\.json says none/);

  // Words that are also codes, and a price with no sign at all, are left alone.
  const words = await lint({ root: tree({ pages: page('preise/index.html', 'CHF 25.–', '25 ALL inclusive') }) });
  assert.deepEqual(said(words), []);
});

test('pricePaths and placeOf read a price as the preflight does: by its path from the block down, in either grammar', () => {
  assert.deepEqual([...pricePaths(SCHEMA.blocks)].sort(), ['costs', 'items.extras.extra', 'items.price', 'price']);
  assert.equal(placeOf('blocks[list].items[r1].price'), 'items.price');
  assert.equal(placeOf(`page:${PRICES}:blocks[list].items[r1].extras[x1].extra`), 'items.extras.extra');
  assert.equal(placeOf(`entry:${LANE}:costs`), 'costs');
  assert.equal(placeOf('blocks[hero].image.alt'), 'image');
  assert.equal(placeOf('page:/services/colour:blocks[0].costs'), 'costs');
  assert.equal(placeOf('blocks[2].rates[1].costs'), 'rates.costs');
  assert.equal(placeOf('page:/services:blocks[b1].costs'), '', 'an address with a key mixes the grammars');
  assert.equal(placeOf('page:nobody:title'), '');
});
