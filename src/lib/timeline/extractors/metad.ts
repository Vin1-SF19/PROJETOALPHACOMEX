import db from '@/lib/prisma';
import type { TimelineEvent } from '../types';

export async function extractMetasEvents(clientId: number): Promise<TimelineEvent[]> {
  try {
    const contratos = await db.contratoComercial.findMany({
      where: { clienteId },
      select: {
        id: true,
        servico: true,
        valorContrato: true,
        formaPagamento: true,
        pagamentoConfirmadoEm: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return contratos.map((c) => ({
      id: `metas-${c.id}`,
      timestamp: (c.pagamentoConfirmadoEm ?? c.createdAt).toISOString(),
      module: 'metas',
      moduleLabel: 'Metas',
      title: `Contrato "${c.servico}" — ${c.status}`,
      description: [
        c.valorContrato != null ? `Valor: R$ ${c.valorContrato.toFixed(2)}` : null,
        c.formaPagamento ? `Pagamento: ${c.formaPagamento}` : null,
        c.pagamentoConfirmadoEm ? `Confirmado em: ${c.pagamentoConfirmadoEm.toISOString().split('T')[0]}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
      metadata: {
        contratoId: c.id,
        servico: c.servico,
        status: c.status,
        pagamentoConfirmadoEm: c.pagamentoConfirmadoEm?.toISOString() ?? null,
      },
    }));
  } catch {
    return [];
  }
}
