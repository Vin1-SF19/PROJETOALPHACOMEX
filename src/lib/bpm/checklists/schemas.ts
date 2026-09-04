import { z } from "zod";

const idSchema = z.string().cuid();
const textoOpcional = (maximo: number) => z.string().trim().max(maximo).nullable().optional();

export const itemTemplateChecklistSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  descricao: textoOpcional(2000),
  obrigatorio: z.boolean().default(true),
  ordem: z.number().int().min(0).max(10000),
});

const dadosTemplateSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  descricao: textoOpcional(4000),
  ativo: z.boolean().default(true),
  pipelineId: idSchema.nullable().optional(),
  etapaId: idSchema.nullable().optional(),
  servico: textoOpcional(200),
  tipoProcesso: textoOpcional(200),
  cardId: idSchema.nullable().optional(),
});

export const criarTemplateChecklistSchema = dadosTemplateSchema.extend({
  itens: z.array(itemTemplateChecklistSchema).max(200).default([]),
});
export const atualizarTemplateChecklistSchema = dadosTemplateSchema.extend({ id: idSchema });
export const salvarTemplateChecklistSchema = dadosTemplateSchema.extend({
  id: idSchema,
  itens: z.array(itemTemplateChecklistSchema.extend({ id: idSchema.optional() })).max(200),
}).superRefine((dados, contexto) => {
  const ids = dados.itens.flatMap((item) => item.id ? [item.id] : []);
  if (new Set(ids).size !== ids.length) {
    contexto.addIssue({ code: "custom", path: ["itens"], message: "Itens duplicados" });
  }
});
export const alternarTemplateChecklistSchema = z.object({ id: idSchema, ativo: z.boolean() });
export const criarItemTemplateChecklistSchema = itemTemplateChecklistSchema.extend({ templateId: idSchema });
export const atualizarItemTemplateChecklistSchema = itemTemplateChecklistSchema.extend({ id: idSchema });
export const removerItemTemplateChecklistSchema = z.object({ id: idSchema });
export const reordenarItensTemplateChecklistSchema = z.object({
  templateId: idSchema,
  itemIds: z.array(idSchema).min(1).max(200).refine((ids) => new Set(ids).size === ids.length, "Itens duplicados"),
});
export const cardChecklistSchema = z.object({ cardId: idSchema });
export const adicionarItemExclusivoChecklistSchema = z.object({
  cardChecklistId: idSchema,
  nome: z.string().trim().min(1).max(200),
  descricao: textoOpcional(2000),
  obrigatorio: z.boolean().default(true),
});
export const atualizarItemChecklistCardSchema = z.object({
  itemId: idSchema,
  status: z.enum(["PENDENTE", "CONCLUIDO"]).optional(),
  observacao: textoOpcional(4000),
  responsavelId: z.number().int().positive().nullable().optional(),
}).refine((dados) => dados.status !== undefined || dados.observacao !== undefined || dados.responsavelId !== undefined, "Nenhuma alteração informada");
