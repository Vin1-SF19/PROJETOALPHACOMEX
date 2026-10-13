import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ acesso: vi.fn(), iniciar: vi.fn(), retomar: vi.fn(), ler: vi.fn(), cancelar: vi.fn(), confirmar: vi.fn(), remoto: vi.fn() }));
vi.mock('@/lib/alpha-catcher/worker-client', () => ({ encaminharWorkerCatcher: mocks.remoto }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/logcomex-job', () => ({ iniciarColeta: mocks.iniciar, retomarColeta: mocks.retomar, lerColetaResposta: mocks.ler, cancelarColeta: mocks.cancelar, confirmarCaptcha: mocks.confirmar }));
import { GET, POST } from '@/app/api/alpha-catcher/logcomex/route';
const input = { data: '2026-10-05', limite: 5 };
const post = (value: unknown, origin = 'https://alpha.test') => new Request('https://alpha.test/api/alpha-catcher/logcomex', {
  method: 'POST', headers: { origin, host: 'alpha.test', 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});
afterEach(() => vi.useRealTimers());
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T15:00:00Z')); vi.clearAllMocks(); mocks.remoto.mockResolvedValue(null); mocks.acesso.mockResolvedValue({ status: 200, userId: 42 }); mocks.iniciar.mockResolvedValue({ id: 'job', estado: 'executando' }); mocks.retomar.mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', estado: 'executando' }); });
describe('importação automática Shipment Intel', () => {
  it('inicia com parâmetros validados e proprietário da sessão', async () => {
    expect((await POST(post(input))).status).toBe(202); expect(mocks.iniciar).toHaveBeenCalledWith(42, { ...input, embarquesMin: 1, embarquesMax: 2 });
  });
  it.each([{ ...input, limite: -1 }, { ...input, limite: 1.5 }, { ...input, data: '2026-02-30' }])('bloqueia parâmetros inválidos', async value => {
    expect((await POST(post(value))).status).toBe(400); expect(mocks.iniciar).not.toHaveBeenCalled();
  });
  it('encaminha período e faixa personalizados ao worker', async () => {
    const filtros = { ...input, dataInicio: '2026-09-01', dataFinal: '2026-10-05', embarquesMin: 3, embarquesMax: 50 };
    expect((await POST(post(filtros))).status).toBe(202); expect(mocks.iniciar).toHaveBeenCalledWith(42, filtros);
  });
  it.each([0, 10001])('aceita limite opcional %s', async limite => {
    expect((await POST(post({ ...input, limite }))).status).toBe(202);
    expect(mocks.iniciar).toHaveBeenCalledWith(42, { ...input, limite, embarquesMin: 1, embarquesMax: 2 });
  });
  it.each(['2026-10-26', '2026-11-02'])('rejeita data recente ou futura %s antes de iniciar login', async data => {
    expect((await POST(post({ ...input, data }))).status).toBe(400); expect(mocks.iniciar).not.toHaveBeenCalled();
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
    expect(mocks.ler).toHaveBeenCalledWith('job', 42, undefined);
  });
  it('lê apenas o delta solicitado e preserva identidade do dono', async () => {
    mocks.ler.mockReturnValue({ id: 'job', totalEmpresas: 200, empresas: { empresas: [{ cnpj: 'x' }] } });
    const response = await GET(new Request('https://alpha.test/api/alpha-catcher/logcomex?id=job&desde=199'));
    expect(response.status).toBe(200);
    expect(mocks.ler).toHaveBeenCalledWith('job', 42, 199);
    expect((await response.json()).totalEmpresas).toBe(200);
  });
  it('retoma somente UUID com proprietário da sessão e encaminha ao worker', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect((await POST(post({ acao: 'retomar', id, userId: 99 }))).status).toBe(202);
    expect(mocks.retomar).toHaveBeenCalledWith(id, 42);
    expect((await POST(post({ acao: 'retomar', id: 'invalido' }))).status).toBe(400);
    mocks.remoto.mockResolvedValueOnce(new Response(JSON.stringify({ id }), { status: 202 }));
    expect((await POST(post({ acao: 'retomar', id }))).status).toBe(202);
    expect(mocks.remoto).toHaveBeenLastCalledWith('retomar', 42, id);
    expect(mocks.retomar).toHaveBeenCalledTimes(1);
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

it('Vercel acompanha o mesmo worker entre chamadas e não consulta Map local', async () => {
  mocks.remoto.mockResolvedValueOnce(new Response(JSON.stringify({id:'job-remote',estado:'executando'}),{status:202}));
  expect((await POST(post(input))).status).toBe(202);
  expect(mocks.remoto).toHaveBeenCalledWith('iniciar',42,expect.objectContaining(input));expect(mocks.iniciar).not.toHaveBeenCalled();
  mocks.remoto.mockResolvedValueOnce(new Response(JSON.stringify({id:'job-remote',estado:'executando'})));
  expect((await GET(new Request('https://alpha.test/api/alpha-catcher/logcomex?id=job-remote'))).status).toBe(200);
  expect(mocks.remoto).toHaveBeenLastCalledWith('ler',42,'job-remote');expect(mocks.ler).not.toHaveBeenCalled();
});
it('proxy indisponível preserva 503 e não inicia outra coleta local', async () => {
  mocks.remoto.mockResolvedValue(new Response(JSON.stringify({error:'Worker indisponível'}),{status:503}));
  expect((await POST(post(input))).status).toBe(503);expect(mocks.iniciar).not.toHaveBeenCalled();
});
