/**
 * The grounds a page can be printed on.
 *
 * Data only — no DOM, no colour. `Pattern.astro` owns the layer, the ink and
 * every way it is allowed to fail; this file is what each ground actually looks
 * like, which is the part worth reading on its own.
 *
 * ── one idea holds the whole catalogue together ─────────────────────────────
 *
 * **A ground is a stencil, and the ink is a token.** Nothing here names a
 * colour. A stencil ground is an alpha mask over a layer painted in
 * `--pattern-ink`; a drawn ground is line art stroked in `currentColor`, which
 * is the same token. So a variant that changes its palette — or the studio
 * bar's live accent picker — repaints the ground with it, and a ground can
 * never arrive in somebody else's colour the way a shipped background image
 * would.
 *
 * The two mechanisms exist because they do different work:
 *
 *   STENCILS   a repeating figure with no beginning and no end. CSS only:
 *              a mask image, no markup, no bytes past this file.
 *   DRAWINGS   one composition that bleeds off its box. SVG, because a figure
 *              has a size and a place, and because strokes can draw themselves.
 *
 * Adding one is a row in either record. What it has to earn is a *different
 * job*: another spacing of parallel lines is `rules` with different constants,
 * not a seventh ground. Ask what a design could do with it that it could not do
 * with the six.
 *
 * ── what the geometry is measured in ────────────────────────────────────────
 *
 *   --pattern-size     the figure's pitch: line spacing, tile, wavelength.
 *   --pattern-weight   stroke weight.
 *
 * Both are read straight out of CSS rather than passed through here, so a
 * variant can retune a ground per breakpoint — a 22px rule pitch that reads on
 * a laptop is a grey wash on a phone — without touching this file.
 */

import { GRAIN_TILE, GRAIN_SIZE } from '../../lib/noise';

export type Pattern = 'grain' | 'rules' | 'hatch' | 'contour' | 'construction' | 'motif';

/** Grounds drawn as a CSS mask: a repeating figure, no markup. */
export type Stencil = 'grain' | 'rules' | 'hatch';

/** Grounds drawn as SVG: one composition, in a place, able to draw itself. */
export type Drawn = Exclude<Pattern, Stencil>;

export const STENCILS: Record<Stencil, string> = {
  /*
   * Film grain, paper fibre, plaster. The only ground with no figure at all —
   * it is texture, and its whole job is that a flat token stops reading as a
   * fill. The tile is shared with the `film` photo treatment, which is why it
   * lives in src/lib rather than here.
   */
  grain: GRAIN_TILE,

  /*
   * The ruled plane: ledger paper, a form, a chart. Horizontal only, on
   * purpose — the square grid is the most-used background on the web and it
   * reads as a designer's default rather than as the trade's own paper. A page
   * that genuinely wants graph paper adds the second axis here as a second
   * gradient, and says in a comment which trade asked for it.
   */
  rules:
    'repeating-linear-gradient(to bottom, #000 0 var(--pattern-weight), transparent var(--pattern-weight) var(--pattern-size))',

  /*
   * Engraved hatching: one direction, the way a burin goes. Crosshatch is
   * deliberately not here — two sets at low opacity average out to a grey wash,
   * which is a tint, not a texture.
   */
  hatch:
    'repeating-linear-gradient(48deg, #000 0 var(--pattern-weight), transparent var(--pattern-weight) var(--pattern-size))',
};

/**
 * Contour lines, the way a landscape is drawn.
 *
 * Generated rather than hand-drawn, because forty hand-drawn curves is forty
 * chances to draw two the same. The seed is a constant and the arithmetic is
 * integer: the same build produces the same page, or every rebuild is a diff
 * nobody asked for.
 */
function contour(lines = 11, samples = 56, width = 1200, height = 800): string {
  let seed = 20260825;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out: string[] = [];

  for (let i = 0; i < lines; i++) {
    const base = ((i + 0.6) / (lines + 0.2)) * height;
    // Two waves per line, one slow and one fast, so no two lines run parallel
    // for long — parallel is what makes generated contours look like a comb.
    const slowAmp = 16 + rand() * 44;
    const fastAmp = 6 + rand() * 22;
    const slowFreq = 0.8 + rand() * 1.4;
    const fastFreq = 2.4 + rand() * 2.6;
    const phase = rand() * Math.PI * 2;

    const points: string[] = [];
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const y =
        base +
        Math.sin(t * Math.PI * slowFreq + phase) * slowAmp +
        Math.cos(t * Math.PI * fastFreq - phase * 1.7) * fastAmp;
      points.push(`${(t * width).toFixed(1)} ${y.toFixed(1)}`);
    }
    // pathLength="1" is what lets `draw` animate a stroke without anybody
    // measuring the path by hand — see surface.md.
    out.push(`<path pathLength="1" style="--i:${i}" d="M ${points.join(' L ')}"/>`);
  }
  return out.join('');
}

export const DRAWINGS: Record<Exclude<Drawn, 'motif'>, { viewBox: string; markup: string }> = {
  contour: { viewBox: '0 0 1200 800', markup: contour() },

  /*
   * Setting-out: the axes, circles and dotted guides a drawing is built on
   * before anything is drawn on it. It is the register of a studio that shows
   * its process.
   *
   * **It is not anybody's signature.** The build this came from had its own
   * construction geometry — the guides that particular tattooist leaves in red
   * inside her own work — and that drawing is hers. This is the generic
   * article: use it as furniture, and put the thing that could not move to
   * another site somewhere else on the page. See surface.md, and the last
   * section of shapes.md.
   */
  construction: {
    viewBox: '0 0 1200 800',
    markup: [
      // The thirds, set out first, the way a stencil is.
      '<line pathLength="1" style="--i:0" x1="400" y1="0" x2="400" y2="800"/>',
      '<line pathLength="1" style="--i:0" x1="800" y1="0" x2="800" y2="800"/>',
      '<line pathLength="1" style="--i:1" x1="0" y1="267" x2="1200" y2="267"/>',
      '<line pathLength="1" style="--i:1" x1="0" y1="533" x2="1200" y2="533"/>',
      // The circle the composition hangs from, and its inner ring.
      '<circle pathLength="1" style="--i:2" cx="800" cy="267" r="236"/>',
      '<circle pathLength="1" style="--i:3" cx="800" cy="267" r="118"/>',
      // The diagonal, and the arc that answers it.
      '<line pathLength="1" style="--i:3" x1="120" y1="740" x2="1080" y2="120"/>',
      '<path pathLength="1" style="--i:4" stroke-dasharray="2 8" d="M 164 533 A 400 400 0 0 0 964 533"/>',
      // The nodes: where the guides agree.
      '<circle pathLength="1" style="--i:5" cx="400" cy="533" r="6"/>',
      '<circle pathLength="1" style="--i:5" cx="800" cy="267" r="6"/>',
      '<circle pathLength="1" style="--i:5" cx="400" cy="267" r="6"/>',
    ].join(''),
  },
};

/** In the order the reference table lists them. */
export const PATTERNS: Pattern[] = ['grain', 'rules', 'hatch', 'contour', 'construction', 'motif'];

export const isStencil = (pattern: Pattern): pattern is Stencil => pattern in STENCILS;

/**
 * Per-ground starting values.
 *
 * Not a house style — a starting point that is *in range*. Grain wants a tile
 * two hundred pixels wide and hatch wants fourteen; one shared default would
 * put both in the wrong place, and a ground that arrives wrong is a ground
 * somebody switches off instead of tuning. The design overrides any of them
 * with a prop.
 *
 * `opacity` is the one to look at. These are quiet on purpose: a ground is read
 * at a glance and never read *at*.
 */
export const DEFAULTS: Record<Pattern, { size: string; weight: string; opacity: number }> = {
  grain: { size: GRAIN_SIZE, weight: '1px', opacity: 0.09 },
  rules: { size: '26px', weight: '1px', opacity: 0.07 },
  hatch: { size: '14px', weight: '1px', opacity: 0.06 },
  contour: { size: '100%', weight: '1px', opacity: 0.09 },
  construction: { size: '100%', weight: '1px', opacity: 0.08 },
  motif: { size: '96px', weight: '1px', opacity: 0.08 },
};

/**
 * A `<pattern>` needs an id, two motifs on one page need two, and a build must
 * produce the same document twice. A module counter is all three: it lives for
 * the build rather than for the render, so it does not reset per component and
 * does not reach for randomness.
 */
let motifs = 0;
export const nextMotifId = (): string => `jtk-motif-${(motifs += 1)}`;
