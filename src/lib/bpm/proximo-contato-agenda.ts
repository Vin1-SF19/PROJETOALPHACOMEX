import "server-only";

import type { Prisma } from "@prisma/client";
import { etapaEhEmTratativa } from "@/lib/bpm/em-tratativa";

export const TIPO_TAREFA_PROXIMO_CONTATO = "CRM_PROXIMO_CONTATO";

export function idTarefaProximoContato(cardId: string): string {
  return `crm-proximo-contato:${cardId}`;
}

/** Mantém a tarefa de agenda na mesma transação do card. O cron de alertas usa esta tarefa. */
export async function sincronizarProximoContatoAgenda(input: {
  cardId: string;
  etapaNome: string;
  status: string;
  proximoContatoEm: Date | null;
  responsavelId: number;
  empresaNome: string;
}, tx: Prisma.TransactionClient): Promise<void> {
  const id = idTarefaProximoContato(input.cardId);
  const ativa = input.status === "ATIVO" && etapaEhEmTratativa(input.etapaNome) && input.proximoContatoEm !== null;
  if (!ativa) {
    await tx.bpmTarefa.updateMany({
      where: { id, status: "PENDENTE" },
      data: { status: "CONCLUIDA", concluidaEm: new Date() },
    });
    return;
  }

  const prazo = input.proximoContatoEm!;
  const existente = await tx.bpmTarefa.findUnique({ where: { id }, select: { prazo: true, responsavelId: true, status: true } });
  const mudou = !existente || existente.prazo?.getTime() !== prazo.getTime()
    || existente.responsavelId !== input.responsavelId || existente.status !== "PENDENTE";
  if (existente && !mudou) return;
  const titulo = `Próximo contato — ${input.empresaNome}`.slice(0, 255);
  const alertaEm = new Date(prazo.getTime() - 10 * 60_000);
  await tx.bpmTarefa.upsert({
    where: { id },
    create: {
      id, cardId: input.cardId, titulo, descricao: "Follow-up do CRM — Em tratativas.",
      responsavelId: input.responsavelId, prazo, alertaEm,
      tipo: TIPO_TAREFA_PROXIMO_CONTATO, status: "PENDENTE",
    },
    update: {
      titulo, responsavelId: input.responsavelId, prazo, alertaEm,
      status: "PENDENTE", concluidaEm: null, alertaDisparadoEm: null,
    },
  });
}
