import type { LinhaResultadoCatcher } from './historico-tipos';
import { normalizarCapitalCatcher, dataOpcaoSimplesCatcher, formatarDataInclusaoCatcher, formatarDataOpcaoCatcher } from './resultados';

export async function gerarExcelCatcher(linhas: readonly LinhaResultadoCatcher[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Resultados');
  sheet.columns = [
    { header: 'Data da consulta', width: 23 }, { header: 'CNPJ', width: 20 },
    { header: 'Razão social', width: 50 }, { header: 'Nome fantasia', width: 40 }, { header: 'Processamento', width: 45 },
    { header: 'Situação Radar', width: 24 }, { header: 'Modalidade', width: 24 },
    { header: 'UF', width: 8 }, { header: 'Município', width: 26 },
    { header: 'Regime tributário', width: 26 }, { header: 'Data da opção', width: 18 },
    { header: 'Capital social', width: 24 },
  ];
  const estados = { aguardando: 'Aguardando', consultando: 'Consultando', existente: 'Já no banco', salvo: 'Salva', pendente: 'Pendente' };
  for (const linha of linhas) {
    const row = sheet.addRow([
      formatarDataInclusaoCatcher(linha.dataConsulta), linha.cnpj,
      linha.razaoSocial || '—', linha.nomeFantasia || '—',
      [estados[linha.estado], linha.mensagem].filter(Boolean).join('\n'),
      linha.situacao || '—', linha.modalidade || '—', linha.uf || '—',
      linha.municipio || '—', linha.regimeTributario || '—',
      formatarDataOpcaoCatcher(dataOpcaoSimplesCatcher(linha)),
      normalizarCapitalCatcher(linha.capitalSocial) ?? '—',
    ]);
    row.getCell(2).numFmt = '@';
    row.getCell(12).numFmt = '"R$" #,##0.00';
    row.alignment = { vertical: 'top', wrapText: true };
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'L1' };
  const buffer = await workbook.xlsx.writeBuffer();
  return Uint8Array.from(new Uint8Array(buffer)).buffer;
}
