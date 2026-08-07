import type { PptxMatrix, PptxSourceRef } from "./modelo-intermediario";

export type PptxDiagnosticSeverity = "INFO" | "WARNING" | "FALLBACK" | "ERROR";

export interface PptxDiagnosticEntry {
  severity: PptxDiagnosticSeverity;
  source: PptxSourceRef;
  type: string;
  geometry?: string;
  fill?: string;
  asset?: string;
  parent?: string;
  localTransform?: PptxMatrix;
  worldTransform?: PptxMatrix;
  crop?: { left: number; top: number; right: number; bottom: number };
  result?: string;
  message: string;
}

export function diagnosticoTemProblemaVisual(entry: PptxDiagnosticEntry): boolean {
  return entry.severity === "WARNING" || entry.severity === "FALLBACK" || entry.severity === "ERROR";
}

export function resumirDiagnosticos(entries: PptxDiagnosticEntry[]): Record<PptxDiagnosticSeverity, number> {
  const summary: Record<PptxDiagnosticSeverity, number> = { INFO: 0, WARNING: 0, FALLBACK: 0, ERROR: 0 };
  for (const entry of entries) summary[entry.severity] += 1;
  return summary;
}

