/**
 * What a piece is drawn on, and so how wide it may be (global.css, docs/kit.md
 * «The floor»).
 *
 *   paper   text and photographs on the page's own ground — the reading
 *           measure, a line the eye can follow back
 *   filled  a surface of its own — a calendar, a form, a card, a price list —
 *           the object measure: wider, one width with the header's capsule
 *   bleed   from the screen's edge to the screen's edge — the beginning and
 *           the end of a page
 *
 * A piece that takes `surface` writes `data-measure` with what this says, and
 * global.css's three rules cap it; the look decides the widths, the piece
 * never names one.
 */
export type Surface = 'paper' | 'filled' | 'bleed';

const MEASURE: Record<Surface, 'read' | 'object' | 'full'> = { paper: 'read', filled: 'object', bleed: 'full' };

/** The `data-measure` of a surface. */
export function measureOf(surface: Surface): 'read' | 'object' | 'full' {
  return MEASURE[surface] ?? 'object';
}
