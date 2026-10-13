import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acesso: vi.fn(), listarCompartilhado: vi.fn(), detalharCompartilhado: vi.fn(), remoto: vi.fn() }));
vi.mock('@/lib/alpha-catcher/worker-client', () => ({ encaminharWorkerCatcher: mocks.remoto }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/historico', () => ({ historicoCatcher: { listarCompartilhado: mocks.listarCompartilhado, detalharCompartilhado: mocks.detalharCompartilhado } }));
import { GET } from '@/app/api/alpha-catcher/historico/route';
import { GET as DETALHE } from '@/app/api/alpha-catcher/historico/[id]/route';
beforeEach(() => { vi.clearAllMocks(); mocks.remoto.mockResolvedValue(null); mocks.acesso.mockResolvedValue({ status: 200, userId: 42 }); mocks.listarCompartilhado.mockResolvedValue({ importacoes: [], proximoCursor: null }); });
describe('acesso ao histórico Catcher', () => {
  it.each([401, 403])('não lista histórico sem acesso %s', async status => {
    mocks.acesso.mockResolvedValue({ status }); expect((await GET(new Request('https://alpha.test/api/alpha-catcher/historico'))).status).toBe(status); expect(mocks.listarCompartilhado).not.toHaveBeenCalled();
  });
  it('compartilha após gate do módulo, pagina e ignora usuário enviado', async () => {
    const res = await GET(new Request('https://alpha.test/api/alpha-catcher/historico?cursor=50&userId=99'));
    expect(res.status).toBe(200); expect(mocks.listarCompartilhado).toHaveBeenCalledWith(50, 42); expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('rejeita cursor inválido', async () => { expect((await GET(new Request('https://alpha.test/api/alpha-catcher/historico?cursor=-1'))).status).toBe(400); expect(mocks.listarCompartilhado).not.toHaveBeenCalled(); });
});

it('detalhe compartilhado mantém gate e aceita UUID legado único', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  mocks.detalharCompartilhado.mockResolvedValue(null);
  const res = await DETALHE(new Request('https://alpha.test/api/alpha-catcher/historico/' + id), { params: Promise.resolve({ id }) });
  expect(res.status).toBe(404); expect(mocks.detalharCompartilhado).toHaveBeenCalledWith(id, 42);
});

it.each([401, 403])('detalhe não chama leitura sem acesso %s', async status => {
  mocks.acesso.mockResolvedValue({ status });
  expect((await DETALHE(new Request('https://alpha.test'), { params: Promise.resolve({ id: '198' }) })).status).toBe(status);
  expect(mocks.detalharCompartilhado).not.toHaveBeenCalled();
});
it('usuários autorizados leem o mesmo registro por ID inequívoco', async () => {
  mocks.detalharCompartilhado.mockResolvedValue({ importacao: { autor: { usuario: 'lucca' } }, linhas: [] });
  for (const userId of [42, 99]) {
    mocks.acesso.mockResolvedValue({ status: 200, userId });
    const res = await DETALHE(new Request('https://alpha.test'), { params: Promise.resolve({ id: '198' }) });
    expect(res.status).toBe(200); expect((await res.json()).importacao.autor.usuario).toBe('lucca');
    expect(mocks.detalharCompartilhado).toHaveBeenLastCalledWith(198, userId);
  }
});
it.each(['0', '-1', '9007199254740992', 'abc'])('rejeita referência inválida %s', async id => {
  expect((await DETALHE(new Request('https://alpha.test'), { params: Promise.resolve({ id }) })).status).toBe(400);
  expect(mocks.detalharCompartilhado).not.toHaveBeenCalled();
});

it('histórico remoto preserva estado ativo do worker e não infere interrupção local', async () => {
  mocks.remoto.mockResolvedValue(new Response(JSON.stringify({importacoes:[{estado:'em_andamento',autor:{usuario:'lucca'}}],proximoCursor:null})));
  const res=await GET(new Request('https://alpha.test/api/alpha-catcher/historico'));
  expect((await res.json()).importacoes[0].estado).toBe('em_andamento');expect(mocks.listarCompartilhado).not.toHaveBeenCalled();
  expect(mocks.remoto).toHaveBeenCalledWith('listar-historico',42,null);
});
