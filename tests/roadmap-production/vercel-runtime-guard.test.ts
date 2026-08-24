import fs from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { productionMessageSchema } from "@/lib/roadmap-production/contracts";

const requireRoadmapAccessMock = vi.hoisted(() => vi.fn());
const runtimeEnabledMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  roadmapWorkspace: { findMany: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/actions/PermissoesSetor", () => ({
  listarAcessoModulo: vi.fn(),
  toggleAcessoModulo: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/roadmap-alpha/authorization", () => ({
  requireRoadmapAccess: requireRoadmapAccessMock,
  requireRoadmapProductionAccess: vi.fn(),
}));
vi.mock("@/lib/roadmap-alpha/improve-with-ai", () => ({
  improveRoadmapField: vi.fn(),
}));
vi.mock("@/lib/roadmap-production/agents", () => ({ listBibbleAgents: vi.fn() }));
vi.mock("@/lib/roadmap-production/interactions", () => ({
  assertNoQueuedInterventionResponse: vi.fn(),
  validateInteractionCommand: vi.fn(),
}));
vi.mock("@/lib/roadmap-production/providers", () => ({
  diagnoseProductionProviders: vi.fn(),
}));
vi.mock("@/lib/roadmap-production/runtime", () => ({
  isRoadmapProductionRuntimeEnabled: runtimeEnabledMock,
  ROADMAP_PRODUCTION_RUNTIME_DISABLED: "ROADMAP_PRODUCTION_RUNTIME_DISABLED",
}));
vi.mock("@/lib/roadmap-production/storage", () => ({
  enqueueProductionControl: vi.fn(),
  readProductionConfig: vi.fn(),
  readProductionControls: vi.fn(),
  readProductionState: vi.fn(),
  writeProductionConfig: vi.fn(),
}));
vi.mock("@/lib/roadmap-production/worker", () => ({
  processNextProductionPhase: vi.fn(),
  refreshProductionExecutions: vi.fn(),
}));
vi.mock("@/lib/roles", () => ({ isAdminRole: vi.fn() }));

import {
  ListarExecucoesAguardandoAprovacao,
  ListarExecucoesPorObjetivo,
  ListarExecucoesPrecisandoAtencao,
} from "@/actions/RoadmapProduction";

beforeEach(() => {
  vi.clearAllMocks();
  requireRoadmapAccessMock.mockResolvedValue({
    userId: 1,
    role: "Admin",
    canMutate: true,
    canAccessProduction: true,
  });
  runtimeEnabledMock.mockReturnValue(false);
});

describe("regressão Vercel — listagens de Produção", () => {
  it.each([
    ["aprovações pendentes", ListarExecucoesAguardandoAprovacao, true],
    ["execuções que requerem atenção", ListarExecucoesPrecisandoAtencao, true],
    ["execuções por objetivo", ListarExecucoesPorObjetivo, undefined],
  ] as const)(
    "não toca Prisma quando o executor local está desabilitado: %s",
    async (_label, action, expectedMutationPermission) => {
      await expect(action()).resolves.toEqual({ success: true, data: [] });

      if (expectedMutationPermission === undefined) {
        expect(requireRoadmapAccessMock).toHaveBeenCalledWith();
      } else {
        expect(requireRoadmapAccessMock).toHaveBeenCalledWith(
          expectedMutationPermission,
        );
      }
      expect(prismaMock.roadmapWorkspace.findMany).not.toHaveBeenCalled();
    },
  );
});

describe("autorização da listagem por objetivo", () => {
  it("não revela execuções a quem tem Roadmap, mas não Produção", async () => {
    requireRoadmapAccessMock.mockResolvedValue({
      userId: 2,
      role: "Comercial",
      canMutate: false,
      canAccessProduction: false,
    });
    runtimeEnabledMock.mockReturnValue(true);

    await expect(ListarExecucoesPorObjetivo()).resolves.toEqual({
      success: false,
      error: "Não autorizado",
      data: [],
    });
    expect(prismaMock.roadmapWorkspace.findMany).not.toHaveBeenCalled();
  });
});

describe("regressão da Sala de Implementação", () => {
  it("rejeita mensagens persistidas com conteúdo não textual", () => {
    const validMessage = {
      id: "7d828779-4ea8-4463-96bf-2f8f9f5b0478",
      executionId: "RM-TEST:v1",
      phaseNumber: 1,
      role: "SYSTEM",
      kind: "STATUS",
      content: "Esta fase já tentou se autocorrigir uma vez.",
      requestId: null,
      createdAt: "2026-08-24T12:00:00.000Z",
    };

    expect(productionMessageSchema.safeParse(validMessage).success).toBe(true);
    expect(
      productionMessageSchema.safeParse({ ...validMessage, content: 42 }).success,
    ).toBe(false);
  });

  it("mantém a proteção de runtime para dados legados fora do contrato", async () => {
    const room = await fs.readFile(
      path.join(
        process.cwd(),
        "src/components/RoadmapAlpha/RoadmapImplementationRoom.tsx",
      ),
      "utf8",
    );
    const helper = room.slice(
      room.indexOf("function isRetryThresholdWarning"),
      room.indexOf("function MessageCard"),
    );

    expect(helper).toContain('typeof message.content === "string"');
    expect(helper.indexOf('typeof message.content === "string"')).toBeLessThan(
      helper.indexOf('message.content.startsWith('),
    );
  });
});
