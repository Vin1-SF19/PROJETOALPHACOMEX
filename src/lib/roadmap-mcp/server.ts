import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { roadmapMcpTools } from "./registry";
import { mcpFailure, mcpSuccess } from "./format";
import type { RoadmapApiIdentity } from "@/lib/roadmap-production-api/auth";

export function createRoadmapMcpServer(identity: RoadmapApiIdentity): McpServer {
  const server = new McpServer(
    {
      name: "roadmap-production-mcp-server",
      title: "Roadmap Production",
      version: "1.0.0",
      description:
        "Ferramentas de produção do Roadmap Alpha: fila, runs, status, eventos, aprovação e relatório de conclusão.",
    },
    {
      instructions:
        "Use a fila para descobrir IDs de objetivos e fases. Confirme transições de status antes de atualizar. Nunca tente iniciar uma fase bloqueada sem resolver o bloqueio.",
    },
  );

  for (const tool of roadmapMcpTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      async (rawArgs): Promise<CallToolResult> => {
        const meta = {
          tool: tool.name,
          authKind: identity.credentialId ? "api_key" : "session",
          userId: identity.userId,
        };
        try {
          const parsed = tool.inputSchema.parse(rawArgs) as Record<string, unknown>;
          const data = await tool.execute(parsed, identity);
          return mcpSuccess({ ok: true, data, meta }, `${tool.title} concluído.`);
        } catch (error) {
          const failure = mcpFailure(error);
          const original =
            failure.structuredContent &&
            typeof failure.structuredContent === "object"
              ? failure.structuredContent
              : {};
          return { ...failure, structuredContent: { ok: false, error: original, meta } };
        }
      },
    );
  }
  return server;
}
