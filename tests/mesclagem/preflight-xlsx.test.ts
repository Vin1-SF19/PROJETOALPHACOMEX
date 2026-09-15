import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { validarPreflightXlsxMesclagem } from "@/lib/mesclagem/preflight-xlsx";
import { carregarWorkbookXlsx } from "@/lib/mesclagem/parsing";

function arrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe("Preflight XLSX da Mesclagem", () => {
  it("aceita XLSX real antes do ExcelJS", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Dados").addRow(["CNPJ", "Município"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(validarPreflightXlsxMesclagem(arrayBuffer(buffer))).resolves.toBeUndefined();
  });

  it("rejeita metadados com taxa típica de ZIP bomb", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "types");
    zip.file("xl/workbook.xml", "workbook");
    zip.file("xl/worksheets/sheet1.xml", "A".repeat(512 * 1024));
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
    await expect(validarPreflightXlsxMesclagem(arrayBuffer(buffer)))
      .rejects.toMatchObject({ code: "ZIP_BOMB", status: 413 });
    await expect(carregarWorkbookXlsx(arrayBuffer(buffer), "bomba.xlsx", ".xlsx"))
      .rejects.toMatchObject({ code: "ZIP_BOMB", status: 413 });
  });

  it("rejeita quantidade adversarial de worksheets pelos metadados", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "types");
    zip.file("xl/workbook.xml", "workbook");
    for (let indice = 1; indice <= 51; indice += 1) {
      zip.file(`xl/worksheets/sheet${indice}.xml`, `<worksheet id="${indice}"/>`);
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await expect(validarPreflightXlsxMesclagem(arrayBuffer(buffer)))
      .rejects.toMatchObject({ code: "TOO_MANY_WORKSHEETS", status: 413 });
  });

  it("limita colunas reais após o preflight e antes do processamento", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Dados").addRow(Array.from({ length: 201 }, (_, indice) => `Campo ${indice}`));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(carregarWorkbookXlsx(arrayBuffer(buffer), "largo.xlsx", ".xlsx"))
      .rejects.toMatchObject({ code: "TOO_MANY_COLUMNS", status: 413 });
  });
});
