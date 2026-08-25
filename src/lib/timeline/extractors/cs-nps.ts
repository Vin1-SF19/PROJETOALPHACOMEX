import db from '@/lib/prisma';
import type { TimelineEvent } from '../types';

const MODULE = 'cs-nps';
const MODULE_LABEL = 'CS & NPS';

export async function extractCsNpsEvents(clienteId: number): Promise<TimelineEvent[]> {
  try {
    const servicos = await db.clienteServico.findMany({
      where: { clienteId },
      select: {
        id: true,
        servico: true,
        status: true,
        analistaResponsavel: true,
        dataContratacao: true,
        dataExito: true,
        origemLead: true,
        createdAt: true,
        updatedAt: true,
        logCs: {
          select: { id: true, dataRegistro: true, colaborador: true, sentimento: true, observacao: true },
          orderBy: { dataRegistro: 'asc' },
        },
        logFeedback: {
          select: { id: true, dataRegistro: true, colaborador: true, sentimento: true, observacao: true },
          orderBy: { dataRegistro: 'asc' },
        },
      },
    });

    const events: TimelineEvent[] = [];

    for (const svc of servicos) {
      // Evento de contratação
      if (svc.dataContratacao) {
        events.push({
          id: `csnps-contratacao-${svc.id}`,
          timestamp: new Date(svc.dataContratacao).toISOString(),
          module: MODULE,
          moduleLabel: MODULE_LABEL,
          title: `Contratação — ${svc.servico}`,
          description: `Serviço "${svc.servico}" contratado. Analista: ${svc.analistaResponsavel ?? 'N/D'}.`,
          actor: svc.analistaResponsavel ?? undefined,
          metadata: { servico: svc.servico, status: svc.status, origemLead: svc.origemLead ?? undefined },
        });
      }

      // Evento de sucesso
      if (svc.dataExito) {
        events.push({
          id: `csnps-exito-${svc.id}`,
          timestamp: new Date(svc.dataExito).toISOString(),
          module: MODULE,
          moduleLabel: MODULE_LABEL,
          title: `Éxito — ${svc.servico}`,
          description: `Serviço "${svc.servico}" marcado como exitoso.`,
          metadata: { servico: svc.servico },
        });
      }

      // Logs CS
      for (const log of svc.logCs) {
        events.push({
          id: `csnps-cs-${log.id}`,
          timestamp: log.dataRegistro.toISOString(),
          module: MODULE,
          moduleLabel: MODULE_LABEL,
          title: `Contato CS — ${svc.servico}`,
          description: log.observacao || `Sentimento: ${log.sentimento}`,
          actor: log.colaborador,
          metadata: { servico: svc.servico, sentimento: log.sentimento },
        });
      }

      // Logs Feedback
      for (const fb of svc.logFeedback) {
        events.push({
          id: `csnps-fb-${fb.id}`,
          timestamp: fb.dataRegistro.toISOString(),
          module: MODULE,
          moduleLabel: MODULE_LABEL,
          title: `Feedback — ${svc.servico}`,
          description: fb.observacao || `Sentimento: ${fb.sentimento}`,
          actor: fb.colaborador,
          metadata: { servico: svc.servico, sentimento: fb.sentimento },
        });
      }
    }

    return events;
  } catch (error) {
    console.error('[Timeline] CS&NPS extractor failed:', error);
    return [];
  }
}
