import { describe, expect, it, vi } from 'vitest';
import { consultarReceitaWS, criarLimitadorReceitaWS, configReceitaWS, ErroReceitaWS, EsperaReceitaWS } from '@/lib/cnpj/receitaws';

const cnpj = '33000167000101';
const cadastro = { status: 'OK', cnpj, nome: 'Banco', ultima_atualizacao: '2026-10-06T00:00:00Z', billing: { free: false, database: true } };
const env = { RECEITAWS_MODE: 'commercial', RECEITAWS_TOKEN: 'TEST_PRIVATE_TOKEN', RECEITAWS_REQUESTS_PER_MINUTE: '50' };
const deps = () => ({ env, fetcher: vi.fn().mockResolvedValue(Response.json(cadastro)), limitador: criarLimitadorReceitaWS() });

describe('ReceitaWS comercial', () => {
  it('dias escolhidos por consulta prevalecem sobre o padrão do servidor', async () => {
    const d = deps(); await consultarReceitaWS(cnpj, { ...d, days: 7 });
    expect(d.fetcher.mock.calls[0][0]).toContain('/days/7?');
  });
  it('usa token somente no header, days e fallback, sem cache HTTP', async () => {
    const d = deps(); expect(await consultarReceitaWS(cnpj, d)).toEqual({ dados: cadastro, modo: 'commercial' });
    expect(d.fetcher).toHaveBeenCalledWith(`https://receitaws.com.br/v1/cnpj/${cnpj}/days/30?fallback=cacheOnError`, expect.objectContaining({
      cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer TEST_PRIVATE_TOKEN' }),
    }));
    expect(String(d.fetcher.mock.calls[0][0])).not.toContain('TEST_PRIVATE_TOKEN');
  });
  it('aceita atualização imediata e noCache quando configurados', async () => {
    const d = deps(); d.env = { ...env, RECEITAWS_DAYS: '0', RECEITAWS_FALLBACK: 'noCache' } as typeof env;
    await consultarReceitaWS(cnpj, d);
    expect(d.fetcher.mock.calls[0][0]).toContain('/days/0?fallback=noCache');
  });
  it('token seleciona comercial por padrão; modo público permite reversão sem enviar token', async () => {
    expect(configReceitaWS({ RECEITAWS_TOKEN: 'TEST_PRIVATE_TOKEN' }).mode).toBe('commercial');
    const d = deps(); d.env = { ...env, RECEITAWS_MODE: 'public' }; await consultarReceitaWS(cnpj, d);
    expect(d.fetcher.mock.calls[0][0]).toBe(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
    expect(d.fetcher.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });
  it.each([{ RECEITAWS_TOKEN: '' }, { RECEITAWS_REQUESTS_PER_MINUTE: '51' }, { RECEITAWS_DAYS: '-1' }, { RECEITAWS_FALLBACK: 'qualquer' }, { RECEITAWS_MODE: 'outro' }])('configuração inválida não faz requisição: %j', async extra => {
    const d = deps(); d.env = { ...env, ...extra };
    await expect(consultarReceitaWS(cnpj, d)).rejects.toBeInstanceOf(ErroReceitaWS); expect(d.fetcher).not.toHaveBeenCalled();
  });
  it('contabiliza espaço compartilhado entre CNPJs e respeita qualquer janela de minuto', () => {
    let agora = 100000; const limitador = criarLimitadorReceitaWS(() => agora); const inicios: number[] = [];
    for (let i = 0; i < 120000; i += 100) {
      if (limitador.admitir('conta', 50) === 0) inicios.push(agora);
      agora += 100;
    }
    expect(inicios.length).toBeGreaterThan(80);
    for (const inicio of inicios) expect(inicios.filter(time => time >= inicio && time < inicio + 60000).length).toBeLessThanOrEqual(50);
  });
  it('pedidos recusados não prorrogam a reserva; público continua limitado', () => {
    let agora = 0; const limiter = criarLimitadorReceitaWS(() => agora);
    expect(limiter.admitir('conta', 50)).toBe(0); expect(limiter.admitir('conta', 50)).toBe(2);
    agora = 1300; expect(limiter.admitir('conta', 50)).toBe(0);
    expect(limiter.admitir('public', 3)).toBe(0); expect(limiter.admitir('public', 3)).toBe(21);
  });
  it('limite do mesmo token é compartilhado entre chamadas do painel', async () => {
    (globalThis as typeof globalThis & { receitawsLimitador?: unknown }).receitawsLimitador = undefined;
    const fetcher = vi.fn().mockResolvedValue(Response.json(cadastro));
    await consultarReceitaWS(cnpj, { env, fetcher });
    await expect(consultarReceitaWS('00000000000191', { env, fetcher })).rejects.toBeInstanceOf(EsperaReceitaWS);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('429 bloqueia as demais chamadas pelo Retry-After', async () => {
    let agora = 10000;
    const d = { ...deps(), limitador: criarLimitadorReceitaWS(() => agora) };
    d.fetcher.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '20' } }));
    await expect(consultarReceitaWS(cnpj, d)).rejects.toMatchObject({ segundos: 20 });
    agora += 5000; await expect(consultarReceitaWS(cnpj, d)).rejects.toMatchObject({ segundos: 15 });
    expect(d.fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([[402, 'RECEITA_QUOTA_EXHAUSTED'], [401, 'RECEITA_UNAUTHORIZED'], [403, 'RECEITA_UNAUTHORIZED'], [504, 'RECEITA_TIMEOUT'], [503, 'RECEITA_UNAVAILABLE']])('erro %s é seguro e específico', async (status, codigo) => {
    const d = deps(); d.fetcher.mockResolvedValueOnce(new Response('TEST_PRIVATE_TOKEN', { status: Number(status) }));
    try { await consultarReceitaWS(cnpj, d); throw new Error('Deveria falhar'); } catch (error) {
      expect(error).toMatchObject({ codigo }); expect(String(error)).not.toContain('TEST_PRIVATE_TOKEN');
    }
  });
  it.each([{}, null, { ...cadastro, status: 'ERROR' }, { ...cadastro, cnpj: '00000000000191' }, { ...cadastro, nome: '' }])('rejeita corpo inválido antes do Radar: %j', async body => {
    const d = deps(); d.fetcher.mockResolvedValueOnce(Response.json(body));
    await expect(consultarReceitaWS(cnpj, d)).rejects.toMatchObject({ codigo: 'RECEITA_INVALID_RESPONSE' });
  });
});
