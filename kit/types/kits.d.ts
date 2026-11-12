export interface Kit {
  kind: string;
  about?: string;
  ask?: string[];
  version?: string | number;
  catalogue: {
    blocks: Record<string, unknown>[];
    collections: Record<string, unknown>[];
    modules: Record<string, Record<string, string>>;
  };
  settings: Record<string, unknown>;
  entries: { collection: string; slug: string; fields: Record<string, unknown> }[];
}

export const API: string;
export function readKit(file: string): Kit;
export function fetchKit(kind: string, api?: string): Promise<Kit>;
export function loadKit(asked: string, api?: string): Promise<Kit>;
export function checkKit(kit: unknown, from: string): Kit;
export function kitLanguage(locale: string | undefined): 'uk' | 'en' | 'de' | 'ru' | 'es' | 'it' | 'pt' | 'fr';
export function kitSettings(kit: Kit): Record<string, unknown>;
export function kitEntries(kit: Kit, locale: string): [string, Record<string, unknown>][];
/** The keys only contract 3 has, which a contract-2 schema is refused for: on the catalogue, on a field at any depth, on a collection. */
export const CONTRACT_3_ONLY: Readonly<{ catalogue: readonly string[]; field: readonly string[]; collection: readonly string[] }>;
/** A kit's catalogue as a contract-2 schema holds it: without contract 3's keys, nothing else changed. */
export function catalogueIn2(catalogue: Kit['catalogue']): Kit['catalogue'];
export function mergeKitIntoCatalogue(catalogue: Record<string, unknown>, kit: Kit): Record<string, unknown>;
export function layKitFiles(target: string, kit: Kit, options?: { locale?: string; catalogue?: boolean }): string[];

/** Something a person must answer before it can be decided, as `@jtakeit/kit/upgrade` says it. */
export interface KitQuestion {
  what: string;
  where: string;
  ask: string;
}

/**
 * A kit in contract 3's words, in memory: its block types, collections and
 * module as `tablesOf` says them, and its settings, rates and the page its
 * services are shown on as `documentsOf` moves them — keyed `/jtk/…`, with
 * new ids. `jtk create --kit` and `layKit3Files` take this one mapping.
 */
export function kitIn3(
  kit: Kit,
  how: { locale: string; lang?: string; ownListings?: Set<string> },
): {
  blocks: Record<string, unknown>[];
  collections: Record<string, unknown>[];
  modules: Record<string, Record<string, string>>;
  write: Record<string, Record<string, unknown>>;
  questions: KitQuestion[];
  refused?: string;
};

/**
 * Which contract a kit is laid into a tree on: 3 for `jtk/schema.json` at
 * contract 3, 2 for contract 2's files and no schema, 3 for a new tree
 * (`fresh`); or why the tree is neither.
 */
export function treeOf(target: string):
  | { contract: 2 | 3; fresh?: boolean; refused?: undefined }
  | { refused: string; contract?: undefined; fresh?: undefined };

/**
 * A kit laid into a contract-3 tree, or a new one: its tables into
 * `jtk/schema.json` beside the site's own, judged as the platform judges it;
 * its settings, rates and the page its services are shown on where the site
 * has none. Throws, writing nothing, on a clash or a finding.
 */
export function layKit3Files(target: string, kit: Kit, options?: { locale?: string }): { written: string[]; questions: KitQuestion[] };

/** `jtkit apply`: contract 3's files on a new or contract-3 tree, contract 2's on a contract-2 one. */
export function applyKit(target: string, kit: Kit, options?: { locale?: string }): { contract: 2 | 3; written: string[]; questions: KitQuestion[] };
