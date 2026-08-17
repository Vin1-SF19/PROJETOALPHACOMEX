import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const { default: db } = await import("../src/lib/prisma.ts");
const { isAdminRole } = await import("../src/lib/roles.ts");
const { createRoadmapObjective, updateRoadmapObjective } = await import("../src/lib/roadmap-alpha/objectives.ts");
const { processNextRoadmapJob } = await import("../src/lib/roadmap-alpha/worker.ts");
const serviceMode = process.argv.includes("--service");
const revisionMode = process.argv.includes("--revision");

let objectiveId = null;
let objectiveCode = null;
let objectiveDirectory = null;

async function waitForDocumentation(expectedVersion) {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const state = await db.roadmapObjective.findUnique({
      where: { id: objectiveId },
      select: { documentationStatus: true, sourceVersion: true },
    });
    if (state?.sourceVersion === expectedVersion && state.documentationStatus === "DOCUMENTED") return;
    if (state?.sourceVersion === expectedVersion && state.documentationStatus === "FAILED") {
      throw new Error("E2E_SERVICE_WORKER_FAILED");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("E2E_SERVICE_WORKER_TIMEOUT");
}

async function processVersion(expectedVersion) {
  if (serviceMode) {
    await waitForDocumentation(expectedVersion);
    return;
  }
  const workerResult = await processNextRoadmapJob(`roadmap-e2e-${randomUUID()}`);
  if (!workerResult.processed || !workerResult.success) throw new Error(workerResult.errorCode ?? "E2E_WORKER_FAILED");
}

try {
  const existingObjectives = await db.roadmapObjective.count();
  if (existingObjectives !== 0) throw new Error("E2E_REQUIRES_EMPTY_ROADMAP");

  const users = await db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: { id: true, role: true },
    orderBy: { id: "asc" },
  });
  const actor = users.find((user) => isAdminRole(user.role));
  if (!actor) throw new Error("NO_ADMIN_ACTOR");

  const created = await createRoadmapObjective({
    contractVersion: 1,
    moduleKey: "roadmap",
    title: "Teste técnico ponta a ponta do Roadmap Alpha",
    description: "Validar criação, fila, geração estruturada pelo Qwen, persistência dos artefatos e publicação atômica no prompt-phases.",
    desiredOutcome: "Comprovar o fluxo completo e remover todos os dados temporários ao final.",
    constraints: "Não executar os prompts gerados e não alterar módulos fora do Roadmap Alpha.",
    acceptanceCriteria: [
      "O job deve terminar como SUCCEEDED.",
      "Os artefatos publicados devem possuir hashes e caminhos seguros.",
      "A projeção deve conter 00-contexto-geral.md e _status.md.",
    ],
    globalPriority: 1,
  }, actor.id);
  objectiveId = created.objective.id;
  objectiveCode = created.objective.code;
  objectiveDirectory = path.resolve(process.cwd(), "prompt-phases", "roadmap-alpha", "roadmap", objectiveCode);

  await processVersion(1);

  if (revisionMode) {
    const updated = await updateRoadmapObjective(objectiveId, {
      contractVersion: 1,
      moduleKey: "roadmap",
      title: "Teste técnico revisado do Roadmap Alpha",
      description: "Validar a regeneração material, o versionamento imutável e a publicação da segunda revisão pelo Qwen.",
      desiredOutcome: "Comprovar que r0001 é preservada, marcada como superada no banco e que r0002 vira a revisão publicada.",
      constraints: "Não executar os prompts gerados e não alterar módulos fora do Roadmap Alpha.",
      acceptanceCriteria: [
        "A versão da fonte deve avançar para dois.",
        "Os artefatos da primeira revisão devem ficar SUPERSEDED.",
        "A segunda revisão deve ser publicada em um diretório próprio.",
      ],
    });
    if (!updated.regenerated || updated.objective.sourceVersion !== 2) throw new Error("E2E_REVISION_NOT_ENQUEUED");
    await processVersion(2);
  }

  const persisted = await db.roadmapObjective.findUnique({
    where: { id: objectiveId },
    include: {
      documentationJobs: true,
      promptArtifacts: { orderBy: { phaseNumber: "asc" } },
    },
  });
  if (!persisted || persisted.documentationStatus !== "DOCUMENTED") throw new Error("E2E_OBJECTIVE_NOT_DOCUMENTED");
  if (persisted.documentationJobs.some((job) => job.status !== "SUCCEEDED")) throw new Error("E2E_JOB_NOT_SUCCEEDED");
  if (persisted.promptArtifacts.length < 2) throw new Error("E2E_ARTIFACTS_MISSING");

  const expectedVersion = revisionMode ? 2 : 1;
  if (persisted.sourceVersion !== expectedVersion) throw new Error("E2E_SOURCE_VERSION_MISMATCH");
  if (persisted.documentationJobs.length !== expectedVersion) throw new Error("E2E_JOB_COUNT_MISMATCH");
  const currentArtifacts = persisted.promptArtifacts.filter((artifact) => artifact.documentationVersion === expectedVersion);
  if (currentArtifacts.length < 2 || currentArtifacts.some((artifact) => artifact.status !== "PUBLISHED")) {
    throw new Error("E2E_CURRENT_ARTIFACTS_INVALID");
  }
  if (revisionMode) {
    const priorArtifacts = persisted.promptArtifacts.filter((artifact) => artifact.documentationVersion === 1);
    if (priorArtifacts.length < 2 || priorArtifacts.some((artifact) => artifact.status !== "SUPERSEDED")) {
      throw new Error("E2E_PRIOR_ARTIFACTS_NOT_SUPERSEDED");
    }
  }

  const relativeDirectory = path.dirname(currentArtifacts[0].relativePath ?? "");
  const namespaceRoot = path.resolve(process.cwd(), "prompt-phases", "roadmap-alpha");
  if (!objectiveDirectory.startsWith(`${namespaceRoot}${path.sep}`)) throw new Error("E2E_UNSAFE_PROJECTION_PATH");
  await fs.access(path.join(process.cwd(), relativeDirectory, "00-contexto-geral.md"));
  await fs.access(path.join(process.cwd(), relativeDirectory, "_status.md"));
  if (revisionMode) {
    await fs.access(path.join(objectiveDirectory, "r0001", "_status.md"));
    await fs.access(path.join(objectiveDirectory, "r0002", "_status.md"));
  }

  console.info(JSON.stringify({
    ok: true,
    objectiveCode,
    documentationStatus: persisted.documentationStatus,
    jobStatus: persisted.documentationJobs[0].status,
    sourceVersion: persisted.sourceVersion,
    jobCount: persisted.documentationJobs.length,
    phaseCount: currentArtifacts.length,
    projectionVerified: true,
    revisionVerified: revisionMode,
    workerMode: serviceMode ? "scheduled-service" : "direct",
  }));
} catch (error) {
  const errorCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "E2E_FAILED";
  console.info(JSON.stringify({ ok: false, errorCode }));
  process.exitCode = 1;
} finally {
  if (objectiveId) {
    await db.roadmapObjective.deleteMany({ where: { id: objectiveId } });
  }
  if (objectiveDirectory) {
    const namespaceRoot = path.resolve(process.cwd(), "prompt-phases", "roadmap-alpha");
    if (objectiveDirectory.startsWith(`${namespaceRoot}${path.sep}`) && objectiveCode && objectiveDirectory.endsWith(objectiveCode)) {
      await fs.rm(objectiveDirectory, { recursive: true, force: true });
    }
  }
  await db.$disconnect();
}
