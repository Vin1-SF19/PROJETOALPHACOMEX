import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirAcessoCard: vi.fn(),
  itemFindUnique: vi.fn(),
  itemUpdateMany: vi.fn(),
  itemFindMany: vi.fn(),
  membroFindUnique: vi.fn(),
  checklistUpdate: vi.fn(),
  historico: vi.fn(),
  realtime: vi.fn(),
  revalidate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoConfigPipeline: vi.fn(),
  exigirAcessoBpmCard: mocks.exigirAcessoCard,
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: mocks.historico }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.realtime }));
vi.mock("@/lib/bpm/checklists/service", () => ({ materializarChecklistsAplicaveisCard: vi.fn() }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ carregarResumoChecklistAplicavelCard: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmCardChecklistItem: { findUnique: mocks.itemFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { AtualizarItemChecklistCardBpm } from "@/actions/bpm/Checklists";

const ITEM_ID = "cm12345678901234567890123";
const atualizadoEm = new Date("2026-09-04T15:00:00Z");
const existente = {
  id: ITEM_ID,
  status: "PENDENTE",
  observacao: null,
  responsavelId: null,
  updatedAt: atualizadoEm,
  cardChecklist: {
    id: "checklist-1",
    cardId: "card-1",
    card: { pipelineId: "pipeline-1", responsavelId: 7 },
  },
};

describe("Checklists.ts — operações robustas no card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.itemFindUnique.mockReset();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirAcessoCard.mockResolvedValue(undefined);
    mocks.itemFindUnique
      .mockResolvedValueOnce(existente)
      .mockResolvedValueOnce({
        id: ITEM_ID,
        status: "CONCLUIDO",
        observacao: null,
        responsavelId: null,
        concluidoEm: new Date("2026-09-04T15:01:00Z"),
        updatedAt: new Date("2026-09-04T15:01:00Z"),
      });
    mocks.itemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.itemFindMany.mockResolvedValue([{ status: "CONCLUIDO" }]);
    mocks.checklistUpdate.mockResolvedValue({ id: "checklist-1" });
    mocks.historico.mockResolvedValue(undefined);
    mocks.realtime.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (operacao) => operacao({
      bpmCardChecklistItem: {
        updateMany: mocks.itemUpdateMany,
        findUnique: mocks.itemFindUnique,
        findMany: mocks.itemFindMany,
      },
      bpmCardMembro: { findUnique: mocks.membroFindUnique },
      bpmCardChecklist: { update: mocks.checklistUpdate },
    }));
  });

  it("conclui com compare-and-swap, atualiza a instância e emite um único sinal", async () => {
    const resposta = await AtualizarItemChecklistCardBpm({ itemId: ITEM_ID, status: "CONCLUIDO" });

    expect(resposta.success).toBe(true);
    expect(mocks.exigirAcessoCard).toHaveBeenCalledTimes(2);
    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: ITEM_ID, updatedAt: atualizadoEm },
      data: expect.objectContaining({ status: "CONCLUIDO" }),
    }));
    expect(mocks.checklistUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONCLUIDO" }),
    }));
    expect(mocks.historico).toHaveBeenCalledTimes(1);
    expect(mocks.realtime).toHaveBeenCalledTimes(1);
  });

  it("rejeita responsável que não pertence ao card antes de gravar", async () => {
    mocks.membroFindUnique.mockResolvedValue(null);
    const resposta = await AtualizarItemChecklistCardBpm({ itemId: ITEM_ID, responsavelId: 99 });

    expect(resposta).toEqual({ success: false, error: "Responsável não é membro válido do card" });
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
    expect(mocks.historico).not.toHaveBeenCalled();
  });

  it("detecta escrita concorrente e não emite histórico ou realtime", async () => {
    mocks.itemUpdateMany.mockResolvedValue({ count: 0 });
    const resposta = await AtualizarItemChecklistCardBpm({ itemId: ITEM_ID, status: "CONCLUIDO" });

    expect(resposta).toEqual({ success: false, error: "CONFLITO_CHECKLIST_ITEM" });
    expect(mocks.checklistUpdate).not.toHaveBeenCalled();
    expect(mocks.historico).not.toHaveBeenCalled();
    expect(mocks.realtime).not.toHaveBeenCalled();
  });
});
