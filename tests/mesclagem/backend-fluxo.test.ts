import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { criarMapeamentoInicial } from "@/lib/mesclagem/catalogo";
import {
  criarPreviaMesclagem,
  inspecionarArquivoMesclagem,
  processarMesclagem,
  sugerirMapeamentoMesclagem,
  validarMapeamentoMesclagem,
} from "@/lib/mesclagem/processamento";

function arquivoCsv(nome: string, conteudo: string): File {
  return new File([conteudo], nome, { type: "text/csv" });
}

async function arquivoExcel(nome: string): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const aba = workbook.addWorksheet("Dados");
  aba.addRow(["CNPJ", "Município"]);
  aba.addRow(["12.345.678/0001-95", "Recife"]);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], nome, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("Fluxo backend da Mesclagem", () => {
  it.each(["planilha.xlsx", "planilha.xlsm"])("processa o formato real %s", async (nome) => {
    const inspecao = await inspecionarArquivoMesclagem(await arquivoExcel(nome));
    expect(inspecao.extensao).toBe(nome.endsWith("xlsm") ? ".xlsm" : ".xlsx");
    expect(inspecao.abas[0].colunas.map((coluna) => coluna.nome)).toEqual(["CNPJ", "Município"]);
  });

  it("processa TSV real sem confundir delimitadores", async () => {
    const arquivo = new File(["CNPJ\tRazão Social\n12.345.678/0001-95\tEmpresa, LTDA"], "dados.tsv", { type: "text/tab-separated-values" });
    const inspecao = await inspecionarArquivoMesclagem(arquivo);
    expect(inspecao.abas[0].colunas).toHaveLength(2);
  });

  it("preserva newline e aspas escapadas no mesmo registro durante a mesclagem", async () => {
    const principal = arquivoCsv("principal.csv", "CNPJ\n12.345.678/0001-95");
    const complementar = arquivoCsv(
      "complementar.csv",
      'CNPJ;Razão Social\n12.345.678/0001-95;"Empresa ""Alpha""\nComércio"',
    );
    const mapeamento = criarMapeamentoInicial().map((campo) => campo.destino === "Razão Social"
      ? { ...campo, origem: 2, origemNome: "Razão Social", manual: true }
      : campo);
    const resultado = await processarMesclagem({ principal, complementar, mapeamento });
    expect(resultado.resultado.linhas).toHaveLength(1);
    expect(resultado.resultado.linhas[0].valores["Razão Social"]).toBe('Empresa "Alpha"\nComércio');
  });

  it("valida aba, coluna CNPJ e origem contra os cabeçalhos reais", async () => {
    const principal = arquivoCsv("principal.csv", "CNPJ;Município\n12.345.678/0001-95;Recife");
    const complementar = arquivoCsv("complementar.csv", "CNPJ;Cidade\n12.345.678/0001-95;Olinda");
    await expect(processarMesclagem({ principal, complementar, abaComplementar: "Inexistente" })).rejects.toMatchObject({ code: "MISSING_SHEET" });
    await expect(processarMesclagem({ principal, complementar, colunaCnpjPrincipal: 99 })).rejects.toMatchObject({ code: "INVALID_CNPJ_COLUMN" });
    expect(() => validarMapeamentoMesclagem(
      [{ destino: "Município", origem: 99 }],
      [{ numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" }],
      [{ numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" }],
    )).toThrow(/origem inválida/i);
  });

  it("rejeita resolvedores com mais de 200 colunas", () => {
    const colunas = Array.from({ length: 201 }, (_, indice) => ({
      numero: indice + 1,
      nome: `Coluna ${indice + 1}`,
      nomeNormalizado: `coluna ${indice + 1}`,
    }));
    expect(() => validarMapeamentoMesclagem(criarMapeamentoInicial(), colunas, []))
      .toThrow(/limite é de 200 colunas/i);
  });

  it("recalcula sugestões automáticas e preserva somente override manual", async () => {
    const anterior = criarMapeamentoInicial().map((campo) => campo.destino === "Município"
      ? { ...campo, origem: 2, origemNome: "Coluna antiga", automatico: true }
      : campo.destino === "UF"
        ? { ...campo, origem: null, manual: true }
        : { ...campo, manual: true });
    const resultado = await sugerirMapeamentoMesclagem({
      colunasPrincipal: [{ numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" }],
      colunasComplementar: [
        { numero: 1, nome: "CNPJ", nomeNormalizado: "cnpj" },
        { numero: 3, nome: "Município", nomeNormalizado: "municipio" },
      ],
      mapeamento: anterior,
    });
    expect(resultado.mapeamento.find((campo) => campo.destino === "Município")).toMatchObject({ origem: 3, automatico: true });
    expect(resultado.mapeamento.find((campo) => campo.destino === "UF")).toMatchObject({ origem: null, manual: true });
  });

  it("recalcula o resultado stateless após override", async () => {
    const principal = arquivoCsv("principal.csv", "CNPJ;Município\n12.345.678/0001-95;Recife");
    const complementar = arquivoCsv("complementar.csv", "CNPJ;Cidade A;Cidade B\n12.345.678/0001-95;Olinda;Paulista");
    const inicial = criarMapeamentoInicial().map((campo) => campo.destino === "Município"
      ? { ...campo, origem: 2, origemNome: "Cidade A", manual: true }
      : campo);
    const primeira = await processarMesclagem({ principal, complementar, mapeamento: inicial });
    expect(primeira.resultado.linhas[0].valores["Município"]).toBe("Olinda");

    const override = primeira.mapeamento.map((campo) => campo.destino === "Município"
      ? { ...campo, origem: 3, origemNome: "Cidade B", manual: true, automatico: false }
      : campo);
    const atualizada = await processarMesclagem({ principal, complementar, mapeamento: override });
    expect(atualizada.resultado.linhas[0].valores["Município"]).toBe("Paulista");
  });

  it("mantém Vazio manual sem reativar fallback ou automapeamento", async () => {
    const principal = arquivoCsv("principal.csv", "CNPJ;Município\n12.345.678/0001-95;Recife");
    const complementar = arquivoCsv("complementar.csv", "CNPJ;Município\n12.345.678/0001-95;Olinda");
    const mapeamento = criarMapeamentoInicial().map((campo) => campo.destino === "Município"
      ? { ...campo, origem: null, origemNome: null, manual: true }
      : campo);
    const processado = await processarMesclagem({ principal, complementar, mapeamento });
    const campo = processado.mapeamento.find((item) => item.destino === "Município");
    expect(campo).toMatchObject({ origem: null, manual: true, origemPrincipal: 2 });
    expect(processado.resultado.linhas[0].valores["Município"]).toBe("");
  });

  it("retorna apenas amostra compacta, mantendo o total calculado", async () => {
    const dados = Array.from({ length: 105 }, () => "12.345.678/0001-95;Recife").join("\n");
    const principal = arquivoCsv("principal.csv", `CNPJ;Município\n${dados}`);
    const complementar = arquivoCsv("complementar.csv", "CNPJ;Município\n12.345.678/0001-95;Olinda");
    const previa = await criarPreviaMesclagem({ principal, complementar, mapeamento: criarMapeamentoInicial() });
    expect(previa.resultado.resumo.totalLinhas).toBe(105);
    expect(previa.resultado.linhas).toHaveLength(100);
    expect(previa).not.toHaveProperty("linhasPrincipal");
    expect(previa).not.toHaveProperty("linhasComplementar");
    expect(previa).not.toHaveProperty("userId");
  });
});
