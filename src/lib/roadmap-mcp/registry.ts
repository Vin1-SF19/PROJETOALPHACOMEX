import { z } from "zod";
import type { RoadmapMcpToolDefinition } from "./types";

export const ROADMAP_MCP_TOOL_NAMES = [
  "roadmap_whoami",
  "roadmap_list_queue",
  "roadmap_create_run",
  "roadmap_get_run",
  "roadmap_update_run_status",
  "roadmap_list_events",
  "roadmap_add_event",
  "roadmap_approve_run",
  "roadmap_set_completion_report",
] as const;

export type RoadmapMcpToolName = (typeof ROADMAP_MCP_TOOL_NAMES)[number];

const runId = z.string().trim().min(1).max(100).describe("ID da fase/rodada de produção.");
const objectiveId = z.string().trim().min(1).max(100).describe("ID do objetivo do roadmap.");
const phaseNumber = z.number().int().min(0).max(99).describe("Número da fase (0-indexado).");
const assignee = z.enum(["claude", "codex", "manual"]).default("claude");
const status = z.enum([
  "PENDING",
  "AWAITING_APPROVAL",
  "IN_PROGRESS",
  "NEEDS_INPUT",
  "BLOCKED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);
const resultSummary = z.string().trim().min(1).max(4_000).optional();
const errorCode = z.string().trim().min(1).max(80).optional();
const eventKind = z.enum(["MESSAGE", "QUESTION", "ANSWER", "NOTE"]);
const eventContent = z.string().trim().min(1).max(4_000);
const reportMarkdown = z.string().trim().min(1).max(200_000);
const moduleKey = z.string().trim().min(1).max(100).optional();
const queueStatus = z.enum([
  "PENDING",
  "AWAITING_APPROVAL",
  "IN_PROGRESS",
  "NEEDS_INPUT",
  "BLOCKED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]).optional();
const eventsLimit = z.number().int().min(1).max(200).default(50);
const eventsCursor = z.string().trim().min(1).max(100).optional();

const empty = z.object({}).strict();
const commonOutput = z
  .object({
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    meta: z
      .object({ tool: z.string(), authKind: z.string(), userId: z.number() })
      .strict(),
  })
  .strict();

const schemas: Record<RoadmapMcpToolName, z.ZodObject<z.ZodRawShape>> = {
  roadmap_whoami: empty,
  roadmap_list_queue: z
    .object({
      status: queueStatus,
      moduleKey,
      assignee: z.enum(["claude", "codex", "manual"]).optional(),
    })
    .strict(),
  roadmap_create_run: z
    .object({ objectiveId, phaseNumber, assignee })
    .strict(),
  roadmap_get_run: z.object({ runId }).strict(),
  roadmap_update_run_status: z
    .object({ runId, status, resultSummary, errorCode })
    .strict(),
  roadmap_list_events: z
    .object({ runId, limit: eventsLimit, cursor: eventsCursor })
    .strict(),
  roadmap_add_event: z
    .object({ runId, kind: eventKind, content: eventContent })
    .strict(),
  roadmap_approve_run: z.object({ runId }).strict(),
  roadmap_set_completion_report: z
    .object({ objectiveId, reportMarkdown })
    .strict(),
};

const titles: Record<RoadmapMcpToolName, string> = {
  roadmap_whoami: "Who am I",
  roadmap_list_queue: "List production queue",
  roadmap_create_run: "Create production run",
  roadmap_get_run: "Get run detail",
  roadmap_update_run_status: "Update run status",
  roadmap_list_events: "List run events",
  roadmap_add_event: "Add run event",
  roadmap_approve_run: "Approve run",
  roadmap_set_completion_report: "Set completion report",
};

const writeTools = new Set<RoadmapMcpToolName>([
  "roadmap_create_run",
  "roadmap_update_run_status",
  "roadmap_add_event",
  "roadmap_approve_run",
  "roadmap_set_completion_report",
]);

export const roadmapMcpTools: RoadmapMcpToolDefinition[] =
  ROADMAP_MCP_TOOL_NAMES.map((name) => ({
    name,
    title: titles[name],
    description: `${titles[name]}. Operação de produção do Roadmap Alpha com validação estrita, resposta estruturada e erros acionáveis.`,
    inputSchema: schemas[name],
    outputSchema: commonOutput,
    annotations: {
      title: titles[name],
      readOnlyHint: !writeTools.has(name),
      destructiveHint: false,
      idempotentHint: !["roadmap_create_run", "roadmap_add_event"].includes(name),
      openWorldHint: false,
    },
    execute: async (args, identity) =>
      (await import("./tool-executor")).executeRoadmapMcpTool(name, args, identity),
  }));
