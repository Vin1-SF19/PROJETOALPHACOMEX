import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), access: vi.fn(), transaction: vi.fn(), findCard: vi.fn(),
  updateCard: vi.fn(), createChecklist: vi.fn(), createInteraction: vi.fn(), createHistory: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.access }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));

import { SalvarChecklistFollowUpBpm } from "@/actions/bpm/FollowUp";

const cardId = "clw0000000000000card";

describe("follow-up de Em tratativas na action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    mocks.access.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback({
      bpmCard: { findUnique: mocks.findCard, updateMany: mocks.updateCard },
      bpmChecklistFollowUp: { create: mocks.createChecklist },
      bpmInteracaoCard: { create: mocks.createInteraction },
      bpmCardHistorico: { create: mocks.createHistory },
    }));
  });

  it.each([null, new Date("2020-01-01T12:00:00Z")])(
    "bloqueia conclusão sem Próximo Contato válido (%s), sem gravar interação ou histórico",
    async (proximoContatoEm) => {
      mocks.findCard.mockResolvedValue({
        pipelineId: "pipeline-1", etapaId: "stage-1", updatedAt: new Date(),
        proximoContatoEm, pipeline: { nome: "Revisão de Radar" }, etapa: { nome: "Em tratativas" },
      });
      const resultado = await SalvarChecklistFollowUpBpm({
        cardId, respostas: { "anotacoes-ultimo-follow-up": "Cliente pediu proposta" }, concluir: true,
      });
      expect(resultado).toMatchObject({ success: false, error: expect.stringContaining("próximo contato") });
      expect(mocks.updateCard).not.toHaveBeenCalled();
      expect(mocks.createChecklist).not.toHaveBeenCalled();
      expect(mocks.createInteraction).not.toHaveBeenCalled();
      expect(mocks.createHistory).not.toHaveBeenCalled();
    },
  );
});
