import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface TransacaoParaExportar {
  mesReferencia: string;
  nomeBanco: string;
  data: string;
  descricao: string;
  valor: number;
}

const PALETA_CORES = [
  "FFF1F5FE", "FFFFF1F1", "FFF0FDF4", "FFFFFEF2",
  "FFF5F3FF", "FFFFF7ED", "FFECFEFF",
];

const CABECALHO_RELATORIO = ["MÊS REF.", "BANCO", "DATA", "DESCRIÇÃO", "VALOR (R$)", "JUSTIFICATIVA"];

function estilizarCabecalho(row: ExcelJS.Row, repetido = false): void {
  row.values = CABECALHO_RELATORIO;
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "475569" } };
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: repetido ? "thick" : "thin", color: { argb: "FF334155" } },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function converterDataRef(ref: string): string {
  const [mes, ano] = ref.split("/");
  const meses: Record<string, string> = {
    Janeiro: "01", Fevereiro: "02", Março: "03", Abril: "04", Maio: "05", Junho: "06",
    Julho: "07", Agosto: "08", Setembro: "09", Outubro: "10", Novembro: "11", Dezembro: "12",
  };
  return `${ano}${meses[mes] || "00"}`;
}

/** Exporta um lote de transações no template "Relatório Radar" (Portaria Coana nº 72/2020). */
export function criarRelatorioExcel(
  transacoes: TransacaoParaExportar[],
  razaoSocial: string,
  cnpj: string,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Relatório Radar");

  const bancoCores: Record<string, string> = {};
  let corIndex = 0;
  transacoes.forEach((t) => {
    const nome = (t.nomeBanco || "BANCO").toUpperCase();
    if (!bancoCores[nome]) {
      bancoCores[nome] = PALETA_CORES[corIndex % PALETA_CORES.length];
      corIndex++;
    }
  });

  worksheet.columns = [
    { key: "mes", width: 20 },
    { key: "banco", width: 22 },
    { key: "data", width: 15 },
    { key: "descricao", width: 55 },
    { key: "valor", width: 18 },
    { key: "justificativa", width: 40 },
  ];

  worksheet.mergeCells("A1:F1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = '15 5160: COMPROVANTE DE TRANSFERENCIA DE RECURSOS DISPONIVEIS (Artigo 6º, I, "c" da Portaria Coana nº 72/2020)';
  titleCell.font = { name: "Arial", size: 10, bold: true };

  worksheet.getCell("A2").value = "EMPRESA:";
  worksheet.getCell("B2").value = razaoSocial?.toUpperCase() || "NOME NÃO INFORMADO";
  worksheet.getCell("A3").value = "CNPJ:";
  worksheet.getCell("B3").value = cnpj || "CNPJ NÃO INFORMADO";
  [worksheet.getCell("A2"), worksheet.getCell("A3")].forEach((c) => (c.font = { bold: true }));

  const headerRow = worksheet.getRow(5);
  estilizarCabecalho(headerRow);

  const dadosOrdenados = [...transacoes].sort((a, b) => {
    const refA = converterDataRef(a.mesReferencia);
    const refB = converterDataRef(b.mesReferencia);
    if (refA !== refB) return refB.localeCompare(refA);
    if (a.nomeBanco !== b.nomeBanco) return a.nomeBanco.localeCompare(b.nomeBanco);
    return a.data.localeCompare(b.data);
  });

  const gruposMensais: Array<{ mes: string; inicio: number; fim: number }> = [];
  let grupoAtual: (typeof gruposMensais)[number] | undefined;

  dadosOrdenados.forEach((t) => {
    if (!grupoAtual || grupoAtual.mes !== t.mesReferencia) {
      if (grupoAtual) {
        estilizarCabecalho(worksheet.addRow(CABECALHO_RELATORIO), true);
      }
      grupoAtual = {
        mes: t.mesReferencia,
        inicio: worksheet.rowCount + 1,
        fim: worksheet.rowCount + 1,
      };
      gruposMensais.push(grupoAtual);
    }

    const nomeBanco = (t.nomeBanco || "BANCO").toUpperCase();
    const corHex = bancoCores[nomeBanco];

    const row = worksheet.addRow({
      mes: t.mesReferencia.toUpperCase(),
      banco: nomeBanco,
      data: (t.data || "").toUpperCase(),
      descricao: (t.descricao || "").toUpperCase(),
      valor: Number(t.valor || 0),
      justificativa: "",
    });

    row.eachCell((cell, colNumber) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };

      if (colNumber === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "94a3b8" } };
        cell.font = { color: { argb: "FFFFFF" }, bold: true };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: corHex } };
        if (colNumber === 5) {
          cell.numFmt = '"R$ " #,##0.00';
          cell.alignment = { horizontal: "right" };
          cell.font = { bold: true, color: { argb: Number(t.valor) < 0 ? "BE123C" : "000000" } };
        }
      }
    });

    grupoAtual.fim = row.number;
  });

  gruposMensais.forEach(({ inicio, fim }) => {
    if (fim > inicio) worksheet.mergeCells(`A${inicio}:A${fim}`);

    let inicioBanco = inicio;
    for (let linha = inicio; linha <= fim; linha++) {
      const bancoAtual = worksheet.getCell(linha, 2).value;
      const bancoProximo = linha < fim ? worksheet.getCell(linha + 1, 2).value : null;
      if (bancoAtual !== bancoProximo) {
        if (linha > inicioBanco) worksheet.mergeCells(`B${inicioBanco}:B${linha}`);
        inicioBanco = linha + 1;
      }
    }
  });

  const corDivisor = { argb: "FF334155" };
  gruposMensais.forEach(({ inicio, fim }) => {
    for (let coluna = 1; coluna <= 6; coluna++) {
      const celulaInicio = worksheet.getCell(inicio, coluna);
      const celulaFim = worksheet.getCell(fim, coluna);

      celulaInicio.border = {
        ...celulaInicio.border,
        top: {
          style: "medium",
          color: corDivisor,
        },
      };
      celulaFim.border = {
        ...celulaFim.border,
        bottom: { style: "medium", color: corDivisor },
      };
    }

    worksheet.getRow(inicio).height = 24;
  });

  worksheet.views = [{ state: "frozen", ySplit: 5 }];

  return workbook;
}

export async function exportarRelatorioExcel(
  transacoes: TransacaoParaExportar[],
  razaoSocial: string,
  cnpj: string,
): Promise<void> {
  const workbook = criarRelatorioExcel(transacoes, razaoSocial, cnpj);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Relatorio_Radar_${razaoSocial.replace(/\s+/g, "_")}.xlsx`);
}
