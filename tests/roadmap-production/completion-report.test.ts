import { describe, expect, it } from "vitest";

import { buildCompletionReport } from "@/lib/roadmap-production/completion-report";

describe("relatório final da Produção", () => {
  it("gera o último arquivo com o que foi feito e como foi executado", () => {
    const timestamp = "2026-08-17T16:00:00.000Z";
    const report = buildCompletionReport({
      id: "objective:v1",
      objectiveId: "objective",
      objectiveCode: "RM-2026-TESTE",
      objectiveTitle: "Melhorar CRM",
      moduleKey: "crm",
      developmentProvider: "claude",
      sourceVersion: 1,
      globalPriority: 1,
      status: "SUCCEEDED",
      createdAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 1,
      manualFeedback: [
        {
          id: "1189691c-b39f-4e27-a64d-a111d080ab50",
          reportedAt: timestamp,
          content:
            "O estado vazio precisa explicar como criar o primeiro item.",
          improvedWithAi: true,
          resolvedAt: timestamp,
        },
      ],
      phases: [
        {
          phaseNumber: 0,
          title: "Implementar",
          kind: "EXECUTION",
          requestedAgent: "dev",
          resolvedAgent: "nova",
          status: "SUCCEEDED",
          attemptCount: 2,
          autoRetryCount: 0,
          retryAt: null,
          startedAt: timestamp,
          finishedAt: timestamp,
          summary: "Implementação corrigida.",
          errorCode: null,
          changedFiles: ["src/example.ts"],
          reworkCount: 0,
          manualFeedback: [],
          activities: [],
        },
      ],
    });
    expect(report.relativePath).toBe(
      "prompt-phases/roadmap-alpha/crm/rm-2026-teste/r0001/99-relatorio-conclusao.md",
    );
    expect(report.markdown).toContain("## O que foi feito");
    expect(report.markdown).toContain("## Como foi feito");
    expect(report.markdown).toContain("`src/example.ts`");
    expect(report.markdown).toContain(
      "## Correções solicitadas pelo administrador",
    );
    expect(report.markdown).toContain(
      "O estado vazio precisa explicar como criar o primeiro item.",
    );
    expect(report.markdown).toContain("Melhorado com IA: sim");
    expect(report.markdown).toContain("Claude (fallback Codex)");
  });
});
