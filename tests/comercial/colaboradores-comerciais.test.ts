import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  usuarios: { findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("./Clientes", () => ({ criarRegistroClienteAPartirDeContrato: vi.fn() }));

import { getColaboradoresComerciais } from "@/actions/ContratoComercial";

describe("getColaboradoresComerciais — opções do input Closer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
  });

  it("lista closers e líderes comerciais ativos", async () => {
    prismaMock.usuarios.findMany.mockResolvedValue([
      { id: 10, nome: "Closer Alpha", imagemUrl: null },
      { id: 20, nome: "Líder Alpha", imagemUrl: null },
    ]);

    const resultado = await getColaboradoresComerciais();

    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith({
      where: { role: { in: ["COMERCIAL", "Lider Comercial"] }, status: "ATIVO" },
      select: { id: true, nome: true, imagemUrl: true },
      orderBy: { nome: "asc" },
    });
    expect(resultado).toEqual({
      success: true,
      usuarios: [
        { id: 10, nome: "Closer Alpha", imagemUrl: null },
        { id: 20, nome: "Líder Alpha", imagemUrl: null },
      ],
    });
  });

  it("bloqueia sem sessão", async () => {
    authMock.mockResolvedValue(null);

    await expect(getColaboradoresComerciais()).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.usuarios.findMany).not.toHaveBeenCalled();
  });
});
