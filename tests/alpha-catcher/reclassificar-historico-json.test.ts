import { expect, it } from 'vitest';
import { prepararReclassificacaoJson, planoReclassificacaoSchema, executarReclassificacaoJson } from '@/lib/alpha-catcher/reclassificar-historico-json';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', instante = '2026-09-28T15:00:00.000Z';
function fixture() {
  const linhas = [
    { cnpj: 'A', consignatario: 'A', dataConsulta: instante, estado: 'existente', nomeFantasia: 'Preservar' },
    { cnpj: 'B', consignatario: 'B', dataConsulta: '2026-09-28T15:01:00.000Z', estado: 'existente' },
    { cnpj: 'C', consignatario: 'C', dataConsulta: '2026-09-27T15:00:00.000Z', estado: 'existente' },
  ];
  const resumo = { versao: 1, id, origem: 'JSON', arquivo: 'empresas.json', recuperadoEm: '2026-10-08T17:00:00Z', inicio: null, fim: null, fimColeta: null,
    estado: 'concluido', dataInicio: '2026-09-28', dataFinal: '2026-09-28', embarquesMin: 0, embarquesMax: 0, limite: 0, totalColetadas: 3, novasSalvas: null, processadas: 3, pendentes: 0, listaDisponivel: true };
  const registros = [{ id: 198, acao: 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX', detalhes: JSON.stringify(resumo) }, { id: 199, acao: `ALPHA_CATCHER_IMPORTACAO_LINHAS:${id}:0`, detalhes: JSON.stringify({ importacaoId: id, indice: 0, linhas }) }];
  const datas = new Map(linhas.map(l => [l.cnpj, l.dataConsulta]));
  const patch = prepararReclassificacaoJson(registros, id, instante, datas);
  const plano = planoReclassificacaoSchema.parse({ versao: 1, banco: 'a'.repeat(64), userId: 42, email: 'teste@example.com', importacaoId: id, instante, criadoEm: '2026-10-08T18:00:00Z', ...patch });
  return { linhas, registros, datas, plano };
}
it('classifica somente o instante exato de 28/09 12:00 São Paulo e preserva todos os demais dados', () => {
  const { plano, linhas } = fixture();
  expect(plano).toMatchObject({ salvas: 1, existentes: 2, total: 3 });
  const depois = JSON.parse(plano.registros[1].depois).linhas;
  expect(depois).toEqual(linhas.map((l, i) => ({ ...l, estado: i === 0 ? 'salvo' : 'existente' })));
  expect(JSON.parse(plano.registros[0].depois)).toMatchObject({ novasSalvas: 1, inicio: null, fim: null, reclassificacaoPorData: { instante } });
});
it('considera equivalência UTC/fuso e bloqueia snapshot divergente do cadastro', () => {
  const { registros, datas } = fixture();
  expect(prepararReclassificacaoJson(registros, id, '2026-09-28T12:00:00-03:00', datas).salvas).toBe(1);
  datas.set('A', '2026-09-28T15:01:00.000Z');
  expect(() => prepararReclassificacaoJson(registros, id, instante, datas)).toThrow('diverge');
});
it('bloqueia lote errado, lista incompleta e cadastro ausente', () => {
  const { registros, datas } = fixture();
  expect(() => prepararReclassificacaoJson(registros, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', instante, datas)).toThrow();
  expect(() => prepararReclassificacaoJson(registros.slice(0, 1), id, instante, datas)).toThrow();
  datas.delete('B'); expect(() => prepararReclassificacaoJson(registros, id, instante, datas)).toThrow();
});
function repoFixture() {
  const { plano } = fixture();
  const state = { rows: plano.registros.map(r => ({ id: r.id, detalhes: r.antes })), falhar: false, email: plano.email };
  const repo = { async transacao<T>(operacao: (tx: { email: (userId: number) => Promise<string | undefined>; atualizar: (userId: number, r: { id: number; acao: string; antes: string; depois: string }, rollback: boolean) => Promise<number> }) => Promise<T>) {
    const rows = state.rows.map(r => ({ ...r }));
    const result = await operacao({ email: async () => state.email, atualizar: async (_userId, r, rollback) => {
      if (state.falhar && r.id === 199) return 0;
      const row = rows.find(x => x.id === r.id), antes = rollback ? r.depois : r.antes, depois = rollback ? r.antes : r.depois;
      if (!row || ![antes, depois].includes(row.detalhes)) return 0;
      row.detalhes = depois; return 1;
    } });
    state.rows = rows; return result;
  } };
  return { repo, state, plano };
}
it('apply/reapply/rollback são restritos ao plano e não duplicam ou deixam atualizações parciais', async () => {
  const { repo, state, plano } = repoFixture();
  await executarReclassificacaoJson(plano, repo); await executarReclassificacaoJson(plano, repo);
  expect(state.rows.map(r => r.detalhes)).toEqual(plano.registros.map(r => r.depois));
  await executarReclassificacaoJson(plano, repo, true);
  expect(state.rows.map(r => r.detalhes)).toEqual(plano.registros.map(r => r.antes));
  state.falhar = true;
  await expect(executarReclassificacaoJson(plano, repo)).rejects.toThrow('mudou');
  expect(state.rows.map(r => r.detalhes)).toEqual(plano.registros.map(r => r.antes));
});
it('bloqueia mudança de proprietário e snapshot alterado sem persistir o resumo', async () => {
  const { repo, state, plano } = repoFixture(); state.email = 'outro@example.com';
  await expect(executarReclassificacaoJson(plano, repo)).rejects.toThrow('Proprietário');
  state.email = plano.email; state.rows[1].detalhes = 'alterado';
  await expect(executarReclassificacaoJson(plano, repo)).rejects.toThrow('mudou');
  expect(state.rows[0].detalhes).toBe(plano.registros[0].antes);
});
