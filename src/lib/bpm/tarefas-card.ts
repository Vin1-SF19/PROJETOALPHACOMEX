/** Tarefas geradas pelo procedimento são um reflexo técnico dele, não tarefas independentes. */
export function separarTarefasCard<T extends { cardChecklistId: string | null; tipo: string }>(tarefas: readonly T[]) {
  return {
    tarefas: tarefas.filter((tarefa) => !tarefa.cardChecklistId && tarefa.tipo !== "CHECKLIST"),
    procedimentos: tarefas.filter((tarefa) => Boolean(tarefa.cardChecklistId) || tarefa.tipo === "CHECKLIST"),
  };
}
