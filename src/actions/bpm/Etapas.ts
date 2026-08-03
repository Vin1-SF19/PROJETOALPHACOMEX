"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarEtapaSchema,
  atualizarEtapaSchema,
  reordenarEtapasSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

async function registrarAuditoriaPipeline(params: {
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

    exigirAcessoConfigPipeline(session.user.role ?? null, "configurarEtapas");

    const parsed = criarEtapaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, nome, ordem, slaDias } = parsed.data;

    const etapa = await db.$transaction(async (tx) => {
      const criada = await tx.bpmEtapa.create({ data: { pipelineId, nome, ordem, slaDias } });
      await registrarAuditoriaPipeline({
        pipelineId,
        adminId: userId,
        campoAlterado: "etapa_criada",
        valorNovoJson: JSON.stringify({ nome, ordem, slaDias }),
      });
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
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

    exigirAcessoConfigPipeline(session.user.role ?? null, "configurarEtapas");

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

    exigirAcessoConfigPipeline(session.user.role ?? null, "configurarEtapas");

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
    return { success: true };
  } catch (error) {
    console.error("[ReordenarEtapasBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao reordenar etapas";
    return { success: false, error: msg };
  }
}
