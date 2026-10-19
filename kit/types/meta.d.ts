export interface Meta {
  redirects: { from: string; to: string; status?: number }[];
  drafts: string[];
  immutable?: string[];
  cache?: CacheRule[];
}

/** How long browsers keep the files under a directory whose names carry no hash. */
export interface CacheRule {
  /** The directory, e.g. `/clips/`. Never `/`. */
  prefix: string;
  /** Seconds, at most a year. Pages under the directory are never covered. */
  maxAge: number;
}

export interface MetaInput {
  /** The content root, `jtk/content` under the working directory by default. */
  root?: string;
  collections?: { prefix: string; body?: string[] }[];
  blocks?: { type: string; views?: { key: string }[] }[];
  locales?: string[];
  /** The directories whose file names carry a content hash, e.g. `['/_astro/']`. */
  immutable?: string[];
  /**
   * Lifetimes for directories of files that keep their names. Each name is
   * then held to its contents by the platform for that long: new contents
   * take a new name (JTK_E_CACHED_FILE_CHANGED).
   */
  cache?: CacheRule[];
  redirects?: { from: string; to: string; status?: number }[];
}

export function specimenId(type: string, view?: string): string;
export function specimenAddresses(
  collections: { prefix: string; body?: string[] }[],
  blocks: { type: string; views?: { key: string }[] }[],
  locales?: string[],
): string[];
export function hiddenEntries(root?: string, now?: number): Promise<string[]>;
export function cacheRules(cache?: CacheRule[]): CacheRule[];
export function buildMeta(what?: MetaInput): Promise<Meta>;
export function writeMeta(dir: string, what?: MetaInput): Promise<Meta>;
