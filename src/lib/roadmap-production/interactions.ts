import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  productionInterventionCategorySchema,
  type ProductionControlCommand,
  type ProductionExecution,
  type ProductionIntervention,
  type ProductionState,
} from "@/lib/roadmap-production/contracts";
import {
  classifyProductionAction,
  normalizeProductionAction,
  policyLevelForCategory,
} from "@/lib/roadmap-production/policy";

const needsInputPayloadSchema = z
  .object({
    requestId: z.string().uuid(),
    phaseNumber: z.number().int().min(0).max(99),
    category: productionInterventionCategorySchema,
    question: z.string().trim().min(5).max(2_000),
    intendedAction: z.string().trim().min(1).max(1_000),
    risk: z.string().trim().min(1).max(2_000),
    options: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  })
  .strict();

const SECRET_PATTERNS = [
  /\b(?:authorization|x-api-key|api[_ -]?key|token|secret|password|senha)\s*[:=]\s*[^\s,;]+/gi,
  /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s]+/gi,
  /\b(?:sk|ghp|github_pat|glpat)-[A-Za-z0-9_-]{12,}\b/g,
];

export function sanitizeProductionText(value: string, limit = 4_000): string {
  let sanitized = value.normalize("NFKC");
  for (const pattern of SECRET_PATTERNS) sanitized = sanitized.replace(pattern, "[REDACTED]");
  sanitized = sanitized.replace(/(?:^|[\\/])\.env(?:\.[\w.-]+)?\b/gi, " [PROTECTED_FILE]");
  return sanitized.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, limit);
}

export function parseNeedsInputResult(
  content: string,
  executionId: string,
): ProductionIntervention | null {
  if (!/^|\n/.test(content) || !/RESULT\s*:\s*NEEDS_INPUT\b/i.test(content)) return null;
  const marker = content.match(/NEEDS_INPUT_JSON\s*:\s*(\{[^]*\})\s*$/i);
  if (!marker?.[1]) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(marker[1]);
  } catch {
    return null;
  }
  const parsed = needsInputPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;
  const safeIntendedAction = sanitizeProductionText(value.intendedAction, 1_000);
  const policy = classifyProductionAction({ action: safeIntendedAction });
  const categoryLevel = policyLevelForCategory(value.category);
  const normalizedAction = normalizeProductionAction(safeIntendedAction);
  const effectiveRisk =
    categoryLevel === "FORBIDDEN" ? `${value.risk}\n${policy.guidance}` : value.risk;
  return {
    id: randomUUID(),
    requestId: value.requestId,
    executionId,
    phaseNumber: value.phaseNumber,
    category: value.category,
    question: sanitizeProductionText(value.question, 2_000),
    intendedAction: safeIntendedAction,
    normalizedAction,
    risk: sanitizeProductionText(effectiveRisk, 2_000),
    options: value.options.map((option) => sanitizeProductionText(option, 200)),
    status: "PENDING",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolution: null,
  };
}

function normalizedFailureCause(summary: string): string {
  return sanitizeProductionText(summary, 1_000)
    .toLocaleLowerCase("pt-BR")
    .replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi, "<id>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

export function productionFailureFingerprint(input: {
  phaseNumber: number;
  agentId: string;
  errorCode?: string | null;
  summary: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        phaseNumber: input.phaseNumber,
        agentId: input.agentId,
        errorCode: input.errorCode ?? "AGENT_FAILED",
        cause: normalizedFailureCause(input.summary),
      }),
    )
    .digest("hex");
}

export function resetProductionCircuit(
  execution: ProductionExecution,
  phaseNumber: number,
  reason: string,
  at: string,
): void {
  const phase = execution.phases.find((item) => item.phaseNumber === phaseNumber);
  if (!phase) return;
  phase.circuit = {
    fingerprint: null,
    consecutiveCount: 0,
    firstOccurredAt: null,
    lastOccurredAt: null,
    resetReason: sanitizeProductionText(reason, 500),
  };
  execution.messages.push({
    id: randomUUID(),
    executionId: execution.id,
    phaseNumber,
    role: "SYSTEM",
    kind: "STATUS",
    content: sanitizeProductionText(`Circuito reiniciado: ${reason}`),
    requestId: null,
    createdAt: at,
  });
  execution.messages = execution.messages.slice(-500);
}

export function registerProductionFailure(
  execution: ProductionExecution,
  phaseNumber: number,
  errorCode: string | undefined,
  summary: string,
  at: string,
): { opened: boolean; fingerprint: string; count: number } {
  const phase = execution.phases.find((item) => item.phaseNumber === phaseNumber);
  if (!phase) throw new Error("PHASE_NOT_FOUND");
  const fingerprint = productionFailureFingerprint({
    phaseNumber,
    agentId: phase.resolvedAgent,
    errorCode,
    summary,
  });
  if (phase.circuit.fingerprint === fingerprint) {
    phase.circuit.consecutiveCount += 1;
    phase.circuit.lastOccurredAt = at;
  } else {
    phase.circuit = {
      fingerprint,
      consecutiveCount: 1,
      firstOccurredAt: at,
      lastOccurredAt: at,
      resetReason: null,
    };
  }
  return {
    opened: phase.circuit.consecutiveCount >= 3,
    fingerprint,
    count: phase.circuit.consecutiveCount,
  };
}

export function createCircuitIntervention(
  execution: ProductionExecution,
  phaseNumber: number,
  summary: string,
  count: number,
  at: string,
): ProductionIntervention {
  const requestId = randomUUID();
  return {
    id: randomUUID(),
    requestId,
    executionId: execution.id,
    phaseNumber,
    category: "DECISION",
    question: "A mesma falha ocorreu três vezes. Como deseja prosseguir?",
    intendedAction: "Revisar o contexto, responder com orientação ou trocar o agente da fase.",
    normalizedAction: "revisar contexto ou trocar agente",
    risk: sanitizeProductionText(`Circuit breaker aberto após ${count} ocorrências. Causa: ${summary}`, 2_000),
    options: ["Responder com orientação", "Trocar agente", "Manter bloqueado"],
    status: "PENDING",
    createdAt: at,
    resolvedAt: null,
    resolution: null,
  };
}

export function validateInteractionCommand(
  state: ProductionState,
  command: ProductionControlCommand,
  installedAgentIds: ReadonlySet<string> = new Set(),
): void {
  const execution = state.executions.find((item) => item.id === command.executionId);
  if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
  const phase = execution.phases.find((item) => item.phaseNumber === command.phaseNumber);
  if (["RESPOND", "AUTHORIZE", "DENY", "MESSAGE", "SWITCH_AGENT"].includes(command.type) && !phase) {
    throw new Error("INTERACTION_PHASE_NOT_FOUND");
  }
  if (["RESPOND", "AUTHORIZE", "DENY"].includes(command.type)) {
    const intervention = execution.interventions.find((item) => item.requestId === command.requestId);
    if (!intervention) throw new Error("INTERVENTION_NOT_FOUND");
    if (intervention.phaseNumber !== command.phaseNumber) throw new Error("INTERVENTION_PHASE_MISMATCH");
    if (intervention.status !== "PENDING") throw new Error("INTERVENTION_ALREADY_RESOLVED");
    if (command.type === "AUTHORIZE" && policyLevelForCategory(intervention.category) === "FORBIDDEN") {
      throw new Error("INTERVENTION_AUTHORIZATION_FORBIDDEN");
    }
  }
  if (command.type === "MESSAGE" && phase && !["RUNNING", "NEEDS_INPUT", "PENDING", "BLOCKED"].includes(phase.status)) {
    throw new Error("PHASE_IS_READ_ONLY");
  }
  if (command.type === "SWITCH_AGENT" && command.agentId) {
    if (!installedAgentIds.has(command.agentId)) throw new Error("AGENT_NOT_INSTALLED");
    if (!["nova", "echo"].includes(command.agentId) && phase?.kind === "EXECUTION") {
      throw new Error("AGENT_INCOMPATIBLE");
    }
  }
}
