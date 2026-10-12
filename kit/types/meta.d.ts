export interface Meta {
  redirects: { from: string; to: string; status?: number }[];
  drafts: string[];
  immutable?: string[];
}

export interface MetaInput {
  /** The content root, `jtk/content` under the working directory by default. */
  root?: string;
  collections?: { prefix: string; body?: string[] }[];
  blocks?: { type: string; views?: { key: string }[] }[];
  locales?: string[];
  /** The directories whose file names carry a content hash, e.g. `['/_astro/']`. */
  immutable?: string[];
  redirects?: { from: string; to: string; status?: number }[];
}

export function specimenId(type: string, view?: string): string;
export function specimenAddresses(
  collections: { prefix: string; body?: string[] }[],
  blocks: { type: string; views?: { key: string }[] }[],
  locales?: string[],
): string[];
export function hiddenEntries(root?: string, now?: number): Promise<string[]>;
export function buildMeta(what?: MetaInput): Promise<Meta>;
export function writeMeta(dir: string, what?: MetaInput): Promise<Meta>;
