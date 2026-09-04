"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarEtapaSchema,
  atualizarEtapaSchema,
  reordenarEtapasSchema,
  ativarDesativarEtapaSchema,
  definirEtapaInicialSchema,
  definirEtapasFinaisSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function registrarAuditoriaPipeline(params: {
  pipelineId: string;
  adminId: number;
  campoAlterado: string;
  valorAnteriorJson?: string;
  valorNovoJson?: string;
}) {
  await db.bpmPipelineConfigAuditoria.create({ data: params });
}

export async function CriarEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = criarEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, nome, ordem, slaDias, cor } = parsed.data;

    const etapa = await db.$transaction(async (tx) => {
      const criada = await tx.bpmEtapa.create({ data: { pipelineId, nome, ordem, slaDias, cor } });
      await registrarAuditoriaPipeline({
        pipelineId,
        adminId: userId,
        campoAlterado: "etapa_criada",
        valorNovoJson: JSON.stringify({ nome, ordem, slaDias, cor }),
      });
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: etapa };
  } catch (error) {
    console.error("[CriarEtapaBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao criar etapa";
    return { success: false, error: msg };
  }
}

export async function AtualizarEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = atualizarEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { etapaId, ...campos } = parsed.data;

    const etapaAnterior = await db.bpmEtapa.findUnique({ where: { id: etapaId } });
    if (!etapaAnterior) return { success: false, error: "Etapa não encontrada" };

    const etapa = await db.$transaction(async (tx) => {
      const atualizada = await tx.bpmEtapa.update({ where: { id: etapaId }, data: campos });
      await registrarAuditoriaPipeline({
        pipelineId: etapaAnterior.pipelineId,
        adminId: userId,
        campoAlterado: "etapa_atualizada",
        valorAnteriorJson: JSON.stringify(etapaAnterior),
        valorNovoJson: JSON.stringify(campos),
      });
      return atualizada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${etapaAnterior.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: etapaAnterior.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: etapa };
  } catch (error) {
    console.error("[AtualizarEtapaBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar etapa";
    return { success: false, error: msg };
  }
}

export async function ReordenarEtapasBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");

    const parsed = reordenarEtapasSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, ordem } = parsed.data;

    await db.$transaction(
      ordem.map(({ etapaId, ordem: novaOrdem }) =>
        db.bpmEtapa.update({ where: { id: etapaId }, data: { ordem: novaOrdem } }),
      ),
    );

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[ReordenarEtapasBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao reordenar etapas";
    return { success: false, error: msg };
  }
}

export async function AtivarDesativarEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = ativarDesativarEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { etapaId, ativo } = parsed.data;

    const etapaAnterior = await db.bpmEtapa.findUnique({ where: { id: etapaId } });
    if (!etapaAnterior) return { success: false, error: "Etapa não encontrada" };

    const etapa = await db.$transaction(async (tx) => {
      const atualizada = await tx.bpmEtapa.update({ where: { id: etapaId }, data: { ativo } });
      await registrarAuditoriaPipeline({
        pipelineId: etapaAnterior.pipelineId,
        adminId: userId,
        campoAlterado: "etapa_ativo",
        valorAnteriorJson: JSON.stringify({ ativo: etapaAnterior.ativo }),
        valorNovoJson: JSON.stringify({ ativo }),
      });
      return atualizada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${etapaAnterior.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${etapaAnterior.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: etapaAnterior.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: etapa };
  } catch (error) {
    console.error("[AtivarDesativarEtapaBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao ativar/desativar etapa";
    return { success: false, error: msg };
  }
}

/** Garante unicidade da etapa inicial por pipeline — desmarca as demais na mesma transação. */
export async function DefinirEtapaInicialBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = definirEtapaInicialSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, etapaId } = parsed.data;

    const etapa = await db.bpmEtapa.findUnique({ where: { id: etapaId } });
    if (!etapa || etapa.pipelineId !== pipelineId) {
      return { success: false, error: "Etapa não encontrada neste pipeline" };
    }

    await db.$transaction(async (tx) => {
      await tx.bpmEtapa.updateMany({
        where: { pipelineId, ehInicial: true, NOT: { id: etapaId } },
        data: { ehInicial: false },
      });
      await tx.bpmEtapa.update({ where: { id: etapaId }, data: { ehInicial: true } });
      await registrarAuditoriaPipeline({
        pipelineId,
        adminId: userId,
        campoAlterado: "etapa_inicial",
        valorNovoJson: JSON.stringify({ etapaId }),
      });
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[DefinirEtapaInicialBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao definir etapa inicial";
    return { success: false, error: msg };
  }
}

/** Etapas finais admitem múltiplas por pipeline — substitui o conjunto completo. */
export async function DefinirEtapasFinaisBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = definirEtapasFinaisSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, etapaIds } = parsed.data;

    const etapasDoPipeline = await db.bpmEtapa.findMany({
      where: { pipelineId, id: { in: etapaIds } },
      select: { id: true },
    });
    if (etapasDoPipeline.length !== etapaIds.length) {
      return { success: false, error: "Uma ou mais etapas não pertencem a este pipeline" };
    }

    await db.$transaction(async (tx) => {
      await tx.bpmEtapa.updateMany({ where: { pipelineId }, data: { ehFinal: false } });
      if (etapaIds.length > 0) {
        await tx.bpmEtapa.updateMany({ where: { id: { in: etapaIds } }, data: { ehFinal: true } });
      }
      await registrarAuditoriaPipeline({
        pipelineId,
        adminId: userId,
        campoAlterado: "etapas_finais",
        valorNovoJson: JSON.stringify({ etapaIds }),
      });
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[DefinirEtapasFinaisBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao definir etapas finais";
    return { success: false, error: msg };
  }
}
