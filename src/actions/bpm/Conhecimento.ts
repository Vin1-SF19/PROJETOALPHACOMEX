"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  MAX_SCRIPT_ETAPA_PERSISTIDO,
  scriptEtapaPersistidoValido,
} from "@/lib/bpm/script-etapa";
import db from "@/lib/prisma";

const salvarScriptSchema = z.object({
  pipelineId: z.string().cuid(),
  etapaId: z.string().cuid(),
  script: z
    .string()
    .max(MAX_SCRIPT_ETAPA_PERSISTIDO)
    .nullable()
    .refine(scriptEtapaPersistidoValido, "Conteúdo do script inválido"),
});

async function exigirAdministradorConfiguracao() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarEtapas");
  return userId;
}

function erroPublico(error: unknown): string {
  if (error instanceof z.ZodError) return "Revise o conteúdo informado.";
  if (
    error instanceof Error
    && [
      "Não autorizado",
      "Não autorizado — apenas administradores configuram pipelines",
      "Etapa não encontrada neste pipeline",
    ].includes(error.message)
  ) {
    return error.message;
  }
  return "Não foi possível salvar o script";
}

export async function SalvarScriptEtapaBpm(payload: unknown) {
  try {
    const userId = await exigirAdministradorConfiguracao();
    const dados = salvarScriptSchema.parse(payload);
    const etapaAnterior = await db.bpmEtapa.findUnique({
      where: { id: dados.etapaId },
      select: { id: true, pipelineId: true, script: true },
    });
    if (!etapaAnterior || etapaAnterior.pipelineId !== dados.pipelineId) {
      throw new Error("Etapa não encontrada neste pipeline");
    }

    await db.$transaction(async (tx) => {
      await tx.bpmEtapa.update({
        where: { id: dados.etapaId },
        data: { script: dados.script },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: dados.pipelineId,
          adminId: userId,
          campoAlterado: "script_etapa_atualizado",
          valorAnteriorJson: JSON.stringify({ etapaId: dados.etapaId, script: etapaAnterior.script }),
          valorNovoJson: JSON.stringify({ etapaId: dados.etapaId, script: dados.script }),
        },
      });
    });

    revalidatePath("/PainelAlpha/AlphaCRM/admin/conhecimento");
    revalidatePath(`/PainelAlpha/AlphaCRM/pipeline/${dados.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: dados.pipelineId, tipo: "ETAPA_ALTERADA" });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}
