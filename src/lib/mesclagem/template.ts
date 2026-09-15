import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import path from "node:path";

import { criarMapeamentoInicial } from "./catalogo";
import type { CampoMapeamento, LinhaMesclada } from "./tipos";
import { normalizarCabecalho } from "./mapeamento-deterministico";

export const NOME_TEMPLATE_MESCLAGEM = "template-padrao.xlsx";

function neutralizarFormula(valor: string): string {
  return /^[ \t\r\n]*[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

function valorParaCelula(valor: string): string {
  const texto = valor.trim();
  if (!texto) return "";
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));
  if (Number.isFinite(numero) && texto.replace(/[.,\d]/g, "").length === 0) {
    return texto;
  }
  return neutralizarFormula(texto);
}

export function caminhoTemplateMesclagem(): string {
  const baseDir = process.env.BASE_DIR ?? process.cwd();
  return path.join(baseDir, "public", "templates", NOME_TEMPLATE_MESCLAGEM);
}

export function lerTemplateMesclagem(): Buffer {
  return readFileSync(caminhoTemplateMesclagem());
}

const PARES_DDD_FONE = Array.from({ length: 5 }, (_, indice) => ({
  ddd: `DDD${indice + 1}`,
  fone: `FONE${indice + 1}`,
}));

function mapaCabecalhos(worksheet: ExcelJS.Worksheet): Map<string, number> {
  const mapa = new Map<string, number>();
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, numero) => {
    const nome = typeof cell.value === "string" ? cell.value : "";
    if (!nome) return;
    const normalizado = normalizarCabecalho(nome);
    if (mapa.has(normalizado)) throw new Error(`Cabeçalho duplicado no template: ${nome}`);
    mapa.set(normalizado, numero);
  });
  return mapa;
}

function inserirDddsAntesDosTelefones(worksheet: ExcelJS.Worksheet, mapeamento: CampoMapeamento[]): void {
  const destinos = new Set(mapeamento.map((campo) => normalizarCabecalho(campo.destino)));
  for (const par of PARES_DDD_FONE) {
    if (!destinos.has(normalizarCabecalho(par.ddd))) continue;
    const mapa = mapaCabecalhos(worksheet);
    if (mapa.has(normalizarCabecalho(par.ddd))) continue;
    const colunaFone = mapa.get(normalizarCabecalho(par.fone));
    if (colunaFone === undefined) continue;

    worksheet.spliceColumns(colunaFone, 0, []);
    const celula = worksheet.getRow(1).getCell(colunaFone);
    const referencia = worksheet.getRow(1).getCell(colunaFone + 1);
    celula.value = par.ddd;
    celula.style = { ...referencia.style };
    celula.font = { ...referencia.font, bold: true };
    worksheet.getColumn(colunaFone).width = worksheet.getColumn(colunaFone + 1).width;
  }
}

export async function gerarXlsxMesclagem(params: {
  linhas: LinhaMesclada[];
  mapeamento: CampoMapeamento[];
  template?: Buffer;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((params.template ?? lerTemplateMesclagem()) as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Template de mesclagem sem aba");

  inserirDddsAntesDosTelefones(worksheet, params.mapeamento);
  const mapaDestino = mapaCabecalhos(worksheet);

  let proximaColuna = worksheet.columnCount + 1;
  for (const campo of params.mapeamento) {
    const destinoNormalizado = normalizarCabecalho(campo.destino);
    if (mapaDestino.has(destinoNormalizado)) continue;
    const celula = worksheet.getRow(1).getCell(proximaColuna);
    celula.value = campo.destino;
    const referencia = worksheet.getRow(1).getCell(Math.max(1, proximaColuna - 1));
    celula.style = { ...referencia.style };
    celula.font = { ...referencia.font, bold: true };
    mapaDestino.set(destinoNormalizado, proximaColuna);
    proximaColuna += 1;
  }

  params.mapeamento.forEach((campo) => {
    const numero = mapaDestino.get(normalizarCabecalho(campo.destino));
    if (numero === undefined) {
      throw new Error(`Destino do template não encontrado: ${campo.destino}`);
    }
  });

  let linhaAtual = 2;
  for (const linha of params.linhas) {
    const row = worksheet.getRow(linhaAtual);
    for (const [destino, valor] of Object.entries(linha.valores)) {
      const numero = mapaDestino.get(normalizarCabecalho(destino));
      if (numero === undefined) continue;
      row.getCell(numero).value = valorParaCelula(valor);
      row.getCell(numero).font = { ...row.getCell(numero).font, size: 10 };
    }
    linhaAtual += 1;
  }

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function gerarTemplateMesclagem(): Promise<Buffer> {
  return gerarXlsxMesclagem({ linhas: [], mapeamento: criarMapeamentoInicial() });
}
