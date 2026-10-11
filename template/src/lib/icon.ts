/**
 * The site's icon — the picture in the browser tab, on a phone's home screen,
 * beside the site in a list of search results.
 *
 * One source, and everything else made from it at build time:
 *
 *   public/icon.png      the business's mark as a picture (square, 180px or
 *                        more), when it has one that is not a vector
 *   public/favicon.svg   otherwise — the mark as SVG, or, until somebody
 *                        gives one, the monogram `jtk create` wrote from the
 *                        business's name (marked `data-jtk-monogram`)
 *
 * The 32px tab icon and the 180px home-screen icon are rendered from it
 * (`src/pages/favicon-32.png.ts`, `apple-touch-icon.png.ts`), so replacing the
 * one file replaces all of them. Ask the developer for the business's mark —
 * a logo file, the sign over the door — before launch; the platform's
 * preflight says when the site still wears the monogram (docs/pages.md,
 * «The icon»).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const PUBLIC = join(process.cwd(), 'public');

/** Whether the mark is a picture rather than SVG — `Layout.astro` then links only the PNGs. */
export const RASTER_MARK = existsSync(join(PUBLIC, 'icon.png'));

/** The icon at `size`×`size`, as PNG bytes — an ArrayBuffer, which every TypeScript takes as a response body. */
export async function iconPng(size: number): Promise<ArrayBuffer> {
  const source = RASTER_MARK ? join(PUBLIC, 'icon.png') : join(PUBLIC, 'favicon.svg');
  if (!existsSync(source)) {
    throw new Error('the site has no icon: public/favicon.svg or public/icon.png (src/lib/icon.ts)');
  }
  const input = readFileSync(source);
  const out = await sharp(input, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}
