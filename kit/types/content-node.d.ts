/** `@jtakeit/kit/content/node` — the files the door reads, from a disk. */

/** Every `.json` under `jtk/`, keyed `/jtk/…`, parsed; `media/` directories and `jtk/session.json` left out. */
export function readJtk(root?: string, options?: { dir?: string }): Promise<Record<string, unknown>>;

/**
 * A contract-3 tree's missing names written in: an `id` on each page and entry,
 * a `_key` on each block, row and picture (wiki/98 §15 · 12); what was minted,
 * file by file. Nothing on a tree that is not contract 3.
 */
export function mintJtk(root?: string, options?: { dir?: string }): Promise<{ file: string; place: string; what: 'id' | 'key' }[]>;

/** The published content as one document, from the files in `jtk/` — what the build renders from. */
export function collectContent(root: string, options?: { dir?: string; now?: number }): Promise<{
  schema_version: number;
  content_rev: number;
  site: { slug: string; locale: string; media_base: string; business: Record<string, unknown> };
  pages: { path: string; seo: Record<string, unknown>; blocks: Record<string, unknown>[]; collection?: string; visible?: boolean }[];
  shared?: { locale?: string; blocks: Record<string, unknown>[] }[];
}>;
