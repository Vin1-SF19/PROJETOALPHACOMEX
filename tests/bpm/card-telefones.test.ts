import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  socios: { findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  isAdminRole: vi.fn().mockReturnValue(false),
}));

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
    expect(prismaMock.socios.findMany).not.toHaveBeenCalled();
  });

  it("exige acesso de visualização ao card", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    exigirAcessoBpmCardMock.mockRejectedValue(new Error("Não autorizado"));

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith("card-1", 42, "User", "visualizar");
    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: [] });
    expect(prismaMock.socios.findMany).not.toHaveBeenCalled();
  });

  it("busca vínculos diretos e adicionais e remove telefones vazios", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ empresaId: 17 });
    prismaMock.socios.findMany.mockResolvedValue([
      { id: 1, nome: "Ana", telefone: " (11) 99999-0000 " },
      { id: 2, nome: "Bruno", telefone: "   " },
    ]);

    const resultado = await ListarTelefonesCardBpm("card-1");

    expect(prismaMock.socios.findMany).toHaveBeenCalledWith({
      where: {
        telefone: { not: null },
        OR: [
          { clienteId: 17 },
          { empresaVinculos: { some: { empresaId: 17 } } },
        ],
      },
      select: { id: true, nome: true, telefone: true },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });
    expect(resultado).toEqual({
      success: true,
      data: [{ id: 1, nome: "Ana", telefone: "(11) 99999-0000" }],
    });
  });
});
