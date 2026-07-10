import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

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
