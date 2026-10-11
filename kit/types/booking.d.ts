export interface Named {
  slug: string;
  title: string;
  takes?: number;
  costs?: number;
  /** A price by the hour of the week instead of `costs`: rows of a day, a span and a price. The list says «from …»; the price is the slot's. */
  rates?: { day: string; from: number; until: number; costs: number }[];
  /** `'person'` for a price times the party — a class per place, shoes; the list says so and the running total multiplies. */
  per?: 'booking' | 'person';
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
/** The booking form as HTML, wrapped in `<jtk-booking>`. */
export function renderBookingForm(props: BookingFormProps): string;
