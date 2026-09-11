import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  feedbackCreate: vi.fn(),
}));

const tx = {
  chamados: {
    findUnique: mocks.findUnique,
    updateMany: mocks.updateMany,
  },
  chamadoFeedback: { create: mocks.feedbackCreate },
};

vi.mock("@/lib/prisma", () => ({
  default: { $transaction: mocks.transaction },
}));

import {
  concluirChamadoComFeedback,
} from "@/lib/chamados/conclusao";

const CONCLUIDO_EM = new Date("2026-09-11T13:00:00.000Z");

describe("concluirChamadoComFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.findUnique.mockResolvedValue({
      id: 10,
      titulo: "Falha no acesso",
      usuarioId: 7,
      tecnicoId: 3,
      status: "EM_ATENDIMENTO",
      tecnico: { role: "TI" },
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.feedbackCreate.mockResolvedValue({ chamadoId: 10 });
  });

  it("grava conclusão, closedAt e feedback pendente na mesma transação", async () => {
    await concluirChamadoComFeedback({
      chamadoId: 10,
      tecnicoId: 3,
      concluidoEm: CONCLUIDO_EM,
      solucao: "Perfil liberado",
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 10, tecnicoId: 3, status: "EM_ATENDIMENTO" },
      data: expect.objectContaining({
        status: "CONCLUIDO",
        closedAt: CONCLUIDO_EM,
        updatedAt: CONCLUIDO_EM,
        solucao: "Perfil liberado",
      }),
    });
    expect(mocks.feedbackCreate).toHaveBeenCalledWith({
      data: { chamadoId: 10, status: "PENDENTE" },
      select: { chamadoId: true },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("impede conclusão por usuário diferente do técnico efetivo", async () => {
    await expect(concluirChamadoComFeedback({
      chamadoId: 10,
      tecnicoId: 9,
      concluidoEm: CONCLUIDO_EM,
    })).rejects.toMatchObject({ code: "SEM_PERMISSAO" });

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("distingue chamado inexistente de status que já não permite conclusão", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    await expect(concluirChamadoComFeedback({
      chamadoId: 999,
      tecnicoId: 3,
      concluidoEm: CONCLUIDO_EM,
    })).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });

    mocks.findUnique.mockResolvedValueOnce({
      id: 10,
      titulo: "Falha no acesso",
      usuarioId: 7,
      tecnicoId: 3,
      status: "CONCLUIDO",
      tecnico: { role: "TI" },
    });
    await expect(concluirChamadoComFeedback({
      chamadoId: 10,
      tecnicoId: 3,
      concluidoEm: CONCLUIDO_EM,
    })).rejects.toMatchObject({ code: "STATUS_INVALIDO" });

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("não cria pendência quando o CAS da conclusão perde a corrida", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(concluirChamadoComFeedback({
      chamadoId: 10,
      tecnicoId: 3,
      concluidoEm: CONCLUIDO_EM,
    })).rejects.toMatchObject({ code: "CONCORRENCIA" });

    expect(mocks.feedbackCreate).not.toHaveBeenCalled();
  });
});
