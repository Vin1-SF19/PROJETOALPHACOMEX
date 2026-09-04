import { z } from "zod";

import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";

export const MARCADOR_REGRA_TRIBUTARIA = "[REGRA_FINANCEIRA_TRIBUTARIA:v1]";
export const FORMULA_LIQUIDO_PADRAO =
  "valorBruto - totalRetencoes";

export const baseCalculoRetencaoSchema = z.enum([
  "VALOR_BRUTO",
  "VALOR_BRUTO_MENOS_RETENCOES",
]);

export const retencaoConfiguravelSchema = z
  .object({
    aplicavel: z.boolean().default(false),
    aliquotaPercentual: z.number().finite().min(0).max(100).default(0),
    baseCalculo: baseCalculoRetencaoSchema.default("VALOR_BRUTO"),
  })
  .strict();

export const outraRetencaoConfiguravelSchema = z
  .object({
    nome: z.string().trim().min(1).max(80),
    tipo: z.enum(["PERCENTUAL", "FIXO"]),
    aliquotaPercentual: z.number().finite().min(0).max(100).optional(),
    valorFixoCents: z.number().int().nonnegative().optional(),
    baseCalculo: baseCalculoRetencaoSchema.default("VALOR_BRUTO"),
  })
  .strict()
  .superRefine((retencao, context) => {
    if (
      retencao.tipo === "PERCENTUAL" &&
      retencao.aliquotaPercentual === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["aliquotaPercentual"],
        message: "Informe a alíquota da retenção percentual",
      });
    }
    if (retencao.tipo === "FIXO" && retencao.valorFixoCents === undefined) {
      context.addIssue({
        code: "custom",
        path: ["valorFixoCents"],
        message: "Informe o valor da retenção fixa",
      });
    }
  });

export const configuracaoTributariaSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    irrf: retencaoConfiguravelSchema,
    csrf: retencaoConfiguravelSchema,
    outrasRetencoes: z.array(outraRetencaoConfiguravelSchema).max(20).default([]),
    formulaValorLiquido: z.string().trim().min(1).max(500),
  })
  .strict();

export const salvarRegraTributariaSchema = z
  .object({
    id: z.string().cuid().optional(),
    nome: z.string().trim().min(1).max(200),
    descricao: z.string().trim().max(900).optional(),
    ativa: z.boolean().default(true),
    prioridade: z.number().int().min(0).max(10_000).default(0),
    pipelineId: z.string().cuid(),
    condicao: grupoCondicaoSchema,
    configuracao: configuracaoTributariaSchema,
  })
  .strict();

export const idRegraTributariaSchema = z
  .object({ id: z.string().cuid() })
  .strict();

export const alternarRegraTributariaSchema = idRegraTributariaSchema.extend({
  ativa: z.boolean(),
});

export type ConfiguracaoTributaria = z.infer<
  typeof configuracaoTributariaSchema
>;
export type SalvarRegraTributariaInput = z.infer<
  typeof salvarRegraTributariaSchema
>;

export function codificarConfiguracaoTributaria(
  configuracao: ConfiguracaoTributaria,
): string {
  return JSON.stringify(configuracaoTributariaSchema.parse(configuracao));
}

export function decodificarConfiguracaoTributaria(
  valor: unknown,
): ConfiguracaoTributaria | null {
  if (typeof valor !== "string") return null;
  try {
    return configuracaoTributariaSchema.parse(JSON.parse(valor));
  } catch {
    return null;
  }
}

