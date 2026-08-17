import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { enqueueProductionControl, readProductionConfig, readProductionState, writeProductionConfig, writeProductionState } from "@/lib/roadmap-production/storage";
import { applyProductionControls, isImplementationPhase, phaseRequiresWrite, recoverCorrectableFailures, scheduleAutomaticRecovery, selectNextProductionExecution } from "@/lib/roadmap-production/worker";

const roots: string[] = [];
async function root() { const value = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-production-")); roots.push(value); return value; }
afterEach(async () => { await Promise.all(roots.splice(0).map((value) => fs.rm(value, { recursive: true, force: true }))); });

describe("estado local de Produção", () => {
  it("não exige escrita de fases analíticas classificadas como execução", () => {
    expect(isImplementationPhase({ kind: "EXECUTION", requestedAgent: "scout" })).toBe(false);
    expect(isImplementationPhase({ kind: "EXECUTION", requestedAgent: "dev" })).toBe(true);
    expect(isImplementationPhase({ kind: "VERIFICATION", requestedAgent: "dev" })).toBe(false);
    expect(phaseRequiresWrite({ kind: "CLOSURE", requestedAgent: "scribe", resolvedAgent: "scribe", title: "Documentar entrega" }, "Criar README.md")).toBe(true);
    expect(phaseRequiresWrite({ kind: "CLOSURE", requestedAgent: "scribe", resolvedAgent: "scribe", title: "Resumir entrega" }, "Somente relatar o resultado")).toBe(false);
  });

  it("cria configuração padrão e persiste atualização", async () => {
    const project = await root();
    const initial = await readProductionConfig(project);
    expect(initial.provider).toBe("ollama");
    const saved = await writeProductionConfig({ version: 1, provider: "ollama", model: "qwen3.8:27b", autoRun: false, maxToolSteps: 12 }, project);
    expect(saved.autoRun).toBe(false);
    expect((await readProductionConfig(project)).maxToolSteps).toBe(12);
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
      id: "objective:v2", objectiveId: "objective", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm",
      sourceVersion: 2, globalPriority: 1, status: "PENDING" as const, createdAt: timestamp, startedAt: null, finishedAt: null,
      phases: [{ phaseNumber: 0, title: "Contexto", kind: "CONTEXT", requestedAgent: "context", resolvedAgent: "scout", status: "PENDING" as const, attemptCount: 0, autoRetryCount: 0, retryAt: null, startedAt: null, finishedAt: null, summary: null, errorCode: null, changedFiles: [], activities: [] }],
    };
    await writeProductionState({ version: 1, updatedAt: timestamp, ignoredExecutionIds: [], executions: [execution] }, project);
    await enqueueProductionControl("PAUSE", execution.id, project);
    expect(await applyProductionControls(project)).toBe(1);
    expect((await readProductionState(project)).executions[0].status).toBe("PAUSED");
    await enqueueProductionControl("RESUME", execution.id, project);
    await applyProductionControls(project);
    expect((await readProductionState(project)).executions[0].status).toBe("PENDING");
    await enqueueProductionControl("EXCLUDE", execution.id, project);
    await applyProductionControls(project);
    const state = await readProductionState(project);
    expect(state.executions).toEqual([]);
    expect(state.ignoredExecutionIds).toContain(execution.id);
  });

  it("uma falha antiga não bloqueia a próxima revisão pendente", () => {
    const timestamp = new Date().toISOString();
    const pendingPhase = { phaseNumber: 0, title: "Contexto", kind: "CONTEXT", requestedAgent: "context", resolvedAgent: "scout", status: "PENDING" as const, attemptCount: 0, autoRetryCount: 0, retryAt: null, startedAt: null, finishedAt: null, summary: null, errorCode: null, changedFiles: [], activities: [] };
    const base = { objectiveId: "objective", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm", globalPriority: 1, createdAt: timestamp, startedAt: null, finishedAt: null, phases: [pendingPhase] };
    const failed = { ...base, id: "objective:v2", sourceVersion: 2, status: "FAILED" as const };
    const pending = { ...base, id: "objective:v3", sourceVersion: 3, status: "PENDING" as const };
    expect(selectNextProductionExecution({ version: 1, updatedAt: timestamp, ignoredExecutionIds: [], executions: [failed, pending] })?.id).toBe("objective:v3");
  });

  it("recoloca somente a fase falha na fila quando recebe retry", async () => {
    const project = await root();
    const timestamp = new Date().toISOString();
    const execution = {
      id: "objective:v3", objectiveId: "objective", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm",
      sourceVersion: 3, globalPriority: 1, status: "FAILED" as const, createdAt: timestamp, startedAt: timestamp, finishedAt: timestamp,
      phases: [{ phaseNumber: 1, title: "Analisar", kind: "EXECUTION", requestedAgent: "scout", resolvedAgent: "scout", status: "FAILED" as const, attemptCount: 1, autoRetryCount: 1, retryAt: null, startedAt: timestamp, finishedAt: timestamp, summary: "Análise pronta", errorCode: "NO_CHANGES_APPLIED", changedFiles: [], activities: [] }],
    };
    await writeProductionState({ version: 1, updatedAt: timestamp, ignoredExecutionIds: [], executions: [execution] }, project);
    await enqueueProductionControl("RETRY", execution.id, project);
    await applyProductionControls(project);
    const retried = (await readProductionState(project)).executions[0];
    expect(retried.status).toBe("PENDING");
    expect(retried.phases[0]).toMatchObject({ status: "PENDING", autoRetryCount: 0, retryAt: null, errorCode: null, finishedAt: null });
  });

  it("devolve reprovação do Probe para a implementação e agenda nova verificação", () => {
    const timestamp = "2099-08-17T15:00:00.000Z";
    const phaseBase = { attemptCount: 1, autoRetryCount: 0, retryAt: null, startedAt: timestamp, finishedAt: timestamp, summary: null, errorCode: null, changedFiles: [], activities: [] };
    const execution = {
      id: "objective:v4", objectiveId: "objective", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm",
      sourceVersion: 4, globalPriority: 1, status: "RUNNING" as const, createdAt: timestamp, startedAt: timestamp, finishedAt: null,
      phases: [
        { ...phaseBase, phaseNumber: 2, title: "Implementar", kind: "EXECUTION", requestedAgent: "dev", resolvedAgent: "nova", status: "SUCCEEDED" as const, changedFiles: ["src/example.ts"] },
        { ...phaseBase, phaseNumber: 3, title: "Verificar", kind: "VERIFICATION", requestedAgent: "probe", resolvedAgent: "probe", status: "BLOCKED" as const },
      ],
    };
    const recovery = scheduleAutomaticRecovery(execution, 3, { success: false, summary: "Faltou implementar o estado vazio.", errorCode: "AGENT_BLOCKED" }, timestamp);
    expect(recovery).toBe("IMPLEMENTATION_FEEDBACK");
    expect(execution.status).toBe("PENDING");
    expect(execution.phases[0]).toMatchObject({ status: "PENDING", errorCode: "VERIFICATION_FEEDBACK" });
    expect(execution.phases[0].summary).toContain("Faltou implementar o estado vazio");
    expect(execution.phases[1]).toMatchObject({ status: "PENDING", autoRetryCount: 1 });
    expect(selectNextProductionExecution({ version: 1, updatedAt: timestamp, ignoredExecutionIds: [], executions: [execution] })).toBeUndefined();
  });

  it("recupera uma implementação antiga bloqueada após corrigir o agente executor", () => {
    const timestamp = "2099-08-17T15:00:00.000Z";
    const execution = {
      id: "objective:v5", objectiveId: "objective", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm",
      sourceVersion: 5, globalPriority: 1, status: "BLOCKED" as const, createdAt: timestamp, startedAt: timestamp, finishedAt: timestamp,
      phases: [{ phaseNumber: 2, title: "Implementar background", kind: "EXECUTION", requestedAgent: "forge", resolvedAgent: "nova", status: "BLOCKED" as const, attemptCount: 2, autoRetryCount: 0, retryAt: null, startedAt: timestamp, finishedAt: timestamp, summary: "Implementação ausente", errorCode: "AGENT_BLOCKED", changedFiles: [], activities: [] }],
    };
    const state = { version: 1 as const, updatedAt: timestamp, ignoredExecutionIds: [], executions: [execution] };
    expect(recoverCorrectableFailures(state, timestamp)).toBe(1);
    expect(execution).toMatchObject({ status: "PENDING", finishedAt: null });
    expect(execution.phases[0]).toMatchObject({ status: "PENDING", autoRetryCount: 1 });
  });

  it("retoma o Scribe com escrita quando a documentação obrigatória foi bloqueada por read-only", () => {
    const timestamp = "2099-08-17T16:00:00.000Z";
    const execution = {
      id: "objective:v6", objectiveId: "objective", objectiveCode: "RM-TEST", objectiveTitle: "Teste", moduleKey: "crm",
      sourceVersion: 6, globalPriority: 1, status: "BLOCKED" as const, createdAt: timestamp, startedAt: timestamp, finishedAt: timestamp,
      phases: [{ phaseNumber: 6, title: "Documentar mudanças", kind: "CLOSURE", requestedAgent: "scribe", resolvedAgent: "scribe", status: "BLOCKED" as const, attemptCount: 2, autoRetryCount: 0, retryAt: null, startedAt: timestamp, finishedAt: timestamp, summary: "Criar README e CHANGELOG; bloqueado pelo modo somente leitura.", errorCode: "AGENT_BLOCKED", changedFiles: [], activities: [] }],
    };
    const state = { version: 1 as const, updatedAt: timestamp, ignoredExecutionIds: [], executions: [execution] };
    expect(recoverCorrectableFailures(state, timestamp)).toBe(1);
    expect(execution).toMatchObject({ status: "PENDING", finishedAt: null });
    expect(execution.phases[0]).toMatchObject({ status: "PENDING", autoRetryCount: 1 });
  });
});
