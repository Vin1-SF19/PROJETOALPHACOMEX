import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import JSZip from "jszip";
import ts from "typescript";

import * as preflightXlsx from "../src/lib/cs-nps/preflight-xlsx.ts";

const { ErroPreflightXlsx, validarXlsxStreaming } = preflightXlsx;
const require = createRequire(import.meta.url);

function paraArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function falsificarTamanhoDescompactado(buffer, nomeAlvo, tamanhoFalso) {
  const assinaturaEocd = 0x06054b50;
  let eocd = -1;
  for (let cursor = buffer.length - 22; cursor >= Math.max(0, buffer.length - 65_557); cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === assinaturaEocd) {
      eocd = cursor;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD ausente no smoke");

  const total = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  for (let indice = 0; indice < total; indice += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Central ZIP inválida no smoke");
    const tamanhoNome = buffer.readUInt16LE(cursor + 28);
    const tamanhoExtra = buffer.readUInt16LE(cursor + 30);
    const tamanhoComentario = buffer.readUInt16LE(cursor + 32);
    const nome = buffer.subarray(cursor + 46, cursor + 46 + tamanhoNome).toString("utf8");
    if (nome === nomeAlvo) {
      const local = buffer.readUInt32LE(cursor + 42);
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error("Header local inválido no smoke");
      buffer.writeUInt32LE(tamanhoFalso, cursor + 24);
      buffer.writeUInt32LE(tamanhoFalso, local + 22);
      return;
    }
    cursor += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }
  throw new Error("Entrada alvo ausente no smoke");
}

async function criarModeloNormal() {
  const caminho = new URL("../src/lib/cs-nps/importar-dados.ts", import.meta.url);
  const compilado = ts.transpileModule(readFileSync(caminho, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const modulo = { exports: {} };
  const requireIsolado = (id) => {
    if (id === "@/lib/prisma") return {};
    if (id === "@/lib/cs-nps/importacao-tipos") {
      return { TIPOS_IMPORTACAO: ["socios", "cs", "feedbacks"] };
    }
    if (id === "@/lib/cs-nps/preflight-xlsx") return preflightXlsx;
    return require(id);
  };
  new Function("require", "module", "exports", compilado)(requireIsolado, modulo, modulo.exports);
  const gerarModeloImportacao = modulo.exports.gerarModeloImportacao;
  if (typeof gerarModeloImportacao !== "function") throw new Error("Gerador do modelo não foi carregado");
  return Buffer.from(await gerarModeloImportacao(["socios", "cs", "feedbacks"]));
}

async function validarFormatacaoModelo(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(paraArrayBuffer(buffer));
  for (const aba of ["Socios", "CS", "Feedbacks"]) {
    const sheet = workbook.getWorksheet(aba);
    if (!sheet) throw new Error(`Aba ${aba} ausente no modelo`);
    for (const linha of [2, 2_001]) {
      if (sheet.getCell(linha, 1).numFmt !== "@") {
        throw new Error(`CNPJ sem formato texto em ${aba}!A${linha}`);
      }
      if (sheet.getCell(linha, 6).numFmt !== "dd/mm/yyyy") {
        throw new Error(`Data sem formato em ${aba}!F${linha}`);
      }
    }
  }
  const socios = workbook.getWorksheet("Socios");
  if (socios?.getCell(2_001, 4).numFmt !== "@") {
    throw new Error("Telefone sem formato texto em Socios!D2001");
  }
  for (const aba of ["CS", "Feedbacks"]) {
    const validacao = workbook.getWorksheet(aba)?.getCell(2_001, 4).dataValidation;
    if (validacao?.type !== "list" || validacao.formulae?.[0] !== '"pos,neg,na"') {
      throw new Error(`Validação de sentimento ausente em ${aba}!D2001`);
    }
  }
}

async function criarBombaComMetadadoFalso() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types />");
  zip.file("_rels/.rels", "<Relationships />");
  zip.file("xl/workbook.xml", "<workbook />");
  const alvo = "xl/worksheets/sheet1.xml";
  zip.file(alvo, "A".repeat(21 * 1024 * 1024));
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  falsificarTamanhoDescompactado(buffer, alvo, 1_024);
  return buffer;
}

const normal = await criarModeloNormal();
await validarFormatacaoModelo(normal);
await validarXlsxStreaming(paraArrayBuffer(normal));
process.stdout.write("modelo-normal-formatacao-2001: aprovado\n");

const bomba = await criarBombaComMetadadoFalso();
let bloqueada = false;
try {
  await validarXlsxStreaming(paraArrayBuffer(bomba));
} catch (error) {
  if (error instanceof ErroPreflightXlsx) {
    bloqueada = true;
    process.stdout.write(`zip-bomb-metadado-falso: bloqueado (${error.code})\n`);
  } else {
    throw error;
  }
}
if (!bloqueada) throw new Error("O preflight aceitou a zip bomb com metadado falsificado");
