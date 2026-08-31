import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  chamados: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarChamadoConcluido: vi.fn(),
  notificarNovoChamado: vi.fn(),
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: vi.fn(),
  criarTarefaAgendadaParaChamado: vi.fn().mockResolvedValue(undefined),
}));

import { assumirChamado } from "@/actions/chamados";

const SESSION = { user: { id: "3", role: "TI" } };

function chamadoAberto(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    titulo: "Falha no acesso",
    descricao: "desc",
    usuarioId: 1,
    solucao: null,
    status: "ABERTO",
    tecnicoId: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("assumirChamado — fluxo 'Assumir Chamado'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION);
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
      where: { id: 10, tecnicoId: null, status: "ABERTO" },
      data: { status: "EM_ATENDIMENTO", tecnicoId: 3 },
    });
  });

  it("rejeita uma assunção concorrente sem sobrescrever o técnico vencedor", async () => {
    prismaMock.chamados.findUnique.mockResolvedValue(chamadoAberto());
    prismaMock.chamados.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await assumirChamado(10);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/já foi assumido/i);
  });
});
