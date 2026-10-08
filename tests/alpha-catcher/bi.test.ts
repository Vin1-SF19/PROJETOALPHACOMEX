import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { credenciaisBI, capturarSessaoBI, fetchComProduto, validarRankingSessao, apiComPrimeiroRanking } from '../../scripts/alpha-catcher-bi.mjs';
const headers = { authorization: 'secreto', 'x-infra-key': 'privado', 'user-email': 'conta@teste.com', 'product-signature': 'shipment-intel' };
const url = 'https://api-plataformabi.logcomex.io/api/dataset/test';
describe('produto da sessão BI validada', () => {
  it('compara o produto capturado uma vez após 406 e mantém o produto que funcionou', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 406 })).mockResolvedValue(new Response('{}'));
    const enviar = fetchComProduto({ productSignature: 'plataforma-bi' }, fetcher);
    await enviar(url, { headers: { authorization: 'secreto' }, body: 'mesmos-filtros' });
    expect(fetcher.mock.calls.map(c => c[1].headers.get('product-signature'))).toEqual(['bi-importacao', 'plataforma-bi']);
    expect(fetcher.mock.calls.map(c => c[1].body)).toEqual(['mesmos-filtros', 'mesmos-filtros']);
    await enviar(url, { headers: {} }); expect(fetcher.mock.calls[2][1].headers.get('product-signature')).toBe('plataforma-bi');
  });
  it.each([401, 403, 429, 500])('não troca o produto nem repete HTTP %s', async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status }));
    expect((await fetchComProduto({ productSignature: 'plataforma-bi' }, fetcher)(url, {})).status).toBe(status);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('valida ranking real antes de reutilizar sessão e reutiliza apenas a primeira página', async () => {
    const ranking = { result: [{ data: [{ consignatario: 'Empresa' }] }] };
    const api = { ranking: vi.fn().mockResolvedValue(ranking), perfil: vi.fn() };
    const primeiro = await validarRankingSessao(api, '2026-09-29', [1, 2]);
    const coleta = apiComPrimeiroRanking(api, primeiro);
    expect(await coleta.ranking('2026-09-29', 1, [1, 2])).toBe(ranking); expect(api.ranking).toHaveBeenCalledTimes(1);
    await coleta.ranking('2026-09-29', 2, [1, 2]); expect(api.ranking).toHaveBeenCalledTimes(2);
    api.ranking.mockResolvedValue({}); await expect(validarRankingSessao(api, '2026-09-29', [1, 2])).rejects.toThrow();
  });
  it('aceita produto capturado, recusando conta, origem ou headers inválidos', () => {
    expect(credenciaisBI(url, headers, headers['user-email'])?.productSignature).toBe('shipment-intel');
    expect(credenciaisBI('https://externo.test', headers, headers['user-email'])).toBeNull();
    expect(credenciaisBI(url, headers, 'outra@teste.com')).toBeNull();
    expect(credenciaisBI(url, { ...headers, 'product-signature': '' }, headers['user-email'])).toBeNull();
  });
  it('valida HTTP bem-sucedido antes de aceitar credenciais e remove listeners', async () => {
    const context = new EventEmitter(); const capture = capturarSessaoBI(context, headers['user-email'], 1000);
    const response = (status: number) => ({ url: () => url, status: () => status, ok: () => status === 200, request: () => ({ headers: () => headers }) });
    context.emit('response', response(406)); expect(context.listenerCount('response')).toBe(1);
    context.emit('response', response(200));
    expect((await capture.promise).productSignature).toBe('shipment-intel'); expect(context.listenerCount('response')).toBe(0);
    expect(capture.diagnostics.statuses).toEqual({ 406: 1, 200: 1 });
  });
  it('começa pelo produto de importação validado e bloqueia origem externa', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const fetchProduto = fetchComProduto({ productSignature: 'shipment-intel' }, fetcher);
    await fetchProduto(url, { headers: { authorization: 'secreto', 'product-signature': 'bi-importacao' } });
    const enviado = fetcher.mock.calls[0][1].headers as Headers;
    expect(enviado.get('product-signature')).toBe('bi-importacao'); expect(enviado.get('authorization')).toBe('secreto');
    await expect(fetchProduto('https://externo.test', {})).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
