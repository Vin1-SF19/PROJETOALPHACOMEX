import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acesso: vi.fn(), iniciarJson: vi.fn() }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/historico', () => ({ historicoCatcher: { iniciarJson: mocks.iniciarJson } }));
import { POST } from '@/app/api/alpha-catcher/importacoes/json/route';
const empresa = { cnpj: '33000167000101', consignatario: 'Banco' };
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function req(body: unknown, origin = 'https://alpha.test') {
  return new Request('https://alpha.test/api/alpha-catcher/importacoes/json', { method: 'POST', headers: { host: 'alpha.test', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.acesso.mockResolvedValue({ status: 200, userId: 42 }); mocks.iniciarJson.mockResolvedValue(undefined); });
it('deduplica e valida servidor, usa autoria autenticada, preserva data e não aceita resultados do cliente', async () => {
  const res = await POST(req({ id, arquivo: 'empresas.json', empresas: [empresa, empresa, { cnpj: 'invalido' }], dataConsulta: '2026-09-28', userId: 99, novasSalvas: 999 }));
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ id, total: 1, duplicados: 1, invalidos: 1 });
  expect(mocks.iniciarJson).toHaveBeenCalledWith(id, 42, 'empresas.json', [empresa], '2026-09-28');
});
it.each([401, 403])('bloqueia acesso %s', async status => {
  mocks.acesso.mockResolvedValue({ status });
  expect((await POST(req({ arquivo: 'a.json', empresas: [empresa] }))).status).toBe(status);
  expect(mocks.iniciarJson).not.toHaveBeenCalled();
});
it('bloqueia origem cruzada, data inválida e arquivo sem empresas', async () => {
  expect((await POST(req({ arquivo: 'a.json', empresas: [empresa] }, 'https://evil.test'))).status).toBe(403);
  expect((await POST(req({ arquivo: 'a.json', empresas: [empresa], dataConsulta: '2099-01-01' }))).status).toBe(400);
  expect((await POST(req({ arquivo: 'a.json', empresas: [] }))).status).toBe(400);
  expect(mocks.iniciarJson).not.toHaveBeenCalled();
});
it('falha de persistência impede iniciar processamento sem histórico', async () => {
  mocks.iniciarJson.mockRejectedValue(new Error('db'));
  expect((await POST(req({ arquivo: 'a.json', empresas: [empresa] }))).status).toBe(503);
});
