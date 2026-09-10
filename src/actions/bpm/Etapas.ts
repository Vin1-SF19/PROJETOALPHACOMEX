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
import type { Prisma } from "@prisma/client";
import { avancarConfigVersionBpm } from "@/lib/bpm/config-version";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

async function notificarEtapaConfirmada(pipelineId: string) {
  try {
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
  } catch (error) {
    console.error("[Etapas:notificacao_pos_commit]", error);
  }
}

type ClienteAuditoriaPipeline = Pick<Prisma.TransactionClient, "bpmPipelineConfigAuditoria">;

export async function registrarAuditoriaPipeline(client: ClienteAuditoriaPipeline, params: {
  pipelineId: string;
  adminId: number;
  campoAlterado: string;
  valorAnteriorJson?: string;
  valorNovoJson?: string;
}) {
  await client.bpmPipelineConfigAuditoria.create({ data: params });
}

export async function CriarEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = criarEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, nome, ordem, cor } = parsed.data;

    const etapa = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const existentes = await tx.bpmEtapa.findMany({
        where: { pipelineId },
        select: { id: true },
      });
      const criada = await tx.bpmEtapa.create({ data: { pipelineId, nome, ordem, cor } });
      if (existentes.length > 0) {
        await tx.bpmTransicaoEtapa.createMany({
          data: existentes.flatMap(({ id }) => [
            { pipelineId, etapaOrigemId: criada.id, etapaDestinoId: id, permitida: false, origem: "AMBOS" },
            { pipelineId, etapaOrigemId: id, etapaDestinoId: criada.id, permitida: false, origem: "AMBOS" },
          ]),
        });
      }
      await registrarAuditoriaPipeline(tx, {
        pipelineId,
        adminId: userId,
        campoAlterado: "etapa_criada",
        valorNovoJson: JSON.stringify({ nome, ordem, cor, transicoesBloqueadasCriadas: existentes.length * 2 }),
      });
      await avancarConfigVersionBpm(tx, pipelineId);
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarEtapaConfirmada(pipelineId);
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

    const { etapa, pipelineId } = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const etapaAnterior = await tx.bpmEtapa.findUnique({ where: { id: etapaId } });
      if (!etapaAnterior) throw new Error("ETAPA_NAO_ENCONTRADA");
      const atualizada = await tx.bpmEtapa.update({ where: { id: etapaId }, data: campos });
      await registrarAuditoriaPipeline(tx, {
        pipelineId: etapaAnterior.pipelineId,
        adminId: userId,
        campoAlterado: "etapa_atualizada",
        valorAnteriorJson: JSON.stringify(etapaAnterior),
        valorNovoJson: JSON.stringify(campos),
      });
      await avancarConfigVersionBpm(tx, etapaAnterior.pipelineId);
      return { etapa: atualizada, pipelineId: etapaAnterior.pipelineId };
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarEtapaConfirmada(pipelineId);
    return { success: true, data: etapa };
  } catch (error) {
    console.error("[AtualizarEtapaBpm]", error);
    const msg = error instanceof Error && error.message === "ETAPA_NAO_ENCONTRADA"
      ? "Etapa não encontrada"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar etapa";
    return { success: false, error: msg };
  }
}

export async function ReordenarEtapasBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = reordenarEtapasSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, ordem } = parsed.data;

    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const ids = ordem.map(({ etapaId }) => etapaId);
      const pertencentes = await tx.bpmEtapa.count({ where: { pipelineId, id: { in: ids } } });
      if (pertencentes !== new Set(ids).size) throw new Error("ETAPA_FORA_PIPELINE");
      for (const { etapaId, ordem: novaOrdem } of ordem) {
        await tx.bpmEtapa.update({ where: { id: etapaId }, data: { ordem: novaOrdem } });
      }
      await registrarAuditoriaPipeline(tx, {
        pipelineId,
        adminId: userId,
        campoAlterado: "etapas_reordenadas",
        valorNovoJson: JSON.stringify({ ordem }),
      });
      await avancarConfigVersionBpm(tx, pipelineId);
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarEtapaConfirmada(pipelineId);
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

    const { etapa, pipelineId } = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const etapaAnterior = await tx.bpmEtapa.findUnique({ where: { id: etapaId } });
      if (!etapaAnterior) throw new Error("ETAPA_NAO_ENCONTRADA");
      const atualizada = await tx.bpmEtapa.update({ where: { id: etapaId }, data: { ativo } });
      await registrarAuditoriaPipeline(tx, {
        pipelineId: etapaAnterior.pipelineId,
        adminId: userId,
        campoAlterado: "etapa_ativo",
        valorAnteriorJson: JSON.stringify({ ativo: etapaAnterior.ativo }),
        valorNovoJson: JSON.stringify({ ativo }),
      });
      await avancarConfigVersionBpm(tx, etapaAnterior.pipelineId);
      return { etapa: atualizada, pipelineId: etapaAnterior.pipelineId };
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarEtapaConfirmada(pipelineId);
    return { success: true, data: etapa };
  } catch (error) {
    console.error("[AtivarDesativarEtapaBpm]", error);
    const msg = error instanceof Error && error.message === "ETAPA_NAO_ENCONTRADA"
      ? "Etapa não encontrada"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao ativar/desativar etapa";
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

    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const etapa = await tx.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId }, select: { id: true } });
      if (!etapa) throw new Error("ETAPA_FORA_PIPELINE");
      await tx.bpmEtapa.updateMany({
        where: { pipelineId, ehInicial: true, NOT: { id: etapaId } },
        data: { ehInicial: false },
      });
      await tx.bpmEtapa.update({ where: { id: etapaId }, data: { ehInicial: true } });
      await registrarAuditoriaPipeline(tx, {
        pipelineId,
        adminId: userId,
        campoAlterado: "etapa_inicial",
        valorNovoJson: JSON.stringify({ etapaId }),
      });
      await avancarConfigVersionBpm(tx, pipelineId);
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarEtapaConfirmada(pipelineId);
    return { success: true };
  } catch (error) {
    console.error("[DefinirEtapaInicialBpm]", error);
    const msg = error instanceof Error && error.message === "ETAPA_FORA_PIPELINE"
      ? "Etapa não encontrada neste pipeline"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao definir etapa inicial";
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

    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const etapasDoPipeline = await tx.bpmEtapa.findMany({
        where: { pipelineId, id: { in: etapaIds } },
        select: { id: true },
      });
      if (etapasDoPipeline.length !== new Set(etapaIds).size) throw new Error("ETAPA_FORA_PIPELINE");
      await tx.bpmEtapa.updateMany({ where: { pipelineId }, data: { ehFinal: false } });
      if (etapaIds.length > 0) {
        await tx.bpmEtapa.updateMany({ where: { id: { in: etapaIds } }, data: { ehFinal: true } });
      }
      await registrarAuditoriaPipeline(tx, {
        pipelineId,
        adminId: userId,
        campoAlterado: "etapas_finais",
        valorNovoJson: JSON.stringify({ etapaIds }),
      });
      await avancarConfigVersionBpm(tx, pipelineId);
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${pipelineId}`);
    await notificarEtapaConfirmada(pipelineId);
    return { success: true };
  } catch (error) {
    console.error("[DefinirEtapasFinaisBpm]", error);
    const msg = error instanceof Error && error.message === "ETAPA_FORA_PIPELINE"
      ? "Uma ou mais etapas não pertencem a este pipeline"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao definir etapas finais";
    return { success: false, error: msg };
  }
}
