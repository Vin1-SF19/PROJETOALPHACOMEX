import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiro: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("bcryptjs", () => ({ hashSync: vi.fn(() => "senha-hash") }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

import { criarParceiro } from "@/actions/parceiros";

describe("responsável físico de parceiro PJ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    prismaMock.parceiro.create.mockResolvedValue({
      id: 10,
      nome: "Empresa Parceira",
    });
  });

  it("permite cadastrar o responsável informando somente o nome", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Responsável" }],
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.parceiro.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        representantes: {
          create: [{
            tipo: "PF",
            documento: "",
            nome: "Maria Responsável",
            dataNascimento: null,
            cargo: null,
            email: null,
            telefone: null,
          }],
        },
      }),
    });
  });

  it("continua exigindo ao menos um responsável com nome para PJ", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "  " }],
    });

    expect(resultado).toEqual({
      success: false,
      error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica",
    });
    expect(prismaMock.parceiro.create).not.toHaveBeenCalled();
  });
});
