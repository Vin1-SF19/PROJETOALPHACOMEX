import { createHash } from "node:crypto";
import { z } from "zod";

export const alphaSeoCostEstimateSchema = z.object({
  operation: z.string().min(1),
  units: z.number().int().positive(),
  estimatedCredits: z.number().nonnegative(),
  estimatedUsd: z.number().nonnegative(),
  classification: z.enum(["free", "low", "medium", "high"]),
  approvalRequired: z.boolean(),
});

export type AlphaSeoCostEstimate = z.infer<typeof alphaSeoCostEstimateSchema>;

export function estimateOperationCost(input: {
  operation: string;
  units: number;
  creditsPerUnit: number;
  usdPerCredit?: number;
  approvalCreditThreshold?: number;
}): AlphaSeoCostEstimate {
  const units = z.number().int().positive().parse(input.units);
  const estimatedCredits = Number((units * Math.max(0, input.creditsPerUnit)).toFixed(6));
  const estimatedUsd = Number((estimatedCredits * Math.max(0, input.usdPerCredit ?? 0)).toFixed(6));
  const threshold = input.approvalCreditThreshold ?? 2_000;
  const classification = estimatedCredits === 0 ? "free" : estimatedCredits <= 100 ? "low" : estimatedCredits <= threshold ? "medium" : "high";
  return alphaSeoCostEstimateSchema.parse({
    operation: input.operation,
    units,
    estimatedCredits,
    estimatedUsd,
    classification,
    approvalRequired: estimatedCredits > threshold,
  });
}

export function requireCostApproval(estimate: AlphaSeoCostEstimate, approvalToken?: string): { approved: true } | { approved: false; reason: "APPROVAL_REQUIRED" } {
  if (!estimate.approvalRequired || approvalToken?.trim()) return { approved: true };
  return { approved: false, reason: "APPROVAL_REQUIRED" };
}

function stablePart(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stablePart).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${stablePart(nested)}`).join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stablePart(value)).digest("hex").slice(0, 32);
}

export function alphaSeoIdempotencyKey(projectId: string, operation: string, payload: unknown): string {
  return `alpha-seo:idem:${projectId}:${operation}:${digest(payload)}`;
}

export function alphaSeoCacheKey(projectId: string, namespace: string, payload: unknown): string {
  return `alpha-seo:cache:${projectId}:${namespace}:${digest(payload)}`;
}

export function alphaSeoLockKey(projectId: string, resource: string): string {
  return `alpha-seo:lock:${projectId}:${resource}`;
}
