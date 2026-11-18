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
/** The names in the page's address the element opens the form on: `?service=…&day=YYYY-MM-DD&time=HH:MM`. */
export const LINK: Readonly<{ service: 'service'; day: 'day'; time: 'time' }>;
/** What a page's address asks the form to open on — only what parses. */
export function linkIn(search: string | URLSearchParams): { services: string[]; day: string; time: string };
