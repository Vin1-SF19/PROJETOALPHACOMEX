"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { detectarDivergenciasDeEvento } from "@/lib/commissions/divergence-detector";

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

async function registrarAuditoria(params: {
  userId: number;
  acao: string;
  entityId: string;
  before: unknown;
  after: unknown;
}) {
  await db.commissionAuditLog.create({
    data: {
      userId: params.userId,
      acao: params.acao,
      entityType: "CommissionDivergence",
      entityId: params.entityId,
      beforeJson: JSON.stringify(params.before),
      afterJson: JSON.stringify(params.after),
      correlationId: crypto.randomUUID(),
    },
  });
}

const listarDivergenciasSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  severidade: z.enum(["PENDING_REVIEW", "BLOCKED", "INTEGRATION_ERROR"]).optional(),
  tipo: z.string().optional(),
  resolvido: z.boolean().optional(),
});

export async function ListarDivergencias(input?: z.infer<typeof listarDivergenciasSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listarDivergenciasSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { page, pageSize, severidade, tipo, resolvido } = parsed.data;

  try {
    const where: Prisma.CommissionDivergenceWhereInput = {
      ...(severidade ? { severidade } : {}),
      ...(tipo ? { tipo } : {}),
      ...(resolvido === true ? { resolvidoEm: { not: null } } : {}),
      ...(resolvido === false ? { resolvidoEm: null } : {}),
    };

    const [data, total] = await Promise.all([
      db.commissionDivergence.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.commissionDivergence.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    } as const;
  } catch (error) {
    console.error("[ListarDivergencias]", error);
    return { success: false, error: "Erro interno ao listar divergências" } as const;
  }
}

const resolverDivergenciaSchema = z.object({
  divergenciaId: z.string().min(1),
  observacao: z.string().optional(),
});

export async function ResolverDivergencia(input: z.infer<typeof resolverDivergenciaSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = resolverDivergenciaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const divergencia = await db.commissionDivergence.findUnique({ where: { id: parsed.data.divergenciaId } });
    if (!divergencia) return { success: false, error: "Divergência não encontrada" } as const;

    if (divergencia.resolvidoEm) {
      return { success: false, error: "Divergência já foi resolvida anteriormente" } as const;
    }

    const atualizado = await db.commissionDivergence.update({
      where: { id: parsed.data.divergenciaId },
      data: {
        resolvidoEm: new Date(),
        resolvidoById: acesso.userId,
        ...(parsed.data.observacao ? { detalhes: `${divergencia.detalhes}\n\nResolução: ${parsed.data.observacao}` } : {}),
      },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "RESOLVER_DIVERGENCIA",
      entityId: parsed.data.divergenciaId,
      before: { resolvidoEm: divergencia.resolvidoEm, detalhes: divergencia.detalhes },
      after: { resolvidoEm: atualizado.resolvidoEm, observacao: parsed.data.observacao ?? null },
    });

    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[ResolverDivergencia]", error);
    return { success: false, error: "Erro interno ao resolver divergência" } as const;
  }
}

const reprocessarSchema = z.object({ divergenciaId: z.string().min(1) });

/**
 * Rechama a detecção real antes de marcar como resolvida — nunca permite marcar uma
 * divergência como resolvida sem re-checagem factual (evita "resolver" no papel um
 * problema que ainda existe no dado real).
 */
export async function ReprocessarAposCorrecao(input: z.infer<typeof reprocessarSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = reprocessarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const divergencia = await db.commissionDivergence.findUnique({ where: { id: parsed.data.divergenciaId } });
    if (!divergencia) return { success: false, error: "Divergência não encontrada" } as const;

    if (!divergencia.eventId) {
      return {
        success: false,
        error: "Esta divergência não está associada a um evento — não é possível reprocessar automaticamente.",
      } as const;
    }

    const divergenciasAtuais = await detectarDivergenciasDeEvento(divergencia.eventId);
    const aindaExiste = divergenciasAtuais.some((d) => d.tipo === divergencia.tipo);

    if (aindaExiste) {
      return {
        success: true,
        data: { resolvida: false, motivo: "A divergência ainda existe nos dados reais — não foi marcada como resolvida." },
      } as const;
    }

    const atualizado = await db.commissionDivergence.update({
      where: { id: parsed.data.divergenciaId },
      data: { resolvidoEm: new Date(), resolvidoById: acesso.userId },
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "REPROCESSAR_DIVERGENCIA_RESOLVIDA",
      entityId: parsed.data.divergenciaId,
      before: { resolvidoEm: divergencia.resolvidoEm },
      after: { resolvidoEm: atualizado.resolvidoEm },
    });

    return { success: true, data: { resolvida: true, divergencia: atualizado } } as const;
  } catch (error) {
    console.error("[ReprocessarAposCorrecao]", error);
    return { success: false, error: "Erro interno ao reprocessar divergência" } as const;
  }
}
