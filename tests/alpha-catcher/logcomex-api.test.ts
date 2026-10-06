import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acesso: vi.fn(), iniciar: vi.fn(), ler: vi.fn(), cancelar: vi.fn(), confirmar: vi.fn() }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/logcomex-job', () => ({ iniciarColeta: mocks.iniciar, lerColeta: mocks.ler, cancelarColeta: mocks.cancelar, confirmarCaptcha: mocks.confirmar }));
import { GET, POST } from '@/app/api/alpha-catcher/logcomex/route';
const input = { data: '2026-10-05', limite: 5 };
const post = (value: unknown, origin = 'https://alpha.test') => new Request('https://alpha.test/api/alpha-catcher/logcomex', {
  method: 'POST', headers: { origin, host: 'alpha.test', 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});
beforeEach(() => { vi.clearAllMocks(); mocks.acesso.mockResolvedValue({ status: 200, userId: 42 }); mocks.iniciar.mockResolvedValue({ id: 'job', estado: 'executando' }); });
describe('importação automática Shipment Intel', () => {
  it('inicia com parâmetros validados e proprietário da sessão', async () => {
    expect((await POST(post(input))).status).toBe(202); expect(mocks.iniciar).toHaveBeenCalledWith(42, input);
  });
  it.each([{ ...input, limite: 0 }, { ...input, limite: 10001 }, { ...input, data: '2026-02-30' }])('bloqueia parâmetros inválidos', async value => {
    expect((await POST(post(value))).status).toBe(400); expect(mocks.iniciar).not.toHaveBeenCalled();
  });
  it('bloqueia origem externa', async () => {
    expect((await POST(post(input, 'https://evil.test'))).status).toBe(403); expect(mocks.iniciar).not.toHaveBeenCalled();
  });
  it('não inicia nem consulta jobs sem acesso', async () => {
    mocks.acesso.mockResolvedValue({ status: 403 }); expect((await POST(post(input))).status).toBe(403);
    expect((await GET(new Request('https://alpha.test/api/alpha-catcher/logcomex?id=job'))).status).toBe(403);
    expect(mocks.iniciar).not.toHaveBeenCalled(); expect(mocks.ler).not.toHaveBeenCalled();
  });
  it('limita corpo antes da validação', async () => {
    expect((await POST(post({ ...input, extra: 'x'.repeat(2000) }))).status).toBe(413); expect(mocks.iniciar).not.toHaveBeenCalled();
  });
  it('consulta status isolado pelo dono da execução', async () => {
    mocks.ler.mockReturnValue(null); expect((await GET(new Request('https://alpha.test/api/alpha-catcher/logcomex?id=job'))).status).toBe(404);
    expect(mocks.ler).toHaveBeenCalledWith('job', 42);
  });
  it('cancelamento usa identidade da sessão, sem aceitar identidade do payload', async () => {
    await POST(post({ acao: 'cancelar', id: 'job', userId: 99 })); expect(mocks.cancelar).toHaveBeenCalledWith('job', 42);
  });
  it('conflito de execução retorna 409', async () => {
    mocks.iniciar.mockRejectedValue(new Error('lock')); expect((await POST(post(input))).status).toBe(409);
  });
  it.each(['confirmar_captcha', 'tentar_captcha'])('checagem %s usa proprietário autenticado e não inicia outra coleta', async acao => {
    mocks.confirmar.mockReturnValue(true);
    expect((await POST(post({ acao, id: 'job', userId: 99 }))).status).toBe(202);
    expect(mocks.confirmar).toHaveBeenCalledWith('job', 42, acao); expect(mocks.iniciar).not.toHaveBeenCalled();
  });
  it('checagem recusada não afirma resolução', async () => {
    mocks.confirmar.mockReturnValue(false);
    const response = await POST(post({ acao: 'confirmar_captcha', id: 'job' }));
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ verificando: false });
  });
});
