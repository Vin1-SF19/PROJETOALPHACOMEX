import db from "@/lib/prisma";
import { montarContextoProjeto } from "./ai-context";

export interface BlueprintAiCtx {
  projectId: string;
  userId: number;
}

export async function executarBlueprintAiTool(nome: string, params: Record<string, unknown>, ctx: BlueprintAiCtx): Promise<string> {
  switch (nome) {
    case "resumir_projeto":
    case "identificar_lacunas":
    case "gerar_perguntas_pendentes": {
      // Estas 3 tools apenas retornam o contexto para o modelo processar e responder em
      // texto natural — a "geração" acontece no turno de resposta do modelo, não aqui.
      const contexto = await montarContextoProjeto(ctx.projectId);
      return contexto || "Projeto ainda não possui conteúdo registrado.";
    }
    case "gerar_requisitos_sugeridos": {
      const contexto = await montarContextoProjeto(ctx.projectId);
      const foco = typeof params.foco === "string" ? params.foco : undefined;
      return JSON.stringify({ contexto, foco: foco ?? "geral" });
    }
    default:
      return `Tool desconhecida: ${nome}`;
  }
}

export async function registrarAcaoIaBlueprint(projectId: string, userId: number, acao: string, metadata?: Record<string, unknown>) {
  await db.blueprintActivity.create({
    data: {
      projectId,
      userId,
      action: "ACAO_IA",
      entityType: "PROJETO",
      metadataJson: JSON.stringify({ acao, ...metadata }),
    },
  });
}
