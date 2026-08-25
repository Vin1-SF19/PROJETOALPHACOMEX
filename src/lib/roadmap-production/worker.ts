import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";
import {
  listBibbleAgents,
  resolveCapabilityEscalationAgent,
  resolvePhaseAgent,
} from "@/lib/roadmap-production/agents";
import type {
  DevelopmentProvider,
  ProductionActivity,
  ProductionConfig,
  ProductionExecution,
  ProductionMessage,
  ProductionState,
} from "@/lib/roadmap-production/contracts";

type ProductionPhaseCompat = Omit<
  ProductionExecution["phases"][number],
  "agentOverride" | "circuit"
> &
  Partial<
    Pick<
      ProductionExecution["phases"][number],
      "agentOverride" | "circuit"
    >
  >;
type ProductionExecutionCompat = Omit<
  ProductionExecution,
  "messages" | "interventions" | "phases"
> & {
  messages?: ProductionExecution["messages"];
  interventions?: ProductionExecution["interventions"];
  phases: ProductionPhaseCompat[];
};
type ProductionStateCompat = Omit<ProductionState, "executions"> & {
  executions: ProductionExecutionCompat[];
};
import { isAdminRole } from "@/lib/roles";

import { writeCompletionReport } from "@/lib/roadmap-production/completion-report";
import { acquireProductionExecutionLease } from "@/lib/roadmap-production/execution-lock";
import {
  requiresCapabilityEscalation,
  requiresDeliveryAdjustment,
  runProductionAgent,
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
import { resolveProductionWorkspaceScope } from "@/lib/roadmap-production/workspace-scope";
import {
  createCircuitIntervention,
  registerProductionFailure,
  resetProductionCircuit,
  sanitizeProductionText,
  validateInteractionCommand,
} from "@/lib/roadmap-production/interactions";

const AUTO_RETRY_DELAY_MS = 5_000;
// Margem alta de propósito: fases recuperáveis (implementação, closure gravável, erro
// transiente) devem insistir bastante antes de travar pedindo intervenção administrativa.
const AUTO_RETRY_LIMIT = 30;
// Quantas vezes a Qwen tenta resolver sozinha uma tarefa básica antes de escalar para
// Claude/Codex — só não se aplica quando a própria Qwen sinaliza CAPABILITY_ESCALATION_REQUIRED,
// caso em que ela já declarou não ter capacidade e o escalonamento é imediato.
const QWEN_SELF_RETRY_LIMIT = 5;
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
  "PROVIDER_EXTERNAL_CLI_DISABLED",
  "PROVIDER_QUOTA_EXHAUSTED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_WRITE_SANDBOX_UNAVAILABLE",
]);

// Descrição legível de cada código de erro conhecido do pipeline — usada nas mensagens de
// atividade para que o histórico da fase explique a causa raiz, não só o código técnico.
const ERROR_CODE_DESCRIPTIONS: Record<string, string> = {
  AGENT_BLOCKED: "o agente bloqueou a fase por não conseguir validar um pré-requisito",
  AGENT_REPORTED_FAILURE: "o agente reportou falha ao executar a fase",
  AGENT_RESULT_MISSING: "o agente não retornou o marcador obrigatório de resultado (RESULT: PASS/FAIL/BLOCKED)",
  AGENT_STEP_LIMIT: "o agente excedeu o número máximo de passos de ferramentas permitido para a fase",
  CLI_EXECUTION_FAILED: "a CLI do provedor terminou com erro de execução",
  CLI_NOT_FOUND: "a CLI do provedor não está instalada ou não foi encontrada no ambiente",
  CLI_TIMEOUT: "a CLI do provedor excedeu o tempo limite de execução",
  INVALID_PROVIDER_CONFIG: "a configuração do provedor Ollama/Qwen está inválida ou incompleta",
  INVALID_PROVIDER_RESPONSE: "o provedor retornou uma resposta em formato inesperado",
  NO_CHANGES_APPLIED: "a fase exigia alterações de arquivo, mas nenhuma foi aplicada",
  PROHIBITED_GIT_MUTATION: "o agente tentou alterar o HEAD do repositório, operação proibida",
  PRODUCTION_PROVIDER_FAILED: "nenhum provedor de IA configurado conseguiu executar a fase",
  PROVIDER_AUTH_FAILED: "falha de autenticação com o provedor de IA",
  PROVIDER_EXTERNAL_CLI_DISABLED:
    "o provider CLI externo está desabilitado até existir workspace brokerizado",
  PROVIDER_HTTP_ERROR: "erro de comunicação HTTP com o provedor de IA",
  PROVIDER_QUOTA_EXHAUSTED: "o provedor atingiu o limite de créditos ou uso",
  PROVIDER_RATE_LIMITED: "o provedor aplicou um limite temporário de requisições",
  PROVIDER_WRITE_SANDBOX_UNAVAILABLE:
    "o provider externo não possui mediador executável seguro para escrita",
  TRUNCATED_MODEL_RESPONSE: "o modelo retornou respostas truncadas repetidamente",
};

export function describeProductionErrorCode(errorCode?: string | null): string {
  if (!errorCode) return "erro não identificado";
  const description = ERROR_CODE_DESCRIPTIONS[errorCode];
  return description ? `${description} (${errorCode})` : errorCode;
}

export function shouldFallbackDevelopmentProvider(errorCode?: string): boolean {
  return Boolean(errorCode && PROVIDER_FALLBACK_ERROR_CODES.has(errorCode));
}

export function developmentProviderOrder(
  preferred: DevelopmentProvider,
): DevelopmentProvider[] {
  void preferred;
  return ["ollama"];
}

export function nextBrokeredCapabilityAgent(
  currentAgent: string,
  summary: string,
): "nova" | "echo" | null {
  if (!requiresCapabilityEscalation([summary])) return null;
  const promotedAgent = resolveCapabilityEscalationAgent(summary) ?? "echo";
  return promotedAgent === currentAgent ? null : promotedAgent;
}

async function runProductionAgentWithCapabilityRouting(
  config: ProductionConfig,
  preferred: DevelopmentProvider,
  input: ProductionAgentInput,
  onActivity: (message: string) => Promise<void> | void,
  root = process.cwd(),
): Promise<ProductionAgentResult> {
  const qwenModel = process.env.ROADMAP_QWEN_MODEL?.trim();
  if (!qwenModel?.startsWith("qwen3.8")) {
    await onActivity("Qwen 3.8 brokerizado sem configuração válida.");
    return {
      success: false,
      summary: "O único provider brokerizado não está configurado.",
      errorCode: "INVALID_PROVIDER_CONFIG",
      toolSteps: 0,
    };
  }
  void preferred;
  const previousEscalation = resolveCapabilityEscalationAgent(
    input.previousSummaries.join("\n"),
  );
  let routedAgent = previousEscalation ?? input.agentId;
  await onActivity(
    `Roteamento seguro: Qwen 3.8 brokerizado como ${routedAgent}.`,
  );
  let qwenResult: ProductionAgentResult;
  let qwenInput =
    routedAgent === input.agentId ? input : { ...input, agentId: routedAgent };
  let attempt = 1;
  for (;;) {
    qwenResult = await runProductionAgent(
      { ...config, provider: "ollama", model: qwenModel },
      qwenInput,
      onActivity,
      root,
    );
    const routedResult =
      routedAgent === input.agentId
        ? qwenResult
        : { ...qwenResult, resolvedAgent: routedAgent };
    if (qwenResult.success || qwenResult.errorCode === "NEEDS_INPUT") {
      return routedResult;
    }

    if (requiresCapabilityEscalation([qwenResult.summary])) {
      if (attempt >= QWEN_SELF_RETRY_LIMIT) return routedResult;
      const promotedAgent = nextBrokeredCapabilityAgent(
        routedAgent,
        qwenResult.summary,
      );
      if (!promotedAgent) return routedResult;
      await onActivity(
        `Capacidade reencaminhada para ${promotedAgent} no mesmo Qwen brokerizado.`,
      );
      routedAgent = promotedAgent;
      qwenInput = {
        ...input,
        agentId: promotedAgent,
        previousSummaries: [
          ...qwenInput.previousSummaries,
          `Diagnóstico antes da troca de persona:\n${qwenResult.summary}`,
        ],
      };
      attempt += 1;
      continue;
    }
    if (attempt >= QWEN_SELF_RETRY_LIMIT) return routedResult;

    await onActivity(
      `Qwen não concluiu na tentativa ${attempt}/${QWEN_SELF_RETRY_LIMIT} (${describeProductionErrorCode(qwenResult.errorCode)}); tentando novamente sozinha antes de escalar.`,
    );
    qwenInput = {
      ...qwenInput,
      previousSummaries: [
        ...qwenInput.previousSummaries,
        `Tentativa ${attempt} da Qwen falhou (${describeProductionErrorCode(qwenResult.errorCode)}): ${qwenResult.summary}`,
      ],
    };
    attempt += 1;
  }
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

const AUTO_RETRY_WARNING_THRESHOLD = Math.floor(AUTO_RETRY_LIMIT / 2);

/**
 * Até virar BLOCKED, uma fase pode se autocorrigir silenciosamente até
 * AUTO_RETRY_LIMIT vezes — na prática já se observou attemptCount na casa das
 * dezenas antes de aparecer qualquer sinal para o administrador. Ao cruzar a
 * metade do limite pela primeira vez, empurra um aviso visível no chat da
 * execução (não só no log interno da fase) para dar chance de intervenção
 * antes do circuito estourar. Comparação exata (===) garante disparo único —
 * chamar depois de CADA incremento de autoRetryCount, nos 3 pontos do arquivo
 * que o incrementam.
 */
function appendRetryThresholdWarning(
  execution: ProductionExecutionCompat,
  phase: ProductionPhaseCompat,
  at: string,
): void {
  if (phase.autoRetryCount !== AUTO_RETRY_WARNING_THRESHOLD) return;
  const warning: ProductionMessage = {
    id: randomUUID(),
    executionId: execution.id,
    phaseNumber: phase.phaseNumber,
    role: "SYSTEM",
    kind: "STATUS",
    content: `Esta fase já tentou se autocorrigir ${AUTO_RETRY_WARNING_THRESHOLD} de ${AUTO_RETRY_LIMIT} vezes sem sucesso. Considere revisar o objetivo ou intervir manualmente antes do limite ser atingido.`,
    requestId: null,
    createdAt: at,
  };
  execution.messages = [...(execution.messages ?? []), warning].slice(-500);
}

function isReady(
  phase: ProductionPhaseCompat,
  referenceTime: number,
): boolean {
  return (
    phase.status === "PENDING" &&
    (!phase.retryAt || Date.parse(phase.retryAt) <= referenceTime)
  );
}

function nextReadyPhase(
  execution: ProductionExecutionCompat,
  referenceTime: number,
): ProductionPhaseCompat | undefined {
  const nextPending = execution.phases.find(
    (phase) => phase.status === "PENDING",
  );
  return nextPending && isReady(nextPending, referenceTime)
    ? nextPending
    : undefined;
}

function appendActivity(
  executionPhase: Pick<ProductionPhaseCompat, "activities">,
  activity: ProductionActivity,
): void {
  executionPhase.activities = [...executionPhase.activities, activity].slice(
    -200,
  );
}

async function documentedObjectives(allowedModuleKeys: ReadonlySet<string>) {
  return db.roadmapObjective.findMany({
    where: {
      archivedAt: null,
      documentationStatus: "DOCUMENTED",
      moduleKey: { in: Array.from(allowedModuleKeys) },
    },
    orderBy: [{ globalPriority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      moduleKey: true,
      sourceVersion: true,
      globalPriority: true,
      createdBy: { select: { role: true } },
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

export async function syncProductionExecutions(
  root = process.cwd(),
  allowedModuleKeys?: ReadonlySet<string>,
): Promise<ProductionState> {
  const scopeModuleKeys =
    allowedModuleKeys ?? (await resolveProductionWorkspaceScope(root)).allowedModuleKeys;
  const [state, objectives, developmentPreferences] = await Promise.all([
    readProductionState(root),
    documentedObjectives(scopeModuleKeys),
    readObjectiveDevelopmentPreferences(root),
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
        if (!existingPhase.agentOverride && existingPhase.resolvedAgent !== desiredAgent) {
          existingPhase.resolvedAgent = desiredAgent;
          resetProductionCircuit(
            existing,
            existingPhase.phaseNumber,
            "agente corrigido automaticamente",
            now(),
          );
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
    /**
     * Objetivo criado por autor com role administrativa (Admin/CEO/TI —
     * mesmo bypass já estabelecido em todo o projeto via isAdminRole) nasce
     * direto em PENDING, pulando AWAITING_APPROVAL por completo — decisão
     * explícita do usuário. A primeira fase recebe uma activity registrando
     * o motivo, para manter rastreabilidade de por que essa execução nunca
     * passou por aprovação manual.
     */
    const autoApproved = isAdminRole(objective.createdBy.role);
    const newExecution = {
      id,
      objectiveId: objective.id,
      objectiveCode: objective.code,
      objectiveTitle: objective.title,
      moduleKey: objective.moduleKey,
      developmentProvider,
      sourceVersion: objective.sourceVersion,
      globalPriority: objective.globalPriority,
      status: autoApproved
        ? ("PENDING" as const)
        : ("AWAITING_APPROVAL" as const),
      createdAt,
      startedAt: null,
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      messages: [],
      interventions: [],
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
        agentOverride: false,
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
        circuit: {
          fingerprint: null,
          consecutiveCount: 0,
          firstOccurredAt: null,
          lastOccurredAt: null,
          resetReason: null,
        },
        activities: [],
      })),
    } satisfies ProductionExecutionCompat;
    if (autoApproved) {
      for (const phase of newExecution.phases) {
        appendActivity(phase, {
          at: createdAt,
          agentId: phase.resolvedAgent,
          type: "STATUS",
          message:
            "Aprovação automática — autor tem acesso administrativo (Admin/CEO/TI), objetivo liberado direto para produção.",
        });
        break;
      }
    }
    state.executions.push(newExecution);
    changed = true;
  }
  for (const execution of state.executions) {
    if (execution.status !== "SUCCEEDED" || execution.completionReportMarkdown)
      continue;
    const report = await writeCompletionReport(execution, root);
    execution.completionReportPath = report.relativePath;
    execution.completionReportMarkdown = report.markdown;
    changed = true;
  }
  /**
   * Aposentadoria PROATIVA de execuções obsoletas — extensão do gate
   * reativo de OBJECTIVE_SUPERSEDED (linha ~1168 mais abaixo, dentro de
   * processNextProductionPhaseUnlocked), que só roda quando o worker tenta
   * processar a PRÓXIMA fase de uma execução específica. Uma execução já
   * parada (BLOCKED/AWAITING_APPROVAL/PENDING/PAUSED/WAITING_FOR_ADMIN/
   * FAILED) nunca volta a ser processada, então nunca chegaria nesse gate —
   * ficaria presa com o errorCode antigo para sempre mesmo depois que uma
   * versão mais nova do MESMO objetivo já foi documentada e já tem sua
   * própria execução ativa. Este loop cobre exatamente essa lacuna, a cada
   * sincronização (poll da UI ou ciclo do worker).
   */
  const currentSourceVersionByObjective = new Map(
    objectives.map((objective) => [objective.id, objective.sourceVersion]),
  );
  for (const execution of state.executions) {
    if (execution.status === "SUCCEEDED" || execution.status === "RUNNING")
      continue;
    const alreadySuperseded = execution.phases.some(
      (phase) => phase.errorCode === "OBJECTIVE_SUPERSEDED",
    );
    if (alreadySuperseded) continue;
    const currentVersion = currentSourceVersionByObjective.get(
      execution.objectiveId,
    );
    if (currentVersion === undefined || execution.sourceVersion >= currentVersion)
      continue;
    const currentPhase = [...execution.phases]
      .reverse()
      .find((phase) => phase.status !== "SUCCEEDED");
    if (!currentPhase) continue;
    currentPhase.status = "BLOCKED";
    currentPhase.errorCode = "OBJECTIVE_SUPERSEDED";
    currentPhase.finishedAt = now();
    execution.status = "BLOCKED";
    execution.finishedAt = now();
    appendActivity(currentPhase, {
      at: now(),
      agentId: currentPhase.resolvedAgent,
      type: "STATUS",
      message:
        "Objetivo foi revisado (nova versão já documentada) — esta execução da versão anterior foi aposentada automaticamente.",
    });
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
  if (changed) await writeProductionState(state, root);
  return state;
}

export async function refreshProductionExecutions(
  root = process.cwd(),
): Promise<ProductionState> {
  const lease = await acquireProductionExecutionLease();
  if (!lease) return readProductionState(root);
  try {
    return await syncProductionExecutions(root);
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
  const installedAgents = new Set(
    (await listBibbleAgents(process.cwd()))
      .filter((agent) => agent.available)
      .map((agent) => agent.id),
  );
  for (const { command } of controls) {
    const index = state.executions.findIndex(
      (execution) => execution.id === command.executionId,
    );
    const execution = index >= 0 ? state.executions[index] : null;
    if (["RESPOND", "AUTHORIZE", "DENY", "MESSAGE", "SWITCH_AGENT"].includes(command.type)) {
      try {
        validateInteractionCommand(state, command, installedAgents);
      } catch (error) {
        const code = error instanceof Error ? error.message : "INTERACTION_REJECTED";
        const phase = execution?.phases.find((item) => item.phaseNumber === command.phaseNumber);
        if (execution && phase) {
          execution.messages.push({
            id: randomUUID(),
            executionId: execution.id,
            phaseNumber: phase.phaseNumber,
            role: "SYSTEM",
            kind: "STATUS",
            content: `Comando administrativo rejeitado: ${code}`,
            requestId: command.requestId,
            createdAt: command.createdAt,
          });
          execution.messages = execution.messages.slice(-500);
        }
        continue;
      }
    }
    if (command.type === "EXCLUDE") {
      if (execution) state.executions.splice(index, 1);
      if (!state.ignoredExecutionIds.includes(command.executionId))
        state.ignoredExecutionIds.push(command.executionId);
      state.ignoredExecutionIds = state.ignoredExecutionIds.slice(-500);
    } else if (
      command.type === "APPROVE" &&
      execution &&
      execution.status === "AWAITING_APPROVAL"
    ) {
      execution.status = "PENDING";
      for (const phase of execution.phases) {
        appendActivity(phase, {
          at: now(),
          agentId: phase.resolvedAgent,
          type: "STATUS",
          message: "Objetivo aprovado pelo administrador; liberado para produção.",
        });
        break;
      }
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
    } else if (
      ["RESPOND", "AUTHORIZE", "DENY"].includes(command.type) &&
      execution &&
      command.phaseNumber !== null &&
      command.requestId
    ) {
      const phase = execution.phases.find(
        (item) => item.phaseNumber === command.phaseNumber,
      );
      const intervention = execution.interventions.find(
        (item) => item.requestId === command.requestId,
      );
      if (!phase || !intervention) continue;
      const decision =
        command.type === "RESPOND"
          ? "ANSWER"
          : command.type === "AUTHORIZE"
            ? "AUTHORIZE"
            : "DENY";
      const content = sanitizeProductionText(
        command.content ??
          (decision === "AUTHORIZE"
            ? "Ação autorizada uma única vez para esta fase."
            : "Ação negada pelo administrador."),
      );
      intervention.status =
        decision === "ANSWER"
          ? "ANSWERED"
          : decision === "AUTHORIZE"
            ? "AUTHORIZED"
            : "DENIED";
      intervention.resolvedAt = command.createdAt;
      intervention.resolution = {
        author: command.author,
        decision,
        content,
        createdAt: command.createdAt,
        authorizationAttempt:
          decision === "AUTHORIZE" ? phase.attemptCount + 1 : null,
        authorizationConsumedAt: null,
      };
      execution.messages.push({
        id: randomUUID(),
        executionId: execution.id,
        phaseNumber: phase.phaseNumber,
        role: "ADMIN",
        kind: decision === "ANSWER" ? "ANSWER" : "DECISION",
        content,
        requestId: intervention.requestId,
        createdAt: command.createdAt,
      });
      execution.messages = execution.messages.slice(-500);
      if (decision === "DENY") {
        phase.status = "BLOCKED";
        phase.errorCode = "ADMIN_DENIED";
        phase.finishedAt = command.createdAt;
        execution.status = "BLOCKED";
        execution.finishedAt = command.createdAt;
      } else {
        phase.status = "PENDING";
        phase.errorCode = null;
        phase.finishedAt = null;
        phase.retryAt = null;
        execution.status = "PENDING";
        execution.finishedAt = null;
        resetProductionCircuit(
          execution,
          phase.phaseNumber,
          "resposta administrativa recebida",
          command.createdAt,
        );
      }
    } else if (
      command.type === "MESSAGE" &&
      execution &&
      command.phaseNumber !== null &&
      command.content
    ) {
      execution.messages.push({
        id: randomUUID(),
        executionId: execution.id,
        phaseNumber: command.phaseNumber,
        role: "ADMIN",
        kind: "MESSAGE",
        content: sanitizeProductionText(command.content),
        requestId: null,
        createdAt: command.createdAt,
      });
      execution.messages = execution.messages.slice(-500);
    } else if (
      command.type === "SWITCH_AGENT" &&
      execution &&
      command.phaseNumber !== null &&
      command.agentId
    ) {
      const phase = execution.phases.find(
        (item) => item.phaseNumber === command.phaseNumber,
      );
      if (!phase) continue;
      const previousAgent = phase.resolvedAgent;
      phase.resolvedAgent = command.agentId;
      phase.agentOverride = true;
      resetProductionCircuit(
        execution,
        phase.phaseNumber,
        `troca manual de ${previousAgent} para ${command.agentId}`,
        command.createdAt,
      );
      execution.messages.push({
        id: randomUUID(),
        executionId: execution.id,
        phaseNumber: phase.phaseNumber,
        role: "SYSTEM",
        kind: "STATUS",
        content: `Agente trocado por ${command.author}: ${previousAgent} → ${command.agentId}.`,
        requestId: null,
        createdAt: command.createdAt,
      });
      execution.messages = execution.messages.slice(-500);
    } else if (execution) {
      for (const phase of execution.phases) {
        appendActivity(phase, {
          at: now(),
          agentId: phase.resolvedAgent,
          type: "STATUS",
          message: `Comando ${command.type} ignorado: execução está em status ${execution.status}, condição do comando não foi satisfeita.`,
        });
        break;
      }
    } else {
      console.warn(
        `[roadmap-production] Comando ${command.type} ignorado: executionId ${command.executionId} não encontrado no estado atual.`,
      );
    }
  }
  await writeProductionState(state, root);
  await removeProductionControlFiles(
    controls.map((control) => control.filePath),
  );
  return controls.length;
}

export function selectNextProductionExecution(
  state: ProductionStateCompat,
): ProductionExecutionCompat | undefined {
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
  root = process.cwd(),
): Promise<ProductionExecution> {
  const state = await readProductionState(root);
  const execution = state.executions.find(
    (item) => item.id === executionIdValue,
  );
  if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
  mutate(execution);
  await writeProductionState(state, root);
  return execution;
}

async function addActivity(
  executionIdValue: string,
  phaseNumber: number,
  agentId: string,
  message: string,
  root = process.cwd(),
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
  }, root);
}

async function recoverInterruptedProductionUnlocked(
  root = process.cwd(),
): Promise<number> {
  const state = await readProductionState(root);
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
  if (recovered) await writeProductionState(state, root);
  return recovered;
}

export async function recoverInterruptedProduction(
  root = process.cwd(),
): Promise<number> {
  const lease = await acquireProductionExecutionLease(root);
  if (!lease) return 0;
  try {
    return await recoverInterruptedProductionUnlocked(root);
  } finally {
    await lease.release();
  }
}

async function retryProductionExecutionUnlocked(
  id: string,
  adoptedChanges: string[] = [],
  root = process.cwd(),
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
  }, root);
}

export async function retryProductionExecution(
  id: string,
  adoptedChanges: string[] = [],
  root = process.cwd(),
): Promise<void> {
  const lease = await acquireProductionExecutionLease();
  if (!lease) throw new Error("PRODUCTION_EXECUTION_BUSY");
  try {
    await retryProductionExecutionUnlocked(id, adoptedChanges, root);
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
  execution: ProductionExecutionCompat,
  failedPhaseNumber: number,
  result: FailedAgentResult,
  at = now(),
): "IMPLEMENTATION_FEEDBACK" | "SAME_PHASE" | null {
  const failed = execution.phases.find(
    (phase) => phase.phaseNumber === failedPhaseNumber,
  );
  if (!failed || failed.autoRetryCount >= AUTO_RETRY_LIMIT) return null;
  const errorCode = result.errorCode ?? "AGENT_FAILED";
  if (errorCode === "ADMIN_DENIED") return null;

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
    appendRetryThresholdWarning(execution, failed, at);
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
    appendRetryThresholdWarning(execution, failed, at);
    failed.retryAt = retryDate(at);
    appendActivity(failed, {
      at,
      agentId: failed.resolvedAgent,
      type: "STATUS",
      message: `Nova tentativa automática ${failed.autoRetryCount}/${AUTO_RETRY_LIMIT} agendada após analisar: ${describeProductionErrorCode(errorCode)}.`,
    });
    execution.status = "PENDING";
    execution.finishedAt = null;
    return "SAME_PHASE";
  }

  return null;
}

export function recoverCorrectableFailures(
  state: ProductionStateCompat,
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

async function processNextProductionPhaseUnlocked(root = process.cwd()) {
  const scope = await resolveProductionWorkspaceScope(root);
  await applyProductionControls(root);
  const config = await readProductionConfig(root);
  if (!config.autoRun)
    return {
      processed: false as const,
      healthy: true as const,
      paused: true as const,
    };
  const state = await syncProductionExecutions(root, scope.allowedModuleKeys);
  if (recoverCorrectableFailures(state)) await writeProductionState(state, root);
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
    const report = await writeCompletionReport(execution, root);
    execution.completionReportPath = report.relativePath;
    execution.completionReportMarkdown = report.markdown;
    await writeProductionState(state, root);
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
    await writeProductionState(state, root);
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
  await writeProductionState(state, root);
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
    executionId: execution.id,
    agentId: phase.resolvedAgent,
    objectiveCode: execution.objectiveCode,
    objectiveTitle: execution.objectiveTitle,
    moduleKey: execution.moduleKey,
    phaseNumber: phase.phaseNumber,
    phaseTitle: phase.title,
    phaseKind: phase.kind,
    phaseMarkdown: artifact.contentMarkdown,
    manualFeedback: [
      ...pendingManualFeedback.map((feedback) => feedback.content),
      ...(execution.messages ?? [])
        .filter((message) => message.phaseNumber === phase.phaseNumber)
        .filter((message) => {
          if (!message.requestId) return true;
          const related = (execution.interventions ?? []).find(
            (item) => item.requestId === message.requestId,
          );
          if (related?.status !== "AUTHORIZED") return true;
          return (
            related.resolution?.authorizationAttempt === phase.attemptCount &&
            related.resolution.authorizationConsumedAt === null
          );
        })
        .slice(-20)
        .map(
          (message) =>
            `[${message.role}/${message.kind}] ${message.content}`,
        ),
    ],
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
    addActivity(
      execution.id,
      phase.phaseNumber,
      phase.resolvedAgent,
      message,
      root,
    );
  const result = await runProductionAgentWithCapabilityRouting(
    config,
    execution.developmentProvider,
    agentInput,
    onActivity,
    root,
  );

  let updated = await mutateExecution(
    execution.id,
    (current) => {
    const currentPhase = current.phases.find(
      (item) => item.phaseNumber === phase.phaseNumber,
    );
    if (!currentPhase) return;
    for (const intervention of current.interventions) {
      if (
        intervention.phaseNumber === currentPhase.phaseNumber &&
        intervention.status === "AUTHORIZED" &&
        intervention.resolution?.authorizationAttempt ===
          currentPhase.attemptCount &&
        intervention.resolution.authorizationConsumedAt === null
      ) {
        intervention.resolution.authorizationConsumedAt = now();
      }
    }
    if (result.resolvedAgent && result.resolvedAgent !== currentPhase.resolvedAgent) {
      const previousAgent = currentPhase.resolvedAgent;
      currentPhase.resolvedAgent = result.resolvedAgent;
      currentPhase.agentOverride = false;
      resetProductionCircuit(
        current,
        currentPhase.phaseNumber,
        `escalonamento automático de ${previousAgent} para ${result.resolvedAgent}`,
        now(),
      );
    }
    if (result.errorCode === "NEEDS_INPUT" && result.intervention) {
      const intervention = result.intervention;
      if (intervention.phaseNumber !== currentPhase.phaseNumber) {
        currentPhase.status = "FAILED";
        currentPhase.finishedAt = now();
        currentPhase.summary = result.summary;
        currentPhase.errorCode = "INTERVENTION_PHASE_MISMATCH";
        current.status = "FAILED";
        current.finishedAt = now();
        return;
      }
      const duplicate = current.interventions.some(
        (item) => item.requestId === intervention.requestId,
      );
      if (!duplicate) {
        current.interventions.push(intervention);
        current.interventions = current.interventions.slice(-100);
        current.messages.push({
          id: randomUUID(),
          executionId: current.id,
          phaseNumber: currentPhase.phaseNumber,
          role: "AGENT",
          kind: "QUESTION",
          content: intervention.question,
          requestId: intervention.requestId,
          createdAt: intervention.createdAt,
        });
        current.messages = current.messages.slice(-500);
      }
      currentPhase.status = "NEEDS_INPUT";
      currentPhase.finishedAt = now();
      currentPhase.summary = result.summary;
      currentPhase.errorCode = "NEEDS_INPUT";
      current.status = "WAITING_FOR_ADMIN";
      current.finishedAt = null;
      return;
    }
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
        : `Fase interrompida: ${describeProductionErrorCode(result.errorCode)}`,
    });
    if (!result.success) {
      const circuit = registerProductionFailure(
        current,
        currentPhase.phaseNumber,
        result.errorCode,
        result.summary,
        now(),
      );
      if (circuit.opened) {
        const intervention = createCircuitIntervention(
          current,
          currentPhase.phaseNumber,
          result.summary,
          circuit.count,
          now(),
        );
        current.interventions.push(intervention);
        current.interventions = current.interventions.slice(-100);
        current.messages.push({
          id: randomUUID(),
          executionId: current.id,
          phaseNumber: currentPhase.phaseNumber,
          role: "SYSTEM",
          kind: "QUESTION",
          content: intervention.question,
          requestId: intervention.requestId,
          createdAt: intervention.createdAt,
        });
        current.messages = current.messages.slice(-500);
        currentPhase.status = "NEEDS_INPUT";
        currentPhase.errorCode = "CIRCUIT_OPEN";
        current.status = "WAITING_FOR_ADMIN";
        current.finishedAt = null;
        return;
      }
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
        appendRetryThresholdWarning(current, currentPhase, now());
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
        const motivo =
          currentPhase.autoRetryCount >= AUTO_RETRY_LIMIT
            ? `Limite de ${AUTO_RETRY_LIMIT} correções automáticas atingido`
            : "Este erro não é recuperável automaticamente";
        appendActivity(currentPhase, {
          at: now(),
          agentId: currentPhase.resolvedAgent,
          type: "ERROR",
          message: `${motivo}: ${describeProductionErrorCode(result.errorCode)}. Intervenção administrativa necessária. Última causa registrada: ${result.summary.slice(0, 400)}`,
        });
      }
    } else if (current.phases.every((item) => item.status === "SUCCEEDED")) {
      resetProductionCircuit(
        current,
        currentPhase.phaseNumber,
        "fase concluída com sucesso",
        now(),
      );
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
  }, root);
  if (updated.status === "SUCCEEDED" && !updated.completionReportMarkdown) {
    const report = await writeCompletionReport(updated, root);
    updated = await mutateExecution(
      updated.id,
      (current) => {
        current.completionReportPath = report.relativePath;
        current.completionReportMarkdown = report.markdown;
      },
      root,
    );
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

export async function processNextProductionPhase(root = process.cwd()) {
  const lease = await acquireProductionExecutionLease(root);
  if (!lease) {
    return {
      processed: false as const,
      healthy: true as const,
      busy: true as const,
    };
  }
  try {
    return await processNextProductionPhaseUnlocked(root);
  } finally {
    await lease.release();
  }
}
