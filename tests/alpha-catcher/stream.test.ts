import { describe, expect, it, vi } from 'vitest';
import { coletarProgressivo } from '../../scripts/alpha-catcher-stream.mjs';
const raw = (nomes: string[], maxPage = 1) => ({ result: [{ data: nomes.map(consignatario => ({ consignatario })), summary: { remaining: { maxPage } } }] });
const perfil = async () => ({ cnpj: '33000167000101', address: {} });
type Evento = { type: string; empresa?: { consignatario: string }; progresso?: { total: number | null; totalLista: number | null; coletadas: number; cnpjs: number } };
type Api = { ranking: (data: string, page: number) => Promise<ReturnType<typeof raw>>; perfil: (data: string, nome: string) => Promise<unknown> };
describe('coleta progressiva', () => {
  it('publica o primeiro CNPJ sem esperar a última página usada para descobrir o total', async () => {
    let liberar!: (value: ReturnType<typeof raw>) => void;
    const ultima = new Promise(resolve => { liberar = resolve; });
    const eventos: Evento[] = [];
    const ranking = vi.fn((_data, page) => page === 1 ? Promise.resolve(raw(['A', 'B'], 3)) : page === 3 ? ultima : Promise.resolve(raw(['C', 'D'], 3)));
    await coletarProgressivo({ api: { ranking, perfil }, data: '2026-09-29', limite: Infinity, faixa: [1, 2], emitir: async (e: Evento) => { eventos.push(e); }, coletar: async ({ api }: { api: Api }) => {
      await api.ranking('', 1);
      await api.perfil('', 'A');
      expect(eventos.some(e => e.type === 'empresa')).toBe(true);
      expect(ranking.mock.calls.some(c => c[1] === 2)).toBe(false);
      expect(eventos.at(-1)?.progresso?.total).toBeNull();
      liberar(raw(['E'], 3));
      await api.ranking('', 3);
      await api.ranking('', 2);
      await api.perfil('', 'B');
      return 'fim';
    } });
    expect(eventos.filter(e => e.type === 'empresa').map(e => e.empresa?.consignatario)).toEqual(['A', 'B']);
    expect(eventos.at(-1)?.progresso).toMatchObject({ totalLista: 5, total: 5, coletadas: 2, cnpjs: 2 });
    expect(ranking.mock.calls.filter(c => c[1] === 3)).toHaveLength(1);
  });
  it('contabiliza perfis sem CNPJ e falhas sem publicar empresas inválidas', async () => {
    const eventos: Evento[] = [];
    const consultar = vi.fn().mockResolvedValueOnce({ cnpj: null, address: {} }).mockRejectedValueOnce(new Error('rede')).mockResolvedValue({ cnpj: '33000167000101', address: {} });
    await coletarProgressivo({ api: { ranking: async () => raw(['A', 'B', 'C']), perfil: consultar }, data: '', limite: 2, faixa: [], emitir: async (e: Evento) => { eventos.push(e); }, coletar: async ({ api }: { api: Api }) => {
      await api.ranking('', 1); await api.perfil('', 'A');
      await expect(api.perfil('', 'B')).rejects.toThrow('rede');
    } });
    expect(eventos.some(e => e.type === 'empresa')).toBe(false);
    expect(eventos.at(-1)?.progresso).toMatchObject({ totalLista: 3, total: 2, coletadas: 2, cnpjs: 0 });
  });
  it('repete a última página normalmente se a descoberta paralela falhar', async () => {
    const ranking = vi.fn().mockResolvedValueOnce(raw(['A'], 2)).mockRejectedValueOnce(new Error('rede')).mockResolvedValue(raw(['B'], 2));
    await coletarProgressivo({ api: { ranking, perfil }, data: '', limite: Infinity, faixa: [], emitir: async () => {}, coletar: async ({ api }: { api: Api }) => {
      await api.ranking('', 1); await api.perfil('', 'A');
      expect((await api.ranking('', 2)).result[0].data).toHaveLength(1);
    } });
    expect(ranking).toHaveBeenCalledTimes(3);
  });
});
