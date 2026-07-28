import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

const prismaMock = vi.hoisted(() => ({
  cargoColaborador: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  setor: { findMany: vi.fn() },
  tariffVersion: { create: vi.fn(), findMany: vi.fn() },
  commissionRule: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  commissionRuleVersion: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  commissionAuditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { CriarCargo } from "@/actions/CommissionPositions";
import { CriarTarifario } from "@/actions/CommissionTariffs";
import { PublicarRegra, CriarVersaoRegra } from "@/actions/CommissionRuleBuilder";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

describe("CriarCargo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("vinculoPadrao inválido (não CLT/PJ) é rejeitado pelo Zod, nunca chega ao banco", async () => {
    const result = await CriarCargo({
      nome: "Cargo Teste",
      // @ts-expect-error — testando valor inválido de propósito
      vinculoPadrao: "EFETIVO",
      permiteMultiplosOcupantes: true,
    });

    expect(result.success).toBe(false);
    expect(prismaMock.cargoColaborador.create).not.toHaveBeenCalled();
  });

  it("cargo válido é criado normalmente", async () => {
    prismaMock.cargoColaborador.findUnique.mockResolvedValue(null);
    prismaMock.cargoColaborador.create.mockResolvedValue({ id: 1, nome: "Closer" });

    const result = await CriarCargo({
      nome: "Closer",
      vinculoPadrao: "CLT",
      naturezaRecebimento: "COMISSAO",
      permiteMultiplosOcupantes: true,
    });

    expect(result.success).toBe(true);
    expect(prismaMock.cargoColaborador.create).toHaveBeenCalledTimes(1);
  });

  it("rejeita nome duplicado sem tentar criar", async () => {
    prismaMock.cargoColaborador.findUnique.mockResolvedValue({ id: 1, nome: "Closer" });

    const result = await CriarCargo({ nome: "Closer", permiteMultiplosOcupantes: true });

    expect(result.success).toBe(false);
    expect(prismaMock.cargoColaborador.create).not.toHaveBeenCalled();
  });
});

describe("CriarTarifario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("cria tarifário corretamente com os campos obrigatórios", async () => {
    prismaMock.tariffVersion.create.mockResolvedValue({ id: "tarifario-1", servico: "Revisão de RADAR Ilimitado" });

    const result = await CriarTarifario({
      servico: "Revisão de RADAR Ilimitado",
      valorCents: 2_200_000,
      dataInicial: new Date("2026-07-01T00:00:00.000Z"),
      formasPagamentoJson: JSON.stringify(["A_VISTA_DESCONTO", "CARTAO_PARCELADO"]),
    });

    expect(result.success).toBe(true);
    expect(prismaMock.tariffVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ servico: "Revisão de RADAR Ilimitado", valorCents: 2_200_000 }),
      }),
    );
  });

  it("rejeita valorCents negativo", async () => {
    const result = await CriarTarifario({
      servico: "Revisão de RADAR Ilimitado",
      valorCents: -100,
      dataInicial: new Date("2026-07-01T00:00:00.000Z"),
      formasPagamentoJson: "[]",
    });

    expect(result.success).toBe(false);
    expect(prismaMock.tariffVersion.create).not.toHaveBeenCalled();
  });
});

describe("PublicarRegra / CriarVersaoRegra — versionamento imutável", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
    prismaMock.commissionAuditLog.create.mockResolvedValue({});
  });

  it("publica uma versão em DRAFT com sucesso", async () => {
    prismaMock.commissionRuleVersion.findUnique.mockResolvedValue({ id: "v1", status: "DRAFT" });
    prismaMock.commissionRuleVersion.update.mockResolvedValue({ id: "v1", status: "PUBLISHED" });

    const result = await PublicarRegra({ versionId: "v1" });

    expect(result.success).toBe(true);
    expect(prismaMock.commissionRuleVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PUBLISHED" }) }),
    );
  });

  it("rejeita publicar uma versão que já está PUBLISHED (nunca republica/sobrescreve)", async () => {
    prismaMock.commissionRuleVersion.findUnique.mockResolvedValue({ id: "v1", status: "PUBLISHED" });

    const result = await PublicarRegra({ versionId: "v1" });

    expect(result.success).toBe(false);
    expect(prismaMock.commissionRuleVersion.update).not.toHaveBeenCalled();
  });

  it("editar uma regra JÁ publicada cria versão NOVA (version incrementada) em vez de sobrescrever a antiga", async () => {
    prismaMock.commissionRule.findUnique.mockResolvedValue({ id: "rule-1", priority: 0 });
    // Última versão existente já está PUBLISHED, com version=1.
    prismaMock.commissionRuleVersion.findFirst.mockResolvedValue({ id: "v1", version: 1, status: "PUBLISHED" });
    prismaMock.commissionRuleVersion.create.mockResolvedValue({ id: "v2", version: 2, status: "DRAFT" });

    const result = await CriarVersaoRegra({
      ruleId: "rule-1",
      priority: 0,
      conditions: [],
      calculation: { type: "FIXED", benefitType: "COMMISSION", fixedAmountCents: 35_000 },
      paymentSchedule: { scheduleRuleName: "QUINTO_DIA_UTIL_CLT" },
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
    });

    expect(result.success).toBe(true);
    // A nova versão é criada com version=2 (incrementada a partir da version=1 anterior).
    expect(prismaMock.commissionRuleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 2, status: "DRAFT" }) }),
    );
    // A versão antiga (v1, PUBLISHED) NUNCA é atualizada/sobrescrita por esta operação —
    // nenhuma chamada de update foi feita sobre ela.
    expect(prismaMock.commissionRuleVersion.update).not.toHaveBeenCalled();
  });

  it("primeira versão de uma regra nova começa em version=1 quando não há versão anterior", async () => {
    prismaMock.commissionRule.findUnique.mockResolvedValue({ id: "rule-2", priority: 0 });
    prismaMock.commissionRuleVersion.findFirst.mockResolvedValue(null); // sem versão anterior
    prismaMock.commissionRuleVersion.create.mockResolvedValue({ id: "v1", version: 1, status: "DRAFT" });

    const result = await CriarVersaoRegra({
      ruleId: "rule-2",
      priority: 0,
      conditions: [],
      calculation: { type: "FIXED", benefitType: "COMMISSION", fixedAmountCents: 10_000 },
      paymentSchedule: { scheduleRuleName: "QUINTO_DIA_UTIL_CLT" },
      validFrom: new Date("2026-08-01T00:00:00.000Z"),
    });

    expect(result.success).toBe(true);
    expect(prismaMock.commissionRuleVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 1 }) }),
    );
  });
});
