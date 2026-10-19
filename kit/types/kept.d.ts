/** Where the copies go: under Astro's hashed directory, which the edge keeps for a year. */
export const KEPT_DIR: string;

/** `scene-1.webp` and its bytes → `scene-1.3f9a1c2b.webp`. */
export function keptName(name: string, bytes: Uint8Array): string;

export interface Kept {
  /** Every copy, as addresses: `/clips/a.mp4` → `/_astro/kept/clips/a.3f9a1c2b.mp4`. */
  kept: { from: string; to: string }[];
  /** How many references in the build were pointed at a copy. */
  rewritten: number;
  /** Addresses no file of the build named whole — still served by name, at the edge's minute. */
  unreferenced: string[];
}

/**
 * Copies the files under `dirs` of a build directory to names that carry a
 * hash of their bytes, under `/_astro/kept/`, and points the build's literal
 * references at them. The originals stay.
 */
export function keepByName(dist: string, options: { dirs: string[]; base?: string }): Kept;
