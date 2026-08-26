import { z } from "zod";
import { roadmapApiClient } from "./client.js";

export const roadmapTools = [
  {
    name: "roadmap_listar_fila",
    title: "Listar fila de produção do Roadmap",
    description:
      "Lista as fases (RoadmapProductionRun) da fila de produção do Roadmap Alpha, com filtros opcionais.",
    inputSchema: {
      status: z
        .enum([
          "PENDING",
          "AWAITING_APPROVAL",
          "IN_PROGRESS",
          "NEEDS_INPUT",
          "BLOCKED",
          "SUCCEEDED",
          "FAILED",
          "CANCELLED",
        ])
        .optional(),
      moduleKey: z.string().optional(),
      assignee: z.enum(["claude", "codex", "manual"]).optional(),
    },
    execute: (args: { status?: string; moduleKey?: string; assignee?: string }) =>
      roadmapApiClient.listQueue(args),
  },
  {
    name: "roadmap_ver_fase",
    title: "Ver detalhe de uma fase",
    description: "Retorna o detalhe completo de uma RoadmapProductionRun: objetivo, artefato documentado e últimos eventos.",
    inputSchema: { runId: z.string().min(1) },
    execute: (args: { runId: string }) => roadmapApiClient.getRun(args.runId),
  },
  {
    name: "roadmap_marcar_fase_iniciada",
    title: "Marcar fase como em progresso",
    description: "Transiciona a fase para IN_PROGRESS (a partir de PENDING).",
    inputSchema: { runId: z.string().min(1) },
    execute: (args: { runId: string }) =>
      roadmapApiClient.updateStatus(args.runId, "IN_PROGRESS"),
  },
  {
    name: "roadmap_marcar_fase_concluida",
    title: "Marcar fase como concluída",
    description: "Transiciona a fase para SUCCEEDED, registrando um resumo do que foi feito.",
    inputSchema: { runId: z.string().min(1), resultSummary: z.string().min(1).max(4000) },
    execute: (args: { runId: string; resultSummary: string }) =>
      roadmapApiClient.updateStatus(args.runId, "SUCCEEDED", args.resultSummary),
  },
  {
    name: "roadmap_marcar_fase_falhou",
    title: "Marcar fase como falha",
    description: "Transiciona a fase para FAILED, registrando código e resumo do erro.",
    inputSchema: {
      runId: z.string().min(1),
      errorCode: z.string().min(1).max(80),
      resultSummary: z.string().min(1).max(4000),
    },
    execute: (args: { runId: string; errorCode: string; resultSummary: string }) =>
      roadmapApiClient.updateStatus(args.runId, "FAILED", args.resultSummary, args.errorCode),
  },
  {
    name: "roadmap_perguntar",
    title: "Registrar pergunta e marcar fase como aguardando decisão",
    description: "Registra uma pergunta/pedido de decisão e transiciona a fase para NEEDS_INPUT.",
    inputSchema: { runId: z.string().min(1), content: z.string().min(1).max(4000) },
    execute: (args: { runId: string; content: string }) =>
      roadmapApiClient.createEvent(args.runId, "QUESTION", args.content),
  },
  {
    name: "roadmap_registrar_nota",
    title: "Registrar nota/mensagem no histórico da fase",
    description: "Adiciona uma nota livre ao histórico da fase, sem mudar o status.",
    inputSchema: { runId: z.string().min(1), content: z.string().min(1).max(4000) },
    execute: (args: { runId: string; content: string }) =>
      roadmapApiClient.createEvent(args.runId, "NOTE", args.content),
  },
  {
    name: "roadmap_ver_historico",
    title: "Ver histórico de eventos de uma fase",
    description: "Lista o log append-only de eventos (mudanças de status, mensagens, notas) de uma fase.",
    inputSchema: { runId: z.string().min(1), limit: z.number().int().min(1).max(200).optional() },
    execute: (args: { runId: string; limit?: number }) =>
      roadmapApiClient.listEvents(args.runId, args.limit),
  },
  {
    name: "roadmap_criar_run",
    title: "Criar (ou obter) a run de uma fase documentada",
    description:
      "Cria a RoadmapProductionRun de uma fase a partir do artefato publicado (RoadmapPromptArtifact). Idempotente: se já existir, retorna a existente.",
    inputSchema: {
      objectiveId: z.string().min(1),
      phaseNumber: z.number().int().min(0).max(99),
      assignee: z.enum(["claude", "codex", "manual"]).default("claude"),
    },
    execute: (args: { objectiveId: string; phaseNumber: number; assignee: string }) =>
      roadmapApiClient.createRun(args.objectiveId, args.phaseNumber, args.assignee),
  },
  {
    name: "roadmap_registrar_relatorio_conclusao",
    title: "Registrar relatório de conclusão do objetivo",
    description:
      "Grava o relatório Markdown completo de conclusão de um objetivo (chamado na fase de arquivamento/Kowalski, sem o limite de 4000 caracteres do resultSummary de fase). Sobrescreve o relatório anterior se o objetivo for reexecutado.",
    inputSchema: {
      objectiveId: z.string().min(1),
      reportMarkdown: z.string().min(1).max(200_000),
    },
    execute: (args: { objectiveId: string; reportMarkdown: string }) =>
      roadmapApiClient.setCompletionReport(args.objectiveId, args.reportMarkdown),
  },
] as const;
