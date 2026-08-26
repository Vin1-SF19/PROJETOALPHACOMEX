import "server-only";

import db from "@/lib/prisma";
import {
  assertRoadmapRunTransition,
  isValidRoadmapRunStatus,
  type RoadmapRunStatus,
} from "./status-machine";

export class RoadmapProductionOperationError extends Error {
  constructor(
    public readonly status: 400 | 404,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoadmapProductionOperationError";
  }
}

async function getRunOrThrow(runId: string) {
  const run = await db.roadmapProductionRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new RoadmapProductionOperationError(404, "RUN_NOT_FOUND", "Fase não encontrada.");
  }
  return run;
}

export async function listRoadmapProductionQueue(filter: {
  status?: string;
  moduleKey?: string;
  assignee?: string;
}) {
  return db.roadmapProductionRun.findMany({
    where: {
      status: filter.status,
      assignee: filter.assignee,
      objective: filter.moduleKey ? { moduleKey: filter.moduleKey } : undefined,
    },
    include: {
      objective: {
        select: {
          id: true,
          code: true,
          title: true,
          moduleKey: true,
          moduleLabelSnapshot: true,
          // Só a data (não o Markdown inteiro, que pode ser grande) — suficiente para a UI
          // decidir se mostra o botão "Ver relatório de conclusão".
          completionReportGeneratedAt: true,
        },
      },
      artifact: {
        select: { phaseNumber: true, title: true, kind: true, relativePath: true },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });
}

export async function getRoadmapProductionRunDetail(runId: string, eventsLimit = 50) {
  const run = await db.roadmapProductionRun.findUnique({
    where: { id: runId },
    include: {
      objective: {
        select: { id: true, code: true, title: true, moduleKey: true, moduleLabelSnapshot: true },
      },
      artifact: true,
      events: { orderBy: { createdAt: "desc" }, take: eventsLimit },
    },
  });
  if (!run) {
    throw new RoadmapProductionOperationError(404, "RUN_NOT_FOUND", "Fase não encontrada.");
  }
  return run;
}

export async function listRoadmapProductionEvents(runId: string, limit: number, cursor?: string) {
  await getRunOrThrow(runId);
  return db.roadmapProductionEvent.findMany({
    where: { runId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

interface AuthorInfo {
  authorKind: "user" | "assistant" | "system";
  authorLabel: string;
  authorUserId: number | null;
}

export async function updateRoadmapProductionRunStatus(
  runId: string,
  toStatus: string,
  author: AuthorInfo,
  extra: { resultSummary?: string; errorCode?: string } = {},
) {
  if (!isValidRoadmapRunStatus(toStatus)) {
    throw new RoadmapProductionOperationError(400, "INVALID_STATUS", "Status inválido.");
  }
  const run = await getRunOrThrow(runId);
  const fromStatus = run.status as RoadmapRunStatus;
  try {
    assertRoadmapRunTransition(fromStatus, toStatus);
  } catch {
    throw new RoadmapProductionOperationError(
      400,
      "INVALID_TRANSITION",
      `Transição inválida: ${fromStatus} → ${toStatus}.`,
    );
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.roadmapProductionRun.update({
      where: { id: runId },
      data: {
        status: toStatus,
        startedAt: toStatus === "IN_PROGRESS" && !run.startedAt ? now : undefined,
        finishedAt: toStatus === "SUCCEEDED" || toStatus === "FAILED" ? now : undefined,
        resultSummary: extra.resultSummary ?? undefined,
        errorCode: toStatus === "FAILED" ? (extra.errorCode ?? undefined) : null,
      },
    });
    await tx.roadmapProductionEvent.create({
      data: {
        runId,
        kind: "STATUS_CHANGE",
        fromStatus,
        toStatus,
        content: extra.resultSummary ?? null,
        authorKind: author.authorKind,
        authorLabel: author.authorLabel,
        authorUserId: author.authorUserId,
      },
    });

    // Primeira fase a começar de fato move o objetivo para o filtro "Em
    // desenvolvimento" — nunca sobrescreve ARCHIVED/DELETED, só o estado
    // inicial ACTIVE (objetivo documentado ainda não tocado).
    if (toStatus === "IN_PROGRESS") {
      await tx.roadmapObjective.updateMany({
        where: { id: run.objectiveId, status: "ACTIVE" },
        data: { status: "IN_DEVELOPMENT" },
      });
    }

    // Última fase (maior phaseNumber publicado da mesma versão) concluída
    // com sucesso promove o objetivo inteiro para "Concluídos".
    if (toStatus === "SUCCEEDED") {
      const lastArtifact = await tx.roadmapPromptArtifact.findFirst({
        where: {
          objectiveId: run.objectiveId,
          documentationVersion: run.sourceVersion,
          status: "PUBLISHED",
        },
        orderBy: { phaseNumber: "desc" },
        select: { phaseNumber: true },
      });
      if (lastArtifact && run.phaseNumber === lastArtifact.phaseNumber) {
        await tx.roadmapObjective.updateMany({
          where: { id: run.objectiveId, status: { in: ["ACTIVE", "IN_DEVELOPMENT"] } },
          data: { status: "COMPLETED" },
        });
      }
    }

    return saved;
  });
  return updated;
}

export async function approveRoadmapProductionRun(runId: string, author: AuthorInfo) {
  return updateRoadmapProductionRunStatus(runId, "PENDING", author);
}

export async function registerRoadmapProductionEvent(
  runId: string,
  kind: "MESSAGE" | "QUESTION" | "ANSWER" | "NOTE",
  content: string,
  author: AuthorInfo,
) {
  await getRunOrThrow(runId);
  return db.$transaction(async (tx) => {
    const event = await tx.roadmapProductionEvent.create({
      data: {
        runId,
        kind,
        content,
        authorKind: author.authorKind,
        authorLabel: author.authorLabel,
        authorUserId: author.authorUserId,
      },
    });
    if (kind === "QUESTION") {
      const run = await tx.roadmapProductionRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status === "IN_PROGRESS") {
        await tx.roadmapProductionRun.update({
          where: { id: runId },
          data: { status: "NEEDS_INPUT" },
        });
      }
    }
    return event;
  });
}

export async function createRoadmapProductionRun(
  objectiveId: string,
  phaseNumber: number,
  assignee: string,
  createdById: number,
) {
  const objective = await db.roadmapObjective.findUnique({
    where: { id: objectiveId },
    select: { id: true, sourceVersion: true },
  });
  if (!objective) {
    throw new RoadmapProductionOperationError(404, "OBJECTIVE_NOT_FOUND", "Objetivo não encontrado.");
  }
  const artifact = await db.roadmapPromptArtifact.findFirst({
    where: {
      objectiveId,
      documentationVersion: objective.sourceVersion,
      phaseNumber,
      status: "PUBLISHED",
    },
  });
  if (!artifact) {
    throw new RoadmapProductionOperationError(
      404,
      "ARTIFACT_NOT_FOUND",
      "Fase documentada e publicada não encontrada para este objetivo/versão.",
    );
  }
  return db.roadmapProductionRun.upsert({
    where: {
      objectiveId_sourceVersion_phaseNumber: {
        objectiveId,
        sourceVersion: objective.sourceVersion,
        phaseNumber,
      },
    },
    update: {},
    create: {
      objectiveId,
      sourceVersion: objective.sourceVersion,
      phaseNumber,
      artifactId: artifact.id,
      assignee,
      createdById,
    },
  });
}

/**
 * Grava o relatório de conclusão completo (Markdown) de um objetivo — chamado na fase de
 * arquivamento (Kowalski), sem o limite de 4000 caracteres de RoadmapProductionRun.resultSummary.
 * Sobrescreve um relatório anterior se o objetivo for reexecutado/reaberto (1 relatório vigente
 * por objetivo, sem histórico de versões).
 */
export async function setRoadmapObjectiveCompletionReport(
  objectiveId: string,
  reportMarkdown: string,
) {
  const objective = await db.roadmapObjective.findUnique({
    where: { id: objectiveId },
    select: { id: true },
  });
  if (!objective) {
    throw new RoadmapProductionOperationError(404, "OBJECTIVE_NOT_FOUND", "Objetivo não encontrado.");
  }
  return db.roadmapObjective.update({
    where: { id: objectiveId },
    data: { completionReportMarkdown: reportMarkdown, completionReportGeneratedAt: new Date() },
    select: { id: true, completionReportGeneratedAt: true },
  });
}
