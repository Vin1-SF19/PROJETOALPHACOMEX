/**
 * ⚠️ PENDÊNCIA CONSCIENTE (seção 39 do prompt original — NÃO deve ser inventada):
 * a fórmula definitiva do DSR (Descanso Semanal Remunerado) não foi validada pela gestão
 * responsável. Esta estrutura é CONFIGURÁVEL por competência (dias úteis, domingos,
 * feriados) — o valor abaixo ("PADRAO_PENDENTE_VALIDACAO") é um PLACEHOLDER documentado,
 * nunca deve ser tratado como fórmula final em produção sem confirmação explícita do
 * usuário/gestão. Ver `.bibble/memory/decisions.md`.
 */

export interface DsrFormulaInput {
  /** Valor da comissão/prêmio sobre o qual o DSR incide, em centavos. */
  baseAmountCents: number;
  /** Quantidade de dias úteis na competência (mês de referência). */
  diasUteis: number;
  /** Quantidade de domingos + feriados na competência. */
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
  /** Sempre true até a gestão validar formalmente uma fórmula definitiva. */
  pendingValidation: boolean;
}

const DSR_FORMULAS: Record<string, (input: DsrFormulaInput) => DsrFormulaResult> = {
  /**
   * Fórmula clássica de DSR sobre comissão variável (CLT, Lei 605/1949, art. 7º):
   * DSR = (soma da comissão no mês / dias úteis do mês) × dias não úteis do mês.
   * PLACEHOLDER — não confirmado pela gestão da Alpha Comex. Ver aviso no topo do arquivo.
   */
  PADRAO_PENDENTE_VALIDACAO: (input) => {
    const { baseAmountCents, diasUteis, diasNaoUteis } = input;
    if (diasUteis <= 0) {
      return {
        formulaName: "PADRAO_PENDENTE_VALIDACAO",
        valorCents: 0,
        memoriaCalculo: {
          baseAmountCents,
          diasUteis,
          diasNaoUteis,
          formula: "DSR não calculado: diasUteis deve ser maior que zero.",
        },
        pendingValidation: true,
      };
    }
    const valorCents = Math.round((baseAmountCents / diasUteis) * diasNaoUteis);
    return {
      formulaName: "PADRAO_PENDENTE_VALIDACAO",
      valorCents,
      memoriaCalculo: {
        baseAmountCents,
        diasUteis,
        diasNaoUteis,
        formula: `(${baseAmountCents} / ${diasUteis}) × ${diasNaoUteis} = ${valorCents}. FÓRMULA PENDENTE DE VALIDAÇÃO PELA GESTÃO — não usar como definitiva sem confirmação.`,
      },
      pendingValidation: true,
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
