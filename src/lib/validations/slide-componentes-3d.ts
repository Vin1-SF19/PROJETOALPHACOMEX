import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

const corHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal no formato #RRGGBB.");

export const globoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("globo"),
  corBase: z.string().optional(),
  texturaUrl: z.string().optional(),
  velocidadeRotacao: z.number().min(0).max(5).default(0.5),
  marcadores: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().optional(),
    cor: z.string().optional(),
  })).default([]),
  /** Rotas entre 2 marcadores (índice no array acima) — usado para mapas de comércio/logística (portos, container tracker). */
  rotas: z.array(z.object({
    origemIndex: z.number().int().min(0),
    destinoIndex: z.number().int().min(0),
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

/** Container de carga procedural da Alpha, adaptado da seção Sobre do site institucional. */
export const containerCargaComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("containerCarga"),
  corPrincipal: corHexSchema.default("#071a3d"),
  corMetal: corHexSchema.default("#96a3b2"),
  corInterior: corHexSchema.default("#171b22"),
  anguloAbertura: z.number().min(45).max(120).default(105),
  duracaoAbertura: z.number().min(0.2).max(10).default(1.8),
  atrasoAbertura: z.number().min(0).max(10).default(0.2),
  transicaoProximoSlide: z.boolean().default(true),
  duracaoZoom: z.number().min(0.3).max(5).default(1.4),
  somHabilitado: z.boolean().default(false),
  somAbertura: z.enum(["industrial", "hidraulico"]).default("industrial"),
  volumeSom: z.number().min(0).max(1).default(0.65),
  mostrarLogo: z.boolean().default(true),
  estadoEditor: z.enum(["fechado", "aberto"]).default("fechado"),
});
