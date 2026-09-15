import { describe, expect, it } from "vitest";

import { criarMapeamentoInicial } from "@/lib/mesclagem/catalogo";
import { mapearCamposAutomaticos, mesclarPlanilhas } from "@/lib/mesclagem/mesclador";
import { validarMapeamentoMesclagem } from "@/lib/mesclagem/processamento";
import type { ColunaPlanilha, LinhaPlanilha } from "@/lib/mesclagem/tipos";

function digitoCnpj(base: string, pesos: number[]): number {
  const soma = base.split("").reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjSintetico(indice: number): string {
  const base = String(10_000_000_000 + indice).padStart(12, "0");
  const primeiro = digitoCnpj(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoCnpj(`${base}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${primeiro}${segundo}`;
}

const colunasPrincipal: ColunaPlanilha[] = [
  { numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" },
  { numero: 2, nome: "Situação", nomeNormalizado: "situacao" },
  { numero: 3, nome: "Data Situação", nomeNormalizado: "data situacao" },
  { numero: 4, nome: "Data Const.", nomeNormalizado: "data const" },
  { numero: 5, nome: "Regime", nomeNormalizado: "regime" },
];

const colunasComplementar: ColunaPlanilha[] = [
  { numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" },
  { numero: 2, nome: "Situação", nomeNormalizado: "situacao" },
  { numero: 3, nome: "Data Situação", nomeNormalizado: "data situacao" },
  { numero: 4, nome: "Data Const.", nomeNormalizado: "data const" },
  { numero: 5, nome: "Regime", nomeNormalizado: "regime" },
];

describe("Regressão das planilhas de referência 1, 2 e 3", () => {
  it("reproduz a cardinalidade 1:N e preserva o fallback nas 95 linhas sem correspondência", () => {
    const principal: LinhaPlanilha[] = Array.from({ length: 1_812 }, (_, indice) => ({
      numero: indice + 2,
      valores: {
        1: cnpjSintetico(indice),
        2: "ATIVA",
        3: "15/09/2026",
        4: "01/01/2020",
        5: "Lucro Presumido",
      },
    }));
    const complementar: LinhaPlanilha[] = [];
    for (let indice = 0; indice < 1_717; indice += 1) {
      const repeticoes = indice < 797 ? 2 : 1;
      for (let repeticao = 0; repeticao < repeticoes; repeticao += 1) {
        complementar.push({
          numero: complementar.length + 2,
          valores: {
            1: cnpjSintetico(indice),
            2: "ATIVA",
            3: "15/09/2026",
            4: "01/01/2020",
            5: "Lucro Presumido",
          },
        });
      }
    }

    const comFallbackPrincipal = validarMapeamentoMesclagem(
      criarMapeamentoInicial(), colunasComplementar, colunasPrincipal,
    );
    const mapeamento = mapearCamposAutomaticos(comFallbackPrincipal, colunasComplementar);
    const resultado = mesclarPlanilhas({
      principal,
      complementar,
      colunaCnpjPrincipal: 1,
      colunaCnpjComplementar: 1,
      mapeamento,
    });

    expect(resultado.resumo).toMatchObject({
      totalLinhas: 2_609,
      comMatch: 1_717,
      semMatch: 95,
      linhasComplementares: 2_514,
    });
    const semMatch = resultado.linhas.filter((linha) => linha.origemComplementar === null);
    expect(semMatch).toHaveLength(95);
    expect(semMatch.every((linha) =>
      linha.valores["Situação da Habilitação"] === "ATIVA" &&
      linha.valores["Data da Situação"] === "15/09/2026" &&
      linha.valores["Data de Constituição"] === "01/01/2020" &&
      linha.valores["Regime Tributário"] === "Lucro Presumido"
    )).toBe(true);
  });
});
