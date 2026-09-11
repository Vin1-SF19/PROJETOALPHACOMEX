import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  usuarioFindUnique: vi.fn(),
  chamadoFindFirst: vi.fn(),
  chamadoCreate: vi.fn(),
  notificarNovo: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: { findUnique: mocks.usuarioFindUnique },
    chamados: {
      findFirst: mocks.chamadoFindFirst,
      create: mocks.chamadoCreate,
    },
  },
}));
vi.mock("@/lib/pusher-server.ts", () => ({
  pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: vi.fn(),
  notificarChamadoAssumido: vi.fn(),
  notificarChamadoConcluido: vi.fn(),
  notificarMensagemChamado: vi.fn(),
  notificarNovoChamado: mocks.notificarNovo,
}));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({
  concluirTarefaAgendadaDoChamado: vi.fn(),
  criarTarefaAgendadaParaChamado: vi.fn(),
}));

import { createChamadoAction } from "@/actions/chamados";

function formData(overrides: Record<string, string> = {}): FormData {
  const dados = new FormData();
  const valores = {
    titulo: "Acesso ao sistema",
    categoria: "Acesso",
    prioridade: "MEDIA",
    descricao: "Preciso que meu perfil seja liberado",
    tecnicoSolicitadoId: "3",
    dataDesejadaConclusao: "2026-09-18",
    ...overrides,
  };
  Object.entries(valores).forEach(([chave, valor]) => dados.set(chave, valor));
  return dados;
}

describe("createChamadoAction — preferência e prazo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "7", nome: "Solicitante", role: "Comercial" },
    });
    mocks.usuarioFindUnique.mockResolvedValue({ id: 3, role: "T.I", status: "ATIVO" });
    mocks.chamadoFindFirst.mockResolvedValue(null);
    mocks.chamadoCreate.mockResolvedValue({
      id: 10,
      titulo: "Acesso ao sistema",
      prioridade: "MEDIA",
      createdAt: new Date("2026-09-11T13:00:00.000Z"),
    });
    mocks.notificarNovo.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("aceita role legada T.I ativa e mantém tecnicoId reservado para a assunção", async () => {
    await expect(createChamadoAction(formData())).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.usuarioFindUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { id: true, role: true, status: true },
    });
    expect(mocks.chamadoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 7,
        tecnicoSolicitadoId: 3,
        dataDesejadaConclusao: new Date("2026-09-18T03:00:00.000Z"),
        status: "ABERTO",
      }),
      select: expect.any(Object),
    });
    expect(mocks.chamadoCreate.mock.calls[0]?.[0].data).not.toHaveProperty("tecnicoId");
  });

  it("rejeita usuário inativo ou fora de TI antes de criar", async () => {
    mocks.usuarioFindUnique.mockResolvedValueOnce({ id: 3, role: "Financeiro", status: "ATIVO" });

    const resultado = await createChamadoAction(formData());

    expect(resultado).toEqual({
      error: "O técnico solicitado não está disponível para receber chamados.",
    });
    expect(mocks.chamadoCreate).not.toHaveBeenCalled();
  });

  it("cria sem preferência nem data quando os campos opcionais estão vazios", async () => {
    await expect(createChamadoAction(formData({
      tecnicoSolicitadoId: "",
      dataDesejadaConclusao: "",
    }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.usuarioFindUnique).not.toHaveBeenCalled();
    expect(mocks.chamadoCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tecnicoSolicitadoId: null,
        dataDesejadaConclusao: null,
      }),
    }));
  });
});
