/**
 * Central de Pendências (RM-2026-D6D970).
 *
 * Consolida, sem duplicar dado, o que exige ação do usuário a partir dos
 * componentes já existentes do CRM/BPM: tarefas pendentes, próximo contato
 * vencido, checklists incompletos, campos obrigatórios faltantes na etapa
 * atual e alertas de SLA (quando o módulo SLA — RM-2026-095B40 — já estiver
 * disponível em produção; fail-open enquanto não estiver).
 */
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";

type ClienteDb = Prisma.TransactionClient | typeof db;

export type TipoPendencia =
  | "TAREFA_PENDENTE"
  | "PROXIMO_CONTATO_VENCIDO"
  | "CHECKLIST_PENDENTE"
  | "CAMPO_OBRIGATORIO_FALTANTE"
  | "SLA_PROXIMO"
  | "SLA_VENCIDO";

export interface ItemPendencia {
  tipo: TipoPendencia;
  cardId: string;
  pipelineId: string;
  pipelineNome: string;
  etapaNome: string;
  servico: string | null;
  titulo: string;
  prazo: string | null;
  responsavelId: number | null;
  responsavelNome: string | null;
}

type InstanciaSlaPendencia = {
  cardId: string | null;
  deadline: Date | null;
  alertaPrazoDisparadoEm: Date | null;
  vencidoEm: Date | null;
  slaConfig: { nome: string };
};

/**
 * Escopo: cards onde o usuário é responsável ou membro (mesmo critério usado
 * no restante do BPM para "meus cards"); administradores/diretoria veem tudo.
 */
async function cardsDoUsuario(userId: number, isAdminOuDiretoria: boolean, client: ClienteDb) {
  return client.bpmCard.findMany({
    where: {
      status: "ATIVO",
      ...(isAdminOuDiretoria ? {} : { OR: [{ responsavelId: userId }, { membros: { some: { userId } } }] }),
    },
    select: {
      id: true,
      servico: true,
      proximoContatoEm: true,
      pipelineId: true,
      etapaId: true,
      responsavelId: true,
      responsavel: { select: { nome: true } },
      pipeline: { select: { nome: true } },
      etapa: { select: { nome: true } },
    },
  });
}

export async function listarPendenciasBpm(
  userId: number,
  isAdminOuDiretoria: boolean,
  client: ClienteDb = db,
): Promise<ItemPendencia[]> {
  const cards = await cardsDoUsuario(userId, isAdminOuDiretoria, client);
  if (cards.length === 0) return [];
  const cardIds = cards.map((c) => c.id);
  const cardPorId = new Map(cards.map((c) => [c.id, c]));

  function base(cardId: string) {
    const card = cardPorId.get(cardId)!;
    return {
      cardId,
      pipelineId: card.pipelineId,
      pipelineNome: card.pipeline?.nome ?? "—",
      etapaNome: card.etapa?.nome ?? "—",
      servico: card.servico,
      responsavelId: card.responsavelId,
      responsavelNome: card.responsavel?.nome ?? null,
    };
  }

  const itens: ItemPendencia[] = [];
  const agora = new Date();

  for (const card of cards) {
    if (card.proximoContatoEm && card.proximoContatoEm <= agora) {
      itens.push({
        ...base(card.id),
        tipo: "PROXIMO_CONTATO_VENCIDO",
        titulo: `Próximo contato vencido${card.servico ? ` — ${card.servico}` : ""}`,
        prazo: card.proximoContatoEm.toISOString(),
      });
    }
  }

  const [tarefas, checklists, camposObrigatorios, valoresCampos, slaInstancias] = await Promise.all([
    client.bpmTarefa.findMany({
      where: { cardId: { in: cardIds }, status: "PENDENTE" },
      select: { id: true, cardId: true, titulo: true, prazo: true, responsavelId: true, responsavel: { select: { nome: true } } },
    }),
    client.bpmCardChecklist.findMany({
      where: { cardId: { in: cardIds }, status: { not: "CONCLUIDO" } },
      select: { id: true, cardId: true, templateNome: true },
    }),
    client.bpmCampo.findMany({
      where: { pipelineId: { in: cards.map((c) => c.pipelineId) }, obrigatorio: true },
      select: { id: true, pipelineId: true, etapaId: true, nome: true },
    }),
    client.bpmCardCampoValor.findMany({
      where: { cardId: { in: cardIds } },
      select: { cardId: true, campoId: true, valor: true },
    }),
    (client.bpmSlaInstancia.findMany({
      where: {
        cardId: { in: cardIds },
        status: { in: ["DENTRO_PRAZO", "PROXIMO_VENCIMENTO", "ATRASADO", "PAUSADO"] },
      },
      select: { id: true, cardId: true, deadline: true, alertaPrazoDisparadoEm: true, vencidoEm: true, slaConfig: { select: { nome: true } } },
    }) as Promise<InstanciaSlaPendencia[]>).catch(() => []),
  ]);

  for (const tarefa of tarefas) {
    itens.push({
      ...base(tarefa.cardId),
      tipo: "TAREFA_PENDENTE",
      titulo: tarefa.titulo,
      prazo: tarefa.prazo?.toISOString() ?? null,
      responsavelId: tarefa.responsavelId ?? base(tarefa.cardId).responsavelId,
      responsavelNome: tarefa.responsavel?.nome ?? base(tarefa.cardId).responsavelNome,
    });
  }

  for (const checklist of checklists) {
    itens.push({
      ...base(checklist.cardId),
      tipo: "CHECKLIST_PENDENTE",
      titulo: `Checklist pendente — ${checklist.templateNome}`,
      prazo: null,
    });
  }

  const valorPorCardCampo = new Map(valoresCampos.map((v) => [`${v.cardId}:${v.campoId}`, v.valor]));
  for (const card of cards) {
    const camposDaEtapa = camposObrigatorios.filter(
      (campo) => campo.pipelineId === card.pipelineId && (campo.etapaId === null || campo.etapaId === card.etapaId),
    );
    for (const campo of camposDaEtapa) {
      const valor = valorPorCardCampo.get(`${card.id}:${campo.id}`);
      if (!valor || !valor.trim()) {
        itens.push({
          ...base(card.id),
          tipo: "CAMPO_OBRIGATORIO_FALTANTE",
          titulo: `Campo obrigatório faltando — ${campo.nome}`,
          prazo: null,
        });
      }
    }
  }

  for (const instancia of slaInstancias) {
    if (!instancia.cardId) continue;
    if (instancia.vencidoEm) {
      itens.push({
        ...base(instancia.cardId),
        tipo: "SLA_VENCIDO",
        titulo: `SLA vencido — ${instancia.slaConfig.nome}`,
        prazo: instancia.deadline?.toISOString() ?? null,
      });
    } else if (instancia.alertaPrazoDisparadoEm) {
      itens.push({
        ...base(instancia.cardId),
        tipo: "SLA_PROXIMO",
        titulo: `SLA próximo do vencimento — ${instancia.slaConfig.nome}`,
        prazo: instancia.deadline?.toISOString() ?? null,
      });
    }
  }

  itens.sort((a, b) => {
    if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
    if (a.prazo) return -1;
    if (b.prazo) return 1;
    return 0;
  });
  return itens;
}
