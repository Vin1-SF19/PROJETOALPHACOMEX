import "server-only";

import * as XLSX from "xlsx";

import { ErroMesclagem } from "./erro";
import {
  LIMITE_LINHAS_MESCLAGEM,
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
  await validarPreflightXlsxMesclagem(buffer);
  return lerWorkbookLogcomex(buffer, true) ? "logcomex_extended" : "legacy";
}

/** Converte metadados do layout reconhecido para as colunas internas já usadas pela engine. */
export async function inspecionarEntradaXlsx(
  buffer: ArrayBuffer,
  nomeArquivo: string,
  extensao: string,
): Promise<InspecaoPlanilha> {
  await validarPreflightXlsxMesclagem(buffer);
  const logcomex = lerWorkbookLogcomex(buffer, true) ? lerWorkbookLogcomex(buffer) : null;
  if (!logcomex) return carregarWorkbookXlsx(buffer, nomeArquivo, extensao);
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
  await validarPreflightXlsxMesclagem(buffer);
  const logcomex = lerWorkbookLogcomex(buffer, true) ? lerWorkbookLogcomex(buffer) : null;
  if (logcomex) return linhasLogcomex(logcomex, nomeAba);
  return lerLinhasWorkbook(await lerWorkbookXlsx(buffer), nomeAba);
}
