import { z } from "zod";

export const criarTemaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  corPrimaria: z.string().min(1),
  corSecundaria: z.string().min(1),
  corAccent: z.string().min(1),
  radius: z.string().max(20).nullish(),
  fontePrimaria: z.string().max(100).nullish(),
  fonteSecundaria: z.string().max(100).nullish(),
  tokensJson: z.record(z.string(), z.unknown()).default({}),
});
export type CriarTemaInput = z.infer<typeof criarTemaSchema>;

export const atualizarTemaSchema = criarTemaSchema.partial().extend({
  id: z.string().min(1),
});
export type AtualizarTemaInput = z.infer<typeof atualizarTemaSchema>;

export const aplicarTemaSchema = z.object({
  apresentacaoId: z.string().min(1),
  temaId: z.string().min(1).nullable(),
});
export type AplicarTemaInput = z.infer<typeof aplicarTemaSchema>;
