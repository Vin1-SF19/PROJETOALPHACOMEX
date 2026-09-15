import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { detectarLayoutEntradaXlsx, lerLinhasEntradaXlsx } from "@/lib/mesclagem/input-adapter";

const CABECALHOS_ASSINATURA = [
  "CNPJ", "CNPJ Logcomex", "Raiz CNPJ", "Razão Social", "Município (UF)",
  "Situação Radar (Siscomex)", "Modalidade", "Data Situação",
];

async function workbookBuffer(abas: Array<{ nome: string; cabecalhos: string[]; valores?: ExcelJS.CellValue[] }>): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const aba of abas) {
    const worksheet = workbook.addWorksheet(aba.nome);
    worksheet.addRow(aba.cabecalhos);
    worksheet.addRow(aba.valores ?? aba.cabecalhos.map(() => "valor"));
  }
  return await workbook.xlsx.writeBuffer() as ArrayBuffer;
}

describe("Detecção estrutural do adapter de entrada", () => {
  it("não confunde Raiz CNPJ isolada com o layout Logcomex", async () => {
    const buffer = await workbookBuffer([{ nome: "Empresas", cabecalhos: ["Raiz CNPJ", "Razão Social"] }]);
    expect(await detectarLayoutEntradaXlsx(buffer)).toBe("legacy");
  });

  it("mantém fallback legacy quando duas abas têm a mesma assinatura", async () => {
    const buffer = await workbookBuffer([
      { nome: "Empresas A", cabecalhos: CABECALHOS_ASSINATURA },
      { nome: "Empresas B", cabecalhos: CABECALHOS_ASSINATURA },
    ]);
    expect(await detectarLayoutEntradaXlsx(buffer)).toBe("legacy");
  });

  it("rejeita fórmula em campo selecionado do adapter", async () => {
    const valores: ExcelJS.CellValue[] = CABECALHOS_ASSINATURA.map(() => "valor");
    valores[0] = { formula: "1+1", result: 2 };
    const buffer = await workbookBuffer([{ nome: "Empresas", cabecalhos: CABECALHOS_ASSINATURA, valores }]);
    await expect(lerLinhasEntradaXlsx(buffer, "Empresas"))
      .rejects.toMatchObject({ code: "FORMULA_NOT_ALLOWED", status: 422 });
  });
});
