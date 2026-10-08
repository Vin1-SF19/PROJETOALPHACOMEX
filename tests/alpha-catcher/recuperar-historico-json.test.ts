import { expect, it } from 'vitest';
import { idRecuperacaoJson, planoRecuperacaoSchema, registrosRecuperacao, executarRecuperacaoJson } from '@/lib/alpha-catcher/recuperar-historico-json';
const hash = 'a'.repeat(64);
function plano() {
  const linhas = Array.from({ length: 2491 }, (_, i) => ({ cnpj: String(i), consignatario: `Empresa ${i}`, estado: 'existente' as const }));
  return planoRecuperacaoSchema.parse({ versao: 1, banco: hash, userId: 42, email: 'teste@example.com', arquivoSha256: hash, criadoEm: '2026-10-08T17:00:00Z', linhas,
    resumo: { versao: 1, id: idRecuperacaoJson(hash), origem: 'JSON', arquivo: 'empresas.json', arquivoSha256: hash, recuperadoEm: '2026-10-08T17:00:00Z', inicio: null, fim: null, fimColeta: null, estado: 'concluido', listaDisponivel: true,
      dataInicio: '2026-10-08', dataFinal: '2026-10-08', dataConsultaJson: null, embarquesMin: 0, embarquesMax: 0, limite: 0, totalColetadas: linhas.length, novasSalvas: null, processadas: linhas.length, pendentes: 0 } });
}
it('prepara um resumo e 25 blocos em ordem sem inventar horários ou quantidade nova', () => {
  const p = plano(), registros = registrosRecuperacao(p);
  expect(registros).toHaveLength(26);
  expect(JSON.parse(registros[0].detalhes)).toMatchObject({ inicio: null, fim: null, novasSalvas: null, totalColetadas: 2491 });
  const linhas = registros.slice(1).flatMap(r => JSON.parse(r.detalhes).linhas);
  expect(linhas).toEqual(p.linhas);
  expect(idRecuperacaoJson(hash)).toBe(idRecuperacaoJson(hash));
});
it('bloqueia plano adulterado com números novos inventados, duplicatas ou horários originais fictícios', () => {
  const p = plano();
  expect(planoRecuperacaoSchema.safeParse({ ...p, resumo: { ...p.resumo, novasSalvas: 2375 } }).success).toBe(false);
  expect(planoRecuperacaoSchema.safeParse({ ...p, resumo: { ...p.resumo, inicio: p.criadoEm } }).success).toBe(false);
  expect(planoRecuperacaoSchema.safeParse({ ...p, linhas: p.linhas.map(() => p.linhas[0]) }).success).toBe(false);
});
function repoFixture() {
  const state = { rows: [{ id: 1, userId: 99, acao: 'AUDITORIA_ALHEIA', detalhes: 'preservar' }], falhar: 0, email: 'teste@example.com' };
  const repo = { async transacao<T>(operacao: (tx: {
    email: (userId: number) => Promise<string | undefined>;
    registros: (userId: number, acao: string) => Promise<{ id: number; detalhes: string }[]>;
    criar: (userId: number, registro: { acao: string; detalhes: string }) => Promise<{ id: number }>;
    remover: (userId: number, id: number, registro: { acao: string; detalhes: string }) => Promise<number>;
  }) => Promise<T>) {
    let rows = state.rows.map(r => ({ ...r })), creates = 0;
    const result = await operacao({ email: async () => state.email,
      registros: async (userId, acao) => rows.filter(r => r.userId === userId && r.acao === acao),
      criar: async (userId, registro) => { if (++creates === state.falhar) throw new Error('db'); const id = rows.length + 1; rows.push({ id, userId, ...registro }); return { id }; },
      remover: async (userId, id, registro) => { const count = rows.filter(r => r.id === id && r.userId === userId && r.acao === registro.acao && r.detalhes === registro.detalhes).length; rows = rows.filter(r => !(r.id === id && r.userId === userId && r.acao === registro.acao && r.detalhes === registro.detalhes)); return count; },
    });
    state.rows = rows; return result;
  } };
  return { repo, state };
}
it('apply é idempotente e rollback remove só a recuperação exata, preservando auditoria alheia', async () => {
  const { repo, state } = repoFixture(), p = plano();
  expect(await executarRecuperacaoJson(p, repo, 'apply')).toMatchObject({ inseridos: 26 });
  expect(await executarRecuperacaoJson(p, repo, 'apply')).toMatchObject({ jaExistia: true, inseridos: 0 });
  expect(state.rows).toHaveLength(27);
  expect(await executarRecuperacaoJson(p, repo, 'rollback')).toEqual({ removidos: 26 });
  expect(state.rows).toEqual([{ id: 1, userId: 99, acao: 'AUDITORIA_ALHEIA', detalhes: 'preservar' }]);
});
it('falha intermediária e dono divergente não deixam resumo ou blocos parciais', async () => {
  const { repo, state } = repoFixture(), p = plano(); state.falhar = 3;
  await expect(executarRecuperacaoJson(p, repo, 'apply')).rejects.toThrow('db');
  expect(state.rows).toHaveLength(1);
  state.falhar = 0; state.email = 'outro@example.com';
  await expect(executarRecuperacaoJson(p, repo, 'apply')).rejects.toThrow('Proprietário');
  expect(state.rows).toHaveLength(1);
});
it('bloqueia reexecução incompleta e rollback de conteúdo alterado sem apagar outros blocos', async () => {
  const { repo, state } = repoFixture(), p = plano();
  await executarRecuperacaoJson(p, repo, 'apply');
  state.rows[state.rows.length - 1].detalhes = 'alterado';
  await expect(executarRecuperacaoJson(p, repo, 'apply')).rejects.toThrow();
  await expect(executarRecuperacaoJson(p, repo, 'rollback')).rejects.toThrow('alterado');
  expect(state.rows).toHaveLength(27);
});
