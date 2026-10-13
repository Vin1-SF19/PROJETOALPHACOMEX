import { expect, it, vi } from 'vitest';
import { fetchSmoke } from '../../scripts/alpha-catcher-worker-prod/smoke-request.mjs';

function fixture(statuses: (number | Error)[], local = true) {
  let time = 0;
  let nonce = 0;
  const requests: RequestInit[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (_url, request) => {
    requests.push(request ?? {});
    const status = statuses.shift() ?? 502;
    if (status instanceof Error) throw status;
    return new Response(null, { status });
  });
  const options = {
    fetchImpl, local, url: 'http://worker', timeoutMs: 1000, intervalMs: 500,
    now: () => time,
    wait: async (ms: number) => { time += ms; },
    createRequest: () => ({ headers: { nonce: String(++nonce) } }),
  };
  return { options, fetchImpl, requests };
}

it('aguarda 502 de inicialização e retorna a requisição bem-sucedida para replay', async () => {
  const f = fixture([502, 404]);
  const result = await fetchSmoke(f.options);
  expect(result.response.status).toBe(404);
  expect(f.fetchImpl).toHaveBeenCalledTimes(2);
  expect(f.requests.map(r => r.headers)).toEqual([{ nonce: '1' }, { nonce: '2' }]);
  expect(result.request.headers).toEqual({ nonce: '2' });
  expect(f.requests[1].signal).toBeInstanceOf(AbortSignal);
});

it('aguarda conexão recusada durante inicialização', async () => {
  const f = fixture([new TypeError('connection refused'), 404]);
  expect((await fetchSmoke(f.options)).response.status).toBe(404);
});

it.each([401, 403, 500])('não repete falha definitiva HTTP %s', async status => {
  const f = fixture([status, 404]);
  expect((await fetchSmoke(f.options)).response.status).toBe(status);
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
});

it.each([502, 503, 504])('limita espera por HTTP %s persistente', async status => {
  const f = fixture([status, status]);
  await expect(fetchSmoke(f.options)).rejects.toThrow(`1000 ms (HTTP ${status})`);
  expect(f.fetchImpl).toHaveBeenCalledTimes(2);
});

it('não esconde falha do endpoint HTTPS', async () => {
  const f = fixture([502, 200], false);
  expect((await fetchSmoke(f.options)).response.status).toBe(502);
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  const network = fixture([new Error('network')], false);
  await expect(fetchSmoke(network.options)).rejects.toThrow('network');
});
