import { describe, expect, it } from "vitest";

import {
  calcularTotais,
  construirLinhasSalvar,
  obterStatusLinha,
} from "@/app/PainelAlpha/CadastroClientes/importacao/calculos";
import type { LinhaImportacaoPreview } from "@/lib/cs-nps/importacao-tipos";

const candidata = {
  clienteId: 10,
  cnpj: "12.345.678/0001-90",
  razaoSocial: "Empresa A",
  servico: "Contábil",
  status: "ATIVO",
};

const linhaAmbigua: LinhaImportacaoPreview = {
  id: "socios:2",
  tipo: "socios",
  aba: "Socios",
  numeroLinha: 2,
  identificador: { cnpj: candidata.cnpj, razaoSocial: null },
  dados: {
    nome: "Maria",
    telefone: null,
    observacao: null,
    dataNascimento: null,
    vinculo: null,
  },
  status: "ambigua",
  clienteIdSugerido: null,
  candidatos: [candidata, { ...candidata, clienteId: 11, servico: "Fiscal" }],
  mensagens: [],
};

const linhaValida: LinhaImportacaoPreview = {
  id: "cs:2",
  tipo: "cs",
  aba: "CS",
  numeroLinha: 2,
  identificador: { cnpj: null, razaoSocial: "Empresa A" },
  dados: {
    colaborador: "Ana",
    sentimento: "pos",
    observacao: "Contato realizado com sucesso",
    dataRegistro: null,
  },
  status: "valida",
  clienteIdSugerido: 10,
  candidatos: [candidata],
  mensagens: [],
};

describe("cálculos da revisão", () => {
  it("transforma ambiguidade em válida somente após escolher o destino", () => {
    expect(obterStatusLinha(linhaAmbigua, {})).toBe("ambigua");
    expect(obterStatusLinha(linhaAmbigua, { "socios:2": 11 })).toBe("valida");
    expect(calcularTotais([linhaAmbigua, linhaValida], {})).toMatchObject({
      total: 2,
      validas: 1,
      ambiguas: 1,
      invalidas: 0,
    });
    expect(calcularTotais([linhaAmbigua, linhaValida], { "socios:2": 11 })).toMatchObject({
      total: 2,
      validas: 2,
      ambiguas: 0,
      invalidas: 0,
    });
  });

  it("monta apenas linhas válidas e respeita remoção feita na revisão", () => {
    const selecoes = { "socios:2": 11 };
    const todas = construirLinhasSalvar([linhaAmbigua, linhaValida], selecoes);
    const aposRemoverSocio = construirLinhasSalvar([linhaValida], selecoes);

    expect(todas).toHaveLength(2);
    expect(todas[0]).toMatchObject({ id: "socios:2", clienteId: 11 });
    expect(aposRemoverSocio).toEqual([
      expect.objectContaining({ id: "cs:2", clienteId: 10 }),
    ]);
  });

  it("nunca inclui linha inválida, mesmo com clienteId injetado na seleção", () => {
    const invalida: LinhaImportacaoPreview = {
      ...linhaAmbigua,
      id: "socios:3",
      status: "invalida",
      mensagens: ["Data inválida"],
    };

    expect(construirLinhasSalvar([invalida], { "socios:3": 10 })).toEqual([]);
  });
});
