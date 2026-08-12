"use server";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { salvarChecklistFollowUpSchema } from "@/lib/validations/bpm";
import {
  etapaEhEmTratativa,
  lerRespostasFollowUp,
  lerSnapshotPerguntasFollowUp,
  montarSnapshotPerguntasFollowUp,
  validarRespostasFollowUp,
  type RespostasFollowUp,
} from "@/lib/bpm/em-tratativa";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type ChecklistPersistido = {
  id: string;
  perguntasJson: string;
  respostasJson: string;
  completo: boolean;
  criadoEm: Date;
};

function serializarChecklist(checklist: ChecklistPersistido | null) {
  if (!checklist) {
    return { estado: "NAO_INICIADO" as const, checklist: null };
  }
  return {
    estado: checklist.completo ? "CONCLUIDO" as const : "EM_ANDAMENTO" as const,
    checklist: {
      id: checklist.id,
      perguntas: lerSnapshotPerguntasFollowUp(checklist.perguntasJson),
      respostas: lerRespostasFollowUp(checklist.respostasJson),
      completo: checklist.completo,
      criadoEm: checklist.criadoEm,
    },
  };
}

async function carregarUltimoChecklist(
  cardId: string,
  client: Pick<typeof db, "bpmChecklistFollowUp"> = db,
) {
  return client.bpmChecklistFollowUp.findFirst({
    where: { cardId },
    select: {
      id: true,
      perguntasJson: true,
      respostasJson: true,
      completo: true,
      criadoEm: true,
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
  });
}

export async function ObterUltimoFollowUpBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    await exigirAcessoBpmCard(
      cardId,
      Number(session.user.id),
      session.user.role ?? null,
      "visualizar",
    );
    const checklist = await carregarUltimoChecklist(cardId);
    return { success: true, data: serializarChecklist(checklist) };
  } catch (error) {
    console.error("[ObterUltimoFollowUpBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : "Erro ao buscar o último follow-up";
    return { success: false, error: msg };
  }
}

export async function SalvarChecklistFollowUpBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    const parsed = salvarChecklistFollowUpSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, checklistId, respostas, concluir } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    const resultado = await db.$transaction(async (tx) => {
      const card = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          pipelineId: true,
          etapaId: true,
          updatedAt: true,
          etapa: { select: { nome: true } },
        },
      });
      if (!card) throw new Error("FOLLOW_UP_NEGOCIO:Card não encontrado.");
      if (!etapaEhEmTratativa(card.etapa.nome)) {
        throw new Error(
          "FOLLOW_UP_NEGOCIO:O checklist de follow-up só pode ser operado em Em Tratativa.",
        );
      }

      const trava = await tx.bpmCard.updateMany({
        where: { id: cardId, etapaId: card.etapaId, updatedAt: card.updatedAt },
        data: { updatedAt: new Date() },
      });
      if (trava.count !== 1) throw new Error("FOLLOW_UP_CONFLITO");

      const ultimo = await carregarUltimoChecklist(cardId, tx);
      if (checklistId && ultimo?.id !== checklistId) {
        throw new Error(
          "FOLLOW_UP_NEGOCIO:Este checklist não é mais o último follow-up do card. Recarregue os dados.",
        );
      }
      if (checklistId && ultimo?.completo) {
        throw new Error(
          "FOLLOW_UP_NEGOCIO:Este follow-up já foi concluído e não pode mais ser alterado.",
        );
      }

      const existente = checklistId
        ? ultimo
        : ultimo && !ultimo.completo
          ? ultimo
          : null;
      let perguntas;
      let respostasAnteriores: RespostasFollowUp = {};
      try {
        if (existente) {
          perguntas = lerSnapshotPerguntasFollowUp(existente.perguntasJson);
          respostasAnteriores = lerRespostasFollowUp(existente.respostasJson);
        } else {
          const configuradas = await tx.bpmChecklistFollowUpPergunta.findMany({
            where: { pipelineId: card.pipelineId, ativo: true },
            select: {
              id: true,
              pergunta: true,
              tipo: true,
              opcoesJson: true,
              obrigatoria: true,
              ordem: true,
            },
            orderBy: [{ ordem: "asc" }, { id: "asc" }],
          });
          perguntas = montarSnapshotPerguntasFollowUp(configuradas);
        }
      } catch {
        throw new Error("FOLLOW_UP_DADOS_INVALIDOS");
      }

      let validacao;
      try {
        validacao = validarRespostasFollowUp(
          perguntas,
          { ...respostasAnteriores, ...respostas },
        );
      } catch {
        throw new Error("FOLLOW_UP_DADOS_INVALIDOS");
      }
      if (concluir && validacao.pendencias.length > 0) {
        throw new Error(
          `FOLLOW_UP_NEGOCIO:Conclua os itens obrigatórios: ${validacao.pendencias.join(", ")}.`,
        );
      }
      const completo = concluir && validacao.pendencias.length === 0;

      if (existente) {
        const atualizacao = await tx.bpmChecklistFollowUp.updateMany({
          where: { id: existente.id, cardId, completo: false },
          data: {
            respostasJson: JSON.stringify(validacao.respostas),
            completo,
          },
        });
        if (atualizacao.count !== 1) throw new Error("FOLLOW_UP_CONFLITO");
        const atualizado = await tx.bpmChecklistFollowUp.findUnique({
          where: { id: existente.id },
          select: {
            id: true,
            perguntasJson: true,
            respostasJson: true,
            completo: true,
            criadoEm: true,
          },
        });
        if (!atualizado) throw new Error("FOLLOW_UP_CONFLITO");
        await tx.bpmCardHistorico.create({
          data: {
            cardId,
            acao: completo ? "FOLLOW_UP_CONCLUIDO" : "FOLLOW_UP_ATUALIZADO",
            usuarioId: userId,
            valorNovoJson: JSON.stringify({ checklistId: atualizado.id, completo }),
          },
        });
        return { checklist: atualizado, pendencias: validacao.pendencias, pipelineId: card.pipelineId };
      }

      await tx.bpmInteracaoCard.create({
        data: {
          cardId,
          tipo: "FOLLOW_UP",
          observacoes: typeof validacao.respostas["anotacoes-ultimo-follow-up"] === "string"
            ? validacao.respostas["anotacoes-ultimo-follow-up"]
            : undefined,
          registradoPorId: userId,
        },
      });
      const criado = await tx.bpmChecklistFollowUp.create({
        data: {
          cardId,
          perguntasJson: JSON.stringify(perguntas),
          respostasJson: JSON.stringify(validacao.respostas),
          completo,
          criadoPorId: userId,
        },
        select: {
          id: true,
          perguntasJson: true,
          respostasJson: true,
          completo: true,
          criadoEm: true,
        },
      });
      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: completo ? "FOLLOW_UP_CRIADO_E_CONCLUIDO" : "FOLLOW_UP_INICIADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ checklistId: criado.id, completo }),
        },
      });
      return { checklist: criado, pendencias: validacao.pendencias, pipelineId: card.pipelineId };
    });

    revalidatePath(`${ROTA_BASE}/card/${cardId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${resultado.pipelineId}`);
    await notificarPipelineBpm({
      pipelineId: resultado.pipelineId,
      cardId,
      tipo: "CARD_ATUALIZADO",
    });
    return {
      success: true,
      data: {
        ...serializarChecklist(resultado.checklist),
        pendencias: resultado.pendencias,
      },
    };
  } catch (error) {
    console.error("[SalvarChecklistFollowUpBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "FOLLOW_UP_CONFLITO"
        ? "O follow-up mudou enquanto era editado. Recarregue e tente novamente."
        : error instanceof Error && error.message.startsWith("FOLLOW_UP_NEGOCIO:")
          ? error.message.slice("FOLLOW_UP_NEGOCIO:".length)
          : error instanceof Error && error.message === "FOLLOW_UP_DADOS_INVALIDOS"
            ? "Os dados do checklist são inválidos. Recarregue e tente novamente."
            : "Erro ao salvar o checklist de follow-up";
    return { success: false, error: msg };
  }
}
