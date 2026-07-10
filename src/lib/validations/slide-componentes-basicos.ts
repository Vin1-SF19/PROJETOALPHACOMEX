import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

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

/** Vídeo HTML5 nativo — mesmo padrão de imagem (URL, sem upload próprio nesta onda). */
export const videoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("video"),
  url: z.string(),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  controles: z.boolean().default(true),
  muted: z.boolean().default(true),
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
