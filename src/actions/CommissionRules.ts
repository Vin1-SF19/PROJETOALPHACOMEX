"use server";

import { auth } from "../../auth";
import { z } from "zod";
import { evaluateRules } from "@/lib/commissions/rule-engine";
import { calculateAmountCents } from "@/lib/commissions/calculators";
import { calculateCommissionableBase } from "@/lib/commissions/commissionable-base";
import { buildCalculationMemory, type CalculationMemory } from "@/lib/commissions/calculation-memory";
import { calcularPaymentSchedule } from "@/lib/commissions/payment-schedule";
import { regrasSeedDoCargo } from "@/lib/commissions/cargo-rule-matching";
import type { CommissionRuleVersionData, FactRecord } from "@/lib/commissions/types";

/**
 * TODO(Fase 14 — Configurações/RBAC granular): mesma verificação de role temporária
 * documentada em `src/actions/CommissionSync.ts`.
 */
const ROLES_TEMPORARIAMENTE_PERMITIDOS = ["Admin", "CEO", "FINANCEIRO"];

async function exigirAcesso() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES_TEMPORARIAMENTE_PERMITIDOS.includes(role)) {
    return { ok: false as const, error: "Sem permissão" };
  }

  return { ok: true as const, userId: Number(session.user.id) };
}

const EVENT_TYPES = [
  "CONTRACTING",
  "PROCESS_STARTED",
  "PROCESS_SUCCESS",
  "FIRST_ATTEMPT_SUCCESS",
  "AUXILIARY_PARTICIPATION",
  "MANUAL_EVENT",
  "CANCELLATION",
  "REVERSAL",
] as const;

const simularRegraSchema = z.object({
  servico: z.string().min(1),
  tarifarioCents: z.number().int().nonnegative(),
  valorContratadoCents: z.number().int().nonnegative(),
  descontoPercentual: z.number().min(0).max(1).optional(),
  formaPagamento: z.enum(["PARCELADO_CONTRATACAO_EXITO", "CARTAO_PARCELADO", "A_VISTA_DESCONTO"]),
  cargoNome: z.string().min(1),
  eventType: z.enum(EVENT_TYPES),
  dataEvento: z.coerce.date(),
  primeiraTentativa: z.boolean().optional(),
  vinculo: z.enum(["CLT", "PJ"]),
});

export type SimularRegraInput = z.infer<typeof simularRegraSchema>;

export interface SimulacaoPorTipo {
  benefitType: "COMMISSION" | "BONUS" | "DSR";
  regrasCandidatas: string[];
  regraVencedora: string | null;
  calculatedAmountCents: number | null;
  memoria: CalculationMemory | null;
}

export interface SimularRegraResult {
  base: ReturnType<typeof calculateCommissionableBase> | null;
  resultadosPorTipo: SimulacaoPorTipo[];
  contractualDueDate: Date | null;
  operationalSuggestedDate: Date | null;
  alertas: string[];
}

function factsDaSimulacao(input: SimularRegraInput): FactRecord {
  return {
    servico: input.servico,
    formaPagamento: input.formaPagamento,
    dataContratacao: input.dataEvento.toISOString(),
    fechadoNoTarifarioOuAcima: input.valorContratadoCents >= input.tarifarioCents,
    auditorParticipacaoAutomatica: input.servico.toUpperCase().includes("RADAR"),
    deferidoPrimeiraTentativa: input.primeiraTentativa ?? false,
  };
}

/**
 * Simula o resultado do motor de regras para uma combinação hipotética de
 * serviço/tarifário/valor/desconto/forma de pagamento/cargo/data/evento — SEM PERSISTIR
 * NADA no banco (seção 27 do prompt original).
 *
 * TODO(Fase 14 — Construtor de Regras): esta versão simula apenas contra as seed-rules
 * (Fase 04). Comparação "regra atual vigente vs. rascunho não publicado" depende do
 * construtor visual de regras (CommissionRuleVersion com status DRAFT/PUBLISHED), que
 * ainda não existe — implementar quando a Fase 14 estiver pronta.
 */
export async function SimularRegra(input: SimularRegraInput) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = simularRegraSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const dados = parsed.data;
  const alertas: string[] = [];

  const regrasDoCargo = regrasSeedDoCargo(dados.cargoNome, dados.eventType);

  if (regrasDoCargo.length === 0) {
    alertas.push(`Nenhuma regra ativa encontrada para o cargo "${dados.cargoNome}" no evento "${dados.eventType}".`);
  }

  const facts = factsDaSimulacao(dados);

  const benefitTypes: Array<CommissionRuleVersionData["benefitType"]> = ["COMMISSION", "BONUS", "DSR"];
  const resultadosPorTipo: SimulacaoPorTipo[] = [];

  let base: ReturnType<typeof calculateCommissionableBase> | null = null;
  let precisaBase = false;

  for (const benefitType of benefitTypes) {
    const regrasDoTipo = regrasDoCargo.filter((r) => r.benefitType === benefitType);

    if (regrasDoTipo.length === 0) continue;

    const resultado = evaluateRules(regrasDoTipo, facts);

    if (!resultado.matchedRule) {
      resultadosPorTipo.push({
        benefitType,
        regrasCandidatas: regrasDoTipo.map((r) => r.ruleName),
        regraVencedora: null,
        calculatedAmountCents: null,
        memoria: null,
      });
      alertas.push(`Regras de ${benefitType} existem para este cargo, mas nenhuma condição casou com os dados informados.`);
      continue;
    }

    const rule = resultado.matchedRule;

    if ((rule.calculation.type === "PERCENTAGE" || rule.calculation.type === "PROPORTIONAL") && !precisaBase) {
      precisaBase = true;
      base = calculateCommissionableBase({
        tariffAmountCents: dados.tarifarioCents,
        contractAmountCents: dados.valorContratadoCents,
        formaPagamento: dados.formaPagamento,
        preservaTarifarioEmDescontoAte10: true,
      });

      if (base.requiresApproval) {
        alertas.push(base.reason);
      }
    }

    const dsrInput =
      rule.calculation.type === "DSR"
        ? { baseAmountCents: base?.commissionableBaseCents ?? 0, diasUteis: 22, diasNaoUteis: 9 }
        : undefined;

    let calculatedAmountCents: number | null = null;
    try {
      calculatedAmountCents = calculateAmountCents(rule.calculation, {
        commissionableBaseCents: base?.commissionableBaseCents,
        dsrInput,
      });
    } catch (err) {
      alertas.push(err instanceof Error ? err.message : `Erro ao calcular ${benefitType}.`);
    }

    const memoria =
      calculatedAmountCents !== null
        ? buildCalculationMemory({ rule, calculatedAmountCents, base: base ?? undefined })
        : null;

    resultadosPorTipo.push({
      benefitType,
      regrasCandidatas: regrasDoTipo.map((r) => r.ruleName),
      regraVencedora: rule.ruleName,
      calculatedAmountCents,
      memoria,
    });
  }

  const primeiroVencedor = resultadosPorTipo.find((r) => r.regraVencedora !== null);
  let contractualDueDate: Date | null = null;
  let operationalSuggestedDate: Date | null = null;

  if (primeiroVencedor) {
    const schedule = calcularPaymentSchedule({
      tipoBeneficio: primeiroVencedor.benefitType === "COMMISSION" ? "COMISSAO" : primeiroVencedor.benefitType === "DSR" ? "DSR" : "PREMIO",
      vinculo: dados.vinculo,
      dataEvento: dados.dataEvento,
    });
    contractualDueDate = schedule.contractualDueDate;
    operationalSuggestedDate = schedule.operationalSuggestedDate;
  }

  const result: SimularRegraResult = {
    base,
    resultadosPorTipo,
    contractualDueDate,
    operationalSuggestedDate,
    alertas,
  };

  return { success: true, data: result } as const;
}
