import { z } from "zod";

export const STATUS_APRESENTACAO = ["DRAFT", "PUBLICADA", "ARQUIVADA"] as const;
export type StatusApresentacao = (typeof STATUS_APRESENTACAO)[number];

export const criarApresentacaoSchema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório").max(200),
  clienteNome: z.string().trim().max(200).nullish(),
});
export type CriarApresentacaoInput = z.infer<typeof criarApresentacaoSchema>;

export const atualizarStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUS_APRESENTACAO),
});
export type AtualizarStatusInput = z.infer<typeof atualizarStatusSchema>;

export const paginacaoApresentacaoSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  busca: z.string().trim().max(200).optional(),
});
export type PaginacaoApresentacaoInput = z.infer<typeof paginacaoApresentacaoSchema>;

/** Estrutura mínima de um slide recém-criado (vazio) — o Editor (Onda 2) populará `componentes`. */
export const dadosSlideVazioSchema = z.object({
  componentes: z.array(z.unknown()).default([]),
});
