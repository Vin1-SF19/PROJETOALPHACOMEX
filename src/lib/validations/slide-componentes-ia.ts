import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

/** Bolhas de chat estáticas para ILUSTRAR um slide sobre produto de IA — sem funcionalidade real. */
export const chatIlustrativoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("chatIlustrativo"),
  mensagens: z.array(z.object({
    autor: z.enum(["usuario", "ia"]),
    texto: z.string(),
  })).default([]),
});
