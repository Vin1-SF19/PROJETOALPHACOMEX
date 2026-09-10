"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarSubStatusSchema,
  atualizarSubStatusSchema,
  ativarDesativarSubStatusSchema,
  reordenarSubStatusSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { registrarAuditoriaPipeline } from "@/actions/bpm/Etapas";
import { avancarConfigVersionBpm } from "@/lib/bpm/config-version";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

async function notificarSubStatusConfirmado(pipelineId: string) {
  try {
    await notificarPipelineBpm({ pipelineId, tipo: "ETAPA_ALTERADA" });
  } catch (error) {
    console.error("[SubStatus:notificacao_pos_commit]", error);
  }
}

export async function CriarSubStatusBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = criarSubStatusSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { etapaId, nome, cor, ordem } = parsed.data;

    const { subStatus, pipelineId } = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const etapa = await tx.bpmEtapa.findUnique({ where: { id: etapaId }, select: { pipelineId: true } });
      if (!etapa) throw new Error("ETAPA_NAO_ENCONTRADA");
      const criado = await tx.bpmSubStatus.create({ data: { etapaId, nome, cor, ordem } });
      await registrarAuditoriaPipeline(tx, {
        pipelineId: etapa.pipelineId,
        adminId: userId,
        campoAlterado: "substatus_criado",
        valorNovoJson: JSON.stringify({ etapaId, nome, cor, ordem }),
      });
      await avancarConfigVersionBpm(tx, etapa.pipelineId);
      return { subStatus: criado, pipelineId: etapa.pipelineId };
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarSubStatusConfirmado(pipelineId);
    return { success: true, data: subStatus };
  } catch (error) {
    console.error("[CriarSubStatusBpm]", error);
    const msg = error instanceof Error && error.message === "ETAPA_NAO_ENCONTRADA"
      ? "Etapa não encontrada"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao criar substatus";
    return { success: false, error: msg };
  }
}

export async function AtualizarSubStatusBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = atualizarSubStatusSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { subStatusId, ...campos } = parsed.data;

    const { subStatus, pipelineId } = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const anterior = await tx.bpmSubStatus.findUnique({
        where: { id: subStatusId },
        include: { etapa: { select: { pipelineId: true } } },
      });
      if (!anterior) throw new Error("SUBSTATUS_NAO_ENCONTRADO");
      const atualizado = await tx.bpmSubStatus.update({ where: { id: subStatusId }, data: campos });
      await registrarAuditoriaPipeline(tx, {
        pipelineId: anterior.etapa.pipelineId,
        adminId: userId,
        campoAlterado: "substatus_atualizado",
        valorAnteriorJson: JSON.stringify(anterior),
        valorNovoJson: JSON.stringify(campos),
      });
      await avancarConfigVersionBpm(tx, anterior.etapa.pipelineId);
      return { subStatus: atualizado, pipelineId: anterior.etapa.pipelineId };
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarSubStatusConfirmado(pipelineId);
    return { success: true, data: subStatus };
  } catch (error) {
    console.error("[AtualizarSubStatusBpm]", error);
    const msg = error instanceof Error && error.message === "SUBSTATUS_NAO_ENCONTRADO"
      ? "Substatus não encontrado"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar substatus";
    return { success: false, error: msg };
  }
}

export async function AtivarDesativarSubStatusBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = ativarDesativarSubStatusSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    return await AtualizarSubStatusBpm(parsed.data);
  } catch (error) {
    console.error("[AtivarDesativarSubStatusBpm]", error);
    return { success: false, error: "Erro ao ativar/desativar substatus" };
  }
}

export async function ReordenarSubStatusBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = reordenarSubStatusSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { etapaId, ordem } = parsed.data;

    const pipelineId = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const etapa = await tx.bpmEtapa.findUnique({ where: { id: etapaId }, select: { pipelineId: true } });
      if (!etapa) throw new Error("ETAPA_NAO_ENCONTRADA");
      const ids = ordem.map(({ subStatusId }) => subStatusId);
      const pertencentes = await tx.bpmSubStatus.count({ where: { etapaId, id: { in: ids } } });
      if (pertencentes !== new Set(ids).size) throw new Error("SUBSTATUS_FORA_ETAPA");
      for (const { subStatusId, ordem: novaOrdem } of ordem) {
        await tx.bpmSubStatus.update({ where: { id: subStatusId }, data: { ordem: novaOrdem } });
      }
      await registrarAuditoriaPipeline(tx, {
        pipelineId: etapa.pipelineId,
        adminId: userId,
        campoAlterado: "substatus_reordenados",
        valorNovoJson: JSON.stringify({ etapaId, ordem }),
      });
      await avancarConfigVersionBpm(tx, etapa.pipelineId);
      return etapa.pipelineId;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    await notificarSubStatusConfirmado(pipelineId);
    return { success: true };
  } catch (error) {
    console.error("[ReordenarSubStatusBpm]", error);
    const msg = error instanceof Error && error.message === "ETAPA_NAO_ENCONTRADA"
      ? "Etapa não encontrada"
      : error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao reordenar substatus";
    return { success: false, error: msg };
  }
}
