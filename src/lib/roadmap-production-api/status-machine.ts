export const ROADMAP_RUN_STATUSES = [
  "PENDING",
  "AWAITING_APPROVAL",
  "IN_PROGRESS",
  "NEEDS_INPUT",
  "BLOCKED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type RoadmapRunStatus = (typeof ROADMAP_RUN_STATUSES)[number];

export interface RoadmapRunStartContext {
  objectiveCode: string;
  previousPhaseNumbers: number[];
  previousRuns: Array<{ phaseNumber: number; status: string }>;
  earlierObjective: { code: string; title: string } | null;
  runningRun: { objectiveCode: string; phaseNumber: number } | null;
}

export interface RoadmapRunStartBlocker {
  code:
    | "PRODUCTION_QUEUE_ALREADY_RUNNING"
    | "PRODUCTION_PHASE_DEPENDENCY_PENDING"
    | "PRODUCTION_QUEUE_BLOCKED_BY_EARLIER_OBJECTIVE";
  message: string;
}

/**
 * Política fail-closed da fila de desenvolvimento. Uma falha não equivale a
 * conclusão: fases seguintes e objetivos de prioridade menor permanecem
 * parados até o ponto com erro ser retomado e concluído com sucesso.
 */
export function findRoadmapRunStartBlocker(
  context: RoadmapRunStartContext,
): RoadmapRunStartBlocker | null {
  if (context.runningRun) {
    return {
      code: "PRODUCTION_QUEUE_ALREADY_RUNNING",
      message: `Fluxo pausado: ${context.runningRun.objectiveCode}, fase ${context.runningRun.phaseNumber}, já está em desenvolvimento.`,
    };
  }

  const runByPhase = new Map(
    context.previousRuns.map((run) => [run.phaseNumber, run]),
  );
  const pendingDependency = [...context.previousPhaseNumbers]
    .sort((a, b) => a - b)
    .find((phaseNumber) => runByPhase.get(phaseNumber)?.status !== "SUCCEEDED");
  if (pendingDependency !== undefined) {
    const status = runByPhase.get(pendingDependency)?.status ?? "NÃO INICIADA";
    return {
      code: "PRODUCTION_PHASE_DEPENDENCY_PENDING",
      message: `Fluxo pausado: a fase ${pendingDependency} de ${context.objectiveCode} está ${status} e precisa ser concluída com sucesso antes da próxima fase.`,
    };
  }

  if (context.earlierObjective) {
    return {
      code: "PRODUCTION_QUEUE_BLOCKED_BY_EARLIER_OBJECTIVE",
      message: `Fluxo pausado no objetivo prioritário ${context.earlierObjective.code} (${context.earlierObjective.title}). Resolva-o antes de iniciar o próximo objetivo.`,
    };
  }

  return null;
}

const TRANSITIONS: Record<RoadmapRunStatus, RoadmapRunStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  AWAITING_APPROVAL: ["PENDING", "CANCELLED"],
  IN_PROGRESS: ["SUCCEEDED", "FAILED", "NEEDS_INPUT", "BLOCKED", "CANCELLED"],
  NEEDS_INPUT: ["IN_PROGRESS", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: ["PENDING"],
  CANCELLED: [],
};

export function isValidRoadmapRunStatus(
  value: string,
): value is RoadmapRunStatus {
  return (ROADMAP_RUN_STATUSES as readonly string[]).includes(value);
}

export function canTransitionRoadmapRun(
  from: RoadmapRunStatus,
  to: RoadmapRunStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function assertRoadmapRunTransition(
  from: RoadmapRunStatus,
  to: RoadmapRunStatus,
): void {
  if (!canTransitionRoadmapRun(from, to)) {
    throw new Error(`INVALID_TRANSITION:${from}->${to}`);
  }
}
