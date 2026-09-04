import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const CADENCIA_STATUS = ["ATIVA", "PAUSADA", "CONCLUIDA", "CANCELADA"] as const;
export const CADENCIA_PASSO_EXECUCAO_STATUS = ["PENDENTE", "EM_EXECUCAO", "CONCLUIDA", "FALHA"] as const;
export const BPM_TAREFA_TIPOS = ["CHECKLIST", "LIGACAO", "WHATSAPP", "EMAIL", "TAREFA", "LEMBRETE_RAPIDO"] as const;
export const BPM_PRIORIDADES = ["BAIXA", "NORMAL", "ALTA"] as const;

// ─── Schemas de criação/edição ───────────────────────────────────────────────

export const criarCadenciaSchema = z.object({
  nome: z.string().min(1).max(200),
  descricao: z.string().max(2000).optional(),
  pipelineId: z.string().cuid().optional(),
  etapaId: z.string().cuid().optional(),
});

export const atualizarCadenciaSchema = z.object({
  id: z.string().cuid(),
  nome: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).nullable().optional(),
  pipelineId: z.string().cuid().nullable().optional(),
  etapaId: z.string().cuid().nullable().optional(),
  ativa: z.boolean().optional(),
});

export const criarPassoCadenciaSchema = z.object({
  cadenciaId: z.string().cuid(),
  ordem: z.number().int().min(1),
  intervaloDias: z.number().int().min(0),
  tipoTarefa: z.enum(BPM_TAREFA_TIPOS).default("TAREFA"),
  titulo: z.string().min(1).max(500),
  descricao: z.string().max(5000).optional(),
  responsavelId: z.number().int().positive().optional(),
  prazoRelativoDias: z.number().int().min(0).optional(),
  alertaAntecedenciaHoras: z.number().int().min(0).optional(),
  prioridade: z.enum(BPM_PRIORIDADES).default("NORMAL"),
  checklistJson: z.string().max(10000).optional(),
});

export const atualizarPassoCadenciaSchema = z.object({
  id: z.string().cuid(),
  ordem: z.number().int().min(1).optional(),
  intervaloDias: z.number().int().min(0).optional(),
  tipoTarefa: z.enum(BPM_TAREFA_TIPOS).optional(),
  titulo: z.string().min(1).max(500).optional(),
  descricao: z.string().max(5000).nullable().optional(),
  responsavelId: z.number().int().positive().nullable().optional(),
  prazoRelativoDias: z.number().int().min(0).nullable().optional(),
  alertaAntecedenciaHoras: z.number().int().min(0).nullable().optional(),
  prioridade: z.enum(BPM_PRIORIDADES).optional(),
  checklistJson: z.string().max(10000).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const reordenarPassosCadenciaSchema = z.object({
  cadenciaId: z.string().cuid(),
  passoIds: z.array(z.string().cuid()).min(1),
});

export const iniciarCadenciaCardSchema = z.object({
  cardId: z.string().cuid(),
  cadenciaId: z.string().cuid(),
});

export const pausarCadenciaCardSchema = z.object({
  vinculoId: z.string().cuid(),
  motivo: z.string().max(500).optional(),
});

export const cancelarCadenciaCardSchema = z.object({
  vinculoId: z.string().cuid(),
  motivo: z.string().max(500).optional(),
});

export const reativarCadenciaCardSchema = z.object({
  vinculoId: z.string().cuid(),
});
