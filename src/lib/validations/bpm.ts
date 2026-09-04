import { z } from "zod";
import { STATUS_POS_FECHAMENTO_CODIGOS } from "@/lib/bpm/status-pos-fechamento";
import { BPM_TAREFA_TIPOS } from "@/lib/bpm/tarefas-tipo";
import { normalizarCNPJ } from "@/lib/format-cnpj";

export const BPM_CARD_STATUS = ["ATIVO", "CONCLUIDO", "CANCELADO"] as const;

export const BPM_CARD_MEMBRO_ROLE = ["RESPONSAVEL", "ADMINISTRADOR", "PARTICIPANTE"] as const;

export const BPM_CAMPO_TIPO = [
  "texto",
  "texto_longo",
  "numero",
  "moeda",
  "percentual",
  "data",
  "data_hora",
  "booleano",
  "selecao",
  "multiselecao",
  "usuario",
  "cnpj",
  "cpf",
  "email",
  "telefone",
  "url",
  "arquivo",
  "relacionamento",
] as const;

export const BPM_CAMPO_ESCOPO = ["CARD", "GLOBAL"] as const;
export const BPM_CAMPO_FONTE_ENTIDADE = ["CLIENTE", "CONTATO", "PARCEIRO", "CONTRATO", "SERVICO", "PROCESSO", "CARD"] as const;
export const BPM_CAMPO_MAPEAMENTO_MODO = ["COPIAR", "SINCRONIZAR", "REFERENCIAR"] as const;
export const BPM_CAMPO_PERFIL = ["ADMIN", "RESPONSAVEL", "MEMBRO"] as const;

export const BPM_TAREFA_PRIORIDADE = ["BAIXA", "NORMAL", "ALTA"] as const;

const dataHoraIsoBpmSchema = z.string().datetime({ offset: true });

function normalizarDataHoraBpm(valor: unknown): unknown {
  if (valor instanceof Date) return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return new Date(valor);
  if (typeof valor === "string" && dataHoraIsoBpmSchema.safeParse(valor).success) {
    return new Date(valor);
  }
  return valor;
}

/**
 * Aceita somente os formatos historicamente documentados pelas Server Actions:
 * Date válida, ISO datetime estrita com timezone e timestamp numérico finito.
 * Strings locais/naturais e datas sem hora nunca chegam ao parser do ambiente.
 */
export function dataHoraObrigatoriaBpmSchema(mensagem: string) {
  return z.preprocess(normalizarDataHoraBpm, z.date({ error: mensagem }));
}

const dataHoraOpcionalBpmSchema = z.preprocess(
  (valor) => valor === "" ? null : normalizarDataHoraBpm(valor),
  z.date().nullable().optional(),
);

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

const corBpmSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser um hex válido (#RRGGBB)")
  .nullable()
  .optional();

export const criarEtapaSchema = z.object({
  pipelineId: z.string().cuid(),
  nome: z.string().trim().min(1, "Nome da etapa é obrigatório").max(MAX_NOME),
  ordem: z.number().int().min(0).default(0),
  slaDias: z.number().int().positive().optional(),
  cor: corBpmSchema,
});

export const atualizarEtapaSchema = z.object({
  etapaId: z.string().cuid(),
  nome: z.string().trim().min(1).max(MAX_NOME).optional(),
  ordem: z.number().int().min(0).optional(),
  slaDias: z.number().int().positive().nullable().optional(),
  script: z.string().trim().max(8000).nullable().optional(),
  ativo: z.boolean().optional(),
  cor: corBpmSchema,
});

export const reordenarEtapasSchema = z.object({
  pipelineId: z.string().cuid(),
  ordem: z.array(z.object({ etapaId: z.string().cuid(), ordem: z.number().int().min(0) })).min(1),
});

export const ativarDesativarPipelineSchema = z.object({
  pipelineId: z.string().cuid(),
  ativo: z.boolean(),
});

export const reordenarPipelinesSchema = z.object({
  ordem: z.array(z.object({ pipelineId: z.string().cuid(), ordem: z.number().int().min(0) })).min(1),
});

export const ativarDesativarEtapaSchema = z.object({
  etapaId: z.string().cuid(),
  ativo: z.boolean(),
});

export const definirEtapaInicialSchema = z.object({
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid(),
});

export const definirEtapasFinaisSchema = z.object({
  pipelineId: z.string().cuid(),
  etapaIds: z.array(z.string().cuid()).max(200),
});

export const criarSubStatusSchema = z.object({
  etapaId: z.string().cuid(),
  nome: z.string().trim().min(1, "Nome do substatus é obrigatório").max(120),
  cor: corBpmSchema,
  ordem: z.number().int().min(0).default(0),
});

export const atualizarSubStatusSchema = z.object({
  subStatusId: z.string().cuid(),
  nome: z.string().trim().min(1).max(120).optional(),
  cor: corBpmSchema,
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export const ativarDesativarSubStatusSchema = z.object({
  subStatusId: z.string().cuid(),
  ativo: z.boolean(),
});

export const reordenarSubStatusSchema = z.object({
  etapaId: z.string().cuid(),
  ordem: z.array(z.object({ subStatusId: z.string().cuid(), ordem: z.number().int().min(0) })).min(1),
});

export const BPM_TRANSICAO_ORIGEM = ["MANUAL", "AUTOMACAO", "AMBOS"] as const;

export const criarTransicaoEtapaSchema = z
  .object({
    pipelineId: z.string().cuid(),
    etapaOrigemId: z.string().cuid(),
    etapaDestinoId: z.string().cuid(),
    permitida: z.boolean().default(true),
    origem: z.enum(BPM_TRANSICAO_ORIGEM).default("AMBOS"),
  })
  .refine((dados) => dados.etapaOrigemId !== dados.etapaDestinoId, {
    message: "Etapa de origem e destino devem ser diferentes",
    path: ["etapaDestinoId"],
  });

export const atualizarTransicaoEtapaSchema = z.object({
  transicaoId: z.string().cuid(),
  permitida: z.boolean().optional(),
  origem: z.enum(BPM_TRANSICAO_ORIGEM).optional(),
});

export const removerTransicaoEtapaSchema = z.object({
  transicaoId: z.string().cuid(),
});

const campoOpcaoSchema = z.union([
  z.string().trim().min(1).max(120),
  z.object({
    id: z.string().cuid().optional(),
    chave: z.string().trim().min(1).max(120).regex(/^[a-z0-9_-]+$/i),
    rotulo: z.string().trim().min(1).max(120),
    ordem: z.number().int().min(0),
    ativo: z.boolean().default(true),
  }),
]);

const campoEtapaConfigSchema = z.object({
  etapaId: z.string().cuid(),
  visivel: z.boolean().default(true),
  editavel: z.boolean().default(true),
  somenteLeitura: z.boolean().default(false),
  obrigatorio: z.boolean().default(false),
  obrigatorioEntrada: z.boolean().default(false),
  obrigatorioSaida: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
  grupo: z.string().trim().max(120).nullable().optional(),
  valorPadrao: z.string().max(4000).nullable().optional(),
  condicaoVisibilidadeJson: z.string().max(20_000).nullable().optional(),
  condicaoObrigatoriedadeJson: z.string().max(20_000).nullable().optional(),
}).refine((config) => !(config.editavel && config.somenteLeitura), {
  message: "Uma etapa não pode ser editável e somente leitura ao mesmo tempo",
});

const campoAcessoSchema = z.object({
  perfil: z.enum(BPM_CAMPO_PERFIL),
  visivel: z.boolean().default(true),
  editavel: z.boolean().default(true),
  somenteLeitura: z.boolean().default(false),
  obrigatorio: z.boolean().default(false),
}).refine((config) => !(config.editavel && config.somenteLeitura), {
  message: "Um perfil não pode editar um campo somente leitura",
});

const campoConfiguracaoBaseSchema = z.object({
  chave: z.string().trim().min(1).max(120).regex(/^[a-z0-9_.-]+$/i).nullable().optional(),
  escopo: z.enum(BPM_CAMPO_ESCOPO).default("CARD"),
  valorPadrao: z.string().max(4000).nullable().optional(),
  fonteEntidade: z.enum(BPM_CAMPO_FONTE_ENTIDADE).nullable().optional(),
  fonteAtributo: z.string().trim().max(80).nullable().optional(),
  entidadeGlobal: z.enum(["CLIENTE"]).nullable().optional(),
  visivel: z.boolean().default(true),
  editavel: z.boolean().default(true),
  somenteLeitura: z.boolean().default(false),
  ativo: z.boolean().default(true),
  pipelineIds: z.array(z.string().cuid()).max(50).optional(),
  etapaConfiguracoes: z.array(campoEtapaConfigSchema).max(200).optional(),
  acessos: z.array(campoAcessoSchema).max(10).optional(),
});

function validarConfiguracaoCampo(
  dados: { escopo?: string; fonteEntidade?: string | null; fonteAtributo?: string | null; editavel?: boolean; somenteLeitura?: boolean },
  contexto: z.RefinementCtx,
) {
  if (dados.editavel && dados.somenteLeitura) {
    contexto.addIssue({ code: "custom", path: ["somenteLeitura"], message: "Campo somente leitura não pode ser editável" });
  }
  if (Boolean(dados.fonteEntidade) !== Boolean(dados.fonteAtributo)) {
    contexto.addIssue({ code: "custom", path: ["fonteEntidade"], message: "Entidade e atributo canônicos devem ser informados juntos" });
  }
}

export const criarCampoSchema = z.object({
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid().optional(),
  nome: z.string().trim().min(1, "Nome do campo é obrigatório").max(MAX_NOME),
  tipo: z.enum(BPM_CAMPO_TIPO),
  opcoes: z.array(campoOpcaoSchema).max(50).optional(),
  obrigatorio: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
}).merge(campoConfiguracaoBaseSchema).superRefine(validarConfiguracaoCampo);

export const atualizarCampoSchema = z.object({
  campoId: z.string().cuid(),
  nome: z.string().trim().min(1).max(MAX_NOME).optional(),
  tipo: z.enum(BPM_CAMPO_TIPO).optional(),
  opcoes: z.array(campoOpcaoSchema).max(50).nullable().optional(),
  etapaId: z.string().cuid().nullable().optional(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
  chave: z.string().trim().min(1).max(120).regex(/^[a-z0-9_.-]+$/i).nullable().optional(),
  escopo: z.enum(BPM_CAMPO_ESCOPO).optional(),
  valorPadrao: z.string().max(4000).nullable().optional(),
  fonteEntidade: z.enum(BPM_CAMPO_FONTE_ENTIDADE).nullable().optional(),
  fonteAtributo: z.string().trim().max(80).nullable().optional(),
  entidadeGlobal: z.enum(["CLIENTE"]).nullable().optional(),
  visivel: z.boolean().optional(),
  editavel: z.boolean().optional(),
  somenteLeitura: z.boolean().optional(),
  ativo: z.boolean().optional(),
  pipelineIds: z.array(z.string().cuid()).max(50).optional(),
  etapaConfiguracoes: z.array(campoEtapaConfigSchema).max(200).optional(),
  acessos: z.array(campoAcessoSchema).max(10).optional(),
}).superRefine(validarConfiguracaoCampo);

export const excluirCampoSchema = z.object({
  campoId: z.string().cuid(),
});

export const configurarMapeamentoCampoSchema = z.object({
  campoDestinoId: z.string().cuid(),
  campoOrigemId: z.string().cuid(),
  modo: z.enum(BPM_CAMPO_MAPEAMENTO_MODO),
  ativo: z.boolean().default(true),
}).refine((dados) => dados.campoDestinoId !== dados.campoOrigemId, {
  message: "Origem e destino devem ser campos diferentes",
  path: ["campoOrigemId"],
});

// Cadastro real de empresa nova — só usado pelo botão "+" da etapa "Novos Leads"
// (Fase 3.2 do Cliente Master): cria o `Cliente` na mesma transação do card, em
// vez de exigir que a empresa já exista (única exceção do BPM — as demais
// etapas continuam vinculando empresa já cadastrada via `empresaId`).
export const novaEmpresaCardSchema = z.object({
  cnpj: z.string()
    .refine((valor) => valor.replace(/\D/g, "").length === 14, "CNPJ inválido")
    .transform(normalizarCNPJ)
    .refine((cnpj) => cnpj.length === 14, "CNPJ inválido"),
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
  // Fase 3 (RM-2026-54DC86): omitido, `servico` é derivado do nome do pipeline em CriarCardBpm.
  // RM-2026-97934A: informado explicitamente por callers que já sabem o serviço de origem
  // (ex: Indicacao.servicoIndicado) — quando ausente, mantém o fallback do nome do pipeline.
  servico: z.string().trim().min(1).max(120).optional(),
}).refine((d) => d.empresaId !== undefined || d.novaEmpresa !== undefined, {
  message: "Empresa é obrigatória",
  path: ["empresaId"],
});

export const atualizarCardSchema = z.object({
  cardId: z.string().cuid(),
  responsavelId: z.number().int().positive().optional(),
  servico: z.string().trim().max(120).nullable().optional(),
  tipoProcesso: z.string().trim().max(200).nullable().optional(),
  status: z.enum(BPM_CARD_STATUS).optional(),
  statusPosFechamento: z.enum(STATUS_POS_FECHAMENTO_CODIGOS).optional(),
  versaoEsperadaEm: z.coerce.date().optional(),
  proximoContatoEm: dataHoraOpcionalBpmSchema,
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
  proximoContatoEm: dataHoraOpcionalBpmSchema,
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
  prazo: dataHoraObrigatoriaBpmSchema("Prazo é obrigatório"),
  alertaEm: dataHoraObrigatoriaBpmSchema("Alerta é obrigatório"),
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
      prazo: dataHoraObrigatoriaBpmSchema("Prazo é obrigatório"),
      alertaEm: dataHoraObrigatoriaBpmSchema("Alerta é obrigatório"),
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
  campoId: z.string().cuid().optional(),
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
