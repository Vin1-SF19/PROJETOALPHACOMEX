import { describe, expect, it } from "vitest";

import { criarFiltrosPesquisaExtratos } from "@/lib/extrato/pesquisa-extratos";

describe("pesquisa da listagem de extratos", () => {
  it("normaliza CNPJ formatado para somente dígitos", () => {
    const filtros = criarFiltrosPesquisaExtratos("00.000.000/0001-00");

    expect(filtros).toContainEqual({
      cnpj: { contains: "00000000000100" },
    });
  });

  it("preserva CNPJ não formatado", () => {
    const filtros = criarFiltrosPesquisaExtratos("00000000000100");

    expect(filtros).toContainEqual({
      cnpj: { contains: "00000000000100" },
    });
  });

  it("pesquisa razão social sem adicionar condição vazia de CNPJ", () => {
    const filtros = criarFiltrosPesquisaExtratos("Alpha Comércio Ltda");

    expect(filtros).toContainEqual({
      razaoSocial: { contains: "ALPHA COMÉRCIO LTDA" },
    });
    expect(filtros.some((filtro) => "cnpj" in filtro)).toBe(false);
    expect(JSON.stringify(filtros)).not.toContain('"contains":""');
  });

  it("não cria filtros para uma pesquisa vazia", () => {
    expect(criarFiltrosPesquisaExtratos("   ")).toEqual([]);
    expect(criarFiltrosPesquisaExtratos(undefined)).toEqual([]);
  });
});
