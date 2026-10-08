import { z } from 'zod';
const diagnosticoSchema = z.object({
  status: z.enum(['concluido', 'concluido_com_erros', 'interrompido', 'desconhecido']),
  recebidas: z.number().int().nonnegative(), semCnpj: z.number().int().nonnegative(), paginas: z.number().int().nonnegative(),
  falhas: z.array(z.string().regex(/^(http_[45]\d{2}|timeout|conexao|resposta_invalida|ranking_invalido|paginacao_invalida|pagina_vazia|perfil_invalido|empresa_invalida|filtro_invalido|falha_coleta)$/)).max(210),
});
export function resumirFalhaColeta(value: unknown, validas: number, invalidos: number) {
  const parsed = diagnosticoSchema.safeParse(value);
  if (!parsed.success) return 'Coleta parcial. Não foi possível obter o diagnóstico. Confira os resultados antes de processar.';
  const d = parsed.data;
  const causas: Record<string, string> = {
    timeout: 'A Logcomex excedeu o tempo de resposta.', conexao: 'Falha de conexão com a Logcomex.',
    resposta_invalida: 'A Logcomex retornou uma resposta que não é JSON válido.',
    ranking_invalido: 'O ranking retornou um formato inesperado.', paginacao_invalida: 'A Logcomex não informou uma paginação válida.',
    pagina_vazia: 'A Logcomex retornou uma página vazia antes do fim do ranking.',
    perfil_invalido: 'Os perfis retornaram um formato diferente do esperado pelo coletor.',
    empresa_invalida: 'O ranking retornou empresa sem nome.', filtro_invalido: 'O coletor não enviou o filtro de período esperado.',
    falha_coleta: 'A coleta encontrou uma falha sem diagnóstico específico.',
  };
  const motivo = d.falhas.map(f => f.startsWith('http_') ? `Logcomex respondeu HTTP ${f.slice(5)}.` : causas[f]).join(' ');
  const resumo = `${d.recebidas} empresas recebidas; ${validas} com CNPJ válido; ${d.semCnpj} sem CNPJ; ${invalidos} entradas descartadas; ${d.paginas} páginas consultadas.`;
  return `Coleta parcial. ${motivo || (d.semCnpj ? 'Há perfis sem CNPJ na resposta da Logcomex.' : 'Não foi possível confirmar a conclusão da coleta.')} ${resumo} ${validas ? 'Os resultados válidos foram preservados.' : 'Nenhuma empresa válida foi obtida para processar.'}`;
}
