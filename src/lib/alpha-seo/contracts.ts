import { z } from "zod";

export const alphaSeoExitCodeSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

export type AlphaSeoExitCode = z.infer<typeof alphaSeoExitCodeSchema>;

export const alphaSeoErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "PROJECT_ACCESS_DENIED",
  "RESOURCE_NOT_FOUND",
  "COST_APPROVAL_REQUIRED",
  "DEPENDENCY_UNAVAILABLE",
  "CONTRACT_INVALID",
  "LEASE_CONFLICT",
  "RETRY_EXHAUSTED",
]);

export const alphaSeoErrorSchema = z.object({
  code: alphaSeoErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type AlphaSeoErrorCode = z.infer<typeof alphaSeoErrorCodeSchema>;
export type AlphaSeoError = z.infer<typeof alphaSeoErrorSchema>;

export const alphaSeoCheckSchema = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  kind: z.enum(["config", "dependency", "contract", "safety"]),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const alphaSeoJobResultSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["rank", "audit", "oauth-cleanup"]),
  status: z.enum(["completed", "skipped", "failed", "retry-scheduled"]),
  attempts: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  message: z.string().min(1),
});

export const alphaSeoCliResultSchema = z.object({
  ok: z.boolean(),
  command: z.enum(["inventory", "doctor", "worker"]),
  code: alphaSeoExitCodeSchema,
  checks: z.array(alphaSeoCheckSchema),
  jobs: z.array(alphaSeoJobResultSchema).optional(),
  timestamp: z.string().datetime(),
});

export type AlphaSeoCheck = z.infer<typeof alphaSeoCheckSchema>;
export type AlphaSeoCliResult = z.infer<typeof alphaSeoCliResultSchema>;
export type AlphaSeoJobResult = z.infer<typeof alphaSeoJobResultSchema>;

export function exitCodeForChecks(checks: readonly AlphaSeoCheck[]): AlphaSeoExitCode {
  if (checks.some((check) => !check.ok && (check.kind === "config" || check.kind === "contract"))) {
    return 2;
  }
  if (checks.some((check) => !check.ok)) return 1;
  return 0;
}

export function makeCliResult(input: {
  command: AlphaSeoCliResult["command"];
  checks: AlphaSeoCheck[];
  jobs?: AlphaSeoJobResult[];
  timestamp?: string;
}): AlphaSeoCliResult {
  const code = exitCodeForChecks(input.checks);
  return alphaSeoCliResultSchema.parse({
    ok: code === 0,
    command: input.command,
    code,
    checks: input.checks,
    jobs: input.jobs,
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}
