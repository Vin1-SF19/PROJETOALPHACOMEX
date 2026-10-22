import { z } from "zod";
export const tiposChecklist = [
  "RECEITA_BRUTA_DAS",
  "RECEITA_BRUTA_CPRB",
  "INICIO_RETOMADA",
  "DISPONIBILIDADE_FINANCEIRA",
] as const;
export const statusChecklist = [
  "PENDENTE",
  "OK",
  "IRREGULAR",
  "PARCIALMENTE_IRREGULAR",
  "REVISAR",
  "DESNECESSARIO",
  "EM_ANALISE",
  "AGUARDANDO_DOCUMENTOS",
  "PRIORIDADE",
] as const;
export const idSchema = z.string().trim().min(1).max(80);
export const comandoSchema = z.object({
  mutationId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
});
export const paginaSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export const filtroEmpresasSchema = paginaSchema.extend({
  analistaId: z.number().int().positive().optional(),
  semAnalista: z.boolean().optional(),
  busca: z.string().trim().max(200).optional(),
  tipo: z.enum(tiposChecklist).optional(),
  status: z.string().trim().max(40).optional(),
  clienteId: z.number().int().positive().optional(),
});
export const selecionarTipoSchema = comandoSchema.extend({
  empresaId: idSchema,
  tipo: z.enum(tiposChecklist),
});
export const patchEmpresaSchema = comandoSchema.extend({
  empresaId: idSchema,
  patch: z
    .object({
      status: z.string().trim().min(1).max(40).optional(),
      embasamento: z.string().trim().max(120).optional(),
      mesProtocolo: z.string().trim().max(40).nullable().optional(),
      linkGrupo: z
        .string()
        .url()
        .max(1000)
        .refine((v) => v.startsWith("https://"), "Use HTTPS")
        .nullable()
        .optional(),
    })
    .strict(),
});
export const patchItemSchema = comandoSchema.extend({
  itemId: idSchema,
  patch: z
    .object({
      status: z.enum(statusChecklist).optional(),
      observacao: z.string().trim().max(5000).nullable().optional(),
    })
    .strict(),
});
export const atribuirSchema = comandoSchema.extend({
  empresaId: idSchema,
  analistaId: z.number().int().positive(),
});
export const criarAtendimentoSchema = z
  .object({
    mutationId: z.string().uuid(),
    clienteId: z.number().int().positive(),
    clienteOperacionalId: idSchema.optional(),
    novaConta: z
      .object({
        nome: z.string().trim().min(2).max(120),
        email: z
          .string()
          .trim()
          .email()
          .max(180)
          .transform((v) => v.toLowerCase()),
      })
      .optional(),
    analistaId: z.number().int().positive().optional(),
    tipo: z.enum(tiposChecklist).optional(),
  })
  .superRefine((v, c) => {
    if (Boolean(v.clienteOperacionalId) === Boolean(v.novaConta))
      c.addIssue({
        code: "custom",
        message: "Escolha uma conta existente ou crie uma nova.",
      });
  });
export const documentoComandoSchema = comandoSchema.extend({
  documentoId: idSchema,
});
export const observacaoDocumentoSchema = documentoComandoSchema.extend({
  observacao: z.string().trim().max(5000).nullable(),
});
export function normalizarCodigoModelo(v: string) {
  return v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
export const publicarModeloSchema = comandoSchema.extend({
  identidadeId: idSchema.optional(),
  escopo: z.enum(["GLOBAL", ...tiposChecklist]),
  codigo: z
    .string()
    .transform(normalizarCodigoModelo)
    .pipe(z.string().min(1).max(80)),
  nome: z.string().trim().min(1).max(180),
  descricao: z.string().trim().max(1000).nullable(),
  secao: z.enum([
    "CONSTITUIÇÃO REGULAR",
    "CAPACIDADE OPERACIONAL",
    "CAPACIDADE FINANCEIRA",
    "ORIGEM DO CAPITAL SOCIAL",
    "VALIDAÇÃO",
  ]),
  obrigatorio: z.boolean(),
  ordem: z.number().int().min(0).max(100000),
  ativo: z.boolean().default(true),
});
