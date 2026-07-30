"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { detectarDivergenciasDeEvento } from "@/lib/commissions/divergence-detector";
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
  const acesso = await exigirAcesso("VISUALIZAR");
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

    const [registros, total] = await Promise.all([
      db.commissionDivergence.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.commissionDivergence.count({ where }),
    ]);

    // Enriquece com contexto legível (razão social/serviço do evento, nome do colaborador)
    // — a UI nunca deveria precisar mostrar cuid/clienteId cru para o usuário final.
    const eventIds = [...new Set(registros.map((d) => d.eventId).filter((id): id is string => id !== null))];
    const entryIds = [...new Set(registros.map((d) => d.entryId).filter((id): id is string => id !== null))];

    const [eventos, entradas] = await Promise.all([
      eventIds.length > 0
        ? db.commissionEvent.findMany({
            where: { id: { in: eventIds } },
            select: { id: true, razaoSocial: true, servico: true },
          })
        : Promise.resolve([]),
      entryIds.length > 0
        ? db.commissionEntry.findMany({
            where: { id: { in: entryIds } },
            select: { id: true, collaboratorId: true },
          })
        : Promise.resolve([]),
    ]);

    const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
    const collaboratorIdPorEntry = new Map(entradas.map((e) => [e.id, e.collaboratorId]));
    const collaboratorIds = [...new Set(entradas.map((e) => e.collaboratorId))];

    const colaboradores = collaboratorIds.length > 0
      ? await db.usuarios.findMany({ where: { id: { in: collaboratorIds } }, select: { id: true, nome: true } })
      : [];
    const nomePorColaboradorId = new Map(colaboradores.map((u) => [u.id, u.nome]));

    const data = registros.map((d) => {
      const evento = d.eventId ? eventoPorId.get(d.eventId) : undefined;
      const collaboratorId = d.entryId ? collaboratorIdPorEntry.get(d.entryId) : undefined;
      const colaboradorNome = collaboratorId !== undefined ? nomePorColaboradorId.get(collaboratorId) : undefined;

      return {
        ...d,
        contexto: {
          razaoSocial: evento?.razaoSocial ?? null,
          servico: evento?.servico ?? null,
          colaboradorNome: colaboradorNome ?? null,
        },
      };
    });

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
  const acesso = await exigirAcesso("APROVAR");
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
  const acesso = await exigirAcesso("APROVAR");
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
