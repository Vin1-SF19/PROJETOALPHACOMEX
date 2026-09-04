/**
 * Timeline unificada de um card do Alpha CRM (RM-2026-D6D970).
 *
 * Reaproveita o framework existente em src/lib/timeline (types.ts,
 * aggregator.ts, usado hoje pelo perfil da empresa) sem duplicar dados:
 * cada fonte já é persistida por um módulo existente do CRM/BPM
 * (BpmCardHistorico, BpmInteracaoCard, BpmTarefa, BpmCardChecklist,
 * BpmAutomacaoExecucao, BpmSlaDisparo). Esta função só lê e funde
 * cronologicamente.
 */
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import type { TimelineEvent } from "@/lib/timeline/types";

type ClienteDb = Prisma.TransactionClient | typeof db;

function resumirValor(json: string | null): string | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || parsed === undefined) return null;
    if (typeof parsed === "object") return JSON.stringify(parsed).slice(0, 200);
    return String(parsed);
  } catch {
    return json.slice(0, 200);
  }
}

export async function extractCardTimelineEvents(
  cardId: string,
  client: ClienteDb = db,
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  const card = await client.bpmCard.findUnique({
    where: { id: cardId },
    select: { id: true, createdAt: true, servico: true, responsavel: { select: { nome: true } } },
  });
  if (!card) return events;

  events.push({
    id: `card-criacao-${card.id}`,
    timestamp: card.createdAt.toISOString(),
    module: "card",
    moduleLabel: "Card",
    title: `Card criado${card.servico ? ` — ${card.servico}` : ""}`,
    actor: card.responsavel?.nome,
    metadata: { tipo: "criacao" },
  });

  const [historico, interacoes, tarefas, checklists, automacoes, slaDisparos] = await Promise.all([
    client.bpmCardHistorico.findMany({
      where: { cardId },
      select: { id: true, acao: true, valorAnteriorJson: true, valorNovoJson: true, automacaoOrigem: true, createdAt: true, usuario: { select: { nome: true } } },
    }),
    client.bpmInteracaoCard.findMany({
      where: { cardId },
      select: { id: true, tipo: true, observacoes: true, resumo: true, createdAt: true, registradoPor: { select: { nome: true } } },
    }),
    client.bpmTarefa.findMany({
      where: { cardId },
      select: { id: true, titulo: true, tipo: true, status: true, createdAt: true, concluidaEm: true, responsavel: { select: { nome: true } } },
    }),
    client.bpmCardChecklist.findMany({
      where: { cardId },
      select: { id: true, templateNome: true, status: true, createdAt: true, concluidoEm: true },
    }),
    client.bpmAutomacaoExecucao.findMany({
      where: { cardId },
      select: { id: true, gatilhoTipo: true, status: true, executadoEm: true, createdAt: true, automacao: { select: { nome: true } } },
    }),
    client.bpmSlaDisparo.findMany({
      where: { cardId },
      select: { id: true, tipoDisparo: true, disparadoEm: true, slaConfig: { select: { nome: true } } },
    }).catch(() => []), // SLA (RM-2026-095B40) pode ainda não estar disponível em produção — fail-open.
  ]);

  for (const h of historico) {
    const anterior = resumirValor(h.valorAnteriorJson);
    const novo = resumirValor(h.valorNovoJson);
    events.push({
      id: `hist-${h.id}`,
      timestamp: h.createdAt.toISOString(),
      module: "historico",
      moduleLabel: "Histórico",
      title: h.acao,
      description: anterior || novo ? `${anterior ?? "—"} → ${novo ?? "—"}` : undefined,
      actor: h.usuario?.nome ?? (h.automacaoOrigem ? `Automação: ${h.automacaoOrigem}` : undefined),
      metadata: { valorAnterior: h.valorAnteriorJson, valorNovo: h.valorNovoJson, origem: h.automacaoOrigem ? "automacao" : "manual" },
    });
  }

  for (const interacao of interacoes) {
    events.push({
      id: `interacao-${interacao.id}`,
      timestamp: interacao.createdAt.toISOString(),
      module: "interacao",
      moduleLabel: "Anotação/Ligação",
      title: interacao.tipo,
      description: interacao.observacoes ?? interacao.resumo ?? undefined,
      actor: interacao.registradoPor?.nome,
    });
  }

  for (const tarefa of tarefas) {
    events.push({
      id: `tarefa-criada-${tarefa.id}`,
      timestamp: tarefa.createdAt.toISOString(),
      module: "tarefa",
      moduleLabel: "Tarefa",
      title: `Tarefa criada — ${tarefa.titulo}`,
      actor: tarefa.responsavel?.nome ?? undefined,
      metadata: { tipo: tarefa.tipo, status: tarefa.status },
    });
    if (tarefa.concluidaEm) {
      events.push({
        id: `tarefa-concluida-${tarefa.id}`,
        timestamp: tarefa.concluidaEm.toISOString(),
        module: "tarefa",
        moduleLabel: "Tarefa",
        title: `Tarefa concluída — ${tarefa.titulo}`,
        actor: tarefa.responsavel?.nome ?? undefined,
      });
    }
  }

  for (const checklist of checklists) {
    events.push({
      id: `checklist-criado-${checklist.id}`,
      timestamp: checklist.createdAt.toISOString(),
      module: "checklist",
      moduleLabel: "Checklist",
      title: `Checklist iniciado — ${checklist.templateNome}`,
    });
    if (checklist.concluidoEm) {
      events.push({
        id: `checklist-concluido-${checklist.id}`,
        timestamp: checklist.concluidoEm.toISOString(),
        module: "checklist",
        moduleLabel: "Checklist",
        title: `Checklist concluído — ${checklist.templateNome}`,
      });
    }
  }

  for (const automacao of automacoes) {
    if (!automacao.executadoEm) continue;
    events.push({
      id: `automacao-${automacao.id}`,
      timestamp: automacao.executadoEm.toISOString(),
      module: "automacao",
      moduleLabel: "Automação",
      title: `Automação executada — ${automacao.automacao?.nome ?? automacao.gatilhoTipo}`,
      metadata: { status: automacao.status, gatilho: automacao.gatilhoTipo },
    });
  }

  for (const disparo of slaDisparos) {
    events.push({
      id: `sla-${disparo.id}`,
      timestamp: disparo.disparadoEm.toISOString(),
      module: "sla",
      moduleLabel: "SLA",
      title: `${disparo.tipoDisparo === "ALERTA_VENCIDO" ? "SLA vencido" : "SLA próximo do vencimento"} — ${disparo.slaConfig.nome}`,
    });
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return events;
}
