import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import db from "@/lib/prisma";
import { roadmapPhaseManifestSchema } from "@/lib/roadmap-alpha/contracts";
import { publishRoadmapProjection } from "@/lib/roadmap-alpha/projection";

export async function enqueueMissingRoadmapJobs() {
  const objectives = await db.roadmapObjective.findMany({
    where: { archivedAt: null },
    select: { id: true, sourceVersion: true, globalPriority: true },
  });
  let enqueued = 0;
  for (const objective of objectives) {
    const existing = await db.roadmapDocumentationJob.findUnique({
      where: { objectiveId_sourceVersion: { objectiveId: objective.id, sourceVersion: objective.sourceVersion } },
      select: { id: true },
    });
    if (existing) continue;
    await db.roadmapDocumentationJob.create({
      data: {
        objectiveId: objective.id,
        sourceVersion: objective.sourceVersion,
        idempotencyKey: `${objective.id}:v${objective.sourceVersion}`,
        prioritySnapshot: objective.globalPriority,
      },
    });
    enqueued += 1;
  }
  return { ok: true, command: "enqueue", code: 0, checks: { scanned: objectives.length, enqueued }, timestamp: new Date().toISOString() };
}

function objectiveManifest(objective: {
  title: string;
  description: string;
  promptArtifacts: Array<{ phaseNumber: number; slug: string; title: string; kind: string; agent: string; dependsOnJson: string; contentMarkdown: string }>;
}) {
  const summary = `${objective.title}. ${objective.description}`.slice(0, 2_000).padEnd(20, ".");
  return roadmapPhaseManifestSchema.parse({
    contractVersion: 1,
    summary,
    phases: objective.promptArtifacts.map((artifact) => ({
      number: artifact.phaseNumber,
      slug: artifact.slug,
      title: artifact.title,
      kind: artifact.kind,
      agent: artifact.agent,
      dependsOn: JSON.parse(artifact.dependsOnJson) as number[],
      markdown: artifact.contentMarkdown,
    })),
  });
}

export async function exportRoadmapProjections(objectiveCode?: string) {
  const objectives = await db.roadmapObjective.findMany({
    where: { archivedAt: null, documentationStatus: "DOCUMENTED", ...(objectiveCode ? { code: objectiveCode } : {}) },
    include: { promptArtifacts: { where: { status: "PUBLISHED" }, orderBy: { phaseNumber: "asc" } } },
    orderBy: [{ globalPriority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let exported = 0;
  for (const objective of objectives) {
    const artifacts = objective.promptArtifacts.filter((artifact) => artifact.documentationVersion === objective.sourceVersion);
    if (artifacts.length < 2) continue;
    await publishRoadmapProjection({
      moduleKey: objective.moduleKey,
      objectiveCode: objective.code,
      version: objective.sourceVersion,
      manifest: objectiveManifest({ ...objective, promptArtifacts: artifacts }),
    });
    exported += 1;
  }
  return { ok: true, command: "export", code: 0, checks: { matched: objectives.length, exported }, timestamp: new Date().toISOString() };
}

export async function reconcileRoadmapProjections(root = process.cwd()) {
  const artifacts = await db.roadmapPromptArtifact.findMany({
    where: { status: "PUBLISHED" },
    select: { relativePath: true, sha256: true },
  });
  const namespace = path.resolve(root, "prompt-phases", "roadmap-alpha");
  let missing = 0;
  let divergent = 0;
  let valid = 0;
  for (const artifact of artifacts) {
    if (!artifact.relativePath) { missing += 1; continue; }
    const absolute = path.resolve(root, artifact.relativePath);
    if (!absolute.startsWith(`${namespace}${path.sep}`)) { divergent += 1; continue; }
    try {
      const content = await fs.readFile(absolute, "utf8");
      const digest = createHash("sha256").update(content.trim()).digest("hex");
      if (digest === artifact.sha256) valid += 1;
      else divergent += 1;
    } catch {
      missing += 1;
    }
  }
  const ok = missing === 0 && divergent === 0;
  return { ok, command: "reconcile", code: ok ? 0 : 1, checks: { artifacts: artifacts.length, valid, missing, divergent }, timestamp: new Date().toISOString() };
}
