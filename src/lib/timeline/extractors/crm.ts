import db from '@/lib/prisma';
import type { TimelineEvent } from '../types';

const MODULE = 'crm';
const MODULE_LABEL = 'Alpha CRM';

interface ExtractCrmEventsOptions {
  userId: number;
  isAdminOrDiretoria: boolean;
}

export async function extractCrmEvents(
  clienteId: number,
  { userId, isAdminOrDiretoria }: ExtractCrmEventsOptions,
): Promise<TimelineEvent[]> {
  try {
    const cards = await db.bpmCard.findMany({
      where: {
        empresaId: clienteId,
        ...(isAdminOrDiretoria ? {} : { membros: { some: { userId } } }),
      },
      select: {
        id: true,
        status: true,
        servico: true,
        createdAt: true,
        updatedAt: true,
        responsavel: { select: { nome: true } },
        pipeline: { select: { nome: true } },
        etapa: { select: { nome: true } },
        historico: {
          select: { id: true, acao: true, createdAt: true, usuario: { select: { nome: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const events: TimelineEvent[] = [];

    for (const card of cards) {
      // Criação do card
      events.push({
        id: `crm-card-${card.id}`,
        timestamp: card.createdAt.toISOString(),
        module: MODULE,
        moduleLabel: MODULE_LABEL,
        title: `Card criado — ${card.servico ?? 'Sem serviço'}`,
        description: `Pipeline: ${card.pipeline?.nome ?? 'N/D'} | Etapa: ${card.etapa?.nome ?? 'N/D'} | Status: ${card.status}`,
        actor: card.responsavel?.nome,
        metadata: { cardId: card.id, servico: card.servico ?? undefined, pipeline: card.pipeline?.nome, etapa: card.etapa?.nome, status: card.status },
      });

      // Histórico de ações
      for (const h of card.historico) {
        events.push({
          id: `crm-hist-${h.id}`,
          timestamp: h.createdAt.toISOString(),
          module: MODULE,
          moduleLabel: MODULE_LABEL,
          title: `${h.acao} — ${card.servico ?? 'Sem serviço'}`,
          description: `Ação: ${h.acao}`,
          actor: h.usuario?.nome,
          metadata: { cardId: card.id, acao: h.acao },
        });
      }
    }

    return events;
  } catch (error) {
    console.error('[Timeline] CRM extractor failed:', error);
    return [];
  }
}
