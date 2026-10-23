import { z } from "zod";
import { bpmCardIdSchema, etapaIdCardSchema } from "@/lib/validations/bpm";

export const encaminhamentoManualSchema = z.object({
  cardId: bpmCardIdSchema,
  pipelineDestinoId: z.string().cuid(),
  etapaDestinoId: etapaIdCardSchema,
  responsavelDestinoId: z.number().int().positive().optional(),
  etapaOrigemEsperadaId: etapaIdCardSchema,
  versaoEsperada: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();
export type ComandoEncaminhamentoManual = z.infer<typeof encaminhamentoManualSchema>;
export type PipelineEnvioManual = { id: string; nome: string; etapas: { id: string; nome: string }[] };
export class ErroEncaminhamentoManual extends Error {}
