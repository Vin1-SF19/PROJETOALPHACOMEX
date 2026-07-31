import db from "@/lib/prisma";
import { buscarClientePorId } from "./adapters/cs-nps-adapter";
import { listarContratosComerciaisParaSync } from "./adapters/metas-adapter";
import { mergeCompanyEvent, chaveDeCasamento } from "./adapters/company-event-merger";
import { listarClientesComExitoNaoProcessado } from "./adapters/exito-detector";
import { buscarClientePorCnpjEServico } from "./adapters/cs-nps-lookup";
import { persistirDivergenciasDetectadas } from "./divergence-detector";
import { gerarLancamentosParaEvento } from "./entry-generator";
import {
  registrarAmbiguidadesParticipantes,
  resolverParticipantesAutomaticosEvento,
} from "./participant-resolver";

/**
 * Gera lançamentos automaticamente só para os responsáveis que o sistema consegue
 * resolver com confiança (closer via FK, analista responsável via FK) — decisão do
 * usuário: os demais cargos do Big Card (Coordenadora/Diretora Comercial, Auditor
 * Contábil, Diretor Operacional) não têm nenhuma fonte de dado hoje para vínculo por
 * evento, então ficam de fora da geração automática e precisam ser adicionados
 * manualmente (Novo Lançamento/Recalcular). Nunca falha a sincronização por causa disso
 * — se não há nenhum colaborador resolvido, o evento fica sem lançamento (card vazio),
 * mas o evento em si já foi criado com sucesso.
 */
async function gerarLancamentosAutomaticos(eventId: string) {
  const { collaboratorIds, ambiguidades } = await resolverParticipantesAutomaticosEvento(eventId);
  await registrarAmbiguidadesParticipantes(eventId, ambiguidades);
  if (collaboratorIds.length === 0) return;

  await gerarLancamentosParaEvento({ eventId, collaboratorIds });
}

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

      if (jaExiste) {
        await gerarLancamentosAutomaticos(jaExiste.id);
        continue;
      }

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
          // Closer: prioriza FK real (ContratoComercial.usuarioId) — só cai para nome manual
          // quando não há vínculo formal (ex: só existe registro no CS&NPS).
          closerUsuarioId: merged.usuarioIdCloser,
          closerNomeManual: merged.usuarioIdCloser ? null : merged.closerNome,
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

      // Lançamentos automáticos só para closer/analista responsável (únicos resolvidos com
      // confiança) — demais cargos do Big Card ficam para adição manual.
      await gerarLancamentosAutomaticos(evento.id);

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

      // Closer: herdado do evento de CONTRATAÇÃO já sincronizado para o mesmo cliente (já
      // resolvido lá via merge ContratoComercial+clientes) — evita duplicar a lógica de merge.
      const eventoContratacao = await db.commissionEvent.findFirst({
        where: { clienteId, eventType: "CONTRACTING" },
        select: { closerUsuarioId: true, closerNomeManual: true },
        orderBy: { createdAt: "desc" },
      });

      // Analista responsável + dados de tentativas: FK real via BusinessProcess quando existir.
      const processo = await db.businessProcess.findFirst({
        where: { clienteId },
        select: { id: true, analistaResponsavelId: true, tentativas: true, deferidoPrimeiraTentativa: true },
      });

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
          closerUsuarioId: eventoContratacao?.closerUsuarioId ?? null,
          closerNomeManual: eventoContratacao?.closerUsuarioId ? null : (eventoContratacao?.closerNomeManual ?? cliente.closerNome),
          analistaResponsavelUsuarioId: processo?.analistaResponsavelId ?? null,
          analistaResponsavelNomeManual: processo?.analistaResponsavelId ? null : cliente.analistaResponsavel,
          businessProcessId: processo?.id ?? null,
        },
      });

      // Sem BusinessProcess correspondente: faltam tentativas/responsáveis — divergência.
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

      // Lançamentos automáticos só para closer/analista responsável (únicos resolvidos com
      // confiança) — demais cargos do Big Card ficam para adição manual.
      await gerarLancamentosAutomaticos(evento.id);

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

  // Reconcilia eventos de êxito já existentes. Isso permite que vínculos adicionados ao
  // BusinessProcess (auxiliar/auditor/diretor) passem a aparecer sem recriar o evento.
  const exitosExistentes = await db.commissionEvent.findMany({
    where: { eventType: "PROCESS_SUCCESS" },
    select: { id: true },
    take: 500,
  });
  for (const evento of exitosExistentes) {
    try {
      await gerarLancamentosAutomaticos(evento.id);
    } catch (err) {
      totalErrors++;
      await db.syncError.create({
        data: {
          syncRunId: syncRun.id,
          sourceEntity: "reconciliacao-exito",
          sourceId: evento.id,
          mensagem: err instanceof Error ? err.message : "Erro ao reconciliar participantes do êxito.",
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
