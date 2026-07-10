import { z } from "zod";
import { configAnimacaoCompletaSchema } from "./animacao";

/** Campos comuns a todo componente de slide — base de todos os schemas de tipo. */
export const baseComponenteSchema = z.object({
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
