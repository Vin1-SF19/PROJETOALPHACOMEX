import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const concluirTarefaMock = vi.hoisted(() => vi.fn());
const notificarConcluidoMock = vi.hoisted(() => vi.fn());
const notificarAgendaMock = vi.hoisted(() => vi.fn());
const concluirChamadoMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  protocoloTemplate: {},
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: notificarAgendaMock,
  notificarChamadoConcluido: notificarConcluidoMock,
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: concluirTarefaMock,
}));
vi.mock("@/lib/chamados/conclusao", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/chamados/conclusao")>(),
  concluirChamadoComFeedback: concluirChamadoMock,
}));

import { finalizarComProtocolo } from "@/actions/protocolos";
import { ErroConclusaoChamado } from "@/lib/chamados/conclusao";

const INSTANTE_CONCLUSAO = new Date("2026-09-09T18:37:42.000Z");

describe("finalizarComProtocolo — integração com Agenda Alpha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(INSTANTE_CONCLUSAO);
    authMock.mockResolvedValue({ user: { id: "3", role: "TI" } });
    concluirChamadoMock.mockResolvedValue({
      id: 10,
      titulo: "Falha no acesso",
      usuarioId: 7,
      tecnicoId: 3,
      destinoEhTI: true,
      tecnicoRole: "T.I",
      solucao: "Acesso restabelecido",
      closedAt: INSTANTE_CONCLUSAO,
      updatedAt: INSTANTE_CONCLUSAO,
    });
    concluirTarefaMock.mockResolvedValue(undefined);
    notificarConcluidoMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa o mesmo instante do fechamento para encerrar a tarefa do técnico", async () => {
    const resultado = await finalizarComProtocolo(10, {
      solucao: "Acesso restabelecido",
      causa: "Permissão ausente",
      mensagemFinal: "Chamado concluído",
    });

    expect(resultado).toEqual({ success: true });
    expect(concluirChamadoMock).toHaveBeenCalledWith({
      chamadoId: 10,
      tecnicoId: 3,
      concluidoEm: INSTANTE_CONCLUSAO,
      solucao: "Acesso restabelecido",
      causa: "Permissão ausente",
      mensagemFinal: "Chamado concluído",
      templateId: null,
    });
    expect(concluirTarefaMock).toHaveBeenCalledWith({
      chamadoId: 10,
      concluidoEm: INSTANTE_CONCLUSAO,
      tecnicoId: 3,
      tecnicoRole: "T.I",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CalendarioAlpha");
    expect(notificarAgendaMock).toHaveBeenCalledWith(
      [7, 3],
      {
        chamadoId: 10,
        status: "CONCLUIDO",
        updatedAt: INSTANTE_CONCLUSAO.toISOString(),
      },
    );
  });

  it("mantém o chamado concluído quando o Google Tasks está indisponível", async () => {
    concluirTarefaMock.mockRejectedValueOnce(new Error("Google indisponível"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const resultado = await finalizarComProtocolo(10, {
      solucao: "Acesso restabelecido",
      causa: "",
      mensagemFinal: "",
    });

    expect(resultado).toEqual({ success: true });
    expect(notificarConcluidoMock).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      "[chamados] Falha ao concluir tarefa da Agenda Alpha pelo protocolo",
      expect.objectContaining({ chamadoId: 10, tecnicoId: 3, message: "Google indisponível" }),
    );
    consoleError.mockRestore();
  });

  it("propaga recusa do serviço sem disparar automação da Agenda", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "7", role: "User" } });
    concluirChamadoMock.mockRejectedValueOnce(new ErroConclusaoChamado("SEM_PERMISSAO"));

    const resultado = await finalizarComProtocolo(11, {
      solucao: "Tratativa administrativa",
      causa: "",
      mensagemFinal: "",
    });

    expect(resultado).toEqual({ success: false, error: "Somente o responsável ativo e autorizado que assumiu o chamado pode finalizá-lo." });
    expect(concluirChamadoMock).toHaveBeenCalled();
    expect(concluirTarefaMock).not.toHaveBeenCalled();
  });

  it("oculta erros técnicos e não dispara efeitos quando a conclusão falha", async () => {
    concluirChamadoMock.mockRejectedValueOnce(new Error("SQLITE_CONSTRAINT: detalhes internos"));
    const resultado = await finalizarComProtocolo(10, { solucao: "Resolvido", causa: "", mensagemFinal: "" });
    expect(resultado).toEqual({ success: false, error: "Erro ao finalizar chamado." });
    expect(concluirTarefaMock).not.toHaveBeenCalled();
    expect(notificarConcluidoMock).not.toHaveBeenCalled();
    expect(notificarAgendaMock).not.toHaveBeenCalled();
  });

  it("preserva orientação segura para contenção esgotada", async () => {
    const erro = new ErroConclusaoChamado("BANCO_OCUPADO");
    concluirChamadoMock.mockRejectedValueOnce(erro);
    expect(await finalizarComProtocolo(10, { solucao: "Resolvido", causa: "", mensagemFinal: "" }))
      .toEqual({ success: false, error: erro.message });
    expect(concluirTarefaMock).not.toHaveBeenCalled();
    expect(notificarConcluidoMock).not.toHaveBeenCalled();
  });
});
