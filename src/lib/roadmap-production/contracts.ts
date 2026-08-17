import { z } from "zod";

export const productionProviderSchema = z.enum(["ollama", "codex", "claude"]);
export const productionConfigSchema = z.object({
  version: z.literal(1),
  provider: productionProviderSchema,
  model: z.string().trim().min(1).max(120),
  autoRun: z.boolean(),
  maxToolSteps: z.number().int().min(4).max(40),
  updatedAt: z.string().datetime(),
}).strict();

export const productionPhaseStatusSchema = z.enum([
  "PENDING", "RUNNING", "SUCCEEDED", "FAILED", "BLOCKED",
]);
export const productionExecutionStatusSchema = z.enum([
  "PENDING", "RUNNING", "PAUSED", "SUCCEEDED", "FAILED", "BLOCKED",
]);

export const productionControlCommandSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["PAUSE", "RESUME", "RETRY", "EXCLUDE"]),
  executionId: z.string().min(1).max(240),
  createdAt: z.string().datetime(),
}).strict();

export const productionActivitySchema = z.object({
  at: z.string().datetime(),
  agentId: z.string().min(1).max(80),
  type: z.enum(["STATUS", "TOOL", "RESULT", "ERROR"]),
  message: z.string().max(2_000),
}).strict();

export const productionPhaseStateSchema = z.object({
  phaseNumber: z.number().int().min(0).max(99),
  title: z.string().min(1).max(200),
  kind: z.string().min(1).max(40),
  requestedAgent: z.string().min(1).max(80),
  resolvedAgent: z.string().min(1).max(80),
  status: productionPhaseStatusSchema,
  attemptCount: z.number().int().min(0).max(100),
  autoRetryCount: z.number().int().min(0).max(20).default(0),
  retryAt: z.string().datetime().nullable().default(null),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  summary: z.string().max(8_000).nullable(),
  errorCode: z.string().max(100).nullable(),
  changedFiles: z.array(z.string().min(1).max(500)).max(100).default([]),
  activities: z.array(productionActivitySchema).max(200),
}).strict();

export const productionExecutionSchema = z.object({
  id: z.string().min(1).max(240),
  objectiveId: z.string().min(1).max(120),
  objectiveCode: z.string().min(1).max(80),
  objectiveTitle: z.string().min(1).max(200),
  moduleKey: z.string().min(1).max(80),
  sourceVersion: z.number().int().positive(),
  globalPriority: z.number().int(),
  status: productionExecutionStatusSchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  phases: z.array(productionPhaseStateSchema).max(100),
}).strict();

export const productionStateSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  ignoredExecutionIds: z.array(z.string().min(1).max(240)).max(500).default([]),
  executions: z.array(productionExecutionSchema).max(200),
}).strict();

export type ProductionProvider = z.infer<typeof productionProviderSchema>;
export type ProductionConfig = z.infer<typeof productionConfigSchema>;
export type ProductionActivity = z.infer<typeof productionActivitySchema>;
export type ProductionPhaseState = z.infer<typeof productionPhaseStateSchema>;
export type ProductionExecution = z.infer<typeof productionExecutionSchema>;
export type ProductionState = z.infer<typeof productionStateSchema>;
export type ProductionControlCommand = z.infer<typeof productionControlCommandSchema>;
