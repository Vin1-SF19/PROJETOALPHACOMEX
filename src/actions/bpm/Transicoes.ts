"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "../../../auth";
import {
  criarTransicaoEtapaSchema,
  atualizarTransicaoEtapaSchema,
  removerTransicaoEtapaSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { registrarAuditoriaPipeline } from "@/actions/bpm/Etapas";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function ListarTransicoesDoPipelineBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoConfigPipeline(Number(session.user.id), "visualizarPipeline");

    const parsedId = z.string().cuid().safeParse(pipelineId);
    if (!parsedId.success) return { success: false, error: "Pipeline inválido", data: [] };

    const transicoes = await db.bpmTransicaoEtapa.findMany({
      where: { pipelineId },
      include: {
        etapaOrigem: { select: { id: true, nome: true } },
        etapaDestino: { select: { id: true, nome: true } },
      },
      orderBy: [{ etapaOrigem: { ordem: "asc" } }, { etapaDestino: { ordem: "asc" } }],
    });

    return { success: true, data: transicoes };
  } catch (error) {
    console.error("[ListarTransicoesDoPipelineBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao buscar transições";
    return { success: false, error: msg, data: [] };
  }
}

export async function CriarTransicaoEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = criarTransicaoEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, etapaOrigemId, etapaDestinoId, permitida, origem } = parsed.data;

    const [etapaOrigem, etapaDestino] = await Promise.all([
      db.bpmEtapa.findUnique({ where: { id: etapaOrigemId }, select: { pipelineId: true } }),
      db.bpmEtapa.findUnique({ where: { id: etapaDestinoId }, select: { pipelineId: true } }),
    ]);
    if (!etapaOrigem || !etapaDestino || etapaOrigem.pipelineId !== pipelineId || etapaDestino.pipelineId !== pipelineId) {
      return { success: false, error: "Etapas de origem/destino devem pertencer ao pipeline informado" };
    }

    const transicao = await db.$transaction(async (tx) => {
      const criada = await tx.bpmTransicaoEtapa.upsert({
        where: { etapaOrigemId_etapaDestinoId: { etapaOrigemId, etapaDestinoId } },
        create: { pipelineId, etapaOrigemId, etapaDestinoId, permitida, origem },
        update: { permitida, origem },
      });
      await registrarAuditoriaPipeline({
        pipelineId,
        adminId: userId,
        campoAlterado: "transicao_criada",
        valorNovoJson: JSON.stringify({ etapaOrigemId, etapaDestinoId, permitida, origem }),
      });
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: transicao };
  } catch (error) {
    console.error("[CriarTransicaoEtapaBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao criar transição";
    return { success: false, error: msg };
  }
}

export async function AtualizarTransicaoEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = atualizarTransicaoEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { transicaoId, ...campos } = parsed.data;

    const anterior = await db.bpmTransicaoEtapa.findUnique({ where: { id: transicaoId } });
    if (!anterior) return { success: false, error: "Transição não encontrada" };

    const transicao = await db.$transaction(async (tx) => {
      const atualizada = await tx.bpmTransicaoEtapa.update({ where: { id: transicaoId }, data: campos });
      await registrarAuditoriaPipeline({
        pipelineId: anterior.pipelineId,
        adminId: userId,
        campoAlterado: "transicao_atualizada",
        valorAnteriorJson: JSON.stringify(anterior),
        valorNovoJson: JSON.stringify(campos),
      });
      return atualizada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${anterior.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${anterior.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: anterior.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: transicao };
  } catch (error) {
    console.error("[AtualizarTransicaoEtapaBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar transição";
    return { success: false, error: msg };
  }
}

export async function RemoverTransicaoEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = removerTransicaoEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { transicaoId } = parsed.data;

    const anterior = await db.bpmTransicaoEtapa.findUnique({ where: { id: transicaoId } });
    if (!anterior) return { success: false, error: "Transição não encontrada" };

    await db.$transaction(async (tx) => {
      await tx.bpmTransicaoEtapa.delete({ where: { id: transicaoId } });
      await registrarAuditoriaPipeline({
        pipelineId: anterior.pipelineId,
        adminId: userId,
        campoAlterado: "transicao_removida",
        valorAnteriorJson: JSON.stringify(anterior),
      });
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${anterior.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${anterior.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: anterior.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[RemoverTransicaoEtapaBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao remover transição";
    return { success: false, error: msg };
  }
}
