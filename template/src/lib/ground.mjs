/**
 * Which way up a palette is, and the header's glass and words made from it
 * (the owner, 24 November 2026).
 *
 * A dark palette — `bg` #1d1312, its `ink` near white — had the header drawn
 * as the look's light porcelain with the palette's light ink on it: the name
 * and the navigation read 1.05:1 and vanished. The ground is read from the
 * palette's own `bg`: dark where near-white words read further from it than
 * near-black ones (WCAG's luminance, the same crossing as the words on the
 * accent in Layout.astro). Then
 *
 *   - the page says it is dark (`data-ground="dark"` on <html>), so every
 *     glass a look draws is its dark one, under the palette's light words;
 *   - the header's glass is the palette's own paper — translucent over the
 *     hero, nearly solid once the page passes under it — a step lighter on a
 *     light page, a step deeper on a dark one;
 *   - its words are the palette's ink and muted where they read at 4.5:1 on
 *     that glass over anything (black under a light glass, white under a dark
 *     one, the worst a photograph or the lacquer can put behind it), and
 *     near-black or near-white where they do not.
 *
 * Plain JavaScript, so a test reads the same function the build does
 * (test/booking-page.test.mjs); Layout.astro writes what it returns.
 */

/** The words on a light ground and on a dark one, where the palette's own do not read. */
export const NEAR_BLACK = '#16130f';
export const NEAR_WHITE = '#fbf8f5';
/** WCAG 1.4.3, normal text. */
export const AA = 4.5;
/** How much of the header's glass is the paper over the hero, and once the page is under it. */
export const GLASS = 0.86;
export const SOLID = 0.94;

const HEX = /^#[0-9a-f]{6}$/i;

/** `#rrggbb` → [r, g, b], 0–255; null for anything else. */
export function rgbOf(hex) {
  if (typeof hex !== 'string' || !HEX.test(hex.trim())) return null;
  const n = parseInt(hex.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hexOf = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** WCAG relative luminance of `#rrggbb`; null for anything else. */
export function luminance(hex) {
  const rgb = rgbOf(hex);
  if (rgb === null) return null;
  return rgb
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

/** WCAG contrast ratio of two `#rrggbb`, 1 to 21. */
export function contrast(a, b) {
  const [x, y] = [luminance(a) ?? 0, luminance(b) ?? 0].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** `a` laid at `amount` (0–1) over `b`, as one colour. */
export function over(a, b, amount) {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  if (x === null || y === null) return a;
  return hexOf(x.map((v, i) => v * amount + y[i] * (1 - amount)));
}

/** Whether a page of this paper is dark: near-white words read further from it than near-black ones. */
export function isDark(bg) {
  return rgbOf(bg) !== null && contrast(bg, NEAR_WHITE) > contrast(bg, NEAR_BLACK);
}

/** The first of the words that reads at 4.5:1 on every one of the grounds, or undefined. */
function readable(grounds, ...words) {
  const worst = (one) => Math.min(...grounds.map((ground) => contrast(one, ground)));
  return words.find((one) => rgbOf(one) !== null && worst(one) >= AA);
}

/**
 * The ground a palette makes, or null where it names no `bg` (the look's own
 * tokens then stand).
 *
 * @param {{ bg?: string; ink?: string; muted?: string }} palette
 * @returns {null | { dark: boolean; glass: string; solid: string; ink: string; quiet: string; grounds: string[] }}
 *   `glass` the header's paper over the hero (drawn at GLASS), `solid` once the
 *   page is under it (drawn at SOLID), `ink` and `quiet` its words, `grounds`
 *   every colour the words were checked on.
 */
export function groundOf(palette) {
  const bg = typeof palette?.bg === 'string' ? palette.bg.trim() : '';
  if (rgbOf(bg) === null) return null;
  const dark = isDark(bg);
  const toward = dark ? '#000000' : '#ffffff';
  const far = dark ? '#ffffff' : '#000000';
  const away = dark ? NEAR_WHITE : NEAR_BLACK;
  // A light page's glass a step towards white, a dark page's a step towards black — and
  // further, a tenth at a time, where a paper of the middle greys leaves no words that read.
  for (let step = 0; step <= 10; step++) {
    const glass = over(bg, toward, Math.max(0, 0.9 - step * 0.1));
    const solid = over(bg, toward, Math.max(0, (dark ? 0.82 : 0.4) - step * 0.1));
    // What the words stand on: the glass alone, and the glass over the worst a photograph can put behind it.
    const grounds = [glass, solid, over(glass, far, GLASS), over(solid, far, SOLID)];
    const ink = readable(grounds, palette.ink, away, dark ? '#ffffff' : '#000000');
    if (ink === undefined) continue;
    const quiet = readable(grounds, palette.muted, ink);
    return { dark, glass, solid, ink, quiet, grounds };
  }
  throw new Error(`no words read on a glass made from ${bg}`);
}
