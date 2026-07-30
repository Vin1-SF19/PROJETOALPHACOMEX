import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  commissionEvent: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const gerarLancamentosParaEventoMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/commissions/entry-generator", () => ({ gerarLancamentosParaEvento: gerarLancamentosParaEventoMock }));

import { GerarLancamentosAutomaticosEvento } from "@/actions/CommissionEvents";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

describe("GerarLancamentosAutomaticosEvento — retroagir eventos sem lançamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("gera lançamentos para closer + analista responsável quando ambos resolvidos", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue({
      closerUsuarioId: 10,
      analistaResponsavelUsuarioId: 42,
    });
    gerarLancamentosParaEventoMock.mockResolvedValue({ entriesCreated: 2, entriesSkipped: 0, divergencesCreated: 0 });

    const result = await GerarLancamentosAutomaticosEvento({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    expect(gerarLancamentosParaEventoMock).toHaveBeenCalledWith({
      eventId: "evento-1",
      collaboratorIds: expect.arrayContaining([10, 42]),
    });
  });

  it("gera lançamento só para closer quando analista não está resolvido", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue({
      closerUsuarioId: 10,
      analistaResponsavelUsuarioId: null,
    });
    gerarLancamentosParaEventoMock.mockResolvedValue({ entriesCreated: 1, entriesSkipped: 0, divergencesCreated: 0 });

    await GerarLancamentosAutomaticosEvento({ eventId: "evento-1" });

    expect(gerarLancamentosParaEventoMock).toHaveBeenCalledWith({ eventId: "evento-1", collaboratorIds: [10] });
  });

  it("rejeita quando não há closer nem analista resolvidos — nunca chama o gerador à toa", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue({
      closerUsuarioId: null,
      analistaResponsavelUsuarioId: null,
    });

    const result = await GerarLancamentosAutomaticosEvento({ eventId: "evento-1" });

    expect(result.success).toBe(false);
    expect(gerarLancamentosParaEventoMock).not.toHaveBeenCalled();
  });

  it("evento inexistente é rejeitado", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);

    const result = await GerarLancamentosAutomaticosEvento({ eventId: "evento-inexistente" });

    expect(result.success).toBe(false);
    expect(gerarLancamentosParaEventoMock).not.toHaveBeenCalled();
  });
});
