import { z } from 'zod';
import { blocoHistoricoSchema, historicoImportacaoSchema } from './historico-tipos';

const registroSchema = z.object({ id: z.number().int().positive(), acao: z.string(), antes: z.string(), depois: z.string() });
export const planoReclassificacaoSchema = z.object({
  versao: z.literal(1), banco: z.string().regex(/^[a-f0-9]{64}$/), userId: z.number().int().positive(), email: z.string().email(),
  importacaoId: z.string().uuid(), instante: z.string().datetime(), criadoEm: z.string().datetime(),
  total: z.number().int().positive(), salvas: z.number().int().nonnegative(), existentes: z.number().int().nonnegative(),
  registros: z.array(registroSchema).min(2),
}).superRefine((p, ctx) => {
  if (p.salvas + p.existentes !== p.total || new Set(p.registros.map(r => r.id)).size !== p.registros.length) ctx.addIssue({ code: 'custom', message: 'Contagens ou registros inválidos.' });
});
export type PlanoReclassificacao = z.infer<typeof planoReclassificacaoSchema>;

export function prepararReclassificacaoJson(registros: { id: number; acao: string; detalhes: string | null }[], id: string, instante: string, datasRadar: Map<string, string>) {
  const alvo = new Date(instante).toISOString();
  const resumos = registros.filter(r => r.acao === 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX');
  if (resumos.length !== 1) throw new Error('Resumo ausente ou duplicado.');
  const resumoOriginal = JSON.parse(resumos[0].detalhes || '{}');
  const resumo = historicoImportacaoSchema.parse(resumoOriginal);
  if (resumo.id !== id || resumo.origem !== 'JSON' || !resumo.recuperadoEm) throw new Error('Lote não é o JSON recuperado.');
  const blocos = registros.filter(r => r.acao.startsWith(`ALPHA_CATCHER_IMPORTACAO_LINHAS:${id}:`)).map(r => ({ registro: r, original: JSON.parse(r.detalhes || '{}'), bloco: blocoHistoricoSchema.parse(JSON.parse(r.detalhes || '{}')) })).sort((a, b) => a.bloco.indice - b.bloco.indice);
  const vistos = new Set<string>(); let salvas = 0;
  const patches = blocos.map((item, indice) => {
    if (item.bloco.indice !== indice || item.bloco.importacaoId !== id || item.registro.acao !== `ALPHA_CATCHER_IMPORTACAO_LINHAS:${id}:${indice}`) throw new Error('Blocos incompletos ou divergentes.');
    const linhas = item.bloco.linhas.map((linha, posicao) => {
      if (vistos.has(linha.cnpj) || !linha.dataConsulta || !datasRadar.has(linha.cnpj)) throw new Error('CNPJ duplicado, data ausente ou cadastro ausente.');
      vistos.add(linha.cnpj);
      const data = new Date(linha.dataConsulta).toISOString();
      if (data !== new Date(datasRadar.get(linha.cnpj)!).toISOString()) throw new Error('Data do cadastro diverge do snapshot; revisão necessária.');
      const estado = data === alvo ? 'salvo' : 'existente';
      if (estado === 'salvo') salvas++;
      return { ...item.original.linhas[posicao], estado };
    });
    return { id: item.registro.id, acao: item.registro.acao, antes: item.registro.detalhes!, depois: JSON.stringify({ ...item.original, linhas }) };
  });
  if (vistos.size !== resumo.totalColetadas || vistos.size !== datasRadar.size) throw new Error('Lista incompleta.');
  const atualizado = { ...resumoOriginal, novasSalvas: salvas, reclassificacaoPorData: { instante: alvo, criterio: 'Regra informada pelo usuário: mesma data de consulta = Salvo; demais = Já no banco.' } };
  historicoImportacaoSchema.parse(atualizado);
  return { total: vistos.size, salvas, existentes: vistos.size - salvas, registros: [{ id: resumos[0].id, acao: resumos[0].acao, antes: resumos[0].detalhes!, depois: JSON.stringify(atualizado) }, ...patches] };
}

type Tx = { email: (userId: number) => Promise<string | undefined>; atualizar: (userId: number, registro: z.infer<typeof registroSchema>, rollback: boolean) => Promise<number> };
export async function executarReclassificacaoJson(raw: PlanoReclassificacao, repo: { transacao: <T>(operacao: (tx: Tx) => Promise<T>) => Promise<T> }, rollback = false) {
  const plano = planoReclassificacaoSchema.parse(raw);
  return repo.transacao(async tx => {
    if (await tx.email(plano.userId) !== plano.email) throw new Error('Proprietário divergente.');
    let atualizados = 0;
    for (const registro of plano.registros) {
      if (await tx.atualizar(plano.userId, registro, rollback) !== 1) throw new Error('Histórico mudou; nenhuma atualização parcial deve ser aplicada.');
      atualizados++;
    }
    return { atualizados, total: plano.total, salvas: plano.salvas, existentes: plano.existentes, rollback };
  });
}
