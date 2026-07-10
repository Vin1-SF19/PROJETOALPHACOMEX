import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

/**
 * Organograma/fluxograma/mapa mental são todos grafos de nó-e-conexão — mesma estrutura
 * de dados (nos[]/conexoes[]), só muda a aparência padrão via `estilo`. Um tipo só evita
 * duplicar 3 schemas quase idênticos.
 */
export const grafoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("grafo"),
  estilo: z.enum(["organograma", "fluxograma", "mapamental"]).default("fluxograma"),
  nos: z.array(z.object({
    id: z.string(),
    label: z.string(),
    x: z.number(),
    y: z.number(),
  })).default([]),
  conexoes: z.array(z.object({
    origem: z.string(),
    destino: z.string(),
    label: z.string().optional(),
  })).default([]),
});

export const diagramaComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("diagrama"),
  formato: z.enum(["swot", "matriz2x2", "piramide", "funil"]).default("swot"),
  itens: z.array(z.object({
    label: z.string(),
    texto: z.string().optional(),
    cor: z.string().optional(),
  })).default([]),
});
