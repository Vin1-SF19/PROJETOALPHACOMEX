"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { bpmCardIdSchema } from "@/lib/validations/bpm";
import { assumirRecebimentoPipelineBpm } from "@/lib/bpm/recebimentos-card-server";
import { notificarPendenciasLeadsBpm } from "@/lib/bpm/notificacoes-leads-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const schema = z.object({ cardId: bpmCardIdSchema, recepcaoId: z.string().min(1).max(200),
  versaoEsperada: z.number().int().nonnegative() }).strict();
export async function AssumirRecebimentoPipelineBpm(input: unknown) {
  const session = await auth();
  const usuarioId = Number(session?.user?.id);
  if (!session?.user?.id || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) return { success: false as const, error: "Não autorizado" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos para assumir" };
  try {
    const resultado = await assumirRecebimentoPipelineBpm(parsed.data, usuarioId);
    await Promise.allSettled([
      notificarPendenciasLeadsBpm({ pipelineId: resultado.pipelineId }),
      notificarPipelineBpm({ cardId: resultado.cardId, pipelineId: resultado.pipelineId, tipo: "CARD_ATUALIZADO" }),
      Promise.resolve().then(() => revalidatePath(`/PainelAlpha/AlphaCRM/pipeline/${resultado.pipelineId}`)),
    ]);
    return { success: true as const, data: resultado };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "";
    return { success: false as const, error: /^(Não autorizado|Recepção não encontrada|Este card já|Card indisponível|Seu perfil|O card mudou)/.test(mensagem)
      ? mensagem : "Não foi possível assumir o card. Atualize e tente novamente." };
  }
}
