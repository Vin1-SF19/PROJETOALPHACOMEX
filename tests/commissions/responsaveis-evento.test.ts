import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  commissionEvent: { findUnique: vi.fn(), update: vi.fn() },
  commissionEntry: { findMany: vi.fn() },
  commissionDivergence: { findMany: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  commissionAuditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { AtualizarResponsaveisEvento, BuscarEventoComLancamentos } from "@/actions/CommissionEntries";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

function eventoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "evento-1",
    eventType: "CONTRACTING",
    cnpj: "12345678000190",
    razaoSocial: "Alpha Import",
    nomeFantasia: null,
    servico: "Revisão de RADAR Ilimitado",
    eventDate: new Date("2026-07-15T00:00:00.000Z"),
    formaPagamento: "A_VISTA_DESCONTO",
    grossContractAmountCents: 2_200_000,
    netContractAmountCents: 2_200_000,
    commissionableBaseCents: 2_200_000,
    status: "OK",
    closerUsuarioId: null,
    closerNomeManual: null,
    analistaResponsavelUsuarioId: null,
    analistaResponsavelNomeManual: null,
    ...overrides,
  };
}

describe("BuscarEventoComLancamentos — resolução de closer/analista", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionEntry.findMany.mockResolvedValue([]);
    prismaMock.commissionDivergence.findMany.mockResolvedValue([]);
  });

  it("sem closer nem analista atribuídos: retorna null em ambos, nunca esconde o campo", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event.closerNome).toBeNull();
      expect(result.data.event.closerViaUsuario).toBe(false);
      expect(result.data.event.analistaResponsavelNome).toBeNull();
      expect(result.data.event.analistaResponsavelViaUsuario).toBe(false);
    }
  });

  it("closer via FK real: resolve o nome do usuário e marca closerViaUsuario=true", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({ closerUsuarioId: 10 }));
    prismaMock.usuarios.findUnique.mockResolvedValue({ nome: "Sheila" });

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event.closerNome).toBe("Sheila");
      expect(result.data.event.closerViaUsuario).toBe(true);
    }
  });

  it("analista só com nome manual (sem FK): resolve o texto e marca viaUsuario=false", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(
      eventoBase({ analistaResponsavelNomeManual: "Maria" }),
    );

    const result = await BuscarEventoComLancamentos({ eventId: "evento-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event.analistaResponsavelNome).toBe("Maria");
      expect(result.data.event.analistaResponsavelViaUsuario).toBe(false);
    }
  });
});

describe("AtualizarResponsaveisEvento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
  });

  it("preenche closer manualmente (nome) quando não havia nada atribuído", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.commissionEvent.update.mockResolvedValue(eventoBase({ closerNomeManual: "João" }));

    const result = await AtualizarResponsaveisEvento({ eventId: "evento-1", closerNomeManual: "João" });

    expect(result.success).toBe(true);
    expect(prismaMock.commissionEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closerNomeManual: "João", closerUsuarioId: null }),
      }),
    );
    expect(prismaMock.commissionAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it("atribui closer via FK real: limpa closerNomeManual automaticamente (nunca guarda os dois)", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase({ closerNomeManual: "Nome antigo" }));
    prismaMock.usuarios.findUnique.mockResolvedValue({ id: 10 });
    prismaMock.commissionEvent.update.mockResolvedValue(eventoBase({ closerUsuarioId: 10 }));

    const result = await AtualizarResponsaveisEvento({ eventId: "evento-1", closerUsuarioId: 10 });

    expect(result.success).toBe(true);
    expect(prismaMock.commissionEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closerUsuarioId: 10, closerNomeManual: null }),
      }),
    );
  });

  it("rejeita FK de usuário inexistente — nunca grava um vínculo inválido", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(eventoBase());
    prismaMock.usuarios.findUnique.mockResolvedValue(null);

    const result = await AtualizarResponsaveisEvento({ eventId: "evento-1", closerUsuarioId: 999 });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionEvent.update).not.toHaveBeenCalled();
  });

  it("evento inexistente é rejeitado", async () => {
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);

    const result = await AtualizarResponsaveisEvento({ eventId: "evento-inexistente", closerNomeManual: "X" });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionEvent.update).not.toHaveBeenCalled();
  });

  it("sem nenhum campo informado, Zod rejeita antes de chegar ao banco", async () => {
    const result = await AtualizarResponsaveisEvento({ eventId: "evento-1" });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionEvent.findUnique).not.toHaveBeenCalled();
  });
});
