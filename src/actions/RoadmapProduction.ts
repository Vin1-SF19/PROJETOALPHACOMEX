"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  listarAcessoModulo,
  toggleAcessoModulo,
} from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import {
  requireRoadmapAccess,
  requireRoadmapProductionAccess,
} from "@/lib/roadmap-alpha/authorization";
import {
  approveRoadmapProductionRun,
  createRoadmapProductionRun,
  getRoadmapProductionRunDetail,
  listRoadmapProductionEvents,
  listRoadmapProductionQueue,
  registerRoadmapProductionEvent,
  RoadmapProductionOperationError,
  updateRoadmapProductionRunStatus,
} from "@/lib/roadmap-production-api/operations";
import { ROADMAP_RUN_STATUSES } from "@/lib/roadmap-production-api/status-machine";
import { isAdminRole } from "@/lib/roles";

const ROUTE = "/PainelAlpha/Roadmap";
const PRODUCTION_PERMISSION = "roadmapProduction";
const runIdSchema = z.string().min(1).max(240);
const userIdSchema = z.number().int().positive();
const statusUpdateSchema = z
  .object({
    runId: runIdSchema,
    status: z.enum(ROADMAP_RUN_STATUSES),
    resultSummary: z.string().trim().min(1).max(4_000).optional(),
    errorCode: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
const eventSchema = z
  .object({
    runId: runIdSchema,
    kind: z.enum(["MESSAGE", "QUESTION", "ANSWER", "NOTE"]),
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();
const createRunSchema = z
  .object({
    objectiveId: z.string().min(1),
    phaseNumber: z.number().int().min(0).max(99),
    assignee: z.enum(["claude", "codex", "manual"]).default("claude"),
  })
  .strict();

function publicError(error: unknown): string {
  if (error instanceof RoadmapProductionOperationError) return error.message;
  if (
    error instanceof Error &&
    ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
  )
    return "Não autorizado";
  return "Não foi possível concluir a operação";
}

async function authorName(userId: number): Promise<string> {
  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { nome: true },
  });
  return user?.nome?.trim() || `Administrador #${userId}`;
}

function serializeQueueRun(
  run: Awaited<ReturnType<typeof listRoadmapProductionQueue>>[number],
) {
  return {
    id: run.id,
    status: run.status,
    assignee: run.assignee,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    resultSummary: run.resultSummary,
    errorCode: run.errorCode,
    updatedAt: run.updatedAt.toISOString(),
    objective: run.objective,
    artifact: run.artifact,
  };
}

function serializeEvent(
  event: Awaited<ReturnType<typeof listRoadmapProductionEvents>>[number],
) {
  return {
    id: event.id,
    kind: event.kind,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    content: event.content,
    authorKind: event.authorKind,
    authorLabel: event.authorLabel,
    createdAt: event.createdAt.toISOString(),
  };
}

export async function ObterRoadmapProduction(moduleKey: string) {
  try {
    const access = await requireRoadmapProductionAccess();
    const scopedModuleKey = z.string().trim().min(1).max(120).parse(moduleKey);
    const queue = await listRoadmapProductionQueue({ moduleKey: scopedModuleKey });
    return {
      success: true as const,
      canManage: access.canMutate,
      queue: queue.map(serializeQueueRun),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function ObterFaseRoadmapProduction(runId: unknown) {
  try {
    await requireRoadmapProductionAccess();
    const id = runIdSchema.parse(runId);
    const run = await getRoadmapProductionRunDetail(id);
    return { success: true as const, run };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function ListarAcessosRoadmapProduction() {
  try {
    await requireRoadmapProductionAccess(true);
    const users = await listarAcessoModulo(PRODUCTION_PERMISSION);
    return {
      success: true as const,
      data: users.map((user) => ({
        id: user.id,
        nome: user.nome,
        usuario: user.usuario,
        role: user.role,
        status: user.status,
        imagemUrl: user.imagemUrl,
        locked: isAdminRole(user.role),
        hasAccess:
          isAdminRole(user.role) ||
          user.permissaoOverrides.some((override) => override.acao === "ADD"),
      })),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

export async function AlternarAcessoRoadmapProduction(usuarioId: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const id = userIdSchema.parse(usuarioId);
    const user = await db.usuarios.findUnique({
      where: { id },
      select: { role: true, status: true },
    });
    if (!user || user.status !== "ATIVO" || isAdminRole(user.role))
      throw new Error("FORBIDDEN");
    const result = await toggleAcessoModulo(id, PRODUCTION_PERMISSION);
    revalidatePath(ROUTE);
    return result;
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function CriarFaseRoadmapProduction(payload: unknown) {
  try {
    const access = await requireRoadmapProductionAccess(true);
    const input = createRunSchema.parse(payload);
    const run = await createRoadmapProductionRun(
      input.objectiveId,
      input.phaseNumber,
      input.assignee,
      access.userId,
    );
    revalidatePath(ROUTE);
    return { success: true as const, run };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise os campos da fase" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function AtualizarStatusRoadmapProduction(payload: unknown) {
  try {
    const access = await requireRoadmapProductionAccess(true);
    const input = statusUpdateSchema.parse(payload);
    const author = await authorName(access.userId);
    const run = await updateRoadmapProductionRunStatus(
      input.runId,
      input.status,
      { authorKind: "user", authorLabel: author, authorUserId: access.userId },
      { resultSummary: input.resultSummary, errorCode: input.errorCode },
    );
    revalidatePath(ROUTE);
    return { success: true as const, run };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise os campos do status" };
    return { success: false as const, error: publicError(error) };
  }
}

/**
 * Deliberadamente usa requireRoadmapAccess (não requireRoadmapProductionAccess)
 * — aprovar é uma decisão de gestão. O card de objetivo na lista principal
 * precisa poder aprovar mesmo sem acesso à tela de Produção.
 */
export async function AprovarFaseRoadmapProduction(runId: unknown) {
  try {
    const access = await requireRoadmapAccess(true);
    const id = runIdSchema.parse(runId);
    const author = await authorName(access.userId);
    const run = await approveRoadmapProductionRun(id, {
      authorKind: "user",
      authorLabel: author,
      authorUserId: access.userId,
    });
    revalidatePath(ROUTE);
    return { success: true as const, run };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function RegistrarEventoRoadmapProduction(payload: unknown) {
  try {
    const access = await requireRoadmapProductionAccess(true);
    const input = eventSchema.parse(payload);
    const author = await authorName(access.userId);
    const event = await registerRoadmapProductionEvent(input.runId, input.kind, input.content, {
      authorKind: "user",
      authorLabel: author,
      authorUserId: access.userId,
    });
    revalidatePath(ROUTE);
    return { success: true as const, event };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise a mensagem" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function ListarHistoricoRoadmapProduction(runId: unknown) {
  try {
    await requireRoadmapProductionAccess();
    const id = runIdSchema.parse(runId);
    const events = await listRoadmapProductionEvents(id, 100);
    return { success: true as const, data: events.map(serializeEvent) };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

/**
 * Mesma autorização de AprovarFaseRoadmapProduction — badges de "aguardando
 * aprovação"/"precisando de atenção" no dashboard não dependem de acesso à
 * tela de Produção, só de acesso ao Roadmap em si.
 */
export async function ListarExecucoesAguardandoAprovacao() {
  try {
    await requireRoadmapAccess();
    const runs = await db.roadmapProductionRun.findMany({
      where: { status: "AWAITING_APPROVAL" },
      select: { id: true, objectiveId: true },
    });
    return {
      success: true as const,
      data: runs.map((run) => ({ objectiveId: run.objectiveId, executionId: run.id })),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

export async function ListarExecucoesPrecisandoAtencao() {
  try {
    await requireRoadmapAccess();
    const runs = await db.roadmapProductionRun.findMany({
      where: { status: { in: ["NEEDS_INPUT", "BLOCKED"] } },
      select: { id: true, objectiveId: true, status: true },
    });
    return {
      success: true as const,
      data: runs.map((run) => ({
        objectiveId: run.objectiveId,
        executionId: run.id,
        status: run.status as "NEEDS_INPUT" | "BLOCKED",
      })),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

export async function ListarExecucoesPorObjetivo() {
  try {
    const access = await requireRoadmapAccess();
    if (!access.canAccessProduction) {
      return { success: false as const, error: "Não autorizado", data: [] };
    }
    const runs = await db.roadmapProductionRun.findMany({
      select: { id: true, objectiveId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const latestByObjective = new Map<
      string,
      { objectiveId: string; executionId: string; status: string }
    >();
    for (const run of runs) {
      if (latestByObjective.has(run.objectiveId)) continue;
      latestByObjective.set(run.objectiveId, {
        objectiveId: run.objectiveId,
        executionId: run.id,
        status: run.status,
      });
    }
    return { success: true as const, data: Array.from(latestByObjective.values()) };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}
