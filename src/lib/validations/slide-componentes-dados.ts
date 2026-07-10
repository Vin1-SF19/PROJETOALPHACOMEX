import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

export const graficoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("grafico"),
  tipoGrafico: z.enum(["barra", "linha", "pizza"]).default("barra"),
  dados: z.array(z.object({ label: z.string(), valor: z.number() })).default([]),
  corPrimaria: z.string().optional(),
});

export const tabelaComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("tabela"),
  colunas: z.array(z.string()).default([]),
  linhas: z.array(z.array(z.string())).default([]),
  corCabecalho: z.string().optional(),
});

export const kpiComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("kpi"),
  valor: z.string(),
  label: z.string(),
  variacao: z.number().optional(),
  icone: z.string().optional(),
});

export const progressoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("progresso"),
  percentual: z.number().min(0).max(100),
  label: z.string().optional(),
  cor: z.string().optional(),
});

export const roadmapComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("roadmap"),
  itens: z.array(z.object({
    titulo: z.string(),
    data: z.string().optional(),
    descricao: z.string().optional(),
    concluido: z.boolean().default(false),
  })).default([]),
  orientacao: z.enum(["horizontal", "vertical"]).default("horizontal"),
});

export const comparacaoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("comparacao"),
  colunas: z.array(z.object({
    titulo: z.string(),
    itens: z.array(z.string()).default([]),
    destaque: z.boolean().default(false),
  })).default([]),
});

export const faqComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("faq"),
  itens: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).default([]),
});

export const checklistComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("checklist"),
  itens: z.array(z.object({ texto: z.string(), concluido: z.boolean().default(false) })).default([]),
});
