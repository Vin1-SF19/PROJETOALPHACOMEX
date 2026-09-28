import db from "@/lib/prisma";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { pusherServer } from "@/lib/pusher-server.ts";
import { CALENDARIO_ALPHA_COMPROMISSO_EVENT, canalCalendarioAlphaDoUsuario } from "@/lib/google-calendar/notificacoes";
import { TIPO_TAREFA_PROXIMO_CONTATO } from "@/lib/bpm/proximo-contato-agenda";

export async function executarAlertasTarefasBpm(agora = new Date(), somenteProximoContatoCrm = false) {
  const candidatas = await db.bpmTarefa.findMany({
    where: {
      ...(somenteProximoContatoCrm ? { tipo: TIPO_TAREFA_PROXIMO_CONTATO } : {}),
      status: "PENDENTE",
      alertaEm: { lte: agora },
      alertaDisparadoEm: null,
    },
    select: { id: true, cardId: true, tipo: true, titulo: true, prazo: true, alertaEm: true, responsavelId: true, card: { select: { pipelineId: true } } },
    take: 100,
    orderBy: { alertaEm: "asc" },
  });

  let disparados = 0;
  for (const tarefa of candidatas) {
    const marcacao = await db.bpmTarefa.updateMany({
        where: {
          id: tarefa.id, status: "PENDENTE", alertaEm: tarefa.alertaEm,
          prazo: tarefa.prazo, responsavelId: tarefa.responsavelId,
          alertaDisparadoEm: null,
        },
        data: { alertaDisparadoEm: agora },
    });
    if (marcacao.count !== 1) continue;
    if (tarefa.tipo === TIPO_TAREFA_PROXIMO_CONTATO && tarefa.responsavelId && tarefa.prazo) {
      try {
        await pusherServer.trigger(
          canalCalendarioAlphaDoUsuario(tarefa.responsavelId),
          CALENDARIO_ALPHA_COMPROMISSO_EVENT,
          {
            id: tarefa.id, googleEventId: tarefa.id, titulo: tarefa.titulo,
            inicioEm: tarefa.prazo.toISOString(), janela: "10min",
            calendarioNome: "CRM · Próximo contato", calendarioCorHex: "#06b6d4",
            createdAt: agora.toISOString(),
          },
        );
      } catch (error) {
        console.error("[AlertasTarefasBpm/notificacao-agenda]", error);
        await db.bpmTarefa.updateMany({
          where: { id: tarefa.id, alertaDisparadoEm: agora, prazo: tarefa.prazo, responsavelId: tarefa.responsavelId },
          data: { alertaDisparadoEm: null },
        });
        continue;
      }
    }
    disparados += 1;
    try {
      await registrarHistoricoCard({
        cardId: tarefa.cardId,
        acao: "TAREFA_ALERTA_DISPARADO",
        automacaoOrigem: "BPM_ALERTA_TAREFA",
        valorNovoJson: JSON.stringify({ tarefaId: tarefa.id }),
      });
    } catch (error) {
      console.error("[AlertasTarefasBpm/historico]", error);
    }
    try {
      await notificarPipelineBpm({ pipelineId: tarefa.card.pipelineId, cardId: tarefa.cardId, tipo: "TAREFA_ALTERADA" });
    } catch (error) {
      console.error("[AlertasTarefasBpm/realtime-pipeline]", error);
    }
  }

  return { examinadas: candidatas.length, disparados };
}
