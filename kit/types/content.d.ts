/**
 * `@jtakeit/kit/content` — the door: the one place a site reads its content
 * files (wiki/98 §13 of the platform). This version reads contract 2.
 *
 *   import { content } from '@jtakeit/kit/content';
 *   export const site = content(import.meta.glob('/jtk/**\/*.json', { eager: true, import: 'default' }));
 */

/** Words written once, or per language: `'Works'`, `{ en: 'Works', de: 'Arbeiten' }`. */
export type Text = string | Record<string, string>;

/** A field as `jtk/catalogue.json` declares it. */
export interface Field {
  key: string;
  label?: Text;
  kind: string;
  ref?: string;
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
  /** Where its entries live, contract 2: `/works`. */
  prefix: string;
}

/** The annotation of one value: spread it onto the element that draws it. Empty when annotation is off. */
export type At = { 'data-jtk-path'?: string };

/** A picture, its words, and its annotation. */
export interface Picture extends At {
  /** An upload key (`media/<site>/<hash>.jpg`) or a slot the repository ships. `''` where there is none. */
  src: string;
  /** Contract 2: the `<key>_alt` beside it, else an entry's title. */
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
   */
  at(field: string, row?: number | string, part?: string): At;
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
  /** Annotated as another page's words: `page:<address>:…`. */
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
  /** Its path without the language and the collection's prefix. */
  slug: string;
  /** `''` for the base language, the tag of any other. */
  locale: string;
  /** Whether a listing shows it now: `visible`, `show_at`, `hide_at`. */
  visible: boolean;
  seo: Record<string, unknown>;
  file?: string;
  /** A specimen page: one arrangement of a block type, built for the panel, listed nowhere. */
  specimen: boolean;
  /** Its own values (contract 2: its first block). */
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
  /** The stored value it stands for: the option, or the referenced entry's slug. */
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
  contract: 2;
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
  /** A module's settings (contract 2: its `<module>_config` block); `{}` for none. */
  module(name: string): Record<string, unknown>;

  /** A collection's entries in a language, offered (`all: true` for every one) and in its order. */
  entries(name: string, options?: { locale?: string; now?: number; all?: boolean }): Entry[];
  entry(name: string, idOrSlug: string, locale?: string): Entry | undefined;
  /** The specimen pages of a collection, in every language or one. */
  specimens(name: string, options?: { locale?: string }): Entry[];

  addressOf(entry: Entry): string | undefined;
  anchorOf(entry: Entry): string | undefined;
  /** A collection's listing in a language, page `n`: `/works`, `/de/works/page/2`. */
  listingOf(name: string, locale?: string, page?: number): string;
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

  /** A price in the site's currency: whole minor units (contract 2) or `{ minor }` (contract 3). */
  money(value: unknown, locale?: string): string;
  /** A label's words in a language. */
  words(text: Text | undefined, locale?: string): string;
  tappable(field: Field | undefined): boolean;

  /** Every page and entry document as its file holds it — for the kit's own checks. */
  documents(): { file: string; path: string; locale: string; collection?: string; slug?: string; seo: Record<string, unknown>; blocks: Record<string, unknown>[]; visible?: unknown; shown: boolean }[];
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
export function linksToListing(collection: { pages?: boolean; listing?: boolean }): boolean;

/** The content as one document, read off a disk — `@jtakeit/kit/content/node`'s, kept here too. */
export { collectContent } from './content-node';
