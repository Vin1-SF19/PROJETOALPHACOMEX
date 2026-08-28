import { z } from "zod";

export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 14, "CNPJ deve conter 14 dígitos");

export const vincularEmpresaExtratoSchema = z.object({
  cnpj: cnpjSchema,
  razaoSocial: z.string().trim().min(1, "Razão social é obrigatória").max(255),
  nomeFantasia: z.string().trim().max(255).optional(),
  dataConstituicao: z.string().trim().max(30).optional(),
  municipio: z.string().trim().max(120).optional(),
  uf: z.string().trim().max(2).optional(),
  regimeTributario: z.string().trim().max(120).optional(),
});
export type VincularEmpresaExtratoInput = z.infer<typeof vincularEmpresaExtratoSchema>;

export const periodoInputSchema = z.object({
  mes: z.string().min(1, "Mês é obrigatório").max(30),
  ano: z
    .string()
    .regex(/^\d{4}$/, "Ano deve conter 4 dígitos"),
  extratoId: z.number().int().positive(),
});
export type PeriodoInput = z.infer<typeof periodoInputSchema>;

export const bancoInputSchema = z.object({
  bancoId: z.string().min(1),
  nome: z.string().min(1, "Nome do banco é obrigatório").max(100),
  logo: z.string().min(1),
  descricao: z.string().max(500).nullish(),
  periodoId: z.number().int().positive(),
});
export type BancoInput = z.infer<typeof bancoInputSchema>;

/** Aceita DD/MM/YYYY, DD/MM (sem ano), ou vazio — o parsing final decide se vira Date ou fica como texto. */
export const transacaoInputSchema = z.object({
  data: z.string().max(60).optional().default(""),
  descricao: z.string().trim().min(1, "Descrição é obrigatória").max(500),
  valor: z.coerce.number().finite("Valor inválido"),
  bancoId: z.string().min(1).optional(),
  mesReferencia: z.string().max(30).optional().default(""),
  origemArquivo: z.string().max(300).nullish(),
});
export type TransacaoInput = z.infer<typeof transacaoInputSchema>;

export const transacaoLoteSchema = z.array(transacaoInputSchema).min(1, "Nenhuma transação para salvar");

export const paginacaoSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type PaginacaoInput = z.infer<typeof paginacaoSchema>;

/** Resposta esperada de UMA transação vinda do agente Onyx (interpretação de página de extrato). */
export const transacaoOnyxSchema = z.object({
  data: z.string().max(60),
  descricao: z.string().trim().min(1).max(500),
  valor: z.coerce.number().finite(),
});
export type TransacaoOnyx = z.infer<typeof transacaoOnyxSchema>;

export const transacoesOnyxArraySchema = z.array(z.unknown());
