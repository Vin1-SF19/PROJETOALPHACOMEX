import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";
import { resolvePhaseAgent } from "@/lib/roadmap-production/agents";
import type {
  DevelopmentProvider,
  ProductionActivity,
  ProductionConfig,
  ProductionExecution,
  ProductionState,
} from "@/lib/roadmap-production/contracts";
import { writeCompletionReport } from "@/lib/roadmap-production/completion-report";
import { acquireProductionExecutionLease } from "@/lib/roadmap-production/execution-lock";
import {
  requiresCapabilityEscalation,
  requiresDeliveryAdjustment,
  runProductionAgent,
  selectProductionExecutionEngine,
  type ProductionAgentInput,
  type ProductionAgentResult,
} from "@/lib/roadmap-production/providers";
import {
  readObjectiveDevelopmentPreferences,
  readProductionConfig,
  readProductionControls,
  readProductionState,
  removeProductionControlFiles,
  writeProductionState,
} from "@/lib/roadmap-production/storage";

const AUTO_RETRY_DELAY_MS = 5_000;
const AUTO_RETRY_LIMIT = 12;
const TRANSIENT_ERROR_CODES = new Set([
  "AGENT_RESULT_MISSING",
  "AGENT_STEP_LIMIT",
  "INVALID_PROVIDER_RESPONSE",
  "NO_CHANGES_APPLIED",
  "PRODUCTION_PROVIDER_FAILED",
  "PROVIDER_HTTP_ERROR",
  "TRUNCATED_MODEL_RESPONSE",
]);
const PROVIDER_FALLBACK_ERROR_CODES = new Set([
  "CLI_EXECUTION_FAILED",
  "CLI_NOT_FOUND",
  "CLI_TIMEOUT",
  "PROVIDER_AUTH_FAILED",
  "PROVIDER_QUOTA_EXHAUSTED",
  "PROVIDER_RATE_LIMITED",
]);

export function shouldFallbackDevelopmentProvider(errorCode?: string): boolean {
  return Boolean(errorCode && PROVIDER_FALLBACK_ERROR_CODES.has(errorCode));
}

export function developmentProviderOrder(
  preferred: DevelopmentProvider,
): [DevelopmentProvider, DevelopmentProvider] {
  return preferred === "claude" ? ["claude", "codex"] : ["codex", "claude"];
}

async function runDevelopmentAgentWithFallback(
  config: ProductionConfig,
  preferred: DevelopmentProvider,
  input: ProductionAgentInput,
  onActivity: (message: string) => Promise<void> | void,
): Promise<ProductionAgentResult> {
  const providers = developmentProviderOrder(preferred);
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const model = config.provider === provider ? config.model : "default";
    const result = await runProductionAgent(
      { ...config, provider, model },
      input,
      onActivity,
    );
    const canFallback =
      index === 0 && shouldFallbackDevelopmentProvider(result.errorCode);
    if (!canFallback) return result;
    const fallback = providers[index + 1];
    await onActivity(
      `${provider === "claude" ? "Claude" : "Codex"} indisponível (${result.errorCode}); alternando automaticamente para ${fallback === "claude" ? "Claude" : "Codex"}.`,
    );
  }
  return {
    success: false,
    summary: "Nenhum cérebro de desenvolvimento está disponível.",
    errorCode: "PRODUCTION_PROVIDER_FAILED",
    toolSteps: 0,
  };
}

async function runProductionAgentWithCapabilityRouting(
  config: ProductionConfig,
  preferred: DevelopmentProvider,
  input: ProductionAgentInput,
  onActivity: (message: string) => Promise<void> | void,
): Promise<ProductionAgentResult> {
  const engine = selectProductionExecutionEngine({
    agentId: input.agentId,
    phaseKind: input.phaseKind,
    phaseTitle: input.phaseTitle,
    phaseMarkdown: input.phaseMarkdown,
    allowWrite: input.allowWrite,
    previousSummaries: input.previousSummaries,
  });
  if (engine === "development") {
    await onActivity("Roteamento de capacidade: Claude/Codex.");
    return runDevelopmentAgentWithFallback(
      config,
      preferred,
      input,
      onActivity,
    );
  }

  const qwenModel = process.env.ROADMAP_QWEN_MODEL?.trim();
  if (!qwenModel?.startsWith("qwen3.8")) {
    await onActivity(
      "Qwen 3.8 sem configuração válida; encaminhando para Claude/Codex.",
    );
    return runDevelopmentAgentWithFallback(
      config,
      preferred,
      input,
      onActivity,
    );
  }
  await onActivity("Roteamento de capacidade: Qwen 3.8 para tarefa básica.");
  const qwenResult = await runProductionAgent(
    { ...config, provider: "ollama", model: qwenModel },
    input,
    onActivity,
  );
  if (qwenResult.success) return qwenResult;

  const escalatedByQwen = requiresCapabilityEscalation([qwenResult.summary]);
  await onActivity(
    escalatedByQwen
      ? "Qwen identificou necessidade de engenharia; encaminhando o diagnóstico para Claude/Codex."
      : `Qwen não concluiu a tarefa básica (${qwenResult.errorCode ?? "AGENT_FAILED"}); encaminhando para Claude/Codex.`,
  );
  return runDevelopmentAgentWithFallback(
    config,
    preferred,
    {
      ...input,
      previousSummaries: [
        ...input.previousSummaries,
        `Diagnóstico do Qwen antes do escalonamento:\n${qwenResult.summary}`,
      ],
    },
    onActivity,
  );
}

function now(): string {
  return new Date().toISOString();
}

function executionId(objectiveId: string, sourceVersion: number): string {
  return `${objectiveId}:v${sourceVersion}`;
}

export function isImplementationPhase(
  phase: Pick<
    ProductionExecution["phases"][number],
    "kind" | "requestedAgent"
  > &
    Partial<
      Pick<ProductionExecution["phases"][number], "resolvedAgent" | "title">
    >,
): boolean {
  return (
    phase.kind === "EXECUTION" &&
    (phase.requestedAgent === "dev" ||
      ["nova", "echo"].includes(phase.resolvedAgent ?? ""))
  );
}

export function phaseRequiresWrite(
  phase: Pick<
    ProductionExecution["phases"][number],
    "kind" | "requestedAgent" | "resolvedAgent" | "title"
  >,
  markdown = "",
): boolean {
  if (isImplementationPhase(phase)) return true;
  if (
    phase.kind !== "CLOSURE" ||
    !["scribe", "kowalski"].includes(phase.resolvedAgent)
  )
    return false;
  return /\b(criar|atualizar|editar|registrar|documentar|escrever)\b/i.test(
    `${phase.title}\n${markdown}`,
  );
}

export function resolveDeliveryAdjustmentAgent(
  phase: Pick<
    ProductionExecution["phases"][number],
    "kind" | "requestedAgent" | "resolvedAgent" | "title"
  >,
  summaries: string[],
  markdown = "",
): string | null {
  if (
    phase.kind !== "EXECUTION" ||
    isImplementationPhase(phase) ||
    !requiresDeliveryAdjustment(summaries)
  ) {
    return null;
  }
  return resolvePhaseAgent(
    "dev",
    phase.title,
    `${markdown}\n${summaries.join("\n")}`,
  );
}

function retryDate(at: string): string {
  return new Date(new Date(at).getTime() + AUTO_RETRY_DELAY_MS).toISOString();
}

function isReady(
  phase: ProductionExecution["phases"][number],
  referenceTime: number,
): boolean {
  return (
    phase.status === "PENDING" &&
    (!phase.retryAt || Date.parse(phase.retryAt) <= referenceTime)
  );
}

function nextReadyPhase(
  execution: ProductionExecution,
  referenceTime: number,
): ProductionExecution["phases"][number] | undefined {
  const nextPending = execution.phases.find(
    (phase) => phase.status === "PENDING",
  );
  return nextPending && isReady(nextPending, referenceTime)
    ? nextPending
    : undefined;
}

function appendActivity(
  executionPhase: ProductionExecution["phases"][number],
  activity: ProductionActivity,
): void {
  executionPhase.activities = [...executionPhase.activities, activity].slice(
    -200,
  );
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
        select: {
          phaseNumber: true,
          title: true,
          kind: true,
          agent: true,
          contentMarkdown: true,
        },
      },
    },
  });
}

export async function syncProductionExecutions(): Promise<ProductionState> {
  const [state, objectives, developmentPreferences] = await Promise.all([
    readProductionState(),
    documentedObjectives(),
    readObjectiveDevelopmentPreferences(),
  ]);
  let changed = false;
  for (const objective of objectives) {
    const id = executionId(objective.id, objective.sourceVersion);
    if (state.ignoredExecutionIds.includes(id)) continue;
    const existing = state.executions.find((execution) => execution.id === id);
    const developmentProvider =
      developmentPreferences.objectives[objective.id] ?? "claude";
    if (existing) {
      if (
        existing.globalPriority !== objective.globalPriority ||
        existing.objectiveTitle !== objective.title ||
        existing.developmentProvider !== developmentProvider
      ) {
        existing.globalPriority = objective.globalPriority;
        existing.objectiveTitle = objective.title;
        existing.developmentProvider = developmentProvider;
        changed = true;
      }
      for (const artifact of objective.promptArtifacts) {
        const existingPhase = existing.phases.find(
          (phase) => phase.phaseNumber === artifact.phaseNumber,
        );
        if (!existingPhase) continue;
        const desiredAgent = resolvePhaseAgent(
          artifact.agent,
          artifact.title,
          artifact.contentMarkdown,
        );
        if (existingPhase.resolvedAgent !== desiredAgent) {
          existingPhase.resolvedAgent = desiredAgent;
          appendActivity(existingPhase, {
            at: now(),
            agentId: desiredAgent,
            type: "STATUS",
            message: `Roteamento corrigido automaticamente: ${artifact.agent} → ${desiredAgent}.`,
          });
          changed = true;
        }
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
      developmentProvider,
      sourceVersion: objective.sourceVersion,
      globalPriority: objective.globalPriority,
      status: "PENDING",
      createdAt,
      startedAt: null,
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: objective.promptArtifacts.map((phase) => ({
        phaseNumber: phase.phaseNumber,
        title: phase.title,
        kind: phase.kind,
        requestedAgent: phase.agent,
        resolvedAgent: resolvePhaseAgent(
          phase.agent,
          phase.title,
          phase.contentMarkdown,
        ),
        status: "PENDING",
        attemptCount: 0,
        autoRetryCount: 0,
        retryAt: null,
        startedAt: null,
        finishedAt: null,
        summary: null,
        errorCode: null,
        changedFiles: [],
        reworkCount: 0,
        manualFeedback: [],
        activities: [],
      })),
    });
    changed = true;
  }
  for (const execution of state.executions) {
    if (execution.status !== "SUCCEEDED" || execution.completionReportMarkdown)
      continue;
    const report = await writeCompletionReport(execution);
    execution.completionReportPath = report.relativePath;
    execution.completionReportMarkdown = report.markdown;
    changed = true;
  }
  const completedObjectiveIds = state.executions
    .filter((execution) => execution.status === "SUCCEEDED")
    .map((execution) => execution.objectiveId);
  if (completedObjectiveIds.length) {
    await db.roadmapObjective.updateMany({
      where: {
        id: { in: completedObjectiveIds },
        archivedAt: null,
        status: { not: "COMPLETED" },
      },
      data: { status: "COMPLETED" },
    });
  }
  state.executions.sort(
    (a, b) =>
      a.globalPriority - b.globalPriority ||
      a.createdAt.localeCompare(b.createdAt),
  );
  if (changed) await writeProductionState(state);
  return state;
}

export async function refreshProductionExecutions(): Promise<ProductionState> {
  const lease = await acquireProductionExecutionLease();
  if (!lease) return readProductionState();
  try {
    return await syncProductionExecutions();
  } finally {
    await lease.release();
  }
}

export async function applyProductionControls(
  root = process.cwd(),
): Promise<number> {
  const controls = await readProductionControls(root);
  if (!controls.length) return 0;
  const state = await readProductionState(root);
  for (const { command } of controls) {
    const index = state.executions.findIndex(
      (execution) => execution.id === command.executionId,
    );
    const execution = index >= 0 ? state.executions[index] : null;
    if (command.type === "EXCLUDE") {
      if (execution) state.executions.splice(index, 1);
      if (!state.ignoredExecutionIds.includes(command.executionId))
        state.ignoredExecutionIds.push(command.executionId);
      state.ignoredExecutionIds = state.ignoredExecutionIds.slice(-500);
    } else if (
      command.type === "PAUSE" &&
      execution &&
      ["PENDING", "RUNNING"].includes(execution.status)
    ) {
      execution.status = "PAUSED";
      execution.finishedAt = null;
    } else if (command.type === "RESUME" && execution?.status === "PAUSED") {
      execution.status = "PENDING";
      execution.finishedAt = null;
    } else if (
      command.type === "RETRY" &&
      execution &&
      ["FAILED", "BLOCKED"].includes(execution.status)
    ) {
      const failed = execution.phases.find(
        (phase) => phase.status === "FAILED" || phase.status === "BLOCKED",
      );
      if (failed) {
        failed.status = "PENDING";
        failed.autoRetryCount = 0;
        failed.retryAt = null;
        failed.errorCode = null;
        failed.finishedAt = null;
        appendActivity(failed, {
          at: now(),
          agentId: failed.resolvedAgent,
          type: "STATUS",
          message: "Nova tentativa solicitada pelo administrador.",
        });
        execution.status = "PENDING";
        execution.finishedAt = null;
      }
    } else if (
      command.type === "REPORT_ERROR" &&
      execution &&
      command.phaseNumber === null &&
      command.feedback
    ) {
      execution.manualFeedback.push({
        id: randomUUID(),
        reportedAt: command.createdAt,
        content: command.feedback,
        improvedWithAi: command.improvedWithAi,
        resolvedAt: null,
      });
      execution.manualFeedback = execution.manualFeedback.slice(-50);
      execution.reworkCount += 1;
      for (const phase of execution.phases) {
        phase.status = "PENDING";
        phase.retryAt = null;
        phase.finishedAt = null;
        phase.errorCode = null;
        appendActivity(phase, {
          at: command.createdAt,
          agentId: phase.resolvedAgent,
          type: "STATUS",
          message:
            "Objetivo reenfileirado integralmente após relato de erro do administrador.",
        });
      }
      execution.status = "PENDING";
      execution.finishedAt = null;
      execution.completionReportPath = null;
      execution.completionReportMarkdown = null;
    }
  }
  await writeProductionState(state, root);
  await removeProductionControlFiles(
    controls.map((control) => control.filePath),
  );
  return controls.length;
}

export function selectNextProductionExecution(
  state: ProductionState,
): ProductionExecution | undefined {
  const referenceTime = Date.now();
  const activeExecution = state.executions.find(
    (execution) =>
      execution.startedAt !== null &&
      execution.finishedAt === null &&
      ["PENDING", "RUNNING"].includes(execution.status),
  );
  if (activeExecution) {
    return nextReadyPhase(activeExecution, referenceTime)
      ? activeExecution
      : undefined;
  }
  return state.executions.find(
    (execution) =>
      ["PENDING", "RUNNING"].includes(execution.status) &&
      Boolean(nextReadyPhase(execution, referenceTime)),
  );
}

async function mutateExecution(
  executionIdValue: string,
  mutate: (execution: ProductionExecution) => void,
): Promise<ProductionExecution> {
  const state = await readProductionState();
  const execution = state.executions.find(
    (item) => item.id === executionIdValue,
  );
  if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
  mutate(execution);
  await writeProductionState(state);
  return execution;
}

async function addActivity(
  executionIdValue: string,
  phaseNumber: number,
  agentId: string,
  message: string,
): Promise<void> {
  await mutateExecution(executionIdValue, (execution) => {
    const phase = execution.phases.find(
      (item) => item.phaseNumber === phaseNumber,
    );
    if (!phase) return;
    const activity: ProductionActivity = {
      at: now(),
      agentId,
      type:
        message.startsWith("Tool:") ||
        message.startsWith("Alterou") ||
        message.startsWith("Criou") ||
        message.startsWith("Executando")
          ? "TOOL"
          : "STATUS",
      message: message.slice(0, 2_000),
    };
    phase.activities = [...phase.activities, activity].slice(-200);
    const changedPath = message.match(/^(?:Alterou|Criou) (.+)$/)?.[1];
    if (changedPath && !phase.changedFiles.includes(changedPath)) {
      phase.changedFiles = [...phase.changedFiles, changedPath].slice(-100);
    }
  });
}

async function recoverInterruptedProductionUnlocked(): Promise<number> {
  const state = await readProductionState();
  let recovered = 0;
  for (const execution of state.executions) {
    for (const phase of execution.phases) {
      if (phase.status !== "RUNNING") continue;
      phase.status = "PENDING";
      phase.errorCode = "WORKER_INTERRUPTED_RETRY";
      phase.retryAt = null;
      appendActivity(phase, {
        at: now(),
        agentId: phase.resolvedAgent,
        type: "STATUS",
        message: "Worker reiniciado; fase devolvida à fila.",
      });
      execution.status = "PENDING";
      recovered += 1;
    }
  }
  if (recovered) await writeProductionState(state);
  return recovered;
}

export async function recoverInterruptedProduction(): Promise<number> {
  const lease = await acquireProductionExecutionLease();
  if (!lease) return 0;
  try {
    return await recoverInterruptedProductionUnlocked();
  } finally {
    await lease.release();
  }
}

async function retryProductionExecutionUnlocked(
  id: string,
  adoptedChanges: string[] = [],
): Promise<void> {
  await mutateExecution(id, (execution) => {
    const failed = execution.phases.find(
      (phase) => phase.status === "FAILED" || phase.status === "BLOCKED",
    );
    if (!failed) throw new Error("NO_FAILED_PHASE");
    failed.status = "PENDING";
    failed.autoRetryCount = 0;
    failed.retryAt = null;
    failed.errorCode = null;
    failed.finishedAt = null;
    for (const changedPath of adoptedChanges) {
      if (
        !changedPath ||
        changedPath.length > 500 ||
        changedPath.includes("..") ||
        /^[a-z]:/i.test(changedPath)
      )
        throw new Error("INVALID_ADOPTED_PATH");
      if (!failed.changedFiles.includes(changedPath))
        failed.changedFiles.push(changedPath);
    }
    failed.changedFiles = failed.changedFiles.slice(-100);
    appendActivity(failed, {
      at: now(),
      agentId: failed.resolvedAgent,
      type: "STATUS",
      message: "Nova tentativa solicitada pelo administrador.",
    });
    execution.status = "PENDING";
    execution.finishedAt = null;
  });
}

export async function retryProductionExecution(
  id: string,
  adoptedChanges: string[] = [],
): Promise<void> {
  const lease = await acquireProductionExecutionLease();
  if (!lease) throw new Error("PRODUCTION_EXECUTION_BUSY");
  try {
    await retryProductionExecutionUnlocked(id, adoptedChanges);
  } finally {
    await lease.release();
  }
}

interface FailedAgentResult {
  success: boolean;
  summary: string;
  errorCode?: string;
}

export function scheduleAutomaticRecovery(
  execution: ProductionExecution,
  failedPhaseNumber: number,
  result: FailedAgentResult,
  at = now(),
): "IMPLEMENTATION_FEEDBACK" | "SAME_PHASE" | null {
  const failed = execution.phases.find(
    (phase) => phase.phaseNumber === failedPhaseNumber,
  );
  if (!failed || failed.autoRetryCount >= AUTO_RETRY_LIMIT) return null;
  const errorCode = result.errorCode ?? "AGENT_FAILED";

  if (
    failed.kind === "VERIFICATION" &&
    ["AGENT_BLOCKED", "AGENT_REPORTED_FAILURE"].includes(errorCode)
  ) {
    const implementation = [...execution.phases]
      .reverse()
      .find(
        (phase) =>
          phase.phaseNumber < failed.phaseNumber &&
          isImplementationPhase(phase),
      );
    if (!implementation) return null;
    failed.status = "PENDING";
    failed.autoRetryCount += 1;
    failed.retryAt = null;
    implementation.status = "PENDING";
    implementation.finishedAt = null;
    implementation.errorCode = "VERIFICATION_FEEDBACK";
    implementation.retryAt = retryDate(at);
    implementation.summary =
      `Feedback obrigatório da verificação — corrija antes de concluir:\n${result.summary}`.slice(
        0,
        8_000,
      );
    appendActivity(implementation, {
      at,
      agentId: implementation.resolvedAgent,
      type: "STATUS",
      message: `Verificação reprovou a entrega. Correção automática ${failed.autoRetryCount}/${AUTO_RETRY_LIMIT} agendada.`,
    });
    appendActivity(failed, {
      at,
      agentId: failed.resolvedAgent,
      type: "STATUS",
      message:
        "Feedback devolvido automaticamente para a fase de implementação.",
    });
    execution.status = "PENDING";
    execution.finishedAt = null;
    return "IMPLEMENTATION_FEEDBACK";
  }

  const writableClosure =
    failed.kind === "CLOSURE" &&
    ["scribe", "kowalski"].includes(failed.resolvedAgent);
  if (
    isImplementationPhase(failed) ||
    writableClosure ||
    TRANSIENT_ERROR_CODES.has(errorCode)
  ) {
    failed.status = "PENDING";
    failed.autoRetryCount += 1;
    failed.retryAt = retryDate(at);
    appendActivity(failed, {
      at,
      agentId: failed.resolvedAgent,
      type: "STATUS",
      message: `Nova tentativa automática ${failed.autoRetryCount}/${AUTO_RETRY_LIMIT} agendada após analisar ${errorCode}.`,
    });
    execution.status = "PENDING";
    execution.finishedAt = null;
    return "SAME_PHASE";
  }

  return null;
}

export function recoverCorrectableFailures(
  state: ProductionState,
  at = now(),
): number {
  let recovered = 0;
  for (const execution of state.executions) {
    if (!["FAILED", "BLOCKED"].includes(execution.status)) continue;
    const failed = execution.phases.find(
      (phase) => phase.status === "FAILED" || phase.status === "BLOCKED",
    );
    if (!failed) continue;
    const recovery = scheduleAutomaticRecovery(
      execution,
      failed.phaseNumber,
      {
        success: false,
        summary:
          failed.summary ??
          "A fase anterior não foi concluída; reinspecione o estado atual e corrija a causa.",
        errorCode: failed.errorCode ?? undefined,
      },
      at,
    );
    if (recovery) recovered += 1;
  }
  return recovered;
}

async function processNextProductionPhaseUnlocked() {
  await applyProductionControls();
  const config = await readProductionConfig();
  if (!config.autoRun)
    return {
      processed: false as const,
      healthy: true as const,
      paused: true as const,
    };
  const state = await syncProductionExecutions();
  if (recoverCorrectableFailures(state)) await writeProductionState(state);
  const execution = selectNextProductionExecution(state);
  if (!execution) return { processed: false as const, healthy: true as const };
  const phase = nextReadyPhase(execution, Date.now());
  if (!phase) {
    execution.status = "SUCCEEDED";
    execution.finishedAt = now();
    execution.manualFeedback = execution.manualFeedback.map((feedback) =>
      feedback.resolvedAt
        ? feedback
        : { ...feedback, resolvedAt: execution.finishedAt },
    );
    const report = await writeCompletionReport(execution);
    execution.completionReportPath = report.relativePath;
    execution.completionReportMarkdown = report.markdown;
    await writeProductionState(state);
    await db.roadmapObjective.updateMany({
      where: {
        id: execution.objectiveId,
        sourceVersion: execution.sourceVersion,
        archivedAt: null,
      },
      data: { status: "COMPLETED" },
    });
    return {
      processed: true as const,
      success: true as const,
      objectiveCode: execution.objectiveCode,
      completed: true as const,
    };
  }

  const objective = await db.roadmapObjective.findUnique({
    where: { id: execution.objectiveId },
    select: {
      archivedAt: true,
      sourceVersion: true,
      documentationStatus: true,
      promptArtifacts: {
        where: {
          documentationVersion: execution.sourceVersion,
          phaseNumber: phase.phaseNumber,
          status: "PUBLISHED",
        },
        take: 1,
        select: { contentMarkdown: true },
      },
    },
  });
  if (
    !objective ||
    objective.archivedAt ||
    objective.sourceVersion !== execution.sourceVersion ||
    objective.documentationStatus !== "DOCUMENTED"
  ) {
    phase.status = "BLOCKED";
    phase.errorCode = "OBJECTIVE_SUPERSEDED";
    phase.finishedAt = now();
    execution.status = "BLOCKED";
    execution.finishedAt = now();
    await writeProductionState(state);
    return {
      processed: true as const,
      success: false as const,
      errorCode: "OBJECTIVE_SUPERSEDED",
    };
  }
  const artifact = objective.promptArtifacts[0];
  if (!artifact) throw new Error("PRODUCTION_PHASE_ARTIFACT_MISSING");

  const successfulSummaries = execution.phases
    .filter((item) => item.status === "SUCCEEDED" && item.summary)
    .map((item) => item.summary!);
  const deliveryAdjustmentAgent = resolveDeliveryAdjustmentAgent(
    phase,
    successfulSummaries,
    artifact.contentMarkdown,
  );
  if (deliveryAdjustmentAgent) {
    const previousAgent = phase.resolvedAgent;
    phase.resolvedAgent = deliveryAdjustmentAgent;
    appendActivity(phase, {
      at: now(),
      agentId: phase.resolvedAgent,
      type: "STATUS",
      message: `Autoajuste de entrega: fase promovida de ${previousAgent} para ${phase.resolvedAgent}.`,
    });
  }

  phase.status = "RUNNING";
  phase.attemptCount += 1;
  phase.startedAt = now();
  phase.finishedAt = null;
  phase.errorCode = null;
  phase.retryAt = null;
  appendActivity(phase, {
    at: now(),
    agentId: phase.resolvedAgent,
    type: "STATUS",
    message: `Agente ${phase.resolvedAgent} iniciou a fase.`,
  });
  execution.status = "RUNNING";
  execution.startedAt ??= now();
  await writeProductionState(state);
  await db.$transaction([
    db.roadmapObjective.updateMany({
      where: {
        id: { not: execution.objectiveId },
        archivedAt: null,
        status: "IN_DEVELOPMENT",
      },
      data: { status: "ACTIVE" },
    }),
    db.roadmapObjective.updateMany({
      where: {
        id: execution.objectiveId,
        sourceVersion: execution.sourceVersion,
        archivedAt: null,
      },
      data: { status: "IN_DEVELOPMENT" },
    }),
  ]);

  const requiresWrite = phaseRequiresWrite(phase, artifact.contentMarkdown);
  const pendingManualFeedback = execution.manualFeedback.filter(
    (feedback) => !feedback.resolvedAt,
  );
  const agentInput: ProductionAgentInput = {
    agentId: phase.resolvedAgent,
    objectiveCode: execution.objectiveCode,
    objectiveTitle: execution.objectiveTitle,
    moduleKey: execution.moduleKey,
    phaseNumber: phase.phaseNumber,
    phaseTitle: phase.title,
    phaseKind: phase.kind,
    phaseMarkdown: artifact.contentMarkdown,
    manualFeedback: pendingManualFeedback.map((feedback) => feedback.content),
    previousSummaries: [
      ...successfulSummaries,
      ...(phase.attemptCount > 1 && phase.summary
        ? [
            `Resumo da tentativa anterior desta fase — use-o para agir sem repetir a investigação:\n${phase.summary}`,
          ]
        : []),
    ],
    allowWrite: requiresWrite,
    requireChanges: requiresWrite,
    priorChangesApplied:
      phase.changedFiles.length > 0 && pendingManualFeedback.length === 0,
  };
  const onActivity = (message: string) =>
    addActivity(execution.id, phase.phaseNumber, phase.resolvedAgent, message);
  const result = await runProductionAgentWithCapabilityRouting(
    config,
    execution.developmentProvider,
    agentInput,
    onActivity,
  );

  let updated = await mutateExecution(execution.id, (current) => {
    const currentPhase = current.phases.find(
      (item) => item.phaseNumber === phase.phaseNumber,
    );
    if (!currentPhase) return;
    currentPhase.status = result.success
      ? "SUCCEEDED"
      : result.errorCode === "AGENT_BLOCKED"
        ? "BLOCKED"
        : "FAILED";
    currentPhase.finishedAt = now();
    currentPhase.summary = result.summary;
    currentPhase.errorCode = result.errorCode ?? null;
    appendActivity(currentPhase, {
      at: now(),
      agentId: currentPhase.resolvedAgent,
      type: result.success ? "RESULT" : "ERROR",
      message: result.success
        ? "Fase concluída."
        : `Fase interrompida: ${result.errorCode ?? "AGENT_FAILED"}`,
    });
    if (!result.success) {
      let recovery: "IMPLEMENTATION_FEEDBACK" | "SAME_PHASE" | null;
      const retryAgent = resolveDeliveryAdjustmentAgent(
        currentPhase,
        [result.summary],
        artifact.contentMarkdown,
      );
      if (retryAgent && currentPhase.autoRetryCount < AUTO_RETRY_LIMIT) {
        const previousAgent = currentPhase.resolvedAgent;
        currentPhase.resolvedAgent = retryAgent;
        currentPhase.status = "PENDING";
        currentPhase.autoRetryCount += 1;
        currentPhase.retryAt = retryDate(now());
        currentPhase.errorCode = "DELIVERY_AUTO_ADJUSTMENT";
        appendActivity(currentPhase, {
          at: now(),
          agentId: currentPhase.resolvedAgent,
          type: "STATUS",
          message: `Lacuna de entrega detectada por ${previousAgent}; fase promovida automaticamente para ${currentPhase.resolvedAgent}.`,
        });
        current.status = "PENDING";
        current.finishedAt = null;
        recovery = "SAME_PHASE";
      } else {
        recovery = scheduleAutomaticRecovery(
          current,
          currentPhase.phaseNumber,
          result,
        );
      }
      if (!recovery) {
        current.status =
          currentPhase.status === "BLOCKED" ? "BLOCKED" : "FAILED";
        current.finishedAt = now();
        if (currentPhase.autoRetryCount >= AUTO_RETRY_LIMIT) {
          appendActivity(currentPhase, {
            at: now(),
            agentId: currentPhase.resolvedAgent,
            type: "ERROR",
            message: `Limite de ${AUTO_RETRY_LIMIT} correções automáticas atingido; intervenção administrativa necessária.`,
          });
        }
      }
    } else if (current.phases.every((item) => item.status === "SUCCEEDED")) {
      current.status = "SUCCEEDED";
      current.finishedAt = now();
      current.manualFeedback = current.manualFeedback.map((feedback) =>
        feedback.resolvedAt
          ? feedback
          : { ...feedback, resolvedAt: current.finishedAt },
      );
    } else {
      current.status = "PENDING";
    }
  });
  if (updated.status === "SUCCEEDED" && !updated.completionReportMarkdown) {
    const report = await writeCompletionReport(updated);
    updated = await mutateExecution(updated.id, (current) => {
      current.completionReportPath = report.relativePath;
      current.completionReportMarkdown = report.markdown;
    });
    await db.roadmapObjective.updateMany({
      where: {
        id: updated.objectiveId,
        sourceVersion: updated.sourceVersion,
        archivedAt: null,
      },
      data: { status: "COMPLETED" },
    });
  }
  return {
    processed: true as const,
    success: result.success,
    objectiveCode: updated.objectiveCode,
    phaseNumber: phase.phaseNumber,
    agentId: phase.resolvedAgent,
    errorCode: result.errorCode,
    autoRetryScheduled: !result.success && updated.status === "PENDING",
  };
}

export async function processNextProductionPhase() {
  const lease = await acquireProductionExecutionLease();
  if (!lease) {
    return {
      processed: false as const,
      healthy: true as const,
      busy: true as const,
    };
  }
  try {
    return await processNextProductionPhaseUnlocked();
  } finally {
    await lease.release();
  }
}
