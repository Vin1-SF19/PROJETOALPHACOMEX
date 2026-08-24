import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  productionControlCommandSchema,
  productionStateSchema,
} from "@/lib/roadmap-production/contracts";
import {
  assertNoQueuedInterventionResponse,
  parseNeedsInputResult,
  productionFailureFingerprint,
  registerProductionFailure,
  sanitizeProductionText,
  validateInteractionCommand,
} from "@/lib/roadmap-production/interactions";
import {
  enqueueProductionControl,
  readProductionState,
  writeProductionState,
} from "@/lib/roadmap-production/storage";
import {
  applyProductionControls,
  selectNextProductionExecution,
} from "@/lib/roadmap-production/worker";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

function executionFixture() {
  const at = "2026-08-24T12:00:00.000Z";
  const requestId = randomUUID();
  const state = productionStateSchema.parse({
    version: 1,
    updatedAt: at,
    ignoredExecutionIds: [],
    executions: [
      {
        id: "objective:v1",
        objectiveId: "objective",
        objectiveCode: "RM-TEST",
        objectiveTitle: "Teste",
        moduleKey: "crm",
        sourceVersion: 1,
        globalPriority: 1,
        status: "WAITING_FOR_ADMIN",
        createdAt: at,
        startedAt: at,
        finishedAt: null,
        phases: [
          {
            phaseNumber: 2,
            title: "Implementar API",
            kind: "EXECUTION",
            requestedAgent: "dev",
            resolvedAgent: "echo",
            status: "NEEDS_INPUT",
            attemptCount: 1,
            startedAt: at,
            finishedAt: at,
            summary: "Aguardando resposta",
            errorCode: "NEEDS_INPUT",
            activities: [],
          },
        ],
        interventions: [
          {
            id: randomUUID(),
            requestId,
            executionId: "objective:v1",
            phaseNumber: 2,
            category: "DECISION",
            question: "Qual comportamento deve ser usado?",
            intendedAction: "Escolher comportamento",
            normalizedAction: "escolher comportamento",
            risk: "Sem resposta a fase não pode continuar.",
            options: ["Opção A", "Opção B"],
            status: "PENDING",
            createdAt: at,
          },
        ],
      },
    ],
  });
  return { state, requestId };
}

describe("intervenções administrativas", () => {
  it("aceita somente NEEDS_INPUT completo e estruturado", () => {
    const requestId = randomUUID();
    const intervention = parseNeedsInputResult(
      `RESULT: NEEDS_INPUT\nNEEDS_INPUT_JSON: ${JSON.stringify({
        requestId,
        phaseNumber: 2,
        category: "PERMISSION",
        question: "Posso acessar o serviço externo?",
        intendedAction: "curl https://example.com com token=supersecreto",
        risk: "Ação usa rede e Authorization: Bearer-segredo",
        options: ["Autorizar", "Negar"],
      })}`,
      "objective:v1",
    );
    expect(intervention).toMatchObject({ requestId, status: "PENDING" });
    expect(JSON.stringify(intervention)).not.toContain("supersecreto");
    expect(parseNeedsInputResult("RESULT: NEEDS_INPUT\nPosso continuar?", "x")).toBeNull();
  });

  it("deriva a categoria proibida da ação e impede autorização disfarçada como decisão", () => {
    const requestId = randomUUID();
    const intervention = parseNeedsInputResult(
      `RESULT: NEEDS_INPUT\nNEEDS_INPUT_JSON: ${JSON.stringify({
        requestId,
        phaseNumber: 2,
        category: "DECISION",
        question: "Posso publicar as mudanças no remoto?",
        intendedAction: "git push origin main",
        risk: "Publicação externa.",
        options: ["Autorizar", "Negar"],
      })}`,
      "objective:v1",
    );
    expect(intervention?.category).toBe("GIT_REMOTE");
    const { state } = executionFixture();
    state.executions[0].interventions = [intervention!];
    const authorize = productionControlCommandSchema.parse({
      id: randomUUID(),
      type: "AUTHORIZE",
      executionId: "objective:v1",
      phaseNumber: 2,
      requestId,
      createdAt: new Date().toISOString(),
    });
    expect(() => validateInteractionCommand(state, authorize)).toThrow(
      "INTERVENTION_AUTHORIZATION_FORBIDDEN",
    );
  });

  it("rejeita no produtor uma segunda resposta já enfileirada", () => {
    const { state, requestId } = executionFixture();
    const first = productionControlCommandSchema.parse({
      id: randomUUID(),
      type: "RESPOND",
      executionId: "objective:v1",
      phaseNumber: 2,
      requestId,
      content: "Use a opção A.",
      createdAt: new Date().toISOString(),
    });
    const duplicate = productionControlCommandSchema.parse({
      ...first,
      id: randomUUID(),
    });
    validateInteractionCommand(state, first);
    expect(() =>
      assertNoQueuedInterventionResponse([first], duplicate),
    ).toThrow("INTERVENTION_COMMAND_ALREADY_QUEUED");
  });

  it("gera fingerprint estável e abre o circuito na terceira falha", () => {
    const { state } = executionFixture();
    const execution = state.executions[0];
    execution.status = "RUNNING";
    execution.phases[0].status = "FAILED";
    const first = registerProductionFailure(execution, 2, "AGENT_BLOCKED", "Arquivo 123 ausente", "2026-08-24T12:01:00.000Z");
    const second = registerProductionFailure(execution, 2, "AGENT_BLOCKED", "Arquivo 456 ausente", "2026-08-24T12:02:00.000Z");
    const third = registerProductionFailure(execution, 2, "AGENT_BLOCKED", "Arquivo 789 ausente", "2026-08-24T12:03:00.000Z");
    expect(first.opened).toBe(false);
    expect(second.opened).toBe(false);
    expect(third).toMatchObject({ opened: true, count: 3 });
    expect(
      productionFailureFingerprint({ phaseNumber: 2, agentId: "echo", errorCode: "X", summary: "Erro 1" }),
    ).toBe(
      productionFailureFingerprint({ phaseNumber: 2, agentId: "echo", errorCode: "X", summary: "Erro 999" }),
    );

    execution.status = "WAITING_FOR_ADMIN";
    execution.phases[0].status = "NEEDS_INPUT";
    expect(selectNextProductionExecution(state)).toBeUndefined();
  });

  it("preserva WAITING_FOR_ADMIN em restart sem iniciar uma quarta tentativa", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-waiting-restart-"));
    roots.push(root);
    const { state } = executionFixture();
    state.executions[0].phases[0].attemptCount = 3;
    state.executions[0].phases[0].circuit = {
      fingerprint: "a".repeat(64),
      consecutiveCount: 3,
      firstOccurredAt: "2026-08-24T12:00:00.000Z",
      lastOccurredAt: "2026-08-24T12:02:00.000Z",
      resetReason: null,
    };
    await writeProductionState(state, root);

    const firstBoot = await readProductionState(root);
    const secondBoot = await readProductionState(root);
    expect(secondBoot.executions[0]).toMatchObject({
      status: "WAITING_FOR_ADMIN",
      phases: [
        expect.objectContaining({
          status: "NEEDS_INPUT",
          attemptCount: 3,
          circuit: expect.objectContaining({ consecutiveCount: 3 }),
        }),
      ],
    });
    expect(selectNextProductionExecution(firstBoot)).toBeUndefined();
    expect(selectNextProductionExecution(secondBoot)).toBeUndefined();
  });

  it("responde de forma localizada e rejeita repetição", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-intervention-"));
    roots.push(root);
    const { state, requestId } = executionFixture();
    await writeProductionState(state, root);
    await enqueueProductionControl("RESPOND", "objective:v1", root, {
      phaseNumber: 2,
      requestId,
      content: "Use a opção A.",
      author: "Admin",
    });
    await applyProductionControls(root);
    const updated = await readProductionState(root);
    expect(updated.executions[0].status).toBe("PENDING");
    expect(updated.executions[0].phases[0].status).toBe("PENDING");
    expect(updated.executions[0].interventions[0].status).toBe("ANSWERED");
    expect(updated.executions[0].messages.some((message) => message.role === "ADMIN")).toBe(true);

    const duplicate = productionControlCommandSchema.parse({
      id: randomUUID(),
      type: "RESPOND",
      executionId: "objective:v1",
      phaseNumber: 2,
      requestId,
      content: "Responder de novo",
      createdAt: new Date().toISOString(),
    });
    expect(() => validateInteractionCommand(updated, duplicate)).toThrow(
      "INTERVENTION_ALREADY_RESOLVED",
    );
  });

  it("autoriza uma única tentativa da mesma fase e mantém o grant após restart", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-one-shot-"));
    roots.push(root);
    const { state, requestId } = executionFixture();
    const intervention = state.executions[0].interventions[0];
    intervention.category = "EXTERNAL_ACTION";
    intervention.intendedAction = "curl https://example.com/status";
    intervention.normalizedAction = "curl https://example.com/status";
    await writeProductionState(state, root);
    await enqueueProductionControl("AUTHORIZE", "objective:v1", root, {
      phaseNumber: 2,
      requestId,
      author: "Admin",
    });

    await applyProductionControls(root);
    const restarted = await readProductionState(root);
    expect(restarted.executions[0]).toMatchObject({
      status: "PENDING",
      phases: [expect.objectContaining({ phaseNumber: 2, status: "PENDING" })],
      interventions: [
        expect.objectContaining({
          requestId,
          phaseNumber: 2,
          status: "AUTHORIZED",
          resolution: expect.objectContaining({
            decision: "AUTHORIZE",
            authorizationAttempt: 2,
            authorizationConsumedAt: null,
          }),
        }),
      ],
    });

    const replay = productionControlCommandSchema.parse({
      id: randomUUID(),
      type: "AUTHORIZE",
      executionId: "objective:v1",
      phaseNumber: 2,
      requestId,
      createdAt: new Date().toISOString(),
    });
    expect(() => validateInteractionCommand(restarted, replay)).toThrow(
      "INTERVENTION_ALREADY_RESOLVED",
    );
    const wrongPhase = productionControlCommandSchema.parse({
      ...replay,
      id: randomUUID(),
      phaseNumber: 1,
    });
    state.executions[0].phases.push({
      ...state.executions[0].phases[0],
      phaseNumber: 1,
      title: "Preparar implementação",
    });
    expect(() => validateInteractionCommand(state, wrongPhase)).toThrow(
      "INTERVENTION_PHASE_MISMATCH",
    );
  });

  it("redige segredos antes de persistir no histórico", () => {
    const sanitized = sanitizeProductionText(
      "Authorization: abc123 token=secreto _authToken=camel-secret private_key=pem-secret https://user:pass@example.com/x?authToken=query-secret DATABASE_URL=postgresql://dbuser:dbpass@db.internal/app smb://shareuser:sharepass@files.internal/path PUBLIC_URL=https://example.com/docs",
    );
    expect(sanitized).not.toContain("abc123");
    expect(sanitized).not.toContain("secreto");
    expect(sanitized).not.toContain("user:pass");
    expect(sanitized).not.toContain("camel-secret");
    expect(sanitized).not.toContain("pem-secret");
    expect(sanitized).not.toContain("query-secret");
    expect(sanitized).not.toContain("dbuser:dbpass");
    expect(sanitized).not.toContain("shareuser:sharepass");
    expect(sanitized).toContain("PUBLIC_URL=https://example.com/docs");
  });

  it("redige credenciais embutidas em URIs de banco e NAS", () => {
    const sanitized = sanitizeProductionText(
      "DATABASE_URL=postgresql://db-user:db-pass@db.local/app smb://nas-user:nas-pass@nas.local/share",
    );
    expect(sanitized).not.toContain("db-pass");
    expect(sanitized).not.toContain("nas-pass");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("preserva no boundary uma mensagem aceita durante RUNNING sem reabrir a fase concluída", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-running-message-"));
    roots.push(root);
    const { state } = executionFixture();
    const execution = state.executions[0];
    execution.status = "RUNNING";
    execution.finishedAt = null;
    execution.phases[0].status = "RUNNING";
    execution.phases[0].finishedAt = null;
    execution.interventions = [];
    await writeProductionState(state, root);
    await enqueueProductionControl("MESSAGE", execution.id, root, {
      phaseNumber: 2,
      content: "Considere também o cenário mobile.",
      author: "Admin",
      acceptedPhaseStatus: "RUNNING",
    });

    const terminal = await readProductionState(root);
    terminal.executions[0].status = "SUCCEEDED";
    terminal.executions[0].finishedAt = "2026-08-24T12:10:00.000Z";
    terminal.executions[0].phases[0].status = "SUCCEEDED";
    terminal.executions[0].phases[0].finishedAt =
      "2026-08-24T12:10:00.000Z";
    await writeProductionState(terminal, root);

    await applyProductionControls(root);
    const updated = await readProductionState(root);
    expect(updated.executions[0].status).toBe("SUCCEEDED");
    expect(updated.executions[0].phases[0].status).toBe("SUCCEEDED");
    expect(updated.executions[0].messages.at(-1)).toMatchObject({
      role: "ADMIN",
      kind: "MESSAGE",
      content: "Considere também o cenário mobile.",
    });
  });
});
