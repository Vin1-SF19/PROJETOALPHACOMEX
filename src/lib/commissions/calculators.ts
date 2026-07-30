import type { RuleCalculation } from "./types";
import { resolveDsrFormula, type DsrFormulaInput } from "./dsr-formula";

/**
 * Calculadoras puras por tipo de cálculo (seção 16 do prompt original).
 * Todas retornam centavos (Int), com arredondamento explícito via Math.round —
 * política de arredondamento: sempre para o inteiro mais próximo, nunca truncamento
 * silencioso (ver decisions.md, "arredondamento de centavos").
 */

export interface CalculatorContext {
  /** Base comissionável em centavos, usada por PERCENTAGE/PROPORTIONAL. */
  commissionableBaseCents?: number;
  /** Usado por DSR — dados necessários para resolver a fórmula configurável. */
  dsrInput?: DsrFormulaInput;
}

export function calculateAmountCents(calculation: RuleCalculation, ctx: CalculatorContext = {}): number {
  switch (calculation.type) {
    case "PERCENTAGE": {
      const base = ctx.commissionableBaseCents ?? 0;
      const rate = calculation.rate ?? 0;
      return Math.round(base * rate);
    }
    case "FIXED":
      return calculation.fixedAmountCents ?? 0;
    case "PER_UNIT": {
      const perUnit = calculation.perUnitAmountCents ?? 0;
      const qty = calculation.quantity ?? 0;
      return Math.round(perUnit * qty);
    }
    case "ADDITIONAL":
      return calculation.fixedAmountCents ?? 0;
    case "DSR": {
      if (!ctx.dsrInput) {
        throw new Error("Cálculo do tipo DSR requer dsrInput no contexto.");
      }
      return resolveDsrFormula(calculation.dsrFormulaName ?? "PROPORCIONAL_DIAS_DESCANSO", ctx.dsrInput).valorCents;
    }
    case "CAP": {
      const base = ctx.commissionableBaseCents ?? 0;
      const cap = calculation.capCents ?? Number.POSITIVE_INFINITY;
      return Math.min(base, cap);
    }
    case "FLOOR": {
      const base = ctx.commissionableBaseCents ?? 0;
      const floor = calculation.floorCents ?? 0;
      return Math.max(base, floor);
    }
    case "PROPORTIONAL": {
      const base = ctx.commissionableBaseCents ?? 0;
      const proportion = calculation.proportion ?? 0;
      return Math.round(base * proportion);
    }
    case "SUM_OF_COMPONENTS":
      return (calculation.componentsCents ?? []).reduce((sum, c) => sum + c, 0);
    case "TOTAL_FIXO_COM_DSR":
      throw new Error(
        "TOTAL_FIXO_COM_DSR não deve ser resolvido por calculateAmountCents — é decomposto em COMISSAO+DSR separadamente em entry-generator.ts (via decomporTotalFixoComDsr).",
      );
    default: {
      const _exhaustive: never = calculation.type;
      return _exhaustive;
    }
  }
}
