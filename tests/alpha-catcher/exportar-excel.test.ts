import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { gerarExcelCatcher } from '@/lib/alpha-catcher/exportar-excel';

describe('Planilha Alpha Catcher', () => {
  it('preserva zeros do CNPJ, texto literal, datas e linhas além da primeira página', async () => {
    const linhas = Array.from({ length: 60 }, (_, i) => ({
      cnpj: '01234567000189', consignatario: '=1+1', estado: 'existente' as const,
      razaoSocial: `Empresa ${i}`, nomeFantasia: '=1+1', capitalSocial: i === 0 ? '1234567.89' : '0', dataConsulta: '2025-04-01T12:30:00.000Z',
      regimeTributario: 'Simples Nacional', optanteSimples: i === 0,
      dataOpcao: '2020-01-01T00:00:00.000Z',
    }));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await gerarExcelCatcher(linhas));
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(61);
    expect(sheet.getCell('L2').value).toBe(1234567.89);
    expect(sheet.getCell('L3').value).toBe(0);
    expect(sheet.getCell('L2').numFmt).toContain('R$');
    expect(sheet.getRow(1).values).toEqual([undefined, 'Data da consulta', 'CNPJ', 'Razão social', 'Nome fantasia', 'Processamento', 'Situação Radar', 'Modalidade', 'UF', 'Município', 'Regime tributário', 'Data da opção', 'Capital social']);
    expect(sheet.getCell('A2').value).toBe('01/04/2025, 09:30');
    expect(sheet.getCell('B2').value).toBe('01234567000189');
    expect(sheet.getCell('B2').numFmt).toBe('@');
    expect(sheet.getCell('C2').value).toBe('Empresa 0');
    expect(sheet.getCell('D2').value).toBe('=1+1');
    expect(sheet.getCell('D2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('E2').value).toBe('Já no banco');
    expect(sheet.getCell('K2').value).toBe('01/01/2020');
    expect(sheet.getCell('K3').value).toBe('—');
    expect(sheet.getCell('C61').value).toBe('Empresa 59');
  });
});
