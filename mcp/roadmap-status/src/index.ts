import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { roadmapTools } from "./tools.js";

const server = new McpServer(
  {
    name: "roadmap-status-mcp",
    title: "Roadmap Alpha — Status de Produção",
    version: "1.0.0",
    description:
      "Quadro de status manual de produção do Roadmap Alpha (PainelAlpha): listar fila, marcar fases iniciadas/concluídas/falhas, registrar perguntas e notas.",
  },
  {
    instructions:
      "Use estas ferramentas para refletir no painel o progresso real de implementação de cada fase do Roadmap. Marque uma fase como iniciada antes de trabalhar nela, e concluída/falha ao terminar, sempre com um resumo objetivo do que foi feito.",
  },
);

for (const tool of roadmapTools) {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    async (rawArgs: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const data = await (tool.execute as (args: Record<string, unknown>) => Promise<unknown>)(
          rawArgs as Record<string, unknown>,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Erro: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
