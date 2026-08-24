import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildCompletionReport,
  writeCompletionReport,
} from "@/lib/roadmap-production/completion-report";

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
    expect(report.markdown).toContain("Claude (fallback Qwen brokerizado)");
  });

  it("redige canários antes de gravar o relatório físico", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-report-secure-"));
    const timestamp = "2026-08-24T12:00:00.000Z";
    try {
      const report = await writeCompletionReport(
        {
          id: "secure:v1",
          objectiveId: "secure",
          objectiveCode: "RM-SECURE",
          objectiveTitle: "Relatório seguro",
          moduleKey: "roadmap",
          developmentProvider: "ollama",
          sourceVersion: 1,
          globalPriority: 1,
          status: "SUCCEEDED",
          createdAt: timestamp,
          startedAt: timestamp,
          finishedAt: timestamp,
          completionReportPath: null,
          completionReportMarkdown: null,
          reworkCount: 0,
          manualFeedback: [],
          interventions: [
            {
              id: "e605073a-0986-47d7-bcf7-c49be30e8024",
              requestId: "97718633-e232-4820-90cd-b4eae8866d38",
              executionId: "secure:v1",
              phaseNumber: 1,
              category: "DECISION",
              question: "Qual opção deve ser usada?",
              intendedAction: "Selecionar opção segura",
              normalizedAction: "selecionar opção segura",
              risk: "Baixo",
              options: ["Continuar"],
              status: "ANSWERED",
              createdAt: timestamp,
              resolvedAt: timestamp,
              resolution: {
                author: "Administrador",
                decision: "ANSWER",
                content: "AWS_SECRET_ACCESS_KEY=resolution-canary",
                createdAt: timestamp,
                authorizationAttempt: null,
                authorizationConsumedAt: null,
              },
            },
          ],
          phases: [
            {
              phaseNumber: 1,
              title: "Concluir",
              kind: "CLOSURE",
              requestedAgent: "scribe",
              resolvedAgent: "scribe",
              status: "SUCCEEDED",
              attemptCount: 1,
              autoRetryCount: 0,
              retryAt: null,
              startedAt: timestamp,
              finishedAt: timestamp,
              summary: "TURSO_AUTH_TOKEN=summary-canary",
              errorCode: null,
              changedFiles: [],
              reworkCount: 0,
              manualFeedback: [],
              activities: [
                {
                  at: timestamp,
                  agentId: "scribe",
                  type: "RESULT",
                  message: "TOKEN=activity-canary",
                },
              ],
            },
          ],
        },
        root,
      );
      const persisted = await fs.readFile(
        path.join(root, report.relativePath),
        "utf8",
      );
      expect(persisted).not.toContain("summary-canary");
      expect(persisted).not.toContain("activity-canary");
      expect(persisted).not.toContain("resolution-canary");
      expect(persisted).toContain("[REDACTED]");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
