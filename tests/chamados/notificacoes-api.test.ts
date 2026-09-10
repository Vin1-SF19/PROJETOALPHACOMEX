import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  default: { mensagensChamado: { findMany: mocks.findMany } },
}));

import { GET } from "@/app/api/notificacoes/route";

describe("GET /api/notificacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recupera todas as mensagens não lidas do solicitante nos status atuais", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "42", role: "User" } });
    mocks.findMany.mockResolvedValue([{
      id: 91,
      texto: "Consegue verificar?",
      arquivoTipo: null,
      autorId: 8,
      createdAt: new Date("2026-09-09T20:00:00.000Z"),
      autor: { nome: "Carlos" },
      chamado: { id: 15, titulo: "Falha no acesso" },
    }]);

    const resposta = await GET();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        lida_usuario: false,
        chamado: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] }, usuarioId: 42 },
      }),
      take: 50,
    }));
    await expect(resposta.json()).resolves.toEqual({
      notificacoes: [expect.objectContaining({
        mensagemId: 91,
        chamadoId: 15,
        autorNome: "Carlos",
      })],
    });
  });

  it("usa a leitura administrativa sem restringir ao solicitante", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "8", role: "TI" } });
    mocks.findMany.mockResolvedValue([]);

    await GET();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        lida_admin: false,
        chamado: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] } },
      }),
    }));
  });
});
