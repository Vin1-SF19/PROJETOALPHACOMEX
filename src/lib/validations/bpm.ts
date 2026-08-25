import { z } from "zod";
import { STATUS_POS_FECHAMENTO_CODIGOS } from "@/lib/bpm/status-pos-fechamento";
import { BPM_TAREFA_TIPOS } from "@/lib/bpm/tarefas-tipo";

export const BPM_CARD_STATUS = ["ATIVO", "CONCLUIDO", "CANCELADO"] as const;

export const BPM_CARD_MEMBRO_ROLE = ["RESPONSAVEL", "ADMINISTRADOR", "PARTICIPANTE"] as const;

export const BPM_CAMPO_TIPO = ["texto", "texto_longo", "numero", "data", "selecao", "booleano", "cpf"] as const;

export const BPM_TAREFA_PRIORIDADE = ["BAIXA", "NORMAL", "ALTA"] as const;

export const BPM_TAREFA_STATUS = ["PENDENTE", "CONCLUIDA"] as const;

export const BPM_TAREFA_PRESET_TIPO_GERACAO = ["UNICA", "MULTIPLA", "FLUXO"] as const;

const MAX_NOME = 200;
const MAX_DESCRICAO = 4000;
export const MAX_CAMPOS_VALORES_BPM = 100;

const camposValoresBpmSchema = z
  .record(z.string().cuid(), z.string().max(4000))
  .refine(
    (valores) => Object.keys(valores).length <= MAX_CAMPOS_VALORES_BPM,
    `No máximo ${MAX_CAMPOS_VALORES_BPM} campos podem ser enviados por operação.`,
  );

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

// Cadastro real de empresa nova — só usado pelo botão "+" da etapa "Novos Leads"
// (Fase 3.2 do Cliente Master): cria o `Cliente` na mesma transação do card, em
// vez de exigir que a empresa já exista (única exceção do BPM — as demais
// etapas continuam vinculando empresa já cadastrada via `empresaId`).
export const novaEmpresaCardSchema = z.object({
  cnpj: z.string().trim().min(14, "CNPJ inválido").max(20),
  razaoSocial: z.string().trim().min(2, "Razão social é obrigatória").max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  uf: z.string().trim().length(2).optional(),
  municipio: z.string().trim().max(120).optional(),
});

export const criarCardSchema = z.object({
  empresaId: z.number().int().positive().optional(),
  novaEmpresa: novaEmpresaCardSchema.optional(),
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid(),
  responsavelId: z.number().int().positive(),
  servico: z.string().trim().max(120).optional(),
}).refine((d) => d.empresaId !== undefined || d.novaEmpresa !== undefined, {
  message: "Empresa é obrigatória",
  path: ["empresaId"],
});

export const atualizarCardSchema = z.object({
  cardId: z.string().cuid(),
  responsavelId: z.number().int().positive().optional(),
  servico: z.string().trim().max(120).nullable().optional(),
  status: z.enum(BPM_CARD_STATUS).optional(),
  statusPosFechamento: z.enum(STATUS_POS_FECHAMENTO_CODIGOS).optional(),
  versaoEsperadaEm: z.coerce.date().optional(),
  proximoContatoEm: z.preprocess(
    (valor) => valor === "" ? null : valor,
    z.coerce.date().nullable().optional(),
  ),
  camposValores: camposValoresBpmSchema.optional(),
});

export const MAX_MEMBROS_CARD_BPM = 50;

export const listarUsuariosVinculaveisCardSchema = z.object({
  cardId: z.string().cuid(),
});

export const atualizarMembrosCardSchema = z.object({
  cardId: z.string().cuid(),
  userIds: z
    .array(z.number().int().positive())
    .max(
      MAX_MEMBROS_CARD_BPM,
      `Selecione no máximo ${MAX_MEMBROS_CARD_BPM} pessoas para o card.`,
    )
    .superRefine((userIds, contexto) => {
      if (new Set(userIds).size !== userIds.length) {
        contexto.addIssue({
          code: "custom",
          message: "Uma pessoa não pode ser vinculada mais de uma vez ao mesmo card.",
        });
      }
    }),
});

export const salvarChecklistFollowUpSchema = z.object({
  cardId: z.string().cuid(),
  checklistId: z.string().cuid().optional(),
  respostas: z.record(
    z.string().trim().min(1).max(100),
    z.union([z.string().max(MAX_DESCRICAO), z.boolean()]),
  ),
  concluir: z.boolean().default(false),
});

export const interromperStandbyFollowUpSchema = z.object({
  cardId: z.string().cuid(),
  motivo: z.string().trim().min(2, "Informe o motivo da interrupção").max(MAX_DESCRICAO),
});

export const moverCardSchema = z.object({
  cardId: z.string().cuid(),
  etapaDestinoId: z.string().cuid(),
});

export const salvarRequisitosEMoverCardSchema = moverCardSchema.extend({
  camposValores: camposValoresBpmSchema.default({}),
  proximoContatoEm: z.preprocess(
    (valor) => valor === "" ? null : valor,
    z.coerce.date().nullable().optional(),
  ),
});

export const promoverNolossLeadSchema = z.object({
  nolossLeadId: z.string().cuid(),
  etapaDestinoId: z.string().cuid(),
  responsavelId: z.number().int().positive(),
});

export const criarVinculoCardSchema = z.object({
  cardOrigemId: z.string().cuid(),
  cardDestinoId: z.string().cuid(),
});

export const criarInteracaoCardSchema = z.object({
  cardId: z.string().cuid(),
  tipo: z.enum(["LIGACAO", "ANOTACAO", "EMAIL", "REUNIAO", "WHATSAPP"]).default("LIGACAO"),
  agendadoEm: z.coerce.date().optional(),
  agendaLink: z.string().trim().url().max(500).optional(),
  observacoes: z.string().trim().max(MAX_DESCRICAO).optional(),
  resumo: z.string().trim().max(MAX_DESCRICAO).optional(),
}).superRefine((dados, contexto) => {
  if (dados.tipo === "ANOTACAO" && !dados.observacoes?.trim()) {
    contexto.addIssue({
      code: "custom",
      path: ["observacoes"],
      message: "A anotação não pode ficar vazia.",
    });
  }
});

export const criarTarefaSchema = z.object({
  cardId: z.string().cuid(),
  tipo: z.enum(BPM_TAREFA_TIPOS),
  titulo: z.string().trim().max(MAX_NOME).optional(),
  descricao: z.string().trim().max(MAX_DESCRICAO).optional(),
  contato: z.string().trim().max(200).optional(),
  telefone: z.string().trim().max(40).optional(),
  emailDestino: z.string().trim().email("E-mail de destino inválido").max(320).optional(),
  mensagem: z.string().trim().max(MAX_DESCRICAO).optional(),
  checklistItens: z.array(z.string().trim().min(1).max(300)).min(1).max(30).optional(),
  responsavelId: z.number().int().positive().optional(),
  prazo: z.coerce.date({ error: "Prazo é obrigatório" }),
  alertaEm: z.coerce.date({ error: "Alerta é obrigatório" }),
  prioridade: z.enum(BPM_TAREFA_PRIORIDADE).default("NORMAL"),
  presetId: z.string().cuid().optional(),
}).superRefine((dados, contexto) => {
  if (dados.alertaEm > dados.prazo) {
    contexto.addIssue({ code: "custom", path: ["alertaEm"], message: "O alerta deve ocorrer antes do prazo." });
  }
  if (["CHECKLIST", "TAREFA", "LEMBRETE_RAPIDO", "EMAIL"].includes(dados.tipo) && !dados.titulo?.trim()) {
    contexto.addIssue({ code: "custom", path: ["titulo"], message: "Título é obrigatório." });
  }
  if (dados.tipo === "CHECKLIST" && !dados.checklistItens?.length) {
    contexto.addIssue({ code: "custom", path: ["checklistItens"], message: "Inclua ao menos um item no checklist." });
  }
  if (dados.tipo === "LIGACAO" && !dados.telefone?.trim()) {
    contexto.addIssue({ code: "custom", path: ["telefone"], message: "Telefone é obrigatório para ligação." });
  }
  if (dados.tipo === "WHATSAPP" && (!dados.contato?.trim() || !dados.mensagem?.trim())) {
    contexto.addIssue({ code: "custom", path: ["mensagem"], message: "Informe contato e mensagem do WhatsApp." });
  }
  if (dados.tipo === "EMAIL" && (!dados.emailDestino?.trim() || !dados.mensagem?.trim())) {
    contexto.addIssue({ code: "custom", path: ["mensagem"], message: "Informe destinatário e mensagem do e-mail." });
  }
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
      tipo: z.enum(BPM_TAREFA_TIPOS).default("TAREFA"),
      prazo: z.coerce.date({ error: "Prazo é obrigatório" }),
      alertaEm: z.coerce.date({ error: "Alerta é obrigatório" }),
      prioridade: z.enum(BPM_TAREFA_PRIORIDADE).default("NORMAL"),
    }).superRefine((tarefa, contexto) => {
      if (tarefa.alertaEm > tarefa.prazo) {
        contexto.addIssue({
          code: "custom",
          path: ["alertaEm"],
          message: "O alerta deve ocorrer antes do prazo.",
        });
      }
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
  recibo: z.string().trim().min(20).max(4_096),
});

export function validarUploadAnexo(file: { size: number; type: string }): string | null {
  if (file.size > BPM_ANEXO_MAX_BYTES) return "Arquivo excede o tamanho máximo permitido (100MB)";
  if (!BPM_ANEXO_ALLOWED_MIME.includes(file.type as (typeof BPM_ANEXO_ALLOWED_MIME)[number])) {
    return "Tipo de arquivo não permitido";
  }
  return null;
}

export { BPM_ANEXO_MAX_BYTES, BPM_ANEXO_ALLOWED_MIME };
