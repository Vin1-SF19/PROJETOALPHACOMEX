import "server-only";

import { Prisma } from "@prisma/client";

import { registrarHistoricoCard } from "@/lib/bpm/historico-server";

export const MENSAGEM_TAREFA_CHECKLIST_PENDENTE =
  "Esta tarefa é controlada pelo checklist. Conclua os itens do checklist para finalizá-la.";

export type AcaoReconciliacaoTarefaChecklist =
  | "CRIADA"
  | "ATUALIZADA"
  | "REABERTA"
  | "CONCLUIDA"
  | "IGNORADA";

export type ResultadoReconciliacaoTarefaChecklist = {
  acao: AcaoReconciliacaoTarefaChecklist;
  checklistId: string;
  tarefaId: string | null;
  cardId: string | null;
  pipelineId: string | null;
  status: "PENDENTE" | "CONCLUIDA" | null;
  motivo?: "CHECKLIST_NAO_ENCONTRADO" | "SEM_ALTERACAO";
};

type ClientReconciliacao = Pick<
  Prisma.TransactionClient,
  "bpmCardChecklist" | "bpmTarefa" | "bpmCardHistorico"
>;

type ClientLeituraReconciliacao = Pick<
  Prisma.TransactionClient,
  "bpmCardChecklist" | "bpmTarefa"
>;

const selectChecklistReconciliacao = {
  id: true,
  cardId: true,
  templateNome: true,
  card: { select: { pipelineId: true, responsavelId: true } },
  itens: {
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    select: { id: true, status: true, responsavelId: true },
  },
} satisfies Prisma.BpmCardChecklistSelect;

const selectTarefaGerenciada = {
  id: true,
  cardId: true,
  titulo: true,
  tipo: true,
  status: true,
  responsavelId: true,
  concluidaEm: true,
} satisfies Prisma.BpmTarefaSelect;

type ChecklistReconciliacao = Prisma.BpmCardChecklistGetPayload<{
  select: typeof selectChecklistReconciliacao;
}>;
type TarefaGerenciada = Prisma.BpmTarefaGetPayload<{ select: typeof selectTarefaGerenciada }>;

function tituloTarefa(checklist: Pick<ChecklistReconciliacao, "templateNome">) {
  return `Checklist: ${checklist.templateNome}`;
}

function estadoDesejado(checklist: ChecklistReconciliacao) {
  const pendentes = checklist.itens.filter((item) => item.status !== "CONCLUIDO");
  const concluida = checklist.itens.length > 0 && pendentes.length === 0;
  const responsavelPendente = pendentes.find((item) => item.responsavelId !== null)?.responsavelId;
  return {
    status: (concluida ? "CONCLUIDA" : "PENDENTE") as "PENDENTE" | "CONCLUIDA",
    // O primeiro item pendente atribuído representa o próximo trabalho; sem atribuição,
    // a tarefa permanece com o responsável principal do card.
    responsavelId: responsavelPendente ?? checklist.card.responsavelId ?? null,
    titulo: tituloTarefa(checklist),
  };
}

function ehP2002(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function alteracoesGerenciadas(
  checklist: ChecklistReconciliacao,
  tarefa: TarefaGerenciada,
  agora: Date,
) {
  const desejado = estadoDesejado(checklist);
  const data: Prisma.BpmTarefaUpdateInput = {};
  if (tarefa.cardId !== checklist.cardId) data.card = { connect: { id: checklist.cardId } };
  if (tarefa.titulo !== desejado.titulo) data.titulo = desejado.titulo;
  if (tarefa.tipo !== "CHECKLIST") data.tipo = "CHECKLIST";
  if (tarefa.responsavelId !== desejado.responsavelId) {
    data.responsavel = desejado.responsavelId
      ? { connect: { id: desejado.responsavelId } }
      : { disconnect: true };
  }
  if (tarefa.status !== desejado.status) {
    data.status = desejado.status;
    data.concluidaEm = desejado.status === "CONCLUIDA" ? agora : null;
  } else if (desejado.status === "CONCLUIDA" && tarefa.concluidaEm === null) {
    data.concluidaEm = agora;
  } else if (desejado.status === "PENDENTE" && tarefa.concluidaEm !== null) {
    data.concluidaEm = null;
  }
  return { data, desejado };
}

function acaoAtualizacao(
  anterior: TarefaGerenciada,
  status: "PENDENTE" | "CONCLUIDA",
): Exclude<AcaoReconciliacaoTarefaChecklist, "CRIADA" | "IGNORADA"> {
  if (anterior.status === "CONCLUIDA" && status === "PENDENTE") return "REABERTA";
  if (anterior.status !== "CONCLUIDA" && status === "CONCLUIDA") return "CONCLUIDA";
  return "ATUALIZADA";
}

/** Inspeção sem escrita usada pelo dry-run oficial do reconciliador legado. */
export async function inspecionarTarefaChecklist(
  checklistId: string,
  client: ClientLeituraReconciliacao,
): Promise<ResultadoReconciliacaoTarefaChecklist> {
  const checklist = await client.bpmCardChecklist.findUnique({
    where: { id: checklistId },
    select: selectChecklistReconciliacao,
  });
  if (!checklist) {
    return {
      acao: "IGNORADA",
      checklistId,
      tarefaId: null,
      cardId: null,
      pipelineId: null,
      status: null,
      motivo: "CHECKLIST_NAO_ENCONTRADO",
    };
  }
  const existente = await client.bpmTarefa.findUnique({
    where: { cardChecklistId: checklist.id },
    select: selectTarefaGerenciada,
  });
  const desejado = estadoDesejado(checklist);
  if (!existente) {
    return {
      acao: "CRIADA",
      checklistId,
      tarefaId: null,
      cardId: checklist.cardId,
      pipelineId: checklist.card.pipelineId,
      status: desejado.status,
    };
  }
  const { data } = alteracoesGerenciadas(checklist, existente, new Date(0));
  return {
    acao: Object.keys(data).length === 0 ? "IGNORADA" : acaoAtualizacao(existente, desejado.status),
    checklistId,
    tarefaId: existente.id,
    cardId: checklist.cardId,
    pipelineId: checklist.card.pipelineId,
    status: desejado.status,
    ...(Object.keys(data).length === 0 ? { motivo: "SEM_ALTERACAO" as const } : {}),
  };
}

async function atualizarExistente(params: {
  checklist: ChecklistReconciliacao;
  tarefa: TarefaGerenciada;
  usuarioId?: number;
  automacaoOrigem?: string;
  client: ClientReconciliacao;
  agora: Date;
}): Promise<ResultadoReconciliacaoTarefaChecklist> {
  const { data, desejado } = alteracoesGerenciadas(params.checklist, params.tarefa, params.agora);
  if (Object.keys(data).length === 0) {
    return {
      acao: "IGNORADA",
      checklistId: params.checklist.id,
      tarefaId: params.tarefa.id,
      cardId: params.checklist.cardId,
      pipelineId: params.checklist.card.pipelineId,
      status: desejado.status,
      motivo: "SEM_ALTERACAO",
    };
  }

  await params.client.bpmTarefa.update({
    where: { id: params.tarefa.id },
    data,
    select: { id: true },
  });
  const acao = acaoAtualizacao(params.tarefa, desejado.status);
  await registrarHistoricoCard({
    cardId: params.checklist.cardId,
    acao: `TAREFA_CHECKLIST_${acao}`,
    usuarioId: params.usuarioId,
    automacaoOrigem: params.automacaoOrigem,
    valorAnteriorJson: JSON.stringify({
      tarefaId: params.tarefa.id,
      checklistId: params.checklist.id,
      status: params.tarefa.status,
      responsavelId: params.tarefa.responsavelId,
    }),
    valorNovoJson: JSON.stringify({
      tarefaId: params.tarefa.id,
      checklistId: params.checklist.id,
      status: desejado.status,
      responsavelId: desejado.responsavelId,
    }),
  }, params.client);
  return {
    acao,
    checklistId: params.checklist.id,
    tarefaId: params.tarefa.id,
    cardId: params.checklist.cardId,
    pipelineId: params.checklist.card.pipelineId,
    status: desejado.status,
  };
}

/**
 * Mantém exatamente uma tarefa derivada por checklist. O chamador fornece a
 * transação para que checklist e tarefa mudem atomicamente.
 */
export async function reconciliarTarefaChecklist(params: {
  checklistId: string;
  usuarioId?: number;
  automacaoOrigem?: string;
  agora?: Date;
}, client: ClientReconciliacao): Promise<ResultadoReconciliacaoTarefaChecklist> {
  const checklist = await client.bpmCardChecklist.findUnique({
    where: { id: params.checklistId },
    select: selectChecklistReconciliacao,
  });
  if (!checklist) {
    return {
      acao: "IGNORADA",
      checklistId: params.checklistId,
      tarefaId: null,
      cardId: null,
      pipelineId: null,
      status: null,
      motivo: "CHECKLIST_NAO_ENCONTRADO",
    };
  }

  const agora = params.agora ?? new Date();
  const existente = await client.bpmTarefa.findUnique({
    where: { cardChecklistId: checklist.id },
    select: selectTarefaGerenciada,
  });
  if (existente) {
    return atualizarExistente({ ...params, checklist, tarefa: existente, client, agora });
  }

  const desejado = estadoDesejado(checklist);
  try {
    const criada = await client.bpmTarefa.create({
      data: {
        cardId: checklist.cardId,
        cardChecklistId: checklist.id,
        titulo: desejado.titulo,
        tipo: "CHECKLIST",
        status: desejado.status,
        responsavelId: desejado.responsavelId,
        concluidaEm: desejado.status === "CONCLUIDA" ? agora : null,
      },
      select: { id: true },
    });
    await registrarHistoricoCard({
      cardId: checklist.cardId,
      acao: "TAREFA_CHECKLIST_CRIADA",
      usuarioId: params.usuarioId,
      automacaoOrigem: params.automacaoOrigem,
      valorNovoJson: JSON.stringify({
        tarefaId: criada.id,
        checklistId: checklist.id,
        status: desejado.status,
        responsavelId: desejado.responsavelId,
      }),
    }, client);
    return {
      acao: "CRIADA",
      checklistId: checklist.id,
      tarefaId: criada.id,
      cardId: checklist.cardId,
      pipelineId: checklist.card.pipelineId,
      status: desejado.status,
    };
  } catch (error) {
    if (!ehP2002(error)) throw error;
    const concorrente = await client.bpmTarefa.findUnique({
      where: { cardChecklistId: checklist.id },
      select: selectTarefaGerenciada,
    });
    if (!concorrente) throw error;
    return atualizarExistente({ ...params, checklist, tarefa: concorrente, client, agora });
  }
}
