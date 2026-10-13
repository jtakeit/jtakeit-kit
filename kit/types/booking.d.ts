export interface Named {
  slug: string;
  title: string;
  takes?: number;
  costs?: number;
  /** A price by the hour of the week instead of `costs`: rows of a day, a span and a price. The list says «from …»; the price is the slot's. */
  rates?: { day: string; from: number; until: number; costs: number }[];
  /** `'person'` for a price times the party — a class per place, shoes; the list says so and the running total multiplies. */
  per?: 'booking' | 'person';
  /** The heading a service is listed under: the words — an option's label, a category's title — not the stored value. Services with none come after every heading. */
  group?: string;
  /** For a resource: the services they perform, by slug. The element greys the others out once they are chosen. */
  does?: string[];
}

export interface BookingFormProps {
  services: Named[];
  resources?: Named[];
  locale: string;
  daysAhead?: number;
  combine?: boolean;
  currency?: string;
  scale?: string;
  kind?: string;
  /** Where `/api/` is from this page; under the preview the site is served at `/p/<slug>/`. */
  api?: string;
  /** The element around the form, `jtk-booking`; `''` for none. */
  tag?: string;
  now?: Date;
  /** The days the business opens, by name (`monday`…); the week of days strikes the others out. */
  open?: string[];
  /** The form's look — two steps, the week, the parts of the day, the drawn choice — on by default; `false` for the plain form, or the ones wanted: `'week parts'`. */
  ui?: boolean | string;
}

/** What the form sends to /api/book, as `data-sends` says it. */
export const SENDS: readonly string[];
/** What the booking form is made of, for a page that writes the markup itself (the scaffold's BookingForm.astro). */
export interface BookingForm {
  /** The form's words in the page's language; the platform's answer replaces the kind's. */
  words: Record<string, string>;
  /** The language tag prices and days are written in. */
  lang: string;
  /** A checklist, or one `<select>`. */
  combine: boolean;
  /** The checklist's runs: headings in order, the ones with none after them, add-ons last. `meta` is «45 min · CHF 95». */
  runs: { group: string; items: (Named & { meta: string })[] }[];
  /** For one `<select>`, as they came. */
  services: Named[];
  /** The choice of whom — empty for none; `does` is the slugs joined for `data-does`. */
  resources: (Omit<Named, 'does'> & { does: string })[];
  /** The day input's `min` and `max`. */
  today: string;
  last: string;
  /** Every attribute of the `<form>` — `data-booking`, `data-api`, `data-sends`, `novalidate`… — to spread on it. */
  attrs: Record<string, string>;
}
export function bookingForm(props: BookingFormProps): BookingForm;
/** The booking form as HTML, wrapped in `<jtk-booking>`. */
export function renderBookingForm(props: BookingFormProps): string;
