import db from "@/lib/prisma";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

export async function executarAlertasTarefasBpm(agora = new Date()) {
  const candidatas = await db.bpmTarefa.findMany({
    where: {
      status: "PENDENTE",
      alertaEm: { lte: agora },
      alertaDisparadoEm: null,
    },
    select: { id: true, cardId: true, card: { select: { pipelineId: true } } },
    take: 100,
    orderBy: { alertaEm: "asc" },
  });

  let disparados = 0;
  for (const tarefa of candidatas) {
    const atualizado = await db.$transaction(async (tx) => {
      const marcacao = await tx.bpmTarefa.updateMany({
        where: { id: tarefa.id, status: "PENDENTE", alertaEm: { lte: agora }, alertaDisparadoEm: null },
        data: { alertaDisparadoEm: agora },
      });
      if (marcacao.count !== 1) return false;
      await registrarHistoricoCard({
        cardId: tarefa.cardId,
        acao: "TAREFA_ALERTA_DISPARADO",
        automacaoOrigem: "BPM_ALERTA_TAREFA",
        valorNovoJson: JSON.stringify({ tarefaId: tarefa.id }),
      }, tx);
      return true;
    });
    if (!atualizado) continue;
    disparados += 1;
    await notificarPipelineBpm({ pipelineId: tarefa.card.pipelineId, cardId: tarefa.cardId, tipo: "TAREFA_ALTERADA" });
  }

  return { examinadas: candidatas.length, disparados };
}
