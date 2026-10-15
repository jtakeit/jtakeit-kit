/**
 * The ways a body of work can be shown.
 *
 * Data only — no DOM. `Gallery.astro` owns the markup, the motion and every
 * path back to a still page; this file is what each arrangement is *for*, which
 * is the part worth reading before choosing one.
 *
 * ── the choice is made by the material, not by taste ────────────────────────
 *
 * A tattooist with eight hundred posts and thirty-seven usable frames is not
 * the same problem as a baker with nine. The first needs volume to read as
 * volume; the second needs nine pictures each given room, because a wall of
 * nine looks like a business that has done nine jobs.
 *
 * So the first question is how much work there is, and the second is whether
 * the work has an order. Everything else follows.
 *
 * ── what an arrangement may not do ─────────────────────────────────────────
 *
 * Whatever it looks like, every one clears the same floor: no photograph is
 * stretched, nothing readable sits inside a moving surface, nothing scrolls the
 * page sideways, and `prefers-reduced-motion` gets the work laid out in full
 * and still — the finished thing, never a shorter one.
 */

export type Arrangement = 'ragged' | 'wall' | 'contact' | 'strip' | 'spread' | 'index' | 'deck' | 'coverflow' | 'focus' | 'stage' | 'morph' | 'sphere';

export interface Recipe {
  /** One line, for the table in references/gallery.md. */
  readonly what: string;
  /** How many pieces it wants. Below the floor it looks thin; above the ceiling it stops reading. */
  readonly works: readonly [number, number];
  /** Whether it moves on its own. Only one arrangement does, and it is bounded. */
  readonly moves: boolean;
  /** Columns, where the arrangement has them. */
  readonly columns: number;
}

export const GALLERIES: Record<Arrangement, Recipe> = {
  /*
   * The default, and the one to argue against rather than for. Columns of
   * photographs at their own proportions, nothing cropped to a square, nothing
   * moving. A calf is not the shape a forearm is, and a grid of squares takes
   * the tattoo out of half of them.
   */
  ragged: { what: 'Still columns, every picture its own proportions.', works: [6, 24], moves: false, columns: 3 },

  /*
   * Volume as the argument. Columns drifting in opposite directions inside a
   * window about two photographs tall, so thirty-seven frames read as one
   * moving surface rather than as a very long list.
   *
   * It is the only arrangement here that moves on its own, and the kit argues
   * against that by default — see the Motion section in the astro-kit skill.
   * What buys the exception is in Gallery.astro, and it is three conditions
   * rather than an opinion.
   */
  wall: { what: 'Columns drifting in opposite directions inside a window.', works: [18, 200], moves: true, columns: 3 },

  /*
   * A contact sheet: uniform cells, small, many at once, deliberately dense.
   * Where the wall says "there is a lot of this" by moving, this says it by
   * fitting eighty things on one screen. Wants work that survives being small —
   * strong silhouettes, not fine line detail.
   */
  contact: { what: 'Uniform small cells, dense, many at once.', works: [24, 200], moves: false, columns: 6 },

  /*
   * One row, scroll-snapped, moved by the visitor. The arrangement for work
   * that has an *order*: a process, a before and an after, a series. It scrolls
   * inside its own container and never takes the page sideways with it.
   */
  strip: { what: 'One row, snapped, dragged by the visitor.', works: [3, 20], moves: false, columns: 1 },

  /*
   * A few, large. One piece per band, given the width it deserves. For a master
   * with six outstanding photographs rather than sixty adequate ones — and the
   * honest answer whenever the feed has been picked over and there is simply
   * not much.
   */
  spread: { what: 'A few pieces, each given the full width.', works: [3, 10], moves: false, columns: 1 },

  /*
   * A list: a small frame, and words beside it. Where what the work *is* —
   * where on the body, how long it took, what it covered — matters as much as
   * how it looks, and where a caption is the argument. Needs captions; without
   * them it is a bad `ragged`.
   */
  index: { what: 'Rows: a small frame and the words beside it.', works: [4, 30], moves: false, columns: 1 },

  /*
   * Prints on a table. The pieces lie in a loose pile, the top one is thrown
   * off — dragged and let go, or the arrow, or a key — and slides back in at
   * the bottom. For work held in the hand: a cut, a cake, a ring. One piece is
   * looked at at a time, which is the whole point and the whole cost: it is
   * not how to show volume.
   */
  deck: { what: 'A loose pile of prints, the top one thrown off by the visitor.', works: [4, 24], moves: false, columns: 1 },

  /*
   * A row the visitor scrolls, with the pieces on either side of the middle
   * turned away in depth. The strip's honest mechanics — native scrolling,
   * snapping, nothing hijacked — with the one centred piece given the stage.
   * Without JavaScript, or with reduced motion, it is a strip.
   */
  coverflow: { what: 'A scrolled row, the side pieces turned away in depth.', works: [5, 30], moves: false, columns: 1 },

  /*
   * The same row, racked like a lens: the centred piece sharp and full size,
   * its neighbours softened, smaller and quieter by how far they sit from the
   * middle, continuously as the row is scrolled. For photographs that want to
   * be looked at one by one without losing sight of the rest.
   */
  focus: { what: 'A scrolled row racked like a lens: the middle sharp, the rest soft.', works: [4, 30], moves: false, columns: 1 },

  /*
   * One large frame and a row of small ones over its foot. For a portfolio
   * somebody browses — every piece reachable in one tap, the one chosen shown
   * large. Native scrolling under both, so a swipe on a phone is a swipe.
   */
  stage: { what: 'One large frame, a row of thumbnails over its foot.', works: [4, 30], moves: false, columns: 1 },

  /*
   * One frame at a time, and the next one burns through the last — a noise
   * field dissolves the old picture, the bright parts of the new one first.
   * WebGL, one shader, no library; a browser without it, or reduced motion,
   * gets the same frame changed plainly. For a business whose pictures are
   * atmosphere — a room, a light, a mood — rather than a catalogue.
   */
  morph: { what: 'One frame at a time, dissolving into the next through noise.', works: [3, 16], moves: false, columns: 1 },

  /*
   * Volume as a globe: the pieces spread over a sphere the visitor turns with a
   * drag, the near side large, the far side gone; a tap opens one. It turns
   * slowly by itself, which makes it the second arrangement that moves — so it
   * declares itself, stops under the pointer and on focus, and reduced motion
   * gets it still. Small circular frames: work that reads at thumbnail size.
   */
  sphere: { what: 'The work spread over a globe the visitor turns.', works: [20, 80], moves: true, columns: 1 },
};

export const ARRANGEMENTS = Object.keys(GALLERIES) as Arrangement[];

/**
 * One item. A name is the file in src/assets, the rest is what the page says
 * about it — and `caption` is what `index` exists for.
 */
export interface Piece {
  /**
   * A slot in `src/assets`, or a key like `media/<site>/<hash>.jpg` from the
   * content document. `<Shot>` resolves both, so a gallery fed from either
   * looks the same from here — `gallery()` in the copy adapter is what turns a
   * content field into these.
   */
  readonly name: string;
  readonly caption?: string;
  readonly alt?: string;
  /**
   * `data-jtk-path` for this picture, where the gallery is fed from the content
   * document. Without it the owner can see their work on the page and cannot
   * touch it — `jtk catalogue` fails on exactly that, and a gallery is the
   * longest list on the site to have to fix afterwards.
   *
   * It ends up on the `<img>` rather than on the frame around it, because what
   * the admin does with it is set `src`.
   */
  readonly path?: string;
  /** `data-jtk-path` for the caption, where the words come from content too. */
  readonly captionPath?: string;
  /** A clip's poster. Galleries do not render clips; `<Clip>` does. */
  readonly poster?: string;
}

/** Names alone are the common case; a caption promotes an item to a row. */
export const asPieces = (items: readonly (string | Piece)[]): Piece[] =>
  items.map((item) => (typeof item === 'string' ? { name: item } : item));

/**
 * Deal, do not slice.
 *
 * Slicing a date-ordered list into columns puts this year in one column and
 * three years ago in another, so a visitor reading down one column sees one
 * period of the work. Dealing keeps every column mixed in subject and date,
 * which is what makes any column a fair sample of the whole.
 */
export const deal = <T,>(items: readonly T[], columns: number): T[][] =>
  Array.from({ length: Math.max(1, columns) }, (_, n) =>
    items.filter((_item, i) => i % Math.max(1, columns) === n),
  );
