import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ator: vi.fn(),
  mensagensFindMany: vi.fn(),
  feedbacksFindMany: vi.fn(),
}));

vi.mock("@/lib/chamados/acesso", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/chamados/acesso")>();
  return { ...original, obterAtorChamados: mocks.ator };
});
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  default: {
    mensagensChamado: { findMany: mocks.mensagensFindMany },
    chamadoFeedback: { findMany: mocks.feedbacksFindMany },
  },
}));

import { GET } from "@/app/api/notificacoes/route";

describe("GET /api/notificacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.feedbacksFindMany.mockResolvedValue([]);
    mocks.ator.mockResolvedValue({ id: 42, role: "Financeiro", setorId: 3, setorNome: "Financeiro", visaoGlobal: false });
  });

  it("recupera todas as mensagens não lidas do solicitante nos status atuais", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "User" } });
    mocks.mensagensFindMany.mockResolvedValue([{
      id: 91,
      texto: "Consegue verificar?",
      arquivoTipo: null,
      autorId: 8,
      createdAt: new Date("2026-09-09T20:00:00.000Z"),
      autor: { nome: "Carlos" },
      chamado: { id: 15, titulo: "Falha no acesso" },
    }]);

    const resposta = await GET();

    expect(mocks.mensagensFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { chamado: { usuarioId: 42 }, lida_usuario: false },
          { chamado: { usuarioId: { not: 42 }, OR: [{ tecnicoId: null }, { tecnicoId: 42, OR: [{ setorDestinoId: 3, setorDestino: { ativo: true, isBase: false } }] }] }, lida_admin: false },
        ],
        chamado: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] }, OR: [{ usuarioId: 42 }, { setorDestinoId: 3, setorDestino: { ativo: true, isBase: false } }] },
      }),
      take: 50,
    }));
    await expect(resposta.json()).resolves.toEqual({
      notificacoes: [expect.objectContaining({
        mensagemId: 91,
        chamadoId: 15,
        autorNome: "Carlos",
      })],
      feedbacksPendentes: [],
    });
  });

  it("usa a leitura administrativa sem restringir ao solicitante", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "8", role: "TI" } });
    mocks.ator.mockResolvedValue({ id: 8, role: "TI", setorId: 8, setorNome: "TI", visaoGlobal: true });
    mocks.mensagensFindMany.mockResolvedValue([]);

    await GET();

    expect(mocks.mensagensFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { chamado: { usuarioId: 8 }, lida_usuario: false },
          { chamado: { usuarioId: { not: 8 }, OR: [{ tecnicoId: null }, { tecnicoId: 8, OR: [{ setorDestinoId: 8, setorDestino: { ativo: true, isBase: false } }, { setorDestinoId: null }] }] }, lida_admin: false },
        ],
        chamado: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] } },
      }),
    }));
  });

  it("recupera feedback pendente somente pelo ownership do solicitante", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "User" } });
    mocks.mensagensFindMany.mockResolvedValue([]);
    mocks.feedbacksFindMany.mockResolvedValue([{
      chamadoId: 15,
      chamado: {
        titulo: "Falha no acesso",
        closedAt: new Date("2026-09-11T13:00:00.000Z"),
      },
    }]);

    const resposta = await GET();

    expect(mocks.feedbacksFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: "PENDENTE",
        chamado: {
          usuarioId: 42,
          status: "CONCLUIDO",
          closedAt: { not: null },
        },
      },
      take: 20,
    }));
    await expect(resposta.json()).resolves.toMatchObject({
      feedbacksPendentes: [{
        chamadoId: 15,
        titulo: "Falha no acesso",
        closedAt: "2026-09-11T13:00:00.000Z",
      }],
    });
  });

  it("nega recuperação de notificações para um usuário inativo mesmo com sessão válida", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "Admin" } });
    mocks.ator.mockResolvedValue(null);
    const resposta = await GET();
    expect(resposta.status).toBe(403);
    expect(mocks.mensagensFindMany).not.toHaveBeenCalled();
  });

  it("não apresenta uma fila vazia como autoritativa quando a leitura falha", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "User" } });
    mocks.mensagensFindMany.mockRejectedValue(new Error("indisponível"));

    const resposta = await GET();

    expect(resposta.status).toBe(500);
  });
});
