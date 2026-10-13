import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ default: { auditoria: {} } }));
import { criarHistoricoCatcher } from '@/lib/alpha-catcher/historico';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empresas = (cnpjs: string[]) => cnpjs.map(cnpj => ({ cnpj, consignatario: cnpj }));
const input = { data: '2026-09-29', dataInicio: '2026-03-29', dataFinal: '2026-09-29', embarquesMin: 1, embarquesMax: 2, limite: 0 };
function fixture() {
  const registro = { id: 15, detalhes: '' };
  const blocos = new Map<number, { id: number; detalhes: string }>();
  const repo = { criar: vi.fn(async (_user: number, detalhes: string) => { registro.detalhes = detalhes; return { id: 15 }; }),
    atualizar: vi.fn(async (_id: number, _user: number, detalhes: string) => { registro.detalhes = detalhes; }),
    listar: vi.fn(async () => [registro]),
    buscar: vi.fn(async (userId: number, importacaoId: string) => userId === 42 && importacaoId === id && registro.detalhes ? registro : null),
    blocos: vi.fn(async () => [...blocos.values()]),
    gravarBloco: vi.fn(async (_userId: number, _id: string, indice: number, detalhes: string) => { const r = { id: 20 + indice, detalhes }; blocos.set(indice, r); return r; }) };
  return { repo, historico: criarHistoricoCatcher(repo), registro };
}
it('JSON persiste a lista antes das consultas e restaura contexto e contadores após restart', async () => {
  const { historico, repo } = fixture();
  await historico.iniciarJson(id, 42, 'empresas.json', empresas(['A', 'B']), '2026-09-28');
  expect((await historico.listar(42)).importacoes[0]).toMatchObject({ origem: 'JSON', arquivo: 'empresas.json', totalColetadas: 2, processadas: 0, fim: null });
  await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'salvo' });
  const restart = criarHistoricoCatcher(repo);
  expect(await restart.contexto(id, 99, 'B')).toBeNull();
  expect(await restart.contexto(id, 42, 'B')).toMatchObject({ origem: 'JSON', dataConsulta: '2026-09-28', empresa: { cnpj: 'B', consignatario: 'B' } });
  await restart.resultado(id, 42, { cnpj: 'B', consignatario: 'B', estado: 'existente' });
  expect((await restart.listar(42)).importacoes[0]).toMatchObject({ estado: 'concluido', processadas: 2, novasSalvas: 1 });
  await restart.iniciarJson(id, 42, 'empresas.json', empresas(['A', 'B']), '2026-09-28');
  expect(repo.criar).toHaveBeenCalledTimes(1);
  await expect(restart.iniciarJson(id, 42, 'outro.json', empresas(['A']), null)).rejects.toThrow();
});
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T15:00:00Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('histórico persistente das importações', () => {
  it('não oferece continuação enquanto a coleta original ou a nova tentativa está ativa', async () => {
    const { historico } = fixture();
    await historico.iniciar(id, 42, input);
    expect((await historico.listar(42)).importacoes[0].podeRetomar).toBe(false);
    expect((await historico.planoRetomada(id, 42))?.elegivel).toBe(false);
    await historico.terminarColeta(id, 42, 'erro');
    expect((await historico.planoRetomada(id, 42))?.elegivel).toBe(true);
    await historico.retomar(id, 42);
    expect((await historico.listar(42)).importacoes[0].podeRetomar).toBe(false);
    expect((await historico.planoRetomada(id, 42))?.elegivel).toBe(false);
  });
  it('retoma após restart com filtros originais e preserva resultados e tentativas', async () => {
    const { historico, repo } = fixture();
    await historico.iniciar(id, 42, input);
    historico.coletadas(id, 42, empresas(['A', 'B']));
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'salvo' });
    await historico.diagnostico(id, 42, 'Coletando consignatários e CNPJs', undefined, 'limite_execucao');
    await historico.terminarColeta(id, 42, 'erro');
    const reiniciado = criarHistoricoCatcher(repo);
    expect(await reiniciado.planoRetomada(id, 99)).toBeNull();
    expect(await reiniciado.planoRetomada(id, 42)).toMatchObject({ elegivel: true, input, coletadas: 2, processadas: 1, ignorarNomes: ['A', 'B'] });
    await reiniciado.retomar(id, 42);
    expect((await reiniciado.listar(42)).importacoes[0]).toMatchObject({ estado: 'em_andamento', fim: null, fimColeta: null, totalColetadas: 2, processadas: 1 });
    reiniciado.coletadas(id, 42, empresas(['A', 'B', 'C']));
    await reiniciado.resultado(id, 42, { cnpj: 'C', consignatario: 'C', estado: 'existente' });
    await reiniciado.terminarColeta(id, 42, 'concluido');
    expect((await reiniciado.listar(42)).importacoes[0]).toMatchObject({ totalColetadas: 3, novasSalvas: 1, processadas: 2, tentativas: [{ estado: 'erro', motivo: 'limite_execucao' }, { estado: 'concluido' }] });
  });
  it('inclui existentes no total e conta somente creates confirmados, sem duplicar retries', async () => {
    const { historico, repo } = fixture(); await historico.iniciar(id, 42, input);
    historico.coletadas(id, 42, empresas(['A', 'B', 'A']));
    expect(historico.aceitaEmpresa(id, 99, 'A')).toBe(false);
    await expect(historico.resultado(id, 99, { cnpj: 'A', consignatario: 'A', estado: 'salvo' })).rejects.toThrow();
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'existente' });
    await historico.resultado(id, 42, { cnpj: 'B', consignatario: 'B', estado: 'salvo' });
    vi.setSystemTime(new Date('2026-10-06T15:05:00Z')); await historico.terminarColeta(id, 42, 'concluido');
    await historico.resultado(id, 42, { cnpj: 'B', consignatario: 'B', estado: 'existente' });
    expect((await historico.listar(42)).importacoes[0]).toMatchObject({ inicio: '2026-10-06T15:00:00.000Z', fim: '2026-10-06T15:05:00.000Z', totalColetadas: 2, novasSalvas: 1, dataInicio: input.dataInicio, dataFinal: input.dataFinal, embarquesMin: 1, embarquesMax: 2 });
    expect((await criarHistoricoCatcher(repo).listar(42)).importacoes[0].novasSalvas).toBe(1);
  });
  it('aguarda terminar a fila depois da coleta, preservando fim nas novas tentativas', async () => {
    const { historico } = fixture(); await historico.iniciar(id, 42, input); historico.coletadas(id, 42, empresas(['A']));
    await historico.terminarColeta(id, 42, 'concluido');
    expect((await historico.listar(42)).importacoes[0]).toMatchObject({ estado: 'pendente', fim: null });
    vi.setSystemTime(new Date('2026-10-06T15:10:00Z'));
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'salvo' });
    vi.setSystemTime(new Date('2026-10-06T15:20:00Z'));
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'existente' });
    expect((await historico.listar(42)).importacoes[0]).toMatchObject({ estado: 'concluido', novasSalvas: 1, fim: '2026-10-06T15:10:00.000Z' });
  });
  it('serializa resultados concorrentes sem perder novas empresas no histórico', async () => {
    const { historico } = fixture(); await historico.iniciar(id, 42, input); historico.coletadas(id, 42, empresas(['A', 'B', 'C']));
    await Promise.all(['A', 'B', 'C'].map(cnpj => historico.resultado(id, 42, { cnpj, consignatario: cnpj, estado: cnpj === 'C' ? 'existente' : 'salvo' })));
    await historico.terminarColeta(id, 42, 'concluido');
    expect((await historico.listar(42)).importacoes[0]).toMatchObject({ totalColetadas: 3, novasSalvas: 2, processadas: 3 });
  });
  it('registra falha antes de receber empresas sem inventar sucesso', async () => {
    const { historico } = fixture(); await historico.iniciar(id, 42, input);
    vi.setSystemTime(new Date('2026-10-06T15:01:00Z')); await historico.terminarColeta(id, 42, 'erro');
    expect((await historico.listar(42)).importacoes[0]).toMatchObject({ totalColetadas: 0, novasSalvas: 0, estado: 'erro', fim: '2026-10-06T15:01:00.000Z' });
  });
  it('recupera a lista original após restart sem buscar valores novos do cadastro', async () => {
    const { historico, repo } = fixture(); await historico.iniciar(id, 42, input);
    historico.coletadas(id, 42, [{ cnpj: 'A', consignatario: 'Nome baixado' }]);
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'Nome alterado na entrada', estado: 'salvo', razaoSocial: 'EMPRESA', nomeFantasia: 'FANTASIA', capitalSocial: '1234.56', dataConsulta: '2025-01-02T12:00:00.000Z', regimeTributario: 'Simples Nacional', optanteSimples: true, dataOpcao: '2020-01-01T00:00:00.000Z' });
    await historico.terminarColeta(id, 42, 'concluido');
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'Outro', estado: 'existente', dataConsulta: '2026-10-06T12:00:00.000Z' });
    const reiniciado = criarHistoricoCatcher(repo);
    expect((await reiniciado.detalhar(id, 42))?.linhas).toEqual([expect.objectContaining({ cnpj: 'A', consignatario: 'Nome baixado', estado: 'salvo', razaoSocial: 'EMPRESA', nomeFantasia: 'FANTASIA', capitalSocial: '1234.56', dataConsulta: '2025-01-02T12:00:00.000Z', dataOpcao: '2020-01-01T00:00:00.000Z' })]);
    expect(await reiniciado.detalhar(id, 99)).toBeNull();
  });
  it('mantém a ordem entre blocos e inclui aguardando numa coleta interrompida', async () => {
    const { historico, repo } = fixture(); await historico.iniciar(id, 42, input);
    historico.coletadas(id, 42, empresas(Array.from({ length: 205 }, (_, i) => String(i))));
    await historico.terminarColeta(id, 42, 'cancelado');
    const lista = (await criarHistoricoCatcher(repo).detalhar(id, 42))!.linhas;
    expect(lista).toHaveLength(205); expect(lista.map(l => l.cnpj)).toEqual(Array.from({ length: 205 }, (_, i) => String(i)));
    expect(lista.every(l => l.estado === 'aguardando')).toBe(true);
    expect(repo.gravarBloco).toHaveBeenCalledTimes(3);
  });
  it('identifica resumo antigo sem inventar lista ou buscar cadastros atuais', async () => {
    const { historico, repo, registro } = fixture(); await historico.iniciar(id, 42, input);
    const antigo = JSON.parse(registro.detalhes); delete antigo.listaDisponivel; antigo.totalColetadas = 100;
    registro.detalhes = JSON.stringify(antigo);
    const detalhe = await criarHistoricoCatcher(repo).detalhar(id, 42);
    expect(detalhe?.importacao.listaDisponivel).toBe(false); expect(detalhe?.linhas).toEqual([]);
    expect(repo.blocos).not.toHaveBeenCalled();
  });
  it('recupera contagens após falha de persistência sem perder atribuição da empresa nova', async () => {
    const { historico, repo } = fixture(); await historico.iniciar(id, 42, input); historico.coletadas(id, 42, empresas(['A']));
    repo.atualizar.mockRejectedValueOnce(new Error('db'));
    await expect(historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'salvo' })).rejects.toThrow();
    expect(historico.temErro(id, 42)).toBe(true);
    await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'existente' });
    expect((await historico.listar(42)).importacoes[0].novasSalvas).toBe(1);
    expect(historico.temErro(id, 42)).toBe(false);
  });
});

it('completa campos ausentes para exibição sem alterar snapshot ou data histórica', async () => {
  const { repo, historico } = fixture();
  await historico.iniciar(id, 42, input);
  historico.coletadas(id, 42, empresas(['A', 'B', 'C']));
  await historico.resultado(id, 42, { cnpj: 'A', consignatario: 'A', estado: 'existente', dataConsulta: '2025-01-02T12:00:00.000Z' });
  await historico.resultado(id, 42, { cnpj: 'B', consignatario: 'B', estado: 'salvo', nomeFantasia: 'ORIGINAL', capitalSocial: '0' });
  const complementos = vi.fn(async () => [{ cnpj: 'A', nome_fantasia: 'FANTASIA BANCO', capital_social: '1000.50' }, { cnpj: 'B', nome_fantasia: 'OUTRO', capital_social: '9999' }]);
  const leitura = criarHistoricoCatcher({ ...repo, complementos });
  const writes = repo.atualizar.mock.calls.length, blocos = repo.gravarBloco.mock.calls.length;
  const detalhe = await leitura.detalhar(id, 42);
  expect(complementos).toHaveBeenCalledWith(['A']);
  expect(detalhe?.linhas[0]).toMatchObject({ nomeFantasia: 'FANTASIA BANCO', capitalSocial: '1000.50', dataConsulta: '2025-01-02T12:00:00.000Z', estado: 'existente' });
  expect(detalhe?.linhas[1]).toMatchObject({ nomeFantasia: 'ORIGINAL', capitalSocial: '0' });
  expect(detalhe?.linhas[2]).not.toHaveProperty('nomeFantasia');
  expect((await criarHistoricoCatcher(repo).detalhar(id, 42))?.linhas[0]).not.toHaveProperty('capitalSocial');
  expect(repo.atualizar.mock.calls.length).toBe(writes); expect(repo.gravarBloco.mock.calls.length).toBe(blocos);
  complementos.mockClear();
  expect(await leitura.detalhar(id, 99)).toBeNull(); expect(complementos).not.toHaveBeenCalled();
});

it('limita consultas de complementos a 200 CNPJs por lote', async () => {
  const { repo, historico } = fixture();
  await historico.iniciar(id, 42, input);
  const pares = empresas(Array.from({ length: 205 }, (_, i) => String(i)));
  historico.coletadas(id, 42, pares);
  for (const empresa of pares) await historico.resultado(id, 42, { ...empresa, estado: 'existente' });
  const complementos = vi.fn(async (_cnpjs: string[]) => []);
  const detalhe = await criarHistoricoCatcher({ ...repo, complementos }).detalhar(id, 42);
  expect(detalhe?.linhas).toHaveLength(205);
  expect(complementos.mock.calls.map(([cnpjs]) => cnpjs.length)).toEqual([200, 5]);
});
it('leitor compartilhado vê consulta ativa do dono e não ganha contexto de escrita', async () => {
  const {repo,registro}=fixture();
  const historico=criarHistoricoCatcher({...repo,
    listarCompartilhado:async()=>[{...registro,userId:42,usuario:{usuario:'lucca'}}],
    buscarCompartilhado:async()=>({...registro,userId:42,usuario:{usuario:'lucca'}}),
  });
  await historico.iniciar(id,42,input);historico.coletadas(id,42,empresas(['A']));
  await historico.terminarColeta(id,42,'concluido');historico.consulta(id,42,'A',true);
  expect((await historico.detalharCompartilhado(15))?.linhas[0].estado).toBe('consultando');
  expect((await historico.listarCompartilhado()).importacoes[0]).toMatchObject({registroId:15,autor:{usuario:'lucca'},estado:'pendente'});
  expect(await historico.contexto(id,99,'A')).toBeNull();
  await expect(historico.resultado(id,99,{cnpj:'A',consignatario:'A',estado:'salvo'})).rejects.toThrow();
});
