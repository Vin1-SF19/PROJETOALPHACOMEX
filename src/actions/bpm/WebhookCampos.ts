"use server";

import { z } from "zod";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import { listarCamposObrigatoriosWebhook } from "@/lib/bpm/webhook-campos-server";

export async function ListarCamposObrigatoriosWebhookBpm(endpointId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");
    const id = z.string().cuid().safeParse(endpointId);
    if (!id.success) return { success: false as const, error: "Endpoint inválido" };
    const endpoint = await db.bpmWebhookEndpoint.findUnique({
      where: { id: id.data }, select: { pipelineId: true, pipeline: { select: { nome: true } } },
    });
    if (!endpoint?.pipelineId || !endpoint.pipeline || !pipelineEhRevisaoRadar(endpoint.pipeline.nome)) {
      return { success: false as const, error: "A consulta de campos da API de cards requer um webhook vinculado ao pipeline Revisão de Radar." };
    }
    return { success: true as const, data: await listarCamposObrigatoriosWebhook(endpoint.pipelineId) };
  } catch {
    return { success: false as const, error: "Não foi possível consultar os campos. Verifique sua permissão e tente novamente." };
  }
}
