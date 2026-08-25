import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { getRoadmapModuleCatalogWithWorkspaces } from "@/lib/roadmap-alpha/catalog";
import type { RoadmapObjectiveContent, RoadmapObjectiveInput } from "@/lib/roadmap-alpha/contracts";

const PRIORITY_SHIFT = 1_000_000;

function objectiveCode(): string {
  return `RM-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function openPriorityCount(tx: Prisma.TransactionClient): Promise<number> {
  return tx.roadmapObjective.count({ where: { archivedAt: null } });
}

async function shiftPrioritiesUp(tx: Prisma.TransactionClient, from: number, to?: number): Promise<void> {
  const range = { gte: from, ...(to === undefined ? {} : { lte: to }) };
  await tx.roadmapObjective.updateMany({
    where: { archivedAt: null, globalPriority: range },
    data: { globalPriority: { increment: PRIORITY_SHIFT } },
  });
  await tx.roadmapObjective.updateMany({
    where: { archivedAt: null, globalPriority: { gte: from + PRIORITY_SHIFT, ...(to === undefined ? {} : { lte: to + PRIORITY_SHIFT }) } },
    data: { globalPriority: { decrement: PRIORITY_SHIFT - 1 } },
  });
}

async function shiftPrioritiesDown(tx: Prisma.TransactionClient, from: number, to: number): Promise<void> {
  await tx.roadmapObjective.updateMany({
    where: { archivedAt: null, globalPriority: { gte: from, lte: to } },
    data: { globalPriority: { increment: PRIORITY_SHIFT } },
  });
  await tx.roadmapObjective.updateMany({
    where: { archivedAt: null, globalPriority: { gte: from + PRIORITY_SHIFT, lte: to + PRIORITY_SHIFT } },
    data: { globalPriority: { decrement: PRIORITY_SHIFT + 1 } },
  });
}

export async function createRoadmapObjective(input: RoadmapObjectiveInput, createdById: number) {
  const catalog = await getRoadmapModuleCatalogWithWorkspaces();
  const moduleSnapshot = catalog.find((item) => item.id === input.moduleKey);
  if (!moduleSnapshot) throw new Error("UNKNOWN_MODULE");

  return db.$transaction(async (tx) => {
    const count = await openPriorityCount(tx);
    const priority = Math.min(input.globalPriority, count + 1);
    await shiftPrioritiesUp(tx, priority);

    const objective = await tx.roadmapObjective.create({
      data: {
        code: objectiveCode(),
        moduleKey: moduleSnapshot.id,
        moduleLabelSnapshot: moduleSnapshot.label,
        moduleCategorySnapshot: moduleSnapshot.category,
        title: input.title,
        description: input.description,
        desiredOutcome: input.desiredOutcome,
        constraints: input.constraints,
        acceptanceCriteriaJson: JSON.stringify(input.acceptanceCriteria),
        globalPriority: priority,
        isNewModule: input.isNewModule,
        createdById,
      },
    });

    const job = await tx.roadmapDocumentationJob.create({
      data: {
        objectiveId: objective.id,
        sourceVersion: objective.sourceVersion,
        idempotencyKey: `${objective.id}:v${objective.sourceVersion}`,
        prioritySnapshot: priority,
        maxAttempts: 30,
      },
    });

    return { objective, job };
  });
}

export async function moveRoadmapObjective(objectiveId: string, requestedPriority: number) {
  return db.$transaction(async (tx) => {
    const objective = await tx.roadmapObjective.findUnique({ where: { id: objectiveId } });
    if (!objective || objective.archivedAt) throw new Error("OBJECTIVE_NOT_FOUND");
    const count = await openPriorityCount(tx);
    const nextPriority = Math.max(1, Math.min(requestedPriority, count));
    if (nextPriority === objective.globalPriority) return objective;

    const minimum = await tx.roadmapObjective.aggregate({ _min: { globalPriority: true } });
    const sentinel = Math.min(minimum._min.globalPriority ?? 0, 0) - 1;
    await tx.roadmapObjective.update({ where: { id: objectiveId }, data: { globalPriority: sentinel } });
    if (nextPriority < objective.globalPriority) {
      await shiftPrioritiesUp(tx, nextPriority, objective.globalPriority - 1);
    } else {
      await shiftPrioritiesDown(tx, objective.globalPriority + 1, nextPriority);
    }
    const updated = await tx.roadmapObjective.update({
      where: { id: objectiveId },
      data: { globalPriority: nextPriority },
    });
    await tx.roadmapDocumentationJob.updateMany({
      where: { objectiveId, status: { in: ["PENDING", "RETRY_WAIT"] } },
      data: { prioritySnapshot: nextPriority },
    });
    return updated;
  });
}

async function retireRoadmapObjective(objectiveId: string, status: "ARCHIVED" | "DELETED") {
  return db.$transaction(async (tx) => {
    const objective = await tx.roadmapObjective.findUnique({ where: { id: objectiveId } });
    if (!objective || objective.archivedAt) throw new Error("OBJECTIVE_NOT_FOUND");
    const minimum = await tx.roadmapObjective.aggregate({ _min: { globalPriority: true } });
    const archivedPriority = Math.min(minimum._min.globalPriority ?? 0, 0) - 1;
    await tx.roadmapObjective.update({
      where: { id: objectiveId },
      data: { globalPriority: archivedPriority, archivedAt: new Date(), status, documentationStatus: "SUPERSEDED" },
    });
    await shiftPrioritiesDown(tx, objective.globalPriority + 1, await openPriorityCount(tx) + 1);
    await tx.roadmapDocumentationJob.updateMany({
      where: { objectiveId, status: { in: ["PENDING", "PROCESSING", "RETRY_WAIT"] } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        claimedBy: null,
        claimExpiresAt: null,
        heartbeatAt: null,
        claimToken: { increment: 1 },
      },
    });
    await tx.roadmapDocumentationAttempt.updateMany({
      where: { job: { objectiveId }, status: "RUNNING" },
      data: { status: "FAILED", finishedAt: new Date(), errorCode: `OBJECTIVE_${status}`, errorMessage: `OBJECTIVE_${status}` },
    });
  });
}

export async function archiveRoadmapObjective(objectiveId: string) {
  return retireRoadmapObjective(objectiveId, "ARCHIVED");
}

export async function deleteRoadmapObjective(objectiveId: string) {
  return retireRoadmapObjective(objectiveId, "DELETED");
}

export async function purgeExpiredDeletedRoadmapObjectives(referenceDate = new Date()): Promise<number> {
  const expiresBefore = new Date(referenceDate.getTime() - 3 * 24 * 60 * 60 * 1_000);
  const result = await db.roadmapObjective.deleteMany({
    where: { status: "DELETED", archivedAt: { lte: expiresBefore } },
  });
  return result.count;
}

export async function retryRoadmapObjective(objectiveId: string) {
  return db.$transaction(async (tx) => {
    const objective = await tx.roadmapObjective.findUnique({ where: { id: objectiveId } });
    if (!objective || objective.archivedAt) throw new Error("OBJECTIVE_NOT_FOUND");
    const nextVersion = objective.sourceVersion + 1;
    await tx.roadmapDocumentationJob.updateMany({
      where: { objectiveId, status: { in: ["PENDING", "PROCESSING", "RETRY_WAIT"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), claimToken: { increment: 1 } },
    });
    await tx.roadmapPromptArtifact.updateMany({
      where: { objectiveId, documentationVersion: objective.sourceVersion, status: "PUBLISHED" },
      data: { status: "SUPERSEDED" },
    });
    const updated = await tx.roadmapObjective.update({
      where: { id: objectiveId },
      data: { sourceVersion: nextVersion, status: "ACTIVE", documentationStatus: "PENDING" },
    });
    const job = await tx.roadmapDocumentationJob.create({
      data: {
        objectiveId,
        sourceVersion: nextVersion,
        idempotencyKey: `${objectiveId}:v${nextVersion}`,
        prioritySnapshot: objective.globalPriority,
        maxAttempts: 30,
      },
    });
    return { objective: updated, job };
  });
}

export async function updateRoadmapObjective(objectiveId: string, input: RoadmapObjectiveContent) {
  const catalog = await getRoadmapModuleCatalogWithWorkspaces();
  const moduleSnapshot = catalog.find((item) => item.id === input.moduleKey);
  if (!moduleSnapshot) throw new Error("UNKNOWN_MODULE");
  const acceptanceCriteriaJson = JSON.stringify(input.acceptanceCriteria);

  return db.$transaction(async (tx) => {
    const current = await tx.roadmapObjective.findUnique({ where: { id: objectiveId } });
    if (!current || current.archivedAt) throw new Error("OBJECTIVE_NOT_FOUND");
    /**
     * Objetivo de módulo novo nunca pode ser "movido" para outro módulo na
     * edição — moduleKey dele é sempre o placeholder do módulo Roadmap Alpha
     * em si (histórico da criação, ver CreateObjectiveDialog), não um módulo
     * de destino real. Trocar isso corromperia o objetivo (o worker de
     * documentação passaria a tratá-lo como ajuste de módulo existente em
     * vez de criação de módulo novo, ver worker.ts).
     */
    if (current.isNewModule && input.moduleKey !== current.moduleKey) {
      throw new Error("CANNOT_CHANGE_MODULE_OF_NEW_MODULE_OBJECTIVE");
    }
    const materialChanged = current.moduleKey !== input.moduleKey
      || current.title !== input.title
      || current.description !== input.description
      || current.desiredOutcome !== (input.desiredOutcome ?? null)
      || current.constraints !== (input.constraints ?? null)
      || current.acceptanceCriteriaJson !== acceptanceCriteriaJson;
    if (!materialChanged) return { objective: current, regenerated: false };

    const nextVersion = current.sourceVersion + 1;
    await tx.roadmapDocumentationJob.updateMany({
      where: { objectiveId, status: { in: ["PENDING", "PROCESSING", "RETRY_WAIT"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), claimToken: { increment: 1 } },
    });
    await tx.roadmapPromptArtifact.updateMany({
      where: { objectiveId, documentationVersion: current.sourceVersion, status: "PUBLISHED" },
      data: { status: "SUPERSEDED" },
    });
    const objective = await tx.roadmapObjective.update({
      where: { id: objectiveId },
      data: {
        moduleKey: moduleSnapshot.id,
        moduleLabelSnapshot: moduleSnapshot.label,
        moduleCategorySnapshot: moduleSnapshot.category,
        title: input.title,
        description: input.description,
        desiredOutcome: input.desiredOutcome ?? null,
        constraints: input.constraints ?? null,
        acceptanceCriteriaJson,
        sourceVersion: nextVersion,
        status: "ACTIVE",
        documentationStatus: "PENDING",
      },
    });
    await tx.roadmapDocumentationJob.create({
      data: {
        objectiveId,
        sourceVersion: nextVersion,
        idempotencyKey: `${objectiveId}:v${nextVersion}`,
        prioritySnapshot: current.globalPriority,
        maxAttempts: 30,
      },
    });
    return { objective, regenerated: true };
  });
}
