import { z } from "zod";

export const TIPOS_VARIAVEL = ["texto", "numero", "moeda", "data", "booleano"] as const;
export type TipoVariavel = (typeof TIPOS_VARIAVEL)[number];

export const VariavelTemplateSchema = z.object({
  nome: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use apenas letras, números e _ (deve começar com letra ou _)"),
  label: z.string().min(1).max(120),
  tipo: z.enum(TIPOS_VARIAVEL),
  obrigatorio: z.boolean().default(true),
  placeholder: z.string().max(200).optional().default(""),
});
export type VariavelTemplate = z.infer<typeof VariavelTemplateSchema>;

export const TIPOS_CLAUSULA = ["TEXTO", "TABELA", "ASSINATURA"] as const;

const MAX_CLAUSULAS_POR_TEMPLATE = 200;

export const ClasulaInputSchema = z.object({
  titulo: z.string().min(1).max(200),
  conteudo: z.string().min(1).max(20_000),
  tipo: z.enum(TIPOS_CLAUSULA).default("TEXTO"),
  editavel: z.boolean().default(true),
});

export const CriarTemplateSchema = z.object({
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(2000).optional(),
  categoria: z.string().max(60).optional(),
  variaveis: z.array(VariavelTemplateSchema).max(50).default([]),
  clausulas: z.array(ClasulaInputSchema).min(1).max(MAX_CLAUSULAS_POR_TEMPLATE),
});
export type CriarTemplateInput = z.infer<typeof CriarTemplateSchema>;

export const AtualizarTemplateSchema = z.object({
  templateId: z.string().cuid(),
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).optional(),
  categoria: z.string().max(60).optional(),
  variaveis: z.array(VariavelTemplateSchema).max(50).optional(),
});

export const CriarClasulaSchema = ClasulaInputSchema.extend({
  templateId: z.string().cuid(),
  ordem: z.number().int().min(0),
});

export const AtualizarClasulaSchema = z.object({
  clasulaId: z.string().cuid(),
  titulo: z.string().min(1).max(200).optional(),
  conteudo: z.string().min(1).max(20_000).optional(),
  tipo: z.enum(TIPOS_CLAUSULA).optional(),
  editavel: z.boolean().optional(),
});

export const ReordenarClasulasSchema = z.object({
  templateId: z.string().cuid(),
  ordem: z.array(z.string().cuid()).min(1).max(MAX_CLAUSULAS_POR_TEMPLATE),
});

export const GerarDocumentoSchema = z.object({
  templateId: z.string().cuid(),
  titulo: z.string().min(1).max(200),
  variaveis: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()),
  clienteId: z.number().int().positive().optional(),
  empresaContratadaId: z.string().cuid().optional(),
});
export type GerarDocumentoInput = z.infer<typeof GerarDocumentoSchema>;

/** Qualificação de empresa CONTRATADA — cadastro global do módulo Gerador de Documentos. */
export const EmpresaContratadaSchema = z.object({
  razaoSocial: z.string().min(1).max(200),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ deve conter 14 dígitos"),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  bairro: z.string().max(100).optional(),
  municipio: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  naturezaJuridica: z.string().max(200).optional(),
  representanteLegalNome: z.string().max(200).optional(),
  representanteLegalCpf: z.string().max(20).optional(),
  representanteLegalCargo: z.string().max(100).optional(),
});
export type EmpresaContratadaInput = z.infer<typeof EmpresaContratadaSchema>;

export const AtualizarEmpresaContratadaSchema = EmpresaContratadaSchema.partial().extend({
  empresaId: z.string().cuid(),
});

export const ReescreverClasulaSchema = z.object({
  documentoId: z.string().cuid(),
  clasulaId: z.string().cuid(),
  instrucao: z.string().min(3).max(2000),
});

export const EditarClasulaGeradaSchema = z.object({
  documentoId: z.string().cuid(),
  clasulaId: z.string().cuid(),
  conteudo: z.string().min(1).max(20_000),
});

/** Resposta da IA ao identificar variáveis e cláusulas de um documento enviado (RM-2026-93645F). */
export const IdentificacaoTemplateSchema = z.object({
  variaveis: z.array(VariavelTemplateSchema).max(50),
  clausulas: z
    .array(
      z.object({
        titulo: z.string().min(1).max(200),
        conteudo: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(MAX_CLAUSULAS_POR_TEMPLATE),
});
export type IdentificacaoTemplate = z.infer<typeof IdentificacaoTemplateSchema>;
