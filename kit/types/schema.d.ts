/**
 * A contract-3 declaration in `src/content/blocks.ts`, in the words of
 * jtakeit-core wiki/98 §3 — what `jtk schema` writes into `jtk/schema.json`.
 *
 * A declaration says it is contract 3 with one line, and is otherwise the
 * file it always was, one export per table:
 *
 *   import type { Block, Collection, Field, Modules } from '@jtakeit/kit/schema';
 *
 *   export const CONTRACT = 3;
 *   export const LOCALE = 'de';
 *   export const LOCALES: string[] = [];
 *   export const BLOCKS: Block[] = [ … ];
 *   export const SHARED: string[] = ['contacts'];
 *   export const COLLECTIONS: Collection[] = [ … ];
 *   export const MODULES: Modules = {};
 *   export const PAGE_SEO: Field[] = [ … ];
 *
 * No `BUSINESS_FACTS`: the business's own words are shared text, a block the
 * schema lists in `SHARED` whose fields say their `role` (§4.5). A declaration
 * without `CONTRACT = 3` is contract 2's, read by `jtk catalogue` as before.
 */

/** Words, written once, or once per language: `'Preis'` or `{ de: 'Preis', en: 'Price' }`. */
export type Text = string | Record<string, string>;

/** What a field of the shared text means to the outside world: the door builds the business's structured data from them (§3.3, §4.5). One field a role. */
export type Role =
  | 'name' | 'phone' | 'email'
  | 'street' | 'postal_code' | 'city' | 'region' | 'country' | 'maps'
  | 'social' | 'price_range' | 'business_type' | 'hours';

/** One choice of a select: its `value` is what a document holds, and renaming it is a migration; its `label` is the words (§3.3). */
export interface Option {
  value: string;
  label?: Text;
}

/** Where a reference points: the collections it may name an entry of, by the entry's id (§3.3). */
export interface Ref {
  to: string[];
  /** Several entries — an array of ids — where contract 2 wrote a list of one-ref rows. */
  many?: boolean;
  /** What a deletion of the entry named does: refused (`restrict`, the default), or the reference emptied. */
  on_delete?: 'restrict' | 'nullify';
}

/** What every field may say, whatever its kind. */
interface FieldBase {
  /** Permanent: a-z, 0-9 and underscores, a letter first. */
  key: string;
  label: Text;
  hint?: Text;
  /**
   * One meaning: a shown document without the value is refused at import, at
   * save and at publish; on a list, at least one row. A hidden entry may lack it.
   */
  required?: boolean;
  /** Absent is false, everywhere (§3.3): only a field that says `true` is the owner's, and only it must be annotated where it is drawn. */
  client_editable?: boolean;
  /** Edited in the panel, never drawn as an element: no annotation is asked of it. */
  no_tap_target?: boolean;
  /** The field the owner taps to edit this one, which is not on the page (`no_tap_target`). */
  beside?: string;
  /** The text field of the same block or row that names one of these in the panel. */
  titled_by?: string;
  /** A warning in the panel that changing it changes what a search engine sees. */
  seo_sensitive?: boolean;
  /** What the field means to the outside world — only on a type `SHARED` lists. */
  role?: Role;
}

/**
 * How long, how many, how much: absent is unbounded and `0` is a bound
 * (§3.3) — `min: 0` says "none is allowed", which contract 2 could not say.
 * Characters on text, the value on a number, rows on a list, pictures on a
 * gallery; a link, a date and one picture take none.
 */
interface Bounds {
  min?: number;
  max?: number;
}

/** Words: per language unless `localized: false` says they are the same in every language. */
export interface TextField extends FieldBase, Bounds {
  kind: 'text' | 'textarea' | 'richtext_lite' | 'markdown';
  localized?: boolean;
}

/** A number; `integer` where only a whole one makes sense — a count of seats (§3.3). */
export interface NumberField extends FieldBase, Bounds {
  kind: 'number';
  integer?: boolean;
}

/**
 * A price, `{ "minor": 4500 }` in the site's one currency, with `from: true`
 * or `on_request: true` where `qualifiers` allow them (§3.4). Never localized:
 * a price is the same in every language.
 */
export interface MoneyField extends FieldBase, Bounds {
  kind: 'money';
  qualifiers?: ('from' | 'on_request')[];
}

/** A select: its options as `{ value, label }`, one list (§3.3). */
export interface SelectField extends FieldBase {
  kind: 'select';
  options: Option[];
}

/**
 * A reference to an entry of one of the schema's collections, by its id;
 * with `many`, several, bounded in how many it names as the list of one-ref
 * rows it replaced was in rows.
 */
export interface RefField extends FieldBase, Bounds {
  kind: 'ref';
  ref: Ref;
}

/**
 * A picture or a clip, `{ src, alt?, focus?, poster? }` — or, `multiple`, a
 * gallery of them, each with a `_key`. `localized: true` lets a language hold
 * its own picture; by default only its `alt` is per language.
 */
export interface MediaField extends FieldBase, Bounds {
  kind: 'media';
  accept?: 'image' | 'video';
  multiple?: boolean;
  /** The frame the design shows it in, `'3:2'`; the owner's `focus` says what survives the crop. */
  ratio?: string;
  localized?: boolean;
}

/**
 * Rows, each with a `_key`, of the fields in `of` — one of which may be a
 * list itself (M5), and none deeper. `localized: true` is a whole list per
 * language; by default the rows are shared and their words per language.
 */
export interface ListField extends FieldBase, Bounds {
  kind: 'list';
  of: Field[];
  localized?: boolean;
}

/** A link, `https://…` or `#anchor`; the same in every language unless `localized: true`. */
export interface UrlField extends FieldBase {
  kind: 'url';
  localized?: boolean;
}

/**
 * A product's stock-keeping code, `OAK-TABLE-180`: unique per site within its
 * role, and fixed once a record names it (§3.4).
 */
export interface SkuField extends FieldBase, Bounds {
  kind: 'sku';
}

/** Whole minutes: a length, or a time of day from midnight — bounded as a number is (a service takes 5 to 480). */
export interface MinutesField extends FieldBase, Bounds {
  kind: 'duration' | 'time_of_day';
}

/** A telephone number, an address to write to: bounded in characters, as text is. */
export interface ContactField extends FieldBase, Bounds {
  kind: 'tel' | 'email';
}

/** The kinds with nothing of their own to say, and no bounds (§3.3): a date, a switch. */
export interface PlainField extends FieldBase {
  kind: 'date' | 'bool';
}

/** One field of a block, a row, a form's asks or the page's SEO (§3.3). */
export type Field = TextField | NumberField | MoneyField | SelectField | RefField | MediaField | ListField | UrlField | SkuField | MinutesField | ContactField | PlainField;

/** The kinds, eighteen (§3.4). */
export type Kind = Field['kind'];

/** One arrangement of a block's one gallery, and how many pictures it takes in what frame. */
export interface View {
  key: string;
  label: Text;
  min?: number;
  max?: number;
  ratio?: string;
  needs_build?: boolean;
}

/** A block type: what a page, an entry's body or the shared text is made of (§3.2). */
export interface Block {
  /** Permanent: the content of every page that used it holds it. */
  type: string;
  /** The version of its fields' shape, 1 or more. */
  v: number;
  label: Text;
  /** Drawn in the dialog that adds a block. */
  hint?: Text;
  fields: Field[];
  views?: View[];
  /** Required on a block whose form gathers personal data. */
  collects?: 'enquiry';
  /** What its form asks a visitor for besides the enquiry's own name, contact and message. */
  asks?: Field[];
  /** How many photographs its form takes with an enquiry, 1 to 7. */
  photos?: number;
}

/** An address, with `{slug}` where an entry's slug goes, the same in every language or per language — always what follows the language's prefix (§15 · 4). */
export type Pattern = string | Record<string, string>;

/**
 * Where a collection's entries are reached (§3.5): their own pages — and the
 * page listing them, paginated, where it has one — or `'none'`, for entries
 * shown only on other pages, which `shown_on` then names.
 */
export type Route = 'none' | { detail: Pattern; listing?: Pattern; per_page?: number };

/** A set of entries of one block type (§3.5). */
export interface Collection {
  /** Its entries' directory, `jtk/entries/<name>/`; fixed once it has entries. */
  name: string;
  label: Text;
  /** One of them, as the panel says it: «Service». */
  one?: Text;
  intro?: Text;
  place?: 'business' | 'site';
  /** `lucide:<name>`, or `path:<svg path data>` on a 20×20 grid. */
  icon?: string;
  type: string;
  route: Route;
  /** The places an entry appears besides its own page, `['/prices#{slug}']`; required with `route: 'none'`. */
  shown_on?: Pattern[];
  /** By hand — every entry then carries `rank` — or by a required date, number or line of text. Absent is by hand. */
  order?: 'manual' | { by: string; desc?: boolean };
  /** A select, or a reference to one entry of one other collection. */
  group?: string;
  /** The block types an entry's body may hold besides its own values. */
  blocks?: string[];
  /** What a language with no translation does with an entry: shows the original, or leaves it out. */
  untranslated?: 'base' | 'hide';
}

/** The domain modules the site turns on, each pointed at its collections by role: `{ bookings: { services: 'services', resources: 'masters' } }`. */
export type Modules = Record<string, Record<string, string>>;

/** `jtk/schema.json`, as `jtk schema` writes it from the declaration. */
export interface Schema {
  contract: 3;
  generator?: string;
  /** The site's own language: the one source of it. */
  locale: string;
  locales?: string[];
  blocks: Block[];
  page_seo?: Field[];
  /** The block types the shared document holds. */
  shared?: string[];
  collections?: Collection[];
  modules?: Modules;
}

/** What `src/content/blocks.ts` exports, on contract 3. */
export interface Declaration {
  CONTRACT: 3;
  LOCALE: string;
  LOCALES?: string[];
  BLOCKS: Block[];
  PAGE_SEO?: Field[];
  SHARED?: string[];
  COLLECTIONS?: Collection[];
  MODULES?: Modules;
}

/** A thing wrong with a schema, as the platform names it. */
export interface Fault {
  code: string;
  path: string;
  says: string;
}

/** Which contract a declaration is: 3 where it says `CONTRACT = 3`, 2 where it says nothing or 2. Anything else is an error with the reason. */
export function contractOfDeclaration(declared: Record<string, unknown>): 2 | 3;

/** The schema a contract-3 declaration says, in the order the file is written in. */
export function schemaOf(declared: Record<string, unknown>, options?: { generator?: string }): Schema;

/** The schema as `jtk/schema.json` holds it: two spaces to a level and a newline — byte for byte the same for the same declaration. */
export function schemaText(schema: Schema): string;

/** Everything the platform's strict decode and its judge would say of a contract-3 schema's text, offline; empty for one it accepts. */
export function judgeSchema(text: string): Fault[];

/** `jtk schema` with these arguments; resolves to the exit code. */
export function main(argv: string[]): Promise<number>;
