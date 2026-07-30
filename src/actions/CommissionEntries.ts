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
  entityType: "CommissionEntry" | "CommissionEvent";
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

/**
 * Resolve o nome de exibição de um responsável (closer/analista) a partir de FK real
 * (preferível — usuário existente, navegável) ou nome manual/texto herdado. Nunca inventa
 * um nome: se nada estiver preenchido, retorna null e a UI mostra "Não Atribuído".
 */
async function resolverNomeResponsavel(usuarioId: number | null, nomeManual: string | null): Promise<{ nome: string | null; viaUsuario: boolean }> {
  if (usuarioId !== null) {
    const usuario = await db.usuarios.findUnique({ where: { id: usuarioId }, select: { nome: true } });
    if (usuario) return { nome: usuario.nome, viaUsuario: true };
  }
  return { nome: nomeManual, viaUsuario: false };
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
    /** null quando não há closer atribuído nem por FK nem por texto manual — UI deve exibir "Não Atribuído". */
    closerNome: string | null;
    /** true quando o nome veio de closerUsuarioId (FK real, navegável); false quando é texto manual/herdado de fonte externa. */
    closerViaUsuario: boolean;
    analistaResponsavelNome: string | null;
    analistaResponsavelViaUsuario: boolean;
    /**
     * Campos específicos de evento de êxito (eventType=PROCESS_SUCCESS) — vêm do
     * BusinessProcess vinculado. null quando não há BusinessProcess correspondente (mesmo
     * caso que gera a divergência EXITO_SEM_BUSINESS_PROCESS/PRIMEIRA_TENTATIVA_INCONSISTENTE
     * na sincronização) — UI deve exibir "Não informado", nunca inventar um valor.
     */
    dataExito: Date | null;
    tentativas: number | null;
    deferidoPrimeiraTentativa: boolean | null;
  };
  divergencias: Array<{ id: string; tipo: string; severidade: string; detalhes: string }>;
  setorComercial: CommissionEntryComColaborador[];
  setorOperacional: CommissionEntryComColaborador[];
  semSetor: CommissionEntryComColaborador[];
  totalGeralCents: number;
}

const buscarEventoSchema = z.object({ eventId: z.string().min(1) });

export async function BuscarEventoComLancamentos(input: z.infer<typeof buscarEventoSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = buscarEventoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const event = await db.commissionEvent.findUnique({ where: { id: parsed.data.eventId } });
    if (!event) return { success: false, error: "Evento não encontrado" } as const;

    const [entries, divergencias, closerResolvido, analistaResolvido, businessProcess] = await Promise.all([
      db.commissionEntry.findMany({
        where: { eventId: event.id },
        include: { componentes: true },
      }),
      db.commissionDivergence.findMany({
        where: { eventId: event.id, resolvidoEm: null },
        select: { id: true, tipo: true, severidade: true, detalhes: true },
      }),
      resolverNomeResponsavel(event.closerUsuarioId, event.closerNomeManual),
      resolverNomeResponsavel(event.analistaResponsavelUsuarioId, event.analistaResponsavelNomeManual),
      event.businessProcessId
        ? db.businessProcess.findUnique({
            where: { id: event.businessProcessId },
            select: { dataExito: true, tentativas: true, deferidoPrimeiraTentativa: true },
          })
        : Promise.resolve(null),
    ]);

    const setorComercial: CommissionEntryComColaborador[] = [];
    const setorOperacional: CommissionEntryComColaborador[] = [];
    const semSetor: CommissionEntryComColaborador[] = [];
    let totalGeralCents = 0;

    for (const entry of entries) {
      const usuario = await db.usuarios.findUnique({
        where: { id: entry.collaboratorId },
        select: { nome: true, cargo: true, role: true },
      });

      // Setor: prioriza `usuarios.role` (fonte real usada pelo módulo Gestão de Equipe —
      // já vem preenchido como "COMERCIAL"/"OPERACIONAL" para todo colaborador). Só cai
      // para CargoColaborador.setorId (cadastro específico do módulo de Comissões) quando
      // o role não for um dos dois setores reconhecidos — nunca o contrário, para não
      // depender de um cadastro paralelo que pode não ter sido preenchido.
      const roleNormalizado = usuario?.role?.trim().toUpperCase() ?? "";
      let setorNome: string | null =
        roleNormalizado === "COMERCIAL" ? "Comercial" : roleNormalizado === "OPERACIONAL" ? "Operacional" : null;

      if (!setorNome && usuario?.cargo) {
        const cargoRow = await db.cargoColaborador.findUnique({
          where: { nome: usuario.cargo },
          select: { setorId: true },
        });
        const setorRow = cargoRow?.setorId
          ? await db.setor.findUnique({ where: { id: cargoRow.setorId }, select: { nome: true } })
          : null;
        setorNome = setorRow?.nome ?? null;
      }

      const entryResumo: CommissionEntryComColaborador = {
        id: entry.id,
        collaboratorId: entry.collaboratorId,
        colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
        cargoNome: usuario?.cargo ?? null,
        setorNome,
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

      const setorNormalizado = setorNome?.trim().toUpperCase() ?? "";
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
        closerNome: closerResolvido.nome,
        closerViaUsuario: closerResolvido.viaUsuario,
        analistaResponsavelNome: analistaResolvido.nome,
        analistaResponsavelViaUsuario: analistaResolvido.viaUsuario,
        dataExito: businessProcess?.dataExito ?? null,
        tentativas: businessProcess?.tentativas ?? null,
        deferidoPrimeiraTentativa: businessProcess?.deferidoPrimeiraTentativa ?? null,
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

// ─── Preenchimento manual de closer/analista responsável ───

const atualizarResponsaveisSchema = z
  .object({
    eventId: z.string().min(1),
    closerUsuarioId: z.number().int().positive().nullable().optional(),
    closerNomeManual: z.string().min(1).nullable().optional(),
    analistaResponsavelUsuarioId: z.number().int().positive().nullable().optional(),
    analistaResponsavelNomeManual: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) =>
      data.closerUsuarioId !== undefined ||
      data.closerNomeManual !== undefined ||
      data.analistaResponsavelUsuarioId !== undefined ||
      data.analistaResponsavelNomeManual !== undefined,
    { message: "Informe ao menos um campo para atualizar." },
  );

/**
 * Preenche/corrige manualmente closer e/ou analista responsável de um evento — usado
 * quando a sincronização automática não trouxe o dado (exibido como "Não Atribuído" na
 * UI). Ao informar um `*UsuarioId`, o campo `*NomeManual` correspondente é sempre limpo
 * (nunca guarda os dois ao mesmo tempo — FK real sempre tem precedência sobre texto).
 */
export async function AtualizarResponsaveisEvento(input: z.infer<typeof atualizarResponsaveisSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = atualizarResponsaveisSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { eventId, closerUsuarioId, closerNomeManual, analistaResponsavelUsuarioId, analistaResponsavelNomeManual } = parsed.data;

  try {
    const event = await db.commissionEvent.findUnique({ where: { id: eventId } });
    if (!event) return { success: false, error: "Evento não encontrado" } as const;

    if (closerUsuarioId !== undefined && closerUsuarioId !== null) {
      const usuario = await db.usuarios.findUnique({ where: { id: closerUsuarioId }, select: { id: true } });
      if (!usuario) return { success: false, error: "Colaborador informado como closer não encontrado" } as const;
    }
    if (analistaResponsavelUsuarioId !== undefined && analistaResponsavelUsuarioId !== null) {
      const usuario = await db.usuarios.findUnique({ where: { id: analistaResponsavelUsuarioId }, select: { id: true } });
      if (!usuario) return { success: false, error: "Colaborador informado como analista responsável não encontrado" } as const;
    }

    const data: Record<string, unknown> = {};
    if (closerUsuarioId !== undefined) {
      data.closerUsuarioId = closerUsuarioId;
      data.closerNomeManual = closerUsuarioId !== null ? null : (closerNomeManual ?? event.closerNomeManual);
    } else if (closerNomeManual !== undefined) {
      data.closerNomeManual = closerNomeManual;
      data.closerUsuarioId = null;
    }

    if (analistaResponsavelUsuarioId !== undefined) {
      data.analistaResponsavelUsuarioId = analistaResponsavelUsuarioId;
      data.analistaResponsavelNomeManual = analistaResponsavelUsuarioId !== null ? null : (analistaResponsavelNomeManual ?? event.analistaResponsavelNomeManual);
    } else if (analistaResponsavelNomeManual !== undefined) {
      data.analistaResponsavelNomeManual = analistaResponsavelNomeManual;
      data.analistaResponsavelUsuarioId = null;
    }

    const atualizado = await db.commissionEvent.update({ where: { id: eventId }, data });

    await registrarAuditoria({
      userId: acesso.userId,
      acao: "ATUALIZAR_RESPONSAVEIS_EVENTO",
      entityType: "CommissionEvent",
      entityId: eventId,
      before: {
        closerUsuarioId: event.closerUsuarioId,
        closerNomeManual: event.closerNomeManual,
        analistaResponsavelUsuarioId: event.analistaResponsavelUsuarioId,
        analistaResponsavelNomeManual: event.analistaResponsavelNomeManual,
      },
      after: {
        closerUsuarioId: atualizado.closerUsuarioId,
        closerNomeManual: atualizado.closerNomeManual,
        analistaResponsavelUsuarioId: atualizado.analistaResponsavelUsuarioId,
        analistaResponsavelNomeManual: atualizado.analistaResponsavelNomeManual,
      },
    });

    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AtualizarResponsaveisEvento]", error);
    return { success: false, error: "Erro interno ao atualizar responsáveis" } as const;
  }
}

// ─── Dados auxiliares para o modal de detalhes ───

const buscarEntrySchema = z.object({ entryId: z.string().min(1) });

export async function BuscarDetalhesLancamento(input: z.infer<typeof buscarEntrySchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
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

    const [auditoria, event] = await Promise.all([
      db.commissionAuditLog.findMany({
        where: { entityType: "CommissionEntry", entityId: entry.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.commissionEvent.findUnique({ where: { id: entry.eventId } }),
    ]);

    const [closerResolvido, analistaResolvido] = await Promise.all([
      event ? resolverNomeResponsavel(event.closerUsuarioId, event.closerNomeManual) : Promise.resolve({ nome: null, viaUsuario: false }),
      event ? resolverNomeResponsavel(event.analistaResponsavelUsuarioId, event.analistaResponsavelNomeManual) : Promise.resolve({ nome: null, viaUsuario: false }),
    ]);

    return {
      success: true,
      data: {
        entry,
        auditoria,
        eventId: entry.eventId,
        closerNome: closerResolvido.nome,
        closerViaUsuario: closerResolvido.viaUsuario,
        analistaResponsavelNome: analistaResolvido.nome,
        analistaResponsavelViaUsuario: analistaResolvido.viaUsuario,
      },
    } as const;
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
  const acesso = await exigirAcesso("PAGAR");
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
      entityType: "CommissionEntry",
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
