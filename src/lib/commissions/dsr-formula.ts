/**
 * Fórmula de DSR (Descanso Semanal Remunerado) — validada e confirmada pelo usuário
 * (2026-07-30): DSR = (comissão base do lançamento ÷ dias úteis do mês) × dias de
 * descanso do mês (domingos + feriados nacionais/estaduais/municipais — SÁBADO NUNCA
 * conta como dia de descanso). Aplicada por lançamento individual, usando os dias
 * úteis/descanso do MÊS DO EVENTO (calendário fixo, independe de quantos lançamentos
 * existem no mês) — confirmado batendo com o espelho real da Maria Eduarda (Jun/2026:
 * 24 dias úteis, 6 de descanso, R$280 comissão + R$70 DSR = (280/24)×6 = 70).
 *
 * Para cargos com TOTAL FIXO (Analista II R$250, Sênior R$350 = comissão+DSR
 * combinados), a comissão base é obtida por decomposição algébrica — ver
 * `decomporTotalFixoComDsr` — nunca definida como um valor arbitrário separado do DSR.
 */

export interface DsrFormulaInput {
  /** Valor da comissão/prêmio sobre o qual o DSR incide, em centavos. */
  baseAmountCents: number;
  /** Quantidade de dias úteis no mês do evento. */
  diasUteis: number;
  /** Quantidade de domingos + feriados (nacional/estadual/municipal) no mês do evento. */
  diasNaoUteis: number;
}

export interface DsrFormulaResult {
  formulaName: string;
  valorCents: number;
  memoriaCalculo: {
    baseAmountCents: number;
    diasUteis: number;
    diasNaoUteis: number;
    formula: string;
  };
}

const DSR_FORMULAS: Record<string, (input: DsrFormulaInput) => DsrFormulaResult> = {
  /**
   * DSR = (comissão base ÷ dias úteis do mês) × dias de descanso do mês.
   * Validada pelo usuário em 2026-07-30 — bate com o espelho real (Maria Eduarda, Jun/2026).
   */
  PROPORCIONAL_DIAS_DESCANSO: (input) => {
    const { baseAmountCents, diasUteis, diasNaoUteis } = input;
    if (diasUteis <= 0) {
      return {
        formulaName: "PROPORCIONAL_DIAS_DESCANSO",
        valorCents: 0,
        memoriaCalculo: {
          baseAmountCents,
          diasUteis,
          diasNaoUteis,
          formula: "DSR não calculado: diasUteis deve ser maior que zero.",
        },
      };
    }
    const valorCents = Math.round((baseAmountCents / diasUteis) * diasNaoUteis);
    return {
      formulaName: "PROPORCIONAL_DIAS_DESCANSO",
      valorCents,
      memoriaCalculo: {
        baseAmountCents,
        diasUteis,
        diasNaoUteis,
        formula: `(${baseAmountCents} / ${diasUteis}) × ${diasNaoUteis} = ${valorCents}`,
      },
    };
  },
};

export function resolveDsrFormula(formulaName: string, input: DsrFormulaInput): DsrFormulaResult {
  const formula = DSR_FORMULAS[formulaName];
  if (!formula) {
    throw new Error(`Fórmula de DSR desconhecida: "${formulaName}". Fórmulas disponíveis: ${Object.keys(DSR_FORMULAS).join(", ")}`);
  }
  return formula(input);
}

export interface DecomposicaoTotalFixo {
  comissaoCents: number;
  dsrCents: number;
  totalCents: number;
  memoriaCalculo: {
    totalFixoCents: number;
    diasUteis: number;
    diasNaoUteis: number;
    formula: string;
  };
}

/**
 * Decompõe um TOTAL fixo (comissão+DSR combinados, ex: R$350 do Analista Sênior) em
 * comissão base + DSR, de forma que `comissao + (comissao/diasUteis)*diasNaoUteis` some
 * exatamente o total fixo. Álgebra: total = comissao × (1 + diasNaoUteis/diasUteis) →
 * comissao = total / (1 + diasNaoUteis/diasUteis) = total × diasUteis / (diasUteis + diasNaoUteis).
 * O resto (arredondamento) sempre vai para o DSR, nunca para a comissão, para o total
 * final bater exatamente com o valor fixo configurado (nunca perder/sobrar centavo).
 */
export function decomporTotalFixoComDsr(params: {
  totalFixoCents: number;
  diasUteis: number;
  diasNaoUteis: number;
}): DecomposicaoTotalFixo {
  const { totalFixoCents, diasUteis, diasNaoUteis } = params;

  if (diasUteis <= 0) {
    return {
      comissaoCents: totalFixoCents,
      dsrCents: 0,
      totalCents: totalFixoCents,
      memoriaCalculo: {
        totalFixoCents,
        diasUteis,
        diasNaoUteis,
        formula: "DSR não decomposto: diasUteis deve ser maior que zero. Total fixo tratado como comissão integral.",
      },
    };
  }

  const comissaoCents = Math.round((totalFixoCents * diasUteis) / (diasUteis + diasNaoUteis));
  const dsrCents = totalFixoCents - comissaoCents; // resto sempre no DSR — total nunca diverge do fixo configurado.

  return {
    comissaoCents,
    dsrCents,
    totalCents: totalFixoCents,
    memoriaCalculo: {
      totalFixoCents,
      diasUteis,
      diasNaoUteis,
      formula: `comissão = ${totalFixoCents} × ${diasUteis} / (${diasUteis} + ${diasNaoUteis}) = ${comissaoCents}; DSR = ${totalFixoCents} − ${comissaoCents} = ${dsrCents}`,
    },
  };
}
