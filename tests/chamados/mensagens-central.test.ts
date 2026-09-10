import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  chamadoFindUnique: vi.fn(),
  mensagemCreate: vi.fn(),
  pusherTrigger: vi.fn(),
  notificarMensagem: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    chamados: {
      findUnique: mocks.chamadoFindUnique,
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    mensagensChamado: {
      create: mocks.mensagemCreate,
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/pusher-server.ts", () => ({
  pusherServer: { trigger: mocks.pusherTrigger },
}));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: vi.fn(),
  notificarChamadoAssumido: vi.fn(),
  notificarChamadoConcluido: vi.fn(),
  notificarMensagemChamado: mocks.notificarMensagem,
  notificarNovoChamado: vi.fn(),
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: vi.fn(),
  criarTarefaAgendadaParaChamado: vi.fn(),
}));

import { enviarMensagemAction } from "@/actions/chamados";

const mensagemCriada = {
  id: 91,
  texto: "Consegue verificar?",
  chamadoId: 15,
  autorId: 42,
  arquivoUrl: null,
  arquivoTipo: null,
  createdAt: new Date("2026-09-09T20:00:00.000Z"),
  autor: { id: 42, nome: "Ana", usuario: "ana" },
};

describe("mensagens de chamados na central global", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pusherTrigger.mockResolvedValue(undefined);
    mocks.notificarMensagem.mockResolvedValue(true);
    mocks.mensagemCreate.mockResolvedValue(mensagemCriada);
  });

  it("notifica o técnico atribuído quando o solicitante envia mensagem", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "User", nome: "Ana" } });
    mocks.chamadoFindUnique.mockResolvedValue({
      id: 15,
      titulo: "Falha no acesso",
      usuarioId: 42,
      tecnicoId: 8,
    });

    await expect(enviarMensagemAction(15, "Consegue verificar?")).resolves.toEqual({ success: true });
    expect(mocks.notificarMensagem).toHaveBeenCalledWith(
      { usuarioIds: [8] },
      expect.objectContaining({ mensagemId: 91, chamadoId: 15, autorId: 42 }),
    );
  });

  it("notifica a equipe administrativa quando o chamado ainda não tem técnico", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "User", nome: "Ana" } });
    mocks.chamadoFindUnique.mockResolvedValue({
      id: 15,
      titulo: "Falha no acesso",
      usuarioId: 42,
      tecnicoId: null,
    });

    await enviarMensagemAction(15, "Alguém pode ajudar?");
    expect(mocks.notificarMensagem).toHaveBeenCalledWith(
      { administradores: true },
      expect.objectContaining({ chamadoId: 15 }),
    );
  });

  it("notifica o solicitante quando o técnico envia mensagem", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "8", role: "TI", nome: "Carlos" } });
    mocks.chamadoFindUnique.mockResolvedValue({
      id: 15,
      titulo: "Falha no acesso",
      usuarioId: 42,
      tecnicoId: 8,
    });
    mocks.mensagemCreate.mockResolvedValue({
      ...mensagemCriada,
      autorId: 8,
      autor: { id: 8, nome: "Carlos", usuario: "carlos" },
    });

    await enviarMensagemAction(15, "Já estou verificando.");
    expect(mocks.notificarMensagem).toHaveBeenCalledWith(
      { usuarioIds: [42] },
      expect.objectContaining({ autorId: 8, autorNome: "Carlos" }),
    );
  });

  it("bloqueia usuário que não é solicitante nem técnico administrativo", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "99", role: "User", nome: "Intruso" } });
    mocks.chamadoFindUnique.mockResolvedValue({
      id: 15,
      titulo: "Falha no acesso",
      usuarioId: 42,
      tecnicoId: 8,
    });

    await expect(enviarMensagemAction(15, "Oi")).resolves.toEqual({
      error: "Você não tem acesso a este chamado",
    });
    expect(mocks.mensagemCreate).not.toHaveBeenCalled();
    expect(mocks.notificarMensagem).not.toHaveBeenCalled();
  });

  it("mantém o envio salvo quando a atualização visual do chat falha", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "8", role: "TI", nome: "Carlos" } });
    mocks.chamadoFindUnique.mockResolvedValue({
      id: 15,
      titulo: "Falha no acesso",
      usuarioId: 42,
      tecnicoId: 8,
    });
    mocks.pusherTrigger.mockRejectedValueOnce(new Error("indisponível"));

    await expect(enviarMensagemAction(15, "Mensagem persistida")).resolves.toEqual({ success: true });
    expect(mocks.notificarMensagem).toHaveBeenCalledTimes(1);
  });
});
