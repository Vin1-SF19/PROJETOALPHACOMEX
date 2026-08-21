import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { alphaSeoMcpTools } from "./registry";
import { mcpFailure, mcpSuccess } from "./format";
import type { AlphaSeoMcpIdentity } from "./types";

export function createAlphaSeoMcpServer(identity: AlphaSeoMcpIdentity): McpServer {
  const server = new McpServer(
    {
      name: "alpha-seo-mcp-server",
      title: "Alpha SEO",
      version: "1.0.0",
      description: "Ferramentas project-scoped de pesquisa, rank tracking, auditoria, GSC, GA4 e SEO local do Painel Alpha.",
    },
    {
      instructions: "Confirme custos quando uma ferramenta solicitar aprovação. Nunca tente trocar o projectId fixado pela credencial. Use paginação/filtros quando a resposta for truncada.",
    },
  );

  for (const tool of alphaSeoMcpTools) {
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
        const meta = { tool: tool.name, authKind: identity.kind, projectId: identity.fixedProjectId };
        try {
          const parsed = tool.inputSchema.parse(rawArgs) as Record<string, unknown>;
          const data = await tool.execute(parsed, identity);
          return mcpSuccess({ ok: true, data, meta }, `${tool.title} concluído.`);
        } catch (error) {
          const failure = mcpFailure(error);
          const original = failure.structuredContent && typeof failure.structuredContent === "object" ? failure.structuredContent : {};
          return { ...failure, structuredContent: { ok: false, error: original, meta } };
        }
      },
    );
  }
  return server;
}

