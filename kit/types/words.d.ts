export const LOCALES: readonly string[];
/** The booking form's words for a language and a scale, as a fresh object. */
export function wordsFor(locale: string, scale?: string): Record<string, string>;
/** A length of time as the form says it: «4 Std.», «1 Std. 30 Min.», «45 min». */
export function lasting(minutes: number, words: Record<string, string>): string;
