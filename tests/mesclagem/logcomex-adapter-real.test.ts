import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { criarMapeamentoInicial } from "@/lib/mesclagem/catalogo";
import { detectarLayoutEntradaXlsx } from "@/lib/mesclagem/input-adapter";
import { inspecionarArquivoMesclagem, processarMesclagem } from "@/lib/mesclagem/processamento";
import { gerarXlsxMesclagem, lerTemplateMesclagem } from "@/lib/mesclagem/template";

const NOME_LOGCOMEX = "LISTA LOGCOMEX - HOUSE E DIRETO - 1 E 2 EMBARQUES - 05.03.2026 A 02.06.2026 - 50k e 150k.xlsx";
const CAMINHO_LOGCOMEX = path.join(process.cwd(), "Mesclagem", NOME_LOGCOMEX);
const CAMINHO_COMPLEMENTAR = path.join(process.cwd(), "Mesclagem", "2.xlsx");
const CAMINHO_LEGADO = path.join(process.cwd(), "Mesclagem", "1.xlsx");
const FIXTURES_REAIS_DISPONIVEIS = [CAMINHO_LOGCOMEX, CAMINHO_COMPLEMENTAR, CAMINHO_LEGADO].every(existsSync);

function arquivoReal(caminho: string): File {
  const buffer = readFileSync(caminho);
  return new File([buffer], path.basename(caminho), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function cabecalhos(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const nomes: string[] = [];
  workbook.worksheets[0].getRow(1).eachCell({ includeEmpty: false }, (celula) => nomes.push(String(celula.value ?? "")));
  return nomes;
}

describe.runIf(FIXTURES_REAIS_DISPONIVEIS)("Adapter do layout Logcomex estendido — fixture real", () => {
  it("detecta Empresas, expõe somente o modelo interno e escolhe o CNPJ completo", async () => {
    const arquivo = arquivoReal(CAMINHO_LOGCOMEX);
    expect(await detectarLayoutEntradaXlsx(await arquivo.arrayBuffer())).toBe("logcomex_extended");

    const inspecao = await inspecionarArquivoMesclagem(arquivo);
    expect(inspecao.abas).toHaveLength(1);
    expect(inspecao.abas[0].nome).toBe("Empresas");
    expect(inspecao.abas[0].totalLinhas).toBe(952);
    expect(inspecao.colunasCnpjSugeridas).toEqual([1]);
    expect(inspecao.abas[0].colunas.map((coluna) => coluna.nome)).toEqual([
      "CNPJ", "Razão Social", "Nome Fantasia", "Município", "UF",
      "Data de Constituição", "Regime Tributário", "Capital Social",
      "Situação da Habilitação", "Data da Situação", "Submodalidade", "Data Opção Simples",
    ]);
    expect(inspecao.abas[0].colunas.some((coluna) => /raiz|logcomex|receitaws/i.test(coluna.nome))).toBe(false);
  });

  it("mescla com a complementar real, preserva 1:N/sem-match e mantém exatamente o template", async () => {
    const templateAntes = lerTemplateMesclagem();
    const hashAntes = createHash("sha256").update(templateAntes).digest("hex");
    const processado = await processarMesclagem({
      principal: arquivoReal(CAMINHO_LOGCOMEX),
      complementar: arquivoReal(CAMINHO_COMPLEMENTAR),
      mapeamento: criarMapeamentoInicial(),
    });

    expect(processado.colunaCnpjPrincipal).toBe(1);
    expect(processado.resultado.resumo).toMatchObject({
      comMatch: 46,
      semMatch: 906,
      linhasComplementares: 62,
      totalLinhas: 968,
    });
    expect(processado.resultado.linhas.every((linha) => linha.cnpj === null || linha.cnpj.length === 14)).toBe(true);
    expect(processado.resultado.linhas.some((linha) => linha.origemComplementar === null)).toBe(true);
    expect(processado.resultado.linhas.filter((linha) => linha.origemComplementar !== null).length).toBe(62);
    const primeiraEmpresa = processado.resultado.linhas.find((linha) => linha.origemPrincipal === 2);
    expect(primeiraEmpresa?.valores).toMatchObject({
      CNPJ: "40196085000140",
      "Razão Social": "BR3PRO COMERCIO VAREJISTA LTDA",
      Município: "SAO PAULO",
      UF: "SP",
      "Data de Constituição": "24/12/2020",
      "Situação da Habilitação": "Habilitada",
      "Data da Situação": "06/11/2025",
      Submodalidade: "Limitada Até US$ 50 mil",
      "Data Opção Simples": "24/12/2020",
    });
    expect(Object.keys(primeiraEmpresa?.valores ?? {})).toHaveLength(criarMapeamentoInicial().length);

    const resultado = await gerarXlsxMesclagem({
      linhas: processado.resultado.linhas,
      mapeamento: processado.mapeamento,
      template: templateAntes,
    });
    expect(await cabecalhos(resultado)).toEqual(await cabecalhos(templateAntes));
    expect(await cabecalhos(resultado)).not.toEqual(expect.arrayContaining([
      "Raiz CNPJ", "CNPJ Logcomex", "ReceitaWS.qsa[0].nome", "ReceitaWS.atividade_principal[0].text",
    ]));
    expect(createHash("sha256").update(lerTemplateMesclagem()).digest("hex")).toBe(hashAntes);
  }, 30_000);

  it("mantém a fixture do layout antigo no adapter legacy", async () => {
    const arquivo = arquivoReal(CAMINHO_LEGADO);
    expect(await detectarLayoutEntradaXlsx(await arquivo.arrayBuffer())).toBe("legacy");
    const inspecao = await inspecionarArquivoMesclagem(arquivo);
    expect(inspecao.abas[0].totalLinhas).toBeGreaterThan(0);
    expect(inspecao.colunasCnpjSugeridas.length).toBeGreaterThan(0);
  }, 30_000);
});
