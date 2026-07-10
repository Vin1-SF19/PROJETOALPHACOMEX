import { z } from "zod";
import { configAnimacaoCompletaSchema } from "./animacao";

const baseComponenteSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().min(1),
  h: z.number().min(1),
  zIndex: z.number().default(0),
  rotacao: z.number().default(0),
  /** Tipado na Onda 3 — dados anteriores (Ondas 1/2) têm animacao: undefined, compatível sem migração. */
  animacao: configAnimacaoCompletaSchema,
});

export const textoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("texto"),
  texto: z.string(),
  tag: z.enum(["h1", "h2", "p", "span"]),
  corTexto: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  alinhamento: z.enum(["left", "center", "right"]).optional(),
});

export const imagemComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("imagem"),
  url: z.string(),
  alt: z.string().optional(),
  objectFit: z.enum(["cover", "contain"]).optional(),
});

export const botaoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("botao"),
  texto: z.string(),
  corFundo: z.string().optional(),
  corTexto: z.string().optional(),
  borderRadius: z.number().optional(),
  href: z.string().optional(),
});

export const iconeComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("icone"),
  nomeIcone: z.string(),
  cor: z.string().optional(),
  tamanhoIcone: z.number().optional(),
});

export const divisorComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("divisor"),
  cor: z.string().optional(),
  espessura: z.number().optional(),
});

// Card e Grid são containers recursivos — precisam de z.lazy() porque referenciam
// o próprio union (componenteSchema) antes dele existir.
export const cardComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("card"),
  corFundo: z.string().optional(),
  borderRadius: z.number().optional(),
  padding: z.number().optional(),
  get filhos() {
    return z.array(componenteSchema);
  },
});

export const gridComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("grid"),
  colunas: z.number().int().min(1),
  gap: z.number().optional(),
  get filhos() {
    return z.array(componenteSchema);
  },
});

export const globoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("globo"),
  corBase: z.string().optional(),
  texturaUrl: z.string().optional(),
  velocidadeRotacao: z.number().min(0).max(5).default(0.5),
  marcadores: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string().optional(),
    cor: z.string().optional(),
  })).default([]),
});

export const particulasComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("particulas"),
  quantidade: z.number().min(10).max(2000).default(300),
  cor: z.string().optional(),
  tamanho: z.number().min(0.5).max(10).default(2),
  velocidade: z.number().min(0).max(5).default(1),
});

export const objeto3dComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("objeto3d"),
  url: z.string(),
  autoRotacao: z.boolean().default(true),
  escala: z.number().min(0.1).max(10).default(1),
});

export const componenteSchema: z.ZodType<ComponenteSlide> = z.discriminatedUnion("tipo", [
  textoComponenteSchema,
  imagemComponenteSchema,
  botaoComponenteSchema,
  cardComponenteSchema,
  gridComponenteSchema,
  iconeComponenteSchema,
  divisorComponenteSchema,
  globoComponenteSchema,
  particulasComponenteSchema,
  objeto3dComponenteSchema,
]);

/** Coleta todos os ids da árvore (recursivo em card/grid.filhos) — usado para checar unicidade. */
function coletarIds(lista: ComponenteSlide[], acc: string[] = []): string[] {
  for (const c of lista) {
    acc.push(c.id);
    if (c.tipo === "card" || c.tipo === "grid") coletarIds(c.filhos, acc);
  }
  return acc;
}

export const dadosSlideSchema = z.object({
  componentes: z.array(componenteSchema),
}).refine(
  (dados) => {
    const ids = coletarIds(dados.componentes);
    return new Set(ids).size === ids.length;
  },
  { message: "Todos os componentes do slide (incluindo filhos de card/grid) devem ter ids únicos." },
);

export type TextoComponente = z.infer<typeof textoComponenteSchema>;
export type ImagemComponente = z.infer<typeof imagemComponenteSchema>;
export type BotaoComponente = z.infer<typeof botaoComponenteSchema>;
export type IconeComponente = z.infer<typeof iconeComponenteSchema>;
export type DivisorComponente = z.infer<typeof divisorComponenteSchema>;
export type GloboComponente = z.infer<typeof globoComponenteSchema>;
export type ParticulasComponente = z.infer<typeof particulasComponenteSchema>;
export type Objeto3dComponente = z.infer<typeof objeto3dComponenteSchema>;
export interface CardComponente extends z.infer<typeof baseComponenteSchema> {
  tipo: "card";
  corFundo?: string;
  borderRadius?: number;
  padding?: number;
  filhos: ComponenteSlide[];
}
export interface GridComponente extends z.infer<typeof baseComponenteSchema> {
  tipo: "grid";
  colunas: number;
  gap?: number;
  filhos: ComponenteSlide[];
}

export type ComponenteSlide =
  | TextoComponente
  | ImagemComponente
  | BotaoComponente
  | CardComponente
  | GridComponente
  | IconeComponente
  | DivisorComponente
  | GloboComponente
  | ParticulasComponente
  | Objeto3dComponente;

export type DadosSlide = z.infer<typeof dadosSlideSchema>;
