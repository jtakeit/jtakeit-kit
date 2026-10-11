import type { Progress } from './progress';

export type PhaseKey = 'brief' | 'laidOut' | 'writing' | 'judged' | 'attached' | 'building' | 'preview';
export type PhaseState = 'done' | 'current' | 'left' | 'unseen';

export const PHASES: readonly PhaseKey[];
export const PHASE_NAMES: Record<PhaseKey, string>;
export const STEP_NAMES: Record<string, string>;

/** The platform's half, as `/v1/dev-sessions/{id}/progress` answers it. */
export interface PlatformHalf {
  site_id: string;
  name: string;
  until: string;
  judged?: { at: string; ok: boolean; findings: number };
  attached: boolean;
  served: boolean;
  build?: { status: string; stage_num?: number; stage_of?: number; finished_at?: string; error?: string };
  steps: { key: string; done: boolean; whose: string }[];
  left: number;
  panel: string;
  /** Set by the dev server when the platform could not be read. */
  error?: string;
}

export interface Where {
  phases: { key: PhaseKey; state: PhaseState }[];
  current: PhaseKey;
  index: number;
  /** Whether the platform's half was read. */
  known: boolean;
  /** Whether the kit's half was read. */
  seen: boolean;
}

export function phasesOf(progress: Progress | null | undefined, platform: PlatformHalf | null | undefined): Where;
export function sayPhase(where: Where, progress: Progress | null | undefined, platform: PlatformHalf | null | undefined): string;
export function meanwhile(platform: PlatformHalf | null | undefined): {
  open: { key: string; name: string; done: boolean }[];
  done: { key: string; name: string; done: boolean }[];
};
