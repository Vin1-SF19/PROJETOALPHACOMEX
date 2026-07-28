"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { gerarLancamentosParaEvento } from "@/lib/commissions/entry-generator";

/**
 * TODO(Fase 14 — Configurações/RBAC granular): mesma verificação de role temporária
 * documentada em `src/actions/CommissionSync.ts` — substituir por `getPermissoesEfetivas`
 * + permissão específica do módulo assim que existir.
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

const criarEventoManualSchema = z.object({
  cnpj: z.string().min(1),
  razaoSocial: z.string().min(1),
  servico: z.string().min(1),
  eventDate: z.coerce.date(),
  grossContractAmountCents: z.number().int().nonnegative(),
  netContractAmountCents: z.number().int().nonnegative(),
  collaboratorIds: z.array(z.number().int().positive()).min(1),
});

export async function CriarEventoFinanceiro(input: z.infer<typeof criarEventoManualSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarEventoManualSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { collaboratorIds, ...eventData } = parsed.data;

  try {
    const event = await db.commissionEvent.create({
      data: {
        eventType: "MANUAL_EVENT",
        cnpj: eventData.cnpj,
        razaoSocial: eventData.razaoSocial,
        servico: eventData.servico,
        eventDate: eventData.eventDate,
        grossContractAmountCents: eventData.grossContractAmountCents,
        netContractAmountCents: eventData.netContractAmountCents,
        status: "OK",
        sourceSystem: "manual",
        sourceEntity: "lancamento-manual",
        sourceId: crypto.randomUUID(),
        lastSyncAt: new Date(),
      },
    });

    const resultado = await gerarLancamentosParaEvento({ eventId: event.id, collaboratorIds });

    return { success: true, data: { eventId: event.id, ...resultado } } as const;
  } catch (error) {
    console.error("[CriarEventoFinanceiro]", error);
    return { success: false, error: "Erro interno ao criar evento" } as const;
  }
}

const recalcularEventoSchema = z.object({
  eventId: z.string().min(1),
  collaboratorIds: z.array(z.number().int().positive()).min(1),
});

export async function RecalcularEvento(input: z.infer<typeof recalcularEventoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = recalcularEventoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const resultado = await gerarLancamentosParaEvento(parsed.data);
    return { success: true, data: resultado } as const;
  } catch (error) {
    console.error("[RecalcularEvento]", error);
    return { success: false, error: "Erro interno ao recalcular evento" } as const;
  }
}

const aprovarEventoSchema = z.object({ eventId: z.string().min(1) });

export async function AprovarEvento(input: z.infer<typeof aprovarEventoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = aprovarEventoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const event = await db.commissionEvent.findUnique({ where: { id: parsed.data.eventId }, select: { id: true } });
    if (!event) return { success: false, error: "Evento não encontrado" } as const;

    const updated = await db.commissionEvent.update({
      where: { id: parsed.data.eventId },
      data: { status: "OK" },
    });

    return { success: true, data: updated } as const;
  } catch (error) {
    console.error("[AprovarEvento]", error);
    return { success: false, error: "Erro interno ao aprovar evento" } as const;
  }
}
