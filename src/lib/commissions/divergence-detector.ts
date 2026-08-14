import db from "@/lib/prisma";
import { classifyPrecedenceLevel, evaluateRules } from "./rule-engine";
import { calculateCommissionableBase } from "./commissionable-base";
import { resolverVinculoNaData } from "./vinculo-resolver";
import { regrasSeedDoCargo } from "./cargo-rule-matching";
import type { ContratoColaboradorRecord } from "./vinculo-resolver";

/**
 * Detecção sistemática de divergências (seção 28 do prompt original — 14 checagens).
 * Nunca calcula silenciosamente quando o dado puder alterar o resultado financeiro.
 *
 * ⚠️ Limitação documentada: "analista sem nível" usa heurística de nome de cargo
 * (contém "Sênior"/"Senior"/"II"/"Auxiliar" quando o cargo começa com "Analista") — se
 * não for possível determinar com confiança, NÃO gera falso positivo (não sinaliza).
 *
 * ⚠️ Limitação documentada: `SyncError` (schema da Fase 02) não tem campo de "resolvido"
 * — a checagem de "erro de integração" considera qualquer SyncError associado ao
 * `sourceId` do evento como divergência ativa, sem conceito de resolução automática.
 */

export type DivergenceType =
  | "EMPRESA_SEM_CNPJ"
  | "CONTRATO_SEM_VALOR"
  | "SERVICO_SEM_TARIFARIO"
  | "COLABORADOR_SEM_CARGO"
  | "COLABORADOR_SEM_VINCULO_VIGENTE"
  | "ANALISTA_SEM_NIVEL"
  | "EVENTO_DUPLICADO"
  | "EXITO_SEM_CONTRATACAO"
  | "REGRAS_CONFLITANTES"
  | "REGRA_NAO_ENCONTRADA"
  | "DESCONTO_INCONSISTENTE"
  | "PAGAMENTO_SUPERIOR_AO_VALOR"
  | "PRIMEIRA_TENTATIVA_INCONSISTENTE"
  | "DADOS_IMPORTADOS_ALTERADOS"
  | "ERRO_DE_INTEGRACAO";

export type DivergenceSeverity = "PENDING_REVIEW" | "BLOCKED" | "INTEGRATION_ERROR";

export interface DetectedDivergence {
  tipo: DivergenceType;
  severidade: DivergenceSeverity;
  detalhes: string;
  entryId?: string;
}

export async function detectarDivergenciasDeEvento(eventId: string): Promise<DetectedDivergence[]> {
  const event = await db.commissionEvent.findUnique({ where: { id: eventId } });
  if (!event) return [];

  const divergencias: DetectedDivergence[] = [];

  // 1. Empresa sem CNPJ
  if (!event.cnpj || event.cnpj.trim() === "") {
    divergencias.push({
      tipo: "EMPRESA_SEM_CNPJ",
      severidade: "BLOCKED",
      detalhes: `Evento ${event.id} não possui CNPJ registrado.`,
    });
  }

  // 2. Contrato sem valor/honorários
  if (event.grossContractAmountCents <= 0) {
    divergencias.push({
      tipo: "CONTRATO_SEM_VALOR",
      severidade: "BLOCKED",
      detalhes: `Evento ${event.id} (${event.razaoSocial}) não possui valor de contrato registrado (grossContractAmountCents = ${event.grossContractAmountCents}).`,
    });
  }

  // `grossContractAmountCents` já é o tarifário/honorário bruto trazido pelo
  // contrato nos adapters de Metas e CS/NPS. Exigir também uma TariffVersion criava
  // um falso positivo. Ausência de valor continua coberta por CONTRATO_SEM_VALOR.

  // Lançamentos associados a este evento — usados por várias checagens abaixo.
  const entries = await db.commissionEntry.findMany({
    where: { eventId: event.id },
    include: { componentes: true, alocacoes: true },
  });

  for (const entry of entries) {
    const usuario = await db.usuarios.findUnique({
      where: { id: entry.collaboratorId },
      select: { cargo: true },
    });

    // 4. Colaborador sem cargo
    if (!usuario?.cargo || usuario.cargo.trim() === "") {
      divergencias.push({
        tipo: "COLABORADOR_SEM_CARGO",
        severidade: "PENDING_REVIEW",
        detalhes: `Colaborador ${entry.collaboratorId} não possui cargo definido em usuarios.cargo.`,
        entryId: entry.id,
      });
    }

    // 5. Colaborador sem vínculo vigente
    const contratos = await db.contratoColaborador.findMany({
      where: { usuarioId: entry.collaboratorId },
      select: { id: true, usuarioId: true, tipo: true, dataInicio: true, dataFim: true },
    });
    const vinculo = resolverVinculoNaData(contratos as ContratoColaboradorRecord[], entry.collaboratorId, event.eventDate);
    if (vinculo.status === "SEM_VINCULO_VIGENTE") {
      divergencias.push({
        tipo: "COLABORADOR_SEM_VINCULO_VIGENTE",
        severidade: "PENDING_REVIEW",
        detalhes: `Colaborador ${entry.collaboratorId}: ${vinculo.motivo}`,
        entryId: entry.id,
      });
    }

    // 6. Analista sem nível (heurística — nunca gera falso positivo se não tiver confiança)
    if (usuario?.cargo?.trim().toLowerCase().startsWith("analista")) {
      const cargoNormalizado = usuario.cargo.toLowerCase();
      const temNivelReconhecido =
        cargoNormalizado.includes("sênior") ||
        cargoNormalizado.includes("senior") ||
        cargoNormalizado.includes(" ii") ||
        cargoNormalizado.includes("auxiliar");
      if (!temNivelReconhecido) {
        divergencias.push({
          tipo: "ANALISTA_SEM_NIVEL",
          severidade: "PENDING_REVIEW",
          detalhes: `Cargo "${usuario.cargo}" começa com "Analista" mas não indica nível reconhecido (Sênior/II/Auxiliar).`,
          entryId: entry.id,
        });
      }
    }

    // 12. Pagamento superior ao valor
    const totalPagoCents = entry.alocacoes.reduce((sum, a) => sum + a.valorCents, 0);
    if (totalPagoCents > entry.totalCents) {
      divergencias.push({
        tipo: "PAGAMENTO_SUPERIOR_AO_VALOR",
        severidade: "BLOCKED",
        detalhes: `Lançamento ${entry.id}: total pago (${totalPagoCents}) excede o valor devido (${entry.totalCents}).`,
        entryId: entry.id,
      });
    }
  }

  // 7. Evento duplicado (camada extra de segurança além da unique constraint do schema)
  const possivelDuplicado = await db.commissionEvent.findFirst({
    where: {
      cnpj: event.cnpj,
      servico: event.servico,
      eventType: event.eventType,
      NOT: { id: event.id },
    },
  });
  if (possivelDuplicado) {
    divergencias.push({
      tipo: "EVENTO_DUPLICADO",
      severidade: "PENDING_REVIEW",
      detalhes: `Evento ${event.id} parece duplicado com ${possivelDuplicado.id} (mesmo cnpj+servico+eventType).`,
    });
  }

  // 8. Êxito sem contratação
  if (event.eventType === "PROCESS_SUCCESS" && event.clienteServicoId !== null) {
    const contratacaoPrevia = await db.commissionEvent.findFirst({
      where: { clienteServicoId: event.clienteServicoId, servico: event.servico, eventType: "CONTRACTING" },
    });
    if (!contratacaoPrevia) {
      divergencias.push({
        tipo: "EXITO_SEM_CONTRATACAO",
        severidade: "PENDING_REVIEW",
        detalhes: `Evento de êxito para clienteServicoId=${event.clienteServicoId} sem evento de contratação correspondente para o serviço "${event.servico}".`,
      });
    }
  }

  // 9. Regras conflitantes — 2+ regras da MESMA precedência e MESMA priority casando ao mesmo tempo.
  for (const entry of entries) {
    const usuario = await db.usuarios.findUnique({ where: { id: entry.collaboratorId }, select: { cargo: true } });
    if (!usuario?.cargo) continue;

    const regras = regrasSeedDoCargo(usuario.cargo, event.eventType);
    const facts = {
      servico: event.servico,
      formaPagamento: event.formaPagamento,
      dataContratacao: event.eventDate.toISOString(),
    };

    const candidatas = regras.filter((r) => {
      try {
        return evaluateRules([r], facts).matchedRule !== null;
      } catch {
        return false;
      }
    });

    const empatadas = candidatas.filter(
      (r) =>
        candidatas.some(
          (outra) =>
            outra !== r &&
            classifyPrecedenceLevel(outra) === classifyPrecedenceLevel(r) &&
            outra.priority === r.priority &&
            outra.benefitType === r.benefitType,
        ),
    );

    if (empatadas.length > 0) {
      divergencias.push({
        tipo: "REGRAS_CONFLITANTES",
        severidade: "PENDING_REVIEW",
        detalhes: `Colaborador ${entry.collaboratorId}: ${empatadas.length} regra(s) empatadas em precedência e prioridade para o mesmo tipo de benefício — não é possível desempatar automaticamente.`,
        entryId: entry.id,
      });
    }
  }

  // 10. Regra não encontrada (verificação idempotente pós-fato — entry-generator já cobre no momento da geração)
  for (const entry of entries) {
    if (entry.status === "EmDivergencia" && entry.totalCents === 0) {
      const jaRegistrada = await db.commissionDivergence.findFirst({
        where: { entryId: entry.id, tipo: "REGRA_NAO_ENCONTRADA_OU_APROVACAO_PENDENTE", resolvidoEm: null },
      });
      if (jaRegistrada) {
        divergencias.push({
          tipo: "REGRA_NAO_ENCONTRADA",
          severidade: "PENDING_REVIEW",
          detalhes: `Lançamento ${entry.id} permanece sem regra aplicável (confirmado na verificação pós-fato).`,
          entryId: entry.id,
        });
      }
    }
  }

  // 11. Desconto inconsistente
  if (event.discountAmountCents < 0) {
    divergencias.push({
      tipo: "DESCONTO_INCONSISTENTE",
      severidade: "BLOCKED",
      detalhes: `Evento ${event.id}: discountAmountCents negativo (${event.discountAmountCents}) — dado inconsistente.`,
    });
  } else if (event.grossContractAmountCents > 0) {
    const baseCheck = calculateCommissionableBase({
      tariffAmountCents: event.grossContractAmountCents,
      contractAmountCents: event.netContractAmountCents,
      formaPagamento: "A_VISTA_DESCONTO",
      preservaTarifarioEmDescontoAte10: true,
    });
    if (baseCheck.requiresApproval) {
      divergencias.push({
        tipo: "DESCONTO_INCONSISTENTE",
        severidade: "PENDING_REVIEW",
        detalhes: baseCheck.reason,
      });
    }
  }

  // 13. Primeira tentativa inconsistente
  if (event.eventType === "FIRST_ATTEMPT_SUCCESS" && event.clienteServicoId !== null) {
    const processo = await db.businessProcess.findFirst({ where: { clienteServicoId: event.clienteServicoId } });
    if (!processo || !processo.deferidoPrimeiraTentativa) {
      divergencias.push({
        tipo: "PRIMEIRA_TENTATIVA_INCONSISTENTE",
        severidade: "PENDING_REVIEW",
        detalhes: `Evento FIRST_ATTEMPT_SUCCESS para clienteServicoId=${event.clienteServicoId} sem BusinessProcess.deferidoPrimeiraTentativa=true correspondente.`,
      });
    }
  }

  // 14. Alteração de dados importados (sourceUpdatedAt mudou sem re-sincronização)
  if (event.sourceUpdatedAt && event.lastSyncAt && event.sourceUpdatedAt > event.lastSyncAt) {
    divergencias.push({
      tipo: "DADOS_IMPORTADOS_ALTERADOS",
      severidade: "PENDING_REVIEW",
      detalhes: `Evento ${event.id}: sourceUpdatedAt (${event.sourceUpdatedAt.toISOString()}) é mais recente que lastSyncAt (${event.lastSyncAt.toISOString()}) — dado pode estar desatualizado, recomenda-se re-sincronizar.`,
    });
  }

  // 15. Erro de integração — qualquer SyncError associado ao sourceId deste evento.
  const errosDeIntegracao = await db.syncError.findMany({ where: { sourceId: event.sourceId } });
  if (errosDeIntegracao.length > 0) {
    divergencias.push({
      tipo: "ERRO_DE_INTEGRACAO",
      severidade: "INTEGRATION_ERROR",
      detalhes: `${errosDeIntegracao.length} erro(s) de sincronização registrado(s) para sourceId="${event.sourceId}": ${errosDeIntegracao[0].mensagem}`,
    });
  }

  return divergencias;
}

/**
 * Persiste as divergências detectadas, evitando duplicar uma divergência já registrada
 * e não resolvida para o mesmo eventId+tipo (idempotente).
 */
export async function persistirDivergenciasDetectadas(eventId: string): Promise<number> {
  const detectadas = await detectarDivergenciasDeEvento(eventId);
  let novasCriadas = 0;

  // Reconcilia o falso positivo legado na próxima sincronização do evento.
  await db.commissionDivergence.updateMany({
    where: { eventId, tipo: "SERVICO_SEM_TARIFARIO", resolvidoEm: null },
    data: { resolvidoEm: new Date() },
  });

  for (const divergencia of detectadas) {
    const jaExiste = await db.commissionDivergence.findFirst({
      where: { eventId, tipo: divergencia.tipo, resolvidoEm: null },
    });

    if (jaExiste) continue;

    await db.commissionDivergence.create({
      data: {
        eventId,
        entryId: divergencia.entryId,
        tipo: divergencia.tipo,
        severidade: divergencia.severidade,
        detalhes: divergencia.detalhes,
      },
    });
    novasCriadas++;
  }

  return novasCriadas;
}
