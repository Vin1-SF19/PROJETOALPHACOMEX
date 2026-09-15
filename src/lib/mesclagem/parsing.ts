import ExcelJS from "exceljs";

import { extrairDigitos } from "./cnpj";
import {
  EXTENSOES_MESCLAGEM,
  LIMITE_CELULAS_MESCLAGEM,
  LIMITE_COLUNAS_MESCLAGEM,
  type ExtensaoMesclagem,
} from "./catalogo";
import type { AbaPlanilha, ColunaPlanilha, InspecaoPlanilha } from "./tipos";
import type { LinhaPlanilha } from "./tipos";
import { validarPreflightXlsxMesclagem } from "./preflight-xlsx";
import { ErroMesclagem } from "./erro";

export { EXTENSOES_MESCLAGEM, type ExtensaoMesclagem } from "./catalogo";

export const LIMITE_ARQUIVO_MESCLAGEM_MB = 80;
export const LIMITE_ARQUIVO_MESCLAGEM_BYTES = LIMITE_ARQUIVO_MESCLAGEM_MB * 1024 * 1024;
export const MARGEM_MULTIPART_MESCLAGEM_BYTES = 2 * 1024 * 1024;
export const LIMITE_MULTIPART_ARQUIVO_MESCLAGEM_BYTES =
  LIMITE_ARQUIVO_MESCLAGEM_BYTES + MARGEM_MULTIPART_MESCLAGEM_BYTES;
export const LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES =
  LIMITE_MULTIPART_ARQUIVO_MESCLAGEM_BYTES * 2;
export const LIMITE_LINHAS_MESCLAGEM = 50_000;
export { LIMITE_CELULAS_MESCLAGEM, LIMITE_COLUNAS_MESCLAGEM } from "./catalogo";

export { ErroMesclagem } from "./erro";

export function extensaoDoArquivo(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  if (ponto < 0) return "";
  return nome.slice(ponto).toLowerCase();
}

export function validarExtensaoMesclagem(nome: string): ExtensaoMesclagem {
  const extensao = extensaoDoArquivo(nome);
  if (!(EXTENSOES_MESCLAGEM as readonly string[]).includes(extensao)) {
    throw new ErroMesclagem("Envie .xlsx, .xlsm, .xls, .xlsb, .ods, .csv ou .tsv", "INVALID_FILE_TYPE");
  }
  return extensao as ExtensaoMesclagem;
}

export function validarTamanhoArquivo(arquivo: { size: number }): void {
  if (arquivo.size <= 0) throw new ErroMesclagem("O arquivo está vazio", "EMPTY_FILE");
  if (arquivo.size > LIMITE_ARQUIVO_MESCLAGEM_BYTES) {
    throw new ErroMesclagem(
      `O arquivo excede o limite de ${LIMITE_ARQUIVO_MESCLAGEM_MB} MB`,
      "FILE_TOO_LARGE",
      413,
    );
  }
}

export function normalizarNomeColuna(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function valorParaTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") return "";
  return String(valor).trim();
}

function valorTemFormula(valor: ExcelJS.CellValue): boolean {
  if (valor === null || typeof valor !== "object" || valor instanceof Date) return false;
  return "formula" in valor || "sharedFormula" in valor;
}

function colunasDaAba(worksheet: ExcelJS.Worksheet): ColunaPlanilha[] {
  const header = worksheet.getRow(1);
  const colunas: ColunaPlanilha[] = [];
  header.eachCell({ includeEmpty: false }, (cell, numero) => {
    const valor = cell.value;
    if (valorTemFormula(valor)) {
      throw new ErroMesclagem(`Fórmulas não são permitidas (${worksheet.name}!${cell.address})`, "FORMULA_NOT_ALLOWED", 422);
    }
    const nome = valorParaTexto(valor);
    if (!nome) return;
    colunas.push({
      numero,
      nome,
      nomeNormalizado: normalizarNomeColuna(nome),
    });
  });
  return colunas.sort((a, b) => a.numero - b.numero);
}

function totalLinhas(worksheet: ExcelJS.Worksheet): number {
  let total = 0;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    if (row.number === 1) return;
    let possui = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== "") possui = true;
    });
    if (possui) total += 1;
  });
  return total;
}

function sugerirColunasCnpj(colunas: ColunaPlanilha[]): number[] {
  const porNome = colunas
    .filter((coluna) => ["cnpj", "cnpj empresa", "cnpj empresa cliente", "cnpj cliente", "cnpj do cliente", "cnpj da empresa"].includes(coluna.nomeNormalizado))
    .map((coluna) => coluna.numero);
  if (porNome.length > 0) return porNome;
  const porContem = colunas.filter((coluna) => coluna.nomeNormalizado.includes("cnpj")).map((coluna) => coluna.numero);
  return porContem;
}

function validarCabecalhosUnicos(colunas: ColunaPlanilha[]): void {
  const vistos = new Set<string>();
  for (const coluna of colunas) {
    if (vistos.has(coluna.nomeNormalizado)) {
      throw new ErroMesclagem(`Cabeçalho duplicado ou ambíguo: ${coluna.nome}`, "DUPLICATE_HEADER", 422);
    }
    vistos.add(coluna.nomeNormalizado);
  }
}

export function inspecionarWorkbook(workbook: ExcelJS.Workbook, nomeArquivo: string, extensao: string): InspecaoPlanilha {
  if (workbook.worksheets.length === 0) {
    throw new ErroMesclagem("A planilha não possui abas", "EMPTY_WORKBOOK", 422);
  }

  let totalCelulas = 0;
  const abas: AbaPlanilha[] = workbook.worksheets.map((worksheet) => {
    const colunas = colunasDaAba(worksheet);
    if (colunas.length === 0) {
      throw new ErroMesclagem(`A aba ${worksheet.name} não possui cabeçalho`, "INVALID_HEADER", 422);
    }
    validarCabecalhosUnicos(colunas);
    if (
      worksheet.actualColumnCount > LIMITE_COLUNAS_MESCLAGEM ||
      colunas.some((coluna) => coluna.numero > LIMITE_COLUNAS_MESCLAGEM)
    ) {
      throw new ErroMesclagem(`A aba ${worksheet.name} excede o limite de ${LIMITE_COLUNAS_MESCLAGEM} colunas`, "TOO_MANY_COLUMNS", 413);
    }
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.cellCount > LIMITE_CELULAS_MESCLAGEM - totalCelulas) {
        throw new ErroMesclagem(`A planilha excede o limite de ${LIMITE_CELULAS_MESCLAGEM.toLocaleString("pt-BR")} células`, "TOO_MANY_CELLS", 413);
      }
      totalCelulas += row.cellCount;
    });
    const linhas = totalLinhas(worksheet);
    if (linhas > LIMITE_LINHAS_MESCLAGEM) {
      throw new ErroMesclagem(`A aba ${worksheet.name} excede o limite de ${LIMITE_LINHAS_MESCLAGEM.toLocaleString("pt-BR")} linhas`, "TOO_MANY_ROWS", 413);
    }
    return { nome: worksheet.name, colunas, totalLinhas: linhas };
  });

  const primeiraAba = abas[0];
  return {
    nomeArquivo,
    extensao,
    abas,
    colunasCnpjSugeridas: sugerirColunasCnpj(primeiraAba.colunas),
  };
}

export async function carregarWorkbookXlsx(buffer: ArrayBuffer, nomeArquivo: string, extensao: string): Promise<InspecaoPlanilha> {
  const assinatura = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
  if (assinatura[0] !== 0x50 || assinatura[1] !== 0x4b) {
    throw new ErroMesclagem("O arquivo XLSX é inválido", "INVALID_XLSX");
  }
  await validarPreflightXlsxMesclagem(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ErroMesclagem("Não foi possível ler o arquivo XLSX", "INVALID_XLSX");
  }
  return inspecionarWorkbook(workbook, nomeArquivo, extensao);
}

export async function lerWorkbookXlsx(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const assinatura = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
  if (assinatura[0] !== 0x50 || assinatura[1] !== 0x4b) {
    throw new ErroMesclagem("O arquivo XLSX é inválido", "INVALID_XLSX");
  }
  await validarPreflightXlsxMesclagem(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ErroMesclagem("Não foi possível ler o arquivo XLSX", "INVALID_XLSX");
  }
  return workbook;
}

export function lerLinhasWorkbook(workbook: ExcelJS.Workbook, nomeAba: string): LinhaPlanilha[] {
  const worksheet = workbook.getWorksheet(nomeAba);
  if (!worksheet) throw new ErroMesclagem(`Aba ausente: ${nomeAba}`, "MISSING_SHEET", 422);

  const linhas: LinhaPlanilha[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    if (row.number === 1) return;
    const valores: Record<number, string> = {};
    let possui = false;
    row.eachCell({ includeEmpty: false }, (cell, numero) => {
      const valor = cell.value;
      if (valorTemFormula(valor)) {
        throw new ErroMesclagem(`Fórmulas não são permitidas (${worksheet.name}!${cell.address})`, "FORMULA_NOT_ALLOWED", 422);
      }
      const texto = valorParaTexto(valor);
      if (texto) {
        valores[numero] = texto;
        possui = true;
      }
    });
    if (possui) {
      linhas.push({ numero: row.number, valores });
      if (linhas.length > LIMITE_LINHAS_MESCLAGEM) {
        throw new ErroMesclagem(`A planilha excede o limite de ${LIMITE_LINHAS_MESCLAGEM.toLocaleString("pt-BR")} linhas`, "TOO_MANY_ROWS", 413);
      }
    }
  });
  return linhas;
}

type Delimitador = ";" | "," | "\t";

function primeiroRegistroLogico(conteudo: string): string {
  let dentroAspas = false;
  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (caractere === '"') {
      if (dentroAspas && conteudo[indice + 1] === '"') indice += 1;
      else dentroAspas = !dentroAspas;
    } else if (!dentroAspas && (caractere === "\n" || caractere === "\r")) {
      return conteudo.slice(0, indice);
    }
  }
  return conteudo;
}

function detectarDelimitador(conteudo: string, extensao?: string): Delimitador {
  if (extensao === ".tsv") return "\t";
  const registro = primeiroRegistroLogico(conteudo);
  const contagem: Record<Delimitador, number> = { ";": 0, ",": 0, "\t": 0 };
  let dentroAspas = false;
  for (let indice = 0; indice < registro.length; indice += 1) {
    if (registro[indice] === '"') {
      if (dentroAspas && registro[indice + 1] === '"') indice += 1;
      else dentroAspas = !dentroAspas;
    } else if (!dentroAspas && (registro[indice] === ";" || registro[indice] === "," || registro[indice] === "\t")) {
      contagem[registro[indice] as Delimitador] += 1;
    }
  }
  if (contagem["\t"] > contagem[";"] && contagem["\t"] > contagem[","]) return "\t";
  return contagem[","] > contagem[";"] ? "," : ";";
}

/** Parser por registros RFC 4180: a quebra de linha só encerra registro fora de aspas. */
export function lerRegistrosDelimitados(texto: string, extensao?: string): string[][] {
  const conteudo = texto.replace(/^\uFEFF/, "");
  const delimitador = detectarDelimitador(conteudo, extensao);
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  let dentroAspas = false;
  let totalCelulas = 0;

  const adicionarCampo = () => {
    if (registro.length >= LIMITE_COLUNAS_MESCLAGEM) {
      throw new ErroMesclagem(`O arquivo excede o limite de ${LIMITE_COLUNAS_MESCLAGEM} colunas`, "TOO_MANY_COLUMNS", 413);
    }
    registro.push(campo.trim());
    campo = "";
  };

  const finalizarRegistro = () => {
    adicionarCampo();
    if (registro.some((valor) => valor.length > 0)) {
      // O primeiro registro é o cabeçalho; o limite se aplica somente às linhas de dados.
      if (registros.length > LIMITE_LINHAS_MESCLAGEM) {
        throw new ErroMesclagem(`O arquivo excede o limite de ${LIMITE_LINHAS_MESCLAGEM.toLocaleString("pt-BR")} linhas`, "TOO_MANY_ROWS", 413);
      }
      if (registro.length > LIMITE_CELULAS_MESCLAGEM - totalCelulas) {
        throw new ErroMesclagem(`O arquivo excede o limite de ${LIMITE_CELULAS_MESCLAGEM.toLocaleString("pt-BR")} células`, "TOO_MANY_CELLS", 413);
      }
      totalCelulas += registro.length;
      registros.push(registro);
    }
    registro = [];
  };

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (dentroAspas) {
      if (caractere === '"') {
        if (conteudo[indice + 1] === '"') {
          campo += '"';
          indice += 1;
        } else {
          dentroAspas = false;
        }
      } else if (caractere === "\r") {
        campo += "\n";
        if (conteudo[indice + 1] === "\n") indice += 1;
      } else {
        campo += caractere;
      }
      continue;
    }
    if (caractere === '"' && campo.trim().length === 0) {
      dentroAspas = true;
    } else if (caractere === delimitador) {
      adicionarCampo();
    } else if (caractere === "\n" || caractere === "\r") {
      finalizarRegistro();
      if (caractere === "\r" && conteudo[indice + 1] === "\n") indice += 1;
    } else {
      campo += caractere;
    }
  }
  if (dentroAspas) throw new ErroMesclagem("O arquivo possui aspas não fechadas", "INVALID_CSV", 422);
  if (campo.length > 0 || registro.length > 0) finalizarRegistro();

  return registros;
}

export function registrosDelimitadosParaLinhas(registros: string[][]): LinhaPlanilha[] {
  return registros.slice(1).map((registro, indice) => {
    const valores: Record<number, string> = {};
    registro.forEach((valor, coluna) => { if (valor) valores[coluna + 1] = valor; });
    return { numero: indice + 2, valores };
  });
}

export function parseCsvTexto(texto: string, nomeArquivo: string, extensao: string): InspecaoPlanilha {
  const registros = lerRegistrosDelimitados(texto, extensao);
  if (registros.length < 2) {
    throw new ErroMesclagem("O arquivo precisa de cabeçalho e ao menos uma linha", "EMPTY_WORKBOOK", 422);
  }

  const cabecalho = registros[0];
  const colunas: ColunaPlanilha[] = cabecalho
    .map((nome, indice) => ({
      numero: indice + 1,
      nome,
      nomeNormalizado: normalizarNomeColuna(nome),
    }))
    .filter((coluna) => coluna.nome.length > 0);

  if (colunas.length === 0) {
    throw new ErroMesclagem("O arquivo não possui cabeçalho", "INVALID_HEADER", 422);
  }
  validarCabecalhosUnicos(colunas);

  const totalLinhas = registros.length - 1;
  if (totalLinhas > LIMITE_LINHAS_MESCLAGEM) {
    throw new ErroMesclagem(`O arquivo excede o limite de ${LIMITE_LINHAS_MESCLAGEM.toLocaleString("pt-BR")} linhas`, "TOO_MANY_ROWS", 413);
  }

  return {
    nomeArquivo,
    extensao,
    abas: [{ nome: "Dados", colunas, totalLinhas }],
    colunasCnpjSugeridas: sugerirColunasCnpj(colunas),
  };
}

export function valorCnpjDaLinha(linha: LinhaPlanilha, coluna: number): string {
  const valor = linha.valores[coluna];
  if (!valor) return "";
  return extrairDigitos(valor);
}
