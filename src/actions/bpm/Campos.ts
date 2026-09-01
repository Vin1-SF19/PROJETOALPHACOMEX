"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarCampoSchema, atualizarCampoSchema, excluirCampoSchema } from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function CriarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarCampos");

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
    await notificarPipelineBpm({ pipelineId, tipo: "CAMPO_ALTERADO" });
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

    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = atualizarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { campoId, opcoes, ...resto } = parsed.data;

    const campoAnterior = await db.bpmCampo.findUnique({ where: { id: campoId } });
    if (!campoAnterior) return { success: false, error: "Campo não encontrado" };

    // Se o admin editou o tipo para algo que não usa opções
    // (texto/numero/data/booleano/cpf) e o schema permite nulo em `opcoes`,
    // zera a coluna. `opcoes` undefined (não informado) mantém o valor anterior.
    const opcoesSerializadas =
      opcoes === undefined
        ? undefined
        : opcoes === null || opcoes.length === 0
          ? null
          : JSON.stringify(opcoes);

    const campo = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmCampo.update({
        where: { id: campoId },
        data: { ...resto, opcoesJson: opcoesSerializadas },
      }      );
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
    await notificarPipelineBpm({ pipelineId: campoAnterior.pipelineId, tipo: "CAMPO_ALTERADO" });
    return { success: true, data: campo };
  } catch (error) {
    console.error("[AtualizarCampoBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar campo";
    return { success: false, error: msg };
  }
}

/**
 * D-027: exclusão de campo personalizado.
 * Cascade automático no Prisma limpa `BpmCardCampoValor`, `BpmCampoObrigatorioEtapa`
 * e `BpmCampoOcultoEtapa` (todas com onDelete: Cascade, schema.prisma).
 * Sem cascade: os cards deixariam de exibir esse campo, mas os valores já
 * preenchidos seriam removidos junto — comportamento consistente com exclusão
 * definitiva do campo (não "desativar").
 */
export async function ExcluirCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = excluirCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { campoId } = parsed.data;

    const campoAnterior = await db.bpmCampo.findUnique({ where: { id: campoId } });
    if (!campoAnterior) return { success: false, error: "Campo não encontrado" };

    await db.$transaction(async (tx) => {
      await tx.bpmCampo.delete({ where: { id: campoId } });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: campoAnterior.pipelineId,
          adminId: userId,
          campoAlterado: "campo_excluido",
          valorAnteriorJson: JSON.stringify(campoAnterior),
          valorNovoJson: null,
        },
      });
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${campoAnterior.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: campoAnterior.pipelineId, tipo: "CAMPO_ALTERADO" });
    return { success: true };
  } catch (error) {
    console.error("[ExcluirCampoBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao excluir campo";
    return { success: false, error: msg };
  }
}
