import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProgress, readBrief, sayProgress } from '../lib/progress.mjs';

// A site halfway through being written, laid out in a temporary directory:
// a brief with open questions, a catalogue, one page with some of its text,
// a collection the diary points at with no entry yet, settings without
// hours. Progress is read off these and nothing else.

function site({ brief = true, catalogue = true, written = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-progress-'));
  const write = (path, text) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  if (brief) {
    write('BRIEF.md', [
      '# Corner Bakery — brief', '',
      'Read on 9 October. Sources: developer.', '',
      '## In one sentence', 'A bakery that wants more weekday orders.', '',
      '## The one action', 'Call.', '',
      '## Facts', '| Fact | Value | Source |', '| --- | --- | --- |', '| Name | Corner Bakery | developer |', '| Phone | NEEDS CLIENT | — |', '',
      '## Bookings', 'The kit: salon, whole.', '',
      '## Decisions', '', '',
      '## Open — NEEDS CLIENT', '- the phone number', '- opening hours on Sunday', '',
      '## Done when', '- [x] every fact has a source', '- [ ] the kit is taken whole', '- [ ] the developer said yes', '',
    ].join('\n'));
  }
  if (catalogue) {
    write('jtk/catalogue.json', JSON.stringify({
      contract: 2,
      blocks: [
        { type: 'hero', v: 1, label: 'Hero', fields: [
          { key: 'title', label: 'Title', kind: 'text', required: true },
          { key: 'lead', label: 'Lead', kind: 'textarea' },
          { key: 'cta_href', label: 'Link', kind: 'url' },
          { key: 'image', label: 'Picture', kind: 'media' },
        ] },
        { type: 'service', v: 1, label: 'Service', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true }] },
      ],
      collections: [{ name: 'services', label: 'Services', prefix: '/services', type: 'service', pages: false }],
      modules: { bookings: { services: 'services' } },
    }));
  }
  write('jtk/content/index.json', JSON.stringify({
    path: '/', seo: {},
    blocks: [{ _key: 'h1', type: 'hero', v: 1, title: written ? 'Bread, every morning' : '', lead: written ? 'Since 1998.' : 'Since 1998.', cta_href: '#contact', image: '' }],
  }));
  write('jtk/bookings.json', JSON.stringify({ blocks: [{ type: 'bookings_config', v: 1, kit: 'salon', kit_version: '0.5.1', zone: 'Europe/Zurich' }] }));
  write('src/data/site.ts', "export const SITE = { name: '{{NAME}}' };\nexport const SCHEMA_TYPE = '{{SCHEMA_TYPE}}';\n");
  return root;
}

test('progress is read off the files: the brief, the pages, the collections, the settings', async () => {
  const p = await readProgress(site());
  assert.equal(p.rule, 'exact');
  assert.deepEqual(p.kit, { kind: 'salon', version: '0.5.1' });
  assert.equal(p.brief.facts, 2);
  assert.equal(p.brief.open, 2);
  assert.equal(p.brief.needsClient, 1, 'the phone, in the table — not the heading, not the checklist');
  assert.equal(p.brief.sections['Decisions'], false);
  assert.equal(p.brief.sections['Facts'], true);
  assert.deepEqual(p.brief.doneWhen, { done: 1, of: 3, items: [
    { done: true, says: 'every fact has a source' }, { done: false, says: 'the kit is taken whole' }, { done: false, says: 'the developer said yes' },
  ] });
  assert.equal(p.catalogue, true);
  assert.deepEqual(p.pages, [{ path: '/', written: false, filled: 1, of: 2, missing: 1 }]);
  assert.deepEqual(p.collections, { services: { entries: 0, expected: 1 } });
  assert.deepEqual(p.settings, { hours: false, zone: true, payment: '' });
  assert.deepEqual(p.facts, { placeholders: 2 });
  assert.equal(p.media, 0);
  assert.deepEqual(p.missing, [
    '2 questions for the client (Open — NEEDS CLIENT)',
    'the brief has no Decisions yet',
    '/: 1 of 2 fields, 1 required missing',
    'services: no entry yet',
    'the opening hours are not set (jtk/bookings.json)',
    'src/data/site.ts still carries 2 placeholders',
    'no picture yet',
  ]);
  assert.ok(p.changedAt !== null);
});

test('a page is written when its required text is there; a site with no catalogue is read by the weaker rule', async () => {
  const exact = await readProgress(site({ written: true }));
  assert.equal(exact.pages[0].written, true);
  assert.ok(!exact.missing.some((one) => one.startsWith('/:')));

  const loose = await readProgress(site({ catalogue: false, written: true }));
  assert.equal(loose.rule, 'has-text');
  assert.equal(loose.pages[0].written, true);
  assert.equal(loose.pages[0].of, 2, 'the url and the picture are not words');
  assert.ok(loose.missing.includes('jtk/catalogue.json is not written yet (npx @jtakeit/astro catalogue)'));
});

test('no brief is said first, and an empty tree is nothing but missing', async () => {
  const p = await readProgress(site({ brief: false }));
  assert.equal(p.brief, null);
  assert.equal(p.missing[0], 'BRIEF.md is not written yet');
  assert.equal(await readBrief(join(tmpdir(), 'no-such-brief.md')), null);

  const empty = await readProgress(mkdtempSync(join(tmpdir(), 'jtk-empty-')));
  assert.deepEqual(empty.pages, []);
  assert.equal(empty.changedAt, null);
  assert.ok(empty.missing.includes('no page has content yet'));
});

test('the terminal says the same list', async () => {
  const said = sayProgress(await readProgress(site()));
  assert.match(said, /brief: 2 fact\(s\), 2 open for the client, done when 1\/3/);
  assert.match(said, /todo \/  1\/2 fields, 1 required missing/);
  assert.match(said, /todo services: 0 entries \(≥ 1\)/);
  assert.match(said, /- no picture yet/);
});

test('the brief the scaffold writes has no words of its own', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-skeleton-'));
  writeFileSync(join(root, 'BRIEF.md'), [
    '# Probe — brief', '', 'Read on <date>. Sources: developer <date>.', '',
    '## In one sentence', '', '## The one action', '', '## Facts', '| Fact | Value | Source |', '| --- | --- | --- |', '',
    '## Bookings', 'The kit: salon, whole — or what was taken out, under Decisions.', '| Asked | Answer | Source |', '| --- | --- | --- |', '| Default | Confirmed / changed to | Source |', '| --- | --- | --- |', '',
    '## Decisions', '', '## Open — NEEDS CLIENT', '', '## Done when', '- [ ] every fact has a source, and every gap is NEEDS CLIENT', '- [ ] hours: when it is open', '',
  ].join('\n'));
  const b = await readBrief(join(root, 'BRIEF.md'));
  assert.deepEqual(Object.entries(b.sections).filter(([, has]) => has).map(([name]) => name), ['Done when']);
  assert.equal(b.facts, 0);
  assert.equal(b.needsClient, 0);
  assert.equal(b.doneWhen.of, 2);
});

// ── contract 3 ─────────────────────────────────────────────────────────────
//
// The same reading of a contract-3 tree (jtakeit-core wiki/98 §2–§6): the
// schema is the declaration, pages and entries are where contract 3 keeps
// them, an entry's words are its `fields`, a picture is `{src}`, the diary's
// settings are a module's, the currency is site.json's own.

const PAGE_ID = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e21';
const SERVICES_ID = '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e22';
const CUT_ID = '0193a5c3-1b2a-7e44-8a10-6c2f9d3e4b55';

function site3({ settings = true, currency = 'CHF', named = true, schema = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'jtk-progress3-'));
  const write = (path, value) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  };
  write('jtk/schema.json', {
    contract: 3,
    locale: 'de-CH',
    blocks: [
      { type: 'hero', v: 1, label: 'Hero', fields: [
        { key: 'title', label: 'Title', kind: 'text', required: true, client_editable: true },
        { key: 'lead', label: 'Lead', kind: 'textarea', client_editable: true },
        { key: 'image', label: 'Picture', kind: 'media', client_editable: true },
      ] },
      { type: 'service', v: 1, label: 'Service', fields: [
        { key: 'title', label: 'Name', kind: 'text', required: true, client_editable: true },
        { key: 'cover', label: 'Picture', kind: 'media', client_editable: true },
        { key: 'costs', label: 'Price', kind: 'money', client_editable: true },
      ] },
      { type: 'master', v: 1, label: 'Master', fields: [{ key: 'title', label: 'Name', kind: 'text', required: true, client_editable: true }] },
    ],
    collections: [
      { name: 'services', label: 'Services', type: 'service', route: 'none', shown_on: ['/services#services-{slug}'] },
      { name: 'masters', label: 'Masters', type: 'master', route: { detail: '/masters/{slug}' } },
    ],
    modules: { bookings: { services: 'services', resources: 'masters' } },
    ...schema,
  });
  write('jtk/site.json', { id: 's-1', slug: 'probe', media_base: '', ...(currency === '' ? {} : { currency }) });
  write('jtk/pages/index.json', {
    ...(named ? { id: PAGE_ID } : {}),
    path: '/', name: 'Start',
    blocks: [{ _key: 'hero', type: 'hero', v: 1, title: 'Willkommen', image: { src: 'media/a.jpg', alt: 'Der Laden' } }],
  });
  // The page a route-"none" collection is shown on: nothing of its own to write.
  write('jtk/pages/services.json', { id: SERVICES_ID, path: '/services', name: 'Leistungen' });
  write('jtk/entries/services/schnitt.json', { id: CUT_ID, collection: 'services', slug: 'schnitt', visible: true, fields: { title: 'Schnitt', cover: { src: 'media/cut.jpg' }, costs: { minor: 4500 } } });
  if (settings) write('jtk/modules/bookings.json', { v: 1, settings: { kit: 'salon', kit_version: '1', zone: 'Europe/Zurich', payment: 'on_the_spot' } });
  return root;
}

test('contract 3: the schema is the declaration, an entry\'s words are its fields, a picture is {src}, the settings are the module\'s', async () => {
  const progress = await readProgress(site3());
  assert.equal(progress.version, 1, 'the panel reads version 1 and nothing else');
  assert.equal(progress.contract, 3);
  assert.equal(progress.rule, 'exact');
  assert.equal(progress.catalogue, true, 'the declaration is written — the field the panel reads as «laid out»');
  assert.deepEqual(progress.pages, [
    { path: '/', written: true, filled: 1, of: 2 },
    { path: '/services', written: true, filled: 0, of: 0 },
  ]);
  assert.deepEqual(progress.collections, { services: { entries: 1, expected: 1 }, masters: { entries: 0, expected: 1 } });
  assert.equal(progress.media, 2, "the hero's picture, and the service's own cover");
  assert.deepEqual(progress.kit, { kind: 'salon', version: '1' });
  assert.deepEqual(progress.settings, { hours: false, zone: true, payment: 'on_the_spot' });
  assert.deepEqual(progress.missing, [
    'BRIEF.md is not written yet',
    'masters: no entry yet',
    'the opening hours are not set (jtk/modules/bookings.json)',
  ]);
  assert.match(sayProgress(progress), /^schema: written$/m);
  assert.doesNotMatch(sayProgress(progress), /catalogue/);
});

test('contract 3: what only a contract-3 tree can lack is said — a catalogue beside the schema, a name, the settings\' file, a currency', async () => {
  const root = site3({ settings: false, currency: '', named: false });
  writeFileSync(join(root, 'jtk', 'catalogue.json'), '{"contract": 2, "blocks": []}');
  const progress = await readProgress(root);
  assert.deepEqual(progress.missing, [
    'BRIEF.md is not written yet',
    "jtk/catalogue.json is contract 2's and still beside jtk/schema.json — the platform refuses a tree with both (git rm jtk/catalogue.json)",
    '1 place in jtk/ without the id or the _key the panel taps it by (npx @jtakeit/astro catalogue mints them; jtkit lint names each)',
    'masters: no entry yet',
    'jtk/modules/bookings.json is not written yet',
    "the site has prices and no currency yet — jtk/site.json says none: write it at its top (\"currency\": \"CHF\") and the next import takes it while the site has none (create_site's `currency` for a new site); once set, a person changes it in the panel; every price is drawn without one until then",
  ]);
  assert.equal(progress.settings, null);
  assert.equal(progress.kit, null);
});

test('contract 3: the currency is site.json\'s top, never business; a schema without a price asks for none', async () => {
  const root = site3({ currency: '' });
  writeFileSync(join(root, 'jtk', 'site.json'), JSON.stringify({ slug: 'probe', business: { currency: 'CHF' } }));
  assert.ok((await readProgress(root)).missing.some((one) => one.startsWith('the site has prices and no currency yet')));

  const unpriced = site3({ currency: '', schema: {} });
  const schema = JSON.parse((await import('node:fs')).readFileSync(join(unpriced, 'jtk', 'schema.json'), 'utf8'));
  schema.blocks.find((one) => one.type === 'service').fields.pop();
  writeFileSync(join(unpriced, 'jtk', 'schema.json'), JSON.stringify(schema));
  assert.ok(!(await readProgress(unpriced)).missing.some((one) => one.includes('currency')));
});

test('contract 3: a page not written yet, and a required word missing, in the same sentences as contract 2', async () => {
  const root = site3();
  writeFileSync(join(root, 'jtk', 'pages', 'about.json'), JSON.stringify({ id: '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e23', path: '/about', name: 'Über', blocks: [{ _key: 'hero', type: 'hero', v: 1, lead: 'Seit 1990.' }] }));
  writeFileSync(join(root, 'jtk', 'pages', 'team.json'), JSON.stringify({ id: '0193a5c2-7f4e-7c1a-9b2e-5d1f0c3a8e24', path: '/team', name: 'Team', blocks: [{ _key: 'hero', type: 'hero', v: 1 }] }));
  const progress = await readProgress(root);
  assert.deepEqual(progress.pages.map((one) => [one.path, one.written, one.missing]), [['/', true, undefined], ['/about', false, 1], ['/services', true, undefined], ['/team', false, 1]]);
  assert.ok(progress.missing.includes('/about: 1 of 2 fields, 1 required missing'));
  assert.ok(progress.missing.includes('/team is not written yet'));
});
