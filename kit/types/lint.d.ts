export interface Finding { code: string; says: string }
export interface Verdict {
  findings: Finding[];
  ok: boolean;
  pages: number;
  shared: boolean;
  line: string;
  /** Present on a contract-3 tree, which is linted as the build's lint3 lints it. */
  contract?: 3;
  /** Contract 3: the entries read, in the site's own language. */
  entries?: number;
}
export interface LintOptions {
  /** The site's root, holding `jtk/`; the working directory by default. */
  root?: string;
  /** The built pages; `dist` under the root by default. */
  dist?: string;
  /** The address the build is for (`SITE_URL`); empty skips the host checks. */
  siteURL?: string;
  /** Contract 2: the catalogue, read from `jtk/catalogue.json` when left out. */
  catalogue?: unknown;
  /** Contract 2: the content document, collected from `jtk/` when left out. */
  content?: unknown;
  /** Contract 3: the clock an entry's `show_at` and `hide_at` are read against, ms since the epoch; now by default. */
  now?: number;
}
/**
 * The annotation lint the platform's build runs: the built pages against the content and the catalogue —
 * on a contract-3 tree, against `jtk/schema.json` in the grammar by key and by id, and every price in the
 * site's currency (`JTK_LOCAL`, the platform's preflight check). What stops the build's collection of a
 * contract-3 tree (a catalogue beside the schema, a translation before M3, …) rejects with its sentence.
 */
export function lint(options?: LintOptions): Promise<Verdict>;
/** Print the findings the way the build does; 0 when clean, 1 otherwise. */
export function lintCommand(options?: LintOptions): Promise<number>;
export const TAPPABLE: Set<string>;
export const CODES: Readonly<Record<string, string>>;
export function said(code: string, message: string): string;
/** Where a price sits in a block, by path from the block down (`rates.costs`): the platform preflight's `pricePaths`. */
export function pricePaths(blocks: unknown): Set<string>;
/** An annotation's place in its block, in either grammar, as `pricePaths` says one; `''` for one the grammar does not read. */
export function placeOf(annotation: string): string;
