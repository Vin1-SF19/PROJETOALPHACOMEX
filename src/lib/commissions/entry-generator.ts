import db from "@/lib/prisma";
import { evaluateRules } from "./rule-engine";
import { calculateAmountCents } from "./calculators";
import { calculateCommissionableBase } from "./commissionable-base";
import { buildCalculationMemory } from "./calculation-memory";
import { calcularPaymentSchedule } from "./payment-schedule";
import { buscarColaboradorNaData } from "./adapters/colaboradores-adapter";
import { resolverEligibilityOverride } from "./eligibility-filter";
import { regrasSeedDoCargo } from "./cargo-rule-matching";
import type { CommissionRuleVersionData, FactRecord } from "./types";
import type { EligibilityOverrideRecord } from "./eligibility-filter";

/**
 * Gera CommissionEntry + EntryComponent[] a partir de um CommissionEvent já persistido
 * (Fase 06) e uma lista de colaboradores candidatos. Sempre separa comissão/prêmio/DSR
 * como componentes distintos — nunca soma num único valor (seção 30 do prompt original).
 *
 * Ordem de checagem por colaborador: (1) EligibilityOverride vigente (bloqueio/exclusão/
 * substituição de valor/percentual têm prioridade — ver eligibility-filter.ts) → (2) se
 * nenhum override decisivo, roda o motor de regras normal (rule-engine + seed-rules).
 * Se nenhuma regra casar, o lançamento nasce em divergência (nunca zero silencioso).
 */

export interface GerarLancamentosParams {
  eventId: string;
  /** IDs de usuarios candidatos a receber comissão/prêmio/DSR por este evento. */
  collaboratorIds: number[];
}

export interface GerarLancamentosResult {
  entriesCreated: number;
  entriesSkipped: number;
  divergencesCreated: number;
}

/**
 * `fechadoNoTarifarioOuAcima` (seção 9.1 do prompt — usada por Closer/Coordenadora
 * Comercial) é aproximada aqui por `netContractAmountCents >= grossContractAmountCents`
 * (fechou sem desconto ou acima do tarifário). É uma SIMPLIFICAÇÃO — quando `TariffVersion`
 * (schema já existe desde a Fase 02) estiver integrado por serviço/data na Fase 14, este
 * fato deve comparar contra o tarifário vigente real do serviço, não contra o próprio
 * `grossContractAmountCents` do evento (que hoje É o tarifário, por definição do adapter
 * da Fase 06 — ver `metas-adapter.ts`/`cs-nps-adapter.ts`).
 */
/**
 * `auditorParticipacaoAutomatica` (seção 11.4 do prompt — "pode ser automática para
 * Revisão de RADAR, mas deve ser configurável") — SIMPLIFICAÇÃO nesta fase: assumida
 * `true` para qualquer serviço "Revisão de RADAR" até a Fase 14 (Configurações) expor
 * um flag real e persistido por serviço/cargo. Nunca tratar como decisão definitiva.
 */
function toRuleConditionsFacts(event: {
  servico: string;
  formaPagamento: string | null;
  eventDate: Date;
  grossContractAmountCents: number;
  netContractAmountCents: number;
}): FactRecord {
  return {
    servico: event.servico,
    formaPagamento: event.formaPagamento,
    dataContratacao: event.eventDate.toISOString(),
    fechadoNoTarifarioOuAcima: event.netContractAmountCents >= event.grossContractAmountCents,
    auditorParticipacaoAutomatica: event.servico.toUpperCase().includes("RADAR"),
  };
}

async function buscarOverridesVigentes(query: {
  collaboratorId: number;
  cargoId: number | null;
  clienteId: number | null;
  contratoComercialId: string | null;
}): Promise<EligibilityOverrideRecord[]> {
  const rows = await db.eligibilityOverride.findMany({
    where: {
      OR: [
        { collaboratorId: query.collaboratorId },
        { cargoId: query.cargoId ?? undefined },
        { clienteId: query.clienteId ?? undefined },
        { contratoComercialId: query.contratoComercialId ?? undefined },
        { collaboratorId: null, cargoId: null, clienteId: null, contratoComercialId: null },
      ],
    },
  });

  return rows as unknown as EligibilityOverrideRecord[];
}

export async function gerarLancamentosParaEvento(params: GerarLancamentosParams): Promise<GerarLancamentosResult> {
  const { eventId, collaboratorIds } = params;

  const event = await db.commissionEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error(`CommissionEvent ${eventId} não encontrado.`);
  }

  let entriesCreated = 0;
  let entriesSkipped = 0;
  let divergencesCreated = 0;

  for (const collaboratorId of collaboratorIds) {
    // Não duplicar lançamento já existente para este evento+colaborador (recálculo seguro).
    const entryExistente = await db.commissionEntry.findFirst({
      where: { eventId, collaboratorId },
      select: { id: true, status: true },
    });

    if (entryExistente && (entryExistente.status === "Pago" || entryExistente.status === "ParcialmentePago")) {
      entriesSkipped++;
      continue;
    }

    const colaborador = await buscarColaboradorNaData(collaboratorId, event.eventDate);
    if (!colaborador) {
      entriesSkipped++;
      continue;
    }

    const overrides = await buscarOverridesVigentes({
      collaboratorId,
      cargoId: colaborador.cargoId,
      clienteId: event.clienteId,
      contratoComercialId: event.contratoComercialId,
    });

    const decisao = resolverEligibilityOverride(overrides, {
      collaboratorId,
      cargoId: colaborador.cargoId,
      clienteId: event.clienteId,
      contratoComercialId: event.contratoComercialId,
      servico: event.servico,
      eventType: event.eventType,
      dataEvento: event.eventDate,
    });

    if (decisao?.action === "BLOQUEAR" || decisao?.action === "EXCLUIR") {
      entriesSkipped++;
      continue;
    }

    if (decisao?.action === "AGUARDANDO_APROVACAO") {
      await criarLancamentoDivergente({
        eventId,
        collaboratorId,
        cargoId: colaborador.cargoId ?? 0,
        vinculo: "CLT",
        motivo: `EligibilityOverride ${decisao.override.id} requer aprovação antes de calcular este lançamento.`,
      });
      divergencesCreated++;
      continue;
    }

    if (colaborador.vinculoResolution.status !== "RESOLVIDO") {
      await criarLancamentoDivergente({
        eventId,
        collaboratorId,
        cargoId: colaborador.cargoId ?? 0,
        vinculo: "CLT",
        motivo: `Vínculo CLT/PJ não pôde ser resolvido: ${colaborador.vinculoResolution.status}.`,
      });
      divergencesCreated++;
      continue;
    }

    const vinculo = colaborador.vinculoResolution.vinculo;

    // Regras candidatas — seed-rules (Fase 04) filtradas por cargo REAL do colaborador
    // (casamento por nome, ver cargo-rule-matching.ts) e eventType.
    const regrasDoCargo = colaborador.cargoNome
      ? regrasSeedDoCargo(colaborador.cargoNome, event.eventType, colaborador.cargoId)
      : [];

    if (regrasDoCargo.length === 0) {
      await criarLancamentoDivergente({
        eventId,
        collaboratorId,
        cargoId: colaborador.cargoId ?? 0,
        vinculo,
        motivo: `Nenhuma regra aplicável encontrada para cargo="${colaborador.cargoNome ?? "desconhecido"}", eventType=${event.eventType}.`,
      });
      divergencesCreated++;
      continue;
    }

    const facts = toRuleConditionsFacts(event);

    // Cada benefitType (COMMISSION/DSR/BONUS) é avaliado em um grupo SEPARADO —
    // comissão, DSR e prêmio nunca competem entre si na precedência, e cada um vira
    // um EntryComponent independente (nunca somados). Um único CommissionEntry agrega
    // todos os componentes do colaborador para este evento.
    const benefitTypes: Array<CommissionRuleVersionData["benefitType"]> = ["COMMISSION", "BONUS", "DSR"];
    const componentesParaCriar: Array<{ tipo: string; valorCents: number; percentual: number | null; memoriaCalculoJson: string }> = [];
    let divergenciaNesteColaborador: string | null = null;

    for (const benefitType of benefitTypes) {
      const regrasDoTipo = regrasDoCargo.filter((r) => r.benefitType === benefitType);
      if (regrasDoTipo.length === 0) continue; // este cargo não tem regra deste tipo para este evento — normal, não é divergência

      const resultado = evaluateRules(regrasDoTipo, facts);
      if (!resultado.matchedRule) continue; // condições não bateram para nenhuma regra deste tipo — normal

      const rule = resultado.matchedRule;

      let commissionableBaseCents: number | undefined;
      let baseResult: ReturnType<typeof calculateCommissionableBase> | undefined;

      if (rule.calculation.type === "PERCENTAGE" || rule.calculation.type === "PROPORTIONAL") {
        baseResult = calculateCommissionableBase({
          tariffAmountCents: event.grossContractAmountCents,
          contractAmountCents: event.netContractAmountCents,
          formaPagamento: "PARCELADO_CONTRATACAO_EXITO",
          preservaTarifarioEmDescontoAte10: true,
        });

        if (baseResult.requiresApproval) {
          divergenciaNesteColaborador = baseResult.reason;
          break;
        }

        commissionableBaseCents = baseResult.commissionableBaseCents;
      }

      const dsrInput =
        rule.calculation.type === "DSR"
          ? { baseAmountCents: commissionableBaseCents ?? 0, diasUteis: 22, diasNaoUteis: 9 }
          : undefined;

      let valorCents: number;
      try {
        valorCents = calculateAmountCents(rule.calculation, { commissionableBaseCents, dsrInput });
      } catch (err) {
        divergenciaNesteColaborador = err instanceof Error ? err.message : "Erro ao calcular valor do lançamento.";
        break;
      }

      if (decisao?.action === "SUBSTITUIR_VALOR") valorCents = decisao.valorCents;
      if (decisao?.action === "SUBSTITUIR_PERCENTUAL" && commissionableBaseCents !== undefined) {
        valorCents = Math.round(commissionableBaseCents * decisao.percentual);
      }

      const memoria = buildCalculationMemory({ rule, calculatedAmountCents: valorCents, base: baseResult });

      componentesParaCriar.push({
        tipo: benefitType === "COMMISSION" ? "COMISSAO" : benefitType === "DSR" ? "DSR" : "PREMIO",
        valorCents,
        percentual: rule.calculation.rate ?? null,
        memoriaCalculoJson: JSON.stringify(memoria),
      });
    }

    if (divergenciaNesteColaborador) {
      await criarLancamentoDivergente({
        eventId,
        collaboratorId,
        cargoId: colaborador.cargoId ?? 0,
        vinculo,
        motivo: divergenciaNesteColaborador,
      });
      divergencesCreated++;
      continue;
    }

    if (componentesParaCriar.length === 0) {
      await criarLancamentoDivergente({
        eventId,
        collaboratorId,
        cargoId: colaborador.cargoId ?? 0,
        vinculo,
        motivo: `Regras encontradas para cargo="${colaborador.cargoNome}" mas nenhuma condição casou para eventType=${event.eventType}.`,
      });
      divergencesCreated++;
      continue;
    }

    // Vencimento resolvido a partir do primeiro componente (COMISSAO/DSR seguem a mesma
    // regra CLT; PREMIO tem regra própria — se houver os dois tipos no mesmo lançamento,
    // o vencimento do Entry reflete o do primeiro componente processado; cada componente
    // mantém sua própria natureza na memória de cálculo).
    const tipoPrincipal = componentesParaCriar[0].tipo as "COMISSAO" | "DSR" | "PREMIO";
    const schedule = calcularPaymentSchedule({
      tipoBeneficio: tipoPrincipal === "COMISSAO" ? "COMISSAO" : tipoPrincipal === "DSR" ? "DSR" : "PREMIO",
      vinculo,
      dataEvento: event.eventDate,
    });

    const totalCents = componentesParaCriar.reduce((sum, c) => sum + c.valorCents, 0);

    const entry = entryExistente
      ? await db.commissionEntry.update({
          where: { id: entryExistente.id },
          data: {
            totalCents,
            status: "Pendente",
            contractualDueDate: schedule.contractualDueDate,
            operationalSuggestedDate: schedule.operationalSuggestedDate,
          },
        })
      : await db.commissionEntry.create({
          data: {
            eventId,
            collaboratorId,
            cargoId: colaborador.cargoId ?? 0,
            vinculo,
            totalCents,
            status: "Pendente",
            contractualDueDate: schedule.contractualDueDate,
            operationalSuggestedDate: schedule.operationalSuggestedDate,
          },
        });

    // Um EntryComponent por benefitType vencedor — nunca somados num único componente.
    for (const componente of componentesParaCriar) {
      await db.entryComponent.create({ data: { entryId: entry.id, ...componente } });
    }

    entriesCreated++;
  }

  return { entriesCreated, entriesSkipped, divergencesCreated };
}

async function criarLancamentoDivergente(params: {
  eventId: string;
  collaboratorId: number;
  cargoId: number;
  vinculo: "CLT" | "PJ";
  motivo: string;
}) {
  const entry = await db.commissionEntry.create({
    data: {
      eventId: params.eventId,
      collaboratorId: params.collaboratorId,
      cargoId: params.cargoId,
      vinculo: params.vinculo,
      totalCents: 0,
      status: "EmDivergencia",
    },
  });

  await db.commissionDivergence.create({
    data: {
      entryId: entry.id,
      tipo: "REGRA_NAO_ENCONTRADA_OU_APROVACAO_PENDENTE",
      severidade: "PENDING_REVIEW",
      detalhes: params.motivo,
    },
  });
}
