/**
 * `@jtakeit/kit/upgrade` — a contract-2 site's declaration and documents in
 * contract 3's words (jtakeit-core wiki/98 §7 · 2 and 3), as pure functions:
 * `jtk upgrade contract-3` (`@jtakeit/astro`) runs them over a scaffold, and
 * another generator's tool can run them over its own.
 */

/** Something a person must answer before it can be decided (wiki/98 §8). */
export interface Question {
  what: string;
  where: string;
  ask: string;
}

/** Empty is absent: `null`, `""`, whitespace-only text, `[]` and `{}`. */
export function isEmpty(value: unknown): boolean;

/** A rank between two, compared as bytes, as the platform mints one; `''` for either end. */
export function rankBetween(a: string, b: string): string;
/** `n` ranks spread evenly, in order. */
export function rankSpread(n: number): string[];

/** The contract-3 tables of a contract-2 declaration's exports, or why it is refused. */
export function tablesOf(
  declared: Record<string, any>,
  ctx?: { sharedTypes?: string[]; ownListings?: Set<string> },
): { tables: Record<string, any>; questions: Question[]; notes: string[]; contacts?: any; refused?: string };

/** One field, a list of fields, a block type and a collection, each in contract 3's words. */
export function field3(field: any, how?: { whole?: string[] }): any;
export function fields3(fields: any[], how?: { whole?: string[] }): any[];
export function block3(block: any, how?: { whole?: string[] }): any;
export function collection3(collection: any, ownListings?: Set<string>): any;

/** The business facts as the shared `contacts` block type with roles, and its values from the platform's facts. */
export function contactsOf(facts: any[], locale: string): { block: any; questions: Question[]; notes: string[] };
export function contactsValues(contacts: any, business: Record<string, unknown>, locale: string): { values: Record<string, unknown>; questions: Question[] };

/** A list whose row is one reference, which contract 3 says as one reference to many. */
export function oneRefList(field: any): boolean;
/** The `<key>_alt` fields of a list of fields, by the picture's key. */
export function altsIn(fields: any[]): Map<string, string>;

/**
 * The platform's state an agent fetched through the MCP server, read-only:
 * `{ "site": get_site, "pages": get_content's pages }`, each part optional.
 */
export function stateOf(json: unknown): {
  site: Record<string, any>;
  pages: { id: string; path: string; collection: string; locale: string; position: number }[];
  faults: string[];
};

export function pageFile3(path: string): string;
export function entryFile3(collection: string, slug: string): string;
export function nameOfPage(raw: Record<string, any>, path: string, locale: string): string;

/** A shared value that differs between an original and its copy in another language (wiki/95 §6). */
export interface Differing {
  /** The translation's file, as it will be written: `jtk/pages/index.en.json`. */
  file: string;
  /** The contract-2 copy it came from: `jtk/content/en/index.json`. */
  from: string;
  locale: string;
  /** The place, as the annotation grammar says it: `blocks[hero].image`. */
  place: string;
  /** The field, as `--take-base` names it: `hero.image`, `service.costs`, `prices.items.price`, `seo.title`, `page:/prices` for a page's blocks. */
  field: string;
  base: unknown;
  theirs: unknown;
}

/**
 * The contract-3 tree of a contract-2 one: the files to write and to remove, and what goes to a person.
 *
 * A copy in another language (`jtk/content/en/…`, or one that says its `locale`) becomes a
 * translation beside its original (`index.en.json`): its localized values, recorded as made from
 * the original as it stands (`translated[place].from`); a shared value equal to the original's
 * kept once, on the original; one that differs listed in `differing`, unless `takeBase` says the
 * original's stands — a field marked `localized` in `to` is per language and differs from nothing.
 */
export function documentsOf(
  files: Record<string, any>,
  how: {
    from: any;
    to: any;
    order: Record<string, string[]>;
    state?: ReturnType<typeof stateOf>;
    contacts?: any;
    mint?: { id?: () => string; key?: (taken: Set<string>) => string };
    /** Whether the original's value stands for a field that differs, by `Differing.field` (or `<locale>:<field>`). */
    takeBase?: (field: string) => boolean;
  },
): {
  write: Record<string, any>;
  remove: string[];
  questions: Question[];
  notes: string[];
  minted: { ids: string[]; ranks: string[]; keys: number; rekeyed: number };
  differing: Differing[];
};

/** Which language a contract-2 document is in: `''` for the site's own, else the canonical tag. */
export function languageOfDocument(raw: Record<string, any>, others: string[], base?: string): string;
export function wholeOf(declared: Record<string, any>): Map<string, string[]>;
