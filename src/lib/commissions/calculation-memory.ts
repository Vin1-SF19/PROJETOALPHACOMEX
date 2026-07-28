import type { CommissionRuleVersionData } from "./types";
import type { CommissionableBaseResult } from "./commissionable-base";

/**
 * Objeto de memória de cálculo (seção 17 do prompt original) — todo lançamento deve
 * possuir uma explicação completa e legível do porquê do valor calculado.
 */
export interface CalculationMemory {
  ruleName: string;
  ruleVersion: number;
  eventType: string;
  tariffAmountCents?: number;
  contractAmountCents?: number;
  discountPercent?: number;
  commissionableBaseCents?: number;
  rate?: number;
  calculatedAmountCents: number;
  reason: string;
}

export function buildCalculationMemory(params: {
  rule: CommissionRuleVersionData;
  calculatedAmountCents: number;
  base?: CommissionableBaseResult;
  extraReason?: string;
}): CalculationMemory {
  const { rule, calculatedAmountCents, base, extraReason } = params;

  const reasonParts: string[] = [];
  if (base?.reason) reasonParts.push(base.reason);
  if (extraReason) reasonParts.push(extraReason);

  return {
    ruleName: rule.ruleName,
    ruleVersion: rule.version,
    eventType: rule.eventType,
    tariffAmountCents: base?.grossContractAmountCents,
    contractAmountCents: base ? base.netContractAmountCents + base.partnerSpreadCents + base.thirdPartyCostsCents : undefined,
    discountPercent: base ? Math.round(base.discountPercent * 10000) / 100 : undefined,
    commissionableBaseCents: base?.commissionableBaseCents,
    rate: rule.calculation.rate,
    calculatedAmountCents,
    reason: reasonParts.length > 0 ? reasonParts.join(" ") : "Cálculo aplicado conforme regra vigente.",
  };
}
