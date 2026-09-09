import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiroAcesso: { findUnique: vi.fn() },
  parceiroTermo: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));
const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { atualizarTermo, getPermissaoParceiros } from "@/actions/parceiros";

describe("Lider Comercial com acesso total no modulo Parceiros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.parceiroTermo.findFirst.mockResolvedValue(null);
    prismaMock.parceiroTermo.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.parceiroTermo.create.mockResolvedValue({ id: 2 });
  });

  it("recebe as mesmas permissoes internas de Admin", async () => {
    authMock.mockResolvedValue({ user: { id: "7", role: "Lider Comercial" } });

    await expect(getPermissaoParceiros()).resolves.toEqual({
      isAdmin: true,
      podeEditar: true,
      podeExcluir: true,
      podeAprovar: true,
    });
    expect(prismaMock.parceiroAcesso.findUnique).not.toHaveBeenCalled();
  });

  it("pode publicar uma nova versao do termo", async () => {
    authMock.mockResolvedValue({ user: { id: "7", role: "Lider Comercial" } });

    const resultado = await atualizarTermo(
      "V2.0 - 2026",
      "Conteudo valido do termo de adesao atualizado.",
    );

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.parceiroTermo.create).toHaveBeenCalledWith({
      data: {
        versao: "V2.0 - 2026",
        conteudo: "Conteudo valido do termo de adesao atualizado.",
        ativo: true,
        criadoPorId: 7,
      },
    });
  });

  it("nao transforma um editor comum em administrador do modulo", async () => {
    authMock.mockResolvedValue({ user: { id: "8", role: "User" } });
    prismaMock.parceiroAcesso.findUnique.mockResolvedValue({
      podeEditar: true,
      podeExcluir: false,
      podeAprovar: false,
    });

    const resultado = await atualizarTermo(
      "V2.0 - 2026",
      "Conteudo valido do termo de adesao atualizado.",
    );

    expect(resultado.success).toBe(false);
    expect(prismaMock.parceiroTermo.create).not.toHaveBeenCalled();
  });
});
