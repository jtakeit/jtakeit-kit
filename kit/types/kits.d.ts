export interface Kit {
  kind: string;
  about?: string;
  ask?: string[];
  version?: string;
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
export function kitLanguage(locale: string | undefined): 'uk' | 'en' | 'de';
export function kitSettings(kit: Kit): Record<string, unknown>;
export function kitEntries(kit: Kit, locale: string): [string, Record<string, unknown>][];
/** The keys only contract 3 has, which a contract-2 schema is refused for: on the catalogue, on a field at any depth, on a collection. */
export const CONTRACT_3_ONLY: Readonly<{ catalogue: readonly string[]; field: readonly string[]; collection: readonly string[] }>;
/** A kit's catalogue as a contract-2 schema holds it: without contract 3's keys, nothing else changed. */
export function catalogueIn2(catalogue: Kit['catalogue']): Kit['catalogue'];
export function mergeKitIntoCatalogue(catalogue: Record<string, unknown>, kit: Kit): Record<string, unknown>;
export function layKitFiles(target: string, kit: Kit, options?: { locale?: string; catalogue?: boolean }): string[];
