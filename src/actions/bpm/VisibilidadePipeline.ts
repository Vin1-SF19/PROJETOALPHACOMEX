"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const schema = z.object({ pipelineId: z.string().cuid(), setorIds: z.array(z.number().int().positive()).max(100), versao: z.number().int().nonnegative() });

export async function LerVisibilidadePipelineBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");
    if (!z.string().cuid().safeParse(pipelineId).success) return { success: false as const, error: "Pipeline inválido" };
    const [pipeline, setores] = await Promise.all([
      db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { configVersion: true, setores: { select: { setorId: true } } } }),
      db.setor.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    ]);
    if (!pipeline) return { success: false as const, error: "Pipeline não encontrado" };
    return { success: true as const, data: { setores, setorIds: pipeline.setores.map((s) => s.setorId), versao: pipeline.configVersion } };
  } catch { return { success: false as const, error: "Não foi possível carregar a visibilidade do pipeline." }; }
}

export async function SalvarVisibilidadePipelineBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: "Configuração inválida" };
    const { pipelineId, versao } = parsed.data;
    const setorIds = [...new Set(parsed.data.setorIds)];
    const permitidos = await db.setor.count({ where: { id: { in: setorIds } } });
    if (permitidos !== setorIds.length) return { success: false as const, error: "Um dos setores não está disponível. Recarregue a configuração." };
    await db.$transaction(async (tx) => {
      const anterior = await tx.bpmPipelineSetor.findMany({ where: { pipelineId }, select: { setorId: true } });
      const updated = await tx.bpmPipeline.updateMany({ where: { id: pipelineId, configVersion: versao }, data: { configVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new Error("CONFLITO");
      await tx.bpmPipelineSetor.deleteMany({ where: { pipelineId } });
      if (setorIds.length) await tx.bpmPipelineSetor.createMany({ data: setorIds.map((setorId) => ({ pipelineId, setorId })) });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId, adminId: userId, campoAlterado: "visibilidade_pipeline", valorAnteriorJson: JSON.stringify(anterior.map((s) => s.setorId)), valorNovoJson: JSON.stringify(setorIds) } });
    });
    revalidatePath("/PainelAlpha/AlphaCRM", "layout");
    try { await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" }); } catch { /* O polling também revalida permissões. A gravação já foi confirmada. */ }
    return { success: true as const, versao: versao + 1 };
  } catch (error) {
    return { success: false as const, error: error instanceof Error && error.message === "CONFLITO" ? "A configuração mudou. Recarregue antes de publicar." : "Não foi possível salvar a visibilidade do pipeline." };
  }
}
