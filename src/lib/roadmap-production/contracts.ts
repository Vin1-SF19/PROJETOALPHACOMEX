import { z } from "zod";

export const productionProviderSchema = z.enum(["ollama", "codex", "claude"]);
export const developmentProviderSchema = z.enum(["claude", "codex", "ollama"]);
export const productionConfigSchema = z
  .object({
    version: z.literal(1),
    provider: productionProviderSchema,
    model: z.string().trim().min(1).max(120),
    autoRun: z.boolean(),
    maxToolSteps: z.number().int().min(4).max(40),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const productionPhaseStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
]);
export const productionExecutionStatusSchema = z.enum([
  "AWAITING_APPROVAL",
  "PENDING",
  "RUNNING",
  "PAUSED",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
]);

export const productionControlCommandSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum([
      "APPROVE",
      "PAUSE",
      "RESUME",
      "RETRY",
      "EXCLUDE",
      "REPORT_ERROR",
    ]),
    executionId: z.string().min(1).max(240),
    phaseNumber: z.number().int().min(0).max(99).nullable().default(null),
    feedback: z.string().trim().min(5).max(4_000).nullable().default(null),
    improvedWithAi: z.boolean().default(false),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((command, context) => {
    if (
      command.type === "REPORT_ERROR" &&
      (!command.feedback || command.phaseNumber !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "REPORT_ERROR_REQUIRES_FEEDBACK",
      });
    }
    if (
      command.type !== "REPORT_ERROR" &&
      (command.phaseNumber !== null || command.feedback !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "CONTROL_DOES_NOT_ACCEPT_FEEDBACK",
      });
    }
  });

export const productionManualFeedbackSchema = z
  .object({
    id: z.string().uuid(),
    reportedAt: z.string().datetime(),
    content: z.string().trim().min(5).max(4_000),
    improvedWithAi: z.boolean(),
    resolvedAt: z.string().datetime().nullable().default(null),
  })
  .strict();

export const productionActivitySchema = z
  .object({
    at: z.string().datetime(),
    agentId: z.string().min(1).max(80),
    type: z.enum(["STATUS", "TOOL", "RESULT", "ERROR"]),
    message: z.string().max(2_000),
  })
  .strict();

export const productionPhaseStateSchema = z
  .object({
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
    reworkCount: z.number().int().min(0).max(100).default(0),
    manualFeedback: z.array(productionManualFeedbackSchema).max(50).default([]),
    activities: z.array(productionActivitySchema).max(200),
  })
  .strict();

export const productionExecutionSchema = z
  .object({
    id: z.string().min(1).max(240),
    objectiveId: z.string().min(1).max(120),
    objectiveCode: z.string().min(1).max(80),
    objectiveTitle: z.string().min(1).max(200),
    moduleKey: z.string().min(1).max(80),
    developmentProvider: developmentProviderSchema.default("claude"),
    sourceVersion: z.number().int().positive(),
    globalPriority: z.number().int(),
    status: productionExecutionStatusSchema,
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    finishedAt: z.string().datetime().nullable(),
    completionReportPath: z.string().max(500).nullable().default(null),
    completionReportMarkdown: z.string().max(200_000).nullable().default(null),
    reworkCount: z.number().int().min(0).max(100).default(0),
    manualFeedback: z.array(productionManualFeedbackSchema).max(50).default([]),
    phases: z.array(productionPhaseStateSchema).max(100),
  })
  .strict();

export const productionStateSchema = z
  .object({
    version: z.literal(1),
    updatedAt: z.string().datetime(),
    ignoredExecutionIds: z
      .array(z.string().min(1).max(240))
      .max(500)
      .default([]),
    executions: z.array(productionExecutionSchema).max(200),
  })
  .strict();

export type ProductionProvider = z.infer<typeof productionProviderSchema>;
export type DevelopmentProvider = z.infer<typeof developmentProviderSchema>;
export type ProductionConfig = z.infer<typeof productionConfigSchema>;
export type ProductionActivity = z.infer<typeof productionActivitySchema>;
export type ProductionPhaseState = z.infer<typeof productionPhaseStateSchema>;
export type ProductionExecution = z.infer<typeof productionExecutionSchema>;
export type ProductionState = z.infer<typeof productionStateSchema>;
export type ProductionControlCommand = z.infer<
  typeof productionControlCommandSchema
>;
