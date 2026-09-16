import "server-only";

import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";

export function createSupportId(): string {
  return randomUUID();
}
export function writeExplorerLog(event: {
  correlationId: string;
  action: string;
  result: "success" | "denied" | "failure";
  userId?: number;
  provider?: string;
  durationMs?: number;
  sizeBytes?: number;
  parts?: number;
  errorCode?: string;
}): void {
  process.stdout.write(`${JSON.stringify({ scope: "alpha-explorer", ...event })}\n`);
}

export async function auditExplorer(userId: number, action: string, details: Record<string, unknown>): Promise<void> {
  const sanitized = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/key|bucket|url|token|secret|cookie|header/i.test(key)),
  );
  await db.auditoria.create({ data: { userId, acao: `ALPHA_EXPLORER_${action}`, detalhes: JSON.stringify(sanitized) } });
}
