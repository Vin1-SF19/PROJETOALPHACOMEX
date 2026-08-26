import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiro: { findMany: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));

import { listarParceiros } from "@/actions/parceiros";

describe("Fase 07 — listarParceiros com filtros consolidados (aditivo, retrocompatível)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1" } });
    prismaMock.parceiro.findMany.mockResolvedValue([]);
  });

  it("chamada antiga (só busca/nivel) continua funcionando sem os filtros novos no where", async () => {
    await listarParceiros(undefined, "GOLD");
    expect(prismaMock.parceiro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nivel: "GOLD" } }),
    );
  });

  it("aplica estágio/potencial/segmento/origem/responsável quando informados", async () => {
    await listarParceiros(undefined, undefined, {
      estagioDesenvolvimento: "ATIVO",
      potencialMin: 4,
      segmento: "Comex",
      origem: "Indicação",
      responsavelId: 9,
    });
    expect(prismaMock.parceiro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          estagioDesenvolvimento: "ATIVO",
          potencialRecorrencia: { gte: 4 },
          segmento: { contains: "Comex" },
          origem: { contains: "Indicação" },
          responsavelId: 9,
        },
      }),
    );
  });
});
