/** The published content as one document, from the files in `jtk/` — what the build renders from. */
export function collectContent(root: string, options?: { dir?: string; now?: number }): Promise<{
  schema_version: number;
  content_rev: number;
  site: { slug: string; locale: string; media_base: string; business: Record<string, unknown> };
  pages: { path: string; seo: Record<string, unknown>; blocks: Record<string, unknown>[]; collection?: string; visible?: boolean }[];
  shared?: { locale?: string; blocks: Record<string, unknown>[] }[];
}>;
export function sharedLocaleOf(name: string): string | null;
