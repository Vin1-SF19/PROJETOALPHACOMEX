"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import db from "@/lib/prisma";
import { requireRoadmapAccess } from "@/lib/roadmap-alpha/authorization";
import { roadmapObjectiveContentSchema, roadmapObjectiveInputSchema } from "@/lib/roadmap-alpha/contracts";
import {
  archiveRoadmapObjective,
  createRoadmapObjective,
  moveRoadmapObjective,
  retryRoadmapObjective,
  updateRoadmapObjective,
} from "@/lib/roadmap-alpha/objectives";

const ROUTE = "/PainelAlpha/Roadmap";
const idSchema = z.string().cuid();
const moveSchema = z.object({ objectiveId: idSchema, globalPriority: z.number().int().positive().max(9_999) }).strict();

function publicError(error: unknown): string {
  if (error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) return "Não autorizado";
  if (error instanceof Error && error.message === "OBJECTIVE_NOT_FOUND") return "Objetivo não encontrado";
  return "Não foi possível concluir a operação";
}

export async function ListarRoadmapAlpha(moduleKey?: string) {
  try {
    const access = await requireRoadmapAccess();
    const where = { archivedAt: null, ...(moduleKey ? { moduleKey } : {}) };
    const objectives = await db.roadmapObjective.findMany({
      where,
      orderBy: [{ globalPriority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: {
        createdBy: { select: { id: true, nome: true } },
        documentationJobs: { orderBy: { sourceVersion: "desc" }, take: 1, select: { status: true, attemptCount: true, maxAttempts: true, lastErrorCode: true } },
        promptArtifacts: { orderBy: { phaseNumber: "asc" } },
      },
    });
    return {
      success: true as const,
      canMutate: access.canMutate,
      canAccessProduction: access.canAccessProduction,
      data: objectives.map((objective) => ({
        ...objective,
        acceptanceCriteria: JSON.parse(objective.acceptanceCriteriaJson) as string[],
        createdAt: objective.createdAt.toISOString(),
        updatedAt: objective.updatedAt.toISOString(),
        archivedAt: objective.archivedAt?.toISOString() ?? null,
        promptArtifacts: objective.promptArtifacts
          .filter((artifact) => artifact.documentationVersion === objective.sourceVersion)
          .map((artifact) => ({ ...artifact, createdAt: artifact.createdAt.toISOString(), updatedAt: artifact.updatedAt.toISOString(), publishedAt: artifact.publishedAt?.toISOString() ?? null })),
      })),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [], canMutate: false, canAccessProduction: false };
  }
}

export async function CriarObjetivoRoadmap(payload: unknown) {
  try {
    const access = await requireRoadmapAccess(true);
    const input = roadmapObjectiveInputSchema.parse(payload);
    const result = await createRoadmapObjective(input, access.userId);
    revalidatePath(ROUTE);
    return { success: true as const, objectiveId: result.objective.id };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: "Revise os campos do objetivo" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function MoverObjetivoRoadmap(payload: unknown) {
  try {
    await requireRoadmapAccess(true);
    const input = moveSchema.parse(payload);
    await moveRoadmapObjective(input.objectiveId, input.globalPriority);
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function AtualizarObjetivoRoadmap(payload: unknown) {
  try {
    await requireRoadmapAccess(true);
    const parsed = z.object({ objectiveId: idSchema, content: roadmapObjectiveContentSchema }).strict().parse(payload);
    const result = await updateRoadmapObjective(parsed.objectiveId, parsed.content);
    revalidatePath(ROUTE);
    return { success: true as const, regenerated: result.regenerated };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: "Revise os campos do objetivo" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function ArquivarObjetivoRoadmap(objectiveId: string) {
  try {
    await requireRoadmapAccess(true);
    await archiveRoadmapObjective(idSchema.parse(objectiveId));
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function ReenfileirarObjetivoRoadmap(objectiveId: string) {
  try {
    await requireRoadmapAccess(true);
    await retryRoadmapObjective(idSchema.parse(objectiveId));
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
