"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const listarEventosSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  busca: z.string().optional(),
  /** Filtro de período por mês (seção 1 do desenho do usuário) — "YYYY-MM", filtra por CommissionEvent.eventDate. */
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export interface EventoComissaoResumo {
  id: string;
  eventType: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  servico: string;
  eventDate: Date;
  status: string;
  netContractAmountCents: number;
}

export async function ListarEventosComissao(input?: z.infer<typeof listarEventosSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listarEventosSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { page, pageSize, busca, mesReferencia } = parsed.data;

  try {
    const where: Prisma.CommissionEventWhereInput = {
      ...(busca?.trim()
        ? {
            OR: [
              { cnpj: { contains: busca } },
              { razaoSocial: { contains: busca } },
              { nomeFantasia: { contains: busca } },
              { servico: { contains: busca } },
            ],
          }
        : {}),
      ...(mesReferencia
        ? (() => {
            const [ano, mes] = mesReferencia.split("-").map(Number);
            const inicio = new Date(Date.UTC(ano, mes - 1, 1));
            const fim = new Date(Date.UTC(ano, mes, 1));
            return { eventDate: { gte: inicio, lt: fim } };
          })()
        : {}),
    };

    const [data, total] = await Promise.all([
      db.commissionEvent.findMany({
        where,
        select: {
          id: true,
          eventType: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
          servico: true,
          eventDate: true,
          status: true,
          netContractAmountCents: true,
        },
        orderBy: { eventDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.commissionEvent.count({ where }),
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
    console.error("[ListarEventosComissao]", error);
    return { success: false, error: "Erro interno ao listar eventos" } as const;
  }
}

export interface IndicadoresComissao {
  totalEventos: number;
  totalPendente: number;
  totalPago: number;
  totalVencido: number;
  totalBloqueado: number;
  totalDivergencias: number;
  valorPrevistoCents: number;
  valorPagoNoPeriodoCents: number;
}

export async function CalcularIndicadoresComissao() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const agora = new Date();

    const [
      totalEventos,
      totalPendente,
      totalPago,
      totalVencido,
      totalBloqueado,
      totalDivergencias,
      entriesAbertas,
      alocacoesPagas,
    ] = await Promise.all([
      db.commissionEvent.count(),
      db.commissionEntry.count({ where: { status: "Pendente" } }),
      db.commissionEntry.count({ where: { status: "Pago" } }),
      db.commissionEntry.count({ where: { status: "Pendente", contractualDueDate: { lt: agora } } }),
      db.commissionEntry.count({ where: { status: "Bloqueado" } }),
      db.commissionDivergence.count({ where: { resolvidoEm: null } }),
      db.commissionEntry.findMany({
        where: { status: { in: ["Pendente", "ParcialmentePago", "Programado"] } },
        select: { totalCents: true },
      }),
      db.paymentAllocation.findMany({
        where: {
          payment: {
            tipo: "PAGAMENTO",
            data: { gte: new Date(agora.getFullYear(), agora.getMonth(), 1) },
          },
        },
        select: { valorCents: true },
      }),
    ]);

    const valorPrevistoCents = entriesAbertas.reduce((sum, e) => sum + e.totalCents, 0);
    const valorPagoNoPeriodoCents = alocacoesPagas.reduce((sum, a) => sum + a.valorCents, 0);

    const indicadores: IndicadoresComissao = {
      totalEventos,
      totalPendente,
      totalPago,
      totalVencido,
      totalBloqueado,
      totalDivergencias,
      valorPrevistoCents,
      valorPagoNoPeriodoCents,
    };

    return { success: true, data: indicadores } as const;
  } catch (error) {
    console.error("[CalcularIndicadoresComissao]", error);
    return { success: false, error: "Erro interno ao calcular indicadores" } as const;
  }
}
