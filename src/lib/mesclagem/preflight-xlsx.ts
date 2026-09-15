import "server-only";

import * as yauzl from "yauzl";

import { ErroPreflightXlsx, validarXlsxStreaming } from "@/lib/cs-nps/preflight-xlsx";
import { ErroMesclagem } from "./erro";

export const LIMITE_ABAS_XLSX_MESCLAGEM = 50;
const LIMITE_ENTRADA_DESCOMPACTADA_MESCLAGEM = 128 * 1024 * 1024;
const LIMITE_TOTAL_DESCOMPACTADO_MESCLAGEM = 256 * 1024 * 1024;
const LIMITE_ENTRADAS_ZIP_MESCLAGEM = 512;

function abrirZip(buffer: ArrayBuffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(Buffer.from(buffer), { lazyEntries: true, strictFileNames: true, decodeStrings: true }, (error, zipfile) => {
      if (error || !zipfile) reject(new ErroMesclagem("Estrutura ZIP inválida", "INVALID_ZIP_STREAM", 422));
      else resolve(zipfile);
    });
  });
}

async function validarMetadadosXlsx(buffer: ArrayBuffer): Promise<void> {
  const zipfile = await abrirZip(buffer);
  await new Promise<void>((resolve, reject) => {
    let finalizado = false;
    let workbook = false;
    let contentTypes = false;
    let abas = 0;
    const nomes = new Set<string>();
    const falhar = (erro: ErroMesclagem) => {
      if (finalizado) return;
      finalizado = true;
      if (zipfile.isOpen) zipfile.close();
      reject(erro);
    };
    zipfile.once("error", () => falhar(new ErroMesclagem("Estrutura ZIP inválida", "INVALID_ZIP_STREAM", 422)));
    zipfile.once("end", () => {
      if (finalizado) return;
      if (!workbook || !contentTypes || abas === 0) {
        falhar(new ErroMesclagem("O ZIP não contém uma estrutura XLSX válida", "INVALID_XLSX_STRUCTURE", 422));
        return;
      }
      finalizado = true;
      if (zipfile.isOpen) zipfile.close();
      resolve();
    });
    zipfile.on("entry", (entry: yauzl.Entry) => {
      if (finalizado) return;
      const nome = entry.fileName.replace(/\\/g, "/");
      if (nomes.has(nome)) {
        falhar(new ErroMesclagem("O XLSX contém entradas internas duplicadas", "DUPLICATE_ZIP_ENTRY", 422));
        return;
      }
      nomes.add(nome);
      if (nome === "xl/workbook.xml") workbook = true;
      if (nome === "[Content_Types].xml") contentTypes = true;
      if (/^xl\/worksheets\/[^/]+\.xml$/i.test(nome)) {
        abas += 1;
        if (abas > LIMITE_ABAS_XLSX_MESCLAGEM) {
          falhar(new ErroMesclagem(`O XLSX excede o limite de ${LIMITE_ABAS_XLSX_MESCLAGEM} abas`, "TOO_MANY_WORKSHEETS", 413));
          return;
        }
      }
      zipfile.readEntry();
    });
    zipfile.readEntry();
  });
}

/** Executa limites ZIP streaming e metadados mínimos antes do ExcelJS. */
export async function validarPreflightXlsxMesclagem(buffer: ArrayBuffer): Promise<void> {
  try {
    await validarXlsxStreaming(buffer, {
      entradaDescompactadaBytes: LIMITE_ENTRADA_DESCOMPACTADA_MESCLAGEM,
      totalDescompactadoBytes: LIMITE_TOTAL_DESCOMPACTADO_MESCLAGEM,
      entradas: LIMITE_ENTRADAS_ZIP_MESCLAGEM,
      razaoCompressao: 100,
    });
  } catch (error) {
    if (error instanceof ErroPreflightXlsx) throw new ErroMesclagem(error.message, error.code, error.status);
    throw new ErroMesclagem("Falha no preflight do XLSX", "INVALID_ZIP_STREAM", 422);
  }
  await validarMetadadosXlsx(buffer);
}
