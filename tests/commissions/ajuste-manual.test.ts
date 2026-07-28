import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  commissionEntry: { findUnique: vi.fn(), update: vi.fn() },
  manualAdjustment: { create: vi.fn() },
  entryComponent: { create: vi.fn() },
  commissionAuditLog: { create: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  cargoColaborador: { findUnique: vi.fn() },
  setor: { findUnique: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { CriarAjusteManual } from "@/actions/CommissionEntries";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    eventId: "evento-1",
    collaboratorId: 42,
    cargoId: 1,
    vinculo: "CLT",
    totalCents: 35_000,
    status: "Pendente",
    ...overrides,
  };
}

describe("CriarAjusteManual — seção 30 do prompt original", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock));
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
  });

  it("cria ajuste manual: gera ManualAdjustment + EntryComponent tipo AJUSTE com a diferença + atualiza totalCents", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ totalCents: 35_000 }));
    prismaMock.manualAdjustment.create.mockResolvedValue({ id: "ajuste-1" });
    prismaMock.entryComponent.create.mockResolvedValue({ id: "comp-ajuste" });
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ totalCents: 40_000 }));

    const result = await CriarAjusteManual({
      entryId: "entry-1",
      valorAjustadoCents: 40_000,
      justificativa: "Correção de valor combinado com o cliente",
    });

    expect(result.success).toBe(true);

    expect(prismaMock.manualAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          valorOriginalCents: 35_000,
          valorAjustadoCents: 40_000,
        }),
      }),
    );

    // O componente AJUSTE guarda a DIFERENÇA (5.000), nunca reescreve os componentes originais.
    expect(prismaMock.entryComponent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: "AJUSTE", valorCents: 5_000 }),
      }),
    );

    expect(prismaMock.commissionEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { totalCents: 40_000 } }),
    );

    expect(prismaMock.commissionAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it("ajuste negativo (redução de valor) gera componente AJUSTE com valor negativo", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ totalCents: 35_000 }));
    prismaMock.manualAdjustment.create.mockResolvedValue({ id: "ajuste-2" });
    prismaMock.entryComponent.create.mockResolvedValue({ id: "comp-ajuste-2" });
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ totalCents: 30_000 }));

    const result = await CriarAjusteManual({
      entryId: "entry-1",
      valorAjustadoCents: 30_000,
      justificativa: "Ajuste para baixo por erro de cálculo anterior",
    });

    expect(result.success).toBe(true);
    expect(prismaMock.entryComponent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "AJUSTE", valorCents: -5_000 }) }),
    );
  });

  it("rejeita ajuste em lançamento já Pago — nunca calcula sozinho sobre valor já quitado", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ status: "Pago" }));

    const result = await CriarAjusteManual({
      entryId: "entry-1",
      valorAjustadoCents: 40_000,
      justificativa: "Tentativa de ajuste após pagamento",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.manualAdjustment.create).not.toHaveBeenCalled();
    expect(prismaMock.commissionEntry.update).not.toHaveBeenCalled();
  });

  it("rejeita ajuste em lançamento Estornado", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ status: "Estornado" }));

    const result = await CriarAjusteManual({
      entryId: "entry-1",
      valorAjustadoCents: 40_000,
      justificativa: "Tentativa de ajuste após estorno",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.manualAdjustment.create).not.toHaveBeenCalled();
  });

  it("rejeita justificativa curta demais (Zod) antes de chegar ao banco", async () => {
    const result = await CriarAjusteManual({
      entryId: "entry-1",
      valorAjustadoCents: 40_000,
      justificativa: "curta",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionEntry.findUnique).not.toHaveBeenCalled();
  });

  it("lançamento inexistente é rejeitado", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(null);

    const result = await CriarAjusteManual({
      entryId: "entry-inexistente",
      valorAjustadoCents: 40_000,
      justificativa: "Ajuste em lançamento que não existe",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.manualAdjustment.create).not.toHaveBeenCalled();
  });

  it("sem sessão autenticada, rejeita antes de tudo", async () => {
    authMock.mockResolvedValue(null);

    const result = await CriarAjusteManual({
      entryId: "entry-1",
      valorAjustadoCents: 40_000,
      justificativa: "Ajuste sem sessão válida",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionEntry.findUnique).not.toHaveBeenCalled();
  });
});
