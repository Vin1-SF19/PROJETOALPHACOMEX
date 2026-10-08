import { z } from 'zod';
const quantidade = z.number().int().nonnegative();
export const historicoImportacaoSchema = z.object({
  registroId: z.number().int().positive().optional(),
  autor: z.object({ usuario: z.string() }).optional(),
  versao: z.literal(1), id: z.string().uuid(), inicio: z.string().datetime().nullable(), fim: z.string().datetime().nullable(),
  fimColeta: z.string().datetime().nullable(),
  estado: z.enum(['em_andamento', 'pendente', 'concluido', 'erro', 'cancelado', 'interrompido']),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  embarquesMin: quantidade, embarquesMax: quantidade, limite: quantidade,
  totalColetadas: quantidade, novasSalvas: quantidade.nullable(), processadas: quantidade, pendentes: quantidade,
  listaDisponivel: z.boolean().default(false),
  origem: z.enum(['JSON', 'LOGCOMEX']).default('LOGCOMEX'),
  arquivo: z.string().max(255).optional(),
  dataConsultaJson: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  recuperadoEm: z.string().datetime().optional(),
  arquivoSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export type HistoricoImportacao = z.infer<typeof historicoImportacaoSchema>;

export const linhaHistoricoSchema = z.object({
  cnpj: z.string(), consignatario: z.string(),
  estado: z.enum(['aguardando', 'consultando', 'existente', 'salvo', 'pendente']),
  capitalSocial: z.string().nullable().optional(),
  nomeFantasia: z.string().nullable().optional(),
  razaoSocial: z.string().nullable().optional(), situacao: z.string().nullable().optional(),
  modalidade: z.string().nullable().optional(), municipio: z.string().nullable().optional(), uf: z.string().nullable().optional(),
  dataConsulta: z.string().datetime().nullable().optional(), regimeTributario: z.string().nullable().optional(),
  optanteSimples: z.boolean().nullable().optional(), dataOpcao: z.string().datetime().nullable().optional(),
  mensagem: z.string().optional(), codigo: z.string().optional(),
});
export type LinhaResultadoCatcher = z.infer<typeof linhaHistoricoSchema>;
export const blocoHistoricoSchema = z.object({ importacaoId: z.string().uuid(), indice: quantidade, linhas: z.array(linhaHistoricoSchema) });
export const detalheHistoricoSchema = z.object({ importacao: historicoImportacaoSchema, linhas: z.array(linhaHistoricoSchema) });
export type DetalheHistorico = z.infer<typeof detalheHistoricoSchema>;
