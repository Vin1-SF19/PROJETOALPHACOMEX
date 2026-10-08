import { z } from 'zod';
import { historicoImportacaoSchema, linhaHistoricoSchema } from './historico-tipos';

export const planoRecuperacaoSchema = z.object({
  versao: z.literal(1), banco: z.string().regex(/^[a-f0-9]{64}$/), userId: z.number().int().positive(),
  email: z.string().email(), arquivoSha256: z.string().regex(/^[a-f0-9]{64}$/), criadoEm: z.string().datetime(),
  resumo: historicoImportacaoSchema, linhas: z.array(linhaHistoricoSchema).min(1),
}).superRefine((p, ctx) => {
  if (p.resumo.origem !== 'JSON' || !p.resumo.recuperadoEm || p.resumo.inicio !== null || p.resumo.fim !== null || p.resumo.novasSalvas !== null ||
      p.resumo.arquivoSha256 !== p.arquivoSha256 || p.linhas.length !== p.resumo.totalColetadas ||
      new Set(p.linhas.map(l => l.cnpj)).size !== p.linhas.length || p.linhas.some(l => l.estado !== 'existente')) {
    ctx.addIssue({ code: 'custom', message: 'Recuperação deve preservar fatos conhecidos e identificar snapshot atual.' });
  }
});
export type PlanoRecuperacao = z.infer<typeof planoRecuperacaoSchema>;

export function idRecuperacaoJson(hash: string): string {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Hash inválido.');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function registrosRecuperacao(plano: PlanoRecuperacao) {
  const p = planoRecuperacaoSchema.parse(plano);
  const registros = [{ acao: 'ALPHA_CATCHER_IMPORTACAO_LOGCOMEX', detalhes: JSON.stringify(p.resumo) }];
  for (let i = 0; i < p.linhas.length; i += 100) {
    const indice = i / 100;
    registros.push({ acao: `ALPHA_CATCHER_IMPORTACAO_LINHAS:${p.resumo.id}:${indice}`, detalhes: JSON.stringify({ importacaoId: p.resumo.id, indice, linhas: p.linhas.slice(i, i + 100) }) });
  }
  return registros;
}

type Registro = { id: number; detalhes: string | null };
type TxRecuperacao = {
  email: (userId: number) => Promise<string | undefined>;
  registros: (userId: number, acao: string) => Promise<Registro[]>;
  criar: (userId: number, registro: { acao: string; detalhes: string }) => Promise<{ id: number }>;
  remover: (userId: number, id: number, registro: { acao: string; detalhes: string }) => Promise<number>;
};
type RepoRecuperacao = { transacao: <T>(operacao: (tx: TxRecuperacao) => Promise<T>) => Promise<T> };

export async function executarRecuperacaoJson(raw: PlanoRecuperacao, repo: RepoRecuperacao, acao: 'apply' | 'rollback') {
  const plano = planoRecuperacaoSchema.parse(raw), registros = registrosRecuperacao(plano);
  return repo.transacao(async tx => {
    if (await tx.email(plano.userId) !== plano.email) throw new Error('Proprietário divergente.');
    if (acao === 'rollback') {
      let removidos = 0;
      for (const registro of registros) {
        const existentes = (await tx.registros(plano.userId, registro.acao)).filter(r => {
          if (registro.acao !== registros[0].acao) return true;
          try { return JSON.parse(r.detalhes || '{}').id === plano.resumo.id; } catch { return false; }
        });
        if (existentes.some(r => r.detalhes !== registro.detalhes)) throw new Error('Histórico alterado; rollback bloqueado.');
        if (existentes.length > 1) throw new Error('Registros duplicados; rollback manual necessário.');
        if (existentes.length === 1) removidos += await tx.remover(plano.userId, existentes[0].id, registro);
      }
      return { removidos };
    }
    const existentes = (await tx.registros(plano.userId, registros[0].acao)).filter(r => {
      try { return JSON.parse(r.detalhes || '{}').id === plano.resumo.id; } catch { return false; }
    });
    if (existentes.length > 1) throw new Error('Históricos duplicados.');
    if (existentes.length === 1) {
      if (existentes[0].detalhes !== registros[0].detalhes) throw new Error('Histórico existente divergente.');
      for (const registro of registros.slice(1)) {
        const blocos = await tx.registros(plano.userId, registro.acao);
        if (blocos.length !== 1 || blocos[0].detalhes !== registro.detalhes) throw new Error('Histórico existente incompleto ou divergente.');
      }
      return { jaExistia: true, id: existentes[0].id, inseridos: 0 };
    }
    let id: number | undefined;
    for (const registro of registros) { const novo = await tx.criar(plano.userId, registro); id ??= novo.id; }
    return { jaExistia: false, id, inseridos: registros.length };
  });
}
