import "server-only";

import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { formatarDataCivil } from "@/components/CalendarioAlpha/lib/datas";
import { materializarChecklistsAplicaveisCard } from "@/lib/bpm/checklists/service";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { cicloSemanal, ETAPA_DOCUMENTACAO_ANALISE_ID, PIPELINE_DOCUMENTACAO_OPERACIONAL_ID } from "@/lib/bpm/documentacao-analise";

const TITULO_PENDENCIAS = "Verificar documentos pendentes";
const TITULO_ATUALIZACAO = "Atualizar andamento documental";

async function criarTarefaUnica(dados: Prisma.BpmTarefaUncheckedCreateInput): Promise<boolean> {
  try { await db.bpmTarefa.create({ data: dados }); return true; }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}

/** Executado pelo job existente; tarefas têm identidade fixa por card e ciclo. */
export async function monitorarDocumentacaoEmAnalise(agora = new Date()) {
  const habilitado = await db.bpmFormularioComponente.findFirst({ where: {
    tipo: "CHECKLIST", capability: "STAGE_CHECKLIST",
    secao: { formulario: { etapaId: ETAPA_DOCUMENTACAO_ANALISE_ID, ativo: true } },
  }, select: { id: true } });
  if (!habilitado) return { cards: 0, pendencias: 0, atualizacoes: 0 };

  let cardsTotal = 0, pendencias = 0, atualizacoes = 0;
  let cursor: string | undefined;
  while (true) {
    const cards = await db.bpmCard.findMany({ where: { pipelineId: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID,
      etapaId: ETAPA_DOCUMENTACAO_ANALISE_ID, status: "ATIVO" }, orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, createdAt: true, responsavelId: true }, take: 200 });
    if (cards.length === 0) break;
    cardsTotal += cards.length;
    for (const card of cards) {
    let alterouTarefas = false;
    const materializados = await materializarChecklistsAplicaveisCard({ cardId: card.id, automacaoOrigem: "Monitoramento documental" });
    const quantidadePendente = materializados.checklists.flatMap((checklist) => checklist.itens)
      .filter((item) => item.status !== "CONCLUIDO").length;
    const [ultimaAnotacao, movimentoEntrada] = await Promise.all([
      db.bpmCardHistorico.findFirst({ where: { cardId: card.id, acao: "ANOTACAO_REGISTRADA" },
        orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      db.bpmCardHistorico.findFirst({ where: { cardId: card.id, acao: "CARD_MOVIDO",
        valorNovoJson: { contains: `"etapaId":"${ETAPA_DOCUMENTACAO_ANALISE_ID}"` } },
      orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const anotacao = ultimaAnotacao?.createdAt ?? null;
    const entrada = movimentoEntrada?.createdAt ?? card.createdAt;
    const referenciaSemanal = anotacao && anotacao > entrada ? anotacao : entrada;
    const dia = formatarDataCivil(agora);
    if (quantidadePendente > 0) {
      const antigas = await db.bpmTarefa.updateMany({ where: { cardId: card.id, titulo: { startsWith: TITULO_PENDENCIAS },
        status: "PENDENTE", id: { not: `docpend:${card.id}:${dia}` } },
      data: { status: "CONCLUIDA", concluidaEm: agora } });
      alterouTarefas ||= antigas.count > 0;
      if (await criarTarefaUnica({ id: `docpend:${card.id}:${dia}`, cardId: card.id,
        titulo: `${TITULO_PENDENCIAS} — ${dia}`, descricao: `${quantidadePendente} documento(s) ainda pendente(s) no checklist do card.`,
        responsavelId: card.responsavelId, prazo: agora, alertaEm: agora, prioridade: "ALTA" })) { pendencias++; alterouTarefas = true; }
    } else {
      const concluidas = await db.bpmTarefa.updateMany({ where: { cardId: card.id, titulo: { startsWith: TITULO_PENDENCIAS }, status: "PENDENTE" },
        data: { status: "CONCLUIDA", concluidaEm: agora } });
      alterouTarefas ||= concluidas.count > 0;
    }
    const ciclo = cicloSemanal(entrada, anotacao, agora);
    if (ciclo > 0) {
      const idAtualizacao = `docupdate:${card.id}:${referenciaSemanal.getTime()}:${ciclo}`;
      const antigas = await db.bpmTarefa.updateMany({ where: { cardId: card.id, titulo: { startsWith: TITULO_ATUALIZACAO },
        status: "PENDENTE", id: { not: idAtualizacao } },
      data: { status: "CONCLUIDA", concluidaEm: agora } });
      alterouTarefas ||= antigas.count > 0;
      if (await criarTarefaUnica({ id: idAtualizacao, cardId: card.id,
        titulo: `${TITULO_ATUALIZACAO} — semana ${ciclo}`, descricao: "Registre uma anotação de andamento da assessoria neste card.",
        responsavelId: card.responsavelId, prazo: agora, alertaEm: agora, prioridade: "ALTA" })) { atualizacoes++; alterouTarefas = true; }
    }
    if (anotacao) {
      const concluidas = await db.bpmTarefa.updateMany({ where: { cardId: card.id, titulo: { startsWith: TITULO_ATUALIZACAO },
        status: "PENDENTE", createdAt: { lte: anotacao } }, data: { status: "CONCLUIDA", concluidaEm: anotacao } });
      alterouTarefas ||= concluidas.count > 0;
    }
    if (alterouTarefas) await notificarPipelineBpm({ pipelineId: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID,
      cardId: card.id, tipo: "TAREFA_ALTERADA" });
    }
    cursor = cards.at(-1)?.id;
    if (cards.length < 200) break;
  }
  return { cards: cardsTotal, pendencias, atualizacoes };
}
