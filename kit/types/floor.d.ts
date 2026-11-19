/** One piece of the floor's advice: where, and what to do. */
export interface FloorFinding { where: string; says: string }
/** F1: every height in vh, svh or dvh in one file's styles (`var(--screen, 100svh)`'s fallback aside). */
export function screenHeightsIn(text: string, where: string): FloorFinding[];
/** F1 over a site's src/. */
export function screenHeights(root: string): FloorFinding[];
/** F2: a family named and never loaded, a face from a third party, own faces with no preload or no measured stand-in. */
export function fontFaults(input: { css: { where: string; text: string }[]; html?: { where: string; text: string }[] }): FloorFinding[];
export function builtType(dist: string): { css: { where: string; text: string }[]; html: { where: string; text: string }[] };
export function sourceType(root: string): { css: { where: string; text: string }[]; html: { where: string; text: string }[] };
/** Both, the fonts off the build where there is one. Advice, never a refusal. */
export function floorAdvice(root: string, dist?: string): FloorFinding[];
