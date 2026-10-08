import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acesso: vi.fn(), processar: vi.fn(), aceita: vi.fn(), resultado: vi.fn(), consulta: vi.fn(), contexto: vi.fn() }));
vi.mock('@/lib/alpha-catcher/historico', () => ({ historicoCatcher: { aceitaEmpresa: mocks.aceita, resultado: mocks.resultado, consulta: mocks.consulta, contexto: mocks.contexto } }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/service', () => ({ processarEmpresa: mocks.processar, EsperaCatcher: class extends Error {} }));
import { POST } from '@/app/api/alpha-catcher/route';
const empresa = { cnpj: '33000167000101', consignatario: 'Banco' };
function req(body: unknown = empresa, origin = 'https://alpha.test') {
  return new Request('https://alpha.test/api/alpha-catcher', { method: 'POST', headers: { host: 'alpha.test', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.acesso.mockResolvedValue({ status: 200, userId: 42 }); mocks.aceita.mockReturnValue(true); mocks.contexto.mockImplementation(async (...args) => mocks.aceita(...args) ? { origem: 'LOGCOMEX', empresa } : null); mocks.resultado.mockResolvedValue(undefined); mocks.processar.mockResolvedValue({ ...empresa, estado: 'salvo' }); });
describe('fronteira HTTP Alpha Catcher', () => {
  it('envia a escolha da interface para a consulta; padrão 30 dias', async () => {
    expect((await POST(req({ ...empresa, days: 0 }))).status).toBe(200);
    expect(mocks.processar).toHaveBeenLastCalledWith(empresa, undefined, { days: 0, origem: 'JSON' });
    await POST(req()); expect(mocks.processar).toHaveBeenLastCalledWith(empresa, undefined, { days: 30, origem: 'JSON' });
  });
  it.each([-1, 0.5, '30', null])('rejeita idade máxima inválida %s antes da API', async days => {
    expect((await POST(req({ ...empresa, days }))).status).toBe(400);
    expect(mocks.processar).not.toHaveBeenCalled();
  });
  it.each([401, 403])('bloqueia acesso %s antes do processamento', async status => {
    mocks.acesso.mockResolvedValue({ status }); expect((await POST(req())).status).toBe(status); expect(mocks.processar).not.toHaveBeenCalled();
  });
  it.each(['https://evil.test', 'invalid'])('bloqueia origem %s', async origin => {
    expect((await POST(req(empresa, origin))).status).toBe(403); expect(mocks.processar).not.toHaveBeenCalled();
  });
  it('vincula somente empresa coletada pelo próprio usuário e registra resultado real', async () => {
    const historicoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect((await POST(req({ ...empresa, historicoId, novasSalvas: 999 }))).status).toBe(200);
    expect(mocks.aceita).toHaveBeenCalledWith(historicoId, 42, empresa.cnpj);
    expect(mocks.resultado).toHaveBeenCalledWith(historicoId, 42, { ...empresa, estado: 'salvo' });
    mocks.aceita.mockReturnValue(false); mocks.processar.mockClear();
    expect((await POST(req({ ...empresa, historicoId }))).status).toBe(404);
    expect(mocks.processar).not.toHaveBeenCalled();
  });
  it('valida CNPJ antes de consultar', async () => {
    expect((await POST(req({ ...empresa, cnpj: 'invalid' }))).status).toBe(400); expect(mocks.processar).not.toHaveBeenCalled();
  });
  it('limita tamanho da entrada', async () => {
    expect((await POST(req({ ...empresa, extra: 'x'.repeat(5000) }))).status).toBe(413); expect(mocks.processar).not.toHaveBeenCalled();
  });
  it('processa entrada autorizada e não retorna dados internos', async () => {
    const res = await POST(req()); expect(res.status).toBe(200); expect(await res.json()).toEqual({ ...empresa, estado: 'salvo' });
  });
});

describe('data da consulta no contrato JSON', () => {
  it('repassa data escolhida validada', async () => {
    expect((await POST(req({ ...empresa, dataConsulta: '2020-02-29' }))).status).toBe(200);
    expect(mocks.processar).toHaveBeenCalledWith(empresa, undefined, { days: 30, origem: 'JSON', dataConsulta: '2020-02-29' });
  });
  it.each([null, 123, '', '2025-02-29', '2099-01-01'])('rejeita data inválida %s', async dataConsulta => {
    expect((await POST(req({ ...empresa, dataConsulta }))).status).toBe(400);
    expect(mocks.processar).not.toHaveBeenCalled();
  });
  it('não permite data personalizada em histórico Logcomex', async () => {
    expect((await POST(req({ ...empresa, dataConsulta: '2020-01-01', historicoId: '11111111-1111-4111-8111-111111111111' }))).status).toBe(400);
    expect(mocks.processar).not.toHaveBeenCalled();
  });
});

describe('origem de importação validada pelo servidor', () => {
  it('histórico JSON preserva data e consignatário registrados e ignora origem forjada', async () => {
    mocks.contexto.mockResolvedValue({ origem: 'JSON', dataConsulta: '2026-09-28', empresa: { ...empresa, consignatario: 'Original' } });
    const historicoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect((await POST(req({ ...empresa, historicoId, origem: 'LOGCOMEX' }))).status).toBe(200);
    expect(mocks.processar).toHaveBeenCalledWith({ ...empresa, consignatario: 'Original' }, undefined, { days: 30, origem: 'JSON', dataConsulta: '2026-09-28', importacaoId: historicoId, importacaoUserId: 42 });
    expect((await POST(req({ ...empresa, historicoId, dataConsulta: '2026-09-27' }))).status).toBe(400);
  });
  it('JSON ignora origem declarada pelo cliente', async () => {
    await POST(req({ ...empresa, origem: 'LOGCOMEX' }));
    expect(mocks.processar).toHaveBeenCalledWith(empresa, undefined, { days: 30, origem: 'JSON' });
  });
  it('histórico autorizado determina Logcomex', async () => {
    await POST(req({ ...empresa, origem: 'JSON', historicoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
    expect(mocks.processar).toHaveBeenCalledWith(empresa, undefined, { days: 30, origem: 'LOGCOMEX', importacaoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', importacaoUserId: 42 });
  });
});
