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

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

async function carregarEtapaComPipeline(etapaId: string) {
  return db.bpmEtapa.findUnique({ where: { id: etapaId }, select: { pipelineId: true } });
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

    const etapa = await carregarEtapaComPipeline(etapaId);
    if (!etapa) return { success: false, error: "Etapa não encontrada" };

    const subStatus = await db.$transaction(async (tx) => {
      const criado = await tx.bpmSubStatus.create({ data: { etapaId, nome, cor, ordem } });
      await registrarAuditoriaPipeline({
        pipelineId: etapa.pipelineId,
        adminId: userId,
        campoAlterado: "substatus_criado",
        valorNovoJson: JSON.stringify({ etapaId, nome, cor, ordem }),
      });
      return criado;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${etapa.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: etapa.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: subStatus };
  } catch (error) {
    console.error("[CriarSubStatusBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao criar substatus";
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

    const anterior = await db.bpmSubStatus.findUnique({ where: { id: subStatusId } });
    if (!anterior) return { success: false, error: "Substatus não encontrado" };
    const etapa = await carregarEtapaComPipeline(anterior.etapaId);
    if (!etapa) return { success: false, error: "Etapa não encontrada" };

    const subStatus = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmSubStatus.update({ where: { id: subStatusId }, data: campos });
      await registrarAuditoriaPipeline({
        pipelineId: etapa.pipelineId,
        adminId: userId,
        campoAlterado: "substatus_atualizado",
        valorAnteriorJson: JSON.stringify(anterior),
        valorNovoJson: JSON.stringify(campos),
      });
      return atualizado;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${etapa.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: etapa.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true, data: subStatus };
  } catch (error) {
    console.error("[AtualizarSubStatusBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar substatus";
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
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");

    const parsed = reordenarSubStatusSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { etapaId, ordem } = parsed.data;

    const etapa = await carregarEtapaComPipeline(etapaId);
    if (!etapa) return { success: false, error: "Etapa não encontrada" };

    await db.$transaction(
      ordem.map(({ subStatusId, ordem: novaOrdem }) =>
        db.bpmSubStatus.update({ where: { id: subStatusId }, data: { ordem: novaOrdem } }),
      ),
    );

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${etapa.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: etapa.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[ReordenarSubStatusBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao reordenar substatus";
    return { success: false, error: msg };
  }
}
