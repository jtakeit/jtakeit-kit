import type { ImageMetadata } from 'astro';
import { isUpload, uploaded } from './uploads';

/**
 * The site's photographs.
 *
 * **A picture the owner may change is a field, and its value is a key of the
 * site's media library** — `{ "src": "media/<site>/<hash>.jpg", "alt": "…" }`
 * (jtakeit-core wiki/108). While a site is designed, a field may name a
 * slot — a file in src/assets by its name, `atelier-raum` for
 * `src/assets/atelier-raum.jpg` — as a working name:
 * `npx @jtakeit/astro media push '<url>'` (the URL is `media_link`'s) uploads
 * it, writes its key over the slot, keeps its words, and moves the file out of
 * src/assets once nothing in the code names it. The platform refuses a slot in
 * the content on contract 3 (`JTK_E_MEDIA_NOT_LIBRARY`, after one release of
 * advice).
 *
 * What stays a slot is the design's: a picture the code draws by name and
 * nobody edits — a texture, a background, a mark. `PHOTOS` registers those,
 * with their words in the site's language; a content picture's words are in
 * its field and in the library, where the push put them.
 *
 * **A missing file is never a build error.** `photo()` returns undefined and
 * `<Shot>` renders a labelled placeholder that keeps the frame's proportions.
 * That is what lets stage 1 proceed while the client is still finding their
 * photographs.
 */

export interface Photo {
  /** File base name in src/assets, without the extension. */
  readonly name: string;
  readonly alt: string;
  /** Portrait-shaped files can be given a taller cell by a gallery. */
  readonly tall?: boolean;
  /**
   * This is the person the business *is* — their face, not their hands, their
   * room or their work.
   *
   * It is registered because it changes what may be done to the picture. A
   * treatment that replaces skin colour — `duotone`, `press` — makes a face
   * look like stock art, and on a one-person business that face is the thing
   * being chosen. `<Shot>` refuses to apply one to a photo marked here, and
   * fails the build rather than shipping it. The gentle treatments still work.
   */
  readonly person?: boolean;
}

/**
 * What may be done to a photograph, beyond framing it.
 *
 * Client photographs arrive as a feed: twenty pictures in twenty lights, shot
 * on three phones over two years, with white balance disagreeing between every
 * pair. Cropping them well leaves them still disagreeing, and a page of
 * photographs that disagree reads as a page nobody art-directed — which is
 * exactly what it is.
 *
 * A treatment is what makes them one set. It is CSS over the picture, in the
 * variant's own tokens: no build step, no second copy of any file, nothing to
 * re-run when a photo is replaced, and it degrades to the untouched photograph
 * anywhere the blend modes do not land.
 *
 * The table of what each one is for is in `docs/photos.md` of @jtakeit/astro. Two rules travel with them: **one treatment per site**,
 * because two is the look of a demo rather than a design, and **never a strong
 * one on their face**.
 */
export type Treatment = 'none' | 'grade' | 'duotone' | 'film' | 'press' | 'recede';

export const TREATMENTS: readonly Treatment[] = [
  'none',
  'grade',
  'duotone',
  'film',
  'press',
  'recede',
];

/** Treatments that replace skin colour, and so may not touch a person. */
export const STRONG: readonly Treatment[] = ['duotone', 'press'];

export const PHOTOS: readonly Photo[] = [
  // { name: 'hero', alt: '' },
];

// Resolved by Vite at build time: files that do not exist simply never appear.
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP,avif,AVIF}',
  { eager: true },
);

const byName = new Map<string, ImageMetadata>();
const metaByName = new Map<string, Photo>();

for (const [path, mod] of Object.entries(modules)) {
  const base = path
    .split('/')
    .pop()!
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  // First file wins, so hero.jpg and hero.webp cannot fight over one slot.
  if (!byName.has(base)) byName.set(base, mod.default);
}

for (const p of PHOTOS) metaByName.set(p.name, p);

/**
 * The picture behind a name.
 *
 * A name is one of two things and this resolves both: a slot in `src/assets`,
 * which is the developer's, or a key like `media/<site>/<hash>.jpg`, which is
 * the owner's and was downloaded into `src/assets/media/` before the build. A
 * component never has to know which it was given — that is the whole point,
 * because a photograph the owner replaced in the admin has to land in exactly
 * the frame the developer's one was in.
 */
export function photo(name: string): ImageMetadata | undefined {
  if (isUpload(name)) return uploaded(name);
  return byName.get(name.toLowerCase());
}

/** What the photograph actually is, before a frame is chosen for it. */
export interface Shape {
  readonly width: number;
  readonly height: number;
  /** width / height. 0.8 for a 4:5 phone portrait, 1.78 for 16:9. */
  readonly ratio: number;
  readonly orientation: 'portrait' | 'landscape' | 'square';
}

/**
 * Measure before placing.
 *
 * A frame is a decision about which part of a photograph nobody will ever see,
 * and made by feel it is made wrong: client photos arrive in every orientation,
 * and the 4:5 portrait that carries the whole business loses more than half of
 * itself to a 16:9 band. A page that asks this first can pick the frame from
 * the picture instead of cropping the picture to the frame.
 *
 *   const owner = shape('owner');
 *   <Shot name="owner" ratio={owner?.orientation === 'portrait' ? '4 / 5' : '3 / 2'} />
 */
export function shape(name: string): Shape | undefined {
  const src = photo(name);
  if (!src) return undefined;
  const ratio = src.width / src.height;
  return {
    width: src.width,
    height: src.height,
    ratio,
    // A little tolerance: a phone crop is rarely exactly square.
    orientation: ratio > 1.05 ? 'landscape' : ratio < 0.95 ? 'portrait' : 'square',
  };
}

/**
 * Whether this slot holds the face of the person the business is.
 *
 * Unregistered means no — a photo nobody described is not asserted to be
 * anybody. The check is deliberately one-way: it can stop a treatment reaching
 * a face somebody registered, and it cannot know about one nobody did.
 */
export function isPerson(name: string): boolean {
  return metaByName.get(name)?.person === true;
}

/**
 * Whether this picture came from the admin rather than from the repository.
 *
 * Worth asking in one place: a treatment is a decision about the site's own
 * photographs, and an owner who swapped one in has not agreed to have it
 * duotoned. Nothing enforces that — it is here for a component that wants to.
 */
export { isUpload } from './uploads';

/** Registered alt text, or a neutral fallback so alt is never empty. */
export function altFor(name: string): string {
  return metaByName.get(name)?.alt ?? '';
}
