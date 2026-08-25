import { describe, expect, it } from "vitest";

import {
  inheritPhaseProgress,
  type InheritablePhaseArtifact,
} from "@/lib/roadmap-production/worker";

const AT = "2099-08-25T10:00:00.000Z";

function buildPreviousPhase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    phaseNumber: overrides.phaseNumber as number,
    title: (overrides.title as string) ?? "Fase",
    kind: "EXECUTION",
    requestedAgent: "dev",
    resolvedAgent: "nova",
    status: (overrides.status as string) ?? "SUCCEEDED",
    attemptCount: (overrides.attemptCount as number) ?? 1,
    autoRetryCount: 0,
    retryAt: null,
    startedAt: AT,
    finishedAt: AT,
    summary: (overrides.summary as string) ?? "Resumo anterior",
    errorCode: (overrides.errorCode as string | null) ?? null,
    changedFiles: (overrides.changedFiles as string[]) ?? ["src/foo.ts"],
    reworkCount: 0,
    manualFeedback: [],
    activities: [],
    ...overrides,
  } as never;
}

function buildArtifact(
  phaseNumber: number,
  sha256: string,
  title = "Fase",
): InheritablePhaseArtifact {
  return {
    phaseNumber,
    title,
    kind: "EXECUTION",
    agent: "nova",
    contentMarkdown: `conteúdo da fase ${phaseNumber}`,
    sha256,
  };
}

describe("inheritPhaseProgress", () => {
  it("herda fase cujo sha256 bate e a anterior estava SUCCEEDED", () => {
    const previousPhases = [
      buildPreviousPhase({ phaseNumber: 0, status: "SUCCEEDED", summary: "ok" }),
    ];
    const previousArtifactsByPhase = new Map([[0, "hash-a"]]);
    const newArtifacts = [buildArtifact(0, "hash-a")];

    const result = inheritPhaseProgress(
      previousPhases,
      previousArtifactsByPhase,
      newArtifacts,
      2,
      AT,
    );

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("SUCCEEDED");
    expect(result[0].summary).toBe("ok");
    expect(result[0].changedFiles).toEqual(["src/foo.ts"]);
    expect(result[0].activities).toHaveLength(1);
    expect(result[0].activities[0].message).toContain("herdado da versão anterior (v2)");
  });

  it("não herda quando o sha256 muda (conteúdo da fase foi revisado)", () => {
    const previousPhases = [
      buildPreviousPhase({ phaseNumber: 0, status: "SUCCEEDED" }),
    ];
    const previousArtifactsByPhase = new Map([[0, "hash-a"]]);
    const newArtifacts = [buildArtifact(0, "hash-b")];

    const result = inheritPhaseProgress(
      previousPhases,
      previousArtifactsByPhase,
      newArtifacts,
      2,
      AT,
    );

    expect(result[0].status).toBe("PENDING");
    expect(result[0].summary).toBeNull();
    expect(result[0].activities).toHaveLength(0);
  });

  it("não herda quando a fase anterior não estava SUCCEEDED", () => {
    const previousPhases = [
      buildPreviousPhase({ phaseNumber: 0, status: "BLOCKED" }),
    ];
    const previousArtifactsByPhase = new Map([[0, "hash-a"]]);
    const newArtifacts = [buildArtifact(0, "hash-a")];

    const result = inheritPhaseProgress(
      previousPhases,
      previousArtifactsByPhase,
      newArtifacts,
      2,
      AT,
    );

    expect(result[0].status).toBe("PENDING");
  });

  it("efeito cascata: fase 2 não herda se a fase 0 (anterior) não herdou, mesmo com sha256 idêntico", () => {
    const previousPhases = [
      buildPreviousPhase({ phaseNumber: 0, status: "SUCCEEDED" }),
      buildPreviousPhase({ phaseNumber: 1, status: "SUCCEEDED" }),
    ];
    const previousArtifactsByPhase = new Map([
      [0, "hash-a"],
      [1, "hash-b"],
    ]);
    const newArtifacts = [
      buildArtifact(0, "hash-a-MUDOU"),
      buildArtifact(1, "hash-b"),
    ];

    const result = inheritPhaseProgress(
      previousPhases,
      previousArtifactsByPhase,
      newArtifacts,
      2,
      AT,
    );

    expect(result[0].status).toBe("PENDING");
    expect(result[1].status).toBe("PENDING");
  });

  it("fase nova sem correspondente na versão anterior nasce PENDING e quebra a cadeia para as seguintes", () => {
    const previousPhases = [
      buildPreviousPhase({ phaseNumber: 0, status: "SUCCEEDED" }),
    ];
    const previousArtifactsByPhase = new Map([[0, "hash-a"]]);
    const newArtifacts = [
      buildArtifact(0, "hash-a"),
      buildArtifact(1, "hash-nova"),
      buildArtifact(2, "hash-c"),
    ];

    const result = inheritPhaseProgress(
      previousPhases,
      previousArtifactsByPhase,
      newArtifacts,
      2,
      AT,
    );

    expect(result[0].status).toBe("SUCCEEDED");
    expect(result[1].status).toBe("PENDING");
    expect(result[2].status).toBe("PENDING");
  });

  it("sem execução anterior alguma (map vazio, previousPhases vazio) tudo nasce PENDING", () => {
    const result = inheritPhaseProgress(
      [],
      new Map(),
      [buildArtifact(0, "hash-a"), buildArtifact(1, "hash-b")],
      1,
      AT,
    );

    expect(result.every((phase) => phase.status === "PENDING")).toBe(true);
    expect(result.every((phase) => phase.activities.length === 0)).toBe(true);
  });

  it("campos de execução (activities, autoRetryCount, errorCode, datas) sempre resetam mesmo quando herdado", () => {
    const previousPhases = [
      buildPreviousPhase({
        phaseNumber: 0,
        status: "SUCCEEDED",
        attemptCount: 5,
      }),
    ];
    const previousArtifactsByPhase = new Map([[0, "hash-a"]]);
    const newArtifacts = [buildArtifact(0, "hash-a")];

    const result = inheritPhaseProgress(
      previousPhases,
      previousArtifactsByPhase,
      newArtifacts,
      3,
      AT,
    );

    expect(result[0].attemptCount).toBe(5);
    expect(result[0].autoRetryCount).toBe(0);
    expect(result[0].retryAt).toBeNull();
    expect(result[0].errorCode).toBeNull();
    expect(result[0].startedAt).toBeNull();
    expect(result[0].finishedAt).toBeNull();
    expect(result[0].activities).toHaveLength(1);
  });
});
