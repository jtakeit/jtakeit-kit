import type { ImageMetadata } from 'astro';

/**
 * The pictures the owner uploaded, as local files.
 *
 * ── the two places a picture can be ─────────────────────────────────────────
 *
 * `src/assets/hero.jpg` is the developer's: it is in the repository, it is
 * chosen by whoever built the site, and `photos.ts` resolves it by slot name.
 * This is the other half — a photograph somebody put in through the admin,
 * which arrives as a key like `media/<site>/<hash>.jpg` inside the content
 * document.
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
 * ── on a laptop, before any of that ─────────────────────────────────────────
 *
 * There are no downloaded files while a developer is building the site, so
 * every lookup here answers undefined and `<Shot>` draws its labelled
 * placeholder. That is the same behaviour as a missing slot, and it is what lets
 * a site be built, checked and pushed before it has ever been attached.
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
  return byKey.get(key)?.default;
}

/** An uploaded clip's address in the built site. */
export function uploadedClip(key: string): string | undefined {
  return clipsByKey.get(key);
}
