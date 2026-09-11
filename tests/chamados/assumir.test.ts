import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  chamados: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
const notificarAgendaMock = vi.hoisted(() => vi.fn());
const notificarAssumidoMock = vi.hoisted(() => vi.fn());
const criarTarefaMock = vi.hoisted(() => vi.fn());

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: notificarAgendaMock,
  notificarChamadoAssumido: notificarAssumidoMock,
  notificarChamadoConcluido: vi.fn(),
  notificarMensagemChamado: vi.fn(),
  notificarNovoChamado: vi.fn(),
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: vi.fn(),
  criarTarefaAgendadaParaChamado: criarTarefaMock,
}));

import { assumirChamado } from "@/actions/chamados";

const SESSION = { user: { id: "3", role: "TI", nome: "Carlos Silva" } };

function chamadoAberto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    titulo: "Falha no acesso",
    descricao: "desc",
    usuarioId: 1,
    solucao: null,
    status: "ABERTO",
    tecnicoId: null,
    tecnicoSolicitadoId: null,
    tecnicoSolicitado: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("assumirChamado — fluxo 'Assumir Chamado'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION);
    criarTarefaMock.mockResolvedValue(undefined);
    notificarAssumidoMock.mockResolvedValue(true);
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(false);
    expect(prismaMock.chamados.updateMany).not.toHaveBeenCalled();
  });

  it("retorna erro quando o chamado não existe", async () => {
    prismaMock.chamados.findUnique.mockResolvedValue(null);

    const resultado = await assumirChamado(999);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/não encontrado/i);
  });

  it("rejeita quando o chamado já foi assumido por outro técnico", async () => {
    prismaMock.chamados.findUnique.mockResolvedValue(chamadoAberto({ tecnicoId: 7 }));

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/já foi assumido/i);
    expect(prismaMock.chamados.updateMany).not.toHaveBeenCalled();
  });

  it("rejeita quando o status não é o estado inicial (ABERTO)", async () => {
    prismaMock.chamados.findUnique.mockResolvedValue(chamadoAberto({ status: "EM_ATENDIMENTO" }));

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(false);
    expect(prismaMock.chamados.updateMany).not.toHaveBeenCalled();
  });

  it("vincula o usuário autenticado e move o status para EM_ATENDIMENTO", async () => {
    prismaMock.chamados.findUnique
      .mockResolvedValueOnce(chamadoAberto())
      .mockResolvedValueOnce(chamadoAberto());
    prismaMock.chamados.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(true);
    expect(resultado.chamado).toEqual({ id: 10, status: "EM_ATENDIMENTO", tecnicoId: 3 });
    expect(prismaMock.chamados.updateMany).toHaveBeenCalledWith({
      where: { id: 10, tecnicoId: null, status: "ABERTO", tecnicoSolicitadoId: null },
      data: { status: "EM_ATENDIMENTO", tecnicoId: 3 },
    });
    expect(notificarAgendaMock).toHaveBeenCalledWith(
      [1, 3],
      expect.objectContaining({
        chamadoId: 10,
        status: "EM_ATENDIMENTO",
      }),
    );
    expect(notificarAssumidoMock).toHaveBeenCalledWith(1, expect.objectContaining({
      chamadoId: 10,
      titulo: "Falha no acesso",
      tecnicoNome: "Carlos Silva",
    }));
  });

  it("rejeita uma assunção concorrente sem sobrescrever o técnico vencedor", async () => {
    prismaMock.chamados.findUnique.mockResolvedValue(chamadoAberto());
    prismaMock.chamados.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/já foi assumido/i);
    expect(notificarAssumidoMock).not.toHaveBeenCalled();
  });

  it("bloqueia outro técnico quando o solicitante indicou um responsável", async () => {
    prismaMock.chamados.findUnique.mockResolvedValue(chamadoAberto({
      tecnicoSolicitadoId: 9,
      tecnicoSolicitado: { nome: "Ana Souza" },
    }));

    const resultado = await assumirChamado(10);

    expect(resultado).toEqual({
      success: false,
      error: "O solicitante pediu que Ana Souza realizasse este chamado. Somente esse usuário pode assumir.",
    });
    expect(prismaMock.chamados.updateMany).not.toHaveBeenCalled();
  });

  it("permite que o técnico solicitado assuma com CAS da preferência", async () => {
    prismaMock.chamados.findUnique
      .mockResolvedValueOnce(chamadoAberto({
        tecnicoSolicitadoId: 3,
        tecnicoSolicitado: { nome: "Carlos Silva" },
      }))
      .mockResolvedValueOnce(chamadoAberto());
    prismaMock.chamados.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(true);
    expect(prismaMock.chamados.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tecnicoSolicitadoId: 3 }),
    }));
  });

  it("bloqueia ator sem role administrativa no servidor", async () => {
    authMock.mockResolvedValue({ user: { id: "4", role: "User", nome: "Colaborador" } });

    const resultado = await assumirChamado(10);

    expect(resultado).toEqual({ success: false, error: "Permissão insuficiente" });
    expect(prismaMock.chamados.findUnique).not.toHaveBeenCalled();
  });

  it("notifica o solicitante antes de aguardar a automação da Agenda Alpha", async () => {
    let liberarAgenda!: () => void;
    criarTarefaMock.mockImplementation(
      () => new Promise<void>((resolve) => {
        liberarAgenda = resolve;
      }),
    );
    prismaMock.chamados.findUnique
      .mockResolvedValueOnce(chamadoAberto())
      .mockResolvedValueOnce(chamadoAberto());
    prismaMock.chamados.updateMany.mockResolvedValue({ count: 1 });

    const resultadoPendente = assumirChamado(10);
    await vi.waitFor(() => expect(notificarAssumidoMock).toHaveBeenCalledTimes(1));
    expect(criarTarefaMock).toHaveBeenCalledTimes(1);

    liberarAgenda();
    await expect(resultadoPendente).resolves.toMatchObject({ success: true });
  });
});
