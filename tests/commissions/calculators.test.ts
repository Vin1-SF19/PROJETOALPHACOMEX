import { describe, expect, it } from "vitest";
import { calculateAmountCents } from "@/lib/commissions/calculators";
import { resolveDsrFormula } from "@/lib/commissions/dsr-formula";
import type { RuleCalculation } from "@/lib/commissions/types";

describe("calculateAmountCents — tipos de cálculo (seção 16)", () => {
  it("PERCENTAGE", () => {
    const calc: RuleCalculation = { type: "PERCENTAGE", benefitType: "COMMISSION", rate: 0.04 };
    expect(calculateAmountCents(calc, { commissionableBaseCents: 2_200_000 })).toBe(88_000);
  });

  it("FIXED (valor fixo, ex: R$350,00 = 35000 centavos)", () => {
    const calc: RuleCalculation = { type: "FIXED", benefitType: "COMMISSION", fixedAmountCents: 35_000 };
    expect(calculateAmountCents(calc)).toBe(35_000);
  });

  it("PER_UNIT", () => {
    const calc: RuleCalculation = { type: "PER_UNIT", benefitType: "BONUS", perUnitAmountCents: 2_500, quantity: 3 };
    expect(calculateAmountCents(calc)).toBe(7_500);
  });

  it("ADDITIONAL (ex: R$100,00 de 1ª tentativa)", () => {
    const calc: RuleCalculation = { type: "ADDITIONAL", benefitType: "BONUS", fixedAmountCents: 10_000 };
    expect(calculateAmountCents(calc)).toBe(10_000);
  });

  it("CAP (teto)", () => {
    const calc: RuleCalculation = { type: "CAP", benefitType: "COMMISSION", capCents: 50_000 };
    expect(calculateAmountCents(calc, { commissionableBaseCents: 80_000 })).toBe(50_000);
    expect(calculateAmountCents(calc, { commissionableBaseCents: 30_000 })).toBe(30_000);
  });

  it("FLOOR (piso)", () => {
    const calc: RuleCalculation = { type: "FLOOR", benefitType: "COMMISSION", floorCents: 20_000 };
    expect(calculateAmountCents(calc, { commissionableBaseCents: 10_000 })).toBe(20_000);
    expect(calculateAmountCents(calc, { commissionableBaseCents: 30_000 })).toBe(30_000);
  });

  it("PROPORTIONAL", () => {
    const calc: RuleCalculation = { type: "PROPORTIONAL", benefitType: "COMMISSION", proportion: 0.5 };
    expect(calculateAmountCents(calc, { commissionableBaseCents: 100_000 })).toBe(50_000);
  });

  it("SUM_OF_COMPONENTS", () => {
    const calc: RuleCalculation = { type: "SUM_OF_COMPONENTS", benefitType: "COMMISSION", componentsCents: [35_000, 7_000, 10_000] };
    expect(calculateAmountCents(calc)).toBe(52_000);
  });

  it("DSR delega para a fórmula configurável (nunca percentual fixo hardcoded aqui)", () => {
    const calc: RuleCalculation = { type: "DSR", benefitType: "DSR", dsrFormulaName: "PROPORCIONAL_DIAS_DESCANSO" };
    const result = calculateAmountCents(calc, {
      dsrInput: { baseAmountCents: 35_000, diasUteis: 22, diasNaoUteis: 9 },
    });
    expect(result).toBeGreaterThan(0);
  });

  it("DSR sem dsrInput no contexto lança erro explícito (nunca calcula silenciosamente)", () => {
    const calc: RuleCalculation = { type: "DSR", benefitType: "DSR", dsrFormulaName: "PROPORCIONAL_DIAS_DESCANSO" };
    expect(() => calculateAmountCents(calc)).toThrow();
  });

  it("TOTAL_FIXO_COM_DSR nunca deve ser resolvido por calculateAmountCents (decomposto em entry-generator.ts)", () => {
    const calc: RuleCalculation = { type: "TOTAL_FIXO_COM_DSR", benefitType: "COMMISSION", totalFixoComDsrCents: 35_000 };
    expect(() => calculateAmountCents(calc)).toThrow();
  });
});

describe("resolveDsrFormula — validada com o espelho real (Maria Eduarda, Jun/2026)", () => {
  it("calcula DSR proporcional a dias de descanso / dias úteis do mês", () => {
    const result = resolveDsrFormula("PROPORCIONAL_DIAS_DESCANSO", {
      baseAmountCents: 22_000, // R$220,00
      diasUteis: 22,
      diasNaoUteis: 9,
    });

    expect(result.valorCents).toBe(Math.round((22_000 / 22) * 9));
  });

  it("bate exatamente com o espelho real: R$280 comissão + R$70 DSR (Jun/2026: 24 dias úteis, 6 de descanso)", () => {
    const result = resolveDsrFormula("PROPORCIONAL_DIAS_DESCANSO", {
      baseAmountCents: 28_000, // R$280,00
      diasUteis: 24,
      diasNaoUteis: 6,
    });

    expect(result.valorCents).toBe(7_000); // R$70,00
  });

  it("fórmula desconhecida lança erro explícito", () => {
    expect(() =>
      resolveDsrFormula("FORMULA_INEXISTENTE", { baseAmountCents: 1000, diasUteis: 20, diasNaoUteis: 10 }),
    ).toThrow(/desconhecida/);
  });

  it("diasUteis zero não calcula (evita divisão por zero) e retorna zero explicitamente", () => {
    const result = resolveDsrFormula("PROPORCIONAL_DIAS_DESCANSO", {
      baseAmountCents: 10_000,
      diasUteis: 0,
      diasNaoUteis: 5,
    });
    expect(result.valorCents).toBe(0);
  });
});

describe("decomporTotalFixoComDsr — decomposição algébrica do total fixo", () => {
  it("Analista Sênior: R$350 total, Jun/2026 (24 úteis, 6 descanso) → R$280 comissão + R$70 DSR", async () => {
    const { decomporTotalFixoComDsr } = await import("@/lib/commissions/dsr-formula");
    const result = decomporTotalFixoComDsr({ totalFixoCents: 35_000, diasUteis: 24, diasNaoUteis: 6 });

    expect(result.comissaoCents).toBe(28_000);
    expect(result.dsrCents).toBe(7_000);
    expect(result.comissaoCents + result.dsrCents).toBe(35_000); // nunca diverge do total fixo configurado
  });

  it("Analista II: R$250 total nunca diverge da soma comissão+DSR, mesmo com arredondamento", async () => {
    const { decomporTotalFixoComDsr } = await import("@/lib/commissions/dsr-formula");
    const result = decomporTotalFixoComDsr({ totalFixoCents: 25_000, diasUteis: 21, diasNaoUteis: 7 });

    expect(result.comissaoCents + result.dsrCents).toBe(25_000);
  });

  it("diasUteis zero: trata o total fixo como comissão integral, sem quebrar", async () => {
    const { decomporTotalFixoComDsr } = await import("@/lib/commissions/dsr-formula");
    const result = decomporTotalFixoComDsr({ totalFixoCents: 35_000, diasUteis: 0, diasNaoUteis: 6 });

    expect(result.comissaoCents).toBe(35_000);
    expect(result.dsrCents).toBe(0);
  });
});
