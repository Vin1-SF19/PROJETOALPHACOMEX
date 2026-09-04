import { z } from "zod";

import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";

export const GATILHOS_AUTOMACAO_BPM = [
  "ENTRAR_COLUNA",
  "SAIR_COLUNA",
  "TEMPO_NA_COLUNA",
  "CARD_CRIADO",
  "TAREFA_CRIADA",
  "PROCESSO_DEFERIDO",
] as const;

export const ACOES_AUTOMACAO_BPM = [
  "ENVIAR_EMAIL",
  "GERAR_CONTRATO",
  "GERAR_FICHA",
  "MATERIALIZAR_CHECKLIST",
  "DISTRIBUIR_RESPONSAVEL",
  "IDENTIFICAR_OPORTUNIDADE",
] as const;

export type GatilhoAutomacaoBpm = (typeof GATILHOS_AUTOMACAO_BPM)[number];
export type AcaoAutomacaoBpm = (typeof ACOES_AUTOMACAO_BPM)[number];

export const parametrosEmailSchema = z.object({
  para: z.string().trim().email("Informe um e-mail válido").max(320),
  assunto: z.string().trim().min(1).max(200),
  corpo: z.string().trim().min(1).max(20_000),
  cc: z.array(z.string().trim().email().max(320)).max(20).default([]),
}).strict();

export const parametrosContratoSchema = z.object({
  templateId: z.string().cuid(),
  titulo: z.string().trim().min(1).max(200),
  variaveis: z.record(
    z.string().min(1).max(60),
    z.union([z.string().max(10_000), z.number(), z.boolean()]).nullable(),
  ).default({}),
}).strict();

export const parametrosFichaSchema = z.object({}).strict();
export const parametrosMaterializarChecklistSchema = z.object({}).strict();

export const estrategiaDistribuicaoSchema = z.enum([
  "RESPONSAVEL_FIXO",
  "ROUND_ROBIN",
  "MENOR_CARGA",
]);

const distribuicaoBaseSchema = z.object({
  versao: z.number().int().min(1).max(10_000).default(1),
  prioridade: z.number().int().min(0).max(10_000).default(0),
  entidade: z.enum(["CARD", "TAREFA"]).default("CARD"),
  estrategia: estrategiaDistribuicaoSchema,
  candidatosIds: z.array(z.number().int().positive()).min(1).max(100),
  responsavelFixoId: z.number().int().positive().optional().nullable(),
  condicao: grupoCondicaoSchema.optional().nullable(),
}).strict().superRefine((dados, contexto) => {
  if (dados.estrategia === "RESPONSAVEL_FIXO") {
    if (!dados.responsavelFixoId || !dados.candidatosIds.includes(dados.responsavelFixoId)) {
      contexto.addIssue({
        code: "custom",
        path: ["responsavelFixoId"],
        message: "O responsável fixo deve fazer parte dos candidatos elegíveis",
      });
    }
  }
});

export const parametrosDistribuicaoSchema = distribuicaoBaseSchema;

const acaoOportunidadeSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("CRIAR_CARD_COMERCIAL"),
    pipelineId: z.string().cuid(),
    etapaId: z.string().cuid(),
    responsavelId: z.number().int().positive(),
  }).strict(),
  z.object({
    tipo: z.literal("ATRIBUIR_VENDEDOR"),
    responsavelId: z.number().int().positive(),
  }).strict(),
  z.object({
    tipo: z.literal("CRIAR_TAREFA"),
    titulo: z.string().trim().min(1).max(200),
    descricao: z.string().trim().max(2_000).optional().nullable(),
    responsavelId: z.number().int().positive().optional().nullable(),
    prazoDias: z.number().int().min(0).max(365).default(0),
  }).strict(),
  z.object({
    tipo: z.literal("ADICIONAR_ANOTACAO"),
    texto: z.string().trim().min(1).max(5_000),
  }).strict(),
  z.object({
    tipo: z.literal("ALTERAR_CAMPO"),
    campoId: z.string().cuid(),
    valor: z.string().max(20_000),
  }).strict(),
  z.object({
    tipo: z.literal("ENVIAR_EMAIL"),
    parametros: parametrosEmailSchema,
  }).strict(),
]);

export const parametrosOportunidadeSchema = z.object({
  servicoAlvoId: z.number().int().positive(),
  condicao: grupoCondicaoSchema,
  acao: acaoOportunidadeSchema,
}).strict();

const baseSchema = z.object({
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid(),
  nome: z.string().trim().min(2).max(120),
  descricao: z.string().trim().max(1_000).optional().nullable(),
  gatilhoTipo: z.enum(GATILHOS_AUTOMACAO_BPM),
  tempoMinutos: z.number().int().min(5).max(525_600).optional().nullable(),
  ativa: z.boolean().default(true),
});

export const salvarAutomacaoBpmSchema = z.discriminatedUnion("acaoTipo", [
  baseSchema.extend({
    acaoTipo: z.literal("ENVIAR_EMAIL"),
    parametros: parametrosEmailSchema,
  }),
  baseSchema.extend({
    acaoTipo: z.literal("GERAR_CONTRATO"),
    parametros: parametrosContratoSchema,
  }),
  baseSchema.extend({
    acaoTipo: z.literal("GERAR_FICHA"),
    parametros: parametrosFichaSchema,
  }),
  baseSchema.extend({
    acaoTipo: z.literal("MATERIALIZAR_CHECKLIST"),
    parametros: parametrosMaterializarChecklistSchema,
  }),
  baseSchema.extend({
    acaoTipo: z.literal("DISTRIBUIR_RESPONSAVEL"),
    parametros: parametrosDistribuicaoSchema,
  }),
  baseSchema.extend({
    acaoTipo: z.literal("IDENTIFICAR_OPORTUNIDADE"),
    parametros: parametrosOportunidadeSchema,
  }),
]).superRefine((dados, context) => {
  if (dados.gatilhoTipo === "TEMPO_NA_COLUNA" && !dados.tempoMinutos) {
    context.addIssue({
      code: "custom",
      path: ["tempoMinutos"],
      message: "Informe o tempo mínimo na coluna",
    });
  }
  if (dados.gatilhoTipo !== "TEMPO_NA_COLUNA" && dados.tempoMinutos != null) {
    context.addIssue({
      code: "custom",
      path: ["tempoMinutos"],
      message: "Tempo só pode ser usado no gatilho por permanência",
    });
  }
  if (
    dados.acaoTipo === "DISTRIBUIR_RESPONSAVEL"
    && dados.parametros.entidade === "TAREFA"
    && dados.gatilhoTipo !== "TAREFA_CRIADA"
  ) {
    context.addIssue({
      code: "custom",
      path: ["gatilhoTipo"],
      message: "Distribuição de tarefa exige o gatilho Tarefa criada",
    });
  }
  if (
    dados.acaoTipo === "DISTRIBUIR_RESPONSAVEL"
    && dados.parametros.entidade === "CARD"
    && dados.gatilhoTipo === "TAREFA_CRIADA"
  ) {
    context.addIssue({
      code: "custom",
      path: ["gatilhoTipo"],
      message: "Distribuição de card não pode usar o gatilho Tarefa criada",
    });
  }
});

export const atualizarAutomacaoBpmSchema = z.object({
  automacaoId: z.string().cuid(),
  dados: salvarAutomacaoBpmSchema,
}).strict();

export const duplicarAutomacaoBpmSchema = z.object({
  automacaoId: z.string().cuid(),
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid(),
  nome: z.string().trim().min(2).max(120).optional(),
}).strict();

export function validarParametrosAutomacaoBpm(
  acaoTipo: AcaoAutomacaoBpm,
  parametros: unknown,
) {
  if (acaoTipo === "ENVIAR_EMAIL") return parametrosEmailSchema.parse(parametros);
  if (acaoTipo === "GERAR_CONTRATO") return parametrosContratoSchema.parse(parametros);
  if (acaoTipo === "GERAR_FICHA") return parametrosFichaSchema.parse(parametros);
  if (acaoTipo === "MATERIALIZAR_CHECKLIST") return parametrosMaterializarChecklistSchema.parse(parametros);
  if (acaoTipo === "DISTRIBUIR_RESPONSAVEL") return parametrosDistribuicaoSchema.parse(parametros);
  return parametrosOportunidadeSchema.parse(parametros);
}

export type SalvarAutomacaoBpmInput = z.infer<typeof salvarAutomacaoBpmSchema>;
export type ParametrosEmailBpm = z.infer<typeof parametrosEmailSchema>;
export type ParametrosContratoBpm = z.infer<typeof parametrosContratoSchema>;
export type ParametrosDistribuicaoBpm = z.infer<typeof parametrosDistribuicaoSchema>;
export type ParametrosOportunidadeBpm = z.infer<typeof parametrosOportunidadeSchema>;
