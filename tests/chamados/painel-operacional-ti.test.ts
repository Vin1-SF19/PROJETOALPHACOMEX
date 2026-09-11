import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  chamadosFindMany: vi.fn(),
  chamadosFindUnique: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    chamados: {
      findMany: mocks.chamadosFindMany,
      findUnique: mocks.chamadosFindUnique,
    },
  },
}));
vi.mock("@/lib/pusher-server.ts", () => ({
  pusherServer: { trigger: vi.fn() },
}));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: vi.fn(),
  notificarChamadoAssumido: vi.fn(),
  notificarChamadoConcluido: vi.fn(),
  notificarMensagemChamado: vi.fn(),
  notificarNovoChamado: vi.fn(),
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: vi.fn(),
  criarTarefaAgendadaParaChamado: vi.fn(),
}));

import {
  enviarMensagemChamadoAtendidoTIAction,
  listarChamadosAtivosTIAction,
} from "@/actions/chamados";

const chamadoPersistido = {
  id: 12,
  titulo: "Acesso bloqueado",
  descricao: "Usuário não consegue acessar o sistema",
  categoria: "Acesso",
  prioridade: "ALTA",
  status: "EM_ATENDIMENTO",
  tecnicoId: 7,
  tecnicoSolicitadoId: 7,
  createdAt: new Date("2026-09-11T12:00:00.000Z"),
  updatedAt: new Date("2026-09-11T13:00:00.000Z"),
  solicitante: { nome: "Ana", usuario: "ana" },
  tecnico: { id: 7, nome: "Dex" },
  tecnicoSolicitado: { id: 7, nome: "Dex" },
  mensagens: [
    {
      id: 2,
      texto: "Já estamos verificando",
      createdAt: new Date("2026-09-11T12:20:00.000Z"),
      autorId: 7,
      arquivoUrl: null,
      arquivoTipo: null,
      autor: { id: 7, nome: "Dex", usuario: "dex" },
    },
    {
      id: 1,
      texto: "Preciso de ajuda",
      createdAt: new Date("2026-09-11T12:10:00.000Z"),
      autorId: 4,
      arquivoUrl: null,
      arquivoTipo: null,
      autor: { id: 4, nome: "Ana", usuario: "ana" },
    },
  ],
};

describe("listarChamadosAtivosTIAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "TI" } });
    mocks.chamadosFindMany.mockResolvedValue([chamadoPersistido]);
  });

  it.each(["TI", "T.I"])("autoriza a role normalizada %s e consulta somente chamados ativos", async (role) => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "7", role } });

    const resultado = await listarChamadosAtivosTIAction();

    expect(resultado.success).toBe(true);
    expect(mocks.chamadosFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    }));
    expect(resultado.chamados[0]).toMatchObject({
      id: 12,
      createdAt: "2026-09-11T12:00:00.000Z",
      updatedAt: "2026-09-11T13:00:00.000Z",
    });
    expect(resultado.chamados[0]?.mensagens.map((mensagem) => mensagem.id)).toEqual([1, 2]);
  });

  it.each(["Admin", "CEO", "Comercial"])("nega a role %s sem consultar o banco", async (role) => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "9", role } });

    const resultado = await listarChamadosAtivosTIAction();

    expect(resultado).toEqual({ success: false, chamados: [], error: "Permissão insuficiente" });
    expect(mocks.chamadosFindMany).not.toHaveBeenCalled();
  });
});

describe("enviarMensagemChamadoAtendidoTIAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "TI" } });
  });

  it("nega resposta rápida quando o chamado pertence a outro técnico", async () => {
    mocks.chamadosFindUnique.mockResolvedValue({ status: "EM_ATENDIMENTO", tecnicoId: 8 });

    await expect(enviarMensagemChamadoAtendidoTIAction(12, "Estou verificando")).resolves.toEqual({
      success: false,
      error: "Somente o técnico responsável pode responder por este painel.",
    });
  });

  it("nega resposta rápida quando o chamado não está em atendimento", async () => {
    mocks.chamadosFindUnique.mockResolvedValue({ status: "ABERTO", tecnicoId: null });

    await expect(enviarMensagemChamadoAtendidoTIAction(12, "Estou verificando")).resolves.toEqual({
      success: false,
      error: "Somente o técnico responsável pode responder por este painel.",
    });
  });
});
