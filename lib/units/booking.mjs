/**
 * `jtk add booking --kind <kind>` and `jtk remove booking`: a booking kit of
 * the platform's laid over the example, mapped onto what the example already
 * has rather than beside it (jtakeit-core wiki/110 §3.6).
 *
 *   the price list   every kit's is a collection named `services`, and the
 *                    example's service already has `takes` and `costs`: the
 *                    kit's fields join the example's `service` (the kit's
 *                    definition where both have a field), and the example's
 *                    entries stay. A kit whose price list is another type
 *                    (a tariff, a table) takes the collection over, and the
 *                    example's services give way — said.
 *   the people       for a kit whose resources are people — salon, clinic —
 *                    the example's `team` entries become the kit's resource
 *                    entries, `portrait` its `cover`, and `team_list` draws
 *                    them (TeamList.astro reads the diary's resources). For
 *                    any other kind `team` stays as it is.
 *   the hours        the shared `hours` rows become the diary's
 *                    `settings.hours`, the same shape with the same `_key`s,
 *                    and the footer and the form's card read them there:
 *                    a site never types its hours twice (JTK_W_MODULE_TWIN).
 *   the button       the header's button leads to the page the diary books
 *                    on (`settings.page`), in the example's words for it.
 *
 * The booking form is the template's, on the services' page, where the
 * kit's settings put it. What the kit asks the business is printed, as
 * `create --kit` prints it: ask, never make up. Paid online or on the spot
 * is asked in the brief, never a flag.
 *
 * Every element the kit adds to blocks.ts carries a line saying so, which is
 * what `remove booking` finds them by: the kit is not asked again.
 */
import { kitIn3 } from '@jtakeit/kit/kits';
import { ownListingsOf } from '../upgrade.mjs';
import { said, tableIn, keyOf, uncommented, withElement, withoutElement } from './source.mjs';

/** The kinds whose resources are people, whom the example's team becomes (the owner, 13 November 2026). */
export const PEOPLE = new Set(['salon', 'clinic']);
const BLOCKS_TS = 'src/content/blocks.ts';
const MARK = (kind) => `// The booking kit «${kind}» (npx @jtakeit/astro add booking): yours from here on.`;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** A literal element's value: the example's tables are data literals with comments. */
function valueOf(element) {
  try {
    return new Function(`return (${uncommented(element.text)});`)();
  } catch {
    return undefined;
  }
}

const marked = (source, element) => /\/\/ The booking kit «[^»]+» \(npx @jtakeit\/astro add booking\)/.test(source.slice(element.from, element.start));

function refuse(table, file) {
  if ('refused' in table) {
    const why = new Error(table.refused);
    why.refusal = true;
    throw why;
  }
  return table;
}

/** The kit's `service` with the example's own fields kept: the kit's definition where both have one. */
function mergedService(example, kit) {
  const fields = example.fields.map((one) => kit.fields.find((k) => k.key === one.key) ?? one);
  for (const one of kit.fields) if (!fields.some((f) => f.key === one.key)) fields.push(one);
  return { ...kit, fields };
}

/** The people of the example, as the kit's resources: `title`, `portrait` → `cover`, `role` and `bio` where the kit has them. */
function asResource(fields, declared) {
  const has = (key) => declared.some((one) => one.key === key);
  const out = {};
  if (fields.title !== undefined) out.title = fields.title;
  if (fields.portrait !== undefined && has('cover')) out.cover = fields.portrait;
  for (const key of ['role', 'bio']) if (fields[key] !== undefined && has(key)) out[key] = fields[key];
  return out;
}

const asPerson = (fields) => {
  const out = {};
  // In the example's order: the name, what they do, the portrait, a line about them.
  if (fields.title !== undefined) out.title = fields.title;
  if (fields.role !== undefined) out.role = fields.role;
  if (fields.cover !== undefined) out.portrait = fields.cover;
  if (fields.bio !== undefined) out.bio = fields.bio;
  return out;
};

const words = (x) => ({ label: x.t('Book a visit', 'Termin buchen') });

/** The example's words about a person, which the kit's people keep when the team becomes them. */
const PERSON_WORDS = [
  { key: 'role', label: 'What they do', kind: 'text', max: 80, client_editable: true },
  { key: 'bio', label: 'A line about them', kind: 'textarea', max: 400, client_editable: true },
];

export const booking = {
  name: 'booking',
  kind: 'module',
  about: 'a booking kit of the platform\'s (--kind salon, clinic, hotel…), laid over the example: its price list, people and hours',
  present: (tree) => {
    const table = tableIn(tree.read(BLOCKS_TS) ?? '', 'MODULES');
    return !('refused' in table) && table.elements.some((one) => keyOf(one) === 'bookings');
  },

  add(tree, { site, x, others, did, options, engine }) {
    const kit = options.kit;
    if (!kit) throw Object.assign(new Error('add booking needs --kind <kind> (salon, clinic, hotel…), or --kit <file>'), { refusal: true });
    let source = tree.read(BLOCKS_TS);
    if (booking.present(tree)) {
      did.push('booking: already there — MODULES turns bookings on');
      return did;
    }
    const laid = kitIn3(kit, { locale: site.locale, lang: site.locale, ownListings: ownListingsOf(tree.root) });
    if (laid.refused) throw Object.assign(new Error(`the «${kit.kind}» kit cannot be put in contract 3's words: ${laid.refused}`), { refusal: true });
    const { services, resources } = laid.modules.bookings ?? {};
    const mark = MARK(kit.kind);
    const people = PEOPLE.has(kit.kind) && resources !== undefined;

    // A price list of another kind than the example's — a tariff, a seating, a
    // course — takes the collection over: the example's services give way,
    // their section, page and words with them, and the command says so.
    const priceType = laid.collections.find((one) => one.name === services)?.type;
    if (priceType !== undefined && priceType !== 'service' && engine.unitPresent(tree, engine.units.services)) {
      const gone = engine.removeUnit(tree, engine.units.services, { force: options.force === true });
      if (gone.faults.length > 0) {
        throw Object.assign(new Error(`the «${kit.kind}» kit's price list is «${priceType}», which takes the example's services' place — and these are not the example's:\n  ${gone.faults.join('\n  ')}\n(--force replaces them)`), { refusal: true });
      }
      // The hero's second button led to the example's price list: it leads to the kit's.
      const shownOn = String(laid.collections.find((one) => one.name === services)?.shown_on?.[0] ?? '/services').split('#')[0];
      const home = tree.json('jtk/pages/index.json');
      const hero = home?.blocks?.find((one) => one?.type === 'hero');
      if (hero?.more_href === '/services' && shownOn !== '/services') {
        hero.more_href = shownOn;
        tree.write('jtk/pages/index.json', json(home));
      }
      did.push(`the example's services give way to the kit's ${priceType}s — the price list is the kit's now (npx @jtakeit/astro add services lays the example's back once booking is removed)`);
      source = tree.read(BLOCKS_TS);
    }

    // ── the declaration ──────────────────────────────────────────────────
    const last = (table) => (one) => one === table.elements.at(-1);
    let blocksTable = refuse(tableIn(source, 'BLOCKS'));
    const serviceType = laid.collections.find((one) => one.name === services)?.type;
    const resourceType = laid.collections.find((one) => one.name === resources)?.type;
    const teamThere = refuse(tableIn(source, 'COLLECTIONS')).elements.some((one) => said(one, 'name') === 'team');
    for (const block of laid.blocks) {
      // The people keep what the example said of them: what they do, a line about them.
      if (people && teamThere && block.type === resourceType) {
        for (const own of PERSON_WORDS) if (!block.fields.some((one) => one.key === own.key)) block.fields.push(own);
      }
      const there = blocksTable.elements.find((one) => said(one, 'type') === block.type);
      if (there !== undefined && block.type === serviceType && !marked(source, there)) {
        const example = valueOf(there);
        if (example === undefined) throw Object.assign(new Error(`${BLOCKS_TS}: the ${block.type} type is not a literal — merge the kit's fields into it by hand`), { refusal: true });
        source = withoutElement(source, there, blocksTable);
        blocksTable = refuse(tableIn(source, 'BLOCKS'));
        const before = blocksTable.elements.findLast?.((one) => one.end <= there.from) ?? undefined;
        source = withElement(source, blocksTable, `${mark}\n// The example's service, with the kit's fields.\n${JSON.stringify(mergedService(example, block), null, 2)}`, (one) => before !== undefined && one.start === before.start);
        did.push(`${BLOCKS_TS}: the ${block.type} type takes the kit's fields, and keeps the example's`);
      } else if (there === undefined) {
        source = withElement(source, blocksTable, `${mark}\n${JSON.stringify(block, null, 2)}`, last(blocksTable));
        did.push(`${BLOCKS_TS}: BLOCKS gains the kit's ${block.type}`);
      }
      blocksTable = refuse(tableIn(source, 'BLOCKS'));
    }

    let collectionsTable = refuse(tableIn(source, 'COLLECTIONS'));
    for (const collection of laid.collections) {
      const there = collectionsTable.elements.find((one) => said(one, 'name') === collection.name);
      if (there !== undefined && said(there, 'type') === collection.type) continue;
      if (there !== undefined) {
        source = withoutElement(source, there, collectionsTable);
        collectionsTable = refuse(tableIn(source, 'COLLECTIONS'));
        did.push(`${BLOCKS_TS}: the example's ${collection.name} gives way to the kit's — its price list is «${collection.type}»`);
      }
      source = withElement(source, collectionsTable, `${mark}\n${JSON.stringify(collection, null, 2)}`, last(collectionsTable));
      did.push(`${BLOCKS_TS}: COLLECTIONS gains the kit's ${collection.name}`);
      collectionsTable = refuse(tableIn(source, 'COLLECTIONS'));
    }

    // The example's people become the kit's resources.
    const team = collectionsTable.elements.find((one) => said(one, 'name') === 'team');
    const converted = [];
    if (people && team !== undefined) {
      const declared = laid.blocks.find((one) => one.type === laid.collections.find((c) => c.name === resources)?.type)?.fields ?? [];
      for (const file of tree.under('jtk/entries/team')) {
        const doc = tree.json(file);
        const translation = /\.([A-Za-z]{2}(-[A-Za-z]{2})?)\.json$/.test(file);
        let fields = asResource(doc.fields ?? {}, declared);
        // A name the kit says is a language's (its title not `localized: false`)
        // is in the translation too, as the original's, so nothing starts untranslated.
        const title = declared.find((one) => one.key === 'title');
        if (translation && title !== undefined && title.localized !== false) {
          const original = tree.json(file.replace(/\.[A-Za-z]{2}(-[A-Za-z]{2})?\.json$/, '.json'));
          if (typeof original?.fields?.title === 'string') fields = { title: original.fields.title, ...fields };
        }
        const to = file.replace('jtk/entries/team/', `jtk/entries/${resources}/`);
        tree.write(to, json(translation ? { ...doc, fields } : { ...doc, collection: resources, fields }));
        tree.remove(file);
        if (!translation) converted.push(doc.slug);
      }
      source = withoutElement(source, team, collectionsTable);
      collectionsTable = refuse(tableIn(source, 'COLLECTIONS'));
      blocksTable = refuse(tableIn(source, 'BLOCKS'));
      const person = blocksTable.elements.find((one) => said(one, 'type') === 'person');
      if (person !== undefined) source = withoutElement(source, person, blocksTable);
      did.push(`jtk/entries/${resources}/: the example's team, ${converted.length} people, as the kit's ${resources} — team_list draws them`);
    }

    const modulesTable = refuse(tableIn(source, 'MODULES'));
    source = withElement(source, modulesTable, `${mark}\nbookings: ${JSON.stringify(laid.modules.bookings)}`, () => false);
    did.push(`${BLOCKS_TS}: MODULES turns bookings on — services: ${services}, resources: ${resources}`);
    tree.write(BLOCKS_TS, source);

    // ── the documents ────────────────────────────────────────────────────
    const shared = tree.json('jtk/shared.json');
    const hours = shared?.blocks?.find((one) => one?.type === 'hours');
    for (const [file, doc] of Object.entries(laid.write)) {
      const path = file.replace(/^\//, '');
      if (path === 'jtk/modules/bookings.json') {
        const settings = { ...doc.settings };
        if (Array.isArray(hours?.rows) && hours.rows.length > 0 && !Array.isArray(settings.hours)) settings.hours = hours.rows;
        tree.write(path, json({ ...doc, settings }));
        did.push(`${path}: the diary's settings${settings.hours ? ', the opening hours moved into them' : ''}`);
        continue;
      }
      if (tree.exists(path)) continue;
      // The kit's own sample entries where the example has its own in that collection.
      const collection = /^jtk\/entries\/([^/]+)\//.exec(path)?.[1];
      if (collection !== undefined && tree.under(`jtk/entries/${collection}`).length > 0) continue;
      tree.write(path, json(doc));
      did.push(`${path}: the kit's`);
    }
    if (hours !== undefined && Array.isArray(hours.rows) && hours.rows.length > 0) {
      delete hours.rows;
      tree.write('jtk/shared.json', json(shared));
      did.push('jtk/shared.json: the hours are the diary\'s now — the note stays');
    }

    // ── the header's button ──────────────────────────────────────────────
    const header = shared?.blocks?.find((one) => one?.type === 'header');
    const page = laid.write['/jtk/modules/bookings.json']?.settings?.page ?? '/services';
    if (header !== undefined) {
      header.cta_label = words(x).label;
      header.cta_link = page;
      tree.write('jtk/shared.json', json(shared));
      for (const { locale, x: y } of others) {
        const file = `jtk/shared.${locale}.json`;
        const translation = tree.json(file) ?? { locale, blocks: [] };
        let over = translation.blocks.find((one) => one?._key === header._key);
        if (over === undefined) translation.blocks.push((over = { _key: header._key }));
        over.cta_label = words(y).label;
        tree.write(file, json(translation));
      }
      did.push(`jtk/shared.json: the header's button leads to ${page}`);
    }
    did.questions = [...(kit.ask ?? []), ...laid.questions.map((one) => one.ask)];
    return did;
  },

  remove(tree, { site, did, kept, faults, force, units, wordsIn: wi }) {
    let source = tree.read(BLOCKS_TS) ?? '';
    let modulesTable = refuse(tableIn(source, 'MODULES'));
    const element = modulesTable.elements.find((one) => keyOf(one) === 'bookings');
    if (element === undefined) return { did, kept, faults };
    const roles = valueOf({ text: `{${element.text}}` })?.bookings ?? {};
    const settingsFile = 'jtk/modules/bookings.json';
    const settings = tree.json(settingsFile)?.settings ?? {};

    // The kit's people back into the example's team, where the team's section is on the site.
    const teamOn = /^\s*team_list\s*:/m.test(tree.read('src/components/sections/index.ts') ?? '');
    const resources = roles.resources;
    if (teamOn && resources && PEOPLE.has(String(settings.kind ?? settings.kit ?? ''))) {
      for (const file of tree.under(`jtk/entries/${resources}`)) {
        const doc = tree.json(file);
        const translation = /\.([A-Za-z]{2}(-[A-Za-z]{2})?)\.json$/.test(file);
        // A person's name is the same in every language: never in a translation.
        const { title: _name, ...words } = asPerson(doc.fields ?? {});
        void _name;
        tree.write(file.replace(`jtk/entries/${resources}/`, 'jtk/entries/team/'), json(translation ? { ...doc, fields: words } : { ...doc, collection: 'team', fields: asPerson(doc.fields ?? {}) }));
        tree.remove(file);
      }
      did.push(`jtk/entries/team/: the kit's ${resources} back as the example's team`);
      const team = units.team;
      let blocksTable = refuse(tableIn(source, 'BLOCKS'));
      if (!blocksTable.elements.some((one) => said(one, 'type') === 'person')) {
        const listed = blocksTable.elements.find((one) => said(one, 'type') === 'team_list');
        source = withElement(source, blocksTable, team.types.find((one) => one.type === 'person').source, (one) => listed !== undefined && one.start === blocksTable.elements[blocksTable.elements.indexOf(listed) - 1]?.start);
      }
      const collectionsTable = refuse(tableIn(source, 'COLLECTIONS'));
      if (!collectionsTable.elements.some((one) => said(one, 'name') === 'team')) {
        source = withElement(source, collectionsTable, team.collections[0].source, (one) => said(one, 'name') === 'services');
      }
      void blocksTable;
    }

    // Every element the kit added, and the example's service as it was.
    for (const name of ['BLOCKS', 'COLLECTIONS']) {
      for (;;) {
        const table = refuse(tableIn(source, name));
        const one = table.elements.find((e) => marked(source, e));
        if (one === undefined) break;
        const value = valueOf(one);
        source = withoutElement(source, one, table);
        if (name === 'BLOCKS' && value?.type === 'service' && units.services) {
          const restored = refuse(tableIn(source, 'BLOCKS'));
          const before = restored.elements.findLast((e) => e.end <= one.from);
          source = withElement(source, restored, units.services.types.find((t) => t.type === 'service').source, (e) => before !== undefined && e.start === before.start);
          const own = new Set(valueOf({ text: uncommented(units.services.types.find((t) => t.type === 'service').source).trim() }).fields.map((f) => f.key));
          for (const file of tree.under(`jtk/entries/${roles.services}`)) {
            const doc = tree.json(file);
            const extra = Object.keys(doc?.fields ?? {}).filter((key) => !own.has(key));
            if (extra.length > 0) {
              const said_ = extra.filter((key) => doc.fields[key] !== undefined && doc.fields[key] !== '' && !(Array.isArray(doc.fields[key]) && doc.fields[key].length === 0));
              if (said_.length > 0 && !force) faults.push(`${file} · fields.${said_.join(', fields.')} — the kit's fields, filled; the example's service has none (--force drops them)`);
              for (const key of extra) delete doc.fields[key];
              tree.write(file, json(doc));
            }
          }
          did.push(`${BLOCKS_TS}: the ${value.type} type as the example had it`);
        } else did.push(`${BLOCKS_TS}: ${name} loses the kit's ${value?.type ?? value?.name ?? 'element'}`);
        if (name === 'COLLECTIONS' && value?.name && value.name !== roles.services && value.name !== 'team') {
          for (const file of tree.under(`jtk/entries/${value.name}`)) {
            if (!force) faults.push(`${file} — an entry of the kit's ${value.name} (--force deletes it)`);
            tree.remove(file);
          }
        }
      }
    }
    modulesTable = refuse(tableIn(source, 'MODULES'));
    const modules = modulesTable.elements.find((one) => keyOf(one) === 'bookings');
    source = withoutElement(source, modules, modulesTable);
    did.push(`${BLOCKS_TS}: MODULES turns bookings off`);
    tree.write(BLOCKS_TS, source);

    // The hours back into the shared text, the settings gone.
    const shared = tree.json('jtk/shared.json');
    const hours = shared?.blocks?.find((one) => one?.type === 'hours');
    if (hours !== undefined && Array.isArray(settings.hours) && settings.hours.length > 0 && !Array.isArray(hours.rows)) {
      const rows = settings.hours;
      const { note, ...rest } = hours;
      Object.keys(hours).forEach((key) => delete hours[key]);
      Object.assign(hours, rest, { rows }, note === undefined ? {} : { note });
      did.push('jtk/shared.json: the opening hours back in the shared text');
    }
    tree.remove(settingsFile);
    did.push(`${settingsFile}: deleted`);

    // The header's button, back to the example's where it is still the kit's.
    const header = shared?.blocks?.find((one) => one?.type === 'header');
    const lang = site.lang;
    if (header !== undefined && header.cta_label === words(wi(lang, site.name)).label) {
      header.cta_label = wi(lang, site.name).t('Get in touch', 'Kontakt aufnehmen');
      header.cta_link = '/#contact';
      for (const file of tree.under('jtk').filter((one) => /^jtk\/shared\.[A-Za-z-]+\.json$/.test(one))) {
        const translation = tree.json(file);
        const over = translation?.blocks?.find((one) => one?._key === header._key);
        if (over?.cta_label === undefined) continue;
        const y = wi(String(translation.locale).toLowerCase().startsWith('de') ? 'de' : 'en', site.name);
        over.cta_label = y.t('Get in touch', 'Kontakt aufnehmen');
        tree.write(file, json(translation));
      }
      did.push('jtk/shared.json: the header\'s button leads to /#contact again');
    }
    if (shared !== undefined) tree.write('jtk/shared.json', json(shared));
    return { did, kept, faults };
  },
};
