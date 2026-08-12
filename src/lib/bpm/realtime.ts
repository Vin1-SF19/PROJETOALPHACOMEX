export const BPM_PIPELINE_CHANNEL_PREFIX = "private-alpha-crm-pipeline-";
export const BPM_PIPELINE_EVENT = "alpha-crm-atualizado";

export const BPM_REALTIME_TIPOS = [
  "CARD_CRIADO",
  "PRIMEIRA_VISUALIZACAO",
  "CARD_ATUALIZADO",
  "CARD_MOVIDO",
  "TAREFA_ALTERADA",
  "ANEXO_ALTERADO",
  "INTERACAO_CRIADA",
  "REUNIAO_ALTERADA",
  "VINCULO_CRIADO",
  "ETAPA_ALTERADA",
  "CAMPO_ALTERADO",
  "PIPELINE_ALTERADO",
] as const;

export type BpmRealtimeTipo = (typeof BPM_REALTIME_TIPOS)[number];

export type BpmRealtimePayload = {
  pipelineId: string;
  cardId?: string;
  tipo: BpmRealtimeTipo;
  timestamp: string;
};

const PIPELINE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function canalPipelineBpm(pipelineId: string): string {
  if (!PIPELINE_ID_PATTERN.test(pipelineId)) {
    throw new Error("ID de pipeline inválido para canal realtime");
  }
  return `${BPM_PIPELINE_CHANNEL_PREFIX}${pipelineId}`;
}

export function extrairPipelineIdCanalBpm(channelName: string): string | null {
  if (!channelName.startsWith(BPM_PIPELINE_CHANNEL_PREFIX)) return null;

  const pipelineId = channelName.slice(BPM_PIPELINE_CHANNEL_PREFIX.length);
  if (!PIPELINE_ID_PATTERN.test(pipelineId)) return null;

  return canalPipelineBpm(pipelineId) === channelName ? pipelineId : null;
}

export function criarBpmRealtimePayload(params: {
  pipelineId: string;
  cardId?: string;
  tipo: BpmRealtimeTipo;
  agora?: Date;
}): BpmRealtimePayload {
  const payload: BpmRealtimePayload = {
    pipelineId: params.pipelineId,
    tipo: params.tipo,
    timestamp: (params.agora ?? new Date()).toISOString(),
  };

  if (params.cardId) payload.cardId = params.cardId;
  return payload;
}
