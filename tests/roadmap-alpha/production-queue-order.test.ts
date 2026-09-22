import { describe, expect, it } from "vitest";

import { findRoadmapRunStartBlocker } from "@/lib/roadmap-production-api/status-machine";
import { canTransitionRoadmapRun } from "@/lib/roadmap-production-api/status-machine";

const base = {
  objectiveCode: "RM-2026-SEGUNDO",
  previousPhaseNumbers: [] as number[],
  previousRuns: [] as Array<{ phaseNumber: number; status: string }>,
  earlierObjective: null,
  runningRun: null,
};

describe("Roadmap Production - fluxo sequencial fail-closed", () => {
  it("pausa a próxima fase quando a anterior falhou", () => {
    const blocker = findRoadmapRunStartBlocker({
      ...base,
      previousPhaseNumbers: [1],
      previousRuns: [{ phaseNumber: 1, status: "FAILED" }],
    });

    expect(blocker?.code).toBe("PRODUCTION_PHASE_DEPENDENCY_PENDING");
    expect(blocker?.message).toContain("fase 1");
    expect(blocker?.message).toContain("FAILED");
  });

  it("pausa o próximo objetivo enquanto o prioritário não foi resolvido", () => {
    const blocker = findRoadmapRunStartBlocker({
      ...base,
      earlierObjective: {
        code: "RM-2026-PRIMEIRO",
        title: "Primeiro objetivo da mesclagem",
      },
    });

    expect(blocker?.code).toBe("PRODUCTION_QUEUE_BLOCKED_BY_EARLIER_OBJECTIVE");
    expect(blocker?.message).toContain("RM-2026-PRIMEIRO");
  });

  it("não inicia outro objetivo enquanto já existe uma fase em desenvolvimento", () => {
    const blocker = findRoadmapRunStartBlocker({
      ...base,
      runningRun: { objectiveCode: "RM-2026-PRIMEIRO", phaseNumber: 2 },
    });

    expect(blocker?.code).toBe("PRODUCTION_QUEUE_ALREADY_RUNNING");
  });

  it("libera a fase seguinte somente depois de todas as anteriores concluírem", () => {
    const blocker = findRoadmapRunStartBlocker({
      ...base,
      previousPhaseNumbers: [1, 2],
      previousRuns: [
        { phaseNumber: 1, status: "SUCCEEDED" },
        { phaseNumber: 2, status: "SUCCEEDED" },
      ],
    });

    expect(blocker).toBeNull();
  });

  it("trata fase anterior ainda não criada como dependência pendente", () => {
    const blocker = findRoadmapRunStartBlocker({
      ...base,
      previousPhaseNumbers: [1],
    });

    expect(blocker?.code).toBe("PRODUCTION_PHASE_DEPENDENCY_PENDING");
    expect(blocker?.message).toContain("NÃO INICIADA");
  });

  it("permite reabrir a própria fase com falha, sem considerar a falha concluída", () => {
    expect(canTransitionRoadmapRun("FAILED", "PENDING")).toBe(true);
    expect(canTransitionRoadmapRun("FAILED", "SUCCEEDED")).toBe(false);
  });
});
