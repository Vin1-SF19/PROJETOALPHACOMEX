import { describe, expect, it } from "vitest";

import { criarFiltrosPesquisaExtratos } from "@/lib/extrato/pesquisa-extratos";

describe("pesquisa da listagem de extratos (Fase 3.3 do Cliente Master — razão social/CNPJ via `cliente`)", () => {
  it("normaliza CNPJ formatado para somente dígitos", () => {
    const where = criarFiltrosPesquisaExtratos("00.000.000/0001-00");

    expect(where).toEqual({
      OR: [
        { cliente: { razaoSocial: { contains: "00.000.000/0001-00" } } },
        { analistaResponsavel: { contains: "00.000.000/0001-00" } },
        { cliente: { cnpj: { contains: "00000000000100" } } },
      ],
    });
  });

  it("preserva CNPJ não formatado", () => {
    const where = criarFiltrosPesquisaExtratos("00000000000100");

    expect(where.OR).toContainEqual({ cliente: { cnpj: { contains: "00000000000100" } } });
  });

  it("pesquisa razão social (via cliente) sem adicionar condição vazia de CNPJ", () => {
    const where = criarFiltrosPesquisaExtratos("Alpha Comércio Ltda");

    expect(where.OR).toContainEqual({ cliente: { razaoSocial: { contains: "ALPHA COMÉRCIO LTDA" } } });
    expect(where.OR!.some((filtro) => "cliente" in filtro && "cnpj" in filtro.cliente)).toBe(false);
    expect(JSON.stringify(where)).not.toContain('"contains":""');
  });

  it("não cria filtros para uma pesquisa vazia", () => {
    expect(criarFiltrosPesquisaExtratos("   ")).toEqual({});
    expect(criarFiltrosPesquisaExtratos(undefined)).toEqual({});
  });
});
