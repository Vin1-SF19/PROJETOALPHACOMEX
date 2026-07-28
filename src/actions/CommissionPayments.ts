"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";

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

/**
 * Status que NUNCA podem receber pagamento (nem individual, nem em lote).
 * "ParcialmentePago" fica de fora desta lista para pagamento INDIVIDUAL (pode receber
 * o restante), mas é excluído do LOTE (seção 20: "parcialmente pagos sem conferência"
 * exige revisão manual, não entra silenciosamente).
 */
const STATUS_BLOQUEADOS_PARA_PAGAMENTO = ["Pago", "Cancelado", "Bloqueado", "EmDivergencia", "Estornado"];

async function registrarAuditoria(params: {
  userId: number;
  acao: string;
  entityId: string;
  before: unknown;
  after: unknown;
  correlationId: string;
}) {
  await db.commissionAuditLog.create({
    data: {
      userId: params.userId,
      acao: params.acao,
      entityType: "CommissionEntry",
      entityId: params.entityId,
      beforeJson: JSON.stringify(params.before),
      afterJson: JSON.stringify(params.after),
      correlationId: params.correlationId,
    },
  });
}

/** Saldo líquido pago de um lançamento = soma de todas as PaymentAllocation (estornos entram com valor negativo). */
async function calcularSaldoPagoCents(entryId: string): Promise<number> {
  const alocacoes = await db.paymentAllocation.findMany({ where: { entryId }, select: { valorCents: true } });
  return alocacoes.reduce((sum, a) => sum + a.valorCents, 0);
}

// ─── RegistrarPagamento (individual) ───

const registrarPagamentoSchema = z.object({
  entryId: z.string().min(1),
  data: z.coerce.date(),
  valorCents: z.number().int().positive(),
  meio: z.string().min(1),
  referencia: z.string().optional(),
  observacao: z.string().optional(),
  comprovanteUrl: z.string().url().optional(),
});

export async function RegistrarPagamento(input: z.infer<typeof registrarPagamentoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = registrarPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { entryId, data, valorCents, meio, referencia, observacao, comprovanteUrl } = parsed.data;

  try {
    const entry = await db.commissionEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: "Lançamento não encontrado" } as const;

    if (STATUS_BLOQUEADOS_PARA_PAGAMENTO.includes(entry.status)) {
      return { success: false, error: `Lançamento com status "${entry.status}" não pode receber pagamento.` } as const;
    }

    const correlationId = crypto.randomUUID();
    const statusAntes = entry.status;

    const payment = await db.payment.create({
      data: {
        data,
        valorCents,
        meio,
        referencia,
        observacao,
        comprovanteUrl,
        usuarioResponsavelId: acesso.userId,
        tipo: "PAGAMENTO",
      },
    });

    await db.paymentAllocation.create({
      data: { paymentId: payment.id, entryId, valorCents },
    });

    const saldoPago = await calcularSaldoPagoCents(entryId);
    const novoStatus = saldoPago >= entry.totalCents ? "Pago" : "ParcialmentePago";

    const entryAtualizado = await db.commissionEntry.update({
      where: { id: entryId },
      data: { status: novoStatus, actualPaymentDate: data },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "REGISTRAR_PAGAMENTO",
      entityId: entryId,
      before: { status: statusAntes },
      after: { status: novoStatus, paymentId: payment.id, valorCents },
      correlationId,
    });

    return { success: true, data: { payment, entry: entryAtualizado, saldoPago } } as const;
  } catch (error) {
    console.error("[RegistrarPagamento]", error);
    return { success: false, error: "Erro interno ao registrar pagamento" } as const;
  }
}

// ─── Preview e Lote ───

export interface ItemElegivelPagamentoLote {
  entryId: string;
  valorPendenteCents: number;
}

export interface ItemExcluidoPagamentoLote {
  entryId: string;
  motivo: string;
}

async function classificarEntriesParaLote(
  entryIds: string[],
): Promise<{ elegiveis: ItemElegivelPagamentoLote[]; excluidos: ItemExcluidoPagamentoLote[] }> {
  const elegiveis: ItemElegivelPagamentoLote[] = [];
  const excluidos: ItemExcluidoPagamentoLote[] = [];

  for (const entryId of entryIds) {
    const entry = await db.commissionEntry.findUnique({ where: { id: entryId } });

    if (!entry) {
      excluidos.push({ entryId, motivo: "Lançamento não encontrado" });
      continue;
    }

    if (entry.status === "Pago") {
      excluidos.push({ entryId, motivo: "Já está pago" });
      continue;
    }
    if (entry.status === "Cancelado") {
      excluidos.push({ entryId, motivo: "Lançamento cancelado" });
      continue;
    }
    if (entry.status === "Bloqueado") {
      excluidos.push({ entryId, motivo: "Lançamento bloqueado" });
      continue;
    }
    if (entry.status === "EmDivergencia") {
      excluidos.push({ entryId, motivo: "Lançamento em divergência — resolva antes de pagar" });
      continue;
    }
    if (entry.status === "Estornado") {
      excluidos.push({ entryId, motivo: "Lançamento estornado" });
      continue;
    }
    if (entry.status === "ParcialmentePago") {
      excluidos.push({ entryId, motivo: "Parcialmente pago — requer conferência manual, não entra em lote" });
      continue;
    }

    const saldoPago = await calcularSaldoPagoCents(entryId);
    const valorPendenteCents = entry.totalCents - saldoPago;

    if (valorPendenteCents <= 0) {
      excluidos.push({ entryId, motivo: "Saldo pendente zerado ou negativo" });
      continue;
    }

    elegiveis.push({ entryId, valorPendenteCents });
  }

  return { elegiveis, excluidos };
}

const listaEntryIdsSchema = z.object({ entryIds: z.array(z.string().min(1)).min(1) });

export async function PrepararPagamentoLoteBigCard(input: z.infer<typeof listaEntryIdsSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listaEntryIdsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const { elegiveis, excluidos } = await classificarEntriesParaLote(parsed.data.entryIds);
    const totalCents = elegiveis.reduce((sum, e) => sum + e.valorPendenteCents, 0);

    return { success: true, data: { elegiveis, excluidos, totalCents } } as const;
  } catch (error) {
    console.error("[PrepararPagamentoLoteBigCard]", error);
    return { success: false, error: "Erro interno ao preparar pagamento em lote" } as const;
  }
}

const registrarPagamentoLoteSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1),
  data: z.coerce.date(),
  meio: z.string().min(1),
  observacao: z.string().optional(),
});

export async function RegistrarPagamentoLote(input: z.infer<typeof registrarPagamentoLoteSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = registrarPagamentoLoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { entryIds, data, meio, observacao } = parsed.data;

  try {
    const { elegiveis, excluidos } = await classificarEntriesParaLote(entryIds);

    const processados: string[] = [];

    for (const item of elegiveis) {
      const entry = await db.commissionEntry.findUnique({ where: { id: item.entryId } });
      if (!entry) continue;

      const correlationId = crypto.randomUUID();
      const statusAntes = entry.status;

      const payment = await db.payment.create({
        data: {
          data,
          valorCents: item.valorPendenteCents,
          meio,
          observacao,
          usuarioResponsavelId: acesso.userId,
          tipo: "PAGAMENTO",
        },
      });

      await db.paymentAllocation.create({
        data: { paymentId: payment.id, entryId: item.entryId, valorCents: item.valorPendenteCents },
      });

      await db.commissionEntry.update({
        where: { id: item.entryId },
        data: { status: "Pago", actualPaymentDate: data },
      });

      await registrarAuditoria({
        userId: acesso.userId,
        acao: "REGISTRAR_PAGAMENTO_LOTE",
        entityId: item.entryId,
        before: { status: statusAntes },
        after: { status: "Pago", paymentId: payment.id, valorCents: item.valorPendenteCents },
        correlationId,
      });

      processados.push(item.entryId);
    }

    return { success: true, data: { processados, excluidos } } as const;
  } catch (error) {
    console.error("[RegistrarPagamentoLote]", error);
    return { success: false, error: "Erro interno ao registrar pagamento em lote" } as const;
  }
}

// ─── ProgramarPagamento ───

const programarPagamentoSchema = z.object({
  entryId: z.string().min(1),
  scheduledPaymentDate: z.coerce.date(),
});

export async function ProgramarPagamento(input: z.infer<typeof programarPagamentoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = programarPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const entry = await db.commissionEntry.findUnique({ where: { id: parsed.data.entryId } });
    if (!entry) return { success: false, error: "Lançamento não encontrado" } as const;

    if (STATUS_BLOQUEADOS_PARA_PAGAMENTO.includes(entry.status)) {
      return { success: false, error: `Lançamento com status "${entry.status}" não pode ser programado.` } as const;
    }

    const correlationId = crypto.randomUUID();

    const atualizado = await db.commissionEntry.update({
      where: { id: parsed.data.entryId },
      data: { status: "Programado", scheduledPaymentDate: parsed.data.scheduledPaymentDate },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "PROGRAMAR_PAGAMENTO",
      entityId: parsed.data.entryId,
      before: { status: entry.status },
      after: { status: "Programado", scheduledPaymentDate: parsed.data.scheduledPaymentDate },
      correlationId,
    });

    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[ProgramarPagamento]", error);
    return { success: false, error: "Erro interno ao programar pagamento" } as const;
  }
}

// ─── EstornarPagamento ───

/**
 * Convenção de estorno: o Payment de estorno tem `valorCents` NEGATIVO (mesmo sinal do
 * valor original invertido) e `tipo: "ESTORNO"` + `estornoDeId` apontando para o Payment
 * original. Isso permite calcular o saldo líquido pago de um lançamento somando
 * simplesmente todos os `PaymentAllocation.valorCents` (estornos subtraem
 * automaticamente), sem precisar checar `tipo` em toda leitura de saldo — ver
 * `calcularSaldoPagoCents` acima. O Payment original NUNCA é alterado/apagado.
 */
const estornarPagamentoSchema = z.object({
  paymentId: z.string().min(1),
  motivo: z.string().min(1, "Motivo do estorno é obrigatório"),
});

export async function EstornarPagamento(input: z.infer<typeof estornarPagamentoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = estornarPagamentoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const paymentOriginal = await db.payment.findUnique({ where: { id: parsed.data.paymentId } });
    if (!paymentOriginal) return { success: false, error: "Pagamento não encontrado" } as const;

    if (paymentOriginal.tipo === "ESTORNO") {
      return { success: false, error: "Não é possível estornar um estorno" } as const;
    }

    const jaEstornado = await db.payment.findFirst({
      where: { estornoDeId: paymentOriginal.id },
      select: { id: true },
    });
    if (jaEstornado) {
      return { success: false, error: "Este pagamento já foi estornado anteriormente" } as const;
    }

    const alocacaoOriginal = await db.paymentAllocation.findFirst({
      where: { paymentId: paymentOriginal.id },
    });
    if (!alocacaoOriginal) {
      return { success: false, error: "Alocação original do pagamento não encontrada" } as const;
    }

    const entryId = alocacaoOriginal.entryId;
    const entry = await db.commissionEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: "Lançamento associado não encontrado" } as const;

    const correlationId = crypto.randomUUID();
    const statusAntes = entry.status;

    const estorno = await db.payment.create({
      data: {
        data: new Date(),
        valorCents: -alocacaoOriginal.valorCents,
        meio: paymentOriginal.meio,
        observacao: parsed.data.motivo,
        usuarioResponsavelId: acesso.userId,
        tipo: "ESTORNO",
        estornoDeId: paymentOriginal.id,
      },
    });

    await db.paymentAllocation.create({
      data: { paymentId: estorno.id, entryId, valorCents: -alocacaoOriginal.valorCents },
    });

    const saldoPago = await calcularSaldoPagoCents(entryId);
    const novoStatus = saldoPago <= 0 ? "Pendente" : "ParcialmentePago";

    const entryAtualizado = await db.commissionEntry.update({
      where: { id: entryId },
      data: { status: novoStatus },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "ESTORNAR_PAGAMENTO",
      entityId: entryId,
      before: { status: statusAntes, paymentId: paymentOriginal.id },
      after: { status: novoStatus, estornoId: estorno.id },
      correlationId,
    });

    return { success: true, data: { estorno, entry: entryAtualizado, saldoPago } } as const;
  } catch (error) {
    console.error("[EstornarPagamento]", error);
    return { success: false, error: "Erro interno ao estornar pagamento" } as const;
  }
}
