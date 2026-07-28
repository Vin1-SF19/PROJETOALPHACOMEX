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
      entityType: "CommissionEntry",
      entityId: params.entityId,
      beforeJson: JSON.stringify(params.before),
      afterJson: JSON.stringify(params.after),
      correlationId: crypto.randomUUID(),
    },
  });
}

export interface EntryComponentResumo {
  id: string;
  tipo: string;
  valorCents: number;
  percentual: number | null;
  memoriaCalculoJson: string;
}

export interface CommissionEntryComColaborador {
  id: string;
  collaboratorId: number;
  colaboradorNome: string;
  cargoNome: string | null;
  setorNome: string | null;
  vinculo: string;
  totalCents: number;
  status: string;
  contractualDueDate: Date | null;
  operationalSuggestedDate: Date | null;
  scheduledPaymentDate: Date | null;
  actualPaymentDate: Date | null;
  componentes: EntryComponentResumo[];
}

export interface EventoComLancamentosResult {
  event: {
    id: string;
    eventType: string;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    servico: string;
    eventDate: Date;
    formaPagamento: string | null;
    grossContractAmountCents: number;
    netContractAmountCents: number;
    commissionableBaseCents: number | null;
    status: string;
  };
  divergencias: Array<{ id: string; tipo: string; severidade: string; detalhes: string }>;
  setorComercial: CommissionEntryComColaborador[];
  setorOperacional: CommissionEntryComColaborador[];
  semSetor: CommissionEntryComColaborador[];
  totalGeralCents: number;
}

const buscarEventoSchema = z.object({ eventId: z.string().min(1) });

export async function BuscarEventoComLancamentos(input: z.infer<typeof buscarEventoSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = buscarEventoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const event = await db.commissionEvent.findUnique({ where: { id: parsed.data.eventId } });
    if (!event) return { success: false, error: "Evento não encontrado" } as const;

    const [entries, divergencias] = await Promise.all([
      db.commissionEntry.findMany({
        where: { eventId: event.id },
        include: { componentes: true },
      }),
      db.commissionDivergence.findMany({
        where: { eventId: event.id, resolvidoEm: null },
        select: { id: true, tipo: true, severidade: true, detalhes: true },
      }),
    ]);

    const setorComercial: CommissionEntryComColaborador[] = [];
    const setorOperacional: CommissionEntryComColaborador[] = [];
    const semSetor: CommissionEntryComColaborador[] = [];
    let totalGeralCents = 0;

    for (const entry of entries) {
      const usuario = await db.usuarios.findUnique({
        where: { id: entry.collaboratorId },
        select: { nome: true, cargo: true },
      });

      const cargoRow = usuario?.cargo
        ? await db.cargoColaborador.findUnique({
            where: { nome: usuario.cargo },
            select: { setorId: true },
          })
        : null;

      const setorRow = cargoRow?.setorId
        ? await db.setor.findUnique({ where: { id: cargoRow.setorId }, select: { nome: true } })
        : null;

      const entryResumo: CommissionEntryComColaborador = {
        id: entry.id,
        collaboratorId: entry.collaboratorId,
        colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
        cargoNome: usuario?.cargo ?? null,
        setorNome: setorRow?.nome ?? null,
        vinculo: entry.vinculo,
        totalCents: entry.totalCents,
        status: entry.status,
        contractualDueDate: entry.contractualDueDate,
        operationalSuggestedDate: entry.operationalSuggestedDate,
        scheduledPaymentDate: entry.scheduledPaymentDate,
        actualPaymentDate: entry.actualPaymentDate,
        componentes: entry.componentes.map((c) => ({
          id: c.id,
          tipo: c.tipo,
          valorCents: c.valorCents,
          percentual: c.percentual,
          memoriaCalculoJson: c.memoriaCalculoJson,
        })),
      };

      totalGeralCents += entry.totalCents;

      const setorNormalizado = setorRow?.nome?.trim().toUpperCase() ?? "";
      if (setorNormalizado === "COMERCIAL") {
        setorComercial.push(entryResumo);
      } else if (setorNormalizado === "OPERACIONAL") {
        setorOperacional.push(entryResumo);
      } else {
        semSetor.push(entryResumo);
      }
    }

    const result: EventoComLancamentosResult = {
      event: {
        id: event.id,
        eventType: event.eventType,
        cnpj: event.cnpj,
        razaoSocial: event.razaoSocial,
        nomeFantasia: event.nomeFantasia,
        servico: event.servico,
        eventDate: event.eventDate,
        formaPagamento: event.formaPagamento,
        grossContractAmountCents: event.grossContractAmountCents,
        netContractAmountCents: event.netContractAmountCents,
        commissionableBaseCents: event.commissionableBaseCents,
        status: event.status,
      },
      divergencias,
      setorComercial,
      setorOperacional,
      semSetor,
      totalGeralCents,
    };

    return { success: true, data: result } as const;
  } catch (error) {
    console.error("[BuscarEventoComLancamentos]", error);
    return { success: false, error: "Erro interno ao buscar evento" } as const;
  }
}

// ─── Dados auxiliares para o modal de detalhes ───

const buscarEntrySchema = z.object({ entryId: z.string().min(1) });

export async function BuscarDetalhesLancamento(input: z.infer<typeof buscarEntrySchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = buscarEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const entry = await db.commissionEntry.findUnique({
      where: { id: parsed.data.entryId },
      include: { componentes: true, ajustes: true, alocacoes: { include: { payment: true } } },
    });
    if (!entry) return { success: false, error: "Lançamento não encontrado" } as const;

    const auditoria = await db.commissionAuditLog.findMany({
      where: { entityType: "CommissionEntry", entityId: entry.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { success: true, data: { entry, auditoria } } as const;
  } catch (error) {
    console.error("[BuscarDetalhesLancamento]", error);
    return { success: false, error: "Erro interno ao buscar detalhes" } as const;
  }
}

// ─── Ajuste manual (seção 30 do prompt original — nunca altera componentes originais) ───

const criarAjusteManualSchema = z.object({
  entryId: z.string().min(1),
  valorAjustadoCents: z.number().int(),
  justificativa: z.string().min(10, "Justificativa deve ter ao menos 10 caracteres"),
});

/**
 * Registra um ajuste manual sobre um lançamento — NUNCA sobrescreve ou remove os
 * EntryComponent originais (comissão/prêmio/DSR calculados pelo motor de regras). O ajuste
 * entra como um EntryComponent adicional do tipo "AJUSTE" (diferença entre o valor atual e
 * o valor ajustado desejado) e o total do lançamento é recalculado a partir da soma de
 * todos os componentes. Fica pendente de aprovação (`aprovadoById`/`aprovadoEm` nulos) —
 * este endpoint apenas registra a solicitação, aprovação é uma ação separada.
 */
export async function CriarAjusteManual(input: z.infer<typeof criarAjusteManualSchema>) {
  const acesso = await exigirAcesso();
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarAjusteManualSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { entryId, valorAjustadoCents, justificativa } = parsed.data;

  try {
    const entry = await db.commissionEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: "Lançamento não encontrado" } as const;

    if (entry.status === "Pago" || entry.status === "Estornado") {
      return {
        success: false,
        error: "Não é possível ajustar um lançamento já pago ou estornado — reverta o pagamento primeiro.",
      } as const;
    }

    const valorOriginalCents = entry.totalCents;
    const diferencaCents = valorAjustadoCents - valorOriginalCents;

    const resultado = await db.$transaction(async (tx) => {
      const ajuste = await tx.manualAdjustment.create({
        data: {
          entryId,
          valorOriginalCents,
          valorAjustadoCents,
          justificativa,
          createdById: acesso.userId,
        },
      });

      await tx.entryComponent.create({
        data: {
          entryId,
          tipo: "AJUSTE",
          valorCents: diferencaCents,
          percentual: null,
          memoriaCalculoJson: JSON.stringify({
            reason: `Ajuste manual: ${justificativa}`,
            valorOriginalCents,
            valorAjustadoCents,
          }),
        },
      });

      const entryAtualizado = await tx.commissionEntry.update({
        where: { id: entryId },
        data: { totalCents: valorAjustadoCents },
      });

      return { ajuste, entryAtualizado };
    });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "CRIAR_AJUSTE_MANUAL",
      entityId: entryId,
      before: { totalCents: valorOriginalCents },
      after: { totalCents: valorAjustadoCents, justificativa, ajusteId: resultado.ajuste.id },
    });

    return { success: true, data: resultado } as const;
  } catch (error) {
    console.error("[CriarAjusteManual]", error);
    return { success: false, error: "Erro interno ao criar ajuste manual" } as const;
  }
}
