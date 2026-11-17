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

/** A variant's choice among its product's options, by key (contract 3's alone). */
export interface PicksField extends FieldBase {
  kind: 'picks';
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
export type Field = TextField | NumberField | MoneyField | SelectField | RefField | MediaField | ListField | UrlField | SkuField | PicksField | MinutesField | ContactField | PlainField;

/** The kinds, nineteen (§3.4). */
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
  /** The steps that bring content written at an older `v` up to this one: one step for each older version content may still say. */
  upcast?: UpcastStep[];
  /** On a collection's entry type only: how the panel lays out an entry's card and a new entry. Absent, the panel guesses, in the fields' order. */
  form?: Form;
}

/**
 * A field in a row of a form: its key, or `{ field, span }` — how many of the
 * row's six columns it takes, 2 to 6. Cells without a span share what the
 * others leave, evenly.
 */
export type FormCell = string | { field: string; span?: number };

/** One section of an entry's card: a heading, a line under it, and rows of one to three fields. */
export interface FormSection {
  title?: Text;
  /** One line under the title: what these fields change on the site. */
  note?: Text;
  /** Side by side on a laptop, one under another on a phone. A gallery, a list or a document takes a row alone. */
  rows: FormCell[][];
}

/** The controls a field may be written with — each only for its kinds (the platform's reference, «A form's widgets»). */
export type Widget =
  | 'line' | 'area' | 'tall' | 'writing' | 'number' | 'stepper' | 'money' | 'minutes' | 'presets'
  | 'clock' | 'calendar' | 'toggle' | 'dropdown' | 'radio' | 'segmented' | 'input' | 'code'
  | 'picture' | 'gallery' | 'rows' | 'checklist';

/**
 * How the panel lays out one entry's card and a new entry (jtakeit-core
 * wiki/99 §10). `title` leads where no row names it; a field no row and no
 * aside names is drawn after the sections, under «More»; every required field
 * has a place; `body` never does — it is written beside the page.
 *
 *   form: {
 *     sections: [
 *       { rows: [[{ field: 'title', span: 4 }, 'date'], ['starts', 'price']] },
 *       { title: 'On the page', note: 'What the listing shows', rows: [['excerpt']] },
 *     ],
 *     aside: ['cover'],
 *     widgets: { starts: 'clock' },
 *   }
 */
export interface Form {
  /** At most eight. Absent: the panel's own layout — `title` (with `date` beside it), then every field in its order, short ones two to a row. */
  sections?: FormSection[];
  /** A column beside the sections on a laptop, after them on a phone, at most six: a picture, a category, a switch. Absent: the type's single pictures; `[]`: none. */
  aside?: string[];
  /** The control a field is written with, one of its kind's; absent is the kind's own. */
  widgets?: Record<string, Widget>;
}

/** What one step changes, in a block or in each row of one of its lists; made in this order: rename, rows, values, drop, set. */
export interface UpcastChange {
  /** Old key → new key. */
  rename?: Record<string, string>;
  /** List key → the same changes inside each of its rows (one level). */
  rows?: Record<string, UpcastChange>;
  /** Field key → old value → new value: a select's value renamed. */
  values?: Record<string, Record<string, string>>;
  /** Fields that are gone; what they held is kept in `_orphans`. */
  drop?: string[];
  /** A new field's first value, written where the block has none. */
  set?: Record<string, unknown>;
}

/** What a block written at version `from` becomes at `from + 1`. */
export interface UpcastStep extends UpcastChange {
  from: number;
}

/** An address, with `{slug}` where an entry's slug goes, the same in every language or per language — always what follows the language's prefix (§15 · 4). */
export type Pattern = string | Record<string, string>;

/**
 * Where a collection's entries are reached (§3.5): their own pages — and the
 * page listing them, paginated, where it has one — or `'none'`, for entries
 * shown only on other pages, which `shown_on` then names.
 */
export type Route = 'none' | { detail: Pattern; listing?: Pattern; per_page?: number };

/**
 * When a collection's entries are over, by their own date (the owner, 16
 * November 2026). The platform works the moment out on every save, says
 * «over» in the panel and rebuilds the site at it; the door gives each entry
 * `ended` and `endsAt`, so a template never compares the date with today
 * itself. What becomes of an entry that is over is `then`'s.
 *
 *   { date: 'date', time: 'starts', after: 480, zone: 'Europe/Zurich', then: 'keep' }
 *
 * The moment is the date at the time (the start of the day without one) on
 * the zone's clock, and `after` minutes.
 */
export interface EndsBy {
  /** A field of kind `date` of the entry type. An entry with no date stays. */
  date: string;
  /** A field of kind `time_of_day` (minutes from midnight); absent is the start of the day. */
  time?: string;
  /** Minutes after that moment, 0 to 10080 (a week); absent is 0 with a time, 1440 without one. */
  after?: number;
  /** The IANA zone the date and the time are on the clock of: `Europe/Zurich`. */
  zone: string;
  /**
   * What becomes of an entry that is over: `keep` (absent) leaves it on the site — in the listing,
   * the feed, the sitemap — for the template to place by `ended`, an archive of past nights; `hide`
   * takes it off, its `hide_at` the moment.
   */
  then?: 'keep' | 'hide';
}

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
  /** When its entries are over, by their own date, and what becomes of them then. */
  ends_by?: EndsBy;
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
  /**
   * `live`: the template draws a draft at request time the way it draws its
   * files at build time, and the panel may preview a saved field at once
   * (jtakeit-core wiki/89 §12). The platform checks it at every build.
   */
  render?: 'live';
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
  /** `'live'`: written as the schema's `render` (the scaffold's template is ready). */
  RENDER?: 'live';
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

/** The judge's advice on a schema it accepts — `JTK_W_PANEL_FORM_GUESSED`, where the panel guesses an entry's card, and `JTK_W_NOT_LIVE`, a schema without `render: "live"`; empty for one it refuses. */
export function adviseSchema(text: string): Fault[];

/** `jtk schema` with these arguments; resolves to the exit code. */
export function main(argv: string[]): Promise<number>;
