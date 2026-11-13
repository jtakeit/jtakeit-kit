/** `@jtakeit/kit/live` — a draft rendered live, the request's own door (jtakeit-core wiki/89 §12). */

/** What the renderer hands a request: the draft's `jtk/` files, and what the platform knows of its pictures. */
export interface Draft {
  files: Record<string, unknown>;
  media: Record<string, { width: number; height: number }>;
  memo: Map<string, unknown>;
}

/** The draft the request being rendered carries, or undefined: a build, or a request without one. */
export function draft(): Draft | undefined;

/** Something made of the draft once per request, or undefined where there is no draft. */
export function inDraft<T>(key: string, make: (now: Draft) => T): T | undefined;

/** The door every template imports, as the request's: the build's, or one made of the draft's files. */
export function live<Door extends object>(built: Door, doorOf: (files: Record<string, unknown>) => Door): Door;

/** A request rendered inside the draft it carries (`locals.jtkDraft`); untouched where it carries none. */
export function rendering(locals: Record<string, unknown>, next: () => Promise<Response>): Promise<Response>;

/** Where a picture the draft names is served from while no build has fetched it: the bucket. */
export function fromBucket(key: string): string | undefined;

/** A picture's size, where the platform said it with the draft. */
export function sizeOf(key: string): { width: number; height: number } | undefined;
