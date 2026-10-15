/**
 * Where this build is served from, and how to write an address inside it.
 *
 * ── the bug this exists to make impossible ──────────────────────────────────
 *
 * A site is served two ways and the difference is a path. On its own host it
 * is at the root, so `/preise/` and `/favicon.png` mean what they say. In the
 * studio's preview the same build is served under `https://preview…/p/<slug>/`,
 * where the root is not the site: every one of those addresses leaves it. What
 * a person sees is a page with no stylesheet, no pictures and navigation that
 * 404s — which reads as a broken build rather than as a wrong prefix, and has
 * cost three separate afternoons to diagnose from that symptom.
 *
 * Astro's `base` fixes what *it* emits — the bundled CSS, the optimised
 * images — and it cannot fix a string somebody typed. So every internal
 * address written by hand goes through `under()`, and `jtk catalogue` fails a
 * repository that writes one straight.
 *
 * A build for a real host has a base of `/`, where `under()` changes nothing.
 * That is the point: one way to write an address, correct in both places.
 */

/** The path this build is served under, always with its trailing slash. */
export function base(): string {
  const at = import.meta.env.BASE_URL ?? '/';
  return at.endsWith('/') ? at : `${at}/`;
}

/** A site-absolute path — `/preise/` — served under wherever this build is. */
export function under(path: string): string {
  return `${base()}${path.replace(/^\//, '')}`;
}
