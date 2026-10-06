import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acesso: vi.fn(), processar: vi.fn() }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/service', () => ({ processarEmpresa: mocks.processar, EsperaCatcher: class extends Error {} }));
import { POST } from '@/app/api/alpha-catcher/route';
const empresa = { cnpj: '33000167000101', consignatario: 'Banco' };
function req(body: unknown = empresa, origin = 'https://alpha.test') {
  return new Request('https://alpha.test/api/alpha-catcher', { method: 'POST', headers: { host: 'alpha.test', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.acesso.mockResolvedValue({ status: 200 }); mocks.processar.mockResolvedValue({ ...empresa, estado: 'salvo' }); });
describe('fronteira HTTP Alpha Catcher', () => {
  it.each([401, 403])('bloqueia acesso %s antes do processamento', async status => {
    mocks.acesso.mockResolvedValue({ status }); expect((await POST(req())).status).toBe(status); expect(mocks.processar).not.toHaveBeenCalled();
  });
  it.each(['https://evil.test', 'invalid'])('bloqueia origem %s', async origin => {
    expect((await POST(req(empresa, origin))).status).toBe(403); expect(mocks.processar).not.toHaveBeenCalled();
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
