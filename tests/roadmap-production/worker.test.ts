import { describe, expect, it } from "vitest";

import { scheduleAutomaticRecovery } from "@/lib/roadmap-production/worker";
import type { ProductionMessage } from "@/lib/roadmap-production/contracts";

const AUTO_RETRY_WARNING_THRESHOLD = 15;
const AUTO_RETRY_LIMIT = 30;

function buildExecution(autoRetryCount: number) {
  const timestamp = "2099-08-17T15:00:00.000Z";
  return {
    id: "objective:v1",
    objectiveId: "objective",
    objectiveCode: "RM-TEST",
    objectiveTitle: "Teste",
    moduleKey: "crm",
    developmentProvider: "claude" as const,
    sourceVersion: 1,
    globalPriority: 1,
    status: "RUNNING" as const,
    createdAt: timestamp,
    startedAt: timestamp,
    finishedAt: null,
    completionReportPath: null,
    completionReportMarkdown: null,
    reworkCount: 0,
    manualFeedback: [],
    messages: [] as ProductionMessage[],
    phases: [
      {
        phaseNumber: 1,
        title: "Implementar",
        kind: "EXECUTION" as const,
        requestedAgent: "dev",
        resolvedAgent: "nova",
        status: "FAILED" as const,
        attemptCount: autoRetryCount + 1,
        autoRetryCount,
        retryAt: null,
        startedAt: timestamp,
        finishedAt: timestamp,
        summary: "Falha transitória",
        errorCode: "NO_CHANGES_APPLIED" as const,
        changedFiles: [],
        reworkCount: 0,
        manualFeedback: [],
        activities: [],
      },
    ],
  };
}

describe("aviso de limiar do circuito de retry", () => {
  it("adiciona um aviso ao cruzar exatamente a metade do limite de correções automáticas", () => {
    const execution = buildExecution(AUTO_RETRY_WARNING_THRESHOLD - 1);
    const recovery = scheduleAutomaticRecovery(execution, 1, {
      success: false,
      summary: "Falha transitória",
      errorCode: "NO_CHANGES_APPLIED",
    });
    expect(recovery).toBe("SAME_PHASE");
    expect(execution.phases[0].autoRetryCount).toBe(
      AUTO_RETRY_WARNING_THRESHOLD,
    );
    const messages = execution.messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "SYSTEM",
      kind: "STATUS",
      phaseNumber: 1,
    });
    expect(messages[0].content).toContain(
      `${AUTO_RETRY_WARNING_THRESHOLD} de ${AUTO_RETRY_LIMIT}`,
    );
  });

  it("não repete o aviso em tentativas seguintes ao limiar", () => {
    const execution = buildExecution(AUTO_RETRY_WARNING_THRESHOLD);
    scheduleAutomaticRecovery(execution, 1, {
      success: false,
      summary: "Falha transitória",
      errorCode: "NO_CHANGES_APPLIED",
    });
    expect(execution.phases[0].autoRetryCount).toBe(
      AUTO_RETRY_WARNING_THRESHOLD + 1,
    );
    expect(execution.messages).toHaveLength(0);
  });

  it("não adiciona aviso antes de atingir o limiar", () => {
    const execution = buildExecution(1);
    scheduleAutomaticRecovery(execution, 1, {
      success: false,
      summary: "Falha transitória",
      errorCode: "NO_CHANGES_APPLIED",
    });
    expect(execution.phases[0].autoRetryCount).toBe(2);
    expect(execution.messages).toHaveLength(0);
  });
});
