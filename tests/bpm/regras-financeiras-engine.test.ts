import { describe, expect, it } from "vitest";

import {
  calcularRegraTributaria,
  selecionarRegraTributaria,
  type RegraTributariaAvaliavel,
} from "@/lib/bpm/regras-financeiras/motor";
import { FORMULA_LIQUIDO_PADRAO } from "@/lib/bpm/regras-financeiras/schemas";

function regra(
  id: string,
  prioridade: number,
  regime: string,
): RegraTributariaAvaliavel {
  return {
    id,
    nome: `Regra ${regime}`,
    prioridade,
    versao: 2,
    condicao: {
      operador: "AND",
      condicoes: [
        {
          tipo: "condicao",
          campo: { fonte: "cliente", campo: "regimeTributario" },
          operador: "igual",
          valor: regime,
        },
      ],
    },
    configuracao: {
      schemaVersion: 1,
      irrf: {
        aplicavel: true,
        aliquotaPercentual: 1.5,
        baseCalculo: "VALOR_BRUTO",
      },
      csrf: {
        aplicavel: true,
        aliquotaPercentual: 4.65,
        baseCalculo: "VALOR_BRUTO",
      },
      outrasRetencoes: [],
      formulaValorLiquido: FORMULA_LIQUIDO_PADRAO,
    },
  };
}

describe("motor de regras financeiras", () => {
  it("seleciona a primeira linha aplicável pela prioridade", () => {
    const selecionada = selecionarRegraTributaria(
      [regra("segunda", 20, "Lucro Real"), regra("primeira", 10, "Lucro Real")],
      { card: {}, cliente: { regimeTributario: "Lucro Real" } },
    );

    expect(selecionada?.id).toBe("primeira");
  });

  it("calcula IRRF, CSRF e líquido usando somente valores configurados", () => {
    const resultado = calcularRegraTributaria({
      regra: regra("regra-1", 10, "Lucro Real"),
      valorBrutoCents: 1_000_000,
      calculadoEm: new Date("2026-09-04T12:00:00.000Z"),
    });

    expect(resultado).toMatchObject({
      valorIrrfCents: 15_000,
      valorCsrfCents: 46_500,
      totalRetencoesCents: 61_500,
      valorLiquidoCents: 938_500,
    });
    expect(JSON.parse(resultado.memoriaCalculo)).toMatchObject({
      regra: { id: "regra-1", versao: 2 },
      resultados: { valorLiquidoCents: 938_500 },
    });
  });

  it("aceita retenção adicional e fórmula administrável", () => {
    const configurada = regra("regra-2", 10, "Lucro Real");
    configurada.configuracao.outrasRetencoes = [
      {
        nome: "ISS retido",
        tipo: "PERCENTUAL",
        aliquotaPercentual: 2,
        baseCalculo: "VALOR_BRUTO_MENOS_RETENCOES",
      },
    ];
    configurada.configuracao.formulaValorLiquido =
      "valorBruto - valorIrrf - valorCsrf - outrasRetencoes";

    const resultado = calcularRegraTributaria({
      regra: configurada,
      valorBrutoCents: 100_000,
    });

    expect(resultado.outrasRetencoesCents).toBe(1_877);
    expect(resultado.valorLiquidoCents).toBe(91_973);
  });

  it("rejeita identificador de fórmula fora da DSL segura", () => {
    const configurada = regra("regra-3", 10, "Lucro Real");
    configurada.configuracao.formulaValorLiquido = "process.exit(1)";

    expect(() =>
      calcularRegraTributaria({
        regra: configurada,
        valorBrutoCents: 100_000,
      }),
    ).toThrow();
  });
});

