import { z } from "zod";

export const GATILHOS_AUTOMACAO_BPM = [
  "ENTRAR_COLUNA",
  "SAIR_COLUNA",
  "TEMPO_NA_COLUNA",
] as const;

export const ACOES_AUTOMACAO_BPM = [
  "ENVIAR_EMAIL",
  "GERAR_CONTRATO",
  "GERAR_FICHA",
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
  return parametrosFichaSchema.parse(parametros);
}

export type SalvarAutomacaoBpmInput = z.infer<typeof salvarAutomacaoBpmSchema>;
export type ParametrosEmailBpm = z.infer<typeof parametrosEmailSchema>;
export type ParametrosContratoBpm = z.infer<typeof parametrosContratoSchema>;
