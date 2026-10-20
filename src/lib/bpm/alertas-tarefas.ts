import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { pusherServer } from "@/lib/pusher-server.ts";
import { CALENDARIO_ALPHA_COMPROMISSO_EVENT, canalCalendarioAlphaDoUsuario } from "@/lib/google-calendar/notificacoes";
import { TIPO_TAREFA_PROXIMO_CONTATO } from "@/lib/bpm/proximo-contato-agenda";
import { BPM_TAREFA_ALERTA_EVENT, canalTarefasBpmDoUsuario } from "@/lib/bpm/notificacoes-tarefas";

export const tarefaAlertaSelect = {
  id: true, cardId: true, tipo: true, titulo: true, prazo: true, alertaEm: true, responsavelId: true,
  card: { select: { pipelineId: true, responsavelId: true } },
} satisfies Prisma.BpmTarefaSelect;
type TarefaAlerta = Prisma.BpmTarefaGetPayload<{ select: typeof tarefaAlertaSelect }>;

/** Único ponto de entrega para o cron legado e a Central de Automações. */
export async function dispararAlertaTarefaBpm(tarefa: TarefaAlerta, agora: Date, automacaoOrigem = "BPM_ALERTA_TAREFA") {
  const usuarioId = tarefa.responsavelId ?? tarefa.card.responsavelId;
  if (!usuarioId || !tarefa.alertaEm || tarefa.alertaEm > agora) return false;
  const marcacao = await db.bpmTarefa.updateMany({
    where: {
      id: tarefa.id, status: "PENDENTE", alertaEm: tarefa.alertaEm,
      prazo: tarefa.prazo, responsavelId: tarefa.responsavelId, alertaDisparadoEm: null,
      card: { status: { not: "ARQUIVADO" }, pipeline: { ativo: true },
        ...(tarefa.responsavelId === null ? { responsavelId: usuarioId } : {}) },
    },
    data: { alertaDisparadoEm: agora },
  });
  if (marcacao.count !== 1) return false;
  try {
    if (tarefa.tipo === TIPO_TAREFA_PROXIMO_CONTATO && tarefa.prazo) {
      await pusherServer.trigger(canalCalendarioAlphaDoUsuario(usuarioId), CALENDARIO_ALPHA_COMPROMISSO_EVENT, {
        id: tarefa.id, googleEventId: tarefa.id, titulo: tarefa.titulo,
        inicioEm: tarefa.prazo.toISOString(), janela: "10min",
        calendarioNome: "CRM · Próximo contato", calendarioCorHex: "#06b6d4", createdAt: agora.toISOString(),
      });
    } else {
      // Apenas invalidação: conteúdo completo vem do GET autenticado, com ACL atualizada.
      await pusherServer.trigger(canalTarefasBpmDoUsuario(usuarioId), BPM_TAREFA_ALERTA_EVENT, { tarefaId: tarefa.id });
    }
  } catch (error) {
    await db.bpmTarefa.updateMany({
      where: { id: tarefa.id, alertaDisparadoEm: agora, alertaEm: tarefa.alertaEm,
        prazo: tarefa.prazo, responsavelId: tarefa.responsavelId },
      data: { alertaDisparadoEm: null },
    });
    throw error;
  }
  try {
    await registrarHistoricoCard({ cardId: tarefa.cardId, acao: "TAREFA_ALERTA_DISPARADO", automacaoOrigem,
      valorNovoJson: JSON.stringify({ tarefaId: tarefa.id }) });
  } catch (error) { console.error("[AlertasTarefasBpm/historico]", error); }
  try {
    await notificarPipelineBpm({ pipelineId: tarefa.card.pipelineId, cardId: tarefa.cardId, tipo: "TAREFA_ALTERADA" });
  } catch (error) { console.error("[AlertasTarefasBpm/realtime-pipeline]", error); }
  return true;
}

export async function executarAlertasTarefasBpm(agora = new Date(), somenteProximoContatoCrm = false) {
  const candidatas = await db.bpmTarefa.findMany({
    where: {
      ...(somenteProximoContatoCrm ? { tipo: TIPO_TAREFA_PROXIMO_CONTATO } : {}),
      status: "PENDENTE", alertaEm: { lte: agora }, alertaDisparadoEm: null,
      card: { status: { not: "ARQUIVADO" }, pipeline: { ativo: true } },
    },
    select: tarefaAlertaSelect, take: 100, orderBy: { alertaEm: "asc" },
  });
  let disparados = 0;
  for (const tarefa of candidatas) {
    try { if (await dispararAlertaTarefaBpm(tarefa, agora)) disparados += 1; }
    catch (error) { console.error("[AlertasTarefasBpm/entrega]", error); }
  }
  return { examinadas: candidatas.length, disparados };
}
