"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { promoverNolossLeadSchema } from "@/lib/validations/bpm";
import {
  exigirAcessoBpmPipeline,
  usuarioElegivelResponsavelBpm,
} from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";

async function obterPipelineRevisaoRadar() {
  return db.bpmPipeline.findFirst({
    where: { nome: "Revisão de Radar", ativo: true },
    select: { id: true },
  });
}

export async function PromoverNolossLead(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = promoverNolossLeadSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { nolossLeadId, etapaDestinoId, responsavelId } = parsed.data;

    const pipeline = await obterPipelineRevisaoRadar();
    if (!pipeline) return { success: false, error: "Pipeline Revisão de Radar não encontrado" };

    await exigirAcessoBpmPipeline(pipeline.id, userId);

    const [etapaDestino, usuarioAtual] = await Promise.all([
      db.bpmEtapa.findFirst({
        where: { id: etapaDestinoId, pipelineId: pipeline.id, ativo: true },
        select: {
          id: true,
          visibilidades: {
            select: { perfil: true, podeVer: true, podeAgir: true },
          },
        },
      }),
      db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);
    if (!etapaDestino) return { success: false, error: "Etapa de destino inválida" };
    if (!resolverVisibilidadeEtapa(
      usuarioAtual?.role,
      etapaDestino.visibilidades,
    ).podeAgir) {
      return { success: false, error: "Seu perfil não pode agir na etapa de destino." };
    }

    if (!(await usuarioElegivelResponsavelBpm(pipeline.id, responsavelId))) {
      return { success: false, error: "Responsável inválido para este pipeline." };
    }

    const nolossLead = await db.nolossLead.findUnique({
      where: { id: nolossLeadId },
      select: { id: true, status: true, nome: true, email: true },
    });
    if (!nolossLead || nolossLead.status !== "pending") {
      return { success: false, error: "Lead não encontrado ou já processado" };
    }

    const resultado = await db.$transaction(async (tx) => {
      const [destinoAtual, perfilAtual] = await Promise.all([
        tx.bpmEtapa.findFirst({
          where: { id: etapaDestinoId, pipelineId: pipeline.id, ativo: true },
          select: {
            visibilidades: {
              select: { perfil: true, podeVer: true, podeAgir: true },
            },
          },
        }),
        tx.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
      ]);
      if (!destinoAtual || !resolverVisibilidadeEtapa(
        perfilAtual?.role,
        destinoAtual.visibilidades,
      ).podeAgir) {
        throw new Error("VISIBILIDADE_ETAPA_NEGADA");
      }

      // CAS: garante que nenhuma outra promoção concorrente já consumiu este lead.
      const reservado = await tx.nolossLead.updateMany({
        where: { id: nolossLeadId, status: "pending" },
        data: { status: "promoted" },
      });
      if (reservado.count !== 1) return null;

      const razaoSocial = nolossLead.nome?.trim() || nolossLead.email?.trim() || "Lead sem nome";
      const cliente = await tx.cliente.create({
        data: {
          razaoSocial,
          cnpj: null,
          status: "ATIVO",
        },
        select: { id: true },
      });

      const card = await tx.bpmCard.create({
        data: {
          empresaId: cliente.id,
          pipelineId: pipeline.id,
          etapaId: etapaDestino.id,
          responsavelId,
          status: "ATIVO",
        },
        select: { id: true },
      });

      await tx.nolossLead.update({
        where: { id: nolossLeadId },
        data: {
          promotedClienteId: cliente.id,
          promotedCardId: card.id,
          promotedAt: new Date(),
          promotedByUserId: userId,
        },
      });

      return { cardId: card.id };
    });

    if (!resultado) {
      return { success: false, error: "Lead não encontrado ou já processado" };
    }

    await notificarPipelineBpm({
      pipelineId: pipeline.id,
      cardId: resultado.cardId,
      tipo: "CARD_CRIADO",
    });

    return { success: true, data: resultado };
  } catch (error) {
    console.error("[PromoverNolossLead]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "VISIBILIDADE_ETAPA_NEGADA"
        ? "Seu perfil não pode agir na etapa de destino."
        : "Erro ao promover lead";
    return { success: false, error: msg };
  }
}
