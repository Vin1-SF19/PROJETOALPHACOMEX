import { z } from "zod";

import db from "@/lib/prisma";
import type { CommissionRuleVersionData, EventType } from "./types";

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "EQUALS", "NOT_EQUALS", "GREATER_THAN", "GREATER_THAN_OR_EQUAL",
    "LESS_THAN", "LESS_THAN_OR_EQUAL", "CONTAINS", "IN", "BETWEEN",
    "EXISTS", "NOT_EXISTS", "BEFORE", "AFTER",
  ]),
  value: z.unknown().optional(),
});

const calculationSchema = z.object({
  type: z.enum(["PERCENTAGE", "FIXED", "PER_UNIT", "ADDITIONAL", "DSR", "CAP", "FLOOR", "PROPORTIONAL", "SUM_OF_COMPONENTS", "TOTAL_FIXO_COM_DSR"]),
  benefitType: z.enum(["COMMISSION", "BONUS", "DSR"]),
  rate: z.number().min(0).max(1).optional(),
  baseCalculo: z.enum(["VALOR_BRUTO", "VALOR_LIQUIDO"]).optional(),
  fixedAmountCents: z.number().int().optional(),
  perUnitAmountCents: z.number().int().optional(),
  quantity: z.number().optional(),
  capCents: z.number().int().optional(),
  floorCents: z.number().int().optional(),
  proportion: z.number().min(0).max(1).optional(),
  componentsCents: z.array(z.number().int()).optional(),
  dsrFormulaName: z.string().optional(),
  totalFixoComDsrCents: z.number().int().optional(),
});

const paymentScheduleSchema = z.object({ scheduleRuleName: z.string().min(1) });

export interface CarregarRegrasPublicadasParams {
  eventType: string;
  eventDate: Date;
  collaboratorId: number;
  cargoId: number | null;
  setorId?: number | null;
  servico: string;
}

/** Carrega somente a última versão publicada e vigente de cada regra persistida. */
export async function carregarRegrasComissaoPublicadas(
  params: CarregarRegrasPublicadasParams,
): Promise<CommissionRuleVersionData[]> {
  const regras = await db.commissionRule.findMany({
    where: {
      active: true,
      eventType: params.eventType,
      AND: [
        { OR: [{ collaboratorId: null }, { collaboratorId: params.collaboratorId }] },
        { OR: [{ cargoId: null }, { cargoId: params.cargoId ?? undefined }] },
        { OR: [{ setorId: null }, { setorId: params.setorId ?? undefined }] },
        { OR: [{ servico: null }, { servico: params.servico }] },
      ],
    },
    include: {
      versoes: {
        where: {
          status: "PUBLISHED",
          validFrom: { lte: params.eventDate },
          OR: [{ validTo: null }, { validTo: { gte: params.eventDate } }],
        },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  return regras.flatMap(({ versoes, ...regra }) => {
    const versao = versoes[0];
    if (!versao) return [];
    const conditions = z.array(conditionSchema).safeParse(JSON.parse(versao.conditionsJson));
    const calculation = calculationSchema.safeParse(JSON.parse(versao.calculationJson));
    const paymentSchedule = paymentScheduleSchema.safeParse(JSON.parse(versao.paymentScheduleJson));
    if (!conditions.success || !calculation.success || !paymentSchedule.success) {
      throw new Error(`Regra de comissão publicada inválida: ${regra.name} v${versao.version}.`);
    }
    return [{
      ruleId: regra.id,
      ruleName: regra.name,
      version: versao.version,
      ruleVersionId: versao.id,
      eventType: regra.eventType as EventType,
      benefitType: regra.benefitType as CommissionRuleVersionData["benefitType"],
      priority: regra.priority,
      cargoId: regra.cargoId,
      setorId: regra.setorId,
      collaboratorId: regra.collaboratorId,
      servico: regra.servico,
      conditions: conditions.data,
      calculation: calculation.data,
      paymentSchedule: paymentSchedule.data,
      approvalRequired: regra.approvalRequired,
      active: regra.active,
    } satisfies CommissionRuleVersionData];
  });
}
