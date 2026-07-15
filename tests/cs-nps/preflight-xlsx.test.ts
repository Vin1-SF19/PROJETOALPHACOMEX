import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  ErroPreflightXlsx,
  validarXlsxStreaming,
} from "@/lib/cs-nps/preflight-xlsx";

function paraArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

describe("preflight streaming do XLSX", () => {
  it("aceita uma planilha XLSX normal", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Socios");
    sheet.addRow(["cnpj", "razaoSocial", "nome"]);
    sheet.addRow(["12.345.678/0001-90", null, "Maria"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(validarXlsxStreaming(paraArrayBuffer(buffer))).resolves.toBeUndefined();
  });

  it("bloqueia conteúdo com taxa de compressão típica de zip bomb", async () => {
    const zip = new JSZip();
    zip.file("xl/worksheets/sheet1.xml", "A".repeat(512 * 1024));
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    await expect(validarXlsxStreaming(paraArrayBuffer(buffer))).rejects.toEqual(
      expect.objectContaining<Partial<ErroPreflightXlsx>>({ code: "ZIP_BOMB", status: 413 }),
    );
  });
});
