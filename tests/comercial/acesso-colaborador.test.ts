import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  comercialPerformance: { findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getPerformanceColaborador } from "@/actions/ComercialControle";

const SESSION_GISELLE = { user: { nome: "Giselle", role: "COMERCIAL" } };
const SESSION_OUTRO_CLOSER = { user: { nome: "Fulano", role: "COMERCIAL" } };
const SESSION_LIDER = { user: { nome: "Chefe", role: "Lider Comercial" } };

describe("getPerformanceColaborador — gate de role real (RM-2026-DA0B7D, Fase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("closer comum consegue ver os próprios leads", async () => {
    authMock.mockResolvedValue(SESSION_GISELLE);
    prismaMock.comercialPerformance.findMany.mockResolvedValue([{ id: 1, colaboradoraId: "Giselle" }]);

    const resultado = await getPerformanceColaborador("Giselle", new Date(2026, 8, 3));

    expect(resultado).toEqual([{ id: 1, colaboradoraId: "Giselle" }]);
  });

  it("closer comum NÃO consegue ver leads de outro closer (rejeitado mesmo chamando a Server Action direto)", async () => {
    authMock.mockResolvedValue(SESSION_OUTRO_CLOSER);

    await expect(getPerformanceColaborador("Giselle", new Date(2026, 8, 3))).rejects.toThrow(
      "Acesso negado: você só pode visualizar os próprios leads."
    );
    expect(prismaMock.comercialPerformance.findMany).not.toHaveBeenCalled();
  });

  it("Lider Comercial consegue ver leads de qualquer closer (trigger de troca de closer)", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    prismaMock.comercialPerformance.findMany
      .mockResolvedValueOnce([{ id: 1, colaboradoraId: "Giselle" }, { id: 2, colaboradoraId: "Giselle" }])
      .mockResolvedValueOnce([{ id: 3, colaboradoraId: "Fulano" }]);

    const leadsGiselle = await getPerformanceColaborador("Giselle", new Date(2026, 8, 3));
    const leadsFulano = await getPerformanceColaborador("Fulano", new Date(2026, 8, 3));

    expect(leadsGiselle).toHaveLength(2);
    expect(leadsFulano).toHaveLength(1);
    expect(prismaMock.comercialPerformance.findMany.mock.calls[0][0].where.colaboradoraId).toBe("Giselle");
    expect(prismaMock.comercialPerformance.findMany.mock.calls[1][0].where.colaboradoraId).toBe("Fulano");
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);
    await expect(getPerformanceColaborador("Giselle", new Date(2026, 8, 3))).rejects.toThrow("Não autenticado");
  });
});
