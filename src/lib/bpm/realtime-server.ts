import "server-only";

import db from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
  BPM_PIPELINE_EVENT,
  canalPipelineBpm,
  criarBpmRealtimePayload,
  type BpmRealtimeTipo,
} from "@/lib/bpm/realtime";

type NotificarPipelineBpmParams = {
  pipelineId?: string;
  cardId?: string;
  tipo: BpmRealtimeTipo;
};

/**
 * Publica apenas um sinal de invalidação. A emissão é best-effort: uma falha
 * externa nunca pode transformar uma mutação já persistida em erro para o usuário.
 */
export async function notificarPipelineBpm(params: NotificarPipelineBpmParams): Promise<void> {
  try {
    let pipelineId = params.pipelineId;

    if (!pipelineId && params.cardId) {
      const card = await db.bpmCard.findUnique({
        where: { id: params.cardId },
        select: { pipelineId: true },
      });
      pipelineId = card?.pipelineId;
    }

    if (!pipelineId) {
      console.error("[AlphaCRM realtime] Pipeline não resolvido", {
        cardId: params.cardId,
        tipo: params.tipo,
      });
      return;
    }

    const payload = criarBpmRealtimePayload({
      pipelineId,
      tipo: params.tipo,
    });

    await pusherServer.trigger(canalPipelineBpm(pipelineId), BPM_PIPELINE_EVENT, payload);
  } catch (error) {
    console.error("[AlphaCRM realtime] Falha ao publicar atualização", error);
  }
}
