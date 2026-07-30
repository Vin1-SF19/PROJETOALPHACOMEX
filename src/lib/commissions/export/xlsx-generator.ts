import ExcelJS from "exceljs";
import type { PreviewResult } from "./preview-builder";

/**
 * Gera XLSX no FORMATO REAL do espelho usado pela empresa (validado contra PDFs de
 * referência "ESPELHO DE COMISSÕES"/"ESPELHO DE PRÊMIOS", 2026-07-30) — 1 aba única,
 * cabeçalho com período/cargo/colaborador, tabela simples, subtotais, total, linha de
 * assinatura. Substitui o formato técnico anterior (6 abas), que não era o entregável
 * real para o colaborador.
 */

const CORES = {
  cabecalho: "FF0F172A",
  cabecalhoTexto: "FFFFFFFF",
  borda: "FFD7DEE8",
  zebra: "FFF1F5F9",
  texto: "FF1E293B",
} as const;

function centavosParaReais(cents: number): number {
  return cents / 100;
}

/**
 * Neutraliza Excel/CSV Formula Injection — mesma lógica de
 * `src/lib/cs-nps/exportar-dados.ts` (`neutralizarFormula`).
 */
function neutralizarFormula(value: string): string {
  return /^[ \t\r\n]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function estilizarCabecalhoTabela(worksheet: ExcelJS.Worksheet, linha: number, numColunas: number) {
  const headerRow = worksheet.getRow(linha);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: CORES.cabecalhoTexto }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.cabecalho } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  void numColunas;
}

export async function gerarXlsxEspelho(params: { preview: PreviewResult; codigoVerificacao: string }): Promise<Buffer> {
  const { preview, codigoVerificacao } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PainelAlpha — Gestão de Comissões e Prêmios";
  workbook.created = new Date();

  const titulo = preview.tipo === "comissoes" ? "ESPELHO DE COMISSÕES" : "ESPELHO DE PRÊMIOS";
  const sheet = workbook.addWorksheet(titulo.slice(0, 31));

  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = titulo;
  sheet.getCell("A1").font = { bold: true, size: 14 };

  sheet.getCell("D1").value = "PERÍODO DE REFERÊNCIA";
  sheet.getCell("D1").font = { bold: true };
  sheet.getCell("D2").value = "DE";
  sheet.getCell("E2").value = preview.periodoInicio;
  sheet.getCell("E2").numFmt = "dd/mm/yyyy";
  sheet.getCell("D3").value = "ATÉ";
  sheet.getCell("E3").value = preview.periodoFim;
  sheet.getCell("E3").numFmt = "dd/mm/yyyy";

  sheet.getCell("A5").value = "CARGO";
  sheet.getCell("A5").font = { bold: true };
  sheet.getCell("B5").value = neutralizarFormula(preview.cargoNome ?? "");
  sheet.getCell("A6").value = "COLABORADOR";
  sheet.getCell("A6").font = { bold: true };
  sheet.getCell("B6").value = neutralizarFormula(preview.colaboradorNome);

  const linhaInicioTabela = 8;
  const colunas =
    preview.tipo === "comissoes"
      ? ["Data", "Empresa", "Comissão", "DSR", "Total"]
      : ["Data", "Empresa", "Êxito", "De Primeira", "Total"];

  colunas.forEach((label, i) => {
    sheet.getCell(linhaInicioTabela, i + 1).value = label;
  });
  estilizarCabecalhoTabela(sheet, linhaInicioTabela, colunas.length);

  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 42;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;

  let linhaAtual = linhaInicioTabela + 1;
  const linhas = preview.tipo === "comissoes" ? preview.linhasComissao : preview.linhasPremio;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const row = sheet.getRow(linhaAtual);
    row.getCell(1).value = linha.data;
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(2).value = neutralizarFormula(linha.empresaNome);

    if (preview.tipo === "comissoes") {
      const l = linha as (typeof preview.linhasComissao)[number];
      row.getCell(3).value = centavosParaReais(l.comissaoCents);
      row.getCell(4).value = centavosParaReais(l.dsrCents);
      row.getCell(5).value = centavosParaReais(l.totalCents);
    } else {
      const l = linha as (typeof preview.linhasPremio)[number];
      row.getCell(3).value = centavosParaReais(l.exitoCents);
      row.getCell(4).value = centavosParaReais(l.primeiraCents);
      row.getCell(5).value = centavosParaReais(l.totalCents);
    }

    row.getCell(3).numFmt = "R$ #,##0.00";
    row.getCell(4).numFmt = "R$ #,##0.00";
    row.getCell(5).numFmt = "R$ #,##0.00";
    row.getCell(5).font = { bold: true };

    if (i % 2 === 0) {
      row.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.zebra } }));
    }
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "hair", color: { argb: CORES.borda } },
        left: { style: "hair", color: { argb: CORES.borda } },
        bottom: { style: "hair", color: { argb: CORES.borda } },
        right: { style: "hair", color: { argb: CORES.borda } },
      };
      cell.font = { ...cell.font, size: 10 };
    });

    linhaAtual++;
  }

  linhaAtual += 1;

  if (preview.tipo === "comissoes") {
    sheet.getCell(linhaAtual, 4).value = "COMISSÃO";
    sheet.getCell(linhaAtual, 5).value = centavosParaReais(preview.totais.comissaoCents);
    sheet.getCell(linhaAtual, 5).numFmt = "R$ #,##0.00";
    linhaAtual++;
    sheet.getCell(linhaAtual, 4).value = "DSR";
    sheet.getCell(linhaAtual, 5).value = centavosParaReais(preview.totais.dsrCents);
    sheet.getCell(linhaAtual, 5).numFmt = "R$ #,##0.00";
    linhaAtual++;
  } else {
    sheet.getCell(linhaAtual, 4).value = "PRÊMIOS POR ÊXITO";
    sheet.getCell(linhaAtual, 5).value = centavosParaReais(preview.totais.exitoCents);
    sheet.getCell(linhaAtual, 5).numFmt = "R$ #,##0.00";
    linhaAtual++;
    sheet.getCell(linhaAtual, 4).value = "PRÊMIOS POR DEFERIMENTO DE PRIMEIRA";
    sheet.getCell(linhaAtual, 5).value = centavosParaReais(preview.totais.primeiraCents);
    sheet.getCell(linhaAtual, 5).numFmt = "R$ #,##0.00";
    linhaAtual++;
  }

  sheet.getCell(linhaAtual, 4).value = "TOTAL";
  sheet.getCell(linhaAtual, 4).font = { bold: true };
  sheet.getCell(linhaAtual, 5).value = centavosParaReais(preview.totais.totalGeralCents);
  sheet.getCell(linhaAtual, 5).numFmt = "R$ #,##0.00";
  sheet.getCell(linhaAtual, 5).font = { bold: true };
  sheet.getCell(linhaAtual, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.cabecalho } };
  sheet.getCell(linhaAtual, 4).font = { bold: true, color: { argb: CORES.cabecalhoTexto } };
  sheet.getCell(linhaAtual, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.cabecalho } };
  sheet.getCell(linhaAtual, 5).font = { bold: true, color: { argb: CORES.cabecalhoTexto } };

  linhaAtual += 3;
  sheet.getCell(linhaAtual, 1).value = neutralizarFormula(preview.colaboradorNome);
  linhaAtual++;
  sheet.getCell(linhaAtual, 1).value = "Assinatura";
  sheet.getCell(linhaAtual, 1).font = { italic: true };

  linhaAtual += 2;
  sheet.getCell(linhaAtual, 1).value = `Documento emitido em ${new Date().toLocaleDateString("pt-BR")}`;
  sheet.getCell(linhaAtual, 1).font = { size: 8, color: { argb: CORES.texto } };
  linhaAtual++;
  sheet.getCell(linhaAtual, 1).value = `Código de verificação: ${codigoVerificacao}`;
  sheet.getCell(linhaAtual, 1).font = { size: 8, color: { argb: CORES.texto } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
