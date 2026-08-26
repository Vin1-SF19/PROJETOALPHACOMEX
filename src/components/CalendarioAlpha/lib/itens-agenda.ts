import type { EventoExibicao, TarefaAgendaExibicao } from "./tipos";

/** Converte tarefas pendentes com vencimento em itens de dia inteiro da grade. */
export function tarefasParaItensAgenda(tarefas: TarefaAgendaExibicao[]): EventoExibicao[] {
  return tarefas.flatMap((tarefa) => {
    if (tarefa.status === "completed" || !tarefa.vencimentoEm) return [];
    const vencimento = new Date(tarefa.vencimentoEm);
    const meioDiaUtc = new Date(Date.UTC(
      vencimento.getUTCFullYear(),
      vencimento.getUTCMonth(),
      vencimento.getUTCDate(),
      12,
    ));
    return [{
      id: `tarefa-${tarefa.id}`,
      googleEventId: `tarefa-${tarefa.id}`,
      status: "needsAction",
      titulo: tarefa.titulo,
      inicioEm: meioDiaUtc.toISOString(),
      fimEm: meioDiaUtc.toISOString(),
      diaInteiro: true,
      etag: "",
      linkMeet: null,
      eventType: "task",
      tipo: "tarefa" as const,
      tarefaCacheId: tarefa.id,
      calendarioId: "tarefas-google",
      calendarioGoogleId: tarefa.taskListGoogleId,
      calendarioNome: tarefa.listaTitulo,
      calendarioCorHex: null,
      calendarioGravavel: true,
    }];
  });
}
