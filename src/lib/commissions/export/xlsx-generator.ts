import ExcelJS from "exceljs";
import type { PreviewResult } from "./preview-builder";

/**
 * Gera XLSX real (seção 25 do prompt original) — mesmo padrão visual de
 * `src/lib/cs-nps/exportar-dados.ts` (cabeçalho escuro, autofiltro, congelamento,
 * linhas zebradas). 6 abas: Resumo, Lançamentos, Memória de Cálculo, Regras Aplicadas,
 * Ajustes, Metadados.
 */

const CORES = {
  cabecalho: "FF0F172A",
  cabecalhoTexto: "FFFFFFFF",
  borda: "FFD7DEE8",
  zebra: "FFF1F5F9",
  texto: "FF1E293B",
} as const;

function estilizarCabecalho(worksheet: ExcelJS.Worksheet, numColunas: number) {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: CORES.cabecalhoTexto }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.cabecalho } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: CORES.cabecalho } },
      left: { style: "thin", color: { argb: CORES.borda } },
      bottom: { style: "thin", color: { argb: CORES.cabecalho } },
      right: { style: "thin", color: { argb: CORES.borda } },
    };
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: `${worksheet.getColumn(numColunas).letter}1` };
}

function estilizarLinhasDeDado(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.font = { color: { argb: CORES.texto }, size: 10 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: CORES.borda } },
        left: { style: "hair", color: { argb: CORES.borda } },
        bottom: { style: "hair", color: { argb: CORES.borda } },
        right: { style: "hair", color: { argb: CORES.borda } },
      };
      if (rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORES.zebra } };
      }
    });
  });
}

function centavosParaReais(cents: number | null): number | null {
  return cents === null ? null : cents / 100;
}

/**
 * Neutraliza Excel/CSV Formula Injection — mesma lógica de
 * `src/lib/cs-nps/exportar-dados.ts` (`neutralizarFormula`). Qualquer string de texto
 * livre vinda de dados do usuário (razaoSocial, servico, observacao, etc.) que comece com
 * `=`, `+`, `-` ou `@` (mesmo após espaço/tab/quebra de linha) é prefixada com `'` para o
 * Excel tratar como texto literal, nunca como fórmula executável.
 */
function neutralizarFormula(value: string): string {
  return /^[ \t\r\n]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function gerarXlsxEspelho(params: {
  preview: PreviewResult;
  tipo: string;
  periodoInicio: Date;
  periodoFim: Date;
  colaboradorNome?: string;
  codigoVerificacao: string;
}): Promise<Buffer> {
  const { preview, tipo, periodoInicio, periodoFim, colaboradorNome, codigoVerificacao } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PainelAlpha — Gestão de Comissões e Prêmios";
  workbook.created = new Date();

  // ─── Aba Resumo ───
  const resumo = workbook.addWorksheet("Resumo");
  resumo.columns = [{ width: 32 }, { width: 24 }];
  resumo.addRow(["Tipo de espelho", neutralizarFormula(tipo)]);
  resumo.addRow(["Período início", periodoInicio]);
  resumo.addRow(["Período fim", periodoFim]);
  resumo.addRow(["Colaborador", neutralizarFormula(colaboradorNome ?? "Todos")]);
  resumo.addRow(["Código de verificação", codigoVerificacao]);
  resumo.addRow(["Data de emissão", new Date()]);
  resumo.addRow([]);
  resumo.addRow(["Subtotal Comissão", centavosParaReais(preview.totais.comissaoCents)]);
  resumo.addRow(["Subtotal DSR", centavosParaReais(preview.totais.dsrCents)]);
  resumo.addRow(["Subtotal Prêmio", centavosParaReais(preview.totais.premioCents)]);
  resumo.addRow(["Subtotal Ajustes", centavosParaReais(preview.totais.ajusteCents)]);
  resumo.addRow(["Total Geral", centavosParaReais(preview.totais.totalGeralCents)]);
  resumo.getColumn(2).numFmt = "R$ #,##0.00";
  resumo.eachRow((row) => row.eachCell((cell) => (cell.font = { color: { argb: CORES.texto }, size: 10 })));

  // ─── Aba Lançamentos ───
  const lancamentos = workbook.addWorksheet("Lançamentos");
  lancamentos.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "CNPJ", key: "cnpj", width: 18 },
    { header: "Razão Social", key: "razaoSocial", width: 32 },
    { header: "Nome Fantasia", key: "nomeFantasia", width: 24 },
    { header: "Serviço", key: "servico", width: 24 },
    { header: "Evento", key: "evento", width: 20 },
    { header: "Honorários", key: "honorarios", width: 14 },
    { header: "Tarifário", key: "tarifario", width: 14 },
    { header: "Base Comissionável", key: "base", width: 16 },
    { header: "Forma de Pagamento", key: "formaPagamento", width: 20 },
    { header: "Percentual", key: "percentual", width: 12 },
    { header: "Valor Fixo", key: "valorFixo", width: 14 },
    { header: "Comissão", key: "comissao", width: 14 },
    { header: "DSR", key: "dsr", width: 14 },
    { header: "Prêmio", key: "premio", width: 14 },
    { header: "Ajuste", key: "ajuste", width: 14 },
    { header: "Total", key: "total", width: 16 },
    { header: "Previsão", key: "previsao", width: 14 },
    { header: "Pagamento", key: "pagamento", width: 14 },
    { header: "Status", key: "status", width: 18 },
    { header: "Observação", key: "observacao", width: 30 },
  ];

  for (const linha of preview.linhas) {
    lancamentos.addRow({
      data: linha.data,
      cnpj: neutralizarFormula(linha.cnpj),
      razaoSocial: neutralizarFormula(linha.razaoSocial),
      nomeFantasia: neutralizarFormula(linha.nomeFantasia ?? ""),
      servico: neutralizarFormula(linha.servico),
      evento: neutralizarFormula(linha.evento),
      honorarios: centavosParaReais(linha.honorariosCents),
      tarifario: centavosParaReais(linha.tarifarioCents),
      base: centavosParaReais(linha.baseComissionavelCents),
      formaPagamento: neutralizarFormula(linha.formaPagamento ?? ""),
      percentual: linha.percentual,
      valorFixo: centavosParaReais(linha.valorFixoCents),
      comissao: centavosParaReais(linha.comissaoCents),
      dsr: centavosParaReais(linha.dsrCents),
      premio: centavosParaReais(linha.premioCents),
      ajuste: centavosParaReais(linha.ajusteCents),
      total: centavosParaReais(linha.totalCents),
      previsao: linha.previsao,
      pagamento: linha.pagamento,
      status: neutralizarFormula(linha.status),
      observacao: neutralizarFormula(linha.observacao ?? ""),
    });
  }

  for (const col of ["G", "H", "I", "L", "M", "N", "O", "P", "Q"]) {
    lancamentos.getColumn(col).numFmt = "R$ #,##0.00";
  }
  for (const col of ["A", "R", "S"]) {
    lancamentos.getColumn(col).numFmt = "dd/mm/yyyy";
  }

  estilizarCabecalho(lancamentos, 21);
  estilizarLinhasDeDado(lancamentos);

  // ─── Aba Memória de Cálculo ───
  const memoria = workbook.addWorksheet("Memória de Cálculo");
  memoria.columns = [
    { header: "Lançamento", key: "entryId", width: 24 },
    { header: "Colaborador", key: "colaborador", width: 28 },
    { header: "Cargo", key: "cargo", width: 24 },
    { header: "Total", key: "total", width: 14 },
  ];
  for (const linha of preview.linhas) {
    memoria.addRow({
      entryId: linha.entryId,
      colaborador: neutralizarFormula(linha.colaboradorNome),
      cargo: neutralizarFormula(linha.cargoNome ?? ""),
      total: centavosParaReais(linha.totalCents),
    });
  }
  memoria.getColumn("D").numFmt = "R$ #,##0.00";
  estilizarCabecalho(memoria, 4);
  estilizarLinhasDeDado(memoria);

  // ─── Aba Regras Aplicadas (placeholder até construtor de regras da Fase 14) ───
  const regras = workbook.addWorksheet("Regras Aplicadas");
  regras.columns = [{ header: "Observação", key: "obs", width: 80 }];
  regras.addRow({ obs: "Detalhamento de regra por versão será expandido quando o construtor visual de regras (Fase 14) estiver disponível." });
  estilizarCabecalho(regras, 1);
  estilizarLinhasDeDado(regras);

  // ─── Aba Ajustes ───
  const ajustes = workbook.addWorksheet("Ajustes");
  ajustes.columns = [
    { header: "Lançamento", key: "entryId", width: 24 },
    { header: "Observação", key: "observacao", width: 50 },
  ];
  for (const linha of preview.linhas) {
    if (linha.observacao) {
      ajustes.addRow({ entryId: linha.entryId, observacao: neutralizarFormula(linha.observacao) });
    }
  }
  estilizarCabecalho(ajustes, 2);
  estilizarLinhasDeDado(ajustes);

  // ─── Aba Metadados ───
  const metadados = workbook.addWorksheet("Metadados");
  metadados.columns = [{ width: 28 }, { width: 40 }];
  metadados.addRow(["Sistema", "PainelAlpha — Gestão de Comissões e Prêmios"]);
  metadados.addRow(["Código de verificação", codigoVerificacao]);
  metadados.addRow(["Gerado em", new Date()]);
  metadados.addRow(["Total de linhas", preview.linhas.length]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
