import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";
import {
  textoComponenteSchema,
  imagemComponenteSchema,
  videoComponenteSchema,
  audioComponenteSchema,
  botaoComponenteSchema,
  iconeComponenteSchema,
  divisorComponenteSchema,
  formaComponenteSchema,
} from "./slide-componentes-basicos";
import {
  globoComponenteSchema,
  particulasComponenteSchema,
  objeto3dComponenteSchema,
  containerCargaComponenteSchema,
} from "./slide-componentes-3d";
import {
  graficoComponenteSchema,
  tabelaComponenteSchema,
  kpiComponenteSchema,
  progressoComponenteSchema,
  roadmapComponenteSchema,
  comparacaoComponenteSchema,
  faqComponenteSchema,
  checklistComponenteSchema,
} from "./slide-componentes-dados";
import {
  grafoComponenteSchema,
  diagramaComponenteSchema,
} from "./slide-componentes-business";
import { chatIlustrativoComponenteSchema } from "./slide-componentes-ia";
import { fundoAnimadoComponenteSchema, type FundoAnimadoComponente } from "./slide-componentes-fundos";
import { canvasConfigSchema } from "@/lib/apresentacoes/canvas";
import { slideAnimationConfigSchema } from "./slide-animacao-config";
import { presetsAnimacaoPersonalizadosSchema } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { fontesPersonalizadasSchema } from "@/lib/apresentacoes/fontes-personalizadas";

export {
  textoComponenteSchema,
  imagemComponenteSchema,
  videoComponenteSchema,
  audioComponenteSchema,
  botaoComponenteSchema,
  iconeComponenteSchema,
  divisorComponenteSchema,
  formaComponenteSchema,
  globoComponenteSchema,
  particulasComponenteSchema,
  objeto3dComponenteSchema,
  containerCargaComponenteSchema,
  graficoComponenteSchema,
  tabelaComponenteSchema,
  kpiComponenteSchema,
  progressoComponenteSchema,
  roadmapComponenteSchema,
  comparacaoComponenteSchema,
  faqComponenteSchema,
  checklistComponenteSchema,
  grafoComponenteSchema,
  diagramaComponenteSchema,
  chatIlustrativoComponenteSchema,
  fundoAnimadoComponenteSchema,
};

// Card/Grid/Container são containers recursivos — ficam aqui (não nos arquivos satélites)
// porque usam z.lazy() referenciando componenteSchema, que só existe depois de todos os
// tipos serem declarados. O getter só é avaliado quando usado (lazy de verdade), então a
// referência a `componenteSchema` (declarada mais abaixo) funciona por hoisting de `const`.
export const gradienteComponenteSchema = z.object({
  angulo: z.number().default(135),
  corInicio: z.string(),
  corFim: z.string(),
});

export const cardComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("card"),
  corFundo: z.string().optional(),
  /** Quando presente, tem precedência visual sobre `corFundo` (mistura de cor sem exigir hex
   * digitado — o usuário escolhe as duas cores e o ângulo via UI, ver `CardProps.tsx`). */
  gradiente: gradienteComponenteSchema.optional(),
  borderRadius: z.number().optional(),
  padding: z.number().optional(),
  corBorda: z.string().optional(),
  larguraBorda: z.number().nonnegative().optional(),
  estiloBorda: z.enum(["solid", "dashed", "dotted"]).optional(),
  sombra: z.object({
    x: z.number(),
    y: z.number(),
    blur: z.number().nonnegative(),
    spread: z.number(),
    color: z.string(),
    inset: z.boolean().optional(),
  }).optional(),
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

/** Substitui a antiga separação Colunas/Stack/Flex — um único tipo com `layout` variável. */
export const containerComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("container"),
  layout: z.enum(["grid", "flex-row", "flex-col", "stack"]).default("flex-col"),
  colunas: z.number().int().min(1).optional(),
  gap: z.number().optional(),
  corFundo: z.string().optional(),
  get filhos() {
    return z.array(componenteSchema);
  },
});

export const componenteSchema: z.ZodType<ComponenteSlide> = z.discriminatedUnion("tipo", [
  textoComponenteSchema,
  imagemComponenteSchema,
  videoComponenteSchema,
  audioComponenteSchema,
  botaoComponenteSchema,
  cardComponenteSchema,
  gridComponenteSchema,
  containerComponenteSchema,
  iconeComponenteSchema,
  divisorComponenteSchema,
  formaComponenteSchema,
  globoComponenteSchema,
  particulasComponenteSchema,
  objeto3dComponenteSchema,
  containerCargaComponenteSchema,
  graficoComponenteSchema,
  tabelaComponenteSchema,
  kpiComponenteSchema,
  progressoComponenteSchema,
  roadmapComponenteSchema,
  comparacaoComponenteSchema,
  faqComponenteSchema,
  checklistComponenteSchema,
  grafoComponenteSchema,
  diagramaComponenteSchema,
  chatIlustrativoComponenteSchema,
  fundoAnimadoComponenteSchema,
]);

/** Coleta todos os ids da árvore (recursivo em containers) — usado para checar unicidade. */
function coletarIds(lista: ComponenteSlide[], acc: string[] = []): string[] {
  for (const c of lista) {
    acc.push(c.id);
    if (c.tipo === "card" || c.tipo === "grid" || c.tipo === "container") coletarIds(c.filhos, acc);
  }
  return acc;
}

export const dadosSlideSchema = z.object({
  componentes: z.array(componenteSchema),
  canvas: canvasConfigSchema.optional(),
  /** Alpha Motion (Fase 01) — ausente em slides anteriores a esta fila, sem exigir migração. */
  animacaoConfig: slideAnimationConfigSchema.optional(),
  /** Biblioteca de presets da apresentação. Fica em um slide-hospedeiro e é preservada pelo autosave. */
  presetsAnimacao: presetsAnimacaoPersonalizadosSchema.optional(),
  /** Biblioteca de fontes enviadas pelo usuário. Fica em um único slide-hospedeiro, sem migration. */
  fontesPersonalizadas: fontesPersonalizadasSchema.optional(),
  pptxSource: z.object({
    type: z.literal("pptx"),
    originalFileUrl: z.string().url().optional(),
    originalFileName: z.string().min(1),
    importerVersion: z.string().min(1),
    slideNumber: z.number().int().positive(),
    diagnostics: z.record(z.string(), z.number().int().nonnegative()).optional(),
  }).optional(),
}).refine(
  (dados) => {
    const ids = coletarIds(dados.componentes);
    return new Set(ids).size === ids.length;
  },
  { message: "Todos os componentes do slide (incluindo filhos de containers) devem ter ids únicos." },
);

export type TextoComponente = z.infer<typeof textoComponenteSchema>;
export type ImagemComponente = z.infer<typeof imagemComponenteSchema>;
export type VideoComponente = z.infer<typeof videoComponenteSchema>;
export type AudioComponente = z.infer<typeof audioComponenteSchema>;
export type BotaoComponente = z.infer<typeof botaoComponenteSchema>;
export type IconeComponente = z.infer<typeof iconeComponenteSchema>;
export type DivisorComponente = z.infer<typeof divisorComponenteSchema>;
export type FormaComponente = z.infer<typeof formaComponenteSchema>;
export type GloboComponente = z.infer<typeof globoComponenteSchema>;
export type ParticulasComponente = z.infer<typeof particulasComponenteSchema>;
export type Objeto3dComponente = z.infer<typeof objeto3dComponenteSchema>;
export type ContainerCargaComponente = z.infer<typeof containerCargaComponenteSchema>;
export type GraficoComponente = z.infer<typeof graficoComponenteSchema>;
export type TabelaComponente = z.infer<typeof tabelaComponenteSchema>;
export type KpiComponente = z.infer<typeof kpiComponenteSchema>;
export type ProgressoComponente = z.infer<typeof progressoComponenteSchema>;
export type RoadmapComponente = z.infer<typeof roadmapComponenteSchema>;
export type ComparacaoComponente = z.infer<typeof comparacaoComponenteSchema>;
export type FaqComponente = z.infer<typeof faqComponenteSchema>;
export type ChecklistComponente = z.infer<typeof checklistComponenteSchema>;
export type GrafoComponente = z.infer<typeof grafoComponenteSchema>;
export type DiagramaComponente = z.infer<typeof diagramaComponenteSchema>;
export type ChatIlustrativoComponente = z.infer<typeof chatIlustrativoComponenteSchema>;
export type { FundoAnimadoComponente };

export interface CardComponente extends z.infer<typeof baseComponenteSchema> {
  tipo: "card";
  corFundo?: string;
  gradiente?: { angulo: number; corInicio: string; corFim: string };
  borderRadius?: number;
  padding?: number;
  corBorda?: string;
  larguraBorda?: number;
  estiloBorda?: "solid" | "dashed" | "dotted";
  sombra?: { x: number; y: number; blur: number; spread: number; color: string; inset?: boolean };
  filhos: ComponenteSlide[];
}
export interface GridComponente extends z.infer<typeof baseComponenteSchema> {
  tipo: "grid";
  colunas: number;
  gap?: number;
  filhos: ComponenteSlide[];
}
export interface ContainerComponente extends z.infer<typeof baseComponenteSchema> {
  tipo: "container";
  layout: "grid" | "flex-row" | "flex-col" | "stack";
  colunas?: number;
  gap?: number;
  corFundo?: string;
  filhos: ComponenteSlide[];
}

export type ComponenteSlide =
  | TextoComponente
  | ImagemComponente
  | VideoComponente
  | AudioComponente
  | BotaoComponente
  | CardComponente
  | GridComponente
  | ContainerComponente
  | IconeComponente
  | DivisorComponente
  | FormaComponente
  | GloboComponente
  | ParticulasComponente
  | Objeto3dComponente
  | ContainerCargaComponente
  | GraficoComponente
  | TabelaComponente
  | KpiComponente
  | ProgressoComponente
  | RoadmapComponente
  | ComparacaoComponente
  | FaqComponente
  | ChecklistComponente
  | GrafoComponente
  | DiagramaComponente
  | ChatIlustrativoComponente
  | FundoAnimadoComponente;

export type DadosSlide = z.infer<typeof dadosSlideSchema>;
