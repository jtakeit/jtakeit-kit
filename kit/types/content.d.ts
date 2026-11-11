/**
 * `@jtakeit/kit/content` — the door: the one place a site reads its content
 * files (wiki/98 §13 of the platform). It reads contract 2 (`jtk/catalogue.json`)
 * and contract 3 (`jtk/schema.json` saying `contract: 3`) behind one
 * interface: a template calls the same functions on either.
 *
 *   import { content } from '@jtakeit/kit/content';
 *   export const site = content(import.meta.glob('/jtk/**\/*.json', { eager: true, import: 'default' }));
 */

/** Words written once, or per language: `'Works'`, `{ en: 'Works', de: 'Arbeiten' }`. */
export type Text = string | Record<string, string>;

/**
 * A field as the schema declares it, in one shape for both contracts. Under
 * contract 3 a select's `options: [{ value, label }]` is handed out as
 * `options` and `option_labels`, and a reference's `ref: { to, many }` as
 * `to` and `many`, with `ref` the one collection where `to` names one.
 */
export interface Field {
  key: string;
  label?: Text;
  kind: string;
  /** The collection a reference names, where it names one. */
  ref?: string;
  /** Every collection a reference may name: `[ref]` under contract 2. */
  to?: string[];
  /** Contract 3: a reference holding several entries' ids. */
  many?: boolean;
  /** Contract 3: whether the value is per language (wiki/98 §3.3); absent, its kind's default. */
  localized?: boolean;
  hint?: Text;
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  option_labels?: Record<string, Text>;
  of?: Field[];
  accept?: 'image' | 'video';
  ratio?: string;
  multiple?: boolean;
  client_editable?: boolean;
  no_tap_target?: boolean;
  beside?: string;
  titled_by?: string;
  seo_sensitive?: boolean;
  [more: string]: unknown;
}

/** A block type as `jtk/catalogue.json` declares it. */
export interface BlockType {
  type: string;
  v: number;
  label?: Text;
  hint?: Text;
  fields: Field[];
  views?: { key: string; label?: Text; min?: number; max?: number; ratio?: string; needs_build?: boolean }[];
  collects?: 'enquiry';
  asks?: Field[];
  photos?: number;
  [more: string]: unknown;
}

/** A collection, as a template reads it. */
export interface Collection {
  name: string;
  label?: Text;
  one?: Text;
  intro?: Text;
  icon?: string;
  /** The block type of its entries. */
  type: string;
  /** That type's fields: what an entry of it holds. */
  fields: Field[];
  /** Whether its entries have pages of their own. */
  pages: boolean;
  /** Whether it asked for a listing at its prefix (`listing: true`). */
  listing: boolean;
  per_page?: number;
  order: 'manual' | { by: string; desc: boolean };
  group?: string;
  /** The block types an entry may hold below its own values. */
  blocks: string[];
  /**
   * Where its entries live, contract 2: `/works`. Under contract 3, the
   * `listing` its route declares, in the site's own language, and `''` where
   * it declares none (wiki/98 §15 · 6).
   */
  prefix: string;
  /**
   * Contract 3: its entries' addresses, or `'none'`. A pattern per language is
   * what follows the language's prefix, which always comes first (`{ en:
   * '/works/{slug}' }` is `/en/works/…`); a language it does not name takes
   * the base language's.
   */
  route?: 'none' | { detail: string | Record<string, string>; listing?: string | Record<string, string>; per_page?: number };
  /** Contract 3: where its entries are shown besides their own pages, `['/prices#{slug}']`. */
  shown_on?: (string | Record<string, string>)[];
  /** Contract 3: what a language without a translation does with an entry: shows the original, or leaves it out. */
  untranslated?: 'base' | 'hide';
}

/** The annotation of one value: spread it onto the element that draws it. Empty when annotation is off. */
export type At = { 'data-jtk-path'?: string };

/** A picture, its words, and its annotation. */
export interface Picture extends At {
  /** An upload key (`media/<site>/<hash>.jpg`) or a slot the repository ships. `''` where there is none. */
  src: string;
  /** Contract 2: the `<key>_alt` beside it, else an entry's title. Contract 3: the picture's own `alt`. */
  alt: string;
  focus?: string;
  /** A clip's poster. */
  poster?: string;
}

/** The values of one object — a block, a row, an entry's own — with the annotation of each. */
export interface Values {
  /** A value as words; `''` for none. */
  text(field: string): string;
  /** A value as stored; `undefined` for none — `null`, `''` and `[]` are none. */
  value(field: string): unknown;
  /**
   * A price in whole minor units, whichever contract wrote it — `4500`
   * (contract 2) or `{ minor: 4500 }` (contract 3) — for a form that sums
   * prices. `undefined` for none, and for a price said «from» or «on
   * request», which nobody is charged online (wiki/98 §3.4).
   */
  minor(field: string): number | undefined;
  /**
   * The entries a field names, in its order and the document's language: a
   * reference (an entry's slug in contract 2, its id in contract 3), a
   * `many` reference, or a list whose rows each hold one reference —
   * contract 2's `does: [{ service }]`. A name no entry has is left out.
   */
  refs(field: string): Entry[];
  /** A list's rows, each read the same way. */
  rows(field: string): Row[];
  /** A single picture. */
  picture(field: string): Picture;
  /** A gallery: its pictures, the empty ones left out, each annotated by its place in the field it was read from. */
  gallery(field: string): Picture[];
  /**
   * The annotation of a value — `{ 'data-jtk-path': … }` — or `{}` when
   * annotation is off. With a row (its index, or its `_key`) and a part, a
   * cell of a list or an item of a gallery: `at('items', 3, 'title')`.
   *
   * Contract 2 writes a place, `blocks[1].items[3].title`; contract 3 a key
   * and an id, `blocks[list].items[r7k2].title`, a picture by its part
   * (`at('image')` is `image.src`, `at('image', undefined, 'alt')` is
   * `image.alt`), and `{}` for what the grammar cannot name: a block or a
   * row without a key, a document without an id, a place too deep.
   */
  at(field: string, row?: number | string, part?: string): At;
  /**
   * Whether the value is the original's words on a page in another language
   * — a localized value nobody has translated — so a page can give it the
   * original's `lang`. A value that is the same in every language (a price, a
   * date, a phone number, a picture) has no language and is never from the
   * base. Contract 3; always `false` under contract 2, which copies every
   * document whole per language.
   */
  fromBase(field: string): boolean;
  /** The field's declaration, where the schema has one. */
  field(field: string): Field | undefined;
  /** Whether the field, filled, must carry a tap target (`TAPPABLE`, `client_editable`, `no_tap_target`). */
  tappable(field: string): boolean;
}

export interface Row extends Values {
  /** The row's `_key`, where it has one. */
  key?: string;
  index: number;
}

export interface Block extends Values {
  type: string;
  key?: string;
  /** The arrangement it is shown in, of the ones its type declares. */
  view?: string;
}

/** A page: its blocks, as the file holds them. */
export interface Page {
  kind: 'page';
  /** The page's own id, kept when its file moves; `''` before the platform's first save. */
  id: string;
  /** Its address: `/prices`, `/de/prices`. */
  address: string;
  /** `''` for the base language, the tag of any other. */
  locale: string;
  seo: Record<string, unknown>;
  /** The file it was read from, as in `files`; `undefined` for a page nobody wrote. */
  file?: string;
  blocks: Block[];
  /** The first block of a type; an empty one, annotated nowhere, where the page has none. */
  block(type: string): Block;
  /** Annotated as the page it is drawn on (no document named). The default for a page. */
  here: Page;
  /** Annotated as another page's words: `page:<address>:…` (contract 2), `page:<id>:…` (contract 3). */
  elsewhere: Page;
}

/** The shared text: on every page, in no page. Annotated `shared:…`. */
export interface Shared {
  kind: 'shared';
  locale: string;
  file?: string;
  blocks: Block[];
  block(type: string): Block;
}

/** An entry of a collection. */
export interface Entry {
  kind: 'entry';
  /** The entry's own id, kept when its file moves; `''` before the platform's first save. */
  id: string;
  collection: string;
  /** Its path without the language and the collection's prefix (contract 2); its `slug` in its language (contract 3). */
  slug: string;
  /** `''` for the base language, the tag of any other. */
  locale: string;
  /** Whether a listing shows it now: `visible`, `show_at`, `hide_at`. */
  visible: boolean;
  seo: Record<string, unknown>;
  file?: string;
  /** A specimen page: one arrangement of a block type, built for the panel, listed nowhere. */
  specimen: boolean;
  /** Its own values (contract 2: its first block; contract 3: its `fields`). On its own page `title` is `blocks[0].title` (contract 2), `title` (contract 3). */
  fields: Values;
  /** The blocks below its own values. */
  body: Block[];
  /** Where its page is, for a collection with pages: `/de/blog/first-look`. */
  address?: string;
  /** Where it is shown, for a collection without pages: `/services#services-cut`. */
  anchor?: string;
  /** Annotated as its own page, where the entry is the document. */
  here: Entry;
  /** Annotated as drawn on another page — a tile, a row, a heading: `page:<address>:…`. The default for an entry. */
  elsewhere: Entry;
}

export interface Heading {
  /** The stored value it stands for: the option, or the referenced entry's slug (contract 2) or id (contract 3). */
  key: string;
  text: string;
  /** The entry whose title it is, for a group by a ref. */
  entry?: Entry;
  /** The title's annotation, where it is the owner's to tap. */
  at: At;
  /** The repository's words, or a title nobody taps: draw it `data-jtk-fixed`. */
  fixed: boolean;
}

export interface Site {
  /** Which contract the door read the files as. */
  contract: 2 | 3;
  /** The base language's tag. */
  locale: string;
  /** Every language, base first. */
  locales: string[];
  /** ISO 4217, upper case; `''` while nobody has said. */
  currency: string;
  types: BlockType[];
  type(name: string): BlockType | undefined;
  collections: Collection[];
  collection(name: string): Collection | undefined;
  /** The collections a module is pointed at — `{ services, resources }` — or `undefined` for a module the site has not turned on. */
  rolesOf(module: string): Record<string, string> | undefined;

  /** A page, by its address, in a language; an empty page where none is written. */
  page(address: string, locale?: string): Page;
  pages(locale?: string): Page[];
  shared(locale?: string): Shared;
  /** A module's settings (contract 2: its `<module>_config` block; contract 3: `settings` of `jtk/modules/<module>.json`); `{}` for none. */
  module(name: string): Record<string, unknown>;
  /** The same settings read like any values, `rows('hours')`; annotated `module:<module>:hours[h1].opens` under contract 3, nowhere under contract 2. */
  settings(name: string): Values;

  /** A collection's entries in a language, offered (`all: true` for every one) and in its order. */
  entries(name: string, options?: { locale?: string; now?: number; all?: boolean }): Entry[];
  entry(name: string, idOrSlug: string, locale?: string): Entry | undefined;
  /** The specimen pages of a collection, in every language or one. */
  specimens(name: string, options?: { locale?: string }): Entry[];

  addressOf(entry: Entry): string | undefined;
  anchorOf(entry: Entry): string | undefined;
  /**
   * A collection's listing in a language, page `n`: `/works`, `/de/works/page/2`.
   * Contract 3: `undefined` for a collection that declares no `listing`
   * (wiki/98 §15 · 6) — its entries are at their own pages, or at `anchorOf`.
   */
  listingOf(name: string, locale?: string, page?: number): string | undefined;
  /**
   * The page a collection's entries are shown on, in a language, without the
   * anchor: a collection without pages is listed there. Contract 2: its
   * prefix (`/services`); contract 3: the first page its `shown_on` names.
   * `undefined` for a collection with pages (contract 2) or none named.
   */
  shownOn(name: string, locale?: string): string | undefined;
  /** The listing as its pages draw it: the entries in order, group by group, and how many to a page. */
  listingPages(name: string, locale?: string): { entries: Entry[]; size: number; last: number };
  /** Which language an address is in: `''` for the base. */
  localeOf(address: string): string;
  /** An address in a language: `/about` → `/de/about`, `/` → `/de`. */
  inLocale(locale: string, address: string): string;
  /** Every language a page or an entry exists in, for `hreflang`; empty for one in a single language. */
  alternatesOf(document: Page | Entry): { locale: string; address: string }[];

  /** Entries under their headings, or `undefined` for a collection with no `group`. */
  groupsOf(name: string, entries: Entry[], locale?: string): { heading?: Heading; entries: Entry[] }[] | undefined;
  /** What points at an entry from the other collections, each capped at its `per_page`. */
  referrersOf(entry: Entry): { collection: Collection; entries: Entry[]; more: number }[];
  /** Where an entry sits in its collection's tree. */
  treeOf(entry: Entry): { trail: Entry[]; children: Entry[]; more: number };

  /**
   * A price in the site's currency: whole minor units (contract 2) or `{ minor }`
   * (contract 3). Contract 3 says its qualifiers in the page's language —
   * «ab CHF 45.–» for `{ minor, from: true }`, «auf Anfrage» for `{ on_request:
   * true }` — in the kit's words (`priceWords`, `@jtakeit/kit/money`), or in
   * the template's own: `{ from: '{amount} und mehr' }`.
   */
  money(value: unknown, locale?: string, own?: { from?: string; on_request?: string }): string;
  /** A label's words in a language. */
  words(text: Text | undefined, locale?: string): string;
  tappable(field: Field | undefined): boolean;

  /**
   * Every page and entry document as its file holds it — for the kit's own
   * checks. Contract 3: each in every language it is in, with its `id`, an
   * entry's `fields` apart from its body `blocks`, and no `path` for an entry
   * shown only on another page.
   */
  documents(): { file: string; id?: string; path?: string; locale: string; collection?: string; slug?: string; seo: Record<string, unknown>; fields?: Record<string, unknown>; blocks: Record<string, unknown>[]; visible?: unknown; shown: boolean }[];
  sharedDocuments(): { file: string; locale: string; blocks: Record<string, unknown>[] }[];
}

/**
 * Read a site's content.
 * @param files every file under `jtk/`, keyed `/jtk/…`, parsed
 * @param options `annotate: false` for a build with no editor; `now`, the clock a schedule is read against
 */
export function content(files: Record<string, unknown>, options?: { annotate?: boolean; now?: number }): Site;

/** The platform's tappable kinds. */
export const TAPPABLE: ReadonlySet<string>;
export function tappable(field: Field | undefined): boolean;
export function specimenId(type: string, view?: string): string;
export function shownAt(document: { visible?: boolean; show_at?: unknown; hide_at?: unknown } | null | undefined, now?: number): boolean;
export function canonicalLocale(tag: unknown): string | null;
export function sharedLocaleOf(name: string): string | null;
export function drawsPagedListing(collection: { pages?: boolean; listing?: boolean }, ownPage: boolean): boolean;
export function linksToListing(collection: { pages?: boolean; listing?: boolean; prefix?: string }): boolean;

/** The content as one document, read off a disk — `@jtakeit/kit/content/node`'s, kept here too. */
export { collectContent } from './content-node';
