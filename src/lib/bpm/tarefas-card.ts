/** Tarefas geradas pelo procedimento são um reflexo técnico dele, não tarefas independentes. */
export function separarTarefasCard<T extends { cardChecklistId: string | null }>(tarefas: readonly T[]) {
  return {
    tarefas: tarefas.filter((tarefa) => !tarefa.cardChecklistId),
    procedimentos: tarefas.filter((tarefa) => Boolean(tarefa.cardChecklistId)),
  };
}
