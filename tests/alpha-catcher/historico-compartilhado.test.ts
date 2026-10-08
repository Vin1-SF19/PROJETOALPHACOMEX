import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { auditoria: mocks } }));
import { criarHistoricoCatcher } from '@/lib/alpha-catcher/historico';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const resumo = { versao: 1, id, inicio: '2026-10-06T15:00:00Z', fim: '2026-10-06T15:20:00Z', fimColeta: '2026-10-06T15:15:00Z', estado: 'concluido', dataInicio: '2026-03-29', dataFinal: '2026-09-29', embarquesMin: 1, embarquesMax: 2, limite: 0, totalColetadas: 1, novasSalvas: 1, processadas: 1, pendentes: 0, listaDisponivel: true };
const registro = (auditId: number, userId: number, usuario: string) => ({ id: auditId, userId, usuario: { usuario }, detalhes: JSON.stringify({ ...resumo, autor: { usuario: 'forjado' } }) });
beforeEach(() => { vi.clearAllMocks(); });
it('pagina globalmente só resumos do módulo e projeta apenas o handle confiável', async () => {
  mocks.findMany.mockResolvedValue(Array.from({ length: 21 }, (_, i) => registro(100-i, i%2 ? 42 : 99, i%2 ? 'lucca' : '@ana')));
  const result = await criarHistoricoCatcher().listarCompartilhado(101);
  expect(result.importacoes).toHaveLength(20); expect(result.proximoCursor).toBe(81);
  expect(result.importacoes[0]).toMatchObject({ registroId: 100, autor: { usuario: 'ana' } });
  expect(result.importacoes[1].autor).toEqual({ usuario: 'lucca' });
  expect(mocks.findMany).toHaveBeenCalledWith({ where: { acao: 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX', id: { lt: 101 } }, orderBy: { id: 'desc' }, take: 21, select: { id: true, userId: true, detalhes: true, usuario: { select: { usuario: true } } } });
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it('detalhe compartilhado resolve blocos pelo dono real sem alteração do snapshot', async () => {
  const r=registro(198,42,'lucca');
  mocks.findMany.mockResolvedValueOnce([r]).mockResolvedValueOnce([{id:199,detalhes:JSON.stringify({importacaoId:id,indice:0,linhas:[{cnpj:'A',consignatario:'EMPRESA',estado:'salvo',nomeFantasia:'F',capitalSocial:'1',dataConsulta:'2026-09-28T15:00:00Z'}]})}]);
  const result=await criarHistoricoCatcher().detalharCompartilhado(198);
  expect(result?.importacao).toMatchObject({registroId:198,autor:{usuario:'lucca'},novasSalvas:1});
  expect(result?.linhas[0]).toMatchObject({estado:'salvo',dataConsulta:'2026-09-28T15:00:00Z'});
  expect(mocks.findMany.mock.calls[1][0].where.userId).toBe(42);
  expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
});
it('UUID repetido entre autores exige referência numérica, sem escolher ou mesclar dono', async () => {
  mocks.findMany.mockResolvedValueOnce([registro(198,42,'lucca'),registro(200,99,'ana')]);
  expect(await criarHistoricoCatcher().detalharCompartilhado(id)).toBeNull();
  expect(mocks.findMany).toHaveBeenCalledTimes(1);
  expect(mocks.findMany.mock.calls[0][0].take).toBe(2);
});
it('dados inválidos e referências inexistentes não viram histórico de outro módulo', async () => {
  mocks.findMany.mockResolvedValueOnce([{...registro(198,42,'lucca'),detalhes:'{}'}]);
  expect((await criarHistoricoCatcher().listarCompartilhado()).importacoes).toEqual([]);
  mocks.findMany.mockResolvedValueOnce([]);
  expect(await criarHistoricoCatcher().detalharCompartilhado(1)).toBeNull();
});
it('leitura compartilhada não restaura contexto nem concede escrita ao leitor', async () => {
  mocks.findFirst.mockResolvedValue(null);
  const h=criarHistoricoCatcher();
  expect(await h.contexto(id,99,'A')).toBeNull();
  expect(mocks.findFirst.mock.calls[0][0].where.userId).toBe(99);
  await expect(h.resultado(id,99,{cnpj:'A',consignatario:'A',estado:'salvo'})).rejects.toThrow();
  expect(mocks.update).not.toHaveBeenCalled();
});
