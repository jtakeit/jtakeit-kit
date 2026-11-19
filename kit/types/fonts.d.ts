export interface FaceMetrics {
  format: string;
  family: string;
  subfamily: string;
  style: 'normal' | 'italic';
  /** The weight measured: a variable face's, 400 where its range has it, unless asked. */
  weight: number;
  axes: { tag: string; min: number; default: number; max: number }[];
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  /** Which vertical metrics a browser lays the face out by. */
  metrics: 'hhea' | 'typo';
  xAvgCharWidth: number;
  /** The lowercase letters' and the space's advance, weighted by how often they occur in text; 0 where the face maps too few. */
  avg: number;
  capHeight: number;
  xHeight: number;
  /** serif, sans-serif, monospace, cursive — or '' where the font does not say. */
  kind: string;
  varied: boolean;
}
export interface StandIn {
  family: string;
  fallback: string;
  local: string[];
  style: 'normal' | 'italic';
  weight: string;
  sizeAdjust: string;
  ascentOverride: string;
  descentOverride: string;
  lineGapOverride: string;
  width: 'letters' | 'xAvgCharWidth';
}
/** The system faces a stand-in is measured against. */
export const FALLBACKS: Readonly<Record<string, { kind: string; faces: Record<string, { local: string[]; upm: number; avg: number; xavg: number }> }>>;
/** A font file's tables by tag: woff2, woff, ttf, otf, or a collection's first face. */
export function readTables(bytes: Uint8Array): { format: string; tables: Map<string, Uint8Array>; transformed: Set<string> };
export function metricsOf(bytes: Uint8Array, options?: { weight?: number }): FaceMetrics;
export function standIn(metrics: FaceMetrics, options?: { fallback?: string; family?: string; weight?: number }): StandIn;
export function fontFaceCSS(face: StandIn): string;
export function usage(): string;
/** `jtk fonts <file.woff2>…`: 0 when every face was measured. */
export function main(args: string[]): Promise<number>;
