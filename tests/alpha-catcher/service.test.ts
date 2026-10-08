import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ default: { consultas_radar: { findUnique: vi.fn(), create: vi.fn() } } }));
import { processarEmpresa, EsperaCatcher } from '@/lib/alpha-catcher/service';
import { ErroReceitaWS } from '@/lib/cnpj/receitaws';
import { ErroConsultaRadar } from '@/lib/radar/consulta';

const empresa = { cnpj: '33000167000101', consignatario: 'Banco' };
const row = { razao_social: 'BANCO', nome_fantasia: 'BANCO FANTASIA', capital_social: '1234.56', situacao_radar: 'DEFERIDA', submodalidade: 'ILIMITADA', municipio: 'Brasília', uf: 'DF', regime_tributario: 'Regime Normal', optante_simples: false, data_opcao: null, data_consulta: new Date('2025-04-10T14:30:00.000Z') };
function dependencias() {
  return {
    buscar: vi.fn().mockResolvedValue(null), salvar: vi.fn().mockResolvedValue(row),
    receita: vi.fn().mockResolvedValue({ status: 'OK', cnpj: empresa.cnpj, nome: 'Banco', simples: { optante: false } }),
    radar: vi.fn().mockResolvedValue({ situacao: 'DEFERIDA', submodalidade: 'ILIMITADA' }),
  };
}
it('reconcilia criação pela mesma importação após crash sem contar outras importações como novas', async () => {
  const deps = dependencias();
  const importacaoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await processarEmpresa(empresa, deps, { importacaoId, importacaoUserId: 42 });
  const metadata = JSON.parse(deps.salvar.mock.calls[0][0].json_completo);
  expect(metadata).toMatchObject({ importacaoId, importacaoUserId: 42 });
  deps.buscar.mockResolvedValue({ ...row, json_completo: JSON.stringify(metadata) });
  deps.receita.mockClear(); deps.salvar.mockClear();
  expect(await processarEmpresa(empresa, deps, { importacaoId, importacaoUserId: 42 })).toMatchObject({ estado: 'salvo' });
  expect(await processarEmpresa(empresa, deps, { importacaoId, importacaoUserId: 99 })).toMatchObject({ estado: 'existente' });
  expect(deps.receita).not.toHaveBeenCalled(); expect(deps.salvar).not.toHaveBeenCalled();
});
describe('processamento Alpha Catcher', () => {
  it('repassa dias escolhidos e registra a política sem alterar o cadastro', async () => {
    const deps = dependencias(); await processarEmpresa(empresa, deps, { days: 0 });
    expect(deps.receita).toHaveBeenCalledWith(empresa.cnpj, 0);
    expect(JSON.parse(deps.salvar.mock.calls[0][0].json_completo).politicaReceita).toEqual({ days: 0 });
  });
  it('aguarda validar ReceitaWS antes de iniciar Radar', async () => {
    const deps = dependencias(); let liberar!: (value: object) => void;
    deps.receita.mockImplementation(() => new Promise(resolve => { liberar = resolve; }));
    const job = processarEmpresa(empresa, deps);
    await Promise.resolve(); await Promise.resolve();
    expect(deps.radar).not.toHaveBeenCalled();
    liberar({ status: 'OK', cnpj: empresa.cnpj, nome: 'Banco', modoReceitaWS: 'commercial' });
    await expect(job).resolves.toMatchObject({ estado: 'salvo' });
    expect(deps.radar).toHaveBeenCalledOnce();
    expect(deps.salvar).toHaveBeenCalledWith(expect.objectContaining({ fonte: expect.stringContaining('RECEITAWS_COMERCIAL') }));
  });
  it('cota esgotada interrompe antes do Radar sem gravar empresa', async () => {
    const deps = dependencias(); deps.receita.mockRejectedValue(new ErroReceitaWS('RECEITA_QUOTA_EXHAUSTED', 'Cota esgotada', 402));
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'pendente', codigo: 'RECEITA_QUOTA_EXHAUSTED' });
    expect(deps.radar).not.toHaveBeenCalled(); expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('reaproveita qualquer registro existente sem API ou gravação', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValue(row);
    expect(await processarEmpresa({ ...empresa, dataConsulta: '2026-10-06T15:00:00.000Z' }, deps)).toMatchObject({ estado: 'existente', nomeFantasia: 'BANCO FANTASIA', capitalSocial: '1234.56', dataConsulta: '2025-04-10T14:30:00.000Z' });
    expect(deps.receita).not.toHaveBeenCalled(); expect(deps.radar).not.toHaveBeenCalled();
    expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('retorna regime e data de opção originais de empresa já salva sem reconsultar', async () => {
    const deps = dependencias();
    deps.buscar.mockResolvedValue({ ...row, regime_tributario: 'Simples Nacional', optante_simples: true, data_opcao: new Date('2020-01-01T00:00:00Z') });
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'existente', regimeTributario: 'Simples Nacional', optanteSimples: true, dataOpcao: '2020-01-01T00:00:00.000Z', dataConsulta: row.data_consulta.toISOString() });
    expect(deps.receita).not.toHaveBeenCalled(); expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('salva a combinação das APIs com a origem e retorna a data atribuída pelo banco', async () => {
    const deps = dependencias();
    const criado = { ...row, data_consulta: new Date('2026-10-06T18:00:00.000Z') };
    deps.salvar.mockResolvedValue(criado);
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'salvo', nomeFantasia: 'BANCO FANTASIA', capitalSocial: '1234.56', dataConsulta: criado.data_consulta.toISOString() });
    expect(deps.salvar.mock.calls[0][0]).not.toHaveProperty('data_consulta');
    expect(deps.salvar).toHaveBeenCalledWith(expect.objectContaining({ cnpj: empresa.cnpj, regime_tributario: 'Regime Normal', optante_simples: false, fonte: expect.stringContaining('ALPHA_CATCHER') }));
  });
  it('não grava Receita inválida nem CNPJ divergente', async () => {
    const deps = dependencias(); deps.receita.mockResolvedValue({ status: 'OK', cnpj: '00000000000000', nome: 'Outra' });
    expect((await processarEmpresa(empresa, deps)).estado).toBe('pendente');
    expect(deps.salvar).not.toHaveBeenCalled(); expect(deps.radar).not.toHaveBeenCalled();
  });
  it('resposta nula da Receita não desaparece nem grava placeholder', async () => {
    const deps = dependencias(); deps.receita.mockResolvedValue(null);
    expect((await processarEmpresa(empresa, deps)).estado).toBe('pendente');
    expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('404 salva sem inventar situação Radar', async () => {
    const deps = dependencias(); deps.radar.mockRejectedValue(new ErroConsultaRadar(404, 'NOT_FOUND', 'Não encontrado'));
    expect((await processarEmpresa(empresa, deps)).estado).toBe('salvo');
    expect(deps.salvar).toHaveBeenCalledWith(expect.objectContaining({ situacao_radar: null, submodalidade: null }));
  });
  it('captcha permanece pendente sem gravação', async () => {
    const deps = dependencias(); deps.radar.mockRejectedValue(new ErroConsultaRadar(502, 'BLOCKED_BY_CAPTCHA', 'Captcha'));
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'pendente', codigo: 'BLOCKED_BY_CAPTCHA' });
    expect(deps.salvar).not.toHaveBeenCalled();
  });
  it('limite impede novas chamadas', async () => {
    const deps = dependencias(); deps.receita.mockRejectedValue(new EsperaCatcher(2));
    await expect(processarEmpresa(empresa, deps)).rejects.toBeInstanceOf(EsperaCatcher);
    expect(deps.radar).not.toHaveBeenCalled();
  });
  it('concorrência preserva o registro de outra sessão', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    deps.salvar.mockRejectedValue({ code: 'P2002' });
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'existente', nomeFantasia: 'BANCO FANTASIA', capitalSocial: '1234.56', dataConsulta: '2025-04-10T14:30:00.000Z' });
    expect(deps.salvar).toHaveBeenCalledTimes(1);
  });
  it('falha de persistência é pendente', async () => {
    const deps = dependencias(); deps.salvar.mockRejectedValue(new Error('secret database details'));
    expect(await processarEmpresa(empresa, deps)).toMatchObject({ estado: 'pendente', codigo: 'SAVE_FAILED' });
  });
});

 describe('data original da planilha JSON', () => {
  it('grava dia escolhido na criação e retorna a data salva', async () => {
    const deps = dependencias();
    deps.salvar.mockImplementation(async data => ({ ...row, data_consulta: data.data_consulta }));
    expect(await processarEmpresa(empresa, deps, { dataConsulta: '2020-02-29' })).toMatchObject({ dataConsulta: '2020-02-29T15:00:00.000Z' });
    expect(deps.salvar.mock.calls[0][0].data_consulta).toEqual(new Date('2020-02-29T15:00:00Z'));
    expect(deps.receita).toHaveBeenCalledOnce(); expect(deps.radar).toHaveBeenCalledOnce();
  });
  it('mantém data de existente e não chama APIs', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValue(row);
    expect(await processarEmpresa(empresa, deps, { dataConsulta: '2020-01-01' })).toMatchObject({ estado: 'existente', dataConsulta: row.data_consulta.toISOString() });
    expect(deps.salvar).not.toHaveBeenCalled(); expect(deps.receita).not.toHaveBeenCalled();
  });
  it('mantém data da empresa criada por sessão concorrente', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    deps.salvar.mockRejectedValue({ code: 'P2002' });
    expect(await processarEmpresa(empresa, deps, { dataConsulta: '2020-01-01' })).toMatchObject({ estado: 'existente', dataConsulta: row.data_consulta.toISOString() });
  });
  it.each(['2025-02-29', '2099-01-01', '', '2020-01-01T00:00:00Z'])('rejeita data inválida %s antes das APIs', async dataConsulta => {
    const deps = dependencias();
    await expect(processarEmpresa(empresa, deps, { dataConsulta })).rejects.toThrow('Data da consulta inválida');
    expect(deps.buscar).not.toHaveBeenCalled(); expect(deps.receita).not.toHaveBeenCalled();
  });
});

describe('fonte da importação', () => {
  it.each(['JSON', 'LOGCOMEX'] as const)('registra origem %s na fonte e metadados', async origem => {
    const deps = dependencias();
    deps.receita.mockResolvedValue({ status: 'OK', cnpj: empresa.cnpj, nome: 'Banco', modoReceitaWS: 'commercial' });
    await processarEmpresa(empresa, deps, { origem });
    expect(deps.salvar.mock.calls[0][0].fonte).toBe(`ALPHA_CATCHER+${origem}+RECEITAWS_COMERCIAL+CONSULTA_RADAR`);
    expect(JSON.parse(deps.salvar.mock.calls[0][0].json_completo).origemImportacao).toBe(origem);
  });
  it('chamada sem origem assume JSON', async () => {
    const deps = dependencias(); await processarEmpresa(empresa, deps);
    expect(deps.salvar.mock.calls[0][0].fonte).toBe('ALPHA_CATCHER+JSON+RECEITAWS_PUBLICA+CONSULTA_RADAR');
  });
  it('não sobrescreve fonte de registro existente', async () => {
    const deps = dependencias(); deps.buscar.mockResolvedValue(row);
    await processarEmpresa(empresa, deps, { origem: 'JSON' });
    expect(deps.salvar).not.toHaveBeenCalled(); expect(deps.receita).not.toHaveBeenCalled();
  });
});
