import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  feedbackCreate: vi.fn(),
}));

const tx = {
  usuarios: { findUnique: vi.fn().mockResolvedValue({ id: 3, nome: "Carlos", role: "TI", status: "ATIVO" }) },
  setor: { findMany: vi.fn().mockResolvedValue([{ id: 14, nome: "TI" }]) },
  chamados: {
    findUnique: mocks.findUnique,
    updateMany: mocks.updateMany,
  },
  chamadoFeedback: { create: mocks.feedbackCreate },
};

vi.mock("@/lib/prisma", () => ({
  default: { $transaction: mocks.transaction,
    usuarios: { findUnique: vi.fn().mockResolvedValue({ id: 3, nome: "Carlos", role: "TI", status: "ATIVO" }) },
    setor: { findMany: vi.fn().mockResolvedValue([{ id: 14, nome: "TI" }]) },
  },
}));

import {
  concluirChamadoComFeedback,
} from "@/lib/chamados/conclusao";

const CONCLUIDO_EM = new Date("2026-09-11T13:00:00.000Z");

describe("concluirChamadoComFeedback", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    tx.usuarios.findUnique.mockReset().mockResolvedValue({ id: 3, nome: "Carlos", role: "TI", status: "ATIVO" });
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.findUnique.mockResolvedValue({
      id: 10,
      titulo: "Falha no acesso",
      usuarioId: 7,
      tecnicoId: 3,
      status: "EM_ATENDIMENTO",
      tecnico: { role: "TI", status: "ATIVO" },
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
      where: { id: 10, tecnicoId: 3, status: "EM_ATENDIMENTO", setorDestinoId: undefined },
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

  it("permite ao responsável TI concluir atendimento assumido para o Comercial", async () => {
    mocks.findUnique.mockResolvedValue({
      id: 10, titulo: "Demanda de outro setor", usuarioId: 7, tecnicoId: 3,
      status: "EM_ATENDIMENTO", tecnico: { role: "TI", status: "ATIVO" },
      setorDestinoId: 5, setorDestino: { id: 5, nome: "COMERCIAL", ativo: true, isBase: false },
    });
    const resultado = await concluirChamadoComFeedback({ chamadoId: 10, tecnicoId: 3, concluidoEm: CONCLUIDO_EM, solucao: "Resolvido" });
    expect(resultado).toMatchObject({ tecnicoId: 3, destinoEhTI: false });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10, tecnicoId: 3, setorDestinoId: 5, status: "EM_ATENDIMENTO" },
    }));
    expect(mocks.feedbackCreate).toHaveBeenCalledOnce();
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
      tecnico: { role: "TI", status: "ATIVO" },
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
  it("conclui autoatendimento sem criar avaliação própria", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: 10, titulo: "Meu acesso", usuarioId: 3, tecnicoId: 3, status: "EM_ATENDIMENTO", tecnico: { role: "TI", status: "ATIVO" } });
    const resultado = await concluirChamadoComFeedback({ chamadoId: 10, tecnicoId: 3, concluidoEm: CONCLUIDO_EM });
    expect(resultado.id).toBe(10);
    expect(mocks.updateMany).toHaveBeenCalledOnce();
    expect(mocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("reinicia a transação e reconsulta o chamado após lock transitório", async () => {
    vi.useFakeTimers();
    mocks.updateMany.mockRejectedValueOnce({ cause: { originalMessage: "SQLITE_BUSY: database is locked" } });
    const resultado = concluirChamadoComFeedback({ chamadoId: 10, tecnicoId: 3, concluidoEm: CONCLUIDO_EM });
    const resolucao = expect(resultado).resolves.toMatchObject({ id: 10 });
    await vi.advanceTimersByTimeAsync(200);
    await resolucao;
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.feedbackCreate).toHaveBeenCalledOnce();
  });

  it("limita contenção persistente a quatro tentativas e retorna erro seguro", async () => {
    vi.useFakeTimers();
    mocks.transaction.mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));
    const resultado = concluirChamadoComFeedback({ chamadoId: 10, tecnicoId: 3, concluidoEm: CONCLUIDO_EM });
    const rejeicao = expect(resultado).rejects.toMatchObject({ code: "BANCO_OCUPADO", message: expect.not.stringContaining("SQLITE") });
    await vi.advanceTimersByTimeAsync(1_400);
    await rejeicao;
    expect(mocks.transaction).toHaveBeenCalledTimes(4);
    expect(mocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("revalida autorização após lock em vez de reutilizar a primeira leitura", async () => {
    vi.useFakeTimers();
    mocks.updateMany.mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked"));
    tx.usuarios.findUnique.mockResolvedValueOnce({ id: 3, nome: "Carlos", role: "TI", status: "ATIVO" })
      .mockResolvedValueOnce(null);
    const resultado = concluirChamadoComFeedback({ chamadoId: 10, tecnicoId: 3, concluidoEm: CONCLUIDO_EM });
    const rejeicao = expect(resultado).rejects.toMatchObject({ code: "SEM_PERMISSAO" });
    await vi.advanceTimersByTimeAsync(200);
    await rejeicao;
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenCalledOnce();
    expect(mocks.feedbackCreate).not.toHaveBeenCalled();
  });

  it("não repete falhas de integridade nem erros de negócio", async () => {
    mocks.feedbackCreate.mockRejectedValueOnce(new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed"));
    await expect(concluirChamadoComFeedback({ chamadoId: 10, tecnicoId: 3, concluidoEm: CONCLUIDO_EM }))
      .rejects.toThrow("SQLITE_CONSTRAINT");
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

});
