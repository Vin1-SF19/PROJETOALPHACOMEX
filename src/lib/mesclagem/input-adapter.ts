import "server-only";

import * as XLSX from "xlsx";

import { ErroMesclagem } from "./erro";
import {
  LIMITE_LINHAS_MESCLAGEM,
  LIMITE_CELULAS_MESCLAGEM,
  LIMITE_COLUNAS_MESCLAGEM,
  carregarWorkbookXlsx,
  lerLinhasWorkbook,
  lerWorkbookXlsx,
  normalizarNomeColuna,
} from "./parsing";
import { validarPreflightXlsxMesclagem } from "./preflight-xlsx";
import type { ColunaPlanilha, InspecaoPlanilha, LinhaPlanilha } from "./tipos";

export type LayoutEntradaMesclagem = "legacy" | "logcomex_extended";

interface CelulaDensa {
  f?: string;
  t?: string;
  v?: unknown;
  w?: string;
}

type AbaDensa = Array<Array<CelulaDensa | undefined> | undefined> & { "!ref"?: string };

interface WorkbookLogcomex {
  abaNome: string;
  linhas: AbaDensa;
  indices: Map<string, number>;
}

const ASSINATURA_LOGCOMEX = [
  "cnpj",
  "cnpj logcomex",
  "raiz cnpj",
  "razao social",
  "municipio uf",
  "situacao radar siscomex",
  "modalidade",
  "data situacao",
] as const;

const CAMPOS_INTERNOS_LOGCOMEX = [
  "CNPJ",
  "Razão Social",
  "Nome Fantasia",
  "Município",
  "UF",
  "Data de Constituição",
  "Regime Tributário",
  "Capital Social",
  "Situação da Habilitação",
  "Data da Situação",
  "Submodalidade",
  "Data Opção Simples",
] as const;

const ORIGENS_LOGCOMEX: Record<(typeof CAMPOS_INTERNOS_LOGCOMEX)[number], string> = {
  CNPJ: "cnpj",
  "Razão Social": "razao social",
  "Nome Fantasia": "nome fantasia",
  Município: "municipio uf",
  UF: "municipio uf",
  "Data de Constituição": "data de constituicao",
  "Regime Tributário": "regime tributario",
  "Capital Social": "capital social",
  "Situação da Habilitação": "situacao radar siscomex",
  "Data da Situação": "data situacao",
  Submodalidade: "modalidade",
  "Data Opção Simples": "receitaws simples data opcao",
};

function valorCelula(celula: CelulaDensa | undefined, endereco: string): string {
  if (!celula) return "";
  if (celula.f) throw new ErroMesclagem(`Fórmulas não são permitidas (${endereco})`, "FORMULA_NOT_ALLOWED", 422);
  if (celula.v === null || celula.v === undefined) return "";
  if (celula.v instanceof Date) return celula.v.toISOString();
  if (typeof celula.v === "object") return "";
  if (typeof celula.v === "number") return String(celula.v);
  return String(celula.w ?? celula.v).trim();
}

function indicesCabecalho(linha: Array<CelulaDensa | undefined>): Map<string, number> | null {
  const indices = new Map<string, number>();
  for (let indice = 0; indice < linha.length; indice += 1) {
    const nome = valorCelula(linha[indice], `cabeçalho:${indice + 1}`);
    if (!nome) continue;
    const normalizado = normalizarNomeColuna(nome);
    if (indices.has(normalizado)) return null;
    indices.set(normalizado, indice);
  }
  return indices;
}

function encontrarLogcomex(workbook: XLSX.WorkBook): WorkbookLogcomex | null {
  const candidatas: WorkbookLogcomex[] = [];
  for (const abaNome of workbook.SheetNames) {
    const linhas = workbook.Sheets[abaNome] as unknown as AbaDensa;
    const indices = indicesCabecalho(linhas[0] ?? []);
    if (!indices || !ASSINATURA_LOGCOMEX.every((nome) => indices.has(nome))) continue;
    candidatas.push({ abaNome, linhas, indices });
  }
  return candidatas.length === 1 ? candidatas[0] : null;
}

function lerWorkbookLogcomex(buffer: ArrayBuffer, somenteCabecalho = false): WorkbookLogcomex | null {
  try {
    const workbook = XLSX.read(buffer, {
      type: "array",
      dense: true,
      cellDates: true,
      ...(somenteCabecalho ? { sheetRows: 1 } : {}),
    });
    return encontrarLogcomex(workbook);
  } catch {
    return null;
  }
}

function colunasInternas(): ColunaPlanilha[] {
  return CAMPOS_INTERNOS_LOGCOMEX.map((nome, indice) => ({
    numero: indice + 1,
    nome,
    nomeNormalizado: normalizarNomeColuna(nome),
  }));
}

/** Leitor compatível com os formatos legados suportados pelo SheetJS (.xls/.xlsb/.ods)
 * e também com XLSX que não passa pelo parser do ExcelJS. */
function lerWorkbookGenerico(buffer: ArrayBuffer): XLSX.WorkBook {
  try {
    return XLSX.read(buffer, { type: "array", dense: true, cellDates: true, cellFormula: true });
  } catch {
    throw new ErroMesclagem("Não foi possível ler a planilha", "INVALID_XLSX", 422);
  }
}

function valorGenerico(celula: CelulaDensa | string | number | Date | undefined, endereco: string): string {
  if (typeof celula === "string" || typeof celula === "number") return String(celula).trim();
  if (celula instanceof Date) return celula.toISOString();
  return valorCelula(celula, endereco);
}

function inspecionarWorkbookGenerico(workbook: XLSX.WorkBook, nomeArquivo: string, extensao: string): InspecaoPlanilha {
  if (workbook.SheetNames.length === 0) throw new ErroMesclagem("A planilha não possui abas", "EMPTY_WORKBOOK", 422);
  let totalCelulas = 0;
  const abas = workbook.SheetNames.map((nome) => {
    const sheet = workbook.Sheets[nome] as unknown as AbaDensa;
    const linhas = sheet_to_json_rows(sheet);
    const cabecalho = linhas[0] ?? [];
    const colunas = cabecalho.map((celula, indice) => {
      const nomeColuna = valorGenerico(celula, `${nome}!${indice + 1}`);
      return nomeColuna ? { numero: indice + 1, nome: nomeColuna, nomeNormalizado: normalizarNomeColuna(nomeColuna) } : null;
    }).filter((coluna): coluna is ColunaPlanilha => Boolean(coluna));
    if (colunas.length === 0) throw new ErroMesclagem(`A aba ${nome} não possui cabeçalho`, "INVALID_HEADER", 422);
    const vistos = new Set<string>();
    colunas.forEach((coluna) => { if (vistos.has(coluna.nomeNormalizado)) throw new ErroMesclagem(`Cabeçalho duplicado ou ambíguo: ${coluna.nome}`, "DUPLICATE_HEADER", 422); vistos.add(coluna.nomeNormalizado); });
    if (colunas.length > LIMITE_COLUNAS_MESCLAGEM) throw new ErroMesclagem(`A aba ${nome} excede o limite de ${LIMITE_COLUNAS_MESCLAGEM} colunas`, "TOO_MANY_COLUMNS", 413);
    const dados = linhas.slice(1).filter((linha) => linha?.some((celula) => valorGenerico(celula, `${nome}!1`)));
    totalCelulas += linhas.reduce((total, linha) => total + (linha?.filter(Boolean).length ?? 0), 0);
    if (totalCelulas > LIMITE_CELULAS_MESCLAGEM) throw new ErroMesclagem(`A planilha excede o limite de ${LIMITE_CELULAS_MESCLAGEM.toLocaleString("pt-BR")} células`, "TOO_MANY_CELLS", 413);
    if (dados.length > LIMITE_LINHAS_MESCLAGEM) throw new ErroMesclagem(`A aba ${nome} excede o limite de ${LIMITE_LINHAS_MESCLAGEM.toLocaleString("pt-BR")} linhas`, "TOO_MANY_ROWS", 413);
    return { nome, colunas, totalLinhas: dados.length };
  });
  return { nomeArquivo, extensao, abas, colunasCnpjSugeridas: sugerirCnpjGenerico(abas[0].colunas) };
}

type ValorGenerico = CelulaDensa | string | number | Date | undefined;

function sheet_to_json_rows(sheet: AbaDensa): Array<Array<ValorGenerico>> {
  const ref = sheet["!ref"];
  if (!ref) return [];
  return XLSX.utils.sheet_to_json(sheet as unknown as XLSX.WorkSheet, { header: 1, raw: true, defval: "", blankrows: false }) as Array<Array<ValorGenerico>>;
}

function sugerirCnpjGenerico(colunas: ColunaPlanilha[]): number[] {
  return colunas.filter((coluna) => coluna.nomeNormalizado === "cnpj" || coluna.nomeNormalizado.includes("cnpj")).map((coluna) => coluna.numero);
}

function lerLinhasWorkbookGenerico(workbook: XLSX.WorkBook, nomeAba: string): LinhaPlanilha[] {
  const sheet = workbook.Sheets[nomeAba] as unknown as AbaDensa | undefined;
  if (!sheet) throw new ErroMesclagem(`Aba ausente: ${nomeAba}`, "MISSING_SHEET", 422);
  const linhas = sheet_to_json_rows(sheet);
  const resultado: LinhaPlanilha[] = [];
  linhas.slice(1).forEach((linha, indice) => {
    const valores: Record<number, string> = {};
    linha.forEach((celula, coluna) => { const valor = valorGenerico(celula, `${nomeAba}!${indice + 2}`); if (valor) valores[coluna + 1] = valor; });
    if (Object.keys(valores).length > 0) resultado.push({ numero: indice + 2, valores });
  });
  return resultado;
}

function separarMunicipioUf(valor: string): { municipio: string; uf: string } {
  const encontrado = valor.match(/^(.+?)\s*\(([A-Z]{2})\)\s*$/i);
  return encontrado
    ? { municipio: encontrado[1].trim(), uf: encontrado[2].toUpperCase() }
    : { municipio: valor.trim(), uf: "" };
}

function linhasLogcomex(entrada: WorkbookLogcomex, abaSolicitada: string): LinhaPlanilha[] {
  if (entrada.abaNome !== abaSolicitada) {
    throw new ErroMesclagem(`Aba ausente: ${abaSolicitada}`, "MISSING_SHEET", 422);
  }
  const linhas: LinhaPlanilha[] = [];
  for (let indiceLinha = 1; indiceLinha < entrada.linhas.length; indiceLinha += 1) {
    const origem = entrada.linhas[indiceLinha] ?? [];
    const valores: Record<number, string> = {};
    const municipioUf = valorCelula(
      origem[entrada.indices.get(ORIGENS_LOGCOMEX.Município) ?? -1],
      `${entrada.abaNome}!${indiceLinha + 1}`,
    );
    const localidade = separarMunicipioUf(municipioUf);

    CAMPOS_INTERNOS_LOGCOMEX.forEach((destino, indiceDestino) => {
      const valor = destino === "Município"
        ? localidade.municipio
        : destino === "UF"
          ? localidade.uf
          : valorCelula(
              origem[entrada.indices.get(ORIGENS_LOGCOMEX[destino]) ?? -1],
              `${entrada.abaNome}!${indiceLinha + 1}`,
            );
      if (valor) valores[indiceDestino + 1] = valor;
    });
    if (Object.keys(valores).length === 0) continue;
    linhas.push({ numero: indiceLinha + 1, valores });
    if (linhas.length > LIMITE_LINHAS_MESCLAGEM) {
      throw new ErroMesclagem(`A aba ${entrada.abaNome} excede o limite de ${LIMITE_LINHAS_MESCLAGEM.toLocaleString("pt-BR")} linhas`, "TOO_MANY_ROWS", 413);
    }
  }
  return linhas;
}

/** Detecta apenas layouts com assinatura inequívoca; qualquer ambiguidade preserva o parser legado. */
export async function detectarLayoutEntradaXlsx(buffer: ArrayBuffer): Promise<LayoutEntradaMesclagem> {
  if (new Uint8Array(buffer, 0, 2)[0] === 0x50) await validarPreflightXlsxMesclagem(buffer);
  return lerWorkbookLogcomex(buffer, true) ? "logcomex_extended" : "legacy";
}

/** Converte metadados do layout reconhecido para as colunas internas já usadas pela engine. */
export async function inspecionarEntradaXlsx(
  buffer: ArrayBuffer,
  nomeArquivo: string,
  extensao: string,
): Promise<InspecaoPlanilha> {
  const assinatura = new Uint8Array(buffer, 0, 2);
  if (assinatura[0] !== 0x50 || assinatura[1] !== 0x4b) {
    return inspecionarWorkbookGenerico(lerWorkbookGenerico(buffer), nomeArquivo, extensao);
  }
  await validarPreflightXlsxMesclagem(buffer);
  const logcomex = lerWorkbookLogcomex(buffer, true) ? lerWorkbookLogcomex(buffer) : null;
  if (!logcomex) {
    try {
      return await carregarWorkbookXlsx(buffer, nomeArquivo, extensao);
    } catch (error) {
      if (error instanceof ErroMesclagem && error.code === "INVALID_XLSX") {
        return inspecionarWorkbookGenerico(lerWorkbookGenerico(buffer), nomeArquivo, extensao);
      }
      throw error;
    }
  }
  const linhas = linhasLogcomex(logcomex, logcomex.abaNome);
  return {
    nomeArquivo,
    extensao,
    abas: [{ nome: logcomex.abaNome, colunas: colunasInternas(), totalLinhas: linhas.length }],
    colunasCnpjSugeridas: [1],
  };
}

/** Extrai somente valores relevantes e devolve a mesma representação consumida pelo join existente. */
export async function lerLinhasEntradaXlsx(buffer: ArrayBuffer, nomeAba: string): Promise<LinhaPlanilha[]> {
  const assinatura = new Uint8Array(buffer, 0, 2);
  if (assinatura[0] !== 0x50 || assinatura[1] !== 0x4b) {
    return lerLinhasWorkbookGenerico(lerWorkbookGenerico(buffer), nomeAba);
  }
  await validarPreflightXlsxMesclagem(buffer);
  const logcomex = lerWorkbookLogcomex(buffer, true) ? lerWorkbookLogcomex(buffer) : null;
  if (logcomex) return linhasLogcomex(logcomex, nomeAba);
  try {
    return lerLinhasWorkbook(await lerWorkbookXlsx(buffer), nomeAba);
  } catch (error) {
    if (error instanceof ErroMesclagem && error.code === "INVALID_XLSX") {
      return lerLinhasWorkbookGenerico(lerWorkbookGenerico(buffer), nomeAba);
    }
    throw error;
  }
}
