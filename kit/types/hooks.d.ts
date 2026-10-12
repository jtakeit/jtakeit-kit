export interface Hook {
  hook: string;
  says: string;
}
/** Every form has these, or it cannot book. */
export const ALWAYS: readonly Hook[];
/** Shown only when the platform's answer asks; preflight fails a form without one where the business asks. */
export const ASKED: readonly (Hook & { when: string })[];
/** Where the element writes what happened; left out, that line is not said. */
export const SAID: readonly Hook[];
export const HOOKS: readonly string[];
export function lacking(form: ParentNode): string[];
