/**
 * A length of time as the booking form says it, wherever a page says one: a
 * service's line in a list, its own page, a timetable. «1 Std. 15 Min.» in the
 * price list and «75 Minuten» in the form beside it read as two things — the
 * form's words are the one way (`lasting` in @jtakeit/kit, 19 November 2026).
 * Whole days stay days: a car by the day is «2 Tage», as the form says it.
 */
import { lasting, wordsFor } from '@jtakeit/kit/booking/words';
import { langOf } from './locale';

export function lengthOf(minutes: number, locale: string): string {
  const lang = langOf(locale);
  const whole = Math.max(0, Math.round(Number(minutes) || 0));
  if (whole > 0 && whole % 1440 === 0) {
    return new Intl.NumberFormat(lang, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(whole / 1440);
  }
  return lasting(whole, wordsFor(lang.slice(0, 2)));
}
