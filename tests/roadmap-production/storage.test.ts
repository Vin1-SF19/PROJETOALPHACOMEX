import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  enqueueProductionControl,
  readObjectiveDevelopmentPreferences,
  readProductionConfig,
  readProductionState,
  writeProductionConfig,
  writeObjectiveDevelopmentProvider,
  writeProductionState,
} from "@/lib/roadmap-production/storage";
import {
  applyProductionControls,
  developmentProviderOrder,
  isImplementationPhase,
  phaseRequiresWrite,
  recoverCorrectableFailures,
  scheduleAutomaticRecovery,
  selectNextProductionExecution,
  shouldFallbackDevelopmentProvider,
} from "@/lib/roadmap-production/worker";

const roots: string[] = [];
async function root() {
  const value = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-production-"));
  roots.push(value);
  return value;
}
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((value) => fs.rm(value, { recursive: true, force: true })),
  );
});

describe("estado local de Produção", () => {
  it("prioriza Claude e troca somente em falhas de disponibilidade", () => {
    expect(developmentProviderOrder("claude")).toEqual(["claude", "codex"]);
    expect(developmentProviderOrder("codex")).toEqual(["codex", "claude"]);
    expect(shouldFallbackDevelopmentProvider("PROVIDER_QUOTA_EXHAUSTED")).toBe(
      true,
    );
    expect(shouldFallbackDevelopmentProvider("PROVIDER_AUTH_FAILED")).toBe(
      true,
    );
    expect(shouldFallbackDevelopmentProvider("AGENT_REPORTED_FAILURE")).toBe(
      false,
    );
  });
  it("não exige escrita de fases analíticas classificadas como execução", () => {
    expect(
      isImplementationPhase({ kind: "EXECUTION", requestedAgent: "scout" }),
    ).toBe(false);
    expect(
      isImplementationPhase({ kind: "EXECUTION", requestedAgent: "dev" }),
    ).toBe(true);
    expect(
      isImplementationPhase({ kind: "VERIFICATION", requestedAgent: "dev" }),
    ).toBe(false);
    expect(
      phaseRequiresWrite(
        {
          kind: "CLOSURE",
          requestedAgent: "scribe",
          resolvedAgent: "scribe",
          title: "Documentar entrega",
        },
        "Criar README.md",
      ),
    ).toBe(true);
    expect(
      phaseRequiresWrite(
        {
          kind: "CLOSURE",
          requestedAgent: "scribe",
          resolvedAgent: "scribe",
          title: "Resumir entrega",
        },
        "Somente relatar o resultado",
      ),
    ).toBe(false);
  });

  it("cria configuração padrão e persiste atualização", async () => {
    const project = await root();
    const initial = await readProductionConfig(project);
    expect(initial.provider).toBe("claude");
    expect(initial.model).toBe("default");
    const saved = await writeProductionConfig(
      {
        version: 1,
        provider: "ollama",
        model: "qwen3.8:27b",
        autoRun: false,
        maxToolSteps: 12,
      },
      project,
    );
    expect(saved.autoRun).toBe(false);
    expect((await readProductionConfig(project)).maxToolSteps).toBe(12);
  });

  it("persiste o cérebro escolhido por objetivo sem depender do banco", async () => {
    const project = await root();
    expect(
      (await readObjectiveDevelopmentPreferences(project)).objectives,
    ).toEqual({});
    await writeObjectiveDevelopmentProvider("objective-1", "codex", project);
    await writeObjectiveDevelopmentProvider("objective-2", "claude", project);
    expect(
      (await readObjectiveDevelopmentPreferences(project)).objectives,
    ).toEqual({ "objective-1": "codex", "objective-2": "claude" });
  });

  it("persiste estado validado de forma recuperável", async () => {
    const project = await root();
    const state = await readProductionState(project);
    await writeProductionState(state, project);
    expect((await readProductionState(project)).executions).toEqual([]);
  });

  it("pausa, retoma e exclui por comandos locais sem recriar a execução", async () => {
    const project = await root();
    const timestamp = new Date().toISOString();
    const execution = {
      id: "objective:v2",
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      sourceVersion: 2,
      globalPriority: 1,
      status: "PENDING" as const,
      createdAt: timestamp,
      startedAt: null,
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: [
        {
          phaseNumber: 0,
          title: "Contexto",
          kind: "CONTEXT",
          requestedAgent: "context",
          resolvedAgent: "scout",
          status: "PENDING" as const,
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
        },
      ],
    };
    await writeProductionState(
      {
        version: 1,
        updatedAt: timestamp,
        ignoredExecutionIds: [],
        executions: [execution],
      },
      project,
    );
    await enqueueProductionControl("PAUSE", execution.id, project);
    expect(await applyProductionControls(project)).toBe(1);
    expect((await readProductionState(project)).executions[0].status).toBe(
      "PAUSED",
    );
    await enqueueProductionControl("RESUME", execution.id, project);
    await applyProductionControls(project);
    expect((await readProductionState(project)).executions[0].status).toBe(
      "PENDING",
    );
    await enqueueProductionControl("EXCLUDE", execution.id, project);
    await applyProductionControls(project);
    const state = await readProductionState(project);
    expect(state.executions).toEqual([]);
    expect(state.ignoredExecutionIds).toContain(execution.id);
  });

  it("reenfileira o objetivo completo com o relato obrigatório", async () => {
    const project = await root();
    const timestamp = "2026-08-17T17:00:00.000Z";
    const phase = (phaseNumber: number) => ({
      phaseNumber,
      title: `Fase ${phaseNumber}`,
      kind: "EXECUTION",
      requestedAgent: "dev",
      resolvedAgent: "nova",
      status: "SUCCEEDED" as const,
      attemptCount: 1,
      autoRetryCount: 0,
      retryAt: null,
      startedAt: timestamp,
      finishedAt: timestamp,
      summary: "Concluída",
      errorCode: null,
      changedFiles: ["src/example.ts"],
      reworkCount: 0,
      manualFeedback: [],
      activities: [],
    });
    const execution = {
      id: "objective:v7",
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      sourceVersion: 7,
      globalPriority: 1,
      status: "SUCCEEDED" as const,
      createdAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      completionReportPath: "prompt-phases/report.md",
      completionReportMarkdown: "# Relatório antigo",
      reworkCount: 0,
      manualFeedback: [],
      phases: [phase(1), phase(2), phase(3)],
    };
    await writeProductionState(
      {
        version: 1,
        updatedAt: timestamp,
        ignoredExecutionIds: [],
        executions: [execution],
      },
      project,
    );
    await enqueueProductionControl("REPORT_ERROR", execution.id, project, {
      feedback: "O comportamento mobile ainda está incorreto.",
      improvedWithAi: true,
    });

    await applyProductionControls(project);
    const updated = (await readProductionState(project)).executions[0];
    expect(updated).toMatchObject({
      status: "PENDING",
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
    });
    expect(updated.reworkCount).toBe(1);
    expect(updated.manualFeedback[0]).toMatchObject({
      content: "O comportamento mobile ainda está incorreto.",
      improvedWithAi: true,
      resolvedAt: null,
    });
    expect(updated.phases[0].status).toBe("PENDING");
    expect(updated.phases[1].status).toBe("PENDING");
    expect(updated.phases[2].status).toBe("PENDING");
  });

  it("uma falha antiga não bloqueia a próxima revisão pendente", () => {
    const timestamp = new Date().toISOString();
    const pendingPhase = {
      phaseNumber: 0,
      title: "Contexto",
      kind: "CONTEXT",
      requestedAgent: "context",
      resolvedAgent: "scout",
      status: "PENDING" as const,
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
    };
    const base = {
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      globalPriority: 1,
      createdAt: timestamp,
      startedAt: null,
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: [pendingPhase],
    };
    const failed = {
      ...base,
      id: "objective:v2",
      sourceVersion: 2,
      status: "FAILED" as const,
    };
    const pending = {
      ...base,
      id: "objective:v3",
      sourceVersion: 3,
      status: "PENDING" as const,
    };
    expect(
      selectNextProductionExecution({
        version: 1,
        updatedAt: timestamp,
        ignoredExecutionIds: [],
        executions: [failed, pending],
      })?.id,
    ).toBe("objective:v3");
  });

  it("recoloca somente a fase falha na fila quando recebe retry", async () => {
    const project = await root();
    const timestamp = new Date().toISOString();
    const execution = {
      id: "objective:v3",
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      sourceVersion: 3,
      globalPriority: 1,
      status: "FAILED" as const,
      createdAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: [
        {
          phaseNumber: 1,
          title: "Analisar",
          kind: "EXECUTION",
          requestedAgent: "scout",
          resolvedAgent: "scout",
          status: "FAILED" as const,
          attemptCount: 1,
          autoRetryCount: 1,
          retryAt: null,
          startedAt: timestamp,
          finishedAt: timestamp,
          summary: "Análise pronta",
          errorCode: "NO_CHANGES_APPLIED",
          changedFiles: [],
          reworkCount: 0,
          manualFeedback: [],
          activities: [],
        },
      ],
    };
    await writeProductionState(
      {
        version: 1,
        updatedAt: timestamp,
        ignoredExecutionIds: [],
        executions: [execution],
      },
      project,
    );
    await enqueueProductionControl("RETRY", execution.id, project);
    await applyProductionControls(project);
    const retried = (await readProductionState(project)).executions[0];
    expect(retried.status).toBe("PENDING");
    expect(retried.phases[0]).toMatchObject({
      status: "PENDING",
      autoRetryCount: 0,
      retryAt: null,
      errorCode: null,
      finishedAt: null,
    });
  });

  it("devolve reprovação do Probe para a implementação e agenda nova verificação", () => {
    const timestamp = "2099-08-17T15:00:00.000Z";
    const phaseBase = {
      attemptCount: 1,
      autoRetryCount: 0,
      retryAt: null,
      startedAt: timestamp,
      finishedAt: timestamp,
      summary: null,
      errorCode: null,
      changedFiles: [],
      reworkCount: 0,
      manualFeedback: [],
      activities: [],
    };
    const execution = {
      id: "objective:v4",
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      sourceVersion: 4,
      globalPriority: 1,
      status: "RUNNING" as const,
      createdAt: timestamp,
      startedAt: timestamp,
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: [
        {
          ...phaseBase,
          phaseNumber: 2,
          title: "Implementar",
          kind: "EXECUTION",
          requestedAgent: "dev",
          resolvedAgent: "nova",
          status: "SUCCEEDED" as const,
          changedFiles: ["src/example.ts"],
        },
        {
          ...phaseBase,
          phaseNumber: 3,
          title: "Verificar",
          kind: "VERIFICATION",
          requestedAgent: "probe",
          resolvedAgent: "probe",
          status: "BLOCKED" as const,
        },
      ],
    };
    const recovery = scheduleAutomaticRecovery(
      execution,
      3,
      {
        success: false,
        summary: "Faltou implementar o estado vazio.",
        errorCode: "AGENT_BLOCKED",
      },
      timestamp,
    );
    expect(recovery).toBe("IMPLEMENTATION_FEEDBACK");
    expect(execution.status).toBe("PENDING");
    expect(execution.phases[0]).toMatchObject({
      status: "PENDING",
      errorCode: "VERIFICATION_FEEDBACK",
    });
    expect(execution.phases[0].summary).toContain(
      "Faltou implementar o estado vazio",
    );
    expect(execution.phases[1]).toMatchObject({
      status: "PENDING",
      autoRetryCount: 1,
    });
    expect(
      selectNextProductionExecution({
        version: 1,
        updatedAt: timestamp,
        ignoredExecutionIds: [],
        executions: [execution],
      }),
    ).toBeUndefined();
  });

  it("recupera uma implementação antiga bloqueada após corrigir o agente executor", () => {
    const timestamp = "2099-08-17T15:00:00.000Z";
    const execution = {
      id: "objective:v5",
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      sourceVersion: 5,
      globalPriority: 1,
      status: "BLOCKED" as const,
      createdAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: [
        {
          phaseNumber: 2,
          title: "Implementar background",
          kind: "EXECUTION",
          requestedAgent: "forge",
          resolvedAgent: "nova",
          status: "BLOCKED" as const,
          attemptCount: 2,
          autoRetryCount: 0,
          retryAt: null,
          startedAt: timestamp,
          finishedAt: timestamp,
          summary: "Implementação ausente",
          errorCode: "AGENT_BLOCKED",
          changedFiles: [],
          reworkCount: 0,
          manualFeedback: [],
          activities: [],
        },
      ],
    };
    const state = {
      version: 1 as const,
      updatedAt: timestamp,
      ignoredExecutionIds: [],
      executions: [execution],
    };
    expect(recoverCorrectableFailures(state, timestamp)).toBe(1);
    expect(execution).toMatchObject({ status: "PENDING", finishedAt: null });
    expect(execution.phases[0]).toMatchObject({
      status: "PENDING",
      autoRetryCount: 1,
    });
  });

  it("retoma o Scribe com escrita quando a documentação obrigatória foi bloqueada por read-only", () => {
    const timestamp = "2099-08-17T16:00:00.000Z";
    const execution = {
      id: "objective:v6",
      objectiveId: "objective",
      objectiveCode: "RM-TEST",
      objectiveTitle: "Teste",
      moduleKey: "crm",
      sourceVersion: 6,
      globalPriority: 1,
      status: "BLOCKED" as const,
      createdAt: timestamp,
      startedAt: timestamp,
      finishedAt: timestamp,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
      phases: [
        {
          phaseNumber: 6,
          title: "Documentar mudanças",
          kind: "CLOSURE",
          requestedAgent: "scribe",
          resolvedAgent: "scribe",
          status: "BLOCKED" as const,
          attemptCount: 2,
          autoRetryCount: 0,
          retryAt: null,
          startedAt: timestamp,
          finishedAt: timestamp,
          summary:
            "Criar README e CHANGELOG; bloqueado pelo modo somente leitura.",
          errorCode: "AGENT_BLOCKED",
          changedFiles: [],
          reworkCount: 0,
          manualFeedback: [],
          activities: [],
        },
      ],
    };
    const state = {
      version: 1 as const,
      updatedAt: timestamp,
      ignoredExecutionIds: [],
      executions: [execution],
    };
    expect(recoverCorrectableFailures(state, timestamp)).toBe(1);
    expect(execution).toMatchObject({ status: "PENDING", finishedAt: null });
    expect(execution.phases[0]).toMatchObject({
      status: "PENDING",
      autoRetryCount: 1,
    });
  });
});
