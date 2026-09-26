import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { RoadmapApiIdentity } from "@/lib/roadmap-production-api/auth";

export type RoadmapMcpToolSchema = z.ZodObject<z.ZodRawShape>;

export interface RoadmapMcpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: RoadmapMcpToolSchema;
  outputSchema: RoadmapMcpToolSchema;
  annotations: ToolAnnotations;
  execute: (
    args: Record<string, unknown>,
    identity: RoadmapApiIdentity,
  ) => Promise<unknown>;
}
