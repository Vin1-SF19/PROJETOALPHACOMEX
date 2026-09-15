import { describe, expect, it } from "vitest";
import { mesclarPlanilhas, diagnosticarCnjs } from "@/lib/mesclagem/mesclador";
import type { LinhaPlanilha } from "@/lib/mesclagem/tipos";

function linhas(arrays: string[][]): LinhaPlanilha[] {
  return arrays.map((valores, indice) => ({ numero: indice + 2, valores }));
}

describe("Mesclador", () => {
  it("preserva relação 1:N", () => {
    const principal = linhas([["12.345.678/0001-95"]]);
    const complementar = linhas([["12.345.678/0001-95"], ["12.345.678/0001-95"]]);
    const resultado = mesclarPlanilhas({ principal, complementar, colunaCnpjPrincipal: 0, colunaCnpjComplementar: 0, mapeamento: [] });
    expect(resultado.resumo.totalLinhas).toBe(2);
    expect(resultado.resumo.comMatch).toBe(1);
    expect(resultado.resumo.semMatch).toBe(0);
  });

  it("mantém principal sem match", () => {
    const principal = linhas([["12.345.678/0001-95"]]);
    const complementar = linhas([["98.765.432/0001-95"]]);
    const resultado = mesclarPlanilhas({ principal, complementar, colunaCnpjPrincipal: 0, colunaCnpjComplementar: 0, mapeamento: [] });
    expect(resultado.resumo.totalLinhas).toBe(1);
    expect(resultado.resumo.comMatch).toBe(0);
    expect(resultado.resumo.semMatch).toBe(1);
  });

  it("diagnostica CNPJs", () => {
    const principal = linhas([["12.345.678/0001-95"], ["12.345.678/0001-96"]]);
    const diagnostico = diagnosticarCnjs(principal, 0);
    expect(diagnostico.validos).toBe(1);
    expect(diagnostico.invalidos).toBe(1);
  });

  it("separa duplicados válidos de inválidos e preserva repetição", () => {
    const principal = linhas([
      ["12.345.678/0001-95"],
      ["12.345.678/0001-95"],
      ["12.345.678/0001-96"],
      [""],
    ]);
    const diagnostico = diagnosticarCnjs(principal, 0);
    expect(diagnostico).toMatchObject({ total: 4, validos: 1, duplicados: 1, invalidos: 1, vazios: 1 });
    expect(diagnostico.exemplosInvalidos).toEqual(["12345678000196"]);
  });

  it("preserva o produto de principal repetida por complementar 1:N", () => {
    const principal = linhas([["12.345.678/0001-95"], ["12.345.678/0001-95"]]);
    const complementar = linhas([["12.345.678/0001-95"], ["12.345.678/0001-95"]]);
    const resultado = mesclarPlanilhas({ principal, complementar, colunaCnpjPrincipal: 0, colunaCnpjComplementar: 0, mapeamento: [] });
    expect(resultado.linhas).toHaveLength(4);
    expect(new Set(resultado.linhas.map((linha) => linha.id)).size).toBe(4);
  });

  it("rejeita multiplicidade adversarial por CNPJ antes de materializar", () => {
    const principal = linhas([["12.345.678/0001-95"]]);
    const complementar = linhas(Array.from({ length: 1_001 }, () => ["12.345.678/0001-95"]));
    expect(() => mesclarPlanilhas({ principal, complementar, colunaCnpjPrincipal: 0, colunaCnpjComplementar: 0, mapeamento: [] }))
      .toThrow(expect.objectContaining({ code: "CNPJ_MULTIPLICITY_TOO_HIGH", status: 413 }));
  });

  it("calcula overflow-safe o limite global da expansão 1:N", () => {
    const principal = linhas(Array.from({ length: 101 }, () => ["12.345.678/0001-95"]));
    const complementar = linhas(Array.from({ length: 1_000 }, () => ["12.345.678/0001-95"]));
    expect(() => mesclarPlanilhas({ principal, complementar, colunaCnpjPrincipal: 0, colunaCnpjComplementar: 0, mapeamento: [] }))
      .toThrow(expect.objectContaining({ code: "MERGE_RESULT_TOO_LARGE", status: 413 }));
  });

  it("usa o cabeçalho equivalente da principal quando a complementar está vazia", () => {
    const principal = linhas([["12.345.678/0001-95", "", "São Paulo"]]);
    const complementar = linhas([["12.345.678/0001-95", "", ""]]);
    const resultado = mesclarPlanilhas({
      principal,
      complementar,
      colunaCnpjPrincipal: 0,
      colunaCnpjComplementar: 0,
      mapeamento: [{ destino: "Município", origem: 2, origemNome: "Município", origemPrincipal: 2, origemPrincipalNome: "Município", automatico: true }],
    });
    expect(resultado.linhas[0].valores["Município"]).toBe("São Paulo");
  });

  it("usa a principal mesmo quando não existe origem complementar", () => {
    const principal = linhas([["12.345.678/0001-95", "Campinas"]]);
    const resultado = mesclarPlanilhas({
      principal,
      complementar: [],
      colunaCnpjPrincipal: 0,
      colunaCnpjComplementar: 0,
      mapeamento: [{ destino: "Município", origem: null, origemNome: null, origemPrincipal: 1, origemPrincipalNome: "Município", automatico: false }],
    });
    expect(resultado.linhas[0].valores["Município"]).toBe("Campinas");
  });

  it("preserva os campos oficiais abreviados da principal nas linhas sem match", () => {
    const principal = linhas([[
      "12.345.678/0001-95", "ATIVA", "2026-09-15T00:00:00.000Z", "2020-01-01T00:00:00.000Z", "Lucro Presumido",
    ]]);
    const resultado = mesclarPlanilhas({
      principal,
      complementar: [],
      colunaCnpjPrincipal: 0,
      colunaCnpjComplementar: 0,
      mapeamento: [
        { destino: "Situação da Habilitação", origem: null, origemNome: null, origemPrincipal: 1, origemPrincipalNome: "Situação", automatico: false },
        { destino: "Data da Situação", origem: null, origemNome: null, origemPrincipal: 2, origemPrincipalNome: "Data Situação", automatico: false },
        { destino: "Data de Constituição", origem: null, origemNome: null, origemPrincipal: 3, origemPrincipalNome: "Data Const.", automatico: false },
        { destino: "Regime Tributário", origem: null, origemNome: null, origemPrincipal: 4, origemPrincipalNome: "Regime", automatico: false },
      ],
    });

    expect(resultado.linhas[0].valores).toMatchObject({
      "Situação da Habilitação": "ATIVA",
      "Data da Situação": "15/09/2026",
      "Data de Constituição": "01/01/2020",
      "Regime Tributário": "Lucro Presumido",
    });
  });
});
