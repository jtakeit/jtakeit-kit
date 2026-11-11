/** The brief's headings, in the order the guide writes them. */
export const BRIEF_SECTIONS: readonly string[];

export interface BriefRead {
  /** Which sections have words in them. */
  sections: Record<string, boolean>;
  /** Rows in the Facts table. */
  facts: number;
  /** Items under «Open — NEEDS CLIENT». */
  open: number;
  /** How often `NEEDS CLIENT` appears outside its heading. */
  needsClient: number;
  /** The agent's own checklist under «Done when» — read out, never believed. */
  doneWhen: { done: number; of: number; items: { done: boolean; says: string }[] };
}

export interface PageProgress {
  path: string;
  /** Written: some text, and every required text field filled (the exact rule); or any text (has-text). */
  written: boolean;
  filled: number;
  of: number;
  /** Required text fields still empty, under the exact rule. */
  missing?: number;
}

export interface Progress {
  version: 1;
  /** Present on a contract-3 tree (`jtk/schema.json` says `contract: 3`); a contract-2 tree has none. */
  contract?: 3;
  /** `exact` with a catalogue, `has-text` without one — a weaker rule, said as such. */
  rule: 'exact' | 'has-text';
  kit: { kind: string; version: string } | null;
  brief: BriefRead | null;
  /** Whether the declaration is written: `jtk/catalogue.json` on contract 2, `jtk/schema.json` on contract 3. */
  catalogue: boolean;
  pages: PageProgress[];
  collections: Record<string, { entries: number; expected: number }>;
  settings: { hours: boolean; zone: boolean; payment: string } | null;
  facts: { placeholders: number } | null;
  media: number;
  /** What is still to do, as sentences — the same list the panel shows. */
  missing: string[];
  /** The newest change among the files read, ISO 8601; null when none exist. */
  changedAt: string | null;
}

/** Read the working tree and say where the site is. */
export function readProgress(root: string, options?: { dir?: string }): Promise<Progress>;
/** The brief as a document, or null where there is none. */
export function readBrief(file: string): Promise<BriefRead | null>;
/** The list as a person reads it in a terminal. */
export function sayProgress(progress: Progress): string;
