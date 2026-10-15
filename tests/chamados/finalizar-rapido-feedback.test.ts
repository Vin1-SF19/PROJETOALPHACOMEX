import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  concluirChamado: vi.fn(),
  concluirTarefa: vi.fn(),
  notificarConcluido: vi.fn(),
  notificarAgenda: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/chamados/conclusao", () => ({
  concluirChamadoComFeedback: mocks.concluirChamado,
  ErroConclusaoChamado: class ErroConclusaoChamado extends Error {},
}));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: mocks.notificarAgenda,
  notificarChamadoAssumido: vi.fn(),
  notificarChamadoConcluido: mocks.notificarConcluido,
  notificarMensagemChamado: vi.fn(),
  notificarNovoChamado: vi.fn(),
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: mocks.concluirTarefa,
  criarTarefaAgendadaParaChamado: vi.fn(),
}));

import { updateChamadosStatus } from "@/actions/chamados";

describe("updateChamadosStatus — conclusão rápida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "3", role: "TI" } });
    const fechadoEm = new Date("2026-09-11T13:00:00.000Z");
    mocks.concluirChamado.mockResolvedValue({
      id: 10,
      titulo: "Falha no acesso",
      usuarioId: 7,
      tecnicoId: 3,
      destinoEhTI: true,
      tecnicoRole: "TI",
      solucao: "Perfil liberado",
      closedAt: fechadoEm,
      updatedAt: fechadoEm,
    });
    mocks.concluirTarefa.mockResolvedValue(undefined);
    mocks.notificarConcluido.mockResolvedValue(undefined);
    mocks.notificarAgenda.mockResolvedValue(undefined);
  });

  it("usa o serviço atômico compartilhado e preserva as notificações", async () => {
    const resultado = await updateChamadosStatus(10, "CONCLUIDO", "Perfil liberado");

    expect(resultado).toEqual({ success: true });
    expect(mocks.concluirChamado).toHaveBeenCalledWith(expect.objectContaining({
      chamadoId: 10,
      tecnicoId: 3,
      solucao: "Perfil liberado",
      concluidoEm: expect.any(Date),
    }));
    expect(mocks.notificarConcluido).toHaveBeenCalledOnce();
    expect(mocks.notificarAgenda).toHaveBeenCalledOnce();
  });

  it("propaga recusa do serviço de conclusão para colaborador sem atribuição", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "7", role: "User" } });
    mocks.concluirChamado.mockRejectedValueOnce(new Error("Permissão insuficiente"));

    const resultado = await updateChamadosStatus(10, "CONCLUIDO", "Tentativa");

    expect(resultado).toEqual({ success: false, error: "Erro ao atualizar status." });
    expect(mocks.concluirChamado).toHaveBeenCalled();
  });
});
