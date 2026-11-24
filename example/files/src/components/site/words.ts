/**
 * The few words of the site's frame that are not the business's: what a
 * label over the address says, the days of the week, «Open now». Interface,
 * like the form's «Sending…» (src/copy): the same for every business, drawn
 * `data-jtk-fixed`, in the page's language — and English where this has none.
 *
 * Everything the business says — its name, its address, its hours, the
 * navigation, the button — is content, in jtk/shared.json, and tapped in the
 * panel.
 */
export interface FrameWords {
  menu: string;
  close: string;
  home: string;
  navigation: string;
  language: string;
  address: string;
  hours: string;
  write: string;
  directions: string;
  closed: string;
  openNow: string;
  closedNow: string;
  follow: string;
  legal: string;
  built: string;
  imprint: string;
  all: string;
  /** A gallery's picture that is a link to its post: what a key and a screen reader say of it. */
  post: string;
  days: Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', string>;
}

const WORDS: Record<string, FrameWords> = {
  en: {
    menu: 'Menu', close: 'Close', language: 'Language', home: 'Home', navigation: 'Main', address: 'Address', hours: 'Opening hours', write: 'Write or call',
    directions: 'Directions', closed: 'Closed', openNow: 'Open now', closedNow: 'Closed now', follow: 'Follow', legal: 'Legal',
    built: 'Built on', imprint: 'Imprint', all: 'All', post: 'Open this post on Instagram',
    days: { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' },
  },
  de: {
    menu: 'Menü', close: 'Schliessen', language: 'Sprache', home: 'Startseite', navigation: 'Hauptnavigation', address: 'Adresse', hours: 'Öffnungszeiten', write: 'Schreiben oder anrufen',
    directions: 'Wegbeschreibung', closed: 'Geschlossen', openNow: 'Jetzt geöffnet', closedNow: 'Jetzt geschlossen', follow: 'Folgen', legal: 'Rechtliches',
    built: 'Gebaut mit', imprint: 'Impressum', all: 'Alle', post: 'Diesen Beitrag auf Instagram öffnen',
    days: { monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch', thursday: 'Donnerstag', friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag' },
  },
  fr: {
    menu: 'Menu', close: 'Fermer', language: 'Langue', home: 'Accueil', navigation: 'Principale', address: 'Adresse', hours: 'Horaires', write: 'Écrire ou appeler',
    directions: 'Itinéraire', closed: 'Fermé', openNow: 'Ouvert', closedNow: 'Fermé', follow: 'Suivre', legal: 'Mentions',
    built: 'Fait avec', imprint: 'Mentions légales', all: 'Tout', post: 'Ouvrir cette publication sur Instagram',
    days: { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' },
  },
  it: {
    menu: 'Menu', close: 'Chiudi', language: 'Lingua', home: 'Home', navigation: 'Principale', address: 'Indirizzo', hours: 'Orari', write: 'Scrivere o chiamare',
    directions: 'Indicazioni', closed: 'Chiuso', openNow: 'Aperto ora', closedNow: 'Chiuso ora', follow: 'Seguire', legal: 'Note legali',
    built: 'Fatto con', imprint: 'Colophon', all: 'Tutto', post: 'Apri questo post su Instagram',
    days: { monday: 'Lunedì', tuesday: 'Martedì', wednesday: 'Mercoledì', thursday: 'Giovedì', friday: 'Venerdì', saturday: 'Sabato', sunday: 'Domenica' },
  },
};

/** The frame's words in a language — `de-CH` reads German's — and English's where there are none. */
export function frameWords(lang: string): FrameWords {
  return WORDS[lang] ?? WORDS[lang.split('-')[0]] ?? WORDS.en;
}

/** Whether the frame's words are this language's own, or English standing in: put it on what says them, as `lang`. */
export function frameLang(lang: string): string | undefined {
  return WORDS[lang] ?? WORDS[lang.split('-')[0]] ? undefined : 'en';
}

/** `540` → `09:00`: a time of day, minutes from midnight, as the 24-hour clock says it. */
export function clock(minutes: unknown): string {
  const n = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.max(0, Math.min(1440, Math.round(minutes))) : 0;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

/** The days in their order, Monday first. */
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * The time zone of a country that keeps one, by its two letters — what the
 * shared contacts' `country` says. «Open now» is the business's clock, never
 * the visitor's: a visitor abroad, or a browser on another zone, looking at a
 * barber in Zurich at 18:58 Zurich time must read «closed» when the shop
 * closes at 18:00. A country of several zones (the United States, Spain with
 * the Canaries, Portugal with the Azores, Australia…) is not here: there the
 * diary's own zone says it, or «open now» is not said at all.
 */
const COUNTRY_ZONES: Record<string, string> = {
  AD: 'Europe/Andorra', AL: 'Europe/Tirane', AT: 'Europe/Vienna', BA: 'Europe/Sarajevo', BE: 'Europe/Brussels', BG: 'Europe/Sofia',
  CH: 'Europe/Zurich', CZ: 'Europe/Prague', DE: 'Europe/Berlin', DK: 'Europe/Copenhagen', EE: 'Europe/Tallinn', FI: 'Europe/Helsinki',
  FR: 'Europe/Paris', GB: 'Europe/London', GE: 'Asia/Tbilisi', GR: 'Europe/Athens', HR: 'Europe/Zagreb', HU: 'Europe/Budapest',
  IE: 'Europe/Dublin', IS: 'Atlantic/Reykjavik', IT: 'Europe/Rome', LI: 'Europe/Vaduz', LT: 'Europe/Vilnius', LU: 'Europe/Luxembourg',
  LV: 'Europe/Riga', MC: 'Europe/Monaco', MD: 'Europe/Chisinau', ME: 'Europe/Podgorica', MK: 'Europe/Skopje', MT: 'Europe/Malta',
  NL: 'Europe/Amsterdam', NO: 'Europe/Oslo', PL: 'Europe/Warsaw', RO: 'Europe/Bucharest', RS: 'Europe/Belgrade', SE: 'Europe/Stockholm',
  SI: 'Europe/Ljubljana', SK: 'Europe/Bratislava', SM: 'Europe/San_Marino', TR: 'Europe/Istanbul', UA: 'Europe/Kyiv', VA: 'Europe/Vatican',
  AE: 'Asia/Dubai', IL: 'Asia/Jerusalem', IN: 'Asia/Kolkata', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', SG: 'Asia/Singapore',
};

/**
 * The zone the business's hours are on the clock of: the diary's own
 * (`jtk/modules/bookings.json`'s `zone`) where the site takes bookings and
 * says one, else its country's, where the country keeps one zone — `''`
 * where neither says, and then nothing claims open or closed.
 */
export function zoneOf(diaryZone: unknown, country: unknown): string {
  const said = typeof diaryZone === 'string' ? diaryZone.trim() : '';
  if (said !== '') return said;
  return COUNTRY_ZONES[typeof country === 'string' ? country.trim().toUpperCase() : ''] ?? '';
}

/** An opening span: the day (0 Monday … 6 Sunday), when it opens and when it closes, minutes from midnight. */
export type Span = readonly [number, number, number];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Whether the hours are open at a moment, on the clock of a zone — the
 * weekday and the time of day are the zone's (`Intl.DateTimeFormat` with
 * `timeZone`), never the browser's own. A span that closes before it opens
 * runs past midnight into the next day; one that closes as it opens is none. `undefined` where the zone is
 * none, or one this browser does not know: then nothing is claimed.
 */
export function openAt(spans: readonly Span[], zone: string, at: Date): boolean | undefined {
  if (zone === '') return undefined;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  } catch {
    return undefined;
  }
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';
  const day = WEEKDAYS.indexOf(part('weekday'));
  const minute = (Number(part('hour')) % 24) * 60 + Number(part('minute'));
  if (day < 0 || !Number.isFinite(minute)) return undefined;
  const yesterday = (day + 6) % 7;
  return spans.some(([d, from, to]) =>
    to >= from ? d === day && minute >= from && minute < to : (d === day && minute >= from) || (d === yesterday && minute < to),
  );
}
