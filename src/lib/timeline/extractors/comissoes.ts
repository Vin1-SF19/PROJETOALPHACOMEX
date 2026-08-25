import db from '@/lib/prisma';
import type { TimelineEvent } from '../types';

export async function extractComissoesEvents(clientId: number): Promise<TimelineEvent[]> {
  try {
    const events = await db.commissionEvent.findMany({
      where: { clienteId },
      select: {
        id: true,
        eventType: true,
        servico: true,
        eventDate: true,
        grossContractAmountCents: true,
        netContractAmountCents: true,
        status: true,
        lastSyncAt: true,
      },
      orderBy: { eventDate: 'asc' },
      take: 100,
    });

    return events.map((ev) => ({
      id: `comissoes-${ev.id}`,
      timestamp: ev.eventDate.toISOString(),
      module: 'comissoes',
      moduleLabel: 'Comissões',
      title: `Evento ${ev.eventType} — ${ev.servico}`,
      description: [
        `Bruto: R$ ${(ev.grossContractAmountCents / 100).toFixed(2)}`,
        `Líquido: R$ ${(ev.netContractAmountCents / 100).toFixed(2)}`,
        `Status: ${ev.status}`,
      ].join(' · '),
      metadata: {
        eventId: ev.id,
        eventType: ev.eventType,
        status: ev.status,
        lastSyncAt: ev.lastSyncAt?.toISOString() ?? null,
      },
    }));
  } catch {
    return [];
  }
}
