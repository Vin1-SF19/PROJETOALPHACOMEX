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
import { applyProductionControls } from "@/lib/roadmap-production/worker";

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

  it("redige segredos antes de persistir no histórico", () => {
    const sanitized = sanitizeProductionText(
      "Authorization: abc123 token=secreto https://user:pass@example.com/x",
    );
    expect(sanitized).not.toContain("abc123");
    expect(sanitized).not.toContain("secreto");
    expect(sanitized).not.toContain("user:pass");
  });
});
