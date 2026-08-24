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
  "NEEDS_INPUT",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
]);
export const productionExecutionStatusSchema = z.enum([
  "AWAITING_APPROVAL",
  "PENDING",
  "RUNNING",
  "WAITING_FOR_ADMIN",
  "PAUSED",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
]);

export const productionInterventionCategorySchema = z.enum([
  "PERMISSION",
  "DECISION",
  "CREDENTIAL",
  "EXTERNAL_ACTION",
  "DATABASE",
  "DESTRUCTIVE",
  "GIT_REMOTE",
]);

export const productionMessageSchema = z
  .object({
    id: z.string().uuid(),
    executionId: z.string().min(1).max(240),
    phaseNumber: z.number().int().min(0).max(99),
    role: z.enum(["AGENT", "ADMIN", "SYSTEM"]),
    kind: z.enum(["MESSAGE", "QUESTION", "ANSWER", "DECISION", "STATUS"]),
    content: z.string().trim().min(1).max(4_000),
    requestId: z.string().uuid().nullable().default(null),
    createdAt: z.string().datetime(),
  })
  .strict();

export const productionInterventionResolutionSchema = z
  .object({
    author: z.string().trim().min(1).max(120),
    decision: z.enum(["ANSWER", "AUTHORIZE", "DENY"]),
    content: z.string().trim().min(1).max(4_000),
    createdAt: z.string().datetime(),
    authorizationAttempt: z.number().int().positive().nullable().default(null),
    authorizationConsumedAt: z.string().datetime().nullable().default(null),
  })
  .strict();

export const productionInterventionSchema = z
  .object({
    id: z.string().uuid(),
    requestId: z.string().uuid(),
    executionId: z.string().min(1).max(240),
    phaseNumber: z.number().int().min(0).max(99),
    category: productionInterventionCategorySchema,
    question: z.string().trim().min(5).max(2_000),
    intendedAction: z.string().trim().min(1).max(1_000),
    normalizedAction: z.string().trim().min(1).max(1_000),
    risk: z.string().trim().min(1).max(2_000),
    options: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
    status: z.enum(["PENDING", "ANSWERED", "AUTHORIZED", "DENIED"]),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable().default(null),
    resolution: productionInterventionResolutionSchema.nullable().default(null),
  })
  .strict();

export const productionCircuitSchema = z
  .object({
    fingerprint: z.string().max(128).nullable().default(null),
    consecutiveCount: z.number().int().min(0).max(100).default(0),
    firstOccurredAt: z.string().datetime().nullable().default(null),
    lastOccurredAt: z.string().datetime().nullable().default(null),
    resetReason: z.string().max(500).nullable().default(null),
  })
  .strict();

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
      "RESPOND",
      "AUTHORIZE",
      "DENY",
      "MESSAGE",
      "SWITCH_AGENT",
    ]),
    executionId: z.string().min(1).max(240),
    phaseNumber: z.number().int().min(0).max(99).nullable().default(null),
    feedback: z.string().trim().min(5).max(4_000).nullable().default(null),
    improvedWithAi: z.boolean().default(false),
    requestId: z.string().uuid().nullable().default(null),
    content: z.string().trim().min(1).max(4_000).nullable().default(null),
    agentId: z.string().trim().min(1).max(80).nullable().default(null),
    acceptedPhaseStatus: productionPhaseStatusSchema.nullable().default(null),
    author: z.string().trim().min(1).max(120).default("Administrador"),
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
    if (["APPROVE", "PAUSE", "RESUME", "RETRY", "EXCLUDE"].includes(command.type) &&
      (command.phaseNumber !== null || command.feedback !== null || command.requestId !== null || command.content !== null || command.agentId !== null || command.acceptedPhaseStatus !== null)) {
      context.addIssue({
        code: "custom",
        message: "CONTROL_DOES_NOT_ACCEPT_FEEDBACK",
      });
    }
    if (["RESPOND", "AUTHORIZE", "DENY"].includes(command.type) &&
      (command.phaseNumber === null || command.requestId === null || (command.type === "RESPOND" && !command.content))) {
      context.addIssue({ code: "custom", message: "INTERVENTION_COMMAND_INVALID" });
    }
    if (command.type === "MESSAGE" && (command.phaseNumber === null || !command.content)) {
      context.addIssue({ code: "custom", message: "MESSAGE_COMMAND_INVALID" });
    }
    if (command.type !== "MESSAGE" && command.acceptedPhaseStatus !== null) {
      context.addIssue({ code: "custom", message: "ACCEPTED_PHASE_STATUS_NOT_ALLOWED" });
    }
    if (command.type === "SWITCH_AGENT" && (command.phaseNumber === null || !command.agentId)) {
      context.addIssue({ code: "custom", message: "SWITCH_AGENT_COMMAND_INVALID" });
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
    agentOverride: z.boolean().default(false),
    status: productionPhaseStatusSchema,
    attemptCount: z.number().int().min(0).max(100),
    autoRetryCount: z.number().int().min(0).max(30).default(0),
    retryAt: z.string().datetime().nullable().default(null),
    startedAt: z.string().datetime().nullable(),
    finishedAt: z.string().datetime().nullable(),
    summary: z.string().max(8_000).nullable(),
    errorCode: z.string().max(100).nullable(),
    changedFiles: z.array(z.string().min(1).max(500)).max(100).default([]),
    reworkCount: z.number().int().min(0).max(100).default(0),
    manualFeedback: z.array(productionManualFeedbackSchema).max(50).default([]),
    circuit: productionCircuitSchema.default({
      fingerprint: null,
      consecutiveCount: 0,
      firstOccurredAt: null,
      lastOccurredAt: null,
      resetReason: null,
    }),
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
    messages: z.array(productionMessageSchema).max(500).default([]),
    interventions: z.array(productionInterventionSchema).max(100).default([]),
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
export type ProductionMessage = z.infer<typeof productionMessageSchema>;
export type ProductionIntervention = z.infer<typeof productionInterventionSchema>;
export type ProductionInterventionResolution = z.infer<
  typeof productionInterventionResolutionSchema
>;
export type ProductionInterventionCategory = z.infer<
  typeof productionInterventionCategorySchema
>;
export type ProductionPhaseState = z.infer<typeof productionPhaseStateSchema>;
export type ProductionExecution = z.infer<typeof productionExecutionSchema>;
export type ProductionState = z.infer<typeof productionStateSchema>;
export type ProductionExecutionInput = z.input<typeof productionExecutionSchema>;
export type ProductionStateInput = z.input<typeof productionStateSchema>;
export type ProductionControlCommand = z.infer<
  typeof productionControlCommandSchema
>;
