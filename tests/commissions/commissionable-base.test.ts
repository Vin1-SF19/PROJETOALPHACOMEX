import { describe, expect, it } from "vitest";
import { calculateCommissionableBase } from "@/lib/commissions/commissionable-base";

describe("calculateCommissionableBase — seção 10 do prompt original", () => {
  it("desconto de 10% à vista: preserva o tarifário original para Closer/Diretora Comercial", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000, // R$22.000,00
      contractAmountCents: 1_980_000, // R$19.800,00 (10% de desconto)
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: true,
    });

    expect(result.commissionableBaseCents).toBe(2_200_000);
    expect(result.preservedOriginalTariff).toBe(true);
    expect(result.discountAmountCents).toBe(220_000);
    expect(Math.round(result.discountPercent * 100)).toBe(10);
    expect(result.requiresApproval).toBe(false);
  });

  it("desconto de 10% mas cargo NÃO elegível à preservação: usa valor efetivamente pago", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 1_980_000,
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: false,
    });

    expect(result.commissionableBaseCents).toBe(1_980_000);
    expect(result.preservedOriginalTariff).toBe(false);
  });

  it("desconto superior a 10% sem política configurada: não calcula, exige decisão", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 1_500_000, // ~31,8% de desconto
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: true,
    });

    expect(result.requiresApproval).toBe(true);
    expect(result.commissionableBaseCents).toBe(0);
  });

  it("desconto superior a 10% com política USAR_TARIFARIO", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 1_500_000,
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: true,
      politicaDescontoAcimaDe10: "USAR_TARIFARIO",
    });

    expect(result.commissionableBaseCents).toBe(2_200_000);
    expect(result.requiresApproval).toBe(false);
  });

  it("desconto superior a 10% com política USAR_VALOR_PAGO", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 1_500_000,
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: true,
      politicaDescontoAcimaDe10: "USAR_VALOR_PAGO",
    });

    expect(result.commissionableBaseCents).toBe(1_500_000);
  });

  it("desconto superior a 10% com política EXIGIR_APROVACAO: nunca calcula sozinho", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 1_500_000,
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: true,
      politicaDescontoAcimaDe10: "EXIGIR_APROVACAO",
    });

    expect(result.requiresApproval).toBe(true);
  });

  it("cartão parcelado com juros: calcula sobre o valor total do link, sem descontar taxa", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 2_400_000, // valor do link com juros do parcelamento
      formaPagamento: "CARTAO_PARCELADO",
      preservaTarifarioEmDescontoAte10: true,
    });

    expect(result.commissionableBaseCents).toBe(2_400_000);
    expect(result.discountAmountCents).toBe(0);
  });

  it("forma de pagamento padrão (50% contratação + 50% êxito): base é o tarifário integral", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 2_200_000,
      formaPagamento: "PARCELADO_CONTRATACAO_EXITO",
      preservaTarifarioEmDescontoAte10: true,
    });

    expect(result.commissionableBaseCents).toBe(2_200_000);
  });

  it("exclusão de spread e custos de terceiros do valor líquido (netContractAmountCents)", () => {
    const result = calculateCommissionableBase({
      tariffAmountCents: 2_200_000,
      contractAmountCents: 2_200_000,
      formaPagamento: "PARCELADO_CONTRATACAO_EXITO",
      preservaTarifarioEmDescontoAte10: true,
      partnerSpreadCents: 50_000,
      thirdPartyCostsCents: 30_000,
    });

    // netContractAmountCents nunca inclui spread/custos de terceiros — separado explicitamente.
    expect(result.netContractAmountCents).toBe(2_200_000 - 50_000 - 30_000);
    expect(result.partnerSpreadCents).toBe(50_000);
    expect(result.thirdPartyCostsCents).toBe(30_000);
    // A base comissionável (tarifário) não é afetada pelo spread/custos de terceiros.
    expect(result.commissionableBaseCents).toBe(2_200_000);
  });
});
