import { z } from "zod";
import { configAnimacaoCompletaSchema } from "./animacao";
import { sharedElementIdSchema } from "./slide-animacao-config";

/** Campos comuns a todo componente de slide — base de todos os schemas de tipo. */
export const baseComponenteSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number().min(1),
  h: z.number().min(1),
  zIndex: z.number().default(0),
  rotacao: z.number().default(0),
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  opacidade: z.number().min(0).max(1).optional(),
  /** Metadados OOXML opcionais e retrocompatíveis para debug/reimportação. */
  pptxOrigem: z.object({
    slide: z.number().int().positive(),
    xmlPath: z.string().min(1),
    level: z.enum(["master", "layout", "slide"]),
    shapeId: z.string().optional(),
    relationshipId: z.string().optional(),
    name: z.string().optional(),
    parentGroup: z.string().optional(),
    result: z.string().optional(),
    fallback: z.boolean().optional(),
  }).optional(),
  /** Tipado na Onda 3 — dados anteriores (Ondas 1/2) têm animacao: undefined, compatível sem migração. */
  animacao: configAnimacaoCompletaSchema,
  /** Alpha Motion (Fase 06) — id compartilhado entre slides consecutivos para Morph. Opcional, retrocompatível. */
  sharedElementId: sharedElementIdSchema,
});
