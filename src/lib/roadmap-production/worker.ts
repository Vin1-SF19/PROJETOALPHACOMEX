import db from "@/lib/prisma";
import { resolvePhaseAgent } from "@/lib/roadmap-production/agents";
import type { ProductionActivity, ProductionExecution, ProductionState } from "@/lib/roadmap-production/contracts";
import { runProductionAgent } from "@/lib/roadmap-production/providers";
import { readProductionConfig, readProductionState, writeProductionState } from "@/lib/roadmap-production/storage";

function now(): string {
  return new Date().toISOString();
}

function executionId(objectiveId: string, sourceVersion: number): string {
  return `${objectiveId}:v${sourceVersion}`;
}

async function documentedObjectives() {
  return db.roadmapObjective.findMany({
    where: { archivedAt: null, documentationStatus: "DOCUMENTED" },
    orderBy: [{ globalPriority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      moduleKey: true,
      sourceVersion: true,
      globalPriority: true,
      promptArtifacts: {
        where: { status: "PUBLISHED" },
        orderBy: { phaseNumber: "asc" },
        select: { phaseNumber: true, title: true, kind: true, agent: true, contentMarkdown: true },
      },
    },
  });
}

export async function syncProductionExecutions(): Promise<ProductionState> {
  const [state, objectives] = await Promise.all([readProductionState(), documentedObjectives()]);
  let changed = false;
  for (const objective of objectives) {
    const id = executionId(objective.id, objective.sourceVersion);
    const existing = state.executions.find((execution) => execution.id === id);
    if (existing) {
      if (existing.globalPriority !== objective.globalPriority || existing.objectiveTitle !== objective.title) {
        existing.globalPriority = objective.globalPriority;
        existing.objectiveTitle = objective.title;
        changed = true;
      }
      continue;
    }
    if (objective.promptArtifacts.length === 0) continue;
    const createdAt = now();
    state.executions.push({
      id,
      objectiveId: objective.id,
      objectiveCode: objective.code,
      objectiveTitle: objective.title,
      moduleKey: objective.moduleKey,
      sourceVersion: objective.sourceVersion,
      globalPriority: objective.globalPriority,
      status: "PENDING",
      createdAt,
      startedAt: null,
      finishedAt: null,
      phases: objective.promptArtifacts.map((phase) => ({
        phaseNumber: phase.phaseNumber,
        title: phase.title,
        kind: phase.kind,
        requestedAgent: phase.agent,
        resolvedAgent: resolvePhaseAgent(phase.agent, phase.title, phase.contentMarkdown),
        status: "PENDING",
        attemptCount: 0,
        startedAt: null,
        finishedAt: null,
        summary: null,
        errorCode: null,
        activities: [],
      })),
    });
    changed = true;
  }
  state.executions.sort((a, b) => a.globalPriority - b.globalPriority || a.createdAt.localeCompare(b.createdAt));
  if (changed) await writeProductionState(state);
  return state;
}

async function mutateExecution(executionIdValue: string, mutate: (execution: ProductionExecution) => void): Promise<ProductionExecution> {
  const state = await readProductionState();
  const execution = state.executions.find((item) => item.id === executionIdValue);
  if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
  mutate(execution);
  await writeProductionState(state);
  return execution;
}

async function addActivity(executionIdValue: string, phaseNumber: number, agentId: string, message: string): Promise<void> {
  await mutateExecution(executionIdValue, (execution) => {
    const phase = execution.phases.find((item) => item.phaseNumber === phaseNumber);
    if (!phase) return;
    const activity: ProductionActivity = {
      at: now(),
      agentId,
      type: message.startsWith("Tool:") || message.startsWith("Alterou") || message.startsWith("Criou") || message.startsWith("Executando") ? "TOOL" : "STATUS",
      message: message.slice(0, 2_000),
    };
    phase.activities = [...phase.activities, activity].slice(-200);
  });
}

export async function recoverInterruptedProduction(): Promise<number> {
  const state = await readProductionState();
  let recovered = 0;
  for (const execution of state.executions) {
    for (const phase of execution.phases) {
      if (phase.status !== "RUNNING") continue;
      phase.status = "PENDING";
      phase.errorCode = "WORKER_INTERRUPTED_RETRY";
      phase.activities.push({ at: now(), agentId: phase.resolvedAgent, type: "STATUS", message: "Worker reiniciado; fase devolvida à fila." });
      execution.status = "PENDING";
      recovered += 1;
    }
  }
  if (recovered) await writeProductionState(state);
  return recovered;
}

export async function retryProductionExecution(id: string): Promise<void> {
  await mutateExecution(id, (execution) => {
    const failed = execution.phases.find((phase) => phase.status === "FAILED" || phase.status === "BLOCKED");
    if (!failed) throw new Error("NO_FAILED_PHASE");
    failed.status = "PENDING";
    failed.errorCode = null;
    failed.finishedAt = null;
    failed.activities.push({ at: now(), agentId: failed.resolvedAgent, type: "STATUS", message: "Nova tentativa solicitada pelo administrador." });
    execution.status = "PENDING";
    execution.finishedAt = null;
  });
}

export async function processNextProductionPhase() {
  const config = await readProductionConfig();
  if (!config.autoRun) return { processed: false as const, healthy: true as const, paused: true as const };
  const state = await syncProductionExecutions();
  const blocking = state.executions.find((execution) => execution.status === "FAILED" || execution.status === "BLOCKED");
  if (blocking) return { processed: false as const, healthy: true as const, blockedBy: blocking.objectiveCode };
  const execution = state.executions.find((item) => item.status === "PENDING" || item.status === "RUNNING");
  if (!execution) return { processed: false as const, healthy: true as const };
  const phase = execution.phases.find((item) => item.status === "PENDING");
  if (!phase) {
    execution.status = "SUCCEEDED";
    execution.finishedAt = now();
    await writeProductionState(state);
    return { processed: true as const, success: true as const, objectiveCode: execution.objectiveCode, completed: true as const };
  }

  const objective = await db.roadmapObjective.findUnique({
    where: { id: execution.objectiveId },
    select: {
      archivedAt: true,
      sourceVersion: true,
      documentationStatus: true,
      promptArtifacts: {
        where: { documentationVersion: execution.sourceVersion, phaseNumber: phase.phaseNumber, status: "PUBLISHED" },
        take: 1,
        select: { contentMarkdown: true },
      },
    },
  });
  if (!objective || objective.archivedAt || objective.sourceVersion !== execution.sourceVersion || objective.documentationStatus !== "DOCUMENTED") {
    phase.status = "BLOCKED";
    phase.errorCode = "OBJECTIVE_SUPERSEDED";
    phase.finishedAt = now();
    execution.status = "BLOCKED";
    execution.finishedAt = now();
    await writeProductionState(state);
    return { processed: true as const, success: false as const, errorCode: "OBJECTIVE_SUPERSEDED" };
  }
  const artifact = objective.promptArtifacts[0];
  if (!artifact) throw new Error("PRODUCTION_PHASE_ARTIFACT_MISSING");

  phase.status = "RUNNING";
  phase.attemptCount += 1;
  phase.startedAt = now();
  phase.finishedAt = null;
  phase.errorCode = null;
  phase.activities.push({ at: now(), agentId: phase.resolvedAgent, type: "STATUS", message: `Agente ${phase.resolvedAgent} iniciou a fase.` });
  execution.status = "RUNNING";
  execution.startedAt ??= now();
  await writeProductionState(state);

  const result = await runProductionAgent(config, {
    agentId: phase.resolvedAgent,
    objectiveCode: execution.objectiveCode,
    objectiveTitle: execution.objectiveTitle,
    moduleKey: execution.moduleKey,
    phaseNumber: phase.phaseNumber,
    phaseTitle: phase.title,
    phaseKind: phase.kind,
    phaseMarkdown: artifact.contentMarkdown,
    previousSummaries: [
      ...execution.phases.filter((item) => item.status === "SUCCEEDED" && item.summary).map((item) => item.summary!),
      ...(phase.attemptCount > 1 && phase.summary ? [`Resumo da tentativa anterior desta fase — use-o para agir sem repetir a investigação:\n${phase.summary}`] : []),
    ],
    allowWrite: phase.kind === "EXECUTION",
  }, (message) => addActivity(execution.id, phase.phaseNumber, phase.resolvedAgent, message));

  const updated = await mutateExecution(execution.id, (current) => {
    const currentPhase = current.phases.find((item) => item.phaseNumber === phase.phaseNumber);
    if (!currentPhase) return;
    currentPhase.status = result.success ? "SUCCEEDED" : result.errorCode === "AGENT_BLOCKED" ? "BLOCKED" : "FAILED";
    currentPhase.finishedAt = now();
    currentPhase.summary = result.summary;
    currentPhase.errorCode = result.errorCode ?? null;
    currentPhase.activities.push({
      at: now(), agentId: currentPhase.resolvedAgent, type: result.success ? "RESULT" : "ERROR",
      message: result.success ? "Fase concluída." : `Fase interrompida: ${result.errorCode ?? "AGENT_FAILED"}`,
    });
    if (!result.success) {
      current.status = currentPhase.status === "BLOCKED" ? "BLOCKED" : "FAILED";
      current.finishedAt = now();
    } else if (current.phases.every((item) => item.status === "SUCCEEDED")) {
      current.status = "SUCCEEDED";
      current.finishedAt = now();
    } else {
      current.status = "PENDING";
    }
  });
  return {
    processed: true as const,
    success: result.success,
    objectiveCode: updated.objectiveCode,
    phaseNumber: phase.phaseNumber,
    agentId: phase.resolvedAgent,
    errorCode: result.errorCode,
  };
}
