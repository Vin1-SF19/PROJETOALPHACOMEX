import "server-only";

import { z } from "zod";

import db from "@/lib/prisma";
import { etapaEhAgendarReuniao, destinoEhReuniaoAgendada } from "@/lib/bpm/agendar-reuniao";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { executarTransicaoBpm } from "@/lib/bpm/transicao-command";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const camposValoresSchema = z.record(z.string().trim().min(1), z.string().max(20_000))
  .refine((campos) => Object.keys(campos).length <= 200, "Informe no máximo 200 campos.");

const camposComuns = {
  camposValores: camposValoresSchema,
  versaoEsperada: z.number().int().nonnegative().optional(),
};

export const moverCardWebhookSchema = z.discriminatedUnion("etapaDestino", [
  z.object({ ...camposComuns, etapaDestino: z.literal("AGENDAR_REUNIAO") }).strict(),
  z.object({
    ...camposComuns,
    etapaDestino: z.literal("REUNIAO_AGENDADA"),
    dataReuniao: z.string().datetime({ offset: true }).transform((data) => new Date(data)),
  }).strict(),
]);

export class ErroMovimentoCardWebhook extends Error {
  constructor(public readonly status: number, public readonly codigo: string, message: string) {
    super(message);
    this.name = "ErroMovimentoCardWebhook";
  }
}

export async function moverCardViaWebhook(params: {
  endpointId: string;
  pipelineId: string;
  cardId: string;
  idempotencyKey: string;
  dados: z.infer<typeof moverCardWebhookSchema>;
}) {
  const card = await db.bpmCard.findFirst({
    where: { id: params.cardId, pipelineId: params.pipelineId },
    select: { id: true, versao: true },
  });
  if (!card) throw new ErroMovimentoCardWebhook(404, "CARD_NOT_FOUND", "Card não encontrado neste endpoint.");

  const etapas = await db.bpmEtapa.findMany({
    where: { pipelineId: params.pipelineId, ativo: true },
    select: { id: true, nome: true },
  });
  const agendar = params.dados.etapaDestino === "AGENDAR_REUNIAO";
  const origens = etapas.filter((etapa) => agendar ? etapaEhNovosLeads(etapa.nome) : etapaEhAgendarReuniao(etapa.nome));
  const destinos = etapas.filter((etapa) => agendar ? etapaEhAgendarReuniao(etapa.nome) : destinoEhReuniaoAgendada(etapa.nome));
  if (origens.length !== 1 || destinos.length !== 1) {
    throw new ErroMovimentoCardWebhook(409, "ETAPAS_NAO_CONFIGURADAS", "Configure uma única etapa ativa para a origem e o destino solicitados.");
  }

  const resultado = await executarTransicaoBpm({
    cardId: card.id,
    etapaOrigemEsperadaId: origens[0].id,
    etapaDestinoId: destinos[0].id,
    versaoEsperada: params.dados.versaoEsperada ?? card.versao,
    idempotencyKey: `webhook-etapa:${params.endpointId}:${params.cardId}:${params.idempotencyKey}`,
    ator: { tipo: "INTEGRACAO" },
    camposValores: params.dados.camposValores,
    ...("dataReuniao" in params.dados ? { dataReuniao: params.dados.dataReuniao } : {}),
  });
  if (resultado.success && !resultado.data.idempotente) {
    try {
      await notificarPipelineBpm({ pipelineId: params.pipelineId, cardId: card.id, tipo: "CARD_MOVIDO" });
    } catch { /* O polling do quadro também recupera o movimento já confirmado. */ }
  }
  return resultado;
}

export function statusErroTransicaoWebhook(code: string): number {
  if (code === "CARD_NOT_FOUND") return 404;
  if (["UNAUTHORIZED", "UNAUTHORIZED_DESTINATION", "REQUESTER_NOT_ALLOWED"].includes(code)) return 403;
  if (["STALE_STAGE", "STALE_VERSION", "SAME_STAGE", "CONCURRENT_TRANSITION", "IDEMPOTENCY_CONFLICT",
    "TRANSITION_NOT_DEFINED", "TRANSITION_DISABLED"].includes(code)) return 409;
  if (code === "DATABASE_BUSY") return 503;
  if (["TRANSITION_FAILED", "OUTBOX_UNAVAILABLE"].includes(code)) return 500;
  return 422;
}
