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
  saldoPagoCents: number;
  saldoPendenteCents: number;
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
    processStatus: string | null;
    dataContratacao: Date | null;
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
  totalPendenteCents: number;
}

const buscarEventoSchema = z.object({ eventId: z.string().min(1) });
const buscarEventosLoteSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function BuscarEventosComLancamentosEmLote(input: z.infer<typeof buscarEventosLoteSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = buscarEventosLoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Eventos inválidos" } as const;

  try {
    const eventIds = [...new Set(parsed.data.eventIds)];
    const events = await db.commissionEvent.findMany({ where: { id: { in: eventIds } } });
    const [entries, divergencias] = await Promise.all([
      db.commissionEntry.findMany({
        where: { eventId: { in: eventIds } },
        include: {
          componentes: true,
          alocacoes: { select: { valorCents: true } },
        },
      }),
      db.commissionDivergence.findMany({
        where: { eventId: { in: eventIds }, resolvidoEm: null, tipo: { not: "SERVICO_SEM_TARIFARIO" } },
        select: { id: true, eventId: true, tipo: true, severidade: true, detalhes: true },
      }),
    ]);

    const usuarioIds = [
      ...new Set([
        ...entries.map((entry) => entry.collaboratorId),
        ...events.flatMap((event) => [event.closerUsuarioId, event.analistaResponsavelUsuarioId]).filter((id): id is number => id !== null),
      ]),
    ];
    const processIds = [...new Set(events.map((event) => event.businessProcessId).filter((id): id is string => Boolean(id)))];
    const contratoIds = [...new Set(events.map((event) => event.contratoComercialId).filter((id): id is string => Boolean(id)))];
    const clienteServicoIds = [...new Set(events.map((event) => event.clienteServicoId).filter((id): id is number => id !== null))];

    const [usuarios, processos, eventosContratacao] = await Promise.all([
      usuarioIds.length
        ? db.usuarios.findMany({
            where: { id: { in: usuarioIds } },
            select: { id: true, nome: true, cargo: true, role: true },
          })
        : [],
      processIds.length
        ? db.businessProcess.findMany({
            where: { id: { in: processIds } },
            select: { id: true, dataExito: true, tentativas: true, deferidoPrimeiraTentativa: true, status: true },
          })
        : [],
      contratoIds.length || clienteServicoIds.length
        ? db.commissionEvent.findMany({
            where: {
              eventType: "CONTRACTING",
              OR: [
                ...(contratoIds.length ? [{ contratoComercialId: { in: contratoIds } }] : []),
                ...(clienteServicoIds.length ? [{ clienteServicoId: { in: clienteServicoIds } }] : []),
              ],
            },
            orderBy: { eventDate: "asc" },
          })
        : [],
    ]);

    const cargosNomes = [...new Set(usuarios.map((usuario) => usuario.cargo).filter((cargo): cargo is string => Boolean(cargo)))];
    const cargos = cargosNomes.length
      ? await db.cargoColaborador.findMany({
          where: { nome: { in: cargosNomes } },
          select: { nome: true, setorId: true },
        })
      : [];
    const setorIds = [...new Set(cargos.map((cargo) => cargo.setorId).filter((id): id is number => id !== null))];
    const setores = setorIds.length
      ? await db.setor.findMany({ where: { id: { in: setorIds } }, select: { id: true, nome: true } })
      : [];

    const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
    const processosPorId = new Map(processos.map((processo) => [processo.id, processo]));
    const cargosPorNome = new Map(cargos.map((cargo) => [cargo.nome, cargo]));
    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor.nome]));
    const entriesPorEvento = new Map<string, typeof entries>();
    const divergenciasPorEvento = new Map<string, Array<(typeof divergencias)[number]>>();
    for (const entry of entries) {
      const lista = entriesPorEvento.get(entry.eventId) ?? [];
      lista.push(entry);
      entriesPorEvento.set(entry.eventId, lista);
    }
    for (const divergencia of divergencias) {
      if (!divergencia.eventId) continue;
      const lista = divergenciasPorEvento.get(divergencia.eventId) ?? [];
      lista.push(divergencia);
      divergenciasPorEvento.set(divergencia.eventId, lista);
    }

    const eventosPorId = new Map(events.map((event) => [event.id, event]));
    const resultados: EventoComLancamentosResult[] = [];
    for (const eventId of eventIds) {
      const event = eventosPorId.get(eventId);
      if (!event) continue;
      const processo = event.businessProcessId ? processosPorId.get(event.businessProcessId) : null;
      const contratacao = event.eventType === "CONTRACTING"
        ? event
        : eventosContratacao.find(
            (item) =>
              (event.contratoComercialId && item.contratoComercialId === event.contratoComercialId) ||
              (event.clienteServicoId !== null && item.clienteServicoId === event.clienteServicoId),
          );
      const setorComercial: CommissionEntryComColaborador[] = [];
      const setorOperacional: CommissionEntryComColaborador[] = [];
      const semSetor: CommissionEntryComColaborador[] = [];
      let totalGeralCents = 0;
      let totalPendenteCents = 0;

      for (const entry of entriesPorEvento.get(event.id) ?? []) {
        const usuario = usuariosPorId.get(entry.collaboratorId);
        const role = usuario?.role?.trim().toUpperCase();
        let setorNome = role === "COMERCIAL" ? "Comercial" : role === "OPERACIONAL" ? "Operacional" : null;
        if (!setorNome && usuario?.cargo) {
          const setorId = cargosPorNome.get(usuario.cargo)?.setorId;
          setorNome = setorId ? (setoresPorId.get(setorId) ?? null) : null;
        }
        const saldoPagoCents = entry.alocacoes.reduce((total, alocacao) => total + alocacao.valorCents, 0);
        const saldoPendenteCents = Math.max(0, entry.totalCents - saldoPagoCents);
        const resumo: CommissionEntryComColaborador = {
          id: entry.id,
          collaboratorId: entry.collaboratorId,
          colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
          cargoNome: usuario?.cargo ?? null,
          setorNome,
          vinculo: entry.vinculo,
          totalCents: entry.totalCents,
          saldoPagoCents,
          saldoPendenteCents,
          status: entry.status,
          contractualDueDate: entry.contractualDueDate,
          operationalSuggestedDate: entry.operationalSuggestedDate,
          scheduledPaymentDate: entry.scheduledPaymentDate,
          actualPaymentDate: entry.actualPaymentDate,
          componentes: entry.componentes.map((componente) => ({
            id: componente.id,
            tipo: componente.tipo,
            valorCents: componente.valorCents,
            percentual: componente.percentual,
            memoriaCalculoJson: componente.memoriaCalculoJson,
          })),
        };
        totalGeralCents += entry.totalCents;
        totalPendenteCents += saldoPendenteCents;
        if (setorNome?.toUpperCase() === "COMERCIAL") setorComercial.push(resumo);
        else if (setorNome?.toUpperCase() === "OPERACIONAL") setorOperacional.push(resumo);
        else semSetor.push(resumo);
      }

      const closer = event.closerUsuarioId ? usuariosPorId.get(event.closerUsuarioId) : null;
      const analista = event.analistaResponsavelUsuarioId ? usuariosPorId.get(event.analistaResponsavelUsuarioId) : null;
      resultados.push({
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
          processStatus: processo?.status ?? null,
          dataContratacao: contratacao?.eventDate ?? null,
          closerNome: closer?.nome ?? event.closerNomeManual,
          closerViaUsuario: Boolean(closer),
          analistaResponsavelNome: analista?.nome ?? event.analistaResponsavelNomeManual,
          analistaResponsavelViaUsuario: Boolean(analista),
          dataExito: processo?.dataExito ?? null,
          tentativas: processo?.tentativas ?? null,
          deferidoPrimeiraTentativa: processo?.deferidoPrimeiraTentativa ?? null,
        },
        divergencias: (divergenciasPorEvento.get(event.id) ?? []).map(({ id, tipo, severidade, detalhes }) => ({ id, tipo, severidade, detalhes })),
        setorComercial,
        setorOperacional,
        semSetor,
        totalGeralCents,
        totalPendenteCents,
      });
    }

    return { success: true, data: resultados } as const;
  } catch (error) {
    console.error("[BuscarEventosComLancamentosEmLote]", error);
    return { success: false, error: "Erro interno ao carregar os eventos" } as const;
  }
}

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

    const [entries, divergencias, closerResolvido, analistaResolvido, businessProcess, eventoContratacao] = await Promise.all([
      db.commissionEntry.findMany({
        where: { eventId: event.id },
        include: {
          componentes: true,
          alocacoes: { select: { valorCents: true } },
        },
      }),
      db.commissionDivergence.findMany({
        where: { eventId: event.id, resolvidoEm: null, tipo: { not: "SERVICO_SEM_TARIFARIO" } },
        select: { id: true, tipo: true, severidade: true, detalhes: true },
      }),
      resolverNomeResponsavel(event.closerUsuarioId, event.closerNomeManual),
      resolverNomeResponsavel(event.analistaResponsavelUsuarioId, event.analistaResponsavelNomeManual),
      event.businessProcessId
        ? db.businessProcess.findUnique({
            where: { id: event.businessProcessId },
            select: { dataExito: true, tentativas: true, deferidoPrimeiraTentativa: true, status: true },
          })
        : Promise.resolve(null),
      event.eventType === "CONTRACTING"
        ? Promise.resolve(event)
        : event.contratoComercialId
          ? db.commissionEvent.findFirst({
              where: {
                contratoComercialId: event.contratoComercialId,
                eventType: "CONTRACTING",
              },
              orderBy: { eventDate: "asc" },
            })
          : Promise.resolve(null),
    ]);

    const collaboratorIds = [...new Set(entries.map((entry) => entry.collaboratorId))];
    const usuarios = collaboratorIds.length
      ? await db.usuarios.findMany({
          where: { id: { in: collaboratorIds } },
          select: { id: true, nome: true, cargo: true, role: true },
        })
      : [];
    const usuariosPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));

    const cargosNomes = [...new Set(usuarios.map((usuario) => usuario.cargo).filter((cargo): cargo is string => Boolean(cargo)))];
    const cargos = cargosNomes.length
      ? await db.cargoColaborador.findMany({
          where: { nome: { in: cargosNomes } },
          select: { nome: true, setorId: true },
        })
      : [];
    const cargosPorNome = new Map(cargos.map((cargo) => [cargo.nome, cargo]));
    const setorIds = [...new Set(cargos.map((cargo) => cargo.setorId).filter((id): id is number => id !== null))];
    const setores = setorIds.length
      ? await db.setor.findMany({
          where: { id: { in: setorIds } },
          select: { id: true, nome: true },
        })
      : [];
    const setoresPorId = new Map(setores.map((setor) => [setor.id, setor.nome]));

    const setorComercial: CommissionEntryComColaborador[] = [];
    const setorOperacional: CommissionEntryComColaborador[] = [];
    const semSetor: CommissionEntryComColaborador[] = [];
    let totalGeralCents = 0;
    let totalPendenteCents = 0;

    for (const entry of entries) {
      const usuario = usuariosPorId.get(entry.collaboratorId);

      // Setor: prioriza `usuarios.role` (fonte real usada pelo módulo Gestão de Equipe —
      // já vem preenchido como "COMERCIAL"/"OPERACIONAL" para todo colaborador). Só cai
      // para CargoColaborador.setorId (cadastro específico do módulo de Comissões) quando
      // o role não for um dos dois setores reconhecidos — nunca o contrário, para não
      // depender de um cadastro paralelo que pode não ter sido preenchido.
      const roleNormalizado = usuario?.role?.trim().toUpperCase() ?? "";
      let setorNome: string | null =
        roleNormalizado === "COMERCIAL" ? "Comercial" : roleNormalizado === "OPERACIONAL" ? "Operacional" : null;

      if (!setorNome && usuario?.cargo) {
        const setorId = cargosPorNome.get(usuario.cargo)?.setorId;
        setorNome = setorId ? (setoresPorId.get(setorId) ?? null) : null;
      }

      const saldoPagoCents = entry.alocacoes.reduce((total, alocacao) => total + alocacao.valorCents, 0);
      const saldoPendenteCents = Math.max(0, entry.totalCents - saldoPagoCents);
      const entryResumo: CommissionEntryComColaborador = {
        id: entry.id,
        collaboratorId: entry.collaboratorId,
        colaboradorNome: usuario?.nome ?? "Colaborador não encontrado",
        cargoNome: usuario?.cargo ?? null,
        setorNome,
        vinculo: entry.vinculo,
        totalCents: entry.totalCents,
        saldoPagoCents,
        saldoPendenteCents,
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
      totalPendenteCents += saldoPendenteCents;

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
        processStatus: businessProcess?.status ?? null,
        dataContratacao: eventoContratacao?.eventDate ?? null,
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
      totalPendenteCents,
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
    const colaborador = await db.usuarios.findUnique({
      where: { id: entry.collaboratorId },
      select: { nome: true, cargo: true },
    });
    const saldoPagoCents = entry.alocacoes.reduce(
      (total, alocacao) => total + alocacao.valorCents,
      0,
    );

    return {
      success: true,
      data: {
        entry,
        colaboradorNome: colaborador?.nome ?? "Colaborador não encontrado",
        cargoNome: colaborador?.cargo ?? null,
        saldoPagoCents,
        saldoPendenteCents: Math.max(0, entry.totalCents - saldoPagoCents),
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
