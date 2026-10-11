/** The booking form's look, by default: the steps, the week of days, the parts of the day, the drawn choice. */
export function dressBooking(form: HTMLFormElement, words: Record<string, string>): void;
export function weekStrip(input: HTMLInputElement, options: { open: string[]; lang: string; words: Record<string, string> }): void;
export function partsOfDay(form: HTMLFormElement, words: Record<string, string>): void;
export function twoSteps(form: HTMLFormElement, words: Record<string, string>, lang: string): void;
export function drawnSelect(select: HTMLSelectElement): void;
