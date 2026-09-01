import { z } from 'zod';

/**
 * Chaves permitidas para o campo de alerta (antecedência de notificação).
 * O valor persistido é a CHAVE, não o texto exibido.
 */
export const ALERTA_OPCOES = [
  { chave: '15MIN_ANTES', label: '15 minutos antes', minutos: 15 },
  { chave: '30MIN_ANTES', label: '30 minutos antes', minutos: 30 },
  { chave: '1H_ANTES', label: '1 hora antes', minutos: 60 },
  { chave: '3H_ANTES', label: '3 horas antes', minutos: 180 },
  { chave: '1DIA_ANTES', label: '1 dia antes', minutos: 1440 },
  { chave: '2DIAS_ANTES', label: '2 dias antes', minutos: 2880 },
  { chave: '1SEMANA_ANTES', label: '1 semana antes', minutos: 10080 },
] as const;

export type AlertaChave = (typeof ALERTA_OPCOES)[number]['chave'];

export const ALERTA_CHAVES_VALIDAS: readonly string[] = ALERTA_OPCOES.map(o => o.chave);

/**
 * Schema Zod para criação de tarefa com prazo (data+hora) e alerta (opção predefinida).
 */
export const CriarTarefaSchema = z.object({
  texto: z.string().min(1, 'Texto é obrigatório'),
  descricao: z.string().optional().default(''),
  userId: z.string().min(1),
  fixa: z.boolean(),
  diaSemana: z.number().int().min(0).max(6).nullable(),
  intervaloDias: z.number().int().positive().nullable().optional(),
  /** Data de início / prazo (ISO 8601 ou Date) */
  dataInicio: z.coerce.date().optional(),
  /** Hora (HH:MM) */
  horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM').nullable().optional(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']),
  /** Chave da opção de alerta predefinida */
  alerta: z.enum(ALERTA_CHAVES_VALIDAS as [string, ...string[]]).optional(),
});

export type CriarTarefaInput = z.infer<typeof CriarTarefaSchema>;

/**
 * Converte a chave de alerta para minutos (para mapeamento com colunas numéricas futuras).
 */
export function alertaChaveParaMinutos(chave: string): number | null {
  const opcao = ALERTA_OPCOES.find(o => o.chave === chave);
  return opcao ? opcao.minutos : null;
}
