"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import db from "@/lib/prisma";
import { isValidRoadmapModuleKey } from "@/lib/roadmap-alpha/catalog";
import { requireRoadmapAccess } from "@/lib/roadmap-alpha/authorization";
import {
  roadmapObjectiveCreateSchema,
  roadmapObjectiveEditSchema,
} from "@/lib/roadmap-alpha/contracts";
import {
  improveRoadmapField,
  roadmapImproveFieldSchema,
} from "@/lib/roadmap-alpha/improve-with-ai";
import {
  archiveRoadmapObjective,
  createRoadmapObjective,
  deleteRoadmapObjective,
  moveRoadmapObjective,
  purgeExpiredDeletedRoadmapObjectives,
  retryRoadmapObjective,
  updateRoadmapObjective,
} from "@/lib/roadmap-alpha/objectives";

const ROUTE = "/PainelAlpha/Roadmap";
const idSchema = z.string().cuid();
const moveSchema = z
  .object({
    objectiveId: idSchema,
    globalPriority: z.number().int().positive().max(9_999),
  })
  .strict();

function publicError(error: unknown): string {
  if (
    error instanceof Error &&
    ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
  )
    return "Não autorizado";
  if (error instanceof Error && error.message === "OBJECTIVE_NOT_FOUND")
    return "Objetivo não encontrado";
  if (error instanceof Error && error.message === "MODULE_KEY_INVALID")
    return "Projeto desconhecido — selecione um projeto ou sistema externo válido";
  if (
    error instanceof Error &&
    error.message === "CANNOT_CHANGE_MODULE_OF_NEW_MODULE_OBJECTIVE"
  )
    return "Este objetivo cria um módulo novo — não é possível associá-lo a um projeto existente";
  return "Não foi possível concluir a operação";
}

export async function ListarRoadmapAlpha(moduleKey?: string) {
  try {
    const access = await requireRoadmapAccess();
    await purgeExpiredDeletedRoadmapObjectives();
    const where = { ...(moduleKey ? { moduleKey } : {}) };
    const objectives = await db.roadmapObjective.findMany({
      where,
      orderBy: [
        { globalPriority: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      include: {
        createdBy: { select: { id: true, nome: true } },
        documentationJobs: {
          orderBy: { sourceVersion: "desc" },
          take: 1,
          select: {
            status: true,
            attemptCount: true,
            maxAttempts: true,
            lastErrorCode: true,
          },
        },
        promptArtifacts: { orderBy: { phaseNumber: "asc" } },
      },
    });
    return {
      success: true as const,
      canMutate: access.canMutate,
      canAccessProduction: access.canAccessProduction,
      data: objectives.map((objective) => ({
        ...objective,
        acceptanceCriteria: JSON.parse(
          objective.acceptanceCriteriaJson,
        ) as string[],
        developmentProvider: objective.developmentAssignee as "claude" | "codex",
        createdAt: objective.createdAt.toISOString(),
        updatedAt: objective.updatedAt.toISOString(),
        archivedAt: objective.archivedAt?.toISOString() ?? null,
        trashExpiresAt:
          objective.status === "DELETED" && objective.archivedAt
            ? new Date(
                objective.archivedAt.getTime() + 3 * 24 * 60 * 60 * 1_000,
              ).toISOString()
            : null,
        promptArtifacts: objective.promptArtifacts
          .filter(
            (artifact) =>
              artifact.documentationVersion === objective.sourceVersion,
          )
          .map((artifact) => ({
            ...artifact,
            createdAt: artifact.createdAt.toISOString(),
            updatedAt: artifact.updatedAt.toISOString(),
            publishedAt: artifact.publishedAt?.toISOString() ?? null,
          })),
      })),
    };
  } catch (error) {
    return {
      success: false as const,
      error: publicError(error),
      data: [],
      canMutate: false,
      canAccessProduction: false,
    };
  }
}

export async function CriarObjetivoRoadmap(payload: unknown) {
  try {
    const access = await requireRoadmapAccess(true);
    const input = roadmapObjectiveCreateSchema.parse(payload);
    if (!(await isValidRoadmapModuleKey(input.moduleKey)))
      throw new Error("MODULE_KEY_INVALID");
    const { developmentProvider, ...objectiveInput } = input;
    const result = await createRoadmapObjective(objectiveInput, access.userId);
    await db.roadmapObjective.update({
      where: { id: result.objective.id },
      data: { developmentAssignee: developmentProvider },
    });
    revalidatePath(ROUTE);
    return { success: true as const, objectiveId: result.objective.id };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise os campos do objetivo" };
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
    const parsed = z
      .object({ objectiveId: idSchema, content: roadmapObjectiveEditSchema })
      .strict()
      .parse(payload);
    if (!(await isValidRoadmapModuleKey(parsed.content.moduleKey)))
      throw new Error("MODULE_KEY_INVALID");
    const { developmentProvider, ...objectiveContent } = parsed.content;
    const previousObjective = await db.roadmapObjective.findUnique({
      where: { id: parsed.objectiveId },
      select: { developmentAssignee: true },
    });
    const previousDevelopmentProvider = previousObjective?.developmentAssignee ?? "claude";
    const result = await updateRoadmapObjective(
      parsed.objectiveId,
      objectiveContent,
    );
    await db.roadmapObjective.update({
      where: { id: parsed.objectiveId },
      data: { developmentAssignee: developmentProvider },
    });
    revalidatePath(ROUTE);
    return {
      success: true as const,
      regenerated: result.regenerated,
      providerChanged: previousDevelopmentProvider !== developmentProvider,
      developmentProvider,
    };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise os campos do objetivo" };
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

export async function ExcluirObjetivoRoadmap(objectiveId: string) {
  try {
    await requireRoadmapAccess(true);
    await deleteRoadmapObjective(idSchema.parse(objectiveId));
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

export async function MelhorarCampoObjetivoRoadmap(payload: unknown) {
  try {
    await requireRoadmapAccess(true);
    const input = z
      .object({
        field: roadmapImproveFieldSchema,
        value: z.string().max(10_000),
        context: z
          .object({
            title: z.string().max(180).optional(),
            description: z.string().max(10_000).optional(),
            desiredOutcome: z.string().max(4_000).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .parse(payload);
    const improved = await improveRoadmapField(
      input.field,
      input.value,
      input.context,
    );
    return { success: true as const, improved };
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      (error instanceof Error &&
        error.message === "IMPROVEMENT_CONTEXT_REQUIRED")
    ) {
      return {
        success: false as const,
        error:
          "Escreva uma ideia inicial ou preencha outro campo para dar contexto à IA",
      };
    }
    return { success: false as const, error: publicError(error) };
  }
}
