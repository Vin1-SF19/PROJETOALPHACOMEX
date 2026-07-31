import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  commissionEntry: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  payment: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  paymentAllocation: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  commissionAuditLog: { create: vi.fn() },
  usuarios: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  EstornarPagamento,
  PrepararPagamentoLoteBigCard,
  RegistrarPagamento,
  RegistrarPagamentoLote,
} from "@/actions/CommissionPayments";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  prismaMock.usuarios.findMany.mockResolvedValue([{ id: 42, nome: "Sheila", cargo: "Closer" }]);
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
    componentes: [],
    alocacoes: [],
    ...overrides,
  };
}

describe("RegistrarPagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
    prismaMock.payment.create.mockResolvedValue({ id: "payment-1" });
    prismaMock.paymentAllocation.create.mockResolvedValue({ id: "alloc-1" });
  });

  it("pagamento que cobre o total marca o lançamento como Pago", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry());
    prismaMock.paymentAllocation.findMany.mockResolvedValue([{ valorCents: 35_000 }]);
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ status: "Pago" }));

    const result = await RegistrarPagamento({
      entryId: "entry-1",
      data: new Date("2026-08-07T00:00:00.000Z"),
      valorCents: 35_000,
      meio: "PIX",
    });

    expect(result.success).toBe(true);
    expect(prismaMock.commissionEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "Pago" }) }),
    );
    expect(prismaMock.commissionAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it("pagamento parcial (menor que o total) marca como ParcialmentePago", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ totalCents: 100_000 }));
    prismaMock.paymentAllocation.findMany.mockResolvedValue([{ valorCents: 40_000 }]);
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ status: "ParcialmentePago" }));

    const result = await RegistrarPagamento({
      entryId: "entry-1",
      data: new Date("2026-08-07T00:00:00.000Z"),
      valorCents: 40_000,
      meio: "PIX",
    });

    expect(result.success).toBe(true);
    expect(prismaMock.commissionEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ParcialmentePago" }) }),
    );
  });

  it("rejeita valor maior que o saldo pendente após pagamento parcial", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(
      entry({ totalCents: 100_000, status: "ParcialmentePago", alocacoes: [{ valorCents: 70_000 }] }),
    );

    const result = await RegistrarPagamento({
      entryId: "entry-1",
      data: new Date("2026-08-07T00:00:00.000Z"),
      valorCents: 40_000,
      meio: "PIX",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ultrapassa");
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("rejeita pagamento de lançamento já Pago (sem exceção, erro explícito)", async () => {
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ status: "Pago", alocacoes: [{ valorCents: 35_000 }] }));

    const result = await RegistrarPagamento({
      entryId: "entry-1",
      data: new Date("2026-08-07T00:00:00.000Z"),
      valorCents: 35_000,
      meio: "PIX",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Pago");
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("rejeita pagamento de lançamento Bloqueado/Cancelado/EmDivergencia", async () => {
    for (const status of ["Bloqueado", "Cancelado", "EmDivergencia"]) {
      prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ status }));
      const result = await RegistrarPagamento({
        entryId: "entry-1",
        data: new Date("2026-08-07T00:00:00.000Z"),
        valorCents: 35_000,
        meio: "PIX",
      });
      expect(result.success).toBe(false);
    }
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("sem sessão autenticada, rejeita antes de tocar no banco", async () => {
    authMock.mockResolvedValue(null);

    const result = await RegistrarPagamento({
      entryId: "entry-1",
      data: new Date("2026-08-07T00:00:00.000Z"),
      valorCents: 35_000,
      meio: "PIX",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionEntry.findUnique).not.toHaveBeenCalled();
  });
});

describe("PrepararPagamentoLoteBigCard / RegistrarPagamentoLote — nunca incluir silenciosamente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
  });

  it("preview exclui bloqueado/cancelado/divergente/pago/parcialmente pago, com motivo explícito para cada um", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([
      entry({ id: "e-pendente", status: "Pendente", totalCents: 10_000 }),
      entry({ id: "e-bloqueado", status: "Bloqueado" }),
      entry({ id: "e-cancelado", status: "Cancelado" }),
      entry({ id: "e-divergente", status: "EmDivergencia" }),
      entry({ id: "e-pago", status: "Pago" }),
      entry({ id: "e-parcial", status: "ParcialmentePago" }),
    ]);

    prismaMock.paymentAllocation.findMany.mockResolvedValue([]); // sem pagamentos prévios para o pendente

    const result = await PrepararPagamentoLoteBigCard({
      entryIds: ["e-pendente", "e-bloqueado", "e-cancelado", "e-divergente", "e-pago", "e-parcial"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elegiveis).toEqual([
        expect.objectContaining({ entryId: "e-pendente", valorPendenteCents: 10_000 }),
      ]);
      expect(result.data.excluidos).toHaveLength(5);
      const motivos = result.data.excluidos.map((e) => e.entryId);
      expect(motivos).toEqual(
        expect.arrayContaining(["e-bloqueado", "e-cancelado", "e-divergente", "e-pago", "e-parcial"]),
      );
      // Cada exclusão tem motivo textual, nunca omitido.
      for (const excluido of result.data.excluidos) {
        expect(excluido.motivo.length).toBeGreaterThan(0);
      }
    }
  });

  it("RegistrarPagamentoLote processa só os elegíveis e retorna os excluídos com motivo, sem incluir nada silenciosamente", async () => {
    prismaMock.commissionEntry.findMany.mockResolvedValue([
      entry({ id: "e-pendente", status: "Pendente", totalCents: 10_000 }),
      entry({ id: "e-pago", status: "Pago" }),
    ]);
    prismaMock.commissionEntry.findUnique.mockResolvedValue(
      entry({ id: "e-pendente", status: "Pendente", totalCents: 10_000 }),
    );

    prismaMock.paymentAllocation.findMany.mockResolvedValue([]);
    prismaMock.payment.create.mockResolvedValue({ id: "payment-lote-1" });
    prismaMock.paymentAllocation.create.mockResolvedValue({ id: "alloc-lote-1" });
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ status: "Pago" }));

    const result = await RegistrarPagamentoLote({
      entryIds: ["e-pendente", "e-pago"],
      data: new Date("2026-08-07T00:00:00.000Z"),
      meio: "PIX",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.processados).toEqual(["e-pendente"]);
      expect(result.data.excluidos).toEqual([
        expect.objectContaining({ entryId: "e-pago", motivo: "Já está pago" }),
      ]);
    }
    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1); // só para o elegível
  });
});

describe("EstornarPagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
  });

  it("estorno cria um NOVO Payment (tipo ESTORNO), nunca apaga o original", async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ id: "payment-1", tipo: "PAGAMENTO", meio: "PIX", estornoDeId: null });
    prismaMock.payment.findFirst.mockResolvedValue(null); // ainda não estornado
    prismaMock.paymentAllocation.findFirst.mockResolvedValue({ id: "alloc-1", entryId: "entry-1", valorCents: 35_000 });
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ status: "Pago", alocacoes: [{ valorCents: 35_000 }] }));
    prismaMock.payment.create.mockResolvedValue({ id: "payment-estorno-1" });
    prismaMock.paymentAllocation.create.mockResolvedValue({ id: "alloc-estorno-1" });
    prismaMock.paymentAllocation.findMany.mockResolvedValue([{ valorCents: 35_000 }, { valorCents: -35_000 }]);
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ status: "Pendente" }));

    const result = await EstornarPagamento({ paymentId: "payment-1", motivo: "Erro de digitação no valor" });

    expect(result.success).toBe(true);
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "ESTORNO", estornoDeId: "payment-1", valorCents: -35_000 }) }),
    );
    // Payment original nunca é atualizado/deletado.
    expect(prismaMock.payment.findUnique).toHaveBeenCalled();
  });

  it("reverte o status do CommissionEntry para Pendente quando o saldo líquido zera", async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ id: "payment-1", tipo: "PAGAMENTO", meio: "PIX", estornoDeId: null });
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.paymentAllocation.findFirst.mockResolvedValue({ id: "alloc-1", entryId: "entry-1", valorCents: 35_000 });
    prismaMock.commissionEntry.findUnique.mockResolvedValue(entry({ status: "Pago" }));
    prismaMock.payment.create.mockResolvedValue({ id: "payment-estorno-1" });
    prismaMock.paymentAllocation.create.mockResolvedValue({ id: "alloc-estorno-1" });
    prismaMock.paymentAllocation.findMany.mockResolvedValue([{ valorCents: 35_000 }, { valorCents: -35_000 }]); // saldo líquido = 0
    prismaMock.commissionEntry.update.mockResolvedValue(entry({ status: "Pendente" }));

    await EstornarPagamento({ paymentId: "payment-1", motivo: "Estorno total" });

    expect(prismaMock.commissionEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "Pendente" }) }),
    );
  });

  it("rejeita estornar um pagamento que já foi estornado (não duplica estorno)", async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ id: "payment-1", tipo: "PAGAMENTO", meio: "PIX", estornoDeId: null });
    prismaMock.payment.findFirst.mockResolvedValue({ id: "payment-estorno-ja-existente" }); // já foi estornado

    const result = await EstornarPagamento({ paymentId: "payment-1", motivo: "Tentativa duplicada" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("já foi estornado");
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("rejeita estornar um estorno (não permite estorno em cascata)", async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ id: "payment-estorno-1", tipo: "ESTORNO", meio: "PIX", estornoDeId: "payment-1" });

    const result = await EstornarPagamento({ paymentId: "payment-estorno-1", motivo: "Tentativa inválida" });

    expect(result.success).toBe(false);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});
