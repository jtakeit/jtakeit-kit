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
  days: Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', string>;
}

const WORDS: Record<string, FrameWords> = {
  en: {
    menu: 'Menu', close: 'Close', language: 'Language', home: 'Home', navigation: 'Main', address: 'Address', hours: 'Opening hours', write: 'Write or call',
    directions: 'Directions', closed: 'Closed', openNow: 'Open now', closedNow: 'Closed now', follow: 'Follow', legal: 'Legal',
    built: 'Built on', imprint: 'Imprint', all: 'All',
    days: { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' },
  },
  de: {
    menu: 'Menü', close: 'Schliessen', language: 'Sprache', home: 'Startseite', navigation: 'Hauptnavigation', address: 'Adresse', hours: 'Öffnungszeiten', write: 'Schreiben oder anrufen',
    directions: 'Wegbeschreibung', closed: 'Geschlossen', openNow: 'Jetzt geöffnet', closedNow: 'Jetzt geschlossen', follow: 'Folgen', legal: 'Rechtliches',
    built: 'Gebaut mit', imprint: 'Impressum', all: 'Alle',
    days: { monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch', thursday: 'Donnerstag', friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag' },
  },
  fr: {
    menu: 'Menu', close: 'Fermer', language: 'Langue', home: 'Accueil', navigation: 'Principale', address: 'Adresse', hours: 'Horaires', write: 'Écrire ou appeler',
    directions: 'Itinéraire', closed: 'Fermé', openNow: 'Ouvert', closedNow: 'Fermé', follow: 'Suivre', legal: 'Mentions',
    built: 'Fait avec', imprint: 'Mentions légales', all: 'Tout',
    days: { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' },
  },
  it: {
    menu: 'Menu', close: 'Chiudi', language: 'Lingua', home: 'Home', navigation: 'Principale', address: 'Indirizzo', hours: 'Orari', write: 'Scrivere o chiamare',
    directions: 'Indicazioni', closed: 'Chiuso', openNow: 'Aperto ora', closedNow: 'Chiuso ora', follow: 'Seguire', legal: 'Note legali',
    built: 'Fatto con', imprint: 'Colophon', all: 'Tutto',
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
