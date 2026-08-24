import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  enqueueProductionControl,
  productionStateDirectory,
  readObjectiveDevelopmentPreferences,
  readProductionConfig,
  readProductionControls,
  readProductionState,
  writeProductionConfig,
  writeObjectiveDevelopmentProvider,
  writeProductionState,
} from "@/lib/roadmap-production/storage";
import {
  applyProductionControls,
  developmentProviderOrder,
  isImplementationPhase,
  nextBrokeredCapabilityAgent,
  phaseRequiresWrite,
  recoverCorrectableFailures,
  resolveDeliveryAdjustmentAgent,
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
  const staleRoots = roots.splice(0);
  await Promise.all(
    staleRoots.flatMap((value) => [
      fs.rm(value, { recursive: true, force: true }),
      fs.rm(productionStateDirectory(value), { recursive: true, force: true }),
    ]),
  );
});

describe("estado local de Produção", () => {
  it("mantém o control plane fora do workspace do agente", async () => {
    const project = await root();
    const stateDirectory = productionStateDirectory(project);
    expect(path.relative(project, stateDirectory).startsWith("..")).toBe(true);
    expect(stateDirectory).not.toContain(
      `${path.sep}.roadmap-production`,
    );
  });

  it("importa o estado legado validado uma única vez e não executa controls legados", async () => {
    const project = await root();
    const legacyDirectory = path.join(project, ".roadmap-production");
    await fs.mkdir(path.join(legacyDirectory, "commands"), { recursive: true });
    await fs.writeFile(
      path.join(legacyDirectory, "state.json"),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-08-24T12:00:00.000Z",
        ignoredExecutionIds: ["legacy:v1"],
        executions: [],
      }),
      "utf8",
    );
    await fs.writeFile(
      path.join(legacyDirectory, "commands", "legacy.json"),
      JSON.stringify({
        id: "8ffca73d-9224-4a67-a2af-ad99658ee20f",
        type: "EXCLUDE",
        executionId: "legacy:v1",
        phaseNumber: null,
        feedback: null,
        improvedWithAi: false,
        requestId: null,
        content: null,
        agentId: null,
        acceptedPhaseStatus: null,
        author: "workspace agent",
        createdAt: "2026-08-24T12:00:00.000Z",
      }),
      "utf8",
    );

    expect((await readProductionState(project)).ignoredExecutionIds).toEqual([
      "legacy:v1",
    ]);
    expect(await readProductionControls(project)).toEqual([]);
    await fs.writeFile(
      path.join(legacyDirectory, "state.json"),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-08-24T12:01:00.000Z",
        ignoredExecutionIds: ["tampered:v2"],
        executions: [],
      }),
      "utf8",
    );
    expect((await readProductionState(project)).ignoredExecutionIds).toEqual([
      "legacy:v1",
    ]);
  });

  it("falha fechado e não volta ao legado após encontrar JSON corrompido", async () => {
    const project = await root();
    const legacyDirectory = path.join(project, ".roadmap-production");
    await fs.mkdir(legacyDirectory, { recursive: true });
    await fs.writeFile(path.join(legacyDirectory, "state.json"), "{invalid", "utf8");
    await expect(readProductionState(project)).rejects.toThrow(
      "INVALID_LEGACY_STATE_JSON",
    );
    await fs.writeFile(
      path.join(legacyDirectory, "state.json"),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-08-24T12:00:00.000Z",
        ignoredExecutionIds: [],
        executions: [],
      }),
      "utf8",
    );
    await expect(readProductionState(project)).rejects.toThrow(
      "INVALID_LEGACY_STATE_JSON",
    );
  });
  it("promove uma fase read-only quando o diagnóstico encontra lacuna de entrega", () => {
    expect(
      resolveDeliveryAdjustmentAgent(
        {
          kind: "EXECUTION",
          requestedAgent: "scout",
          resolvedAgent: "scout",
          title: "Preparar diagnóstico em Markdown",
        },
        [
          "AUTO_ADJUSTMENT_REQUIRED: não existe visualizador para o diagnóstico",
        ],
        "Integrar o resultado à interface do sistema.",
      ),
    ).toBe("nova");
  });

  it("prioriza Claude e troca somente em falhas de disponibilidade", () => {
    expect(developmentProviderOrder("claude")).toEqual(["ollama"]);
    expect(developmentProviderOrder("codex")).toEqual(["ollama"]);
    expect(shouldFallbackDevelopmentProvider("PROVIDER_QUOTA_EXHAUSTED")).toBe(
      true,
    );
    expect(shouldFallbackDevelopmentProvider("PROVIDER_AUTH_FAILED")).toBe(
      true,
    );
    expect(shouldFallbackDevelopmentProvider("AGENT_REPORTED_FAILURE")).toBe(
      false,
    );
    expect(
      nextBrokeredCapabilityAgent(
        "scout",
        "CAPABILITY_ESCALATION_REQUIRED: BACKEND — criar rota",
      ),
    ).toBe("echo");
    expect(
      nextBrokeredCapabilityAgent(
        "echo",
        "CAPABILITY_ESCALATION_REQUIRED: FRONTEND — criar painel",
      ),
    ).toBe("nova");
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
    await writeObjectiveDevelopmentProvider("objective-1", "claude", project);
    expect(
      (await readObjectiveDevelopmentPreferences(project)).objectives,
    ).toEqual({ "objective-1": "claude", "objective-2": "claude" });
  });

  it("persiste estado validado de forma recuperável", async () => {
    const project = await root();
    const state = await readProductionState(project);
    await writeProductionState(state, project);
    expect((await readProductionState(project)).executions).toEqual([]);
  });

  it("redige segredos em summaries, errors, activities e messages no boundary", async () => {
    const project = await root();
    const timestamp = "2026-08-24T12:00:00.000Z";
    await writeProductionState(
      {
        version: 1,
        updatedAt: timestamp,
        ignoredExecutionIds: [],
        executions: [
          {
            id: "secure:v1",
            objectiveId: "secure",
            objectiveCode: "RM-SEC",
            objectiveTitle: "Segurança",
            moduleKey: "roadmap",
            developmentProvider: "codex",
            sourceVersion: 1,
            globalPriority: 1,
            status: "FAILED",
            createdAt: timestamp,
            startedAt: timestamp,
            finishedAt: timestamp,
            completionReportPath: null,
            completionReportMarkdown:
              "relatório https://example.test/cb?access_token=report-secret",
            reworkCount: 0,
            manualFeedback: [],
            messages: [
              {
                id: "23b1ea41-610e-4daf-8b89-5980c48869cc",
                executionId: "secure:v1",
                phaseNumber: 1,
                role: "SYSTEM",
                kind: "STATUS",
                content: "TURSO_AUTH_TOKEN=turso-secret",
                requestId: null,
                createdAt: timestamp,
              },
            ],
            interventions: [],
            phases: [
              {
                phaseNumber: 1,
                title: "Executar",
                kind: "EXECUTION",
                requestedAgent: "echo",
                resolvedAgent: "echo",
                status: "FAILED",
                attemptCount: 1,
                autoRetryCount: 0,
                retryAt: null,
                startedAt: timestamp,
                finishedAt: timestamp,
                summary: "AWS_SECRET_ACCESS_KEY=aws-secret",
                errorCode: "TOKEN=error-secret",
                changedFiles: [],
                reworkCount: 0,
                manualFeedback: [],
                activities: [
                  {
                    at: timestamp,
                    agentId: "echo",
                    type: "ERROR",
                    message: "falhou?api_key=activity-secret",
                  },
                ],
              },
            ],
          },
        ],
      },
      project,
    );
    const raw = await fs.readFile(
      path.join(productionStateDirectory(project), "state.json"),
      "utf8",
    );
    expect(raw).not.toContain("turso-secret");
    expect(raw).not.toContain("aws-secret");
    expect(raw).not.toContain("error-secret");
    expect(raw).not.toContain("activity-secret");
    expect(raw).not.toContain("report-secret");
    expect(raw).toContain("[REDACTED]");
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
      developmentProvider: "claude" as const,
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
      developmentProvider: "claude" as const,
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
      developmentProvider: "claude" as const,
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

  it("mantém o objetivo iniciado como exclusivo durante a autocorreção", () => {
    const timestamp = new Date().toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const phase = {
      phaseNumber: 1,
      title: "Implementar",
      kind: "EXECUTION",
      requestedAgent: "dev",
      resolvedAgent: "nova",
      status: "PENDING" as const,
      attemptCount: 1,
      autoRetryCount: 1,
      retryAt: future,
      startedAt: timestamp,
      finishedAt: null,
      summary: "Aguardando autocorreção",
      errorCode: "NO_CHANGES_APPLIED",
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
      developmentProvider: "claude" as const,
      sourceVersion: 1,
      createdAt: timestamp,
      finishedAt: null,
      completionReportPath: null,
      completionReportMarkdown: null,
      reworkCount: 0,
      manualFeedback: [],
    };
    const active = {
      ...base,
      id: "objective:v1",
      globalPriority: 1,
      status: "PENDING" as const,
      startedAt: timestamp,
      phases: [phase],
    };
    const next = {
      ...base,
      id: "objective-2:v1",
      objectiveId: "objective-2",
      globalPriority: 2,
      status: "PENDING" as const,
      startedAt: null,
      phases: [{ ...phase, retryAt: null, startedAt: null }],
    };
    const state = {
      version: 1 as const,
      updatedAt: timestamp,
      ignoredExecutionIds: [],
      executions: [active, next],
    };

    expect(selectNextProductionExecution(state)).toBeUndefined();
    const readyActive = {
      ...active,
      phases: [{ ...phase, retryAt: null }],
    };
    expect(
      selectNextProductionExecution({
        ...state,
        executions: [readyActive, next],
      })?.id,
    ).toBe(active.id);
    const runningActive = {
      ...active,
      status: "RUNNING" as const,
      phases: [{ ...phase, status: "RUNNING" as const, retryAt: null }],
    };
    expect(
      selectNextProductionExecution({
        ...state,
        executions: [runningActive, next],
      }),
    ).toBeUndefined();
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
      developmentProvider: "claude" as const,
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
      developmentProvider: "claude" as const,
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
      developmentProvider: "claude" as const,
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
      developmentProvider: "claude" as const,
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
