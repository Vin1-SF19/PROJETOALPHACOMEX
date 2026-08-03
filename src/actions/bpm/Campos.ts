"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarCampoSchema, atualizarCampoSchema } from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function CriarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    exigirAcessoConfigPipeline(session.user.role ?? null, "configurarCampos");

    const parsed = criarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, etapaId, nome, tipo, opcoes, obrigatorio, ordem } = parsed.data;

    const campo = await db.$transaction(async (tx) => {
      const criado = await tx.bpmCampo.create({
        data: {
          pipelineId,
          etapaId,
          nome,
          tipo,
          opcoesJson: opcoes ? JSON.stringify(opcoes) : null,
          obrigatorio,
          ordem,
        },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "campo_criado",
          valorNovoJson: JSON.stringify({ nome, tipo, obrigatorio, etapaId }),
        },
      });
      return criado;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    return { success: true, data: campo };
  } catch (error) {
    console.error("[CriarCampoBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao criar campo";
    return { success: false, error: msg };
  }
}

export async function AtualizarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    exigirAcessoConfigPipeline(session.user.role ?? null, "configurarCampos");

    const parsed = atualizarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { campoId, opcoes, ...resto } = parsed.data;

    const campoAnterior = await db.bpmCampo.findUnique({ where: { id: campoId } });
    if (!campoAnterior) return { success: false, error: "Campo não encontrado" };

    const campo = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmCampo.update({
        where: { id: campoId },
        data: { ...resto, opcoesJson: opcoes ? JSON.stringify(opcoes) : undefined },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: campoAnterior.pipelineId,
          adminId: userId,
          campoAlterado: "campo_atualizado",
          valorAnteriorJson: JSON.stringify(campoAnterior),
          valorNovoJson: JSON.stringify(resto),
        },
      });
      return atualizado;
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${campoAnterior.pipelineId}`);
    return { success: true, data: campo };
  } catch (error) {
    console.error("[AtualizarCampoBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar campo";
    return { success: false, error: msg };
  }
}
