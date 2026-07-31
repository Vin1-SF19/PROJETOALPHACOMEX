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

const filtrosSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  periodoInicio: z.coerce.date().optional(),
  periodoFim: z.coerce.date().optional(),
  eventType: z.string().optional(),
  componentType: z.string().optional(),
  vinculo: z.string().optional(),
  setor: z.string().optional(),
  cargo: z.string().optional(),
  colaboradorId: z.number().int().positive().optional(),
  formaPagamento: z.string().optional(),
  status: z.string().optional(),
});

export type CommissionDashboardFilters = z.infer<typeof filtrosSchema>;

const listarEventosSchema = filtrosSchema.extend({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
});

function diaSeguinte(data: Date) {
  const resultado = new Date(data);
  resultado.setUTCHours(0, 0, 0, 0);
  resultado.setUTCDate(resultado.getUTCDate() + 1);
  return resultado;
}

function inicioDia(data: Date) {
  const resultado = new Date(data);
  resultado.setUTCHours(0, 0, 0, 0);
  return resultado;
}

async function construirWhere(filtros: CommissionDashboardFilters) {
  const and: Prisma.CommissionEventWhereInput[] = [];
  const entryWhere: Prisma.CommissionEntryWhereInput = {};

  if (filtros.periodoInicio || filtros.periodoFim) {
    and.push({
      eventDate: {
        ...(filtros.periodoInicio ? { gte: inicioDia(filtros.periodoInicio) } : {}),
        ...(filtros.periodoFim ? { lt: diaSeguinte(filtros.periodoFim) } : {}),
      },
    });
  }
  if (filtros.eventType) and.push({ eventType: filtros.eventType });
  if (filtros.formaPagamento) and.push({ formaPagamento: filtros.formaPagamento });
  if (filtros.componentType) {
    entryWhere.componentes = { some: { tipo: filtros.componentType } };
  }
  if (filtros.vinculo) entryWhere.vinculo = filtros.vinculo;
  if (filtros.status) entryWhere.status = filtros.status;
  if (filtros.colaboradorId) entryWhere.collaboratorId = filtros.colaboradorId;

  let idsPorEstrutura: number[] | null = null;
  if (filtros.cargo || filtros.setor) {
    let cargosPermitidos: string[] | undefined;
    if (filtros.setor) {
      const setor = await db.setor.findFirst({ where: { nome: filtros.setor }, select: { id: true } });
      const cargos = setor
        ? await db.cargoColaborador.findMany({
            where: { setorId: setor.id },
            select: { nome: true },
          })
        : [];
      cargosPermitidos = cargos.map((cargo) => cargo.nome);
    }
    const usuarios = await db.usuarios.findMany({
      where: {
        ...(filtros.cargo ? { cargo: filtros.cargo } : {}),
        ...(filtros.setor
          ? {
              OR: [
                { role: filtros.setor.toUpperCase() },
                ...(cargosPermitidos?.length ? [{ cargo: { in: cargosPermitidos } }] : []),
              ],
            }
          : {}),
      },
      select: { id: true },
    });
    idsPorEstrutura = usuarios.map((usuario) => usuario.id);
    entryWhere.collaboratorId = {
      in: idsPorEstrutura.length ? idsPorEstrutura : [-1],
    };
  }

  if (filtros.busca) {
    const usuarios = await db.usuarios.findMany({
      where: {
        OR: [
          { nome: { contains: filtros.busca } },
          { cargo: { contains: filtros.busca } },
        ],
      },
      select: { id: true },
    });
    const idsBusca = usuarios.map((usuario) => usuario.id);
    and.push({
      OR: [
        { cnpj: { contains: filtros.busca } },
        { razaoSocial: { contains: filtros.busca } },
        { nomeFantasia: { contains: filtros.busca } },
        { servico: { contains: filtros.busca } },
        ...(idsBusca.length ? [{ entries: { some: { collaboratorId: { in: idsBusca } } } }] : []),
      ],
    });
  }

  if (Object.keys(entryWhere).length > 0) and.push({ entries: { some: entryWhere } });

  return {
    eventWhere: and.length ? ({ AND: and } satisfies Prisma.CommissionEventWhereInput) : {},
    entryWhere,
  };
}

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

export async function ListarEventosComissao(input?: z.input<typeof listarEventosSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listarEventosSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { page, pageSize, ...filtros } = parsed.data;

  try {
    const { eventWhere } = await construirWhere(filtros);
    const [data, total] = await Promise.all([
      db.commissionEvent.findMany({
        where: eventWhere,
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
        orderBy: [{ eventDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.commissionEvent.count({ where: eventWhere }),
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

export async function BuscarOpcoesFiltrosComissao() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const [usuarios, cargos, eventos] = await Promise.all([
      db.usuarios.findMany({
        select: { id: true, nome: true, cargo: true },
        orderBy: { nome: "asc" },
      }),
      db.cargoColaborador.findMany({
        where: { ativo: true },
        select: { nome: true },
        orderBy: { nome: "asc" },
      }),
      db.commissionEvent.findMany({
        where: { formaPagamento: { not: null } },
        distinct: ["formaPagamento"],
        select: { formaPagamento: true },
        orderBy: { formaPagamento: "asc" },
      }),
    ]);
    return {
      success: true,
      data: {
        usuarios,
        cargos: [...new Set([...cargos.map((cargo) => cargo.nome), ...usuarios.map((usuario) => usuario.cargo).filter((cargo): cargo is string => Boolean(cargo))])].sort(),
        formasPagamento: eventos.map((evento) => evento.formaPagamento).filter((forma): forma is string => Boolean(forma)),
      },
    } as const;
  } catch (error) {
    console.error("[BuscarOpcoesFiltrosComissao]", error);
    return { success: false, error: "Erro ao carregar opções de filtros" } as const;
  }
}

export async function CalcularIndicadoresComissao(input?: z.input<typeof filtrosSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = filtrosSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false, error: "Filtros inválidos" } as const;

  try {
    const agora = new Date();
    const { eventWhere, entryWhere } = await construirWhere(parsed.data);
    const whereEntryBase: Prisma.CommissionEntryWhereInput = {
      ...entryWhere,
      event: eventWhere,
    };
    const periodoPagamento: Prisma.DateTimeFilter = {
      ...(parsed.data.periodoInicio ? { gte: inicioDia(parsed.data.periodoInicio) } : {}),
      ...(parsed.data.periodoFim ? { lt: diaSeguinte(parsed.data.periodoFim) } : {}),
    };

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
      db.commissionEvent.count({ where: eventWhere }),
      db.commissionEntry.count({ where: { ...whereEntryBase, status: "Pendente" } }),
      db.commissionEntry.count({ where: { ...whereEntryBase, status: "Pago" } }),
      db.commissionEntry.count({
        where: { ...whereEntryBase, status: { in: ["Pendente", "Programado"] }, contractualDueDate: { lt: agora } },
      }),
      db.commissionEntry.count({ where: { ...whereEntryBase, status: "Bloqueado" } }),
      db.commissionDivergence.count({
        where: { resolvidoEm: null, tipo: { not: "SERVICO_SEM_TARIFARIO" }, event: eventWhere },
      }),
      db.commissionEntry.findMany({
        where: { ...whereEntryBase, status: { in: ["Pendente", "ParcialmentePago", "Programado", "Vencido"] } },
        select: { totalCents: true, alocacoes: { select: { valorCents: true } } },
      }),
      db.paymentAllocation.findMany({
        where: {
          entry: whereEntryBase,
          payment: {
            tipo: "PAGAMENTO",
            ...(Object.keys(periodoPagamento).length ? { data: periodoPagamento } : {}),
          },
        },
        select: { valorCents: true },
      }),
    ]);

    const valorPrevistoCents = entriesAbertas.reduce(
      (sum, entry) =>
        sum + Math.max(0, entry.totalCents - entry.alocacoes.reduce((pago, alocacao) => pago + alocacao.valorCents, 0)),
      0,
    );
    const valorPagoNoPeriodoCents = alocacoesPagas.reduce((sum, alocacao) => sum + alocacao.valorCents, 0);

    return {
      success: true,
      data: {
        totalEventos,
        totalPendente,
        totalPago,
        totalVencido,
        totalBloqueado,
        totalDivergencias,
        valorPrevistoCents,
        valorPagoNoPeriodoCents,
      } satisfies IndicadoresComissao,
    } as const;
  } catch (error) {
    console.error("[CalcularIndicadoresComissao]", error);
    return { success: false, error: "Erro interno ao calcular indicadores" } as const;
  }
}
