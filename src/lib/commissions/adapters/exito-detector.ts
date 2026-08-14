import db from "@/lib/prisma";
import { buscarClientePorId } from "./cs-nps-adapter";

/**
 * Detecta o evento de ÊXITO (PROCESS_SUCCESS) — decisão confirmada pelo usuário (Fase 01,
 * não reabrir): nasce da presença de `ClienteServico.dataExito` passando de vazio para
 * preenchido (Fase 3.6 do Cliente Master, 2026-08-14 — antes era `clientes.dataExito`).
 * NÃO vem do Checklist RADAR nem é registro manual. A detecção compara o estado atual
 * contra o último `CommissionEvent` de CONTRACTING já sincronizado para o mesmo
 * `clienteId` (aqui, `ClienteServico.id` — nome do campo preservado por compatibilidade
 * com o histórico de comissões já geradas) — se já existe um evento de PROCESS_SUCCESS
 * para esse cliente, a detecção é idempotente (não gera de novo).
 */

export interface ExitoDetectionResult {
  clienteId: number;
  dataExito: Date;
  /** true quando já existia um evento de êxito prévio para este cliente — não deve gerar novo. */
  jaProcessado: boolean;
}

export async function detectarExitoParaCliente(clienteId: number): Promise<ExitoDetectionResult | null> {
  const cliente = await buscarClientePorId(clienteId);
  if (!cliente || !cliente.dataExito) return null;

  const eventoExitoExistente = await db.commissionEvent.findFirst({
    where: { clienteId, eventType: "PROCESS_SUCCESS" },
    select: { id: true },
  });

  return {
    clienteId,
    dataExito: cliente.dataExito,
    jaProcessado: eventoExitoExistente !== null,
  };
}

/**
 * Varre clientes com `dataExito` preenchida que ainda não geraram evento de êxito.
 * Usado pelo sync-engine para detectar êxitos novos em lote (não busca 1 cliente por vez).
 */
export async function listarClientesComExitoNaoProcessado(): Promise<number[]> {
  const clientesComExito = await db.clienteServico.findMany({
    where: { dataExito: { not: null } },
    select: { id: true },
    take: 500,
  });

  if (clientesComExito.length === 0) return [];

  const idsComExito = clientesComExito.map((c) => c.id);

  const eventosExistentes = await db.commissionEvent.findMany({
    where: { clienteId: { in: idsComExito }, eventType: "PROCESS_SUCCESS" },
    select: { clienteId: true },
  });

  const idsJaProcessados = new Set(eventosExistentes.map((e) => e.clienteId));

  return idsComExito.filter((id) => !idsJaProcessados.has(id));
}
