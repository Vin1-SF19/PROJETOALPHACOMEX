/**
 * Cálculo da base comissionável (seção 10 do prompt original).
 * Nunca incluir automaticamente na base: spread de parceiro, reembolsos, taxas,
 * tributos, valores de terceiros. Tudo em centavos (Int).
 */

export type FormaPagamento = "PARCELADO_CONTRATACAO_EXITO" | "CARTAO_PARCELADO" | "A_VISTA_DESCONTO";

/** Política de tratamento para desconto acima de 10% — decisão que NÃO deve ser inventada (seção 39). */
export type PoliticaDescontoAcimaDe10 =
  | "USAR_VALOR_PAGO"
  | "USAR_TARIFARIO"
  | "EXIGIR_APROVACAO"
  | "BASE_MANUAL"
  | "FORA_DO_PADRAO";

export interface CommissionableBaseInput {
  tariffAmountCents: number;
  contractAmountCents: number;
  formaPagamento: FormaPagamento;
  partnerSpreadCents?: number;
  thirdPartyCostsCents?: number;
  /** Cargo elegível à regra de preservação do tarifário em desconto ≤10% (Closer, Diretora Comercial). */
  preservaTarifarioEmDescontoAte10: boolean;
  /** Só usado quando desconto > 10% — decisão explícita de configuração, nunca fallback silencioso. */
  politicaDescontoAcimaDe10?: PoliticaDescontoAcimaDe10;
  /** Usado somente quando politicaDescontoAcimaDe10 === "BASE_MANUAL". */
  baseManualCents?: number;
}

export interface CommissionableBaseResult {
  grossContractAmountCents: number;
  partnerSpreadCents: number;
  thirdPartyCostsCents: number;
  discountAmountCents: number;
  netContractAmountCents: number;
  commissionableBaseCents: number;
  discountPercent: number;
  /** true quando a base preservou o tarifário original (desconto ≤10%, cargo elegível). */
  preservedOriginalTariff: boolean;
  /** true quando o desconto excede 10% e a política exige decisão humana antes de calcular. */
  requiresApproval: boolean;
  reason: string;
}

/**
 * Calcula a base comissionável a partir do tarifário, valor contratado e forma de pagamento.
 * Regra de desconto ≤10%: para Closer/Diretora Comercial, a base preserva o valor ORIGINAL
 * do tarifário mesmo com desconto à vista de até 10% (seção 10.1).
 * Regra de cartão com juros: calcula sobre o valor total do link, sem descontar taxa (10.2).
 * Regra de desconto >10%: NUNCA decide sozinho — aplica a política configurada (10.3).
 */
export function calculateCommissionableBase(input: CommissionableBaseInput): CommissionableBaseResult {
  const {
    tariffAmountCents,
    contractAmountCents,
    formaPagamento,
    partnerSpreadCents = 0,
    thirdPartyCostsCents = 0,
    preservaTarifarioEmDescontoAte10,
    politicaDescontoAcimaDe10,
    baseManualCents,
  } = input;

  const discountAmountCents = Math.max(tariffAmountCents - contractAmountCents, 0);
  const discountPercent = tariffAmountCents > 0 ? discountAmountCents / tariffAmountCents : 0;

  const grossContractAmountCents = tariffAmountCents;
  const netContractAmountCents = contractAmountCents - partnerSpreadCents - thirdPartyCostsCents;

  // Cartão com juros: base é o valor total do link (contractAmountCents), sem desconto de taxa.
  if (formaPagamento === "CARTAO_PARCELADO") {
    return {
      grossContractAmountCents,
      partnerSpreadCents,
      thirdPartyCostsCents,
      discountAmountCents: 0,
      netContractAmountCents,
      commissionableBaseCents: contractAmountCents,
      discountPercent: 0,
      preservedOriginalTariff: false,
      requiresApproval: false,
      reason: "Cartão parcelado com juros: base calculada sobre o valor total do link, sem desconto de taxa da operadora.",
    };
  }

  // 50% contratação + 50% êxito (padrão): sem desconto envolvido, base = tarifário.
  if (formaPagamento === "PARCELADO_CONTRATACAO_EXITO") {
    return {
      grossContractAmountCents,
      partnerSpreadCents,
      thirdPartyCostsCents,
      discountAmountCents: 0,
      netContractAmountCents,
      commissionableBaseCents: tariffAmountCents,
      discountPercent: 0,
      preservedOriginalTariff: false,
      requiresApproval: false,
      reason: "Forma de pagamento padrão (50% contratação + 50% êxito): base é o tarifário integral.",
    };
  }

  // À vista com desconto.
  if (discountPercent <= 0.1) {
    const base = preservaTarifarioEmDescontoAte10 ? tariffAmountCents : contractAmountCents;
    return {
      grossContractAmountCents,
      partnerSpreadCents,
      thirdPartyCostsCents,
      discountAmountCents,
      netContractAmountCents,
      commissionableBaseCents: base,
      discountPercent,
      preservedOriginalTariff: preservaTarifarioEmDescontoAte10,
      requiresApproval: false,
      reason: preservaTarifarioEmDescontoAte10
        ? `Pagamento à vista com desconto de até 10% (${(discountPercent * 100).toFixed(2)}%). A base comissionável foi preservada no valor original do tarifário.`
        : `Pagamento à vista com desconto de até 10% (${(discountPercent * 100).toFixed(2)}%). Cargo não elegível à preservação do tarifário — base é o valor efetivamente contratado.`,
    };
  }

  // Desconto > 10%: decisão NUNCA assumida sozinha — exige política configurada explicitamente.
  if (!politicaDescontoAcimaDe10) {
    return {
      grossContractAmountCents,
      partnerSpreadCents,
      thirdPartyCostsCents,
      discountAmountCents,
      netContractAmountCents,
      commissionableBaseCents: 0,
      discountPercent,
      preservedOriginalTariff: false,
      requiresApproval: true,
      reason: `Desconto de ${(discountPercent * 100).toFixed(2)}% excede 10% e nenhuma política foi configurada. Base não calculada — requer decisão explícita (usar valor pago, usar tarifário, exigir aprovação, base manual, ou marcar fora do padrão).`,
    };
  }

  switch (politicaDescontoAcimaDe10) {
    case "USAR_VALOR_PAGO":
      return {
        grossContractAmountCents, partnerSpreadCents, thirdPartyCostsCents, discountAmountCents,
        netContractAmountCents, commissionableBaseCents: contractAmountCents, discountPercent,
        preservedOriginalTariff: false, requiresApproval: false,
        reason: `Desconto acima de 10% (${(discountPercent * 100).toFixed(2)}%). Política configurada: usar valor efetivamente pago.`,
      };
    case "USAR_TARIFARIO":
      return {
        grossContractAmountCents, partnerSpreadCents, thirdPartyCostsCents, discountAmountCents,
        netContractAmountCents, commissionableBaseCents: tariffAmountCents, discountPercent,
        preservedOriginalTariff: true, requiresApproval: false,
        reason: `Desconto acima de 10% (${(discountPercent * 100).toFixed(2)}%). Política configurada: usar tarifário integral.`,
      };
    case "BASE_MANUAL":
      return {
        grossContractAmountCents, partnerSpreadCents, thirdPartyCostsCents, discountAmountCents,
        netContractAmountCents, commissionableBaseCents: baseManualCents ?? 0, discountPercent,
        preservedOriginalTariff: false, requiresApproval: baseManualCents === undefined,
        reason: baseManualCents !== undefined
          ? `Desconto acima de 10% (${(discountPercent * 100).toFixed(2)}%). Base manual aplicada conforme configuração.`
          : `Desconto acima de 10% (${(discountPercent * 100).toFixed(2)}%). Política é base manual, mas nenhum valor manual foi fornecido — requer decisão.`,
      };
    case "EXIGIR_APROVACAO":
    case "FORA_DO_PADRAO":
      return {
        grossContractAmountCents, partnerSpreadCents, thirdPartyCostsCents, discountAmountCents,
        netContractAmountCents, commissionableBaseCents: 0, discountPercent,
        preservedOriginalTariff: false, requiresApproval: true,
        reason: `Desconto acima de 10% (${(discountPercent * 100).toFixed(2)}%). Política configurada exige aprovação humana antes de calcular a base — não calculado automaticamente.`,
      };
    default: {
      const _exhaustive: never = politicaDescontoAcimaDe10;
      return _exhaustive;
    }
  }
}
