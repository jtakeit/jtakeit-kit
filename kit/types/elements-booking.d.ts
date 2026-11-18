export function daysBetween(from: string, until: string): number;
export function plusDays(iso: string, n: number): string;
export function lasting(minutes: number, words: Record<string, string>): string;
export function wireBooking(form: HTMLFormElement): void;
export function wireAll(root?: ParentNode): void;
/** What `slotchange` says: the time chosen, or `null` once none is. */
export type SlotChange = { start: string; ends: string | null; resource: string | null } | null;
export class JtkBooking extends HTMLElement {
  connectedCallback(): void;
  /** Chooses the free time starting at `start` (ISO 8601) where the form shows it; true if chosen. */
  choose(start: string): boolean;
  /** Unchooses the time chosen, if any. */
  clear(): void;
}
export function defineBooking(name?: string): void;
export const BOOKING_PROTOCOL: number;
