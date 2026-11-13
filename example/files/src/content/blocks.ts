/**
 * What the admin may edit on this site.
 *
 * ── an example, in Brumy's design ───────────────────────────────────────────
 *
 * `jtk create` laid this site out as an example: a home page of sections, a
 * price list at /services, the privacy page and an imprint, a header and a
 * footer — in the design system of Brumy (brumy.ch), the company that makes
 * jtakeit, with example words and photographs, every word of it the owner's
 * to change in the panel. Keep what the brief names, adapt the look
 * (src/styles/tokens.css), and take out the rest:
 *
 *   npx @jtakeit/astro units               what this site has, what can be added
 *   npx @jtakeit/astro remove testimonials  a section, its block type, its words
 *   npx @jtakeit/astro add blog             a module the brief asked for
 *
 * Each section is a unit: its block types below, its component in
 * src/components/sections/ and its line in that folder's `SECTIONS`, its words
 * in jtk/pages/, its entries in jtk/entries/. The commands edit the tables of
 * this file in place, by a block's `type` and a collection's `name` — keep
 * them literals, and everything else here is yours to change.
 *
 * ── the contract, before the essay ──────────────────────────────────────────
 *
 *   CONTRACT        3 — this file is contract 3's (jtakeit-core wiki/98), in its words
 *   BLOCKS          every block type a page renders: type, v: 1, label, fields
 *   fields          key, label, kind; client_editable: true for what the owner edits,
 *                   and every such field is drawn with its annotation — which the
 *                   kit's door writes, `{...hero.at('title')}`, never a literal
 *   SHARED          the block types the shared text holds (jtk/shared.json): here
 *                   `contacts`, the business's own facts, each field with its role
 *   COLLECTIONS     name, label, type, route — { detail, listing?, per_page? }, or
 *                   'none' with shown_on — for the entries the owner creates
 *   MODULES         { bookings: { services: '<collection>', resources: '<collection>' } }
 *   PAGE_SEO        the title and description of every page
 *
 *   `npx @jtakeit/astro schema` writes jtk/schema.json from this file, gives
 *   every page and entry its `id` and every block, row and picture its `_key`
 *   where a file lacks one, and seeds jtk/modules/bookings.json when MODULES
 *   turns bookings on. `--judge` asks the platform's own judge, and
 *   `validate_schema` judges the tree — sent as text, or by site and ref once
 *   it is pushed. The platform's reference/contract.md has every rule in one
 *   line each, with the code that refuses it. The types are
 *   `@jtakeit/kit/schema`'s, imported below.
 *
 *   The pages render from jtk/schema.json too, not from this file: the kit's
 *   door (src/lib/site.ts) reads the schema the platform reads. Under
 *   `astro dev` the schema is written again on every save of this file
 *   (jtakeit-meta.mjs), and a change that does not check is said in the dev
 *   server's log while the page keeps the last one that did. Before a commit,
 *   run the tool: a build reads the committed file and writes nothing.
 *
 * ── where the values are ────────────────────────────────────────────────────
 *
 *   jtk/pages/<path>.json         a page — `/` is index.json — with its `id`,
 *                                 `path`, `name` and `blocks`
 *   jtk/entries/<collection>/<slug>.json
 *                                 an entry: its `id`, `slug`, `visible`, its own
 *                                 values under `fields`, its body under `blocks`
 *   jtk/shared.json               the text on every page and in none (SHARED)
 *   jtk/modules/bookings.json     the diary's settings, `{ v, settings }`
 *   jtk/site.json                 the platform's, to the site: the currency, given
 *                                 once to `create_site`; nothing here writes it
 *
 * Every page and entry is known by its `id`, every block, row and picture by
 * its `_key` — never by where it sits — so an annotation names a place by key:
 * `blocks[hero0001].title`, an entry's own `title`, `entry:<id>:title` on a page
 * that lists it, `shared:blocks[contacts].phone`. Empty is absent: a value
 * nobody has written is left out of the file, not written as "".
 *
 * ── the one file that decides whether a bespoke site is editable ────────────
 *
 * The studio's admin edits a site by tapping the text on it. It can do that for
 * any site, however that site is built, because it reads a *schema* — this
 * file, emitted to `jtk/schema.json` — rather than knowing anything about these
 * components. That is the whole reason a site built here can look like nothing
 * else and still be handed to its owner.
 *
 * So the division is:
 *
 *   src/          the design. Yours, or the agent's. Anything at all.
 *   jtk/          the values. The owner's, edited in the admin.
 *   this file     which values there are, and what each one is
 *
 * **Declare a field here and the owner can edit it. Leave it out and it is part
 * of the design.** Both are legitimate — a headline is content, a section's
 * layout is not — and that decision is yours to make per field rather than
 * something a framework makes for you.
 *
 * `jtk schema` writes the JSON and then checks it against the built HTML: every
 * field the owner edits has to appear on the page carrying its annotation, and
 * every annotation on the page has to name a place declared here. The two
 * cannot drift, which is what stops an owner tapping a heading that never opens.
 *
 * ── a label is the words ────────────────────────────────────────────────────
 *
 * The words themselves, in the site's language, and the admin shows them as
 * written. There are no locale keys anywhere: our blocks and yours are drawn by
 * one code path. A label may still be written per language —
 *
 *     label: 'Заголовок'
 *     label: { uk: 'Заголовок', en: 'Heading' }
 *
 * — and the admin shows the one in the site's language.
 *
 * ── the labels below are English, and that is the scaffold speaking ─────────
 *
 * They arrive in English whatever `--locale` the site was scaffolded with,
 * because they are a **starting point rather than an answer**: the design pass
 * rewrites this file for the business it is building, and it writes the labels
 * in the language the owner will read them in.
 *
 * They used to arrive in Ukrainian, which was invisible while every site was
 * Ukrainian and wrong the first time one was not — a Swiss client opening the
 * panel found their blocks labelled in a language they do not read, and
 * nothing in the build said so. English is not a translation, it is an
 * admission that the scaffold does not know yet.
 *
 * The strings a visitor sees are the other way round: those are in
 * `src/copy/`, they are interface rather than seed, nothing rewrites them, and
 * `jtk create` fills them in per locale.
 */
import type { Block, Collection, Field, Modules, Text } from '@jtakeit/kit/schema';

/** This declaration is contract 3's: `jtk schema` writes it, `jtk catalogue` writes nothing for it. */
export const CONTRACT = 3;

/**
 * This template draws a page the same way from a draft at request time as
 * from its files at build time (src/live/, src/lib/site.ts), so the panel may
 * show the owner a saved field in the preview at once, rather than after a
 * build. `jtk schema` writes it as `render: "live"`. The platform checks the
 * word at every build — it renders a few pages live and compares them with
 * the built ones — and shows the build where they differ, saying why; what is
 * published is always the build. Take the line out if the site's own pages
 * read content in a way a server cannot (docs/live.md).
 */
export const RENDER = 'live';

export type { Text };

/**
 * A `Text` as one string, for the places that can only take one.
 *
 * A feed's `<title>`, an attribute, anything written into markup: those cannot
 * hold a map of languages, and handing them one produced `[object Object]` in
 * the output and a type error at the call site. `words()` is where that choice
 * is made once. (A page reads the schema's words through the door,
 * `site.words(label, lang)`; this is for this file's own tables.)
 *
 * The order is the site's language first, then the site's other languages in
 * the order they are declared, then whatever the map happens to hold.
 */
export function words(text: Text | undefined, locale: string = LOCALE): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;

  const found = text[locale];
  if (found !== undefined && found !== '') return found;

  // A regional locale reads its language's words: `en-NL` is English, and
  // the labels are written by language. Without this step `en-NL` fell
  // through to the first word in the map — Ukrainian — and an English site's
  // journal said «Блог» and «Дата» (Schorem, 15 October 2026).
  const language = locale.split('-')[0];
  const plain = text[language];
  if (plain !== undefined && plain !== '') return plain;

  for (const other of LOCALES) {
    const next = text[other] ?? text[other.split('-')[0]];
    if (next !== undefined && next !== '') return next;
  }
  // English before an arbitrary one: it is the language every label has.
  if (text.en) return text.en;
  return Object.values(text).find((one) => one !== '') ?? '';
}

/**
 * This site's blocks.
 *
 * ── the example's, and then the business's ──────────────────────────────────
 *
 * The example's sections each declare their type here — `hero`, `values`,
 * `services_list`, `gallery`, `team_list`, `testimonials`, `questions` — after
 * `text`, in the home page's order; `cta_banner` (the form) and `imprint` are
 * the site's own and stay. A landing page cannot do without three of them:
 *
 *   hero        what this is, for whom, and one action. Without it a visitor
 *               arriving from a search does not know what they are looking at.
 *   cta_banner  the form. A page that sells and cannot be answered is a leaflet.
 *   questions   the questions block. It is what a hesitating visitor reads last
 *               and what an assistant lifts a paragraph out of — see
 *               `docs/pages.md` of @jtakeit/astro. It is the page's whole generative weight.
 *
 * **What the business adds is chosen, and its name is this business's own.**
 * Not `features`, `about`, `benefits`: a tattooist's page had `plates`,
 * `letter`, `conviction`, `process` and `artist`, and a page whose block names
 * could be pasted into any other site is a page that will look like it.
 *
 * The type name is permanent once content exists under it, so it is worth the
 * minute it takes to name it after what it *is* on this page.
 *
 * And a block is a job, not a band. An angle can be carried by a photograph
 * with three words on it, one sentence set across the full width, or a
 * quotation — the shape is `docs/shapes.md` of @jtakeit/astro, and
 * nothing here asks for a heading, a lead and a grid of three.
 *
 * ── what a field says, in contract 3's words ────────────────────────────────
 *
 *   client_editable  true for what the owner edits; absent is false, everywhere.
 *                    A headline is theirs; a button's destination usually is not.
 *   min, max         absent is unbounded, and 0 is a bound. Characters on text,
 *                    the value on a number, rows on a list, pictures on a gallery;
 *                    a link, a date and one picture take none.
 *   media            one picture is `{ src, alt?, focus?, poster? }`: its
 *                    description is its own `alt`, never a field beside it.
 *                    `multiple: true` is a gallery, `[{ _key, src, alt }]`, the
 *                    array the page; `accept: 'video'` a short silent loop
 *                    (docs/photos.md); `ratio: '3:2'` the frame the design shows
 *                    it in, and the owner's `focus` says what survives the crop.
 *   list             rows of the fields in `of`, each row with its `_key`.
 *   money            `{ minor: 4500 }`: whole minor units of the site's one
 *                    currency, which is never part of the value.
 *   duration         whole minutes: 90 is an hour and a half. `time_of_day` is
 *                    minutes from midnight: 540 is nine in the morning.
 *   select           `options: [{ value, label }]` — the value is what a
 *                    document holds, and renaming it is a migration.
 *   ref              `ref: { to: ['services'], many?: true }`: an entry's id,
 *                    or several.
 *   no_tap_target    a value never drawn as its own element — an attribute, a
 *                    message a script writes later; edited in the panel, and
 *                    `beside` names the field the owner taps to reach it.
 *   views            the arrangements a block with one gallery may be shown
 *                    in: the designer writes the menu, the owner orders from it.
 *   collects         'enquiry' on the block whose form keeps what a visitor
 *                    types; `asks` are its questions beyond name, contact and
 *                    message, `photos` how many pictures it takes, 1 to 7.
 *                    The words a visitor reads over a question are the
 *                    block's `<key>_label` field, content like the rest.
 */
export const BLOCKS: Block[] = [
  {
    /*
     * A run of prose inside a post, and the reason a post is a sequence.
     *
     * The first run is the post's own `body` field, because that is what the
     * feed and the search result quote; every run after it is one of these,
     * in the entry's `blocks`, between whatever else the collection's
     * `blocks` allows — a gallery between the fourth paragraph and the fifth.
     *
     * Prose only. A picture in a post is a block, chosen from the menu the
     * blocks below declare, and not an `![]()` written into the text: two ways
     * to put a photograph in a page is two sets of rules for how it may look,
     * and only one of them is something this repository decided.
     *
     * Every collection that declares `blocks` must name this type in it, or
     * the writing cannot be broken by anything at all.
     */
    type: 'text',
    v: 1,
    label: 'Text',
    fields: [{ key: 'body', label: 'Text', kind: 'markdown', max: 40000, client_editable: true }],
  },
  {
    type: 'cta_banner',
    v: 1,
    label: 'Call to action and form',
    collects: 'enquiry',
    /*
     * One question of the site's own, as a starting point. The scaffold's
     * form asks what the message is about; a salon asks for a service, a
     * restaurant for a number of guests. Rewrite it for the business, or
     * take it out — a field the owner never reads costs a visitor for nothing.
     *
     * Its `label` is what the owner's inbox, the notification and the export
     * name the answer by, so it is in the site's language from the first
     * commit (`jtk create` writes it), not in the English the panel's labels
     * arrive in. What a visitor reads above the control is content, as every
     * other word on the page: the block's `topic_label` below — `<key>_label`
     * for each question — which the owner taps, changes and translates
     * (LeadForm.astro). An ask's label written once in the declaration stayed
     * German on the English page and could not be tapped (the owner's
     * two-language site, 12 November 2026). An ask with no `<key>_label` is
     * drawn under its `label`, fixed.
     */
    asks: [{ key: 'topic', label: '{{UI_ASK_TOPIC}}', kind: 'text', max: 120 }],
    fields: [
      { key: 'title', label: 'Heading', kind: 'text', required: true, max: 80, client_editable: true },
      { key: 'lead', label: 'Subheading', kind: 'textarea', max: 240, client_editable: true },
      { key: 'cta_label', label: 'Button text', kind: 'text', max: 40, client_editable: true },
      { key: 'cta_href', label: 'Button link', kind: 'url', no_tap_target: true, beside: 'cta_label' },
      { key: 'form', label: 'Show the form', kind: 'bool', no_tap_target: true },

      /*
       * What the form asks for, in the business's own words.
       *
       * These are not interface. "Розкажіть про ідею, де на тілі і приблизно
       * який розмір" is a tattooist deciding what she needs to know before she
       * can answer, and the next business needs something else entirely — a
       * date, a number of guests, a car's registration. A visitor reads them
       * and the owner is the only person who knows what they should say.
       *
       * What stays out of the schema is the machinery around them: "Sending…",
       * "Sent.", the message a browser shows for an empty field. There is
       * nothing an owner wants to say in those, and the server has its own copy
       * of the refusals anyway.
       *
       * `jtk create` writes them, and the button's `cta_label`, in the site's
       * language in jtk/pages/index.json, and in each other language's
       * translation beside it; `npx @jtakeit/astro copy <locale>` does the
       * same for a language added later. One for each question in `asks`,
       * named `<key>_label`, is the words over its control.
       */
      { key: 'name_label', label: 'Label for the “name” field', kind: 'text', max: 60, client_editable: true },
      { key: 'contact_label', label: 'Label for the “how to reach you” field', kind: 'text', max: 90, client_editable: true },
      { key: 'message_label', label: 'Label for the “message” field', kind: 'text', max: 120, client_editable: true },
      { key: 'required_note', label: 'Line under the form', kind: 'text', max: 140, client_editable: true },
      { key: 'topic_label', label: 'Label for the “topic” field', kind: 'text', max: 120, client_editable: true },
    ],
  },
  {
    /*
     * The imprint's own words (jtk/pages/imprint.json): what contract 3 holds
     * no field of — the register entry, the VAT number, who is responsible.
     * The name, the address and how to reach the business are the contacts',
     * drawn above it.
     */
    type: 'imprint',
    v: 1,
    label: 'Imprint',
    fields: [
      { key: 'title', label: 'Heading', kind: 'text', required: true, max: 80, client_editable: true },
      { key: 'body', label: 'Register, VAT number, responsible person', kind: 'textarea', max: 2000, client_editable: true },
    ],
  },
];

/**
 * The business's own facts: shared text, on every page and in none, which the
 * layout reads by `role` — the structured data search engines and assistants
 * are given, the head, llms.txt — and the owner corrects in the panel like any
 * other text. One field a role; the roles are a closed list (`@jtakeit/kit/schema`,
 * `Role`): name, phone, email, street, postal_code, city, region, country, maps,
 * social, price_range, business_type, hours. Add the ones this business has —
 * the street and the postcode, the map, its profiles — and draw each where the
 * page says it (`site.facts(locale)`), or as `no_tap_target` where it is only
 * told. The name, the street, the postcode, the schema.org type and the price
 * range are the same in every language: say `localized: false` on each, or
 * every other language counts them as words to translate. The city stays per
 * language («Zürich», «Zurich»). The currency is not one of them: it is the site's setting, given once
 * to `create_site`.
 */
export const CONTACTS: Block = {
  type: 'contacts',
  v: 1,
  label: {
    en: 'Contacts',
    de: 'Kontakt',
    fr: 'Contact',
    it: 'Contatti',
    es: 'Contacto',
    pt: 'Contactos',
    pl: 'Kontakt',
    uk: 'Контакти',
    ru: 'Контакты',
  },
  fields: [
    {
      key: 'name',
      label: 'Name',
      kind: 'text',
      max: 80,
      client_editable: true,
      no_tap_target: true,
      role: 'name',
      hint: 'The business\'s name, as search engines and assistants are told it.',
      // The same in every language: nobody translates the business's name.
      localized: false,
    },
    {
      key: 'city',
      label: 'City',
      kind: 'text',
      max: 60,
      client_editable: true,
      no_tap_target: true,
      role: 'city',
      hint: 'The town of that address.',
    },
    {
      // Tapped where the footer, the form's card and the imprint draw it; the
      // map's link is edited beside it.
      key: 'street',
      label: 'Street',
      kind: 'text',
      max: 80,
      client_editable: true,
      role: 'street',
      hint: 'Street and number, as a letter is addressed.',
      localized: false,
    },
    {
      key: 'postal_code',
      label: 'Postcode',
      kind: 'text',
      max: 12,
      client_editable: true,
      no_tap_target: true,
      role: 'postal_code',
      hint: 'The postcode of that address.',
      localized: false,
    },
    {
      key: 'country',
      label: 'Country',
      kind: 'text',
      max: 2,
      client_editable: true,
      no_tap_target: true,
      role: 'country',
      hint: 'Two letters: CH, DE, AT.',
      localized: false,
    },
    {
      key: 'phone',
      label: 'Phone',
      kind: 'tel',
      client_editable: true,
      no_tap_target: true,
      role: 'phone',
      hint: 'The number to call, written as it is dialled; the site shows it formatted.',
    },
    {
      key: 'email',
      label: 'Email',
      kind: 'email',
      client_editable: true,
      no_tap_target: true,
      role: 'email',
      hint: 'Where a visitor writes to.',
    },
    {
      key: 'maps',
      label: 'Map link',
      kind: 'url',
      client_editable: true,
      no_tap_target: true,
      beside: 'street',
      role: 'maps',
      hint: 'A link to the address on a map, for «Directions».',
      localized: false,
    },
    {
      key: 'social',
      label: 'Profiles',
      kind: 'list',
      max: 6,
      client_editable: true,
      no_tap_target: true,
      role: 'social',
      hint: 'The business elsewhere — Instagram, a booking page: a link and the words the footer says for it.',
      of: [
        { key: 'label', label: 'Words', kind: 'text', max: 30, client_editable: true, hint: 'Instagram — empty: the link\'s own name.' },
        { key: 'url', label: 'Link', kind: 'url', required: true, client_editable: true, no_tap_target: true, beside: 'label', localized: false },
      ],
    },
  ],
};
BLOCKS.push(CONTACTS);

/**
 * The header on every page (src/components/site/Header.astro): the
 * navigation, the button, and a logo where the business has one — its name
 * from the contacts where it has not. A link is an address on this site
 * (`/services`, `/#team`), written in each page's language by the header.
 */
export const HEADER: Block = {
  type: 'header',
  v: 1,
  label: 'Header',
  fields: [
    { key: 'logo', label: 'Logo', kind: 'media', client_editable: true, hint: 'Empty: the business\'s name, as the contacts say it.' },
    {
      key: 'nav',
      label: 'Navigation',
      kind: 'list',
      max: 7,
      of: [
        { key: 'label', label: 'Words', kind: 'text', required: true, max: 30, client_editable: true },
        { key: 'link', label: 'Link', kind: 'url', required: true, client_editable: true, no_tap_target: true, beside: 'label', localized: false },
      ],
    },
    { key: 'cta_label', label: 'Button text', kind: 'text', max: 30, client_editable: true },
    { key: 'cta_link', label: 'Button link', kind: 'url', client_editable: true, no_tap_target: true, beside: 'cta_label', localized: false },
  ],
};
BLOCKS.push(HEADER);

/**
 * When the business is open: a row a day it opens — two rows for a day with a
 * break — in minutes from midnight, the shape the diary's own hours have; a
 * day with no row is closed. Drawn in the footer and beside the form.
 * Where the site takes bookings, the diary's hours are the hours
 * (`jtk add booking` moves these rows into jtk/modules/bookings.json).
 */
export const HOURS: Block = {
  type: 'hours',
  v: 1,
  label: 'Opening hours',
  fields: [
    {
      key: 'rows',
      label: 'Hours',
      kind: 'list',
      max: 14,
      client_editable: true,
      no_tap_target: true,
      hint: 'A row a day it opens, two for a day with a break; a day with no row is closed.',
      of: [
        {
          key: 'day',
          label: 'Day',
          kind: 'select',
          required: true,
          client_editable: true,
          no_tap_target: true,
          options: [
            { value: 'monday', label: { en: 'Monday', de: 'Montag' } },
            { value: 'tuesday', label: { en: 'Tuesday', de: 'Dienstag' } },
            { value: 'wednesday', label: { en: 'Wednesday', de: 'Mittwoch' } },
            { value: 'thursday', label: { en: 'Thursday', de: 'Donnerstag' } },
            { value: 'friday', label: { en: 'Friday', de: 'Freitag' } },
            { value: 'saturday', label: { en: 'Saturday', de: 'Samstag' } },
            { value: 'sunday', label: { en: 'Sunday', de: 'Sonntag' } },
          ],
        },
        { key: 'opens', label: 'Opens', kind: 'time_of_day', required: true, client_editable: true, no_tap_target: true },
        { key: 'closes', label: 'Closes', kind: 'time_of_day', required: true, client_editable: true, no_tap_target: true },
      ],
    },
    { key: 'note', label: 'A line under them', kind: 'text', max: 120, client_editable: true, hint: 'Sundays by appointment.' },
  ],
};
BLOCKS.push(HOURS);

/** The footer's own words (src/components/site/Footer.astro); the rest of it is the contacts' and the hours'. */
export const FOOTER: Block = {
  type: 'footer',
  v: 1,
  label: 'Footer',
  fields: [{ key: 'tagline', label: 'A line beside the name', kind: 'text', max: 90, client_editable: true }],
};
BLOCKS.push(FOOTER);

/** The block types the shared text holds — jtk/shared.json — on every page, in no page. */
export const SHARED: string[] = ['contacts', 'header', 'hours', 'footer'];

/**
 * The sets of entries the owner may create.
 *
 * ── the one place the admin creates something the repository did not ────────
 *
 * Everywhere else, which pages a site has is this repository's to say: they
 * arrive by import, and there is no "add a page" in the admin, because a page
 * is a file somebody wrote. A collection moves exactly one thing across that
 * line, and names it:
 *
 *   this repository declares the shape    a route, a block type, an order
 *   the admin creates the entries         and nothing else
 *
 * So there is no "blog feature" on the platform. A blog is one collection whose
 * entries live at `/blog/{slug}` and are ordered by date; a portfolio, a price
 * list, a menu or a vacancy board are the same mechanism with different words,
 * and adding one is this array: the scaffold has the routes that render it.
 *
 * ── where an entry is reached ───────────────────────────────────────────────
 *
 *   route: { detail: '/works/{slug}' }      a page per entry, drawn by
 *                                            src/pages/[...entry].astro
 *     listing: '/works', per_page: 12       and a listing at that address,
 *                                            src/pages/[...listing].astro, paged
 *                                            at /works/page/2 — or a page of
 *                                            yours at the address, which takes
 *                                            it over
 *   route: 'none', shown_on: ['/services#services-{slug}']
 *                                            no page of their own: rows a page
 *                                            lists and the diary reads — a price
 *                                            list, the masters of a workshop.
 *                                            The page `shown_on` names must
 *                                            exist (jtk/pages/services.json) and
 *                                            draw the anchor.
 *
 * `jtk schema` checks the declaration; the build checks the rendering, the
 * same way it checks every other annotated field.
 *
 * ── the reserved keys ───────────────────────────────────────────────────────
 *
 * An entry's block type may declare whatever this business needs, but five keys
 * are spoken for, because the listing, the feed, the sitemap, the card a
 * messenger draws and the admin's own list all read them by name:
 *
 *   title    text, and required. Everything above needs one.
 *   date     date. Required if the collection is ordered by it.
 *   excerpt  textarea. The sentence under the title in the listing.
 *   cover    media, one picture. The card, the listing, og:image.
 *   body     markdown. The entry itself.
 *
 * Leave any of them out where they make no sense — a set of works has no
 * excerpt. What you may not do is give one of those names to something else.
 *
 * An entry is `jtk/entries/<collection>/<slug>.json`: its own values under
 * `fields` — annotated as themselves, `title`, on its own page, and as
 * `entry:<id>:title` on a page that lists it — and its body, the blocks the
 * collection's `blocks` allows, under `blocks`. `order` is 'manual' — every
 * entry then carries a `rank` — or `{ by, desc? }`, a required date, number or
 * line of text; absent is by hand.
 *
 * ── only when it was asked for ──────────────────────────────────────────────
 *
 * **The example declares two, `services` and `team`** — the price list and the
 * people, each a section of the home page — and the brief decides which stay
 * (`npx @jtakeit/astro remove team`). Beyond them, do not add one because a
 * site could have one; a blog is added on a sentence in the brief
 * (`npx @jtakeit/astro add blog`).
 *
 * A collection is a standing weekly obligation on the person who owns the site.
 * An empty blog on a live page says the business stopped caring in March, and
 * three posts from a year ago say it louder; a page that never mentions one
 * says nothing at all. The bar is a sentence in the brief that names the
 * thing — not a vertical it would suit, not room in the design, not «for
 * later».
 *
 * A site that declares none shows no trace of them in the admin.
 */
export const COLLECTIONS: Collection[] = [];

/**
 * A blog, ready to turn on — not on: a blog is a commitment somebody asked
 * for (docs/collections.md), and a site that never posts says so louder than
 * one without a blog.
 *
 * On is two lines at the foot of this file, which `npx @jtakeit/astro add
 * blog` writes, with two example posts and a section of the latest:
 *
 *   BLOCKS.push(BLOG_POST);
 *   COLLECTIONS.push(BLOG_COLLECTION);
 *
 * Then the posts are `jtk/entries/blog/<slug>.json`, the listing is
 * `src/pages/[...lang]/blog/index.astro`, a post's page is `[...entry].astro`,
 * the feed `/blog/rss.xml`. The five reserved keys of an entry are all here;
 * `date` and `excerpt` are drawn on the listing and are no tap targets.
 */
export const BLOG_POST: Block = {
  type: 'post',
  v: 1,
  label: { uk: 'Допис', en: 'Post', de: 'Beitrag', ru: 'Запись', es: 'Entrada', it: 'Articolo', pt: 'Artigo', fr: 'Article' },
  fields: [
    {
      key: 'title',
      label: { uk: 'Заголовок', en: 'Title', de: 'Titel', ru: 'Заголовок', es: 'Título', it: 'Titolo', pt: 'Título', fr: 'Titre' },
      kind: 'text',
      required: true,
      max: 90,
      client_editable: true,
      seo_sensitive: true,
    },
    {
      key: 'date',
      label: { uk: 'Дата', en: 'Date', de: 'Datum', ru: 'Дата', es: 'Fecha', it: 'Data', pt: 'Data', fr: 'Date' },
      kind: 'date',
      required: true,
      client_editable: true,
      no_tap_target: true,
    },
    {
      key: 'excerpt',
      label: { uk: 'Анонс', en: 'Excerpt', de: 'Anriss', ru: 'Анонс', es: 'Extracto', it: 'Estratto', pt: 'Resumo', fr: 'Chapeau' },
      kind: 'textarea',
      max: 200,
      client_editable: true,
      no_tap_target: true,
    },
    {
      key: 'cover',
      label: { uk: 'Обкладинка', en: 'Cover', de: 'Titelbild', ru: 'Обложка', es: 'Portada', it: 'Copertina', pt: 'Capa', fr: 'Couverture' },
      kind: 'media',
      client_editable: true,
    },
    {
      key: 'body',
      label: { uk: 'Текст допису', en: 'Text', de: 'Text', ru: 'Текст записи', es: 'Texto', it: 'Testo', pt: 'Texto', fr: 'Texte' },
      kind: 'markdown',
      max: 40000,
      client_editable: true,
    },
  ],
};

export const BLOG_COLLECTION: Collection = {
  name: 'blog',
  label: { uk: 'Блог', en: 'Blog', de: 'Blog', ru: 'Блог', es: 'Blog', it: 'Blog', pt: 'Blog', fr: 'Blog' },
  one: { uk: 'допис', en: 'post', de: 'Beitrag', ru: 'запись', es: 'entrada', it: 'articolo', pt: 'artigo', fr: 'article' },
  icon: 'lucide:newspaper',
  type: 'post',
  route: { detail: '/blog/{slug}', listing: '/blog', per_page: 10 },
  order: { by: 'date', desc: true },
  blocks: ['text'],
};

/**
 * The domain modules this site turns on, and what each is pointed at:
 *
 *   export const MODULES: Modules = { bookings: { services: 'services', resources: 'masters' } };
 *
 * One door. A module is on because it is named here, and everything that
 * follows — the settings document `jtk/modules/bookings.json`, the diary, the
 * form's endpoints, the gate at the launch — asks this one question. The
 * modules reference on the platform says what each module wants pointed at it.
 *
 * The settings are the module's own document, `{ "v": 1, "settings": { … } }`
 * — the zone, the hours, the horizon, each row of a list with its `_key` — and
 * `jtk schema` seeds an empty one when it is missing. Fill in `settings`.
 */
export const MODULES: Modules = {};

/**
 * Where the platform says what it does with what this site's form collects.
 *
 * ── why a link and not a paragraph ──────────────────────────────────────────
 *
 * This used to be a version number beside six paragraphs of our text, written
 * into every site in every language it is built in. Two things were wrong with
 * that. It had to be translated, by us, for every language anybody ever builds
 * in — and it went stale: the day the platform changes what it keeps or for how
 * long, every site in the world is carrying a sentence that is no longer true
 * and has to be rebuilt to stop.
 *
 * A link cannot go stale. The text lives where the thing it describes lives,
 * and there is nothing on this side to keep in step.
 *
 * It also makes the check real. Prose cannot be verified; an address can — the
 * platform reads the built artifact and looks for this string, rather than
 * believing a number the build reported about itself.
 *
 * ── what is asked, and what is not ──────────────────────────────────────────
 *
 * **One link on a page that opens.** Nothing about what else that page says,
 * how it is worded, or which language it is in — that is the business's, and
 * grading it is neither our job nor within our competence.
 *
 * And it is a warning rather than a refusal. A site without it goes live and
 * somebody is told. The only thing publishing refuses over is a form with
 * nowhere to send what people write in it, which is a broken product rather
 * than an opinion about anybody's legal position.
 */
export const PROCESSING_URL = 'https://jtakeit.com/processing';

/**
 * The language this site is written in.
 *
 * `META.lang` in `src/copy/` is this value, and `<html lang>` is that — one
 * declaration, read by the page and by the platform: the schema is the one
 * source of a site's language. Set by `jtk create`; change it only if the site
 * itself changes language.
 */
export const LOCALE = '{{LANG}}';

/**
 * The languages this site has **besides** the one above, as the platform
 * spells them: `['en', 'fr-CH']`.
 *
 * Each is a translation beside every page and entry, holding only its words
 * (`jtk/pages/index.en.json`, jtakeit-core wiki/95, wiki/98 §4.4); a value
 * nobody translated is the original's, shown and marked with its `lang`. Each
 * language's words that are not content are `src/copy/<locale>.ts` —
 * `jtk create --locales en` and `npx @jtakeit/astro copy en` write them in the
 * kit's words. docs/languages.md says the rest.
 */
export const LOCALES: string[] = [];

/** The page's own SEO. Every site has these two, whatever else it has. */
export const PAGE_SEO: Field[] = [
  {
    key: 'title',
    label: 'Page title',
    kind: 'text',
    required: true,
    max: 60,
    client_editable: true,
    seo_sensitive: true,
    no_tap_target: true,
  },
  {
    key: 'description',
    label: 'Description for search results',
    kind: 'textarea',
    max: 160,
    client_editable: true,
    seo_sensitive: true,
    no_tap_target: true,
  },
];
