import { createHash } from "node:crypto";

/** ID estável para tarefas que devem existir uma única vez por card e tipo. */
export function idTarefaUnicaPorTipo(cardId: string, tipo: string): string {
  const resumo = createHash("sha256").update(JSON.stringify(["bpm-tarefa-unica", cardId, tipo])).digest("hex");
  return `c${resumo.slice(0, 24)}`;
}

/** ID único por dia civil de São Paulo; a PK fecha corridas entre execuções. */
export function idTarefaDiariaPorTipo(cardId: string, tipo: string, agora: Date): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return idTarefaUnicaPorTipo(cardId, `${tipo}:${dia}`);
}
