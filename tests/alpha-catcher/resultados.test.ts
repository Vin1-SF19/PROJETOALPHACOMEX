import { describe, expect, it } from 'vitest';
import { normalizarCapitalCatcher, formatarCapitalCatcher, dataOpcaoSimplesCatcher, formatarDataOpcaoCatcher, formatarDataInclusaoCatcher, ordenarResultadosCatcher } from '@/lib/alpha-catcher/resultados';
const linhas = [
  { cnpj: '3', consignatario: 'Zulu', estado: 'salvo', razaoSocial: 'Álpha', municipio: 'Santos', uf: 'SP' },
  { cnpj: '1', consignatario: 'beta', estado: 'pendente', municipio: null },
  { cnpj: '2', consignatario: 'Alpha', estado: 'existente', municipio: 'Curitiba', uf: 'PR' },
];
describe('ordenação dos resultados Catcher', () => {
  it('usa razão social ou consignatário, ignora acentos e preserva empates', () => {
    expect(ordenarResultadosCatcher(linhas, 'empresa', 'asc').map(l => l.cnpj)).toEqual(['3', '2', '1']);
    expect(ordenarResultadosCatcher(linhas, 'empresa', 'desc').map(l => l.cnpj)).toEqual(['1', '3', '2']);
  });
  it('mantém campos ausentes ao final em ambas as direções', () => {
    expect(ordenarResultadosCatcher(linhas, 'localidade', 'asc').map(l => l.cnpj)).toEqual(['2', '3', '1']);
    expect(ordenarResultadosCatcher(linhas, 'localidade', 'desc').map(l => l.cnpj)).toEqual(['3', '2', '1']);
  });
  it('ordena datas pelo instante original, com ausentes ou inválidas ao final', () => {
    const datas = [
      { ...linhas[0], dataConsulta: '2026-10-06T01:00:00-03:00' },
      { ...linhas[1], dataConsulta: '2026-10-06T03:30:00Z' },
      { ...linhas[2], dataConsulta: null },
      { ...linhas[2], cnpj: '4', dataConsulta: 'inválida' },
    ];
    expect(ordenarResultadosCatcher(datas, 'dataConsulta', 'asc').map(l => l.cnpj)).toEqual(['1', '3', '2', '4']);
    expect(ordenarResultadosCatcher(datas, 'dataConsulta', 'desc').map(l => l.cnpj)).toEqual(['3', '1', '2', '4']);
    expect(datas[0].dataConsulta).toBe('2026-10-06T01:00:00-03:00');
  });
  it('não altera a fila original e permite recuperar a ordem de importação', () => {
    ordenarResultadosCatcher(linhas, 'cnpj', 'desc');
    expect(linhas.map(l => l.cnpj)).toEqual(['3', '1', '2']);
    expect(ordenarResultadosCatcher(linhas, 'original', 'desc')).toEqual(linhas);
  });
  it('ordena todo o conjunto antes de paginar e respeita filtro prévio', () => {
    const muitas = Array.from({ length: 65 }, (_, i) => ({ cnpj: String(65 - i), consignatario: 'Empresa', estado: 'salvo' }));
    expect(ordenarResultadosCatcher(muitas, 'cnpj', 'asc').slice(50).map(l => l.cnpj)).toEqual(Array.from({ length: 15 }, (_, i) => String(51 + i)));
    expect(ordenarResultadosCatcher(linhas.filter(l => l.estado !== 'salvo'), 'cnpj', 'desc').map(l => l.cnpj)).toEqual(['2', '1']);
  });
});

describe('data original de inclusão', () => {
  it('formata o instante do banco em Brasília inclusive na mudança de dia', () => {
    expect(formatarDataInclusaoCatcher('2025-04-10T02:30:00.000Z')).toBe('09/04/2025, 23:30');
  });
  it('não inventa a data atual para empresas sem data', () => {
    expect(formatarDataInclusaoCatcher()).toBe('—');
    expect(formatarDataInclusaoCatcher(null)).toBe('—');
    expect(formatarDataInclusaoCatcher('inválida')).toBe('—');
  });
});

describe('data da opção pelo Simples', () => {
  it('exibe a data somente para optantes e aceita cadastros antigos identificados pelo regime', () => {
    const base = { dataOpcao: '2020-01-01T00:00:00Z', regimeTributario: 'Simples Nacional' };
    expect(dataOpcaoSimplesCatcher({ ...base, optanteSimples: true })).toBe(base.dataOpcao);
    expect(dataOpcaoSimplesCatcher({ ...base, optanteSimples: false })).toBeNull();
    expect(dataOpcaoSimplesCatcher({ ...base, optanteSimples: null })).toBe(base.dataOpcao);
    expect(dataOpcaoSimplesCatcher({ ...base, regimeTributario: 'Regime Normal' })).toBeNull();
    expect(formatarDataOpcaoCatcher(base.dataOpcao)).toBe('01/01/2020');
  });
  it('ordena datas de opção sem incluir datas históricas de não optantes', () => {
    const datas = [
      { ...linhas[0], optanteSimples: true, dataOpcao: '2020-01-01T00:00:00Z' },
      { ...linhas[1], optanteSimples: false, dataOpcao: '2010-01-01T00:00:00Z' },
      { ...linhas[2], optanteSimples: true, dataOpcao: '2019-01-01T00:00:00Z' },
    ];
    expect(ordenarResultadosCatcher(datas, 'dataOpcao', 'asc').map(l => l.cnpj)).toEqual(['2', '3', '1']);
    expect(ordenarResultadosCatcher(datas, 'dataOpcao', 'desc').map(l => l.cnpj)).toEqual(['3', '2', '1']);
  });
});

it('capital social é numérico, preserva zero e deixa ausentes no final', () => {
  expect(normalizarCapitalCatcher('1.234,56')).toBe(1234.56);
  expect(formatarCapitalCatcher('0')).toContain('0,00');
  expect(formatarCapitalCatcher('inválido')).toBe('—');
  const dados = [{ ...linhas[0], capitalSocial: '1000' }, { ...linhas[1], capitalSocial: '99.50' }, { ...linhas[2], capitalSocial: null }];
  expect(ordenarResultadosCatcher(dados, 'capitalSocial', 'asc').map(l => l.cnpj)).toEqual(['1', '3', '2']);
  expect(ordenarResultadosCatcher(dados, 'capitalSocial', 'desc').map(l => l.cnpj)).toEqual(['3', '1', '2']);
});
