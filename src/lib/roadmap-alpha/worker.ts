import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";
import { generateRoadmapManifest } from "@/lib/roadmap-alpha/qwen-generator";
import { markdownSha256, publishRoadmapProjection } from "@/lib/roadmap-alpha/projection";

const LEASE_MS = 4 * 60_000;
const HEARTBEAT_MS = 30_000;

function sanitizedErrorCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z_]+$/.test(error.message)) return error.message.slice(0, 80);
  return "DOCUMENTATION_FAILED";
}

async function claimNextJob(workerId: string) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const candidate = await tx.roadmapDocumentationJob.findFirst({
      where: {
        availableAt: { lte: now },
        objective: { archivedAt: null },
        OR: [
          { status: { in: ["PENDING", "RETRY_WAIT"] } },
          { status: "PROCESSING", claimExpiresAt: { lt: now } },
        ],
      },
      orderBy: [{ prioritySnapshot: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    if (!candidate) return null;
    if (candidate.status === "PROCESSING") {
      await tx.roadmapDocumentationAttempt.updateMany({
        where: { jobId: candidate.id, status: "RUNNING" },
        data: { status: "FAILED", finishedAt: now, errorCode: "LEASE_EXPIRED", errorMessage: "LEASE_EXPIRED" },
      });
    }
    const claimed = await tx.roadmapDocumentationJob.updateMany({
      where: {
        id: candidate.id,
        claimToken: candidate.claimToken,
        OR: [
          { status: { in: ["PENDING", "RETRY_WAIT"] } },
          { status: "PROCESSING", claimExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: "PROCESSING",
        claimedBy: workerId,
        claimedAt: now,
        heartbeatAt: now,
        claimExpiresAt: new Date(now.getTime() + LEASE_MS),
        claimToken: { increment: 1 },
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;
    const job = await tx.roadmapDocumentationJob.findUnique({
      where: { id: candidate.id },
      include: { objective: true },
    });
    if (job) await tx.roadmapObjective.update({ where: { id: job.objectiveId }, data: { documentationStatus: "DOCUMENTING" } });
    return job;
  });
}

export async function processNextRoadmapJob(workerId = `roadmap-${randomUUID()}`) {
  const job = await claimNextJob(workerId);
  if (!job) return { processed: false as const };
  const attempt = await db.roadmapDocumentationAttempt.create({
    data: {
      jobId: job.id,
      attemptNumber: job.attemptCount,
      provider: "ollama",
      model: process.env.ROADMAP_QWEN_MODEL ?? "UNCONFIGURED",
      status: "RUNNING",
    },
  });
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const now = new Date();
    void db.roadmapDocumentationJob.updateMany({
      where: { id: job.id, status: "PROCESSING", claimedBy: workerId, claimToken: job.claimToken },
      data: { heartbeatAt: now, claimExpiresAt: new Date(now.getTime() + LEASE_MS) },
    }).catch(() => undefined);
  }, HEARTBEAT_MS);

  try {
    const acceptanceCriteria = JSON.parse(job.objective.acceptanceCriteriaJson) as string[];
    const generated = await generateRoadmapManifest({
      code: job.objective.code,
      moduleKey: job.objective.moduleKey,
      moduleLabel: job.objective.moduleLabelSnapshot,
      title: job.objective.title,
      description: job.objective.description,
      desiredOutcome: job.objective.desiredOutcome,
      constraints: job.objective.constraints,
      acceptanceCriteria,
    });

    const current = await db.roadmapDocumentationJob.findUnique({ where: { id: job.id }, include: { objective: true } });
    if (!current || current.objective.archivedAt || current.status !== "PROCESSING" || current.claimedBy !== workerId || current.claimToken !== job.claimToken || current.sourceVersion !== current.objective.sourceVersion) {
      throw new Error("STALE_WORKER_RESULT");
    }

    const projection = await publishRoadmapProjection({
      moduleKey: current.objective.moduleKey,
      objectiveCode: current.objective.code,
      version: current.sourceVersion,
      manifest: generated.manifest,
    });
    const relativeDirectory = projection.relativeDirectory;

    await db.$transaction(async (tx) => {
      const fencing = await tx.roadmapDocumentationJob.findUnique({ where: { id: job.id }, include: { objective: true } });
      if (!fencing || fencing.objective.archivedAt || fencing.status !== "PROCESSING" || fencing.claimToken !== job.claimToken || fencing.sourceVersion !== fencing.objective.sourceVersion) {
        throw new Error("STALE_WORKER_RESULT");
      }
      await tx.roadmapPromptArtifact.deleteMany({
        where: { objectiveId: job.objectiveId, documentationVersion: job.sourceVersion, status: "DRAFT" },
      });
      await tx.roadmapPromptArtifact.createMany({
        data: generated.manifest.phases.map((phase) => ({
          objectiveId: job.objectiveId,
          jobId: job.id,
          attemptId: attempt.id,
          documentationVersion: job.sourceVersion,
          phaseNumber: phase.number,
          slug: phase.slug,
          title: phase.title,
          kind: phase.kind,
          agent: phase.agent,
          dependsOnJson: JSON.stringify(phase.dependsOn),
          contentMarkdown: phase.markdown,
          relativePath: `${relativeDirectory}/${String(phase.number).padStart(2, "0")}-${phase.slug}.md`,
          sha256: markdownSha256(phase.markdown),
          status: "PUBLISHED",
          publishedAt: new Date(),
        })),
      });
      await tx.roadmapDocumentationAttempt.update({
        where: { id: attempt.id },
        data: { status: "SUCCEEDED", finishedAt: new Date(), durationMs: Date.now() - startedAt, responseSha256: generated.responseSha256 },
      });
      await tx.roadmapDocumentationJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", completedAt: new Date(), claimedBy: null, claimExpiresAt: null, heartbeatAt: null },
      });
      await tx.roadmapObjective.update({ where: { id: job.objectiveId }, data: { documentationStatus: "DOCUMENTED" } });
    });
    return { processed: true as const, success: true as const, objectiveCode: job.objective.code, phaseCount: generated.manifest.phases.length };
  } catch (error) {
    const originalErrorCode = sanitizedErrorCode(error);
    const delayMs = Math.min(30 * 60_000, 30_000 * 2 ** Math.max(0, job.attemptCount - 1));
    const failure = await db.$transaction(async (tx) => {
      const fencing = await tx.roadmapDocumentationJob.findUnique({ where: { id: job.id }, include: { objective: true } });
      const stale = originalErrorCode === "STALE_WORKER_RESULT"
        || !fencing
        || Boolean(fencing.objective.archivedAt)
        || fencing.status !== "PROCESSING"
        || fencing.claimedBy !== workerId
        || fencing.claimToken !== job.claimToken
        || fencing.sourceVersion !== fencing.objective.sourceVersion;
      const errorCode = stale ? "STALE_WORKER_RESULT" : originalErrorCode;
      await tx.roadmapDocumentationAttempt.updateMany({
        where: { id: attempt.id, status: "RUNNING" },
        data: { status: "FAILED", finishedAt: new Date(), durationMs: Date.now() - startedAt, errorCode, errorMessage: errorCode },
      });
      if (stale) return { errorCode, retry: false, superseded: true };

      const retry = job.attemptCount < job.maxAttempts && originalErrorCode !== "PROJECTION_CONFLICT";
      await tx.roadmapDocumentationJob.update({
        where: { id: job.id },
        data: retry
          ? { status: "RETRY_WAIT", availableAt: new Date(Date.now() + delayMs), lastErrorCode: errorCode, lastErrorMessage: errorCode, claimedBy: null, claimExpiresAt: null, heartbeatAt: null }
          : { status: "DEAD_LETTER", deadLetteredAt: new Date(), lastErrorCode: errorCode, lastErrorMessage: errorCode, claimedBy: null, claimExpiresAt: null, heartbeatAt: null },
      });
      await tx.roadmapObjective.update({
        where: { id: job.objectiveId },
        data: { documentationStatus: retry ? "RETRY_WAIT" : "FAILED" },
      });
      return { errorCode, retry, superseded: false };
    });
    return { processed: true as const, success: false as const, objectiveCode: job.objective.code, ...failure };
  } finally {
    clearInterval(heartbeat);
  }
}
