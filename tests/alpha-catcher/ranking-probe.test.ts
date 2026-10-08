import { describe, expect, it, vi } from 'vitest';
import { compararRanking } from '../../scripts/alpha-catcher-ranking-probe.mjs';
import { janelaMeses } from '@/lib/alpha-catcher/logcomex-input';
describe('comparação do ranking Logcomex', () => {
  it('compara períodos/faixa e oculta dados de autenticação da resposta 406', async () => {
    const requests: Record<string, unknown>[] = [], saidas: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      if (body.filters[0].value[0] === '2026-03-29') return new Response(JSON.stringify({ message: 'Token secreto; conta teste@teste.com; chave infra-privada' }), { status: 406, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ result: [{ data: [] }] }));
    }));
    const cliente = ({ fetcher }: { fetcher: typeof fetch }) => ({ ranking: async (_data: string, _page: number, faixa: number[]) => {
      const response = await fetcher('https://api-plataformabi.logcomex.io/api/dataset/test/chart/1852', { body: JSON.stringify({ filters: [{ field: 'data_operacao', value: ['2026-06-29', '2026-09-22'] }], faixa }) });
      if (!response.ok) throw Object.assign(new Error(), { status: response.status });
      return response.json();
    } });
    try {
      await compararRanking({ credentials: { token: 'secreto', email: 'teste@teste.com', infraKey: 'infra-privada' }, cliente, periodo: { dataInicio: '2026-03-29', dataFinal: '2026-09-29' }, min: 1, max: 2, janelaMeses, publicar: async (v: Record<string, unknown>) => { await Promise.resolve(); saidas.push(v); } });
      expect(requests).toHaveLength(5);
      expect(requests[0].faixa).toEqual([1, 2]); expect(requests[4].faixa).toBeUndefined();
      expect(saidas.some(v => v.caso === 'periodo_exato' && v.http === 406)).toBe(true);
      expect(saidas.some(v => v.caso === 'tres_meses_mesmo_fim' && v.http === 200)).toBe(true);
      expect(JSON.stringify(saidas)).not.toContain('secreto'); expect(JSON.stringify(saidas)).not.toContain('infra-privada'); expect(JSON.stringify(saidas)).not.toContain('teste@teste.com');
    } finally { vi.unstubAllGlobals(); }
  });
});
