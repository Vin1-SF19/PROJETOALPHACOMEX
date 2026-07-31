"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

async function registrarAuditoria(params: {
  userId: number;
  acao: string;
  entityType: "CommissionRule" | "CommissionRuleVersion";
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  await db.commissionAuditLog.create({
    data: {
      userId: params.userId,
      acao: params.acao,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeJson: JSON.stringify(params.before),
      afterJson: JSON.stringify(params.after),
      correlationId: crypto.randomUUID(),
    },
  });
}

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

const paymentScheduleSchema = z.object({
  scheduleRuleName: z.string().min(1),
});

const salvarRascunhoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().default(0),
  eventType: z.enum([
    "CONTRACTING", "PROCESS_STARTED", "PROCESS_SUCCESS", "FIRST_ATTEMPT_SUCCESS",
    "AUXILIARY_PARTICIPATION", "MANUAL_EVENT", "CANCELLATION", "REVERSAL",
  ]),
  benefitType: z.enum(["COMMISSION", "BONUS", "DSR"]),
  cargoId: z.number().int().positive().optional(),
  setorId: z.number().int().positive().optional(),
  collaboratorId: z.number().int().positive().optional(),
  servico: z.string().optional(),
  approvalRequired: z.boolean().default(false),
  conditions: z.array(conditionSchema),
  calculation: calculationSchema,
  paymentSchedule: paymentScheduleSchema,
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
});

/** Cria uma CommissionRule nova + sua primeira CommissionRuleVersion em status DRAFT. */
export async function SalvarRascunhoRegra(input: z.infer<typeof salvarRascunhoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = salvarRascunhoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { conditions, calculation, paymentSchedule, validFrom, validTo, ...ruleData } = parsed.data;

  try {
    const rule = await db.commissionRule.create({
      data: { ...ruleData, createdById: acesso.userId },
    });

    const versao = await db.commissionRuleVersion.create({
      data: {
        ruleId: rule.id,
        version: 1,
        status: "DRAFT",
        validFrom,
        validTo,
        conditionsJson: JSON.stringify(conditions),
        calculationJson: JSON.stringify(calculation),
        paymentScheduleJson: JSON.stringify(paymentSchedule),
      },
    });

    return { success: true, data: { rule, versao } } as const;
  } catch (error) {
    console.error("[SalvarRascunhoRegra]", error);
    return { success: false, error: "Erro interno ao salvar rascunho" } as const;
  }
}

const publicarRegraSchema = z.object({ versionId: z.string().min(1) });

/** Muda DRAFT→PUBLISHED. Nunca sobrescreve uma versão já publicada — se a versão alvo já estiver PUBLISHED, rejeita (use CriarVersaoRegra para editar). */
export async function PublicarRegra(input: z.infer<typeof publicarRegraSchema>) {
  const acesso = await exigirAcesso("APROVAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = publicarRegraSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const versao = await db.commissionRuleVersion.findUnique({ where: { id: parsed.data.versionId } });
    if (!versao) return { success: false, error: "Versão não encontrada" } as const;

    if (versao.status === "PUBLISHED") {
      return { success: false, error: "Esta versão já está publicada" } as const;
    }

    const atualizada = await db.commissionRuleVersion.update({
      where: { id: parsed.data.versionId },
      data: { status: "PUBLISHED", publishedById: acesso.userId, publishedAt: new Date() },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "PUBLICAR_REGRA",
      entityType: "CommissionRuleVersion",
      entityId: parsed.data.versionId,
      before: { status: versao.status },
      after: { status: atualizada.status, publishedAt: atualizada.publishedAt },
    });

    return { success: true, data: atualizada } as const;
  } catch (error) {
    console.error("[PublicarRegra]", error);
    return { success: false, error: "Erro interno ao publicar regra" } as const;
  }
}

const criarVersaoSchema = salvarRascunhoSchema
  .omit({ name: true, description: true, eventType: true, benefitType: true, cargoId: true, setorId: true, collaboratorId: true, servico: true, approvalRequired: true })
  .extend({
    ruleId: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    eventType: salvarRascunhoSchema.shape.eventType.optional(),
    benefitType: salvarRascunhoSchema.shape.benefitType.optional(),
    cargoId: z.number().int().positive().nullable().optional(),
    setorId: z.number().int().positive().nullable().optional(),
    collaboratorId: z.number().int().positive().nullable().optional(),
    servico: z.string().nullable().optional(),
    approvalRequired: z.boolean().optional(),
  });

/**
 * Cria uma NOVA CommissionRuleVersion para uma CommissionRule EXISTENTE, incrementando
 * `version`. NUNCA sobrescreve a versão anterior (mesmo que ela esteja PUBLISHED) — a
 * versão antiga permanece intacta no histórico até que a nova seja publicada.
 */
export async function CriarVersaoRegra(input: z.infer<typeof criarVersaoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarVersaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const {
    ruleId,
    conditions,
    calculation,
    paymentSchedule,
    priority,
    validFrom,
    validTo,
    ...rulePatch
  } = parsed.data;

  try {
    const rule = await db.commissionRule.findUnique({ where: { id: ruleId } });
    if (!rule) return { success: false, error: "Regra não encontrada" } as const;

    const ultimaVersao = await db.commissionRuleVersion.findFirst({
      where: { ruleId },
      orderBy: { version: "desc" },
    });

    const novaVersaoNumero = (ultimaVersao?.version ?? 0) + 1;

    if (priority !== rule.priority || Object.keys(rulePatch).length > 0) {
      await db.commissionRule.update({ where: { id: ruleId }, data: { priority, ...rulePatch } });
    }

    const novaVersao = await db.commissionRuleVersion.create({
      data: {
        ruleId,
        version: novaVersaoNumero,
        status: "DRAFT",
        validFrom,
        validTo,
        conditionsJson: JSON.stringify(conditions),
        calculationJson: JSON.stringify(calculation),
        paymentScheduleJson: JSON.stringify(paymentSchedule),
      },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "CRIAR_VERSAO_REGRA",
      entityType: "CommissionRule",
      entityId: ruleId,
      before: { ultimaVersao: ultimaVersao?.version ?? null, priority: rule.priority },
      after: { novaVersao: novaVersao.version, priority, ...rulePatch },
    });

    return { success: true, data: novaVersao } as const;
  } catch (error) {
    console.error("[CriarVersaoRegra]", error);
    return { success: false, error: "Erro interno ao criar nova versão" } as const;
  }
}

const inativarRegraSchema = z.object({ ruleId: z.string().min(1) });

/** Marca CommissionRule.active=false — preserva TODO o histórico de versões, nunca deleta. */
export async function InativarRegra(input: z.infer<typeof inativarRegraSchema>) {
  return AlterarStatusRegra({ ...input, active: false });
}

const alterarStatusRegraSchema = inativarRegraSchema.extend({ active: z.boolean() });

export async function AlterarStatusRegra(input: z.infer<typeof alterarStatusRegraSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = alterarStatusRegraSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const rule = await db.commissionRule.findUnique({ where: { id: parsed.data.ruleId } });
    if (!rule) return { success: false, error: "Regra não encontrada" } as const;

    const atualizada = await db.commissionRule.update({
      where: { id: parsed.data.ruleId },
      data: { active: parsed.data.active },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: parsed.data.active ? "REATIVAR_REGRA" : "INATIVAR_REGRA",
      entityType: "CommissionRule",
      entityId: parsed.data.ruleId,
      before: { active: rule.active },
      after: { active: atualizada.active },
    });

    return { success: true, data: atualizada } as const;
  } catch (error) {
    console.error("[AlterarStatusRegra]", error);
    return { success: false, error: `Erro interno ao ${parsed.data.active ? "reativar" : "inativar"} regra` } as const;
  }
}

export async function ReativarRegra(input: z.infer<typeof inativarRegraSchema>) {
  return AlterarStatusRegra({ ...input, active: true });
}

export async function ListarRegrasConfiguracao() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const regras = await db.commissionRule.findMany({
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: {
        versoes: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    return {
      success: true,
      data: regras.map(({ versoes, ...regra }) => ({
        ...regra,
        ultimaVersao: versoes[0] ?? null,
      })),
    } as const;
  } catch (error) {
    console.error("[ListarRegrasConfiguracao]", error);
    return { success: false, error: "Erro interno ao listar regras" } as const;
  }
}

const compararVersoesSchema = z.object({
  versionIdA: z.string().min(1),
  versionIdB: z.string().min(1),
});

export async function CompararVersoes(input: z.infer<typeof compararVersoesSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = compararVersoesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const [versaoA, versaoB] = await Promise.all([
      db.commissionRuleVersion.findUnique({ where: { id: parsed.data.versionIdA } }),
      db.commissionRuleVersion.findUnique({ where: { id: parsed.data.versionIdB } }),
    ]);

    if (!versaoA || !versaoB) {
      return { success: false, error: "Uma ou ambas as versões não foram encontradas" } as const;
    }

    return { success: true, data: { versaoA, versaoB } } as const;
  } catch (error) {
    console.error("[CompararVersoes]", error);
    return { success: false, error: "Erro interno ao comparar versões" } as const;
  }
}
