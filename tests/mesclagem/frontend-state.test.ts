import { describe, expect, it } from "vitest";
import type { CampoMapeamento, InspecaoPlanilha } from "@/lib/mesclagem";
import {
  mesclarSugestoesPreservandoManuais,
  reconciliarOverridesManuais,
  selecionarColunaCnpjDaAba,
} from "@/app/PainelAlpha/Mesclagem/workspace-state";

describe("Mesclagem workspace — estado concorrente", () => {
  it("preserva override manual ao aplicar uma nova resposta automática", () => {
    const atual: CampoMapeamento[] = [
      { destino: "DDD1", origem: null, origemNome: null, automatico: false, manual: true },
      { destino: "FONE1", origem: 2, origemNome: "Telefone antigo", automatico: true },
    ];
    const resposta: CampoMapeamento[] = [
      { destino: "DDD1", origem: 7, origemNome: "DDD", automatico: true },
      { destino: "FONE1", origem: 8, origemNome: "Celular", automatico: true },
    ];

    expect(mesclarSugestoesPreservandoManuais(atual, resposta)).toEqual([
      atual[0],
      resposta[1],
    ]);
  });

  it("reassocia override manual por nome único e limpa índice stale ou ambíguo", () => {
    const atual: CampoMapeamento[] = [
      { destino: "DDD1", origem: 2, origemNome: "DDD Sócio", automatico: false, manual: true },
      { destino: "FONE1", origem: 3, origemNome: "Telefone", automatico: false, manual: true },
      { destino: "EMAIL_SOCIO", origem: null, origemNome: null, automatico: false, manual: true },
    ];
    const resultado = reconciliarOverridesManuais(atual, [
      { numero: 8, nome: "DDD Socio", nomeNormalizado: "dddsocio" },
      { numero: 9, nome: "Telefone", nomeNormalizado: "telefone" },
      { numero: 10, nome: "TELEFONE", nomeNormalizado: "telefone" },
    ]);

    expect(resultado.mapeamento[0]).toMatchObject({ origem: 8, origemNome: "DDD Socio", manual: true });
    expect(resultado.mapeamento[1]).toMatchObject({ origem: null, origemNome: null, manual: true });
    expect(resultado.mapeamento[2]).toEqual(atual[2]);
    expect(resultado.descartados).toEqual(["FONE1"]);
  });

  it("recalcula a coluna CNPJ usando os cabeçalhos da nova aba", () => {
    const inspecao: InspecaoPlanilha = {
      nomeArquivo: "dados.xlsx",
      extensao: ".xlsx",
      colunasCnpjSugeridas: [1],
      abas: [
        { nome: "Antiga", totalLinhas: 1, colunas: [{ numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" }] },
        { nome: "Nova", totalLinhas: 1, colunas: [
          { numero: 1, nome: "Empresa", nomeNormalizado: "empresa" },
          { numero: 4, nome: "Documento CNPJ", nomeNormalizado: "documentocnpj" },
        ] },
      ],
    };

    expect(selecionarColunaCnpjDaAba(inspecao, inspecao.abas[1])).toBe(4);
  });
});
