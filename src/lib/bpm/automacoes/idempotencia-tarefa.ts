import { createHash } from "node:crypto";

/** ID estável para tarefas que devem existir uma única vez por card e tipo. */
export function idTarefaUnicaPorTipo(cardId: string, tipo: string): string {
  const resumo = createHash("sha256").update(JSON.stringify(["bpm-tarefa-unica", cardId, tipo])).digest("hex");
  return `c${resumo.slice(0, 24)}`;
}
