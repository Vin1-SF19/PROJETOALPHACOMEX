/**
 * Motor de Regras e Validações — Schemas de persistência.
 * RM-2026-19631A, Fase 2.
 *
 * Reaproveita os schemas puros de condicao/resultado da Fase 1 (schemas.ts),
 * adicionando somente os campos administrativos (nome/ativa/prioridade/
 * pipelineId/etapasIds) que não existem no núcleo determinístico sem banco.
 */
import { z } from "zod";
import { grupoCondicaoSchema, resultadoRegraSchema } from "./schemas";

export const salvarRegraBpmSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1_000).optional(),
  ativa: z.boolean().default(true),
  prioridade: z.number().int().min(0).max(10_000).default(0),
  pipelineId: z.string().cuid().optional(),
  etapasIds: z.array(z.string().cuid()).max(200).optional(),
  condicao: grupoCondicaoSchema,
  resultado: resultadoRegraSchema,
});
export type SalvarRegraBpmInput = z.infer<typeof salvarRegraBpmSchema>;

export const atualizarRegraBpmSchema = salvarRegraBpmSchema.extend({
  id: z.string().cuid(),
});
export type AtualizarRegraBpmInput = z.infer<typeof atualizarRegraBpmSchema>;
