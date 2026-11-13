/**
 * What the build found on the disk, for code that renders a page — written by
 * jtakeit-meta.mjs when the build starts, so a page rendered on request (the
 * panel's live preview, jtakeit-core wiki/89 §12) reads no disk.
 */
declare module 'virtual:jtk/build' {
  /** Every file under src/pages, from there: `[...lang]/blog/index.astro`. */
  export const PAGE_FILES: readonly string[];
  /** Whether public/icon.png is there: the mark is a picture rather than SVG (src/lib/icon.ts). */
  export const RASTER_MARK: boolean;
}
