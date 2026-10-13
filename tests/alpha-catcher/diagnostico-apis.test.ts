import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ acesso: vi.fn(), remoto: vi.fn() }));
vi.mock('@/lib/alpha-catcher/access', () => ({ acessoCatcher: mocks.acesso }));
vi.mock('@/lib/alpha-catcher/worker-client', () => ({ encaminharWorkerCatcher: mocks.remoto }));
import { POST } from '@/app/api/alpha-catcher/diagnostico/route';
import { diagnosticarApisCatcher } from '@/lib/alpha-catcher/diagnostico-apis';

const post = (body: unknown = {}) => new Request('https://alpha.test/api/alpha-catcher/diagnostico', {
  method: 'POST', headers: { origin: 'https://alpha.test', host: 'alpha.test', 'content-type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ALPHA_CATCHER_WORKER_HOST', 'false');
  vi.stubEnv('RECEITAWS_MODE', 'commercial'); vi.stubEnv('RECEITAWS_TOKEN', '');
  vi.stubEnv('CONSULTA_RADAR_TOKEN', '');
  mocks.acesso.mockResolvedValue({ status: 200, userId: 42 });
  mocks.remoto.mockResolvedValue(new Response(JSON.stringify({
    verificadoEm: '2026-10-13T20:00:00.000Z',
    worker: { estado: 'disponivel', mensagem: 'Worker respondeu à verificação autenticada.' },
    receitaWS: { estado: 'inconclusivo', mensagem: 'Configuração válida.' },
    radar: { estado: 'inconclusivo', mensagem: 'Credencial configurada.' },
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
});
afterEach(() => vi.unstubAllEnvs());

describe('diagnóstico seguro das APIs Alpha Catcher', () => {
  it('encaminha somente operação read-only e identidade autenticada ao worker', async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(mocks.remoto).toHaveBeenCalledWith('diagnosticar', 42, null);
    expect(JSON.stringify(await response.json())).not.toContain('TOKEN');
  });

  it('exige autenticação, mesma origem e payload vazio', async () => {
    mocks.acesso.mockResolvedValueOnce({ status: 401 });
    expect((await POST(post())).status).toBe(401);
    const cross = new Request('https://alpha.test/api/alpha-catcher/diagnostico', { method: 'POST', headers: { origin: 'https://evil.test', host: 'alpha.test', 'content-type': 'application/json' }, body: '{}' });
    expect((await POST(cross)).status).toBe(403);
    expect((await POST(post({ cnpj: '33000167000101' }))).status).toBe(400);
    expect(mocks.remoto).not.toHaveBeenCalled();
  });

  it('identifica credencial de ReceitaWS ausente sem chamar consulta por CNPJ', () => {
    const resultado = diagnosticarApisCatcher({ workerDisponivel: true, agora: new Date('2026-10-13T20:00:00.000Z') });
    expect(resultado).toMatchObject({
      verificadoEm: '2026-10-13T20:00:00.000Z',
      worker: { estado: 'disponivel' },
      receitaWS: { estado: 'problema', mensagem: 'Token comercial da ReceitaWS não configurado.' },
      radar: { estado: 'problema', mensagem: 'Credencial da API Radar não configurada neste ambiente.' },
    });
    expect(JSON.stringify(resultado)).not.toContain('CONSULTA_RADAR_TOKEN');
  });

  it('não afirma disponibilidade externa quando há apenas configuração', () => {
    vi.stubEnv('RECEITAWS_TOKEN', 'segredo-receita');
    vi.stubEnv('CONSULTA_RADAR_TOKEN', 'segredo-radar');
    const resultado = diagnosticarApisCatcher({ workerDisponivel: false });
    expect(resultado.receitaWS.estado).toBe('inconclusivo');
    expect(resultado.radar.estado).toBe('inconclusivo');
    expect(JSON.stringify(resultado)).not.toContain('segredo-');
  });
});
