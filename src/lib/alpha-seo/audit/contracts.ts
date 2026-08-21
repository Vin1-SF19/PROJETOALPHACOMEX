import { z } from "zod";

export const startAuditSchema = z.object({
  projectId: z.string().min(1).max(100),
  startUrl: z.string().trim().min(1).max(2_048),
  maxPages: z.number().int().min(10).max(10_000).default(50),
  lighthouseStrategy: z.enum(["AUTO", "NONE"]).default("AUTO"),
});

export const auditIdSchema = z.object({ projectId: z.string().min(1).max(100), auditId: z.string().min(1).max(100) });

export const auditMutationSchema = auditIdSchema.extend({
  mode: z.enum(["CANCEL", "DELETE"]),
});

export const auditResultsSchema = auditIdSchema.extend({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
  issueType: z.string().min(1).max(100).optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
});

export type AuditConfig = { maxPages: number; lighthouseStrategy: "AUTO" | "NONE" };
export type AuditMutationMode = z.infer<typeof auditMutationSchema>["mode"];
