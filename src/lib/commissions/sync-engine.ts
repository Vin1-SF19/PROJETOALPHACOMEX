import db from "@/lib/prisma";
import { buscarClientePorId } from "./adapters/cs-nps-adapter";
import { listarContratosComerciaisParaSync } from "./adapters/metas-adapter";
import { mergeCompanyEvent, chaveDeCasamento } from "./adapters/company-event-merger";
import { listarClientesComExitoNaoProcessado } from "./adapters/exito-detector";
import { buscarClientePorCnpjEServico } from "./adapters/cs-nps-lookup";
import { persistirDivergenciasDetectadas } from "./divergence-detector";

/**
 * Orquestra a sincronização incremental de eventos financeiros. Idempotência garantida
 * pela unique constraint já aplicada no schema
 * (sourceSystem+sourceEntity+sourceId+eventType, ver Fase 02) — nunca duplica
 * CommissionEvent para o mesmo par fonte+tipo de evento.
 */

export interface SyncResult {
  syncRunId: string;
  totalProcessed: number;
  totalErrors: number;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
}

export async function sincronizarComissoes(params: {
  triggeredBy: "manual" | "scheduled";
  triggeredById?: number;
}): Promise<SyncResult> {
  const syncRun = await db.syncRun.create({
    data: {
      sourceSystem: "cs-nps+metas",
      triggeredBy: params.triggeredBy,
      triggeredById: params.triggeredById ?? null,
      status: "RUNNING",
    },
  });

  let totalProcessed = 0;
  let totalErrors = 0;

  // ─── Fase 1: eventos de CONTRATAÇÃO via merge ContratoComercial + clientes ───
  const contratos = await listarContratosComerciaisParaSync(null);

  for (const contrato of contratos) {
    try {
      const sourceId = `merged:${chaveDeCasamento(contrato.cnpj, contrato.servico)}`;

      const jaExiste = await db.commissionEvent.findUnique({
        where: {
          sourceSystem_sourceEntity_sourceId_eventType: {
            sourceSystem: "merged",
            sourceEntity: "contratacao",
            sourceId,
            eventType: "CONTRACTING",
          },
        },
        select: { id: true },
      });

      if (jaExiste) continue; // idempotente — já processado

      const clienteCorrespondente = await buscarClientePorCnpjEServico(contrato.cnpj, contrato.servico);
      const clienteSource = clienteCorrespondente ? await buscarClientePorId(clienteCorrespondente.id) : null;

      const merged = mergeCompanyEvent({
        clienteId: clienteCorrespondente?.id ?? null,
        contratoComercialId: contrato.id,
        cliente: clienteSource,
        contrato,
      });

      const netContractAmountCents = merged.valorContratoCents ?? 0;

      const evento = await db.commissionEvent.create({
        data: {
          eventType: "CONTRACTING",
          clienteId: merged.clienteId,
          contratoComercialId: merged.contratoComercialId,
          cnpj: merged.cnpj,
          razaoSocial: merged.razaoSocial,
          nomeFantasia: merged.nomeFantasia,
          servico: merged.servico,
          eventDate: merged.dataContratacao ?? new Date(),
          grossContractAmountCents: merged.valorContratoCents ?? 0,
          netContractAmountCents,
          formaPagamento: merged.formaPagamento,
          status: merged.conflicts.length > 0 ? "PENDING_REVIEW" : "OK",
          sourceSystem: "merged",
          sourceEntity: "contratacao",
          sourceId,
          sourceUpdatedAt: contrato.updatedAt,
          lastSyncAt: new Date(),
          syncStatus: "SYNCED",
        },
      });

      if (merged.conflicts.length > 0) {
        await db.commissionDivergence.create({
          data: {
            eventId: evento.id,
            tipo: "CAMPO_DIVERGENTE_ENTRE_FONTES",
            severidade: "PENDING_REVIEW",
            detalhes: JSON.stringify(merged.conflicts),
          },
        });
      }

      // Detecção sistemática (seção 28) — 14 checagens além do conflito de merge acima.
      await persistirDivergenciasDetectadas(evento.id);

      totalProcessed++;
    } catch (err) {
      totalErrors++;
      await db.syncError.create({
        data: {
          syncRunId: syncRun.id,
          sourceEntity: "contratacao",
          sourceId: contrato.id,
          mensagem: err instanceof Error ? err.message : "Erro desconhecido ao processar contratação.",
        },
      });
    }
  }

  // ─── Fase 2: eventos de ÊXITO via clientes.dataExito ───
  const clienteIdsComExito = await listarClientesComExitoNaoProcessado();

  for (const clienteId of clienteIdsComExito) {
    try {
      const cliente = await buscarClientePorId(clienteId);
      if (!cliente || !cliente.dataExito) continue;

      const sourceId = `exito:${clienteId}`;

      const evento = await db.commissionEvent.create({
        data: {
          eventType: "PROCESS_SUCCESS",
          clienteId,
          cnpj: cliente.cnpj,
          razaoSocial: cliente.razaoSocial,
          nomeFantasia: cliente.nomeFantasia,
          servico: cliente.servico,
          eventDate: cliente.dataExito,
          grossContractAmountCents: cliente.valorContratoCents ?? 0,
          netContractAmountCents: cliente.valorContratoCents ?? 0,
          formaPagamento: cliente.formaPagamento,
          status: "OK",
          sourceSystem: "cs-nps",
          sourceEntity: "exito",
          sourceId,
          lastSyncAt: new Date(),
          syncStatus: "SYNCED",
        },
      });

      // Sem BusinessProcess correspondente: faltam tentativas/responsáveis — divergência.
      const processo = await db.businessProcess.findFirst({ where: { clienteId }, select: { id: true } });
      if (!processo) {
        await db.commissionDivergence.create({
          data: {
            eventId: evento.id,
            tipo: "EXITO_SEM_BUSINESS_PROCESS",
            severidade: "PENDING_REVIEW",
            detalhes: `Evento de êxito gerado para clienteId=${clienteId}, mas não há BusinessProcess correspondente com tentativas/responsáveis.`,
          },
        });
      }

      // Detecção sistemática (seção 28) — 14 checagens além da ausência de BusinessProcess acima.
      await persistirDivergenciasDetectadas(evento.id);

      totalProcessed++;
    } catch (err) {
      totalErrors++;
      await db.syncError.create({
        data: {
          syncRunId: syncRun.id,
          sourceEntity: "exito",
          sourceId: String(clienteId),
          mensagem: err instanceof Error ? err.message : "Erro desconhecido ao processar êxito.",
        },
      });
    }
  }

  const status: SyncResult["status"] = totalErrors === 0 ? "SUCCESS" : totalProcessed > 0 ? "PARTIAL" : "FAILED";

  await db.syncRun.update({
    where: { id: syncRun.id },
    data: { finishedAt: new Date(), status, totalProcessed, totalErrors },
  });

  return { syncRunId: syncRun.id, totalProcessed, totalErrors, status };
}
