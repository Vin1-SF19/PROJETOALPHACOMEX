import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  pessoaClienteVinculo: { findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  isAdminRole: vi.fn().mockReturnValue(false),
}));
// `server-only` não está instalado como dependência real (Next.js o fornece em
// runtime) — Cards.ts importa `realtime-server.ts`, que o usa; sem mock, o Vitest
// falha ao resolver o pacote antes de qualquer teste rodar.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));

import { ListarTelefonesCardBpm } from "@/actions/bpm/Cards";

describe("ListarTelefonesCardBpm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true });
  });

  it("bloqueia a consulta sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: [] });
    expect(exigirAcessoBpmCardMock).not.toHaveBeenCalled();
    expect(prismaMock.pessoaClienteVinculo.findMany).not.toHaveBeenCalled();
  });

  it("exige acesso de visualização ao card", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    exigirAcessoBpmCardMock.mockRejectedValue(new Error("Não autorizado"));

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith("card-1", 42, "User", "visualizar");
    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: [] });
    expect(prismaMock.pessoaClienteVinculo.findMany).not.toHaveBeenCalled();
  });

  it("busca Pessoas vinculadas ao Cliente (PessoaClienteVinculo) e remove telefones vazios", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ empresaId: 17 });
    prismaMock.pessoaClienteVinculo.findMany.mockResolvedValue([
      { pessoa: { id: 1, nome: "Ana", celular: " (11) 99999-0000 " } },
      { pessoa: { id: 2, nome: "Bruno", celular: "   " } },
    ]);

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(prismaMock.pessoaClienteVinculo.findMany).toHaveBeenCalledWith({
      where: { clienteId: 17 },
      select: { pessoa: { select: { id: true, nome: true, celular: true } } },
      orderBy: { pessoa: { nome: "asc" } },
    });
    expect(resultado).toEqual({
      success: true,
      data: [{ id: 1, nome: "Ana", telefone: "(11) 99999-0000" }],
    });
  });
});
