import { z } from "zod";

export const BPM_CARD_STATUS = ["ATIVO", "CONCLUIDO", "CANCELADO"] as const;

export const BPM_CARD_MEMBRO_ROLE = ["RESPONSAVEL", "ADMINISTRADOR", "PARTICIPANTE"] as const;

export const BPM_CAMPO_TIPO = ["texto", "numero", "data", "selecao", "booleano"] as const;

export const BPM_TAREFA_PRIORIDADE = ["BAIXA", "NORMAL", "ALTA"] as const;

export const BPM_TAREFA_STATUS = ["PENDENTE", "CONCLUIDA"] as const;

export const BPM_TAREFA_PRESET_TIPO_GERACAO = ["UNICA", "MULTIPLA", "FLUXO"] as const;

const MAX_NOME = 200;
const MAX_DESCRICAO = 4000;

export const criarPipelineSchema = z.object({
  nome: z.string().trim().min(1, "Nome do pipeline é obrigatório").max(MAX_NOME),
  setorIds: z.array(z.number().int().positive()).min(1, "Selecione ao menos um setor"),
});

export const atualizarPipelineSchema = z.object({
  pipelineId: z.string().cuid(),
  nome: z.string().trim().min(1).max(MAX_NOME).optional(),
  ativo: z.boolean().optional(),
  setorIds: z.array(z.number().int().positive()).optional(),
});

export const criarEtapaSchema = z.object({
  pipelineId: z.string().cuid(),
  nome: z.string().trim().min(1, "Nome da etapa é obrigatório").max(MAX_NOME),
  ordem: z.number().int().min(0).default(0),
  slaDias: z.number().int().positive().optional(),
});

export const atualizarEtapaSchema = z.object({
  etapaId: z.string().cuid(),
  nome: z.string().trim().min(1).max(MAX_NOME).optional(),
  ordem: z.number().int().min(0).optional(),
  slaDias: z.number().int().positive().nullable().optional(),
  script: z.string().trim().max(8000).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const reordenarEtapasSchema = z.object({
  pipelineId: z.string().cuid(),
  ordem: z.array(z.object({ etapaId: z.string().cuid(), ordem: z.number().int().min(0) })).min(1),
});

export const criarCampoSchema = z.object({
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid().optional(),
  nome: z.string().trim().min(1, "Nome do campo é obrigatório").max(MAX_NOME),
  tipo: z.enum(BPM_CAMPO_TIPO),
  opcoes: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  obrigatorio: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
});

export const atualizarCampoSchema = z.object({
  campoId: z.string().cuid(),
  nome: z.string().trim().min(1).max(MAX_NOME).optional(),
  opcoes: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
});

export const criarCardSchema = z.object({
  empresaId: z.number().int().positive({ message: "Empresa é obrigatória" }),
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid(),
  responsavelId: z.number().int().positive(),
  servico: z.string().trim().max(120).optional(),
  camposValores: z.record(z.string().cuid(), z.string().max(4000)).optional(),
});

export const atualizarCardSchema = z.object({
  cardId: z.string().cuid(),
  responsavelId: z.number().int().positive().optional(),
  servico: z.string().trim().max(120).nullable().optional(),
  status: z.enum(BPM_CARD_STATUS).optional(),
  camposValores: z.record(z.string().cuid(), z.string().max(4000)).optional(),
});

export const moverCardSchema = z.object({
  cardId: z.string().cuid(),
  etapaDestinoId: z.string().cuid(),
});

export const criarVinculoCardSchema = z.object({
  cardOrigemId: z.string().cuid(),
  cardDestinoId: z.string().cuid(),
});

export const criarInteracaoCardSchema = z.object({
  cardId: z.string().cuid(),
  agendadoEm: z.coerce.date().optional(),
  agendaLink: z.string().trim().url().max(500).optional(),
  observacoes: z.string().trim().max(MAX_DESCRICAO).optional(),
  resumo: z.string().trim().max(MAX_DESCRICAO).optional(),
});

export const criarTarefaSchema = z.object({
  cardId: z.string().cuid(),
  titulo: z.string().trim().min(1, "Título é obrigatório").max(MAX_NOME),
  descricao: z.string().trim().max(MAX_DESCRICAO).optional(),
  responsavelId: z.number().int().positive().optional(),
  prazo: z.coerce.date().optional(),
  prioridade: z.enum(BPM_TAREFA_PRIORIDADE).default("NORMAL"),
  presetId: z.string().cuid().optional(),
});

export const concluirTarefaSchema = z.object({
  tarefaId: z.string().cuid(),
});

export const criarTarefaPresetSchema = z.object({
  pipelineId: z.string().cuid().optional(),
  nome: z.string().trim().min(1).max(MAX_NOME),
  descricao: z.string().trim().max(MAX_DESCRICAO).optional(),
  tipoGeracao: z.enum(BPM_TAREFA_PRESET_TIPO_GERACAO).default("UNICA"),
  template: z.array(
    z.object({
      titulo: z.string().trim().min(1).max(MAX_NOME),
      descricao: z.string().trim().max(MAX_DESCRICAO).optional(),
      prioridade: z.enum(BPM_TAREFA_PRIORIDADE).default("NORMAL"),
    }),
  ).min(1),
});

const BPM_ANEXO_MAX_BYTES = 100 * 1024 * 1024;
const BPM_ANEXO_ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
] as const;

export const registrarAnexoSchema = z.object({
  cardId: z.string().cuid(),
  url: z.string().url(),
  nome: z.string().trim().min(1).max(255),
  tipo: z.string().max(120).optional(),
  tamanho: z.number().int().positive().max(BPM_ANEXO_MAX_BYTES).optional(),
});

export function validarUploadAnexo(file: { size: number; type: string }): string | null {
  if (file.size > BPM_ANEXO_MAX_BYTES) return "Arquivo excede o tamanho máximo permitido (100MB)";
  if (!BPM_ANEXO_ALLOWED_MIME.includes(file.type as (typeof BPM_ANEXO_ALLOWED_MIME)[number])) {
    return "Tipo de arquivo não permitido";
  }
  return null;
}

export { BPM_ANEXO_MAX_BYTES, BPM_ANEXO_ALLOWED_MIME };
