import type { EventoExibicao, TarefaAgendaExibicao } from "./tipos";

/** Converte tarefas Google em itens da grade; horários de chamados ficam no cache local. */
export function tarefasParaItensAgenda(tarefas: TarefaAgendaExibicao[]): EventoExibicao[] {
  return tarefas.flatMap((tarefa): EventoExibicao[] => {
    const possuiHorarioAgendado = Boolean(tarefa.inicioAgendadoEm && tarefa.fimPlanejadoAgendadoEm);
    const possuiHorarioLocal = Boolean(tarefa.inicioLocalEm && tarefa.fimLocalEm);
    if (!possuiHorarioAgendado && !possuiHorarioLocal && !tarefa.vencimentoEm)
      return [];

    if (possuiHorarioAgendado) {
      return [{
        id: `tarefa-${tarefa.id}`,
        googleEventId: `tarefa-${tarefa.id}`,
        status: tarefa.status,
        titulo: tarefa.titulo,
        inicioEm: tarefa.inicioAgendadoEm ?? null,
        fimEm: tarefa.fimConcluidoAgendadoEm ?? tarefa.fimPlanejadoAgendadoEm ?? null,
        diaInteiro: false,
        etag: "",
        linkMeet: null,
        eventType: "task",
        tipo: "tarefa" as const,
        tarefaCacheId: tarefa.id,
        tarefaNotas: tarefa.notas,
        calendarioId: "tarefas-google",
        calendarioGoogleId: tarefa.taskListGoogleId,
        calendarioNome: tarefa.listaTitulo,
        calendarioCorHex: tarefa.statusAgendamento === "CONCLUIDO" ? "#22c55e" : "#3b82f6",
        calendarioGravavel: true,
      }];
    }

    if (possuiHorarioLocal) {
      return [{
        id: `tarefa-${tarefa.id}`,
        googleEventId: `tarefa-${tarefa.id}`,
        status: tarefa.status,
        titulo: tarefa.titulo,
        inicioEm: tarefa.inicioLocalEm ?? null,
        fimEm: tarefa.fimLocalEm ?? null,
        diaInteiro: false,
        etag: "",
        linkMeet: null,
        eventType: "task",
        tipo: "tarefa" as const,
        tarefaCacheId: tarefa.id,
        tarefaNotas: tarefa.notas,
        calendarioId: "tarefas-google",
        calendarioGoogleId: tarefa.taskListGoogleId,
        calendarioNome: tarefa.listaTitulo,
        calendarioCorHex: tarefa.status === "completed" ? "#22c55e" : null,
        calendarioGravavel: true,
      }];
    }

    if (!tarefa.vencimentoEm) return [];
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
      status: tarefa.status,
      titulo: tarefa.titulo,
      inicioEm: meioDiaUtc.toISOString(),
      fimEm: meioDiaUtc.toISOString(),
      diaInteiro: true,
      etag: "",
      linkMeet: null,
      eventType: "task",
      tipo: "tarefa" as const,
      tarefaCacheId: tarefa.id,
      tarefaNotas: tarefa.notas,
      calendarioId: "tarefas-google",
      calendarioGoogleId: tarefa.taskListGoogleId,
      calendarioNome: tarefa.listaTitulo,
      calendarioCorHex: null,
      calendarioGravavel: true,
    }];
  });
}
