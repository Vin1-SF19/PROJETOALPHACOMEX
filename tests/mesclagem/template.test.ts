import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  caminhoTemplateMesclagem,
  gerarTemplateMesclagem,
  gerarXlsxMesclagem,
  lerTemplateMesclagem,
} from "@/lib/mesclagem/template";

describe("Template mesclagem", () => {
  it("localiza o template oficial", () => {
    const caminho = caminhoTemplateMesclagem();
    expect(caminho).toContain("template-padrao.xlsx");
  });

  it("lê o template oficial", () => {
    const buffer = lerTemplateMesclagem();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("inclui cada DDD imediatamente antes de seu FONE sem perder o valor", async () => {
    const valores = Object.fromEntries(Array.from({ length: 5 }, (_, indice) => [
      `DDD${indice + 1}`,
      String(11 + indice),
    ]));
    const buffer = await gerarXlsxMesclagem({
      linhas: [{ id: "1", cnpj: "123", origemPrincipal: 2, origemComplementar: 2, valores }],
      mapeamento: Array.from({ length: 5 }, (_, indice) => ({
        destino: `DDD${indice + 1}`,
        origem: indice + 1,
        origemNome: `DDD${indice + 1}`,
        automatico: true,
      })),
    });
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    const cabecalhos = worksheet.getRow(1).values as unknown[];
    for (let indice = 1; indice <= 5; indice += 1) {
      const dddColuna = cabecalhos.indexOf(`DDD${indice}`);
      const foneColuna = cabecalhos.indexOf(`FONE${indice}`);
      expect(dddColuna).toBeGreaterThan(0);
      expect(foneColuna).toBe(dddColuna + 1);
      expect(worksheet.getRow(2).getCell(dddColuna).value).toBe(String(10 + indice));
    }
  });

  it("entrega o template baixável com DDD imediatamente antes de cada FONE", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await gerarTemplateMesclagem() as unknown as ArrayBuffer);
    const cabecalhos = workbook.worksheets[0].getRow(1).values as unknown[];

    for (let indice = 1; indice <= 5; indice += 1) {
      expect(cabecalhos.indexOf(`FONE${indice}`)).toBe(cabecalhos.indexOf(`DDD${indice}`) + 1);
    }
  });

  it("valida os 26 cabeçalhos da evidência real sem depender da posição", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const evidencia = await readFile(path.join(process.cwd(), "mesclagem-planilhas-2026-09-14 - resultado.xlsx"));
    await workbook.xlsx.load(evidencia as unknown as ArrayBuffer);
    const cabecalhos = (workbook.worksheets[0].getRow(1).values as unknown[]).slice(1);
    expect(cabecalhos).toHaveLength(26);
    expect(new Set(cabecalhos).size).toBe(26);
    expect(cabecalhos).toEqual(expect.arrayContaining(["CNPJ", "FONE1", "FG_WHATSAPP5", "Regime Tributário"]));
  });

  it("resolve valores por cabeçalho normalizado quando o template está fora de ordem", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const template = new ExcelJS.Workbook();
    template.addWorksheet("Template").addRow(["municÍpio", "CNPJ"]);
    const templateBuffer = Buffer.from(await template.xlsx.writeBuffer());
    const buffer = await gerarXlsxMesclagem({
      template: templateBuffer,
      linhas: [{
        id: "1", cnpj: "123", origemPrincipal: 2, origemComplementar: 2,
        valores: { CNPJ: "12.345.678/0001-95", "Município": "Recife" },
      }],
      mapeamento: [
        { destino: "CNPJ", origem: 1, origemNome: "CNPJ", automatico: true },
        { destino: "Município", origem: 2, origemNome: "Município", automatico: true },
      ],
    });
    const resultado = new ExcelJS.Workbook();
    await resultado.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(resultado.worksheets[0].getRow(2).getCell(1).value).toBe("Recife");
    expect(resultado.worksheets[0].getRow(2).getCell(2).value).toBe("12.345.678/0001-95");
  });
});
