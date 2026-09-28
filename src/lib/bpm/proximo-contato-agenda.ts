import "server-only";

import type { Prisma } from "@prisma/client";
import { etapaEhEmTratativa, etapaEhSemViabilidade } from "@/lib/bpm/em-tratativa";

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
  const emTratativa = etapaEhEmTratativa(input.etapaNome);
  const semViabilidade = etapaEhSemViabilidade(input.etapaNome);
  const ativa = input.proximoContatoEm !== null
    && (emTratativa && input.status === "ATIVO"
      || semViabilidade && ["ATIVO", "CONCLUIDO"].includes(input.status));
  if (!ativa) {
    await tx.bpmTarefa.updateMany({
      where: { id, status: "PENDENTE" },
      data: { status: "CONCLUIDA", concluidaEm: new Date() },
    });
    return;
  }

  const prazo = input.proximoContatoEm!;
  const descricao = semViabilidade ? "Retorno do CRM — Sem viabilidade." : "Follow-up do CRM — Em tratativas.";
  const existente = await tx.bpmTarefa.findUnique({ where: { id }, select: { prazo: true, responsavelId: true, status: true, descricao: true } });
  const mudou = !existente || existente.prazo?.getTime() !== prazo.getTime()
    || existente.responsavelId !== input.responsavelId || existente.status !== "PENDENTE"
    || existente.descricao !== descricao;
  if (existente && !mudou) return;
  const titulo = `Próximo contato — ${input.empresaNome}`.slice(0, 255);
  const alertaEm = new Date(prazo.getTime() - 10 * 60_000);
  await tx.bpmTarefa.upsert({
    where: { id },
    create: {
      id, cardId: input.cardId, titulo, descricao,
      responsavelId: input.responsavelId, prazo, alertaEm,
      tipo: TIPO_TAREFA_PROXIMO_CONTATO, status: "PENDENTE",
    },
    update: {
      titulo, descricao,
      responsavelId: input.responsavelId, prazo, alertaEm,
      status: "PENDENTE", concluidaEm: null, alertaDisparadoEm: null,
    },
  });
}
