import type { ImageMetadata } from 'astro';
import { fromBucket, sizeOf } from '@jtakeit/kit/live';

/**
 * The pictures the owner uploaded, as local files.
 *
 * ── the one place a content picture is ──────────────────────────────────────
 *
 * A picture a field names lives in the site's media library, and the content
 * names it by its key, `media/<site>/<hash>.jpg` (jtakeit-core wiki/108). An
 * agent puts its photographs there with `npx @jtakeit/astro media push`; the
 * owner with the panel. `src/assets/hero.jpg` — a slot `photos.ts` resolves
 * by name — is the code's own: a design asset, or a working name until the
 * push turns it into a key.
 *
 * **They are both local files by the time this runs.** The build's second step
 * downloads every key the content names into `src/assets/`, before `npm run
 * build`, precisely so that a photograph from the admin goes through
 * `astro:assets` exactly as one from the repository does: variants, `srcset`,
 * width hints, the lot. Nothing here fetches anything.
 *
 * That matters more than it sounds. A gallery of thirty-seven pictures served
 * as uploaded is fifteen megabytes; the same gallery through the image pipeline
 * is under two. The difference is not visible to anybody building the site — it
 * is visible to somebody on a phone, on a train, deciding whether to wait.
 *
 * ── on a laptop ─────────────────────────────────────────────────────────────
 *
 * The same files, in the same place, git-ignored: `jtk media push` keeps a
 * copy of each file it sends, `jtk pull` and `jtk media pull` download the
 * ones the content names, and under `astro dev` the integration fetches any
 * the copy still lacks from the public media host (`libraryPictures` in
 * jtakeit-meta.mjs). A key with no file yet draws `<Shot>`'s labelled
 * placeholder, as a missing slot does — which is what lets a site be built,
 * checked and pushed before it has a picture.
 */

/**
 * Anything under `src/assets/media/` — which is only ever what the build put
 * there, keyed by the key itself.
 *
 * `import.meta.glob` needs a literal pattern, so this cannot be narrowed by the
 * site id; the map is small (a site's own pictures) and built once.
 */
const pictures = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/media/**/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP,avif,AVIF}',
  { eager: true },
);

/**
 * Clips, as URLs rather than as metadata.
 *
 * `astro:assets` optimises pictures and has nothing to do to a video, so a clip
 * takes the ordinary asset path: Vite emits the file and hands back its final
 * address, hashed and cacheable. The clips are already small — `jt-clips` cuts
 * them to a tenth of a megabyte — so there is nothing to gain by doing more.
 */
const clips = import.meta.glob<string>('/src/assets/media/**/*.{mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const PREFIX = '/src/assets/';

function keyed<T>(modules: Record<string, T>): Map<string, T> {
  const out = new Map<string, T>();
  for (const [path, value] of Object.entries(modules)) {
    out.set(path.slice(PREFIX.length), value);
  }
  return out;
}

const byKey = keyed(pictures);
const clipsByKey = keyed(clips);

/** Whether a value from the content document is a key rather than a slot. */
export function isUpload(value: string): boolean {
  return value.startsWith('media/');
}

/** An uploaded photograph, ready for `<Image>`. */
export function uploaded(key: string): ImageMetadata | undefined {
  return byKey.get(key)?.default ?? fromTheDraft(key);
}

/** An uploaded clip's address in the built site. */
export function uploadedClip(key: string): string | undefined {
  return clipsByKey.get(key) ?? (/\.(mp4|webm)$/i.test(key) ? fromBucket(key) : undefined);
}

/**
 * ── a picture uploaded since the last build ─────────────────────────────────
 *
 * The panel's live preview draws a draft between builds (jtakeit-core wiki/89
 * §12), and a photograph the owner has just uploaded is in the draft and in no
 * build's `src/assets/`. There it is the bucket's file as it is, at the size
 * the platform measured when it was uploaded — under a draft only: a build
 * that has not fetched a picture draws the placeholder, as it always has.
 */
function fromTheDraft(key: string): ImageMetadata | undefined {
  if (!/\.(jpe?g|png|webp|avif)$/i.test(key)) return undefined;
  const src = fromBucket(key);
  if (src === undefined) return undefined;
  const size = sizeOf(key) ?? { width: 1600, height: 1200 };
  const format = (/\.([a-z0-9]+)$/i.exec(key)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg') as ImageMetadata['format'];
  return { src, width: size.width, height: size.height, format };
}
