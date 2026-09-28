"use server";

import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { etapaEhStandbyFollowUp } from "@/lib/bpm/novos-leads";
import { calcularProximaRecorrencia } from "@/lib/bpm/automacoes/agenda";
import { gatilhoConfigSchema } from "@/lib/bpm/automacoes/central-schemas";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { interromperStandbyFollowUpSchema } from "@/lib/validations/bpm";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type HistoricoEntrada = {
  createdAt: Date;
  valorNovoJson: string | null;
};

function resolverEntradaAtualEmStandby(
  etapaId: string,
  createdAt: Date,
  historicos: HistoricoEntrada[],
): Date {
  for (const historico of historicos) {
    if (!historico.valorNovoJson) continue;
    try {
      const valor = JSON.parse(historico.valorNovoJson) as { etapaId?: unknown };
      if (valor.etapaId === etapaId) return historico.createdAt;
    } catch {
      // Históricos antigos corrompidos não impedem o card de ser operado.
    }
  }
  return createdAt;
}

export async function ObterEstadoStandbyFollowUpBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "visualizar");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        pipelineId: true,
        etapaId: true,
        createdAt: true,
        standbyFollowUpUltimoEm: true,
        standbyFollowUpInterrompidoEm: true,
        etapa: { select: { nome: true } },
      },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (!etapaEhStandbyFollowUp(card.etapa.nome)) {
      return { success: false, error: "O card não está em Standby - Follow Up" };
    }
    const historicos = await db.bpmCardHistorico.findMany({
      where: { cardId, acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO"] } },
      select: { createdAt: true, valorNovoJson: true },
      orderBy: { createdAt: "desc" },
    });
    const entradaEmStandby = resolverEntradaAtualEmStandby(card.etapaId, card.createdAt, historicos);
    const automacao = await db.bpmAutomacao.findUnique({
      where: { pipelineId_chave: { pipelineId: card.pipelineId, chave: "standby_follow_up_semanal" } },
      include: { versoes: { where: { status: "ATIVA" }, take: 1 } },
    });
    const versao = automacao?.ativa ? automacao.versoes[0] : null;
    const configuracao = versao ? gatilhoConfigSchema.parse(JSON.parse(versao.gatilhoConfigJson)) : null;
    const agenda = versao ? await db.bpmAutomacaoAgenda.findFirst({
      where: { cardId, automacaoVersaoId: versao.id, ativo: true, tipo: "RECORRENTE" },
      select: { proximaExecucaoEm: true },
    }) : null;
    const intervaloDias = configuracao?.recorrencia?.tipo === "INTERVALO_DIAS" ? configuracao.recorrencia.intervaloDias ?? null : null;
    const campoMotivo = await db.bpmCampo.findUnique({ where: { chave: "alpha.radar.standby.motivo_interrupcao" }, select: { nome: true } });
    const campoStatus = await db.bpmCampo.findUnique({ where: { chave: "alpha.radar.standby.status_follow_up" }, select: { opcoes: { where: { ativo: true }, select: { chave: true, rotulo: true } } } });
    return {
      success: true,
      data: {
        ativo: card.standbyFollowUpInterrompidoEm === null,
        entradaEmStandby,
        ultimoFollowUpEm: card.standbyFollowUpUltimoEm,
        interrompidoEm: card.standbyFollowUpInterrompidoEm,
        intervaloDias,
        rotuloMotivo: campoMotivo?.nome ?? "Motivo da interrupção",
        rotuloAtivo: campoStatus?.opcoes.find((opcao) => opcao.chave === "ativo")?.rotulo ?? "Ativo",
        rotuloInterrompido: campoStatus?.opcoes.find((opcao) => opcao.chave === "interrompido")?.rotulo ?? "Interrompido",
        proximoFollowUpEm: card.standbyFollowUpInterrompidoEm
          ? null
          : agenda?.proximaExecucaoEm ?? (configuracao?.recorrencia ? calcularProximaRecorrencia(configuracao.recorrencia, card.standbyFollowUpUltimoEm && card.standbyFollowUpUltimoEm > entradaEmStandby ? card.standbyFollowUpUltimoEm : entradaEmStandby, versao?.timezone) : null),
      },
    };
  } catch (error) {
    console.error("[ObterEstadoStandbyFollowUpBpm]", error);
    return {
      success: false,
      error: error instanceof Error && error.message === "Não autorizado"
        ? "Não autorizado"
        : "Erro ao consultar o follow-up",
    };
  }
}

/**
 * NoLoss: quando o lead pede para não receber mais follow-ups, a automação é
 * encerrada permanentemente. Não existe retomada automática ou por este fluxo.
 */
export async function InterromperStandbyFollowUpBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    const parsed = interromperStandbyFollowUpSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, motivo } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const resultado = await db.$transaction(async (tx) => {
      const card = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          pipelineId: true,
          etapaId: true,
          status: true,
          updatedAt: true,
          standbyFollowUpInterrompidoEm: true,
          etapa: { select: { nome: true } },
        },
      });
      if (!card) throw new Error("STANDBY_NEGOCIO:Card não encontrado.");
      if (!etapaEhStandbyFollowUp(card.etapa.nome)) {
        throw new Error("STANDBY_NEGOCIO:O follow-up só pode ser interrompido em Stand By.");
      }
      if (card.status !== "ATIVO") {
        throw new Error("STANDBY_NEGOCIO:O follow-up só pode ser interrompido em um card ativo.");
      }
      if (card.standbyFollowUpInterrompidoEm) {
        throw new Error("STANDBY_NEGOCIO:O follow-up deste card já foi interrompido permanentemente.");
      }

      // Revalida o ownership dentro da transação: permissões podem mudar entre
      // o precheck e a persistência.
      await exigirAcessoBpmCard(
        cardId,
        userId,
        session.user.role ?? null,
        "editarCard",
        tx,
      );

      const interrompidoEm = new Date();
      const atualizacao = await tx.bpmCard.updateMany({
        where: {
          id: cardId,
          etapaId: card.etapaId,
          status: "ATIVO",
          updatedAt: card.updatedAt,
          standbyFollowUpInterrompidoEm: null,
        },
        data: { standbyFollowUpInterrompidoEm: interrompidoEm },
      });
      if (atualizacao.count !== 1) throw new Error("STANDBY_CONFLITO");

      const camposOperacionais = await tx.bpmCampo.findMany({
        where: { pipelineId: card.pipelineId, chave: { in: ["alpha.radar.standby.status_follow_up", "alpha.radar.standby.motivo_interrupcao"] }, ativo: true },
        select: { id: true, chave: true, opcoes: { where: { ativo: true }, select: { chave: true, rotulo: true } } },
      });
      for (const campo of camposOperacionais) {
        const valor = campo.chave === "alpha.radar.standby.status_follow_up"
          ? (campo.opcoes.find((opcao) => opcao.chave === "interrompido")?.rotulo ?? "Interrompido")
          : motivo;
        await tx.bpmCardCampoValor.upsert({ where: { cardId_campoId: { cardId, campoId: campo.id } }, create: { cardId, campoId: campo.id, valor }, update: { valor } });
      }

      const agendas = await tx.bpmAutomacaoAgenda.updateMany({
        where: { cardId, ativo: true, tipo: "RECORRENTE", automacaoVersao: { automacao: { etapaId: card.etapaId } } },
        data: { ativo: false },
      });
      const registrosTarefas = await tx.bpmCardHistorico.findMany({
        where: { cardId, acao: "STANDBY_FOLLOW_UP_TAREFA_CRIADA" },
        select: { valorNovoJson: true },
      });
      const tarefasIds = registrosTarefas.flatMap((registro) => {
        try {
          const valor = JSON.parse(registro.valorNovoJson ?? "{}") as { tarefaId?: unknown };
          return typeof valor.tarefaId === "string" ? [valor.tarefaId] : [];
        } catch { return []; }
      });
      const tarefasPendentes = tarefasIds.length
        ? await tx.bpmTarefa.findMany({ where: { id: { in: tarefasIds }, cardId, status: "PENDENTE" }, select: { id: true, titulo: true } })
        : [];
      let tarefasCanceladas = 0;
      for (const tarefa of tarefasPendentes) {
        const cancelada = await tx.bpmTarefa.updateMany({ where: { id: tarefa.id, cardId, status: "PENDENTE" }, data: { status: "CANCELADA" } });
        if (cancelada.count !== 1) continue;
        tarefasCanceladas++;
        await tx.bpmCardHistorico.create({ data: {
          cardId, acao: "STANDBY_FOLLOW_UP_TAREFA_CANCELADA", usuarioId: userId,
          valorNovoJson: JSON.stringify({ tarefaId: tarefa.id, titulo: tarefa.titulo, motivo, canceladaEm: interrompidoEm.toISOString() }),
        } });
      }

      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "STANDBY_FOLLOW_UP_INTERROMPIDO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ motivo, interrompidoEm: interrompidoEm.toISOString(), agendasCanceladas: agendas.count, tarefasPendentesCanceladas: tarefasCanceladas }),
        },
      });
      return { pipelineId: card.pipelineId };
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/pipeline/${resultado.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/card/${cardId}`);
    await notificarPipelineBpm({
      pipelineId: resultado.pipelineId,
      cardId,
      tipo: "CARD_ATUALIZADO",
    });
    return { success: true };
  } catch (error) {
    console.error("[InterromperStandbyFollowUpBpm]", error);
    const mensagem = error instanceof Error ? error.message : "";
    const erro = mensagem === "Não autorizado"
      ? "Não autorizado"
      : mensagem === "STANDBY_CONFLITO"
        ? "O card mudou enquanto era atualizado. Recarregue e tente novamente."
        : mensagem.startsWith("STANDBY_NEGOCIO:")
          ? mensagem.slice("STANDBY_NEGOCIO:".length)
          : "Erro ao interromper o follow-up";
    return { success: false, error: erro };
  }
}
