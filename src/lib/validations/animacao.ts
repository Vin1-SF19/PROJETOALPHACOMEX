import { z } from "zod";
import { configAnimacaoContainerAlphaSchema } from "@/lib/apresentacoes/animacao-container-alpha";

export const ANIMACAO_TIPOS = [
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom-in",
  "zoom-out",
  "flip",
  "bounce",
  "blur",
  "stagger",
  "typing",
  "counter",
  "container-alpha",
] as const;
export type AnimacaoTipo = (typeof ANIMACAO_TIPOS)[number];

export const EASING_TIPOS = ["linear", "easeIn", "easeOut", "easeInOut"] as const;
export type EasingTipo = (typeof EASING_TIPOS)[number];

export const configAnimacaoSchema = z.object({
  tipo: z.enum(ANIMACAO_TIPOS),
  duracao: z.number().min(0.1).max(5).default(0.5),
  delay: z.number().min(0).max(5).default(0),
  easing: z.enum(EASING_TIPOS).default("easeOut"),
  /** Só usado quando tipo === "stagger" — delay entre a animação de cada filho de card/grid. */
  staggerDelay: z.number().min(0).max(2).optional(),
  /** Só usado quando tipo === "typing" — velocidade de digitação em caracteres por segundo. */
  velocidadeDigitacao: z.number().min(1).max(200).optional(),
  /** Só usado quando tipo === "counter" — o contador anima de 0 até este valor. */
  valorFinal: z.number().optional(),
  /** Configuração visual e sonora da transição fullscreen Container Alpha. */
  containerAlpha: configAnimacaoContainerAlphaSchema.optional(),
});

export const configAnimacaoCompletaSchema = z
  .object({
    entrada: configAnimacaoSchema.optional(),
    saida: configAnimacaoSchema.optional(),
    loop: configAnimacaoSchema.extend({ repetir: z.boolean().default(true) }).optional(),
  })
  .optional();

export type ConfigAnimacao = z.infer<typeof configAnimacaoSchema>;
export type ConfigAnimacaoCompleta = z.infer<typeof configAnimacaoCompletaSchema>;
