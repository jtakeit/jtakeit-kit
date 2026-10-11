export const PARTS: readonly ['morning', 'afternoon', 'evening'];
export const DAY_NAMES: readonly string[];
export function to24(text: string): string;
export function partOfHour(hour: number): 'morning' | 'afternoon' | 'evening';
export function partsOf(hours: number[], least?: number): ('morning' | 'afternoon' | 'evening')[];
export function ymd(d: Date): string;
export function parseDay(text: string): Date | null;
