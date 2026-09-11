import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  list: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

const tx = {
  chamadoFeedback: {
    findUnique: mocks.findUnique,
    updateMany: mocks.updateMany,
  },
};

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
    chamadoFeedback: { findMany: mocks.list },
  },
}));

import {
  listarFeedbacksPendentesAction,
  recusarFeedbackChamadoAction,
  responderFeedbackChamadoAction,
} from "@/actions/chamados-feedback";

describe("ações de feedback de chamado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "User" } });
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.findUnique.mockResolvedValue({
      status: "PENDENTE",
      chamado: { usuarioId: 7, status: "CONCLUIDO" },
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lista somente pendências concluídas pertencentes ao solicitante", async () => {
    mocks.list.mockResolvedValue([{
      chamadoId: 10,
      chamado: { titulo: "Falha no acesso", closedAt: new Date("2026-09-11T13:00:00.000Z") },
    }]);

    const resultado = await listarFeedbacksPendentesAction();

    expect(resultado).toEqual({
      success: true,
      data: [{
        chamadoId: 10,
        titulo: "Falha no acesso",
        closedAt: "2026-09-11T13:00:00.000Z",
      }],
    });
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "PENDENTE",
        chamado: expect.objectContaining({ usuarioId: 7, status: "CONCLUIDO" }),
      }),
      take: 20,
    }));
  });

  it("bloqueia listagem e mutações sem uma sessão válida", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "inválido", role: "User" } });

    await expect(listarFeedbacksPendentesAction()).resolves.toEqual({
      success: false,
      error: "Não autorizado",
    });
    await expect(recusarFeedbackChamadoAction(10)).resolves.toEqual({
      success: false,
      error: "Não autorizado",
    });
    await expect(responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 5,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    })).resolves.toEqual({ success: false, error: "Não autorizado" });

    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa com ownership e CAS de PENDENTE", async () => {
    const resultado = await recusarFeedbackChamadoAction(10);

    expect(resultado).toEqual({ success: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { chamadoId: 10, status: "PENDENTE" },
      data: { status: "RECUSADO", decidedAt: expect.any(Date) },
    });
  });

  it("não revela nem altera feedback de outro solicitante", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      status: "PENDENTE",
      chamado: { usuarioId: 99, status: "CONCLUIDO" },
    });

    const resultado = await recusarFeedbackChamadoAction(10);

    expect(resultado.success).toBe(false);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("persiste somente a ramificação positiva compatível", async () => {
    const resultado = await responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 5,
      notaPrazoConclusao: 4,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    });

    expect(resultado).toEqual({ success: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { chamadoId: 10, status: "PENDENTE" },
      data: expect.objectContaining({
        status: "RESPONDIDO",
        solucionadaComoEsperado: true,
        comentario: null,
        notaQualidadeSolucao: 5,
      }),
    });
  });

  it("persiste somente o relato da ramificação negativa compatível", async () => {
    const resultado = await responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 2,
      notaPrazoConclusao: 1,
      solucionadaComoEsperado: false,
      comentario: "A solução não contemplou todo o acesso solicitado.",
    });

    expect(resultado).toEqual({ success: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { chamadoId: 10, status: "PENDENTE" },
      data: expect.objectContaining({
        status: "RESPONDIDO",
        solucionadaComoEsperado: false,
        comentario: "A solução não contemplou todo o acesso solicitado.",
        notaQualidadeSolucao: null,
      }),
    });
  });

  it("não revela nem altera resposta de outro solicitante", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      status: "PENDENTE",
      chamado: { usuarioId: 99, status: "CONCLUIDO" },
    });

    const resultado = await responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 5,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Feedback inexistente, já respondido ou sem permissão",
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("usa CAS para impedir uma segunda decisão concorrente", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    const resultado = await responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 4,
      notaPrazoConclusao: 4,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 4,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Feedback inexistente, já respondido ou sem permissão",
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { chamadoId: 10, status: "PENDENTE" },
    }));
  });

  it("rejeita relato curto antes de acessar o banco", async () => {
    const resultado = await responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 2,
      notaPrazoConclusao: 1,
      solucionadaComoEsperado: false,
      comentario: "curto",
    });

    expect(resultado.success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("trata indisponibilidade do banco sem expor detalhes internos", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("libsql token=segredo"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const resultado = await responderFeedbackChamadoAction({
      chamadoId: 10,
      notaRapidezResposta: 5,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    });

    expect(resultado).toEqual({ success: false, error: "Não foi possível salvar o feedback" });
    expect(resultado.error).not.toContain("segredo");
    expect(consoleError).toHaveBeenCalledWith(
      "[chamados-feedback] Falha ao responder feedback",
      expect.objectContaining({ chamadoId: 10 }),
    );
    consoleError.mockRestore();
  });
});
