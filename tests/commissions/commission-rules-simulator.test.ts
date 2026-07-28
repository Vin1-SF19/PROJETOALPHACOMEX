import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("../../auth", () => ({ auth: authMock }));

import { SimularRegra } from "@/actions/CommissionRules";

function sessaoAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
}

describe("SimularRegra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoAdmin();
  });

  it("Closer com desconto de 10% à vista: retorna comissão 4% (fechou no tarifário) + DSR, sem persistir nada", async () => {
    const result = await SimularRegra({
      servico: "Revisão de RADAR Ilimitado",
      tarifarioCents: 2_200_000,
      valorContratadoCents: 2_200_000, // sem desconto — fecha no tarifário/acima
      formaPagamento: "A_VISTA_DESCONTO",
      cargoNome: "Closer",
      eventType: "CONTRACTING",
      dataEvento: new Date("2026-07-28T00:00:00.000Z"),
      vinculo: "CLT",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const comissao = result.data.resultadosPorTipo.find((r) => r.benefitType === "COMMISSION");
    const dsr = result.data.resultadosPorTipo.find((r) => r.benefitType === "DSR");

    expect(comissao?.regraVencedora).toContain("tarifário");
    expect(comissao?.calculatedAmountCents).toBe(Math.round(2_200_000 * 0.04));
    expect(dsr?.regraVencedora).not.toBeNull();
    expect(result.data.base?.preservedOriginalTariff).toBe(true);
  });

  it("Closer com desconto abaixo do tarifário: retorna comissão 2,5%", async () => {
    const result = await SimularRegra({
      servico: "Revisão de RADAR Ilimitado",
      tarifarioCents: 2_200_000,
      valorContratadoCents: 1_980_000, // 10% de desconto — abaixo do tarifário
      formaPagamento: "A_VISTA_DESCONTO",
      cargoNome: "Closer",
      eventType: "CONTRACTING",
      dataEvento: new Date("2026-07-28T00:00:00.000Z"),
      vinculo: "CLT",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const comissao = result.data.resultadosPorTipo.find((r) => r.benefitType === "COMMISSION");
    expect(comissao?.calculatedAmountCents).toBe(Math.round(2_200_000 * 0.025));
  });

  it("cargo sem nenhuma regra seed retorna ALERTA, nunca erro/exceção", async () => {
    const result = await SimularRegra({
      servico: "Serviço Qualquer",
      tarifarioCents: 100_000,
      valorContratadoCents: 100_000,
      formaPagamento: "PARCELADO_CONTRATACAO_EXITO",
      cargoNome: "Cargo Inexistente Nas Seeds",
      eventType: "CONTRACTING",
      dataEvento: new Date("2026-07-28T00:00:00.000Z"),
      vinculo: "CLT",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.resultadosPorTipo).toHaveLength(0);
    expect(result.data.alertas.length).toBeGreaterThan(0);
    expect(result.data.alertas[0]).toContain("Nenhuma regra ativa encontrada");
  });

  it("CLT vs PJ geram datas de vencimento DIFERENTES para a mesma simulação (Auditor Contábil, sempre PJ na regra, mas testando o parâmetro de vínculo)", async () => {
    const inputBase = {
      servico: "Revisão de RADAR Ilimitado",
      tarifarioCents: 2_200_000,
      valorContratadoCents: 2_200_000,
      formaPagamento: "A_VISTA_DESCONTO" as const,
      cargoNome: "Closer",
      eventType: "CONTRACTING" as const,
      dataEvento: new Date("2026-07-15T00:00:00.000Z"),
    };

    const comoCLT = await SimularRegra({ ...inputBase, vinculo: "CLT" });
    const comoPJ = await SimularRegra({ ...inputBase, vinculo: "PJ" });

    expect(comoCLT.success).toBe(true);
    expect(comoPJ.success).toBe(true);
    if (!comoCLT.success || !comoPJ.success) return;

    expect(comoCLT.data.contractualDueDate?.toISOString()).not.toBe(
      comoPJ.data.contractualDueDate?.toISOString(),
    );
  });

  it("desconto superior a 10% sem política configurada gera alerta sobre exigir decisão, não calcula silenciosamente", async () => {
    const result = await SimularRegra({
      servico: "Revisão de RADAR Ilimitado",
      tarifarioCents: 2_200_000,
      valorContratadoCents: 1_500_000, // ~31,8% de desconto
      formaPagamento: "A_VISTA_DESCONTO",
      cargoNome: "Closer",
      eventType: "CONTRACTING",
      dataEvento: new Date("2026-07-28T00:00:00.000Z"),
      vinculo: "CLT",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.base?.requiresApproval).toBe(true);
    expect(result.data.alertas.some((a) => a.toLowerCase().includes("requer decisão") || a.toLowerCase().includes("excede 10%"))).toBe(true);
  });

  it("sem sessão autenticada, rejeita antes de simular", async () => {
    authMock.mockResolvedValue(null);

    const result = await SimularRegra({
      servico: "Qualquer",
      tarifarioCents: 100_000,
      valorContratadoCents: 100_000,
      formaPagamento: "PARCELADO_CONTRATACAO_EXITO",
      cargoNome: "Closer",
      eventType: "CONTRACTING",
      dataEvento: new Date("2026-07-28T00:00:00.000Z"),
      vinculo: "CLT",
    });

    expect(result.success).toBe(false);
  });
});
