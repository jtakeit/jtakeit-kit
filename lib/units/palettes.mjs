/**
 * The palette: the eight colours a site's look is drawn in, by name, in one
 * place — `palette` in `jtk/design.json` — which Layout.astro writes on <html>
 * as the look's tokens (docs/looks.md, «The palette»). The names are the
 * palette widget's (`choose_palette`), in its order, so its «Use the palette …»
 * message is copied into the file one to one:
 *
 *   bg         the page                                   → --paper
 *   surface    a card, the form, the header's capsule     → --panel, --paper-lift, --surface
 *   ink        the words (7:1 or more on bg)              → --ink
 *   muted      the quieter words: a line, a length        → --ink-quiet
 *   accent     the button that books, the one colour      → --accent, --accent-deep
 *   accentInk  the words on the accent (4.5:1 or more)    → --on-accent, --on-accent-deep
 *   lacquerA   the hero's liquid lacquer, its body        → --lacquer
 *   lacquerB   the same lacquer where the light lands     → --lacquer-light
 *
 * Six-digit hex, every one. The accent as words on the page — a price, a
 * link — is made from the accent and the ink (`--accent-ink`).
 *
 * A booking page (`jtk create --kind booking-page`, docs/booking-page.md)
 * starts from its vertical's palette below — a starting point drawn for the
 * trade, to be replaced by the business's own colours (their Instagram, their
 * room, their work) — and from `nails`' where the vertical is none of these.
 */

/** The palette's names, in the order they are said. */
export const TOKENS = Object.freeze(['bg', 'surface', 'ink', 'muted', 'accent', 'accentInk', 'lacquerA', 'lacquerB']);

/**
 * Other names a palette may arrive in — the CSS-minded ones an agent reaches
 * for — to the palette's own. Layout.astro reads them too; the names to write
 * are the eight above.
 */
export const ALIASES_OF_NAMES = Object.freeze({ background: 'bg', 'accent-ink': 'accentInk', accent_ink: 'accentInk', lacquer: 'lacquerA', 'lacquer-a': 'lacquerA', 'lacquer-light': 'lacquerB', 'lacquer-b': 'lacquerB' });

/**
 * The verticals' palettes. Each was checked as the widget's are: `ink` at 7:1
 * or more on `bg`, `accentInk` at 4.5:1 or more on `accent`, and `muted` at
 * 4.5:1 on `bg` and `surface` (WCAG 1.4.3).
 */
export const PALETTES = Object.freeze({
  // A cherry lacquer on porcelain: the look's own (Lacqué's).
  nails: { bg: '#faf6f3', surface: '#ffffff', ink: '#1c1215', muted: '#6b5a5f', accent: '#7d0f24', accentInk: '#ffffff', lacquerA: '#750b1f', lacquerB: '#c23a52' },
  // Espresso and caramel: a colourist's warm browns.
  hair: { bg: '#f8f4ef', surface: '#fffdfa', ink: '#1d1712', muted: '#685b51', accent: '#7a4421', accentInk: '#ffffff', lacquerA: '#4a2a1e', lacquerB: '#b0703f' },
  // Midnight and steel: a barber's chair at night.
  barber: { bg: '#f3f3f1', surface: '#ffffff', ink: '#121417', muted: '#585d66', accent: '#1e2550', accentInk: '#ffffff', lacquerA: '#141a3d', lacquerB: '#5b6fd6' },
  // Mauve and pearl: lashes and brows.
  lashes: { bg: '#faf7f8', surface: '#ffffff', ink: '#1d1619', muted: '#695d63', accent: '#7c3b5c', accentInk: '#ffffff', lacquerA: '#4d2337', lacquerB: '#c98aa8' },
  // Sage and stone: a massage room.
  massage: { bg: '#f5f5f0', surface: '#fdfdfa', ink: '#171a15', muted: '#5b6256', accent: '#435c3a', accentInk: '#ffffff', lacquerA: '#27361f', lacquerB: '#8aa77a' },
  // Rose glaze: a cosmetologist's treatment room.
  cosmetology: { bg: '#fbf8f6', surface: '#ffffff', ink: '#1c1718', muted: '#675c5e', accent: '#9a3f55', accentInk: '#ffffff', lacquerA: '#5c2a35', lacquerB: '#e3a3b0' },
  // Ink and ember on a dark page: a tattoo studio.
  tattoo: { bg: '#121012', surface: '#1c1a1d', ink: '#f1ede8', muted: '#aaa29b', accent: '#e0533a', accentInk: '#16130f', lacquerA: '#3a0d0d', lacquerB: '#d9452b' },
  // A clear blue on paper: a coach.
  coach: { bg: '#f6f6f3', surface: '#ffffff', ink: '#111317', muted: '#575c65', accent: '#2a44c4', accentInk: '#ffffff', lacquerA: '#0f1d5c', lacquerB: '#5d7cff' },
  // Orange heat on chalk: a trainer.
  trainer: { bg: '#f3f3ef', surface: '#ffffff', ink: '#121212', muted: '#5a5a56', accent: '#b8401a', accentInk: '#ffffff', lacquerA: '#2a0f05', lacquerB: '#ff7a3d' },
  // Teal and linen: a therapist's quiet room.
  therapist: { bg: '#f6f4ef', surface: '#fffefb', ink: '#1b1d1c', muted: '#5d625e', accent: '#33605b', accentInk: '#ffffff', lacquerA: '#173b38', lacquerB: '#7fb3ab' },
});

/** The words a vertical is said in, to the palette it starts from. */
const ALIASES = {
  nail: 'nails', nails: 'nails', manicure: 'nails', pedicure: 'nails', 'nail-studio': 'nails',
  hair: 'hair', hairdresser: 'hair', salon: 'hair', colourist: 'hair', colorist: 'hair', stylist: 'hair',
  barber: 'barber', barbershop: 'barber',
  lash: 'lashes', lashes: 'lashes', brow: 'lashes', brows: 'lashes', 'lashes-brows': 'lashes', 'lash-brow': 'lashes',
  massage: 'massage', masseur: 'massage', masseuse: 'massage', spa: 'massage',
  cosmetology: 'cosmetology', cosmetologist: 'cosmetology', beauty: 'cosmetology', skincare: 'cosmetology', facial: 'cosmetology',
  tattoo: 'tattoo', tattooist: 'tattoo', piercing: 'tattoo',
  coach: 'coach', coaching: 'coach', mentor: 'coach',
  trainer: 'trainer', 'personal-trainer': 'trainer', fitness: 'trainer', gym: 'trainer', sport: 'trainer',
  therapist: 'therapist', therapy: 'therapist', psychologist: 'therapist', counsellor: 'therapist', counselor: 'therapist', physio: 'therapist',
};

/** The vertical a word names among the palettes', or `''`. */
export function verticalOf(said) {
  const key = String(said ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return ALIASES[key] ?? '';
}

/** The palette a vertical starts from: its own, or the look's (nails') where it names none. */
export function paletteFor(said) {
  return { ...PALETTES[verticalOf(said) || 'nails'] };
}

/**
 * Whether a value is a palette: the eight names, each a six-digit hex — what
 * `jtk/design.json` may hold and a widget may send. Returns the names that are
 * wrong, empty where it is one.
 */
export function paletteFaults(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['the palette is an object of the eight names'];
  value = namedOver(value);
  const out = [];
  for (const name of TOKENS) if (!/^#[0-9a-f]{6}$/i.test(String(value[name] ?? ''))) out.push(`${name}: «${value[name] ?? ''}» is not a six-digit hex colour`);
  for (const name of Object.keys(value)) if (!TOKENS.includes(name)) out.push(`${name}: not a name of the palette — ${TOKENS.join(', ')}`);
  return out;
}

/** A palette with any name of `ALIASES_OF_NAMES` said as the palette's own. */
export function namedOver(value) {
  const out = {};
  for (const [name, one] of Object.entries(value ?? {})) out[ALIASES_OF_NAMES[name] ?? name] = one;
  return out;
}

/**
 * The palette a widget's message says — «Use the palette "Blush": bg #f7ece9,
 * surface #fffaf8, …» — as the object to write: every `name #hex` it names,
 * by the palette's names.
 */
export function paletteFromMessage(text) {
  const out = {};
  for (const [, name, hex] of String(text).matchAll(/([A-Za-z][\w-]*)\s*[:=]?\s*(#[0-9a-fA-F]{6})\b/g)) out[ALIASES_OF_NAMES[name] ?? name] = hex.toLowerCase();
  return out;
}
