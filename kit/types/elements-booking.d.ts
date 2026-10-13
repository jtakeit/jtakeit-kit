export function daysBetween(from: string, until: string): number;
export function plusDays(iso: string, n: number): string;
export function lasting(minutes: number, words: Record<string, string>): string;
export function wireBooking(form: HTMLFormElement): void;
export function wireAll(root?: ParentNode): void;
export class JtkBooking extends HTMLElement {
  connectedCallback(): void;
}
export function defineBooking(name?: string): void;
export const BOOKING_PROTOCOL: number;
