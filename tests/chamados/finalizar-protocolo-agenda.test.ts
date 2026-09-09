import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const concluirTarefaMock = vi.hoisted(() => vi.fn());
const notificarConcluidoMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  chamados: { findUnique: vi.fn() },
  $executeRawUnsafe: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarChamadoConcluido: notificarConcluidoMock,
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: concluirTarefaMock,
}));

import { finalizarComProtocolo } from "@/actions/protocolos";

const INSTANTE_CONCLUSAO = new Date("2026-09-09T18:37:42.000Z");

describe("finalizarComProtocolo — integração com Agenda Alpha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(INSTANTE_CONCLUSAO);
    authMock.mockResolvedValue({ user: { id: "3", role: "TI" } });
    prismaMock.chamados.findUnique.mockResolvedValue({
      id: 10,
      titulo: "Falha no acesso",
      usuarioId: 7,
      tecnicoId: 3,
      tecnico: { role: "T.I" },
    });
    prismaMock.$executeRawUnsafe.mockResolvedValue(1);
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
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("closedAt = ?"),
      "CONCLUIDO",
      "Acesso restabelecido",
      "Permissão ausente",
      "Chamado concluído",
      null,
      INSTANTE_CONCLUSAO.toISOString(),
      INSTANTE_CONCLUSAO.toISOString(),
      10,
    );
    expect(concluirTarefaMock).toHaveBeenCalledWith({
      chamadoId: 10,
      concluidoEm: INSTANTE_CONCLUSAO,
      tecnicoId: 3,
      tecnicoRole: "T.I",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CalendarioAlpha");
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

  it("não tenta concluir tarefa quando o chamado não possui técnico", async () => {
    prismaMock.chamados.findUnique.mockResolvedValueOnce({
      id: 11,
      titulo: "Chamado sem técnico",
      usuarioId: 7,
      tecnicoId: null,
      tecnico: null,
    });

    const resultado = await finalizarComProtocolo(11, {
      solucao: "Tratativa administrativa",
      causa: "",
      mensagemFinal: "",
    });

    expect(resultado).toEqual({ success: true });
    expect(concluirTarefaMock).not.toHaveBeenCalled();
  });
});
