/**
 * The palette: the eight colours a site's look is drawn in, by name, in one
 * place — `palette` in `jtk/design.json` — which Layout.astro writes on <html>
 * as the look's tokens (docs/looks.md, «The palette»).
 *
 *   background     the page
 *   surface        a card, the form, the header's capsule
 *   ink            the words
 *   muted          the quieter words: a line under a heading, a length
 *   accent         the button that books, the one colour
 *   accent-ink     the accent as words on the background — a price, a link — at 4.5:1 or more
 *   lacquer        the hero's liquid lacquer, its body in shadow
 *   lacquer-light  the same lacquer where the light lands
 *
 * Six-digit hex, every one. A palette widget's «Use this palette» says these
 * names and values; an agent writes them into `jtk/design.json` as they are,
 * and nothing else changes.
 *
 * A booking page (`jtk create --kind booking-page`, docs/booking-page.md)
 * starts from its vertical's palette below — a starting point drawn for the
 * trade, to be replaced by the business's own colours (their Instagram, their
 * room, their work) — and from `nails`' where the vertical is none of these.
 */

/** The palette's names, in the order they are said. */
export const TOKENS = Object.freeze(['background', 'surface', 'ink', 'muted', 'accent', 'accent-ink', 'lacquer', 'lacquer-light']);

/**
 * The verticals' palettes. Each was checked: `ink`, `muted` and `accent-ink`
 * read at 4.5:1 or more on `background` and on `surface` (WCAG 1.4.3), and the
 * words Layout.astro puts on `accent` (near-black or white, by its lightness)
 * read at 4.5:1 on it.
 */
export const PALETTES = Object.freeze({
  // A cherry lacquer on porcelain: the look's own (Lacqué's).
  nails: { background: '#faf6f3', surface: '#ffffff', ink: '#1c1215', muted: '#6b5a5f', accent: '#7d0f24', 'accent-ink': '#6a0c1e', lacquer: '#750b1f', 'lacquer-light': '#c23a52' },
  // Espresso and caramel: a colourist's warm browns.
  hair: { background: '#f8f4ef', surface: '#fffdfa', ink: '#1d1712', muted: '#685b51', accent: '#7a4421', 'accent-ink': '#6b3b1c', lacquer: '#4a2a1e', 'lacquer-light': '#b0703f' },
  // Midnight and steel: a barber's chair at night.
  barber: { background: '#f3f3f1', surface: '#ffffff', ink: '#121417', muted: '#585d66', accent: '#1e2550', 'accent-ink': '#1e2550', lacquer: '#141a3d', 'lacquer-light': '#5b6fd6' },
  // Mauve and pearl: lashes and brows.
  lashes: { background: '#faf7f8', surface: '#ffffff', ink: '#1d1619', muted: '#695d63', accent: '#7c3b5c', 'accent-ink': '#6e334f', lacquer: '#4d2337', 'lacquer-light': '#c98aa8' },
  // Sage and stone: a massage room.
  massage: { background: '#f5f5f0', surface: '#fdfdfa', ink: '#171a15', muted: '#5b6256', accent: '#435c3a', 'accent-ink': '#3a5032', lacquer: '#27361f', 'lacquer-light': '#8aa77a' },
  // Rose glaze: a cosmetologist's treatment room.
  cosmetology: { background: '#fbf8f6', surface: '#ffffff', ink: '#1c1718', muted: '#675c5e', accent: '#9a3f55', 'accent-ink': '#86364a', lacquer: '#5c2a35', 'lacquer-light': '#e3a3b0' },
  // Ink and ember on a dark page: a tattoo studio.
  tattoo: { background: '#121012', surface: '#1c1a1d', ink: '#f1ede8', muted: '#aaa29b', accent: '#e0533a', 'accent-ink': '#ff8a70', lacquer: '#3a0d0d', 'lacquer-light': '#d9452b' },
  // A clear blue on paper: a coach.
  coach: { background: '#f6f6f3', surface: '#ffffff', ink: '#111317', muted: '#575c65', accent: '#2a44c4', 'accent-ink': '#2339a8', lacquer: '#0f1d5c', 'lacquer-light': '#5d7cff' },
  // Orange heat on chalk: a trainer.
  trainer: { background: '#f3f3ef', surface: '#ffffff', ink: '#121212', muted: '#5a5a56', accent: '#b8401a', 'accent-ink': '#a33815', lacquer: '#2a0f05', 'lacquer-light': '#ff7a3d' },
  // Teal and linen: a therapist's quiet room.
  therapist: { background: '#f6f4ef', surface: '#fffefb', ink: '#1b1d1c', muted: '#5d625e', accent: '#33605b', 'accent-ink': '#2c5450', lacquer: '#173b38', 'lacquer-light': '#7fb3ab' },
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
  const out = [];
  for (const name of TOKENS) if (!/^#[0-9a-f]{6}$/i.test(String(value[name] ?? ''))) out.push(`${name}: «${value[name] ?? ''}» is not a six-digit hex colour`);
  for (const name of Object.keys(value)) if (!TOKENS.includes(name)) out.push(`${name}: not a name of the palette — ${TOKENS.join(', ')}`);
  return out;
}
